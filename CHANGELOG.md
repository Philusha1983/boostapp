# Changelog

All notable changes to Boost Auto-Book are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)
(patch = fixes · minor = features · major = changes to stored data or breaking behavior)

## [Unreleased]

## [1.2.2] — 2026-07-21

### Fixed
- Period calendar marked future lessons "limit reached" too early: the
  projection only counted the monthly plan balance and ignored bonus /
  single-entry products (the "+N" in the subscription badge). Bonus entries
  now add to the current period's bookable capacity, and the balance chip
  shows them explicitly (e.g. "1/13 left in plan +1 bonus 🎁").

## [1.2.1] — 2026-07-21

### Changed
- The popup's Feedback link now opens the feedback form on the landing page
  (works without a GitHub account; passes the extension version along) instead
  of a prefilled GitHub issue. GitHub Issues remains available for developers.
- Landing page: added the feedback form (Web3Forms → email, all 5 languages)
  and a Feedback link in the nav/footer.

## [1.2.0] — 2026-07-21

### Added
- Onboarding walkthrough: a spotlight tour of the popup runs on first open
  (short sign-in-focused version when signed out, full tour re-runs once after
  signing in). Replayable anytime via the 🎓 Tour link in the footer. Available
  in all five UI languages (en/he/ru/uk/ar, RTL-aware).
- "What's new" intro: after each update, a one-time card lists that release's
  highlights (from the bundled `WHATS_NEW` table in `walkthrough.js`), with an
  optional "Show me" spotlight of the new UI.

### Release process
- Each release that adds a user-visible feature must add a `WHATS_NEW` entry
  (and optionally a tour step tagged `addedIn`) in `walkthrough.js` — see the
  checklist in that file's header.

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
