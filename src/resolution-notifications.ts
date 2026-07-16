import { db } from './db.js';
import { api } from './jellyfin.js';

let deliveryRunning = false;

function supportsMessages(session: any) {
  return session?.Id && session?.UserId && Array.isArray(session.SupportedCommands) && session.SupportedCommands.includes('DisplayMessage');
}

export async function deliverResolutionMessages(sessions: any[]) {
  if (deliveryRunning) return;
  deliveryRunning = true;
  try {
    const pending = (await db.query(`
      SELECT DISTINCT ON (n.user_id)
        n.id, n.user_id, i.id AS issue_id, i.resolution_note, i.playback
      FROM issue_resolution_notifications n
      JOIN issues i ON i.id=n.issue_id
      WHERE n.delivered_at IS NULL AND i.status='resolved'
      ORDER BY n.user_id, n.created_at
      LIMIT 50
    `)).rows;
    const activeCutoff = Date.now() - 90_000;
    for (const notice of pending) {
      const compatible = sessions
        .filter(s => s.UserId === notice.user_id && supportsMessages(s) && (!s.LastActivityDate || new Date(s.LastActivityDate).getTime() >= activeCutoff))
        .sort((a, b) => new Date(b.LastActivityDate || 0).getTime() - new Date(a.LastActivityDate || 0).getTime())[0];
      if (!compatible) continue;
      const itemName = notice.playback?.itemName || 'your reported item';
      const note = String(notice.resolution_note || 'Your server administrator marked this report as resolved.').slice(0, 500);
      try {
        await api(`/Sessions/${encodeURIComponent(compatible.Id)}/Message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Header: `JellyPulse · Report #${notice.issue_id} resolved`, Text: `${itemName}: ${note}`, TimeoutMs: 12_000 })
        });
        await db.query('UPDATE issue_resolution_notifications SET delivered_at=now(),delivery_session_id=$1,last_attempt_at=now(),last_error=NULL WHERE id=$2 AND delivered_at IS NULL', [compatible.Id, notice.id]);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Jellyfin message delivery failed';
        await db.query('UPDATE issue_resolution_notifications SET last_attempt_at=now(),last_error=$1 WHERE id=$2', [message.slice(0, 500), notice.id]);
      }
    }
  } catch (e) {
    console.warn('Resolution message delivery failed:', (e as Error).message);
  } finally {
    deliveryRunning = false;
  }
}
