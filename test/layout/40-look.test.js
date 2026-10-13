/* The Look, measured in real Chromium (session 4, step 4). CLAUDE.md: "Design
   dark skins against the surface … Measure contrast; don't eyeball."
   - Contrast: every skin × every paper swatch, text pairs at WCAG AA (4.5:1)
     and control outlines at the non-text ratio (3:1).
   - Era washes: eras 0–63 in every skin, split and one-colour: era text and
     the banner's own text clear AA on the wash; washes are pale; neighbours
     differ.
   - Reachability (V-5): every control on every tab is displayed, at least
     24 × 24 px (WCAG 2.5.8; creator names inside a line of credits are the
     inline exception), in the viewport once scrolled to, and the element
     actually hit at its centre, in every skin, at 320 and 390 px, with the
     largest text and buttons too.
   - Sizes: the title follows text size (T-45); button size gives a 26 px mark
     at compact (T-56) and 44 px glyph buttons at large (T-57). */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, FIX, basic, stress, readJSON, writeJSON, build, loadData, tmpdir, copyFixture } = require('../lib/helpers');
const C = require('../lib/colour');
const { serve, open, openAll, openSettings, reachability, closeBrowser } = require('./lib');

const SKINS = ['signature', 'paper', 'newsprint', 'pull', 'night'];     // the basic fixture's demo signature skin first
const PAPERS = ['default', 'warm', 'grey', 'rose', 'mint', 'sky', 'lilac'];
const LARGEST = { textSize: 'l', tap: 'large', density: 'roomy', dys: true };
const seed = (key, s) => ({ [key + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s)) });

/* In-page helpers: any CSS colour to sRGB through a canvas, the effective
   background behind an element, and the WCAG contrast ratio. */
const PAGE_LIB = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  window.__rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  window.__bg = el => {
    for (let e = el; e; e = e.parentElement) { const c = window.__rgb(getComputedStyle(e).backgroundColor); if (c[3] > 0) return c; }
    return [255, 255, 255, 255];
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  window.__lum = lum;
  window.__ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /* the text colour as it lands on bg: its alpha blended in (Pull's years are white at 85 %) */
  window.__text = (el, bg) => { const c = window.__rgb(getComputedStyle(el).color), a = c[3] / 255; return [0, 1, 2].map(i => Math.round(a * c[i] + (1 - a) * bg[i])); };
  /* what is painted behind an era text: an opaque background colour, or a solid last background layer (Pull's
     folder tab paints its colour as linear-gradient(C, C) under the cut). Returns [rgba, the colour as written]. */
  const SOLID_LAYER = /linear-gradient\(((?:oklch|rgba?|hsla?|color)\([^()]*\)), \1\)$/;
  window.__eraBg = el => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e), c = window.__rgb(cs.backgroundColor);
      if (c[3] > 0) return [c, cs.backgroundColor];
      const m = SOLID_LAYER.exec(cs.backgroundImage);
      if (m && window.__rgb(m[1])[3] > 0) return [window.__rgb(m[1]), m[1]];
    }
    return [[255, 255, 255, 255], 'white'];
  };
};

module.exports = async function (t) {
  try {
    const b = basic(), srv = await serve(b.out);

    // ------------------------------------------------ contrast: 4 skins × 7 papers
    const TEXT = [['body text on paper', 'body'], ['header meta on paper', '.pmeta'], ['card text', '#fsecs .sec-name'], ['soft text on card', '#fshow'],
      ['link on card', '.fhead .linkbtn'], ['pressed chip', '#fsecs .chip[aria-pressed="true"]'], ['unpressed chip', '#fsecs .chip[aria-pressed="false"]'],
      ['tab', '.tab[aria-selected="false"]'], ['selected tab', '.tab[aria-selected="true"]'], ['band name', '.band-head .bname'],
      ['row title', '.row:not(.inert) .title'], ['read mark', '.row[data-s="read"] .mark'], ['subnote', '.subnote'], ['credits', '.credits'],
      ['creator name', '.cname'], ['Settings label', '.slabel'], ['pressed setting', '.segbtn[aria-pressed="true"]'], ['Settings summary', '.sec-sum']];
    const EDGE = [['chip outline', '#fsecs .chip[aria-pressed="false"]', 'borderTopColor'], ['button outline', '.ptools .tool', 'borderTopColor'],
      ['search outline', '#q', 'borderTopColor'], ['mark outline', '.row[data-s="unread"] .mark', 'borderTopColor'],
      ['selected-tab underline', '.tab[aria-selected="true"]', 'borderBottomColor']];
    const fails = [], theme = [];
    let worst = { r: 99 };
    for (const skin of SKINS) {
      for (const paper of PAPERS) {
        const pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed('fixture', { skin, paper }) });
        await openAll(pg.page);
        await openSettings(pg.page);
        const r = await pg.page.evaluate(([lib, TEXT, EDGE]) => {
          eval('(' + lib + ')')();
          const row = document.querySelector('.row:not(.inert) .mark');
          row.click(); row.click();                                   // unread → reading → read
          const out = [];
          for (const [what, sel] of TEXT) {
            const el = document.querySelector(sel);
            if (!el) { out.push([what, 0, 'missing']); continue; }
            const bg = window.__bg(el);
            out.push([what, window.__ratio(window.__text(el, bg), bg), 4.5]);
          }
          for (const [what, sel, prop] of EDGE) {
            const el = document.querySelector(sel);
            if (!el) { out.push([what, 0, 'missing']); continue; }
            out.push([what, window.__ratio(window.__rgb(getComputedStyle(el)[prop]), window.__bg(el.parentElement)), 3]);
          }
          return { out, meta: document.querySelector('meta[name="theme-color"]').content, body: getComputedStyle(document.body).backgroundColor,
                   skin: document.documentElement.getAttribute('data-skin') };
        }, [PAGE_LIB.toString(), TEXT, EDGE]);
        for (const [what, ratio, need] of r.out) {
          if (need === 'missing' || ratio < need) fails.push(skin + '/' + paper + ': ' + what + ' ' + (need === 'missing' ? 'missing' : ratio.toFixed(2) + ' < ' + need));
          if (need === 4.5 && ratio < worst.r) worst = { r: ratio, at: skin + '/' + paper + ' ' + what };
        }
        if (r.meta !== r.body) theme.push(skin + '/' + paper + ': ' + r.meta + ' vs ' + r.body);
        if (r.skin !== skin) fails.push(skin + '/' + paper + ': the page is in ' + r.skin);
        if (pg.errors.length) fails.push(skin + '/' + paper + ': errors ' + pg.errors.join(' | '));
        await pg.close();
      }
    }
    t.eq('contrast in every skin × paper: ' + TEXT.length + ' text pairs at 4.5:1 and ' + EDGE.length + ' outlines at 3:1 (worst text ' +
         worst.r.toFixed(2) + ', ' + worst.at + ')', fails, []);
    t.eq('the browser chrome (theme-color) follows each skin\'s paper (F-39)', theme, []);

    // ------------------------------------------------ era banners: 64 eras, every skin, split and one colour
    // Every text in the box (the first era complete, so its ✓ shows). Pull's are solid with white text
    // (John, 9 Oct); every other skin's are pale washes (T-39).
    const sig = readJSON(path.join(FIX, 'basic', 'dataset.json')).franchise.signature;
    sig.stylesheet = path.join(FIX, 'basic', sig.stylesheet);              // the same demo signature skin, 64 eras
    const big = stress(64, 2, { signature: sig }), bsrv = await serve(big.out);
    const done = { 'big:v3:progress': JSON.stringify({ marks: { 'series0-1960-1': 'read', 'series0-1960-2': 'read' }, bookmarks: [] }) };
    const ERA_TEXT = '.bname, .byears, .bcount, .bleft, .bfinish, .bdone, .buntimed, .bfiltered';
    const eraFails = [], pale = [], solid = [];
    let ticks = 0;
    for (const skin of SKINS) {
      for (const eraHues of ['split', 'mono']) {
        const pg = await open(bsrv.url, { width: 390, reducedMotion: 'reduce', storage: Object.assign(seed('big', { skin, eraHues }), done) });
        const r = await pg.page.evaluate(([lib, sel]) => {
          eval('(' + lib + ')')();
          const heads = [...document.querySelectorAll('.era-head')];
          window.__skin = document.documentElement.getAttribute('data-skin');
          return heads.map(h => {
            const bg = window.__eraBg(h.querySelector('.bname'))[0];          // the era's colour: the box, or Pull's tab
            const parts = [...h.querySelectorAll(sel)];
            return { bg, lum: window.__lum(bg), min: Math.min.apply(null, parts.map(p => { const pb = window.__eraBg(p)[0]; return window.__ratio(window.__text(p, pb), pb); })),
                     strip: window.__lum(window.__eraBg(h.querySelector('.bcount'))[0]),
                     tick: !!h.querySelector('.bdone'), ink: parts.map(p => [p.className, window.__rgb(getComputedStyle(p).color).join(',')]) };
          });
        }, [PAGE_LIB.toString(), ERA_TEXT]);
        if (r.length !== 64) eraFails.push(skin + '/' + eraHues + ': ' + r.length + ' era banners');
        const inSkin = await pg.page.evaluate(() => window.__skin);
        if (inSkin !== skin) eraFails.push(skin + '/' + eraHues + ': the page is in ' + inSkin);
        ticks += r.filter(e => e.tick).length;
        r.forEach((e, i) => { if (e.min < 4.5) eraFails.push(skin + '/' + eraHues + ' era ' + i + ': ' + e.min.toFixed(2)); });
        if (skin === 'pull') {
          r.forEach((e, i) => {
            if (e.lum > 0.1833) solid.push('pull/' + eraHues + ' era ' + i + ' luminance ' + e.lum.toFixed(3));
            if (!(e.strip < e.lum)) solid.push('pull/' + eraHues + ' era ' + i + ': its strip is not darker than its tab');
            e.ink.forEach(([cls, c]) => { if (c !== (cls === 'byears' ? '255,255,255,217' : '255,255,255,255')) solid.push('pull/' + eraHues + ' era ' + i + ' .' + cls + ' is ' + c); });
          });
        } else {
          const dark = skin === 'night';
          r.forEach((e, i) => { if (dark ? e.lum > 0.08 : e.lum < 0.7) pale.push(skin + '/' + eraHues + ' era ' + i + ' luminance ' + e.lum.toFixed(2)); });
        }
        const same = (x, y) => x.bg.slice(0, 3).every((v, k) => Math.abs(v - y.bg[k]) <= 2);
        if (eraHues === 'split') {
          const twins = r.slice(1).filter((e, i) => same(e, r[i])).length;
          if (twins) eraFails.push(skin + ': ' + twins + ' neighbouring eras share a colour');
        } else if (!r.every(e => same(e, r[0]))) eraFails.push(skin + '/mono: the eras are not one colour');
        await pg.close();
      }
    }
    t.eq('era banners, 64 eras × ' + SKINS.length + ' skins × split and one colour: every text in the box clears 4.5:1 (the years as drawn, ✓ included), neighbours differ, one colour is one colour (D-12, T-38)', eraFails, []);
    t.ok('…the ✓ of a complete era was measured in every case', ticks === SKINS.length * 2, String(ticks));
    t.eq('…and the washes are pale in every skin but Pull (luminance ≥ 0.7, or ≤ 0.08 on the dark skin; T-39)', pale, []);
    t.eq('…Pull\'s are solid, dark enough for white text, each strip darker than its tab, and all their text is white, the years at 85 % (John, 9 Oct)', solid, []);
    await bsrv.close();

    // ------------------------------------------------ Pull's default palette (John, 13 Oct), drawn in Chromium
    // The reference tracker's eleven era colours, nudged where they fail: era i in colour i mod 11, past eleven eras (52).
    // Every tab and strip is the build's colour exactly; every text on them clears 4.5:1, measured as drawn.
    {
      const PAL = JSON.parse(spawnSync('python3', [path.join(ROOT, 'tools', 'build.py'), '--pull-palette'], { encoding: 'utf8', cwd: ROOT }).stdout || '[]');
      const N = 52, dir = tmpdir('palette');
      const eras = [], arcs = [], rows = [];
      for (let e = 0; e < N; e++) {
        eras.push({ id: 'p' + e, name: 'Era ' + e, rank: 5000 + 10 * e, years: String(1960 + e) });
        arcs.push({ id: 'a' + e, name: 'Arc ' + e, era: 'p' + e, strands: ['Main'], type: 'MAIN', mo: 'M', tier: 'All',
                    credits: { writers: ['Writer Number'], artists: ['Artist Number'] } });
        rows.push({ issueId: 'pal' + e + '-1990-1', series: 'Pal' + e, vol: '1990', num: '1', title: 'Pal ' + e + ' #1', era: 'p' + e, arc: 'a' + e,
                    date: { cover: (1990 + Math.floor(e / 12)) + '-' + String(e % 12 + 1).padStart(2, '0'), source: 'generated' } });
      }
      writeJSON(path.join(dir, 'dataset.json'), { schemaVersion: 1, franchise: { key: 'pal', wordmark: 'Pal', title: 'Pal', strapline: '', span: '', theme: '#000000' },
        eras, strands: ['Main'], types: ['MAIN'], tiers: ['All'], media: ['comic'], arcs, rows });
      const hb = build(path.join(dir, 'dataset.json'), { label: 'palette-out' });
      t.ok('a dataset of ' + N + ' eras builds, and the palette has its eleven colours', hb.status === 0 && PAL.length === 11, hb.stderr.slice(-300));
      const hsrv = await serve(hb.out), bad = { colour: [], strip: [], white: [] };
      let worst = { white: 99, years: 99, strip: 99 };
      for (const eraHues of ['split', 'mono']) {
        const pg = await open(hsrv.url, { width: 390, reducedMotion: 'reduce', storage: seed('pal', { skin: 'pull', eraHues }) });
        const r = await pg.page.evaluate(lib => {
          eval('(' + lib + ')')();
          return [...document.querySelectorAll('.era-head')].map(h => {
            const bg = window.__eraBg(h.querySelector('.bname'))[0], sbg = window.__eraBg(h.querySelector('.bcount'))[0];
            return { bg: bg.slice(0, 3), sbg: sbg.slice(0, 3), white: window.__ratio(window.__text(h.querySelector('.bname'), bg), bg),
                     years: window.__ratio(window.__text(h.querySelector('.byears'), bg), bg), strip: window.__ratio(window.__text(h.querySelector('.bcount'), sbg), sbg) };
          });
        }, PAGE_LIB.toString());
        if (r.length !== N) bad.colour.push(eraHues + ': ' + r.length + ' era banners');
        r.forEach((e, i) => {
          const want = C.hexRgb(PAL[eraHues === 'split' ? i % 11 : 10].hex), swant = want.map(v => Math.max(v - 25, 0)), at = eraHues + ' era ' + i;
          if (e.bg.join() !== want.join()) bad.colour.push(at + ': ' + C.rgbHex(e.bg) + ', not ' + C.rgbHex(want));
          if (e.sbg.join() !== swant.join()) bad.strip.push(at + ': its strip ' + C.rgbHex(e.sbg) + ', not ' + C.rgbHex(swant));
          if (e.white < 4.5 || e.years < 4.5 || e.strip < 4.5) bad.white.push(at + ': ' + [e.white, e.years, e.strip].map(x => x.toFixed(2)).join('/'));
          worst = { white: Math.min(worst.white, e.white), years: Math.min(worst.years, e.years), strip: Math.min(worst.strip, e.strip) };
        });
        await pg.close();
      }
      await hsrv.close();
      t.eq('Pull draws era i of ' + N + ' in palette colour i mod 11, exactly, round and round; "One colour" draws every era in its navy', bad.colour.slice(0, 5), []);
      t.eq('…and each strip in its colour with each channel 25 darker, exactly', bad.strip.slice(0, 5), []);
      t.eq('…every text on them clears 4.5:1, measured as drawn: white on the tab (worst ' + worst.white.toFixed(2) + ':1), the 85 % years (worst ' +
           worst.years.toFixed(2) + ':1), white on the strip (worst ' + worst.strip.toFixed(2) + ':1)', bad.white.slice(0, 5), []);
    }

    // ------------------------------------------------ a tracker's own colours (John, 12 Oct): drawn exactly, in Pull only
    {
      const B = loadData(b.out), own = B.eras.map((e, i) => [e, i]).filter(([e]) => e.colour);
      const plain = copyFixture('basic', 'no-colours'), pds = readJSON(path.join(plain, 'dataset.json'));
      pds.eras.forEach(e => { delete e.colour; });
      writeJSON(path.join(plain, 'dataset.json'), pds);
      const pb = build(path.join(plain, 'dataset.json'), { label: 'no-colours-out' }), psrv = await serve(pb.out);
      const heads = async (url, s) => {
        const pg = await open(url, { width: 390, reducedMotion: 'reduce', storage: seed('fixture', s) });
        await openAll(pg.page);
        const r = await pg.page.evaluate(([lib, sel]) => {
          eval('(' + lib + ')')();
          return [...document.querySelectorAll('.era-head')].map(h => {
            const bg = window.__eraBg(h.querySelector('.bname'))[0], strip = window.__eraBg(h.querySelector('.bcount'))[0];
            return { bg: bg.slice(0, 3).join(','), strip: strip.slice(0, 3).join(','),
                     parts: [...h.querySelectorAll(sel)].map(p => { const pb = window.__eraBg(p)[0]; return [p.className, window.__ratio(window.__text(p, pb), pb), !!p.closest('.bfoot')]; }) };
          });
        }, [PAGE_LIB.toString(), ERA_TEXT]);
        await pg.close();
        return r;
      };
      const split = await heads(srv.url, { skin: 'pull', eraHues: 'split' }), mono = await heads(srv.url, { skin: 'pull', eraHues: 'mono' });
      t.eq('Pull draws each tracker colour exactly as given, and its strip in the reference\'s shade (each channel 25 darker): ' +
           own.map(([e]) => e.id + ' ' + e.colour.hex).join(', '),
           own.map(([e, i]) => [split[i].bg, split[i].strip]), own.map(([e]) => { const c = C.hexRgb(e.colour.hex); return [c.join(','), c.map(v => Math.max(v - 25, 0)).join(',')]; }));
      const flagged = [], other = [];
      split.forEach((h, i) => h.parts.forEach(([cls, ratio, onStrip]) => {
        const c = B.eras[i].colour, want = c && (onStrip ? c.stripWhite : cls === 'byears' ? c.years : c.white);
        if (c && want < 4.5) { if (Math.abs(ratio - want) > 0.01) flagged.push(B.eras[i].id + ' .' + cls + ' ' + ratio.toFixed(3) + ' vs ' + want); }
        else if (ratio < 4.5) other.push(B.eras[i].id + ' .' + cls + ' ' + ratio.toFixed(2));
      }));
      t.eq('…the one under 4.5:1 (dawn, as the build warned) measures exactly the ratios the build reported: white ' +
           own.filter(([e]) => e.colour.white < 4.5).map(([e]) => e.colour.white + ':1, years ' + e.colour.years + ':1').join('; '), flagged, []);
      t.eq('…and it is the only exception: every other era text in Pull clears 4.5:1', other, []);
      t.eq('"One colour" sets the tracker\'s colours aside: every era in the palette\'s navy (' + B.pullMono.hex + ')',
           mono.filter(h => h.bg !== C.hexRgb(B.pullMono.hex).join(',')).length, 0);
      const changed = [];
      for (const skin of SKINS.filter(s => s !== 'pull')) {
        for (const eraHues of ['split', 'mono']) {
          const a = await heads(srv.url, { skin, eraHues }), z = await heads(psrv.url, { skin, eraHues });
          a.forEach((h, i) => { if (h.bg !== z[i].bg) changed.push(skin + '/' + eraHues + ' ' + B.eras[i].id + ': ' + h.bg + ' vs ' + z[i].bg); });
        }
      }
      t.eq('every other skin ignores an era\'s colour: its eras look the same with and without them, split and one colour (John, 12 Oct)', changed, []);
      await psrv.close();
    }

    // ------------------------------------------------ reachability: every control, every skin (V-5)
    const unreachable = [];
    let counted = 0;
    for (const skin of SKINS) {
      for (const [w, extra] of [[390, {}], [320, {}], [320, LARGEST]]) {
        const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed('fixture', Object.assign({ skin }, extra)) });
        for (const tab of ['list', 'reading', 'reviews', 'settings']) {
          if (tab === 'list') await openAll(pg.page);
          else if (tab === 'settings') await openSettings(pg.page);
          else await pg.page.click('#tab-' + tab);
          const r = await reachability(pg.page);
          if (tab === 'list' && await pg.page.evaluate(() => document.documentElement.getAttribute('data-skin')) !== skin) unreachable.push(skin + ': the page is not in that skin');
          counted += r.n;
          r.bad.forEach(x => unreachable.push(skin + ' @' + w + (extra.tap ? ' largest' : '') + ' ' + tab + ': ' + x));
        }
        await pg.close();
      }
    }
    t.eq('every control on every tab is reachable in every skin, at 390 and 320 px, and with the largest text and buttons (' + counted + ' checked)',
         unreachable.slice(0, 20), []);

    // ------------------------------------------------ overflow and the tab bar in every skin, at 320 px, largest settings too
    const cut = [];
    for (const skin of SKINS) {
      for (const extra of [{}, LARGEST]) {
        const pg = await open(srv.url, { width: 320, reducedMotion: 'reduce', storage: seed('fixture', Object.assign({ skin }, extra)) });
        for (const tab of ['list', 'reading', 'reviews', 'settings']) {
          if (tab === 'list') await openAll(pg.page);
          else if (tab === 'settings') await openSettings(pg.page);
          else await pg.page.click('#tab-' + tab);
          const m = await pg.page.evaluate(() => {
            const nav = document.querySelector('#tabs'), nr = nav.getBoundingClientRect();
            return { sw: document.documentElement.scrollWidth, vw: innerWidth, navScroll: nav.scrollWidth - nav.clientWidth,
                     out: [...nav.children].filter(x => { const r = x.getBoundingClientRect(); return r.left < nr.left - 0.5 || r.right > nr.right + 0.5; }).length };
          });
          if (m.sw > m.vw || m.navScroll > 0 || m.out) cut.push(skin + (extra.tap ? ' largest' : '') + ' ' + tab + ': page ' + m.sw + ' px, bar scrolls ' + m.navScroll);
        }
        await pg.close();
      }
    }
    t.eq('every skin at 320 px, with default and the largest settings: no overflow, all four tabs fully in the bar', cut, []);

    // ------------------------------------------------ sizes: text (T-45, XM-18) and buttons (T-56, T-57)
    const size = {};
    for (const textSize of ['s', 'm', 'l']) {
      const pg = await open(srv.url, { width: 390, storage: seed('fixture', { textSize }) });
      size[textSize] = await pg.page.evaluate(() => [parseFloat(getComputedStyle(document.querySelector('.ptitle')).fontSize), parseFloat(getComputedStyle(document.body).fontSize)]);
      await pg.close();
    }
    t.eq('the title and the body text follow the text-size setting: × 0.9 / 1 / 1.15 (T-45, XM-18)', size, { s: [25.2, 13.5], m: [28, 15], l: [32.2, 17.25] });
    const tap = {};
    for (const t2 of ['compact', 'standard', 'large']) {
      const pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed('fixture', { tap: t2 }) });
      await openAll(pg.page);
      tap[t2] = await pg.page.evaluate(() => {
        document.querySelector('.b.rv').click();                     // the review editor's stars are glyph buttons too
        const box = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); };
        return [box('.row:not(.inert) .mark'), box('.row:not(.inert) .b.bm'), box('.star')];
      });
      await pg.close();
    }
    t.eq('compact restores the original 26 px mark (T-56)', tap.compact[0], 26);
    t.ok('standard glyph buttons are usable: mark, bookmark and star each at least 24 px (T-57)', tap.standard.every(v => v >= 24), JSON.stringify(tap.standard));
    t.ok('large makes every glyph button at least 44 px (T-57, S-20)', tap.large.every(v => v >= 44), JSON.stringify(tap.large));
    let pg = await open(srv.url, { width: 390, storage: seed('fixture', { dys: true }) });
    const font = await pg.page.evaluate(() => getComputedStyle(document.body).fontFamily);
    await pg.close();
    t.ok('the dyslexia-friendly font replaces the body face (F-51, S-9)', /^"?Comic Sans MS/.test(font), font);
    const rows = {};
    for (const density of ['compact', 'normal', 'roomy']) {
      pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed('fixture', { density }) });
      await openAll(pg.page);
      rows[density] = await pg.page.evaluate(() => Math.round(document.querySelector('.row:not(.inert)').getBoundingClientRect().height));
      await pg.close();
    }
    t.ok('density changes the row height: compact < normal < roomy (S-2)', rows.compact < rows.normal && rows.normal < rows.roomy, JSON.stringify(rows));
    await srv.close();
  } finally { await closeBrowser(); }
};
