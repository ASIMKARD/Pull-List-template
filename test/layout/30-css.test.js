/* Ask the browser, not grep: which rules match an element (grouped selectors
   that span lines are invisible to grep), and do the fonts really load. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, basic, loadData } = require('../lib/helpers');
const { serve, open, rulesFor, closeBrowser } = require('./lib');

module.exports = async function (t) {
  try {
    const srv = await serve(basic().out);
    // the shared fonts are checked in Paper; the basic fixture's signature skin brings one more face (below)
    const pg = await open(srv.url, { width: 390, storage: { 'fixture:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'paper' }) } });
    const { page } = pg;

    // ------------------------------------------------ the rule finder
    await page.addStyleTag({ content: '.nothing-here,\n#tabs\n{ outline-offset: 3px }' });
    let rules = await rulesFor(page, '#tabs');
    t.ok('the rule finder sees a grouped selector that spans lines (what grep misses)', rules.some(r => /nothing-here/.test(r.selector) && /outline-offset/.test(r.css)),
         JSON.stringify(rules));
    rules = await rulesFor(page, '.ptools .tool');
    t.ok('…and the real stylesheet\'s grouped rule for .tool', rules.some(r => /\.tool,\s*\.linkbtn/.test(r.selector)), JSON.stringify(rules.map(r => r.selector)));
    t.ok('…and no stylesheet is unreadable (served over http, not file://)', !rules.some(r => /^!unreadable/.test(r.selector)));

    // ------------------------------------------------ fonts
    const faces = await page.evaluate(async () => {
      await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
      return [...document.fonts].map(f => ({ family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status }));
    });
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    const declared = (css.match(/@font-face/g) || []).length;
    const shared = faces.filter(f => f.family !== 'Fixture Signal');
    t.ok('every @font-face in styles.css is known to the page (' + declared + '), plus the signature skin\'s one',
         shared.length === declared && declared === 12 && faces.length === 13, JSON.stringify(faces));
    t.eq('…and every font file loads (no 404s), the signature skin\'s too', faces.filter(f => f.status !== 'loaded').map(f => f.family + ' ' + f.weight), []);
    t.eq('the three shared families are Anton, IBM Plex Sans and IBM Plex Mono', [...new Set(shared.map(f => f.family))].sort(), ['Anton', 'IBM Plex Mono', 'IBM Plex Sans']);
    const used = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily, title: getComputedStyle(document.querySelector('.ptitle')).fontFamily,
      bodyOk: document.fonts.check('400 15px "IBM Plex Sans"'), titleOk: document.fonts.check('400 28px Anton')
    }));
    t.ok('the body is set in IBM Plex Sans and the title in Anton, both loaded', /^"?IBM Plex Sans/.test(used.body) && /^"?Anton/.test(used.title) && used.bodyOk && used.titleOk,
         JSON.stringify(used));
    const files = fs.readdirSync(path.join(ROOT, 'fonts')).filter(f => f.endsWith('.woff2'));
    t.eq('every vendored font file has an @font-face (none shipped unused)', files.filter(f => css.indexOf('./fonts/' + f) === -1), []);
    t.eq('no page errors (fonts)', pg.errors, []);
    await pg.close();
    // the signature skin's own face, from config: declared once, loaded, and setting the title
    const sg = await open(srv.url, { width: 390 });
    const sig = await sg.page.evaluate(async () => {
      await document.fonts.ready;
      return { skin: document.documentElement.getAttribute('data-skin'), title: getComputedStyle(document.querySelector('.ptitle')).fontFamily,
               loaded: document.fonts.check('500 28px "Fixture Signal"'), n: [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'Fixture Signal').length };
    });
    t.ok('in the signature skin the title is set in its own face, declared once and loaded (' + loadData(basic().out).signature.name + ')',
         sig.skin === 'signature' && /^"?Fixture Signal/.test(sig.title) && sig.loaded && sig.n === 1, JSON.stringify(sig));
    t.eq('no page errors (signature fonts)', sg.errors, []);
    await sg.close();
    await srv.close();
  } finally { await closeBrowser(); }
};
