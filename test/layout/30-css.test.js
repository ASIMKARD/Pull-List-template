/* Ask the browser, not grep: which rules match an element (grouped selectors
   that span lines are invisible to grep), and do the fonts really load. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, basic } = require('../lib/helpers');
const { serve, open, rulesFor, closeBrowser } = require('./lib');

module.exports = async function (t) {
  try {
    const srv = await serve(basic().out);
    const pg = await open(srv.url, { width: 390 });
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
    t.ok('every @font-face in styles.css is known to the page (' + declared + ')', faces.length === declared && declared === 12, JSON.stringify(faces));
    t.eq('…and every font file loads (no 404s)', faces.filter(f => f.status !== 'loaded').map(f => f.family + ' ' + f.weight), []);
    t.eq('the three families are Anton, IBM Plex Sans and IBM Plex Mono', [...new Set(faces.map(f => f.family))].sort(), ['Anton', 'IBM Plex Mono', 'IBM Plex Sans']);
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
    await srv.close();
  } finally { await closeBrowser(); }
};
