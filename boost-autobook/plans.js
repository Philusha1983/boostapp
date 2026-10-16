/* Boost Auto-Book — lesson plan capture (data only, no UI yet).
 *
 * Saves the studio's written workout plan (getClassInfo → description) for
 * every studio lesson you book or attend (see classtypes.js), so it can
 * later be lined up with that lesson's heart-rate curve.
 *
 * Why it has to be captured, not fetched later:
 *  - past plans can't be looked up afterwards: the schedule returns no classes
 *    for past dates (≥ 12 days back verified), and a class's description is
 *    overwritten with the current day's plan (verified 2026-09-23);
 *  - plans posted days ahead are often a stale placeholder from an earlier
 *    week — every plan states its own date, so a mismatch is detectable.
 * So each lesson's plan is captured on the lesson day and once more after the
 * lesson ends (in case the coach revised it); the post-lesson copy is final.
 * Earlier differing texts are kept in revisions[].
 *
 * Storage: bsab_lesson_plans { "<date> <time> <className>": entry } — local
 * only, never exported. Loaded by background.js via importScripts; uses its
 * api(), fetchClassesForDate(), getConfig(), studioTimeMs(), tzOffsetMs().
 */

const LP_KEY = "bsab_lesson_plans";
// Replaced the old /training harmony|calisapiens/ name test (Oct 2026 rename).
// ClassTypes matches on classNameType first and keeps the old names as
// aliases, so both live classes and already-stored lessons resolve.
const lpIsStudioClass = (c) => ClassTypes.isStudio(c);
const LP_ALARM_PREFIX = "planLesson:";
const LP_BACKFILL_DAYS = 2;      // descriptions are overwritten daily → older plans are gone
const LP_MAX_TRIES = 3;          // per lesson, for "class not found" / empty description
const LP_MAX_PER_TICK = 6;

function lpKey(date, time, className) { return `${date} ${time} ${className}`; }
// A lesson stored before the Oct 2026 rename is keyed by its old class name
// while the schedule now returns the new one, so every read tries both.
// Writes always use the current name (lpKey above).
function lpKeys(date, time, className) { return ClassTypes.keysFor(className).map(n => lpKey(date, time, n)); }
function lpPick(store, date, time, className) {
  for (const k of lpKeys(date, time, className)) { const v = (store || {})[k]; if (v) return v; }
  return null;
}

function lpStudioDate(ms) {
  return new Date(ms + tzOffsetMs(STUDIO_TZ, new Date(ms))).toISOString().slice(0, 10);
}

// Same conversion as notes/lesson-plan-capture/capture.js, so parse.js reads it unchanged.
function lpHtmlToText(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .split("\n")
    .map(s => s.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

// The plan's own date, from its header line. Two formats seen:
//   Aug 2026: "22.08.26, Saturday, Functional Strength Training - Week 4: Build"
//   Sep 2026: "Wednesday · 23.09.2026 | Functional Strength Training — Week 1: Build"
// (sometimes after a cycle title line) → look for DD.MM.YY(YY) in the first 3 lines.
function lpHeaderDate(text) {
  const head = String(text || "").split("\n").slice(0, 3).join("\n");
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/.exec(head);
  if (!m) return null;
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

async function getLessonPlans() {
  const o = await chrome.storage.local.get(LP_KEY);
  return o[LP_KEY] || {};
}

// Capture one lesson's plan. phase: "day" (on the lesson day, before it ends)
// or "final" (after it ended). Returns the stored entry.
async function capturePlan(lesson, phase) {
  const cfg = await getConfig();
  const key = lpKey(lesson.date, lesson.time, lesson.className);
  const plans = await getLessonPlans();
  const prev = plans[key] || { date: lesson.date, time: lesson.time, className: lesson.className, revisions: [], tries: 0 };
  // Only post-lesson attempts count toward giving up — a failed day-of try
  // must never block the final capture.
  const entry = Object.assign({}, prev, { tries: (prev.tries || 0) + (phase === "final" ? 1 : 0), lastTryAt: Date.now() });
  try {
    let classId = prev.classId;
    let coach = prev.coach;
    if (!classId) {
      const classes = await fetchClassesForDate(cfg, lesson.date);
      const cls = classes.find(c => (c.startTime || "").slice(0, 5) === lesson.time &&
        (ClassTypes.canonical(c.className) === ClassTypes.canonical(lesson.className) || lpIsStudioClass(c)));
      if (!cls) throw new Error("class not found in schedule for " + lesson.date);
      classId = cls.id; coach = cls.guideName || null;
    }
    const r = await api({ sessionRequire: false, action: "getClassInfo", classId: Number(classId), companyNum: Number(cfg.companyNum) });
    const d = (r && r.data) || {};
    const text = lpHtmlToText(d.description);
    if (!text) throw new Error("empty description");
    const hd = lpHeaderDate(text);
    // Verified 2026-09-23: a class's description is overwritten with the
    // CURRENT day's plan (the 14.09 class returned 23.09's plan), and ahead of
    // time it can still hold an older week's. So a plan whose own date isn't
    // the lesson's date is never stored as that lesson's plan.
    if (hd && hd !== lesson.date) {
      entry.staleSeen = (prev.staleSeen || []).concat([{ headerDate: hd, capturedAt: Date.now() }]).slice(-5);
      throw new Error("plan is for " + hd + ", not this lesson");
    }
    if (prev.text && prev.text !== text) {
      entry.revisions = (prev.revisions || []).concat([{ text: prev.text, capturedAt: prev.capturedAt, headerDate: prev.headerDate }]);
    }
    Object.assign(entry, {
      classId, coach: d.coach || coach || null,
      text, headerDate: hd, dateMatches: hd ? hd === lesson.date : null,
      capturedAt: Date.now(), phase,
      final: phase === "final" || !!prev.final,
      error: null, lastError: null
    });
  } catch (e) {
    const msg = String(e && e.message || e);
    // Network hiccups (laptop asleep/offline) aren't the studio's answer —
    // they never count toward giving up.
    if (/failed to fetch|networkerror|load failed/i.test(msg) && phase === "final") entry.tries = prev.tries || 0;
    if (prev.text) {
      // A good copy is already stored: keep it clean, note the failed refresh separately.
      entry.lastError = msg; entry.error = null;
    } else {
      entry.error = msg;
    }
    if (phase === "final" && entry.tries >= LP_MAX_TRIES) entry.gaveUp = true;
  }
  const latest = await getLessonPlans();   // re-read: other writes may have landed
  latest[key] = entry;
  await chrome.storage.local.set({ [LP_KEY]: latest });
  console.log("[Boost Auto-Book] plan capture", phase, key, entry.error ? "ERROR " + entry.error : (entry.dateMatches === false ? "STALE header " + entry.headerDate : "ok"));
  return entry;
}

// Lessons worth a plan: booked (registrations cache) + attended (history),
// Studio classes only (classtypes.js).
async function lpCandidates() {
  const out = new Map();
  const { bsab_registrations } = await chrome.storage.local.get("bsab_registrations");
  ((bsab_registrations && bsab_registrations.items) || []).forEach(r => {
    if (!r.startAt || !r.time || !lpIsStudioClass(r.className)) return;
    const date = lpStudioDate(r.startAt);
    out.set(lpKey(date, r.time, r.className), { date, time: r.time, className: r.className, startAt: r.startAt });
  });
  try {
    const store = await getHistoryStore();
    const cutoff = lpStudioDate(Date.now() - LP_BACKFILL_DAYS * 864e5);
    Object.values(store.months || {}).forEach(m => (m.rows || []).forEach(rec => {
      if (rec.status !== "attended" || !rec.date || !rec.time || rec.date < cutoff) return;
      if (!lpIsStudioClass(rec.className)) return;
      const time = String(rec.time).slice(0, 5);
      const k = lpKey(rec.date, time, rec.className);
      if (!out.has(k)) out.set(k, { date: rec.date, time, className: rec.className, startAt: studioTimeMs(rec.date, time) });
    }));
  } catch (e) {}
  return [...out.values()];
}

// Decide what to capture now. Runs on the 3-hourly alarm, the per-lesson
// alarms and after bookings sync.
async function planCaptureTick() {
  try {
    const now = Date.now();
    const today = lpStudioDate(now);
    const plans = await getLessonPlans();
    let fixed = false;
    for (const e of Object.values(plans)) {
      if (!e.text || !e.date) continue;
      const hd = lpHeaderDate(e.text);
      if (hd && hd !== e.date) {                       // stored before the check existed
        e.staleSeen = (e.staleSeen || []).concat([{ headerDate: hd, capturedAt: e.capturedAt }]);
        delete e.text; e.final = false; e.headerDate = null; e.dateMatches = null;
        e.error = "plan was for " + hd + ", not this lesson";
        if (e.date < today) e.gaveUp = true;            // a past lesson's plan can't be recovered
        fixed = true;
      } else if (hd && e.headerDate !== hd) { e.headerDate = hd; e.dateMatches = true; fixed = true; }
    }
    if (fixed) await chrome.storage.local.set({ [LP_KEY]: plans });
    const durMs = 60 * 60 * 1000;
    const todo = [];
    for (const l of await lpCandidates()) {
      const e = plans[lpKey(l.date, l.time, l.className)];
      if (e && (e.final || e.gaveUp)) continue;
      const ended = now >= l.startAt + durMs + 5 * 60 * 1000;
      if (ended) todo.push([l, "final"]);                                  // incl. one backfill try for past lessons
      else if (l.date === today && !(e && e.capturedAt && lpStudioDate(e.capturedAt) === today)) todo.push([l, "day"]);
    }
    todo.sort((a, b) => b[0].startAt - a[0].startAt);
    for (const [l, phase] of todo.slice(0, LP_MAX_PER_TICK)) await capturePlan(l, phase);
  } catch (e) {
    console.log("[Boost Auto-Book] planCaptureTick failed:", String(e && e.message || e));
  }
}

// One-shot alarms per booked lesson: 90 min before (day-of copy) and 15 min
// after it ends (final copy). The 3-hourly backstop covers everything else.
async function schedulePlanAlarms() {
  try {
    const { bsab_registrations } = await chrome.storage.local.get("bsab_registrations");
    const items = (bsab_registrations && bsab_registrations.items) || [];
    const existing = new Set((await chrome.alarms.getAll()).filter(a => a.name.startsWith(LP_ALARM_PREFIX)).map(a => a.name));
    const now = Date.now();
    items.forEach(r => {
      if (!r.startAt || !lpIsStudioClass(r.className)) return;
      [r.startAt - 90 * 60 * 1000, r.startAt + 75 * 60 * 1000].forEach((when, i) => {
        const name = LP_ALARM_PREFIX + r.startAt + ":" + i;
        if (when > now && !existing.has(name)) chrome.alarms.create(name, { when });
      });
    });
  } catch (e) {
    console.log("[Boost Auto-Book] schedulePlanAlarms failed:", String(e && e.message || e));
  }
}

// ===========================================================================
// Day-level capture + look-ahead log (2026-09-27)
// ===========================================================================
// Every class of the same type on a day carries the same plan (verified Aug +
// Sep 2026), so one capture per day × class type covers every lesson that day
// — including lessons not booked through the extension. Philip's hypothesis:
// the day's plan is ready by the morning (maybe the whole week ahead). The
// look-ahead log checks the next 7 days on every run and records when each
// day's own plan first appears and whether it changes, so the hypothesis is
// settled by data rather than assumed.
//
// bsab_day_plans      { "<date>|<type>": { date, type, classId, text, headerDate, capturedAt, revisions[] } }
// bsab_plan_lookahead { "<date>|<type>": { firstClassAt, checks, firstOwnAt, firstOwnHoursBefore,
//                                           ownChanges, seen:[{at, headerDate, hash}] } }
const DP_KEY = "bsab_day_plans";
const LA_KEY = "bsab_plan_lookahead";
const LA_DAYS = 7;
const LA_KEEP_DAYS = 45;
// One day-plan bucket per class type, straight from the shared table.
const DP_TYPES = ClassTypes.all().map(t => ({ type: t.name, id: t.id }));

function lpHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function lpDayType(className) { const t = ClassTypes.byName(className); return t ? t.name : null; }
// Day plans stored before the rename are keyed by the old type name, so a
// read tries every name the class has gone by.
function lpDayPlan(dayPlans, date, type) {
  for (const k of ClassTypes.keysFor(type)) { const d = dayPlans[date + "|" + k]; if (d) return d; }
  return null;
}
function lpAddDays(dateStr, n) { const d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

async function dayPlanTick() {
  try {
    const cfg = await getConfig();
    const now = Date.now(), today = lpStudioDate(now);
    const o = await chrome.storage.local.get([DP_KEY, LA_KEY]);
    const dayPlans = o[DP_KEY] || {}, log = o[LA_KEY] || {};
    for (let i = 0; i < LA_DAYS; i++) {
      const date = lpAddDays(today, i);
      let classes = [];
      try { classes = await fetchClassesForDate(cfg, date); } catch (e) { continue; }
      for (const t of DP_TYPES) {
        const cls = classes.filter(c => ClassTypes.of(c) && ClassTypes.of(c).name === t.type)
          .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
        if (!cls) continue;
        let text = "";
        try {
          const r = await api({ sessionRequire: false, action: "getClassInfo", classId: Number(cls.id), companyNum: Number(cfg.companyNum) });
          text = lpHtmlToText(r && r.data && r.data.description);
        } catch (e) { continue; }                       // offline — try next run
        const key = date + "|" + t.type;
        const hd = text ? lpHeaderDate(text) : null, hash = text ? lpHash(text) : null;
        const firstClassAt = studioTimeMs(date, String(cls.startTime || "00:00").slice(0, 5));
        // --- look-ahead log -------------------------------------------------
        const L = log[key] || { firstClassAt, checks: 0, firstOwnAt: null, firstOwnHoursBefore: null, ownChanges: 0, seen: [] };
        L.firstClassAt = firstClassAt; L.checks++;
        const last = L.seen[L.seen.length - 1];
        if (!last || last.hash !== hash) {
          if (last && hd === date && last.headerDate === date) L.ownChanges++;   // the day's own plan was edited
          L.seen.push({ at: now, headerDate: hd, hash, chars: text.length });
          if (L.seen.length > 20) L.seen = L.seen.slice(-20);
        }
        if (hd === date && !L.firstOwnAt) {
          L.firstOwnAt = now;
          L.firstOwnHoursBefore = Math.round((firstClassAt - now) / 36e5 * 10) / 10;
        }
        log[key] = L;
        // --- day plan: any own-dated plan, as soon as it is seen ------------
        // Look-ahead log 27.09–13.10: the studio posts the whole coming week
        // in one batch (Sat 03.10 11:50 → 04–09.10; Sat 10.10 13:16 → 11–16.10),
        // 1–6 days ahead, never edited afterwards; and each class's text rolls
        // on to the NEXT day's plan shortly after that class ends. Waiting
        // for the day itself lost 06.10 (laptop asleep until the roll-over).
        if (hd === date) {
          const prev = dayPlans[key];
          const entry = { date, type: t.type, classId: cls.id, text, headerDate: hd, capturedAt: now, revisions: (prev && prev.revisions) || [] };
          if (prev && prev.text && prev.text !== text) entry.revisions = entry.revisions.concat([{ text: prev.text, capturedAt: prev.capturedAt }]).slice(-5);
          if (!prev || prev.text !== text) dayPlans[key] = entry;
        }
      }
    }
    const cutoff = lpAddDays(today, -LA_KEEP_DAYS);
    Object.keys(log).forEach(k => { if (k.slice(0, 10) < cutoff) delete log[k]; });
    await chrome.storage.local.set({ [DP_KEY]: dayPlans, [LA_KEY]: log });
    await applyDayPlansToLessons(dayPlans);
  } catch (e) {
    console.log("[Boost Auto-Book] dayPlanTick failed:", String(e && e.message || e));
  }
}

// Lessons (booked or attended) that have no plan of their own get the day
// plan for their date + class type.
async function applyDayPlansToLessons(dayPlans) {
  const plans = await getLessonPlans();
  let changed = false;
  for (const l of await lpCandidates()) {
    const type = lpDayType(l.className);
    const dp = type && dayPlans[l.date + "|" + type];
    if (!dp) continue;
    const k = lpKey(l.date, l.time, l.className);
    const e = plans[k];
    if (e && e.text) continue;
    plans[k] = Object.assign({}, e || { date: l.date, time: l.time, className: l.className, revisions: [], tries: 0 }, {
      classId: (e && e.classId) || null, text: dp.text, headerDate: dp.headerDate, dateMatches: true,
      capturedAt: dp.capturedAt, phase: "day-plan", source: "day", final: false, error: null, gaveUp: false,
    });
    changed = true;
  }
  if (changed) await chrome.storage.local.set({ [LP_KEY]: plans });
}

// Daily morning run at 06:30 studio time (the 3-hourly run covers the rest).
function scheduleMorningPlanAlarm() {
  const now = Date.now(), today = lpStudioDate(now);
  let when = studioTimeMs(today, "06:30");
  if (when <= now) when = studioTimeMs(lpAddDays(today, 1), "06:30");
  chrome.alarms.create("planMorning", { when, periodInMinutes: 24 * 60 });
}
