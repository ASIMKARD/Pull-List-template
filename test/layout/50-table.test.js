/* Table view and the banner, measured (session 4, step 5).
   - L-7: table view at least halves the row height.
   - L-8: no table row is wider than the screen; every control in it is still
     reachable at 24 px; and the title keeps at least half the row (badge
     words fold away to glyphs).
   - The persistent banner and the mini bar show on every tab without
     overflow, per format too. */
'use strict';
const { basic, mixed } = require('../lib/helpers');
const { serve, open, openAll, reachability, eachTab, closeBrowser } = require('./lib');

const SKINS = ['paper', 'newsprint', 'pull', 'night'];
const LARGEST = { textSize: 'l', tap: 'large', density: 'roomy', dys: true };
const seed = (key, s) => ({ [key + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s)) });
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rowHeights = page => page.evaluate(() => [...document.querySelectorAll('.row:not(.inert)')].map(r => r.getBoundingClientRect().height));

module.exports = async function (t) {
  try {
    const srv = await serve(basic().out);
    const halves = [], wide = [], unreachable = [], narrow = [];
    let rows = 0, checked = 0;
    for (const skin of SKINS) {
      for (const w of [320, 390]) {
        // L-7: the same rows, normal then table, default settings
        let pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed('fixture', { skin }) });
        await openAll(pg.page);
        const normal = median(await rowHeights(pg.page));
        await pg.close();
        pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed('fixture', { skin, table: true }) });
        await openAll(pg.page);
        const table = median(await rowHeights(pg.page));
        if (!(table <= normal / 2)) halves.push(skin + ' @' + w + ': ' + table + ' of ' + normal + ' px');
        const share = await pg.page.evaluate(() => Math.min.apply(null, [...document.querySelectorAll('.row:not(.inert)')]
          .map(r => r.querySelector('.title').getBoundingClientRect().width / r.getBoundingClientRect().width)));
        if (share < 0.5) narrow.push(skin + ' @' + w + ': a title gets ' + Math.round(share * 100) + '% of its row');
        await pg.close();
        // L-8 and reachability, at default and the largest settings
        for (const extra of [{}, LARGEST]) {
          pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed('fixture', Object.assign({ skin, table: true }, extra)) });
          await openAll(pg.page);
          const m = await pg.page.evaluate(() => [...document.querySelectorAll('.row')].map(r => {
            const b = r.getBoundingClientRect();
            return { right: b.right, sw: r.scrollWidth, cw: r.clientWidth, vw: innerWidth, t: r.querySelector('.title').textContent.slice(0, 30) };
          }));
          rows += m.length;
          m.filter(x => x.right > x.vw + 0.5 || x.sw > x.cw + 1).forEach(x => wide.push(skin + ' @' + w + (extra.tap ? ' largest' : '') + ': "' + x.t + '" ' + x.sw + ' > ' + x.cw));
          const r = await reachability(pg.page);
          checked += r.n;
          r.bad.forEach(x => unreachable.push(skin + ' @' + w + (extra.tap ? ' largest' : '') + ': ' + x));
          t.eq(skin + ' @ ' + w + ' px' + (extra.tap ? ', largest settings' : '') + ': no page errors in table view', pg.errors, []);
          await pg.close();
        }
      }
    }
    t.eq('table view at least halves the row height, every skin, 320 and 390 px (L-7)', halves, []);
    // normal view: a badge's glyph and its word are spaced ("✎ review", not "✎review")
    const pgB = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed('fixture', {}) });
    await openAll(pgB.page);
    const tight = await pgB.page.evaluate(() => [...document.querySelectorAll('.b')].filter(b => b.querySelector('.b-t')).map(b => {
      const parts = [...b.childNodes].map(n => { if (n.nodeType === 3) { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); } return n.getBoundingClientRect(); })
        .filter(r => r.width > 0);
      const gaps = parts.slice(1).map((r, k) => r.left - parts[k].right);
      return { t: b.textContent.trim(), gap: Math.min.apply(null, gaps) };
    }).filter(x => !(x.gap >= 2)));
    t.eq('a badge\'s glyph and word are spaced, not run together ("✎ review", "look up ↗")', tight.slice(0, 5), []);
    await pgB.close();
    t.eq('no table row is wider than the screen (' + rows + ' rows; L-8)', wide.slice(0, 10), []);
    t.eq('…and every title keeps at least half its row: badge words fold to glyphs', narrow, []);
    t.eq('every control in table view is reachable at 24 px or more (' + checked + ' checked)', unreachable.slice(0, 10), []);
    await srv.close();

    // ------------------------------------------------ the banner and the mini bar, every tab, per format
    const msrv = await serve(mixed().out), over = [];
    for (const skin of SKINS) {
      const pg = await open(msrv.url, { width: 320, reducedMotion: 'reduce', storage: seed('mixed', { skin, banner: true, progressMode: 'medium' }) });
      await eachTab(pg.page, async tab => {
        const m = await pg.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth,
          banner: document.querySelector('#pbanner').getBoundingClientRect().height, lines: document.querySelectorAll('#pbannerIn .pbl').length,
          mini: document.querySelector('#miniBar').getBoundingClientRect().height }));
        if (m.sw > m.vw || !(m.banner > 0) || m.lines !== 3 || !(m.mini > 0)) over.push(skin + ' ' + tab + ': ' + JSON.stringify(m));
      });
      await pg.close();
    }
    t.eq('the banner (one line per format) and the mini bar show on every tab, every skin, at 320 px, without overflow', over, []);
    await msrv.close();
  } finally { await closeBrowser(); }
};
