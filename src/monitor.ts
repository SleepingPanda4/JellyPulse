import { api, playbackFromSession } from './jellyfin.js';
import { db, getSetting, setSetting } from './db.js';
import { decrypt, encrypt } from './crypto.js';
import { collectContainerTelemetry, collectGpuTelemetry, createDockerClient, type ContainerTelemetry, type GpuTelemetry } from './telemetry-core.js';
import { deliverResolutionMessages } from './resolution-notifications.js';

export type TelemetryMode = 'auto' | 'remote_agent' | 'disabled';
type TelemetryConfig = {
  mode: TelemetryMode;
  containerName: string;
  agentUrl: string;
  agentToken: string;
  gpuUrl: string;
  gpuMetricName: string;
  gpuScale: number;
  gpuVendor: string;
};
type SourceState = { state: 'available' | 'unavailable' | 'not_configured' | 'disabled'; source: string; message: string; detail?: string | null };
type TelemetryState = { updatedAt: string | null; mode: TelemetryMode; resources: SourceState; gpu: SourceState; playback: SourceState };

const docker = createDockerClient();
let configCache: { expiresAt: number; value: TelemetryConfig } | null = null;
let telemetryState: TelemetryState = {
  updatedAt: null,
  mode: 'auto',
  resources: { state: 'unavailable', source: 'Docker', message: 'Waiting for the first telemetry sample.' },
  gpu: { state: 'not_configured', source: 'GPU exporter', message: 'Waiting for the first telemetry sample.' },
  playback: { state: 'unavailable', source: 'Jellyfin API', message: 'Waiting for the first telemetry sample.' }
};

function environmentConfig(): TelemetryConfig {
  const mode = ['auto', 'remote_agent', 'disabled'].includes(process.env.TELEMETRY_MODE || '') ? process.env.TELEMETRY_MODE as TelemetryMode : 'auto';
  return {
    mode,
    containerName: process.env.JELLYFIN_CONTAINER_NAME || 'jellyfin',
    agentUrl: process.env.TELEMETRY_AGENT_URL || '',
    agentToken: process.env.TELEMETRY_AGENT_TOKEN || '',
    gpuUrl: process.env.GPU_METRICS_URL || '',
    gpuMetricName: process.env.GPU_METRIC_NAME || '',
    gpuScale: Number(process.env.GPU_METRIC_SCALE || 1),
    gpuVendor: process.env.GPU_METRICS_VENDOR || ''
  };
}

async function telemetryConfig(force = false): Promise<TelemetryConfig> {
  if (!force && configCache && configCache.expiresAt > Date.now()) return configCache.value;
  let value = environmentConfig();
  const stored = await getSetting('telemetry_config');
  if (stored) {
    try { value = { ...value, ...JSON.parse(decrypt(stored)) }; }
    catch (error) { console.warn('Stored telemetry configuration could not be read:', (error as Error).message); }
  }
  value.gpuScale = Number.isFinite(Number(value.gpuScale)) ? Number(value.gpuScale) : 1;
  configCache = { expiresAt: Date.now() + 30_000, value };
  return value;
}

export async function getTelemetryAdminState() {
  const config = await telemetryConfig();
  return {
    config: {
      mode: config.mode,
      containerName: config.containerName,
      agentUrl: config.agentUrl,
      agentTokenConfigured: Boolean(config.agentToken),
      gpuUrl: config.gpuUrl,
      gpuMetricName: config.gpuMetricName,
      gpuScale: config.gpuScale,
      gpuVendor: config.gpuVendor
    },
    status: telemetryState
  };
}

export async function saveTelemetrySettings(input: Partial<TelemetryConfig>) {
  const current = await telemetryConfig(true);
  const next: TelemetryConfig = {
    ...current,
    ...input,
    agentToken: input.agentToken?.trim() || current.agentToken,
    containerName: input.containerName?.trim() || 'jellyfin',
    agentUrl: input.agentUrl?.trim().replace(/\/$/, '') || '',
    gpuUrl: input.gpuUrl?.trim() || '',
    gpuMetricName: input.gpuMetricName?.trim() || '',
    gpuVendor: input.gpuVendor?.trim() || '',
    gpuScale: Number.isFinite(Number(input.gpuScale)) ? Number(input.gpuScale) : 1
  };
  await setSetting('telemetry_config', encrypt(JSON.stringify(next)));
  configCache = null;
}

export async function collectPlayback() {
  try {
    const sessions = await (await api('/Sessions?ActiveWithinSeconds=300')).json() as any[];
    for (const s of sessions.filter(x => x.NowPlayingItem && x.UserId)) {
      const p = playbackFromSession(s), itemId = String(s.NowPlayingItem.Id || `${s.NowPlayingItem.Type}:${s.NowPlayingItem.Name}`);
      await db.query('INSERT INTO recent_playback(user_id,username,payload,last_seen) VALUES($1,$2,$3,now()) ON CONFLICT(user_id) DO UPDATE SET username=EXCLUDED.username,payload=EXCLUDED.payload,last_seen=now()', [s.UserId, s.UserName, JSON.stringify(p)]);
      await db.query(`
        WITH current_entry AS (
          SELECT id FROM watch_history
          WHERE user_id=$1 AND item_id=$2 AND last_seen > now()-interval '10 minutes'
          ORDER BY last_seen DESC LIMIT 1
        ), updated AS (
          UPDATE watch_history SET username=$3,payload=$4,last_seen=now(),observed_seconds=observed_seconds+$5
          WHERE id=(SELECT id FROM current_entry) RETURNING id
        )
        INSERT INTO watch_history(user_id,username,item_id,payload,observed_seconds)
        SELECT $1,$3,$2,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM updated)
      `, [s.UserId, itemId, s.UserName || 'Unknown user', JSON.stringify(p), s.PlayState?.IsPaused ? 0 : 30]);
    }
    await deliverResolutionMessages(sessions);
  } catch (e) { console.warn('Playback poll failed:', (e as Error).message); }
}

function unavailableContainer(message: string): ContainerTelemetry {
  return { available: false, cpu: null, memory: null, memoryLimit: null, containerName: null, candidates: [], message };
}
function unavailableGpu(message: string): GpuTelemetry { return { available: false, percent: null, vendor: null, message }; }

async function remoteAgentMetrics(config: TelemetryConfig): Promise<{ container: ContainerTelemetry; gpu: GpuTelemetry }> {
  if (!config.agentUrl || !config.agentToken) return { container: unavailableContainer('Enter both the remote agent URL and token.'), gpu: unavailableGpu('Remote agent setup is incomplete.') };
  try {
    const endpoint = config.agentUrl.endsWith('/metrics') ? config.agentUrl : `${config.agentUrl}/metrics`;
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${config.agentToken}` }, signal: AbortSignal.timeout(7_000) });
    if (!response.ok) throw new Error(`agent returned HTTP ${response.status}`);
    const data = await response.json() as any;
    if (!data?.container || !data?.gpu) throw new Error('agent response did not contain telemetry data');
    return { container: data.container as ContainerTelemetry, gpu: data.gpu as GpuTelemetry };
  } catch (error) {
    const message = `Remote telemetry agent failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    return { container: unavailableContainer(message), gpu: unavailableGpu(message) };
  }
}

async function streamMetrics() {
  try {
    const response = await api('/Sessions?ActiveWithinSeconds=300');
    if (!response.ok) throw new Error(`Jellyfin returned HTTP ${response.status}`);
    const sessions = await response.json() as any[];
    const streams = sessions.filter(s => s.NowPlayingItem).map(s => {
      const t = s.TranscodingInfo, mode = !t ? 'Direct Play' : t.IsVideoDirect && t.IsAudioDirect ? 'Remux' : 'Transcode';
      return { username: s.UserName || 'Unknown user', itemName: s.NowPlayingItem?.Name || 'Unknown item', seriesName: s.NowPlayingItem?.SeriesName || null, mode, videoCodec: t?.VideoCodec || null, audioCodec: t?.AudioCodec || null, container: t?.Container || null, bitrate: t?.Bitrate ?? null, framerate: t?.Framerate ?? null, completionPercentage: t?.CompletionPercentage ?? null, width: t?.Width ?? null, height: t?.Height ?? null, hardwareAccelerationType: t?.HardwareAccelerationType || null, reasons: t?.TranscodeReasons || [] };
    });
    return { available: true, message: `${streams.length} active stream${streams.length === 1 ? '' : 's'} reported by Jellyfin.`, streams, direct: streams.filter(x => x.mode === 'Direct Play').length, remux: streams.filter(x => x.mode === 'Remux').length, transcode: streams.filter(x => x.mode === 'Transcode').length };
  } catch (e) {
    const message = `Jellyfin session telemetry failed: ${(e as Error).message}`;
    console.warn(message);
    return { available: false, message, streams: [], direct: null, remux: null, transcode: null };
  }
}

export async function collectMetrics() {
  const config = await telemetryConfig();
  let resources: ContainerTelemetry, gpu: GpuTelemetry;
  if (config.mode === 'disabled') {
    resources = unavailableContainer('Host resource telemetry is disabled.');
    gpu = unavailableGpu('GPU telemetry is disabled.');
  } else if (config.mode === 'remote_agent') {
    ({ container: resources, gpu } = await remoteAgentMetrics(config));
  } else {
    [resources, gpu] = await Promise.all([
      collectContainerTelemetry(docker, config.containerName),
      collectGpuTelemetry({ url: config.gpuUrl, metricName: config.gpuMetricName, scale: config.gpuScale, vendor: config.gpuVendor })
    ]);
  }
  const playback = await streamMetrics();
  const disabled = config.mode === 'disabled';
  telemetryState = {
    updatedAt: new Date().toISOString(),
    mode: config.mode,
    resources: { state: disabled ? 'disabled' : resources.available ? 'available' : 'unavailable', source: config.mode === 'remote_agent' ? 'Remote agent' : 'Docker', message: resources.message, detail: resources.containerName },
    gpu: { state: disabled ? 'disabled' : gpu.available ? 'available' : config.mode === 'auto' && !config.gpuUrl ? 'not_configured' : 'unavailable', source: config.mode === 'remote_agent' ? 'Remote agent' : 'Prometheus exporter', message: gpu.message, detail: gpu.vendor },
    playback: { state: playback.available ? 'available' : 'unavailable', source: 'Jellyfin API', message: playback.message }
  };
  try {
    const streamCount = playback.direct === null ? null : Number(playback.direct) + Number(playback.remux) + Number(playback.transcode);
    await db.query('INSERT INTO metric_samples(cpu_percent,memory_bytes,memory_limit,gpu_percent,gpu_vendor,stream_count,direct_play_count,remux_count,transcode_count,transcode_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [resources.cpu, resources.memory, resources.memoryLimit, gpu.percent, gpu.vendor, streamCount, playback.direct, playback.remux, playback.transcode, JSON.stringify(playback.streams)]);
  } catch (e) { console.warn('Metrics storage failed:', (e as Error).message); }
  return telemetryState;
}
