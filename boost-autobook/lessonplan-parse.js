/*
 * Boost Auto-Book - automatic registration for BoostApp group lessons.
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

/* ---------------------------------------------------------------------------
 * lesson-plan-capture — plan parser
 * ---------------------------------------------------------------------------
 * Turns a Boost `getClassInfo.description` into a structured LessonPlan.
 *
 * Environment-agnostic: no DOM, no Node APIs. Loads in a browser console, as
 * part of capture.js, or via require() in Node for the test suite.
 *
 * Design rule: NEVER silently drop a line. Anything the grammar does not
 * recognise lands in `unparsed[]` and sets `ok:false`. Parse coverage over the
 * captured corpus is a health metric — if the studio changes its template we
 * want a loud failure, not a quietly wrong set count.
 * ------------------------------------------------------------------------- */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LessonPlanParser = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Assumed seconds of work for a set whose duration is not stated (a rep-based
  // strength set). Only used for expectedDurationSec, never for bout counts.
  const WORK_EST_SEC = 45;

  const BLOCK_MARKERS = { "\u{1F7E9}": "A", "\u{1F7E8}": "B", "\u{1F7E5}": "C" };
  const MARKER_RE = /\u{1F7E9}|\u{1F7E8}|\u{1F7E5}/u;

  // --- text extraction -----------------------------------------------------
  // The description is HTML. Block tags must become newlines BEFORE tags are
  // stripped, otherwise every line runs together (which is exactly what
  // textContent does — see normalizeLines for the recovery path).
  function htmlToText(html) {
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
      .map((s) => s.replace(/[ \t ]+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  // Recovers line structure from run-on text. Needed because some extraction
  // paths (textContent, DOMParser without layout) lose all block boundaries,
  // producing "...Week 4: Build<emoji> Main StrengthA. 3 Pair-SetsA1. 8/each...".
  // Idempotent: already-clean multi-line input passes through unchanged.
  function normalizeLines(text) {
    // Collapse a doubled block letter ("B. B. 3 Sets…", seen on 22.08.26)
    // BEFORE splitting, or the splitter strands a bare "B." on its own line.
    let t = String(text || "")
      .replace(/\r/g, "")
      .replace(/\b([A-C])\.\s*\1\.\s*/g, "$1. ");
    const breakBefore = new RegExp(
      "(?!^)(?=" +
        [
          "\\u{1F7E9}|\\u{1F7E8}|\\u{1F7E5}", // block markers
          "\\d{2}\\.\\d{2}\\.\\d{2},\\s", //  header, when a title precedes it
          "[A-C]\\d\\.\\s", //               item:  A1. / B2. / C4.
          "[A-C]\\.\\s(?:\\d|EMOM|AMRAP|Stay|Max|Every|Accumulate)", // block mode line
          "Rest\\s+\\d", //                  rest instruction
          "Complete all\\b",
          // NB: no rule for a bare "Stay on the same…" — it always follows its
          // block letter ("C. Stay on the same…") and the [A-C]. rule above
          // already breaks there. A separate rule would split "C." off alone.
        ].join("|") +
        ")",
      "gu"
    );
    // Only run-on text needs line recovery. Clean multi-line input (every
    // capture since Sep 2026) must not be re-split: Oct prose mentions items
    // inline ("…then A2. Keep the…"), which would mint phantom items.
    if ((t.match(/\n/g) || []).length < 4) t = t.replace(breakBefore, "\n");
    return t
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
  }

  // --- header --------------------------------------------------------------
  // "18.08.26, Tuesday, Functional Strength Training - Week 4: Build"
  const HEADER_RE =
    /^(\d{2})\.(\d{2})\.(\d{2}),\s*([A-Za-z]+),\s*(.+?)\s*-\s*Week\s*(\d+)\s*:\s*(.+?)\s*$/;

  // Sep 2026 template: "Wednesday · 23.09.2026 | Functional Strength Training — Week 1: Build"
  // Oct 2026 template: "TUESDAY · 13.10.2026 FUNCTIONAL STRENGTH TRAINING — WEEK 4: PEAK"
  // (upper case, no "|") — same regex with the pipe optional, case-insensitive.
  const HEADER2_RE =
    /^([A-Za-z]+)\s*[·•]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*\|?\s*(.+?)\s*[—–-]\s*Week\s*(\d+)\s*:\s*(.+?)\s*$/i;
  const titleCase = (t) => /[a-z]/.test(t) ? t : String(t).toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());

  function parseHeader(line) {
    const m2 = HEADER2_RE.exec(line);
    if (m2) {
      const dd = m2[2].padStart(2, "0"), mm = m2[3].padStart(2, "0");
      return {
        date: m2[4] + "-" + mm + "-" + dd,
        dateRaw: dd + "." + mm + "." + m2[4],
        weekday: titleCase(m2[1]),
        program: titleCase(m2[5]),
        weekNumber: Number(m2[6]),
        phase: titleCase(m2[7]),
        template: /\|/.test(line) ? "2026-09" : "2026-10",
      };
    }
    const m = HEADER_RE.exec(line);
    if (!m) return null;
    return {
      date: "20" + m[3] + "-" + m[2] + "-" + m[1], // ISO, for cross-checking
      dateRaw: m[1] + "." + m[2] + "." + m[3],
      weekday: m[4],
      program: m[5],
      weekNumber: Number(m[6]),
      phase: m[7],
    };
  }

  // --- block mode ----------------------------------------------------------
  function parseMode(rest) {
    let m;
    if ((m = /^(\d+)\s+Pair-Sets?\b/i.exec(rest)))
      return { mode: "PAIR_SETS", sets: Number(m[1]) };
    // Sep 2026: "3 Paired Rounds" (+ "Alternate B1 → B2 for 3 rounds.")
    if ((m = /^(\d+)\s+Paired\s+Rounds?\b/i.exec(rest)))
      return { mode: "PAIR_SETS", sets: Number(m[1]), order: "ALTERNATING" };
    // Sep 2026: "Accumulate 50 Reps per Exercise — 10-Minute Combined Time Cap"
    // Fixed total reps, self-chosen sets and rest, one exercise after the other.
    if ((m = /^Accumulate\s+(\d+)\s+Reps?\s+per\s+Exercise\b(?:.*?(\d+)[-\s]*Minute\b.*?Time\s*Cap)?/i.exec(rest)))
      return {
        mode: "CHIPPER", order: "COMPLETE_ALL_SETS_FIRST",
        targetReps: Number(m[1]),
        timeCapSec: m[2] ? Number(m[2]) * 60 : null,
        restPolicy: "AS_NEEDED",
      };
    // Sep 2026: "6 Rounds — 20 Seconds Work / 10 Seconds Rest"
    if ((m = /^(\d+)\s+Rounds?\s*[—–-]\s*(\d+)\s*(?:s|sec|seconds?)\s*Work\s*\/\s*(\d+)\s*(?:s|sec|seconds?)\s*Rest\b/i.exec(rest)))
      return { mode: "ROUNDS", rounds: Number(m[1]), work: Number(m[2]), rest: Number(m[3]) };
    if ((m = /^(\d+)\s+Sets?\s+Each\s+Exercise\b/i.exec(rest)))
      return { mode: "SETS_EACH", sets: Number(m[1]) };
    if ((m = /^EMOM\s*x\s*(\d+)\s*minutes?\b/i.exec(rest)))
      return { mode: "EMOM", durationMin: Number(m[1]) };
    if ((m = /^AMRAP\s*x\s*(\d+)\s*minutes?\b/i.exec(rest)))
      return { mode: "AMRAP", durationMin: Number(m[1]) };
    // "Every 1:30 minutes for 6 Sets Rotate to the Next Station"
    // A fixed-clock station rotation — an EMOM with a period other than 60s.
    if (
      (m = /^Every\s+(\d+):(\d{2})\s*minutes?\s*for\s*(\d+)\s*Sets?\b/i.exec(rest))
    )
      return {
        mode: "EVERY_X",
        period: Number(m[1]) * 60 + Number(m[2]),
        sets: Number(m[3]),
        rotates: /Rotate to the Next Station/i.test(rest),
      };
    // "2 Rounds (Rotate to the next station every 1:20 | 10s transition)"
    if (
      (m = /^(\d+)\s+Rounds?\b[^(]*\(\s*Rotate to the next station every\s+(\d+):(\d{2})\s*\|\s*(\d+)s\s*transition\s*\)/i.exec(
        rest
      ))
    )
      return {
        mode: "ROUNDS",
        rounds: Number(m[1]),
        work: Number(m[2]) * 60 + Number(m[3]),
        rest: Number(m[4]),
        rotates: true,
      };
    if ((m = /^(\d+)\s+Rounds?\b/i.exec(rest)))
      return { mode: "ROUNDS", rounds: Number(m[1]) };
    // "Complete All Reps of A1 Before Moving to A2" — a chipper: fixed total
    // work, self-selected rest, usually under a time cap. One long effort per
    // exercise rather than a repeating set structure.
    if (/^Complete All Reps of\b/i.test(rest))
      return { mode: "CHIPPER", order: "COMPLETE_ALL_SETS_FIRST" };
    if (
      (m = /Stay on the same exercise for all\s+(\d+)\s+Sets?\s*\(\s*(\d+)s\s*work\s*\|\s*(\d+)s\s*rest\s*\)/i.exec(
        rest
      ))
    )
      return {
        mode: "INTERVAL",
        sets: Number(m[1]),
        work: Number(m[2]),
        rest: Number(m[3]),
        perExercise: true,
      };
    if ((m = /\(\s*(\d+)s\s*work\s*\|\s*(\d+)s\s*rest\s*\)/i.exec(rest)))
      return { mode: "INTERVAL", work: Number(m[1]), rest: Number(m[2]) };
    // Late-Sep plans already used the Oct wording after the block letter
    // ("A. 3 Straight Sets per Exercise", "C. For Completion — 12-Minute Time Cap").
    const v3 = parseModeV3(rest);
    if (v3 && v3.mode) return v3;
    return null;
  }

  // Oct 2026 block mode line, e.g.
  //   "3 Straight Sets per Exercise · Rest 60 seconds"
  //   "3 Paired Rounds · 55 sec work / 25 sec rest · 8 minutes"
  //   "3 Intervals per Exercise · 45 sec work / 15 sec rest · 12 minutes"
  //   "Every 75 Seconds × 6 Intervals · 7:30 total"
  //   "12-Minute Ascending-Ladder AMRAP · 2–4–6–8–10–12… reps of each"
  //   "For Completion · 12-Minute Time Cap · 18–22–26 reps of each"
  // Returns null when the line is not a mode line.
  function parseModeV3(line) {
    const toks = String(line).split(/\s*[·•]\s*|\s+[—–]\s+/).map((t) => t.trim()).filter(Boolean);
    const r = {};
    let m, hit = false;
    for (const t of toks) {
      if ((m = /^(\d+)\s+Straight\s+Sets?\s+per\s+Exercise\b/i.exec(t))) { r.kind = "SETS_EACH"; r.sets = +m[1]; hit = true; }
      else if ((m = /^(\d+)\s+Paired\s+Rounds?\b/i.exec(t))) { r.kind = "PAIRED"; r.sets = +m[1]; hit = true; }
      else if ((m = /^(\d+)\s+Intervals?\s+per\s+Exercise\b/i.exec(t))) { r.kind = "INTERVAL_EACH"; r.sets = +m[1]; hit = true; }
      else if ((m = /^(\d+)\s+Rounds?$/i.exec(t))) { r.kind = "ROUNDS"; r.rounds = +m[1]; hit = true; }
      else if ((m = /^Every\s+(\d+)\s*(?:s|sec|seconds?)\s*[×x]\s*(\d+)\s*(?:Intervals?|Sets?)\b/i.exec(t))) { r.kind = "EVERY_X"; r.period = +m[1]; r.sets = +m[2]; hit = true; }
      else if ((m = /^Every\s+(\d+):(\d{2})\s*(?:minutes?)?\s*[×x]\s*(\d+)/i.exec(t))) { r.kind = "EVERY_X"; r.period = +m[1] * 60 + +m[2]; r.sets = +m[3]; hit = true; }
      else if ((m = /^(\d+)[-\s]*Minute\b.*\bAMRAP\b/i.exec(t))) { r.kind = "AMRAP"; r.durationMin = +m[1]; hit = true; }
      else if ((m = /^Accumulate\s+(\d+)\s+Reps?\b/i.exec(t))) { r.kind = "CHIPPER"; r.targetReps = +m[1]; r.restPolicy = "AS_NEEDED"; hit = true; }
      else if (/^For\s+Completion\b/i.test(t)) { r.kind = "CHIPPER"; hit = true; }
      else if ((m = /^(\d+)[-\s]*Minute\b.*\bTime\s*Cap\b/i.test(t) && /^(\d+)/.exec(t))) { r.timeCapSec = +m[1] * 60; }
      else if ((m = /^(\d+)\s*(?:s|sec|seconds?)\s*work\s*\/\s*(\d+)\s*(?:s|sec|seconds?)\s*rest\b/i.exec(t))) { r.work = +m[1]; r.rest = +m[2]; }
      else if ((m = /^Rest\s+(\d+)\s*(?:s\b|sec|seconds?)/i.exec(t))) { r.rest = +m[1]; }
      else if ((m = /^(\d+)\s*minutes?$/i.exec(t))) { r.durationMinStated = +m[1]; }
      else if ((m = /^(\d+):(\d{2})\s*total\b/i.exec(t))) { r.durationMinStated = (+m[1] * 60 + +m[2]) / 60; }
    }
    if (!hit) return null;
    const out = { durationMinStated: r.durationMinStated, timeCapSec: r.timeCapSec };
    switch (r.kind) {
      case "SETS_EACH": Object.assign(out, { mode: "SETS_EACH", sets: r.sets, rest: r.rest ?? null, order: "COMPLETE_ALL_SETS_FIRST" }); break;
      case "PAIRED":
        // Timed paired rounds ("55 sec work / 25 sec rest") run on a clock:
        // B1, B2, B1, B2… — a ROUNDS block over the two items.
        if (r.work) Object.assign(out, { mode: "ROUNDS", rounds: r.sets, work: r.work, rest: r.rest || 0, order: "ALTERNATING" });
        else Object.assign(out, { mode: "PAIR_SETS", sets: r.sets, rest: r.rest ?? null, order: "ALTERNATING" });
        break;
      case "INTERVAL_EACH": Object.assign(out, { mode: "INTERVAL", sets: r.sets, work: r.work || null, rest: r.rest || 0, perExercise: true }); break;
      case "ROUNDS": Object.assign(out, { mode: "ROUNDS", rounds: r.rounds, work: r.work || null, rest: r.rest || 0, order: "CIRCUIT" }); break;
      case "EVERY_X": Object.assign(out, { mode: "EVERY_X", period: r.period, sets: r.sets, rotates: true }); break;
      case "AMRAP": Object.assign(out, { mode: "AMRAP", durationMin: r.durationMin }); break;
      case "CHIPPER": Object.assign(out, { mode: "CHIPPER", order: "COMPLETE_ALL_SETS_FIRST", targetReps: r.targetReps, restPolicy: r.restPolicy }); break;
    }
    Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  // --- item ----------------------------------------------------------------
  // "A1. 8/each Barbell Single Leg Deadlift | RPE 8"
  // "B1. 60s AMRAP Bent Resist Floor Seated Row | RPE 8"
  // "A1. Max Reps Strict Bar Pull Ups | RPE 8"
  function parseItem(line) {
    const m = /^([A-D]\d)\.\s*(.+)$/.exec(line);
    if (!m) return null;
    const item = { key: m[1], reps: null, unit: null, name: null, rpe: null };
    let body = m[2].trim();
    // Oct 2026: "… ▲ W3: 10 reps, lighter DBs" / "… ↻ W3: Bike or Rower" —
    // what the previous week did. Kept, never parsed as part of the exercise.
    const prev = /\s*(?:[▲↻]\s*W(\d+)\s*:|=\s*W(\d+)\s*$)\s*(.*)$/.exec(body);
    if (prev) { item.prevWeek = { week: Number(prev[1] || prev[2]), note: prev[2] ? "same as" : prev[3].trim() }; body = body.slice(0, prev.index).trim(); }
    const rir = /\s*[·•]\s*RIR\s*([\d–—-]+(?:\s*[–—-]\s*\d+)?)\s*$/i.exec(body);
    if (rir) { item.rir = rir[1].replace(/\s/g, ""); body = body.slice(0, rir.index).trim(); }

    const rpe = /\|\s*RPE\s*(\d+(?:\.\d+)?)\s*$/i.exec(body);
    if (rpe) {
      item.rpe = Number(rpe[1]);
      body = body.slice(0, rpe.index).trim();
    }

    let r;
    // Pyramid sets "8–7–6 reps …" (one number per set).
    if ((r = /^(\d+(?:\s*[–—-]\s*\d+){2,})\s+reps?\s+/i.exec(body))) {
      item.repsPerSet = r[1].split(/\s*[–—-]\s*/).map(Number);
      item.reps = item.repsPerSet[0];
      item.unit = "reps";
      body = body.slice(r[0].length).trim();
      item.name = body;
      return item;
    }
    // "12 total reps, 6/side …"
    if ((r = /^(\d+)\s+total\s+reps?\s*,\s*(\d+)\s*\/\s*side\s+/i.exec(body))) {
      item.reps = Number(r[2]); item.unit = "reps_each_side"; item.totalReps = Number(r[1]);
      item.name = body.slice(r[0].length).trim();
      return item;
    }
    // Ranges appear as "3-5/each Mixed Grip Pull Ups" — keep both ends.
    if ((r = /^(\d+)\s+total\s+reps?\s+/i.exec(body))) {
      item.reps = Number(r[1]);
      item.unit = "total_reps";
    } else if ((r = /^(\d+)(?:\s*[-–—]\s*(\d+))?\s*\/\s*(?:each|side)(?:\s+reps?)?\s+/i.exec(body))) {
      item.reps = Number(r[1]);
      if (r[2]) item.repsMax = Number(r[2]);
      item.unit = "reps_each_side";
    } else if ((r = /^(\d+)s\s+AMRAP\s+/i.exec(body))) {
      item.reps = Number(r[1]);
      item.unit = "seconds_amrap";
    } else if ((r = /^AMRAP\s+/i.exec(body))) {
      item.unit = "amrap";
    } else if ((r = /^Max\s+Reps\s+/i.exec(body))) {
      item.unit = "max_reps";
    } else if ((r = /^(\d+)(?:\s*[-–—]\s*(\d+))?(?:\s+reps?)?\s+/i.exec(body))) {
      item.reps = Number(r[1]);
      if (r[2]) item.repsMax = Number(r[2]);
      item.unit = "reps";
    }
    if (r) body = body.slice(r[0].length).trim();
    item.name = body;
    return item;
  }

  function parseRest(line) {
    let m;
    if ((m = /^Rest\s+(\d+):(\d{2})/i.exec(line)))
      return Number(m[1]) * 60 + Number(m[2]);
    if ((m = /^Rest\s+(\d+)\s*(?:s\b|sec)/i.exec(line))) return Number(m[1]);
    if ((m = /^Rest\s+(\d+):(\d{2})\b/i.exec(line))) return Number(m[1]) * 60 + Number(m[2]);
    if ((m = /^Rest\s+(\d+)\s*min/i.exec(line))) return Number(m[1]) * 60;
    return null;
  }

  // A work|rest clause can ride along with any mode, e.g.
  // "C. 3 Sets Each Exercise (45s work | 15s rest)".
  function parseWorkRest(rest) {
    const m = /\(\s*(\d+)s\s*work\s*\|\s*(\d+)s\s*rest\s*\)/i.exec(rest);
    return m ? { work: Number(m[1]), rest: Number(m[2]) } : null;
  }

  // --- derived quantities --------------------------------------------------
  // expectedBouts is THE number the HR trace gets tested against.
  function derive(block) {
    const n = block.items.length || 1;
    switch (block.mode) {
      case "PAIR_SETS":
      case "SETS_EACH": {
        const sets = block.sets || 1;
        block.expectedBouts = sets * n;
        block.expectedDurationSec =
          sets * n * (WORK_EST_SEC + (block.rest || 0));
        block.boutPeriodSec = WORK_EST_SEC + (block.rest || 0);
        break;
      }
      case "EMOM":
        block.expectedBouts = block.durationMin || 0;
        block.expectedDurationSec = (block.durationMin || 0) * 60;
        block.boutPeriodSec = 60;
        break;
      case "AMRAP":
        block.expectedBouts = 1; // a plateau, not a peak train
        block.expectedDurationSec = (block.durationMin || 0) * 60;
        block.boutPeriodSec = null;
        break;
      case "INTERVAL": {
        const sets = block.sets || 1;
        const per = block.perExercise ? n : 1;
        block.expectedBouts = sets * per;
        block.expectedDurationSec =
          sets * per * ((block.work || 0) + (block.rest || 0));
        block.boutPeriodSec = (block.work || 0) + (block.rest || 0);
        break;
      }
      case "EVERY_X":
        // `sets` counts total station-bouts, not sets per station.
        block.expectedBouts = block.sets || 0;
        block.expectedDurationSec = (block.sets || 0) * (block.period || 0);
        block.boutPeriodSec = block.period || null;
        break;
      case "ROUNDS": {
        const rounds = block.rounds || 1;
        block.expectedBouts = rounds * n;
        block.boutPeriodSec = block.work
          ? block.work + (block.rest || 0)
          : null;
        block.expectedDurationSec = block.boutPeriodSec
          ? rounds * n * block.boutPeriodSec
          : null;
        break;
      }
      case "CHIPPER":
        // One sustained effort per exercise; rest is athlete-chosen.
        block.expectedBouts = n;
        block.expectedDurationSec = block.timeCapSec || null;
        block.boutPeriodSec = null;
        break;
      default:
        block.expectedBouts = null;
        block.expectedDurationSec = null;
        block.boutPeriodSec = null;
    }
    // How much the HR trace should be expected to match the prediction.
    // Clock-driven blocks are testable; self-paced ones are not, and saying so
    // up front stops a weak match being read as a failed hypothesis.
    block.predictability =
      { EMOM: "high", EVERY_X: "high", INTERVAL: "high", ROUNDS: "high",
        PAIR_SETS: "medium", SETS_EACH: "medium",
        AMRAP: "low", CHIPPER: "low" }[block.mode] || null;
    if (block.restPolicy === "AS_NEEDED") block.predictability = "low";
    return block;
  }

  // --- main ----------------------------------------------------------------
  function parsePlan(input, meta) {
    const raw = /<[a-z!/]/i.test(String(input || ""))
      ? htmlToText(input)
      : String(input || "");
    const lines = normalizeLines(raw).split("\n");

    const plan = {
      title: null, // e.g. "Training Harmony - Cycle 08 | 2026"
      header: null,
      blocks: [],
      unparsed: [], // structural failures only — these set ok:false
      prose: [], //    coaching prose kept for review, non-fatal
      ok: false,
      meta: meta || {},
    };
    if (!lines.length) return plan;

    let cur = null;
    for (const line of lines) {
      if (!plan.header) {
        const h = parseHeader(line);
        if (h) {
          plan.header = h;
          continue;
        }
        // Some days prefix a cycle title line before the dated header, e.g.
        // "Training Harmony - Cycle 08 | 2026". Keep it, don't fail on it.
        if (!plan.title && !plan.blocks.length && !MARKER_RE.test(line)) {
          plan.title = line;
          continue;
        }
      }

      // Oct 2026 block header: "A · MAIN STRENGTH | Incline Push + Squat"
      const bh = /^([A-D])\s*[·•]\s*(.+)$/.exec(line);
      if (bh && plan.header) {
        const [lab, foc] = bh[2].split("|");
        cur = {
          key: bh[1], markerKey: null, label: titleCase(lab.trim()), focus: (foc || "").trim() || null,
          mode: null, sets: null, durationMin: null, work: null, rest: null, order: null,
          items: [], notes: [], template: "2026-10",
        };
        plan.blocks.push(cur);
        continue;
      }
      if (cur && cur.template === "2026-10" && !cur.mode && !/^[A-D]\d\./.test(line)) {
        const mv = parseModeV3(line);
        if (mv) { Object.assign(cur, mv); cur.modeRaw = line; continue; }
      }

      const mk = MARKER_RE.exec(line);
      if (mk && mk.index === 0) {
        cur = {
          key: null, // set from the block letter, not the marker colour
          markerKey: BLOCK_MARKERS[mk[0]] || null,
          label: line.slice(mk[0].length).split("|")[0].trim(),
          focus: (line.slice(mk[0].length).split("|")[1] || "").trim() || null,
          mode: null,
          sets: null,
          durationMin: null,
          work: null,
          rest: null,
          order: null,
          items: [],
          notes: [],
        };
        plan.blocks.push(cur);
        continue;
      }

      if (!cur) {
        plan.unparsed.push(line);
        continue;
      }

      const item = parseItem(line);
      if (item) {
        cur.items.push(item);
        continue;
      }

      // Tolerate a duplicated letter prefix — "B. B. 3 Sets Each Exercise"
      // appeared verbatim in the 22.08.26 plan.
      const modeLine = /^([A-C])\.\s*(?:\1\.\s*)?(.+)$/.exec(line);
      if (modeLine) {
        const mode = parseMode(modeLine[2]);
        const wr = parseWorkRest(modeLine[2]);
        if (mode || wr) {
          // The letter is authoritative for the block key; the emoji marker is
          // not always in A/B/C order (21.08.26 had block B under the red
          // marker, skipping yellow entirely).
          cur.key = modeLine[1];
          if (mode) Object.assign(cur, mode);
          if (wr && cur.work == null) Object.assign(cur, wr);
          if (!mode) {
            cur.mode = cur.mode || "INTERVAL";
            cur.modeRaw = modeLine[2];
          }
          continue;
        }
        // A block header we don't recognise: keep the block and its items, but
        // mark the mode unknown and let it fail loudly rather than guessing a
        // bout count that would silently corrupt an analysis.
        cur.mode = "UNKNOWN";
        cur.modeRaw = modeLine[2];
        plan.unparsed.push(line);
        continue;
      }

      const restSec = parseRest(line);
      if (restSec != null) {
        cur.rest = restSec;
        if (/move to\s+[A-C]1/i.test(line)) cur.order = "ALTERNATING";
        cur.notes.push(line);
        continue;
      }

      if (/^Complete all\s+\d+\s+sets?\s+of\s+[A-D]\d\s+before moving/i.test(line)) {
        cur.order = "COMPLETE_ALL_SETS_FIRST";
        cur.notes.push(line);
        continue;
      }
      if (/^Setup:/i.test(line)) {
        if (/partners? alternat/i.test(line)) cur.partners = true;
        cur.notes.push(line);
        continue;
      }
      if (/^Complete all\s+\d+\s+sets? before moving/i.test(line)) {
        cur.order = "COMPLETE_ALL_SETS_FIRST";
        cur.notes.push(line);
        continue;
      }

      // "Time Cap - 10:00 minutes" bounds a block that has no fixed set count.
      let tc;
      if ((tc = /^Time Cap\s*[-–]\s*(\d+):(\d{2})/i.exec(line))) {
        cur.timeCapSec = Number(tc[1]) * 60 + Number(tc[2]);
        cur.notes.push(line);
        continue;
      }
      if (/^Rest as Needed/i.test(line)) {
        cur.restPolicy = "AS_NEEDED";
        cur.notes.push(line);
        continue;
      }

      // Sep 2026 instruction lines.
      if (/^Complete all\s+\d+\s+reps?\s+of\s+[A-C]\d\s+before moving/i.test(line)) {
        cur.order = "COMPLETE_ALL_SETS_FIRST";
        cur.notes.push(line);
        continue;
      }
      if (/^Alternate\s+[A-D]\d\s*(?:→|->|to)\s*[A-D]\d/i.test(line)) {
        cur.order = "ALTERNATING";
        cur.notes.push(line);
        continue;
      }
      if (/^(?:Complete|Move through)\s+[A-D]\d\s*(?:→|->)/i.test(line)) {
        cur.order = "CIRCUIT";
        cur.notes.push(line);
        continue;
      }
      let rl;
      if ((rl = /Each round lasts\s+(\d+)\s*minutes?/i.exec(line))) cur.roundSecStated = Number(rl[1]) * 60;
      if ((rl = /Total duration:?\s*(\d+)\s*minutes?/i.exec(line))) cur.durationMinStated = Number(rl[1]);
      if (/rest as needed/i.test(line)) cur.restPolicy = "AS_NEEDED";
      if (/Stop when the\s+(\d+)[-\s]*minute time cap/i.test(line) && !cur.timeCapSec)
        cur.timeCapSec = Number(/(\d+)[-\s]*minute/i.exec(line)[1]) * 60;

      if (/^Stay on the same exercise/i.test(line)) {
        const mode = parseMode(line);
        if (mode) {
          Object.assign(cur, mode);
          cur.notes.push(line);
          continue;
        }
      }

      // Free-form coaching prose inside a block ("Rotate to the next exercise
      // after each round.") cannot corrupt a bout count, so it is recorded, not
      // treated as a parse failure. Only STRUCTURAL unknowns — a block header
      // whose mode we cannot read, or an item we cannot read — invalidate a
      // plan. Prose is still surfaced via plan.prose so nothing is hidden.
      cur.notes.push(line);
      plan.prose.push(line);
    }

    plan.blocks.forEach(derive);
    plan.expectedBoutsTotal = plan.blocks.reduce(
      (a, b) => a + (b.expectedBouts || 0),
      0
    );
    plan.expectedWorkSec = plan.blocks.reduce(
      (a, b) => a + (b.expectedDurationSec || 0),
      0
    );
    plan.ok =
      !!plan.header &&
      plan.blocks.length > 0 &&
      plan.blocks.every((b) => b.mode && b.mode !== "UNKNOWN" && b.items.length) &&
      plan.unparsed.length === 0;
    return plan;
  }

  // Integrity check from the doc: the plan text states its own date, so a
  // mismatch against the class we fetched means the studio posted a stale or
  // wrong description — worth knowing before it pollutes an analysis.
  function checkDate(plan, classStartDate) {
    if (!plan.header || !classStartDate) return null;
    const iso = String(classStartDate).slice(0, 10);
    return plan.header.date === iso;
  }

  // Second-by-second schedule of a CLOCK-DRIVEN block, relative to its start:
  // [{ t0, t1, kind: "work"|"rest", item: "C2", name, round }]. Only blocks
  // whose clock is dictated by the plan get one (EMOM, EVERY_X, INTERVAL,
  // ROUNDS with work/rest); self-paced blocks return null — there the
  // exercise at a given minute cannot be known from the plan.
  function blockTimeline(block) {
    const items = block.items || [];
    const n = items.length;
    if (!n) return null;
    const out = [];
    const push = (t0, dur, kind, it, round) => {
      if (dur > 0) out.push({ t0, t1: t0 + dur, kind, item: it ? it.key : null, name: it ? it.name : null, round });
    };
    let t = 0;
    if (block.mode === "ROUNDS" && block.work) {
      for (let r = 1; r <= (block.rounds || 1); r++)
        for (const it of items) { push(t, block.work, "work", it, r); t += block.work; push(t, block.rest || 0, "rest", it, r); t += block.rest || 0; }
      return out;
    }
    if (block.mode === "INTERVAL" && block.work) {
      const sets = block.sets || 1;
      if (block.perExercise) {
        for (const it of items) for (let s = 1; s <= sets; s++) { push(t, block.work, "work", it, s); t += block.work; push(t, block.rest || 0, "rest", it, s); t += block.rest || 0; }
      } else {
        for (let s = 1; s <= sets; s++) for (const it of items) { push(t, block.work, "work", it, s); t += block.work; push(t, block.rest || 0, "rest", it, s); t += block.rest || 0; }
      }
      return out;
    }
    if (block.mode === "EMOM" && block.durationMin) {
      for (let m = 0; m < block.durationMin; m++) push(m * 60, 60, "work", items[m % n], Math.floor(m / n) + 1);
      return out;
    }
    if (block.mode === "EVERY_X" && block.period && block.sets) {
      for (let k = 0; k < block.sets; k++) push(k * block.period, block.period, "work", items[k % n], Math.floor(k / n) + 1);
      return out;
    }
    return null;
  }

  return { parsePlan, htmlToText, normalizeLines, checkDate, blockTimeline, WORK_EST_SEC };
});
