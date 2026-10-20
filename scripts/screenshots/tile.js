#!/usr/bin/env node
// Chrome Web Store small promo tile: 440x280.
//
//   node scripts/screenshots/tile.js
//
// Output: docs/assets/store-tile-440x280.png (gitignored, like the shots)

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const OUTDIR = path.join(REPO, "docs", "assets");
const ICON = path.join(REPO, "boost-autobook", "icons", "icon128.png");

function fontCss() {
  return [400, 500, 700].map(w => {
    const f = path.join(HERE, "fonts", `rubik-latin-${w}-normal.woff2`);
    const b64 = fs.readFileSync(f).toString("base64");
    return `@font-face{font-family:'Rubik';font-style:normal;font-weight:${w};` +
           `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join("\n");
}

(async () => {
  const icon = fs.readFileSync(ICON).toString("base64");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
*{margin:0;padding:0;box-sizing:border-box}
body{width:440px;height:280px;overflow:hidden;font-family:'Rubik',system-ui,sans-serif;
     background:radial-gradient(120% 130% at 20% 0%,#123a2c 0%,#0a1512 55%,#070d0b 100%);
     display:flex;flex-direction:column;justify-content:center;padding:0 36px;color:#fff}
img{width:64px;height:64px;border-radius:14px}
h1{margin-top:20px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
p{margin-top:12px;font-size:15px;line-height:1.45;color:#a8c4b8}
.rule{width:44px;height:4px;border-radius:2px;background:#2fd48f;margin-top:18px}
</style></head><body>
<img src="data:image/png;base64,${icon}">
<h1>Auto-Book</h1>
<p>Books your group fitness classes the second registration opens.</p>
<div class="rule"></div>
</body></html>`;

  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  const out = path.join(OUTDIR, "store-tile-440x280.png");
  await p.screenshot({ path: out });
  console.log(path.relative(REPO, out));
  await browser.close();
})();
