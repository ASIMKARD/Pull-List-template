# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file
and Master-Repo `starter/v3/V3-SPEC.md`.

## Session 1 — scaffold (in progress)

| Step | What | Status |
|---|---|---|
| 0 | `main` created and default; session branch; CLAUDE.md (read-only rule, John's standing rule, v2 traps) | done |
| 1 | FEATURE-INVENTORY.md (parity gate) | — |
| 2 | Repo layout, vendored qrcode.js / fonts / icons | — |
| 3 | dataset schema + `tools/build.py` | — |
| 4 | Fixtures (basic, no-periods, broken) | — |
| 5 | Harness skeleton | — |
| 6 | GitHub Actions workflow | — |
| 7 | Closing checkpoint | — |

**Harness assertion count:** no harness yet.

## Decisions locked (session 1)
- Sort key `RRRR·YYYYMM·NNN`, 13 digits; first era rank 5000, spacing 10; derived by the build, never hand-written; `NNN` assigned by the build.
- `id` = progress key, stable forever; `issueId` = canonical cross-tracker slug; events dedupe on `issueId`.
- Events: master in this repo's `events/`, copied into trackers, drift-checked by hash; each event states its era.
- Credits: writer + artist per run, per-issue overrides, `creditSplits` by `fromId`; missing credits warn unless `strictCredits`.
- Cache name and build tag derived from a content hash.
- App served from repo root; build in Python (stdlib); harness Node 22 + jsdom; ajv validates fixtures against `schema/`.
