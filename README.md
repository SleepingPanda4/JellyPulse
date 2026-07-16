# JellyPulse

<p align="center">
  <img src="assets/jellypulse-overview.png" alt="JellyPulse — Monitor, Report, Improve" width="900">
</p>

**MONITOR · REPORT · IMPROVE**

The all-in-one operations dashboard for Jellyfin. Monitor server health, track active viewers, collect playback issues, and keep your media library running smoothly — all from one lightweight, self-hosted application.

## What this first release includes

- First-run setup assigns one existing Jellyfin user as the JellyPulse administrator, alongside the Jellyfin server URL/API key.
- After first-run setup completes, JellyPulse returns to the login screen so the administrator signs in through the same Jellyfin flow as every other user.
- **Login with Jellyfin** for every user. Passwords are passed only to Jellyfin for authentication and are never stored here.
- Server-side session cookies (`HttpOnly`, `SameSite=Strict`) and AES-256-GCM encrypted API keys, webhook URLs, and Jellyfin session tokens in PostgreSQL.
- Playback polling every 30 seconds; the user's latest session is retained for five minutes after it stops.
- Reports containing the user, item details, device/client, playback timestamp, issue type/description, open/resolved state, submission time, and the preceding five minutes of Jellyfin container metrics.
- Admin dashboard with active/recent viewers, CPU history, a sortable-ready issue queue, resolution control, and multiple notification destinations.
- Revocable pre-authenticated reporting links with optional expiration. Raw 256-bit link tokens are shown once and only SHA-256 hashes are stored; link sessions never receive administrator access.

### Private reporting links

An administrator can create a private link for any enabled Jellyfin user from the dashboard. The user can bookmark that link and open it instead of entering a password. Tokens are placed in the URL fragment so they are not sent in HTTP request paths or referrer headers. Treat each link like a password: send it privately, give shared-device links an expiration date, and revoke a link immediately if it is exposed. Disabling the Jellyfin user also prevents the link from being used.

### Notification destinations

JellyPulse can notify multiple destinations for every submitted issue. Supported providers are Home Assistant, SMTP email, Discord, Slack, ntfy, Gotify, Telegram, Pushover, generic JSON webhooks, and an Apprise API bridge for additional services. Each destination can be tested, disabled, or deleted independently; credentials are AES-256-GCM encrypted in PostgreSQL and are never returned to the browser after saving.

For Home Assistant, create a long-lived access token from the Home Assistant user profile and enter the `notify` service suffix, such as `mobile_app_your_phone`. JellyPulse calls `/api/services/notify/{service}`. For email, use the SMTP values supplied by the mail provider. Apprise users can connect a self-hosted Apprise API instance and provide one or more Apprise notification URLs.

## Start it

1. Install Docker Desktop (or Docker Engine) on the machine hosting Jellyfin.
2. Copy `.env.example` to `.env` and replace both secret values. `POSTGRES_PASSWORD` may contain special characters; JellyPulse passes it safely to PostgreSQL without placing it inside a connection URL. Generate the encryption key with:

   ```sh
   openssl rand -base64 32
   ```

3. From this directory, run:

   ```sh
   docker compose up -d --build
   ```

   Docker waits for PostgreSQL to pass its health check before starting JellyPulse. To see startup state, run `docker compose ps`.

4. On the host machine, open `http://localhost:3000` and complete setup.

The service binds to `127.0.0.1` by default. This deliberately means it is not accessible from another device until you place it behind HTTPS (for example Caddy, Nginx Proxy Manager, or a private VPN such as Tailscale) and change `APP_BIND_ADDRESS` appropriately. Set `SESSION_COOKIE_SECURE=true` when HTTPS is enabled.

## Accessing the dashboard

With the default `APP_BIND_ADDRESS=127.0.0.1`, JellyPulse is reachable only on its host. This is the recommended setting for a public deployment behind Caddy.

To complete first-run setup from another computer without exposing the port, create an SSH tunnel from that computer:

```sh
ssh -L 3000:127.0.0.1:3000 root@YOUR-LXC-IP
```

Then open `http://localhost:3000` in the same computer's browser.

For temporary access on a trusted LAN only, set the following in `.env`:

```env
APP_BIND_ADDRESS=0.0.0.0
```

Apply it with:

```sh
docker compose up -d --force-recreate
```

The dashboard will then be available at `http://YOUR-LXC-IP:3000`. Do **not** leave this enabled when the LXC is publicly reachable. When Caddy is configured, change the value back to `127.0.0.1`, proxy Caddy to `127.0.0.1:3000`, and set `SESSION_COOKIE_SECURE=true`.

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

- GPU collector and more complete CPU/RAM dashboards.
- Issue filtering by type/date/status and CSV export.
- A QR-code landing link and a Jellyfin dashboard link/plugin.
