/* The stitch build: runs on every dataset, derives keys correctly, is
   deterministic, keeps generated files fresh, and protects saved progress. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, FIX, BUILD, build, loadData, readJSON, writeJSON, copyFixture, tmpdir } = require('../lib/helpers');
const C = require('../lib/colour');

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
      eraHues(t, D, '64 eras');
    }
  }

  // era colours (session 7): a tracker's own, drawn exactly as given (John, 12 Oct); Pull derives the rest (John, 13 Oct)
  if (built.basic) {
    const { D, b } = built.basic;
    const own = D.eras.filter(e => e.colour);
    t.eq('basic: the two eras with a colour carry it, as given (Foundations and Claremont, the reference tracker\'s)',
         own.map(e => [e.id, e.colour.hex]), [['dawn', '#A6791E'], ['storm', '#A6303C']]);
    t.ok('…the others carry none', D.eras.filter(e => !e.colour).length === 3);
    t.eq('…their OKLCH numbers come back to the same colour, and the strip to the reference\'s shade, each channel 25 darker',
         own.map(e => [C.rgbHex(C.oklchRgb(...e.colour.tab)), C.rgbHex(C.oklchRgb(...e.colour.strip))]), [['#A6791E', '#8D6005'], ['#A6303C', '#8D1723']]);
    t.eq('…with white text\'s ratio and the 85 % years\' on each, as measured here',
         own.map(e => [e.colour.white, e.colour.years]),
         own.map(e => { const rgb = C.hexRgb(e.colour.hex); return [C.contrast(C.WHITE, rgb), C.contrast(C.over(C.WHITE, 0.85, rgb), rgb)].map(x => Math.round(x * 1000) / 1000); }));
    t.ok('the colour under 4.5:1 warns, never fails: era dawn, 3.91:1 and 3.29:1, with a passing shade as a hint',
         /era dawn: white text on its colour #A6791E is 3\.91:1 \(the years at 85 %: 3\.29:1\), under 4\.5:1 \(WCAG AA\)\. Pull draws it as given \(John, 12 Oct\)\. The nearest shade of its hue where both pass: #[0-9A-F]{6}/.test(b.stderr), b.stderr);
    const hint = (b.stderr.match(/both pass: (#[0-9A-F]{6})/) || [])[1];
    t.ok('…and the hint does pass (white and the 85 % years at 4.5:1 or more): ' + hint,
         !!hint && C.contrast(C.WHITE, C.hexRgb(hint)) >= 4.5 && C.contrast(C.over(C.WHITE, 0.85, C.hexRgb(hint)), C.hexRgb(hint)) >= 4.5);
    t.ok('…the colour that passes (storm, 6.75:1) doesn\'t warn', !/era storm: white text/.test(b.stderr));
    t.eq('the report counts them', b.report.eraColours, { set: 2, underAA: ['dawn'] });
    eraHues(t, D, 'basic');
    const bad = copyFixture('basic', 'bad-colour'), ds = readJSON(path.join(bad, 'dataset.json'));
    for (const v of ['#A6791', 'red', '#GG0000', 'A6791E', 7]) {
      ds.eras[1].colour = v;
      writeJSON(path.join(bad, 'dataset.json'), ds);
      const r = build(path.join(bad, 'dataset.json'), { label: 'bad-colour' });
      t.ok('a malformed colour fails the build: ' + JSON.stringify(v), r.status === 1 && /era rising: colour must be #RRGGBB/.test(r.stderr), r.stderr.split('\n')[0]);
    }
  }

  // Pull's derived chroma at every hue, from the build itself (John, 13 Oct): oklch(.48 C h), C the gamut's edge, .08 to .14
  {
    const r = spawnSync('python3', [BUILD, '--era-solid-sweep', '0.01'], { encoding: 'utf8', cwd: ROOT });
    const sweep = JSON.parse(r.stdout || '{"c":[]}'), L = sweep.l, LS = 0.40, k = LS / L;
    const bad = { range: [], gamut: [], highest: [], white: [], years: [], stripGamut: [], stripWhite: [], stripYears: [] };
    let worst = { white: 99, years: 99, stripWhite: 99, stripYears: 99 };
    sweep.c.forEach((c, i) => {
      const h = i * sweep.step, at = h.toFixed(2) + '°';
      if (!(c >= 0.08 && c <= 0.14)) bad.range.push(at);
      if (!C.inGamut(L, c, h)) bad.gamut.push(at);
      if (c < 0.14 && C.inGamut(L, c + 1e-4, h)) bad.highest.push(at);      // under the cap, a hair more must leave the gamut
      const rgb = C.oklchRgb(L, c, h), w = C.contrast(C.WHITE, rgb), y = C.contrast(C.over(C.WHITE, 0.85, rgb), rgb);
      if (w < 4.5) bad.white.push(at);
      if (y < 4.5) bad.years.push(at);
      if (!C.inGamut(LS, c * k, h)) bad.stripGamut.push(at);
      const srgb = C.oklchRgb(LS, c * k, h), sw = C.contrast(C.WHITE, srgb), sy = C.contrast(C.over(C.WHITE, 0.85, srgb), srgb);
      if (sw < 4.5) bad.stripWhite.push(at);
      if (sy < 4.5) bad.stripYears.push(at);
      worst = { white: Math.min(worst.white, w), years: Math.min(worst.years, y), stripWhite: Math.min(worst.stripWhite, sw), stripYears: Math.min(worst.stripYears, sy) };
    });
    t.ok('the build sweeps all 36,000 hues (every 0.01°) at Pull\'s lightness, .48 from styles.css', sweep.c.length === 36000 && L === 0.48, r.stderr);
    t.eq('…every derived chroma is between .08 and .14', bad.range.slice(0, 5), []);
    t.eq('…and inside the sRGB gamut', bad.gamut.slice(0, 5), []);
    t.eq('…and the highest the gamut allows under the cap (a hair more leaves it)', bad.highest.slice(0, 5), []);
    t.eq('…white text on it clears 4.5:1 at every hue (worst ' + worst.white.toFixed(2) + ':1)', bad.white.slice(0, 5), []);
    t.eq('…and the 85 % years (worst ' + worst.years.toFixed(2) + ':1)', bad.years.slice(0, 5), []);
    t.eq('the strip (L .40, chroma × 5/6) is inside the gamut at every hue', bad.stripGamut.slice(0, 5), []);
    t.eq('…with white text (worst ' + worst.stripWhite.toFixed(2) + ':1) and the 85 % years (worst ' + worst.stripYears.toFixed(2) + ':1) at 4.5:1 or more',
         bad.stripWhite.concat(bad.stripYears).slice(0, 5), []);
    t.ok('…and the cap and the floor both bite: some hues sit at .14, some below, none under .08',
         sweep.c.some(c => c === 0.14) && sweep.c.some(c => c < 0.14) && Math.min(...sweep.c) >= 0.08);
  }
  // the build run on its own (tools/ without the app shell, as the verify gate's tests run it): it still builds
  {
    const dir = tmpdir('tools-only');
    fs.mkdirSync(path.join(dir, 'tools', 'templates'), { recursive: true });
    for (const f of ['build.py', 'build_workbook.py']) fs.copyFileSync(path.join(ROOT, 'tools', f), path.join(dir, 'tools', f));
    fs.copyFileSync(path.join(ROOT, 'tools', 'templates', 'sw.js'), path.join(dir, 'tools', 'templates', 'sw.js'));
    fs.cpSync(path.join(ROOT, 'icons'), path.join(dir, 'icons'), { recursive: true });      // the icons, but no app shell
    const out = tmpdir('tools-only-out');
    const r = spawnSync('python3', [path.join(dir, 'tools', 'build.py'), path.join(FIX, 'minimal', 'dataset.json'), '--out', out], { encoding: 'utf8', cwd: dir });
    const D = r.status === 0 ? loadData(out) : null;
    t.ok('without a styles.css beside tools/, the build still builds and says Pull\'s derived colours fall back to the stylesheet\'s .08',
         r.status === 0 && /no styles\.css beside tools\/: Pull's derived era colours are left to the stylesheet's fallback chroma \(\.08\)/.test(r.stderr) &&
         D.eras.every(e => e.solid === undefined) && D.solidMono === null, r.stderr.split('\n').slice(-3).join(' | '));
  }
};

/* Each era's derived chroma is the build's own rule at the hue styles.css gives
   that era (--era-h0 + index × --era-step), and "One colour" at Pull's one hue. */
function eraHues(t, D, label) {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tok = name => {
    let v = null;
    for (const sel of [':root', ':root[data-skin="pull"]']) {
      const blk = css.split('}').find(x => x.split('{')[0].trim() === sel);
      const m = blk && new RegExp(name + '\\s*:\\s*([^;]+);').exec(blk);
      if (m) v = m[1].trim();
    }
    return parseFloat(v);
  };
  const L = tok('--era-solid-l'), h0 = tok('--era-h0'), step = tok('--era-step'), mono = tok('--era-mono-h');
  const rule = h => Math.min(Math.max(Math.floor(C.maxChroma(L, h) * 1e5) / 1e5, 0.08), 0.14);
  t.eq(label + ': each era\'s derived chroma is the rule at its own hue (' + D.eras.length + ' eras)',
       D.eras.map((e, i) => Math.abs(e.solid - rule((h0 + i * step) % 360)) <= 1e-5).filter(x => !x).length, 0);
  t.ok(label + ': and "One colour" has the rule at Pull\'s one hue (' + mono + '°): ' + D.solidMono, Math.abs(D.solidMono - rule(mono % 360)) <= 1e-5);
}
