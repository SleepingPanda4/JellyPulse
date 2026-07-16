import Docker from 'dockerode'; import { api, playbackFromSession } from './jellyfin.js'; import { db } from './db.js'; import { deliverResolutionMessages } from './resolution-notifications.js';
const docker = new Docker({ protocol: 'http', host: 'docker-proxy', port: 2375 });
export async function collectPlayback() { try { const sessions = await (await api('/Sessions?ActiveWithinSeconds=300')).json() as any[]; for (const s of sessions.filter(x => x.NowPlayingItem && x.UserId)) { const p = playbackFromSession(s), itemId = String(s.NowPlayingItem.Id || `${s.NowPlayingItem.Type}:${s.NowPlayingItem.Name}`); await db.query('INSERT INTO recent_playback(user_id,username,payload,last_seen) VALUES($1,$2,$3,now()) ON CONFLICT(user_id) DO UPDATE SET username=EXCLUDED.username,payload=EXCLUDED.payload,last_seen=now()', [s.UserId, s.UserName, JSON.stringify(p)]); await db.query(`
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
      `, [s.UserId, itemId, s.UserName || 'Unknown user', JSON.stringify(p), s.PlayState?.IsPaused ? 0 : 30]); } await deliverResolutionMessages(sessions); } catch (e) { console.warn('Playback poll failed:', (e as Error).message); } }
export async function collectMetrics() { try { const list = await docker.listContainers(); const name = process.env.JELLYFIN_CONTAINER_NAME || 'jellyfin'; const match = list.find(c => c.Names.some(n => n.replace(/^\//, '') === name)); if (!match) return; const s: any = await docker.getContainer(match.Id).stats({ stream: false }); const cpuDelta = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage; const systemDelta = s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage; const cores = s.cpu_stats.online_cpus || s.cpu_stats.cpu_usage.percpu_usage?.length || 1; const cpu = systemDelta > 0 ? (cpuDelta / systemDelta) * cores * 100 : 0; await db.query('INSERT INTO metric_samples(cpu_percent,memory_bytes,memory_limit) VALUES($1,$2,$3)', [cpu, s.memory_stats.usage || 0, s.memory_stats.limit || 0]); } catch (e) { console.warn('Metrics poll failed:', (e as Error).message); } }
