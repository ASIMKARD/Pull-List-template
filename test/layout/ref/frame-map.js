/* The v9 frame, measured (John, 25 Oct: Absolute's own skin must look and work
   exactly as it does in v9). Shared by capture-frame.js (session-only: it
   records a reference) and test/layout/47-frame-v9, so both measure the same.

   A signature skin with "frame": "v9" is drawn on the template's arrangement as
   it was up to v9. This records every visible element in five views (the
   landing, an era open, an arc's rows, scrolled, the Reading tab) at 320, 390
   and 1024 px: where it is, how big, and how it looks, its ::before and
   ::after decorations included. 47-frame-v9 compares that with the recorded
   reference exactly (positions and sizes within 0.5 px), so a later template
   change can't move or restyle anything on that frame. An inline element's
   width follows its text, so only its position is kept. */
'use strict';
const fs = require('fs');
const path = require('path');

const WIDTHS = [320, 390, 1024];
const HEIGHTS = { 320: 568, 390: 844, 1024: 768 };
const VIEWS = ['landing', 'era', 'rows', 'scrolled', 'reading'];
const SCROLL = 300;

const LOOK = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'textDecorationLine', 'color',
  'backgroundColor', 'backgroundImage', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius', 'boxShadow',
  'opacity', 'position', 'zIndex', 'textAlign', 'lineHeight', 'whiteSpace'];
const PSEUDO = ['content', 'color', 'fontFamily', 'fontSize', 'position', 'top', 'right', 'bottom', 'left', 'backgroundColor', 'boxShadow'];

/* The state both pages start in, seeded before load from the data's own ids:
   the first issue read (with a review), the second reading, the third skipped,
   the fourth bookmarked; the signature skin. */
function seed(D) {
  const k = D.franchise.key + ':v3:', ids = D.ids;
  return {
    [k + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'signature' }),
    [k + 'progress']: JSON.stringify({ marks: { [ids[0]]: 'read', [ids[1]]: 'reading', [ids[2]]: 'skip' }, bookmarks: [ids[3]] }),
    [k + 'issue-reviews']: JSON.stringify({ [ids[0]]: { r: 4, t: 'A review for the frame check.' } }),
  };
}

const pause = page => page.waitForTimeout(80);
const DRIVE = {
  async landing(page) { await page.waitForSelector('.era-head'); await page.evaluate(() => document.fonts.ready); await pause(page); },
  async era(page) { await page.click('.era-head'); await page.waitForSelector('.era-body:not([hidden]) .row'); await pause(page); },
  async rows(page) {
    await page.evaluate(() => { const r = document.querySelector('.era-body:not([hidden]) .row'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 160); });
    await pause(page);
  },
  async scrolled(page) { await page.evaluate(y => scrollTo(0, y), SCROLL); await pause(page); },
  async reading(page) { await page.evaluate(() => scrollTo(0, 0)); await page.click('#tab-reading'); await pause(page); },
};

/* Symbols drawn the same on every machine. IBM Plex and Anton have no ★ ✎ ↗ ✓
   and the like, so each machine drew them from its own fonts, and a box holding
   one was a few px wider or taller in CI (28 Oct). Every page measured here draws
   them from one face (ref/frame-symbols.woff2, a subset of DejaVu Sans; its
   licence beside it), added beside every face the page declares, with its
   family, weight and style: a face of its own weight would win the match for
   bold text and send the letters to a system font. */
const SYMBOLS = fs.readFileSync(path.join(__dirname, 'frame-symbols.woff2')).toString('base64');
const SYMBOL_RANGE = 'U+2190-21FF, U+2298, U+2460-24FF, U+25A0-25FF, U+2600-26FF, U+2700-27BF, U+27F0-27FF, U+29D7';
async function symbols(page) {
  await page.evaluate(async ([b64, range]) => {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer, seen = new Set();
    for (const f of [...document.fonts]) {
      const d = { weight: f.weight, style: f.style, stretch: f.stretch }, k = [f.family, d.weight, d.style, d.stretch].join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      const ff = new FontFace(f.family.replace(/["']/g, ''), buf, Object.assign({ unicodeRange: range }, d));
      document.fonts.add(ff);
      await ff.load();
    }
    await document.fonts.ready;
  }, [SYMBOLS, SYMBOL_RANGE]);
}

/* In-page: every visible element in the viewport, as { key: [box, look, before, after] }
   with the looks in a shared table. The key is the element's tag, id and
   classes plus its place among the page's elements with the same ones. */
function inventory(LOOK, PSEUDO) {
  const looks = [], index = new Map();
  const look = o => { const s = JSON.stringify(o); if (!index.has(s)) { index.set(s, looks.length); looks.push(o); } return index.get(s); };
  const seen = {}, out = {};
  const r1 = v => Math.round(v * 10) / 10;
  for (const el of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) continue;
    const sig = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].sort().map(c => '.' + c).join('');
    seen[sig] = (seen[sig] || 0) + 1;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const o = {};
    for (const p of LOOK) o[p] = p === 'fontFamily' ? cs[p].split(',')[0].replace(/["']/g, '').trim() : cs[p];
    const box = cs.display === 'inline' ? [r1(r.left), r1(r.top), null, r1(r.height)] : [r1(r.left), r1(r.top), r1(r.width), r1(r.height)];
    const ps = ['::before', '::after'].map(w => {
      const c = getComputedStyle(el, w);
      if (!c.content || c.content === 'none' || c.content === 'normal') return null;
      const q = {};
      for (const p of PSEUDO) q[p] = c[p];
      return look(q);
    });
    out[sig + '@' + seen[sig]] = [box, look(o), ps[0], ps[1]];
  }
  return { elements: out, looks, frame: document.documentElement.getAttribute('data-frame'), skin: document.documentElement.getAttribute('data-skin') };
}

/* One page through every view at one width: { view: inventory }. */
async function measurePage(page) {
  const out = {};
  await page.waitForSelector('.era-head');
  await symbols(page);
  for (const v of VIEWS) {
    await DRIVE[v](page);
    out[v] = await page.evaluate(([fn, L, P]) => eval('(' + fn + ')')(L, P), [inventory.toString(), LOOK, PSEUDO]);
  }
  return out;
}

/* Every difference between two measurements of the same view, readably. */
function compare(ref, got) {
  const diffs = [];
  const lookOf = (m, i) => i == null ? null : m.looks[i];
  for (const k of Object.keys(ref.elements)) if (!got.elements[k]) diffs.push(k + ': gone');
  for (const k of Object.keys(got.elements)) if (!ref.elements[k]) diffs.push(k + ': new');
  for (const k of Object.keys(ref.elements)) {
    const a = ref.elements[k], b = got.elements[k];
    if (!b) continue;
    a[0].forEach((v, i) => { if ((v == null) !== (b[0][i] == null) || (v != null && Math.abs(v - b[0][i]) > 0.5)) diffs.push(k + ': ' + ['left', 'top', 'width', 'height'][i] + ' ' + v + ' → ' + b[0][i]); });
    for (const [w, ia, ib] of [['look', a[1], b[1]], ['::before', a[2], b[2]], ['::after', a[3], b[3]]]) {
      const la = lookOf(ref, ia), lb = lookOf(got, ib);
      if (!la || !lb) { if (!la !== !lb) diffs.push(k + ': ' + w + (la ? ' gone' : ' new')); continue; }
      for (const p of Object.keys(la)) if (la[p] !== lb[p]) diffs.push(k + ': ' + w + ' ' + p + ' ' + JSON.stringify(la[p]) + ' → ' + JSON.stringify(lb[p]));
    }
  }
  // a reference from a build before frames (v9 itself) has no data-frame: the page must be on the v9 frame now
  if ((ref.frame || 'v9') !== got.frame || ref.skin !== got.skin) diffs.push('page: frame/skin ' + ref.frame + '/' + ref.skin + ' → ' + got.frame + '/' + got.skin);
  return diffs;
}

module.exports = { WIDTHS, HEIGHTS, VIEWS, SCROLL, LOOK, PSEUDO, seed, DRIVE, symbols, inventory, measurePage, compare };
