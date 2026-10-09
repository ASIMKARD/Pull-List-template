# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file,
`CLAUDE.md`, and Master-Repo `starter/v3/V3-SPEC.md`.

**Harness:** 1539 assertions, 0 failed, 35 suites (session 6, step 2 done). **Layout suite (real Chromium, in CI too):** 351 checks, 0 failed, 11 suites.
Session 1 ended at 307, session 2 at 617, session 3 at 1105, session 4 at 1298 (+ 153 layout checks) and session 5 at 1472 (+ 267 layout checks).

---

## Transfer checkpoint — end of session 1 (scaffold), 2 Oct 2026

### Done
| Step | What | Status |
|---|---|---|
| 0 | `main` created with a README stub and confirmed as the default branch; session branch `claude/keen-euler-6qyl31` cut from it. `CLAUDE.md` holds the read-only rule, John's standing rule (Repo safety), the working method, the data rules, and every v2 trap tagged "applies" or "superseded" | done |
| 1 | `FEATURE-INVENTORY.md`, the parity gate. It lists 60 features (F), 31 settings (S), all 123 v2 `test.js` assertions (T), all 9 `layout-check.py` assertions (L), 13 defects (D), 28 spec additions (V), 10 creator-credit lines (CR), 12 filter-panel lines (FP), 20 X-Men extras (XM), 3 extra lines (X) and 6 v2 bugs found while inventorying (B). 39 lines are already `present`, each naming the suite that proves it | done |
| 2 | Repo layout. `qrcode.js` (byte-identical), 12 fonts and 3 icons vendored from v2. App shell stubs (`index.html`, `app.js`, `styles.css`), a service-worker template, `package.json` + lockfile (jsdom, ajv), and a `.claude/settings.json` SessionStart hook that runs `npm ci` | done |
| 3 | `schema/` (dataset, era-file and event schemas, JSON Schema 2020-12) and `tools/build.py` (stdlib only). The build stitches per-era files, merges events on `issueId`, derives 13-digit keys `RRRR·YYYYMM·NNN` and the 9-digit `altKey`, validates everything, resolves credits and builds the creator index, checks id stability, stamps `data.js` / `sw.js` / `manifest.json` with one content hash, and offers `--check` for staleness | done |
| 4 | Fixtures: `basic` (an invented franchise, 61 rows covering every edge case), `no-periods`, and `broken/*` (20 one-error cases plus a valid base) | done |
| 5 | Harness `test/run.js` plus 9 suites: runner gate, schema, build, identity, credits, events, validation, shell, guards. Each guard was checked by breaking the code on purpose | done |
| 6 | `.github/workflows/harness.yml` runs on every push and PR. It fails on any failure, any crash, or zero assertions. CI is green at 307 assertions. Actions bumped to their Node-24 majors (`checkout@v5`, `setup-node@v5`, `setup-python@v6`) after run #1 warned that Node 20 is deprecated | done |
| 7 | This checkpoint | done |

### How to run
```
npm ci                         # once per container (the SessionStart hook does it)
python3 tools/build.py         # rebuild data.js, sw.js, manifest.json from dataset.json
python3 tools/build.py --check # are the committed generated files fresh?
node test/run.js               # the harness — report the count
node test/run.js identity      # one suite
```

### Decisions locked in session 1 (do not reopen)
- **Sort key** is `RRRR·YYYYMM·NNN` (13 digits).
  - Ranks run 1000–9999. New builds start at 5000, spaced 10, so earlier eras slot in below.
  - Keys are **derived** by the build from the era rank, the month of `sortDate` (or `date.cover`), and `NNN`.
  - `NNN` is assigned within each era and month, ordered by date, then the `seq` hint, then event order, then source order.
- **altKey** is publication order, `YYYYMM·NNN` (9 digits, no era rank). That is the same shape as legacy keys, so `verify.py`'s `check_built` reads v3's `data.js` unchanged.
- **`id` vs `issueId`.**
  - `id` is the progress key and never changes. Migrated trackers keep their old sort key; new rows default to `issueId`.
  - `issueId` is `<series>-<volume-start-year>[-<token>…]`. The number part is optional and can be any slug token, so graphic novels, games and TV episodes fit.
  - Rows also carry `series` / `vol` / `num`, and the build checks they agree with `issueId`.
- **Removing an id fails the build** unless it is listed in `retiredIds`.
- **Events.**
  - The master copy lives in this repo's `events/`. Trackers copy the files, and each built event carries its file's hash so drift is detectable.
  - `dataset.json` lists `events: [{id, era, arc?}]`.
  - Chapters merge with the tracker's rows on `issueId`. Unmatched chapters are placed inside the stated era by date, then event order; the era is never guessed.
- **Credits.**
  - Writers and artists per arc. `creditSplits` start at a `fromId`; per-row overrides replace only the roles they name.
  - Names must be full canonical names; single words are allowed only through `creatorMononyms`. Conflicting spellings fail the build.
  - Missing credits give a warning with a coverage %. `strictCredits` makes them fail: on for new builds, off for migrations.
- **Per-series ordering** (taken from `verify.py`): in the order the app shows, issue numbers within one series, volume and subseries never go backwards. ALT and `SPECIAL_NUMBERING` rows are exempt.
- **Content hash** stamps the build tag, the SW cache name (`<key>-<hash>`) and `data.js`. Nothing is bumped by hand.
- **Storage namespace** is `<franchise.key>:v3:`. Old trackers' keys come in through `franchise.storage.legacy` ({prefix, format}).
- **Tooling:** the app is served from the repo root; the build is Python (stdlib only); the harness is Node 22 + jsdom; ajv validates fixtures against `schema/`.
- **`data.js` layout.** Issue rows keep v2's first nine positions (`key, title, arc, type, mandatory, core, flags, note, altKey`). Everything else lives in index-aligned parallel arrays: `ids`, `issueIds`, `issueEra`, `issuePeriod`, `issueMedium`, `issueTier`, `issueImportance`, `issueEvent`, `issueCompleteOnly`, `issuePresence`, `issueWriters`, `issueArtists`.

### Open items carried forward
- **content-visibility (session 4).** Proposed resolution: render an era's rows only when it is first expanded. v3 lands collapsed, so the guard isn't needed and v2's iOS bugs can't occur. Recorded in CLAUDE.md and FEATURE-INVENTORY V-15.
- **Pace model — DECIDED 2 Oct (John).** Both:
  - *Minutes per issue* drives a **time left** figure on every banner. Presets are X-Men's: Quick 8, Average 15 (default), Deep dive 25.
  - *Issues per week* drives a **finish-by** date. Presets are v2's: light 5, steady 12 (default), heavy 25, marathon 50.
  - Both are settable in Settings. The finish-by date appears in the progress header and on each top-level banner (period bands, or eras when there are no bands); era banners inside a band show time left only.
- **Franchise-string guard scope.** It covers the shipped template code: `index.html`, `app.js`, `styles.css` and the SW template. `tools/build.py` docstrings quote real `issueId` examples by design.
- **Absolute pilot (session 5).** It goes into a **fresh repo John creates first**. Stop and ask before any edit outside this repo.
- **Research-Repo** was attached read-only this session to read `toolkit/verify.py`. Nothing was written to it or to any repo other than this one.
- **Merge before session 2.** Review the diff, create the PR and merge `claude/keen-euler-6qyl31` into `main`, per KICKOFF.md.

### Session 2 starts with: the core app
Read every S2 line in `FEATURE-INVENTORY.md`, then replace the `app.js` stub:
1. **Rendering.** String templates through `escapeHtml` / `escapeAttr` (V-2): period bands → era goal banners → arcs → rows. An era's rows render only when it is first expanded (V-15, XM-15).
2. **Collapsed landing** (V-3) with goal banners showing name, years, read count, progress bar and time left (V-6, XM-1). Each band has its own identity (V-4); expand state is session-only.
3. **Whole-app delegation** (V-1). One click handler covers marks, bookmarks, notes, banners and the filter panel. Stay at or under 12 listeners; the guard already enforces it.
4. **Marks.** Four states through **one** mark function for every surface (F-5, D-1, B-3), medium-aware labels (F-6), inert rows (F-7), and badges including `.b.rv` (F-8, D-4).
5. **Filter panel structure** (FP-1…FP-10): five collapsible sections with summaries, removable chips, "Showing N of M", and the open state remembered. Plus filters and search including creator names (F-19, CR-9), the order chips (F-20, F-21), and empty-band hiding (F-13).
6. **Storage.** The shim and save-flush are in place. Add the progress model keyed on `id`, settings in ONE store, and the `storage.legacy` migration hook (V-16).
7. **Navigation:** `jumpToIssue` and next-unread (F-27, F-29, D-10).
8. **Tests.** Port the S2 `T-*` assertions into new suites as each feature lands, and report the count after every change.

---

## Session 2 plan (agreed 2 Oct 2026): the core app

Work continues on `claude/keen-euler-6qyl31`, which already holds session 1.

1. **Model** (no DOM).
   - Indexes by era, arc and band.
   - Counts computed from the model, never the DOM.
   - Pace maths: time left from minutes per issue; finish-by from issues per week.
2. **Storage.**
   - One store: `<key>:v3:progress` (keyed on `id`), `:settings` (filters, pace and the filter panel's open sections included), and `:reviews`.
   - Legacy hook: v2-format progress is read from `franchise.storage.legacy` ({prefix, format}) on first boot, matched to `id`, and the count reported in a toast.
3. **Rendering**, all string templates through `escapeHtml` / `escapeAttr`.
   - Progress header: bar, n/N, time left, finish-by, next unread.
   - Goal banners: name, years, read count, bar, time left, ✓ when complete, finish-by on top-level banners.
   - Lands collapsed; expand state is session-only.
   - An era's arcs and rows render on first expand only.
   - Arc heads: name, year and title, blurb, credits as text.
   - Rows: four-state mark, medium labels, subnote, badges (core, flashback/ALT note popover, bookmark, lookup link); inert rows carry no mark.
4. **Delegation.** Listener budget per change 4 below (the whole app ends at 10). A single `setMark(id, state)` path serves every surface (closes D-1 and B-3).
5. **Filter panel**, per the approved mockup.
   - A Filters bar at the top of the checklist, opening inline.
   - Five collapsible sections with summaries:
     - Reading: tier, unread, hide skipped, mandatory.
     - Story: era, type, ALT.
     - Characters: strands.
     - Creators: name search.
     - Order and display: reading/publication (labelled from `dualOrder`) and arc order.
   - Removable chips, active count, Clear all, "Showing N of M", open state remembered.
   - Search covers title, arc, note and creators.
   - Empty bands hide.
6. **Navigation.** `jumpToIssue` opens collapsed ancestors and scrolls; next unread; a toast replaces `alert()`.
7. **Tests.** Suites 90-render, 91-marks, 92-filters, 93-storage, 94-navigation and 95-pace, plus a 5,000-row stress check (landing renders zero rows). All S2 `T-*` lines get ported. Inventory and PROGRESS are updated after each step.

**Changes from John's approval (2 Oct):**
1. **Search and filters open their matches.** While a search or any narrowing filter is active, the bands, eras and arcs with visible matches render and expand automatically, and everything else stays hidden. Clearing returns to the collapsed landing. Still lazy: only eras with matches render.
2. **Safe migration.**
   - The format is declared as `storage.legacy: {prefix, format}`; `"v2"` is implemented now.
   - The reader is strictly read-only: it never deletes or modifies old keys, because the `-archive` site shares this origin.
   - It copies marks, bookmarks and reviews. Reviews are mapped to arcs; unmatched ones are reported and kept, never dropped.
   - It runs once, recorded by a flag in the v3 store, and reports counts in a toast.
   - Session 3 adds a Settings "Import from previous version" action that re-runs it, filling gaps without overwriting newer v3 marks.
3. **Cumulative finish-by.** A top-level banner's date counts the unread (non-skipped) issues in that band plus every band before it in reading order, divided by issues per week. The header covers the whole tracker; completed bands show ✓.
4. **No online/offline listeners.** `navigator.onLine` is checked when needed. Budget: S2 click, input, pagehide, visibilitychange (4); S3 touch ×3 + change (8); S4 keydown + install prompt (10). That leaves headroom under 12.

**Moved to S3:**
- The review button (T-53 / D-4), with the review editor, so no control ships that does nothing.
- Presence grades, the creator picker and the Essential/Complete toggle.

---

## Transfer checkpoint — end of session 2 (core app), 2 Oct 2026

### Done
- **`app.js`** rewritten as the real core app; string templates only, 4 listeners (click, input, pagehide, visibilitychange).
  - **Model:** indexes and counts come from data, never the DOM.
  - **Lands collapsed.** Goal banners show name, years, read count, bar and time left; the header and top-level banners also show the **cumulative** finish-by (✓ when a band is complete).
  - **Lazy:** an era's rows render only on first open.
  - **One `setMark` path** updates the row, every banner and the header.
  - Bookmarks and note popovers; four states with medium-aware labels; inert rows.
- **Filter panel** per the approved mockup: five collapsible sections with summaries, removable chips, active count, Clear all and "Showing N of M"; open sections remembered.
  - Search (title, arc, note, creators) and every narrowing filter **open the bands and eras with matches and hide the rest**; clearing returns to the collapsed landing. Still lazy: on 5,000 rows only matching eras render.
  - Saved filters are stored **by name**, never by index.
- **Storage:** one namespaced store (`progress`, `settings`, `reviews`).
  - Read-only legacy migration via `storage.legacy: {prefix, format:"v2"}` copies marks, bookmarks and reviews (mapped to arcs; unmatched kept under `legacy-unmatched`).
  - It runs once (`settings.migrated`) and toasts the counts.
  - `window.PullList.importLegacy()` is the session 3 re-run; it fills gaps and never overwrites.
- **Navigation:** `jumpToIssue` (opens collapsed ancestors, scrolls, flashes, focuses), next unread, and a toast with an action (no `alert()`).
- **Schema:** `storage.legacy {prefix, format, qrPrefix?}` replaces `legacyPrefix`.
- **Harness:** 7 new suites (90-render, 91-marks, 92-filters, 93-storage, 94-navigation, 95-pace, 96-figures).
  - Two new guards: no variable may share a function's name, and every `[hidden]` element must compute to `display:none` against the real stylesheet.
  - Both were checked by breaking the code on purpose.

### Bugs found and fixed this session
- Clearing the last filter left auto-opened eras open (now returns to the collapsed landing).
- `var names` silently replaced `function names()` (the "later one wins" trap, variable form). Now guarded.
- The idle toast showed as a black bar: `.toast{display:flex}` beat `[hidden]`, which only real-browser screenshots revealed. Fixed by moving layout to an inner wrapper; the jsdom cascade check now catches it.
- Creator-name normalisation dropped digits ("Writer 1" = "Writer 2"). Now keeps them.

### Decisions recorded this session
- Pace: both models (see Open items above).
- The review button moves to session 3 with its editor.
- **Always land collapsed (closing fix 1).** Saved filters persist, but every boot lands collapsed. Matches auto-expand only after a search or filter change made during the current visit.
- **Banner maths: plan always, browsing when active (closing fix 2).** Filters come in three kinds:
  - **Plan** (depth tier, mandatory only, hide skipped, ALT, **format**; later Essential/Complete): progress, time left and finish-by always follow them. Format moved here from browse: **decided by John, 2 Oct**.
  - **Browse** (search, creator, era, type, character): while any is active, banners and header count only that view, with a "filtered" marker, and revert when it is cleared.
  - **Display-only** (unread only, order): never change a number.
  - Finish-by stays cumulative in reading order in every case. "Showing N of M" counts the list against the whole view.
  - Tested in `96-figures`; each rule was checked by putting the old behaviour back (16 / 2 / 3 failures).
- Filter persistence is by name; search text is session-only.

### Session 3 starts with: features
Work through every S3 line in `FEATURE-INVENTORY.md`:
- **Tabs:** Checklist / Reading (stepper + bookmarks) / Reviews / Settings.
- **Settings sections**, including:
  - pace controls (presets via `PullList.pacePresets`);
  - "Import from previous version" (calls `PullList.importLegacy()`);
  - Essential/Complete toggle;
  - refresh reminder;
  - per-medium progress.
- **Presets** (Save as preset in the panel).
- **Bulk mark** by band and range with undo that restores prior states (B-2).
- **Touch:** swipe and long-press, through `setMark`.
- **Reviews:** per arc (the migration already maps them), plus the review button `.b.rv` (T-53, D-4).
- **QR sync and backup**, keyed on ids, versioned and tolerant of rows added since (X-3).
- **Presence filters** with the cameo toggle (FP-5), the creator picker with counts (CR-7), and tappable creator names (CR-8).
- **Listener budget:** touch ×3 + change brings the total to 8.
- **Essential/Complete** joins the PLAN filters: `inView()` already feeds `planOk()`.

---

## Session 3 plan (agreed 3 Oct 2026): features + per-format durations

Branch `claude/compassionate-galileo-6g2vnh`, cut from `main` at `3e480f3` (sessions 1 and 2 merged).
The full plan, with tests per step, was agreed in plan mode. The steps, in order:

1. **Per-format durations** (John's addition, 1 Oct) — done, see the checkpoint below.
2. **Tabs and the Settings shell.**
   - Checklist / Reading / Reviews / Settings, with the active tab persisted; the filter panel shows
     on Checklist only.
   - Settings sections: Display, Reading behaviour, Touch, Bulk actions, Data, Backup.
   - Pace controls, plus the F-18 readout "N left · W weeks · done Mon YYYY".
   - Progress mode, combined or per medium.
   - Refresh reminder (consumed at boot), About & legend, Clear all progress (snapshot + undo
     toast), Import from previous version.
   - Bookmarks list and the pinned bookmark bar; show/hide the jump button.
   - Listeners: + `change` = 5.
3. **Display options** (display-only):
   - badges, combo badge, newest era first, notes only, tap to reveal;
   - gap notes, era navigation style, layout C.
4. **Reading tab** stepper. It resumes at the first unread, and marks go through `setMark` (D-1).
5. **Reviews** per arc. The `.b.rv` ✎ sits on the arc head; the Reviews tab lists them and jumps;
   `legacy-unmatched` reviews are listed, never dropped.
6. **Bulk marking and touch.**
   - `applyMark` + one refresh, so there is still one mark path.
   - Era, range and arc bulk marks, with an undo that restores the previous states.
   - Swipe and long-press (opt-in).
   - Listeners: + 3 touch = 8.
7. **Story, character and creator filters; presets.**
   - Essential/Complete (a plan filter, with "Complete view adds N issues").
   - Presence + cameos (browse).
   - Creator picker with counts, tappable names, and chips.
   - Presets by name.
   - Importance on arc heads.
8. **Sync and backup** (two formats; see the decisions below).
9. **Close-out.** Inventory statuses, this checkpoint, and a real Chromium check with screenshots.

New suites: `97-durations`, `98-tabs-settings`, `99-display`, `9a-reading`, `9b-reviews`, `9c-bulk-touch`,
`9d-story-filters`, `9e-sync`.

**Session length rule (John, 3 Oct):** never start a step that can't be finished. If the session
runs long, stop at the end of a completed step and record here exactly where step N+1 begins.
Then push, and tell John.

### Decisions recorded 3 Oct (do not re-ask)
- **Per-format durations** (asked 1 Oct; settled 3 Oct):
  - **Every comic counts as one issue**, timed by the minutes-per-issue setting. There are no comic
    durations and no length multipliers, so `duration` on a comic row or `durations.comic` fails
    the build.
  - **Shows** use the dataset default `durations: {screen: N}`; a row's `duration` overrides it.
  - **Games** each carry their own `duration`. **One unit everywhere: whole minutes.**
  - A missing duration warns with a coverage % (like credits). It never fails; there is no
    strict flag.
  - **An untimed row adds nothing** to time left or finish-by. Banners and the header show
    "+N untimed"; when a unit's only remaining rows are untimed, the marker shows and there is no
    "0m left".
  - **Finish-by** = minutes left ÷ (issues per week × minutes per issue). For comics-only data
    the result is bit-identical to session 2.
- **S-17 "Jump to first unread on load" is re-expressed.** The landing stays collapsed with no
  exceptions, and the Reading tab resumes at the first unread instead.
- **Swipe and long-press stay off by default (opt-in).**
- **No haptics.** XM-13 is dropped, and a guard (step 6) asserts `navigator.vibrate` is never
  called.
- **XM-9 landmarks fold into notes only / tap to reveal.** X-Men's "landmark notes" are the row's
  short `note`, so no new data field is needed.
- **Reviews are per arc.** The ✎ button sits on the arc head.
- **Two sync formats:**
  - **QR (compact).** It holds a version, the franchise prefix, a dataVersion hash (sha256 of ids
    in row order, emitted by the build), the marks as 2-bit states in the current row order, and
    the bookmarks as positions. Reviews, settings and filters stay out.
    - It is **compressed**: RLE of the marks plus delta-varint bookmarks, keeping RLE or raw 2-bit
      packing, whichever is smaller, then base64url.
    - If the code would exceed QR capacity, the app shows a message and the copy-code instead.
    - On import, a matching dataVersion is decoded by position. A different one is refused, with a
      pointer to the copy-code or the file.
  - **Copy-code, `#sync=` links and the backup file** carry the full id-keyed, change-tolerant JSON
    with everything.
- **Import is Merge or Replace.**
  - Merge is the default and never downgrades a read mark.
  - Replace restores the backup exactly, after an in-page confirm (never `window.confirm`).
  - Before a Replace and before "Clear all progress", the full state is snapshotted, and an undo
    toast restores it.
- **Old (v2) QR codes.** The old position order is rebuilt from every legacy-style id **plus
  `retiredIds`**, sorted by old key, so a retired issue can't shift every later position.

---

## Session 3 checkpoint — step 1 done (per-format durations), 3 Oct 2026

### Done
- **Schema:**
  - `durations` (top level, minutes ≥1; `comic` refused by `propertyNames`);
  - row `duration`;
  - event chapter `duration`;
  - a shared `$defs/minutes`.
- **`tools/build.py`:**
  - Resolution, read by name: row `duration` → `durations[medium]` → comic: 0 (use the setting)
    → missing: -1. Inert rows are 0.
  - Rules: comic `duration` and `durations.comic` fail; a non-integer or a value <1 fails; an
    unknown medium in `durations` fails.
  - A per-medium coverage warning, plus `counts.durationsCoverage`, the report field, and the
    build summary line.
  - Chapters carry `duration` into placed rows.
  - `data.js` gains the index-aligned `issueDuration` array.
- **`app.js`:**
  - Stats accumulate `cl` (comics), `fm` (fixed minutes) and `ut` (untimed) over remaining rows.
  - `minutesLeft = cl × minutes + fm`.
  - Finish-by is cumulative **minutes** ÷ (weekly × minutes), and finish spans carry the
    full-precision `data-weeks` (it feeds step 2's "W weeks" readout).
  - "+N untimed" markers (`.buntimed` / `.puntimed`, `data-untimed`).
  - `setPace` rounds to whole numbers.
- **Fixtures:**
  - `basic` is now fully timed: its game has `duration: 1200`, plus `durations: {screen: 22}`.
  - New **`mixed`** fixture: 2 bands, comics, 3 episodes (22 default, 44 override), a timed game
    (1500) and an untimed game, an ALT row and a gap note.
  - New broken cases: `duration-on-comic`, `durations-comic-default`, `duration-not-integer`.
- **Tests:**
  - **`97-durations`** (107 assertions): build values, coverage warning and summary; the event
    chapter duration; time left honouring each duration (reading still counts; read −1500;
    skip −22); pace changes only the comics part; finish-by from minutes; the untimed marker,
    including the only-untimed case; format-as-plan totals (Games / Shows / Comics / cleared);
    comics-only exactness.
  - **Comics-only exactness** is proved two ways. First, exhaustive arithmetic (r 0…5000 × all 12
    preset pairs). Second, the real DOM against the session-2 formula kept verbatim as the oracle,
    on 4 comics-only datasets (basic without its game and show, the no-periods equivalent, the
    5,000-row stress set and the root starter) × 12 pace pairs, with read / skip / reading marks.
    `data-weeks` is compared as the full double, so the match is bit-identical, not just the same
    day.
  - Mutation checks, each with the old behaviour put back:
    - count-based time left → fails;
    - untimed counted as a comic → fails;
    - dividing twice (`/ w / m`, a sub-day rounding change) → 12 failures, once `data-weeks` was
      compared.
  - `95-pace` and `96-figures` now use an own-minutes oracle. `20-build` checks `issueDuration`
    alignment and the comic/non-comic values on 4 datasets, including `mixed`. `10-schema`
    validates `mixed`.
- **Docs:**
  - CLAUDE.md data rules gain the durations rule.
  - The inventory adds V-29 (present) and updates XM-2. XM-13 is dropped (no haptics) and S-17 is
    re-expressed.

## Session 3 checkpoint — step 2 done (tabs and the Settings shell), 3 Oct 2026

### Done
- **Shell:**
  - One `#tabs` nav with Checklist and Settings. Reading and Reviews get their tabs in steps 4
    and 5, with their content, so no tab ships empty.
  - Panes inside `<main>`. `#app` is now a `div` in the Checklist pane, next to the filter panel,
    so the panel shows on Checklist only.
  - A pinned bookmark bar sits atop the checklist.
- **`app.js`:**
  - `withDefaults()` is the one place settings defaults are filled (boot, snapshot restore,
    later imports). `filtersFromSettings()` re-reads saved filters by name.
  - `showTab()` uses aria-selected and a roving tabindex. The active tab persists (S-29), and the
    checklist still lands collapsed.
  - **Settings, Reading behaviour section:**
    - pace pills from the presets;
    - the F-18 readout "N left · W weeks at P a week · done Mon YYYY", using the same minutes
      maths and date as the header;
    - progress mode, Combined or Per format. Each format's own count, time left and "+N untimed"
      shows in the header. The control is offered only when the data mixes formats;
    - Next unread button show/hide.
  - **Settings, Data section:**
    - the refresh reminder (Monthly / Quarterly / Yearly / Off), consumed at boot. The first run
      starts the clock, and Dismiss or a new interval resets it;
    - the bookmarks list (sorted as displayed, Jump, Remove);
    - Import from previous version (only when the data declares one);
    - Clear all progress, with an in-page confirm and a **full-state snapshot + Undo**
      (`takeSnapshot` / `restoreSnapshot`, reused by Replace in step 8);
    - About & legend.
  - `jumpToIssue` switches to the Checklist first. Settings re-renders keep keyboard focus.
  - No new listeners: still 4 in app code (jsdom adds its own `mouseover`, `mouseout` and `load`
    at boot).
- **Tests:** `98-tabs-settings` (77 assertions). Mutation-checked:
  - a reminder that is stored but never consumed → 4 failures;
  - an Undo that does not restore → 2 failures.
- **Real Chromium** (390 px, mixed fixture): Checklist with the pinned bar and the untimed
  marker; Settings with per-format lines. No page errors and no horizontal overflow. The
  segmented controls became wrapping pills after the first screenshot showed them breaking
  awkwardly.

## Session 3 checkpoint — step 3 done (display options), 3 Oct 2026

### Done
- **A Display section in Settings**, with the `PREFS` toggles. CSS-only ones become root flags in
  `applyPrefs()` (`data-badges`, `data-combo`, `data-reveal`, `data-layout`); the others
  re-render the list. The options:
  - Badges on/off and the combo badge (read + bookmarked → filled star).
  - Tap to reveal: a "note" button opens the subnote.
  - Gap notes on/off.
  - Newest era first: bands and eras are reversed, rows keep reading order, finish-by stays
    cumulative in reading order, and bookmarks sort as displayed.
  - Arc headings, "Headings" or "Label on each row" (layout C, X-1).
  - Era navigation (XM-8).
- **Notes only** is a display-only filter chip in the panel's Reading section: persisted by
  name, shown as an active chip and in the summary. X-Men's landmarks-only folds into it, and
  its inline vs tap-to-reveal folds into tap to reveal.
- **Era navigation (XM-8) — my call, open to veto.** X-Men's version is an era *filter*. v3
  already has the era filter in the Story section, so XM-8 became a **jump bar**: chips or a
  dropdown open and scroll to an era, and nothing is filtered. Plain scroll (no bar) is the
  default, because the collapsed banners already list every era.
- The depth chips sit in one row that never wraps (T-95).
- **Listeners:** `change` added for the era dropdown (5 of 12). Bulk ranges and file import will
  reuse it.
- **Tests:** `99-display` (50 assertions). Every option is checked to leave every figure
  unchanged. Mutation-checked:
  - notes only ignored → 2 failures;
  - newest-first ignored → 3 failures;
  - finish-by following display order → caught.
- **The franchise-string guard caught "X-Men" in two comments.** They now say "the
  feel-reference build", as session 2 did.
- **Real Chromium** (basic fixture, 390 px): era chips, layout C labels and the note button
  render, with no errors and no overflow.
- **Screenshot-script lesson:** writing localStorage while the page is open and then reloading
  is overwritten by the `pagehide` flush. That is the app working as designed, so seed settings
  with `addInitScript` before load.

## Session 3 checkpoint — step 4 done (Reading tab), 3 Oct 2026

### Done
- **The Reading tab** sits between Checklist and Settings. `renderReading()` is a one-entry
  stepper over the current view: plan, browse and display-only filters; reading order within the
  chosen order; **never reversed** (newest-era-first is a checklist browsing aid).
- **Resume:** it starts at the first entry that is neither read nor skipped, until the user
  steps. The stepped-to id is session-only (`reader`). This is also the re-expressed S-17.
- **Marking:** Skip / Mark <verb> go through `setMark`, with verbs following the medium (Mark
  Read / Beaten / Watched; "Beaten ✓" when done). Setting a state steps on; tapping it again
  clears it and stays. Previous / Next are disabled at the ends. Pin toggles the bookmark, and
  the pinned bar and checklist star follow.
- **Tests:** `9a-reading` (32 assertions).
  - A mutation that writes the Reading-tab mark straight to storage (v2's bug) fails the D-1
    counters and the time-left check.
  - A boot on the Reading tab resumes at the first unread while the checklist stays collapsed.
- Real Chromium screenshot of the Reading card: no errors, no overflow.

## Session 3 checkpoint — step 5 done (Reviews), 3 Oct 2026

### Done
- **Per-arc reviews** in `reviews[arcId] = {r, t}`.
  - **The ✎ button.** `.b.rv` (D-4, T-53) sits on every arc head; in layout C it goes on the
    first row of each arc run. Its label shows the rating ("✎ ★★★★", "✎ noted", "✎ review").
  - **The editor.** An inline editor has 5 star buttons (tap the same star again to clear it)
    and a notes box.
  - **Saving.** Text commits to the store on every input; the 400 ms save debounce and the
    `pagehide` flush cover it, so a review typed and closed at once is not lost. Clearing both
    the stars and the text deletes the review.
- **The Reviews tab** (between Reading and Settings):
  - It lists reviews by each arc's first key, with stars, era and text; tapping one jumps to the
    arc's first in-view row.
  - "Kept from the previous version" lists `legacy-unmatched` reviews and reviews whose arc is no
    longer in the data. They are never dropped.
- **Tests:** `9b-reviews` (24 assertions). Mutation-checked:
  - text not committed on input → 2 failures;
  - the kept list removed → 1 failure.
- **Found by real Chromium, invisible to jsdom:** the fourth tab pushed the nav past 390 px
  (horizontal overflow). The tabs now share the width (`flex: 1 0 auto`) and the nav scrolls as
  a fallback. Checked clean at 320, 360 and 390 px.
  - **Session 4:** add a Chromium overflow check at 320 px to the layout suite (L-checks).

## Session 3 checkpoint — step 6 done (bulk marking and touch), 3 Oct 2026

### Done
- **One mark path, two speeds.**
  - `applyMark(i, st)` changes a row's state and any rendered row.
  - `setMark` = one `applyMark` + `afterMarks()` (save, refresh, panel).
  - `bulkMark(list, st, what)` = many `applyMark`s + one `afterMarks()`. It snapshots every
    touched row's **previous** state, so Undo restores a `reading` row as reading and a skip as a
    skip (B-2, V-27).
- **Bulk marks the rows the current view counts** (plan filters plus active browse filters), so
  "mark this era read" turns that banner ✓. This is my call: it respects "mandatory only",
  Essential view and similar filters.
  - Era read / unread and an era range (selects default to the full span and are kept across
    Settings re-renders through the `change` listener).
  - Arc read / unread from new **Mark arc read / unread** buttons in an `.arc-acts` row on each
    arc head, next to the ✎ (XM-11).
- **Touch** (Settings → Touch, both **off by default**):
  - **Swipe:** right = read, left = skip, ≥60 px and mostly horizontal. The row slides over a
    coloured backing (`data-swipe` read / read-go / skip / skip-go).
  - **Long-press** (600 ms) on a band, era or arc head marks it all read with Undo. Moving
    cancels it, and the click that follows the lift is swallowed so the head doesn't also toggle.
  - Listeners: `touchstart`, `touchmove` and `touchend` are passive and delegated, for **8 of 12**
    in total.
- **No haptics:**
  - `80-guards` checks the template code for `vibrate` with comments stripped but strings kept;
  - `9c-bulk-touch` stubs `navigator.vibrate` and asserts zero calls across every gesture;
  - putting a haptic tick back fails both.
- **Settings** has 5 sections now (T-11). Expand all / Collapse all also sit in Bulk actions.
- **Tests:** `9c-bulk-touch` (53 assertions), including 5,000 rows marked in one action in about
  0.1 s. Mutation-checked:
  - v2's delete-all undo → 6 failures;
  - a haptic tick → 2 failures;
  - no click swallow → 1 failure.
- **Real Chromium** at 360 px: a mid-swipe row translates 28 px over the accent backing; the Bulk
  and Touch sections lay out cleanly with no overflow. During a swipe the row pokes past the card
  edge; **session 4** may clip that with `overflow: hidden` on `.arc` if focus rings allow.

## Session 3 checkpoint — step 7 done (story, character and creator filters; presets), 3 Oct 2026

### Done
- **Essential / Complete (V-10)**, a PLAN setting kept in `settings.events`.
  - Controls: Story section chips plus a Settings seg; it shows as an active chip when Complete,
    and Clear all returns it to Essential.
  - **The build now emits each event's own `arc`** (`D.events[k].arc`). Only that heading carries
    "Complete view adds N issues" (a button that switches views), or "Complete view: N more than
    Essential" in Complete view. Chapters merged into the tracker's own arcs keep those arcs and
    get no note; mutation-checked.
- **Appearances (V-11, FP-5)**, a BROWSE filter.
  - Each character chip shows their major and minor appearances; **Include cameos** adds the
    cameo appearances.
  - `chars` and `cameos` persist by name, and unknown names are dropped.
- **Creators (CR-7/8/10)**, session-only like search.
  - The picker lists the creator index by count for the chosen role (Writers and artists /
    Writers / Artists), narrowed by typing.
  - **Picked or tapped names match exactly** through the creator index; typed text stays a
    substring search. This was proved on the stress set, where "Writer Number1" sits inside
    "…10–19" (1,375 typed vs 125 picked).
  - Credited names on arc heads are buttons (CR-8). The chip reads "Creator: “X” as artist".
- **Presets (F-22, S-24, FP-9).** "Save as preset" sits at the bottom of the panel, with an
  in-page name field.
  - What is saved: the persisted filters (by name), the order and Essential/Complete.
  - Apply keeps the session's search text. Saving a name that exists updates it, and delete has
    Undo.
- **Importance** shows on arc headings ("importance 5/5", V-12).
- **Tests:** `9d-story-filters` (52 assertions). Mutation-checked:
  - cameos always counted → fails;
  - picks matched by substring → fails;
  - the note on every arc holding a chapter → fails.
- **Real Chromium** at 360 px: the Characters, Creators and Presets areas render, with no
  overflow and no errors.

## Session 3 checkpoint — step 8 done (sync and backup), 3 Oct 2026

### Done
- **Build:** `data.js` carries `dataVersion` (sha256 of the ids in row order, 12 hex) and
  `retiredIds`.
- **Compact QR.** The prefix is `<KEY>:` (franchise key, uppercase alphanumerics), then
  `q3.<dataVersion>.<payload>`. The payload is base64url bytes:
  - a mode byte, then a varint row count;
  - the marks as RLE (one varint per run, `length × 4 + state`) or raw 2-bit, whichever is
    smaller;
  - the bookmark positions as delta varints.
  - **5,000 rows of realistic progress give a version-5 QR (88 characters, limit 15); mixed
    marks fit too (raw packing, version 30).** With RLE only, the mixed case overflows, so the
    choice of encoding matters.
- **10,000 alternating marks overflow a QR**: the app shows "Too much progress for a QR code:
  use the copy-code below instead", with the copy-code ready. That branch is tested, and the
  copy-code round-trips.
- **The QR holds a `#sync=` link — my call, open to veto.** XM-6 wants a camera scan to open the
  tracker and import, so the QR's text is `<page URL>#sync=<compact code>`. The payload is still
  the compact format. `#sync=` accepts either format, merges on open, reports counts and clears
  the link.
- **`qrcode.js` loads on demand** (only when Show sync code is tapped). In real Chromium the
  rendered QR, decoded with jsQR from a screenshot (installed in the scratchpad only), gives back
  exactly the expected link.
- **The full format** (copy-code `<KEY>:s3.<base64url JSON>`, copy-link, backup file
  `<key>-backup-YYYY-MM-DD.json`) is id-keyed and carries marks, bookmarks, reviews and settings.
  Unknown ids are ignored and reported; rows added since stay unread.
- **Import** shows a preview first, then:
  - **Merge** (the default): never downgrades a read mark, adds bookmarks, fills in missing
    reviews, and reports "Kept N read marks you already had".
  - **Replace**: an in-page confirm, then an exact restore (a full code replaces settings too; a
    QR replaces progress only), with a full-state snapshot and Undo.
  - A QR from another list version, or a code from another tracker, is refused with a pointer
    and nothing changes.
- **Old v2 codes** via `storage.legacy.qrPrefix`: the order is rebuilt from legacy numeric ids
  plus `retiredIds`, and v2's `count-first-last` check is honoured. The test puts a retired id
  in the middle, and every later position lands on the right row.
- **The franchise-string guard is narrowed for one false positive.** `position: absolute` (CSS)
  matched "absolute" (the Absolute line). The CSS declaration is now ignored, and a self-test
  proves "Absolute Batman" is still caught.
- The QR's white backing is a `:root` token (`--qr-paper`).
- **Listeners:** a `once()` helper registers the lazy script's and the file reader's load/error
  events. The static count is 9 of 12; S4 plans keydown + install prompt (11).
- **Tests:** `9e-sync` (59 assertions). Mutation-checked:
  - the v2 order without `retiredIds` → fails;
  - Merge downgrading read → 4 failures;
  - always RLE → 2 failures;
  - Replace without snapshot Undo → 4 failures;
  - no dataVersion check → fails.

---

## Transfer checkpoint — end of session 3 (features), 3 Oct 2026

### Done (all 9 steps; details in the step checkpoints above)
- **All 89 S3 lines in `FEATURE-INVENTORY.md` are present (80) or re-expressed (9), each naming
  its suite.**
  - Nothing in S3 is left todo. 55 lines remain: 51 for S4, 4 for S5.
- **The harness** went from 617 to **1,105 assertions** (+488) across 8 new suites:
  `97-durations`, `98-tabs-settings`, `99-display`, `9a-reading`, `9b-reviews`, `9c-bulk-touch`,
  `9d-story-filters` and `9e-sync`.
  - Every new rule was checked by putting the old or wrong behaviour back once.
  - 22 mutations were caught in all.
- **Per-format durations** (the 1 Oct addition) shipped first. For comics-only data, the
  figures are bit-identical to session 2.
- **Listeners:** 9 of 12 in app code (click, input, change, touchstart, touchmove, touchend,
  pagehide, visibilitychange, and the `once()` helper for one-off load/error events).
- **Final real-Chromium sweep** at 320 and 390 px over Checklist (panel open, era open), Reading,
  Reviews and Settings (sync code open): no page overflow, no page errors, and all four tabs
  fully visible.
  - The sweep caught the tabs being cut off at 320 px; the tab labels now scale with
    `clamp(13px, 4.2vw, 15px)`.
- **CLAUDE.md** gains the session's lessons:
  - Chromium sweeps at 320 px;
  - seeding storage before load;
  - the guard word that is also a CSS keyword;
  - comparing maps by content;
  - one toast, one Undo;
  - `dataVersion` and `retiredIds`.

### My calls this session (1–5 accepted 4 Oct; 6–8 still open to veto)
1. **Era navigation (XM-8) is a jump bar, not a filter.** Plain scroll is the default, because
   the Story section's era chips already filter. **Accepted 4 Oct.**
2. **Bulk marks respect the view.** Era, range, arc and long-press mark the rows the banners
   count, so "mandatory only" or Essential view limits them. **Accepted 4 Oct.**
3. **The QR holds a `#sync=` link** to the compact code, so a camera scan opens the tracker and
   merges (XM-6). **Accepted 4 Oct.**
4. **The Reading stepper ignores "newest era first"** and always steps in reading order.
   **Accepted 4 Oct.**
5. **The sync prefix is the whole franchise key**, uppercase alphanumerics (`FIXTURE:`). v2 used
   the first 4 letters, which could collide between trackers. **Accepted 4 Oct.**
6. **Merge keeps settings and fills only missing reviews.** Replace (full code) restores
   settings too. A QR's Replace touches progress only.
7. **Essential/Complete shows as an active chip,** so Clear all returns it to Essential.
8. **Review ✎ and "Mark arc read / unread"** share an action row under each arc heading.

### Decided 4 Oct (John) — do not reopen
- **Session 3's calls 1–5 are accepted** as shipped:
  1. The era jump bar is off by default.
  2. Bulk marking touches only the rows the figures count.
  3. The QR holds a `#sync=` link.
  4. The Reading tab steps in reading order.
  5. The sync prefix is the full franchise key.
- **Time left keeps the X-Men style:** `45m`, `3h`, `1.2d left` (days to one decimal). This is
  `timeLeft()` as shipped, so nothing changes.
- **Two additions to session 4's scope.** They are steps 1 and 2 of the plan below.
  1. **Collapsible Settings.**
     - Settings sections collapse like the filter panel: icon, name and a one-line summary on
       each header.
     - All collapsed by default, with the open state remembered in namespaced storage.
     - Same animation and tokens as the filter panel.
  2. **Data-driven visibility (a rule, not a one-off).** A control or section only renders when
     the dataset gives it something to do. The rule is in CLAUDE.md → UI rules.
     - Tests: a comics-only, single-era, no-extras fixture where none of these controls
       appear; the full fixture where all of them do; and a mutation check that forcing one on
       is caught.

### Open items for session 4
- **A Chromium layout suite in the harness or CI.**
  - The L-1…L-9 checks, plus the session-3 sweep: every tab at 320 px, no overflow, all tabs
    fully visible.
  - That sweep lives only in this session's scratchpad. Rebuild it under `test/layout/` with
    Playwright (`executablePath: '/opt/pw-browsers/chromium'`).
- **Fonts:** `@font-face` isn't wired up yet, so every measurement this session used fallback
  fonts. Re-measure the tabs at 320 px once Plex/Anton load.
- **Swipe:** a swiped row pokes past the card edge (`translateX(28px)`). Clip it with
  `overflow: hidden` on `.arc` if focus rings survive.
- **Real-device check:** swipe and long-press on iOS (passive listeners; the lift's click is
  swallowed after a long-press).
- **Offline QR:** `sw.js` already precaches `qrcode.js`. Verify the QR draws offline once the
  service worker work lands.
- **Listener budget:** 9 used. S4 adds keydown (V-7, XM-3) and the install prompt (F-37), for 11
  of 12.
- **content-visibility (V-15)** is still the "decide in S4" item. The proposed resolution
  (render an era only on first open) is what v3 already does.

### Session 4 starts with: look and PWA (spec §7.4)
Work through every S4 line in `FEATURE-INVENTORY.md` (51):
1. **The token system and skins** (V-5, F-52…F-54, F-51, S-2…S-5, S-9, S-20, T-40, T-45, T-54…T-57,
   T-98, T-103, XM-17, XM-18):
   - one `:root` token block;
   - skins as pure CSS that never move or hide a control;
   - the reachability guard;
   - density, text size, mark style, button size, dyslexia font, the paper swatches and the
     skin beacon.
2. **Banners and table view** (F-16, F-17, F-49, S-7, S-10, S-11, T-50, T-51, L-7, L-8).
3. **The sticky stack measured at runtime** (F-58, L-1…L-6), proved in real Chromium.
4. **PWA** (F-35…F-38, F-59, XM-7): offline readiness, the online/offline class, the install
   prompt, the update flow and "Check for updates". Remember the iOS traps in CLAUDE.md.
5. **Accessibility and performance** (V-7, XM-3, V-8, V-18, FP-11): keyboard shortcuts,
   critical CSS inline, a preloaded display font, reduced motion and smooth panel animation.
6. **The content-visibility decision** (V-15), then this file's checkpoint.

---

## Session 4 plan (proposed 4 Oct 2026, questions answered 4 Oct): look and PWA — awaiting John's OK to start

Branch `claude/keen-wozniak-w7lt6p`, cut from `main` at `d88a32d` (sessions 1–3 merged).

**Scope:**
- the 51 S4 lines in `FEATURE-INVENTORY.md`;
- John's two additions (steps 1 and 2);
- the open items above.

**Method (as in session 3):**
- Each step lands with its tests, one mutation check (the old or wrong behaviour put back once),
  updated inventory statuses and a checkpoint here.
- Anything visual is measured in real Chromium, never reasoned about.
- The session length rule holds: stop only at the end of a finished step, and record where the
  next one begins.

1. **Data-driven visibility** (John, 4 Oct; the rule is in CLAUDE.md → UI rules). This comes
   first because every later control is added through it.
   - **The capability map.**
     - One map, `HAS`, built once at boot from the data (never from settings or the skin).
     - A read-only copy is exposed as `PullList.has` for the harness.
     - Every conditional control reads it. A missing capability means the control is not
       rendered, rather than hidden with CSS.
   - **John's list:**
     - One medium: no per-format lines, format filter, progress mode, duration copy or
       "+N untimed". Verbs are that medium's own; for comics, plain "Read".
     - Characters needs presence data, or two or more strands (answer 4: with strands, the
       section shows its strand chips).
     - Creators needs credits. That also covers the tappable names and the word "creators" in
       the search hint.
     - Essential/Complete needs events.
     - The ALT toggle needs ALT rows.
     - The order switch needs a second order.
     - Bands need periods.
     - The era jump bar needs two or more eras.
   - **A second order is measured, not declared.**
     - Publication order counts only if some era's rows are out of publication order.
     - Arc order counts only if some era's arcs interleave.
     - Today `mixed` offers a publication chip that changes nothing.
   - **The same rule applied further** (my reading of "a rule, not a one-off"; accepted 4 Oct).
     Each control needs:
     - depth chips: two tiers in use;
     - type chips: two types;
     - strand chips: two strands;
     - "Include cameos": a cameo grade;
     - "Mandatory only": both mandatory and optional rows;
     - "Notes only" and tap to reveal: a note;
     - "Gap notes": a gap note;
     - the era filter, Mark range and "Newest era first": two eras;
     - the look-up link: `searchUrl`;
     - help copy that names bands: periods.
   - **Saved state:** a saved filter or setting for a control that isn't offered is ignored, so
     nothing can filter through a control you can't see.
   - **New fixture `test/fixtures/minimal`.**
     - Comics only, one era.
     - None of: periods, presence, credits, events, ALT rows, notes, `searchUrl`, or a second
       order.
     - Exactly one type, one tier and one strand.
   - **New suite `9f-visibility`.** One table pairs each control with its capability.
     - On `minimal`, none of these controls appear on any tab, with every panel and Settings
       section opened. The controls every tracker has (search, marks, bookmarks, pace, hide
       skipped, skins, backup and so on) still do.
     - On the full fixture, all of them appear. The full fixture is `basic` plus one untimed game
       added at test time, because `basic` is fully timed by design.
     - `mixed` checks the measured-order case.
   - **A permanent mutation self-test.**
     - `boot()` gains an `appSrc` option.
     - The suite forces each capability on in turn in a copy of `app.js`, and every one must be
       caught on `minimal`.

2. **Collapsible Settings, with one section component for both panels** (John, 4 Oct; FP-11).
   - **Sections collapse like the filter panel.**
     - Each header shows an icon, the name, a live one-line summary and a chevron.
     - All sections start collapsed.
     - The open ones are kept in `settings.settingsOpen`, next to `panelOpen` in the one
       namespaced store.
   - **One helper renders the section heads** of both the filter panel and Settings, so the
     two can't drift.
   - **The animation (FP-11), shared by both.**
     - Bodies stay in the DOM and collapse with `grid-template-rows: 0fr → 1fr`, so nothing is
       measured.
     - A closed body is `inert`, so the keyboard and screen readers skip it.
     - The chevron rotates. Colours come from tokens only, and nothing moves under
       `prefers-reduced-motion`.
   - **Summary examples:**
     - Reading behaviour: "Average 15 min · Steady 12 a week".
     - Display: "Badges · Headings · Plain scroll".
     - Touch: "Gestures off".
     - Data: "Quarterly reminder · 3 bookmarks".
     - Backup: "Sync code and backup file".
     - The new Look and Offline sections get theirs in steps 4 and 7.
   - **An import preview opens Backup on its own,** so a pasted code or a file never waits
     inside a closed section.
   - **Tests in `98-tabs-settings`:**
     - sections start collapsed;
     - the open state survives a reload, read after the 400 ms debounce;
     - summaries follow the settings;
     - a closed body is inert.
   - **Earlier suites** open the sections they use through one helper. No assertion is removed or
     weakened.
   - **Mutations:** an open state that isn't saved, and a summary that isn't refreshed.

3. **A Chromium layout harness**, built before the visual steps so that they are measured.
   - **Setup:** `test/layout/` with Playwright (`executablePath: '/opt/pw-browsers/chromium'`),
     served over `http://localhost`, because `cssRules` throws on `file://`.
   - **Checks:**
     - no page errors (L-9);
     - every tab at 320, 360 and 390 px, with no horizontal overflow (`scrollWidth`) and all four
       tabs fully visible;
     - a helper that asks the browser which rules match an element, for multi-line selectors.
   - **Fonts:** `@font-face` for Plex Sans, Plex Mono and Anton, with `font-display: swap`, so
     every later measurement uses the real fonts. Then re-measure the tabs at 320 px.
   - **CI (answer 3): every push.** The workflow installs Chromium and runs `test/layout/`
     after the harness. Layout, contrast, reachability and offline checks become gates like
     the harness, and a zero check count fails as well.

4. **One token system and the skins.** Inventory lines: V-5, F-39, F-52…F-57, S-1…S-6, S-9, S-20,
   S-25, T-38…T-45, T-54…T-57, T-81…T-116, T-98, T-103, XM-17, XM-18, and D-12 styling.
   - **Colour stays in the one `:root` block.**
     - Colours become formulas over a few numeric inputs: the hue, saturation and lightness of
       the paper, ink and accent.
     - A skin or a paper swatch sets only those inputs, with no colour written outside
       `:root`, so skins and swatches combine freely.
   - **Era ramps are derived from each era's index.**
     - The hue is stepped by the golden angle, so there is no cap.
     - The 64-era stress set gets styled, and era tints stay pale washes.
   - **The colour guard is narrowed, not weakened.**
     - Outside `:root`, a colour function is allowed only when every argument is a token
       (`var()` or `calc()` of tokens).
     - A self-test proves that a literal outside `:root` (`#fff`, `hsl(200 50% 50%)`) is still
       caught.
   - **Skins set `data-skin` and tokens only** (fonts, corner radius and letter case included).
     A guard asserts that no skin rule touches position, display, visibility, size or order.
   - **The reachability guard (V-5).** In every skin, every control the visibility table
     expects must be:
     - rendered and displayed;
     - inside the viewport once its section is open;
     - the topmost element at its centre (`elementFromPoint`).

     jsdom checks presence; Chromium does the hit-testing.
   - **Contrast is measured.** For every skin × paper swatch, these must clear WCAG AA in
     Chromium:
     - body text, soft text and chips;
     - era text on its tint, for eras 0–63;
     - chip borders, at the 3:1 non-text ratio (T-40).
   - **The skins (answer 1: v2's four, re-expressed as token sets):**
     - **Paper:** today's light look.
     - **Newsprint:** v2's newsprint theme.
     - **Pull:** the X-Men look, with a cream page, Anton capitals, mono metadata and a black
       tab bar.
     - **Night:** dark, designed against its surface, with contrast measured.

     A tracker picks its default in config (T-104). Each skin sets `data-skin` and nothing else
     (T-81).
   - **Settings → Look:**
     - skin: one option per configured skin, with the default from config;
     - paper: 7 swatches;
     - era hues: split or mono;
     - text size, as a scale multiplier that the title follows (XM-18, T-45);
     - density;
     - button size: compact restores the 26 px mark, standard, and large at 44 px or more;
     - mark style: box, dot or tick (XM-17);
     - dyslexia font.

     Changing skin keeps the current tab and round-trips (T-83, T-103, T-116).
   - **Skin beacon (F-57, T-98):** a `--skin-ok` token is read at boot, and a stale
     `styles.css` shows a warning.

5. **Banners and table view.** Inventory lines: F-16, F-17, F-49, S-7, S-10, S-11, T-50, T-51,
   L-7, L-8.
   - **Mini progress bar:** on by default.
   - **Persistent banner:** off by default. It is one compact line, split per format only when
     the data mixes formats (step 1's rule).
   - **Table view:** compact rows at least halve the row height, and no row is wider than the
     screen. Both are measured in Chromium.

6. **The sticky stack, measured at runtime.** Inventory lines: F-58, L-1…L-6.
   - **The stack.**
     - The tabs stick to the top.
     - The mini bar or banner sits directly under them.
     - `--stack-h` comes from a `ResizeObserver`, which is not an event listener, and never
       from a hard-coded height.
   - **Proved in Chromium after scrolling:**
     - the tabs stay pinned and the banner sits directly under them;
     - no band is shifted onto its own intro;
     - there are no more than 16 px between bands;
     - skins never change positioning (the `position: relative` trap).
   - **Swipe clip:** `overflow: hidden` on `.arc`, if focus rings survive it (open item from
     session 3).

7. **PWA.** Inventory lines: F-35…F-38, F-59, XM-7, the live install of D-2, the icons of D-13,
   and V-17.
   - **Settings → Offline.** The service worker is registered, and the section shows:
     - ready, not ready or unsupported, with "N of M files cached";
     - the build tag.
   - **Online and offline.** Per the 2 Oct decision there are no online/offline listeners.
     - `navigator.onLine` is read at boot, on `visibilitychange` and before network actions.
     - The `.offline` class and a toast follow any change.
   - **Install prompt:** `beforeinstallprompt` is listener 10. "Installed." comes from the
     prompt's result.
   - **Update flow.**
     - Two pieces: "A new version is ready → Reload", and a "Check for updates" button
       (`reg.update()`).
     - It is checked at boot, on `visibilitychange` and from the button. One-off waits go
       through `once()`.
   - **A real-Chromium offline check** over `http://localhost`.
     - Install, go offline and reload: the app boots from the cache, and the QR still draws.
     - Every fetch path ends in a real `Response`, because of the iOS trap.
   - **Icons from config.**
     - `franchise.icons` is optional, and the build checks the PNG sizes (stdlib only).
     - The build warns when a franchise other than the starter ships the template's
       placeholder icons, matched by hash.

8. **Accessibility and first paint.** Inventory lines: V-7, XM-3, V-8, V-18.
   - **Keyboard** (`keydown`, listener 11):
     - on the Reading tab, ← and → step, R reads and X skips;
     - "/" focuses search;
     - keys are ignored in inputs and with modifier keys.
   - **An aria audit in the harness:**
     - every button and input has an accessible name;
     - the tabs, the panel and the Settings sections carry `aria-expanded` and
       `aria-controls`;
     - reduced motion stops every transition.
   - **First paint (answer 2: one stylesheet plus preload).**
     - `styles.css` stays the single stylesheet: one token block in one file, served from the
       service-worker cache after the first visit.
     - Preload the display font.
     - `data.js` and `app.js` don't block the first paint.
     - V-8 is re-expressed as a measured first-paint check in Chromium, before and after.

9. **Close-out.**
   - Record the V-15 decision: lazy rendering replaces `content-visibility`, as shipped since
     session 2 (closed by John, 4 Oct).
   - Update the inventory statuses.
   - Run the full Chromium sweep: 320, 360 and 390 px × every tab × every skin.
   - Write this file's checkpoint.
   - Update CLAUDE.md's repo map with `minimal` and `test/layout/`.

**Listener budget:**
- 9 today, 11 of 12 after this session: `keydown` and `beforeinstallprompt`.
- The `ResizeObserver` and the one-off service-worker waits add none.

**New suites:**
- jsdom: `9f-visibility` (step 1), `9g-look` (step 4), `9h-pwa` (step 7) and `9i-a11y` (step 8);
- Chromium: `test/layout/` (steps 3–9).

**Answers from John (4 Oct) — do not reopen:**
1. **Skins:** v2's four, as token sets: Paper, Newsprint, Pull and Night. Each tracker's
   default comes from config.
2. **First paint (V-8):** one stylesheet plus preload. Nothing is inlined, and `index.html`
   stays hand-written. V-8 is re-expressed as a measured first-paint check.
3. **The Chromium suite runs in GitHub Actions on every push,** as a gate like the harness.
4. **Strands without presence data:** the Characters section shows when there are two or more
   strands, holding the strand chips. With one universal strand and no presence data, it is
   gone.

---

## Session 4 checkpoint — step 1 done (data-driven visibility), 5 Oct 2026

### Done
- **The capability map.**
  - `app.js` builds one map, `HAS`, from the data at boot. It has 19 capabilities: media,
    presence, strands, cameos, credits, events, alt, publication, arcOrder, bands, eras, tiers,
    types, mandatory, notes, reveal, gapNotes, lookup and legacy.
  - Every conditional control reads it, and a missing capability means the control is not
    rendered. `PullList.has` is a frozen copy for the harness.
  - The old one-off checks (`HAS_BANDS`, `MEDIA_USED.length > 1`, `D.events.length`,
    `D.characters.length`, `searchUrl`, `storage.legacy`) now go through the map.
- **Sections are offered by their contents.**
  - Story needs events, eras, formats, types or ALT. Characters needs presence data or two
    strands (John's answer 4). Creators needs credits. Order needs a second order.
  - Reading is always offered, because Unread only and Hide skipped always have work to do.
- **A second order is measured.**
  - Publication order is offered only if some era's rows are out of publication order. Arc
    order is offered only if some era's arcs interleave.
  - `mixed` loses a publication chip that changed nothing.
- **Saved state.**
  - A saved filter for a control that isn't offered is ignored (`FILTER_CAP`).
  - An order or Complete view the data doesn't offer falls back to reading and Essential: in
    `withDefaults`, in presets and in `setFilter`.
- **Copy follows the data.**
  - The search hint names notes and creators only when there are some; the static `index.html`
    hint is now "Search titles and arcs…".
  - The Touch help names bands only with periods.
  - With mixed formats, Reading behaviour gets a duration line: "Comics are timed at your minutes
    per issue; shows and games count their own length."
- **The rule applied further (accepted 4 Oct):** depth chips, type chips, strand chips, Include
  cameos, Mandatory only, Notes only, Tap to reveal, Gap notes, the era filter, the era picker,
  Mark range, Newest era first and the look-up link.
- **New fixture `test/fixtures/minimal`:**
  - 6 comics in 2 arcs and one era;
  - one type, tier and strand;
  - no periods, presence, credits, events, ALT, notes, `searchUrl`, legacy or second order.

  CI builds it too.
- **New suite `9f-visibility` (27 assertions).**
  - One table of 36 controls × 19 capabilities, plus 3 markers driven by the data itself and
    15 controls every tracker has.
  - `minimal`: none of the 36 appear, on any tab, with the panel and every section open. The
    controls every tracker has do appear, the verb is plain "Mark Read", and no other format's
    words appear.
  - Full fixture (`basic` plus one untimed game, added at test time): all of them appear.
  - `mixed` checks the measured-order case. A saved-state check ignores, among others,
    notes-only, which would otherwise hide every row.
  - **Permanent self-test.** `boot()` gains `appSrc`. Each capability is forced on in turn in a
    copy of `app.js`, and its own controls must appear on `minimal`. A capability with no row
    fails the suite.
- **Mutation checks**, each with the old or wrong behaviour put back once:
  - saved filters applied through hidden controls → 2 failures;
  - order chips not measured → 1;
  - Characters section always offered → 3;
  - a gate that bypasses the map → the self-test fails.
- **Real Chromium** (`minimal` and the root starter, 320 and 390 px, every tab): no overflow,
  no page errors. The bare tracker's panel shows only the Reading section.
- **Inventory:** V-30 added as present (9f-visibility), and V-31 (collapsible Settings) added as
  todo.

### One reading to flag (accepted 4 Oct, as call 2 of the session)
- **"+N untimed" follows the data, not the format count.** Comics never lack a length, so a
  comics-only tracker never shows it, as the rule asks.
- A single-format tracker of games with missing lengths would still show it. Hiding it there
  would print a time left that silently leaves rows out, against the 3 Oct durations decision.


## Session 4 checkpoint — step 2 done (collapsible Settings, one section component), 5 Oct 2026

### Done
- **One collapsible section component** (`secHtml`) renders both the filter panel's sections and
  the Settings sections.
  - Each head is a button with an icon, the name, a live one-line summary and a chevron. In
    Settings it sits inside an `h2`.
  - The shared classes are `.sec`, `.sec-head`, `.sec-name`, `.sec-sum`, `.sec-body` and so on.
    `fsec` and `sset` remain as the group classes, and the body ids stay `#fsec-*` and `#set-*`.
- **Settings sections collapse like the panel.**
  - Reading behaviour ◷, Display ◧, Touch ☝, Bulk actions ☑, Data ▤ and Backup ⇄.
  - All start collapsed. The open ones are kept in `settings.settingsOpen`, next to `panelOpen`
    in the one namespaced store.
  - Summaries are live: "Average 15 min · Steady 12 a week", "Badges · Headings · Plain scroll",
    "Gestures off", "Quarterly reminder · 0 bookmarks", "An import is waiting".
- **The animation (FP-11).**
  - Bodies stay in the DOM and open by animating their grid row from 0fr to 1fr, so nothing is
    measured. A closed body is `inert`.
  - Toggling changes the section in place, with no re-render, so the transition runs.
  - Reading a code or a file opens Backup, so a pending import never waits in a closed section.
- **Bug found by measuring (since session 2):** reduced motion didn't stop any transition.
  - `* { transition: none }` has no specificity, so every class rule that declares a transition
    beat it. jsdom and a CSS-text test both "passed".
  - Fixed with a `--motion` token: every duration is `calc(… * var(--motion))`, and
    `@media (prefers-reduced-motion: reduce)` sets it to 0.
  - A guard checks that every transition and animation uses it (mutation: one plain `.15s` put
    back → caught).
  - Real Chromium: a section is 262 of 402 px tall at 90 ms normally, and fully open at once
    under reduced motion.
- **Tests now honour `inert`.**
  - `boot()` makes `click()` and `focus()` do nothing inside an inert body, as for a person, since
    jsdom doesn't implement it.
  - New helpers `openSections(app, g, keys)` and `openSettings(app, keys)` tap section heads
    open. The suites that use Settings call them.
  - **Re-expressed, not weakened:** "closed bodies aren't rendered" (92-filters) became "closed
    bodies are inert".
  - Undo-after-Replace (9e-sync) now expects `settingsOpen: ['backup']` alongside `tab`, because
    the test opens Backup to paste, like a person.
  - Class-name selectors were renamed mechanically; no assertion was removed.
- **New tests in `98-tabs-settings`** (+22): sections and icons in order; collapsed and inert by
  default; summaries per section, and following pace, per-format, swipe and the reminder; one
  component (heads share their parts with the panel's); toggled in place; open state saved after
  the 400 ms debounce and restored on the next visit, separately from the panel's; the pending
  import summary; the shared animation rule; the motion guard.
- **Mutation checks:**
  - open state not recorded → 5 failures and a crash;
  - summary not refreshed → 1;
  - a toggle that rebuilds the section → 5 failures and a crash;
  - closed bodies not inert → 3;
  - a transition that ignores `--motion` → 1.
- **Real Chromium** (`mixed`, 320 and 390 px): Settings collapsed and fully open, with no
  overflow and no page errors. `visibility` also opens Settings sections in its audit now.
- **Inventory:** V-31 and FP-11 present.


## Session 4 checkpoint — step 3 done (the Chromium layout harness, fonts), 5 Oct 2026

### Done
- **`test/layout/`**, the real-Chromium suite. It is run as `npm run test:layout`, which is
  `HARNESS_SUITES=test/layout node test/run.js`.
  - It uses the same runner as the jsdom harness, so any failure, crash or zero count fails the
    run. `run.js` now resolves `HARNESS_SUITES` to an absolute path.
  - **`lib.js`:**
    - finds Chromium from `CHROMIUM_PATH`, then Playwright's default (`PLAYWRIGHT_BROWSERS_PATH`
      here, the CI install there), then `/opt/pw-browsers/chromium`. With no browser it crashes
      with a clear message, never a silent skip;
    - serves the repo over `http://localhost`, with a build's `data.js`, `sw.js` and
      `manifest.json` swapped in;
    - opens a page at a width, with storage seeded before load and page and console errors
      collected;
    - opens sections the way a person taps them;
    - has `rulesFor()`, which asks the browser which rules match an element.
  - **`10-sweep` (36 checks):** `basic`, `mixed`, `minimal` and the starter × 320, 360 and 390 px
    × every tab, with everything open: no horizontal overflow, all four tabs fully visible in the
    bar, no page or console errors (L-9).
  - **`20-motion` (8):** sections open and shut through a `grid-template-rows` transition in both
    the panel and Settings, ending at full height and at zero. Under reduced motion a section
    opens at once, and no element has any duration. Measured through `getAnimations()`, so the
    result doesn't depend on machine speed.
  - **`30-css` (10):**
    - `rulesFor` finds a grouped selector that spans lines (what grep misses) and the real `.tool,
      .linkbtn` rule;
    - all 12 `@font-face` files load;
    - the body is in IBM Plex Sans and the title in Anton;
    - every vendored font file is declared.
- **Fonts:** 12 `@font-face` rules for the vendored files (Anton 400; Plex Sans 400/500/600; Plex
  Mono 400/500; latin and latin-ext ranges), with `font-display: swap`. The service worker already
  precaches them.
- **Re-measured with the real fonts (an open item from session 3):** at 320 px the four tabs take
  287 of 288 px with the `clamp()` label size (13.4 px). It fits but is tight, and the sweep now
  guards it.
- **Dependency:** `playwright-core` 1.56.1 (exact), which matches the pre-installed Chromium 1194.
  It never downloads a browser on install.
- **CI:** after the harness, it installs Chromium (`npx playwright-core install --with-deps
  chromium`), runs the layout suite, and requires a non-zero count for both runs. `00-runner`
  checks that the workflow still does this (+3).
- **Mutation checks:**
  - something 400 px wide → 12 failures;
  - the old `* { transition: none }` → 2;
  - a font file that 404s → 12;
  - 19 px tab labels → 4, at 320 px on every dataset.
  - Putting session 3's 15 px labels back is not caught, because with the real fonts they fit
    (290 rounded vs 288 px; the true sum is under 288).
- **CLAUDE.md:** the repo map gains `test/layout/`, the "done" checklist names
  `npm run test:layout`, and the jsdom trap records the reduced-motion lesson.


## Session 4 checkpoint — step 4 done (one token system, four skins, the Look), 5 Oct 2026

### Done
- **One token block (`styles.css` `:root`).**
  - It holds numeric inputs (paper hue and saturation; lightness for paper, card, line, edge,
    track, bar, ink, soft text, accent, wash and states) and derives every colour from them.
  - New roles: `--edge` (control outlines, 3:1 on paper and card), and `--bar` /
    `--bar-ink` / `--bar-soft` / `--bar-mark` for the tab bar.
  - Type, shape and space are tokens too: `--font-meta`, the display and name case and
    weight, the tab size and fit, `--scale`, `--row-pad`, `--tap`, `--b-min`, `--mark-radius`.
  - All 43 font sizes are `calc(N px * var(--scale))`.
- **Four skins (John's answer 1): Paper (the base), Newsprint, Pull and Night.**
  - Each is a bare `:root[data-skin]` block of inputs: no colour literal and no layout.
  - **Newsprint:** newsprint paper, Georgia display, a dark tab bar, newspaper red.
  - **Pull:** the X-Men look — cream paper, Anton capitals for the title, bands and eras,
    mono metadata, a black tab bar.
  - **Night:** dark, from v2's signature palette, designed against its surface.
- **Seven paper swatches.** The same declaration colours the page and the swatch button.
  "Skin default" uses the skin's own paper.
- **Era colours.**
  - Derived per era index in OKLCH, so one lightness reads alike at every hue. The hue steps by
    the golden angle, so there is no cap.
  - "One colour" uses the skin's accent hue. Washes are pale.
  - The era index reaches CSS as `style="--ei:N"`. B-6 (no inline styles) is narrowed to allow
    custom properties only, with a self-test that `color: red` is still caught.
- **Settings → Look ◐** (the second section):
  - skin (only with two or more skins configured);
  - paper swatches;
  - era colours (only with two or more eras);
  - text size, density, button size and marks (box / dot / tick and cross);
  - a dyslexia-friendly font.

  Each is a root attribute (`data-skin`, `data-paper`, `data-eras`, `data-text`, `data-density`,
  `data-tap`, `data-marks`, `data-dys`) answered with tokens only. The summary lists what
  differs from the defaults.
- **Skins come from the data.** `franchise.skins` (default all four) and `franchise.skin` (a
  first visit's skin) are in the schema and the build. They are validated, with two new broken
  cases: `skin-unknown` and `skin-not-offered`. `minimal` declares one skin.
- **Mark styles** change the glyphs (`glyph()`); screen-reader labels still name the state.
- **The browser chrome:** the `theme-color` meta follows the skin's paper, falling back to the
  franchise colour where nothing is computed (F-39).
- **The skin beacon (F-57):** `--skin-ok: 3` in the stylesheet. A stylesheet with an older or
  missing beacon gets "The page styles are out of date … Reload", which outranks the other boot
  toasts.
- **Guards (80-guards, +9).**
  - The colour guard is narrowed, not weakened: outside `:root`, a colour function is allowed
    only when every component is a token. Self-tests prove that `hsl(200 50% 50%)`, a literal
    alpha, a partly literal `hsl`, `#fff`, `rgb(var…)` and `oklch(.9 .03 var(--h))` are still
    caught.
  - Skin, paper and Look blocks must be bare and set custom properties only.
  - The build and `app.js` know the same skins; every skin and swatch has its block; the
    beacon matches.
- **`9g-look` (29 assertions):**
  - the defaults; one option per configured skin (T-97); seven named swatches; button size has 3
    options, standard by default (T-54, T-55);
  - a skin changes no element, class, id or hidden state (T-81, V-5) and keeps the tab (T-83);
    no trace of the last skin (T-103); round trip (T-116);
  - all 25 Look options set their attribute and change nothing else;
  - the summary; mark glyphs for box, dot and tick;
  - stored in the one store and restored; unknown values fall back;
  - the skin from config (T-104); two configured skins; one skin → no control;
  - the beacon: current, older, missing.
- **`9f-visibility`:** rows for the skin control and the era-colours setting (now 38 controls
  and 20 capabilities), and a row for the Look controls every tracker has.
- **`test/layout/40-look` (12 checks, real Chromium):**
  - **Contrast:** 4 skins × 7 papers. 18 text pairs at 4.5:1 (worst 5.12) and 5 outlines
    at 3:1.
  - **Era banners:** 64 eras × 4 skins × split and one colour. All text clears AA on its wash,
    washes are pale, neighbours differ.
  - **Reachability (V-5):** 5,328 controls across 4 skins × 390/320 px × default and largest
    settings. Each is displayed, at least 24 × 24 px, in view, and is the element hit at its
    centre.
  - **Overflow:** every skin at 320 px, with default and the largest settings: no overflow and
    all four tabs in the bar.
  - **Sizes:** text size (T-45, XM-18); 26 px compact mark (T-56); 44 px large glyph buttons
    (T-57); the dyslexia font; density changes row height.
- **Found by measuring:**
  - Night's control outlines reached only 2.95:1 on the warm and mint papers; `--l-edge` went
    from 45% to 49%.
  - The event note's "Complete view adds N issues" button was 17 px tall; every `.linkbtn` now
    has a 24 px minimum.
- **Mutation checks**, each with the wrong behaviour put back:
  - Night era text not designed against its surface → caught;
  - a skin token collapsing the marks → caught, after the reachability check gained the 24 px
    target (a 1 px "has a size" check missed it);
  - theme-color not following → caught;
  - a skin block with `position` → caught;
  - a literal colour outside `:root` → 3 failures;
  - mark style changing nothing → caught;
  - the beacon never checked → 2 failures.
- **Inventory:** 49 lines present or re-expressed: V-5, F-39, F-51…F-57, S-1…S-6, S-9, S-20,
  S-25, T-38…T-45, T-54…T-57, T-81…T-116, T-93, XM-17, XM-18 and D-12 styling.
- **CLAUDE.md:** the colour trap records how v3 holds it, and the 24 px target rule.


## Session 4 checkpoint — step 5 done (the banner, the mini bar, table view), 5 Oct 2026

### Done
- **Under the tab bar, on every tab:** `#pbanner` and `#mini`. Layout lives on inner wrappers,
  so `[hidden]` wins. Step 6 makes the stack sticky.
  - **Mini progress bar (F-17, on by default):** a `<progress>` showing the header's read of
    goal.
  - **Persistent banner (F-16, off by default):** one compact line, or one line per format when
    progress is per format (which only mixed data offers).
    - Each line has the format's name and its own verb ("12 / 40 read", "1 / 2 beaten",
      "0 / 3 watched"), time left, "+N untimed" and a thin bar.
    - It draws from `renderHeader`, so a mark moves it with the header, with no re-render.
- **Table view (F-49, S-7):** one line per issue.
  - Rows lose their vertical padding, and marks and badges drop to `--tap-dense`: 24 px, or
    44 px with large buttons, so targets never shrink below 24 px.
  - Titles ellipsise. Notes, blurbs and intros fold away.
  - Badge words sit in `.b-t` spans that table view hides. The glyph stays, and the look-up link
    and flashback button now carry full `aria-label`s.
- **Display gains** Table view (Rows) and Mini progress bar / Persistent banner (Progress).
  The summary says "table view", "banner" or "no mini bar".
- **`9h-banners` (27):**
  - the defaults (T-50, T-51); placement under the bar, outside the panes;
  - the mini bar and the banner match the header, and a mark moves both; both turn off;
  - table view's flag; badge words fold but the text and names stay; kept in the one store;
  - per format: three lines in their own verbs, matching the header's per-format counts and
    untimed marker.
- **`9f-visibility`:** a row for the per-format banner lines (media).
- **`test/layout/50-table` (21, real Chromium):**
  - L-7: table view at least halves the median row height, in 4 skins × 320/390 px;
  - L-8: no table row wider than the screen (944 rows, default and largest settings);
  - every title keeps at least half its row;
  - every control in table view is reachable at 24 px (5,472 checked);
  - no page errors;
  - the banner (per format) and the mini bar show on every tab, in every skin, at 320 px.
- **Reachability** moved into `test/layout/lib.js` (`reachability()`, `eachTab()`), shared by
  40-look and 50-table.
- **Found by measuring:** the mini bar made the page 16 px wider. `progress.bar { width: 100% }`
  outranked `.mini-bar { width: auto }`, and the sweep failed everywhere. The inset now lives on
  the wrapper.
- **Mutation checks:**
  - banner and mini bar not refreshed → caught;
  - mini bar off by default → 5 failures;
  - table rows keeping their padding and full marks → L-7;
  - a title that doesn't ellipsise → L-8;
  - badge words that don't fold → caught, once the title-share check was added. Before it, rows
    still fit, with titles squeezed to 26%.
- **Inventory:** F-16, F-17, F-49, S-7, S-10, S-11, T-50, T-51, L-7 and L-8 present.
- **CI:** run 30 (step 4) is green, with both counts in the log.


## Session 4 checkpoint — step 6 done (the sticky stack), 5 Oct 2026

### Done
- **One sticky `#stack`** holds the tabs, the banner and the mini bar (`position: sticky; top: 0`).
  It is full width, so the paper behind it covers what scrolls under.
  - The banner joins the tab bar directly (no gap, no top border).
- **`--stack-h`, measured at runtime (F-58).**
  - A `ResizeObserver` on the stack writes its height. It is not an event listener, so the
    budget stays at 9.
  - The inline `--stack-h` on `<html>` is a token, which B-6 allows.
  - It drives `scroll-margin-top` on rows, arcs, eras and bands, so a jump lands below the stack.
- **Band and era banners stay non-sticky** (my call, accepted 4 Oct): they are tall goal banners, and
  pinning them would take most of a phone screen.
- **The swipe clip** (session 3's open item): `.arc` clips with `overflow: hidden`, so a row
  mid-swipe slides under the card edge. Rows keep 6 px inside the card, so focus rings aren't cut.
- **`test/layout/60-stack` (20, real Chromium):**
  - after scrolling, every skin, Checklist (390 and 320 px) and Settings: the stack holding the
    tabs is sticky and the tabs are at the top (L-1, L-2); the banner is within 2 px under the
    tabs (L-3, L-4); `--stack-h` equals the measured height;
  - turning the banner on grows the stack, and `--stack-h` follows;
  - `jumpToIssue` lands every row below the stack;
  - era chips land each era 0–16 px below the stack, except where the page ends;
  - bands at most 16 px apart and never on their intros, in every density (L-5, L-6);
  - a row mid-swipe is clipped at the card edge;
  - no page errors.
- **`9h-banners` (+1):** the stack holds the tabs, the banner and the mini bar, in order.
- **Mutation checks:**
  - `position: relative` on the stack (the CLAUDE.md trap) → L-2 and the era landing;
  - no scroll margin → era chips land under the stack;
  - measured once, never again → 3 failures;
  - no clip → the swipe check;
  - a gap between the tabs and the banner → L-4.
- **Inventory:** F-58, L-1…L-6, T-94 and T-96 present.
- **Still open from session 3:** the real-device iOS check of swipe and long-press needs a phone,
  so it stays for John.


## Session 4 checkpoint — step 7 done (offline and updates), 5 Oct 2026

### Done
- **The service worker is registered** (over http(s) where supported). The build adds `cache`
  (`<key>-<build>`) and `precache` (the worker's exact file list) to `data.js`, after hashing,
  so there's no circular dependency.
- **Settings → Offline ⇣:**
  - "Ready offline · N of N files saved", "Not ready yet · n of N … keep this page open while
    online", or "isn't available in this browser";
  - the connection, and the version (build);
  - Check for updates, and Reload now once one is ready;
  - Install as an app, while the browser offers it;
  - the iPhone and iPad hint: Add to Home Screen, then open it once online.
  - Summary: "Ready offline · update ready · offline now".
- **Online and offline (F-36), without listeners** (the 2 Oct decision): `navigator.onLine` is
  read at boot, when the page is shown again, and on every tap. A change toggles `body.offline`
  and a header mark, with a toast.
- **Updates (F-38, XM-7):**
  - looked for at boot (a waiting worker), quietly when the page is shown again, and on Check
    for updates;
  - a new worker is followed to "activated" through `once()`; then "A new version is ready" with
    Reload;
  - a first install is never called an update.
- **The install prompt (F-37):** `beforeinstallprompt` is listener 9 at boot (10 static with
  `once()`). The browser bar is held back; a toast and Settings offer Install; then "Installed."
  or a way back.
- **Icons from config (D-13):**
  - `franchise.icons` (192 / 512 / maskable) is in the schema and the build. Each is checked as a
    real PNG of its size: two new broken cases, `icon-wrong-size` and `icon-missing`.
  - The manifest and the page's icon links follow it.
  - A tracker other than the starter that still ships the template's placeholder icons gets a
    build warning (matched by hash).
- **Listener counting is now exact.** jsdom's selector engine (nwsapi) adds its own
  `mouseover` and `mouseout` on each document it starts; `boot()` now records only listeners
  registered from outside `node_modules`.
  - 70-shell: the app registers 9 at boot.
  - 9c: the 9 standing listeners, one each, and nothing else after every gesture.
- **The `.onclick =` guard is narrowed, not weakened.** It fired on `pwa.online = on` (a
  regex false positive). It now flags only real event-handler names, with a self-test that
  `el.onclick =`, `reader.onload =` and `worker.onstatechange =` are caught and a field named
  `online` isn't.
- **`9i-pwa` (37, jsdom with a stand-in worker, caches and connection):**
  - data.js names the worker's cache and file list;
  - no service worker: the status says so;
  - registration; ready / partly ready;
  - Check for updates: latest, a failure, waits offline;
  - an update followed to activated; a waiting worker at boot; a first install not announced;
    quiet checks on return;
  - offline and back online, with no online/offline listeners;
  - the install prompt, accepted and dismissed;
  - icons in the links and the manifest, a configured path, the placeholder warning.
- **`test/layout/70-pwa` (11, a real service worker in Chromium):**
  - installs and claims the page, caching every precached file, fonts and icons included;
  - Offline reports "Ready offline · N of N";
  - with the server down, a reload boots from the cache, the page is marked offline, and the QR
    draws (qrcode.js from the cache);
  - every fetch path ends in a real Response: a missing icon gives 504, a shell page with a
    query falls back to the app, a font comes from the cache;
  - online, a deploy shows on a plain reload (network-first);
  - Check for updates finds a real new worker; "A new version is ready" with Reload; the old
    cache is deleted.
- **Found by testing:** Playwright's `setOffline` doesn't reach the service worker's own fetches.
  The first "offline" run still reached the server. The test server now has `down()`, which
  drops every request, so offline means offline.
- **Mutation checks:**
  - a cache-first path with no final Response (the iOS blank page) → caught;
  - a cache-first shell (the stale-deploy trap) → 2 failures;
  - no skipWaiting → the update never arrives;
  - a first install announced as an update → caught;
  - the connection not read on a tap → caught;
  - readiness never counted → 3 failures.
- **Inventory:** F-35…F-38, F-59, XM-7, D-2 (live install), D-13 and V-17 present.


## Session 4 checkpoint — step 8 done (keyboard, accessibility, first paint), 5 Oct 2026

### Done
- **Keyboard (V-7, XM-3).** `keydown` is listener 10 at boot (11 static with `once()`), as
  planned.
  - On the Reading tab: ← / → step, R reads, X skips.
  - "/" goes to search from any tab.
  - On a tab, the arrow keys, Home and End move between tabs and show them (the ARIA tabs
    pattern).
  - Nothing fires while typing (inputs, text areas, selects) or with Ctrl, ⌘ or Alt held.
  - The Reading card shows "Keys: ← → step · R read · X skip · / search", in the medium's verb,
    on devices with a keyboard (`hover: none` hides it).
- **`9j-a11y` (25, jsdom, everything open on every tab):**
  - every control has an accessible name;
  - every `aria-controls` and `aria-labelledby` resolves; every state is `true` or `false`;
  - no id is used twice (all the ids seen across the tabs);
  - every opener says whether it is open and what it opens;
  - the page has a language, landmarks and the tabs pattern (one tablist, four tabs, panels
    labelled by their tabs, roving tabindex);
  - polite live regions; marks named with their state;
  - the keyboard: steps, R, X, Ctrl/⌘ left alone, "/", typing keeps every key (in search and in
    the sync box), arrows / Home / End / wrap between tabs.
- **First paint (V-8, John's answer 2):** one stylesheet, the scripts deferred, the display font
  preloaded.
  - **Measured before and after.** On localhost, first paint is the same: 92 vs 120 ms normally,
    44 vs 40 ms with data.js 2 s late. The shell already painted before the data arrived.
  - **Measured on a 1.6 Mbps / 150 ms link** (median of 3):
    - no preload: first paint 736 ms, Anton at 1,980 ms (the title swaps late);
    - Anton only: first paint 840 ms, Anton at 667 ms (before the paint, so no swap);
    - Anton and Plex Sans: first paint 1,104 ms.
  - **So only the display font is preloaded**, as the spec says. Preloading the body font cost
    another ~260 ms. CLAUDE.md gains "Preloading isn't free".
- **`test/layout/80-paint` (7, real Chromium):**
  - one stylesheet and deferred scripts;
  - only the display font preloaded, with `crossorigin`;
  - data.js 2 s late: the shell and "Loading the checklist…" paint at once;
  - every font 2 s late: the page still paints at once;
  - every `@font-face` swaps (read from the CSSOM, because paint timing can't see invisible
    text);
  - on a 1.6 Mbps link the display font lands by first paint, and first paint stays under 1.5 s.
- **The test server** gains `delay()` / `undelay()`.
- **Mutation checks:**
  - keys firing while typing → 2 failures (the first version of that test was too weak: it typed
    on a tab where Reading keys don't apply);
  - keys with a modifier → 2;
  - no arrow keys between tabs → 3;
  - a mark with no name → 1;
  - a section head pointing at nothing → 2;
  - no preload → 2;
  - `font-display: block` → caught by the CSSOM check (paint timing alone missed it).
- **CLAUDE.md:** "Preloading isn't free", and the service-worker lesson that Playwright's
  `setOffline` doesn't reach the worker.
- **Inventory:** V-7, XM-3, V-8 (re-expressed) and V-18 present.


---

## Transfer checkpoint — end of session 4 (look and PWA), 5 Oct 2026

### Done (all 9 steps; details in the step checkpoints above)
- **Counts:** the jsdom harness went from 1,105 to **1298 assertions**. The new real-Chromium layout suite
  has **153 checks** in 8 suites, and CI runs both.
- **New suites:**
  - jsdom: `9f-visibility`, `9g-look`, `9h-banners`, `9i-pwa`, `9j-a11y`;
  - Chromium: `test/layout/` 10-sweep, 20-motion, 30-css, 40-look, 50-table, 60-stack, 70-pwa,
    80-paint.
- **The two additions (4 Oct):**
  - data-driven visibility: one capability map, the `minimal` fixture, and a self-test that
    forces each capability on;
  - collapsible Settings: one section component for the panel and Settings, with the same
    animation.
- **One token system and four skins** (Paper, Newsprint, Pull, Night), seven paper swatches, era
  washes with no cap, and text size, density, button size, marks and a dyslexia-friendly font.
  All are token sets that can't move or hide a control. Contrast is measured in every skin ×
  paper, and for 64 eras. The sweep covers every skin at 320, 360 and 390 px.
- **The persistent banner, the mini bar and table view.** The sticky stack is measured at
  runtime.
- **Offline and updates:** a real service worker, readiness, the update flow, the install prompt
  and icons from config.
- **Keyboard, an accessibility audit, and measured first paint.**
- **Every S4 line in `FEATURE-INVENTORY.md`** is present, re-expressed or dropped with a reason.
  V-15 is decided: lazy rendering replaces `content-visibility` (CLAUDE.md trap resolved; closed by
  John 4 Oct).
  - 4 lines remain, all S5: V-21, V-22, V-23 and V-28.
  - Six session-2 story-band lines (F-47, T-28…T-32) still read "re-express (V-14)". Their
    wording should be checked in session 6.
- **About 45 mutations were put back and caught.** Where one wasn't, the test was strengthened
  and re-run; the step checkpoints record each.
- **Listener budget:** 10 at boot (click, input, change, keydown, three touch, pagehide,
  visibilitychange, beforeinstallprompt), 11 static with `once()`, of 12.

### Found by measuring, not reasoning (each fixed and now guarded)
- **Reduced motion never worked (since session 2).** `* { transition: none }` has no specificity;
  the fix is the `--motion` token.
- **Night's control outlines** were 2.95:1 on the warm and mint papers.
- **Two 17 px link buttons**, now a 24 px minimum for every control.
- **The mini bar widened the page by 16 px.**
- **Preloading both fonts cost 368 ms of first paint** on a slow link; only the display font is
  preloaded.
- **Playwright's `setOffline` doesn't reach a service worker**, so offline tests take the server
  down.
- **jsdom's selector engine registers listeners of its own**; the harness now counts only the
  app's.
- **CI runs 34 and 35 failed on a race in the QR test** (it accepted the "Making the QR code…"
  placeholder). It now waits for the final state.
- **A flaky crash in `20-motion` (1 run in 12) was a real bug.**
  - When the service worker's readiness check resolved, all of Settings was re-rendered. That cut
    short any section opening at that moment, and would have wiped a half-typed sync code.
  - Now only the Offline section is redrawn. A 9i-pwa test types half a code, lets readiness land
    and checks the code survives (putting the full redraw back fails it). 0 crashes in 15 runs
    since.
  - A closed test page with a promise still pending no longer crashes the harness.
- **The final screenshots showed "✎review" and "look up↗" run together** (since step 5). A flex
  item's edge space is trimmed; the fix is a `gap` on badges, and 50-table now measures the
  spacing.
- **Process slip:** commit `a575f13` was pushed while that crash was unexplained, because my
  close-out script committed even after its count check failed. The script now stops unless both
  runs are clean.

### My calls this session — all twelve accepted 4 Oct (John)
1. **The visibility rule applied beyond your list.** Each control needs:
   - depth, type and strand chips: two or more in use;
   - Include cameos: cameo data;
   - Mandatory only: both mandatory and optional rows;
   - Notes only and tap to reveal: notes;
   - Gap notes: a gap note;
   - the era filter, picker, Mark range, Newest era first and era colours: two eras;
   - the look-up link: `searchUrl`;
   - the skin control: two or more configured skins.
2. **"+N untimed" follows the data, not the format count.** A comics-only tracker never shows it;
   a games-only tracker with missing lengths still does.
3. **Only the stack is sticky** (tabs, banner, mini bar). Band and era banners are tall goal
   banners, so they scroll.
4. **Mark styles are box, dot, and tick and cross.** v2's "web" was one franchise's motif.
5. **Skin details:**
   - Newsprint: Georgia display and a dark tab bar;
   - Pull: Anton capitals for era names too, and mono metadata;
   - Night: from v2's signature palette.
6. **Table view hides notes, blurbs and intros**, as v2 did.
7. **The `theme-color` meta follows the skin's paper**, falling back to the franchise colour.
8. **The install offer** is a toast once per visit when the browser offers it, and a button in
   Settings → Offline.
9. **Updates are looked for quietly** whenever the page is shown again.
10. **Only the display font is preloaded** (measured above).
11. **V-15:** lazy rendering replaces `content-visibility`.
12. **The iPhone hint in Settings → Offline** shows to everyone.

### Decided 4 Oct (John) — do not reopen
- **Bulk marking stays as shipped.** It marks what the user can see: the plan filters plus any
  active search or browse filter. Session 3's call 2 is accepted with exactly this behaviour.
- **The extended visibility rule is accepted.** It now lives in CLAUDE.md → UI rules, beside the
  original list.
- **Content-visibility is closed.** Lazy rendering, where an era's rows render only when it is
  first opened, replaces it (V-15). CLAUDE.md's trap now says so.
- **All twelve of my session 4 calls above are accepted.**
- **A new permanent rule, "Stop cleanly",** is in CLAUDE.md → Working method:
  - every step ends committed, pushed and green;
  - never start a step that can't be finished;
  - if a session runs long, stop at the end of a completed step;
  - write in PROGRESS.md exactly where the next step begins (the first file, the first test, any
    half-made decisions);
  - then push and tell John.

  It makes permanent session 3's session-length rule, and it covers this session's slip, a commit
  pushed while a crash was unexplained.

### Open items for session 5
- **A real-device check on iPhone (John):**
  - swipe and long-press;
  - Add to Home Screen, open it once online, then try it offline;
  - the home-screen icon;
  - the status-bar colour per skin.
- **The Absolute pilot** goes into a fresh repo John creates first. Stop and ask before any edit
  outside this repo.
  - Its build will warn about placeholder icons until it has its own `franchise.icons`.
  - It should choose its skins (`franchise.skins` / `skin`).
- ~~Merge this branch before session 5.~~ Merged 5 Oct (ASIMKARD/Pull-List-template#3). The
  phone fix below is on the same branch, restarted from `main`.

### Session 5 starts with: workbook and pilot (spec §7.5)
1. `build_workbook.py` (V-23): the workbook generated from `dataset.json`, reading by header
   name.
2. The `verify.py` gate from Research-Repo's toolkit (V-22), read-only from a local copy.
3. Docs (V-28): README (start a tracker in steps), BUILD-NOTES, MIGRATING, and the
   `comic-tracker-build` Skill in `.claude/skills/`.
4. The Absolute pilot (V-21) in a fresh repo John creates. Stop and tell John before the first
   edit to it.

---

## Fix after session 4 — the buttons fit on the phone (John's screenshots), 5 Oct 2026

John's iPhone (393 px wide) showed two kinds of button that didn't fit. Both reproduced in real
Chromium at 390 and 393 px before anything changed.

### What was wrong
- **Settings rows split their controls.** A row was the label, then its buttons, in one wrapping
  line. The first button stayed beside the label and the rest dropped under it, starting from the
  left edge. Seen in Display → Rows and Progress, Touch → Gestures, and Bulk actions → Sections,
  Mark era and Mark range ("through" was left at the start of a line).
- **The last depth chip was cut off.** The depth row never wraps (T-95). It was 320 px of chips in
  a 301 px space, so "Everything · 5" was clipped inside a row that scrolled sideways.

### Why the layout suite missed it
The sweep checked that the *page* never got wider than the screen. A chip clipped inside its own
scrolling row doesn't widen the page, and a button under its label doesn't either. The
reachability check scrolls each control into view first, so it found the hidden chip reachable.

### Done
| Change | Where |
|---|---|
| Each Settings row is now a label and **one block of controls**. The block sits beside the label when all of it fits on that line. Otherwise the whole block takes the next line and wraps inside itself, from one left edge. "through" stays with the range's end | `app.js` `srow`, `styles.css` `.sctl`, `.sgrp` |
| The **depth chips shrink together**. When the row is narrow, each count drops under its name, so the row stays one line (T-95) and nothing is cut off. The " · " between the name and the count is still read out, but no longer drawn | `app.js` `tierChip`, `styles.css` `.depthrow` |
| On the **smallest phones** (≤ 360 px), filter-section bodies drop the 44 px indent to 12 px, and the depth chips use 6 px side padding and a 4 px gap. With large text at 320 px, that leaves 10 px spare | `styles.css` |
| **The sweep now checks fit** in every set, at every width, on every tab:<br>• no control reaches past the edge of any box that clips it (the era jump bar and the pins scroll by design);<br>• every Settings row keeps its controls together;<br>• the depth chips sit on one line, with none hidden.<br>It also gains a set with large text and large buttons | `test/layout/10-sweep` |
| jsdom: every Settings row is a label and one block of controls | `98-tabs-settings` |

All 5 mutations were caught: the old `srow`, the block flattened with `display: contents`, depth
chips that never shrink, a depth row that wraps, and a clipped block. Large text at 320 px failed
first (10 px over), and the narrow-phone padding fixed it.

**Harness:** 1299 assertions (+1), 0 failed, 29 suites. **Layout:** 231 checks (+78), 0 failed,
8 suites.

### For John to check on the phone
Settings → Display, Touch and Bulk actions, and Checklist → Filters → Reading → Depth. On a
393 px phone the depth chips stay on one line, as before. If iOS text runs a little wider, the
counts drop under the names instead of being cut off.

---

## Session 5 plan (agreed 6 Oct 2026): versions, signature skins, Pull, gate, workbook, docs, Absolute pilot

This planning session changed docs only (this file, `CLAUDE.md`, `FEATURE-INVENTORY.md`). **The
build starts in a fresh session** (John, 6 Oct).

### Decided 6 Oct (John) — do not reopen
1. **Readable version numbers come first** (decided 4 Oct).
   - The header shows "v13", not the hash. Settings → About shows the version, with the hash
     in small print for debugging.
   - The number counts up by itself. The build reads the previous `data.js`: if the content
     hash changed, the version is the previous number + 1; otherwise it stays the same.
     `--check` stays deterministic. Nobody bumps anything by hand.
   - The hash keeps its real job: the service-worker cache name still changes whenever the
     content does.
   - Migrated trackers continue their old numbering through `franchise.versionStart`, the old
     tracker's last build + 1. The template demo starts at v1.
2. **Absolute-v3 starts at v8.** The local read-only copy of ASIMKARD/Absolute is at commit
   7304f82 (17 Aug, "…(build v7)"): `index.html` shows "build v7" and `sw.js` caches as
   `absolute-v7`. The live site can't be reached from the container, so the number comes from
   the repo. John confirmed v8.
3. **Dates come from the DC Database.** John adds `dc.fandom.com` to the environment's allowed
   domains before the build session. If it still can't be reached there:
   - rows that existed at the 17 Sep audit keep v7's cover months, with source
     "DC Database via Absolute v7, audited 17 Sep";
   - only the rows added since are sourced, by web search.
4. **Research-Repo is add-only:** one new folder per session, nothing removed or changed.
   `CLAUDE.md` → Read-only rule has the details.
5. **`verify.py` runs in CI as a pinned copy.** It is copied unchanged into `tools/`, with its
   Research-Repo commit and sha256 recorded. CI runs it on every push, and a session check
   flags any drift from Research-Repo.
6. **A signature skin slot.** Each tracker can define one skin of its own in its config:
   - a name, colour and size tokens, fonts, and an optional stylesheet scoped to that skin
     (textures, banner styling, shapes);
   - it uses the same token system and passes the same contrast, every-control-reachable,
     overflow and stack tests as the shared skins;
   - a skin changes how things look, never where they are;
   - the template ships a demo signature skin in a fixture to prove the slot works.
7. **The skin choice is "last used", remembered per tracker.** On a first visit, the app uses
   the skin picked on the old tracker (from its legacy settings) if there is one, otherwise
   the tracker's signature skin. For Absolute's old `layout` value:
   - `abs` → the signature skin;
   - `pull` → Pull;
   - `tabs` → the signature skin. It was v2's default, saved even when nobody chose it, so it
     doesn't count as a pick.
8. **Pull must match X-Men exactly:** era boxes, fonts, sizes, weights, spacing and colours.
   - Serve the local read-only X-men copy in Chromium at 393 px.
   - Measure the computed styles of the header, tabs, era boxes, arc heads and rows, and build
     Pull to match.
   - Add side-by-side measured comparison tests.
   - Anything that can't match without moving a control: list the differences and ask John.
     Never break the one-layout rule.
9. **Absolute keeps its signature look.** Its signature skin recreates the live `abs` skin from
   the read-only Absolute copy.
10. **Absolute's scope stays locked** (kickoff pack). Titles launched since the spec (Cassandra
    Cain; the Sept 2026 Teen Titans, Legion and Doom Patrol wave) are flagged, not added.

### Before the build session (John)
- **Network:** add `dc.fandom.com` under Allowed domains (the environment menu → Edit →
  Network access → Custom; keep the default package-manager list). Steps:
  https://code.claude.com/docs/en/cloud-environments#network-access
- **Absolute-v3:** this session couldn't attach it. GitHub said "you don't have access to
  asimkard/absolute-v3". Install the Claude GitHub App on it from
  https://claude.ai/connect-github, then select Absolute-v3 and Research-Repo when you start
  the build session.
- **This branch** (`claude/keen-wozniak-w7lt6p`, docs only): merge it, or start the build
  session from it.
- **GitHub Pages on Absolute-v3:** only needed for 7f.

### What this session found (for the build session)
- **Absolute's saved progress is template v2's format,** which v3's importer already reads:
  - `absolute:v1:progress` holds `{p: {key: state}, b: [keys]}`;
  - `absolute:v1:reviews` is keyed by issue key;
  - `absolute:v1:settings` holds `layout` (`abs` / `tabs` / `pull`);
  - the QR prefix is `ABSO1:`, packing 2 bits per row in key order, with `d` = count-first-last.
  - v3 uses `absolute:v3:*`, so the old keys are never touched.
- **Absolute v7's data:** 123 issues, 23 month-named arcs and 2 eras.
  - Each row has a 9-digit key (cover month plus a sequence number) and no individual dates
    or credits.
  - The FCBD 2025 special is placed by the "+2" convention and flagged "Derived".
- **The verify gate's data model differs from v3's.** `verify.py` expects
  `rows: [{series, vol, num, title, cover, onsale, arc, flags, date_source}]`. The adapter
  builds those fields from v3's `issueId`, `title` and `date`.
  - `check_built` reads v2's `data.js`, so v3 needs its own equivalent for the order the app
    actually shows.
- **Research-Repo** holds only `toolkit/`. The 17 Sep cache wasn't restored, so pages are
  fetched fresh and cached in the session folder.

### Steps — each ends committed, pushed and green (harness, layout suite, CI), with a checkpoint here
1. **Readable versions** (template).
   - `tools/build.py`:
     - version = max(`versionStart`, previous + 1 if the hash changed, else previous);
     - with no previous version, it is `versionStart` (default 1);
     - the version is stamped into `data.js` after the hash, so it never feeds the hash.
   - The schema gets `franchise.versionStart` (an integer ≥ 1).
   - `app.js`:
     - the header shows "v13";
     - About shows "Version 13", with "build <hash>" in small print;
     - the Offline row and the "latest version" toast use "v13".
   - **Tests:**
     - an unchanged rebuild keeps the number;
     - a content change adds exactly 1;
     - the first build uses `versionStart`, and raising `versionStart` lifts the number;
     - `--check` is deterministic;
     - the cache name changes with the content but not with the version;
     - the header shows "v13" (a fixture built with `versionStart` 13);
     - About shows the hash;
     - mutations for each.
   - BUILD-NOTES: after merging two branches, rebuild on `main`. The number continues from
     `main`'s `data.js`.
2. **The signature skin slot** (template).
   - The schema gets `franchise.signature`: `{name, tokens, fonts?, stylesheet?}`.
   - **The build validates it:**
     - tokens must be known inputs;
     - fonts must exist, and are precached;
     - every stylesheet selector is scoped to `:root[data-skin="signature"]`;
     - only look properties are allowed: colours derived from tokens, background images,
       borders, radii, shadows and font settings. Position, display, inset, order, flex, grid,
       float, visibility, z-index, transform, width, height and margin are refused.
   - **Proposed delivery:** a generated `skin.css` linked after `styles.css`. `80-paint`
     measures it; if it costs first paint, the CSS goes inline instead.
   - A demo signature skin in the `basic` fixture. The contrast matrix, reachability, the
     sweep, the stack and motion all include it. Guard self-tests: an unscoped selector, a
     `position` and a literal colour each fail the build.
   - **Skin choice:**
     - last used, from the per-tracker settings store;
     - first visit: the legacy map (`storage.legacy.skins`: a field plus a value → skin map,
       data-driven), else the signature skin, else `franchise.skin`.
   - The skin control appears with two or more skins (the visibility rule).
3. **Pull matches X-Men** (template).
   - Clone X-men read-only and capture computed styles at 393 px into
     `test/layout/ref/x-men.json`, recording X-Men's commit. Elements: header, tabs, era
     boxes, arc heads and rows. Properties: fonts, sizes, weights, line heights, spacing,
     colours, borders and radii.
   - Build Pull through tokens, adding new tokens where needed.
   - `test/layout/45-pull` compares Pull with the reference side by side: colours, fonts and
     weights must be exact; sizes within ±0.5 px. A session-only re-capture checks the
     reference against a fresh X-Men copy.
   - Differences that would move a control are listed and asked about, never built.
4. **The `verify.py` gate.**
   - A pinned `tools/verify.py` (byte-identical) and `tools/verify.lock` (commit and sha256).
   - `tools/verify_gate.py` adapts the stitched v3 dataset, and checks the order the app shows
     (series ascend; concurrent series interleave).
   - CI runs it.
   - **Tests:**
     - the adapter on every fixture;
     - broken fixtures fail: an interpolated date, backwards numbering, a duplicate title and a
       blocked series;
     - a drift check against Research-Repo when a local copy is present.
5. **`build_workbook.py`.**
   - A stdlib-only `.xlsx` writer with deterministic bytes.
   - Sheets: Reading Order, Arcs, Eras, Creators and Events. Headers are named, frozen and
     filterable.
   - The harness reads the workbook back by header name, including with the columns shuffled,
     and matches it against the dataset.
   - Committed, so John can download it.
6. **Docs and the Skill.**
   - `README.md`: start a tracker in steps.
   - `BUILD-NOTES.md`: the conventions, including versions, skins and the signature slot.
   - `MIGRATING.md`:
     - a fresh repo;
     - the legacy prefix, format, `qrPrefix` and skin map;
     - `retiredIds` and `versionStart`;
     - the cut-over swap and checking a deploy by hash.
   - `.claude/skills/comic-tracker-build/SKILL.md`.
   - A harness check that every command and path the docs name exists.
7. **The Absolute pilot in Absolute-v3** (expected in session 6). Start it only when steps 1–6
   are done and there is room to finish 7a–7c.
   - **7a. Repo.**
     - The template copied in with fresh history, plus Absolute's own icons and name.
     - Key `absolute`, `versionStart` 8, and `storage.legacy`: prefix `absolute:v1:`, format
       `v2`, `qrPrefix` `ABSO1:` and the skin map.
     - `dataset.json` converted from `dataset.py` by a script. `id`s are the old 9-digit keys,
       and `issueId`s follow the rule.
     - The harness, the layout suite and CI are green on Absolute's data (V-21).
   - **7b. Research,** cached in Research-Repo's session folder:
     - every row's cover and on-sale dates, each with its source;
     - writer and artist per arc, by checkpoints;
     - the Absolute Wonder Woman 2026 Annual between #15 and #16;
     - Superman's and Flash's collected ranges, sourced rather than inferred;
     - the title of Absolute Batman Vol. 3;
     - existing titles brought up to date (e.g. Absolute Catwoman #3, 26 Aug 2026);
     - new titles flagged, not added.
   - **7c. Gate.**
     - `verify.py` and the build pass.
     - `id`s stay stable: removed rows go to `retiredIds`, so old QR codes still line up.
   - **7d. The signature skin.** Recreated from the old `[data-skin="abs"]` CSS and fonts, and
     measured side by side against the old copy at 393 px.
   - **7e. A migration proof in real Chromium.**
     - Mark rows, bookmarks, a review and a skin in the old copy.
     - Open Absolute-v3 on the same origin: everything carries over.
     - An old `ABSO1:` code imports.
     - The old keys are untouched.
   - **7f. Deploy.**
     - Pages on Absolute-v3, verified by hash.
     - John checks it on the phone.
     - The cut-over swap happens only when John approves.

### Half-made decisions (my proposals, settled during the build)
- How the signature CSS is delivered: a generated `skin.css` or inline. Decided by
  measurement in `80-paint`.
- Which new tokens Pull needs. The X-Men measurements decide.
- The workbook is committed. It is generated, and `--check` covers it.

### Session-length rule
Stop cleanly (`CLAUDE.md`). Expected: steps 1–6 in session 5, the pilot in session 6. The build
session starts with step 1, in `tools/build.py` and a new version test.


---

## Session 5 checkpoint — step 1 done (readable versions), 6 Oct 2026

Pre-flight (asked by John before step 1):
- **dc.fandom.com:** the MediaWiki API answers (`api.php` returned 200 with the wikitext of
  *Absolute Batman Vol 1 1*). Ordinary wiki pages return 403 with Cloudflare's "Just a
  moment…" challenge, so research must use the API, not page scraping.
- **Absolute-v3:** not attached. `list_repos` shows only ASIMKARD/Absolute, and the attempt to
  attach ASIMKARD/Absolute-v3 was refused by this session's permission check.
- This branch was fast-forwarded to the plan commit `fe0aad0` from `claude/keen-wozniak-w7lt6p`.

### Done
| Change | Where |
|---|---|
| The build stamps a readable **version** after the hash: the previous `data.js`'s number, + 1 only when the content hash changed; never below `franchise.versionStart`; `versionStart` (default 1) when there is no previous number. It never feeds the hash, so the cache name follows the content only | `tools/build.py` `next_version`, `render_outputs` |
| `franchise.versionStart` (integer ≥ 1) in the schema and validated by the build; a broken fixture | `schema/dataset.schema.json`, `test/fixtures/broken/version-start-invalid` |
| The header shows "v1"; About shows "Version 1" with "build <hash>" in small print; the Offline "Version" row and the "latest version" toast say "v1" | `app.js`, `styles.css` `.buildhash` |
| New suite: first build, unchanged rebuild, +1 on a content change, versionStart lifts but never lowers, the hash and `sw.js` ignore the number, a pre-version `data.js`, bad values, `--check` deterministic and read-only, and the app's header, About and Offline row | `test/suites/21-version` |

All 11 mutations were caught: always +1, never +1, `versionStart` ignored, no max with
`versionStart`, the version feeding the hash, no validation, the header, About, the Offline row
and the toast showing the hash, and the version not stamped. (The About one first crashed the
suite instead of failing; the test now fails cleanly.)

**For BUILD-NOTES (step 6):** after merging two branches, rebuild on `main`; the number continues
from `main`'s `data.js`.

**Harness:** 1334 assertions (+35), 0 failed, 30 suites. **Layout:** 231 checks, 0 failed, 8 suites.

---

## Session 5 checkpoint — step 2 done (the signature skin slot), 6 Oct 2026

### Done
| Change | Where |
|---|---|
| **`franchise.signature`** `{name, tokens, fonts?, stylesheet?}` in the schema and the build. The build checks it and emits its CSS: `@font-face` rules (swap), one token block scoped to `:root[data-skin="signature"]` (tokens sorted, so input order never matters), then the stylesheet's rules, normalised | `tools/build.py` `signature_skin`, `signature_rules`, `look_value_problem`; `schema/dataset.schema.json` |
| **What the build refuses.** Tokens must be inputs from `styles.css` `:root`. Every token a Look setting's block sets is read from `styles.css` and refused, as are the page's own (`--fs`, `--stack-h`, `--motion`, `--skin-ok`, `--qr-paper`). Fonts must be a `.woff2` in `fonts/` (precached). Every selector must start with the scope. Only look properties are allowed: colours from tokens, background images (gradients from tokens, or a precached file), borders, radii, shadows and font settings. Position, display, inset, order, flex, grid, float, visibility, z-index, transform, width, height, margin, opacity, content and overflow are refused by name. At-rules, `!important`, literal or named colours, `rgb()`, a literal alpha and transitions also fail | `tools/build.py` |
| **Delivery:** the CSS comes inside `data.js` and the app adds it once, as `<style id="skin-signature">`, before the first render. The skin beacon only reads the page's own stylesheet | `app.js` `applySignature`, `pageSheets` |
| **Skin choice.** The signature skin is offered first, under its own name. A first visit takes the old tracker's pick through `storage.legacy.skins` `{field, map}` (read only); an unmapped or unreadable value falls back to the signature skin, else `franchise.skin`. After that, the last skin used. The map is validated against the skins offered. The skin control counts the signature skin (visibility rule) | `app.js` `firstSkin`, `buildHas`; `tools/build.py` |
| **Demo "Signal"** in the `basic` fixture: tokens, one font face (`Fixture Signal`), a look-only stylesheet, and a legacy map (`sig` / `tabs` → signature, `pull` → Pull) | `test/fixtures/basic/` |
| Broken fixtures (the plan's guard self-tests): an unscoped selector, a `position`, a literal colour | `test/fixtures/broken/signature-*` |
| New suite: the demo's CSS, precached font, read-by-name tokens, a rich look-only stylesheet passing, 34 refusals, the app adding the CSS once, the legacy pick (mapped, unmapped, unreadable, last used wins, the old key never written), no signature, signature + one shared skin | `test/suites/22-signature` |
| **Measured in real Chromium with the shared skins:** the contrast matrix (× 7 papers) and the 64-era washes (the stress set carries the same signature), reachability at 390/320/largest, overflow, the sweep (basic now opens in it; Paper is swept explicitly), the stack, motion, and fonts. Each page checks it really is in the seeded skin | `test/layout/40-look`, `10-sweep`, `60-stack`, `20-motion`, `30-css`, `80-paint` |

### Found by measuring
- **The demo's teal accent at 28 % lightness failed AA.** Creator names reached only 4.34–4.49:1 and
  era-banner text failed too. At the same lightness, teal is brighter than blue. The demo is now at
  24 %; worst text overall is 5.12:1.
- **A signature token could override a Look setting.** The signature CSS loads after `styles.css`,
  so a token such as `--era-h0` would have beaten "one era colour". The build now reads every token
  a Look-setting block sets from `styles.css` and refuses it.

### My call (open to veto): how the signature CSS is delivered
The plan left this to measurement in `80-paint`. On the 1.6 Mbps link, injected from `data.js` gave
a median first paint of 864 ms, and a linked `skin.css` gave 868 ms (7 runs each). That's a tie, so I
chose the delivery with no extra file or request. Its CSS can't get out of step with `data.js`, and a
tracker without a signature pays nothing. The skin only applies once `app.js` sets `data-skin`
anyway, so a stylesheet link couldn't apply it any sooner. `80-paint` now asserts one stylesheet
request and the injected CSS.

Mutations: all 17 code mutations were caught. The 2 layout mutations were caught too: a 34 px
signature tab font (10-sweep: the tabs no longer fit at 320 px) and a pale ink (40-look: 2.32:1).

**Harness:** 1408 assertions (+74), 0 failed, 31 suites. **Layout:** 258 checks (+27), 0 failed, 8 suites.

---

## Session 5 checkpoint — step 3 done (Pull matches X-Men, as far as one layout allows), 6 Oct 2026

### Done
| Change | Where |
|---|---|
| X-Men cloned read-only (`/home/user/X-men`, commit `663fe46`) and served to Chromium at 393 × 852. Its computed styles for the header, tabs, era boxes, the era intro, arc heads, rows and the search box are captured into a reference, with the commit | `test/layout/ref/capture-x-men.js`, `ref/x-men.json` |
| **One map** says which X-Men element each template element is measured against, and which properties: families, sizes, weights, tracking, case, style, colours, effective backgrounds (what is really behind an element), borders, radii and three boxes. The capture and the test share it | `test/layout/ref/pull-map.js` |
| **New tokens, bases equal to today's values** (so the other skins are unchanged, and their measurements say so). Colour: per-role hue and saturation for card, line, bar, soft ink, bar text, the search field, an era-body inset (off by default) and a mark outline. Type: title size, tracking and line height, meta size, era name and era meta sizes, intro size and style, arc size and weight, row size and weight, search size | `styles.css` `:root` and the rules that read them |
| **Pull's inputs**, computed from the reference so every colour derives exactly. Card, inset and line are written relative to the paper, so the seven paper swatches still tint them | `styles.css` `:root[data-skin="pull"]` |
| `45-pull`: 71 properties exact (sizes within 0.5 px). The list of differences is kept true both ways: an unlisted difference fails, and so does a listed one that has gone. Each difference says why. A fresh capture re-checks the reference whenever a local X-Men copy is present; CI records that it has none | `test/layout/45-pull` |

### Found by measuring
- Removing Pull's narrower `--tab-fit` made four uppercase tabs scroll 5 px at 320 px with large text
  (40-look). It is back at 3.7vw, which is still 12.5 px at 393 px.
- The franchise guard caught "X-Men" in a `styles.css` comment; it now says "the reference tracker".
- The read mark's outline was first filed as an accessibility conflict. It isn't: X-Men's ink outline
  passes 3:1. The template simply drew every control outline in one colour. The mark now has its own
  outline token, and Pull matches it.

All 9 mutations were caught: title size, paper lightness, the era-body inset, the mark outline,
the search field, row weight, a difference dropped from the list, a difference listed that isn't
one, and a drifted reference.

### Questions for John (the 9 recorded differences)
Two are kept on purpose, by the measured contrast rules:
- **The selected-tab underline.** X-Men's navy is 1.52:1 on its bar. Pull uses the same hue at 44 %
  lightness, which is 3:1.
- **The search outline.** X-Men's is 1.53:1. Pull keeps the 3:1 control outline.

Seven need your say-so, because a skin may not change them:
1. **Era boxes.** X-Men's are solid, hand-picked colours per era, with white text, a folder-tab
   shape and a darker stats strip. The template's are pale washes generated from the era's index
   (the pale rule is T-39), in a card. Matching them needs a colour per era in the data, plus an
   exception to T-39 for Pull; the shape is layout. Options: (a) keep the pale washes in Pull;
   (b) add an optional `colour` per era and let Pull draw solid era heads with white text (the
   shape stays the template's); (c) both (b) and the folder-tab shape.
2. **The tab bar runs edge to edge in X-Men** (393 px wide, from 0). The template's sits inside the
   16 px page margin (361 px wide, from 16). Options: (a) keep it inset in every skin; (b) edge to
   edge in every skin (one layout); (c) a layout exception for Pull.
3. **Mark size and shape.** X-Men's mark is 22 px with a 5 px radius. The template's size belongs to
   the Button size setting (34 px standard, 26 px compact) and its shape to the Marks setting.
   Options: (a) leave both to the settings; (b) give "compact" X-Men's 22 px (that's under the 24 px
   target, so it would need an exception).

**Harness:** 1408 assertions, 0 failed, 31 suites. **Layout:** 267 checks (+9), 0 failed, 9 suites.

---

## Session 5 checkpoint — step 4 done (the verify.py gate), 6 Oct 2026

### Done
| Change | Where |
|---|---|
| **The pin.** Research-Repo's `toolkit/verify.py`, copied unchanged. The lock records its commit (`18141dd`, the last change to `verify.py`) and its sha256. The gate refuses to run on any other bytes | `tools/verify.py`, `tools/verify.lock` |
| **The gate.** It runs, in order: the pin; the build's own validation; `verify.check()` on the stitched dataset; then `check_shown()`, v3's equivalent of `check_built` (which reads v2's `data.js`). `check_shown` walks the order the app shows: numbers within a series rise (ALT, special numbering and inert rows skipped), and series that ran at the same time interleave. Exit 1 = do not ship | `tools/verify_gate.py` |
| **The adapter** builds `verify.py`'s rows by name: series, vol, num, title, cover, onsale, arc, flags, date_source, mandatory, core and seq. Inert marker rows carry `verify.py`'s own GAP marker and no date. `verify.check()` runs even when the build fails, so its own verdict always shows. `verify.py` keeps findings in module lists, so the gate clears them before each dataset | `tools/verify_gate.py` `adapt` |
| `build()` takes `keep={}` and fills it with the stitched rows, arcs and eras as soon as they are stitched | `tools/build.py` |
| **CI** runs the gate on the template and every fixture | `.github/workflows/harness.yml` |
| **Fixtures the gate stops,** each with its expected line: an interpolated date, backwards numbering (by publication date, fine in the order shown), a duplicate title, and a blocked series (two series that ran together, placed in two eras) | `test/fixtures/gate/` |
| New suite: the lock and the pin; a drift check against the local Research-Repo copy (same bytes, and its last change to `verify.py` is the pinned commit); an edited copy fails; all five datasets pass; the adapter (61 rows, fields by name, cover and on-sale dates for every row, inert rows, arcs and eras, field order never matters); the four stops; and one dataset's findings never carry into the next | `test/suites/23-verify-gate` |

### Found
- `verify.check()` sorts rows by date before its "blocked" test, so it can only catch blocking in odd
  cases. The blocked-series fixture passes it, and only the order shown (`check_shown`) catches it,
  as the original `check_built` did for v2. A test records this.
- The first adapter test compared one row with no on-sale date, so reading `onsale` as `cover` went
  unnoticed. It now compares every row of a copy where 16 rows have an on-sale date.

All 7 mutations are caught (one only after that fix): inert rows without GAP, the module lists not
cleared, `check_shown` never flagging, the wrong date field, the pin unchecked, `verify.check()`
skipped when the build fails, and the series read from the title.

**Harness:** 1430 assertions (+22), 0 failed, 32 suites. **Layout:** 267 checks, 0 failed, 9 suites.

---

## Session 5 checkpoint — step 5 done (the workbook, optional per tracker), 6 Oct 2026

### Done
| Change | Where |
|---|---|
| **`build_workbook.py`**: a stdlib-only `.xlsx` writer. Five sheets: Reading Order (26 named columns, in the order the app shows), Arcs, Eras, Creators and Events. Each has one named header row, bold, frozen and filterable (an `autoFilter` plus Excel's `_FilterDatabase` name). Bytes are deterministic: every part stored, not deflated (so no zlib version can change them), fixed timestamps, fixed order, inline strings. `--shuffle-columns SEED` writes the same data in another column order, to test readers | `tools/build_workbook.py` |
| **Every build writes `workbook.xlsx`** next to `data.js`, and `--check` covers it. The template's is committed (`workbook.xlsx`, 24 KB), so John can download it | `tools/build.py` |
| **John's addition: the workbook is optional per tracker.** `"deliverables": {"workbook": false}` (Absolute and Dark Nights are web-app-only). The build writes none and says so. `--check` fails if one is left over (e.g. the template's, copied in with the shell), and the next build removes it. `deliverables` is validated (on/off switches only) and in the schema | `tools/build.py`, `schema/dataset.schema.json` |
| A small harness reader: unzip with node's zlib, then read each sheet **by header name** | `test/lib/xlsx.js` |
| New suite: written on by default; byte-identical rebuilds; stored parts and a fixed timestamp; well-formed XML; header shape; every Reading Order field read by name and matched against the dataset (61 rows); Arcs, Eras, Creators and Events; the shuffled-column copy reads back the same; `& < > "` and on-sale dates survive; `--check` catches a hand edit. **A tracker with workbooks turned off builds without one**, passes `--check` without one, fails `--check` with a leftover, and the next build removes it. Bad `deliverables` values fail. A session-only openpyxl check opens it | `test/suites/24-workbook` |

Checked once by hand: LibreOffice (headless) opens the basic fixture's workbook and exports all five
sheets, with 61 Reading Order rows.

All 13 mutations are caught: deflated parts, no bold, no freeze, a filter one row short, a reader that
assumes a column order, the switch ignored, `--check` ignoring the workbook, a leftover not removed,
on-sale written as cover, unescaped text, credits from the wrong list, and `deliverables` not
validated. My first "positional reader" mutation was a no-op (the column letters come out in order
either way); the real one is caught.

**Harness:** 1459 assertions (+29), 0 failed, 33 suites. **Layout:** 267 checks, 0 failed, 9 suites.

---

## Session 5 checkpoint — step 6 done (docs and the Skill), 6 Oct 2026

### Done
| Change | Where |
|---|---|
| **README**: what the template is, and how to start a tracker in 8 steps (fresh repo, `npm ci`, `dataset.json`, icons, build, the gate, both suites with counts, deploy and verify by hash), plus a map of what's where | `README.md` |
| **BUILD-NOTES**: the master and what's generated; identity, order and dates; versions (including: after merging two branches, rebuild on `main`); skins, the Look's own tokens, skin choice, the signature slot (what it may hold, how it's delivered and measured), Pull and how to re-capture X-Men; the workbook and turning it off; the gate and how to re-pin `verify.py`; testing | `BUILD-NOTES.md` |
| **MIGRATING**: a fresh repo, always; copy the template; `storage.legacy` (prefix, format, `qrPrefix`, the skin map; old keys read-only); ids, `retiredIds`, `versionStart`; `deliverables` and the signature skin; dates and the gate; the proof in real Chromium; deploy, verify by hash, the cut-over swap only with John's approval | `MIGRATING.md` |
| **The Skill**, with the frontmatter a session loads it by: before anything, the loop, where to look, the rules that cost time before, done means… | `.claude/skills/comic-tracker-build/SKILL.md` |
| `CLAUDE.md`'s repo map lists the new tools, docs and fixtures; the build-tag trap now says "check the version" | `CLAUDE.md` |
| New suite: every path, command and flag, npm script and dataset key the four docs name must exist (paths 107, commands 25, keys 10), with a self-test that catches each kind of mistake | `test/suites/25-docs` |

### Found by the docs check
- On its first run, the check found 7 places where my own docs named things that don't exist:
  - the template root has no `data/eras/` folder (only the basic fixture does);
  - `events/` holds no `.json` files yet;
  - bare names like `verify.py`, `broken/` and `.woff2` don't resolve from the repo root.

  All are reworded.
- **Writing the docs found a real gap.** The signature skin may use background images from `images/`,
  but the build only precached `fonts/` and `icons/`, so such an image would have been missing
  offline. `images/` is now precached, and `22-signature` proves it with a real file.

All 5 docs mutations were caught: a renamed file, a flag the tool lacks, a renamed npm script, a
dataset key the schema lacks, and the Skill losing its name.

**Harness:** 1472 assertions (+13), 0 failed, 34 suites. **Layout:** 267 checks, 0 failed, 9 suites.

---

## Transfer checkpoint — end of session 5 (versions, skins, Pull, gate, workbook, docs), 6 Oct 2026

### Done (steps 1–6 of the agreed plan; details in the step checkpoints above)
- **Counts:** the harness went from 1,299 to **1,472 assertions** (34 suites). The layout suite went
  from 231 to **267 checks** (9 suites). CI was green for steps 1–5 (runs 47–51); step 6's run
  follows the push of this checkpoint. Run 51 also showed that the committed workbook's bytes are
  the same under CI's Python 3.12.
- **New suites:** `21-version`, `22-signature`, `23-verify-gate`, `24-workbook`, `25-docs`, and
  Chromium `45-pull`.
- **Readable versions** (X-5); **the signature skin slot** (X-6), with the skin choice from the old
  tracker's pick (X-7); **Pull matches X-Men** in 71 measured properties (X-8, with 9 recorded
  differences); **the verify gate** (V-22); **the workbook**, optional per tracker (V-23);
  **docs and the Skill** (V-28).
- **John's addition (6 Oct):** `"deliverables": {"workbook": false}` turns the workbook off.
  - The build writes none, and says so.
  - `--check` fails on a leftover workbook, and the next build removes it.
  - `24-workbook` tests that a tracker with workbooks off builds without one.
  - Absolute-v3 must set it.
- **Inventory:** every S5 line is present except V-21 (the pilot).

### Pre-flight results for the pilot (checked before step 1)
- **dc.fandom.com is reachable through its MediaWiki API.**
  - `https://dc.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=…`
    returned 200 with the full wikitext.
  - Ordinary wiki pages return 403, behind Cloudflare's "Just a moment…" check, so research must
    use the API. The plan's fallback (v7's cover months for rows audited on 17 Sep) is not needed.
- **Absolute-v3 is not attached to this session.** `list_repos` shows only ASIMKARD/Absolute.
  Attaching ASIMKARD/Absolute-v3 was refused by the session's permission check, so I couldn't tell
  whether GitHub would allow it. Before session 6, John should:
  - install the Claude GitHub App on Absolute-v3;
  - start the session with Absolute-v3 and Research-Repo selected;
  - allow `add_repo` if asked.

### Why the pilot (step 7) didn't start
The plan starts it only after steps 1–6 and with room to finish 7a–7c, and expected it in session 6.
It also needs Absolute-v3 attached, and CLAUDE.md says to stop and tell John before the first edit
to it. Nothing outside this repo was edited. X-men and Research-Repo were only cloned or read.

### Session 6 starts with: the Absolute pilot (V-21), step 7a
1. **Confirm access first.** Absolute-v3 must be attached with push access. Tell John before the
   first edit to it.
2. **First files:**
   - the template, copied into Absolute-v3 with fresh history (including `.claude/skills/`);
   - `dataset.json` (key `absolute`, `versionStart` 8, `deliverables.workbook: false`);
   - `storage.legacy`: prefix `absolute:v1:`, format `v2`, `qrPrefix` `ABSO1:`, and
     `skins: {field: "layout", map: {abs: "signature", tabs: "signature", pull: "pull"}}`;
   - a conversion script from the read-only Absolute `dataset.py`: `id`s are the old 9-digit keys,
     and `issueId`s follow the rule.
   - Absolute's icons and name. The build warns until `franchise.icons` is set.
3. **Delete the template's `workbook.xlsx` from the copy,** or let the first build remove it:
   `--check` flags it while `deliverables.workbook` is false.
4. **First test:** the harness, the layout suite and `python3 tools/verify_gate.py`, green on
   Absolute's data (V-21). Then 7b research (through the DC Database API, cached in Research-Repo
   `sessions/<date>-absolute/`), 7c the gate, 7d the signature skin recreated from the old
   `[data-skin="abs"]` CSS, 7e the migration proof, 7f deploy.
5. **Half-made for 7d:** the old `abs` skin uses grid rows, counters, `::before`/`::after` content
   and padding. The slot refuses all of those, because a skin may not move things. Recreate what is
   look-only; list the rest for John (the same way as the Pull differences).

### Questions for John
1. **Pull: era boxes** (step 3 checkpoint, question 1): (a) keep pale washes; (b) an optional colour
   per era, with solid era heads in Pull; (c) (b) plus the folder-tab shape.
2. **Pull: the tab bar edge to edge?** (a) inset everywhere, as now; (b) edge to edge everywhere;
   (c) a Pull-only exception.
3. **Pull: mark size and shape** stay with the Button size and Marks settings? (a) yes; (b) give
   compact X-Men's 22 px (below the 24 px target).
4. **My call (step 2), open to veto:** the signature CSS arrives inside `data.js` instead of a linked
   `skin.css`. Measured first paint was a tie: 864 vs 868 ms.

---

## Session 5 — step 7 (the Absolute pilot) in progress, 7 Oct 2026

John asked for all seven steps this session, with a change report and his OK before any data is
written to Absolute-v3.

### Done
- **The v7 reading is confirmed.** `index.html` reads "build v7", `sw.js` caches as `absolute-v7`, and
  commit `7304f82` (17 Aug 2026) is the head of ASIMKARD/Absolute's only branch on GitHub. The live
  site can't be reached from the container. Absolute-v3 starts at v8.
- **7b research,** in Research-Repo `sessions/2026-10-06-absolute/` (add-only; commit `ecd4857` on
  `claude/tender-albattani-hxrb3y`):
  - 142 DC Database pages were fetched through its API, each cached with its revision id;
  - cover dates come from the pages' Month and Year;
  - on-sale dates are the pages' stated release dates (Day plus the template's month, cross-checked:
    136 of 138 fall on a Wednesday);
  - writer and artist credits for every row;
  - the crossover chain that places the Wonder Woman 2026 Annual;
  - collected ranges and Absolute Batman Vol. 3 ("Devil's Workshop");
  - new titles flagged, not added.
  - Only dc.fandom.com is reachable from this environment. dc.com, League of Comic Geeks, the Grand
    Comics Database and Wikipedia are blocked, so there is no second source.
- **The change report** (`change-report.md`): 134 rows (v7: 123), 11 added, 2 re-dated, 1 moved,
  26 renumbered only, 0 removed. The draft dataset passes the build (credits strict, 100 %) and the
  verify gate.

### Waiting on John
1. **His OK on the change report.** It covers Wonder Woman #11 → November 2025 and Flash #12 → May
   2026 (with page histories), the Wonder Woman Annual before #16, the July and September blurbs,
   whether on-sale dates come from the DC Database alone, and the issueId shapes.
2. **Access to Absolute-v3.** Attaching it fails ("you don't have access to asimkard/absolute-v3"),
   and a public search finds only ASIMKARD/Absolute. Either:
   - the repo doesn't exist yet: John creates it;
   - or it is private without the Claude GitHub App: John grants the app access to it, at
     https://claude.ai/connect-github.

   Then retry attaching it here, or start a new session with Absolute-v3 selected.

### Where step 7a begins (after both)
1. Copy the template into Absolute-v3 with fresh history, keeping `.claude/skills/` and dropping
   `workbook.xlsx`.
2. Write `dataset.json` from `sessions/2026-10-06-absolute/absolute-v3.dataset.draft.json`, with John's
   answers applied.
3. Add `storage.legacy.skins` (`abs` / `tabs` → signature, `pull` → Pull) once the signature skin
   exists (7d). Add Absolute's icons and name.
4. First test: `python3 tools/verify_gate.py`, then `node test/run.js` and `npm run test:layout`, on
   Absolute's data.

### Found while closing this out: one bulk mark was quadratic
The close-out's harness run failed once: `9c-bulk-touch` marked 5,000 rows read in 1,544 ms, against a
1.5 s budget. Run alone it took 1,134–1,338 ms, which still passed, but with too little margin.
- **The profile** showed most of the time in jsdom compiling selectors. `applyMark` queried
  `.row[data-i="N"]` once per row, so 5,000 rows meant 5,000 full-document queries, each with a new
  selector, even though no rows were rendered.
- **The fix:** a bulk action now gathers the rendered rows once (`renderedRows()`), and Undo does
  the same when it's tapped. The time is now 170–208 ms. A single mark still uses its one query.
- **New checks in `9c-bulk-touch`:** every rendered row of a bulk-marked arc shows "read" and its
  glyph, and Undo puts each one back as it was. They pass on the old code (same behaviour, just
  slower) and catch a map that misses rows.

**Harness:** 1475 assertions (+3), 0 failed, 34 suites. **Layout:** 267 checks, 0 failed, 9 suites.

## Session 5 — step 7 done (the Absolute pilot): v8 live, 8 Oct 2026

**Change of plan (John, 8 Oct).** Absolute is upgraded in place on ASIMKARD/Absolute's own `main`, a
one-off exception recorded in `CLAUDE.md`; Absolute-v3 is no longer needed. The safeguards:
- `v7-final` tags v7 (`7304f82`). John created it, since this session can't push tags; it is
  confirmed on `7304f82`.
- Nothing reaches `main` until everything passes on Absolute's own data and the in-place proof
  passes.
- v8 reaches `main` through one pull request that John merges (this session can't push `main`).
- The first deploy replaces every file, and every file is verified live by hash.

John's answers (8 Oct): the change report "OK as drafted"; all four shared skins plus the
signature; the live domain allowed for checks by hash.

### Done (template)
- **The service worker leaves other trackers' caches alone.** Every tracker on one Pages site
  shares one cache storage, and v2's worker deleted everyone's. Now it deletes only `<key>-v<N>`
  and `<key>-<12 hex>` (80-guards, 70-pwa).
- **GitHub Pages' 10-minute caching**, found by the upgrade proof (`CLAUDE.md` has the trap):
  - **The precache** now goes past the HTTP cache (`cache: 'reload'`). Before, v8's worker stored
    v7's files under its own name.
  - **The shell** is always checked with the server (`cache: 'no-cache'`; a 304 when unchanged).
  - **`app.js` checks** the data's shape and the stylesheet's beacon before reading anything. On a
    mismatch it loads both again at `?r=<time>` and starts over, once; it never loops. Before,
    Chromium's memory cache handed v8's `app.js` v7's `data.js` on a reload, and it crashed.
  - **Tests:** 80-guards (vm), 9i-pwa (jsdom), and 70-pwa against a server that sends Pages'
    headers (`serve(dir, { pages: true })`). Every one was proved by putting its bug back.
  - **F-57:** an older stylesheet is now reloaded and the app starts over (9g-look). A stylesheet
    with no beacon at all still gets the toast.
- **The suites run on any tracker's data.** `ROOT_DATASET` and `IS_TEMPLATE` are in
  `test/lib/helpers.js`.
  - 21-version uses the root's own `versionStart`.
  - 25-docs allows `FEATURE-INVENTORY.md`, and `workbook.xlsx` when the workbook is off.
  - 93-storage boots the minimal fixture.
  - 9i-pwa checks a tracker's icons are its own.
  - 10-sweep sweeps the root in every skin it offers, and with large text and buttons.
  - **The new `test/layout/45-root`** measures the repo's own dataset in every skin it offers:
    contrast on every paper, its era banners, and every control's reachability. It was proved with
    v7's grey, unstyled banner text and undersized buttons.
- **`test/layout/lib.js` `poll()`.** `page.waitForFunction` returns at once on an async check, so
  two older 70-pwa waits had never waited.
- **`MIGRATING.md`** now covers the in-place path, the Pages caching and `45-root`.

### Done (Absolute, branch `claude/tender-albattani-hxrb3y`)
- **The template, copied in.** v7's own files are gone:
  - removed: `dataset.py`, `gen.py`, `test.js`, `deploy.sh`, `README.md`, `icons/favicon.png`;
  - replaced: v7's `index.html`, `styles.css`, `data.js`, `sw.js` and `manifest.json`;
  - `qrcode.js` and `fonts/` were byte-identical already.
- **Its own files:** `dataset.json` (the approved draft), `signature.css`, `README.md`,
  `CLAUDE.md`, `PROGRESS.md`, `.nojekyll`, and its own icons.
- **The signature skin "Absolute"** is v7's "absolute" look, rebuilt as tokens and look-only rules:
  - a black page, with a red rule under the header;
  - mono uppercase labels and tabs, with a red underline;
  - red era bars with black type, and Anton row titles;
  - square controls, solid red when pressed.

  Contrast is at least 4.58:1 everywhere (v7's own red on black). v7's dim grey (3.3:1) was
  lightened to pass.
- **What it couldn't carry** (each one would move something), listed for John: the big era
  numerals, the row-number gutter, the bracketed `[X]` marks, the `//` arc prefix and full-width
  era bars.
- **v8 on Absolute's data:** gate passed; harness 1483, 0 failed; layout 349, 0 failed (10 suites).
- **The in-place proof** (Research-Repo `sessions/2026-10-06-absolute/upgrade-proof/`): 42 of 42.
  - **v7, used in Chromium:** 5 marks, a bookmark, a review and the "classic" skin. The proof
    server sends Pages' own headers.
  - **One reload opens v8,** with all of them intact; the skin becomes Pull.
  - **The handover:** v8's worker is in control 2.8 s later. `absolute-v7` is deleted, the other
    trackers' caches are kept, and v8's cache holds v8's files byte for byte.
  - **Offline,** it opens as v8 with everything there. v7's keys are byte for byte unchanged.
  - **An old `ABSO1:` code** imports on a second device.
  - **v7's "absolute" skin** and a never-picked skin both open in Absolute.
  - **Reopened within 10 minutes of using v7,** the first open can still show v7, from the
    browser's cache. The next open is v8, with everything intact.

### Live (8 Oct, 12:21 UTC)
- **John merged ASIMKARD/Absolute#1.** `main` is `36fd088`, a merge commit whose files are identical
  to the tested commit `ee076da`. Pages served it within a minute.
- **Every file was verified by sha256** against `main` at https://asimkard.github.io/Absolute/:
  - 180 of 180 match, and the bare address serves `index.html`;
  - v7's 5 removed files return 404;
  - the live `data.js` is version 8, and the cache is `absolute-b0de46364a0d`.
- **Real Chromium on the live site** reads "v8" in the header, in the Absolute skin, with no errors.
- **The record** is in Research-Repo `sessions/2026-10-06-absolute/upgrade-proof/live-verify.txt`,
  with the script `verify-live.sh`.
- **Absolute's own `PROGRESS.md`** still says "after the merge: verify". Changing it needs John's
  say-so, since any change to Absolute does now.

### Open with John (non-blocking)
- **The signature-skin items** that need moving things: era numerals, the row-number gutter, `[X]`
  marks, the `//` arc prefix, full-width era bars.
- **From earlier:** the Pull era boxes; the tab bar edge to edge; the mark size; whether signature
  CSS should ship inside `data.js`.
- **The template's own pull request:** ASIMKARD/Pull-List-template#5 (this branch).

## Session 6 plan (agreed 8 Oct 2026): per-issue reviews, signature decorations, Absolute v9

John approved edits to ASIMKARD/Absolute for v9, through a branch and one pull request, as for v8.
The safeguards are the same: everything passes on Absolute's data first; an in-place v8 → v9
proof in Chromium; every file verified live by hash after the merge.

1. **Per-issue reviews (template).** The per-arc model came from a wrong assumption: the old
   trackers kept a review per issue.
   - Reviews are keyed by row id, with a ✎ on every row, and the Reviews tab lists them in
     reading order.
   - Sync and backup move to v4; v3 (per arc) and v2 (per issue) still read.
   - A one-time upgrade for trackers whose reviews were per arc.
2. **Signature decorations (template).** Pseudo-element content, counters, glyph marks,
   prefixes and full-bleed bars are allowed. Anything that moves, hides or reorders a control is
   still refused. Reachability, overflow, contrast, tap size and the stack must pass across the
   skin.
3. **Absolute v9.** v7's five touches, compared side by side with v7's screenshots, then all
   the tests on Absolute's data.
4. **The v8 → v9 proof,** one PR, and the live check by hash.

**John's decisions (8 Oct) for the upgrade from per-arc reviews:**
- a review written in v8 goes on its arc's first issue (and so does each review of an old
  v3-format code or backup);
- a migrated review that was then edited: v7's originals are restored on every issue, and the
  edited review is kept too, on the first issue;
- a migrated review that was then deleted stays deleted.

My call within the second decision: when the first issue also has a v7 original, the edited text
goes after it, and the stars are the edited review's (the latest choice).

## Session 6 checkpoint — step 1 done (per-issue reviews), 8 Oct 2026

### Done
- **The store.** Reviews live under `<key>:v3:issue-reviews`, keyed by row id. The per-arc
  `reviews` key of earlier builds is read once and never written, so a rollback to v8 finds
  v8's reviews as v8 left them.
- **The ✎ is on every row,** in both layouts, named for its issue. Arc heads no longer carry one.
  - The editor opens under the row.
  - The Reviews tab lists reviews in reading order, each with its arc and era, and tapping one
    jumps to the issue.
  - Reviews the list has no issue for are still kept and listed.
- **The legacy (v2) import is exact, per issue,** with nothing merged. Old QR and sync codes
  (`ABSO1:` and the like) import per issue too.
- **Sync and backup are v4,** with reviews keyed by row id.
  - A v3 code or backup (reviews per arc) still reads; each arc's review goes to the arc's first
    issue.
  - A newer format is refused, and says so.
- **The one-time upgrade** (`upgradeArcReviews`) runs at the first boot without the new store. It
  recomputes the old migration's merge from the untouched old keys, step for step, and applies
  John's decisions. It is recorded in `settings.reviewsUpgraded` and reported once in a toast.
- **Table view** at 320 px: with a ✎ on every row, a row can carry four 24 px targets.
  - Table view's own spacing is 2 px tighter, and the ★ core label (not a target) shrinks.
  - Every title still keeps at least half its row (50-table); every target is still 24 px or
    more.
- **Tests:**
  - 9b-reviews: the per-issue editor and the tab;
  - 93-storage: the exact v2 import, and a re-run that never overwrites an edited review;
  - 9k-review-upgrade, new: every case of the upgrade, a whole list returned exactly, a tracker
    with no old version, and a fresh tracker;
  - 9e-sync: v4 round-trips, old v3 codes and backup files, a newer format refused.

  Each new check was proved by putting its bug back:
  - every review treated as untouched;
  - no restore;
  - deleted reviews brought back;
  - v3 reviews not moved to issues.
- **The docs:** FEATURE-INVENTORY (F-3, F-8, F-30, T-53, D-4) and MIGRATING.

**Harness:** 1517 assertions (+33), 0 failed, 35 suites. **Layout:** 349 checks, 0 failed, 10 suites.

### Step 2 begins with: signature decorations
- **First file:** `tools/build.py` (`signature_rules`, `MOVES`, `LOOK_PROPS`).
- **First test:** `test/suites/22-signature.test.js`.
- **The design:**
  - Rows get `data-n` and eras get `data-n`, zero-padded reading positions for numbering;
  - rows, era heads and arc heads become `position: relative`, as anchors (only `.stack` is
    sticky);
  - a `--row-gutter` token reserves a right gutter in rows;
  - `content` is allowed only on `::before` and `::after`. The build appends `/ ""` (screen
    readers skip it, with a fallback for older Safari) and `pointer-events: none`;
  - a new Chromium check: no decoration covers a control, and every decoration's text clears
    contrast.

## Session 6 checkpoint — step 2 done (signature decorations), 9 Oct 2026

### Done
- **The build** (`signature_rules`) still refuses everything that moves, hides or reorders a
  control: display, visibility, opacity, order, flex, grid, z-index, transform, margins, and
  width, height and offsets on ordinary elements. The new allowances:
  - **Decorations:** a rule whose every selector ends in `::before` or `::after` may have
    `content` and may be placed absolutely, with offsets, width, height, `text-align` and
    `white-space`.
  - **Content** takes quoted text, `attr(data-n)` and `counter()`s. `url()`, other attributes,
    unknown counter styles and a hand-written `/` alternative are refused.
  - **Counters** (`counter-reset`, `counter-increment`, `counter-set`) may run on any rule.
  - **To every decoration the build adds** `pointer-events: none` and an empty alternative,
    `content: X / ""`. Older browsers keep the first `content` line.
- **The template:**
  - rows and era names carry `data-n`, their reading position, zero-padded;
  - rows, era heads, band heads and arc heads are anchors (`position: relative`; only `.stack` is
    sticky);
  - the new `--row-gutter` token reserves room at a row's right end.
- **The demo skin "Signal"** decorates: row numbers in a 24 px gutter (none in table view), a
  `›` arc prefix, era numerals, and `[ ] [/] [X] [-]` marks. So 10-sweep, 40-look and 60-stack
  run across decorations in the template's own CI.
- **The new `test/layout/55-decor`** runs at 320, 390 and 1024 px, with default, largest and
  table view. Every decoration must be silent to screen readers, take no taps, and clear
  contrast. One placed absolutely must be anchored, stay on screen, and cover no control or
  title. It was proved with five bugs put back:
  - no gutter (row numbers covering titles);
  - no `pointer-events: none`;
  - no screen-reader alternative;
  - rows not anchored;
  - faint row numbers (1.48:1).
- **22-signature (+22 checks):**
  - what passes;
  - 15 refusals;
  - the build's additions on every rule;
  - `data-n` on rows (inert rows too) and on era names.
- **60-validation:** the broken fixture `signature-position` now expects the more specific
  refusal.
- **Docs:** BUILD-NOTES (decorations); FEATURE-INVENTORY X-9 (per-issue reviews) and X-10
  (decorations).

**Harness:** 1539 assertions (+22), 0 failed, 35 suites. **Layout:** 351 checks (+2), 0 failed, 11 suites.

### Step 3 begins with: Absolute v9
- **First:** copy the template into ASIMKARD/Absolute's session branch, restarted from `main`.
- **Then `signature.css`:** v7's five touches:
  - the big era numbers: `.era-head .bname::before`, `attr(data-n)`, mono, 26 px;
  - the row-number gutter: `.row::after`, with `--row-gutter`;
  - the `[ ] [/] [X] [-]` marks;
  - the `//` arc prefix;
  - full-width era bars: `box-shadow` either side.
- **First tests:** `test/layout/55-decor` and `45-root` on Absolute's data, then screenshots side
  by side with v7's (Research-Repo `sessions/2026-10-06-absolute/upgrade-proof/screens/`).
