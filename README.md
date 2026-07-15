# JellyPulse

**MONITOR · REPORT · IMPROVE**

The all-in-one operations dashboard for Jellyfin. Monitor server health, track active viewers, collect playback issues, and keep your media library running smoothly — all from one lightweight, self-hosted application.

## What this first release includes

- First-run setup, with a Jellyfin server URL/API key and a separate emergency local administrator account.
- Jellyfin username/password sign-in. User passwords are passed only to Jellyfin for authentication and are never stored here.
- Server-side session cookies (`HttpOnly`, `SameSite=Strict`) and AES-256-GCM encrypted API keys, webhook URLs, and Jellyfin session tokens in PostgreSQL.
- Playback polling every 30 seconds; the user's latest session is retained for five minutes after it stops.
- Reports containing the user, item details, device/client, playback timestamp, issue type/description, open/resolved state, submission time, and the preceding five minutes of Jellyfin container metrics.
- Admin dashboard with active/recent viewers, CPU history, a sortable-ready issue queue, resolution control, and Discord-compatible webhook notifications.

## Start it

1. Install Docker Desktop (or Docker Engine) on the machine hosting Jellyfin.
2. Copy `.env.example` to `.env` and replace both secret values. Generate the encryption key with:

   ```sh
   openssl rand -base64 32
   ```

3. From this directory, run:

   ```sh
   docker compose up -d --build
   ```

4. On the host machine, open `http://localhost:3000` and complete setup.

The service binds to `127.0.0.1` by default. This deliberately means it is not accessible from another device until you place it behind HTTPS (for example Caddy, Nginx Proxy Manager, or a private VPN such as Tailscale) and change `APP_BIND_ADDRESS` appropriately. Set `SESSION_COOKIE_SECURE=true` when HTTPS is enabled.

## Jellyfin API key

In Jellyfin, create a dedicated API key for this service rather than reusing one from another application. The reporter uses it only from the server container; no browser response or page contains it.

## Metrics and GPU support

The compose stack uses a narrowly-permissioned Docker socket proxy instead of giving the application the Docker socket. It can read Jellyfin container CPU and memory samples every 30 seconds. Docker Engine does not expose NVIDIA utilization in that endpoint, so GPU utilization is represented in the schema but requires a small follow-up integration with an NVIDIA DCGM exporter or a host metrics agent. This is intentionally left disabled rather than granting broad host privileges.

## Before exposing it to users

- Use HTTPS and set `SESSION_COOKIE_SECURE=true`.
- Keep `.env` private and back it up separately from the database. Losing `APP_ENCRYPTION_KEY` makes existing encrypted values unreadable; changing it has the same effect.
- Restrict access with a VPN or reverse-proxy access policy if this is only for a small private server.
- Do not publish the PostgreSQL or Docker-proxy ports; this compose file does not publish either.

## Next additions

- Multiple named notification destinations (Discord, Slack, email, Gotify, ntfy).
- GPU collector and more complete CPU/RAM dashboards.
- Issue filtering by type/date/status and CSV export.
- A QR-code landing link and a Jellyfin dashboard link/plugin.
