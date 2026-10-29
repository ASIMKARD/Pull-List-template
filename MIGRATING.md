# Migrating a live tracker onto v3

Moving a tracker people already use onto the v3 template, without losing a
single mark, bookmark, review or skin choice. The Absolute pilot is the first.

## 1. In place, on the tracker's own repo (John, 23 Oct)

Every migration goes in place, on the tracker's own `main`, the way Absolute did (v8,
8 Oct). This replaced the fresh repo and the cut-over swap. It covers Archie Sonic,
IDW Sonic, Spider-Man, Dark Nights and X-Men's fixes.

- **Stop and ask John first.** His say-so is given per migration, and covers only that
  tracker's repo. Every other repo stays read-only.
- **John tags the current `main` `vN-final` first:** the one-step rollback (Absolute:
  `v7-final`). A session can't push tags or `main`, so John makes it. Before the first
  change, confirm on GitHub that the tag exists and points at `main`; if it doesn't, stop.
- **The work reaches `main` only through a branch and a pull request John merges.**
- **Nothing is merged until everything passes on the tracker's own data** (step 6) and
  the in-place upgrade proof passes in Chromium (step 7).
- **After the merge, every file is verified live by hash** (step 8). The first deploy
  replaces every file and removes the old tracker's own (its generator, tests and
  scripts), so nothing stale is left serving.

## 2. Copy the template in

Copy this template over the tracker's old files, on a branch, removing the old
tracker's own files, then give it the tracker's own name, theme, icons and data (`README.md`, "Start a tracker"). Leave out what is only the
template's: its `PROGRESS.md`, `FEATURE-INVENTORY.md` and demo `dataset.json`.
The tracker gets its own `README.md`, `CLAUDE.md` and `PROGRESS.md`.
Keep the old `franchise.key` (e.g. `absolute`): v3 stores progress under
`<key>:v3:`, so the old keys are never touched.

## 3. Saved progress: `storage.legacy`

```json
"storage": { "legacy": {
  "prefix": "absolute:v1:", "format": "v2", "qrPrefix": "ABSO1:",
  "skins": { "field": "layout", "map": { "abs": "signature", "tabs": "signature", "pull": "pull" } }
} }
```

- `prefix` and `format`: where and how the old tracker kept progress. Format
  `v2` is template v2's: `{p: {key: state}, b: [keys]}` plus reviews keyed by
  issue, which come over per issue, exactly. The import runs once, on the first
  visit, and fills gaps only.
- A tracker whose first v3 build kept reviews per arc (before 8 Oct) is
  upgraded once, at its next visit: reviews the migration merged and nobody
  touched go back to the old per-issue originals; one written or edited on v3
  is kept, on its arc's first issue; one deleted stays deleted.
- `qrPrefix`: old QR and sync codes still import; their positions are rebuilt
  from the legacy ids plus `retiredIds`.
- `skins`: the old tracker's skin pick, read once on a first visit: the field
  of its saved settings and a map from each old value to a skin this tracker
  offers (the build checks the map). A value saved by default, never chosen,
  maps to the signature skin.
- Everything under the old prefix is read only. It is never written, moved or
  deleted.

## 4. Ids, numbers and versions

- **Keep each row's old sort key as its `id`.** That is what saved progress is
  keyed on. Give every row a proper `issueId` too.
- A row that goes away is listed in `retiredIds`, so old progress isn't
  silently orphaned and old QR positions don't shift.
- `franchise.versionStart` is the old tracker's last build + 1 (Absolute: build
  v7, so 8). The build counts up from there.
- **Version tags come with the copy** (John, 12 Oct; `BUILD-NOTES.md`,
  "Versions"). `.github/workflows/version-tag.yml` tags each merge into `main`
  that changes the readable version `vN`. It starts with the first such merge
  after the copy lands, so earlier versions keep only the tags made by hand.
  Existing tags, such as the `v7-final` rollback tag, are never moved or
  touched. A tracker already on v3 picks it up at its next update, as
  Absolute will.

## 5. What the tracker produces

- Web-app-only trackers (Absolute, Dark Nights) set
  `"deliverables": {"workbook": false}`.
- A tracker with a look of its own recreates it as its signature skin
  (`BUILD-NOTES.md`, "The signature skin slot"), measured side by side with the
  old copy. What can't be done without moving a control goes to John.
- **A signature skin that must keep its old arrangement** (Absolute's, John 25 Oct)
  sets `franchise.signature.frame` to `"v9"`: the template's arrangement as it was up
  to v9, exactly (`BUILD-NOTES.md`, "Two frames"). The shared skins still get the
  X-Men layout. Capture its reference from the old version's tag, into frame-ref.json
  beside `dataset.json`:

  ```
  git archive vN-final | tar -x -C DIR
  node test/layout/ref/capture-frame.js --dir DIR --out frame-ref.json
  ```

  From then on `test/layout/47-frame-v9.test.js` holds the skin there in CI: every
  visible element, in five views at 320, 390 and 1024 px. Re-capture only after John
  has seen a difference (on Absolute's data, session 8 measured 982 elements in 15 views; none changed).
- **Era colours carry over exactly** (`eras[].colour`, `BUILD-NOTES.md`, "Era
  colours"). Pull draws them as given (John, 12 Oct).
  - The build warns, and never fails, for any colour that puts white text under
    4.5:1. Three of X-Men's eleven will warn: Foundations `#A6791E` (3.91:1),
    Bendis to IvX `#B08A1F` (3.23:1; its strip 4.49:1) and ResurrXion `#C0622A`
    (4.18:1).
  - Eras without a colour get Pull's default palette: the same eleven, five of them nudged darker to
    pass (`BUILD-NOTES.md`). A migrated X-Men can leave its colours out and still look like X-Men.
- **Set the tracker's accent** (`franchise.accent`, `#RRGGBB`), if it has one, for Pull's "One colour" (John, 19 and
  24 Oct). The build darkens it only as far as white text, the 85 % years and the strip need. Without one, "One colour"
  is the X-Men tracker's navy `#1C3A5E`. `franchise.theme` is the browser chrome's colour, not the accent.

## 6. Dates, credits and the gate

- Every row's dates come from a named source (for DC, the DC Database through
  its API), cached in Research-Repo's session folder. Never interpolate.
- Run `python3 tools/verify_gate.py` and both suites on the tracker's own data
  until they're clean. The suites check the repo's own dataset as it is:
  `test/layout/45-root.test.js` measures it in every skin it offers (contrast
  on every paper, its era banners, every control reachable), and
  `test/layout/10-sweep.test.js` sweeps it at 320, 360 and 390 px. With its
  signature skin on the v9 frame, 47-frame-v9 also measures it against its
  frame-ref.json.

## 7. Prove it in real Chromium

On the same origin and path as the old tracker: mark rows, add bookmarks, write
a review and pick a skin in the old copy; open the v3 build; everything carries
over. An old QR code imports. The old keys are byte-for-byte unchanged.

Then the in-place upgrade proof: serve the old build with GitHub Pages' headers
(`serve(dir, { pages: true })`), let its service worker take control, then serve
the new build over the top at the same address and reload once. It must open as
the new version with every mark, bookmark, review and the skin intact; the new
worker takes over, deletes the old one's cache (Absolute's was `absolute-v7`) and
leaves other trackers' caches on the origin alone.

## 8. Deploy and verify

- John merges the pull request. GitHub Pages deploys it (`.nojekyll`, so files are
  served as they are).
- Wait about 100 s, check the version in the header, and verify **every** file by
  hash against the live URL, never by HTTP 200. The old tracker's removed files
  must be gone (404).
- Confirm the version tag appeared (`vN`, "Versions" in `BUILD-NOTES.md`).
- John checks it on his phone.
