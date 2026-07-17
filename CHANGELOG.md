# Changelog

All notable JellyPulse changes are documented here.

## [Unreleased]

### Added

- A Portainer Web Editor stack that deploys the complete application without terminal commands and automatically generates persistent database and encryption secrets.
- Automated multi-architecture GHCR images for Portainer deployments on AMD64 and ARM64 hosts.
- Guided telemetry settings with independent CPU/RAM, GPU, and Jellyfin playback-pipeline health diagnostics.
- Automatic Jellyfin container detection for same-host Docker installations.
- An authenticated JellyPulse telemetry agent and restricted socket-proxy Compose stack for remote Jellyfin, with a clearly labeled whole-host CPU/RAM fallback for native LXC/VM installations.

### Changed

- The image-based Portainer stack is now the default `docker-compose.yml`; the repository-building stack is preserved as `compose.source.yml`.
- JellyPulse can read its database password and application encryption key from mounted secret files while retaining environment-variable compatibility.
- Telemetry errors now remain visible to administrators instead of being represented only as unavailable graph values.
- A Jellyfin server with no active viewers now reports a healthy zero-stream playback pipeline.

## [1.2.0] - 2026-07-16

### Added

- One-time Jellyfin user invitations with 30-minute, 1-hour, 1-day, or 7-day expiration.
- Secure self-service account creation that stores only a SHA-256 hash of each 256-bit invitation token and deletes the invitation after successful use.
- An isolated development Compose stack with hot reload, a separate database volume, separate secrets, and an alternate-on-port-3000 workflow.
- A private My Reports history with report status, resolution timestamps, and administrator notes.
- Durable resolution-message queues that send Jellyfin popups to the user's next compatible active client and track delivery status.
- Visibility-aware admin dashboard refresh every 10 seconds, with immediate refresh when returning to the tab.
- Live playback-position capture at report submission with a clearly labeled most-recently-watched fallback when the user is no longer playing anything.
- Active-session viewer cards under JellyPulse Overview and auto-refreshing playback progress bars on both the overview and report form.
- Hamburger navigation with separate Dashboard, Reports, Users, Report Playback, and Settings pages.
- User management summaries, persistent observed watch history, per-user filtering, most-recently-watched media, most-watched media, and report totals.
- Secure Jellyfin host/API-key reconfiguration with administrator reauthentication and no API-key disclosure.
- Category-specific quick-report options with an optional free-form description.
- An administrator report-detail popup showing playback percentage, report contents, playback metadata, captured CPU/GPU load, and resolution actions.
- A user-scoped Jellyfin library search with a **Not this item** override and stacked show, season, and episode selection.
- Five-minute report diagnostics for CPU, RAM, optional Intel/NVIDIA GPU exporters, and direct-play/remux/transcode activity.
- Report popup graphs and latest-stream details including codecs, resolution, bitrate, framerate, hardware acceleration, completion, and transcode reasons.
- A compact five-minute overview for CPU, RAM, optional Intel/NVIDIA GPU usage, and direct-play/remux/transcode activity.
- Ten-second dashboard and metric refreshes with overlap protection for slower collectors.
- A dashboard report queue sortable by show or movie, submission time, and resolved status, with full report details loaded on demand.
- Automatic grouping of multiple unresolved reports for the same Jellyfin item, including newest-first submitters and expandable individual report rows.
- A dedicated Reports page with sorting by title, season, item, submit time, user, or issue while always prioritizing unresolved reports.
- Page-wide modal scrolling, sticky popup headers, desktop gutter dismissal, Escape-key dismissal, and mobile-friendly Close controls.
- Clickable-column sorting on All Reports, plus an Open Reports overview shortcut.

### Changed

- Expanded installation, remote Jellyfin, Caddy, upgrade, backup, security, and troubleshooting documentation.
- Made `SESSION_COOKIE_SECURE` configurable through `.env` as documented.
- Moved user reports, account invitations, and pre-authenticated reporting links from the dashboard to the Users page.
- Moved notification destinations from the dashboard to the Settings page.
- Limited the dashboard queue to unresolved reports; resolved reports remain available in the complete Reports archive.
- Replaced the live playback-pipeline line graph with horizontal bars comparing current and five-minute peak direct play, remux, and transcode activity.
- Standardized every popup header to remain pinned while its content scrolls.
- Reworked My Reports into a compact, clickable list with full playback, issue, status, and resolution information available in a details popup.
- Added a 15-minute per-user Jellyfin library cache, background cache warming, and combined cached show/season/episode loading for much faster manual item selection.
- Added Jellyfin saved playback position and watched-percentage recovery for manually selected older movies and episodes.
- Added a persistent, responsive header shortcut back to the administrator dashboard from every other workspace.

## [1.1.0] - 2026-07-15

### Added

- Revocable, expiring pre-authenticated reporting links with hashed 256-bit tokens.
- Notification destinations for Home Assistant, SMTP email, Discord, Slack, ntfy, Gotify, Telegram, Pushover, generic webhooks, and Apprise API.
- Test, enable/disable, delete, and secure popup-edit controls for notification destinations.
- JellyPulse overview artwork in the GitHub README.

### Changed

- All interactive sign-ins now use Jellyfin accounts.
- The Jellyfin user selected during setup becomes the JellyPulse administrator.
- Fresh setup returns to the login page instead of automatically opening the dashboard.
- Notification delivery runs independently so an unavailable provider does not block issue submission.

### Fixed

- Added PostgreSQL startup health checks.
- Database passwords containing URL-reserved characters now work correctly.
- Improved Jellyfin authentication request compatibility and error reporting.
- Added secure localhost, LAN, SSH-tunnel, and reverse-proxy deployment guidance.

## [1.0.0] - 2026-07-15

- Initial JellyPulse release.
