/* The verify gate (V-22): Research-Repo's verify.py, pinned byte for byte in
   tools/ (commit and sha256 in tools/verify.lock), run by tools/verify_gate.py
   on the stitched v3 dataset (adapted by name), plus check_shown, v3's
   equivalent of verify.check_built: the order the app actually shows. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { ROOT, FIX, readJSON, writeJSON, copyFixture, tmpdir } = require('../lib/helpers');

const GATE = path.join(ROOT, 'tools', 'verify_gate.py');
const run = (args, cwd) => spawnSync('python3', [GATE].concat(args), { encoding: 'utf8', cwd: cwd || ROOT });
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const FIXTURES = ['dataset.json', 'test/fixtures/basic/dataset.json', 'test/fixtures/no-periods/dataset.json',
                  'test/fixtures/mixed/dataset.json', 'test/fixtures/minimal/dataset.json'];

module.exports = async function (t) {
  // ---------------------------------------------------------------- the pin
  const lock = readJSON(path.join(ROOT, 'tools', 'verify.lock'));
  t.ok('verify.lock records the source, path, commit and sha256', lock.source === 'ASIMKARD/Research-Repo' && lock.path === 'toolkit/verify.py' &&
       /^[0-9a-f]{40}$/.test(lock.commit) && /^[0-9a-f]{64}$/.test(lock.sha256));
  t.eq('tools/verify.py is the pinned copy, byte for byte (sha256 ' + lock.sha256.slice(0, 12) + ')', sha(path.join(ROOT, 'tools', 'verify.py')), lock.sha256);
  const research = process.env.RESEARCH_REPO || path.join(ROOT, '..', 'Research-Repo');
  const theirs = path.join(research, lock.path);
  if (fs.existsSync(theirs)) {
    const last = spawnSync('git', ['-C', research, 'log', '-1', '--format=%H', '--', lock.path], { encoding: 'utf8' }).stdout.trim();
    t.ok('the local Research-Repo copy has not drifted: same bytes, and its last change to verify.py is the pinned commit (' + lock.commit.slice(0, 7) + ')',
         sha(theirs) === lock.sha256 && last === lock.commit, 'theirs ' + sha(theirs).slice(0, 12) + ' at ' + last.slice(0, 7));
  } else {
    t.ok('no local Research-Repo copy here (CI): the pin stands as recorded at ' + lock.commit.slice(0, 7), true);
  }
  {
    const dir = tmpdir('gate-pin');
    fs.mkdirSync(path.join(dir, 'tools'));
    for (const f of ['build.py', 'verify_gate.py', 'verify.lock']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(dir, 'tools', f));
    fs.writeFileSync(path.join(dir, 'tools', 'verify.py'), fs.readFileSync(path.join(ROOT, 'tools', 'verify.py'), 'utf8') + '\n# a local edit\n');
    const r = spawnSync('python3', [path.join(dir, 'tools', 'verify_gate.py'), path.join(FIX, 'minimal', 'dataset.json')], { encoding: 'utf8', cwd: dir });
    t.ok('an edited verify.py fails the gate ("not the pinned copy")', r.status === 1 && /^FAIL pin: tools\/verify\.py is not the pinned copy/m.test(r.stdout), r.stdout.slice(-300));
  }

  // ---------------------------------------------------------------- every real dataset passes
  for (const f of FIXTURES) {
    const r = run([f]);
    t.ok(f + ': the gate passes (build, verify.py, the order shown)', r.status === 0 && /gate passed$/m.test(r.stdout) && !/^FAIL/m.test(r.stdout), r.stdout.split('\n').filter(l => /^FAIL/.test(l)).slice(0, 3).join(' | ') || r.stderr.slice(-300));
  }

  // ---------------------------------------------------------------- the adapter, read by name
  const out = path.join(tmpdir('gate-adapted'), 'basic.json');
  run([path.join(FIX, 'basic', 'dataset.json'), '--adapted', out]);
  const A = readJSON(out);
  const eraFiles = fs.readdirSync(path.join(FIX, 'basic', 'data', 'eras')).map(n => readJSON(path.join(FIX, 'basic', 'data', 'eras', n)));
  const src = eraFiles.flatMap(f => f.rows.map(r => Object.assign({ era: f.era }, r)));
  t.eq('basic: one adapted row per stitched row (61: 5 era files + 4 placed event chapters)', A.rows.length, 61);
  t.ok('every adapted row carries verify.py\'s fields', A.rows.every(r => ['series', 'vol', 'num', 'title', 'arc', 'flags', 'date_source', 'mandatory', 'core', 'seq'].every(k => k in r)));
  const one = src.find(r => r.num === '3' && !(r.flags || []).length && r.date && r.date.onsale) || src.find(r => r.num === '3');
  const got = A.rows.find(r => r.id === (one.id || one.issueId));
  t.eq('a row\'s fields come across by name (series, vol, num, title, cover, source, arc)', got && [got.series, got.vol, got.num, got.title, got.cover, got.date_source, got.arc],
       [one.series, one.vol, one.num, one.title, one.date.cover, one.date.source, one.arc]);
  {
    // on-sale dates (the basic fixture has none): a copy where every third dated row gets one
    const copy = copyFixture('basic', 'gate-onsale'), rows = [];
    for (const f of fs.readdirSync(path.join(copy, 'data', 'eras'))) {
      const ep = path.join(copy, 'data', 'eras', f), e = readJSON(ep);
      e.rows.forEach((r, i) => { if (i % 3 === 0 && !(r.flags || []).length) r.date.onsale = r.date.cover.slice(0, 7) + '-1' + (i % 9); rows.push(r); });
      writeJSON(ep, e);
    }
    const o = path.join(tmpdir('gate-onsale-out'), 'a.json');
    run([path.join(copy, 'dataset.json'), '--adapted', o]);
    const byId = Object.fromEntries(readJSON(o).rows.map(r => [r.id, r]));
    const dated = rows.filter(r => !(r.flags || []).some(f => f === 'GAPNOTE' || f === 'RENUM'));
    const wrong = dated.filter(r => { const a = byId[r.id || r.issueId]; return !a || a.cover !== r.date.cover || (a.onsale || null) !== (r.date.onsale || null); });
    t.ok('every dated row keeps its own cover and on-sale dates (' + dated.length + ' rows, ' + dated.filter(r => r.date.onsale).length + ' with an on-sale date)',
         wrong.length === 0 && dated.filter(r => r.date.onsale).length >= 10, wrong.slice(0, 3).map(r => r.issueId).join(', '));
  }
  const inert = A.rows.filter(r => r.flags.includes('GAP'));
  t.ok('inert marker rows (gap note, renumbering) carry verify.py\'s GAP marker and no date of their own (' + inert.length + ')',
       inert.length === 2 && inert.every(r => !r.cover && r.num === '' && (r.flags.includes('GAPNOTE') || r.flags.includes('RENUM'))));
  t.ok('arcs carry their era and strands (an arc without strands blanks the app); eras are listed', A.arcs.every(a => a.era && a.strands.length) &&
       A.eras.length === 5 && A.order_basis === 'cover');
  {
    const copy = copyFixture('basic', 'gate-shuffled'), p = path.join(copy, 'dataset.json'), ds = readJSON(p);
    ds.franchise = Object.fromEntries(Object.entries(ds.franchise).reverse());
    for (const f of fs.readdirSync(path.join(copy, 'data', 'eras'))) {
      const ep = path.join(copy, 'data', 'eras', f), e = readJSON(ep);
      e.rows = e.rows.map(r => Object.fromEntries(Object.entries(r).reverse()));
      writeJSON(ep, e);
    }
    writeJSON(p, ds);
    const out2 = path.join(tmpdir('gate-adapted2'), 'b.json');
    run([p, '--adapted', out2]);
    t.ok('field order never changes what verify.py sees (the adapter reads by name)', fs.readFileSync(out2, 'utf8') === fs.readFileSync(out, 'utf8'));
  }

  // ---------------------------------------------------------------- what the gate stops
  for (const name of fs.readdirSync(path.join(FIX, 'gate')).sort()) {
    const expect = fs.readFileSync(path.join(FIX, 'gate', name, 'expect.txt'), 'utf8').trim();
    const r = run([path.join(FIX, 'gate', name, 'dataset.json')]);
    t.ok('gate/' + name + ' is stopped: "' + expect + '"', r.status === 1 && r.stdout.includes('FAIL ' + expect) && /DO NOT SHIP$/m.test(r.stdout),
         r.stdout.split('\n').filter(l => /^FAIL/.test(l)).join(' | '));
  }
  const blocked = run([path.join(FIX, 'gate', 'blocked-series', 'dataset.json')]);
  t.ok('…the blocked series passes the build and verify.check (which sorts by date first): only the order shown catches it',
       !/^FAIL (build|verify):/m.test(blocked.stdout) && /^FAIL shown:/m.test(blocked.stdout));
  const both = run([path.join(FIX, 'gate', 'duplicate-title', 'dataset.json'), path.join(FIX, 'minimal', 'dataset.json')]);
  t.ok('verify.py keeps its findings in module lists; the gate clears them, so one dataset\'s failures never carry into the next',
       both.status === 1 && /minimal\/dataset\.json: \d+ rows, 0 failures/.test(both.stdout), both.stdout.slice(-200));
};
