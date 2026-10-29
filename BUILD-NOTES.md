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
- **Version tags are automatic (John, 12 Oct).** `.github/workflows/version-tag.yml`
  runs `tools/version_tag.py` on every push to `main`:
  - when the push changes the readable version in `data.js`, it tags the pushed
    commit (the merge commit) `vN`, e.g. `v10`, and pushes that one tag;
  - a merge that leaves the version as it was (docs only) makes no tag;
  - a tag that already exists, here or on GitHub, is never moved or made
    twice, so re-running the workflow is safe;
  - it only ever creates `vN`, so rollback tags such as `v7-final` and
    `v8-final` are never touched;
  - the template itself (key `starter`) makes none.

  The workflow asks for `contents: write` for itself. If its push is refused,
  the repo's Settings → Actions → General → Workflow permissions is the place
  to look ("Read and write permissions"), and Settings → Rules for a ruleset
  that restricts tags. `python3 tools/version_tag.py --dry-run` says what it
  would do. `test/suites/26-version-tags.test.js` tests it on real git repos.

## Skins

- Four shared skins (Paper, Newsprint, Pull, Night) are token sets in
  `styles.css`: bare `:root[data-skin="…"]` blocks that set custom properties
  only. `test/suites/80-guards.test.js` refuses anything else. A skin changes how
  things look, never where they are.
- **Pull's layout exception (John, 9 Oct).** Pull alone runs its tab bar edge
  to edge and draws its era boxes as the X-Men tracker's folder tabs. The tokens
  that do it are listed in `PULL_ONLY` in `tools/build.py`:
  - `:root` holds the template's layout, and only Pull's block changes them;
  - a signature skin that sets one fails the build;
  - `test/suites/80-guards.test.js` checks the stylesheet;
  - `test/layout/60-stack.test.js` measures the tab bar in every skin, and
    `test/layout/10-sweep.test.js` checks that no era text crosses the tab's cut.
- **Two frames (John, 25 Oct).** The shared skins are drawn on the **x frame**,
  the X-Men tracker's arrangement (session 8). A signature skin may keep the
  **v9 frame**, the template's arrangement as it was up to v9, exactly:
  `"frame": "v9"` in `franchise.signature` (Absolute's own skin).
  - The root carries `data-frame`. Every rule that belongs to the x frame is
    scoped `:root[data-frame="x"]`, and the render paths split only where the
    structure differs: the header and its tools, the era head and body, the arc
    cards, the rows, Reading, Reviews and Settings' on/off rows. So the v9 frame is
    the old rules and markup, untouched. A skin change that crosses frames draws the
    page again.
  - **The page's markup is the v9 frame's.** The x frame moves the same controls
    (`app.js`, `placeChrome`), so each keeps its state and its listeners, and a move
    back restores v9's order exactly (47-frame-v9 checks a signature → Pull →
    signature round trip).
  - `test/layout/47-frame-v9.test.js` measures every visible element in five
    views at 320, 390 and 1024 px against a recorded reference
    (`test/layout/ref/frame-map.js`): the `sig-v9` fixture's in the template
    (`test/fixtures/sig-v9/frame-ref.json`), and a tracker's own frame-ref.json
    beside its `dataset.json` when its skin is on the v9 frame. Re-capture (`node test/layout/ref/capture-frame.js`) only after John
    has seen the difference. A tracker moving onto this template with its own skin
    on the v9 frame captures its reference from its old version (`MIGRATING.md` §5).
  - The v9 frame keeps v9's 6 px mini bar, on by default; the x frame's is 3 px and
    off by default, as the reference tracker's (John, 13, 24 and 28 Oct). The
    Display summary names the mini bar only when it isn't its frame's default.
  - Within a frame a skin still never moves a control.
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
  "stylesheet": "signature.css",
  "frame": "x"
}
```

- `frame` is `"x"` (the default: the shared skins' layout) or `"v9"` (keep v9's
  arrangement; see "Two frames" above).

- `tokens` must be input tokens from `styles.css` `:root`. Tokens a Look
  setting owns are read from `styles.css` and refused, as are the page's own
  and Pull's layout tokens (`PULL_ONLY`).
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

### Era colours

- An era may have its own colour: `"colour": "#RRGGBB"` in `dataset.json`'s
  `eras`. Pull draws it exactly as given, with white text (John, 9 and 12 Oct).
  - The strip under the tab is the X-Men tracker's rule: each channel 25 darker.
  - The other skins ignore it and keep their pale washes from the era's index.
- **The build never refuses or changes a colour.** It reports the ratios of
  white text, of the 85 % years and of white text on the strip. When any is
  under 4.5:1 it warns, and gives the nearest shade of the hue where all three
  pass.
- **An era without a colour gets Pull's default palette** (John, 13 Oct): the
  X-Men tracker's eleven era colours, in its order, era i taking colour i mod 11
  (`PULL_PALETTE` in `tools/build.py`; `test/layout/ref/x-men.json` records
  them, and 20-build checks the two agree).
  - Every default passes for white text, for the 85 % years (blended at
    217/255, as browsers draw them) and for white text on its strip, each at
    4.5:1. A reference colour that doesn't is nudged darker, only as far as it
    must: OKLCH lightness is lowered 0.0005 at a time, with hue and chroma kept.
    Where the gamut runs out first (a yellow holds less chroma as it darkens),
    the chroma follows the gamut's edge, so the colour stays inside sRGB.
  - Five of the eleven are nudged. `python3 tools/build.py --pull-palette` lists
    every colour as drawn, with its nudge and ratios:

    | Reference | Pull | How | White · years · strip |
    |---|---|---|---|
    | Foundations `#A6791E` | `#8A6100` | L .606 → .524, chroma .115 → .109 (the gamut's edge) | 5.54 · 4.50 · 7.99 |
    | Utopia `#1F7A5C` | `#1A7659` | L .519 → .507 | 5.56 · 4.52 · 7.95 |
    | Bendis to IvX `#B08A1F` | `#836400` | L .652 → .522, chroma .124 → .107 (the gamut's edge) | 5.54 · 4.53 · 8.02 |
    | ResurrXion `#C0622A` | `#A94D0D` | L .599 → .531 | 5.59 · 4.50 · 7.84 |
    | Krakoa `#C21E6D` | `#C11C6C` | L .540 → .537 | 5.75 · 4.50 · 7.49 |

    The other six are drawn as they are (white text 5.65:1 or more).
  - A tracker's own colours are never nudged: they are drawn exactly as given.
- "One colour" (the Era colours setting) gives every era one colour and sets a tracker's colours aside
  (John, 19 and 24 Oct):
  - the tracker's own accent, `franchise.accent`, darkened by the palette's rule only as far as white text, the
    85 % years and the strip need for 4.5:1, its hue kept (Absolute's crimson, v7's `#E8123C`, is drawn `#C90030`;
    a dark accent like `#7A1F2B` is drawn as given);
  - without one, the palette's navy `#1C3A5E`, the X-Men tracker's accent.

  The build reports what it drew (`oneColour`: the source, the colour and the nudge), and warns if that colour reads
  under 4.5:1 as the review era tag. 20-build checks no accent, a dark one, two light ones (one at the gamut's edge)
  and malformed ones; 40-look draws three in Chromium.
- Tested in `test/suites/20-build.test.js` (the source against the recorded
  measurement, every default passing, each nudge the least that passes, 52 eras
  cycling, tracker colours untouched) and `test/layout/40-look.test.js` (in
  Chromium: 52 eras drawn in palette colour i mod 11, each strip, every text
  measured, and the other skins identical with and without colours). A
  tracker's colour under 4.5:1 is the one exception the contrast suites allow.
  It must measure exactly what the build reported (40-look, and
  `test/layout/45-root.test.js` on a tracker's own data).

### Pull matches the X-Men tracker

- **The whole page, measured (session 8, John, 24 Oct).** `test/layout/ref/x-men.json`
  holds the live X-Men tracker's computed styles and geometry in eight views (the
  Checklist landing, an era open, an arc open, scrolled, Reading, Reviews, Settings, and
  a core row with a gap note) at 320, 390 and 1024 px. It records the live URL, its
  sha256 and the commit it equals, plus the folder tab's shape and the eleven era
  colours. `test/layout/ref/pull-map.js` says which template element each X-Men element
  is measured against, view by view, and how both pages are driven there.
  - **The template side** is the `pull-ref` fixture in Pull: top-level eras with
    X-Men's type names and its first six era colours.
  - **Every visible element is accounted for.** It is mapped, a wrapper that draws
    nothing, or listed in `ONLY` with the kept item that explains it. The capture
    refuses to write a reference while an X-Men element is unmapped, and 45-pull
    checks the template's side the same way.
  - **Every difference left is in `DIFFERENCES`,** tied to a kept item (the Filters
    panel, the title, per-issue reviews, the 24 px mark, the two outlines, Settings'
    sections, other v3 features), to an accessibility ruling, to an element X-Men draws
    where it never shows (`unseen`), or to John's ruling. While session 8 ran, a
    difference could also name the step that would fix it, and a step that was done
    could leave none. The session is closed (`CURRENT_STEP` is `9`), so none may.
- `test/layout/45-pull.test.js` compares all of it and keeps both lists true in both
  directions. At step 1 of session 8: 858 properties match, 966 differences are
  listed, every one tied to a step. After step 2: 1063 match and 761 are listed; after step 4b, 1317 and 480; after step 5, 1428 and 384; after step 6a, 1645 and 167; with the eras the same size, 1786 and 167; and after step 6b, 1900 and 80, none of them tied to a step.
- To re-capture (session-only, with a read-only clone):
  `node test/layout/ref/capture-x-men.js --dir ../X-men`. The live page must be
  byte-identical to the clone's `index.html`. With `X_MEN_LIVE=1` and a local copy at
  `../X-men` (or `X_MEN_DIR`), 45-pull re-captures and compares.
- Side-by-side screenshots for John: `node test/layout/ref/side-by-side.js OUTDIR`
  (X-Men live | Pull, every view, 390 px by default).

### The x frame's header (session 8, step 2)

- **One 760 px column**, centred: the header, the tabs and the page.
- **The header pins under the tabs**, as X-Men's: the header is sticky at the top
  (z-index 40) and the tab stack (41) covers its top, so its lower lines and the
  progress stay in view. It pins only while it takes at most 35 % of the screen; with
  the largest text on a 320 × 568 phone the tabs pin alone (John, 28 Oct; `10-sweep`).
  `--stack-h` is what stays pinned, so jumps land below it (`60-stack`).
- **Its lines:** the franchise name as the title (28 px, 24 px at 420 px and under in
  Pull: `--title-size-narrow`); X-Men's offline line, ending "· vN" and the offline
  mark, the ink at 64 % (`--offline-a`); the strapline in the subtitle's place.
- **The progress line:** an 8 px track (`--head-track`, `--head-fill`), then the count
  on the left and, on the right, the plan's finish-by date, the time "remaining" and
  "+N untimed" (`--stats-size`). At 320 px the right side takes a line of its own.
- **The filter bar:** no card. The search box with Next unread beside it (filled,
  `--jump-ink`), then the Filters button, Expand all and Collapse all, then "Showing X
  of Y". The bookmarks bar sits under it, as X-Men's PINNED row, its chips in the
  control outline (3:1 on every paper).
- **The tabs** share the bar equally, X-Men's padding; Pull draws no rule under its
  dark bar (`--tabs-rule`, Pull's layout).

### The x frame's era box (session 8, step 3)

- **The tab:** the name, and the years under it, as X-Men's. X-Men's ▸ chevron sits in its
  clipped corner and never shows, so Pull draws none. The tab's right padding stays
  `max(44px, 12%)`, so a long name wraps before the cut (John, 28 Oct).
- **One strip under it:** the count ("1/21 read", X-Men's form) and "filtered" on the left,
  the bar between, 10 px from each side, and the time left, "+N untimed" or ✓ on the right
  (`app.js`, `eraFootHtml`).
- **An era's finish-by date is the first line of its body** (John, 24 Oct), above the intro;
  band heads keep theirs, and an era inside a band shows none. The line is in the closed body
  too, so it is always in the page; `refreshStats` keeps it current.
- **The intro** has X-Men's padding and dashed rule.
- 45-pull measures the strip's bar by its gaps to the figures beside it
  (`relSibLeft`, `relSibRight`), so a fixture whose counts are shorter than X-Men's
  still compares.

### The x frame's arc cards (session 8, step 4a)

- **An open era shows its arcs as cards, all shut**, as X-Men's. A card is one run of an
  arc's rows in the era's order, so an arc the order splits gets "· cont." cards, as the
  headings did (`app.js`, `eraCards`).
- **The head:** the stripe, the name (a button that opens and shuts the card), the type
  badge (only when two or more types are in use) with the year and importance, the
  count of its own rows, ⓘ and the chevron. A tap anywhere on the head but ⓘ opens or
  shuts it.
- **ⓘ** (only when the arc has a blurb or credits) shows them under the head without
  opening the card.
- **An open card** draws its rows the first time: the event's note, Mark arc read and
  Mark arc unread, then the rows. Open cards are session-only, as eras are
  (`open.a`, keyed `era:arc:n`).
- **What opens them:** Expand all and Collapse all reach every card; a jump (Next
  unread, a bookmark, a review, Reading) opens the row's own card; a search or a filter
  change opens the cards it matches; an era chip opens the era with its cards shut.
- "Label on each row" keeps its rows, and the v9 frame keeps its arc headings.
- `test/suites/9l-cards.test.js` checks all of it.
- **The look (step 4b).**
  - **Type colours come from the build.** `data.js` carries `typeColours`, one entry per
    type in the data's order (`tools/build.py`, `pull_type`). Pull draws them; every other
    skin draws a wash by type index, as era washes are (`--type-h0`, `--type-step`).
    - **The stripe** is X-Men's colour for the type's name (`PULL_TYPES`, X-Men's
      TYPE_COLORS), exactly; any other name gets X-Men's fallback, `#666666`.
    - **The badge** is the same colour, darkened by the palette's rule (OKLCH lightness only,
      0.0005 a step, chroma kept) only as far as it must go. Its text then passes 4.5:1 on
      its own tint, a 13.33 % mix of the colour into the card, on **every** paper
      (`PULL_CARDS`, the seven cards Pull draws). SPIN-OFF and EVENT pass as they are.
    - **`PULL_CARDS` must equal the cards drawn.** 40-look reads Pull's card on every paper
      and fails if they differ.
  - **The tint is opaque:** `color-mix(in srgb, <badge> 13.33%, var(--card))`, so contrast
    is measured on the colour actually painted. 80-guards accepts a `color-mix` only when
    every colour and share in it is a token.
  - **Pull's measured card:** 1.45 line height, a 10.5 px year line, a 9 px badge, a 12 px
    count, a 24 × 24 ⓘ, Mark arc buttons with a 1.5 px outline, and a 1 px rule above the
    rows. The other skins keep their own sizes (`--arc-meta-size`).
  - **ⓘ and Mark arc** are outlined in `--soft-edge`, which is Pull's `#8A8577` (3:1 on every
    paper) and the control outline in every other skin.
  - **C and G pass on every paper** (John, 29 Oct). His first rulings (28 Oct)
    passed on Pull's own paper but measured 4.23–4.42:1 (badges) and 2.82–2.94:1 (outline)
    on the grey, sky, rose and lilac papers. Built: MAIN `#206381`, SOLO `#00694D`, MINI
    `#994300` (ruled `#266886`, `#0A6E51`, `#A04600`), and the outline `#8A8577` (ruled
    `#8F8A7C`). `20-build` checks each badge is the least darkening that passes.

### The x frame's rows (session 8, step 5)

- **As the reference's.** The mark, then the title with the core star after it and the note under it, then the
  quiet controls (look up ↗, ✎, ☆) with the bookmark at the row's right end (`app.js`, `xRowHtml`). The v9 frame's
  rows are drawn by `rowHtml` as before.
- **The mark** is the reference's checkbox: on the card, its outline `--mark-edge-w` (Pull 2 px) and `--mark-radius`
  (Pull 5 px); read in `--mark-on` with `--mark-on-ink` (Pull: the ink, and the paper's ✓). Its size stays with the
  Button size setting (John, 9 Oct), so the titles' column starts after it. The Box style draws the reference's
  glyphs: none while unread, ✓ read, ― skipped on a dashed outline, ◐ reading. The v9 frame keeps ☐ ✓ ⊘.
- **The title:** read, in the soft ink struck through in the line colour; skipped, in the soft ink and italic. The
  core star follows it (`--core-size`, the gold), named "core" for screen readers.
- **The note** sits under the title (`--note-size`). A flashback's or an alt's note does too, after "↺ flashback ·"
  or "alt ·", so the x frame has no note badge or popover. Tap to reveal still covers plain notes only, as its
  capability (`HAS.reveal`) says.
- **The quiet controls** have no outline and no fill, at least `--bm-box` (24 px, ruling E; 44 px with large
  buttons), in `--quiet`; a bookmark that is on is in `--gold`. In Pull these are A and B made to pass 4.5:1 on the
  card on every paper: `#6D685B` and `#836400` (A and B revised, John, 29 Oct). In the other skins, the soft ink and the accent.
- **A gap note** is one line in the titles' column, its ↷ or ⟳ inline, on `--gapnote-bg` (Pull: the inset).
- **Table view** ellipsises the title and keeps the core star after it.
- **An event's note** in a card is inset as Mark arc is, so its button's focus ring clears the card's edge, which
  clips for swipe. `10-sweep` focuses every control in every card and checks its ring.

### The x frame's Reading and Reviews (session 8, step 6a)

- **Reading** is the reference's view, not a card (`xReadingHtml`):
  - the counter, "N of M", adds the state once there is one ("· READ", "· BEATEN", "· SKIPPED");
  - the issue centred on the page: its era chip in the era's own colour (white on it in Pull; the wash and the era ink
    elsewhere), the title in the display face (28 px, 22 px at 420 px and under), "arc · TYPE" with the type as
    written and "★ CORE", the note in italics, the blurb under a dashed rule;
  - Skip and Mark Read, 15 px 700, outlined in `--mark-edge-w` and `--mark-on` (Pull: 2 px, the ink), round to
    `--rbtn-radius` (Pull 10 px); the nav row in the soft ink, a disabled step at .3 opacity;
  - the key hint, kept (v3).
- **Reviews** are the reference's cards, one per issue in reading order (John, 8 Oct): the era tag, the issue (it
  jumps there), the stars in the gold, the text, and Edit, which goes to the issue with its review open. The
  heading stays for screen readers only. Reviews kept from the previous version are listed the same way.
- **An era's colour as text.** The review era tag is the era's colour as 10 px text on the card, drawn as given
  (John, 29 Oct), as the tab is. The palette's eleven colours pass 4.5:1 as text on every paper (the lowest 4.54:1). A
  tracker's own colour may not: the build reports it on each paper (`era.colour.onCard`) and warns when the lowest is
  under 4.5:1, and its hint passes as the tag too. 40-look lets such a tag through only at exactly the reported ratio,
  and checks that Pull draws the tag in the era's colour exactly. Anything drawn in an era's colour outside the era box
  carries `.eratok` and the era's tokens (`eraStyle`), so the era colour block applies to it.

### Line height (John, 29 Oct: "make the eras the same size")

- **Pull sets every line at the reference's 1.45** (`--body-lh`, `normal` in the other skins). At `normal` (about 1.3
  for Plex Sans) each era box was 3.9 px short (86.9 px against 90.8), and any text over two or more lines read about
  11 % shorter, which is how X-Men's eras looked 10–15 % bigger.
- **Controls keep the browser's line height,** as the reference's do: a button or a field never inherits the page's
  1.45 there. The rule is at a bare element's weight (`:where()`), so every class rule's own line height still wins.
- **Buttons that are blocks of text** keep the page's line height, because the reference draws them as plain blocks:
  the era and band heads, a card's name and a review's title.
- 45-pull measures line height on every text and the height of the era box, its tab and its strip, so this can't
  drift again. After this: 1786 match and 167 listed.

### The x frame's Settings (session 8, step 6b)

- **The sections stay collapsible** (John, 24 Oct), each drawn as the reference's: a band with a rule under it, its head
  in the mono face, 11 px, upper case, in the soft ink. The icon, the summary and the chevron stay.
- **Rows** are 9 px apart, with the label and its control at either end.
- **On/off settings are switches** (`prefs` in `app.js`), one row each:
  - a group of one is a row with the group's name and the setting's words under it ("Order" / "Newest era first");
  - a larger group is a sub-heading over a row per setting;
  - a switch that is off is the line colour, exactly as the reference's (F); one that is on is in `--mark-on`;
  - its knob moves in `calc(.15s * var(--motion))`, which 20-motion now measures in `::before` and `::after` too.

  The v9 frame keeps its chips.
- **The segmented control** is one joined pill outlined in `--mark-on`. Its segments share it and wrap their own words,
  so "Issues per week" fits at 320 px with the largest text.
- **Buttons** are the reference's small ones, outlined in the control outline, 3:1 on the paper they sit on (as the
  pinned chips). **Swatches** are 24 px (E).
- 45-pull: two Settings differences are left, each ruled; no `step` entry remains anywhere. After this step: 1900 match,
  80 listed.

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
