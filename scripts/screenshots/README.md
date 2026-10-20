# Marketing screenshots

Renders the real popup against invented data and writes the images the README
and the Chrome Web Store listing use.

```bash
node scripts/screenshots/render.js              # all views, README size
node scripts/screenshots/render.js slots        # one view
node scripts/screenshots/render.js all store    # 1280x800, for the store listing
```

Views: `slots`, `upcoming`, `subscription`, `settings` →
`docs/assets/popup.png`, `popup-upcoming.png`, `popup-subscription.png`,
`popup-settings.png` (and `-store.png` in store mode, which is gitignored —
regenerate it when you submit).

Requires `playwright` with Chromium (`npx playwright install chromium`).

## Why render instead of screenshotting

A real screenshot carries real data: the signed-in member's name and photo, and
the names of coaches who never agreed to appear in a public README. Retouching
that out is manual and easy to get wrong — the first two attempts at it here
each missed a name, once in the header and once mid-sentence inside a lesson
line. Rendering from fixtures makes the problem structural rather than careful:
there is no real data in the pipeline to miss.

It also means the images can be regenerated after a UI change instead of
quietly rotting, and that a view can show a state a real account can't produce
on demand — a registration window 11 minutes from opening, for instance.

## How it works

The popup is an ordinary web page. Only two things stand between it and a
headless browser:

**The `chrome.*` APIs.** All 33 of the popup's commands go through a single
`sendMessage` call (`popup.js`), so the shim in `render.js` is one switch
statement. `chrome.storage.local` is a plain object.

**Rubik.** `popup.html` pulls it from Google Fonts. The harness inlines the
same four weights from `fonts/` as data URIs and blocks the network request, so
the render matches a real install rather than falling back to a system sans.
The font files live here rather than in `boost-autobook/`, because `build.sh`
would otherwise ship them inside the extension zip.

## Determinism

`render.js` pins the page clock to `DEMO_NOW` (which must match the constant in
`fixtures.js`) and sets the timezone to Asia/Jerusalem. Output is byte-identical
across runs, so a regenerated screenshot only shows up in `git diff` when the UI
actually changed.

The fixtures are also internally consistent: each slot's `openAt` is exactly the
studio's 72-hour window before its `startAt`, so the countdown agrees with the
dates printed beside it.

## Gotchas

**Don't poll inside the page.** The pinned clock freezes page timers, so
`page.waitForFunction` never ticks. Poll from Node, as the untranslated-key
check does.

**`walkthrough.js` localises its footer link after boot.** Screenshot too early
and you capture the raw key `tour_replay`. The harness fails the run if any leaf
element's entire label is snake_case, and retries until it localises.

**Fixture shapes come from a real `exportState` dump**, not from reading
`background.js`. If you add a field the popup reads, take the shape from an
export rather than guessing — `subscription.items[].monthly.remaining` and
`plan.byRule[ruleId]` are both easy to get subtly wrong.
