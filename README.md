# BoostApp project

Chrome extension for auto-booking BoostApp group lessons, plus research notes.

- `boost-autobook/` — the extension (see its own README)
- `boost-autobook/standalone/` — extension-free history dashboard (bookmarklet)
- `scripts/build.sh` — builds the versioned release zip into `dist/`
- `CHANGELOG.md` — release notes, one section per version

## Versioning

`boost-autobook/manifest.json` `version` is the single source of truth (SemVer):
patch = fixes · minor = features · major = anything that changes stored user data
(bump `SCHEMA_VERSION` in `background.js` and add a migration in `migrateSchema()`).

## One-time setup (after creating the GitHub repo)

1. Publish this folder as a repo with GitHub Desktop (Add local repository → Publish).
2. Push the existing tags: in GitHub Desktop history, right-click won't do it — run
   `git push --tags` once, or use "Push origin" after enabling tag pushing.
3. Set `GITHUB_REPO` at the top of `boost-autobook/background.js` to `"owner/repo"`.
   This enables the daily update check + the popup's Feedback link.

## Releasing a new version

1. Bump `version` in `boost-autobook/manifest.json`.
2. Move the `[Unreleased]` notes in `CHANGELOG.md` into a new `[x.y.z] — date` section.
3. Commit, then tag: `git tag -a vX.Y.Z -m "vX.Y.Z"` and push with tags.
4. Pushing the tag triggers `.github/workflows/release.yml`, which builds the zip and
   creates the GitHub Release automatically (tag must match the manifest version).
5. Testers get the zip from the Releases page; installed extensions show an
   "update available" banner within a day.

To build a zip locally without releasing: `./scripts/build.sh` → `dist/`.

## Feedback

GitHub Issues. The popup's Feedback link opens a prefilled issue that includes the
user's extension version and browser.
