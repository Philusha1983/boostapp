# Boost Auto-Book

A Chrome extension (Manifest V3) that watches BoostApp group lessons and
**automatically registers you the instant the studio's registration window
opens** — by default 72 hours before the lesson starts.

It works for **Training Harmony** (`app.boostapp.co.il`, studio token
`6284d298e4b18`, company `256826`) out of the box, and is configurable for any
BoostApp studio.

---

## What it does

- **Watchlist by date or weekday + time.** You don't have to pick a specific
  lesson instance — mark "Thursday 12:00" (or a specific date) and optionally
  filter by class name / teacher.
- **Live enrichment.** Every poll it pulls the real lesson and shows: class
  name, teacher, how many are registered, capacity, full/open status, and the
  exact moment registration opens.
- **Auto-register on open.** When the window opens and a spot is available, it
  books automatically using your logged-in session and active membership.
- **Precise sniping.** A few minutes before the open moment it schedules a
  one-shot alarm and then fast-retries every ~1.5s until it succeeds.
- **One-click cancel** of anything it booked.
- **My subscription + balance.** Shows your active subscription with the monthly
  balance (e.g. "Monthly: 0/13 left"), renewal text, and validity. Refreshed live
  in the background via `getClientActivitiesForHomePage` (using your client id).
- **Upcoming registrations.** Shows your booked lessons, read from the BoostApp
  Home page widget each time you open it (the home events feed is minified, so the
  extension reads what the page renders rather than a fragile endpoint).
- **Sign-in verification.** Every poll (and right before each snipe) it checks
  your BoostApp session. If you're signed out it pauses auto-booking, shows a red
  banner + toolbar badge, sends a notification, and offers a one-click **Sign in**.
- **Class history dashboard.** A "Wrapped"-style full-tab page (open via **History**
  in the popup) that walks `ClassHistory.php` backward month by month, caches it,
  and turns it into stats, achievements, a punch-card heatmap, and a Story mode —
  see `DOCUMENTATION.md` for how the sync, caching, and filters work.

> ⚠️ It **cannot** beat the studio's 72-hour gate — the server rejects bookings
> before the window opens. The extension simply fires the instant it legitimately
> can, far faster and more reliably than by hand.

---

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right) on.
3. Click **Load unpacked** and select this `boost-autobook` folder.
4. Pin the extension and **make sure you're signed in to BoostApp** in this
   Chrome profile (the extension reuses your session cookie).

Chrome must be running for background polling to occur.

---

## Use

1. Click the toolbar icon.
2. Under **Add a lesson to watch**, choose a date (or weekday) + time, optional
   class/teacher filter, and click **Add to watchlist**.
3. Each card shows live status:
   - `Opens later` — within the 72h gate; shows the exact open time + countdown.
   - `OPEN` — bookable now (auto-books if the master switch is on).
   - `FULL` — open but no spots.
   - `BOOKED` — registered; offers **Cancel booking**.
4. Toggle **Auto-book** in the header to arm/disarm automatic registration.
   Use **Book now** to force an immediate attempt, **Check now** to refresh.

---

## Settings

- **Company #** / **Studio token (GetUrl)** — prefilled for Training Harmony.
- **Poll every (minutes)** — enrichment/detection cadence (min 1; Chrome alarm limit).
- **Snipe lead (minutes)** — how early before open to switch to fast-retry.

---

## How it works (captured BoostApp API)

All calls: `POST https://app.boostapp.co.il/controllerAction/OrderClasses.php`
(JSON body, `credentials: include`).

| Action | Body | Purpose |
|---|---|---|
| `getClassesData` | `{getUrl, start_date, end_date, sessionRequire:false, eventIds:[]}` | List classes for a date → `data.classes[]` with `id, className, guideName, startTime, clientRegister, maxClient, openOrderTime` |
| `getPurchaseOptions` | `{action, classStudioDateId, companyNum, withOutUserMemberShip:false, orderType:1}` | Returns a **fresh** `data.classStudioActId` + your membership `data.membershipsData.userSubscriptions.active[0].id` |
| `registerToClassWithClientActivity` | `{action, companyNum, classStudioActId, clientActivityId}` | Books the class |
| `cancelBookingInfo` | `{action, classId:<bookingActId>, companyNum}` | Pre-cancel check (late cancellation / switchable) used by the Home page |
| `cancelBookingToClass` | `{action, companyNum, classStudioActId, actStatus:1}` | Cancels the booking |

Notes on ids:
- `getPurchaseOptions` returns a **fresh** `classStudioActId` each call (a transient order quote).
- Once booked, the registration has a **stable canonical** `classStudioActId` (shown on the Home page cancel button as `data-classid`) — that's the id used to cancel.
- Upcoming registrations are read from the Home page DOM: each card is
  `.client-booked__event__item` with `.item--title` (class), `.item--guide` (teacher),
  `.item--date`, `.item-note` (cancellation policy), `data-classid`, and a
  `.js--class-cancel-with-new-model` cancel button carrying the canonical booking id.

Open time = lesson start − `openOrderTime` hours (data-driven; defaults to 72).
`classStudioActId` is generated per `getPurchaseOptions` call, so the extension
always fetches options immediately before registering.

---

## How authentication works (important)

The BoostApp session cookie is `SameSite=Lax`, so the extension's **background**
cannot make authenticated calls on its own. Therefore:

- **Sign-in + your subscription + registrations** are read **in-page** by the
  content script whenever you're on the BoostApp Home page, and cached.
- **Booking and cancelling** are executed inside a BoostApp tab via
  `chrome.scripting` — the extension reuses an open boostapp.co.il tab, or opens
  a hidden one for the moment of the action, so the session cookie is sent.
- Read-only availability checks (`getClassesData`) work from the background
  without a session, so detection/countdowns run headlessly.

**Tip:** for the fastest sniping, keep a BoostApp tab open. Otherwise the
extension opens a hidden tab at the open moment, which costs a couple of seconds.

## Notes & limits

- **Login required.** If your session expires, booking will fail with a notice —
  just reopen BoostApp and sign in again.
- **Waitlist.** If a class is already full at the open moment the extension
  notifies you rather than guessing a waitlist call (that flow wasn't verified).
- **Cancellation policy.** Auto-booking respects the studio's policy (this studio
  allows cancellation up to ~22:00 the night before). You're responsible for
  cancelling lessons you can't attend to avoid penalties.
- This is a personal automation tool for your own account and membership.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — service worker: polling, detection, booking, alarms, messaging, history sync
- `popup.html` / `popup.js` — watchlist UI
- `history.html` / `history.js` — class history dashboard (Dashboard/Story/Compare views, i18n, share/export)
