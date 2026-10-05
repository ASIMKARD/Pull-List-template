# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file,
`CLAUDE.md`, and Master-Repo `starter/v3/V3-SPEC.md`.

**Harness:** 1154 assertions, 0 failed, 25 suites (session 4, step 2).
Session 1 ended at 307, session 2 at 617 and session 3 at 1105; CI green on every run.

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
   - **The same rule applied further** (my reading of "a rule, not a one-off"; open to veto).
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
     session 2. Say if you want otherwise.
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
- **The rule applied further (open to veto):** depth chips, type chips, strand chips, Include
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

### One reading to flag
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

### Step 3 starts with: the Chromium layout harness (plan step 3)
- Rebuild the scratchpad checks under `test/layout/`: page errors, the 320/360/390 sweep, and
  this step's animation and reduced-motion measurement.
- Wire up `@font-face`, and run the suite in CI (John's answer 3).
