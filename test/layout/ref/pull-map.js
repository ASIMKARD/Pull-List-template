/* Pull = X-Men (John, 6 Oct): which X-Men element each template element is
   measured against, and what is measured. Shared by the capture script
   (capture-x-men.js, session-only: it needs a local read-only X-Men copy) and
   test/layout/45-pull, so both always measure the same things.

   Measured at 393 px (John's iPhone). Colours, font families, weights, case
   and tracking must be exact; sizes within 0.5 px. Spacing that would move a
   control is a skin's business only with John's say-so (one layout), so it
   is recorded in DIFFERENCES below rather than built. Sizes compare within
   0.5 px; everything else exactly. */
'use strict';

const WIDTH = 393, HEIGHT = 852;

/* [what, X-Men selector, template selector, properties] */
const TEXT = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'color'];
const MAP = [
  ['page background', 'body', 'body', ['backgroundColor']],
  ['title', '.topbar h1', '.ptitle', TEXT.concat(['lineHeight'])],
  ['subtitle', '.topbar .subtitle', '.pmeta', TEXT],
  ['tab bar', '.tabbar', '#tabs', ['backgroundColor']],
  ['tab', '.tabbar button:not(.active)', '.tab[aria-selected="false"]', TEXT],
  ['selected tab', '.tabbar button.active', '.tab[aria-selected="true"]', TEXT.concat(['borderBottomColor', 'borderBottomWidth'])],
  ['era name', '.era-divider .era-name', '.era-head .bname', TEXT],
  ['era years', '.era-divider .era-years', '.era-head .byears', TEXT],
  ['era stats', '.era-divider .era-stats span', '.era-head .bcount', ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform']],
  ['era intro', '.era-intro', '.era-intro', TEXT.concat(['fontStyle'])],
  ['arc name', '.arc-head .name', '.arc-head h3', TEXT],
  ['row title', '.issue-row .title', '.row:not(.inert) .title', TEXT],
  ['row', '.issue-row', '.row:not(.inert)', ['effectiveBackground', 'borderBottomColor']],
  ['era body', '.era-body', '.era-body', ['effectiveBackground']],
  ['search box', '#searchInput', '#q', ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'borderTopColor', 'borderTopLeftRadius']],
  // geometry: what a skin may not change (one layout), measured so the differences are on record
  ['tab bar box', '.tabbar', '#tabs', ['boxLeft', 'boxWidth']],
  ['read mark', '.issue-row .tri-check', '.row:not(.inert) .mark', ['boxWidth', 'boxHeight', 'borderTopLeftRadius', 'borderTopColor']],
];

/* The differences left, each with why it isn't built. "accessible": X-Men's
   value fails a measured contrast rule (40-look), so Pull keeps a passing one.
   "John": it needs a layout, data or rule change only John can approve (the
   one-layout rule, the pale era washes of T-39, the Button size setting).
   45-pull fails if a difference appears that isn't listed here, or a listed
   one goes away, so this list is always the true state. */
const DIFFERENCES = {
  'selected tab.borderBottomColor': 'accessible: X-Men\'s navy underline is 1.52:1 on the bar; Pull uses the same hue at 3:1',
  'search box.borderTopColor': 'accessible: X-Men\'s field outline is 1.53:1; Pull keeps the 3:1 control outline (--edge)',
  'era name.color': 'John: X-Men\'s era boxes are solid, hand-picked colours per era with white text; the template\'s are pale washes (T-39) from the era\'s index',
  'era years.color': 'John: as the era name (white on a solid era colour)',
  'tab bar box.boxLeft': 'John: X-Men\'s tab bar runs edge to edge; the template\'s sits inside the 16 px page margin (layout)',
  'tab bar box.boxWidth': 'John: as above (393 vs 361 px)',
  'read mark.boxWidth': 'John: the mark\'s size belongs to the Button size setting (--tap), not to a skin',
  'read mark.boxHeight': 'John: as the width (22 px in X-Men, --tap here)',
  'read mark.borderTopLeftRadius': 'John: the mark\'s shape belongs to the Marks setting (--mark-radius), not to a skin',
};

/* In-page: the computed values for one side of the map. Colours become
   rgba() strings through a canvas, so "rgb(1, 2, 3)" and "#010203" compare equal. */
function measure(map, side) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return 'rgba(' + [d[0], d[1], d[2], +(d[3] / 255).toFixed(2)].join(', ') + ')'; };
  const out = {};
  for (const [what, xm, tpl, props] of map) {
    const el = document.querySelector(side === 'x-men' ? xm : tpl);
    if (!el) { out[what] = null; continue; }
    const cs = getComputedStyle(el), v = {};
    for (const p of props) {
      let x = cs[p] === undefined ? null : cs[p];
      if (p === 'effectiveBackground') {
        x = 'rgba(0, 0, 0, 0)';
        for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (!/, 0\)$/.test(c)) { x = c; break; } }
      } else if (/^box/.test(p)) { const r = el.getBoundingClientRect(); x = Math.round({ boxLeft: r.left, boxWidth: r.width, boxHeight: r.height }[p] * 10) / 10 + 'px'; }
      else if (/color$/i.test(p)) x = rgb(x);
      else if (p === 'fontFamily') x = x.split(',')[0].replace(/["']/g, '').trim();
      else if (p === 'letterSpacing') x = x === 'normal' ? '0px' : x;
      else if (p === 'lineHeight' && x !== 'normal') x = (parseFloat(x) / parseFloat(cs.fontSize)).toFixed(2);
      v[p] = x;
    }
    out[what] = v;
  }
  return out;
}

/* Getting each page into the measured state: the first era open, its first
   arc open (X-Men opens arcs one at a time; the template opens an era's arcs). */
async function prepareXMen(page) {
  await page.waitForSelector('.era-divider .tab');
  await page.click('.era-divider .tab');
  await page.waitForSelector('.arc-row .arc-head');
  await page.click('.arc-row .arc-head');
  await page.waitForSelector('.issue-row .title');
}
async function prepareTemplate(page) {
  await page.evaluate(() => {
    document.querySelector('#tab-list').click();
    document.querySelector('.ptools [data-act="expand-all"]').click();
  });
  await page.waitForSelector('.row .title');
}

module.exports = { WIDTH, HEIGHT, MAP, DIFFERENCES, measure, prepareXMen, prepareTemplate };
