# Release rollback

## Yank a bad release

1. On GitHub Releases, edit the bad tag release and mark it as prerelease, or delete the release assets.
2. If auto-update already published `latest.yml` / `latest-mac.yml`, publish a newer good tag quickly. electron-updater follows the latest published feed, not "downgrade by default."
3. Do not force users onto an older version through the updater unless you intentionally publish that older build as latest (generally avoid).

## Keep artifacts

Retain at least the last **5** tagged release binaries (Windows NSIS/portable + mac zips) for manual rollback installs.

## Settings schema

`cue-data.json` includes `schemaVersion`. Before shipping a breaking settings change:

1. Bump `SCHEMA_VERSION` in `src/settings-model.js`.
2. Add a migration in `migrateSettings`.
3. On load failure/corruption, Cue writes `cue-data.corrupt.<timestamp>.json` and resets defaults.

## Sessions

Live transcripts are memory-only by design. Export before quit if the user needs a copy. This is a privacy feature, not a defect.
