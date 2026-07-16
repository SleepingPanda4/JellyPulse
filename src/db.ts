import pg from 'pg';
export const db = new pg.Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.PGHOST || 'db', port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'reporter', password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'reporter'
});

export async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value text NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id text NOT NULL, username text NOT NULL, is_admin boolean NOT NULL DEFAULT false, token text NOT NULL, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS recent_playback (user_id text PRIMARY KEY, username text NOT NULL, payload jsonb NOT NULL, last_seen timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS metric_samples (id bigserial PRIMARY KEY, captured_at timestamptz NOT NULL DEFAULT now(), cpu_percent numeric, memory_bytes bigint, memory_limit bigint, gpu_percent numeric);
    CREATE TABLE IF NOT EXISTS issues (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open', issue_type text NOT NULL, description text NOT NULL, user_id text NOT NULL, username text NOT NULL, playback jsonb NOT NULL, metrics jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS access_links (id uuid PRIMARY KEY, user_id text NOT NULL, username text NOT NULL, label text NOT NULL, token_hash text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz);
    CREATE INDEX IF NOT EXISTS access_links_token_hash_idx ON access_links(token_hash);
    CREATE TABLE IF NOT EXISTS notification_destinations (id uuid PRIMARY KEY, type text NOT NULL, label text NOT NULL, config text NOT NULL, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), last_sent_at timestamptz, last_error text);
    CREATE TABLE IF NOT EXISTS user_invites (id uuid PRIMARY KEY, label text NOT NULL, token_hash text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS user_invites_token_hash_idx ON user_invites(token_hash);
  `);
}
export async function getSetting(key: string) { return (await db.query('SELECT value FROM settings WHERE key=$1', [key])).rows[0]?.value as string | undefined; }
export async function setSetting(key: string, value: string) { await db.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', [key, value]); }
