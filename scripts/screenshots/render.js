#!/usr/bin/env node
// Marketing screenshots, rendered from the real popup against invented data.
//
//   node scripts/screenshots/render.js            # every view, README width
//   node scripts/screenshots/render.js slots      # one view
//   node scripts/screenshots/render.js all store  # 1280x800, for the Web Store
//
// The popup is an ordinary web page: only the chrome.* APIs need standing in
// for, and all 33 of its commands go through one sendMessage call, so the shim
// below is small. Fixtures live in fixtures.js and contain no real data.
//
// Output: docs/assets/popup-<view>.png (and -store.png in store mode).

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..", "..");
const EXT = path.join(REPO, "boost-autobook");
const OUTDIR = path.join(REPO, "docs", "assets");
// Read from the real manifest: a hard-coded version here silently rots the
// footer in every screenshot one release after someone bumps it.
const MANIFEST = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));

// Pinned so a view renders identically on every run, and so the countdowns
// agree with the dates beside them. Must match DEMO_NOW in fixtures.js.
const DEMO_NOW = "2026-10-20T10:49:00+03:00";

const VIEWS = {
  slots:        { tab: "slots",        file: "popup" },
  upcoming:     { tab: "upcoming",     file: "popup-upcoming" },
  subscription: { tab: "subscription", file: "popup-subscription" },
  settings:     { tab: "settings",     file: "popup-settings" },
};

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
               ".png": "image/png", ".json": "application/json",
               ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

function serve(root) {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found"); return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r({ srv, port: srv.address().port })));
}

// popup.html pulls Rubik from Google Fonts. Inline the same faces as data URIs so
// the render matches a real install, with no network and nothing added to the
// extension folder (build.sh would otherwise ship it).
function fontCss() {
  return [400, 500, 600, 700].map(w => {
    const f = path.join(HERE, "fonts", `rubik-latin-${w}-normal.woff2`);
    const b64 = fs.readFileSync(f).toString("base64");
    return `@font-face{font-family:'Rubik';font-style:normal;font-weight:${w};` +
           `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join("\n");
}

const SHIM = `
${fs.readFileSync(path.join(HERE, "fixtures.js"), "utf8")}
(() => {
  const F = window.__BSAB_FIXTURES__;
  const store = {
    bsab_seen_version: "99.0.0",   // suppresses the first-run tour and What's New
    bsab_tour_done: true,
    bsab_auth: F.auth, bsab_subscription: F.subscription,
    bsab_registrations: F.registrations, bsab_client: F.client,
  };
  const RESP = (msg) => {
    switch (msg && msg.cmd) {
      case "getState": return {
        config: F.config, targets: F.targets, auth: F.auth,
        subscription: F.subscription, registrations: F.registrations,
        client: F.client, studioWindow: F.studioWindow,
      };
      case "verifyAuth":         return { loggedIn: true };
      case "getUpdateInfo":      return { updateAvailable: false };
      case "getScheduleChanges": return { changes: [], pending: 0 };
      case "getSchedule":        return { schedule: [], ok: true };
      case "getPlan":            return F.plan;
      // muscleLesson() checks MUSCLE.ok and then reads MUSCLE.lessons, so a bare
      // {ok:true} throws. Mirror the real response shape.
      case "getMuscleLessons":   return { ok: true, lessons: [], body: { sex: "neutral" } };
      case "fitbitStatus":       return { connected: false };
      case "getHistory":         return { records: [], meta: {} };
      default:                   return { ok: true };
    }
  };
  const cbOrPromise = (val, cb) => { if (cb) { setTimeout(() => cb(val), 0); return; } return Promise.resolve(val); };
  window.chrome = {
    runtime: {
      sendMessage: (msg, cb) => cbOrPromise(RESP(msg), cb),
      getManifest: () => ({ version: ${JSON.stringify(MANIFEST.version)}, name: ${JSON.stringify(MANIFEST.name)} }),
      getURL: (p) => p,
      lastError: null,
    },
    storage: { local: {
      get: (keys, cb) => {
        const out = {};
        const list = keys == null ? Object.keys(store)
          : Array.isArray(keys) ? keys
          : typeof keys === "string" ? [keys] : Object.keys(keys);
        for (const k of list) if (k in store) out[k] = store[k];
        return cbOrPromise(out, cb);
      },
      set: (obj, cb) => { Object.assign(store, obj); return cbOrPromise(undefined, cb); },
      remove: (k, cb) => { (Array.isArray(k) ? k : [k]).forEach(x => delete store[x]); return cbOrPromise(undefined, cb); },
    } },
    tabs: { create: () => {} },
  };
})();
`;

// An untranslated key IS an element's whole label, so only flag leaf elements
// that are nothing but snake_case. An identifier quoted inside a sentence
// (googlehealth.activity_and_fitness) is legitimate and must not match.
const RAW_KEYS = () => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length || !el.offsetParent) continue;
    const t = (el.textContent || "").trim();
    if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(t)) out.push(t);
  }
  return out.slice(0, 3);
};

(async () => {
  const which = (process.argv[2] || "all").toLowerCase();
  const store = (process.argv[3] || "").toLowerCase() === "store";
  const list = which === "all" ? Object.keys(VIEWS) : [which];
  for (const v of list) if (!VIEWS[v]) { console.error("unknown view:", v, "- try:", Object.keys(VIEWS).join(", ")); process.exit(1); }

  fs.mkdirSync(OUTDIR, { recursive: true });
  const { srv, port } = await serve(EXT);
  const BASE = `http://127.0.0.1:${port}`;
  const css = fontCss();

  const browser = await chromium.launch();
  let failed = 0;

  for (const v of list) {
    const { tab, file } = VIEWS[v];
    const page = await browser.newPage({
      // A real Chrome popup caps at 600 CSS px tall; 610 leaves the last card a
      // clean bottom edge. Store shots use the size the listing requires.
      viewport: store ? { width: 640, height: 400 } : { width: 660, height: 610 },
      deviceScaleFactor: 2,
      timezoneId: "Asia/Jerusalem",
      locale: "en-GB",
    });
    await page.clock.setFixedTime(new Date(DEMO_NOW));
    await page.route("**://fonts.googleapis.com/**", r => r.abort());
    await page.route("**://fonts.gstatic.com/**", r => r.abort());
    await page.addInitScript(SHIM);

    const errors = [];
    page.on("pageerror", e => errors.push(String(e).split("\n")[0]));

    await page.goto(`${BASE}/popup.html`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: css });
    await page.evaluate(() => document.fonts.ready);
    // walkthrough.js localises the footer link after it boots. Don't poll for it:
    // the pinned clock freezes page timers, so waitForFunction would never tick.
    // A fixed wait plus a one-shot check is both simpler and actually reliable.
    await page.waitForTimeout(300);

    const sel = `.tab[data-tab="${tab}"]`;
    if (await page.$(sel)) { await page.click(sel); await page.waitForTimeout(400); }
    else { console.error(`!! ${v}: no tab ${sel}`); failed++; }

    // walkthrough.js localises its footer link after it boots, so a screenshot
    // taken too early catches the raw i18n key. Poll from Node, not the page:
    // the pinned clock freezes page timers, so waitForFunction never ticks.
    let raw = [];
    for (let i = 0; i < 40; i++) {
      raw = await page.evaluate(RAW_KEYS);
      if (!raw.length) break;
      await new Promise(r => setTimeout(r, 150));
    }
    if (raw.length) { console.error(`!! ${v}: untranslated key(s) on screen: ${raw.join(", ")}`); failed++; }

    const out = path.join(OUTDIR, `${file}${store ? "-store" : ""}.png`);
    await page.screenshot({ path: out });
    const rel = path.relative(REPO, out);
    console.log(errors.length ? `${rel}  (${errors.length} page error(s): ${errors[0]})` : rel);
    if (errors.length) failed++;
    await page.close();
  }

  await browser.close();
  srv.close();
  process.exit(failed ? 1 : 0);
})();
