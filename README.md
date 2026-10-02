# Pull List template v3

The base template every Pull List comic reading-order tracker is built on.
Under construction — see `PROGRESS.md` for the current state and `CLAUDE.md`
for the rules every session follows.

```
npm ci                          # harness dependencies (jsdom, ajv)
python3 tools/build.py          # dataset.json -> data.js, sw.js, manifest.json
python3 tools/build.py --check  # generated files fresh?
node test/run.js                # the harness; report the assertion count
```

- `dataset.json` (+ `data/eras/*.json`, `events/*.json`) is the master; schema in `schema/`.
- `FEATURE-INVENTORY.md` is the parity checklist v3 must clear.
- `test/fixtures/basic/` is a complete invented franchise showing every data feature.
