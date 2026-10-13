/* Pull = X-Men (John, 6 Oct): which X-Men element each template element is
   measured against, and what is measured. Shared by the capture script
   (capture-x-men.js, session-only: it needs a local read-only X-Men copy) and
   test/layout/45-pull, so both always measure the same things.

   Measured at 393 px (John's iPhone). Colours, font families, weights, case
   and tracking must be exact; sizes within 0.5 px. Spacing that would move a
   control is a skin's business only with John's say-so (one layout), so it
   is recorded in DIFFERENCES below rather than built. Sizes compare within
   0.5 px; everything else exactly.

   Session 7 (John, 9 Oct): Pull's era boxes take X-Men's folder-tab shape and
   its tab bar runs edge to edge, so both are measured in full: the era box,
   tab, strip and open body, each text's effective colour, and the folder tab's
   cut, read from pixels (SHAPE). X-Men's eras are top-level, so the template's
   are measured on a fixture without bands (page 'eras'). */
'use strict';

const WIDTH = 393, HEIGHT = 852;

/* [what, X-Men selector, template selector, properties, template page]
   A selector ending in @N is its Nth match. The page is 'main' (the basic
   fixture) unless it says 'eras' (the no-periods fixture: top-level eras). */
const TEXT = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'color'];
const MAP = [
  ['page background', 'body', 'body', ['backgroundColor']],
  ['title', '.topbar h1', '.ptitle', TEXT.concat(['lineHeight'])],
  ['subtitle', '.topbar .subtitle', '.pmeta', TEXT],
  ['tab bar', '.tabbar', '#tabs', ['backgroundColor']],
  ['tab', '.tabbar button:not(.active)', '.tab[aria-selected="false"]', TEXT],
  ['selected tab', '.tabbar button.active', '.tab[aria-selected="true"]', TEXT.concat(['borderBottomColor', 'borderBottomWidth'])],
  ['era name', '.era-divider .era-name', '.era-head .bname', TEXT.concat(['effectiveColor']), 'eras'],
  ['era years', '.era-divider .era-years', '.era-head .byears', TEXT.concat(['effectiveColor']), 'eras'],
  ['era stats', '.era-divider .era-stats span', '.era-head .bcount', ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'effectiveColor'], 'eras'],
  ['era intro', '.era-intro', '.era-intro', TEXT.concat(['fontStyle']), 'eras'],
  ['arc name', '.arc-head .name', '.arc-head h3', TEXT],
  ['row title', '.issue-row .title', '.row:not(.inert) .title', TEXT],
  ['row', '.issue-row', '.row:not(.inert)', ['effectiveBackground', 'borderBottomColor']],
  ['era body', '.era-body', '.era-body', ['effectiveBackground', 'boxLeft', 'boxWidth', 'paddingTop', 'paddingLeft', 'borderLeftWidth', 'borderLeftColor',
    'borderBottomWidth', 'borderBottomLeftRadius'], 'eras'],
  ['search box', '#searchInput', '#q', ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'borderTopColor', 'borderTopLeftRadius']],
  // the era box (session 7): X-Men's folder tab, a darker strip under it, and the open body's frame
  ['era box', '.era-divider', '.era-head', ['boxLeft', 'boxWidth', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius',
    'borderBottomRightRadius', 'borderTopWidth', 'boxShadow'], 'eras'],
  ['era spacing', '.era-divider@2', '.era-head@2', ['gapAbove'], 'eras'],
  ['era tab', '.era-divider .tab', '.era-head .bhead', ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], 'eras'],
  ['era strip', '.era-divider .era-stats', '.era-head .bfoot', ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], 'eras'],
  ['era bar', '.era-divider .era-progress-track', '.era-head progress.bar', ['backgroundColor', 'boxHeight', 'borderTopLeftRadius'], 'eras'],
  // geometry: the tab bar runs edge to edge in Pull (John, 9 Oct); the read mark keeps the 24 px minimum (on record below)
  ['tab bar box', '.tabbar', '#tabs', ['boxLeft', 'boxWidth', 'borderTopLeftRadius']],
  ['read mark', '.issue-row .tri-check', '.row:not(.inert) .mark', ['boxWidth', 'boxHeight', 'borderTopLeftRadius', 'borderTopColor']],
];

/* The folder tab's shape, read from pixels on the first era box (SHAPE, per
   side: the box, its tab and its strip). Paper is the page colour. The cut is
   where paper begins along a row of the tab, as a fraction of the box's
   width, at its top, middle and bottom; fill and strip are the colours
   painted there; hatch is the share of the tab's corner (its last 14 px at the
   bottom) drawn darker than the fill. */
const SHAPE = {
  'x-men': { box: '.era-divider', tab: '.era-divider .tab', strip: '.era-divider .era-stats' },
  template: { box: '.era-head', tab: '.era-head .bhead', strip: '.era-head .bfoot' },
};
const SHAPE_PROPS = ['cutTop', 'cutMiddle', 'cutBottom', 'fill', 'strip', 'hatch'];
const NEAR = { cutTop: 0.015, cutMiddle: 0.015, cutBottom: 0.015, hatch: 0.12 };

/* The differences left, each with why it isn't built. "accessible": X-Men's
   value fails a measured contrast rule (40-look), so Pull keeps a passing one.
   "John": it needs a layout, data or rule change only John can approve (the
   one-layout rule, the pale era washes of T-39, the Button size setting), or
   John approved it and session 7 is building it (9 Oct).
   45-pull fails if a difference appears that isn't listed here, or a listed
   one goes away, so this list is always the true state. */
const S7 = 'John (9 Oct): session 7 builds it — ';
const DIFFERENCES = {
  'selected tab.borderBottomColor': 'accessible: X-Men\'s navy underline is 1.52:1 on the bar; Pull uses the same hue at 3:1',
  'search box.borderTopColor': 'accessible: X-Men\'s field outline is 1.53:1; Pull keeps the 3:1 control outline (--edge)',
  'era name.color': S7 + 'white on a solid era colour (the template\'s eras are pale washes, T-39)',
  'era name.effectiveColor': S7 + 'white on a solid era colour',
  'era years.color': S7 + 'white, as the era name',
  'era years.effectiveColor': S7 + 'white at 85 %, as X-Men',
  'era stats.effectiveColor': S7 + 'white on the strip',
  'era body.boxLeft': S7 + 'the open body sits 12 px from the edge, as the era box',
  'era body.boxWidth': S7 + 'as above (369 vs 361 px)',
  'era body.paddingTop': S7 + 'a 6 px inset',
  'era body.paddingLeft': S7 + 'a 6 px inset',
  'era body.borderLeftWidth': S7 + 'a 2 px line frame left, right and bottom',
  'era body.borderLeftColor': S7 + 'the frame is the line colour',
  'era body.borderBottomWidth': S7 + 'the frame\'s bottom edge',
  'era body.borderBottomLeftRadius': S7 + 'the frame\'s rounded foot (8 px)',
  'era box.boxLeft': S7 + 'era boxes sit 12 px from the edge (the template\'s 16)',
  'era box.boxWidth': S7 + 'as above (369 vs 361 px)',
  'era box.borderBottomLeftRadius': S7 + 'the folder tab\'s corners are 8 8 3 3',
  'era box.borderBottomRightRadius': S7 + 'as above',
  'era box.borderTopWidth': S7 + 'no outline: the solid colour is the box',
  'era box.boxShadow': S7 + 'X-Men\'s shadow, ink at 8 % and 6 %',
  'era spacing.gapAbove': S7 + 'era boxes 14 px apart (the template\'s 10)',
  'era tab.paddingTop': S7 + 'the tab\'s padding is 12 44 12 16',
  'era tab.paddingRight': S7 + 'as above: 44 px keeps text clear of the cut',
  'era tab.paddingBottom': S7 + 'as above',
  'era tab.paddingLeft': S7 + 'as above',
  'era strip.paddingTop': S7 + 'the stats strip under the tab (6 16)',
  'era strip.paddingRight': S7 + 'as above',
  'era strip.paddingBottom': S7 + 'as above',
  'era strip.paddingLeft': S7 + 'as above',
  'era bar.backgroundColor': S7 + 'white at 25 % on the strip',
  'era bar.boxHeight': S7 + 'a 4 px bar',
  'era bar.borderTopLeftRadius': S7 + 'a round-ended bar',
  'era shape.cutTop': S7 + 'the tab\'s right edge slants from 88 % at the top',
  'era shape.cutMiddle': S7 + 'as above, through the middle',
  'era shape.fill': S7 + 'the era\'s own colour (Foundations #A6791E here)',
  'era shape.strip': S7 + 'the strip: each channel of the era\'s colour −25 (#8D6005)',
  'era shape.hatch': S7 + 'a hatched corner, black at 12 %',
  'read mark.boxWidth': 'John (9 Oct): the mark keeps the accessible 24 px minimum, with the Button size setting (--tap)',
  'read mark.boxHeight': 'John (9 Oct): as the width (22 px in X-Men, --tap here)',
  'read mark.borderTopLeftRadius': 'John (9 Oct): the mark\'s shape stays with the Marks setting (--mark-radius)',
};

/* In-page: the computed values for one side of the map. Colours become
   rgba() strings through a canvas, so "rgb(1, 2, 3)" and "#010203" compare equal.
   effectiveColor is the text colour with its alpha times every opacity above it
   (X-Men's years are white at opacity .85); gapAbove is the space between an
   era box and the open body before it. */
function measure(map, side, page) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgbA = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  const str = d => 'rgba(' + [d[0], d[1], d[2], +(d[3] / 255).toFixed(2)].join(', ') + ')';
  const rgb = c => str(rgbA(c));
  const pick = sel => { const m = /^(.*)@(\d+)$/.exec(sel); return m ? document.querySelectorAll(m[1])[+m[2] - 1] || null : document.querySelector(sel); };
  const out = {};
  for (const [what, xm, tpl, props, pg] of map) {
    if (side === 'template' && (pg || 'main') !== page) continue;
    const el = pick(side === 'x-men' ? xm : tpl);
    if (!el) { out[what] = null; continue; }
    const cs = getComputedStyle(el), v = {};
    for (const p of props) {
      let x = cs[p] === undefined ? null : cs[p];
      if (p === 'effectiveBackground') {
        x = 'rgba(0, 0, 0, 0)';
        for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (!/, 0\)$/.test(c)) { x = c; break; } }
      } else if (p === 'effectiveColor') {
        const d = rgbA(cs.color); let a = d[3] / 255;
        for (let e = el; e; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity);
        x = 'rgba(' + [d[0], d[1], d[2], +a.toFixed(2)].join(', ') + ')';
      } else if (p === 'gapAbove') {
        const top = el.getBoundingClientRect().top;
        const bodies = [...document.querySelectorAll('.era-body')].filter(b => b.getClientRects().length && b.getBoundingClientRect().bottom <= top + 0.5);
        x = bodies.length ? Math.round((top - bodies[bodies.length - 1].getBoundingClientRect().bottom) * 10) / 10 + 'px' : null;
      } else if (/^box(Left|Width|Height)$/.test(p)) { const r = el.getBoundingClientRect(); x = Math.round({ boxLeft: r.left, boxWidth: r.width, boxHeight: r.height }[p] * 10) / 10 + 'px'; }
      else if (/color$/i.test(p)) x = rgb(x);
      else if (p === 'boxShadow') x = x === 'none' ? 'none' : x.replace(/rgba?\([^)]*\)/g, c => rgb(c));
      else if (p === 'fontFamily') x = x.split(',')[0].replace(/["']/g, '').trim();
      else if (p === 'letterSpacing') x = x === 'normal' ? '0px' : x;
      else if (p === 'lineHeight' && x !== 'normal') x = (parseFloat(x) / parseFloat(cs.fontSize)).toFixed(2);
      v[p] = x;
    }
    out[what] = v;
  }
  return out;
}

/* The folder tab, read from a screenshot of the first era box (Node side: it
   needs the page's screenshot). Decoded by the page's own canvas, so no image
   library is needed. Returns SHAPE_PROPS, or null when there is no era box. */
async function shape(page, side) {
  const sel = SHAPE[side];
  const box0 = await page.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.scrollIntoView({ block: 'center' }); return true; }, sel.box);
  if (!box0) return null;
  await page.waitForTimeout(50);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async ([s, png]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + png; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const px = (x, y) => [...cx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const str = d => 'rgba(' + [d[0], d[1], d[2], 1].join(', ') + ')';
    const r = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
    const box = r(s.box), tab = r(s.tab) || box, strip = r(s.strip);
    const paperAt = px(2, tab.top + tab.height / 2);
    const paper = d => d.slice(0, 3).every((v, i) => Math.abs(v - paperAt[i]) <= 6);
    const cut = y => {
      for (let x = box.left + 10; x < box.right; x++) if (paper(px(x, y))) return Math.round((x - box.left) / box.width * 100) / 100;
      return 1;
    };
    const fill = px(box.left + 6, tab.top + tab.height / 2);
    let dark = 0, all = 0;
    for (let x = Math.ceil(box.right - 14); x < box.right - 1; x++) {
      for (let y = Math.ceil(tab.bottom - 8); y < tab.bottom - 1; y++) {
        const d = px(x, y);
        if (paper(d)) continue;
        all++;
        if (d[0] + d[1] + d[2] < fill[0] + fill[1] + fill[2] - 15) dark++;
      }
    }
    return { cutTop: cut(tab.top + 2), cutMiddle: cut(tab.top + tab.height / 2), cutBottom: cut(tab.bottom - 2), fill: str(fill),
             strip: strip ? str(px(box.left + 6, strip.top + strip.height / 2)) : null, hatch: all ? Math.round(dark / all * 10) / 10 : 0 };
  }, [sel, png]);
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

module.exports = { WIDTH, HEIGHT, MAP, SHAPE, SHAPE_PROPS, NEAR, DIFFERENCES, measure, shape, prepareXMen, prepareTemplate };
