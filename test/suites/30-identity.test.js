/* id vs issueId, event dedupe, within-month numbering, ALT ordering. */
'use strict';
const path = require('path');
const { FIX, build, loadData, readJSON, writeJSON, copyFixture, validateIssueIds } = require('../lib/helpers');

module.exports = async function (t) {
  // ---- issueId validator: unit cases ----
  const good = ['justice-league-2016-32', 'x-men-1963-annual-1', 'fixture-hero-1980-half', 'fixture-hero-1995-minus-1',
    'fixture-hero-1980-1-5', 'fixture-hero-1980-1000000', 'fixture-hero-1980-0',
    'x-men-god-loves-man-kills-1982', 'sonic-frontiers-2022', 'sonic-prime-2022-s1e3', 'spider-man-2099-1992-1'];
  const bad = { 'Fixture-Hero-1980-1': 'uppercase', 'fixture hero-1980-1': 'a space', 'fixture-hero-1980-#1': '#',
    'fixture-hero-1980-½': '½', 'fixture--hero-1980-1': 'a double hyphen', 'fixture-hero-1980-1-': 'a trailing hyphen',
    'fixture-hero-1': 'no year token', '1980-fixture': 'year as the first token only', '': 'empty' };
  const res = validateIssueIds(good.concat(Object.keys(bad)));
  for (const id of good) t.ok('issueId valid: ' + id, res[id] === null, res[id]);
  for (const [id, why] of Object.entries(bad)) t.ok('issueId rejected (' + why + '): ' + JSON.stringify(id), typeof res[id] === 'string');

  // ---- the basic fixture ----
  const b = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'identity' });
  t.ok('basic builds', b.status === 0, b.stderr);
  if (b.status !== 0) return;
  const D = loadData(b.out);
  const at = iid => D.issueIds.indexOf(iid);

  for (const [iid, what, med] of [['fixture-hero-quiet-storm-1986', 'unnumbered graphic novel', 'comic'],
                                  ['fixture-quest-1987', 'game', 'game'],
                                  ['fixture-toons-1988-s1e3', 'TV episode', 'screen']]) {
    const i = at(iid);
    t.ok(what + ' passes validation and builds: ' + iid, i !== -1);
    t.ok(what + ' keeps its medium (' + med + ')', i !== -1 && D.media[D.issueMedium[i]] === med);
  }
  const brokenSlug = build(path.join(FIX, 'broken', 'issue-id-uppercase', 'dataset.json'), { label: 'slug' });
  t.ok('a malformed slug still fails the build', brokenSlug.status === 1 && /bad issueId/.test(brokenSlug.stderr));

  t.ok('new-style rows default id to issueId', D.ids[at('fixture-hero-1980-1')] === 'fixture-hero-1980-1');
  t.ok('issueIds are unique', new Set(D.issueIds.filter(Boolean)).size === D.issueIds.filter(Boolean).length);
  t.ok('inert rows have an id but no issueId', D.ids.includes('gap-1983-hiatus') && D.issueIds[D.ids.indexOf('gap-1983-hiatus')] === '');

  // event merge dedupes on issueId
  const ev = 0;
  const own = at('fixture-hero-1980-30');
  t.ok('event chapter matching a row appears exactly once', D.issueIds.filter(x => x === 'fixture-hero-1980-30').length === 1);
  t.ok('merged row is tagged with the event', D.issueEvent[own] === ev);
  t.ok('merged row stays essential', D.issueCompleteOnly[own] === 0);
  const mig = at('kestrel-1986-7');
  t.ok('migrated row appears exactly once', D.issueIds.filter(x => x === 'kestrel-1986-7').length === 1);
  t.ok('migrated row keeps its legacy id (198706004), not its issueId', D.ids[mig] === '198706004');
  t.ok('migrated row id differs from its issueId', D.ids[mig] !== D.issueIds[mig]);
  t.ok('migrated row is tagged with the event', D.issueEvent[mig] === ev);
  const storm = D.eras.findIndex(e => e.id === 'storm');
  for (const iid of ['shattered-sky-1987-1', 'shattered-sky-1987-2', 'other-guy-1985-22', 'bystander-1987-1']) {
    const i = at(iid);
    t.ok('unmatched chapter placed inside the stated era: ' + iid, i !== -1 && D.issueEra[i] === storm);
    t.ok('placed chapter id defaults to its issueId: ' + iid, i !== -1 && D.ids[i] === iid);
  }
  t.ok('placed chapters follow event order within a month',
       at('shattered-sky-1987-1') < at('other-guy-1985-22'));
  t.ok('Other Guy #22 (a 1985 volume) is placed by its date, not its volume year',
       Math.floor(D.issues[at('other-guy-1985-22')][0] / 1000) % 1e6 === 198705);
  const unknownEra = build(path.join(FIX, 'broken', 'event-unknown-era', 'dataset.json'), { label: 'ev-era' });
  t.ok('an event naming an unknown era fails', unknownEra.status === 1 && /each event must state an era/.test(unknownEra.stderr));

  // NNN is assigned by the build; seq is only a hint, so equal seqs never collide
  const o2 = at('orrin-1983-2'), vo = at('vela-and-orrin-1984-1');
  t.ok('two rows with the same month and seq get distinct keys', D.issues[o2][0] !== D.issues[vo][0]);
  t.ok('equal seq falls back to source order', D.issues[o2][0] % 1000 === 1 && D.issues[vo][0] % 1000 === 2);
  t.ok('seq orders #1 before #1.5 in the same month', at('fixture-hero-1980-1') < at('fixture-hero-1980-1-5'));
  const months = {};
  D.issues.forEach((r, i) => { const k = D.issueEra[i] + ':' + Math.floor(r[0] / 1000); (months[k] = months[k] || []).push(r[0] % 1000); });
  t.ok('NNN runs 1..n within every era+month', Object.values(months).every(a => a.every((n, j) => n === j + 1)));

  // ALT track
  const elsewhere = D.eras.findIndex(e => e.id === 'elsewhere');
  const altRows = D.issues.map((r, i) => i).filter(i => D.issues[i][6] & D.flagBits.ALT);
  t.ok('ALT rows build (4 rows)', altRows.length === 4);
  t.ok('ALT rows sit in their own era', altRows.every(i => D.issueEra[i] === elsewhere));
  t.ok('ALT rows order by placement: #3 (sortDate 1990-01) reads first',
       JSON.stringify(altRows.map(i => D.issueIds[i])) ===
       JSON.stringify(['mirror-hero-1990-3', 'mirror-hero-1990-1', 'mirror-hero-1990-2', 'mirror-hero-1990-4']));
  t.ok('ALT altKeys stay in publication order', D.issues[at('mirror-hero-1990-3')][8] > D.issues[at('mirror-hero-1990-2')][8]);

  // the per-series check skips ALT rows (verify.py rule): drop the ALT flag and it must fail
  const dir = copyFixture('basic', 'no-alt');
  const f = path.join(dir, 'data', 'eras', '5040-elsewhere.json');
  const era = readJSON(f);
  era.rows.forEach(r => { r.flags = (r.flags || []).filter(x => x !== 'ALT'); });
  writeJSON(f, era);
  const noAlt = build(path.join(dir, 'dataset.json'), { label: 'no-alt-out' });
  t.ok('per-series check skips ALT rows (same rows without ALT fail)',
       noAlt.status === 1 && /numbering goes backwards: Mirror Hero \(1990\) #1/.test(noAlt.stderr), noAlt.stderr);
  t.ok('SPECIAL_NUMBERING rows (#½, #1,000,000, #-1) are exempt', b.status === 0);
};
