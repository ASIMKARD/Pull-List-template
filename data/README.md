# data/ — per-era source files

Big franchises split their rows into one file per era, `data/eras/<rank>-<era-id>.json`
(schema: `schema/era-file.schema.json`), listed in `dataset.json` under `"sources"`.
`tools/build.py` stitches them into `data.js`. Small franchises put `"rows"` inline
in `dataset.json` instead (the template's starter dataset does this).
See `test/fixtures/basic/` for a complete per-era example.
