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
| F-1 | Checklist tab: rows grouped period band → era → arc, ordered by sort key | S2 | todo |
| F-2 | Reading tab: one-issue stepper (n of N, era pill, title, arc · type, note, arc blurb, Skip / Mark Read, Prev / Pin / Next); resumes at first unread until the user steps | S3 | todo |
| F-3 | Reviews tab: 1–5 stars + text per issue, list sorted by key, tap to jump to the issue | S3 | todo |
| F-4 | Settings tab, sectioned: Display, Reading behaviour, Touch controls, Bulk actions, Data | S3 | todo |
| F-5 | Four-state marks cycling unread → reading → read → skip; done = read or skip | S2 | todo |
| F-6 | Medium-aware labels: comic Read/Reading, game Not started/Playing/Beaten, screen Unwatched/Watching/Watched; Reading-tab button verb follows | S2 | todo |
| F-7 | Inert rows (GAPNOTE, RENUM) render as notes with no mark and never count toward progress | S2 | todo |
| F-8 | Row badges: ★ core, ↺ flashback (popover note), alt (popover note), bookmark ☆, review ✎ (`.b.rv`), external "read ↗" lookup link (franchise `searchUrl`, falls back to a web search) | S2 | todo |
| F-9 | Row subnote shown under the title when a note exists and isn't a FB/ALT popover | S2 | todo |
| F-10 | Period band heads: name, years label, blurb intro, done/total count | S2 | todo |
| F-11 | Era heads: name, "cont." when an era recurs, intro once, done/total count; arc heads: name ("· cont."), year · title meta, blurb (suppressed when equal to era intro) | S2 | todo |
| F-12 | Counts reflect the current filters (tallyEras counts only visible rows) | S2 | todo |
| F-13 | Empty bands/eras/arcs hide under a filter; "Nothing matches these filters." empty state | S2 | todo |
| F-14 | Global progress: count, %, bar, `aria-valuenow`; progress mode combined vs per medium | S2 | todo |
| F-15 | Progress header (phead): title, offline-edition line, strapline + build tag, bar, "n / N read", days remaining | S2 | todo |
| F-16 | Persistent banner (off by default): one compact progress line per medium, sticky under the tabs | S4 | todo |
| F-17 | Mini progress bar (on by default) | S4 | todo |
| F-18 | Pace estimate: issues/week (light 5, steady 12, heavy 25, marathon 50) → "N left · W weeks · done Mon YYYY" | S3 | todo |
| F-19 | Filters: depth (Barebones/Essential/Everything with counts; Barebones is comics-only), type chips, priority M/O, format (one chip per medium), characters (strands) + all/none, era select, search (title, arc, note; debounced 180 ms), unread only, ALT tracks toggle, reset | S2 | todo |
| F-20 | Order chip: reading order vs Arc Master timeline order | S2 | todo |
| F-21 | Dual-order chip (franchise `dualOrder` config; hidden when unset) using the alternate sort key | S2 | todo |
| F-22 | Filter presets: save current filters by name, apply, delete | S3 | todo |
| F-23 | Bulk mark era read / unread; mark era range read; toast with undo | S3 | todo |
| F-24 | Swipe to mark (right = read, left = skip), opt-in | S3 | todo |
| F-25 | Long-press a band/era/arc head to bulk-mark it read, opt-in | S3 | todo |
| F-26 | Collapse all / expand all (Settings → Bulk actions) | S2 | todo |
| F-27 | Jump to next unread (button) and "jump to first unread" on load (setting) | S2 | todo |
| F-28 | Bookmarks: toggle per row, list in Settings sorted as displayed, jump, remove | S3 | todo |
| F-29 | `jumpToIssue`: switches to Checklist, expands collapsed ancestors outermost-first, scrolls, flashes the row; toast when filtered out | S2 | todo |
| F-30 | QR sync: 2-bit packed progress + bookmarks + settings + filters + reviews, franchise-prefixed code, QR when it fits, copy-code fallback, paste-to-import with confirm | S3 | todo |
| F-31 | About & legend box (legend + maintenance notes from data) | S3 | todo |
| F-32 | Clear all progress (confirm; keeps reviews and bookmarks) | S3 | todo |
| F-33 | Toast with optional action button | S2 | todo |
| F-34 | Refresh reminder (monthly/quarterly/yearly/off), first run starts the clock, dismiss resets | S3 | todo |
| F-35 | Offline readiness readout (Settings → Offline: ready / not ready / unsupported, files cached) | S4 | todo |
| F-36 | Online/offline toasts and body `.offline` class | S4 | todo |
| F-37 | Install prompt toast (`beforeinstallprompt`) and "Installed." | S4 | todo |
| F-38 | Service-worker update flow: "A new version is ready" → Reload | S4 | todo |
| F-39 | Theme button (default ↔ newsprint), theme-color meta follows | S4 | re-express (skins are CSS-only token sets) |
| F-40 | Franchise applied from data: document title, wordmark, strapline, theme-color, apple web-app title | S2 | todo |
| F-41 | Storage shim: `window.storage` → localStorage → in-memory fallback | S2 | todo |
| F-42 | Debounced 400 ms writes, flushed on `pagehide` / `visibilitychange` hidden | S2 | present (70-shell: debounce 400ms, pagehide + visibilitychange flush) |
| F-43 | Namespaced storage `<key>:v1:{progress,settings,filters,reviews}` | S2 | present (70-shell: keys `<key>:v3:*`) |
| F-44 | Keymap migration: `D.keymap` moves marks for re-keyed rows once, toasts the count | S2 | re-express (stable `id` + `retiredIds`; legacy import X-2) |
| F-45 | Saved-filter migration when the strand roster grows (new strands default on) | S2 | todo |
| F-46 | Layout-vocabulary migration (`lv`) | — | dropped: v3 has one layout |
| F-47 | Elsewhere/story band: alternate-continuity rows grouped by story name in a final band | S2 | re-express (ALT rows + eras; see V-14) |
| F-48 | Newest era first (reverse order) | S3 | todo |
| F-49 | Table view (compact rows) | S4 | todo |
| F-50 | Badges on/off; combo badge; tap-to-reveal notes; notes-only; hide skipped | S3 | todo |
| F-51 | Dyslexia font | S4 | todo |
| F-52 | Seven paper swatches (default, warm, grey, rose, mint, sky, lilac) | S4 | todo |
| F-53 | Density (compact/normal/roomy), text size (S/M/L), mark style (box/dot/web) | S4 | todo |
| F-54 | Button size compact/standard/large (large ≥ 44 px) | S4 | todo |
| F-55 | Era hue scheme (split / mono) | S4 | re-express (one token block; ramps derived) |
| F-56 | Three layouts (signature skin, tabbed, classic/pull skin) | S4 | re-express (ONE layout; skins are pure CSS themes; V-5) |
| F-57 | Skin CSS beacon (`--skin-ok`) warns when styles.css is stale | S4 | todo |
| F-58 | Sticky stack measured at runtime (`--tabs-h`, `--stack-h`) | S4 | todo |
| F-59 | Full offline PWA: network-first shell, cache-first fonts/icons, skipWaiting + clients.claim | S4 | todo |
| F-60 | Data: per-issue medium, legend, maintenance notes, counts (total/core/mandatory/essential/gapnotes/renumbers), timeline order, alt order | S1 | present — data (20-build: media, counts incl. gap notes/renumbers, timeline, altKey); UI later |

## S — v2 settings (control → store → default)

v3 has **one** settings store (trap: "two stores for one setting"); the v2
store is listed only to record where the value lived.

| ID | Control (v2 id) | v2 store | Default | Session | Status |
|---|---|---|---|---|---|
| S-1 | Layout `#segLayout` | settings.layout | signature | S4 | re-express (one layout + CSS skins) |
| S-2 | Density `#segDensity` | view.density | normal | S4 | todo |
| S-3 | Text size `#segFont` | view.font | md | S4 | todo |
| S-4 | Paper `#bgRow` (7 swatches) | view.bg | 0 | S4 | todo |
| S-5 | Marks `#segMark` | view.mark | box | S4 | todo |
| S-6 | Era hues `#segEraScheme` | settings.eraScheme | split | S4 | re-express |
| S-7 | Table view `#tableChip` | view.table | off | S4 | todo |
| S-8 | Badges `#badgeChip` | view.badges | on | S3 | todo |
| S-9 | Dyslexia font `#dysChip` | view.dys | off | S4 | todo |
| S-10 | Mini progress bar `#miniChip` | view.mini | on | S4 | todo |
| S-11 | Persistent banner `#bannerChip` | settings.banner | off | S4 | todo |
| S-12 | Combo badge `#comboChip` | view.combo | off | S3 | todo |
| S-13 | Newest era first `#revChip` | view.rev | off | S3 | todo |
| S-14 | Hide skipped `#skipChip` | view.hideSkip | off | S2 | todo (moves to filter panel Reading section, FP-3) |
| S-15 | Notes only `#notesChip` | view.notesOnly | off | S3 | todo |
| S-16 | Tap to reveal notes `#revealChip` | view.reveal | off | S3 | todo |
| S-17 | Jump to first unread on load `#autoChip` | view.auto | off | S3 | todo |
| S-18 | Pace `#segPace` | view.pace | 12/week | S3 | todo |
| S-19 | Progress mode `#segProgress` | settings.progressMode | combined | S3 | todo |
| S-20 | Button size `#segTap` | view.tap | standard | S4 | todo |
| S-21 | Refresh reminder `#segRefresh` | settings.refreshEvery | quarterly | S3 | todo |
| S-22 | Swipe to mark `#swipeChip` | view.swipe | off | S3 | todo |
| S-23 | Long-press bulk-mark `#pressChip` | view.press | off | S3 | todo |
| S-24 | Presets `#presetRow` | view.presets | [] | S3 | todo |
| S-25 | Theme `#themeBtn` | settings.theme | default | S4 | re-express |
| S-26 | Reading/timeline order `#orderChip` | settings.viewOrder | reading | S2 | todo (FP-6) |
| S-27 | Dual order `#cloneChip` | settings.cloneOrder | epic (A) | S2 | todo (FP-6) |
| S-28 | Collapsed eras / bands | settings.collapsed / pcollapsed | persisted | S2 | re-express (always collapsed on load; expand state session-only, V-3) |
| S-29 | Active tab | settings.tab | app | S2 | todo |
| S-30 | Filter state (depth, types, strands, mo, media, era, q, unreadOnly, alt) | filters | everything / all on | S2 | todo |
| S-31 | Refresh-seen timestamp | settings.refreshSeen | first run | S3 | todo |

## T — v2 `test.js` assertions (all 123)

Each must be re-expressed in the v3 harness against the real DOM, or dropped
with a reason. "re-express" means the v2 assertion tested a v2 structure that
v3 replaces by design — the named v3 assertion replaces it.

| ID | v2 assertion | Session | Status |
|---|---|---|---|
| T-1 | no runtime errors at boot | S1 | present (70-shell) |
| T-2 | exactly one #tabs nav | S3 | todo |
| T-3 | every issue rendered a row | S2 | re-express: rows render on first expand (lazy, V-15) — every row of an expanded era renders |
| T-4 | mark buttons are delegation-tagged | S2 | todo |
| T-5 | delegated mark click cycles state | S2 | todo |
| T-6 | delegated mark cycles back round | S2 | todo |
| T-7 | delegated bookmark toggles | S2 | todo |
| T-8 | delegated note badge opens a popover | S2 | todo |
| T-9 | delegated note badge closes again | S2 | todo |
| T-10 | six new settings chips exist | S3 | todo |
| T-11 | settings panel is sectioned (≥4 heads) | S3 | todo |
| T-12 | notes-only narrows the list | S3 | todo |
| T-13 | notes-only restores | S3 | todo |
| T-14 | newest-era-first reverses the order | S3 | todo |
| T-15 | reverse toggles back | S3 | todo |
| T-16 | tap-to-reveal sets the root flag | S3 | todo |
| T-17 | combo badge sets the root flag | S3 | todo |
| T-18 | bulk era selects are populated | S3 | todo |
| T-19 | range selects default to full span | S3 | todo |
| T-20 | touch chips exist | S3 | todo |
| T-21 | bulk mark era marks rows read | S3 | todo |
| T-22 | bulk unmark era clears them | S3 | todo |
| T-23 | bulk mark range covers more than one era | S3 | todo |
| T-24 | swipe toggle flips | S3 | todo |
| T-25 | long-press toggle flips | S3 | todo |
| T-26 | period bands rendered | S2 | todo |
| T-27 | no period bands (franchise has none) | S2 | todo (no-periods fixture) |
| T-28 | story band renders once | S2 | re-express (ALT track, V-14) |
| T-29 | story band is last | S2 | re-express (V-14) |
| T-30 | final band groups by story name | S2 | re-express (V-14) |
| T-31 | no repeated story headings | S2 | re-express (V-14) |
| T-32 | final band holds its rows | S2 | re-express (V-14) |
| T-33 | period heads have names | S2 | todo |
| T-34 | eras nest inside periods | S2 | todo |
| T-35 | all rows inside a period | S2 | todo |
| T-36 | filters visible on Checklist in tabs | S2 | re-express (FP-1: panel opens where it does today) |
| T-37 | build tag and sw cache version agree | S1 | present (70-shell + 80-guards: build tag = sw.js cache hash) |
| T-38 | signature ramp text clears WCAG AA on its dark surface | S4 | re-express: every skin's era text clears AA on its surface |
| T-39 | signature era ramp is flat | S4 | re-express (per-skin token test) |
| T-40 | signature filter chips have a visible border | S4 | todo |
| T-41 | filters survive a round trip through Reading | S3 | todo |
| T-42 | isTabbed covers every non-classic layout | — | dropped: one layout (spec §1) |
| T-43 | paper + era-hue controls hidden on the signature skin | S4 | re-express: no control is ever hidden by a skin (reachability guard V-5) |
| T-44 | refresh interval is actually consumed, not just stored | S3 | todo |
| T-45 | title follows the text-size setting | S4 | todo |
| T-46 | button size reads and writes the same store applyView uses | S2 | re-express: one settings store |
| T-47 | pending writes flush when the app is hidden | S2 | todo |
| T-48 | no function is defined twice | S1 | present (80-guards: brace-depth scan, scanner self-tested) |
| T-49 | bookmarks open a list, not a jump to the first one | S3 | todo |
| T-50 | persistent banner toggle exists | S4 | todo |
| T-51 | persistent banner is off by default | S4 | todo |
| T-52 | reading tab labels vary by medium | S3 | todo |
| T-53 | review button is targetable by class | S2 | todo (D-4) |
| T-54 | button size seg has 3 options | S4 | todo |
| T-55 | button size defaults to standard | S4 | todo |
| T-56 | compact size restores the original 26px mark | S4 | todo |
| T-57 | glyph buttons usable at standard, 44px at large | S4 | todo |
| T-58 | depth chips built | S2 | todo |
| T-59 | progress mode seg has 2 options | S3 | todo |
| T-60 | refresh reminder seg has 4 options incl. off | S3 | todo |
| T-61 | refresh reminder offers an off switch | S3 | todo |
| T-62 | type chips built | S2 | todo |
| T-63 | mandatory/optional chips | S2 | todo |
| T-64 | format row has one chip per medium | S2 | todo |
| T-65 | no redundant Annuals chip | S2 | todo |
| T-66 | media chips are labelled Comics/Games/Shows | S2 | todo (labels from data vocabulary) |
| T-67 | every issue has a medium | S1 | present (20-build: every row has a medium) |
| T-68 | media vocabulary is comic/game/screen | S1 | re-express → present (20-build: medium vocabulary comes from data; fixture uses comic/game/screen) |
| T-69 | no hardcoded franchise chip leaks into Characters | S1/S2 | present — static (80-guards); DOM check S2 |
| T-70 | character chips match the strand list | S2 | re-express (presence characters, V-11) |
| T-71 | character chips match the strand names | S2 | re-express (V-11) |
| T-72 | unticking Optional reduces rows | S2 | todo |
| T-73 | re-ticking Optional restores rows | S2 | todo |
| T-74 | collapse/expand buttons exist | S2 | todo |
| T-75 | filter hides empty period bands | S2 | todo |
| T-76 | filter leaves at least one band | S2 | todo |
| T-77 | filter narrowed the bands | S2 | todo |
| T-78 | search narrows the list | S2 | todo |
| T-79 | band count reflects filtered total | S2 | todo |
| T-80 | clearing search restores all bands | S2 | todo |
| T-81 | classic skin sets data-skin=pull | S4 | re-express: each skin sets `data-skin` and nothing else |
| T-82 | classic skin uses the tabbed shell | — | dropped: one shell |
| T-83 | layout change lands on Checklist, not Settings | S4 | re-express: skin change keeps the current tab |
| T-84 | classic skin shows filters | S4 | re-express (reachability guard, V-5) |
| T-85 | classic skin has no hardcoded franchise chip | S1 | present (80-guards: no franchise or fixture strings in template code) |
| T-86 | search box present in classic skin | S4 | re-express (V-5) |
| T-87 | classic skin has depth chips | S4 | re-express (V-5) |
| T-88 | classic skin has character chips | S4 | re-express (V-5) |
| T-89 | classic skin hides filters off-checklist | S3 | re-express: filter panel only on Checklist, every skin |
| T-90 | classic skin restores filters on checklist | S3 | re-express (as T-89) |
| T-91 | classic skin: no filters on Reading | S3 | re-express (as T-89) |
| T-92 | classic skin: no filters on Reviews | S3 | re-express (as T-89) |
| T-93 | filters[hidden] is authoritative in CSS (`!important`) | S4 | re-express: `[hidden]` authoritative with **zero** `!important` |
| T-94 | nothing sticky in tabbed mode either | S4 | re-express (one layout; sticky rules measured in browser, L-1..L-5) |
| T-95 | depth control is a single nowrap row | S3 | todo |
| T-96 | nothing sticky in the classic skin | S4 | re-express (skins never change positioning) |
| T-97 | layout seg has 3 buttons | S4 | re-express: skin seg has one option per configured skin |
| T-98 | skin beacon present in styles.css | S4 | todo |
| T-99 | classic option = pull skin | S4 | re-express (T-81) |
| T-100 | pull skin keeps the tab shell | — | dropped: one shell |
| T-101 | pull skin: tabs visible | S4 | re-express (V-5) |
| T-102 | pull skin: period bands carry data-p | S2 | todo (bands carry band identity, V-4) |
| T-103 | leaving classic clears the skin | S4 | todo |
| T-104 | default layout = signature | S4 | re-express: default skin from config |
| T-105 | phead visible in tabs | S2 | todo |
| T-106 | topbar hidden in tabs | — | dropped: no topbar shell |
| T-107 | signature option uses the tabbed shell | — | dropped: one shell |
| T-108 | signature option sets data-skin=signature | S4 | re-express (T-81) |
| T-109 | signature skin hides the topbar | — | dropped |
| T-110 | signature skin keeps the tab nav | S4 | re-express (V-5) |
| T-111 | signature skin keeps the progress header | S4 | re-express (V-5) |
| T-112 | signature skin: checklist visible | S4 | re-express (V-5) |
| T-113 | signature skin hides the gear | — | dropped: no gear (Settings tab) |
| T-114 | signature skin: Settings tab opens the pane | S3 | todo |
| T-115 | signature skin keeps the tab nav visible | S4 | re-express (V-5) |
| T-116 | signature -> tabbed via seg works | S4 | re-express: switching skins round-trips |
| T-117 | tabs: gear hidden again | — | dropped |
| T-118 | Reading tab shows stepper title | S3 | todo |
| T-119 | the done button persists a mark (label varies by medium) | S3 | todo (D-1 regression) |
| T-120 | Reviews pane visible | S3 | todo |
| T-121 | Settings pane visible | S3 | todo |
| T-122 | Checklist pane visible again | S3 | todo |
| T-123 | no runtime errors after interaction | S2 | todo |

## L — v2 `layout-check.py` assertions (all 9, real Chromium)

| ID | v2 assertion | Session | Status |
|---|---|---|---|
| L-1 | tabs are sticky | S4 | todo |
| L-2 | tabs pinned to the top after scrolling | S4 | todo |
| L-3 | banner is sticky | S4 | todo |
| L-4 | banner sits directly under the tabs | S4 | todo |
| L-5 | band is not shifted onto its own intro | S4 | todo |
| L-6 | no large gap between bands (≤16 px) | S4 | todo |
| L-7 | table view at least halves row height | S4 | todo |
| L-8 | no table row overflows the screen width | S4 | todo |
| L-9 | no runtime errors | S4 | todo |

Also from v2's docs and deploy checklist (carried as process, CLAUDE.md):
verify every SW path exists on disk (→ guard), manifest franchised, icons
replaced, verify deploy by hash, first deploy uploads everything, open the
installed app once online.

## D — the 13 known template defects (each needs a regression test)

| ID | Defect | Fix at source | Session | Status |
|---|---|---|---|---|
| D-1 | Reading-tab mark doesn't update era counters | one mark path for every surface; assert counters move from a Reading-tab mark | S3 | todo |
| D-2 | `sw.js` precaches no fonts or icons | precache list generated from disk; guard asserts fonts + icons present and every path exists | S4 | present — SW precaches 12 fonts + 3 icons, every path exists (80-guards); live install S4 |
| D-3 | hardcoded franchise chip + filter branch | no franchise strings in template code (guard) | S1 | present (80-guards) |
| D-4 | review button has no distinguishing class | `.b.rv` targetable | S2 | todo |
| D-5 | phantom "Elseworlds (ALT)" era appended | build never adds an era not in the data | S1 | present (20-build: output eras == dataset eras) |
| D-6 | empty strand list blanks the app | build inserts one universal strand | S1 | present (20-build: 64-era stress with no strands → one universal strand) |
| D-7 | sync placeholder hardcoded to another tracker's prefix | QR/sync prefix derived from `franchise.key` | S3 | todo |
| D-8 | workbook columns read by position | named fields everywhere; build output independent of field order | S1 | present (60-validation: shuffled field order → byte-identical data.js) |
| D-9 | duplicate `switchTab` / `jumpToIssue` declarations | guard: no function defined twice | S1 | present (80-guards) |
| D-10 | triple `jumpToIssue` breaks jumps into collapsed sections | one `jumpToIssue` that expands ancestors | S2 | todo |
| D-11 | no save-flush when the app closes | flush on pagehide / visibilitychange | S2 | present (70-shell: pagehide and visibilitychange flush) |
| D-12 | era colour ramps cap at 26 | no cap; 64-era stress dataset builds and (S4) styles | S1/S4 | present — data (20-build: 64 eras); styling S4 |
| D-13 | template icons and manifest name leak into builds | manifest, icons, theme from config; guard | S4 | present — manifest from config (20-build, 80-guards); franchise icons S4 |

## V — spec additions (v3 requirements v2 lacks)

| ID | Requirement | Session | Status |
|---|---|---|---|
| V-1 | Whole-app event delegation: ≤12 listeners total (guard) | S1/S2 | present — guard (80-guards static ≤12, 70-shell runtime ≤12) |
| V-2 | String templating with `escapeHtml` / `escapeAttr` everywhere | S2 | todo |
| V-3 | Always collapsed on load, no setting; expand state session-only | S2 | present — stub (70-shell: lands collapsed, expand state never stored); S2 re-asserts with real rows |
| V-4 | Every band has its own identity (era index + occurrence) | S2 | present — stub (70-shell: one click opens exactly one banner) |
| V-5 | ONE layout; skins are pure CSS and never move or hide a control; reachability guard proves every control reachable in every skin | S4 | todo |
| V-6 | Goal banners: name, years, read count, progress bar, "days left" pace | S2 | todo |
| V-7 | Keyboard navigation and shortcuts | S4 | todo |
| V-8 | Fast first paint: critical CSS inline, preloaded display font, non-blocking data | S4 | todo |
| V-9 | One colour-token block (guard: exactly one); zero `!important` (guard) | S1/S4 | present — guards (80-guards: one :root colour block, zero !important) |
| V-10 | Essential / Complete event toggle in Settings; progress and counts recompute; "Complete view adds N issues" on event headers | S1 data / S3 UI | todo |
| V-11 | Presence tags (major/minor/cameo), character filter defaults to meaningful appearances, cameo toggle | S1 data / S3 UI | todo |
| V-12 | Depth tier independent of M/O; optional Importance 1–5 | S1 data / S2 UI | todo |
| V-13 | Era-ranked compound sort keys, derived; Alt Sort Key = publication order | S1 | present (20-build, 30-identity) |
| V-14 | ALT continuity rows build, order, and are skipped by the per-series check (replaces v2's story band) | S1 data / S2 UI | present — data (30-identity: ALT order + per-series skip); UI S2 |
| V-15 | Rows render only when an era is first expanded (resolves the `content-visibility` conflict; decide S4) | S2/S4 | todo |
| V-16 | Storage namespaced from `franchise.key`; migration hook (`storage.legacyPrefix`) | S2 | present — namespacing (70-shell); legacyPrefix migration S2/S3 |
| V-17 | PWA: cache name and build tag derived from a content hash; icons, manifest name, theme colour from config | S1 hash / S4 | present — hash (20-build, 80-guards); icons/manifest polish S4 |
| V-18 | aria roles and labels; `prefers-reduced-motion` | S4 | todo |
| V-19 | `sw.js` evaluated, not just parsed (guard) | S1 | present (80-guards: sw.js run in a vm, install/activate/fetch exercised) |
| V-20 | Harness in GitHub Actions on every push; fails on zero assertions | S1 | present (.github/workflows/harness.yml + 00-runner) |
| V-21 | Harness passes on fixture, fixture without periods, and one real dataset (Absolute pilot, in a fresh repo) | S1/S5 | todo |
| V-22 | `verify.py` gate (Research-Repo toolkit) wired in | S5 | todo |
| V-23 | `build_workbook.py` generates the workbook from `dataset.json`, reading by header name | S5 | todo |
| V-24 | Stable `id` (progress) separate from canonical `issueId`; events dedupe on `issueId`; id-stability check with `retiredIds` | S1 | present (20-build id stability, 30-identity) |
| V-25 | Canonical events in `events/`, each stating its era in `dataset.json`; drift check by hash | S1 | present (30-identity placement, 50-events hash drift) |
| V-26 | Export and import (file backup) | S3 | todo |
| V-27 | Undo on bulk mark restores the previous states (see B-2) | S3 | todo |
| V-28 | Docs: README, BUILD-NOTES, MIGRATING, `comic-tracker-build` Skill in `.claude/skills/` | S5 | todo |

## CR — creator credits (decided 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| CR-1 | Writer(s) + artist(s) on every arc/run; several names per role | S1 | present (40-credits) |
| CR-2 | Per-issue overrides (replace only the roles they name) | S1 | present (40-credits) |
| CR-3 | Mid-run splits by `fromId` (a row id) | S1 | present (40-credits) |
| CR-4 | Full canonical names; surname-only fails unless in `creatorMononyms`; conflicting spellings fail | S1 | present (40-credits, 60-validation) |
| CR-5 | Build-time creator index: name → writer / artist issue counts | S1 | present (40-credits: brute-force recount) |
| CR-6 | Coverage % reported; missing credits warn; `strictCredits` makes them fail | S1 | present (40-credits: 98.3%, warn vs strict) |
| CR-7 | Searchable creator picker with issue counts and a writers / artists switch | S3 | todo |
| CR-8 | Tappable creator names on each run filter to that creator's work | S3 | todo |
| CR-9 | Search matches creator names | S2 | todo |
| CR-10 | Creator filter appears in the active-filter chips and Creators header summary | S3 | todo |

## FP — collapsible filter panel (approved mockup `starter/v3/filter-panel-mockup.html`, 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| FP-1 | Panel opens where it does in the current trackers; only its inside is reorganised | S2 | todo |
| FP-2 | Five sections in order: Reading, Story, Characters, Creators, Order and display | S2 | todo |
| FP-3 | Reading: depth tier, unread only, hide skipped, mandatory only | S2 | todo |
| FP-4 | Story: era, Essential/Complete events, type, ALT | S2/S3 | todo |
| FP-5 | Characters: presence filters + include-cameos toggle | S3 | todo |
| FP-6 | Order and display: reading vs publication order, alternate stories | S2 | todo |
| FP-7 | Collapsed header shows icon, section name, one-line summary of what's active, chevron — nothing applied is ever hidden | S2 | todo |
| FP-8 | Removable chips at the top for every active filter, active count, Clear all | S2 | todo |
| FP-9 | Live "Showing N of M issues" and Save as preset at the bottom | S2/S3 | todo |
| FP-10 | All sections start collapsed; open state remembered (namespaced storage) | S2 | todo |
| FP-11 | Smooth expand/collapse, honours reduced motion, uses the single token system | S4 | todo |
| FP-12 | Sections are buttons with `aria-expanded`; delegated (counts toward the ≤12 listeners) | S2 | todo |

## XM — X-Men features v2 lacks

| ID | X-Men feature | Session | Status |
|---|---|---|---|
| XM-1 | Era divider banners: name, years, read/total, skipped count, progress track, time left, ✓ when complete (the goal banner, V-6) | S2 | todo |
| XM-2 | Pace as minutes per issue (quick 8 / average 15 / deep 25) driving "time left" per banner | S2/S3 | todo (reconcile with v2 issues/week, F-18) |
| XM-3 | Reading-tab keyboard shortcuts: ← / → step, R read, X skip; ignored in inputs | S4 | todo |
| XM-4 | Pinned bar: bookmarked issues as a scrollable chip row atop the checklist, tap to jump | S3 | todo |
| XM-5 | File backup: export JSON download, import from file | S3 | todo (V-26) |
| XM-6 | QR as a URL (`#sync=…`) that imports on open and **merges** (never downgrades read), reporting counts | S3 | todo |
| XM-7 | "Check for updates" button (`reg.update()`) | S4 | todo |
| XM-8 | Era navigation style: chips / dropdown / scroll | S3 | todo |
| XM-9 | Landmarks-only filter; landmarks inline vs tap-to-reveal | S3 | todo |
| XM-10 | Gap notes on/off | S3 | todo |
| XM-11 | Bulk mark an arc (read / unread) | S3 | todo |
| XM-12 | Swipe with visual feedback (row slides, coloured backing shows the action) | S3 | todo |
| XM-13 | Haptic tick on long-press (`navigator.vibrate`) | S3 | todo |
| XM-14 | Incremental count refresh (ancestor stats update without a full re-render) | S2 | todo |
| XM-15 | Arc issue list rendered on expand (lazy) — basis of V-15 | S2 | todo |
| XM-16 | `escapeHtml` / `escapeAttr` string templating (V-2) | S2 | todo |
| XM-17 | Read-mark style tick / cross | S4 | todo (folds into S-5) |
| XM-18 | Font size as a scale multiplier | S4 | todo (folds into S-3) |
| XM-19 | Show/hide the jump button | S3 | todo |
| XM-20 | Remembered expanded eras | — | dropped: spec §1 — always collapsed on load, expand state session-only |

## X — extra lines (John, 1 Oct)

| ID | Requirement | Session | Status |
|---|---|---|---|
| X-1 | Display mode "layout C": per-row arc labels with no arc headers (Archie's arrangement) | S3 | todo |
| X-2 | Import old-tracker backups and QR codes via `storage.legacyPrefix` (and the old QR prefix) | S3 | todo |
| X-3 | Sync and backup formats keyed on stable `id`, versioned, tolerant of rows added since (unknown ids ignored, new rows default unread) — replaces v2's positional bitstring that refused any data change | S3 | todo |

## B — v2 bugs found while inventorying (don't port them)

| ID | Bug | v3 handling | Status |
|---|---|---|---|
| B-1 | `#paneReading` and `#paneReviews` are each declared **twice** in v2's HTML | guard: no duplicate ids in the shell | present — guard (80-guards: no duplicate ids in index.html) |
| B-2 | Bulk-mark undo deletes every touched mark instead of restoring prior states (a `reading` row becomes `unread`) | undo snapshots previous states (V-27) | todo (S3) |
| B-3 | Swipe marks write `state.progress` directly, bypassing the mark path (no Reading/banner refresh) | one mark function for every surface (D-1) | todo (S2) |
| B-4 | QR import replaces progress wholesale; the code is rejected after any data change (`dataVersion`) | merge import keyed on ids (X-3, XM-6) | todo (S3) |
| B-5 | `jumpBtn` falls back to `alert()` while everything else uses the toast | toast everywhere | todo (S2) |
| B-6 | About box and others set inline `style` attributes | no inline styles in templates; tokens only | present — guard for index.html (80-guards); app templates S2 |
