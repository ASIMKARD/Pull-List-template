/* The stitch build: runs on every dataset, derives keys correctly, is
   deterministic, keeps generated files fresh, and protects saved progress. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, FIX, BUILD, build, loadData, readJSON, writeJSON, copyFixture, tmpdir } = require('../lib/helpers');

const DATASETS = {
  root: path.join(ROOT, 'dataset.json'),
  basic: path.join(FIX, 'basic', 'dataset.json'),
  'no-periods': path.join(FIX, 'no-periods', 'dataset.json'),
  mixed: path.join(FIX, 'mixed', 'dataset.json')
};

module.exports = async function (t) {
  const built = {};
  for (const [name, file] of Object.entries(DATASETS)) {
    const b = build(file, { label: name });
    t.ok(name + ': build succeeds', b.status === 0, b.stderr);
    if (b.status !== 0) continue;
    const D = loadData(b.out);
    built[name] = { D, b, src: readJSON(file) };
    const keys = D.issues.map(r => r[0]);
    t.ok(name + ': data.js evaluates with issues', Array.isArray(D.issues) && D.issues.length > 0);
    t.ok(name + ': keys are 13-digit integers', keys.every(k => Number.isSafeInteger(k) && String(k).length === 13));
    t.ok(name + ': keys unique and strictly ascending', keys.every((k, i) => i === 0 || k > keys[i - 1]));
    t.ok(name + ': key prefix is the row era\'s rank',
         D.issues.every((r, i) => Math.floor(r[0] / 1e9) === D.eras[D.issueEra[i]].rank));
    t.ok(name + ': rows sorted by era rank first',
         D.issueEra.every((e, i) => i === 0 || D.eras[e].rank >= D.eras[D.issueEra[i - 1]].rank));
    const alts = D.issues.map(r => r[8]);
    t.ok(name + ': altKeys are 9-digit YYYYMMNNN, unique', alts.every(k => String(k).length === 9) && new Set(alts).size === alts.length);
    t.ok(name + ': parallel arrays align with issues',
         ['ids', 'issueIds', 'issueEra', 'issueMedium', 'issueDuration', 'issueTier', 'issueEvent', 'issueCompleteOnly',
          'issuePresence', 'issueWriters', 'issueArtists'].every(k => D[k].length === D.issues.length));
    t.ok(name + ': ids unique', new Set(D.ids).size === D.ids.length);
    t.ok(name + ': no phantom era (output eras == dataset eras)',
         JSON.stringify(D.eras.map(e => e.id)) === JSON.stringify(built[name].src.eras.map(e => e.id)));
    t.ok(name + ': every era index used by a row exists', D.issueEra.every(e => e >= 0 && e < D.eras.length));
    t.ok(name + ': every row has a medium from the vocabulary', D.issueMedium.every(m => m >= 0 && m < D.media.length));
    t.ok(name + ': every comic is one issue (duration 0 = minutes per issue); other formats carry minutes or -1',
         D.issueDuration.every((x, i) => D.media[D.issueMedium[i]] === 'comic' ? x === 0 : (x === -1 || (Number.isInteger(x) && x >= 0))));
    t.ok(name + ': build id stamped', /^[0-9a-f]{12}$/.test(D.build));
    const sw = fs.readFileSync(path.join(b.out, 'sw.js'), 'utf8');
    t.ok(name + ': sw.js cache name = key + build id', sw.includes("const CACHE = '" + D.franchise.key + '-' + D.build + "'"));
    const man = readJSON(path.join(b.out, 'manifest.json'));
    t.ok(name + ': manifest name and theme come from config',
         man.name === D.franchise.title && man.short_name === D.franchise.wordmark && man.theme_color === D.franchise.theme);
    t.ok(name + ': issue layout keeps verify.py positions (key,title,arc,type,M,core,flags,note,altKey)',
         JSON.stringify(D.issueLayout) === JSON.stringify(['key', 'title', 'arc', 'type', 'mandatory', 'core', 'flags', 'note', 'altKey']));

    // determinism: a second build of the same input is byte-identical
    const b2 = build(file, { label: name + '-again' });
    const same = ['data.js', 'sw.js', 'manifest.json'].every(f =>
      fs.readFileSync(path.join(b.out, f), 'utf8') === fs.readFileSync(path.join(b2.out, f), 'utf8'));
    t.ok(name + ': repeated builds are byte-identical', same);
  }

  // fixture-specific expectations
  const B = built.basic && built.basic.D;
  if (B) {
    t.ok('basic: era ranks are 5000 + 10n', B.eras.every((e, i) => e.rank === 5000 + 10 * i));
    t.ok('basic: 61 rows stitched from 5 era files + 4 placed event chapters', B.issues.length === 61);
    t.ok('basic: every row sits in a period band', B.issuePeriod.length === B.issues.length &&
         B.issuePeriod.every(p => p >= 0 && p < B.periods.length));
    t.ok('basic: periods list their eras in order',
         JSON.stringify(B.periods.map(p => p.eras)) === JSON.stringify([[0, 1], [2, 3, 4]]));
    const i = B.issueIds.indexOf('vela-year-zero-1984-1');
    t.ok('basic: flashback placed by sortDate (key month 1980-01)', Math.floor(B.issues[i][0] / 1000) % 1e6 === 198001);
    t.ok('basic: flashback altKey follows its cover date (1984-05)', Math.floor(B.issues[i][8] / 1000) === 198405);
    t.ok('basic: flashback reads first in its era', B.issueEra.indexOf(B.issueEra[i]) === i);
    t.ok('basic: altKey order is publication order (cover months non-decreasing)',
         B.issues.slice().sort((a, b) => a[8] - b[8]).every((r, j, s) => j === 0 || Math.floor(r[8] / 1000) >= Math.floor(s[j - 1][8] / 1000)));
    t.ok('basic: counts carry gap notes and renumbers', B.counts.gapnotes === 1 && B.counts.renumbers === 1);
    t.ok('basic: inert rows never count (total excludes them)', B.counts.completeTotal === 59);
    const np = built['no-periods'] && built['no-periods'].D;
    if (np) {
      t.ok('no-periods: no period bands emitted', np.periods.length === 0 && np.issuePeriod.length === 0);
      t.ok('no-periods: same rows as basic', JSON.stringify(np.ids) === JSON.stringify(B.ids));
    }
  }

  // committed root outputs are fresh
  const chk = spawnSync('python3', [BUILD, '--check'], { encoding: 'utf8', cwd: ROOT });
  t.ok('root: committed data.js, sw.js, manifest.json are fresh (--check)', chk.status === 0, chk.stderr);

  // --check catches a stale file
  const stale = tmpdir('stale');
  build(DATASETS.root, { out: stale });
  fs.appendFileSync(path.join(stale, 'data.js'), '// hand edit\n');
  const chk2 = spawnSync('python3', [BUILD, DATASETS.root, '--out', stale, '--check'], { encoding: 'utf8', cwd: ROOT });
  t.ok('--check fails on a hand-edited data.js', chk2.status === 1 && /STALE: data\.js/.test(chk2.stderr), chk2.stderr);

  // id stability: removing an id orphans saved progress
  {
    const dir = copyFixture('broken/_valid', 'idstable');
    const out = tmpdir('idstable-out');
    t.ok('id stability: first build succeeds', build(path.join(dir, 'dataset.json'), { out }).status === 0);
    const ds = readJSON(path.join(dir, 'dataset.json'));
    ds.rows.pop();
    writeJSON(path.join(dir, 'dataset.json'), ds);
    const gone = build(path.join(dir, 'dataset.json'), { out });
    t.ok('id stability: a removed id fails the next build', gone.status === 1 && /ids removed since the last build/.test(gone.stderr), gone.stderr);
    t.ok('id stability: the message names the id', /probe-1990-4/.test(gone.stderr));
    ds.retiredIds = ['probe-1990-4'];
    writeJSON(path.join(dir, 'dataset.json'), ds);
    t.ok('id stability: listing it in retiredIds lets the build pass', build(path.join(dir, 'dataset.json'), { out }).status === 0);
  }

  // 64 eras, no strands: no palette cap (defect 12), universal strand (defect 6)
  {
    const dir = tmpdir('stress');
    const eras = [], rows = [], arcs = [];
    for (let e = 0; e < 64; e++) {
      eras.push({ id: 'era-' + e, name: 'Era ' + e, rank: 5000 + 10 * e });
      arcs.push({ id: 'arc-' + e, name: 'Arc ' + e, era: 'era-' + e, type: 'MAIN', mo: 'M', tier: 'All',
                  credits: { writers: ['Avery Quill'], artists: ['Cass Delune'] } });
      rows.push({ issueId: 'stress-1990-' + (e + 1), series: 'Stress', vol: '1990', num: String(e + 1),
                  title: 'Stress (1990) #' + (e + 1), era: 'era-' + e, arc: 'arc-' + e,
                  date: { cover: (1990 + Math.floor(e / 12)) + '-' + String(e % 12 + 1).padStart(2, '0'), source: 'stress' } });
    }
    eras[0].name = 'Era <b>&"\'zero';
    writeJSON(path.join(dir, 'dataset.json'), {
      schemaVersion: 1, franchise: { key: 'stress', wordmark: 'Stress', title: 'Stress', strapline: '', span: '', theme: '#000000' },
      eras, strands: [], types: ['MAIN'], tiers: ['All'], media: ['comic'], arcs, rows });
    const b = build(path.join(dir, 'dataset.json'), { label: 'stress-out' });
    t.ok('64-era dataset builds (no era cap)', b.status === 0, b.stderr);
    if (b.status === 0) {
      const D = loadData(b.out);
      t.ok('64-era dataset keeps all 64 eras', D.eras.length === 64 && D.eraCounts.length === 64);
      t.ok('empty strand list becomes one universal strand', D.strands.length === 1 && D.arcs.every(a => a.s.length === 1));
      t.ok('universal strand is reported as a warning', /universal strand/.test(b.stderr));
      module.exports.stressDir = b.out;
    }
  }
};
