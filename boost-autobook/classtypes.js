/*
 * Auto-Book - automatic registration for BoostApp group lessons.
 * Copyright (C) 2026 Philip Lesarev
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Studio class types — one table, used by every module that has to recognise
// a lesson.
//
// Why this exists (Oct 2026): the studio renamed every class in BoostApp and
// added two. "Training Harmony" became "FUNCTIONAL" and "Calisapiens" became
// "CALISTHENICS" — same classNameType ids (16130 / 16120), so they are the
// same classes under new names — while "STRENGTH" (19437) and "FLEXIBILITY"
// (21954) are new, and "Stretching" turned out to be FLEXIBILITY's old name.
// The rename was applied to EXISTING instances too, so anything keyed on the
// name string alone splits the history in two and stops matching live classes.
//
// Why it is scoped by studio (v1.8.1): the extension now follows whatever
// studio the signed-in user belongs to, so this table — which is Training
// Harmony's — must not be imposed on anyone else. A class legitimately called
// "Stretching" at another studio must NOT be rewritten to "FLEXIBILITY".
//
// The split that makes that safe:
//   • Identity by classNameType is self-describing and works for ANY studio.
//     An unknown studio's class still gets a stable type, built from its own
//     id and name, so the weekly slot grid, the schedule diff and moved-class
//     detection work everywhere.
//   • Curated knowledge — former names, Google Health type, display casing,
//     typical duration — is Training Harmony's and applies only there.
//     Name-based lookups, the ones that can rewrite a user's booking rule,
//     return nothing until setStudio() has named a studio we actually know.
//
// UMD: window.ClassTypes in the page, self.ClassTypes in the service worker,
// module.exports under node for tests.
(function (root) {
  "use strict";

  // id        — BoostApp's classNameType. Stable across renames; the authority.
  // name      — the current className the schedule returns.
  // aliases   — names this class was stored under before (newest last).
  // health    — Google Health ExerciseType for the lesson log.
  // display   — title shown in health apps and anywhere raw caps look shouty.
  // minutes   — rough lesson length, for history totals.
  const STUDIOS = {
    // Training Harmony (companyNum 256826)
    "256826": [
      { id: 16130, name: "FUNCTIONAL",   aliases: ["Training Harmony"], health: "CROSSFIT",          display: "Functional",   minutes: 55 },
      { id: 16120, name: "CALISTHENICS", aliases: ["Calisapiens"],      health: "CALISTHENICS",      display: "Calisthenics", minutes: 55 },
      { id: 19437, name: "STRENGTH",     aliases: [],                   health: "STRENGTH_TRAINING", display: "Strength",     minutes: 55 },
      { id: 21954, name: "FLEXIBILITY",  aliases: ["Stretching"],       health: "STRETCHING",        display: "Flexibility",  minutes: 45 },
    ],
  };

  let STUDIO = null;          // companyNum of the active studio, once known
  let TYPES = [];             // curated types for it, or [] for a studio we don't know

  // Called by the background (and by any page that has the config) whenever
  // the active studio is established or changes. An unrecognised studio is
  // not an error: it just means no curated knowledge, only id identity.
  function setStudio(companyNum) {
    STUDIO = companyNum == null ? null : String(companyNum);
    TYPES = (STUDIO && STUDIOS[STUDIO]) || [];
    return TYPES.length > 0;
  }
  function studio() { return STUDIO; }
  function known() { return TYPES.length > 0; }

  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();

  function byId(id) {
    if (id == null || id === "") return null;
    const n = Number(id);
    return TYPES.find(t => t.id === n) || null;
  }

  // Current name or any name this class used to carry — curated, so only for
  // a studio we know. This is the lookup that can rewrite a booking rule, so
  // it stays silent rather than guessing.
  function byName(name) {
    const k = norm(name);
    if (!k) return null;
    return TYPES.find(t => norm(t.name) === k || t.aliases.some(a => norm(a) === k)) || null;
  }

  // A class type built from the class itself, for studios we hold no curated
  // knowledge about. Enough to key a slot, diff a grid and spot a move.
  function generic(cls) {
    const id = cls && cls.classNameType;
    const name = String((cls && cls.className) || "").trim();
    if (id == null || id === "") return null;
    return { id: Number(id), name, aliases: [], health: null, display: name, minutes: null, generic: true };
  }

  // A class object straight from getClassesData. classNameType first — it is
  // what survives a rename — then, only for a known studio, the name.
  function of(cls) {
    if (!cls) return null;
    if (typeof cls === "string") return byName(cls);
    return byId(cls.classNameType) || generic(cls) || byName(cls.className);
  }

  // Is this one of the studio's own classes, as opposed to a one-off event?
  // At a known studio that means the curated table; anywhere else, any class
  // the schedule gave a type id to. Plan capture gates on this, so being
  // permissive here is what lets other studios capture plans at all.
  function isStudio(cls) {
    if (!cls) return false;
    if (typeof cls === "string") return known() ? !!byName(cls) : !!norm(cls);
    return !!of(cls);
  }

  // Stored name -> the name it goes by now. Unknown names, and every name at
  // a studio we don't know, pass through untouched.
  function canonical(name) { const t = byName(name); return t ? t.name : (name == null ? "" : String(name).trim()); }

  // Every name a class has gone by, current first — for reading a store that
  // was keyed by name before a rename.
  function keysFor(name) {
    const t = byName(name);
    if (!t) return [name == null ? "" : String(name).trim()];
    return [t.name].concat(t.aliases);
  }

  function display(name) { const t = byName(name); return t ? t.display : (name == null ? "" : String(name).trim()); }
  function healthType(name) { const t = byName(name); return t ? t.health : null; }
  function minutes(name) { const t = byName(name); return t ? t.minutes : null; }
  function all() { return TYPES.map(t => Object.assign({}, t)); }
  function studiosKnown() { return Object.keys(STUDIOS); }

  const api = { setStudio, studio, known, byId, byName, of, isStudio, canonical,
                keysFor, display, healthType, minutes, all, studiosKnown, STUDIOS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ClassTypes = api;
})(typeof self !== "undefined" ? self : this);
