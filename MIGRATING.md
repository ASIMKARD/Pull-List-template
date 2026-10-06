# Migrating a live tracker onto v3

Moving a tracker people already use onto the v3 template, without losing a
single mark, bookmark, review or skin choice. The Absolute pilot is the first.

## 1. A fresh repo, always

- **Stop and ask John first.** He creates a fresh repo (Absolute's is
  ASIMKARD/Absolute-v3). The migration goes there.
- The original stays untouched, for comparison and rollback. Read it from a
  local read-only copy; never commit to it.
- v3 takes over the original address only at a **cut-over swap John approves**
  (step 8).

## 2. Copy the template in

Copy this template into the fresh repo with fresh history, then give it the
tracker's own name, theme, icons and data (`README.md`, "Start a tracker").
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
  issue. The import runs once, on the first visit, and fills gaps only.
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
- Run `python3 tools/verify_gate.py` and both suites until they're clean.

## 7. Prove it in real Chromium

On the same origin as the old tracker: mark rows, add bookmarks, write a review
and pick a skin in the old copy; open the v3 build; everything carries over. An
old QR code imports. The old keys are byte-for-byte unchanged.

## 8. Deploy, verify, swap

- Deploy the fresh repo to GitHub Pages. Wait about 100 s, check the version in
  the header, and verify changed files **by hash** against the live URL, never
  by HTTP 200.
- John checks it on his phone.
- The cut-over swap (v3 takes the original address) happens only when John
  approves it.
