/* Signature decorations (John, 8 Oct), measured in real Chromium. A skin may
   add ::before and ::after content (row numbers, prefixes, era numerals, glyph
   marks) and place a pseudo-element absolutely against a row or a head. For
   every decoration on the page, with everything open:
   - it is silent to screen readers (its computed content ends in / "") and
     never takes a tap (pointer-events: none);
   - its text clears contrast: 4.5:1, or 3:1 when large;
   - one placed absolutely is anchored to its own host, stays on the screen,
     and covers no control and no title.
   At 320, 390 and 1024 px, with default and the largest settings, and in table
   view. Reachability, overflow, tap size and the stack are measured across the
   same skins by 10-sweep, 40-look, 45-root and 60-stack. */
'use strict';
const { ROOT, ROOT_DATASET, basic } = require('../lib/helpers');
const { serve, open, openAll, closeBrowser } = require('./lib');

const LOOKS = [['default', {}], ['largest', { textSize: 'l', tap: 'large', density: 'roomy', dys: true }], ['table view', { table: true }]];
const WIDTHS = [320, 390, 1024];

const MEASURE = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el, own) => {
    const o = rgb(own); if (o[3] > 0) return o;
    for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c[3] > 0) return c; }
    return [255, 255, 255, 255];
  };
  const name = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
    (el.dataset && el.dataset.n ? '[' + el.dataset.n + ']' : el.dataset && el.dataset.act ? '[' + el.dataset.act + ']' : '');
  const shown = el => !el.closest('[hidden]') && el.getClientRects().length > 0;
  const boxes = [...document.querySelectorAll('button, a[href], input, select, textarea, .title')].filter(shown)
    .map(el => ({ el, r: el.getBoundingClientRect() }));
  const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const out = { n: 0, abs: 0, bad: [] };
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    for (const ps of ['::before', '::after']) {
      const cs = getComputedStyle(el, ps), c = cs.content;
      if (!c || c === 'none' || c === 'normal') continue;
      out.n++;
      const where = name(el) + ps;
      if (!/ \/ ""$/.test(c)) out.bad.push(where + ' is read out by screen readers (' + c + ')');
      if (cs.pointerEvents !== 'none') out.bad.push(where + ' takes taps');
      if (/"[^"]*\S[^"]*"/.test(c.replace(/ \/ ""$/, ''))) {
        const fs = parseFloat(cs.fontSize), large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
        const r = ratio(rgb(cs.color), bgOf(el, cs.backgroundColor));
        if (r < (large ? 3 : 4.5)) out.bad.push(where + ' text ' + r.toFixed(2) + ':1 (' + c + ')');
      }
      if (cs.position !== 'absolute') continue;
      out.abs++;
      const hs = getComputedStyle(el);
      if (hs.position === 'static') { out.bad.push(where + ' is placed absolutely but its host is not an anchor'); continue; }
      const hr = el.getBoundingClientRect();
      const left = hr.left + parseFloat(hs.borderLeftWidth) + parseFloat(cs.left), top = hr.top + parseFloat(hs.borderTopWidth) + parseFloat(cs.top);
      const box = { left, top, right: left + parseFloat(cs.width), bottom: top + parseFloat(cs.height) };
      if (box.left < -0.5 || box.right > innerWidth + 0.5) out.bad.push(where + ' runs off the screen (' + Math.round(box.left) + '–' + Math.round(box.right) + ')');
      for (const b of boxes) if (b.el !== el && !b.el.contains(el) && overlap(box, b.r)) out.bad.push(where + ' covers ' + name(b.el));
    }
  }
  return out;
};

module.exports = async function (t) {
  const sets = [['basic (the demo signature skin)', basic().out, 'fixture', true]];
  if (ROOT_DATASET.franchise.signature) sets.push([ROOT_DATASET.franchise.key + ' (the repo\'s own signature skin)', ROOT, ROOT_DATASET.franchise.key, false]);
  try {
    for (const [label, dir, key, mustDecorate] of sets) {
      const srv = await serve(dir);
      let n = 0, abs = 0;
      const bad = [];
      for (const w of WIDTHS) {
        for (const [look, extra] of LOOKS) {
          const storage = { [key + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' }, skin: 'signature' }, extra)) };
          const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage });
          await openAll(pg.page);
          const r = await pg.page.evaluate(MEASURE);
          n += r.n; abs += r.abs;
          r.bad.forEach(x => bad.push(w + ' px, ' + look + ': ' + x));
          if (pg.errors.length) bad.push(w + ' px, ' + look + ': page errors ' + pg.errors.join(' | '));
          await pg.close();
        }
      }
      await srv.close();
      if (mustDecorate) t.ok(label + ': decorations are measured (' + n + ', ' + abs + ' placed absolutely)', n > 0 && abs > 0, n + '/' + abs);
      t.eq(label + ': every decoration is silent to screen readers, takes no taps, clears contrast, and covers no control or title (' + n +
           ' measured at 320, 390 and 1024 px; default, largest, table view)', bad.slice(0, 20), []);
    }
  } finally { await closeBrowser(); }
};
