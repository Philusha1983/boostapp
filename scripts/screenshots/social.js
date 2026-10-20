#!/usr/bin/env node
// Open Graph / GitHub social card, 1200x630.
//
//   node scripts/screenshots/social.js   ->  docs/assets/social-preview.png
//
// Tracked in git (the site and GitHub both point at it), so regenerate it
// whenever the mark or the tagline changes.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const OUT  = path.join(REPO, "docs", "assets", "social-preview.png");
const LOGO = path.join(REPO, "docs", "assets", "logo128.png");

function fontCss() {
  return [400, 500, 700].map(w => {
    const f = path.join(HERE, "fonts", `rubik-latin-${w}-normal.woff2`);
    const b64 = fs.readFileSync(f).toString("base64");
    return `@font-face{font-family:'Rubik';font-style:normal;font-weight:${w};` +
           `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join("\n");
}

(async () => {
  const logo = fs.readFileSync(LOGO).toString("base64");
  const html = `<!doctype html><meta charset="utf-8"><style>
${fontCss()}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Rubik',system-ui,sans-serif;
     background:radial-gradient(130% 120% at 88% 8%,#0C251E 0%,#0D1513 58%,#0B1211 100%);
     color:#E7EEEC;padding:84px}
.rule-top{position:absolute;inset:0 0 auto 0;height:7px;background:#00E0A0}
.head{display:flex;align-items:center;gap:36px}
.head img{width:104px;height:104px;border-radius:24px;display:block}
h1{font-size:62px;font-weight:700;letter-spacing:-.02em}
p.tag{margin-top:40px;font-size:30px;line-height:1.42;font-weight:400;color:#9FB3AC;max-width:20ch}
.chips{display:flex;gap:18px;margin-top:44px}
.chip{border:1px solid #243330;background:#111D1A;border-radius:999px;
      padding:13px 26px;font-size:20px;font-weight:500;color:#B9C9C3}
.foot{position:absolute;left:84px;right:84px;bottom:58px;border-top:1px solid #26332F;
      padding-top:26px;display:flex;justify-content:space-between;font-size:21px}
.foot .a{color:#00A87A} .foot .b{color:#8B9C96}
</style>
<div class="rule-top"></div>
<div class="head"><img src="data:image/png;base64,${logo}"><h1>Auto-Book</h1></div>
<p class="tag">Your BoostApp classes, booked the second registration opens.</p>
<div class="chips">
  <div class="chip">Free &amp; open source</div>
  <div class="chip">Chrome · Manifest V3</div>
  <div class="chip">5 languages · RTL</div>
</div>
<div class="foot"><span class="a">philusha1983.github.io/boostapp</span>
<span class="b">github.com/Philusha1983/boostapp</span></div>`;

  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: OUT });
  console.log(path.relative(REPO, OUT));
  await browser.close();
})();
