/* The repo's own dataset, measured in real Chromium: the demo in the template,
   a tracker's real data in a tracker built from it (the Absolute pilot, 8 Oct:
   "it all passes on Absolute's own data"). 40-look measures the full fixture;
   this measures what actually ships, in every skin it offers (its signature
   skin first, when it has one):
   - contrast on every paper swatch: each text pair this data puts on screen at
     4.5:1, control outlines at 3:1 (a glyph mark with no outline: its glyph);
   - its era banners, split and one colour: every text on the banner at 4.5:1;
   - reachability: every control on every tab, at 390 and 320 px and with the
     largest text and buttons (V-5). */
'use strict';
const { ROOT, ROOT_DATASET } = require('../lib/helpers');
const { serve, open, openAll, openSettings, reachability, closeBrowser } = require('./lib');

const RF = ROOT_DATASET.franchise, KEY = RF.key;
const SKINS = (RF.signature ? ['signature'] : []).concat(RF.skins || ['paper', 'newsprint', 'pull', 'night']);
const PAPERS = ['default', 'warm', 'grey', 'rose', 'mint', 'sky', 'lilac'];
const LARGEST = { textSize: 'l', tap: 'large', density: 'roomy', dys: true };
const seed = s => ({ [KEY + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s)) });

const TEXT = [['body text on paper', 'body'], ['header title', '.ptitle'], ['header meta', '.pmeta'], ['header stats', '.pstats'],
  ['card text', '#fsecs .sec-name'], ['soft text on card', '#fshow'], ['link on card', '.fhead .linkbtn'],
  ['pressed chip', '#fsecs .chip[aria-pressed="true"]'], ['unpressed chip', '#fsecs .chip[aria-pressed="false"]'], ['search text', '#q'],
  ['tab', '.tab[aria-selected="false"]'], ['selected tab', '.tab[aria-selected="true"]'], ['band name', '.band-head .bname'],
  ['era intro', '.era-intro'], ['arc name', '.arc-head h3'], ['arc blurb', '.blurb'], ['row title', '.row[data-s="unread"]:not(.inert) .title'],
  ['read row title', '.row[data-s="read"] .title'], ['read mark', '.row[data-s="read"] .mark'], ['subnote', '.subnote'], ['credits', '.credits'],
  ['creator name', '.cname'], ['badge', '.row .b'], ['Settings label', '.slabel'], ['pressed setting', '.segbtn[aria-pressed="true"]'],
  ['Settings summary', '.sec-sum'], ['tool button', '.ptools .tool']];
const EDGE = [['chip outline', '#fsecs .chip[aria-pressed="false"]', 'borderTopColor'], ['button outline', '.ptools .tool', 'borderTopColor'],
  ['search outline', '#q', 'borderTopColor'], ['mark outline', '.row[data-s="unread"] .mark', 'borderTopColor'],
  ['selected-tab underline', '.tab[aria-selected="true"]', 'borderBottomColor']];

const PAGE_LIB = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  window.__rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  window.__bg = el => {
    for (let e = el; e; e = e.parentElement) { const c = window.__rgb(getComputedStyle(e).backgroundColor); if (c[3] > 0) return c; }
    return [255, 255, 255, 255];
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  window.__ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
};

module.exports = async function (t) {
  const name = KEY + ' (the repo\'s own dataset)';
  try {
    const srv = await serve(ROOT);

    // ------------------------------------------------ contrast: every skin it offers × every paper
    const fails = [], measured = new Set();
    let worst = { r: 99 };
    for (const skin of SKINS) {
      for (const paper of PAPERS) {
        const pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed({ skin, paper }) });
        await openAll(pg.page);
        await openSettings(pg.page);
        await pg.page.click('#tab-list');
        const r = await pg.page.evaluate(([lib, TEXT, EDGE]) => {
          eval('(' + lib + ')')();
          const mark = document.querySelector('.row:not(.inert) .mark');
          mark.click(); mark.click();                                   // unread → reading → read
          const out = [];
          for (const [what, sel] of TEXT) {
            const el = [...document.querySelectorAll(sel)].find(e => !e.closest('[hidden]'));
            if (el) out.push([what, window.__ratio(window.__rgb(getComputedStyle(el).color), window.__bg(el)), 4.5]);
          }
          for (const [what, sel, prop] of EDGE) {
            const el = [...document.querySelectorAll(sel)].find(e => !e.closest('[hidden]'));
            if (!el) continue;
            /* a glyph mark (a signature decoration, session 6): when the outline is
               invisible and the control draws a glyph, the glyph is what shows the
               control and its state (WCAG 1.4.11), so the glyph clears 3:1 */
            const cs = getComputedStyle(el), side = prop.replace(/Color$/, ''), g = getComputedStyle(el, '::after');
            const noLine = parseFloat(cs[side + 'Width']) === 0 || cs[side + 'Style'] === 'none' || window.__rgb(cs[prop])[3] === 0;
            const glyph = g.content && g.content !== 'none' && g.content !== 'normal' && /"[^"]*\S[^"]*"/.test(g.content);
            out.push([what, noLine && glyph ? window.__ratio(window.__rgb(g.color), window.__bg(el)) : window.__ratio(window.__rgb(cs[prop]), window.__bg(el.parentElement)), 3]);
          }
          return { out, skin: document.documentElement.getAttribute('data-skin') };
        }, [PAGE_LIB.toString(), TEXT, EDGE]);
        for (const [what, ratio, need] of r.out) {
          measured.add(what);
          if (ratio < need) fails.push(skin + '/' + paper + ': ' + what + ' ' + ratio.toFixed(2) + ' < ' + need);
          if (need === 4.5 && ratio < worst.r) worst = { r: ratio, at: skin + '/' + paper + ' ' + what };
        }
        if (r.skin !== skin) fails.push(skin + '/' + paper + ': the page is in ' + r.skin);
        if (pg.errors.length) fails.push(skin + '/' + paper + ': errors ' + pg.errors.join(' | '));
        await pg.close();
      }
    }
    t.eq(name + ': contrast in ' + SKINS.join(', ') + ' × ' + PAPERS.length + ' papers, ' + measured.size + ' pairs this data shows (worst text ' +
         worst.r.toFixed(2) + ', ' + worst.at + ')', fails, []);
    t.ok('…which measures most of them: at least 18 of the ' + (TEXT.length + EDGE.length) + ' pairs, every outline among them',
         measured.size >= 18 && EDGE.every(([w]) => measured.has(w)), [...measured].join(', '));

    // ------------------------------------------------ its era banners, split and one colour
    const eraFails = [];
    let banners = 0;
    for (const skin of SKINS) {
      for (const eraHues of ['split', 'mono']) {
        const pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed({ skin, eraHues }) });
        const r = await pg.page.evaluate(lib => {
          eval('(' + lib + ')')();
          return [...document.querySelectorAll('.era-head')].map(h => {
            const bg = window.__rgb(getComputedStyle(h).backgroundColor);
            const parts = [...h.querySelectorAll('.bname, .byears, .bcount, .bleft, .bfinish, .bdone')];
            return parts.map(p => [p.className, window.__ratio(window.__rgb(getComputedStyle(p).color), bg)]);
          });
        }, PAGE_LIB.toString());
        banners += r.length;
        r.forEach((parts, i) => parts.forEach(([cls, ratio]) => { if (ratio < 4.5) eraFails.push(skin + '/' + eraHues + ' era ' + i + ' .' + cls + ': ' + ratio.toFixed(2)); }));
        await pg.close();
      }
    }
    t.eq(name + ': every text on its ' + ROOT_DATASET.eras.length + ' era banners clears 4.5:1 in every skin, split and one colour (' + banners + ' banners)', eraFails, []);
    t.ok('…every era measured in every case', banners === ROOT_DATASET.eras.length * SKINS.length * 2, String(banners));

    // ------------------------------------------------ reachability: every control, every skin it offers (V-5)
    const unreachable = [];
    let counted = 0;
    for (const skin of SKINS) {
      for (const [w, extra] of [[390, {}], [320, {}], [320, LARGEST]]) {
        const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed(Object.assign({ skin }, extra)) });
        for (const tab of ['list', 'reading', 'reviews', 'settings']) {
          if (tab === 'list') await openAll(pg.page);
          else if (tab === 'settings') await openSettings(pg.page);
          else await pg.page.click('#tab-' + tab);
          const r = await reachability(pg.page);
          counted += r.n;
          r.bad.forEach(x => unreachable.push(skin + ' @' + w + (extra.tap ? ' largest' : '') + ' ' + tab + ': ' + x));
        }
        if (pg.errors.length) unreachable.push(skin + ' @' + w + ': errors ' + pg.errors.join(' | '));
        await pg.close();
      }
    }
    t.eq(name + ': every control on every tab is reachable in every skin it offers, at 390 and 320 px, and with the largest text and buttons (' +
         counted + ' checked)', unreachable.slice(0, 20), []);
    await srv.close();
  } finally { await closeBrowser(); }
};
