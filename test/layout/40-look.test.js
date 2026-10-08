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
const { FIX, basic, stress, readJSON } = require('../lib/helpers');
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
            out.push([what, window.__ratio(window.__rgb(getComputedStyle(el).color), window.__bg(el)), 4.5]);
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

    // ------------------------------------------------ era washes: 64 eras, every skin, split and one colour
    const sig = readJSON(path.join(FIX, 'basic', 'dataset.json')).franchise.signature;
    sig.stylesheet = path.join(FIX, 'basic', sig.stylesheet);              // the same demo signature skin, 64 eras
    const big = stress(64, 2, { signature: sig }), bsrv = await serve(big.out);
    const eraFails = [], pale = [];
    for (const skin of SKINS) {
      for (const eraHues of ['split', 'mono']) {
        const pg = await open(bsrv.url, { width: 390, reducedMotion: 'reduce', storage: seed('big', { skin, eraHues }) });
        const r = await pg.page.evaluate(lib => {
          eval('(' + lib + ')')();
          const heads = [...document.querySelectorAll('.era-head')];
          window.__skin = document.documentElement.getAttribute('data-skin');
          return heads.map(h => {
            const bg = window.__rgb(getComputedStyle(h).backgroundColor);
            const parts = [h.querySelector('.bname'), h.querySelector('.byears'), h.querySelector('.bcount'), h.querySelector('.bleft'), h.querySelector('.bfinish')].filter(Boolean);
            return { bg, lum: window.__lum(bg), min: Math.min.apply(null, parts.map(p => window.__ratio(window.__rgb(getComputedStyle(p).color), bg))) };
          });
        }, PAGE_LIB.toString());
        if (r.length !== 64) eraFails.push(skin + '/' + eraHues + ': ' + r.length + ' era banners');
        const inSkin = await pg.page.evaluate(() => window.__skin);
        if (inSkin !== skin) eraFails.push(skin + '/' + eraHues + ': the page is in ' + inSkin);
        r.forEach((e, i) => { if (e.min < 4.5) eraFails.push(skin + '/' + eraHues + ' era ' + i + ': ' + e.min.toFixed(2)); });
        const dark = skin === 'night';
        r.forEach((e, i) => { if (dark ? e.lum > 0.08 : e.lum < 0.7) pale.push(skin + '/' + eraHues + ' era ' + i + ' luminance ' + e.lum.toFixed(2)); });
        const same = (x, y) => x.bg.slice(0, 3).every((v, k) => Math.abs(v - y.bg[k]) <= 2);
        if (eraHues === 'split') {
          const twins = r.slice(1).filter((e, i) => same(e, r[i])).length;
          if (twins) eraFails.push(skin + ': ' + twins + ' neighbouring eras share a colour');
        } else if (!r.every(e => same(e, r[0]))) eraFails.push(skin + '/mono: the eras are not one colour');
        await pg.close();
      }
    }
    t.eq('era banners, 64 eras × ' + SKINS.length + ' skins × split and one colour: every text on its wash clears 4.5:1, neighbours differ, one colour is one colour (D-12, T-38)', eraFails, []);
    t.eq('…and the washes are pale (luminance ≥ 0.7, or ≤ 0.08 on the dark skin; T-39)', pale, []);
    await bsrv.close();

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
