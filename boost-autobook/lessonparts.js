// Lesson parts on the heart-rate curve (experimental, v1.6).
// Places the plan's parts (Warm-up, A, B, C…) on a lesson's heart-rate trace.
// Same algorithm as notes/lesson-plan-capture/prototype.html ("guess v1").
// It is an ESTIMATE: nothing in the data says when a part started; Philip's
// drag fix-ups (stored in bsab_lesson_parts) are the ground truth.
// UMD: window.LessonParts in the page, module.exports under node for tests.
(function (root) {
  "use strict";
  const P = () => (typeof module === "object" && module.exports) ? require("./lessonplan-parse.js") : root.LessonPlanParser;

  // Planned length of a part in seconds.
  function planSec(b) {
    if (b.mode === "CHIPPER" || b.mode === "AMRAP") return b.timeCapSec || (b.durationMin || 0) * 60 || 600;
    return b.expectedDurationSec || (b.durationMinStated || 0) * 60 || 600;
  }
  function workBlocks(plan) { return (plan && plan.blocks || []).filter(b => b.items && b.items.length); }
  function seg(plan, b, i, t0, total) {
    const key = b.key || "ABCD"[i], d = planSec(b);
    return { key, label: b.label || key, t0, t1: Math.min(total, t0 + d), locked: !!P().blockTimeline(b), durSec: d, blockIndex: plan.blocks.indexOf(b) };
  }

  // v0: 10-min warm-up, planned lengths, leftover time spread evenly as gaps.
  function guessV0(plan, total) {
    const blocks = workBlocks(plan), durs = blocks.map(planSec);
    const work = durs.reduce((a, b) => a + b, 0), warm = 600, tail = 120;
    const gap = Math.max(60, (total - warm - tail - work) / Math.max(1, blocks.length));
    const segs = [{ key: "W", label: "Warm-up", t0: 0, t1: warm, locked: false }];
    let t = warm + gap / 2;
    blocks.forEach((b, i) => { segs.push(seg(plan, b, i, t, Infinity)); t += durs[i] + gap; });
    for (const s of segs) if (s.t1 > total) { const d = s.t1 - total; s.t0 = Math.max(0, s.t0 - d); s.t1 = total; }
    return segs;
  }

  // v1: parts keep planned length and order; where they sit is chosen to cover
  // the most heart rate above the lesson's median (dynamic programming on a
  // 30-s grid), warm-up ≥ 6 min (prior: ≈10 min), gaps ≥ 1 min (prior: ≤ 2 min).
  function guessV1(plan, pts, step) {
    const G = 30, total = pts.length * step;
    const blocks = workBlocks(plan);
    if (!blocks.length) return null;
    const N = Math.floor(total / G), hr = [];
    for (let c = 0; c < N; c++) {
      const v = pts.slice(c * G / step, (c + 1) * G / step).filter(x => x != null);
      hr.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    }
    const known = hr.filter(v => v != null).sort((a, b) => a - b);
    const ref = known[Math.floor(known.length / 2)] || 0;
    const pre = [0];
    hr.forEach((v, i) => pre.push(pre[i] + (v == null ? 0 : v - ref)));
    const sum = (a, b) => pre[b] - pre[a];
    const lens = blocks.map(b => Math.max(1, Math.round(planSec(b) / G)));
    const warmMin = 12, gapMin = 2, warmExp = 20, gapFree = 4, LW = 2, LG = 1;
    if (warmMin + lens.reduce((a, b) => a + b, 0) + gapMin * (blocks.length - 1) > N) return guessV0(plan, total);
    const best = blocks.map(() => new Array(N).fill(-Infinity)), from = blocks.map(() => new Array(N).fill(-1));
    for (let i = 0; i < blocks.length; i++) {
      for (let s = 0; s + lens[i] <= N; s++) {
        if (i === 0) { if (s >= warmMin) best[0][s] = sum(s, s + lens[0]) - LW * Math.abs(s - warmExp); continue; }
        for (let e = 0; e <= s - gapMin - lens[i - 1]; e++) {
          if (best[i - 1][e] === -Infinity) continue;
          const gap = s - e - lens[i - 1];
          const v = best[i - 1][e] + sum(s, s + lens[i]) - LG * Math.max(0, gap - gapFree);
          if (v > best[i][s]) { best[i][s] = v; from[i][s] = e; }
        }
      }
    }
    const last = blocks.length - 1;
    let s = best[last].indexOf(Math.max(...best[last]));
    const starts = new Array(blocks.length);
    for (let i = last; i >= 0; i--) { starts[i] = s; s = from[i][s]; }
    const segs = [{ key: "W", label: "Warm-up", t0: 0, t1: starts[0] * G, locked: false }];
    blocks.forEach((b, i) => segs.push(seg(plan, b, i, starts[i] * G, total)));
    return segs;
  }

  // Saved fix-ups override the guess; part metadata comes from the guess.
  function applySaved(auto, saved) {
    if (!saved || !Array.isArray(saved.segs)) return auto.map(s => Object.assign({}, s));
    return saved.segs.map(s => Object.assign({}, auto.find(a => a.key === s.key) || {}, s));
  }

  // Drag one edge to time t (seconds). Clock-driven parts move as a whole.
  function moveEdge(segs, i, edge, t, total) {
    const s = segs[i], prev = segs[i - 1], next = segs[i + 1];
    const lo = prev ? prev.t1 : 0, hi = next ? next.t0 : total;
    if (s.locked) {
      const dur = s.t1 - s.t0; let t0 = edge === "t0" ? t : t - dur;
      t0 = Math.max(lo, Math.min(hi - dur, t0)); s.t0 = t0; s.t1 = t0 + dur;
    } else if (edge === "t0") s.t0 = Math.max(lo, Math.min(s.t1 - 30, t));
    else s.t1 = Math.min(hi, Math.max(s.t0 + 30, t));
  }

  // What was happening at second t: { seg, slot } (slot only for clock-driven parts).
  function at(segs, plan, t) {
    const s = segs.find(s => t >= s.t0 && t < s.t1);
    if (!s) return null;
    let slot = null;
    if (s.locked && s.blockIndex != null) {
      const tl = P().blockTimeline(plan.blocks[s.blockIndex]) || [];
      slot = tl.find(k => t - s.t0 >= k.t0 && t - s.t0 < k.t1) || null;
    }
    return { seg: s, slot };
  }

  const api = { planSec, guessV0, guessV1, applySaved, moveEdge, at, VERSION: "v1" };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LessonParts = api;
})(typeof self !== "undefined" ? self : this);
