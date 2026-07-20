/* ============================================================================
 * Boost Auto-Book — background service worker
 * ----------------------------------------------------------------------------
 * Polls the BoostApp lesson API on a schedule, enriches each watch-list target
 * with live info (class name, teacher, registered/capacity), and — when the
 * studio's registration window opens (default 72h before the lesson) —
 * automatically registers the user.
 *
 * All requests reuse the user's logged-in session cookie (credentials:include),
 * so the user must be signed in to BoostApp in this Chrome profile.
 *
 * IMPORTANT: this cannot register earlier than the studio's server allows.
 * It detects the open moment and fires within seconds.
 * ==========================================================================*/

const API_URL = "https://app.boostapp.co.il/controllerAction/OrderClasses.php";

const DEFAULT_CONFIG = {
  companyNum: "256826",          // Training Harmony studio
  getUrl: "6284d298e4b18",       // studio public token (from the lessons URL)
  pollMinutes: 1,                // how often to poll for enrichment / detection
  autoBook: true,                // master switch for automatic registration
  snipeWindowMin: 5,             // start tight fast-retry this many minutes before open
  dailyLimitOverride: 0,         // 0 = auto-detect from subscription; >0 overrides the local warning
  lang: "en",                    // popup UI language: en / he / ru / uk / ar
  theme: "system"                // popup theme: system / light / dark
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
async function getConfig() {
  const { bsab_config } = await chrome.storage.local.get("bsab_config");
  return Object.assign({}, DEFAULT_CONFIG, bsab_config || {});
}
async function setConfig(patch) {
  const cfg = await getConfig();
  const next = Object.assign(cfg, patch);
  await chrome.storage.local.set({ bsab_config: next });
  return next;
}
async function getTargets() {
  const { bsab_targets } = await chrome.storage.local.get("bsab_targets");
  return Array.isArray(bsab_targets) ? bsab_targets : [];
}
async function setTargets(targets) {
  await chrome.storage.local.set({ bsab_targets: targets });
  return targets;
}
async function updateTarget(id, patch) {
  const targets = await getTargets();
  const i = targets.findIndex(t => t.id === id);
  if (i >= 0) {
    targets[i] = Object.assign(targets[i], patch);
    await setTargets(targets);
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Versioning: update check + storage schema
//
// Distribution is by zip (loaded unpacked), which never auto-updates — so the
// extension itself checks GitHub Releases once a day and the popup shows an
// "update available" banner. Set GITHUB_REPO ("owner/repo") after creating
// the GitHub repository; while empty, update checks and the feedback link
// are silently disabled.
// ---------------------------------------------------------------------------
const GITHUB_REPO = "Philusha1983/boostapp";
const UPDATE_CHECK_ALARM = "updateCheck";
const UPDATE_CHECK_MAX_AGE_MS = 60 * 60 * 1000; // popup refreshes cache older than this

// Numeric dotted-version compare: 1 / 0 / -1.
function cmpVersions(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// GitHub's API is CORS-open, so no extra host permission is needed.
async function checkForUpdate() {
  if (!GITHUB_REPO) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    const rel = await res.json();
    const latest = String(rel.tag_name || "").replace(/^v/, "");
    if (!latest) return null;
    const info = { latest, url: rel.html_url, checkedAt: Date.now() };
    await chrome.storage.local.set({ bsab_update: info });
    return info;
  } catch (e) { return null; }
}

// Storage schema version. User data (targets, history cache, auth state)
// survives extension updates, so any future change to a stored format must
// bump SCHEMA_VERSION and add a migration step here — never reinterpret old
// data in place.
const SCHEMA_VERSION = 1;
async function migrateSchema() {
  const { bsab_schema } = await chrome.storage.local.get("bsab_schema");
  const from = bsab_schema || 1;
  // Future migrations, oldest first:
  // if (from < 2) { ...transform stored data from v1 to v2... }
  if (from !== SCHEMA_VERSION) { /* placeholder until the first real migration */ }
  await chrome.storage.local.set({ bsab_schema: SCHEMA_VERSION });
}

// ---------------------------------------------------------------------------
// Sign-in verification
// ---------------------------------------------------------------------------
const SITE = "https://app.boostapp.co.il";
const SESSION_COOKIE = "BoostApp_session";

// Quick negative gate: no session cookie at all => definitely signed out.
async function hasSessionCookie() {
  try {
    const c = await chrome.cookies.get({ url: SITE, name: SESSION_COOKIE });
    return !!(c && c.value);
  } catch (e) {
    return true; // can't read cookies -> don't use this as the deciding factor
  }
}

// Sign-in state is established IN-PAGE by the content script (which can use the
// SameSite=Lax session cookie). The background CANNOT authenticate on its own,
// so verifyAuth never downgrades based on a background fetch — it reflects the
// last in-page confirmation, using cookie removal only as a negative signal.
async function verifyAuth(cfg) {
  const store = await chrome.storage.local.get(["bsab_auth", "bsab_client"]);
  const client = store.bsab_client;
  const prev = store.bsab_auth || {};

  let loggedIn = false;
  let reason = "Open BoostApp Home to sync & confirm sign-in";

  if (client && client.clientId) {
    if (!(await hasSessionCookie())) {
      loggedIn = false; reason = "signed out (session ended)";
    } else {
      // Preserve the content script's verdict; default to signed-in once synced.
      loggedIn = prev.loggedIn !== false;
      reason = loggedIn ? "signed in" : "sign in again on BoostApp";
    }
  }

  const auth = { loggedIn, checkedAt: Date.now(), reason, lastSync: client ? client.syncedAt : null };
  await chrome.storage.local.set({ bsab_auth: auth });
  await updateBadgeAndTitle();

  if (prev.loggedIn === true && loggedIn === false) {
    const targets = await getTargets();
    const armed = targets.some(t => t.enabled && !t.booked);
    notify("⚠️ Signed out of BoostApp",
      armed ? "Auto-booking is paused until you sign in again. Open BoostApp and log in."
            : "Sign in to BoostApp so auto-booking can work.");
  }
  return auth;
}

const TOOLTIP_I18N = {
  en: { signin: "Sign in to BoostApp first", checking: "Checking BoostApp connection…",
        today: "Today", at: "at", left: "{n} lessons left this month", none: "No upcoming lessons",
        wd: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] },
  he: { signin: "התחבר תחילה ל-BoostApp", checking: "בודק חיבור ל-BoostApp…",
        today: "היום", at: "בשעה", left: "נותרו {n} שיעורים החודש", none: "אין שיעורים קרובים",
        wd: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] },
  ru: { signin: "Сначала войдите в BoostApp", checking: "Проверка подключения к BoostApp…",
        today: "Сегодня", at: "в", left: "осталось {n} занятий в этом месяце", none: "Нет ближайших занятий",
        wd: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"] },
  uk: { signin: "Спочатку увійдіть у BoostApp", checking: "Перевірка підключення до BoostApp…",
        today: "Сьогодні", at: "о", left: "залишилось {n} занять цього місяця", none: "Немає найближчих занять",
        wd: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"] },
  ar: { signin: "سجّل الدخول إلى BoostApp أولًا", checking: "جارٍ التحقّق من الاتصال بـ BoostApp…",
        today: "اليوم", at: "الساعة", left: "متبقٍ {n} حصص هذا الشهر", none: "لا حصص قادمة",
        wd: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] }
};

function nextWhen(reg, L) {
  if (reg && reg.startAt) {
    const d = new Date(reg.startAt), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
    return `${sameDay ? L.today : L.wd[d.getDay()]} ${L.at} ${hh}:${mm}`;
  }
  return (reg && (reg.time || reg.date)) || "";
}

// Update the toolbar badge + hover tooltip from current state.
async function updateBadgeAndTitle() {
  const cfg = await getConfig();
  const L = TOOLTIP_I18N[cfg.lang] || TOOLTIP_I18N.en;
  const store = await chrome.storage.local.get(["bsab_auth", "bsab_registrations", "bsab_subscription"]);
  const auth = store.bsab_auth || { loggedIn: null };

  if (auth.loggedIn !== true) {
    try { chrome.action.setBadgeText({ text: "!" }); chrome.action.setBadgeBackgroundColor({ color: "#c0392b" }); } catch (e) {}
    try { chrome.action.setTitle({ title: auth.loggedIn === null ? L.checking : L.signin }); } catch (e) {}
    return;
  }

  const regs = (store.bsab_registrations && store.bsab_registrations.items) || [];
  try {
    chrome.action.setBadgeText({ text: regs.length ? String(regs.length) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#00a87a" });
  } catch (e) {}

  let next = null;
  regs.forEach(r => { if (r.startAt && (!next || r.startAt < next.startAt)) next = r; });
  if (!next && regs.length) next = regs[0];

  const subs = (store.bsab_subscription && store.bsab_subscription.items) || [];
  let remaining = null;
  subs.forEach(s => { if (s.monthly && typeof s.monthly.remaining === "number") remaining = (remaining == null) ? s.monthly.remaining : Math.max(remaining, s.monthly.remaining); });
  const leftTxt = remaining != null ? L.left.replace("{n}", remaining) : "";

  let title;
  if (next) title = `${next.className || "Lesson"} — ${nextWhen(next, L)}${leftTxt ? "  ·  " + leftTxt : ""}`;
  else title = `${L.none}${leftTxt ? "  ·  " + leftTxt : ""}`;
  try { chrome.action.setTitle({ title }); } catch (e) {}
}

// ---------------------------------------------------------------------------
// Low-level API
// ---------------------------------------------------------------------------
async function api(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { return { _raw: text, _status: res.status, success: false }; }
}

// Get every class for a given date (YYYY-MM-DD). Read-only, no session needed.
async function fetchClassesForDate(cfg, date) {
  const r = await api({
    getUrl: cfg.getUrl,
    action: "getClassesData",
    start_date: date,
    end_date: date,
    sessionRequire: false,
    eventIds: []
  });
  const classes = (r && r.data && Array.isArray(r.data.classes)) ? r.data.classes : [];
  return classes;
}

// Purchase options for a class -> { classStudioActId, clientActivityId } (needs session)
async function getPurchaseOptions(cfg, classId) {
  const r = await api({
    sessionRequire: false,
    action: "getPurchaseOptions",
    classStudioDateId: Number(classId),
    companyNum: Number(cfg.companyNum),
    withOutUserMemberShip: false,
    orderType: 1
  });
  const d = (r && r.data) || {};
  const active = (((d.membershipsData || {}).userSubscriptions || {}).active) || [];
  return {
    ok: !!(r && r.success),
    classStudioActId: d.classStudioActId || null,
    clientActivityId: active.length ? active[0].id : null,
    membershipName: active.length ? active[0].name : null,
    price: (d.membershipsData || {}).price,
    needSubscription: (d.membershipsData || {}).needSubscription,
    raw: r
  };
}

// Register (book). Needs session.
async function registerToClass(cfg, classStudioActId, clientActivityId) {
  const r = await api({
    action: "registerToClassWithClientActivity",
    companyNum: String(cfg.companyNum),
    classStudioActId: Number(classStudioActId),
    clientActivityId: Number(clientActivityId)
  });
  const ok = !!(r && (r.success || (r.data && r.data.success)));
  const msg = (r && r.data && r.data.text) || (r && r.message) || "";
  return { ok, msg, raw: r };
}

// Cancel a booking. Needs session.
async function cancelBooking(cfg, classStudioActId) {
  const r = await api({
    action: "cancelBookingToClass",
    companyNum: Number(cfg.companyNum),
    classStudioActId: Number(classStudioActId),
    actStatus: 1
  });
  const ok = !!(r && r.success);
  const msg = (r && r.data && r.data.message) || "";
  return { ok, msg, raw: r };
}

// Active subscriptions + monthly balance (needs session). clientId from page sync.
async function getClientActivities(cfg, clientId) {
  const r = await api({
    action: "getClientActivitiesForHomePage",
    companyNum: Number(cfg.companyNum),
    clientId: Number(clientId),
    getAllSubscriptions: true
  });
  const data = (r && r.data) || [];
  return data.map(s => ({
    id: s.id, itemId: s.itemId, name: s.name, shortName: s.shortName,
    startDate: s.startDate, endDate: s.endDate,
    isExpired: s.isExpired, isFrozen: s.isFrozen,
    renewText: s.hokRenewDateText, renewDate: s.hokRenewDate,
    monthly: (s.limits && s.limits.monthly) ? {
      max: s.limits.monthly.max, use: s.limits.monthly.use,
      remaining: s.limits.monthly.remaining, text: s.limits.monthly.text
    } : null,
    daily: (s.limits && s.limits.daily) ? { max: s.limits.daily.max, text: s.limits.daily.text } : null
  }));
}

// Daily lesson allowance from the user's subscription(s) — varies by plan
// (some allow 2/day). Defaults to 1 if we haven't synced a subscription yet.
async function getDailyLimit() {
  const cfg = await getConfig();
  if (cfg.dailyLimitOverride && Number(cfg.dailyLimitOverride) > 0) return Number(cfg.dailyLimitOverride);
  const { bsab_subscription } = await chrome.storage.local.get("bsab_subscription");
  const items = (bsab_subscription && bsab_subscription.items) || [];
  let max = 0;
  items.forEach(s => { const d = s.daily && s.daily.max; if (typeof d === "number") max = Math.max(max, d); });
  return max || 1;
}

// Subscription is synced by the content script (in-page, authenticated).
// A background fetch can't authenticate (SameSite=Lax), so we never overwrite
// the synced data here.
async function refreshSubscription() { return null; }

// ---------------------------------------------------------------------------
// Matching & time logic
// ---------------------------------------------------------------------------
function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Next occurrence date for a target: the soonest upcoming date matching the
// weekday that hasn't already been booked or skipped. Returns null when a
// 'once' rule is finished or nothing upcoming.
function resolveTargetDate(target) {
  if (target.mode === "date") return target.date;
  const skip = new Set(target.skipDates || []);
  const booked = new Set(target.bookedDates || []);
  const today = new Date();
  for (let i = 0; i < 6 * 7 + 1; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (d.getDay() === Number(target.weekday)) {
      const ds = ymd(d);
      if (skip.has(ds) || booked.has(ds)) continue;
      return ds;
    }
  }
  return null;
}

// Find the class object that matches a target on a given date.
function matchClass(classes, target) {
  const wantTime = target.time; // "HH:MM"
  return classes.find(c => {
    const startHM = (c.startTime || "").slice(0, 5);
    if (startHM !== wantTime) return false;
    if (target.classFilter && !(c.className || "").toLowerCase().includes(target.classFilter.toLowerCase())) return false;
    if (target.teacherFilter && !(c.guideName || "").includes(target.teacherFilter)) return false;
    return true;
  }) || null;
}

// Registration-open timestamp (ms). openOrderTime is in hours (default 72).
function openTimeMs(cls, date) {
  const hours = Number(cls.openOrderTime || 72);
  const start = new Date(`${date}T${cls.startTime || "00:00:00"}`);
  return start.getTime() - hours * 3600 * 1000;
}

// ---------------------------------------------------------------------------
// Core: enrich one target with live data, return its computed status.
// ---------------------------------------------------------------------------
// Soonest booked occurrence whose START time is still in the future.
function upcomingBookedDate(target) {
  const now = Date.now();
  let best = null;
  (target.bookedDates || []).forEach(ds => {
    const ts = new Date(ds + "T" + (target.time || "00:00") + ":00").getTime();
    if (ts > now && (best === null || ts < best.ts)) best = { ds, ts };
  });
  return best;
}
function daysAhead(ds) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(ds + "T00:00:00") - t) / 864e5);
}

async function enrichTarget(cfg, target) {
  const info = {
    recurrence: target.recurrence || "weekly",
    lastBookedDate: target.lastBookedDate || null,
    lastChecked: Date.now()
  };

  // 1) If a booked occurrence is still upcoming, that's the slot's real state.
  const ub = upcomingBookedDate(target);
  if (ub) {
    info.status = "booked";
    info.resolvedDate = ub.ds;
    info.bookedFor = ub.ds;
    info.className = target.classFilter || null;
    await updateTarget(target.id, { info });
    return info;
  }

  // 2) Otherwise look at the next occurrence to book.
  const date = resolveTargetDate(target);
  info.resolvedDate = date;
  if (!date) {
    info.status = (target.recurrence === "once" && (target.bookedDates || []).length) ? "done" : "none";
    await updateTarget(target.id, { info });
    return info;
  }

  const classes = await fetchClassesForDate(cfg, date);
  const cls = matchClass(classes, target);
  info.found = !!cls;
  if (cls) {
    info.className = cls.className;
    info.teacher = cls.guideName;
    info.registered = cls.clientRegister;
    info.capacity = cls.maxClient;
    info.classId = cls.id;
    info.openAt = openTimeMs(cls, date);
    info.startAt = new Date(`${date}T${cls.startTime || "00:00:00"}`).getTime();
  }

  let status;
  if (cls) {
    const now = Date.now();
    const full = info.registered >= info.capacity;
    if (info.startAt && now > info.startAt) status = "passed";
    else if (now < info.openAt) status = "waiting";        // before the 72h window
    else if (full) status = "full";                         // open but no spots
    else status = "open";                                   // bookable now
  } else if (daysAhead(date) > 6) {
    // Next occurrence is beyond the studio's ~7-day publish horizon: it's a valid
    // recurring slot, the week just isn't published yet. Not an error.
    status = "waiting";
    info.notPublished = true;
  } else {
    status = "not-found";                                   // genuinely missing this week
  }
  info.status = status;
  await updateTarget(target.id, { info });
  return info;
}

async function fetchClassesRange(cfg, fromOffset, toOffset) {
  const t = new Date();
  const s = ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + fromOffset));
  const e = ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + toOffset));
  const r = await api({ getUrl: cfg.getUrl, action: "getClassesData", start_date: s, end_date: e, sessionRequire: false, eventIds: [] });
  return (r && r.data && r.data.classes) || [];
}

// Build the recurring weekly slot grid. The API returns a rolling, capped set,
// so a single forward window can miss a whole weekday (e.g. today's classes have
// passed and next week's aren't published yet). We therefore union a forward AND
// a backward window, and cache the pattern (pruning slots unseen for 21 days) so
// the grid stays complete and stable across refreshes.
async function getSchedule(cfg) {
  const now = Date.now();
  let classes = [];
  try { classes = classes.concat(await fetchClassesRange(cfg, 0, 6)); } catch (e) {}
  try { classes = classes.concat(await fetchClassesRange(cfg, -7, -1)); } catch (e) {}

  const store = await chrome.storage.local.get("bsab_schedule");
  const cache = store.bsab_schedule || {};
  classes.forEach(c => {
    const wd = new Date((c.startDate || "") + "T00:00:00").getDay();
    const time = (c.startTime || "").slice(0, 5);
    if (!time || isNaN(wd)) return;
    cache[wd + "|" + time + "|" + c.className] = { weekday: wd, time, className: c.className, teacher: c.guideName, lastSeen: now };
  });
  const TTL = 21 * 864e5;
  Object.keys(cache).forEach(k => { if (!cache[k].lastSeen || now - cache[k].lastSeen > TTL) delete cache[k]; });
  await chrome.storage.local.set({ bsab_schedule: cache });

  const slots = Object.values(cache).map(s => ({ weekday: s.weekday, time: s.time, className: s.className, teacher: s.teacher }));
  slots.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
  return slots;
}

// Project each weekly rule's occurrences for the current subscription period
// AND a preview window into the next period (same length as the current
// one), with a status per occurrence, applying the shared monthly + daily
// caps chronologically across ALL rules. Returns { periodStart, periodEnd,
// nextPeriodStart, nextPeriodEnd, monthlyMax, monthlyRemaining, dailyMax,
// leftover, byRule: { ruleId: [ {date,time,status,period,...} ] } }.
// `leftover` is how many monthly credits are left AFTER every projected
// occurrence has been assigned a status — i.e. monthly credits that no
// recurring rule will consume before the period closes (0 if none, or if
// there's no subscription synced yet).
//
// NOTE: the real auto-book engine (resolveTargetDate/pollAll below) never
// checks subscription boundaries at all — it books any weekly occurrence up
// to ~6 weeks out the moment registration opens. This projection used to
// stop hard at periodEnd, which made the "My weekly slots" calendar hide
// next-period occurrences (e.g. a Saturday slot that falls on the 1st of
// next month) even though they WILL still be auto-booked. We now project
// one extra period so the UI reflects that reality. Next-period occurrences
// can't use a confirmed monthly balance (the renewal hasn't synced yet), so
// we assume it renews at the same monthlyMax and track it with a separate
// counter, flagged via `period: "next"` so the UI can render it as an
// unconfirmed preview rather than a locked-in booking.
async function computePlan(cfg) {
  const targets = (await getTargets()).filter(t => t.enabled !== false && t.mode === "weekly");
  const store = await chrome.storage.local.get(["bsab_subscription", "bsab_registrations"]);
  const subs = (store.bsab_subscription && store.bsab_subscription.items) || [];
  const regs = (store.bsab_registrations && store.bsab_registrations.items) || [];

  let monthlyMax = null, monthlyRemaining = null, periodEnd = null, periodStart = null;
  subs.forEach(s => {
    if (s.monthly && (monthlyMax == null || s.monthly.max > monthlyMax)) { monthlyMax = s.monthly.max; monthlyRemaining = s.monthly.remaining; periodStart = s.startDate || periodStart; }
    if (s.endDate && (!periodEnd || s.endDate > periodEnd)) periodEnd = s.endDate;
  });
  const dailyMax = await getDailyLimit();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = periodEnd ? new Date(periodEnd + "T23:59:59") : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  const start = periodStart ? new Date(periodStart + "T00:00:00") : new Date(today.getFullYear(), today.getMonth(), 1);

  // One extra cycle, the same length (in whole days) as the current period,
  // so next-period occurrences (e.g. next month's recurring slots) show up
  // as a preview instead of silently disappearing off the end of the grid.
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const periodLenDays = Math.round((endDay - startDay) / 864e5) + 1;
  const nextStart = new Date(end); nextStart.setDate(nextStart.getDate() + 1); nextStart.setHours(0, 0, 0, 0);
  const nextEnd = new Date(nextStart); nextEnd.setDate(nextEnd.getDate() + periodLenDays - 1); nextEnd.setHours(23, 59, 59, 999);

  const regFor = (ds, time) => regs.find(r => {
    if (!r.startAt) return false;
    const d = new Date(r.startAt);
    const rt = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return ymd(d) === ds && rt === time;
  });

  const occ = [];
  targets.forEach(t => {
    for (let d = new Date(today); d <= nextEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== Number(t.weekday)) continue;
      const ds = ymd(d);
      occ.push({
        ruleId: t.id, className: t.classFilter || "", date: ds, time: t.time,
        booked: (t.bookedDates || []).includes(ds), skipped: (t.skipDates || []).includes(ds),
        period: d <= end ? "current" : "next"
      });
    }
  });
  // One-time date rules (e.g. added by clicking a day in the calendar) also
  // consume balance and belong on the grid — include any within the window.
  const dateTargets = (await getTargets()).filter(t => t.enabled !== false && t.mode === "date" && t.date);
  dateTargets.forEach(t => {
    const dd = new Date(t.date + "T00:00:00");
    if (isNaN(dd) || dd < today || dd > nextEnd) return;
    occ.push({
      ruleId: t.id, className: t.classFilter || "", date: t.date, time: t.time,
      booked: (t.bookedDates || []).includes(t.date), skipped: (t.skipDates || []).includes(t.date),
      period: dd <= end ? "current" : "next"
    });
  });
  occ.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  let remaining = (monthlyRemaining == null) ? Infinity : monthlyRemaining;
  let nextRemaining = (monthlyMax == null) ? Infinity : monthlyMax; // best-guess renewal amount, unconfirmed until next period syncs
  const dayCount = {};
  occ.forEach(o => {
    if (o.skipped) { o.status = "skipped"; return; }
    if (o.booked) {
      o.status = "booked";
      const r = regFor(o.date, o.time);
      if (r) { o.cancelActId = r.bookingActId; o.classId = r.classId; }
      dayCount[o.date] = (dayCount[o.date] || 0) + 1;
      return;
    }
    if ((dayCount[o.date] || 0) >= dailyMax) { o.status = "daily"; return; }  // day already allocated
    if (o.period === "current") {
      if (remaining <= 0) { o.status = "limit"; return; }                    // monthly cap reached
      o.status = "scheduled"; remaining--; dayCount[o.date] = (dayCount[o.date] || 0) + 1;
    } else {
      // Next period: no confirmed balance yet. Project it optimistically
      // (matching the real booking engine, which doesn't gate on this
      // either) but still respect the assumed renewal amount so the
      // preview doesn't over-promise indefinitely.
      if (nextRemaining <= 0) { o.status = "limit"; return; }
      o.status = "scheduled"; nextRemaining--; dayCount[o.date] = (dayCount[o.date] || 0) + 1;
    }
  });

  const byRule = {};
  occ.forEach(o => { (byRule[o.ruleId] = byRule[o.ruleId] || []).push(o); });
  const leftover = (monthlyRemaining == null) ? 0 : Math.max(0, remaining);
  return {
    periodStart: ymd(start), periodEnd: ymd(end),
    nextPeriodStart: ymd(nextStart), nextPeriodEnd: ymd(nextEnd),
    monthlyMax, monthlyRemaining, dailyMax, leftover, byRule
  };
}

// ---------------------------------------------------------------------------
// Class history (past events) — powers the History dashboard.
// ClassHistory.php is a plain server-rendered page (not a JSON API), so we
// fetch+parse its HTML from INSIDE a boostapp tab (needed for the
// SameSite=Lax session cookie), one GET per month via
// ClassHistory.php?NextMonth=YYYY-MM&GetDay=YYYY-MM-01&GetUrl=<token>.
// Past months never change once the month is over, so they're cached forever
// in chrome.storage.local; only the current month is re-fetched each time.
// ---------------------------------------------------------------------------
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

async function getHistoryStore() {
  const { bsab_history } = await chrome.storage.local.get("bsab_history");
  return bsab_history || { months: {}, backfillComplete: false, clientId: null };
}
async function setHistoryStore(store) {
  await chrome.storage.local.set({ bsab_history: store });
}

function historyDateToISO(dateStr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Classifies the studio's free-text status label. Order matters: "late
// cancellation" also contains the generic "cancel" substring.
function classifyHistoryStatus(raw) {
  const s = String(raw || "");
  // Order matters: "לא הגיע" (no-show) contains "הגיע" (attended) as a
  // substring, and "ביטול מאוחר" (late cancel) contains "ביטול" (cancelled) —
  // check the more specific patterns first.
  if (/ביטול מאוחר|late.?cancel/i.test(s)) return "lateCancel";
  if (/לא הגיע|no.?show/i.test(s)) return "noShow";
  if (/הגיע|מומש|attended/i.test(s)) return "attended";
  if (/ביטול|cancel/i.test(s)) return "cancelled";
  return "other";
}

function normalizeHistoryRow(month, raw) {
  const date = historyDateToISO(raw.dateStr);
  if (!date) return null;
  return {
    date, weekday: new Date(date + "T00:00:00").getDay(), time: raw.time || "",
    className: raw.className || "(unnamed)", teacher: raw.teacher || "",
    studio: raw.studio || "", status: classifyHistoryStatus(raw.statusRaw),
    statusRaw: raw.statusRaw || "", month
  };
}

// Walk backward from `startYm`, one month per request, stopping after three
// consecutive empty months (a reasonable signal we've gone past the account's
// join date) or after `maxMonths` as a hard safety cap. Runs entirely inside
// the tab so all requests carry the session cookie. Requires at least 2
// months to have been checked before the empty-streak can end the walk, so a
// current month that's naturally sparse (just started) can't trigger a false
// stop on its own.
//
// Also captures #clientHeaderId's data-id from whichever page it can find it
// on — confirmed live that this header (and therefore the signed-in client
// id) renders on ClassHistory.php too, not just Home.php — so the caller can
// tell whether this cache still belongs to whoever is currently signed in.
//
// IMPORTANT: confirmed live that an UNAUTHENTICATED request to ClassHistory.php
// doesn't 401/403 — it silently 200s after redirecting to indexnew.php (the
// landing page), which naturally has zero ".content-boxed" rows and no
// #clientHeaderId. That's indistinguishable from "this month really had no
// classes" unless we explicitly check for the redirect, so we do — and treat
// it as a hard failure (stop immediately, report authFailed) rather than
// letting the walk run to completion thinking every month was just empty.
function fetchHistoryBackwardInPage(getUrl, startYm, maxMonths) {
  return (async () => {
    const out = {};
    let clientId = null;
    let [y, m] = startYm.split("-").map(Number);
    // errorStreak is separate from emptyStreak: a genuinely empty month is a
    // *successful* fetch with zero rows and should reset any error count, but
    // it must NOT reset emptyStreak's sibling meaning — repeated thrown
    // errors (timeouts, aborted requests, etc.) are a systemic failure, not
    // "we've walked past the account's join date", and must stop the walk
    // quickly rather than burning through all `maxMonths` one slow timeout
    // at a time (which is what left the page stuck on "Loading…" indefinitely
    // before this fix — each fetch had no timeout at all, so a single hung
    // request blocked the whole sync forever).
    let emptyStreak = 0, errorStreak = 0, months = 0, authFailed = false, networkFailed = false;
    while (months < maxMonths) {
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      try {
        const url = `/ClassHistory.php?NextMonth=${ym}&GetDay=${ym}-01&GetUrl=${getUrl}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10000);
        let res;
        try {
          res = await fetch(url, { credentials: "include", signal: ctrl.signal });
        } finally {
          clearTimeout(timer);
        }
        if (res.redirected && !/ClassHistory\.php/i.test(res.url)) {
          authFailed = true;
          break; // signed out (or session not carried into this tab) — stop, don't cache this as "empty"
        }
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!clientId) {
          const header = doc.getElementById("clientHeaderId");
          if (header && header.dataset.id) clientId = header.dataset.id;
        }
        const rows = Array.from(doc.querySelectorAll(".content-boxed")).map(box => {
          const spans = Array.from(box.querySelectorAll("span"));
          const black = spans.filter(s => (s.className || "").includes("color-black")).map(s => s.textContent.trim());
          const grayDark = spans.filter(s => (s.className || "").includes("color-gray-dark")).map(s => s.textContent.trim()).filter(Boolean);
          const classNameSpan = spans.find(s => (s.className || "").includes("btn-light"));
          const plain = spans.filter(s => (s.className || "").trim() === "").map(s => s.textContent.trim()).filter(Boolean);
          return {
            dateStr: black[1] || "", time: black[2] || "",
            className: classNameSpan ? classNameSpan.textContent.trim() : "",
            studio: grayDark[0] || "", teacher: grayDark.length ? grayDark[grayDark.length - 1] : "",
            statusRaw: plain[0] || "", subscriptionRaw: plain[1] || ""
          };
        });
        out[ym] = rows;
        emptyStreak = rows.length ? 0 : emptyStreak + 1;
        errorStreak = 0;
      } catch (e) {
        out[ym] = null; emptyStreak = 0; errorStreak++; // network hiccup — don't treat as the "past join date" boundary
        if (errorStreak >= 3) { networkFailed = true; break; } // but 3 in a row is a systemic failure, not a fluke — stop
      }
      months++;
      if (emptyStreak >= 3 && months >= 2) break;
      m--; if (m < 1) { m = 12; y--; }
    }
    return { months: out, clientId, authFailed, networkFailed };
  })();
}

// Merges a { months, clientId, authFailed } fetch result into a history store
// in place. An auth failure never counts as a successful sync — it must not
// flip backfillComplete, or the extension would permanently believe "0
// classes" for an account it was never actually able to read.
function mergeHistoryResult(store, result) {
  if (!result || result.authFailed) return;
  const monthsMap = result.months;
  if (monthsMap && typeof monthsMap === "object") {
    Object.entries(monthsMap).forEach(([ym, rows]) => {
      if (rows === null) return; // fetch failed — leave cached value (if any) untouched
      store.months[ym] = { rows: rows.map(r => normalizeHistoryRow(ym, r)).filter(Boolean), fetchedAt: Date.now() };
    });
    // A network failure means the walk stopped early because of repeated
    // timeouts/errors, not because it reached the natural "no more history"
    // boundary — so whatever months WERE fetched are still good to cache,
    // but backfill must not be marked complete, or a later Resync would
    // never resume walking further back to fill in the rest.
    if (!result.networkFailed) store.backfillComplete = true;
  }
}

// Classifies a runInBoostTab result into a short reason string for storage /
// UI display, or null on success. Distinguishes "we positively saw a
// sign-out redirect" (authFailed) from "runInBoostTab couldn't even execute"
// (the ok:false shape returned by runInBoostTab's own error paths) — both
// used to collapse into the same silent `null` lastError, which is why a
// total execution failure looked identical to "nothing went wrong yet".
function classifyHistoryResult(result) {
  if (!result) return "no response from BoostApp tab";
  if (result.authFailed) return "auth";
  if (result.ok === false) return result.reason || "unknown failure";
  if (result.networkFailed) return "network";
  return null;
}

// First call does the full backward walk (one in-tab execution, natural
// early-stop); once backfilled, subsequent calls just refresh the current
// month (a single cheap request) — UNLESS the currently signed-in account
// (read from the same page's #clientHeaderId) no longer matches whoever this
// cache was built for, e.g. a different family member signed in, or a fresh
// account on the same browser. In that case the cached months belong to
// someone else, so we discard them and do a full re-walk for the new person
// instead of silently mixing two people's class history or appearing empty
// forever because the cheap 1-month path never repopulates the older months.
async function ensureHistoryFetched(cfg) {
  let store = await getHistoryStore();
  const curYm = monthKey(new Date());

  if (!store.backfillComplete) {
    const full = await runInBoostTab(fetchHistoryBackwardInPage, [cfg.getUrl, curYm, 36]);
    if (full && full.clientId) store.clientId = String(full.clientId);
    mergeHistoryResult(store, full);
    store.lastError = classifyHistoryResult(full);
    await setHistoryStore(store);
    return store;
  }

  const probe = await runInBoostTab(fetchHistoryBackwardInPage, [cfg.getUrl, curYm, 1]);
  const seenClientId = probe && probe.clientId ? String(probe.clientId) : null;

  if (seenClientId && store.clientId && store.clientId !== seenClientId) {
    store = { months: {}, backfillComplete: false, clientId: seenClientId };
    const full = await runInBoostTab(fetchHistoryBackwardInPage, [cfg.getUrl, curYm, 36]);
    mergeHistoryResult(store, full);
    store.lastError = classifyHistoryResult(full);
    await setHistoryStore(store);
    return store;
  }

  if (seenClientId && !store.clientId) store.clientId = seenClientId;
  mergeHistoryResult(store, probe);
  store.lastError = classifyHistoryResult(probe);
  await setHistoryStore(store);
  return store;
}

// ---------------------------------------------------------------------------
// Running authenticated calls IN A BOOSTAPP TAB
// The session cookie is SameSite=Lax, so background fetches aren't authenticated.
// We execute booking/cancel inside a boostapp.co.il tab (reusing an open one, or
// opening a hidden one) where same-site fetches DO carry the cookie.
// ---------------------------------------------------------------------------
function waitForTabComplete(tabId) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); };
    const listener = (id, info) => { if (id === tabId && info.status === "complete") finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(t => { if (t && t.status === "complete") finish(); }).catch(finish);
    setTimeout(finish, 15000);
  });
}

// Logs to the service worker console (visible via chrome://extensions ->
// "service worker" -> Console) so failures here are diagnosable without
// having to catch a hidden tab that closes itself right after use.
function logRunTab(...args) { try { console.log("[Boost Auto-Book]", ...args); } catch (e) {} }
function errRunTab(...args) { try { console.error("[Boost Auto-Book]", ...args); } catch (e) {} }

// Runs `chrome.scripting.executeScript` in one specific tab, normalizing every
// outcome (thrown error, empty results, or a per-frame injection error) into
// either the injected function's real return value or a { ok:false, reason }
// failure shape — never a bare null/undefined that a caller could mistake for
// "ran fine, found nothing".
async function execInTab(tabId, func, args) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  logRunTab("executeScript results:", JSON.stringify(results));
  if (!results || !results.length) return { ok: false, reason: "executeScript returned no results" };
  if (results[0].result == null && results[0].error) {
    errRunTab("injected script errored:", results[0].error);
    return { ok: false, reason: "injected script error: " + (results[0].error.message || JSON.stringify(results[0].error)) };
  }
  return results[0].result != null ? results[0].result : { ok: false, reason: "injected script returned no result" };
}

// Defense-in-depth: fetchHistoryBackwardInPage already times out each of its
// own fetches, but this wraps the *entire* in-tab execution with an outer
// ceiling so that any other unforeseen hang (a stuck DOMParser call, a
// browser-specific quirk, executeScript itself never settling, etc.) can
// never leave the History page stuck on "Loading…" forever. Rejects with a
// plain Error, which the callers' existing try/catch already treats as a
// tab-execution failure (triggering the fresh-tab retry in runInBoostTab).
function execInTabWithTimeout(tabId, func, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`execInTab timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    execInTab(tabId, func, args).then(
      r => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } },
      e => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } }
    );
  });
}

// ---------------------------------------------------------------------------
// Auth confirmation gate + cooldown (loop breaker)
//
// Problem this solves: after a long signed-out/idle period, the hidden tab's
// "complete" event fires BEFORE the site's own JS has finished restoring the
// session, so the injected action ran unauthenticated, failed with a generic
// reason, and the snipe/poll retry machinery opened another hidden tab —
// forever. The "short ping" was never long enough to confirm sign-in.
//
// Fix: before running any real action in a tab, positively confirm sign-in
// (waiting up to `timeoutMs` for the page to finish restoring the session).
// On failure, record it and refuse to open NEW hidden tabs for a cooldown
// period, until an in-page sync (content script on Home) proves sign-in again.
// ---------------------------------------------------------------------------
const AUTH_FAIL_COOLDOWN_MS = 10 * 60 * 1000;

// Injected into the BoostApp tab. Resolves { loggedIn } — polls until the
// signed-in header renders, or an authenticated probe succeeds, or timeout.
// An unauthenticated request to ClassHistory.php silently 200s after
// redirecting to the landing page (confirmed live), so the redirect is the
// negative signal; keep re-probing because the page's own JS may still be
// in the middle of restoring the session.
function confirmAuthInPage(timeoutMs) {
  return (async () => {
    const deadline = Date.now() + timeoutMs;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (;;) {
      const h = document.getElementById("clientHeaderId");
      if (h && h.dataset.id) return { loggedIn: true, how: "header" };
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        let res;
        try { res = await fetch("/ClassHistory.php", { credentials: "include", signal: ctrl.signal }); }
        finally { clearTimeout(t); }
        if (res && res.ok && !(res.redirected && !/ClassHistory\.php/i.test(res.url))) {
          return { loggedIn: true, how: "probe" };
        }
      } catch (e) { /* network hiccup — keep waiting until deadline */ }
      if (Date.now() >= deadline) return { loggedIn: false };
      await sleep(1500);
    }
  })();
}

async function inAuthFailCooldown() {
  const store = await chrome.storage.local.get(["bsab_authfail", "bsab_auth"]);
  if (store.bsab_auth && store.bsab_auth.loggedIn === true) return false; // sign-in re-proven since
  const f = store.bsab_authfail;
  return !!(f && f.at && (Date.now() - f.at) < AUTH_FAIL_COOLDOWN_MS);
}

async function recordAuthFail() {
  const store = await chrome.storage.local.get("bsab_auth");
  const prev = store.bsab_auth || {};
  await chrome.storage.local.set({
    bsab_authfail: { at: Date.now() },
    bsab_auth: { loggedIn: false, checkedAt: Date.now(), reason: "session expired — sign in on BoostApp", lastSync: prev.lastSync || null }
  });
  await updateBadgeAndTitle();
  // Notify only on the true->false transition so a broken session can't spam.
  if (prev.loggedIn === true) {
    notify("⚠️ Signed out of BoostApp", "Your session expired. Auto-booking is paused — open BoostApp and sign in again.");
  }
}

async function clearAuthFail() {
  try { await chrome.storage.local.remove("bsab_authfail"); } catch (e) {}
}

// Confirms sign-in in `tabId`; returns null when signed in, or an
// { ok:false, authFailed:true } result the caller should return as-is.
async function authGate(tabId, waitMs) {
  const gate = await execInTabWithTimeout(tabId, confirmAuthInPage, [waitMs], waitMs + 10000);
  if (gate && gate.loggedIn === false) {
    errRunTab("auth gate: could not confirm sign-in within", waitMs, "ms");
    await recordAuthFail();
    return { ok: false, authFailed: true, reason: "not signed in (session could not be confirmed)" };
  }
  await clearAuthFail();
  return null;
}

async function runInBoostTab(func, args) {
  const cfg = await getConfig();
  let tab;
  try {
    const tabs = await chrome.tabs.query({ url: "https://app.boostapp.co.il/*" });
    // A reused tab must be a live, non-discarded document at the right host.
    // Brave/Chrome can discard inactive background tabs to save memory —
    // tabs.query still reports the discarded tab's last-known URL, but its
    // content isn't actually injectable, which surfaces as a misleading
    // "manifest must request permission" error rather than anything about
    // discarding. Skip those and treat it as if no tab were found.
    tab = tabs.find(t => t && !t.discarded && t.url && /^https:\/\/app\.boostapp\.co\.il\//.test(t.url));
  } catch (e) {
    errRunTab("tabs.query failed:", e);
    return { ok: false, reason: "tabs.query failed: " + e };
  }
  let created = false;
  if (!tab) {
    // Loop breaker: a recent, unresolved auth failure means opening yet
    // another hidden tab would just fail the same way — don't. (Only gates
    // NEW hidden tabs; an existing user tab is still checked below, since
    // the user may have signed back in there.)
    if (await inAuthFailCooldown()) {
      logRunTab("skipping hidden tab: auth-fail cooldown active, waiting for sign-in");
      return { ok: false, authFailed: true, reason: "signed out — waiting for you to sign in to BoostApp" };
    }
    try {
      tab = await chrome.tabs.create({ url: `https://app.boostapp.co.il/lessons.php?GetUrl=${cfg.getUrl}`, active: false });
      created = true;
      logRunTab("created hidden tab", tab && tab.id);
      await waitForTabComplete(tab.id);
    } catch (e) {
      errRunTab("tabs.create failed:", e);
      return { ok: false, reason: "tabs.create failed: " + e };
    }
  } else {
    logRunTab("reusing existing BoostApp tab", tab.id, tab.url);
  }
  if (!tab || !tab.id) {
    errRunTab("no valid tab to run in", tab);
    return { ok: false, reason: "no valid BoostApp tab" };
  }
  try {
    // Positively confirm sign-in BEFORE running the real action, giving a
    // freshly created tab enough time for the site's own JS to restore an
    // idle session (the old fixed "ping" closed the tab before that could
    // happen). A reused user tab gets a short check — it's already loaded.
    const denied = await authGate(tab.id, created ? 25000 : 5000);
    if (denied) return denied;
    // 2-minute outer backstop — see execInTabWithTimeout's comment. The
    // realistic worst case (per-fetch 10s timeout x up to 3 consecutive
    // failures before fetchHistoryBackwardInPage gives up) is well under
    // this; it exists purely so an unforeseen hang can never block forever.
    return await execInTabWithTimeout(tab.id, func, args, 120000);
  } catch (e) {
    errRunTab("executeScript threw:", e);
    // The tab may have been discarded, closed, or navigated away between the
    // query above and this injection — fall back to one fresh, disposable
    // tab rather than surfacing a failure that a simple retry could resolve.
    if (!created) {
      logRunTab("retrying in a fresh tab after failure on the reused one");
      let freshTab;
      try {
        freshTab = await chrome.tabs.create({ url: `https://app.boostapp.co.il/lessons.php?GetUrl=${cfg.getUrl}`, active: false });
        await waitForTabComplete(freshTab.id);
        const deniedFresh = await authGate(freshTab.id, 25000);
        if (deniedFresh) return deniedFresh;
        return await execInTabWithTimeout(freshTab.id, func, args, 120000);
      } catch (e2) {
        errRunTab("retry with a fresh tab also failed:", e2);
        return { ok: false, reason: "could not run in BoostApp tab (after retry): " + e2 };
      } finally {
        if (freshTab) { try { await chrome.tabs.remove(freshTab.id); } catch (e3) {} }
      }
    }
    return { ok: false, reason: "could not run in BoostApp tab: " + e };
  } finally {
    if (created) { try { await chrome.tabs.remove(tab.id); } catch (e) {} }
  }
}

// Refresh subscription + upcoming registrations by briefly loading the Home
// page in a hidden tab — the content script there re-syncs both into storage.
async function syncHome() {
  const cfg = await getConfig();
  let tab;
  try {
    tab = await chrome.tabs.create({ url: `https://app.boostapp.co.il/Home.php?GetUrl=${cfg.getUrl}`, active: false });
  } catch (e) { return false; }
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; chrome.runtime.onMessage.removeListener(listener); resolve(); };
    // Wait for a sync that actually carried the events widget (eventsReady),
    // so the hidden/throttled tab has time to render before we close it.
    // Ceiling must exceed the content script's own ~30s give-up so the tab
    // isn't closed while the page is still restoring an idle session.
    const listener = (m) => { if (m && m.cmd === "syncFromPage" && m.payload && m.payload.eventsReady) finish(); };
    chrome.runtime.onMessage.addListener(listener);
    setTimeout(finish, 33000);
  });
  try { await chrome.tabs.remove(tab.id); } catch (e) {}
  return true;
}

// These two run INSIDE the page (serialized into the tab), so they authenticate.
function bookInPage(companyNum, classId) {
  return (async () => {
    const URL = "/controllerAction/OrderClasses.php";
    const post = (b) => fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(b) }).then(r => r.json());
    const po = await post({ sessionRequire: false, action: "getPurchaseOptions", classStudioDateId: Number(classId), companyNum: Number(companyNum), withOutUserMemberShip: false, orderType: 1 });
    const d = (po && po.data) || {};
    const active = (((d.membershipsData || {}).userSubscriptions || {}).active) || [];
    if (!po || !po.success || !d.classStudioActId) return { ok: false, reason: (po && po.message) ? po.message : "registration not open / not signed in" };
    if (!active.length) return { ok: false, reason: "no active membership" };
    const reg = await post({ action: "registerToClassWithClientActivity", companyNum: String(companyNum), classStudioActId: Number(d.classStudioActId), clientActivityId: Number(active[0].id) });
    const ok = !!(reg && (reg.success || (reg.data && reg.data.success)));
    return { ok, msg: (reg && reg.data && reg.data.text) || "", classStudioActId: d.classStudioActId };
  })();
}

function cancelInPage(companyNum, classStudioActId) {
  return (async () => {
    const URL = "/controllerAction/OrderClasses.php";
    const post = (b) => fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(b) }).then(r => r.json());
    const r = await post({ action: "cancelBookingToClass", companyNum: Number(companyNum), classStudioActId: Number(classStudioActId), actStatus: 1 });
    return { ok: !!(r && r.success), msg: (r && r.data && r.data.message) || "" };
  })();
}

// ---------------------------------------------------------------------------
// Booking attempt for one target (executes in a BoostApp tab).
// ---------------------------------------------------------------------------
function classifyFail(reason) {
  const r = String(reason || "");
  if (/כבר משובץ|already (assigned|register)/i.test(r)) return "already";
  if (/מגבל|limit/i.test(r)) return "limit";
  if (/OpenOrder|open to order|cant order now/i.test(r)) return "notopen";
  return "other";
}

async function attemptBook(cfg, target, info) {
  if (!info.classId) return { ok: false, msg: "class not found" };
  if ((target.bookedDates || []).includes(info.resolvedDate)) return { ok: false, kind: "already", msg: "already booked this date" };

  const res = await runInBoostTab(bookInPage, [cfg.companyNum, info.classId]);
  if (!res) return { ok: false, msg: "could not run booking" };
  const now = Date.now();

  if (res.authFailed) {
    // Signed out — a retry can only succeed after the user signs in again,
    // so report a distinct kind that STOPS the retry loops (snipe/poll)
    // instead of being classified as a transient "keep watching" failure.
    await updateTarget(target.id, { lastResult: { date: info.resolvedDate, kind: "auth", msg: "signed out of BoostApp", at: now } });
    return { ok: false, kind: "auth", msg: "Signed out of BoostApp — sign in again to resume auto-booking" };
  }

  if (res.ok) {
    const bookedDates = (target.bookedDates || []).concat(info.resolvedDate);
    const patch = {
      bookedDates, lastBookedDate: info.resolvedDate, lastBookedActId: res.classStudioActId,
      lastResult: { date: info.resolvedDate, kind: "booked", msg: res.msg || "", at: now }
    };
    if (target.recurrence === "once") patch.enabled = false;   // 'once' rule complete
    await updateTarget(target.id, patch);
    notify("✅ Booked!", `${info.className} · ${target.time} · ${info.resolvedDate}\n${res.msg || ""}`);
    try { await syncHome(); } catch (e) {}
    return { ok: true, kind: "booked", msg: res.msg };
  }

  const reason = res.reason || res.msg || "booking failed";
  const kind = classifyFail(reason);

  if (kind === "already") {
    // Already registered (e.g. booked directly on the site) — treat this
    // occurrence as handled so we stop retrying and advance to next week.
    const patch = {
      bookedDates: (target.bookedDates || []).concat(info.resolvedDate),
      lastResult: { date: info.resolvedDate, kind: "already", msg: "Already registered for this class", at: now }
    };
    if (target.recurrence === "once") patch.enabled = false;
    await updateTarget(target.id, patch);
    return { ok: false, kind, msg: "You're already registered for this class" };
  }
  if (kind === "limit") {
    // Daily/subscription limit — skip this occurrence so we don't hammer it.
    await updateTarget(target.id, {
      skipDates: (target.skipDates || []).concat(info.resolvedDate),
      lastResult: { date: info.resolvedDate, kind: "limit", msg: reason, at: now }
    });
    return { ok: false, kind, msg: "Subscription limit reached (often: you already have a lesson that day)" };
  }
  // notopen / other: keep watching; just record what happened.
  await updateTarget(target.id, { lastResult: { date: info.resolvedDate, kind, msg: reason, at: now } });
  return { ok: false, kind, msg: reason };
}

// ---------------------------------------------------------------------------
// Tight "snipe" loop — bounded fast retry around the open moment.
// Service worker stays alive while async fetches are in flight.
// ---------------------------------------------------------------------------
async function snipe(targetId) {
  const cfg = await getConfig();
  // Don't fire blind if signed out — warn and bail.
  if (!(await hasSessionCookie())) {
    await verifyAuth(cfg);
    notify("⚠️ Snipe skipped — signed out", "Registration was about to open but you're not signed in to BoostApp.");
    return;
  }
  const deadline = Date.now() + 90 * 1000; // try for up to 90s
  while (Date.now() < deadline) {
    const targets = await getTargets();
    const target = targets.find(t => t.id === targetId);
    if (!target || !target.enabled) return;
    const info = await enrichTarget(cfg, target);
    if (info.status === "open") {
      const r = await attemptBook(cfg, target, info);
      if (r.ok) return;
      if (r.kind === "auth") return; // signed out — retrying can't help; stop the loop
    } else if (info.status === "full") {
      // No spots at the open moment. Stop sniping; periodic poll keeps watching.
      notify("⚠️ Class full at open", `${info.className} · ${target.time} is full (${info.registered}/${info.capacity}).`);
      return;
    } else if (["passed", "not-found", "done", "none"].includes(info.status)) {
      return;
    }
    await sleep(1500);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Periodic poll — enrich all targets, auto-book any that are open, and
// schedule precise snipe alarms for targets whose open moment is near.
// ---------------------------------------------------------------------------
async function pollAll() {
  const cfg = await getConfig();
  const targets = await getTargets();

  // Periodic sign-in verification.
  const auth = await verifyAuth(cfg);

  for (const target of targets) {
    if (!target.enabled) continue;
    let info;
    try { info = await enrichTarget(cfg, target); }
    catch (e) { continue; }

    if (!info.found) continue;

    // schedule a precise one-shot alarm just before the open moment
    if (info.status === "waiting" && info.openAt) {
      const lead = (cfg.snipeWindowMin || 5) * 60 * 1000;
      if (info.openAt - Date.now() <= lead) {
        chrome.alarms.create(`snipe:${target.id}`, { when: info.openAt - 3000 });
      }
    }

    // if it's already open right now and auto-book is on, grab it immediately
    if (cfg.autoBook && auth.loggedIn && info.status === "open") {
      try { await attemptBook(cfg, target, info); } catch (e) {}
    }
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title,
      message: message || ""
    });
  } catch (e) { /* notifications optional */ }
}

// ---------------------------------------------------------------------------
// Alarms wiring
// ---------------------------------------------------------------------------
async function ensurePollAlarm() {
  const cfg = await getConfig();
  chrome.alarms.create("poll", { periodInMinutes: Math.max(1, Number(cfg.pollMinutes) || 1) });
  if (GITHUB_REPO) chrome.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: 24 * 60, delayInMinutes: 1 });
}

// On load: default to NOT connected until validated (badge shows "!").
async function initOnLoad() {
  await migrateSchema();
  await chrome.storage.local.set({ bsab_auth: { loggedIn: false, checkedAt: Date.now(), reason: "Open BoostApp Home to validate connection" } });
  await updateBadgeAndTitle();
  await ensurePollAlarm();
}
chrome.runtime.onInstalled.addListener((details) => {
  initOnLoad();
  if (details && details.reason === "update") {
    const v = chrome.runtime.getManifest().version;
    notify("Boost Auto-Book updated", `Now running v${v}. See the changelog for what's new.`);
  }
});
chrome.runtime.onStartup.addListener(initOnLoad);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "poll") {
    await pollAll();
  } else if (alarm.name === UPDATE_CHECK_ALARM) {
    await checkForUpdate();
  } else if (alarm.name.startsWith("snipe:")) {
    await snipe(alarm.name.slice("snipe:".length));
  }
});

// ---------------------------------------------------------------------------
// Messaging (popup <-> background)
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.cmd) {
        case "getState": {
          await ensurePollAlarm();
          const store = await chrome.storage.local.get(["bsab_auth", "bsab_subscription", "bsab_registrations", "bsab_client"]);
          sendResponse({
            config: await getConfig(),
            targets: await getTargets(),
            auth: store.bsab_auth || { loggedIn: null },
            subscription: store.bsab_subscription || null,
            registrations: store.bsab_registrations || null,
            client: store.bsab_client || null
          });
          break;
        }
        case "syncFromPage": {
          const p = msg.payload || {};
          if (p.client && p.client.clientId) {
            await chrome.storage.local.set({ bsab_client: { clientId: p.client.clientId, companyNum: p.client.companyNum, name: p.client.name || null, photo: p.client.photo || null, syncedAt: p.syncedAt } });
            if (p.client.companyNum) await setConfig({ companyNum: p.client.companyNum });
          }
          // The content script proved sign-in (it saw #clientHeaderId while on Home).
          if (p.loggedIn) {
            await chrome.storage.local.set({ bsab_auth: { loggedIn: true, checkedAt: p.syncedAt, reason: "synced from Home" } });
            await clearAuthFail(); // in-page proof of sign-in ends the auth-fail cooldown
          } else if (p.loggedIn === false) {
            await chrome.storage.local.set({ bsab_auth: { loggedIn: false, checkedAt: p.syncedAt, reason: "signed out (from page)" } });
          }
          // Only update registrations when the events widget actually rendered.
          // This prevents a premature/throttled read from wiping the cached list.
          if (p.eventsReady && p.events) {
            await chrome.storage.local.set({ bsab_registrations: { items: p.events.items || [], empty: !!p.events.empty, syncedAt: p.syncedAt, source: "page" } });
          }
          if (p.subscriptions) {
            await chrome.storage.local.set({ bsab_subscription: { items: p.subscriptions, syncedAt: p.syncedAt, source: "page" } });
          }
          await updateBadgeAndTitle();
          sendResponse({ ok: true });
          break;
        }
        case "refreshData": {
          const store = await chrome.storage.local.get(["bsab_subscription", "bsab_registrations", "bsab_client"]);
          sendResponse(store);
          break;
        }
        case "cancelRegistration": {
          const cfg = await getConfig();
          if (!msg.actId) { sendResponse({ ok: false, msg: "no booking id on this item" }); break; }
          const r = await runInBoostTab(cancelInPage, [cfg.companyNum, msg.actId]);
          if (r && r.ok) { try { await syncHome(); } catch (e) {} }
          const store = await chrome.storage.local.get(["bsab_subscription", "bsab_registrations"]);
          sendResponse({ ok: !!(r && r.ok), msg: (r && r.msg) || (r && r.reason) || "", subscription: store.bsab_subscription, registrations: store.bsab_registrations });
          break;
        }
        case "classInfo": {
          const cfg = await getConfig();
          if (!msg.classId) { sendResponse({ ok: false, msg: "no class id" }); break; }
          const r = await api({ sessionRequire: false, action: "getClassInfo", classId: Number(msg.classId), companyNum: Number(cfg.companyNum) });
          const d = (r && r.data) || {};
          const names = (arr) => Array.isArray(arr) ? arr.map(p => ({ name: p.name, image: p.image || null })) : [];
          sendResponse({
            ok: !!(r && r.success),
            info: {
              name: d.name, coach: d.coach,
              registered: d.registered, registered_max: d.registered_max,
              participants: names(d.registered_list),
              waitings: names(d.registered_list_waitings),
              description: d.description || ""
            }
          });
          break;
        }
        case "exportState": {
          const { bsab_targets } = await chrome.storage.local.get("bsab_targets");
          const c = await getConfig();
          sendResponse({ data: {
            app: "boost-autobook", version: 1, exportedAt: Date.now(),
            targets: bsab_targets || [],
            config: {
              lang: c.lang, theme: c.theme, companyNum: c.companyNum, getUrl: c.getUrl,
              autoBook: c.autoBook, pollMinutes: c.pollMinutes, snipeWindowMin: c.snipeWindowMin,
              dailyLimitOverride: c.dailyLimitOverride
            }
          }});
          break;
        }
        case "importState": {
          const d = msg.data || {};
          if (!d || !Array.isArray(d.targets)) { sendResponse({ ok: false, error: "no targets" }); break; }
          // normalise imported targets (fresh info; keep booking/skip history)
          const targets = d.targets.map(t => ({
            id: t.id || "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            mode: t.mode || "weekly", weekday: t.weekday, time: t.time, date: t.date,
            classFilter: t.classFilter || "", teacherFilter: t.teacherFilter || "",
            recurrence: t.recurrence || "weekly", enabled: t.enabled !== false,
            bookedDates: Array.isArray(t.bookedDates) ? t.bookedDates : [],
            skipDates: Array.isArray(t.skipDates) ? t.skipDates : [], info: null
          }));
          await setTargets(targets);
          if (d.config && typeof d.config === "object") {
            const allowed = ["lang", "theme", "companyNum", "getUrl", "autoBook", "pollMinutes", "snipeWindowMin", "dailyLimitOverride"];
            const patch = {}; allowed.forEach(k => { if (d.config[k] !== undefined) patch[k] = d.config[k]; });
            await setConfig(patch);
          }
          await ensurePollAlarm();
          sendResponse({ ok: true, count: targets.length });
          break;
        }
        case "syncHome": {
          await syncHome();
          const store = await chrome.storage.local.get(["bsab_subscription", "bsab_registrations", "bsab_client", "bsab_auth"]);
          sendResponse(store);
          break;
        }
        case "getUpdateInfo": {
          const current = chrome.runtime.getManifest().version;
          let { bsab_update } = await chrome.storage.local.get("bsab_update");
          if (GITHUB_REPO && (!bsab_update || (Date.now() - (bsab_update.checkedAt || 0)) > UPDATE_CHECK_MAX_AGE_MS)) {
            bsab_update = (await checkForUpdate()) || bsab_update || null;
          }
          sendResponse({
            repo: GITHUB_REPO || null,
            current,
            latest: bsab_update ? bsab_update.latest : null,
            url: bsab_update ? bsab_update.url : null,
            updateAvailable: !!(bsab_update && bsab_update.latest && cmpVersions(bsab_update.latest, current) > 0)
          });
          break;
        }
        case "verifyAuth": {
          const cfg = await getConfig();
          const auth = await verifyAuth(cfg);
          sendResponse({ auth });
          break;
        }
        case "openLogin": {
          const cfg = await getConfig();
          chrome.tabs.create({ url: `${SITE}/Home.php?GetUrl=${cfg.getUrl}` });
          sendResponse({ ok: true });
          break;
        }
        case "updateConfig": {
          const cfg = await setConfig(msg.config || {});
          await ensurePollAlarm();
          sendResponse({ config: cfg });
          break;
        }
        case "addTarget": {
          const targets = await getTargets();
          const t = Object.assign({
            id: "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            enabled: true, recurrence: "weekly", bookedDates: [], skipDates: [], info: null
          }, msg.target);
          targets.push(t);
          await setTargets(targets);
          sendResponse({ targets });
          break;
        }
        case "getSchedule": {
          const cfg = await getConfig();
          let slots = [];
          try { slots = await getSchedule(cfg); } catch (e) {}
          sendResponse({ slots, targets: await getTargets() });
          break;
        }
        case "addSlot": {
          const s = msg.slot || {};
          const cfg = await getConfig();
          const targets = await getTargets();
          // A slot carrying a `date` is a one-time booking for that specific day;
          // otherwise it's a recurring weekly rule.
          const isDate = !!s.date;
          const wdForDate = isDate ? new Date(s.date + "T00:00:00").getDay() : Number(s.weekday);
          const exists = isDate
            ? targets.some(t => t.mode === "date" && t.date === s.date && t.time === s.time && (t.classFilter || "") === (s.className || ""))
            : targets.some(t => t.mode === "weekly" && Number(t.weekday) === Number(s.weekday) && t.time === s.time && (t.classFilter || "") === (s.className || ""));
          // Heads-up only if adding this slot would exceed the plan's daily allowance
          // (some subscriptions permit 2/day). We still ALLOW it — just warn.
          const dailyLimit = await getDailyLimit();
          const sameDayCount = targets.filter(t => {
            if (t.time === s.time) return false;
            if (t.mode === "weekly") return Number(t.weekday) === wdForDate;
            if (t.mode === "date") return isDate && t.date === s.date;
            return false;
          }).length;
          const sameDayWarning = sameDayCount >= dailyLimit;
          let added = null;
          if (!exists) {
            const id = "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
            targets.push(isDate ? {
              id, mode: "date", date: s.date, time: s.time,
              classFilter: s.className || "", teacherFilter: "",
              recurrence: "once", enabled: true, bookedDates: [], skipDates: [], info: null
            } : {
              id, mode: "weekly", weekday: Number(s.weekday), time: s.time,
              classFilter: s.className || "", teacherFilter: "",
              recurrence: "weekly", enabled: true, bookedDates: [], skipDates: [], info: null
            });
            await setTargets(targets);
            // Enrich immediately so "My slots" shows details at once (no 60s wait),
            // and auto-book on the spot if the window is already open.
            try {
              const target = (await getTargets()).find(t => t.id === id);
              let info = await enrichTarget(cfg, target);
              const auth = (await chrome.storage.local.get("bsab_auth")).bsab_auth || {};
              if (cfg.autoBook && auth.loggedIn && info.status === "open") {
                const r = await attemptBook(cfg, target, info);
                info = await enrichTarget(cfg, (await getTargets()).find(t => t.id === id));
                added = { id, booked: r.ok, kind: r.kind, status: r.ok ? "booked" : info.status, msg: r.msg, resolvedDate: info.resolvedDate, openAt: info.openAt, className: info.className, sameDayWarning, dailyLimit };
              } else {
                added = { id, booked: false, status: info.status, resolvedDate: info.resolvedDate, openAt: info.openAt, className: info.className,
                          needsAutoBook: info.status === "open" && !cfg.autoBook, sameDayWarning, dailyLimit };
              }
            } catch (e) { added = { id, status: "error", msg: String(e) }; }
          }
          sendResponse({ targets: await getTargets(), added });
          break;
        }
        case "removeSlot": {
          const s = msg.slot || {};
          let targets = await getTargets();
          targets = targets.filter(t => !(t.mode === "weekly" && Number(t.weekday) === Number(s.weekday) && t.time === s.time && (t.classFilter || "") === (s.className || "")));
          await setTargets(targets);
          sendResponse({ targets });
          break;
        }
        case "setRecurrence": {
          const patch = { recurrence: msg.recurrence };
          if (msg.recurrence === "weekly") patch.enabled = true; // re-arm if a finished 'once'
          await updateTarget(msg.id, patch);
          sendResponse({ targets: await getTargets() });
          break;
        }
        case "getPlan": {
          const cfg = await getConfig();
          sendResponse(await computePlan(cfg));
          break;
        }
        case "getHistory": {
          const cfg = await getConfig();
          // A true clean slate — clears cached months too (not just the
          // completion flag), so "Resync all history" reliably starts over
          // instead of layering a fresh walk on top of possibly-stale data.
          if (msg.resetBackfill) { await setHistoryStore({ months: {}, backfillComplete: false, clientId: null }); }
          let store;
          try { store = await ensureHistoryFetched(cfg); } catch (e) { store = await getHistoryStore(); }
          const records = [];
          Object.values(store.months || {}).forEach(m => records.push(...(m.rows || [])));
          records.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
          // Months with zero rows are legitimately cached too (that's how the
          // backward walk knows it has gone far enough back / detects the
          // account's start), but they must NOT count as "history" — only
          // months that actually contain a record should inform monthsCached
          // / oldestMonth, otherwise both read earlier than the real first class.
          const monthsWithData = Object.keys(store.months || {}).filter(ym => (store.months[ym].rows || []).length > 0).sort();
          sendResponse({
            records,
            backfillComplete: !!store.backfillComplete,
            monthsCached: monthsWithData.length,
            oldestMonth: monthsWithData[0] || null,
            lastError: store.lastError || null
          });
          break;
        }
        case "skipDate": {
          const targets = await getTargets();
          const tg = targets.find(t => t.id === msg.id);
          if (tg && msg.date) { const sd = new Set(tg.skipDates || []); sd.add(msg.date); await updateTarget(msg.id, { skipDates: [...sd] }); }
          sendResponse({ ok: true });
          break;
        }
        case "unskipDate": {
          const targets = await getTargets();
          const tg = targets.find(t => t.id === msg.id);
          if (tg && msg.date) await updateTarget(msg.id, { skipDates: (tg.skipDates || []).filter(d => d !== msg.date) });
          sendResponse({ ok: true });
          break;
        }
        case "skipNext": {
          const targets = await getTargets();
          const target = targets.find(t => t.id === msg.id);
          if (target) {
            const next = resolveTargetDate(target);
            if (next) await updateTarget(msg.id, { skipDates: (target.skipDates || []).concat(next) });
          }
          sendResponse({ targets: await getTargets() });
          break;
        }
        case "removeTarget": {
          let targets = await getTargets();
          targets = targets.filter(t => t.id !== msg.id);
          await setTargets(targets);
          sendResponse({ targets });
          break;
        }
        case "toggleTarget": {
          await updateTarget(msg.id, { enabled: !!msg.enabled });
          sendResponse({ targets: await getTargets() });
          break;
        }
        case "checkNow": {
          await pollAll();
          sendResponse({ targets: await getTargets() });
          break;
        }
        case "reenrich": {
          // Recompute each slot's status WITHOUT booking — keeps chips fresh on popup open.
          const cfg = await getConfig();
          for (const tg of await getTargets()) { try { await enrichTarget(cfg, tg); } catch (e) {} }
          sendResponse({ targets: await getTargets() });
          break;
        }
        case "bookNow": {
          const cfg = await getConfig();
          const targets = await getTargets();
          const target = targets.find(t => t.id === msg.id);
          if (!target) { sendResponse({ ok: false, msg: "target not found" }); break; }
          const info = await enrichTarget(cfg, target);
          const r = await attemptBook(cfg, target, info);
          sendResponse({ ok: r.ok, msg: r.msg, targets: await getTargets() });
          break;
        }
        case "cancelBooking": {
          const cfg = await getConfig();
          const targets = await getTargets();
          const target = targets.find(t => t.id === msg.id);
          if (!target || !target.classStudioActId) { sendResponse({ ok: false, msg: "no booking on file" }); break; }
          const r = await runInBoostTab(cancelInPage, [cfg.companyNum, target.classStudioActId]);
          if (r && r.ok) { await updateTarget(msg.id, { booked: false, classStudioActId: null, enabled: true }); try { await syncHome(); } catch (e) {} }
          sendResponse({ ok: !!(r && r.ok), msg: (r && r.msg) || (r && r.reason) || "", targets: await getTargets() });
          break;
        }
        default:
          sendResponse({ error: "unknown cmd" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  })();
  return true; // async
});
