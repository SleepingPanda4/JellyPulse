# JellyPulse

<p align="center">
  <img src="public/jellypulse-logo.png" alt="JellyPulse logo" width="180">
</p>

## Report and Monitor

JellyPulse is a lightweight, self-hosted companion for Jellyfin. It gives users a simple way to report playback problems and gives administrators one place to monitor activity, review reports, and manage the experience.

Current release: **v1.3.0**. See [CHANGELOG.md](CHANGELOG.md) for release history.

## Key features

- Jellyfin sign-in for users and administrators. JellyPulse does not store Jellyfin passwords.
- One-click playback reports with the item, user, device, client, playback position, and issue details captured automatically.
- Most recently watched fallback when playback stopped within the last few minutes.
- Optional quick issue choices such as playback stopped, glitching, wrong language, or subtitle timing.
- Live viewer cards, playback progress, CPU, RAM, optional GPU, and transcoding activity.
- Five minutes of server telemetry saved with each report.
- Grouped unresolved reports on the dashboard and a sortable report archive.
- User watch history, My Reports, resolution notes, and Jellyfin popup messages.
- Expiring Jellyfin account invitations and revocable pre-authenticated reporting links.
- Notifications through Home Assistant, email, Discord, Slack, ntfy, Gotify, Telegram, Pushover, webhooks, and Apprise.
- Guided telemetry setup for local or remote Jellyfin servers.
- Encrypted API keys, notification credentials, session tokens, and telemetry tokens.

## Requirements

- Docker Engine with Docker Compose v2, or Docker Standalone through Portainer.
- A Jellyfin server reachable from the JellyPulse container.
- A dedicated Jellyfin API key.
- An existing Jellyfin account to use as the first JellyPulse administrator.

Jellyfin can run on the same host or another device. Authentication, reports, sessions, and playback data work remotely. CPU, RAM, and GPU data from another host require the included telemetry agent.

## Quick start with Portainer

The default `docker-compose.yml` is a complete Portainer-ready stack. It includes JellyPulse, PostgreSQL, automatic secret generation, health checks, and a restricted Docker socket proxy.

1. Open **Stacks > Add stack > Web editor** in Portainer.
2. Name the stack `jellypulse`.
3. Paste the contents of `docker-compose.yml` into the editor.
4. Keep `APP_BIND_ADDRESS=127.0.0.1` when Caddy runs on the same host. Use `0.0.0.0` only when a trusted reverse proxy on another host needs access.
5. Set `SESSION_COOKIE_SECURE=true` when JellyPulse will be accessed through HTTPS.
6. Deploy the stack and complete setup in your browser.

The `secrets-init` container exiting with code `0` is normal. It runs once to create the database password and encryption key. The `app`, `db`, and `docker-proxy` containers should remain running.

Back up the `jellypulse_postgres-data` and `jellypulse_jellypulse-secrets` volumes together. Both are required to restore the installation.

## Docker installation

Clone the repository and start the default image-based stack:

```sh
git clone https://github.com/SleepingPanda4/JellyPulse.git /opt/jellypulse
cd /opt/jellypulse
docker compose up -d
docker compose ps
```

JellyPulse binds to `127.0.0.1:3000` by default. On the same machine, open `http://localhost:3000`.

To build from source instead, create `.env` from `.env.example`, generate the encryption key with `openssl rand -base64 32`, and run:

```sh
docker compose -f compose.source.yml up -d --build
```

## First setup

The setup page asks for:

- The Jellyfin base URL as seen from the container, such as `http://10.10.10.50:8096`. Do not include `/web`.
- A dedicated API key from **Jellyfin Dashboard > Advanced > API Keys**.
- The Jellyfin username and password for the account that should administer JellyPulse.

The password is sent to Jellyfin for verification and is never stored. After setup, JellyPulse returns to the Jellyfin login page.

## HTTPS with Caddy

For Caddy on the same host, keep JellyPulse bound to localhost:

```caddyfile
jellypulse.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Use these stack values:

```env
APP_BIND_ADDRESS=127.0.0.1
SESSION_COOKIE_SECURE=true
```

If Caddy runs on another host, set `APP_BIND_ADDRESS=0.0.0.0`, proxy to `JELLYPULSE-IP:3000`, and use the firewall to allow port 3000 only from the Caddy host.

For temporary access without exposing the port, create an SSH tunnel:

```sh
ssh -L 3000:127.0.0.1:3000 root@JELLYPULSE-IP
```

Then open `http://localhost:3000`.

## Telemetry

Open **Settings > Telemetry** to test CPU/RAM, GPU, and Jellyfin playback data independently.

- Same Docker host: JellyPulse automatically looks for the Jellyfin container through its read-only socket proxy.
- Different Docker host: deploy `compose.telemetry-agent.yml` beside Jellyfin and connect it using the generated agent token.
- Native Jellyfin install: the remote agent can report whole-host CPU and RAM from a read-only `/proc` mount.
- GPU usage: connect a compatible Intel or NVIDIA Prometheus exporter. GPU telemetry is optional.

The telemetry agent should be available only over a private LAN or VPN. Restrict port `9469` so only the JellyPulse host can reach it.

## Security notes

- Use HTTPS before making JellyPulse publicly available.
- Keep PostgreSQL and the Docker socket proxy private. The provided stack does not publish either port.
- Treat reporting links and account invitations like passwords. Use short expiration times and revoke exposed links.
- Never replace the application encryption key on an existing installation. Stored secrets cannot be decrypted without the original key.
- Jellyfin API keys, notification credentials, and telemetry tokens are encrypted with AES-256-GCM before being stored.

## Updating

In Portainer, open the stack, enable **Re-pull image**, and select **Update the stack**. Keep both named volumes attached.

For a cloned installation:

```sh
cd /opt/jellypulse
git pull --ff-only origin main
docker compose pull
docker compose up -d
```

To pin a release, set `JELLYPULSE_IMAGE=ghcr.io/sleepingpanda4/jellypulse:1.3.0` in the stack environment.

## Backup

For the default stack, back up both named volumes together:

- `jellypulse_postgres-data`
- `jellypulse_jellypulse-secrets`

For a source-built installation, back up the database and `.env` together:

```sh
install -d -m 700 /var/backups/jellypulse
docker compose -f compose.source.yml exec -T db pg_dump -U reporter -d reporter > /var/backups/jellypulse/jellypulse-backup.sql
install -m 600 .env /var/backups/jellypulse/jellypulse-env.backup
```

## Troubleshooting

Start with:

```sh
docker compose ps -a
docker compose logs --tail=100 app db
```

- **Connection refused:** JellyPulse is probably bound to `127.0.0.1`. Use Caddy, an SSH tunnel, or a trusted LAN binding.
- **Database connection refused:** wait for PostgreSQL to become healthy, then run `docker compose up -d` again.
- **Database password rejected:** the database volume was created with a different password or secrets volume. Restore the matching volumes together.
- **Jellyfin HTTP 401:** test the username and password directly in Jellyfin, then verify the account is enabled and the API key is valid.
- **Telemetry unavailable:** open **Settings > Telemetry** and run diagnostics. Each source displays its own connection error.
- **Notification test failed:** verify the provider URL, token, service name, or SMTP settings and confirm the container has outbound network access.

To intentionally erase JellyPulse and repeat first setup, run `docker compose down -v`. This permanently deletes JellyPulse reports, settings, links, metrics, and stored secrets. It does not delete Jellyfin media.

## Development

Use the isolated development stack so production data is not touched:

```sh
git switch develop
cp .env.dev.example .env.dev
docker compose --env-file .env.dev -f compose.dev.yml up -d --build
```

Production and development both use port `3000` by default, so run only one at a time.
