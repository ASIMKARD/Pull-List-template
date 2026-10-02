# PROGRESS — template v3

Updated at the end of every step. The next session starts by reading this file,
`CLAUDE.md`, and Master-Repo `starter/v3/V3-SPEC.md`.

**Harness:** 603 assertions, 0 failed, 16 suites (end of session 2, after John's two closing fixes).
Session 1 ended at 307; CI green on every run.

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
  - **Plan** (depth tier, mandatory only, hide skipped, ALT; later Essential/Complete): progress, time left and finish-by always follow them.
  - **Browse** (search, creator, era, type, format, character): while any is active, banners and header count only that view, with a "filtered" marker, and revert when it is cleared. Format is classed as browse alongside type.
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
