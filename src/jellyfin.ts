import { decrypt } from './crypto.js'; import { getSetting } from './db.js';
export type Playback = { itemName: string; itemType: string; seriesName?: string; seasonName?: string; device?: string; client?: string; positionTicks?: number; runtimeTicks?: number; lastSeen: string; source?: 'current' | 'recent'; reportedAt?: string };
export function playbackFromSession(session: any): Playback { const capturedAt = new Date().toISOString(); return { itemName: session.NowPlayingItem.Name, itemType: session.NowPlayingItem.Type, seriesName: session.NowPlayingItem.SeriesName, seasonName: session.NowPlayingItem.SeasonName, device: session.DeviceName, client: session.Client, positionTicks: session.PlayState?.PositionTicks, runtimeTicks: session.NowPlayingItem.RunTimeTicks, lastSeen: capturedAt, source: 'current' }; }
async function config() { const host = await getSetting('jellyfin_host'), encryptedKey = await getSetting('jellyfin_api_key'); if (!host || !encryptedKey) throw new Error('Service has not been configured'); return { host: host.replace(/\/$/, ''), key: decrypt(encryptedKey) }; }
export async function api(path: string, init: RequestInit = {}) { const c = await config(); const r = await fetch(c.host + path, { ...init, headers: { 'X-Emby-Token': c.key, ...(init.headers || {}) } }); if (!r.ok) { const detail = await r.clone().json().then((x: any) => x.Message || x.message).catch(() => undefined); throw new Error(`Jellyfin returned HTTP ${r.status}${detail ? `: ${String(detail).slice(0, 300)}` : ''}`); } return r; }
export async function validateServer(host: string, key: string) { const r = await fetch(host.replace(/\/$/, '') + '/System/Info', { headers: { 'X-Emby-Token': key } }); if (!r.ok) throw new Error('Could not connect to Jellyfin with that API key'); return r.json() as Promise<{ServerName: string}>; }
type JellyfinIdentity = { id: string; username: string; token: string; serverAdmin: boolean };
export async function jellyfinLoginAt(host: string, username: string, password: string): Promise<JellyfinIdentity> { const r = await fetch(host.replace(/\/$/, '') + '/Users/AuthenticateByName', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': 'MediaBrowser Client="JellyPulse", Device="Web", DeviceId="jellypulse-web", Version="0.1.0"' }, body: JSON.stringify({ Username: username, Pw: password, Password: password }) }); if (!r.ok) { const detail = await r.json().then((x: any) => x.Message || x.message).catch(() => undefined); throw new Error(`Jellyfin sign-in was rejected (HTTP ${r.status})${detail ? `: ${detail}` : ''}`); } const body = await r.json() as any; return { id: body.User.Id as string, username: body.User.Name as string, token: body.AccessToken as string, serverAdmin: Boolean(body.User.Policy?.IsAdministrator) }; }
export async function jellyfinLogin(username: string, password: string) { const c = await config(); return jellyfinLoginAt(c.host, username, password); }
export async function createJellyfinUser(username: string, password: string) {
  const response = await api('/Users/New', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Name: username, Password: password })
  });
  return response.json() as Promise<{ Id: string; Name: string }>;
}
