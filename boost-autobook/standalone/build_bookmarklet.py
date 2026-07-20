import json, re, sys, pathlib

SRC = pathlib.Path("/sessions/cool-determined-babbage/mnt/boostapp/boost-autobook")
OUT = pathlib.Path("/sessions/cool-determined-babbage/mnt/outputs/standalone")
OUT.mkdir(parents=True, exist_ok=True)

history_js = (SRC / "history.js").read_text(encoding="utf-8")
history_html = (SRC / "history.html").read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# 1) Patch history.js: strip the 4 spots that talk to chrome.runtime, since in
# standalone mode the data is injected as window globals before this script
# runs, and there is no background service worker to message.
# ---------------------------------------------------------------------------
replacements = [
    (
        'let LANG = "en", CFG = { lang: "en", theme: "system" };',
        'let LANG = "en", CFG = (window.__BOOST_STANDALONE_CFG__ || { lang: "en", theme: "system" });'
    ),
    (
        'let ALL_RECORDS = [], META = {}, STATE = {};',
        'let ALL_RECORDS = (window.__BOOST_STANDALONE_RECORDS__ || []), META = (window.__BOOST_STANDALONE_META__ || {}), STATE = (window.__BOOST_STANDALONE_STATE__ || {});'
    ),
    (
        'async function loadAndRender() {\n'
        '  const res = await send({ cmd: "getHistory" });\n'
        '  ALL_RECORDS = (res && res.records) || [];\n'
        '  META = res || {};\n'
        '  setView(CURRENT_VIEW);\n'
        '}',
        'async function loadAndRender() {\n'
        '  setView(CURRENT_VIEW);\n'
        '}'
    ),
    (
        'async function boot() {\n'
        '  try {\n'
        '    const state = await send({ cmd: "getState" });\n'
        '    CFG = (state && state.config) || CFG;\n'
        '    STATE = state || {};\n'
        '  } catch (e) {}\n'
        '  applyLang(CFG.lang || "en");',
        'async function boot() {\n'
        '  applyLang(CFG.lang || "en");'
    ),
    (
        '  resyncBtn.addEventListener("click", async () => {\n'
        '    resyncBtn.disabled = true; resyncBtn.textContent = t("resyncing");\n'
        '    const res = await send({ cmd: "getHistory", resetBackfill: true });\n'
        '    ALL_RECORDS = (res && res.records) || []; META = res || {};\n'
        '    setView(CURRENT_VIEW);\n'
        '    resyncBtn.disabled = false; resyncBtn.textContent = t("resync");\n'
        '  });',
        '  resyncBtn.addEventListener("click", () => {\n'
        '    alert(LANG === "he" ? "כדי לרענן: סגרו כרטיסייה זו, חזרו לאתר הסטודיו ולחצו שוב על הסימנייה." : "To refresh: close this tab, go back to the studio site, and click the bookmark again.");\n'
        '  });'
    ),
    (
        '  langSelect.addEventListener("change", async (e) => {\n'
        '    const lang = e.target.value;\n'
        '    await send({ cmd: "updateConfig", config: { lang } });\n'
        '    CFG.lang = lang;\n'
        '    applyLang(lang);\n'
        '    populateShareTemplates();\n'
        '    setView(CURRENT_VIEW);\n'
        '  });',
        '  langSelect.addEventListener("change", (e) => {\n'
        '    const lang = e.target.value;\n'
        '    CFG.lang = lang;\n'
        '    applyLang(lang);\n'
        '    populateShareTemplates();\n'
        '    setView(CURRENT_VIEW);\n'
        '  });'
    ),
]

engine_js = history_js
for old, new in replacements:
    count = engine_js.count(old)
    if count != 1:
        print(f"!! Expected 1 match, found {count} for snippet starting: {old[:60]!r}", file=sys.stderr)
        sys.exit(1)
    engine_js = engine_js.replace(old, new)

# The standalone `send` helper is no longer called anywhere; drop its definition.
send_def = 'function send(msg) { return new Promise(res => chrome.runtime.sendMessage(msg, res)); }\n'
if send_def not in engine_js:
    print("!! send() definition not found as expected", file=sys.stderr)
    sys.exit(1)
engine_js = engine_js.replace(send_def, '')

(OUT / "render-engine.js").write_text(engine_js, encoding="utf-8")
print("engine_js bytes:", len(engine_js))

# ---------------------------------------------------------------------------
# 2) Extract the <style>...</style> block from history.html
# ---------------------------------------------------------------------------
m = re.search(r"<style>(.*?)</style>", history_html, re.S)
assert m, "style block not found"
style_css = m.group(1)
print("style_css bytes:", len(style_css))

# ---------------------------------------------------------------------------
# 3) Extract the <body>...</body> inner HTML up to (not including) the
# <script src="history.js"></script> tag, and swap the local icon <img> for
# an emoji so it doesn't 404 against app.boostapp.co.il.
# ---------------------------------------------------------------------------
m = re.search(r"<body>(.*?)<script src=\"history\.js\"></script>", history_html, re.S)
assert m, "body block not found"
body_html = m.group(1)
body_html = body_html.replace(
    '<img src="icons/icon48.png" width="22" height="22" alt="" style="border-radius:5px;display:block;">',
    '<span style="font-size:20px;line-height:1;">\U0001F4CA</span>'
)
assert "icons/" not in body_html, "a local icon reference survived"
print("body_html bytes:", len(body_html))

(OUT / "style.css").write_text(style_css, encoding="utf-8")
(OUT / "body.html").write_text(body_html, encoding="utf-8")

print("OK")
