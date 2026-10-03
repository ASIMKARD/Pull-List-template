/* Creator credits: override > split > arc, the creator index, coverage. */
'use strict';
const path = require('path');
const { FIX, build, loadData, readJSON, writeJSON, copyFixture } = require('../lib/helpers');

module.exports = async function (t) {
  const b = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'credits' });
  t.ok('basic builds', b.status === 0, b.stderr);
  if (b.status !== 0) return;
  const D = loadData(b.out);
  const at = iid => D.issueIds.indexOf(iid);
  const W = iid => D.issueWriters[at(iid)].map(c => D.creators[c].n);
  const A = iid => D.issueArtists[at(iid)].map(c => D.creators[c].n);

  t.eq('arc credits apply before the split (#6 writer)', W('fixture-hero-1980-6'), ['Avery Quill']);
  t.eq('split by fromId takes over at its row (#7 writer)', W('fixture-hero-1980-7'), ['Bram Ostrow']);
  t.eq('split carries on to later rows (#12 writer)', W('fixture-hero-1980-12'), ['Bram Ostrow']);
  t.eq('split only replaces the roles it names (#7 artist)', A('fixture-hero-1980-7'), ['Cass Delune']);
  t.eq('per-issue override beats arc (#4 fill-in artist)', A('fixture-hero-1980-4'), ['Dorian Vale']);
  t.eq('override keeps the roles it does not name (#4 writer)', W('fixture-hero-1980-4'), ['Avery Quill']);
  t.eq('per-issue override beats the split (#10 fill-in writer)', W('fixture-hero-1980-10'), ['Fen Larkspur']);
  t.eq('several names per role are kept', W('vela-and-orrin-1984-1'), ['Emeka Stroud', 'Avery Quill']);
  t.eq('event chapter credits flow into placed rows', W('shattered-sky-1987-1'), ['Avery Quill']);
  t.eq('a listed mononym is accepted', A('fixture-quest-1987'), ['Quillon']);

  // the index must match a brute-force recount over checkable rows
  const recount = {};
  D.issues.forEach((r, i) => {
    if (r[6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)) return;
    D.issueWriters[i].forEach(c => { recount[c] = recount[c] || [0, 0]; recount[c][0]++; });
    D.issueArtists[i].forEach(c => { recount[c] = recount[c] || [0, 0]; recount[c][1]++; });
  });
  t.ok('creator index counts match a brute-force recount',
       D.creators.every((c, i) => recount[i] && recount[i][0] === c.w && recount[i][1] === c.a));
  t.ok('creator index lists every credited name once', new Set(D.creators.map(c => c.n)).size === D.creators.length);
  t.ok('creator index is sorted by name', D.creators.every((c, i) => i === 0 || c.n.toLowerCase() >= D.creators[i - 1].n.toLowerCase()));

  t.ok('coverage reported as a percentage (58 of 59 = 98.3%)', D.counts.creditsCoverage === 98.3);
  t.ok('missing credits warn, not fail, when strictCredits is off', /WARN  credits: 1 of 59/.test(b.stderr));

  const dir = copyFixture('basic', 'strict');
  const ds = readJSON(path.join(dir, 'dataset.json'));
  ds.franchise.strictCredits = true;
  writeJSON(path.join(dir, 'dataset.json'), ds);
  const strict = build(path.join(dir, 'dataset.json'), { label: 'strict-out' });
  t.ok('strictCredits turns missing credits into a failure', strict.status === 1 && /strictCredits/.test(strict.stderr));

  for (const [c, re] of [['surname-only-creator', /not a full canonical name/], ['conflicting-spellings', /conflicting creator spellings/],
                         ['split-unknown-row', /creditSplit fromId/]]) {
    const r = build(path.join(FIX, 'broken', c, 'dataset.json'), { label: c });
    t.ok(c + ' fails the build', r.status === 1 && re.test(r.stderr), r.stderr);
  }
};
