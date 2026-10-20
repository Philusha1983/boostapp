#!/usr/bin/env node
// Render every icon PNG from the two SVG masters in assets-src/.
//
//   node scripts/icons/build-icons.js
//
// One source of truth: nine hand-exported PNGs drift, one script does not.
// Honours CHROME_PATH, like the screenshot scripts.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const SRC  = path.join(REPO, "assets-src");
const ICONS = path.join(REPO, "boost-autobook", "icons");
const DOCS  = path.join(REPO, "docs", "assets");

// [source svg, output path, size]
const JOBS = [
  ["icon.svg",          path.join(ICONS, "icon16.png"),   16],
  ["icon.svg",          path.join(ICONS, "icon32.png"),   32],
  ["icon.svg",          path.join(ICONS, "icon48.png"),   48],
  ["icon.svg",          path.join(ICONS, "icon128.png"), 128],
  ["icon.svg",          path.join(ICONS, "icon192.png"), 192],
  ["icon.svg",          path.join(ICONS, "icon512.png"), 512],
  ["icon.svg",          path.join(ICONS, "icon.png"),    128],
  ["icon-maskable.svg", path.join(ICONS, "appicon192.png"), 192],
  ["icon-maskable.svg", path.join(ICONS, "appicon512.png"), 512],
  // The site uses its own copies; generate them here so they cannot diverge
  // from the extension's (logo128.png was previously a byte copy of icon128).
  ["icon.svg",          path.join(DOCS, "logo128.png"), 128],
  ["icon.svg",          path.join(DOCS, "logo192.png"), 192],
];

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  for (const [svgName, out, size] of JOBS) {
    const svg = fs.readFileSync(path.join(SRC, svgName), "utf8");
    const page = await browser.newPage({
      viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;overflow:hidden}
       svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      { waitUntil: "load" });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: true });
    await page.close();
    console.log(`${path.relative(REPO, out)}  ${size}x${size}`);
  }
  await browser.close();
})();
