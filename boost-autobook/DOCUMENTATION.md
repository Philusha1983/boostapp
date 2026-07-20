# Boost Auto-Book — Documentation

A Chrome extension (Manifest V3) that watches the **Training Harmony** studio on
BoostApp and automatically registers you for group fitness lessons the instant
the studio's 72-hour registration window opens. It also mirrors your BoostApp
home page inside a popup: upcoming registrations, active subscription and its
monthly balance, participant lists, and lesson descriptions.

- **Studio:** Training Harmony (`companyNum` 256826, `getUrl` 6284d298e4b18)
- **Platform:** Chrome / Chromium, Manifest V3
- **Version:** 1.0.0
- **Languages:** English, Hebrew, Russian, Ukrainian, Arabic (RTL for Hebrew & Arabic)

---

## What it does

At its core the extension keeps a **watchlist of weekly slots** — for example
"every Tuesday at 19:00, Stretching." BoostApp only opens registration 72 hours
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
  instant the 72h window opens ("sniping").
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
| `history.html` | Class history dashboard markup + CSS (Dashboard/Story/Compare views, badges, heatmap, charts). |
| `history.js` | Class history dashboard logic: requests/aggregates history from the background, filters, badges, highlights, share/export, i18n. |
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

Registration opens **72 hours** (`openOrderTime`, data-driven) before class start.
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
the earliest legitimate moment — it does not bypass the 72h rule (the server
still enforces it). Check the studio's terms before relying on it.*
