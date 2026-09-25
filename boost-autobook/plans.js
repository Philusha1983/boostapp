/* Boost Auto-Book — lesson plan capture (data only, no UI yet).
 *
 * Saves the studio's written workout plan (getClassInfo → description) for
 * every Training Harmony / Calisapiens lesson you book or attend, so it can
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
const LP_CLASS_RE = /training\s*harmony|calisapiens/i;
const LP_ALARM_PREFIX = "planLesson:";
const LP_BACKFILL_DAYS = 2;      // descriptions are overwritten daily → older plans are gone
const LP_MAX_TRIES = 3;          // per lesson, for "class not found" / empty description
const LP_MAX_PER_TICK = 6;

function lpKey(date, time, className) { return `${date} ${time} ${className}`; }

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
        ((c.className || "").trim().toLowerCase() === lesson.className.trim().toLowerCase() || LP_CLASS_RE.test(c.className || "")));
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
// Training Harmony / Calisapiens only.
async function lpCandidates() {
  const out = new Map();
  const { bsab_registrations } = await chrome.storage.local.get("bsab_registrations");
  ((bsab_registrations && bsab_registrations.items) || []).forEach(r => {
    if (!r.startAt || !r.time || !LP_CLASS_RE.test(r.className || "")) return;
    const date = lpStudioDate(r.startAt);
    out.set(lpKey(date, r.time, r.className), { date, time: r.time, className: r.className, startAt: r.startAt });
  });
  try {
    const store = await getHistoryStore();
    const cutoff = lpStudioDate(Date.now() - LP_BACKFILL_DAYS * 864e5);
    Object.values(store.months || {}).forEach(m => (m.rows || []).forEach(rec => {
      if (rec.status !== "attended" || !rec.date || !rec.time || rec.date < cutoff) return;
      if (!LP_CLASS_RE.test(rec.className || "")) return;
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
      if (!r.startAt || !LP_CLASS_RE.test(r.className || "")) return;
      [r.startAt - 90 * 60 * 1000, r.startAt + 75 * 60 * 1000].forEach((when, i) => {
        const name = LP_ALARM_PREFIX + r.startAt + ":" + i;
        if (when > now && !existing.has(name)) chrome.alarms.create(name, { when });
      });
    });
  } catch (e) {
    console.log("[Boost Auto-Book] schedulePlanAlarms failed:", String(e && e.message || e));
  }
}
