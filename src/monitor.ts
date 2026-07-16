import Docker from 'dockerode';
import { api, playbackFromSession } from './jellyfin.js';
import { db } from './db.js';
import { deliverResolutionMessages } from './resolution-notifications.js';

const docker = new Docker({ protocol: 'http', host: 'docker-proxy', port: 2375 });
let lastGpuWarning = 0;

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

async function containerMetrics() {
  try {
    const list = await docker.listContainers(), name = process.env.JELLYFIN_CONTAINER_NAME || 'jellyfin';
    const match = list.find(c => c.Names.some(n => n.replace(/^\//, '') === name));
    if (!match) return { cpu: null, memory: null, memoryLimit: null };
    const s: any = await docker.getContainer(match.Id).stats({ stream: false });
    const cpuDelta = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
    const systemDelta = s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
    const cores = s.cpu_stats.online_cpus || s.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    return { cpu: systemDelta > 0 ? (cpuDelta / systemDelta) * cores * 100 : 0, memory: s.memory_stats.usage || 0, memoryLimit: s.memory_stats.limit || 0 };
  } catch (e) { console.warn('Container metrics poll failed:', (e as Error).message); return { cpu: null, memory: null, memoryLimit: null }; }
}

async function gpuMetrics() {
  const url = process.env.GPU_METRICS_URL;
  if (!url) return { percent: null, vendor: null };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`exporter returned HTTP ${response.status}`);
    const text = await response.text(), requested = process.env.GPU_METRIC_NAME;
    const candidates = requested ? [requested] : ['DCGM_FI_DEV_GPU_UTIL','nvidia_gpu_utilization','intel_gpu_usage_percent','intel_gpu_engine_busy_percent','igpu_engine_busy_percent'];
    const values: Array<{ name: string; value: number }> = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Za-z_:][A-Za-z0-9_:]*)(?:\{[^}]*\})?\s+([-+0-9.eE]+)(?:\s+\d+)?$/);
      if (match && candidates.includes(match[1])) { const value = Number(match[2]); if (Number.isFinite(value)) values.push({ name: match[1], value }); }
    }
    if (!values.length) throw new Error(`none of the configured GPU metrics were present (${candidates.join(', ')})`);
    const scale = Number(process.env.GPU_METRIC_SCALE || 1), percent = Math.min(100, Math.max(0, Math.max(...values.map(x => x.value)) * (Number.isFinite(scale) ? scale : 1)));
    const metric = values[0].name.toLowerCase(), vendor = process.env.GPU_METRICS_VENDOR || (metric.includes('dcgm') || metric.includes('nvidia') ? 'NVIDIA' : metric.includes('intel') || metric.includes('igpu') ? 'Intel' : 'GPU');
    return { percent, vendor };
  } catch (e) { if (Date.now() - lastGpuWarning > 300_000) { console.warn('GPU metrics poll failed:', (e as Error).message); lastGpuWarning = Date.now(); } return { percent: null, vendor: process.env.GPU_METRICS_VENDOR || null }; }
}

async function streamMetrics() {
  try {
    const sessions = await (await api('/Sessions?ActiveWithinSeconds=300')).json() as any[];
    const streams = sessions.filter(s => s.NowPlayingItem).map(s => {
      const t = s.TranscodingInfo, mode = !t ? 'Direct Play' : t.IsVideoDirect && t.IsAudioDirect ? 'Remux' : 'Transcode';
      return { username: s.UserName || 'Unknown user', itemName: s.NowPlayingItem?.Name || 'Unknown item', seriesName: s.NowPlayingItem?.SeriesName || null, mode, videoCodec: t?.VideoCodec || null, audioCodec: t?.AudioCodec || null, container: t?.Container || null, bitrate: t?.Bitrate ?? null, framerate: t?.Framerate ?? null, completionPercentage: t?.CompletionPercentage ?? null, width: t?.Width ?? null, height: t?.Height ?? null, hardwareAccelerationType: t?.HardwareAccelerationType || null, reasons: t?.TranscodeReasons || [] };
    });
    return { streams, direct: streams.filter(x => x.mode === 'Direct Play').length, remux: streams.filter(x => x.mode === 'Remux').length, transcode: streams.filter(x => x.mode === 'Transcode').length };
  } catch (e) { console.warn('Transcode metrics poll failed:', (e as Error).message); return { streams: [], direct: null, remux: null, transcode: null }; }
}

export async function collectMetrics() {
  const [container, gpu, playback] = await Promise.all([containerMetrics(), gpuMetrics(), streamMetrics()]);
  try {
    const streamCount = playback.direct === null ? null : Number(playback.direct) + Number(playback.remux) + Number(playback.transcode);
    await db.query('INSERT INTO metric_samples(cpu_percent,memory_bytes,memory_limit,gpu_percent,gpu_vendor,stream_count,direct_play_count,remux_count,transcode_count,transcode_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [container.cpu, container.memory, container.memoryLimit, gpu.percent, gpu.vendor, streamCount, playback.direct, playback.remux, playback.transcode, JSON.stringify(playback.streams)]);
  } catch (e) { console.warn('Metrics storage failed:', (e as Error).message); }
}
