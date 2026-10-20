# Boost Auto-Book — Documentation

A Chrome extension (Manifest V3) that watches the **Training Harmony** studio on
BoostApp and automatically registers you for group fitness lessons the instant
your studio's registration window opens. It also mirrors your BoostApp
home page inside a popup: upcoming registrations, active subscription and its
monthly balance, participant lists, and lesson descriptions.

- **Studio:** Training Harmony (`companyNum` 256826, `getUrl` 6284d298e4b18)
- **Platform:** Chrome / Chromium, Manifest V3
- **Version:** see `manifest.json` — the single source of truth (SemVer)
- **Languages:** English, Hebrew, Russian, Ukrainian, Arabic (RTL for Hebrew & Arabic)

---

## What it does

At its core the extension keeps a **watchlist of weekly slots** — for example
"every Tuesday at 19:00, Stretching." BoostApp only opens registration a set number of hours
before a class starts, so the extension polls each watched slot and, the moment
its window opens, submits the booking on your behalf. It respects your
subscription limits (monthly quota and the one-lesson-per-day rule, including
plans that allow two per day) and never double-books.

Beyond auto-booking, the popup is a compact read-only view of your BoostApp
account so you rarely need to open the site: your upcoming booked lessons, your
subscription and how many sessions remain this month, the participant roster for
any class, and the lesson description.

---

## Feature overview

**Auto-booking**

- Weekly recurring slots or one-time slots for a specific date.
- Polls `getPurchaseOptions` and fires `registerToClassWithClientActivity` the
  instant your studio's window opens ("sniping").
- A global **Auto-book** toggle in the header with a coloured **On/Off** label
  and a toast explaining the effect. When off, the *My weekly slots* tab shows a
  warning banner with a one-tap **Turn on**, and the scheduling buttons
  (recurrence, Plan this month, Skip, Pause) are disabled — Remove and Book now
  stay active.
- Respects subscription monthly/daily caps; an optional daily-limit override in
  Settings for plans that permit two lessons a day.

**Account mirror**

- **Upcoming** — your booked lessons, soonest first. Each card has Cancel,
  Participants, and Lesson info (the latter two expand inline).
- **Subscription** — active membership, monthly usage (e.g. 11/13), renewal.
- Header shows your BoostApp avatar, name and a green/red/amber sign-in dot.

**My weekly slots**

- Cards ordered by weekday (Sunday first) then time of day.
- Per-slot actions grouped by context: *Make one-time / Plan this month*
  (scheduling) and *Pause / Remove* (lifecycle).
- **Plan this month** projects each occurrence for the current subscription
  period with per-date status and skip/cancel controls, factoring in monthly and
  daily caps across all rules.

**List / Week / Period views**

- Both Upcoming and My weekly slots can switch between a card **list** and a
  7-column **week grid** (Sunday→Saturday, right-to-left in Hebrew/Arabic).
  My weekly slots has a third **Period** view.
- The toggle sits top-right on both tabs; the choice is remembered per tab.
- Week cells show time, name, teacher, status/date and (for slots) the
  month-plan rollup; empty days shrink so scheduled days get more room; today's
  column is highlighted. Full actions are shown directly in each cell, pinned to
  the bottom at a fixed size so they align across columns.
- **Period view** (My weekly slots only) renders a full-weeks calendar spanning
  the whole subscription period (`periodStart` → `periodEnd` from `getPlan`),
  stacking every occurrence per day with the same booked/scheduled/limit/daily
  status colors used elsewhere. A summary row shows the period range, lessons
  left in your plan, and the last date currently locked in; a warning banner
  appears if some monthly credits have no rule occurrence that will consume
  them before the period closes (`plan.leftover`). Days before today are filled
  from the History backfill (attended/late-cancel/cancelled/no-show), lazily
  fetched via `getHistory` the first time Period view renders and cached in
  `historyCache` (module-level in popup.js) so it isn't re-fetched on every
  action — only on manual Refresh. Days with no history data yet (or truly no
  activity) stay dimmed.
- Switching views plays a staggered scale/slide animation (respects
  `prefers-reduced-motion`).

**Class history dashboard**

- Opened as a standalone full-tab page (**History** button in the popup header)
  rather than inside the popup, since it has room for charts and a Story mode.
- **Dashboard view** — filterable stats (attended count, late-cancel rate,
  avg/week for the selected range, plus separate all-time stats), a by-class /
  by-teacher / month-trend / growth-curve breakdown row, a weekday chart +
  consistency ring, an hour×weekday punch-card heatmap (with a ✓ mark on
  attended days, not just color saturation), flip-card achievement badges, and
  a small set of celebratory highlights (signature session, momentum,
  next-milestone, plan usage/streak) — no action buttons, just information.
- **Story view** — a Wrapped-style slideshow recap; **Compare view** — slices
  history across two ranges.
- **Share/export** — a shareable image card (canvas-rendered, multiple
  templates) and a CSV export of the filtered records.
- **Health view** (needs Fitbit sync) — per attended lesson: average and
  highest heart rate, time in the zone, steps, plus averages per lesson type.
  Clicking a lesson opens its heart-rate curve (10-s points) coloured by zone;
  zones use a max heart rate fitted to the user's own Fitbit zones (fallback:
  age). Fetched once per lesson and stored locally.
- **Workout plan on the curve** (experimental, 1.6.0) — when the lesson has a
  captured plan, its parts (warm-up, A, B, C) are shaded on the curve, the
  exact exercise is shown on hover for clock-driven parts, and the plan is
  listed below. Part placement is an estimate (`lessonparts.js`: parts keep
  their planned length and order and are placed where heart rate is highest,
  with priors for a ~10-min warm-up and short gaps); dragging an edge saves a
  per-lesson fix that overrides the estimate.
- **Schedule awareness** (1.9.0) — two pieces, both keyed on `classNameType`
  so they survive a rename. `diffSchedule()` (background.js) compares one
  complete refresh of the weekly grid to the previous snapshot
  (`bsab_schedule_snap`) and classifies moved / added / removed / renamed /
  teacher-changed into `bsab_schedule_changes` (40 entries, 21 days), shown
  as a dismissible banner above the rules and notified once per batch. A
  refresh where either range fetch failed is never diffed. The 14-day fetch
  window means a single cancelled instance reports nothing and a real removal
  takes a week or two to surface — deliberate, to avoid false alarms.
  `findMovedClass()` runs when a rule finds no class: same class, same
  weekday, another hour, nearest first, offered on the card as "Move rule to
  HH:MM" (`moveTarget`) and never applied automatically.
- **Studio-scoped class types** (1.9.0) — `classtypes.js` holds Training
  Harmony's table keyed by `companyNum`. Since 1.8.1 the extension follows
  the user's own studio, so curated knowledge (former names, health type,
  display, duration) applies only at a studio in the table; `setStudio()` is
  called from `getConfig()` and from the popup/history on load. Identity by
  `classNameType` is self-describing and works anywhere, so the slot grid,
  the diff, moved-class detection and plan capture all function at studios
  the table knows nothing about.
- **Health tab without a tracker** (1.8.0) — the tab used to replace itself
  with a "connect Fitbit" message, hiding the lesson list and the muscle map
  behind a device neither needs (both come from the studio's posted plan).
  It now always renders: a per-class table (lessons, how many had a plan, the
  muscles that class works most) in place of the heart-rate table, muscle
  chips on each row in place of the heart-rate chips, and one line under the
  list inviting a tracker. A lesson with a plan but no heart-rate trace opens
  too, for connected users as well — it used to show nothing. `getMuscleLessons`
  takes an optional `since` date and then covers every attended lesson back to
  it, not just the capture window; the Health tab asks for its full 90 days.
  Plans are only captured from the lesson day onward (the studio overwrites
  each description daily), so older lessons read "No plan saved" permanently.
- **Muscle map** (1.7.0) — `muscles.js` maps each plan exercise to main /
  helping muscle groups (17 groups, ordered keyword rules; unknown names are
  reported, never dropped); `body.js` draws an original front/back SVG figure
  (male, female, neutral) with one path per muscle; `musclepanel.js` renders
  the interactive panel (part chips, hover links, plan list), the mini figure
  for Upcoming rows and the This-week view. Shown in the popup's Upcoming list
  and Lesson info, under each Health-tab chart, and as This week on the Health
  tab. Body figure: Settings → *From my BoostApp profile* (content.js reads the
  gender on `MyProfile.php` at most weekly, by the visible option text) / Male
  / Female / Not specified.
- Same 5-language i18n and theming as the popup.

**Presentation**

- Five-language UI with `t(key, params)`; full RTL layout for Hebrew and Arabic.
- Light/dark/system themes with a selector in Settings.
- Adaptive popup height that fits the active tab up to Chrome's ~600px cap.
- Mobile-aware layout, a home-screen icon and web app manifest.
- Export / import of your slot configuration (JSON) to move between browsers.

---

## Architecture

The extension has four cooperating parts plus stored state.

**`background.js` — service worker (the brain).** Holds the default config,
runs the polling alarm (`chrome.alarms`), talks to the BoostApp API, computes
month plans and subscription limits, updates the toolbar badge/title, and
performs the actual booking and cancelling. It is the single source of truth for
scheduling logic and answers all popup messages.

**`content.js` — runs on the BoostApp Home page (the eyes).** Because you are
guaranteed to be authenticated there, it reads your client id (proving sign-in),
fetches your subscription in-page, and parses your rendered upcoming
registrations, then sends everything to the background to cache. It waits for the
events widget to actually render before syncing so it never caches a premature
empty list.

**`popup.html` / `popup.js` — the UI.** Reads cached state from the background
and renders the four tabs, both view modes, the month planner, and Settings. All
i18n, theming, view switching, and animations live here.

**`history.html` / `history.js` — the class history dashboard.** A separate
full-tab page (opened via `chrome.tabs.create({url: chrome.runtime.getURL("history.html")})`
from the popup's **History** button, not a popup view) that requests
`{cmd: "getHistory"}` from the background, aggregates the returned records
client-side (stats, breakdowns, badges, highlights, heatmap), and renders the
Dashboard/Story/Compare views. It never talks to BoostApp directly — all
fetching and caching happens in the background/service-worker side.

### History sync (`background.js`)

Class history isn't available from a documented API, so the background walks
`ClassHistory.php?NextMonth=<ym>&GetDay=<ym>-01&GetUrl=<getUrl>` backward one
month at a time (`fetchHistoryBackwardInPage`, run **inside a BoostApp tab**
via `runInBoostTab`/`chrome.scripting.executeScript`, for the same
SameSite=Lax cookie reason as booking), parsing each month's `.content-boxed`
rows into `{date, time, className, studio, teacher, status, subscription}`.
The walk stops naturally after 3 consecutive empty months (past the account's
join date). Results are cached per month in `bsab_history.months` so later
visits only need to refresh the current month once `backfillComplete` is true.

**Correctness safeguards**, all keyed off signals discovered by testing
against the live site rather than documented behavior:

- **Per-account cache separation.** `#clientHeaderId`'s `data-id` (which also
  renders on `ClassHistory.php`, not just `Home.php`) is captured during the
  same fetch and stored as `bsab_history.clientId`. If a cheap current-month
  probe ever sees a different client id (a different family member signed in
  on the same browser), the cache is wiped and a full backward walk restarts
  for the new account — otherwise a stale `backfillComplete: true` from the
  previous account would suppress a real resync.
- **Auth-failure detection.** An unauthenticated request to `ClassHistory.php`
  doesn't error — it 200s after silently redirecting to `indexnew.php` (the
  landing page), with zero rows and no `#clientHeaderId`. Left undetected,
  this is indistinguishable from "genuinely 0 classes this month" and would
  permanently mark the sync complete with no data. The walk explicitly checks
  `res.redirected && !/ClassHistory\.php/i.test(res.url)`, sets
  `store.lastError = "auth"`, and refuses to mark `backfillComplete`.
- **Discarded-tab handling.** Chrome/Brave can discard inactive background
  tabs to save memory; `chrome.tabs.query` still reports a discarded tab's
  last-known URL, but injecting into it throws a misleading
  `"...manifest must request permission..."` error. `runInBoostTab` skips
  `discarded` tabs when picking one to reuse, and retries once in a fresh
  disposable tab if injection still throws.
- **Timeouts, not hangs.** Each per-month fetch has a 10s `AbortController`
  timeout; 3 consecutive timeouts/errors stop the walk early with
  `lastError = "network"` instead of leaving the page on "Loading…"
  indefinitely. A 2-minute outer timeout around the whole in-tab execution
  (`execInTabWithTimeout`) is a backstop against hangs anywhere else.

`history.js`'s empty state reads `META.lastError` and shows a distinct message
for `"auth"` vs `"network"` vs a genuinely empty account, instead of one
generic "no history" message for every case.

### Why a content script instead of pure background fetches

The `BoostApp_session` cookie is **SameSite=Lax**. A `fetch` from the background
service worker is treated as a cross-site request and arrives **unauthenticated**,
so booking/cancel would fail. The workaround: side-effectful calls run **inside a
`boostapp.co.il` tab** (via `chrome.scripting.executeScript`, or the in-page
content script), where the cookie is sent normally. Reads of your account also
happen in-page for the same reason.

### Data flow

```
BoostApp Home ──content.js──▶ syncFromPage ──▶ background cache
                                                     │
popup ◀── getState / getPlan / getSchedule ──────────┘
popup ── addSlot / cancelRegistration / bookNow / … ─▶ background ─▶ (in-tab) BoostApp API
alarm ── poll open slots ─▶ getPurchaseOptions ─▶ register (in-tab)
history.js ── getHistory ─▶ background ─▶ (in-tab, backward-walked) ClassHistory.php ─▶ bsab_history cache
```

---

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — permissions, background worker, content-script match, icons, web-accessible resources. |
| `background.js` | Service worker: config, alarms, API calls, month-plan/limit logic, booking/cancel, badge, message handlers, class-history backward sync. |
| `content.js` | Runs on Home/index pages: reads client id, subscription and upcoming events; syncs to background. |
| `popup.html` | Popup markup + all CSS (design tokens, themes, week grid, animations, RTL). |
| `popup.js` | Popup logic: i18n dictionary, rendering, list/week views, month planner, Settings, view/animation wiring. |
| `walkthrough.js` | Onboarding spotlight tour + per-version "What's new" card (5-language). Runs after `popup.js`; keeps the `WHATS_NEW` table and tour steps that MUST be updated each release (see the release checklist in the file header). |
| `history.html` | Class history dashboard markup + CSS (Dashboard/Story/Compare views, badges, heatmap, charts). |
| `history.js` | Class history dashboard logic: requests/aggregates history from the background, filters, badges, highlights, share/export, i18n. |
| `fitbit.js` | Fitbit / Google Health API: lesson sync, heart-rate repair, per-lesson health summary and 10-s trace, resting HR, max-HR calibration. Imported by the service worker. |
| `plans.js` | Workout-plan capture from the studio (`getClassInfo`): per lesson and per day (the week is posted on Saturday), plus a posting-time log. Imported by the service worker. |
| `lessonplan-parse.js` | Plan text → structured plan (parts, mode, items, timed slots). Loaded by `history.html`. |
| `muscles.js` / `body.js` / `musclepanel.js` | Muscle map: exercise → muscles, the SVG body figure, and the shared UI (popup + Health tab). |
| `lessonparts.js` | Estimates where each plan part sat on the heart-rate curve; drag/fix helpers. Loaded by `history.html`. |
| `app.webmanifest` | Web app manifest for the home-screen shortcut. |
| `icons/` | Toolbar and home-screen icons (16/32/48/128 + full-bleed 192/512). |

---

## BoostApp API (reverse-engineered)

All calls are `POST` JSON with `credentials: "include"`.

**Classes & booking** — `controllerAction/OrderClasses.php`

- `getClassesData` — schedule for a date (returns a rolling, capped window).
- `getPurchaseOptions` — returns a **transient** `classStudioActId` quote plus
  your membership `clientActivityId`; used to detect that a window has opened.
- `registerToClassWithClientActivity` — performs the booking.
- `cancelBookingToClass` / `cancelBookingInfo` — cancellation.
- `getClassInfo` — participants, capacity, waitlist, description.

**Subscription** — `controllerAction/ClientActivity.php`

- `getClientActivitiesForHomePage` with `{ companyNum, clientId,
  getAllSubscriptions: true }` — memberships and monthly/daily limits.

### Key identifiers

- **`companyNum` 256826**, **`getUrl` 6284d298e4b18**, **`clientId` 431980975**.
- The `classStudioActId` from `getPurchaseOptions` is a **transient quote id** and
  cannot be used to cancel. The **canonical booking id** (stable per class + client)
  is read from the Home page cancel button
  (`.js--class-cancel-with-new-model` `data-classid`).
- `clientActivityId` is the active membership id and **changes when the
  subscription renews**, so it is always read live.

### Registration timing

Registration opens `openOrderTime` hours before class start — a **per-class**
value from the studio's own schedule, not a fixed 72. Settings states your
studio's window, and each waiting rule shows its own opening time.
The snipe loop polls `getPurchaseOptions` until it succeeds, then registers
immediately.

---

## Stored state (`chrome.storage.local`)

| Key | Contents |
|---|---|
| `bsab_config` | companyNum, getUrl, pollMinutes, autoBook, snipeWindowMin, dailyLimitOverride, lang, theme. |
| `bsab_targets` | The watchlist (weekly/date rules, recurrence, skip dates, enabled flag, last result, cached info). |
| `bsab_client` | clientId, companyNum, name, photo, syncedAt. |
| `bsab_registrations` | Parsed upcoming lessons from the Home page. |
| `bsab_subscription` | Active membership(s) and limits. |
| `bsab_auth` | Sign-in verdict from the content script. |
| `bsab_schedule` | Persistent 7-day schedule cache (21-day TTL). |
| `bsab_history` | Class history dashboard cache: `{months: {"YYYY-MM": {rows, fetchedAt}}, backfillComplete, clientId, lastError}`. Keyed to `clientId` so a different signed-in account triggers a wipe + full re-walk instead of mixing/hiding data. `lastError` is `null` (success), `"auth"` (redirected to the landing page — session not carried into the tab), `"network"` (3 consecutive fetch timeouts/errors), or another string surfaced from a tab-execution failure. |
| `bsab_view_upcoming` / `bsab_view_slots` | Remembered list/week choice per tab (localStorage). |
| `bsab_tour_done` | Onboarding tour state: version string when completed, or `"pending-signin"` if the first run happened signed out (the full tour re-runs once after sign-in). |
| `bsab_seen_version` | Last version whose "What's new" card was shown. Any `WHATS_NEW` entries newer than this appear once after an update. |
| `bsab_lesson_health` / `bsab_lesson_hr_trace` | Per-lesson Fitbit summary and 10-s heart-rate trace, keyed `"<date> <time> <className>"`. Fetched once; never exported or shared. |
| `bsab_resting_hr` | Resting heart rate per day (zones). |
| `bsab_lesson_plans` | Captured workout plan per lesson (same key): text, header date, revisions, capture phase. |
| `bsab_day_plans` / `bsab_plan_lookahead` | Plan per day and class type (`"<date>\|<type>"`), and a log of when each day's plan first appeared (pruned after 45 days). |
| `bsab_lesson_parts` | User fixes of the part bands on the heart-rate chart: `{savedAt, guess, segs:[{key,t0,t1}], auto}` per lesson (`t0`/`t1` = seconds from lesson start). |
| `bsab_body` | Body figure for the muscle map: `{pref: "auto"\|"male"\|"female"\|"neutral", detected, checkedAt}` — `detected` from the BoostApp profile (auto only). |

**Schedule completeness note:** `getClassesData` returns only a rolling, capped
set, which once caused a weekday (Tuesday) to disappear. The fix unions a forward
window (today…+6) and a backward window (today-7…-1) with a persistent cache so
all seven weekdays are always available.

---

## Installation & use

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** and select the `boost-autobook` folder (or unzip
   `boost-autobook.zip` first).
3. Sign in to BoostApp in a normal tab. The header dot turns green and your
   name/avatar appear; the account data syncs automatically.
4. Open the popup, add weekly slots, and leave **Auto-book** on. The badge shows
   how many lessons are queued (and "!" when you're signed out).

To move your setup to another browser, use **Export** in Settings and **Import**
the JSON on the other machine.

---

## Known limitation — always-on booking

The extension can only fire while Chrome is running. For truly unattended booking
(phone or computer off) an always-on backend is needed. The blocker is
**authentication**: BoostApp login is **phone-OTP only**, which can't be
automated, so a server can only *reuse a session cookie you captured manually*.
Whether that's practical depends entirely on **how long a `BoostApp_session`
cookie stays valid** — long-lived sessions make a free Cloudflare Worker cron a
viable snipe host; short sessions leave an always-on desktop running this
extension as the realistic option. The full analysis is in
`backend-scheduler-research.md`.

*This automates only your own membership, booking classes you're entitled to at
the earliest legitimate moment — it does not bypass the studio's rule (the server
still enforces it). Check the studio's terms before relying on it.*
