# Changelog

All notable changes to Boost Auto-Book are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)
(patch = fixes · minor = features · major = changes to stored data or breaking behavior)

## [Unreleased]

## [1.5.0] — 2026-09-23

### Added
- **Health tab** in Past Events (needs Fitbit sync): your tracker's numbers
  for every attended lesson of the last 90 days.
  - Per lesson: average heart rate, highest heart rate, time in the zone
    (minutes with a raised heart rate) and steps.
  - Per lesson type: lessons, average and highest heart rate, average time in
    the zone, and the effort score (Fitbit's Active Zone Minutes — the same
    number the Google Health app shows).
  - Click a lesson to open its heart-rate curve (one point every 10 seconds),
    coloured Light / Moderate / Vigorous / Peak, with zone lines, a hover
    readout, minutes per zone and that day's resting heart rate.
  - Zones are matched to your own Fitbit zones: the extension fits your max
    heart rate so its zone minutes reproduce Fitbit's across your lessons
    (falls back to your age, entered once, until there's enough data).
    Minutes per zone always use Fitbit's own figures, so the chart, the
    lesson chip and the Google Health app agree.
- Health data is fetched once per lesson and stored in the extension (a
  lesson synced minutes after class is re-checked once after 6 hours, in case
  the tracker uploaded late). It stays in this browser only — never included
  in share images, the CSV export, backups or the shareable history.

### Notes
- Calories are not shown: for manually logged workouts the Google Health app
  now displays its own estimate, which differs from the tracker's reading.

## [1.4.1] — 2026-09-23

### Fixed
- **Fitbit sync: heart rate missing on synced lessons.** Since ~Sept 11, 2026
  Google's servers drop the measured metrics sent when a workout is created,
  so lessons showed only duration and calories. The extension now writes the
  heart rate, steps and active zone minutes in a follow-up update right after
  creating each workout (which Google keeps), and verifies it stuck — the
  Google Health / Fitbit app again shows average heart rate and the full
  heart-rate zone chart.
- A repair pass after every sync restores heart rate on the extension's own
  workouts from the last 30 days that are missing it (retried up to 5 times,
  e.g. while the tracker hasn't synced; windows with no tracker data are
  skipped). Workouts logged by hand or by other apps are never touched.
- Active zone minutes are now the total across all heart-rate zones (was
  only the cardio zone).

### Known limitations
- Google now owns the calories and title of manually logged workouts: the app
  shows Google's own calorie estimate rather than the tracker's measured
  value, and the title is the exercise type ("Stretching"); the studio name
  stays in the workout notes.

## [1.4.0] — 2026-08-01

### Added
- **Fitbit sync**: attended lessons are automatically logged to your Fitbit
  account as workouts via the Google Health API, a few minutes after each
  lesson ends. Each workout carries the class name and studio in its title
  ("Stretching at Studio Training Harmony"), the correct exercise type
  (Pilates, CrossFit, Calisthenics, …), and your tracker's measured metrics
  for the lesson window — average heart rate, calories, steps, and active
  zone minutes. Fitbit then shows the full heart-rate zone chart and syncs
  the workout onward to Health Connect for other health apps.
  - Set up in Settings → Fitbit sync: requires a free personal Google Cloud
    project (enable "Google Health API", create a Web-application OAuth
    client with the redirect URI shown in the card, add yourself as a test
    user with the three googlehealth scopes), then paste the Client ID +
    Secret and Connect.
  - Syncs run ~5 minutes after each booked lesson ends (with an automatic
    retry while waiting for the watch to sync), plus a 6-hourly backstop.
    History backfills from your oldest fetched lesson; the "Sync lessons
    from" date limits how far back.
  - Lessons are deduplicated — re-syncing never creates duplicates.
  - Note: while the Google project's consent screen is in "Testing" mode,
    Google expires access every 7 days and the card asks to reconnect;
    publish the consent screen ("In production") to make it permanent.

### Changed
- Backup downloads are now named `boost-autobook-backup-<user>-<YYYY-MM-DD>.json`
  (signed-in user's name + backup date), so repeated backups and different
  accounts' backups don't overwrite each other.

## [1.3.1] — 2026-07-21

### Fixed
- Timezone correctness for travelling laptops: studio date/time strings were
  parsed in the device's local timezone, so away from Israel the 72h open
  moment shifted by the timezone difference (west = snipe fired hours late,
  east = hours early). All timing math (open moment, lesson start, booked-date
  lookups, calendar↔registration matching) now interprets studio times
  explicitly in Asia/Jerusalem (DST-aware via Intl), in both the background
  worker and the Home-page content script. In Israel nothing changes.

## [1.3.0] — 2026-07-21

### Added
- Full-page mode: a ⛶ button in the popup header opens the same dashboard as
  a full browser tab (`popup.html?page=1`). Identical functionality; the wide
  layout centers content at ~1150px, turns card lists into responsive
  multi-column grids, and enlarges the week/period calendars. What's New card
  + tour step included.

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
