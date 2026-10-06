# FEATURE INVENTORY — the v3 parity gate

v3 is not done until **every line** is `present` (with the harness assertion
that proves it) or `dropped: <reason>`. Source of truth for "what v2 did" is
Master-Repo `starter/template/` (v2) and `ASIMKARD/X-men`; v3 requirements are
`starter/v3/V3-SPEC.md` and `starter/STANDARDS.md`.

**Status:** `todo` · `present (assertion)` · `re-express` (v2 behaviour is
replaced by a v3 design; the v3 equivalent must be asserted) · `dropped: why`.
**Session:** S1 scaffold · S2 core app · S3 features · S4 look + PWA ·
S5 workbook + pilot · S6 buffer.

Sections: F features · S settings · T v2 `test.js` assertions (all 123) ·
L v2 `layout-check.py` assertions (all 9) · D the 13 template defects ·
V spec additions · CR creator credits · FP filter panel · XM X-Men extras ·
X extra lines John asked for · B v2 bugs found while inventorying.

---

## F — v2 features

| ID | Feature (v2 behaviour) | Session | Status |
|---|---|---|---|
| F-1 | Checklist tab: rows grouped period band → era → arc, ordered by sort key | S2 | present (90-render: band → era → arc → rows, reading order) |
| F-2 | Reading tab: one-issue stepper (n of N, era pill, title, arc · type, note, arc blurb, Skip / Mark Read, Prev / Pin / Next); resumes at first unread until the user steps | S3 | present (9a-reading: n of N, era + format pills, title, arc · type, state, note, blurb, Skip / Mark <verb>, Previous / Pin / Next, resumes at the first entry not done until you step) |
| F-3 | Reviews tab: 1–5 stars + text per issue, list sorted by key, tap to jump to the issue | S3 | re-express → present (9b-reviews: per arc, as the session-2 migration maps them; 1–5 stars + text, listed by each arc's first key, tap to jump; unmatched old reviews kept and listed) |
| F-4 | Settings tab, sectioned: Display, Reading behaviour, Touch controls, Bulk actions, Data | S3 | present (98-tabs-settings: 6 sections — Reading behaviour, Display, Touch, Bulk actions, Data, Backup) |
| F-5 | Four-state marks cycling unread → reading → read → skip; done = read or skip | S2 | present (91-marks: four-state cycle through one setMark path) |
| F-6 | Medium-aware labels: comic Read/Reading, game Not started/Playing/Beaten, screen Unwatched/Watching/Watched; Reading-tab button verb follows | S2 | present (90-render, 91-marks: game Not started → Beaten; 9a-reading: Reading-tab verbs Mark Read / Beaten / Watched) |
| F-7 | Inert rows (GAPNOTE, RENUM) render as notes with no mark and never count toward progress | S2 | present (90-render: inert rows render with no mark, never count) |
| F-8 | Row badges: ★ core, ↺ flashback (popover note), alt (popover note), bookmark ☆, review ✎ (`.b.rv`), external "read ↗" lookup link (franchise `searchUrl`, falls back to a web search) | S2 | present — core, flashback/ALT note, bookmark, lookup link (90-render); review ✎ `.b.rv` on arc heads, and on the first row of each run in layout C (9b-reviews) |
| F-9 | Row subnote shown under the title when a note exists and isn't a FB/ALT popover | S2 | present (90-render) |
| F-10 | Period band heads: name, years label, blurb intro, done/total count | S2 | present (90-render: name, years label, intro, read count) |
| F-11 | Era heads: name, "cont." when an era recurs, intro once, done/total count; arc heads: name ("· cont."), year · title meta, blurb (suppressed when equal to era intro) | S2 | present (90-render: cont., credits, intro once) |
| F-12 | Counts reflect the current filters (tallyEras counts only visible rows) | S2 | re-express → present: plan filters (tier, mandatory, hide skipped, ALT, format) always count; browse filters (search, creator, era, type, character) count while active, marked "filtered"; display-only (unread, order) never (96-figures) |
| F-13 | Empty bands/eras/arcs hide under a filter; "Nothing matches these filters." empty state | S2 | present (92-filters: empty bands/eras hide, empty state) |
| F-14 | Global progress: count, %, bar, `aria-valuenow`; progress mode combined vs per medium | S2 | present — combined (90-render, 95-pace) and per format with each format's own time left (98-tabs-settings) |
| F-15 | Progress header (phead): title, offline-edition line, strapline + build tag, bar, "n / N read", days remaining | S2 | present (90-render: title, strapline, build, bar, n/N, time left, finish-by) |
| F-16 | Persistent banner (off by default): one compact progress line per medium, sticky under the tabs | S4 | present (9h-banners: off by default; one line, or one per format when progress is per format, each in its own verb; the header's figures, kept current by every mark. test/layout/50-table: on every tab, every skin, 320 px, no overflow. Sticky in step 6) |
| F-17 | Mini progress bar (on by default) | S4 | present (9h-banners: on by default, a `<progress>` with the header's read of goal, refreshed by every mark; test/layout/50-table. Sticky in step 6) |
| F-18 | Pace estimate: issues/week (light 5, steady 12, heavy 25, marathon 50) → "N left · W weeks · done Mon YYYY" | S3 | present (98-tabs-settings: "N left · W weeks at P a week · done Mon YYYY", same minutes maths and date as the header) |
| F-19 | Filters: depth (Barebones/Essential/Everything with counts; Barebones is comics-only), type chips, priority M/O, format (one chip per medium), characters (strands) + all/none, era select, search (title, arc, note; debounced 180 ms), unread only, ALT tracks toggle, reset | S2 | present — tier, type, mandatory, format, characters, era, search incl. creators, unread, ALT (92-filters) |
| F-20 | Order chip: reading order vs Arc Master timeline order | S2 | present (92-filters: arc order) |
| F-21 | Dual-order chip (franchise `dualOrder` config; hidden when unset) using the alternate sort key | S2 | present (92-filters: reading/publication labelled from dualOrder) |
| F-22 | Filter presets: save current filters by name, apply, delete | S3 | present (9d-story-filters: save by name, apply, update, delete with Undo) |
| F-23 | Bulk mark era read / unread; mark era range read; toast with undo | S3 | present (9c-bulk-touch: era read / unread, range, arc; the rows the view counts; toast with Undo; 5,000 rows in one refresh) |
| F-24 | Swipe to mark (right = read, left = skip), opt-in | S3 | present (9c-bulk-touch: opt-in, right = read, left = skip, short or vertical drags ignored) |
| F-25 | Long-press a band/era/arc head to bulk-mark it read, opt-in | S3 | present (9c-bulk-touch: opt-in, band / era / arc head, Undo; the lift never also toggles the head; moving cancels) |
| F-26 | Collapse all / expand all (Settings → Bulk actions) | S2 | present (90-render: expand all / collapse all; also in Settings → Bulk actions) |
| F-27 | Jump to next unread (button) and "jump to first unread" on load (setting) | S2 | present — next unread (94-navigation); jump-on-load re-expressed (S-17) |
| F-28 | Bookmarks: toggle per row, list in Settings sorted as displayed, jump, remove | S3 | present (98-tabs-settings: list sorted as displayed, jump, remove) |
| F-29 | `jumpToIssue`: switches to Checklist, expands collapsed ancestors outermost-first, scrolls, flashes the row; toast when filtered out | S2 | present (94-navigation; 98-tabs-settings: switches to Checklist) |
| F-30 | QR sync: 2-bit packed progress + bookmarks + settings + filters + reviews, franchise-prefixed code, QR when it fits, copy-code fallback, paste-to-import with confirm | S3 | re-express → present (9e-sync: compact QR (RLE or raw, whichever is smaller) holding a #sync= link; full copy-code; paste with preview; Merge or Replace with confirm; over-capacity falls back to the copy-code; a real-Chromium QR decodes back exactly) |
| F-31 | About & legend box (legend + maintenance notes from data) | S3 | present (98-tabs-settings: title, counts, build, legend and maintenance from data) |
| F-32 | Clear all progress (confirm; keeps reviews and bookmarks) | S3 | present (98-tabs-settings: in-page confirm, keeps reviews + bookmarks, snapshot undo restores exactly) |
| F-33 | Toast with optional action button | S2 | present (94-navigation: toast with action) |
| F-34 | Refresh reminder (monthly/quarterly/yearly/off), first run starts the clock, dismiss resets | S3 | present (98-tabs-settings: consumed at boot, first run starts the clock, Dismiss and a new interval reset it) |
| F-35 | Offline readiness readout (Settings → Offline: ready / not ready / unsupported, files cached) | S4 | present (9i-pwa: ready / not ready (N of M) / unavailable from the cache the build names; test/layout/70-pwa: "Ready offline · N of N" after a real install) |
| F-36 | Online/offline toasts and body `.offline` class | S4 | re-express → present (no online/offline listeners, decided 2 Oct: the connection is read at boot, when the page is shown again and on every tap. The body `.offline` class, a header mark and toasts on change: 9i-pwa; test/layout/70-pwa: marked offline after an offline reload) |
| F-37 | Install prompt toast (`beforeinstallprompt`) and "Installed." | S4 | present (9i-pwa: the browser bar is held back; a toast and Settings → Offline offer Install; the prompt runs once; "Installed." or a way back. `beforeinstallprompt` is listener 9 of the 9 at boot) |
| F-38 | Service-worker update flow: "A new version is ready" → Reload | S4 | present (9i-pwa: a new worker is followed to "activated", then "A new version is ready" with Reload; a first install is not an update; quiet checks when the page is shown again. test/layout/70-pwa: a real update via Check for updates, the old cache deleted) |
| F-39 | Theme button (default ↔ newsprint), theme-color meta follows | S4 | re-express → present (four skins in Settings → Look; the theme-color meta follows each skin's paper, measured for 4 skins × 7 papers in test/layout/40-look) |
| F-40 | Franchise applied from data: document title, wordmark, strapline, theme-color, apple web-app title | S2 | present (70-shell) |
| F-41 | Storage shim: `window.storage` → localStorage → in-memory fallback | S2 | present — localStorage with in-memory fallback (70-shell, 93-storage) |
| F-42 | Debounced 400 ms writes, flushed on `pagehide` / `visibilitychange` hidden | S2 | present (70-shell: debounce 400ms, pagehide + visibilitychange flush) |
| F-43 | Namespaced storage `<key>:v1:{progress,settings,filters,reviews}` | S2 | present (70-shell: keys `<key>:v3:*`) |
| F-44 | Keymap migration: `D.keymap` moves marks for re-keyed rows once, toasts the count | S2 | re-express → present: stable ids + retiredIds (20-build) and the read-only legacy reader (93-storage) |
| F-45 | Saved-filter migration when the strand roster grows (new strands default on) | S2 | re-express → present: saved filters stored by name, unknown names dropped (92-filters) |
| F-46 | Layout-vocabulary migration (`lv`) | — | dropped: v3 has one layout |
| F-47 | Elsewhere/story band: alternate-continuity rows grouped by story name in a final band | S2 | re-express (ALT rows + eras; see V-14) |
| F-48 | Newest era first (reverse order) | S3 | present (99-display: bands and eras reversed, rows keep reading order, figures unchanged) |
| F-49 | Table view (compact rows) | S4 | present (9h-banners: a root flag, with badge words folding to glyphs that keep full names; test/layout/50-table: L-7, L-8, titles keep half the row, every control still reachable at 24 px) |
| F-50 | Badges on/off; combo badge; tap-to-reveal notes; notes-only; hide skipped | S3 | present (99-display: badges, combo, tap to reveal, notes only; hide skipped in 92-filters) |
| F-51 | Dyslexia font | S4 | present (9g-look: a root attribute; test/layout/40-look: the body face becomes the dyslexia-friendly stack) |
| F-52 | Seven paper swatches (default, warm, grey, rose, mint, sky, lilac) | S4 | present (9g-look: seven named swatches; 80-guards: one block per swatch colours the page and its own button; test/layout/40-look: contrast in every skin × swatch) |
| F-53 | Density (compact/normal/roomy), text size (S/M/L), mark style (box/dot/web) | S4 | re-express → present (density and text size in 9g-look and test/layout/40-look: row height compact < normal < roomy; text × 0.9 / 1 / 1.15. Mark style is box / dot / tick and cross: v2's "web" was one franchise's motif, replaced by XM-17) |
| F-54 | Button size compact/standard/large (large ≥ 44 px) | S4 | present (9g-look: three options, standard by default; test/layout/40-look: compact 26 px mark, large ≥ 44 px glyph buttons) |
| F-55 | Era hue scheme (split / mono) | S4 | re-express → present (era colours derived per era index from tokens — split by the golden angle, or one colour; test/layout/40-look: 64 eras × 4 skins, AA on every wash) |
| F-56 | Three layouts (signature skin, tabbed, classic/pull skin) | S4 | re-express → present (one layout; the four skins are token sets — see V-5) |
| F-57 | Skin CSS beacon (`--skin-ok`) warns when styles.css is stale | S4 | present (9g-look: a stylesheet with an older or missing `--skin-ok` gets an "out of date" toast with Reload; 80-guards: the stylesheet carries the beacon app.js expects) |
| F-58 | Sticky stack measured at runtime (`--tabs-h`, `--stack-h`) | S4 | present (one sticky `#stack` holds the tabs, the banner and the mini bar; a ResizeObserver measures it into `--stack-h`, which drives `scroll-margin-top`. test/layout/60-stack: --stack-h equals the measured height and follows the banner; row jumps and era chips land below the stack) |
| F-59 | Full offline PWA: network-first shell, cache-first fonts/icons, skipWaiting + clients.claim | S4 | present (test/layout/70-pwa: installs and claims the page; offline, a reload boots from the cache with the server down; a deploy shows at once online (network-first shell); fonts from the cache; every fetch path ends in a real Response) |
| F-60 | Data: per-issue medium, legend, maintenance notes, counts (total/core/mandatory/essential/gapnotes/renumbers), timeline order, alt order | S1 | present — data (20-build: media, counts incl. gap notes/renumbers, timeline, altKey); UI later |

## S — v2 settings (control → store → default)

v3 has **one** settings store (trap: "two stores for one setting"); the v2
store is listed only to record where the value lived.

| ID | Control (v2 id) | v2 store | Default | Session | Status |
|---|---|---|---|---|---|
| S-1 | Layout `#segLayout` | settings.layout | signature | S4 | re-express → present (one layout; the skin control is Settings → Look → Skin, see S-25) |
| S-2 | Density `#segDensity` | view.density | normal | S4 | present (settings.density; 9g-look, test/layout/40-look) |
| S-3 | Text size `#segFont` | view.font | md | S4 | present (settings.textSize, a scale multiplier; 9g-look, test/layout/40-look) |
| S-4 | Paper `#bgRow` (7 swatches) | view.bg | 0 | S4 | present (settings.paper, seven swatches; 9g-look, test/layout/40-look) |
| S-5 | Marks `#segMark` | view.mark | box | S4 | present (settings.marks: box / dot / tick and cross; 9g-look: the glyphs change, screen-reader labels don't) |
| S-6 | Era hues `#segEraScheme` | settings.eraScheme | split | S4 | re-express → present (settings.eraHues: one per era / one colour, offered only with two or more eras; 9g-look, 9f-visibility, test/layout/40-look) |
| S-7 | Table view `#tableChip` | view.table | off | S4 | present (settings.table, Display → Rows; 9h-banners) |
| S-8 | Badges `#badgeChip` | view.badges | on | S3 | present (99-display) |
| S-9 | Dyslexia font `#dysChip` | view.dys | off | S4 | present (settings.dys; 9g-look, test/layout/40-look) |
| S-10 | Mini progress bar `#miniChip` | view.mini | on | S4 | present (settings.mini, Display → Progress, on by default; 9h-banners) |
| S-11 | Persistent banner `#bannerChip` | settings.banner | off | S4 | present (settings.banner, Display → Progress, off by default; 9h-banners) |
| S-12 | Combo badge `#comboChip` | view.combo | off | S3 | present (99-display) |
| S-13 | Newest era first `#revChip` | view.rev | off | S3 | present (99-display) |
| S-14 | Hide skipped `#skipChip` | view.hideSkip | off | S2 | present (92-filters: Reading section) |
| S-15 | Notes only `#notesChip` | view.notesOnly | off | S3 | present (99-display: a display-only filter chip in the panel's Reading section) |
| S-16 | Tap to reveal notes `#revealChip` | view.reveal | off | S3 | present (99-display) |
| S-17 | Jump to first unread on load `#autoChip` | view.auto | off | S3 | re-express → present (decided 3 Oct): no checklist jump, because the landing is always collapsed; the Reading tab resumes at the first unread (9a-reading: boot on Reading resumes, checklist stays collapsed) |
| S-18 | Pace `#segPace` | view.pace | 12/week | S3 | present (98-tabs-settings) |
| S-19 | Progress mode `#segProgress` | settings.progressMode | combined | S3 | present (98-tabs-settings) |
| S-20 | Button size `#segTap` | view.tap | standard | S4 | present (settings.tap; 9g-look, test/layout/40-look) |
| S-21 | Refresh reminder `#segRefresh` | settings.refreshEvery | quarterly | S3 | present (98-tabs-settings) |
| S-22 | Swipe to mark `#swipeChip` | view.swipe | off | S3 | present (9c-bulk-touch: off by default, decided 3 Oct) |
| S-23 | Long-press bulk-mark `#pressChip` | view.press | off | S3 | present (9c-bulk-touch: off by default, decided 3 Oct) |
| S-24 | Presets `#presetRow` | view.presets | [] | S3 | present (9d-story-filters: settings.presets, filters stored by name) |
| S-25 | Theme `#themeBtn` | settings.theme | default | S4 | re-express → present (settings.skin from the data's skins, default from config; offered only with two or more skins; 9g-look, 9f-visibility) |
| S-26 | Reading/timeline order `#orderChip` | settings.viewOrder | reading | S2 | present (92-filters) |
| S-27 | Dual order `#cloneChip` | settings.cloneOrder | epic (A) | S2 | present (92-filters) |
| S-28 | Collapsed eras / bands | settings.collapsed / pcollapsed | persisted | S2 | re-express → present: always collapsed, expand state session-only (90-render, 70-shell) |
| S-29 | Active tab | settings.tab | app | S2 | present (98-tabs-settings) |
| S-30 | Filter state (depth, types, strands, mo, media, era, q, unreadOnly, alt) | filters | everything / all on | S2 | present — persisted by name, search session-only (92-filters) |
| S-31 | Refresh-seen timestamp | settings.refreshSeen | first run | S3 | present (98-tabs-settings) |

## T — v2 `test.js` assertions (all 123)

Each must be re-expressed in the v3 harness against the real DOM, or dropped
with a reason. "re-express" means the v2 assertion tested a v2 structure that
v3 replaces by design — the named v3 assertion replaces it.

| ID | v2 assertion | Session | Status |
|---|---|---|---|
| T-1 | no runtime errors at boot | S1 | present (70-shell) |
| T-2 | exactly one #tabs nav | S3 | present (98-tabs-settings) |
| T-3 | every issue rendered a row | S2 | re-express → present (90-render: lazy, every in-view row of an opened era renders once) |
| T-4 | mark buttons are delegation-tagged | S2 | present (90-render) |
| T-5 | delegated mark click cycles state | S2 | present (91-marks) |
| T-6 | delegated mark cycles back round | S2 | present (91-marks) |
| T-7 | delegated bookmark toggles | S2 | present (91-marks) |
| T-8 | delegated note badge opens a popover | S2 | present (91-marks) |
| T-9 | delegated note badge closes again | S2 | present (91-marks) |
| T-10 | six new settings chips exist | S3 | re-express → present (99-display: the Display section's toggles) |
| T-11 | settings panel is sectioned (≥4 heads) | S3 | present (98-tabs-settings: 5 section heads) |
| T-12 | notes-only narrows the list | S3 | present (99-display) |
| T-13 | notes-only restores | S3 | present (99-display) |
| T-14 | newest-era-first reverses the order | S3 | present (99-display) |
| T-15 | reverse toggles back | S3 | present (99-display) |
| T-16 | tap-to-reveal sets the root flag | S3 | present (99-display) |
| T-17 | combo badge sets the root flag | S3 | present (99-display) |
| T-18 | bulk era selects are populated | S3 | present (9c-bulk-touch) |
| T-19 | range selects default to full span | S3 | present (9c-bulk-touch) |
| T-20 | touch chips exist | S3 | present (9c-bulk-touch) |
| T-21 | bulk mark era marks rows read | S3 | present (9c-bulk-touch) |
| T-22 | bulk unmark era clears them | S3 | present (9c-bulk-touch) |
| T-23 | bulk mark range covers more than one era | S3 | present (9c-bulk-touch) |
| T-24 | swipe toggle flips | S3 | present (9c-bulk-touch) |
| T-25 | long-press toggle flips | S3 | present (9c-bulk-touch) |
| T-26 | period bands rendered | S2 | present (90-render) |
| T-27 | no period bands (franchise has none) | S2 | present (90-render) |
| T-28 | story band renders once | S2 | re-express (ALT track, V-14) |
| T-29 | story band is last | S2 | re-express (V-14) |
| T-30 | final band groups by story name | S2 | re-express (V-14) |
| T-31 | no repeated story headings | S2 | re-express (V-14) |
| T-32 | final band holds its rows | S2 | re-express (V-14) |
| T-33 | period heads have names | S2 | present (90-render) |
| T-34 | eras nest inside periods | S2 | present (90-render) |
| T-35 | all rows inside a period | S2 | present (90-render) |
| T-36 | filters visible on Checklist in tabs | S2 | re-express → present (92-filters: panel above the checklist) |
| T-37 | build tag and sw cache version agree | S1 | present (70-shell + 80-guards: build tag = sw.js cache hash) |
| T-38 | signature ramp text clears WCAG AA on its dark surface | S4 | re-express → present (test/layout/40-look: every skin's era text, years, counts and finish-by clear 4.5:1 on its wash, for 64 eras, split and one colour) |
| T-39 | signature era ramp is flat | S4 | re-express → present (test/layout/40-look: washes are pale — luminance ≥ 0.7, or ≤ 0.08 on Night — neighbours differ, one colour is one colour) |
| T-40 | signature filter chips have a visible border | S4 | re-express → present (test/layout/40-look: chip, button, search and mark outlines clear the 3:1 non-text ratio in every skin × paper) |
| T-41 | filters survive a round trip through Reading | S3 | present (98-tabs-settings round trip through Settings; 9a-reading through Reading) |
| T-42 | isTabbed covers every non-classic layout | — | dropped: one layout (spec §1) |
| T-43 | paper + era-hue controls hidden on the signature skin | S4 | re-express → present (no control is ever hidden by a skin: V-5) |
| T-44 | refresh interval is actually consumed, not just stored | S3 | present (98-tabs-settings) |
| T-45 | title follows the text-size setting | S4 | present (test/layout/40-look: the title is 25.2 / 28 / 32.2 px at small / medium / large) |
| T-46 | button size reads and writes the same store applyView uses | S2 | re-express → present (93-storage: one settings object) |
| T-47 | pending writes flush when the app is hidden | S2 | present (70-shell) |
| T-48 | no function is defined twice | S1 | present (80-guards: brace-depth scan, scanner self-tested) |
| T-49 | bookmarks open a list, not a jump to the first one | S3 | present (98-tabs-settings) |
| T-50 | persistent banner toggle exists | S4 | present (9h-banners) |
| T-51 | persistent banner is off by default | S4 | present (9h-banners) |
| T-52 | reading tab labels vary by medium | S3 | present (9a-reading) |
| T-53 | review button is targetable by class | S2 | present (9b-reviews: `.b.rv` on every arc head) |
| T-54 | button size seg has 3 options | S4 | present (9g-look) |
| T-55 | button size defaults to standard | S4 | present (9g-look) |
| T-56 | compact size restores the original 26px mark | S4 | present (test/layout/40-look) |
| T-57 | glyph buttons usable at standard, 44px at large | S4 | present (test/layout/40-look: standard ≥ 24 px, large ≥ 44 px for mark, bookmark and star) |
| T-58 | depth chips built | S2 | present (92-filters) |
| T-59 | progress mode seg has 2 options | S3 | present (98-tabs-settings) |
| T-60 | refresh reminder seg has 4 options incl. off | S3 | present (98-tabs-settings) |
| T-61 | refresh reminder offers an off switch | S3 | present (98-tabs-settings) |
| T-62 | type chips built | S2 | present (92-filters) |
| T-63 | mandatory/optional chips | S2 | re-express → present (92-filters: mandatory only) |
| T-64 | format row has one chip per medium | S2 | present (92-filters) |
| T-65 | no redundant Annuals chip | S2 | present (92-filters) |
| T-66 | media chips are labelled Comics/Games/Shows | S2 | present (92-filters: labels from data vocabulary) |
| T-67 | every issue has a medium | S1 | present (20-build: every row has a medium) |
| T-68 | media vocabulary is comic/game/screen | S1 | re-express → present (20-build: medium vocabulary comes from data; fixture uses comic/game/screen) |
| T-69 | no hardcoded franchise chip leaks into Characters | S1/S2 | present (80-guards static + 92-filters DOM) |
| T-70 | character chips match the strand list | S2 | re-express → present (92-filters: strand chips; 9d-story-filters: a chip per character with presence grades) |
| T-71 | character chips match the strand names | S2 | re-express → present (92-filters) |
| T-72 | unticking Optional reduces rows | S2 | re-express → present (92-filters) |
| T-73 | re-ticking Optional restores rows | S2 | re-express → present (92-filters) |
| T-74 | collapse/expand buttons exist | S2 | present (90-render) |
| T-75 | filter hides empty period bands | S2 | present (92-filters) |
| T-76 | filter leaves at least one band | S2 | present (92-filters) |
| T-77 | filter narrowed the bands | S2 | present (92-filters) |
| T-78 | search narrows the list | S2 | present (92-filters) |
| T-79 | band count reflects filtered total | S2 | re-express → present (92-filters: Showing N of M) |
| T-80 | clearing search restores all bands | S2 | present (92-filters: back to the collapsed landing) |
| T-81 | classic skin sets data-skin=pull | S4 | re-express → present (9g-look: a skin sets data-skin and nothing else in the page) |
| T-82 | classic skin uses the tabbed shell | — | dropped: one shell |
| T-83 | layout change lands on Checklist, not Settings | S4 | re-express → present (9g-look: a skin change keeps the current tab) |
| T-84 | classic skin shows filters | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-85 | classic skin has no hardcoded franchise chip | S1 | present (80-guards: no franchise or fixture strings in template code) |
| T-86 | search box present in classic skin | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-87 | classic skin has depth chips | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-88 | classic skin has character chips | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-89 | classic skin hides filters off-checklist | S3 | re-express → present (98-tabs-settings: the filter panel lives in the Checklist pane only) |
| T-90 | classic skin restores filters on checklist | S3 | re-express → present (98-tabs-settings: the filter panel lives in the Checklist pane only) |
| T-91 | classic skin: no filters on Reading | S3 | re-express → present (98-tabs-settings, 9a-reading: no filter panel on Reading) |
| T-92 | classic skin: no filters on Reviews | S3 | re-express → present (98-tabs-settings: the filter panel lives in the Checklist pane only) |
| T-93 | filters[hidden] is authoritative in CSS (`!important`) | S4 | re-express → present (80-guards: zero !important, and every [hidden] element computes to display:none against the real stylesheet) |
| T-94 | nothing sticky in tabbed mode either | S4 | re-express → present (one layout; the sticky stack is measured in test/layout/60-stack) |
| T-95 | depth control is a single nowrap row | S3 | present (99-display; test/layout/10-sweep measures one line with no chip hidden, 320–390 px, every skin, large text: the chips shrink and counts drop under names) |
| T-96 | nothing sticky in the classic skin | S4 | re-express → present (skins never change positioning: 80-guards token-only blocks; test/layout/60-stack pins the stack in every skin) |
| T-97 | layout seg has 3 buttons | S4 | re-express → present (9g-look: one option per configured skin, in order; one skin → no control) |
| T-98 | skin beacon present in styles.css | S4 | present (80-guards, 9g-look) |
| T-99 | classic option = pull skin | S4 | re-express → present (T-81) |
| T-100 | pull skin keeps the tab shell | — | dropped: one shell |
| T-101 | pull skin: tabs visible | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-102 | pull skin: period bands carry data-p | S2 | present (90-render: data-b) |
| T-103 | leaving classic clears the skin | S4 | present (9g-look: moving to another skin leaves no trace of the last) |
| T-104 | default layout = signature | S4 | re-express → present (9g-look: franchise.skin opens a first visit; the build validates it against franchise.skins) |
| T-105 | phead visible in tabs | S2 | present (90-render) |
| T-106 | topbar hidden in tabs | — | dropped: no topbar shell |
| T-107 | signature option uses the tabbed shell | — | dropped: one shell |
| T-108 | signature option sets data-skin=signature | S4 | re-express → present (T-81) |
| T-109 | signature skin hides the topbar | — | dropped |
| T-110 | signature skin keeps the tab nav | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-111 | signature skin keeps the progress header | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-112 | signature skin: checklist visible | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-113 | signature skin hides the gear | — | dropped: no gear (Settings tab) |
| T-114 | signature skin: Settings tab opens the pane | S3 | present (98-tabs-settings) |
| T-115 | signature skin keeps the tab nav visible | S4 | present (V-5: 9g-look — a skin sets data-skin and changes no element; 80-guards — skin blocks set tokens only; test/layout/40-look — every control on every tab reachable in every skin) |
| T-116 | signature -> tabbed via seg works | S4 | re-express → present (9g-look: switching skins round-trips, the page unchanged) |
| T-117 | tabs: gear hidden again | — | dropped |
| T-118 | Reading tab shows stepper title | S3 | present (9a-reading) |
| T-119 | the done button persists a mark (label varies by medium) | S3 | present (9a-reading: Mark Beaten persists; D-1 regression) |
| T-120 | Reviews pane visible | S3 | present (9b-reviews) |
| T-121 | Settings pane visible | S3 | present (98-tabs-settings) |
| T-122 | Checklist pane visible again | S3 | present (98-tabs-settings) |
| T-123 | no runtime errors after interaction | S2 | present (90-render, 91-marks) |

## L — v2 `layout-check.py` assertions (all 9, real Chromium)

| ID | v2 assertion | Session | Status |
|---|---|---|---|
| L-1 | tabs are sticky | S4 | present (test/layout/60-stack: the stack holding the tabs is sticky, 4 skins, Checklist and Settings) |
| L-2 | tabs pinned to the top after scrolling | S4 | present (test/layout/60-stack: the tabs are at the top after scrolling 700 px) |
| L-3 | banner is sticky | S4 | present (test/layout/60-stack: the banner is pinned in the stack) |
| L-4 | banner sits directly under the tabs | S4 | present (test/layout/60-stack: the banner sits within 2 px of the tabs) |
| L-5 | band is not shifted onto its own intro | S4 | present (test/layout/60-stack: no band intro sits under its band head) |
| L-6 | no large gap between bands (≤16 px) | S4 | present (test/layout/60-stack: bands at most 16 px apart in every density) |
| L-7 | table view at least halves row height | S4 | present (test/layout/50-table: the median row height in table view is at most half the normal one, 4 skins × 320/390 px) |
| L-8 | no table row overflows the screen width | S4 | present (test/layout/50-table: no table row wider than the screen — 944 rows, 4 skins × 320/390 px × default and largest settings) |
| L-9 | no runtime errors | S4 | present (test/layout/10-sweep: no page or console errors on every tab, 4 datasets × 320/360/390 px, everything open; caught a font 404) |

Also from v2's docs and deploy checklist (carried as process, CLAUDE.md):
verify every SW path exists on disk (→ guard), manifest franchised, icons
replaced, verify deploy by hash, first deploy uploads everything, open the
installed app once online.

## D — the 13 known template defects (each needs a regression test)

| ID | Defect | Fix at source | Session | Status |
|---|---|---|---|---|
| D-1 | Reading-tab mark doesn't update era counters | one mark path for every surface; assert counters move from a Reading-tab mark | S3 | present (9a-reading: a Reading-tab mark moves the header, band and era counters and the time left; mutation: bypassing setMark fails it) |
| D-2 | `sw.js` precaches no fonts or icons | precache list generated from disk; guard asserts fonts + icons present and every path exists | S4 | present (80-guards: 12 fonts + icons, every path exists; test/layout/70-pwa: a real install caches every precached file, and fonts load offline) |
| D-3 | hardcoded franchise chip + filter branch | no franchise strings in template code (guard) | S1 | present (80-guards) |
| D-4 | review button has no distinguishing class | `.b.rv` targetable | S2 | present (9b-reviews: `.b.rv` targetable, opens the arc's review editor) |
| D-5 | phantom "Elseworlds (ALT)" era appended | build never adds an era not in the data | S1 | present (20-build: output eras == dataset eras) |
| D-6 | empty strand list blanks the app | build inserts one universal strand | S1 | present (20-build: 64-era stress with no strands → one universal strand) |
| D-7 | sync placeholder hardcoded to another tracker's prefix | QR/sync prefix derived from `franchise.key` | S3 | present (9e-sync: prefix from franchise.key, e.g. FIXTURE: / BIG:; another tracker's code is refused) |
| D-8 | workbook columns read by position | named fields everywhere; build output independent of field order | S1 | present (60-validation: shuffled field order → byte-identical data.js) |
| D-9 | duplicate `switchTab` / `jumpToIssue` declarations | guard: no function defined twice | S1 | present (80-guards) |
| D-10 | triple `jumpToIssue` breaks jumps into collapsed sections | one `jumpToIssue` that expands ancestors | S2 | present (94-navigation) |
| D-11 | no save-flush when the app closes | flush on pagehide / visibilitychange | S2 | present (70-shell: pagehide and visibilitychange flush) |
| D-12 | era colour ramps cap at 26 | no cap; 64-era stress dataset builds and (S4) styles | S1/S4 | present (20-build: 64 eras build; test/layout/40-look: all 64 styled, AA in every skin) |
| D-13 | template icons and manifest name leak into builds | manifest, icons, theme from config; guard | S4 | present (franchise.icons from config, each checked as a PNG of its size — broken/icon-wrong-size, broken/icon-missing; the manifest and page links follow it, and a tracker on the template's placeholder icons is warned: 9i-pwa, 20-build, 80-guards) |

## V — spec additions (v3 requirements v2 lacks)

| ID | Requirement | Session | Status |
|---|---|---|---|
| V-1 | Whole-app event delegation: ≤12 listeners total (guard) | S1/S2 | present — guard (80-guards static ≤12, 70-shell runtime ≤12) |
| V-2 | String templating with `escapeHtml` / `escapeAttr` everywhere | S2 | present (80-guards, 90-render escaping) |
| V-3 | Always collapsed on load, no setting; expand state session-only | S2 | present (90-render, 92-filters, 96-figures: boots collapsed even with saved filters) |
| V-4 | Every band has its own identity (era index + occurrence) | S2 | present (90-render) |
| V-5 | ONE layout; skins are pure CSS and never move or hide a control; reachability guard proves every control reachable in every skin | S4 | present (one layout. 80-guards: skin, paper and Look blocks are bare `:root[data-…]` token sets with no position, display or size. 9g-look: switching skins changes no element, class, id or hidden state. test/layout/40-look: every control on every tab is displayed, at least 24 × 24 px, in view and the element hit at its centre, in 4 skins × 390/320 px × default and largest settings — 5,328 checks) |
| V-6 | Goal banners: name, years, read count, progress bar, "days left" pace | S2 | present (90-render, 95-pace: name, years, count, bar, time left, cumulative finish-by) |
| V-7 | Keyboard navigation and shortcuts | S4 | present (9j-a11y: on the Reading tab ← / → step, R reads, X skips; "/" goes to search from any tab; the arrow keys, Home and End move between tabs (ARIA tabs pattern); nothing fires while typing or with Ctrl/⌘. `keydown` is listener 10 of 12) |
| V-8 | Fast first paint: critical CSS inline, preloaded display font, non-blocking data | S4 | re-express → present (John's answer 2: one stylesheet, the display font preloaded, the scripts deferred, measured in test/layout/80-paint: the shell paints at once with data.js or every font 2 s late; on a 1.6 Mbps link the display font lands by first paint; every @font-face swaps. Inlining was not chosen) |
| V-9 | One colour-token block (guard: exactly one); zero `!important` (guard) | S1/S4 | present — guards (80-guards: one :root colour block, zero !important) |
| V-10 | Essential / Complete event toggle in Settings; progress and counts recompute; "Complete view adds N issues" on event headers | S1 data / S3 UI | present (9d-story-filters: Story chips + Settings, a plan setting; totals recompute; "Complete view adds N issues" on the event's own arc heading, tap to switch) |
| V-11 | Presence tags (major/minor/cameo), character filter defaults to meaningful appearances, cameo toggle | S1 data / S3 UI | present (9d-story-filters: appearances per character, major + minor by default, Include cameos) |
| V-12 | Depth tier independent of M/O; optional Importance 1–5 | S1 data / S2 UI | present (data: tier independent of M/O, 20-build; 9d-story-filters: importance on arc headings) |
| V-13 | Era-ranked compound sort keys, derived; Alt Sort Key = publication order | S1 | present (20-build, 30-identity) |
| V-14 | ALT continuity rows build, order, and are skipped by the per-series check (replaces v2's story band) | S1 data / S2 UI | present — data (30-identity: ALT order + per-series skip); UI S2 |
| V-15 | Rows render only when an era is first expanded (resolves the `content-visibility` conflict; decide S4) | S2/S4 | present — closed 4 Oct (John): lazy rendering replaces `content-visibility`. 90-render, 92-filters: the 5,000-row dataset renders only opened or matching eras |
| V-16 | Storage namespaced from `franchise.key`; migration hook (`storage.legacy: {prefix, format}`) | S2 | present (70-shell namespacing, 93-storage read-only `storage.legacy` v2 reader) |
| V-17 | PWA: cache name and build tag derived from a content hash; icons, manifest name, theme colour from config | S1 hash / S4 | present (20-build, 80-guards: hash; 9i-pwa: data.js names the cache and lists the worker's files; icons, manifest name and theme colour from config) |
| V-18 | aria roles and labels; `prefers-reduced-motion` | S4 | present (9j-a11y: every control named on every tab with everything open; aria references resolve; valid states; no duplicate ids; the tabs pattern; landmarks; polite live regions; marks named with their state. Reduced motion: test/layout/20-motion) |
| V-19 | `sw.js` evaluated, not just parsed (guard) | S1 | present (80-guards: sw.js run in a vm, install/activate/fetch exercised) |
| V-20 | Harness in GitHub Actions on every push; fails on zero assertions | S1 | present (.github/workflows/harness.yml + 00-runner) |
| V-21 | Harness passes on fixture, fixture without periods, and one real dataset (Absolute pilot, in the fresh repo ASIMKARD/Absolute-v3, starting at v8) | S1/S5 | todo |
| V-22 | `verify.py` gate (Research-Repo toolkit) wired in — a pinned, unchanged copy runs in CI with its Research-Repo commit and hash recorded (John, 6 Oct) | S5 | present (`tools/verify.py` byte-identical, `tools/verify.lock` (18141dd, sha256); `tools/verify_gate.py`: the pin, the build, verify.check on the stitched dataset adapted by name, and check_shown (v3's check_built) on the order shown; CI runs it on the template and every fixture. 23-verify-gate: the pin and a local drift check, every fixture passes, the adapter by name (dates, inert rows, arcs, field order), and gate/ fixtures stopped: interpolated date, backwards numbering, duplicate title, blocked series) |
| V-23 | `build_workbook.py` generates the workbook from `dataset.json`, reading by header name | S5 | todo |
| V-24 | Stable `id` (progress) separate from canonical `issueId`; events dedupe on `issueId`; id-stability check with `retiredIds` | S1 | present (20-build id stability, 30-identity) |
| V-25 | Canonical events in `events/`, each stating its era in `dataset.json`; drift check by hash | S1 | present (30-identity placement, 50-events hash drift) |
| V-26 | Export and import (file backup) | S3 | present (9e-sync) |
| V-27 | Undo on bulk mark restores the previous states (see B-2) | S3 | present (9c-bulk-touch: Undo restores every touched row's previous state) |
| V-28 | Docs: README, BUILD-NOTES, MIGRATING, `comic-tracker-build` Skill in `.claude/skills/` | S5 | todo |
| V-29 | Per-format durations (decided 1 Oct, untimed 3 Oct). Comics are one issue each at minutes per issue. Shows use `durations: {screen: N}`, which a row can override. Games carry their own `duration`, and a missing one warns with a coverage %, adds nothing and shows `+N untimed`. Time left sums each row's own minutes. Finish-by = minutes left ÷ (issues/week × minutes/issue), and comics-only results are bit-identical to session 2 | S3 | present (97-durations: build + coverage warning, own-minutes figures, untimed marker, format-as-plan totals, comics-only exactness on 4 datasets × 12 pace pairs + exhaustive arithmetic) |
| V-30 | Data-driven visibility (John, 4 Oct; CLAUDE.md → UI rules): a control or section renders only when the dataset gives it something to do, decided by one capability map built from the data | S4 | present (9f-visibility: 36 controls × 19 capabilities. On `minimal` none appear and the controls every tracker has do; on the full fixture all appear. Second order measured on `mixed`; saved filters for controls that aren't offered are ignored; forcing each capability on is caught) |
| V-31 | Collapsible Settings (John, 4 Oct): sections collapse like the filter panel, with icon, name and one-line summary; all collapsed by default; open state remembered; same animation and tokens | S4 | present (98-tabs-settings: one section component for the panel and Settings; collapsed by default with inert bodies; live summaries; open state saved after the debounce and restored on the next visit; toggled in place) |

## CR — creator credits (decided 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| CR-1 | Writer(s) + artist(s) on every arc/run; several names per role | S1 | present (40-credits) |
| CR-2 | Per-issue overrides (replace only the roles they name) | S1 | present (40-credits) |
| CR-3 | Mid-run splits by `fromId` (a row id) | S1 | present (40-credits) |
| CR-4 | Full canonical names; surname-only fails unless in `creatorMononyms`; conflicting spellings fail | S1 | present (40-credits, 60-validation) |
| CR-5 | Build-time creator index: name → writer / artist issue counts | S1 | present (40-credits: brute-force recount) |
| CR-6 | Coverage % reported; missing credits warn; `strictCredits` makes them fail | S1 | present (40-credits: 98.3%, warn vs strict) |
| CR-7 | Searchable creator picker with issue counts and a writers / artists switch | S3 | present (9d-story-filters: picker by count, writers / artists switch, typed narrowing) |
| CR-8 | Tappable creator names on each run filter to that creator's work | S3 | present (9d-story-filters: credited names on arc heads are buttons; exact match through the creator index, proved on "Writer Number1" vs "…10–19") |
| CR-9 | Search matches creator names | S2 | present (92-filters) |
| CR-10 | Creator filter appears in the active-filter chips and Creators header summary | S3 | present (9d-story-filters: chip "Creator: “X” as writer/artist" and the Creators summary) |

## FP — collapsible filter panel (approved mockup `starter/v3/filter-panel-mockup.html`, 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| FP-1 | Panel opens where it does in the current trackers; only its inside is reorganised | S2 | present (92-filters) |
| FP-2 | Five sections in order: Reading, Story, Characters, Creators, Order and display | S2 | present (92-filters) |
| FP-3 | Reading: depth tier, unread only, hide skipped, mandatory only | S2 | present (92-filters) |
| FP-4 | Story: era, Essential/Complete events, type, ALT | S2/S3 | present (92-filters: era, type, format, ALT; 9d-story-filters: Essential / Complete) |
| FP-5 | Characters: presence filters + include-cameos toggle | S3 | present (9d-story-filters) |
| FP-6 | Order and display: reading vs publication order, alternate stories | S2 | present (92-filters) |
| FP-7 | Collapsed header shows icon, section name, one-line summary of what's active, chevron — nothing applied is ever hidden | S2 | present (92-filters: summaries) |
| FP-8 | Removable chips at the top for every active filter, active count, Clear all | S2 | present (92-filters: removable chips, count, Clear all) |
| FP-9 | Live "Showing N of M issues" and Save as preset at the bottom | S2/S3 | present (92-filters: Showing N of M; 9d-story-filters: Save as preset) |
| FP-10 | All sections start collapsed; open state remembered (namespaced storage) | S2 | present (92-filters: collapsed by default, remembered) |
| FP-11 | Smooth expand/collapse, honours reduced motion, uses the single token system | S4 | present (98-tabs-settings: one shared rule animates the body's grid row 0fr → 1fr; every duration scales with `--motion`, which reduced motion sets to 0. Real Chromium: test/layout/20-motion, through the browser's own animation list: opens and shuts with a grid-template-rows transition, and under reduced motion no element has any duration) |
| FP-12 | Sections are buttons with `aria-expanded`; delegated (counts toward the ≤12 listeners) | S2 | present (92-filters: aria-expanded, delegated) |

## XM — X-Men features v2 lacks

| ID | X-Men feature | Session | Status |
|---|---|---|---|
| XM-1 | Era divider banners: name, years, read/total, skipped count, progress track, time left, ✓ when complete (the goal banner, V-6) | S2 | present (90-render, 95-pace) |
| XM-2 | Pace as minutes per issue (quick 8 / average 15 / deep 25) driving "time left" per banner | S2/S3 | present — both, decided 2 Oct (95-pace); shows and games use their own durations (V-29, 97-durations) |
| XM-3 | Reading-tab keyboard shortcuts: ← / → step, R read, X skip; ignored in inputs | S4 | present (folds into V-7; the Reading card shows the keys on devices with a keyboard) |
| XM-4 | Pinned bar: bookmarked issues as a scrollable chip row atop the checklist, tap to jump | S3 | present (98-tabs-settings) |
| XM-5 | File backup: export JSON download, import from file | S3 | present (9e-sync: export `<key>-backup-YYYY-MM-DD.json`, import from file) |
| XM-6 | QR as a URL (`#sync=…`) that imports on open and **merges** (never downgrades read), reporting counts | S3 | present (9e-sync: #sync= imports on open, merges, never downgrades read, reports counts, clears the link) |
| XM-7 | "Check for updates" button (`reg.update()`) | S4 | present (9i-pwa: Check for updates calls reg.update(), says "latest", waits for a connection offline, reports a failure; test/layout/70-pwa: finds a real new worker) |
| XM-8 | Era navigation style: chips / dropdown / scroll | S3 | present (99-display: a jump bar, chips or dropdown, that opens and scrolls to an era and never filters; plain scroll is the default) |
| XM-9 | Landmarks-only filter; landmarks inline vs tap-to-reveal | S3 | re-express → present (99-display: landmarks are the row note, so landmarks-only = notes only and inline vs tap = tap to reveal) |
| XM-10 | Gap notes on/off | S3 | present (99-display) |
| XM-11 | Bulk mark an arc (read / unread) | S3 | present (9c-bulk-touch: Mark arc read / unread on the arc head, whole arc) |
| XM-12 | Swipe with visual feedback (row slides, coloured backing shows the action) | S3 | present (9c-bulk-touch: row slides over a coloured backing, data-swipe read / read-go; real Chromium: 28 px translate) |
| XM-13 | Haptic tick on long-press (`navigator.vibrate`) | — | dropped: haptics declined in an earlier round, as the X-Men code notes (re-confirmed 3 Oct); a guard asserts `navigator.vibrate` is never called (S3 step 6) |
| XM-14 | Incremental count refresh (ancestor stats update without a full re-render) | S2 | present (91-marks: refreshStats) |
| XM-15 | Arc issue list rendered on expand (lazy) — basis of V-15 | S2 | present (90-render) |
| XM-16 | `escapeHtml` / `escapeAttr` string templating (V-2) | S2 | present (80-guards) |
| XM-17 | Read-mark style tick / cross | S4 | present (folds into S-5: tick and cross) |
| XM-18 | Font size as a scale multiplier | S4 | present (folds into S-3: a scale multiplier) |
| XM-19 | Show/hide the jump button | S3 | present (98-tabs-settings) |
| XM-20 | Remembered expanded eras | — | dropped: spec §1 — always collapsed on load, expand state session-only |

## X — extra lines (John, 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| X-1 | Display mode "layout C": per-row arc labels with no arc headers (Archie's arrangement) | S3 | present (99-display: "Label on each row" arc headings) |
| X-2 | Import old-tracker backups and QR codes via `storage.legacy` (prefix, format, qrPrefix) | S3 | present (98-tabs-settings: Import from previous version; 9e-sync: old v2 codes via `qrPrefix`, positions rebuilt with retiredIds) |
| X-3 | Sync and backup formats keyed on stable `id`, versioned, tolerant of rows added since (unknown ids ignored, new rows default unread) — replaces v2's positional bitstring that refused any data change | S3 | present (9e-sync: full format keyed on id, versioned, unknown ids ignored and reported, new rows unread) |
| X-4 | Buttons fit on the phone (John's screenshots, 5 Oct): a Settings row's controls move as one block, beside the label or under it, never split; no control is cut off by a box that clips it | S4 | present (98-tabs-settings: label + one control block; test/layout/10-sweep: no split rows, nothing clipped, every tab, 320–390 px) |
| X-5 | Readable version numbers (John, 4 Oct): header "vN", About shows the hash in small print; the build counts up from the previous `data.js` when the content hash changes; `franchise.versionStart` continues a migrated tracker's numbering; the cache name still follows the hash | S5 | present (21-version: first build = versionStart, unchanged rebuild keeps it, a content change adds exactly 1, versionStart lifts but never lowers it and never feeds the hash or cache name, `--check` deterministic and read-only, bad versionStart fails; header "v13", About "Version 13" + hash, Offline row, toast (9i-pwa)) |
| X-6 | Signature skin slot (John, 6 Oct): one per-tracker skin from config (tokens, fonts, optional scoped look-only stylesheet) passing the same contrast, reachability, overflow and stack tests; demo in a fixture | S5 | present (22-signature: the build accepts input tokens only (Look-setting tokens read from styles.css and refused), fonts in fonts/ (precached, swap), and a stylesheet scoped to the skin with look properties only — an unscoped selector, a `position`, a literal colour, at-rules, !important, named colours and every moving or hiding property fail; broken/signature-*; the CSS arrives in data.js and is added once (80-paint: no extra request, a tie with a linked file). Demo "Signal" in the basic fixture, measured in 40-look (contrast × 7 papers, 64 eras, reachability), 10-sweep, 60-stack, 20-motion, 30-css) |
| X-7 | Skin choice is "last used" per tracker; a first visit uses the old tracker's pick from legacy settings, else the signature skin (John, 6 Oct) | S5 | present (22-signature: `storage.legacy.skins` {field, map}, validated against the skins offered; the old pick through the map, an unmapped or unreadable value → the signature skin, else `franchise.skin`; the last skin used wins later; the old settings key is never written. 9g-look: the next visit opens in the same Look) |
| X-8 | Pull matches X-Men exactly (fonts, sizes, weights, spacing, colours, era boxes), measured side by side at 393 px in real Chromium (John, 6 Oct) | S5 | present, 71 properties exact; 9 recorded differences: 2 kept accessible by rule (tab underline, search outline), 7 awaiting John (era box colours, edge-to-edge tab bar, mark size and shape). test/layout/45-pull against ref/x-men.json (X-Men 663fe46), the list kept true both ways; a fresh capture re-checks the reference when a local copy is present |

## B — v2 bugs found while inventorying (don't port them)

| ID | Bug | v3 handling | Status |
|---|---|---|---|
| B-1 | `#paneReading` and `#paneReviews` are each declared **twice** in v2's HTML | guard: no duplicate ids in the shell | present — guard (80-guards: no duplicate ids in index.html) |
| B-2 | Bulk-mark undo deletes every touched mark instead of restoring prior states (a `reading` row becomes `unread`) | undo snapshots previous states (V-27) | present (9c-bulk-touch: "reading" comes back as reading, "skip" as skipped; v2's delete-all undo fails 6 assertions) |
| B-3 | Swipe marks write `state.progress` directly, bypassing the mark path (no Reading/banner refresh) | one mark function for every surface (D-1) | present (one setMark path; 91-marks) |
| B-4 | QR import replaces progress wholesale; the code is rejected after any data change (`dataVersion`) | merge import keyed on ids (X-3, XM-6) | present (9e-sync: Merge keyed on ids; the full code survives list changes; only the compact QR is tied to the dataVersion) |
| B-5 | `jumpBtn` falls back to `alert()` while everything else uses the toast | toast everywhere | present (94-navigation) |
| B-6 | About box and others set inline `style` attributes | no inline styles in templates; tokens only | present (80-guards, 90-render: no [style] in rendered markup) |
