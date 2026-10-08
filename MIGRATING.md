# Migrating a live tracker onto v3

Moving a tracker people already use onto the v3 template, without losing a
single mark, bookmark, review or skin choice. The Absolute pilot is the first.

## 1. A fresh repo, unless John says otherwise

- **Stop and ask John first.** Normally he creates a fresh repo and the
  migration goes there. The original stays untouched, for comparison and
  rollback; read it from a local read-only copy and never commit to it. v3
  takes over the original address only at a **cut-over swap John approves**
  (step 8).
- **In place, as a one-off (Absolute, 8 Oct).** John approved upgrading
  ASIMKARD/Absolute on its own `main`. Because `main` is live:
  - the last old commit is tagged first (`v7-final`): the one-step rollback;
  - nothing reaches `main` until everything passes on the tracker's own data
    (step 6) and the in-place proof passes (step 7);
  - v8 reaches `main` through one pull request John merges;
  - that first deploy replaces every file and removes the old tracker's own
    (its generator, tests and scripts), so nothing stale is left serving.

## 2. Copy the template in

Copy this template into the fresh repo with fresh history (in place: over the
old files, removing them), then give it the tracker's own name, theme, icons
and data (`README.md`, "Start a tracker"). Leave out what is only the
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

## 5. What the tracker produces

- Web-app-only trackers (Absolute, Dark Nights) set
  `"deliverables": {"workbook": false}`.
- A tracker with a look of its own recreates it as its signature skin
  (`BUILD-NOTES.md`, "The signature skin slot"), measured side by side with the
  old copy. What can't be done without moving a control goes to John.

## 6. Dates, credits and the gate

- Every row's dates come from a named source (for DC, the DC Database through
  its API), cached in Research-Repo's session folder. Never interpolate.
- Run `python3 tools/verify_gate.py` and both suites on the tracker's own data
  until they're clean. The suites check the repo's own dataset as it is:
  `test/layout/45-root.test.js` measures it in every skin it offers (contrast
  on every paper, its era banners, every control reachable), and
  `test/layout/10-sweep.test.js` sweeps it at 320, 360 and 390 px.

## 7. Prove it in real Chromium

On the same origin and path as the old tracker: mark rows, add bookmarks, write
a review and pick a skin in the old copy; open the v3 build; everything carries
over. An old QR code imports. The old keys are byte-for-byte unchanged.

In place, serve the old build, let its service worker take control, then serve
the new build over the top at the same address and reload. It must open as the
new version with every mark, bookmark, review and the skin intact; the new
worker takes over, deletes the old one's cache (`absolute-v7`) and leaves other
trackers' caches on the origin alone.

## 8. Deploy, verify, swap

- Deploy to GitHub Pages (`.nojekyll`, so files are served as they are). Wait
  about 100 s, check the version in the header, and verify **every** file by
  hash against the live URL, never by HTTP 200. In place, the old tracker's
  removed files must be gone (404).
- John checks it on his phone.
- For a fresh repo, the cut-over swap (v3 takes the original address) happens
  only when John approves it.
