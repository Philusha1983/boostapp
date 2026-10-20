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

// Body figure for the muscle map (experimental). Original flat SVG, front +
// back, built from left-half point lists mirrored around x=100 and smoothed
// (Catmull-Rom → cubic Bézier). The female figure is the same shapes warped
// (narrower shoulders/waist, wider hips, slimmer arms) so both stay in sync.
// Every muscle is its own <path data-m="group"> so the page can colour it,
// hover it, and link it to exercises. Colours come from CSS variables.
(function (root) {
  "use strict";
  const C = 100;                                       // centre line, viewBox 0 0 200 440
  // ---- shapes (left half; x < 100) --------------------------------------
  const BODY = [[100,56],[91,58],[90,70],[80,76],[66,81],[58,86],[57,98],[62,118],[66,140],[70,168],[70,190],[66,210],
    [63,236],[63,266],[66,300],[70,326],[67,346],[67,372],[72,400],[75,414],[69,424],[73,431],[94,431],[93,414],[92,396],
    [94,362],[92,336],[94,320],[97,286],[98,250],[100,238]];
  const ARM = [[66,82],[56,85],[47,93],[43,108],[41,130],[38,150],[37,168],[33,190],[30,212],[28,232],[25,244],[26,258],
    [32,265],[38,259],[39,245],[40,232],[45,206],[50,182],[53,168],[57,146],[60,126],[64,104]];
  const FRONT = {
    traps: [[91,66],[80,74],[69,80],[82,82],[91,77]],
    shoulders: [[66,83],[56,86],[49,94],[46,107],[48,121],[54,115],[60,103],[66,93]],
    chest: [[98,89],[84,86],[71,90],[64,102],[65,116],[74,126],[88,128],[98,124]],
    biceps: [[58,118],[49,125],[44,142],[44,160],[49,165],[56,150],[59,133]],
    forearms: [[46,171],[41,179],[36,196],[33,216],[32,228],[38,230],[42,212],[47,193],[51,175]],
    abs: [[98,133],[87,134],[86,160],[87,190],[91,206],[98,212]],
    obliques: [[84,134],[73,139],[71,160],[72,184],[78,200],[85,196],[84,165]],
    abductors: [[68,206],[64,224],[63,244],[67,240],[71,222]],
    quads: [[73,218],[67,240],[66,270],[69,298],[76,318],[86,318],[92,300],[93,270],[89,240],[81,224]],
    adductors: [[97,238],[93,248],[94,276],[97,292],[99,262]],
    calves: [[71,340],[69,360],[71,385],[76,398],[79,380],[79,352]],
  };
  const BACK = {
    traps: [[99,58],[91,62],[85,72],[69,82],[79,90],[89,104],[95,126],[99,138]],
    shoulders: FRONT.shoulders,
    upperBack: [[80,92],[68,99],[65,112],[73,120],[85,115],[87,101]],
    triceps: [[58,116],[49,123],[44,140],[44,160],[50,165],[56,148],[59,130]],
    forearms: FRONT.forearms,
    lats: [[66,119],[65,135],[69,158],[75,182],[86,186],[95,168],[90,146],[80,128]],
    lowerBack: [[98,148],[92,155],[90,180],[91,203],[98,207]],
    abductors: [[87,204],[73,205],[67,214],[71,221],[85,213]],
    glutes: [[98,213],[86,210],[73,214],[66,229],[67,250],[76,262],[90,262],[98,254]],
    hamstrings: [[71,266],[67,286],[71,312],[78,328],[88,326],[94,306],[94,280],[90,266]],
    calves: [[71,338],[68,354],[70,376],[76,390],[84,386],[90,363],[90,344],[84,336]],
  };
  // Detail lines (non-interactive), left half.
  const FRONT_LINES = [[[87,152],[98,152]], [[87,171],[98,171]], [[87,190],[98,190]]];
  const BACK_LINES = [];
  // ---- female warp ---------------------------------------------------------
  const FEMALE_W = [[0,.94],[60,.9],[84,.84],[112,.86],[140,.8],[168,.76],[194,.88],[216,1.07],[248,1.08],[290,1.01],[340,.94],[440,.93]];
  function wAt(y) {
    for (let i = 1; i < FEMALE_W.length; i++) if (y <= FEMALE_W[i][0]) {
      const [y0, a] = FEMALE_W[i - 1], [y1, b] = FEMALE_W[i]; return a + (b - a) * (y - y0) / (y1 - y0);
    }
    return 1;
  }
  const ARM_SHIFT = (C - 57) * (1 - .84);               // arms follow the narrower shoulders
  // "neutral" (not specified) sits halfway between the two builds, no hair.
  const AMT = { male: 0, female: 1, neutral: .5 };
  const amt = sex => AMT[sex] ?? AMT.neutral;
  const warpBody = (sex) => ([x, y]) => [C + (x - C) * (1 + (wAt(y) - 1) * amt(sex)), y];
  const warpArm = (sex) => ([x, y]) => [57 + (x - 57) * (1 - .12 * amt(sex)) + ARM_SHIFT * amt(sex), y];
  const ARMISH = new Set(["shoulders", "biceps", "triceps", "forearms"]);
  // ---- geometry helpers ---------------------------------------------------
  const mirror = pts => pts.map(([x, y]) => [2 * C - x, y]);
  const f = n => Math.round(n * 10) / 10;
  function smooth(pts, closed = true, t = 0.5) {
    const n = pts.length; if (n < 3) return "";
    const P = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3];
      d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
    }
    return d + (closed ? "Z" : "");
  }
  function outline(sex) {
    const half = BODY.map(warpBody(sex));
    return smooth(half.concat(mirror(half).reverse().slice(1, -1)));
  }
  function head(sex, side) {
    const face = `<ellipse class="mm-body" cx="100" cy="36" rx="16.5" ry="20"/>`;
    if (sex !== "female") return face;
    // Simple hair (cap + bun), enough to read as a female figure without a face.
    if (side === "back") return face +
      `<path class="mm-hair" d="M83.2,36 C82.5,13 117.5,13 116.8,36 C117,49 111,56 100,56 C89,56 83,49 83.2,36Z"/>` +
      `<ellipse class="mm-hair" cx="100" cy="52" rx="8.5" ry="7"/>`;
    return `<ellipse class="mm-hair" cx="100" cy="14" rx="8.5" ry="6.5"/>` + face +
      `<path class="mm-hair" d="M83,42 C79,12 121,12 117,42 C115,31 108,25 100,25 C92,25 85,31 83,42Z"/>`;
  }
  // svg(side, sex, { idPrefix }) → string
  function svg(side, sex, opt = {}) {
    const muscles = side === "back" ? BACK : FRONT, lines = side === "back" ? BACK_LINES : FRONT_LINES;
    const wb = warpBody(sex), wa = warpArm(sex);
    const armL = ARM.map(wa), armR = mirror(armL);
    let g = `<path class="mm-body" d="${outline(sex)}"/><path class="mm-body" d="${smooth(armL)}"/><path class="mm-body" d="${smooth(armR)}"/>`;
    g += head(sex, side);
    for (const [m, pts] of Object.entries(muscles)) {
      const w = ARMISH.has(m) ? wa : wb, L = pts.map(w);
      g += `<path class="mm-m" data-m="${m}" d="${smooth(L)} ${smooth(mirror(L))}"/>`;
    }
    for (const ln of lines) { const L = ln.map(wb); g += `<path class="mm-ln" d="M${L.map(p => p.map(f).join(",")).join("L")}M${mirror(L).map(p => p.map(f).join(",")).join("L")}"/>`; }
    return `<svg class="mm-fig" viewBox="0 0 200 440" role="img" aria-label="${side} view"${opt.title ? ` data-title="${opt.title}"` : ""}>${g}</svg>`;
  }
  const api = { svg, FRONT: Object.keys(FRONT), BACK: Object.keys(BACK) };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BodyFigure = api;
})(typeof self !== "undefined" ? self : this);
