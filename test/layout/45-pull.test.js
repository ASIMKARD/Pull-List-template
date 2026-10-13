/* Pull = X-Men (John, 6 Oct), measured side by side at 393 px in real
   Chromium. The reference (ref/x-men.json) was captured from the read-only
   X-Men tracker by ref/capture-x-men.js; ref/pull-map.js says which X-Men
   element each template element is measured against. Colours, families,
   weights, case and style must be exact; sizes within 0.5 px. What can't
   match without breaking a rule is listed in DIFFERENCES with the reason, and
   this suite keeps that list true in both directions.
   Session 7: the era boxes (X-Men's folder tab) are measured in full, on a
   fixture whose eras are top-level as X-Men's are, and the tab's shape is
   read from pixels. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, basic, noPeriods } = require('../lib/helpers');
const { serve, open, closeBrowser } = require('./lib');
const { WIDTH, HEIGHT, MAP, SHAPE_PROPS, NEAR, DIFFERENCES, measure, shape, prepareTemplate } = require('./ref/pull-map');
const REF = require('./ref/x-men.json');

const SIZE = /^(fontSize|letterSpacing|border\w*Width|border\w*Radius|box(Left|Width|Height)|padding\w+|gapAbove)$/;
const same = (prop, a, b) => {
  if (NEAR[prop] !== undefined) return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= NEAR[prop];
  return SIZE.test(prop) && /px$/.test(a) && /px$/.test(b) ? Math.abs(parseFloat(a) - parseFloat(b)) <= 0.5 : a === b;
};

module.exports = async function (t) {
  try {
    // ------------------------------------------------ the reference
    t.ok('the reference names its source, commit and width (X-Men ' + String(REF.commit).slice(0, 7) + ', ' + REF.width + ' px)',
         REF.source === 'ASIMKARD/X-men' && /^[0-9a-f]{40}$/.test(REF.commit) && REF.width === WIDTH);
    t.eq('…and holds every mapped element and property', MAP.filter(([what, , , props]) => !REF.styles[what] || props.some(p => REF.styles[what][p] == null)).map(m => m[0]), []);
    t.eq('…and the folder tab\'s shape, read from pixels', SHAPE_PROPS.filter(p => !REF.shape || REF.shape[p] == null), []);

    // ------------------------------------------------ Pull, measured the same way: the basic fixture, and one
    // without bands for the era boxes (X-Men's eras are top-level)
    const got = {}, errors = [], skins = [];
    let eraShape = null;
    for (const [page, built, key] of [['main', basic(), 'fixture'], ['eras', noPeriods(), 'fixture-np']]) {
      const srv = await serve(built.out);
      const pg = await open(srv.url, { width: WIDTH, height: HEIGHT, reducedMotion: 'reduce',
        storage: { [key + ':v3:settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'pull' }) } });
      await prepareTemplate(pg.page);
      skins.push(await pg.page.evaluate(() => document.documentElement.getAttribute('data-skin')));
      Object.assign(got, await pg.page.evaluate(([fn, map, page]) => eval('(' + fn + ')')(map, 'template', page), [measure.toString(), MAP, page]));
      if (page === 'eras') eraShape = await shape(pg.page, 'template');
      errors.push(...pg.errors);
      await pg.close();
      await srv.close();
    }
    t.eq('both pages are in Pull, at ' + WIDTH + ' px', skins, ['pull', 'pull']);
    const differ = [], matched = [];
    for (const [what, , , props] of MAP) {
      for (const p of props) {
        const a = REF.styles[what] && REF.styles[what][p], b = got[what] && got[what][p];
        (same(p, a, b) ? matched : differ).push({ k: what + '.' + p, a, b });
      }
    }
    for (const p of SHAPE_PROPS) {
      const a = REF.shape[p], b = eraShape && eraShape[p];
      (same(p, a, b) ? matched : differ).push({ k: 'era shape.' + p, a, b });
    }
    const unlisted = differ.filter(d => !DIFFERENCES[d.k]).map(d => d.k + ': X-Men ' + d.a + ', Pull ' + d.b);
    t.eq('Pull matches X-Men in ' + matched.length + ' measured properties (header, tabs, era boxes and their shape, arc heads, rows, search): colours, fonts, weights and case exact, sizes within 0.5 px',
         unlisted, []);
    const gone = Object.keys(DIFFERENCES).filter(k => !differ.some(d => d.k === k));
    t.eq('the ' + Object.keys(DIFFERENCES).length + ' recorded differences are still the only ones (each one still differs, so the list stays true)', gone, []);
    t.ok('…every difference says why: accessible (a contrast rule) or John (layout, data or a setting)',
         Object.values(DIFFERENCES).every(v => /^(accessible|John( \(\d{1,2} [A-Z][a-z]{2}\))?): .{10,}/.test(v)));
    const exact = ['title', 'tab', 'selected tab', 'era name', 'arc name', 'row title'].map(w => [w, got[w].fontFamily, got[w].fontWeight, got[w].textTransform]);
    t.eq('…for instance the type: Anton 700 uppercase title, Plex Sans 600 uppercase tabs, Anton era names, Plex Sans 600 arcs and 500 rows', exact,
         [['title', 'Anton', '700', 'uppercase'], ['tab', 'IBM Plex Sans', '600', 'uppercase'], ['selected tab', 'IBM Plex Sans', '600', 'uppercase'],
          ['era name', 'Anton', '400', 'uppercase'], ['arc name', 'IBM Plex Sans', '600', 'none'], ['row title', 'IBM Plex Sans', '500', 'none']]);
    t.eq('no page errors (Pull)', errors, []);

    // ------------------------------------------------ session-only: is the reference still X-Men?
    const local = process.env.X_MEN_DIR || path.join(ROOT, '..', 'X-men');
    if (fs.existsSync(path.join(local, 'index.html'))) {
      const { capture } = require('./ref/capture-x-men');
      const fresh = await capture(local);
      const drift = MAP.flatMap(([what, , , props]) => props.filter(p => (fresh.styles[what] || {})[p] !== REF.styles[what][p]).map(p => what + '.' + p))
        .concat(SHAPE_PROPS.filter(p => (fresh.shape || {})[p] !== REF.shape[p]).map(p => 'era shape.' + p));
      t.eq('a fresh capture of the local X-Men copy (' + fresh.commit.slice(0, 7) + ') matches the reference (' + REF.commit.slice(0, 7) + ')', drift, []);
    } else {
      t.ok('no local X-Men copy here (CI): the reference stands as recorded from ' + REF.commit.slice(0, 7), true);
    }
  } finally { await closeBrowser(); }
};
