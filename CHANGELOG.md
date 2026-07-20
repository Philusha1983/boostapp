# Changelog

All notable changes to Boost Auto-Book are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)
(patch = fixes · minor = features · major = changes to stored data or breaking behavior)

## [Unreleased]

## [1.1.1] — 2026-07-20

### Changed
- Update checks and the popup Feedback link are now live: `GITHUB_REPO` set to
  `Philusha1983/boostapp`.

## [1.1.0] — 2026-07-20

### Added
- Version shown in the popup footer
- Daily update check against GitHub Releases with an "update available" banner in the
  popup (zip installs don't auto-update). Enabled once `GITHUB_REPO` is set in
  `background.js`.
- Feedback link in the popup opening a prefilled GitHub issue (version + browser included)
- Storage schema versioning (`bsab_schema`) with a migration hook for future data-format changes
- Release tooling: `scripts/build.sh`, GitHub Actions release workflow, issue template

## [1.0.0] — 2026-07-20

First tagged release.

### Added
- Watchlist + automatic registration for BoostApp group lessons ("snipe" the 72h window)
- Popup dashboard: targets, subscription balance, upcoming registrations, cancellation
- Class history dashboard with month-by-month backfill
- Standalone extension-free history page (bookmarklet, `boost-autobook/standalone/`)
- Multi-language UI (en/he/ru/uk/ar), badge + tooltip status

### Fixed
- Hidden-tab login loop: after a long idle period the extension repeatedly opened and
  closed BoostApp tabs because the short "ping" closed the tab before the site finished
  restoring the session. Sign-in is now positively confirmed in-tab before any action
  (`confirmAuthInPage`), with a 10-minute cooldown after an auth failure and a distinct
  "auth" failure kind that stops the snipe/poll retry loops.
