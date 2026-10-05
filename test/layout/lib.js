/* Real-browser layout harness (session 4, step 3). jsdom has no layout engine,
   so anything about size, overlap, scrolling, fonts or motion is measured here
   in real Chromium, never reasoned about (CLAUDE.md).

     npm run test:layout          # = HARNESS_SUITES=test/layout node test/run.js

   The same runner as the jsdom harness: any failure, any crash or zero
   assertions fails the run. No browser is a crash with a clear message, never
   a silent skip. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { ROOT } = require('../lib/helpers');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
                '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* Chromium: CHROMIUM_PATH if set, else Playwright's own (PLAYWRIGHT_BROWSERS_PATH
   in cloud sessions, the CI install otherwise), else /opt/pw-browsers/chromium. */
let browserP = null;
function browser() {
  if (browserP) return browserP;
  const { chromium } = require('playwright-core');
  const tries = [];
  if (process.env.CHROMIUM_PATH) tries.push(process.env.CHROMIUM_PATH);
  tries.push(undefined);
  if (fs.existsSync('/opt/pw-browsers/chromium')) tries.push('/opt/pw-browsers/chromium');
  browserP = (async () => {
    const errs = [];
    for (const executablePath of tries) {
      try { return await chromium.launch({ executablePath }); } catch (e) { errs.push((executablePath || 'playwright default') + ': ' + e.message.split('\n')[0]); }
    }
    throw new Error('No Chromium available for the layout suite, so nothing visual was checked. Tried ' + errs.join(' | '));
  })();
  return browserP;
}
async function closeBrowser() { if (browserP) { const b = await browserP.catch(() => null); browserP = null; if (b) await b.close(); } }

/* Serve the repo root over http://localhost (cssRules throws on file://), with a
   build's generated files (data.js, sw.js, manifest.json) swapped in. */
function serve(dataDir) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let f = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (f === '/') f = '/index.html';
      const gen = ['/data.js', '/sw.js', '/manifest.json'].includes(f) && dataDir && fs.existsSync(path.join(dataDir, f));
      const p = gen ? path.join(dataDir, f) : path.join(ROOT, f);
      if (!p.startsWith(ROOT) && !gen) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: 'http://localhost:' + server.address().port + '/', close: () => new Promise(r => server.close(r)) }));
  });
}

/* A page at a width, with storage seeded BEFORE load (CLAUDE.md: writing it
   while the page is open is overwritten by the pagehide flush). Collects page
   errors and console errors (L-9). */
async function open(url, opts) {
  opts = opts || {};
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: opts.width || 390, height: opts.height || 800 },
                                   reducedMotion: opts.reducedMotion || 'no-preference' });
  if (opts.storage) {
    await ctx.addInitScript(s => { if (!sessionStorage.getItem('__seeded')) { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); sessionStorage.setItem('__seeded', '1'); } }, opts.storage);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { page, ctx, errors, close: () => ctx.close() };
}

/* Open things the way a person does: tap each closed head. */
async function openAll(page) {
  await page.evaluate(() => {
    const tap = sel => { let h, n = 0; while ((h = document.querySelector(sel)) && n++ < 30) h.click(); };
    document.querySelector('#tab-list').click();
    const p = document.querySelector('[data-act="panel"]');
    if (p.getAttribute('aria-expanded') !== 'true') p.click();
    tap('#fsecs .sec-head[aria-expanded="false"]');
    document.querySelector('.ptools [data-act="expand-all"]').click();
  });
}
async function openSettings(page) {
  await page.evaluate(() => {
    document.querySelector('#tab-settings').click();
    let h, n = 0;
    while ((h = document.querySelector('#settings .sec-head[aria-expanded="false"]')) && n++ < 30) h.click();
  });
}

/* Which stylesheet rules match an element (grep can't see grouped selectors
   that span lines: ask the browser). Walks @media blocks whose media match. */
async function rulesFor(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel), out = [];
    if (!el) return null;
    const walk = rules => {
      for (const r of rules) {
        if (r.type === CSSRule.MEDIA_RULE) { if (window.matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; }
        if (r.selectorText && el.matches(r.selectorText)) out.push({ selector: r.selectorText, css: r.style.cssText });
      }
    };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { out.push({ selector: '!unreadable ' + sh.href, css: '' }); } }
    return out;
  }, selector);
}

module.exports = { browser, closeBrowser, serve, open, openAll, openSettings, rulesFor };
