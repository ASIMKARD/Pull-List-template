# events/ — canonical event master

Each major crossover is defined **once** here as `events/<id>.json`
(schema: `schema/event.schema.json`) and copied into every tracker it touches.
A tracker lists it in `dataset.json` as `{"id": "<id>", "era": "<era id>"}`;
the build merges chapters the tracker already has (same `issueId`) and places
the rest inside the stated era by date, then event order. Each built event
carries a hash of its file, so a copied event that drifts from this master is
detectable. See the Essential/Complete Event Standard (Master-Repo
`starter/standards/essential-complete-event-standard.md`).
