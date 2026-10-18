# Changelog

All notable changes to Boost Auto-Book are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)
(patch = fixes · minor = features · major = changes to stored data or breaking behavior)

## [Unreleased]

## [1.8.0] — 2026-10-18

### Added
- **Past Events → Health works without a tracker.** The tab used to replace
  itself with a "connect Fitbit" message, which hid the lesson list and the
  muscle map behind a device neither of them needs. Now it always shows your
  attended lessons, each with the muscles its workout plan worked:
  - **Per class** — lessons attended, how many had a plan saved, and the
    muscles that class works most (the heart-rate table when a tracker *is*
    connected).
  - **Lesson by lesson** — each row carries its top three muscles instead of
    heart-rate chips, and opens to the full muscle map with the plan's parts.
  - A single line under the list invites connecting a tracker, instead of the
    full-page message that used to stand in for the page.
- A lesson with a plan but **no heart rate now opens too** — for a connected
  user as well. It used to say "no heart-rate data" and show nothing, even
  when the workout plan was sitting right there.

### Changed
- `getMuscleLessons` takes an optional `since` date and then covers every
  attended lesson back to it, not just the capture window (booked lessons plus
  the last two days). The Health tab asks for its full 90 days.

### Known limitation
- Workout plans can only be captured from the day of a lesson onward — the
  studio overwrites each class's description daily — so lessons from before
  plan capture started show "No plan saved" and always will. A new user's
  Health tab fills in one lesson at a time; the first-run case says so.

## [1.7.1] — 2026-10-18

### Fixed
- **The studio renamed every class in BoostApp**, and the rename was applied to
  lessons that already happened. `Training Harmony` is now `FUNCTIONAL` and
  `Calisapiens` is now `CALISTHENICS` — the same classes under new names
  (unchanged `classNameType` ids 16130 and 16120) — while `STRENGTH` (19437)
  and `FLEXIBILITY` (21954) are new in the cycle starting 18.10.2026.
  Everything that recognised a lesson by its name string broke at once:
  - **Booking rules** whose class filter held an old name matched no class and
    silently stopped booking. A schema migration (v1 → v2) rewrites those
    filters to the current names and reports what it changed; filters the user
    typed themselves are left alone.
  - **Plan capture** skipped every lesson, so new lessons had no workout plan,
    and therefore no part bands and no muscle map.
  - **Day plans** (the 7-day look-ahead) stopped for both class types.
  - **Health logging** fell back to `EXERCISE_CLASS`. `FUNCTIONAL` keeps
    logging as `CROSSFIT`, exactly as `Training Harmony` did, so the history in
    Google Health stays one continuous series.
  - **History** counted one class as two: old records under the old name, new
    ones under the new. Totals, the type filter, the signature-session
    highlight and per-class heart-rate averages now group them together, while
    each record still shows the name it was stored under.

### Added
- `classtypes.js` — one table of the studio's classes (type id, current name,
  former names, health type, display name). Lessons are matched on
  `classNameType`, which survives a rename; names are for display only. The
  next rename is a one-line change here.

### Also in this release
- `Stretching` was FLEXIBILITY's former name as well (same weekly slots,
  Tue 19:00 and Sat 11:00) — added to the table, so rules and history that
  still say "Stretching" follow the class instead of pointing nowhere.
- **The weekly slot grid showed every renamed class twice** (once under each
  name) because `bsab_schedule` is keyed by class name and entries live for 21
  days after they were last seen. It is now keyed by class type, so a renamed
  class keeps one row under whatever it is called now; the migration drops the
  old cache and it rebuilds on the next refresh.

## [1.7.0] — 2026-10-14

### Added
- **Muscle map**: which muscles each lesson works, drawn on a body figure
  (front and back), built from the studio's posted workout plan.
  - **Upcoming** (popup): each booked lesson with a plan shows a small figure
    and its three most-worked muscles; **Lesson info** opens the full map —
    pick Whole lesson or a part (A / B / C), hover a muscle to see which
    exercises work it, hover an exercise to see its muscles.
  - **Past Events → Health**: the same map under each lesson's heart-rate
    chart; hovering a part on the chart shows that part's muscles.
  - **This week** (Health tab): the week's lessons, done and booked, on one
    figure, with a ranked list of muscles and how many lessons hit each.
  - Muscles come from the exercise names (main and helping muscles). An
    exercise the map doesn't know yet is shown as "not mapped yet".
- **Body figure** setting (Settings, and on the Health tab): *From my
  BoostApp profile* (default — read from your BoostApp profile page at most
  once a week), *Male*, *Female* or *Not specified* (a neutral figure, also
  used when the profile has no answer). Stays in this browser.

## [1.6.0] — 2026-10-14

### Added
- **Workout plan on the heart-rate chart** (Health tab, experimental): when a
  lesson has a posted plan, its parts — warm-up, A, B, C — are shaded on the
  lesson's heart-rate curve.
  - Hover the curve to see which part you were in; for timed parts (fixed
    work/rest rounds) it names the exact exercise and round, and small ticks
    mark each work interval.
  - The plan itself is listed under the chart.
  - Where each part sat is **estimated** from your heart rate (work raises it,
    set-up between parts lets it drop). Drag a part's edge to where it really
    was; your fix is saved for that lesson ("Back to estimate" undoes it).
- The extension saves the studio's written workout plan for each Training
  Harmony / Calisapiens lesson you book or attend. The studio posts the whole
  week's plans on Saturday, so they are saved as soon as they appear and
  again on the lesson day. Stored in this browser only.

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
