# Changelog

All notable JellyPulse changes are documented here.

## [Unreleased]

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
