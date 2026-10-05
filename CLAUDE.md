# CLAUDE.md — read this before touching anything

## Repo rules (read first, every session)

### Read-only rule
Only **Pull-List-Template** may be changed. Master-Repo, X-men, Research-Repo and
every other repo are **read-only**: read them from local copies (clone or pull
only), and **never** commit, push, create branches, open pull requests on, or
register them as repo roots.

### Standing rule from John
**Never edit any repo without John's explicit say-so.** Pull-List-Template is
approved for the v3 work. Before the first edit to any other repo — including
the Absolute pilot in session 5 — **stop and tell John**, so he can create a
fresh repo first. Migrations always go into the fresh repo; the original stays
untouched for comparison and rollback, and v3 takes over the original address
only at a cut-over swap John approves. (Full text: Master-Repo
`starter/STANDARDS.md`, "Repo safety".)

### Working method
- Each session works on its own branch and pushes it. John reviews and merges.
  Do not open a pull request unless John asks.
- Commit everything — sessions start from a fresh container.
- Run `node test/run.js` after every change and report the **assertion count**.
- Update `PROGRESS.md` at the end of every step.
- Ask design questions as short multiple-choice options; locked decisions are
  never reopened. Percentage-only progress updates.
- The spec is Master-Repo `starter/v3/V3-SPEC.md`; suite rules are
  `starter/STANDARDS.md`. Where they disagree with this file, ask.

## Repo map
| Path | What it is |
|---|---|
| `dataset.json`, `data/eras/*.json` | the franchise's data — **the master**. Edit these. |
| `events/*.json` | canonical shared event definitions (master copy lives here) |
| `data.js`, `sw.js` cache name, build tag | **generated** by `tools/build.py` — never hand-edit |
| `schema/*.json` | JSON Schema for the data files; the harness validates fixtures against it |
| `tools/build.py` | stitch + derive keys + validate + emit `data.js` (stdlib only) |
| `test/layout/` | real-Chromium suites (`npm run test:layout`): overflow sweep, motion, fonts, the rule finder. Same runner; CI runs it |
| `test/run.js` | the harness; `test/suites/*.test.js`; `test/fixtures/` (`basic`, `no-periods`, `mixed` formats, `minimal` (comics only, one era, no extras), `broken/*`) |
| `FEATURE-INVENTORY.md` | the parity checklist — v3 is not done until every line is present or dropped with a reason |

## Data rules (v3)
- **`id` is the progress key and never changes.** Migrated trackers keep their old
  sort key as `id`; new trackers default `id` to `issueId`. Removing an id
  orphans someone's saved progress: the build fails unless it is listed in
  `retiredIds`.
- **`issueId` is the cross-tracker identity**: `<series>-<volume-start-year>[-<token>…]`,
  lowercase kebab, e.g. `justice-league-2016-32`, `x-men-1963-annual-1`,
  `…-half`, `…-minus-1`, `…-1-5`, `sonic-frontiers-2022`, `sonic-prime-2022-s1e3`.
  Event chapters reference it; the merge dedupes on it.
- **Sort keys are derived, never hand-written**: `RRRR·YYYYMM·NNN` (13 digits).
  Era ranks start at 5000, spaced 10 — add an earlier era with a lower rank,
  never renumber. `NNN` is assigned by the build within each era+month; `seq` is
  only a hint. `altKey` is pure publication order (no era rank).
- **Dates are sourced individually** (`date: {cover, onsale?, source}`). Never
  interpolate, never write series data from memory.
- **Events state their era** in `dataset.json` (`events: [{id, era}]`); chapters
  the tracker doesn't have are placed inside that era by date then event order.
- **Credits**: full canonical names, never surnames alone. Missing credits warn
  (coverage %), and fail only under `strictCredits`.
- **Durations (per format), whole minutes.**
  - **Comics:** every comic counts as one issue, timed by the minutes-per-issue setting.
    A comic `duration` or `durations.comic` fails the build.
  - **Shows:** `durations: {screen: 22}` gives the default, and a row's `duration` overrides it.
  - **Games:** each game needs its own `duration`. A missing one warns (coverage %), adds
    nothing to time left, and shows as "+N untimed".
  - **Finish-by** = minutes left ÷ (issues per week × minutes per issue).
- **Read fields by name, never by position.** v2's generator read columns by
  index and a missing column shifted every downstream field into garbage.
- **`dataVersion` ties a compact QR code to one list.** It hashes the ids in row
  order, and the compact QR stores marks by position. Any change to the ids or
  their order changes it, which by design invalidates old QR codes. The full
  code and the backup file are keyed on id and survive. Old v2 codes are decoded
  in v2's key order, rebuilt from legacy ids **plus `retiredIds`**: keep retired
  ids listed, or every later position shifts.

## UI rules (v3)
- **Data-driven visibility: a rule, not a one-off (decided 4 Oct).** A control or
  section renders only when the dataset gives it something to do. The data
  decides this, never a setting or a skin; skins never hide a control.
  - **One medium:** no per-format header lines, no format filter, no progress-mode
    setting, no duration copy and no "+N untimed". Verbs are that medium's own; for
    comics that is plain "Read".
  - **The rest:**
    - no Characters section without presence data or two or more strands;
    - no Creators section without credits;
    - no Essential/Complete toggle without events;
    - no ALT toggle without ALT rows;
    - no order switch without a second order;
    - no bands without periods;
    - no era jump bar with only one era.
  - **How:** one capability map, built once at boot from the data, decides every
    case. A missing capability means the control is **not rendered**; don't hide it
    with CSS. That keeps the reachability guard and the visibility tests in
    agreement.
  - **Every new control** is added through that map, and it gets a row in the
    visibility suite.
    - The suite boots a bare fixture (comics only, one era, no extras), where none
      of these controls appear, and the full fixture, where all of them do.
    - A self-test forces each capability on in turn and must catch it.

---

## Traps carried over from v2 (each one cost real time)

Tag key: **[applies]** still true in v3 · **[superseded §N]** the v3 spec section
that removes the cause — keep the lesson anyway.

### Duplicate function names — [applies]
JavaScript keeps the **last** definition and silently discards earlier ones. v2
shipped `switchTab` twice, `jumpToIssue` three times, `issueByKey` twice: you
patch the copy that never runs. The harness fails if any function is defined
twice (found by brace-depth scan, never by a newline-brace string). Fix that
first if it fires.

### jsdom has no layout engine — [applies]
The harness can't see overlap, gaps, sticky positioning, size or truncation.
Three layout "fixes" shipped without changing anything visible because they
were reasoned about, not measured. Use real Chromium (Playwright,
`executablePath: '/opt/pw-browsers/chromium'` in cloud sessions) for anything
visual. If no browser is available, say so rather than guessing.
Session 3: the fourth tab pushed the page wider than 390 px, and at 320 px it was
cut off inside the tab bar. Both were invisible to jsdom. Sweep every tab at
320 px and check `scrollWidth`. `test/layout/10-sweep` does this on every push.
Session 4: reduced motion had never worked. A `* { transition: none }` rule has no
specificity, so every class rule that declares a transition beat it, and a test of the
CSS text "passed". Every duration now scales with `--motion`, and `test/layout/20-motion`
measures it.

### grep can't see multi-line CSS selectors — [applies]
A grouped rule spanning lines won't match `grep '\.tabs.*{'`. Ask the browser:
iterate `document.styleSheets` and test `el.matches(rule.selectorText)`.
`cssRules` throws on `file://` — serve over `http://localhost`.

### position:sticky vs position:relative — [applies]
`top:` means "stick here" on sticky and "shift down" on relative. One skin
declaration of `position:relative` turned every sticky offset into a
displacement: a phantom gap, an overlap and floating text.

### content-visibility — [superseded §1, resolved session 4]
v2 removed `content-visibility:auto` + `contain-intrinsic-size`: blank unpainted
rows on iOS, mis-positioned scroll-to-row, wrong estimates. Spec §1 says keep
the performance guard. **Resolved (session 4, open to John's veto):** v3 lands
collapsed and renders an era's rows only when it is first expanded (90-render:
5,000 rows render none at landing). The guard is unnecessary, and the iOS bugs
can't occur. Don't add `content-visibility`.

### Two stores for one setting — [superseded §2 by design; lesson applies]
v2 split settings between `state.settings` and `view`; a control that wrote one
while `applyView()` read the other appeared to work, then snapped back.
v3 has **one** settings store. Write to the store the reader uses.

### Writes are debounced 400 ms — [applies]
A change made just before close never reaches storage unless flushed. Flush on
`pagehide` and `visibilitychange` (hidden). When testing persistence, **wait for
the debounce** — reading 30 ms early looks exactly like a broken save and has
produced two false bug reports.
In a real browser, seed storage with `addInitScript` **before** load. If you write
localStorage while the page is open and then reload, the `pagehide` flush correctly
saves the app's in-memory state over what you wrote, which looks like the app
ignoring your seed.

### One guard word is also a CSS keyword — [applies]
The franchise-string guard matches "absolute" (the Absolute line), and CSS
needs `position: absolute`. The guard exempts that one declaration, with a
self-test that "Absolute Batman" is still caught. If a guard fires on
legitimate code, narrow it with a self-test. Never rename real code to dodge
it, and never weaken it wholesale.

### Maps compared as JSON depend on key order — [applies]
`t.eq` compares `JSON.stringify` output, and decoders return maps in row order.
Compare canonicalised (keys sorted) when the order is not the point, or a
correct round-trip reads as a failure.

### One toast, one Undo — [applies]
Bulk marks, Clear all, Replace and preset deletes each offer Undo on the
toast. A newer toast replaces it, so only the latest action is undoable.
Write tests (and expectations) one action at a time.

### Colour lived in five places — [superseded §1: one token block]
v2: base `:root`, seven `data-bg` swatches, the signature-skin palette, the
`--eN-t/-a/-d` era ramp per scheme, and `.era[data-e=N]` rules that stopped at
era 25 while the ramp went to 34 — rows past the lowest ceiling went unstyled.
v3: one colour-token block; ramps generated, no cap (60+ eras), and a guard
asserts exactly one token block. Era tints are pale washes.
**Design dark skins against the surface.** The first dark skin had 39 of 54
era colours failing WCAG AA (worst 1.35:1). Measure contrast; don't eyeball.
**How v3 holds this (session 4):**
- `:root` holds numeric inputs (hue, saturation, lightness per role) and derives
  every colour from them. Skins, paper swatches and the other Look settings set
  inputs only, in bare `:root[data-…]` blocks, and 80-guards rejects anything else.
- Outside `:root` the only colours allowed are *derived* ones, where every component
  is a token: an era's wash is `oklch(var(--era-tint-l) var(--era-tint-c) var(--era-h))`,
  with `--era-h` computed from the era's index (`style="--ei:N"`, a token, not a
  style). A literal component anywhere is caught.
- `test/layout/40-look` measures contrast for every skin × paper and for 64 eras.
  Its first run caught Night's control outlines at 2.95:1 on the warm and mint
  papers: at the same HSL lightness, a yellowish hue is brighter.
- Every control must be at least 24 × 24 px (WCAG 2.5.8). Creator names inside a
  line of credits are the inline exception.

### A control that saves a value nobody reads — [applies]
v2's refresh reminder stored an interval for a whole build before anything used
it. Add the setting and the code that acts on it in the same change, or not at all.

### iOS specifics — [applies]
- A home-screen app registers its **own** service worker; it must be opened once
  **online** after install. Settings → Offline reports readiness.
- iOS caches the home-screen icon at install; delete and re-add to change it.
- `respondWith(undefined)` is a network error: an offline fallback that misses
  its cache gives a blank page. Always end with a real `Response`.

### Service worker — [applies]
- Evaluate `sw.js`, don't just parse it: a temporal-dead-zone error passes
  `node --check` and silently kills the worker. The harness runs it in a vm.
- Network-first for the shell (`skipWaiting` + `clients.claim`), cache-first
  only for fonts and icons. A cache-first shell makes correct fixes invisible.
- `addAll` rejects the whole install on one 404 — every precached path must exist.
- Playwright's `setOffline` doesn't reach the service worker's own fetches, so an
  "offline" test can quietly pass through the server. Take the test server down
  instead (`test/layout/lib.js` `down()`), as `test/layout/70-pwa` does.

### Preloading isn't free — [applies]
A preloaded font competes for bandwidth with the render-blocking stylesheet. On a
1.6 Mbps link, preloading the display font cost about 100 ms of first paint, and
landed it before that paint, so the title never swaps. Preloading the body font as
well cost another 260 ms. Only the display font is preloaded; `test/layout/80-paint`
measures it. Measure before adding a preload.

### Cache name and build tag — [superseded: automatic in v3]
v2 required bumping `CACHE` and the build tag together by hand. v3 derives both
from a content hash at build time. Still: check the build tag on the phone
before judging anything.

### A crashed harness looks like a pass — [applies]
A crash mid-suite reports fewer passes, not a failure. `test/run.js` fails on
any suite crash and on **zero assertions**; always report the count.

### Test the real rendered DOM — [applies]
Never synthetic elements. Boot the real `index.html` + generated `data.js`.

## Before declaring anything done
1. `python3 tools/build.py --check` — generated files are fresh.
2. `node test/run.js` — 0 failures, and the **count** is what you expect.
3. `npm run test:layout` — real Chromium: 0 failures and the count. Add a check there for anything visual.
4. Manifest and icons franchised (they have shipped with placeholder name and
   another franchise's artwork).
5. Verify a deploy **by hash**, not HTTP 200; GitHub Pages takes ~100 s.
6. First deploy uploads everything: `fonts/`, `icons/`, manifest, `qrcode.js`.
