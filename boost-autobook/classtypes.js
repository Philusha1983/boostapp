// Studio class types — one table, used by every module that has to recognise
// a lesson.
//
// Why this exists (Oct 2026): the studio renamed every class in BoostApp and
// added two. "Training Harmony" became "FUNCTIONAL" and "Calisapiens" became
// "CALISTHENICS" — same classNameType ids (16130 / 16120), so they are the
// same classes under new names — while "STRENGTH" (19437) and "FLEXIBILITY"
// (21954) are new. The rename was applied to EXISTING instances too: the
// schedule now returns "FUNCTIONAL" for lessons that were stored as "Training
// Harmony" at the time. So anything keyed on the name string alone splits the
// history in two and silently stops matching live classes.
//
// Rule for the rest of the codebase: match on classNameType when the object
// comes from the schedule, and run stored names through canonical() before
// using them as a key or a bucket. Names are for display only.
//
// UMD: window.ClassTypes in the page, self.ClassTypes in the service worker,
// module.exports under node for tests.
(function (root) {
  "use strict";

  // id        — BoostApp's classNameType. Stable across renames; the authority.
  // name      — the current className the schedule returns.
  // aliases   — names this class was stored under before (newest last).
  // health    — Google Health ExerciseType for the lesson log.
  // display   — title shown in health apps and anywhere the raw caps look shouty.
  // minutes   — rough lesson length, for history totals.
  const TYPES = [
    { id: 16130, name: "FUNCTIONAL",   aliases: ["Training Harmony"], health: "CROSSFIT",          display: "Functional",   minutes: 55 },
    { id: 16120, name: "CALISTHENICS", aliases: ["Calisapiens"],      health: "CALISTHENICS",      display: "Calisthenics", minutes: 55 },
    { id: 19437, name: "STRENGTH",     aliases: [],                   health: "STRENGTH_TRAINING", display: "Strength",     minutes: 55 },
    { id: 21954, name: "FLEXIBILITY",  aliases: [],                   health: "STRETCHING",        display: "Flexibility",  minutes: 45 },
  ];

  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();

  function byId(id) {
    if (id == null || id === "") return null;
    const n = Number(id);
    return TYPES.find(t => t.id === n) || null;
  }

  // Current name or any name this class used to carry.
  function byName(name) {
    const k = norm(name);
    if (!k) return null;
    return TYPES.find(t => norm(t.name) === k || t.aliases.some(a => norm(a) === k)) || null;
  }

  // A class object straight from getClassesData. classNameType first — it is
  // what survived the rename — then the name, for anything that stored a
  // lesson without the id.
  function of(cls) {
    if (!cls) return null;
    if (typeof cls === "string") return byName(cls);
    return byId(cls.classNameType) || byName(cls.className);
  }

  // Is this one of the studio's own classes (as opposed to a one-off event)?
  function isStudio(cls) { return !!of(cls); }

  // Stored name -> the name it goes by now. Unknown names pass through
  // unchanged: other studios, one-off events, and whatever gets added next.
  function canonical(name) { const t = byName(name); return t ? t.name : (name == null ? "" : String(name).trim()); }

  // Every name a class has ever been stored under, current one first. Use it
  // when reading a store that was keyed by name before the rename.
  function keysFor(name) {
    const t = byName(name);
    if (!t) return [name == null ? "" : String(name).trim()];
    return [t.name].concat(t.aliases);
  }

  function display(name) { const t = byName(name); return t ? t.display : (name == null ? "" : String(name).trim()); }
  function healthType(name) { const t = byName(name); return t ? t.health : null; }
  function minutes(name) { const t = byName(name); return t ? t.minutes : null; }
  function all() { return TYPES.map(t => Object.assign({}, t)); }

  const api = { TYPES, byId, byName, of, isStudio, canonical, keysFor, display, healthType, minutes, all };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ClassTypes = api;
})(typeof self !== "undefined" ? self : this);
