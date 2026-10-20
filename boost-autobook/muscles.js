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

// Muscle map: exercise name → muscle groups it works (experimental).
// Rules are ordered most-specific first; the first match wins. Primary = the
// muscles the movement is built around, secondary = helpers/stabilisers.
// Names that match nothing are returned as unmapped — never silently dropped
// (same rule as the plan parser). "Conditioning" = machine/cardio pieces whose
// muscles depend on the machine and aren't drawn.
(function (root) {
  "use strict";
  const GROUPS = ["traps", "shoulders", "chest", "biceps", "triceps", "forearms", "abs", "obliques",
    "lats", "upperBack", "lowerBack", "glutes", "abductors", "adductors", "quads", "hamstrings", "calves"];
  const R = (re, p, s, tag) => ({ re, p: p.split(" "), s: s ? s.split(" ") : [], tag });
  const RULES = [
    R(/ground[- ]to[- ]overhead/i, "shoulders glutes quads", "traps lowerBack abs"),
    R(/devil press/i, "chest shoulders glutes hamstrings", "triceps quads abs"),
    R(/burpee.*(box|jump|over)|burpee/i, "chest quads", "triceps shoulders abs glutes calves"),
    R(/renegade row\s*\+\s*push/i, "lats chest abs", "triceps upperBack obliques"),
    R(/renegade row/i, "lats upperBack abs", "biceps obliques forearms"),
    R(/rower|calorie row|^row\s*(—|$)/i, "quads upperBack lats", "glutes hamstrings biceps"),
    R(/bike|airbike|assault/i, "quads glutes", "hamstrings calves shoulders"),
    R(/ski ?erg/i, "lats triceps abs", "shoulders glutes"),
    R(/^calories\b/i, "", "", "conditioning"),
    R(/hip thrust/i, "glutes", "hamstrings"),
    R(/hip abduction|abductions?\b/i, "abductors", "glutes"),
    R(/romanian|b-stance|single-leg.*deadlift/i, "hamstrings glutes", "lowerBack forearms"),
    R(/sumo deadlift/i, "glutes adductors quads", "hamstrings lowerBack forearms traps"),
    R(/deadlift/i, "hamstrings glutes lowerBack", "quads traps forearms lats"),
    R(/cossack/i, "adductors quads glutes", "hamstrings"),
    R(/overhead squat/i, "quads glutes shoulders", "upperBack abs adductors"),
    R(/clean (&|and) (push )?press/i, "glutes quads shoulders", "hamstrings triceps traps"),
    R(/squat clean|kb clean|db clean|\bclean\b(?!.*press)/i, "glutes hamstrings quads traps", "forearms upperBack"),
    R(/thruster/i, "quads glutes shoulders", "triceps abs"),
    R(/split squat|lunge|step[- ]?up/i, "quads glutes", "adductors hamstrings"),
    R(/squat/i, "quads glutes", "adductors abs"),
    R(/muscle snatch/i, "shoulders traps", "glutes upperBack"),
    R(/snatch/i, "glutes hamstrings shoulders traps", "quads upperBack lowerBack"),
    R(/russian to american|american swing/i, "glutes hamstrings shoulders", "lowerBack abs forearms"),
    R(/swing/i, "glutes hamstrings", "lowerBack forearms abs"),
    R(/incline.*press|bench press|chest press/i, "chest shoulders triceps", ""),
    R(/narrow-grip.*push|diamond/i, "triceps chest", "shoulders abs"),
    R(/push[- ]?ups?\b/i, "chest triceps shoulders", "abs"),
    R(/\bdips?\b/i, "triceps chest", "shoulders"),
    R(/push press|shoulder press|overhead press|military press/i, "shoulders triceps", "traps abs upperBack"),
    R(/chin[- ]?up/i, "lats biceps", "upperBack forearms"),
    R(/pull[- ]?ups?\b|pulldown|pull-down/i, "lats biceps", "upperBack forearms"),
    R(/pull[- ]?overs?/i, "abs lats", "chest"),
    R(/row/i, "lats upperBack", "biceps forearms"),
    R(/hammer curl|zottman/i, "biceps forearms", ""),
    R(/curl/i, "biceps", "forearms"),
    R(/jump[- ]?overs?|box jump|lateral jump|broad jump/i, "quads glutes calves", "hamstrings"),
    R(/unders|jump rope|skipping/i, "calves", "quads shoulders forearms"),
    R(/calf raise/i, "calves", ""),
    R(/rotation|chainsaw|woodchop|cross body/i, "obliques abs", "shoulders"),
    R(/plank/i, "abs obliques", "shoulders triceps"),
    R(/superman|back extension/i, "lowerBack glutes", "upperBack hamstrings"),
    R(/toes to bar|knee raise|leg raise|l-sit|v-ups?|sit-?ups?|crunch|hollow|toes? touch/i, "abs", "obliques"),
  ];
  function musclesFor(name) {
    const n = String(name || "");
    const r = RULES.find(r => r.re.test(n));
    if (!r) return { primary: [], secondary: [], unmapped: true };
    return { primary: r.p.filter(Boolean), secondary: r.s, tag: r.tag || null };
  }
  // Score per muscle for a list of plan items: primary 1, secondary 0.5.
  function score(items) {
    const sc = {};
    for (const it of items) {
      const m = musclesFor(it.name);
      m.primary.forEach(g => { sc[g] = (sc[g] || 0) + 1; });
      m.secondary.forEach(g => { sc[g] = (sc[g] || 0) + 0.5; });
    }
    return sc;
  }
  const api = { GROUPS, musclesFor, score };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MuscleMap = api;
})(typeof self !== "undefined" ? self : this);
