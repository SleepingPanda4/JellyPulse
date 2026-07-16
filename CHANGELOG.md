# Changelog

All notable JellyPulse changes are documented here.

## [Unreleased]

### Added

- One-time Jellyfin user invitations with 30-minute, 1-hour, 1-day, or 7-day expiration.
- Secure self-service account creation that stores only a SHA-256 hash of each 256-bit invitation token and deletes the invitation after successful use.
- An isolated development Compose stack with hot reload, a separate database volume, separate secrets, and an alternate-on-port-3000 workflow.
- A private My Reports history with report status, resolution timestamps, and administrator notes.
- Durable resolution-message queues that send Jellyfin popups to the user's next compatible active client and track delivery status.
- Visibility-aware admin dashboard refresh every 10 seconds, with immediate refresh when returning to the tab.
- Live playback-position capture at report submission with a clearly labeled most-recently-watched fallback when the user is no longer playing anything.

### Changed

- Expanded installation, remote Jellyfin, Caddy, upgrade, backup, security, and troubleshooting documentation.
- Made `SESSION_COOKIE_SECURE` configurable through `.env` as documented.

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
