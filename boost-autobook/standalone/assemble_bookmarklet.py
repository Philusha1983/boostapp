import json, html, pathlib

OUT = pathlib.Path("/sessions/cool-determined-babbage/mnt/outputs/standalone")

engine_js = (OUT / "render-engine.js").read_text(encoding="utf-8")
style_css = (OUT / "style.css").read_text(encoding="utf-8")
body_html = (OUT / "body.html").read_text(encoding="utf-8")
fetch_logic = (OUT / "fetch-logic.js").read_text(encoding="utf-8")

# Splice the three big chunks in as JSON-encoded (= valid JS) string literals.
full_js = fetch_logic
subs = {
    "__BOOST_STYLE_CSS__": json.dumps(style_css),
    "__BOOST_BODY_HTML__": json.dumps(body_html),
    "__BOOST_ENGINE_JS__": json.dumps(engine_js),
}
for token, literal in subs.items():
    count = full_js.count(token)
    if count != 1:
        raise SystemExit(f"expected 1 occurrence of {token}, found {count}")
    full_js = full_js.replace(token, literal)

(OUT / "bookmarklet-full.js").write_text(full_js, encoding="utf-8")
print("full_js bytes:", len(full_js))

bookmarklet_uri = "javascript:" + full_js
print("bookmarklet_uri bytes:", len(bookmarklet_uri))

# HTML-attribute-escape for embedding as href="...": escape & first, then ".
href_value = bookmarklet_uri.replace("&", "&amp;").replace('"', "&quot;")
(OUT / "bookmarklet-href.txt").write_text(href_value, encoding="utf-8")
print("href_value bytes:", len(href_value))

install_html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Install: Your Class History Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; background:#f5f7f6; color:#1f2a17; margin:0; padding:0; }
  main { max-width:640px; margin:0 auto; padding:40px 24px 80px; }
  h1 { font-size:22px; margin-bottom:4px; }
  .sub { color:#6b7280; font-size:14px; margin-bottom:32px; }
  .step { background:#fff; border:1px solid #e3e6e0; border-radius:14px; padding:20px 22px; margin-bottom:18px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
  .step .n { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:#00a87a; color:#fff; font-weight:700; font-size:13px; margin-inline-end:10px; }
  .step h2 { display:flex; align-items:center; font-size:15px; margin:0 0 10px; }
  .bookmarklet-btn { display:inline-block; background:#00e0a0; color:#063a2b !important; font-weight:700; text-decoration:none; padding:12px 22px; border-radius:10px; font-size:14px; cursor:grab; border:2px dashed #063a2b; }
  .bookmarklet-btn:active { cursor:grabbing; }
  .hint { font-size:12.5px; color:#6b7280; margin-top:10px; line-height:1.6; }
  code { background:#eef0ec; padding:2px 6px; border-radius:5px; font-size:12.5px; }
  textarea { width:100%; height:90px; box-sizing:border-box; border-radius:8px; border:1px solid #e3e6e0; padding:10px; font:11px/1.5 ui-monospace, monospace; color:#444; resize:vertical; }
  button.copy { margin-top:8px; background:#063a2b; color:#00e0a0; border:none; border-radius:8px; padding:8px 14px; font-size:12.5px; font-weight:600; cursor:pointer; }
  .warn { background:#fff8e6; border:1px solid #e6b800; border-radius:10px; padding:12px 16px; font-size:12.5px; margin-top:24px; }
</style>
</head>
<body>
<main>
  <h1>Your Class History Dashboard</h1>
  <div class="sub">No app or extension to install &mdash; just a bookmark. Works entirely in your own browser, using your own login.</div>

  <div class="step">
    <h2><span class="n">1</span> Drag this button to your bookmarks bar</h2>
    <a class="bookmarklet-btn" href="__BOOKMARKLET_HREF__">&#128202; My Class History</a>
    <div class="hint">If your bookmarks bar is hidden, show it first (in Chrome: <code>Ctrl/Cmd+Shift+B</code>). Then drag the green button above up into that bar.</div>
  </div>

  <div class="step">
    <h2><span class="n">2</span> Log in to your studio account</h2>
    <div class="hint">Go to your BoostApp page and make sure you're signed in, same as normal.</div>
  </div>

  <div class="step">
    <h2><span class="n">3</span> Click the bookmark</h2>
    <div class="hint">While on the BoostApp site, click "&#128202; My Class History" in your bookmarks bar. It reads your own class history (using your own logged-in session) and opens your dashboard in a new tab &mdash; stats, streaks, badges, charts, all of it.</div>
  </div>

  <div class="warn">
    <b>Can't drag bookmarklets in your browser?</b> Open DevTools console on the BoostApp page (<code>F12</code>, or <code>Cmd+Opt+J</code> / <code>Ctrl+Shift+J</code>), paste the script below, and press Enter:
    <textarea id="rawScript" readonly>__RAW_SCRIPT__</textarea>
    <button class="copy" onclick="navigator.clipboard.writeText(document.getElementById('rawScript').value)">Copy script</button>
  </div>
</main>
</body>
</html>
"""

raw_script_for_textarea = html.escape(full_js)
install_html = install_html.replace("__BOOKMARKLET_HREF__", href_value)
install_html = install_html.replace("__RAW_SCRIPT__", raw_script_for_textarea)

(OUT / "install-history-page.html").write_text(install_html, encoding="utf-8")
print("install_html bytes:", len(install_html))
print("DONE")
