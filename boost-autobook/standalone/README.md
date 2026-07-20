# Standalone History Bookmarklet

A no-extension version of the History dashboard: a bookmarklet that runs on
`app.boostapp.co.il` (using the visitor's own logged-in session — no shared
credentials, no server, no hosting required) and opens the same dashboard
(stats, streaks, badges, charts, story mode, compare view) from `history.js`
in a new tab.

## Why this exists

A plain link on another domain can't read someone's BoostApp login — that's
enforced by the browser's same-origin policy, not something code can route
around. A bookmarklet sidesteps this because it executes *in the BoostApp
page's own origin* when clicked, so `fetch()` calls to `ClassHistory.php`
carry the session cookie automatically, exactly like the extension's
background tab injection does today.

## Files

- **`install-history-page.html`** — the file to send people. Open it (double-click,
  no server needed), drag the green button to the bookmarks bar, done. Also has a
  "paste into console" fallback for browsers that mishandle giant bookmarklet URLs.
- `fetch-logic.js` — source of the part that runs on the BoostApp page: walks
  `ClassHistory.php` backward one month at a time (same logic as
  `background.js`'s `fetchHistoryBackwardInPage`), extracts the signed-in
  person's name/photo from `#clientHeaderId`, then opens a new tab.
- `render-engine.js` — `history.js`, patched so `boot()`/`loadAndRender()`
  read `window.__BOOST_STANDALONE_*` globals instead of messaging a
  background service worker. Diff is 6 small surgical edits — see
  `build_bookmarklet.py`'s `replacements` list for the exact before/after.
- `style.css`, `body.html` — extracted verbatim from `history.html`'s
  `<style>` block and `<body>` markup (icon `<img>` swapped for an emoji, since
  a relative `icons/...` path would 404 against `app.boostapp.co.il`).
- `bookmarklet-full.js` — the fully assembled bookmarklet payload (~170KB
  unminified) before HTML-attribute-escaping.
- `build_bookmarklet.py`, `assemble_bookmarklet.py` — regenerate everything
  from the live `history.js`/`history.html` whenever those change. Run in
  order: `build_bookmarklet.py` then `assemble_bookmarklet.py`.

## Known trade-offs vs. the extension

- **No caching** — every click re-walks up to 36 months from scratch
  (stops after 3 empty months in a row, same as the extension). Typically a
  few seconds to ~20s depending on account age.
- **No subscription/plan-balance insight** — the "you have N sessions left"
  highlight needs an extra authenticated API call
  (`ClientActivity.php` → `getClientActivitiesForHomePage`) that wasn't
  ported over to keep the fetch logic simple and low-risk. `computeHighlights`
  already degrades gracefully to a streak-based highlight when subscription
  data is absent, so this isn't a hard error — just one fewer card.
  (`content.js`'s `fetchSubscriptions()` has the exact call shape if this
  gets added later.)
- **Studio-specific**: `getUrl` defaults to Training Harmony's public token
  (`6284d298e4b18`, from `background.js`'s `DEFAULT_CONFIG`), auto-overridden
  by a `?GetUrl=...` query param on the current page if present. Fine for
  anyone booking at the same studio; would need a different default (or a
  prompt) to hand this to someone at a different BoostApp-powered studio.
- **"Resync"/"Refresh" buttons** are relabeled to a plain alert telling the
  person to close the tab and click the bookmark again, since there's no
  backing store here to actually resync against.
- **Language preference doesn't persist** across opens — it's re-detected
  from the BoostApp page's `<html lang>` each time (falls back to English).

## Validated

Both the raw script and the HTML-attribute-escaped-then-decoded bookmarklet
pass `node --check`. A JSDOM smoke test (`smoke_test.js`, not shipped) fed
synthetic records through the patched `boot()` and confirmed: the dashboard
renders real stats/badges/persona (not the empty-state), Story and Compare
views switch without errors, and the Refresh/Resync/language-switch handlers
all fire cleanly (including a live RTL re-render on switching to Hebrew).
Not verified live against `app.boostapp.co.il` itself — worth a real test run
before sending to someone else.
