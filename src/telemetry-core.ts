import Docker from 'dockerode';
import { readFile } from 'node:fs/promises';

export type ContainerTelemetry = {
  available: boolean;
  cpu: number | null;
  memory: number | null;
  memoryLimit: number | null;
  containerName: string | null;
  candidates: string[];
  message: string;
};

export type GpuTelemetry = {
  available: boolean;
  percent: number | null;
  vendor: string | null;
  message: string;
};

export type GpuConfig = { url?: string; metricName?: string; scale?: number; vendor?: string };

export function createDockerClient(host = process.env.DOCKER_HOST) {
  if (!host) return new Docker({ socketPath: '/var/run/docker.sock' });
  if (host.startsWith('unix://')) return new Docker({ socketPath: host.slice('unix://'.length) });
  const parsed = new URL(host.replace(/^tcp:/, 'http:'));
  return new Docker({ protocol: parsed.protocol.replace(':', '') as 'http' | 'https', host: parsed.hostname, port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 2375)) });
}

function cleanName(value: string) { return value.replace(/^\//, ''); }

async function hostCpuSnapshot(procRoot: string) {
  const line = (await readFile(`${procRoot}/stat`, 'utf8')).split(/\r?\n/).find(value => value.startsWith('cpu '));
  if (!line) throw new Error('host CPU counters were not present');
  const values = line.trim().split(/\s+/).slice(1).map(Number), total = values.reduce((sum, value) => sum + value, 0), idle = (values[3] || 0) + (values[4] || 0);
  return { total, idle };
}

export async function collectHostTelemetry(procRoot = '/host/proc'): Promise<ContainerTelemetry> {
  try {
    const first = await hostCpuSnapshot(procRoot);
    await new Promise(resolve => setTimeout(resolve, 250));
    const [second, memoryInfo] = await Promise.all([hostCpuSnapshot(procRoot), readFile(`${procRoot}/meminfo`, 'utf8')]);
    const values = new Map(memoryInfo.split(/\r?\n/).map(line => { const match = line.match(/^([^:]+):\s+(\d+)/); return match ? [match[1], Number(match[2]) * 1024] : ['', 0]; }));
    const memoryLimit = Number(values.get('MemTotal') || 0), memoryAvailable = Number(values.get('MemAvailable') || values.get('MemFree') || 0);
    const totalDelta = second.total - first.total, idleDelta = second.idle - first.idle;
    return {
      available: totalDelta > 0 && memoryLimit > 0,
      cpu: totalDelta > 0 ? Math.min(100, Math.max(0, (totalDelta - idleDelta) / totalDelta * 100)) : null,
      memory: memoryLimit > 0 ? memoryLimit - memoryAvailable : null,
      memoryLimit: memoryLimit || null,
      containerName: 'Host total',
      candidates: [],
      message: 'No Jellyfin container was found; reading whole-host CPU and RAM.'
    };
  } catch (error) {
    return { available: false, cpu: null, memory: null, memoryLimit: null, containerName: null, candidates: [], message: `Host metrics failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}

export async function collectContainerTelemetry(docker: Docker, requestedName?: string): Promise<ContainerTelemetry> {
  try {
    const list = await docker.listContainers(), wanted = requestedName?.trim();
    const jellyfinCandidates = list.filter(c => {
      const text = [...c.Names.map(cleanName), c.Image, ...Object.entries(c.Labels || {}).flat()].join(' ').toLowerCase();
      return text.includes('jellyfin');
    });
    let match = wanted ? list.find(c => c.Names.some(n => cleanName(n) === wanted)) : undefined;
    if (!match && jellyfinCandidates.length === 1) match = jellyfinCandidates[0];
    const candidates = jellyfinCandidates.flatMap(c => c.Names.map(cleanName));
    if (!match) {
      const message = wanted
        ? `Container "${wanted}" was not found on this Docker host.${candidates.length ? ` Detected Jellyfin candidates: ${candidates.join(', ')}.` : ''}`
        : candidates.length > 1
          ? `Multiple Jellyfin containers were detected (${candidates.join(', ')}). Choose one in Telemetry settings.`
          : 'No Jellyfin container was detected on this Docker host.';
      return { available: false, cpu: null, memory: null, memoryLimit: null, containerName: null, candidates, message };
    }
    const stats: any = await docker.getContainer(match.Id).stats({ stream: false });
    const cpuDelta = Number(stats.cpu_stats?.cpu_usage?.total_usage || 0) - Number(stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = Number(stats.cpu_stats?.system_cpu_usage || 0) - Number(stats.precpu_stats?.system_cpu_usage || 0);
    const cores = Number(stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1);
    const containerName = cleanName(match.Names[0] || wanted || 'jellyfin');
    return {
      available: true,
      cpu: systemDelta > 0 ? (cpuDelta / systemDelta) * cores * 100 : 0,
      memory: Number(stats.memory_stats?.usage || 0),
      memoryLimit: Number(stats.memory_stats?.limit || 0),
      containerName,
      candidates,
      message: `Reading Docker stats for ${containerName}.`
    };
  } catch (error) {
    return { available: false, cpu: null, memory: null, memoryLimit: null, containerName: null, candidates: [], message: `Docker metrics failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}

export async function collectGpuTelemetry(config: GpuConfig): Promise<GpuTelemetry> {
  if (!config.url) return { available: false, percent: null, vendor: config.vendor || null, message: 'No GPU exporter is configured. GPU telemetry is optional.' };
  try {
    const response = await fetch(config.url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`exporter returned HTTP ${response.status}`);
    const text = await response.text();
    const candidates = config.metricName ? [config.metricName] : ['DCGM_FI_DEV_GPU_UTIL', 'nvidia_gpu_utilization', 'intel_gpu_usage_percent', 'intel_gpu_engine_busy_percent', 'igpu_engine_busy_percent'];
    const values: Array<{ name: string; value: number }> = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{[^}]*\})?\s+([-+0-9.eE]+)(?:\s+\d+)?$/);
      if (match && candidates.includes(match[1])) {
        const value = Number(match[2]);
        if (Number.isFinite(value)) values.push({ name: match[1], value });
      }
    }
    if (!values.length) throw new Error(`none of these metrics were present: ${candidates.join(', ')}`);
    const scale = Number.isFinite(config.scale) ? Number(config.scale) : 1;
    const percent = Math.min(100, Math.max(0, Math.max(...values.map(x => x.value)) * scale));
    const metric = values[0].name.toLowerCase();
    const vendor = config.vendor || (metric.includes('dcgm') || metric.includes('nvidia') ? 'NVIDIA' : metric.includes('intel') || metric.includes('igpu') ? 'Intel' : 'GPU');
    return { available: true, percent, vendor, message: `Reading ${vendor} utilization from ${values[0].name}.` };
  } catch (error) {
    return { available: false, percent: null, vendor: config.vendor || null, message: `GPU exporter failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}
