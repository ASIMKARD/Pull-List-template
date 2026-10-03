# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file,
`CLAUDE.md`, and Master-Repo `starter/v3/V3-SPEC.md`.

**Harness:** 1105 assertions, 0 failed, 24 suites (session 3, step 8 of 9 done).
Session 1 ended at 307 and session 2 at 617; CI green on every run.

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

### Step 9 begins with
**Close-out:** inventory statuses for every S3 line (anything not done gets a reason or moves to
S4), this file's transfer checkpoint and "Session 4 starts with", a CLAUDE.md lessons check, and
the real-Chromium screenshot pass.
