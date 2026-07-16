# JellyPulse

<p align="center">
  <img src="assets/jellypulse-overview.png" alt="JellyPulse — Monitor, Report, Improve" width="900">
</p>

**MONITOR · REPORT · IMPROVE**

The all-in-one operations dashboard for Jellyfin. Monitor server health, track active viewers, collect playback issues, and keep your media library running smoothly — all from one lightweight, self-hosted application.

Current release: **v1.1.0** · See [CHANGELOG.md](CHANGELOG.md) for release history.

## Features

- First-run setup assigns one existing Jellyfin user as the JellyPulse administrator, alongside the Jellyfin server URL/API key.
- After first-run setup completes, JellyPulse returns to the login screen so the administrator signs in through the same Jellyfin flow as every other user.
- **Login with Jellyfin** for every user. Passwords are passed only to Jellyfin for authentication and are never stored here.
- Server-side session cookies (`HttpOnly`, `SameSite=Strict`) and AES-256-GCM encrypted API keys, notification credentials, and Jellyfin session tokens in PostgreSQL.
- Playback polling every 30 seconds; the user's latest observed item and position are retained as a reporting fallback after playback stops.
- Streamlined reporting with category-specific choices such as **Playback stopped**, **Glitching or artifacts**, **Wrong language**, and **Wrong timing**; a written description is optional.
- A **Not this item** library picker that searches accessible Jellyfin movies and shows, then provides stacked season and episode selectors for a series.
- Reports containing the user, item details, device/client, live playback time or last-known position, playback percentage, current/recent source, issue category/preset/optional notes, open/resolved state, submission time, and the preceding five minutes of CPU, RAM, optional GPU, and playback-pipeline telemetry.
- A private **My Reports** history where each user can track their open and resolved reports and read administrator resolution notes.
- Admin resolution notes and durable Jellyfin popup delivery when the user next opens a compatible active client session.
- Hamburger navigation with focused Dashboard, Reports, Report Issue, Users, and Settings pages instead of placing every administrator control on the overview.
- Self-refreshing admin overview with compact CPU, RAM, Intel/NVIDIA GPU, and playback-pipeline graphs for the last five minutes alongside active viewer cards and playback progress.
- A dashboard queue containing only unresolved reports. Multiple open reports for the same Jellyfin item are grouped with newest-first submitters and expandable individual details.
- A complete Reports archive sortable by show or movie, season, episode or item, submit time, user, and issue, with unresolved reports always above resolved reports.
- A Users workspace with Jellyfin account status, most recently watched media, approximate observed watch time, most-watched title or series, watch history, user reports, reporting links, and one-time account invitations.
- A report-detail popup with playback progress, the exact reported problem, five-minute CPU/RAM/GPU and direct-play/remux/transcode graphs, active transcode details, and resolution actions.
- A Settings workspace for securely changing the Jellyfin connection and managing notification destinations.
- Live playback progress under **Report a playback issue**, including elapsed time, total runtime, and percentage watched.
- One-time Jellyfin account invitations that expire after 30 minutes, 1 hour, 1 day, or 7 days.
- Revocable pre-authenticated reporting links with optional expiration. Raw 256-bit link tokens are shown once and only SHA-256 hashes are stored; link sessions never receive administrator access.

### Jellyfin user invitations

An administrator can create a one-time account invitation from **Users → User invitations**. The recipient opens the private link and chooses a Jellyfin username and password; JellyPulse then creates a standard, non-administrator user directly in Jellyfin. After Jellyfin confirms creation, the invitation is permanently deleted and cannot be reused.

Invitations can last only 30 minutes, 1 hour, 1 day, or 7 days. There is deliberately no permanent option. Each link contains a random 256-bit token in its URL fragment, while JellyPulse stores only its SHA-256 hash. The raw invitation is shown only when it is created, so copy it before leaving or refreshing the page. An administrator can revoke any unused invitation from the Users page.

Jellyfin controls the new account's library access and other user policy. Review the account under Jellyfin Dashboard → Users after creation if it needs restricted libraries, playback limits, or other permissions. The recipient can immediately use **Login with Jellyfin** in JellyPulse after creating the account.

### Private reporting links

An administrator can create a private link for any enabled Jellyfin user under **Users → Reporting links**. The user can bookmark that link and open it instead of entering a password. Tokens are placed in the URL fragment so they are not sent in HTTP request paths or referrer headers. Treat each link like a password: send it privately, give shared-device links an expiration date, and revoke a link immediately if it is exposed. Disabling the Jellyfin user also prevents the link from being used.

### Notification destinations

JellyPulse can notify multiple destinations for every submitted issue. Supported providers are Home Assistant, SMTP email, Discord, Slack, ntfy, Gotify, Telegram, Pushover, generic JSON webhooks, and an Apprise API bridge for additional services. Each destination can be edited in a popup, tested, disabled, or deleted independently. Existing secrets stay encrypted when an edit field is left blank; credentials are never returned to the browser after saving.

Notification management is under **Settings → Notifications**. **Settings → Jellyfin configuration** can change the Jellyfin host and API key. JellyPulse never displays the saved API key, permits leaving the key field blank to retain it, and requires the signed-in administrator's Jellyfin password to validate the proposed connection before saving. That password is sent only to Jellyfin and is never stored.

For Home Assistant, create a long-lived access token from the Home Assistant user profile and enter the `notify` service suffix, such as `mobile_app_your_phone`. JellyPulse calls `/api/services/notify/{service}`. For email, use the SMTP values supplied by the mail provider. Apprise users can connect a separately deployed Apprise API instance and provide one or more Apprise notification URLs; Apprise API is not bundled in this Compose stack.

### Report resolution and user messages

Resolving a report opens an optional resolution-note dialog. JellyPulse saves the note in the report owner's **My Reports** history and creates a durable message queue entry. Every 30 seconds, the existing Jellyfin session poll looks for that user on a recently active client that advertises the `DisplayMessage` command. JellyPulse then sends the resolution through Jellyfin's session message API and records when Jellyfin accepted it.

This is an in-app Jellyfin message, not a background mobile push notification. The Jellyfin app must be open and connected, and client support varies. Unsupported clients leave the message queued while **My Reports** remains the permanent and reliable record. JellyPulse sends at most one queued resolution per user during each poll so several completed reports do not overwrite one another on the same client. Reopening a report cancels any queued popup and clears its resolution note.

The administrator overview and visible user-report queue refresh automatically every 10 seconds. Returning to a previously hidden browser tab triggers an immediate refresh, and overlapping requests are suppressed.

When a report is submitted, JellyPulse first requests the user's active Jellyfin sessions and captures the most recently active session's playback position. If nothing is playing, it attaches the last item JellyPulse observed for that user, including its last-known position and observation time. The dashboard, My Reports, and outgoing issue notifications label the fallback as **most recently watched** so it is not mistaken for live playback.

If the detected item is wrong, the user can choose **Not this item**. JellyPulse searches Jellyfin using that user's library access, shows movie and series matches, and expands a selected series into season and episode selectors. Only the selected Jellyfin item ID is submitted by the browser; JellyPulse fetches and validates the movie or episode again server-side before saving the report. A manually selected item is labeled as such and does not claim a playback position or percentage that JellyPulse did not observe.

The overview's **Currently watching** section uses live Jellyfin sessions rather than the five-minute reporting fallback. Each viewer card shows the user, title, device/client, elapsed time, total runtime, percentage watched, and a progress bar. The report page refreshes its own playback card every 10 seconds. Items without a known runtime, such as some live streams, show elapsed time with an unavailable total instead of an inaccurate percentage.

### Watch history and user statistics

JellyPulse begins building its own watch history after this feature is installed. The existing 30-second Jellyfin session poll records active items, groups observations of the same user and item into a watch session until there is a ten-minute gap, and does not add observed time while Jellyfin reports playback as paused. The Users page derives recent media, most-watched media, and observed watch time from these records. These values are operational estimates rather than Jellyfin billing-grade analytics, and playback from before the migration is not reconstructed.

## Requirements

- Docker Engine or Docker Desktop with Docker Compose v2.
- A Jellyfin server reachable from the JellyPulse container.
- A dedicated Jellyfin API key and an existing Jellyfin user to designate as the JellyPulse administrator.
- Git if installing or updating from GitHub.
- Optional: Jellyfin on the same Docker host if you want container CPU/RAM collection.

## Install

1. Clone the repository and enter it:

   ```sh
   git clone https://github.com/SleepingPanda4/JellyPulse.git /opt/jellypulse
   cd /opt/jellypulse
   ```

2. Copy `.env.example` to `.env` and replace both secret values:

   ```sh
   cp .env.example .env
   nano .env
   ```

   `POSTGRES_PASSWORD` may contain special characters; wrap the value in single quotes in `.env` if it contains `$`, `#`, whitespace, or other Compose-sensitive characters. Generate the encryption key with:

   ```sh
   openssl rand -base64 32
   ```

3. From this directory, run:

   ```sh
   docker compose up -d --build
   ```

   Docker waits for PostgreSQL to pass its health check before starting JellyPulse. To see startup state, run `docker compose ps`.

4. On the host machine, open `http://localhost:3000` and complete setup. Use the SSH-tunnel or temporary LAN instructions below when Docker is running on a remote LXC/server.

The service binds to `127.0.0.1` by default. This deliberately means it is not accessible from another device until you use an SSH tunnel or place it behind HTTPS (for example Caddy, Nginx Proxy Manager, or a private VPN such as Tailscale). Set `SESSION_COOKIE_SECURE=true` when HTTPS is enabled.

## First-run setup

The setup wizard asks for:

- The Jellyfin base URL as seen from the JellyPulse container, such as `http://10.10.10.50:8096` or `https://jellyfin.example.com`. Do not use a browser `/web` URL.
- A dedicated Jellyfin API key created under Jellyfin Dashboard → Advanced → API Keys.
- The username and password of the existing Jellyfin account that should administer JellyPulse. The password verifies the selection but is never stored.

After setup completes, JellyPulse returns to **Login with Jellyfin**. The selected account receives the administrator dashboard; other Jellyfin accounts receive the reporting page.

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

### Caddy example

When Caddy and JellyPulse run on the same host:

```caddyfile
jellypulse.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set these values in `.env`, recreate JellyPulse, and then access it only through the HTTPS hostname:

```env
APP_BIND_ADDRESS=127.0.0.1
SESSION_COOKIE_SECURE=true
```

```sh
docker compose up -d --force-recreate app
```

If Caddy runs on a different host or in an unrelated Docker network, it cannot reach the LXC's loopback address. Bind JellyPulse to the LAN address with `APP_BIND_ADDRESS=0.0.0.0`, proxy Caddy to `YOUR-LXC-IP:3000`, and use a firewall to allow port 3000 only from the reverse proxy.

## Remote Jellyfin servers

JellyPulse authentication, session detection, reporting, and notifications work with a Jellyfin server on another machine as long as it is reachable from the JellyPulse container. Browser CORS settings do not apply because JellyPulse contacts Jellyfin server-to-server.

The included Docker metrics collector is different: it reads the local Docker Engine and therefore only finds a Jellyfin container running on the same Docker host. With remote Jellyfin, reporting still works but the CPU/RAM graph remains empty until a remote metrics agent/exporter is added.

## Jellyfin API key

In Jellyfin, create a dedicated API key for this service rather than reusing one from another application. The reporter uses it only from the server container; no browser response or page contains it.

## Metrics and GPU support

The compose stack uses a narrowly permissioned Docker socket proxy instead of giving the application the Docker socket. It reads Jellyfin container CPU and memory every 10 seconds. During the same sample JellyPulse reads active Jellyfin sessions and records direct-play, remux, and transcode counts plus codec, container, resolution, bitrate, framerate, hardware-acceleration type, completion, and transcode reasons. The overview shows the latest five-minute window and refreshes every 10 seconds. These samples are also embedded into each report so its diagnostic graphs do not change later.

Docker Engine does not expose GPU utilization through container stats. JellyPulse therefore accepts an optional Prometheus-format Intel or NVIDIA GPU exporter without granting Docker exec or host-device access to the application. Set these values in `.env` and recreate the application container:

```env
GPU_METRICS_URL=http://gpu-exporter:9400/metrics
GPU_METRIC_NAME=DCGM_FI_DEV_GPU_UTIL
GPU_METRIC_SCALE=1
GPU_METRICS_VENDOR=NVIDIA
```

`GPU_METRIC_NAME` is the exact Prometheus metric containing utilization. JellyPulse automatically recognizes `DCGM_FI_DEV_GPU_UTIL`, `nvidia_gpu_utilization`, `intel_gpu_usage_percent`, `intel_gpu_engine_busy_percent`, and `igpu_engine_busy_percent`; explicitly set the name when the exporter uses something else. Set `GPU_METRIC_SCALE=100` if the exporter reports a 0–1 ratio instead of 0–100 percent. For Intel, use the metric name and port supplied by the installed Intel GPU exporter and set `GPU_METRICS_VENDOR=Intel`. The exporter URL must be reachable from the JellyPulse container. If it is omitted or unavailable, reports still include CPU, RAM, and transcode telemetry while GPU is shown as unavailable.

## Before exposing it to users

- Use HTTPS and set `SESSION_COOKIE_SECURE=true`.
- Keep `.env` private and back it up separately from the database. Losing `APP_ENCRYPTION_KEY` makes existing encrypted values unreadable; changing it has the same effect.
- Restrict access with a VPN or reverse-proxy access policy if this is only for a small private server.
- Do not publish the PostgreSQL or Docker-proxy ports; this compose file does not publish either.
- Treat pre-authenticated links as passwords. Use expirations, share them privately, and revoke exposed links.
- Treat account invitation links as passwords too. Send them privately, choose the shortest practical lifetime, and revoke unused links when plans change.

## Upgrade

To update an installation that tracks `main`:

```sh
cd /opt/jellypulse
git status --short
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
```

Your `.env`, PostgreSQL volume, setup, reports, and destinations remain in place. If `git status` reports tracked-file changes, resolve or preserve them before pulling.

To pin a released version:

```sh
git fetch --tags
git checkout v1.1.0
docker compose up -d --build
```

## Isolated development stack

Development should run from the `develop` branch in a separate checkout. The included `compose.dev.yml` uses the fixed Compose project name `jellypulse-dev`, port `3000`, a separate PostgreSQL database/volume, a separate encryption key, and its own containers. It does not read or migrate the production JellyPulse database. The application source is mounted into the container and `tsx watch` restarts it when files change.

The development example binds port 3000 to `0.0.0.0` so a Caddy instance on another host can reach it. Production and development therefore cannot run at the same time with the default configuration. Stop production before starting development, and stop development before returning to production. Restrict port 3000 so only the Caddy host or trusted LAN can reach it.

Clone and start it alongside production:

```sh
git clone --branch develop https://github.com/SleepingPanda4/JellyPulse.git /opt/jellypulse-dev
cd /opt/jellypulse-dev
cp .env.dev.example .env.dev
nano .env.dev
docker compose --env-file .env.dev -f compose.dev.yml up -d --build
docker compose --env-file .env.dev -f compose.dev.yml ps
```

Generate a new development encryption key with `openssl rand -base64 32`. Do not copy the production database password or encryption key. Before starting development, stop production so it releases port 3000:

```sh
cd /opt/jellypulse
docker compose stop app

cd /opt/jellypulse-dev
docker compose --env-file .env.dev -f compose.dev.yml up -d --build
```

Open the existing Caddy HTTPS address. Keep `DEV_SESSION_COOKIE_SECURE=true` for Caddy. If you instead use `http://YOUR-LXC-IP:3000` on a trusted LAN, set it to `false` and recreate the development app. Development has its own first-run setup and administrator session. To follow logs or stop only development:

```sh
cd /opt/jellypulse-dev
docker compose --env-file .env.dev -f compose.dev.yml logs -f app
docker compose --env-file .env.dev -f compose.dev.yml down
```

To return to production:

```sh
cd /opt/jellypulse-dev
docker compose --env-file .env.dev -f compose.dev.yml down

cd /opt/jellypulse
docker compose up -d app
```

The normal `down` command preserves the development database. Add `-v` only when you intentionally want to erase the development environment and repeat first-run setup.

The isolated stack protects production JellyPulse users, reports, notifications, sessions, and settings. However, connecting development to the same Jellyfin server still allows tested features to affect that Jellyfin server. In particular, invitation redemption creates a real Jellyfin user. Use a separate test Jellyfin server for complete isolation, or delete test accounts and avoid sending live notifications after testing.

For ongoing work, commit and push `develop` only:

```sh
git switch develop
git push -u origin develop
```

Production remains on `main` under `/opt/jellypulse`. Merge a tested release into `main` only when you are ready to deploy it. The two databases remain isolated even though the stacks alternate on the same external port.

## Backup

Back up both the database and `.env`; neither is useful alone because `APP_ENCRYPTION_KEY` decrypts the secrets stored in PostgreSQL.

```sh
install -d -m 700 /var/backups/jellypulse
cd /opt/jellypulse
docker compose exec -T db pg_dump -U reporter -d reporter > /var/backups/jellypulse/jellypulse-backup.sql
install -m 600 .env /var/backups/jellypulse/jellypulse-env.backup
```

Store these files somewhere protected. Never rotate or regenerate `APP_ENCRYPTION_KEY` on an existing database unless you first build a deliberate secret-migration process.

## Troubleshooting

Inspect the stack before changing or deleting anything:

```sh
docker compose ps -a
docker compose logs --tail=100 app db
```

- **`ERR_CONNECTION_REFUSED` from another computer:** `APP_BIND_ADDRESS` is probably `127.0.0.1`. Use an SSH tunnel, Caddy, or temporary trusted-LAN binding.
- **PostgreSQL `ECONNREFUSED`:** wait for the database health check and run `docker compose up -d` again. Inspect `docker compose logs db` if it never becomes healthy.
- **PostgreSQL password authentication failed:** the existing volume was initialized with a different password than the current `.env`. Update the PostgreSQL role password or restore the matching `.env`; do not delete the volume if it contains reports you need.
- **Jellyfin HTTP 401:** verify the actual Jellyfin username/password directly in Jellyfin, check account lockout/remote-access policy, and inspect the Jellyfin authentication log.
- **Account invitation cannot create a user:** confirm the dedicated Jellyfin API key is still valid and that the username is not already in use. The invitation remains valid after a failed attempt and is deleted only after Jellyfin successfully creates the account.
- **Notification test failed:** the destination row displays the most recent provider error. Confirm outbound DNS/network access from the JellyPulse container and verify the provider token, URL, service name, or SMTP settings.
- **Resolved report popup remains queued:** open Jellyfin as the affected user on a client that supports the `DisplayMessage` session command. Some TV clients do not advertise or implement this command; the resolution is still available under My Reports.
- **Browser security-header warnings over an IP address:** plain HTTP origins are not considered trustworthy for several browser features. Complete the Caddy/HTTPS setup before public use.

To intentionally erase JellyPulse and rerun first setup, use `docker compose down -v`. This permanently deletes reports, metrics, sessions, links, destinations, and settings. It does not delete Jellyfin media, but it should never be used as a routine troubleshooting command.

## Next additions

- Optional remote CPU/RAM agent support when Jellyfin is not on the same Docker host.
- Configurable metrics and issue retention policies.
- Issue filtering by type/date/status and CSV export.
- A QR-code landing link and a Jellyfin dashboard link/plugin.
