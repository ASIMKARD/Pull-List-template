/* The workbook (V-23): generated from dataset.json by tools/build_workbook.py
   on every build, read back here BY HEADER NAME (also with its columns
   shuffled) and matched against the dataset. Deterministic bytes; --check
   covers it. A tracker can turn it off ("deliverables": {"workbook": false},
   John, 6 Oct: Absolute and Dark Nights are web-app-only), and then the build
   produces none. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { ROOT, FIX, BUILD, build, loadData, readJSON, writeJSON, copyFixture, tmpdir, basic } = require('../lib/helpers');
const { readWorkbook } = require('../lib/xlsx');

const WB = path.join(ROOT, 'tools', 'build_workbook.py');
const SHEETS = ['Reading Order', 'Arcs', 'Eras', 'Creators', 'Events'];
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const minimalWith = (label, extra) => {
  const dir = copyFixture('minimal', label), p = path.join(dir, 'dataset.json'), ds = readJSON(p);
  Object.assign(ds, extra);
  writeJSON(p, ds);
  return p;
};

module.exports = async function (t) {
  // ---------------------------------------------------------------- every build writes one
  const b = basic(), D = loadData(b.out), file = path.join(b.out, 'workbook.xlsx');
  t.ok('a build writes workbook.xlsx next to data.js (on by default)', fs.existsSync(file) && /, workbook$/m.test(b.stdout), b.stdout);
  const again = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'wb-again' });
  t.ok('repeated builds give byte-identical workbooks', fs.readFileSync(path.join(again.out, 'workbook.xlsx')).equals(fs.readFileSync(file)));
  const W = readWorkbook(fs.readFileSync(file));
  t.eq('five sheets, in order', W.names, SHEETS);
  t.ok('every part is stored, not deflated (so no zlib version can change the bytes), with a fixed timestamp',
       W.parts.every(p => p.method === 0) && (() => { const buf = fs.readFileSync(file); return buf.readUInt16LE(12) === 0x21 && buf.readUInt16LE(10) === 0; })());   // 1 Jan 1980, 00:00 in DOS time
  const bad = W.parts.filter(p => /\.(xml|rels)$/.test(p.name)).filter(p => {
    const doc = new JSDOM('').window.DOMParser ? new (new JSDOM('').window.DOMParser)().parseFromString(W.files[p.name].toString('utf8'), 'application/xml') : null;
    return !doc || doc.getElementsByTagName('parsererror').length;
  }).map(p => p.name);
  t.eq('every part is well-formed XML (' + W.parts.length + ' parts)', bad, []);
  const shape = SHEETS.filter(n => {
    const s = W.sheets[n], last = String.fromCharCode(64 + s.headers.length), rows = s.records.length + 1;
    return !(s.headers.length && new Set(s.headers).size === s.headers.length && s.headers.every(h => typeof h === 'string' && h) &&
             /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(s.xml) &&
             s.xml.includes('<autoFilter ref="A1:' + last + rows + '"/>') && /<row r="1">(<c r="[A-Z]+1" s="1" t="inlineStr">.*?<\/c>)+<\/row>/.test(s.xml));
  });
  t.eq('every sheet: one row of named headers, unique, bold, frozen, with a filter over all of its rows', shape, []);

  // ---------------------------------------------------------------- read back by name, matched against the data
  const src = {};
  for (const f of fs.readdirSync(path.join(FIX, 'basic', 'data', 'eras'))) for (const r of readJSON(path.join(FIX, 'basic', 'data', 'eras', f)).rows) src[r.id || r.issueId] = r;
  for (const f of fs.readdirSync(path.join(FIX, 'basic', 'events'))) for (const r of readJSON(path.join(FIX, 'basic', 'events', f)).chapters) src[r.issueId] = src[r.issueId] || r;
  const RO = W.sheets['Reading Order'].records, names = D.creators.map(c => c.n);
  t.eq('Reading Order: one record per row, in the order the app shows (' + RO.length + ')', RO.map(r => r.Id), D.ids);
  const wrong = RO.map((r, i) => {
    const s = src[D.ids[i]] || {}, iss = D.issues[i], ev = D.issueEvent[i];
    const want = { '#': i + 1, 'Issue ID': D.issueIds[i], Title: iss[1], Series: s.series || '', Volume: s.vol || '', Number: s.num === undefined ? '' : String(s.num),
      Era: D.eras[D.issueEra[i]].name, Arc: D.arcs[iss[2]].n, Type: D.types[iss[3]], Mandatory: iss[4] ? 'yes' : 'no', Core: iss[5] ? 'yes' : 'no',
      'Cover date': (s.date || {}).cover || '', 'Date source': (s.date || {}).source || '', Writers: D.issueWriters[i].map(w => names[w]).join('; '),
      Event: ev >= 0 ? D.events[ev].name : '', 'Complete only': D.issueCompleteOnly[i] ? 'yes' : 'no', Note: iss[7], 'Sort key': iss[0], 'Publication key': iss[8] };
    const off = Object.keys(want).filter(k => r[k] !== want[k]);
    return off.length ? D.ids[i] + ': ' + off.map(k => k + ' ' + JSON.stringify(r[k]) + ' ≠ ' + JSON.stringify(want[k])).join(', ') : null;
  }).filter(Boolean);
  t.eq('…and every field read by its header matches the dataset (titles, series, dates and sources, eras, arcs, credits, events, keys)', wrong.slice(0, 5), []);
  t.ok('…including the event chapters the tracker didn\'t have and the inert marker rows',
       RO.some(r => r.Event && r['Complete only'] === 'yes') && RO.some(r => /GAPNOTE|RENUM/.test(r.Flags)));
  const A = W.sheets.Arcs.records, E = W.sheets.Eras.records, C = W.sheets.Creators.records, V = W.sheets.Events.records;
  t.ok('Arcs: one per arc, with era, strands, credits and an issue count that adds up', A.length === D.arcs.length &&
       A.every((a, i) => a.Id === D.arcs[i].id && a.Era === D.eras[D.arcs[i].e].name && a.Strands) &&
       A.reduce((n, a) => n + a.Issues, 0) === D.issues.length && A.some(a => a.Writers && a.Artists));
  t.ok('Eras: one per era, with rank, period and an issue count that adds up', E.length === D.eras.length &&
       E.every((e, i) => e.Id === D.eras[i].id && e.Rank === D.eras[i].rank && e.Period) && E.reduce((n, e) => n + e.Issues, 0) === D.issues.length);
  t.eq('Creators: one per creator, with what they wrote and drew', C.map(c => [c.Name, c.Written, c.Drawn]), D.creators.map(c => [c.n, c.w, c.a]));
  t.eq('Events: one per event, with essential and complete counts', V.map(v => [v.Id, v.Essential, v.Complete, v.Adds]), D.events.map(e => [e.id, e.essential, e.complete, e.adds]));

  // ---------------------------------------------------------------- columns shuffled: still read by name
  const shuf = path.join(tmpdir('wb-shuf'), 'shuffled.xlsx');
  const sr = spawnSync('python3', [WB, path.join(FIX, 'basic', 'dataset.json'), '--out', shuf, '--shuffle-columns', '7'], { encoding: 'utf8', cwd: ROOT });
  const S = readWorkbook(fs.readFileSync(shuf));
  t.ok('a workbook with every sheet\'s columns shuffled', sr.status === 0 && SHEETS.every(n => W.sheets[n].headers.length < 2 ||
       JSON.stringify(S.sheets[n].headers) !== JSON.stringify(W.sheets[n].headers)), sr.stderr);
  t.ok('…reads back to the same records by header name (by position it would be garbage)', SHEETS.every(n => canon(S.sheets[n].records) === canon(W.sheets[n].records)) &&
       JSON.stringify(S.sheets['Reading Order'].rows[0]) !== JSON.stringify(W.sheets['Reading Order'].rows[0]));

  // ---------------------------------------------------------------- text survives: & < > quotes
  {
    const p = minimalWith('wb-text', {});
    const ds = readJSON(p);
    ds.arcs[0].name = 'Fire & Ice <Part "One">';
    ds.rows[0].date.onsale = ds.rows[0].date.cover.slice(0, 7) + '-14';
    writeJSON(p, ds);
    const r = build(p, { label: 'wb-text-out' });
    const T = readWorkbook(fs.readFileSync(path.join(r.out, 'workbook.xlsx')));
    t.eq('characters XML treats specially (& < > ") come back exactly', T.sheets.Arcs.records[0] && T.sheets.Arcs.records[0].Name, 'Fire & Ice <Part "One">');
    const first = T.sheets['Reading Order'].records.find(x => x.Id === (ds.rows[0].id || ds.rows[0].issueId));
    t.eq('cover and on-sale dates land in their own columns', first && [first['Cover date'], first['On sale']], [ds.rows[0].date.cover, ds.rows[0].date.onsale]);
  }

  // ---------------------------------------------------------------- --check covers it
  {
    const out = tmpdir('wb-check');
    build(path.join(FIX, 'minimal', 'dataset.json'), { out });
    const chk = () => spawnSync('python3', [BUILD, path.join(FIX, 'minimal', 'dataset.json'), '--out', out, '--check'], { encoding: 'utf8', cwd: ROOT });
    t.ok('--check passes on a fresh workbook', chk().status === 0);
    fs.appendFileSync(path.join(out, 'workbook.xlsx'), 'x');
    const c = chk();
    t.ok('--check fails on a hand-edited workbook ("STALE: workbook.xlsx")', c.status === 1 && /STALE: workbook\.xlsx/.test(c.stderr), c.stderr);
  }

  // ---------------------------------------------------------------- turned off: no workbook (Absolute, Dark Nights)
  {
    const p = minimalWith('wb-off', { deliverables: { workbook: false } });
    const out = tmpdir('wb-off-out');
    const r = build(p, { out });
    t.ok('a tracker with workbooks turned off builds', r.status === 0, r.stderr);
    t.ok('…without a workbook: none written, and the build says so', !fs.existsSync(path.join(out, 'workbook.xlsx')) &&
         /no workbook \(deliverables\.workbook is false\)$/m.test(r.stdout) && fs.existsSync(path.join(out, 'data.js')), r.stdout);
    const chk = () => spawnSync('python3', [BUILD, p, '--out', out, '--check'], { encoding: 'utf8', cwd: ROOT });
    t.ok('…and --check passes without one', chk().status === 0);
    fs.copyFileSync(file, path.join(out, 'workbook.xlsx'));             // e.g. the template's, copied in with the shell
    const c = chk();
    t.ok('a workbook left in a tracker that turned them off fails --check ("should not exist")', c.status === 1 &&
         /workbook\.xlsx \(deliverables\.workbook is false: it should not exist\)/.test(c.stderr), c.stderr);
    const r2 = build(p, { out });
    t.ok('…and the next build removes it', r2.status === 0 && !fs.existsSync(path.join(out, 'workbook.xlsx')) && /removed workbook\.xlsx/.test(r2.stdout), r2.stdout);
    const on = build(minimalWith('wb-on', { deliverables: { workbook: true } }), { label: 'wb-on-out' });
    t.ok('"workbook": true is the same as leaving it out', on.status === 0 && fs.existsSync(path.join(on.out, 'workbook.xlsx')));
    for (const [what, v] of [['a string', { workbook: 'no' }], ['an unknown deliverable', { pdf: true }], ['a list', []]]) {
      const x = build(minimalWith('wb-bad', { deliverables: v }), { label: 'wb-bad-out' });
      t.ok('deliverables with ' + what + ' fails the build', x.status === 1 && /deliverables must be an object of on\/off switches: workbook/.test(x.stderr), x.stderr);
    }
  }

  // ---------------------------------------------------------------- session-only: a real spreadsheet library opens it
  const py = spawnSync('python3', ['-c', 'import openpyxl'], { encoding: 'utf8' });
  if (py.status === 0) {
    const r = spawnSync('python3', ['-c', [
      'import json, sys, openpyxl', 'wb = openpyxl.load_workbook(sys.argv[1])',
      'print(json.dumps([[ws.title, ws.freeze_panes, ws.auto_filter.ref, ws.max_row, bool(ws["A1"].font.b)] for ws in wb]))'].join('\n'), file], { encoding: 'utf8' });
    const got = r.status === 0 ? JSON.parse(r.stdout) : r.stderr;
    t.eq('openpyxl opens it: sheet names, frozen panes, filters, row counts and bold headers', got,
         SHEETS.map(n => [n, 'A2', 'A1:' + String.fromCharCode(64 + W.sheets[n].headers.length) + (W.sheets[n].records.length + 1), W.sheets[n].records.length + 1, true]));
  } else {
    t.ok('no openpyxl here (CI): the workbook\'s structure is checked by the reader above', true);
  }
};
