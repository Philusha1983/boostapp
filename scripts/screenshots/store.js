#!/usr/bin/env node
// Chrome Web Store screenshots: 1280x800, the popup framed on a captioned card.
//
//   node scripts/screenshots/store.js
//
// Why this exists rather than `render.js ... store`: that mode renders the
// popup into a 640x400 viewport at deviceScaleFactor 2. The popup needs 660
// CSS px of width and ~610 of height, so the result is a 2x zoom crop of its
// top-left corner - the toolbar toggle and the whole lower half fall outside
// the frame. Fixing it inside render.js would have meant changing the viewport
// that the README images also depend on, so the framing lives here instead and
// render.js is untouched.
//
// This script shells out to render.js for the actual popup rendering (so the
// fixtures, the chrome.* shim, the pinned clock and the untranslated-key check
// all stay in one place), then composes each PNG onto a captioned 1280x800
// canvas.
//
// Output: docs/assets/store-<n>-<view>.png

const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const OUTDIR = path.join(REPO, "docs", "assets");

// Order matters: this is the order they appear in the listing, and the first
// one is the thumbnail a browsing user sees.
const SHOTS = [
  { src: "popup.png",              out: "store-1-slots",        title: "Your classes, booked while you sleep",
    sub: "Tick the classes you attend every week. Auto-Book registers you the instant your studio's window opens." },
  { src: "popup-upcoming.png",     out: "store-2-upcoming",     title: "Always know what's booked",
    sub: "Everything coming up, with the registration window counting down beside it." },
  { src: "popup-subscription.png", out: "store-3-subscription", title: "Your subscription at a glance",
    sub: "Entries left, daily cap and validity, read straight from your studio and kept in sync." },
  { src: "popup-settings.png",     out: "store-4-settings",     title: "Five languages, and nothing leaves your browser",
    sub: "English, Hebrew, Russian, Ukrainian and Arabic with full RTL. No servers, no analytics, no account." },
];

function fontCss() {
  return [400, 500, 600, 700].map(w => {
    const f = path.join(HERE, "fonts", `rubik-latin-${w}-normal.woff2`);
    const b64 = fs.readFileSync(f).toString("base64");
    return `@font-face{font-family:'Rubik';font-style:normal;font-weight:${w};` +
           `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join("\n");
}

const page = (shot, imgB64, css) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
${css}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:800px;overflow:hidden;font-family:'Rubik',system-ui,sans-serif;
     background:radial-gradient(120% 120% at 15% 0%,#123a2c 0%,#0a1512 55%,#070d0b 100%);
     display:flex;align-items:center;gap:56px;padding:0 72px;color:#fff}
.copy{flex:1 1 0;min-width:0}
h1{font-size:46px;line-height:1.12;font-weight:700;letter-spacing:-.015em}
p{margin-top:22px;font-size:21px;line-height:1.5;font-weight:400;color:#a8c4b8;max-width:30ch}
.rule{width:64px;height:5px;border-radius:3px;background:#2fd48f;margin-top:30px}
.shot{flex:0 0 auto;border-radius:18px;overflow:hidden;
      box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
.shot canvas{display:block}
</style></head><body>
<div class="copy"><h1>${shot.title}</h1><p>${shot.sub}</p><div class="rule"></div></div>
<div class="shot" id="shot"></div>
<script>
// Several popup views (Upcoming with one booking, Subscription) leave a large
// empty panel below the content. Baked into a 1280x800 store shot that reads
// as a broken screenshot, so trim the dead area off the bottom before framing:
// scan rows upward until one differs from the panel's own background colour.
window.ready = (async () => {
  const img = new Image();
  img.src = "data:image/png;base64,${imgB64}";
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  const at = (px, py) => { const i = (py * w + px) * 4; return [d[i], d[i+1], d[i+2]]; };
  // Reference colour: a point inside the empty panel, just above the bottom edge.
  const [br, bg, bb] = at(Math.floor(w / 2), h - 6);
  const differs = py => {
    for (let px = 8; px < w - 8; px += 3) {
      const [r, g, b] = at(px, py);
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > 24) return true;
    }
    return false;
  };
  let last = h - 1;
  while (last > h * 0.35 && !differs(last)) last--;
  const pad = Math.round(28 * (w / 660));           // keep the panel's own breathing room
  const cut = Math.min(h, last + pad);
  const o = document.createElement("canvas");
  o.width = w; o.height = cut;
  o.getContext("2d").drawImage(c, 0, 0, w, cut, 0, 0, w, cut);
  // The source is rendered at deviceScaleFactor 2, so these are device pixels.
  // One width for the whole set keeps the four shots consistent; the height
  // then falls out of however much content survived the trim.
  const scale = Math.min(640 / w, 712 / cut);
  o.style.width = (w * scale) + "px";
  o.style.height = (cut * scale) + "px";
  document.getElementById("shot").appendChild(o);
})();
</script>
</body></html>`;

(async () => {
  // Regenerate the natural-size popup PNGs. Deterministic, so this is a no-op
  // in git unless the UI actually changed.
  console.log("rendering popup views via render.js ...");
  execFileSync(process.execPath, [path.join(HERE, "render.js"), "all"], { stdio: "inherit" });

  const css = fontCss();
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  for (const shot of SHOTS) {
    const srcPath = path.join(OUTDIR, shot.src);
    if (!fs.existsSync(srcPath)) { console.error(`!! missing ${shot.src}`); process.exit(1); }
    const b64 = fs.readFileSync(srcPath).toString("base64");
    await p.setContent(page(shot, b64, css), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => window.ready);
    const out = path.join(OUTDIR, `${shot.out}.png`);
    await p.screenshot({ path: out });
    console.log(path.relative(REPO, out));
  }

  await browser.close();
})();
