# Build notes — the conventions

The rules a session must follow are in `CLAUDE.md`; this file explains how the
pieces fit, so a change lands in the right place. Field-by-field definitions
are in `schema/dataset.schema.json`.

## The master and what's generated

- `dataset.json` (plus its per-era files and `events/`) is the only thing
  you edit. `python3 tools/build.py` stitches it, derives the keys, validates
  everything and writes `data.js`, `sw.js`, `manifest.json` and `workbook.xlsx`.
  It also stamps `index.html`'s links to `styles.css`, `data.js` and `app.js`
  with the build's hash (`?v=<build>`): a new build has new addresses, so a
  reload can't reuse the last build's files from a cache. The stamp never feeds
  the hash.
- `python3 tools/build.py --check` rebuilds in memory and fails on any stale
  generated file. CI runs it; so does `test/suites/20-build.test.js`.
- Every field is read **by name**, never by position: the build, the gate's
  adapter and the harness's workbook reader (`test/lib/xlsx.js`) alike.

## Identity, order and dates

- `id` is the saved-progress key and never changes; `issueId` is the
  cross-tracker identity. A removed `id` fails the build until it is listed in
  `retiredIds`.
- Sort keys (`RRRR·YYYYMM·NNN`) and the publication-order `altKey` are derived.
  Era ranks start at 5000, spaced 10; add an earlier era with a lower rank.
- Every date names its source. "Cadence", "interpolated" or "assumed" is not a
  source; the build and the gate both refuse it.

## Versions

- The header shows a readable version ("v13"); Settings → About shows it with
  the content hash in small print.
- The build counts it up by itself: it reads the previous `data.js` in the
  output folder; if the content hash changed, the version is that number + 1,
  otherwise it stays. It is stamped after the hash, so it never feeds it: the
  service-worker cache name still follows the content.
- `franchise.versionStart` sets the floor. A migrated tracker uses its old
  tracker's last build + 1 (Absolute: v8). Raising it lifts the number; it
  never lowers it.
- `--check` is deterministic: an unchanged rebuild keeps the number, so a fresh
  checkout passes.
- **After merging two branches, rebuild on `main`.** Each branch counted up
  from the same `data.js`; the number continues from `main`'s, once.

## Skins

- Four shared skins (Paper, Newsprint, Pull, Night) are token sets in
  `styles.css`: bare `:root[data-skin="…"]` blocks that set custom properties
  only. `test/suites/80-guards.test.js` refuses anything else. A skin changes how
  things look, never where they are.
- The Look settings (paper, era colours, text size, density, button size,
  marks, the dyslexia-friendly font) own their tokens; a skin can't override
  them.
- `franchise.skins` lists the skins a tracker offers; with two or more (the
  signature skin counts), the skin control appears.
- **The skin choice is "last used", per tracker.** A first visit opens in the
  old tracker's pick (`storage.legacy.skins`, see `MIGRATING.md`), else the
  signature skin, else `franchise.skin`.

### The signature skin slot

One skin of the tracker's own, from `franchise.signature`:

```json
"signature": {
  "name": "Signal",
  "tokens": { "--accent-h": 176, "--font-display": "'Fixture Signal', var(--font-mono)" },
  "fonts": [{ "family": "Fixture Signal", "file": "fonts/ibm-plex-mono-500-latin.woff2", "weight": 500 }],
  "stylesheet": "signature.css"
}
```

- `tokens` must be input tokens from `styles.css` `:root`. Tokens a Look
  setting owns are read from `styles.css` and refused, as are the page's own.
- `fonts` are woff2 files in `fonts/`, so the service worker precaches them;
  each face swaps.
- `stylesheet` (relative to `dataset.json`) may only hold rules whose every
  selector starts with `:root[data-skin="signature"]`, and only look
  properties: colours drawn from tokens, background images (gradients from
  tokens, or a file in `fonts/`, `icons/` or `images/`), borders, radii,
  shadows and font settings. Position, display, inset, order, flex, grid,
  float, visibility, z-index, transform, width, height, margin, opacity,
  content and overflow are refused by name (but see decorations, below); so
  are at-rules, `!important`, literal or named colours and transitions.
- Decorations (John, 8 Oct): a rule whose every selector ends in `::before` or
  `::after` may also have `content` and may be placed absolutely.
  - `content` takes quoted text, `attr(data-n)` and `counter()`s.
  - Rows and era names carry `data-n`, their reading position, zero-padded.
  - Placement: `position: absolute`, the offsets, `width`, `height`,
    `text-align` and `white-space`.
  - Rows, era heads, band heads and arc heads are the anchors.
  - The `--row-gutter` token reserves room at a row's right end.
  - Counters (`counter-reset`, `counter-increment`, `counter-set`) may run on
    any rule.
  - The build adds `pointer-events: none` and an empty alternative
    (`content: X / ""`) to every decoration, so it never takes a tap and
    screen readers skip it.
  - Glyph marks are `font-size: 0` on `.mark` with a `.mark::after` per state.
  - Full-width bars are a `box-shadow` either side.
  - Everything that moves, hides or reorders a control stays refused on a
    pseudo-element too.
  - `test/layout/55-decor.test.js` checks every decoration in real Chromium:
    it covers no control or title, stays on screen, clears contrast and
    takes no taps.
- The build writes the checked CSS into `data.js`, and the app adds it once as
  `<style id="skin-signature">`. Measured against a linked file: a tie on
  first paint, and no extra request this way.
- It is measured with the shared skins: contrast in every paper and for 64
  eras, reachability, the sweep, the stack, motion and fonts
  (`test/layout/40-look.test.js` and friends). The demo is "Signal" in
  `test/fixtures/basic/`.

### Pull matches the X-Men tracker

- `test/layout/ref/x-men.json` holds X-Men's computed styles at 393 px, with
  its commit. `test/layout/ref/pull-map.js` maps each template element to
  X-Men's and lists the differences that remain, each with its reason.
- `test/layout/45-pull.test.js` compares Pull with the reference and keeps the
  list of differences true in both directions.
- To re-capture after X-Men changes (read-only clone beside this repo):
  `node test/layout/ref/capture-x-men.js ../X-men`.

## The workbook

- `tools/build_workbook.py` writes five sheets (Reading Order, Arcs, Eras,
  Creators, Events), each with named, bold, frozen, filterable headers.
  Bytes are deterministic (parts stored, fixed timestamps), so `--check` can
  cover it. Read it by header name; `--shuffle-columns` proves a reader does.
- Web-app-only trackers turn it off: `"deliverables": {"workbook": false}`. The
  build then writes none, `--check` fails if one is left over, and the next
  build removes it.

## The verify gate

- `tools/verify.py` is Research-Repo's `toolkit/verify.py`, byte for byte;
  `tools/verify.lock` records the commit and sha256, and the gate refuses any
  other bytes. Never edit it here.
- **To re-pin** after it changes in Research-Repo: copy it into `tools/`, put
  the new commit and sha256 in `tools/verify.lock`, and run
  `python3 tools/verify_gate.py` and `node test/run.js`.
- `python3 tools/verify_gate.py [dataset.json …]` runs the build's validation,
  `verify.check()` on the stitched rows (adapted by name), and the order the app
  shows (numbers rise within a series; series that ran together interleave).

## Testing

- `node test/run.js` (jsdom) and `npm run test:layout` (real Chromium) share
  one runner; any failure, crash or zero assertions fails. Report the count.
- Anything visual is measured in Chromium, never reasoned about.
- Every new check is proved by putting the bug back and watching it fail.
