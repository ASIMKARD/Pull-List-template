/* The stitch build: runs on every dataset, derives keys correctly, is
   deterministic, keeps generated files fresh, and protects saved progress. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, FIX, BUILD, build, loadData, readJSON, writeJSON, copyFixture, tmpdir, pullRef, basic } = require('../lib/helpers');
const C = require('../lib/colour');
const shade = rgb => rgb.map(v => Math.max(v - 25, 0));      // the reference tracker's strip: each channel 25 darker


const DATASETS = {
  root: path.join(ROOT, 'dataset.json'),
  basic: path.join(FIX, 'basic', 'dataset.json'),
  'no-periods': path.join(FIX, 'no-periods', 'dataset.json'),
  mixed: path.join(FIX, 'mixed', 'dataset.json')
};

module.exports = async function (t) {
  const PAL = JSON.parse(spawnSync('python3', [BUILD, '--pull-palette'], { encoding: 'utf8', cwd: ROOT }).stdout || '[]');   // Pull's default palette, from the build
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

  // era colours (session 7): a tracker's own, drawn exactly as given (John, 12 Oct); else Pull's default palette (John, 13 Oct)
  if (built.basic) {
    const { D, b } = built.basic;
    const own = D.eras.filter(e => e.colour);
    t.eq('basic: the two eras with a colour carry it, as given (Foundations and Claremont, the reference tracker\'s)',
         own.map(e => [e.id, e.colour.hex]), [['dawn', '#A6791E'], ['storm', '#A6303C']]);
    t.ok('…the others carry none', D.eras.filter(e => !e.colour).length === 3);
    t.eq('…their OKLCH numbers come back to the same colour, and the strip to the reference\'s shade, each channel 25 darker',
         own.map(e => [C.rgbHex(C.oklchRgb(...e.colour.tab)), C.rgbHex(C.oklchRgb(...e.colour.strip))]), [['#A6791E', '#8D6005'], ['#A6303C', '#8D1723']]);
    t.eq('…with the ratios of white text, the 85 % years and white text on the strip, as measured here',
         own.map(e => [e.colour.white, e.colour.years, e.colour.stripWhite]),
         own.map(e => { const rgb = C.hexRgb(e.colour.hex); return [C.contrast(C.WHITE, rgb), C.contrast(C.over(C.WHITE, C.YEARS, rgb), rgb), C.contrast(C.WHITE, shade(rgb))].map(x => Math.round(x * 1000) / 1000); }));
    const CARDS = Object.fromEntries([...(fs.readFileSync(path.join(ROOT, 'tools', 'build.py'), 'utf8').match(/^PULL_CARDS = \{([^}]*)\}/m) || ['', ''])[1]
      .matchAll(/'(\w+)': \((\d+), (\d+), (\d+)\)/g)].map(m => [m[1], [+m[2], +m[3], +m[4]]]));
    const onCard = h => Object.fromEntries(Object.entries(CARDS).map(([k, card]) => [k, Math.round(C.contrast(C.hexRgb(h), card) * 1000) / 1000]));
    const lowest = h => Math.min(...Object.values(onCard(h)));
    t.ok('the colour under 4.5:1 warns, never fails: era dawn, 3.91:1 and 3.29:1 (its strip 5.51:1; as the review era tag on Pull\'s card ' +
         lowest('#A6791E').toFixed(2) + ':1 at the lowest), with a passing shade as a hint',
         new RegExp('era dawn: white text on its colour #A6791E is 3\\.91:1 \\(the years at 85 %: 3\\.29:1; on its strip #8D6005: 5\\.51:1; as text on Pull\'s card, ' +
           'the review era tag: ' + lowest('#A6791E').toFixed(2).replace('.', '\\.') + ':1 at the lowest\\), under 4\\.5:1 \\(WCAG AA\\)\\. Pull draws it as given \\(John, 12 and 29 Oct\\)\\. ' +
           'The nearest shade of its hue where all pass: #[0-9A-F]{6}').test(b.stderr), b.stderr);
    const hint = (b.stderr.match(/all pass: (#[0-9A-F]{6})/) || [])[1], hr = hint ? C.hexRgb(hint) : null;
    t.ok('…and the hint does pass (white, the 85 % years, the strip, and as text on Pull\'s card on every paper, at 4.5:1 or more): ' + hint,
         !!hint && C.contrast(C.WHITE, hr) >= 4.5 && C.contrast(C.over(C.WHITE, C.YEARS, hr), hr) >= 4.5 && C.contrast(C.WHITE, shade(hr)) >= 4.5 && lowest(hint) >= 4.5);
    t.eq('…and each own colour reports how it reads as text on Pull\'s card on every paper, as measured here (the review era tag, drawn as given; John, 29 Oct)',
         own.map(e => e.colour.onCard), own.map(e => onCard(e.colour.hex)));
    {   // a colour whose white text passes but which reads under 4.5:1 as the review era tag still warns, and its hint passes as the tag
      const dir = copyFixture('basic', 'tag-only'), ds = readJSON(path.join(dir, 'dataset.json'));
      ds.eras.find(e => e.id === 'rising').colour = '#546F66';
      writeJSON(path.join(dir, 'dataset.json'), ds);
      const tb = build(path.join(dir, 'dataset.json'), { label: 'tag-only' }), m = tb.stderr.match(/era rising: [^\n]*all pass: (#[0-9A-F]{6})/);
      t.ok('a colour that passes white text but reads under 4.5:1 as the review era tag warns too: #546F66, ' + lowest('#546F66').toFixed(2) + ':1 at the lowest',
           tb.status === 0 && !!m && m[0].includes('the review era tag: ' + lowest('#546F66').toFixed(2) + ':1 at the lowest'), tb.stderr.slice(0, 300));
      t.ok('…and its hint passes as the tag on every paper: ' + (m && m[1]), !!m && lowest(m[1]) >= 4.5);
    }
    t.ok('…the colour that passes (storm, 6.75:1) doesn\'t warn', !/era storm: white text/.test(b.stderr));
    t.eq('the report counts them', b.report.eraColours, { set: 2, underAA: ['dawn'] });
    t.eq('…and Pull draws them untouched, never nudged: dawn and storm in their own colours, the other eras in the palette\'s by index',
         D.eras.map(e => e.pull.hex), ['#A6791E', PAL[1].hex, '#A6303C', PAL[3].hex, PAL[4].hex]);
    const bad = copyFixture('basic', 'bad-colour'), ds = readJSON(path.join(bad, 'dataset.json'));
    for (const v of ['#A6791', 'red', '#GG0000', 'A6791E', 7]) {
      ds.eras[1].colour = v;
      writeJSON(path.join(bad, 'dataset.json'), ds);
      const r = build(path.join(bad, 'dataset.json'), { label: 'bad-colour' });
      t.ok('a malformed colour fails the build: ' + JSON.stringify(v), r.status === 1 && /era rising: colour must be #RRGGBB/.test(r.stderr), r.stderr.split('\n')[0]);
    }
  }

  // Pull's arc-type colours (session 8; John, 24 and 28 Oct): each stripe the reference tracker's colour exactly, each
  // badge darkened only as far as its text must be to pass on its own tint, on Pull's card on every paper
  {
    const XM = { MAIN: '#2C6E8C', 'SPIN-OFF': '#7B3F94', SOLO: '#1F7A5C', MINI: '#C0622A', EVENT: '#A6303C' };   // X-Men index.html TYPE_COLORS (663fe46); '#666' for any other
    const TD = loadData(pullRef().out), TC = TD.typeColours || [];
    const CARDS = [...(fs.readFileSync(path.join(ROOT, 'tools', 'build.py'), 'utf8').match(/^PULL_CARDS = \{([^}]*)\}/m) || ['', ''])[1]
      .matchAll(/\((\d+), (\d+), (\d+)\)/g)].map(m => [+m[1], +m[2], +m[3]]);
    const badge = h => { const rgb = C.hexRgb(h); return Math.min(...CARDS.map(card => C.contrast(rgb, C.over(rgb, 34 / 255, card)))); };
    t.eq('every arc type has a stripe in the reference tracker\'s colour for its name, exactly, and a badge (' + TD.types.join(', ') + ')',
         TC.map(c => c.hex), TD.types.map(n => XM[n] || '#666666'));
    t.ok('…the build knows Pull\'s card on all seven papers', CARDS.length === 7);
    t.eq('every badge passes 4.5:1 on its own tint (at 0x22) on Pull\'s card on every paper, as the build reports', TC.filter(c => badge(c.badgeHex) < 4.5 ||
         Math.abs(badge(c.badgeHex) - c.ratio) > 0.0005).map(c => c.badgeHex + ' ' + badge(c.badgeHex).toFixed(3)), []);
    t.eq('…the ones that pass as they are are untouched: SPIN-OFF and EVENT', TC.filter(c => !c.nudged).map(c => TD.types[TC.indexOf(c)]), ['SPIN-OFF', 'EVENT']);
    const STEP = 0.0005, cand = (src, k) => { const [L, Cs, H] = C.rgbOklch(C.hexRgb(src)), x = L - k * STEP; return C.rgbHex(C.oklchRgb(x, C.inGamut(x, Cs, H) ? Cs : C.maxChroma(x, H), H)); };
    t.eq('…and each darkening is the least that passes: one step (0.0005 of lightness) less still fails', TC.filter(c => c.nudged).filter(c =>
         cand(c.hex, c.nudged.steps) !== c.badgeHex || badge(cand(c.hex, c.nudged.steps - 1)) >= 4.5).map(c => c.hex), []);
    t.eq('…and every stripe and badge is OKLCH numbers that come back to its colour', TC.filter(c => C.rgbHex(C.oklchRgb(...c.stripe)) !== c.hex ||
         C.rgbHex(C.oklchRgb(...c.badge)) !== c.badgeHex).map(c => c.hex), []);
  }

  // an era's colour as text on Pull's card (session 8, step 6a: the x frame's review era tag, drawn as given; John, 29 Oct):
  // Pull's default palette passes as it is, on every paper, so only a tracker's own colour can fall short (and warns, above)
  {
    const CARDS = [...(fs.readFileSync(path.join(ROOT, 'tools', 'build.py'), 'utf8').match(/^PULL_CARDS = \{([^}]*)\}/m) || ['', ''])[1]
      .matchAll(/\((\d+), (\d+), (\d+)\)/g)].map(m => [+m[1], +m[2], +m[3]]);
    const lowest = h => Math.min(...CARDS.map(card => C.contrast(C.hexRgb(h), card)));
    const all = [];
    for (const out of [basic().out, pullRef().out]) { const XD = loadData(out); XD.eras.forEach(e => { if (!e.colour) all.push(e.pull.hex); }); all.push(XD.pullMono.hex); }
    t.eq('every palette colour Pull draws an era in passes 4.5:1 as text on its card on every paper (' + [...new Set(all)].length + ')',
         [...new Set(all)].filter(h => lowest(h) < 4.5).map(h => h + ' ' + lowest(h).toFixed(2)), []);
    t.eq('…and the build gives no shade of its own for the tag: the era is drawn in the one colour', [basic().out, pullRef().out].flatMap(o => loadData(o).eras)
         .filter(e => 'text' in e.pull || 'textHex' in e.pull).map(e => e.id), []);
  }

  // Pull's default palette (John, 13 Oct): the reference tracker's eleven era colours, each nudged only as far as it must
  {
    const REF = readJSON(path.join(ROOT, 'test', 'layout', 'ref', 'x-men.json'));
    t.eq('the palette is the reference tracker\'s eleven era colours, in its order, as the recorded measurement holds them (X-Men ' + REF.commit.slice(0, 7) + ')',
         PAL.map(p => p.source), REF.eras.map(e => e.tab));
    t.eq('…and the reference\'s strips are its tabs with each channel 25 darker, as Pull draws them', REF.eras.map(e => e.strip), REF.eras.map(e => C.rgbHex(shade(C.hexRgb(e.tab)))));
    const ratios = h => { const rgb = C.hexRgb(h); return [C.contrast(C.WHITE, rgb), C.contrast(C.over(C.WHITE, C.YEARS, rgb), rgb), C.contrast(C.WHITE, shade(rgb))]; };
    t.eq('every default colour passes: white text, the 85 % years (blended at 217/255) and white text on its strip, each at 4.5:1 or more',
         PAL.filter(p => ratios(p.hex).some(r => r < 4.5)).map(p => p.hex + ' ' + ratios(p.hex).map(r => r.toFixed(2)).join('/')), []);
    t.eq('…as the build reports them', PAL.map(p => [p.white, p.years, p.strip]), PAL.map(p => ratios(p.hex).map(r => Math.round(r * 1000) / 1000)));
    t.eq('the reference colours that already pass are untouched', PAL.filter(p => !p.nudged).map(p => [p.source, p.hex]), PAL.filter(p => !p.nudged).map(p => [p.source, p.source]));
    t.eq('…and the five that fail are the ones nudged: Foundations, Utopia, Bendis to IvX, ResurrXion, Krakoa', PAL.filter(p => p.nudged).map(p => p.source),
         ['#A6791E', '#1F7A5C', '#B08A1F', '#C0622A', '#C21E6D']);
    t.eq('…each of those failed to begin with', PAL.filter(p => p.nudged && !ratios(p.source).some(r => r < 4.5)).map(p => p.source), []);
    const STEP = 0.0005, cands = (src, k) => { const [L, Cs, H] = C.rgbOklch(C.hexRgb(src)), x = L - k * STEP, c = C.inGamut(x, Cs, H) ? Cs : C.maxChroma(x, H); return { rgb: C.oklchRgb(x, c, H), c, edge: c < Cs }; };
    const minimal = [], kept = [], edge = [];
    for (const p of PAL.filter(q => q.nudged)) {
      const [L0, C0, H0] = C.rgbOklch(C.hexRgb(p.source)), [L1, C1, H1] = C.rgbOklch(C.hexRgb(p.hex)), k = p.nudged.steps;
      if (C.rgbHex(cands(p.source, k).rgb) !== p.hex) minimal.push(p.source + ': step ' + k + ' is not ' + p.hex);
      if (!ratios(C.rgbHex(cands(p.source, k - 1).rgb)).some(r => r < 4.5)) minimal.push(p.source + ': one step less (' + C.rgbHex(cands(p.source, k - 1).rgb) + ') already passes');
      if (!(L1 < L0) || Math.abs(((H1 - H0) % 360 + 540) % 360 - 180) > 1) kept.push(p.source + ': L ' + L0.toFixed(4) + '→' + L1.toFixed(4) + ', hue ' + H0.toFixed(1) + '→' + H1.toFixed(1));
      if (p.nudged.edge) { if (!(p.nudged.c < C0) || Math.abs(p.nudged.c - C.maxChroma(p.nudged.l, H0)) > 1e-4) edge.push(p.source + ': chroma ' + p.nudged.c + ' is not the gamut\'s edge'); }
      else if (Math.abs(C1 - C0) > 0.002) kept.push(p.source + ': chroma ' + C0.toFixed(4) + '→' + C1.toFixed(4));
    }
    t.eq('each nudge is the least that passes: one step (0.0005 of lightness) less still fails', minimal, []);
    t.eq('…darker, its hue kept (within 1°, the 8-bit rounding) and its chroma kept (within .002), unless the gamut runs out first', kept, []);
    t.eq('…where it does (the two yellows, Foundations and Bendis to IvX), the chroma follows the gamut\'s edge, so the colour stays inside sRGB',
         edge.concat(PAL.filter(p => p.nudged && p.nudged.edge).map(p => p.source).join() === '#A6791E,#B08A1F' ? [] : ['the edge was reached by ' + PAL.filter(p => p.nudged && p.nudged.edge).map(p => p.source).join()]), []);
    // the palette cycles: era i takes colour i mod 11, past eleven eras (52)
    const dir = tmpdir('palette52'), eras = [], arcs = [], rows = [];
    for (let e = 0; e < 52; e++) {
      eras.push({ id: 'p' + e, name: 'Era ' + e, rank: 5000 + 10 * e });
      arcs.push({ id: 'a' + e, name: 'Arc ' + e, era: 'p' + e, type: 'MAIN', mo: 'M', tier: 'All', credits: { writers: ['Avery Quill'], artists: ['Cass Delune'] } });
      rows.push({ issueId: 'pal-1990-' + (e + 1), series: 'Pal', vol: '1990', num: String(e + 1), title: 'Pal (1990) #' + (e + 1), era: 'p' + e, arc: 'a' + e,
                  date: { cover: (1990 + Math.floor(e / 12)) + '-' + String(e % 12 + 1).padStart(2, '0'), source: 'generated' } });
    }
    eras[20].colour = '#123456';                                         // one tracker colour among them, drawn as given
    writeJSON(path.join(dir, 'dataset.json'), { schemaVersion: 1, franchise: { key: 'pal', wordmark: 'Pal', title: 'Pal', strapline: '', span: '', theme: '#000000' },
      eras, strands: [], types: ['MAIN'], tiers: ['All'], media: ['comic'], arcs, rows });
    const pb = build(path.join(dir, 'dataset.json'), { label: 'palette52-out' });
    const PD = pb.status === 0 ? loadData(pb.out) : { eras: [] };
    t.eq('52 eras: era i is drawn in palette colour i mod 11, round and round (the tracker\'s one colour, era 20, aside)',
         PD.eras.map((e, i) => e.pull.hex), PD.eras.map((e, i) => i === 20 ? '#123456' : PAL[i % 11].hex));
    t.eq('…each as OKLCH numbers that come back to the same colour, and its strip to the reference\'s shade',
         PD.eras.filter(e => C.rgbHex(C.oklchRgb(...e.pull.tab)) !== e.pull.hex || C.rgbHex(C.oklchRgb(...e.pull.strip)) !== C.rgbHex(shade(C.hexRgb(e.pull.hex)))).map(e => e.id), []);
    t.eq('"One colour" draws every era in the palette\'s navy, the reference tracker\'s accent', PD.pullMono && PD.pullMono.hex, PAL[10].hex);
  }
  // "One colour" in the tracker's accent (John, 19 and 24 Oct): franchise.accent, darkened by the palette's rule only as far as
  // white text, the 85 % years and the strip need, its hue kept; the navy without one; a tracker's own era colours untouched
  {
    const passes = rgb => C.contrast(C.WHITE, rgb) >= 4.5 && C.contrast(C.over(C.WHITE, C.YEARS, rgb), rgb) >= 4.5 && C.contrast(C.WHITE, shade(rgb)) >= 4.5;
    const STEP = 0.0005, cand = (src, k) => { const [L, Cs, H] = C.rgbOklch(C.hexRgb(src)), x = L - k * STEP; return C.rgbHex(C.oklchRgb(x, C.inGamut(x, Cs, H) ? Cs : C.maxChroma(x, H), H)); };
    const least = src => { if (passes(C.hexRgb(src))) return src.toUpperCase(); for (let k = 1; k < 4000; k++) if (passes(C.hexRgb(cand(src, k)))) return cand(src, k); return null; };
    const withAccent = (label, accent) => {
      const dir = copyFixture('basic', label), ds = readJSON(path.join(dir, 'dataset.json'));
      if (accent === undefined) delete ds.franchise.accent; else ds.franchise.accent = accent;
      writeJSON(path.join(dir, 'dataset.json'), ds);
      const r = build(path.join(dir, 'dataset.json'), { label: label + '-out' });
      return { r, D: r.status === 0 ? loadData(r.out) : null };
    };
    const none = withAccent('accent-none'), dark = withAccent('accent-dark', '#7A1F2B');
    const light = withAccent('accent-crimson', '#E8123C'), yellow = withAccent('accent-yellow', '#E0A040');
    t.eq('without an accent, "One colour" is the palette\'s navy, and the report says so', [none.D && none.D.pullMono.hex, none.r.report && none.r.report.oneColour],
         [PAL[10].hex, { source: null, hex: PAL[10].hex, nudged: null }]);
    t.eq('a dark accent is drawn as given: #7A1F2B', [dark.D && dark.D.pullMono.hex, dark.r.report && dark.r.report.oneColour.nudged], ['#7A1F2B', null]);
    const hue = h => C.rgbOklch(C.hexRgb(h))[2];
    for (const [name, x, src] of [['a light accent (Absolute\'s crimson)', light, '#E8123C'], ['a yellow one, where the gamut runs out first', yellow, '#E0A040']]) {
      const got = x.D && x.D.pullMono.hex;
      t.ok(name + ' is darkened only as far as it must be: ' + src + ' → ' + got + ', passing, and one step less still fails',
           !!got && got === least(src) && passes(C.hexRgb(got)) && got !== src && x.r.report.oneColour.source === src && x.r.report.oneColour.nudged.steps > 0);
      t.ok('…its hue kept (' + hue(src).toFixed(1) + '° → ' + (got ? hue(got).toFixed(1) : '?') + '°, within the 8-bit rounding)', !!got && Math.abs(hue(got) - hue(src)) < 1.5);
    }
    t.eq('…and an accent never touches a tracker\'s own era colours: dawn and storm drawn as given beside it', light.D && light.D.eras.filter(e => e.colour).map(e => e.pull.hex), ['#A6791E', '#A6303C']);
    t.ok('…nor the tab and strip it draws in: the strip is the reference\'s shade of the drawn colour', !!light.D && C.rgbHex(C.oklchRgb(...light.D.pullMono.strip)) === C.rgbHex(shade(C.hexRgb(light.D.pullMono.hex))));
    for (const bad of ['red', '#12345', '#GGGGGG', 7]) {
      const b = withAccent('accent-bad', bad);
      t.ok('a malformed accent fails the build: ' + JSON.stringify(bad), b.r.status === 1 && /franchise\.accent must be #RRGGBB/.test(b.r.stderr), b.r.stderr.split('\n')[0]);
    }
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
    t.ok('without a styles.css beside tools/, the build still builds, and gives Pull its palette (it needs nothing from the stylesheet)',
         r.status === 0 && D.eras.every((e, i) => e.pull.hex === PAL[i % 11].hex) && D.pullMono.hex === PAL[10].hex, r.stderr.split('\n').slice(-3).join(' | '));
  }
};
