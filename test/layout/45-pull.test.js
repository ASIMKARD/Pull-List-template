/* Pull = X-Men (John, 6 Oct), measured side by side at 393 px in real
   Chromium. The reference (ref/x-men.json) was captured from the read-only
   X-Men tracker by ref/capture-x-men.js; ref/pull-map.js says which X-Men
   element each template element is measured against. Colours, families,
   weights, case and style must be exact; sizes within 0.5 px. What can't
   match without breaking a rule is listed in DIFFERENCES with the reason, and
   this suite keeps that list true in both directions. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, basic } = require('../lib/helpers');
const { serve, open, closeBrowser } = require('./lib');
const { WIDTH, HEIGHT, MAP, DIFFERENCES, measure, prepareTemplate } = require('./ref/pull-map');
const REF = require('./ref/x-men.json');

const SIZE = /^(fontSize|letterSpacing|borderBottomWidth|border\w*Radius|box\w+)$/;
const same = (prop, a, b) => SIZE.test(prop) && /px$/.test(a) && /px$/.test(b) ? Math.abs(parseFloat(a) - parseFloat(b)) <= 0.5 : a === b;

module.exports = async function (t) {
  try {
    // ------------------------------------------------ the reference
    t.ok('the reference names its source, commit and width (X-Men ' + String(REF.commit).slice(0, 7) + ', ' + REF.width + ' px)',
         REF.source === 'ASIMKARD/X-men' && /^[0-9a-f]{40}$/.test(REF.commit) && REF.width === WIDTH);
    t.eq('…and holds every mapped element and property', MAP.filter(([what, , , props]) => !REF.styles[what] || props.some(p => REF.styles[what][p] == null)).map(m => m[0]), []);

    // ------------------------------------------------ Pull, measured the same way
    const srv = await serve(basic().out);
    const pg = await open(srv.url, { width: WIDTH, height: HEIGHT, reducedMotion: 'reduce',
      storage: { 'fixture:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'pull' }) } });
    await prepareTemplate(pg.page);
    const skin = await pg.page.evaluate(() => document.documentElement.getAttribute('data-skin'));
    const got = await pg.page.evaluate(([fn, map]) => eval('(' + fn + ')')(map, 'template'), [measure.toString(), MAP]);
    t.eq('the page is in Pull, at ' + WIDTH + ' px', skin, 'pull');
    const differ = [], matched = [];
    for (const [what, , , props] of MAP) {
      for (const p of props) {
        const a = REF.styles[what] && REF.styles[what][p], b = got[what] && got[what][p];
        (same(p, a, b) ? matched : differ).push({ k: what + '.' + p, a, b });
      }
    }
    const unlisted = differ.filter(d => !DIFFERENCES[d.k]).map(d => d.k + ': X-Men ' + d.a + ', Pull ' + d.b);
    t.eq('Pull matches X-Men in ' + matched.length + ' measured properties (header, tabs, era boxes, arc heads, rows, search): colours, fonts, weights and case exact, sizes within 0.5 px',
         unlisted, []);
    const gone = Object.keys(DIFFERENCES).filter(k => !differ.some(d => d.k === k));
    t.eq('the ' + Object.keys(DIFFERENCES).length + ' recorded differences are still the only ones (each one still differs, so the list stays true)', gone, []);
    t.ok('…every difference says why: accessible (a contrast rule) or John (layout, data or a setting)',
         Object.values(DIFFERENCES).every(v => /^(accessible|John): .{10,}/.test(v)));
    const exact = ['title', 'tab', 'selected tab', 'era name', 'arc name', 'row title'].map(w => [w, got[w].fontFamily, got[w].fontWeight, got[w].textTransform]);
    t.eq('…for instance the type: Anton 700 uppercase title, Plex Sans 600 uppercase tabs, Anton era names, Plex Sans 600 arcs and 500 rows', exact,
         [['title', 'Anton', '700', 'uppercase'], ['tab', 'IBM Plex Sans', '600', 'uppercase'], ['selected tab', 'IBM Plex Sans', '600', 'uppercase'],
          ['era name', 'Anton', '400', 'uppercase'], ['arc name', 'IBM Plex Sans', '600', 'none'], ['row title', 'IBM Plex Sans', '500', 'none']]);
    t.eq('no page errors (Pull)', pg.errors, []);
    await pg.close();
    await srv.close();

    // ------------------------------------------------ session-only: is the reference still X-Men?
    const local = process.env.X_MEN_DIR || path.join(ROOT, '..', 'X-men');
    if (fs.existsSync(path.join(local, 'index.html'))) {
      const { capture } = require('./ref/capture-x-men');
      const fresh = await capture(local);
      const drift = MAP.flatMap(([what, , , props]) => props.filter(p => (fresh.styles[what] || {})[p] !== REF.styles[what][p]).map(p => what + '.' + p));
      t.eq('a fresh capture of the local X-Men copy (' + fresh.commit.slice(0, 7) + ') matches the reference (' + REF.commit.slice(0, 7) + ')', drift, []);
    } else {
      t.ok('no local X-Men copy here (CI): the reference stands as recorded from ' + REF.commit.slice(0, 7), true);
    }
  } finally { await closeBrowser(); }
};
