# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file
and Master-Repo `starter/v3/V3-SPEC.md`.

## Session 1 — scaffold (in progress)

| Step | What | Status |
|---|---|---|
| 0 | `main` created and default; session branch; CLAUDE.md (read-only rule, John's standing rule, v2 traps) | done |
| 1 | FEATURE-INVENTORY.md (parity gate): 60 F, 31 S, 123 T, 9 L, 13 D, 28 V, 10 CR, 12 FP, 20 XM, 3 X, 6 B lines | done |
| 2 | Repo layout; qrcode.js, 12 fonts, 3 icons vendored from v2 unchanged; app shell stubs (index.html, app.js, styles.css); SW template; package.json (jsdom, ajv); SessionStart hook runs `npm ci` | done |
| 3 | `schema/` (dataset, era-file, event; JSON Schema 2020-12) + `tools/build.py` (stitch, event merge on issueId, derived 13-digit keys + 9-digit altKey, validation, credits + creator index, id stability, content-hash stamping of data.js / sw.js / manifest.json, `--check`); root starter dataset | done |
| 4 | Fixtures: `basic` (invented franchise, 5 eras in 5 per-era files, 2 bands, 61 rows incl. #0/#-1/#½/#1.5/Annual/#1,000,000, special-character and very long titles, same-number volumes, flashback via sortDate, graphic novel, game, TV episode, ALT track, GAPNOTE/RENUM, one event with merged + migrated-id + placed chapters, credits with split + overrides + mononym), `no-periods` (same data, no bands), `broken/*` (20 one-error cases + a valid base) | done |
| 5 | Harness: `test/run.js` (fails on any failure, any crash, or zero assertions) + 9 suites: runner gate, schema (ajv vs every fixture; schema/build issueId agreement), build (3 datasets, keys, determinism, `--check`, id stability, 64-era stress, universal strand), identity, credits, events, validation (20 broken cases, field-order shuffle), shell (real index.html in jsdom), guards (listeners, one token block, zero !important, sw.js evaluated, duplicate functions, franchise strings, precache paths). Guards mutation-checked. | done |
| 6 | `.github/workflows/harness.yml`: every push (all branches), PRs and manual runs; Node 22 + Python 3.12; `npm ci`, `build.py --check`, fixture builds, harness; fails on any failure, crash or zero assertions (checked twice: by `run.js` and by parsing the count line) | done (CI result below) |
| 7 | Closing checkpoint | — |

**Harness assertion count:** 307 assertions, 0 failed (9 suites).

## Decisions locked (session 1)
- Sort key `RRRR·YYYYMM·NNN`, 13 digits; first era rank 5000, spacing 10; derived by the build, never hand-written; `NNN` assigned by the build.
- `id` = progress key, stable forever; `issueId` = canonical cross-tracker slug; events dedupe on `issueId`.
- Events: master in this repo's `events/`, copied into trackers, drift-checked by hash; each event states its era.
- Credits: writer + artist per run, per-issue overrides, `creditSplits` by `fromId`; missing credits warn unless `strictCredits`.
- Cache name and build tag derived from a content hash.
- App served from repo root; build in Python (stdlib); harness Node 22 + jsdom; ajv validates fixtures against `schema/`.
