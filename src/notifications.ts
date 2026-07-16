import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from './db.js';
import { decrypt, encrypt } from './crypto.js';

const url = z.string().url();
export const notificationConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('discord'), webhookUrl: url }),
  z.object({ type: z.literal('slack'), webhookUrl: url }),
  z.object({ type: z.literal('home_assistant'), baseUrl: url, accessToken: z.string().min(1), notifyService: z.string().regex(/^[a-z0-9_]+$/) }),
  z.object({ type: z.literal('email'), host: z.string().min(1), port: z.number().int().min(1).max(65535), secure: z.boolean(), username: z.string(), password: z.string(), from: z.string().email(), to: z.string().min(3) }),
  z.object({ type: z.literal('ntfy'), serverUrl: url, topic: z.string().regex(/^[A-Za-z0-9_-]+$/), accessToken: z.string() }),
  z.object({ type: z.literal('gotify'), baseUrl: url, appToken: z.string().min(1) }),
  z.object({ type: z.literal('telegram'), botToken: z.string().min(10), chatId: z.string().min(1) }),
  z.object({ type: z.literal('pushover'), appToken: z.string().min(1), userKey: z.string().min(1) }),
  z.object({ type: z.literal('webhook'), webhookUrl: url }),
  z.object({ type: z.literal('apprise'), serverUrl: url, urls: z.string().min(1) })
]);
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;

type Issue = { id?: number; issue_type: string; username: string; description: string; playback: any; created_at?: string };
const timeout = () => AbortSignal.timeout(10_000);
const trim = (value: string, max = 1900) => value.length > max ? value.slice(0, max - 1) + '…' : value;
function content(issue: Issue) { const p = issue.playback || {}; const media = [p.seriesName, p.seasonName, p.itemName].filter(Boolean).join(' · ') || 'Unknown item'; const position = p.positionTicks ? ` at ${Math.floor(p.positionTicks / 600_000_000)}:${String(Math.floor(p.positionTicks / 10_000_000) % 60).padStart(2, '0')}` : ''; const title = `JellyPulse: ${issue.issue_type} issue`; const message = `${issue.username} reported ${issue.issue_type} for ${media}${position}.\n\n${issue.description}`; return { title, message: trim(message) }; }
async function checked(response: Response) { if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`); }

export async function sendNotification(config: NotificationConfig, issue: Issue) {
  const { title, message } = content(issue), signal = timeout();
  switch (config.type) {
    case 'discord': return checked(await fetch(config.webhookUrl, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**${title}**\n${message}` }) }));
    case 'slack': return checked(await fetch(config.webhookUrl, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `*${title}*\n${message}` }) }));
    case 'home_assistant': return checked(await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/services/notify/${config.notifyService}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.accessToken}` }, body: JSON.stringify({ title, message }) }));
    case 'email': { const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.username ? { user: config.username, pass: config.password } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 }); await transport.sendMail({ from: config.from, to: config.to, subject: title, text: message }); return; }
    case 'ntfy': return checked(await fetch(`${config.serverUrl.replace(/\/$/, '')}/${encodeURIComponent(config.topic)}`, { method: 'POST', signal, headers: { Title: title, ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}) }, body: message }));
    case 'gotify': return checked(await fetch(`${config.baseUrl.replace(/\/$/, '')}/message?token=${encodeURIComponent(config.appToken)}`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message, priority: 5 }) }));
    case 'telegram': return checked(await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: config.chatId, text: `${title}\n${message}` }) }));
    case 'pushover': return checked(await fetch('https://api.pushover.net/1/messages.json', { method: 'POST', signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: config.appToken, user: config.userKey, title, message }) }));
    case 'webhook': return checked(await fetch(config.webhookUrl, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'issue.created', title, message, issue }) }));
    case 'apprise': return checked(await fetch(`${config.serverUrl.replace(/\/$/, '')}/notify/`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: config.urls, title, body: message, type: 'info', format: 'text' }) }));
  }
}

export async function sendIssueNotifications(issue: Issue) { const rows = (await db.query('SELECT id,config FROM notification_destinations WHERE enabled=true')).rows; await Promise.allSettled(rows.map(async row => { try { const config = notificationConfigSchema.parse(JSON.parse(decrypt(row.config))); await sendNotification(config, issue); await db.query('UPDATE notification_destinations SET last_sent_at=now(),last_error=NULL WHERE id=$1', [row.id]); } catch (e) { await db.query('UPDATE notification_destinations SET last_error=$1 WHERE id=$2', [(e as Error).message.slice(0, 500), row.id]); } })); }

export async function migrateLegacyDiscord(webhook: string | undefined) { if (!webhook || Number((await db.query('SELECT count(*) FROM notification_destinations')).rows[0].count)) return; const config: NotificationConfig = { type: 'discord', webhookUrl: decrypt(webhook) }; await db.query('INSERT INTO notification_destinations(id,type,label,config) VALUES($1,$2,$3,$4)', [crypto.randomUUID(), config.type, 'Discord webhook', encrypt(JSON.stringify(config))]); }
