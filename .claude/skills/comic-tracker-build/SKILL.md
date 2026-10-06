---
name: comic-tracker-build
description: Build, change, migrate or check a Pull List comic reading-order tracker on template v3 (dataset.json → tools/build.py → offline web app, workbook and verify gate). Use for any work on a tracker's data, skins, workbook, tests or deploy, and for moving a live tracker onto v3.
---

# Building a Pull List tracker (template v3)

## Before anything
1. Read `CLAUDE.md` (the rules, including the repo-safety rule and "stop
   cleanly") and `PROGRESS.md` (where the work stands, and where the next step
   begins). Locked decisions are never reopened.
2. Only the repo you were approved to edit may change. Every other repo is
   read from a local read-only copy. **Before the first edit to any other repo,
   stop and tell John.**
3. `npm ci` if `node_modules/` is missing.

## The loop
```
python3 tools/build.py          # dataset.json → data.js, sw.js, manifest.json, workbook.xlsx
python3 tools/verify_gate.py    # the pinned verify.py + the order the app shows
node test/run.js                # jsdom harness — report the assertion count
npm run test:layout             # real Chromium — report the count
python3 tools/build.py --check  # generated files fresh
```
Edit only the master (`dataset.json`, its per-era files, `events/`); never
hand-edit what the build writes. Commit and push only when every run is clean.

## Where to look
- Starting a tracker: `README.md`, "Start a tracker, step by step".
- Conventions (versions, skins and the signature slot, Pull, the workbook, the
  gate): `BUILD-NOTES.md`.
- Moving a live tracker without losing progress: `MIGRATING.md`.
- Every data field: `schema/dataset.schema.json`; a full example:
  `test/fixtures/basic/dataset.json`.
- Parity: `FEATURE-INVENTORY.md`.

## Rules that cost real time before
- **Dates are sourced row by row.** Never interpolate, never from memory.
- **`id` never changes** (saved progress hangs on it); removed ones go in
  `retiredIds`. `issueId` follows `<series>-<volume-start-year>[-<token>…]`.
- **Read by name, never by position** — data, workbook and gate alike.
- **Visible only when the data gives it something to do** — one capability map
  in `app.js`; a new control gets a row in `test/suites/9f-visibility.test.js`.
- **A skin changes how things look, never where they are.** Skins and the
  signature skin set tokens (and look-only rules); the build and
  `test/suites/80-guards.test.js` refuse the rest.
- **Measure anything visual in real Chromium** (`test/layout/`). jsdom has no
  layout engine. Contrast is measured, never eyeballed.
- **Wait out the 400 ms save debounce** before reading storage in a test; seed
  a real browser's storage before load.
- **A crash or zero assertions is a failure**, and every new check is proved by
  putting the bug back.
- **Versions count up by themselves** (`franchise.versionStart` sets the
  floor). After merging branches, rebuild on `main`.
- **Web-app-only trackers** set `"deliverables": {"workbook": false}`.
- **Deploys are verified by hash**, never by HTTP 200; the first deploy uploads
  `fonts/` and `icons/` too.

## Before declaring anything done
1. `python3 tools/build.py --check` — fresh.
2. `python3 tools/verify_gate.py` — gate passed.
3. `node test/run.js` and `npm run test:layout` — 0 failed, counts reported.
4. Manifest and icons are the franchise's own.
5. `PROGRESS.md` says what was done and where the next step begins.
