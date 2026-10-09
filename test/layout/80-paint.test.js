/* First paint (session 4, step 8; V-8 re-expressed per John's answer 2: one
   stylesheet plus a preloaded display font, measured rather than inlined).
   - The shell paints without waiting for the data or the fonts.
   - Only the display font is preloaded, and on a slow link it lands before
     first paint, so the title never swaps.
   - One stylesheet, the scripts deferred.
   - The signature skin (session 5) comes inside data.js and is added by the
     app, so it adds no request. Measured against a linked skin.css on the
     1.6 Mbps link: 864 vs 868 ms median first paint (7 runs each), a tie, so
     the one with no extra file won. */
'use strict';
const { basic, loadData } = require('../lib/helpers');
const { serve, browser, closeBrowser } = require('./lib');

module.exports = async function (t) {
  try {
    const b = await browser(), srv = await serve(basic().out);
    const load = async (opts) => {
      srv.undelay();
      if (opts.delay) srv.delay(opts.delay, 2000);
      const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      if (opts.slow) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
      }
      await page.goto(srv.url, { waitUntil: opts.delay ? 'commit' : 'load' });
      await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length, null, { timeout: 15000 });
      const m = await page.evaluate(() => {
        const res = performance.getEntriesByType('resource'), end = n => Math.round((res.find(x => x.name.includes(n)) || {}).responseEnd || 0);
        return { fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime), anton: end('anton-400-latin'),
                 loading: /Loading the checklist/.test((document.querySelector('#app') || {}).textContent || ''),
                 tabs: (document.querySelector('#tabs') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height };
      });
      await ctx.close();
      return m;
    };
    const html = srv.file('/index.html');
    const preloads = (html.match(/<link rel="preload"[^>]*>/g) || []);
    t.ok('one stylesheet, and both scripts deferred', (html.match(/rel="stylesheet"/g) || []).length === 1 &&
         /<script defer src="\.\/data\.js\?v=[0-9a-f]{12}"><\/script>/.test(html) && /<script defer src="\.\/app\.js\?v=[0-9a-f]{12}"><\/script>/.test(html));
    t.ok('only the display font is preloaded, as a font, with crossorigin (a preload without it is fetched twice)',
         preloads.length === 1 && /anton-400-latin\.woff2" as="font" type="font\/woff2" crossorigin/.test(preloads[0]), preloads.join(' '));
    let m = await load({ delay: '/data.js' });
    t.ok('data.js 2 s late: the shell (header, tabs, "Loading the checklist…") paints at once (' + m.fcp + ' ms)', m.fcp < 1000 && m.loading && m.tabs > 0, JSON.stringify(m));
    m = await load({ delay: /\.woff2$/ });
    t.ok('every font 2 s late: the page still paints at once (' + m.fcp + ' ms)', m.fcp < 1000, JSON.stringify(m));
    /* paint timing can't see invisible text (glyphs outside the font's range
       paint in a system face either way), so ask the browser's CSSOM */
    const ctx = await b.newContext({ serviceWorkers: 'block' }), pg = await ctx.newPage();
    await pg.goto(srv.url);
    const display = await pg.evaluate(() => [...document.styleSheets].flatMap(sh => [...sh.cssRules]).filter(r => r.type === CSSRule.FONT_FACE_RULE)
      .map(r => r.style.getPropertyValue('font-display')));
    const sigReq = await pg.evaluate(() => ({ styles: performance.getEntriesByType('resource').filter(x => /\.css(\?|$)/.test(x.name)).map(x => x.name.replace(/^.*\//, '').replace(/\?v=[0-9a-f]{12}$/, '')),
                                             inline: (document.querySelector('style#skin-signature') || {}).textContent || '' }));
    await ctx.close();
    const sigFaces = (loadData(basic().out).signature.css.match(/@font-face/g) || []).length;
    t.ok('…because every @font-face swaps, the signature skin\'s too: text shows in the fallback face, never invisible while the font loads (' + display.length + ' faces)',
         sigFaces === 1 && display.length === 12 + sigFaces && display.every(x => x === 'swap'), display.join(','));
    t.ok('the signature skin adds no stylesheet request: its CSS comes inside data.js', JSON.stringify(sigReq.styles) === '["styles.css"]' &&
         sigReq.inline === loadData(basic().out).signature.css, JSON.stringify(sigReq.styles));
    const slow = [await load({ slow: true }), await load({ slow: true }), await load({ slow: true })].sort((x, y) => x.fcp - y.fcp)[1];
    t.ok('a 1.6 Mbps link: the display font lands by first paint, so the title never swaps (font ' + slow.anton + ' ms, paint ' + slow.fcp + ' ms)',
         slow.anton > 0 && slow.anton <= slow.fcp, JSON.stringify(slow));
    t.ok('…and first paint stays within 1.5 s on that link', slow.fcp < 1500, JSON.stringify(slow));
    await srv.close();
  } finally { await closeBrowser(); }
};
