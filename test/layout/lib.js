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
   build's generated files (data.js, sw.js, manifest.json) swapped in.
   override(path, text) serves different content for one path (a deploy);
   down(true) drops every request, so even the service worker's own fetches
   fail (Playwright's setOffline doesn't reach the worker); delay(test, ms)
   holds back the paths a test matches (a slow network for one file).
   { pages: true } sends GitHub Pages' caching headers: max-age=600, an ETag
   and Last-Modified, and 304 for a matching If-None-Match, so the browser's
   HTTP cache holds the previous deploy the way a phone's does. */
function serve(dataDir, opts) {
  opts = opts || {};
  const overrides = {}, delays = [];
  let isDown = false;
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (isDown) { req.socket.destroy(); return; }
      let f = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (f === '/') f = '/index.html';
      const hold = delays.filter(x => x[0](f)).reduce((m, x) => Math.max(m, x[1]), 0);
      if (hold) { setTimeout(send, hold); return; }
      send();
      function send() {
      if (overrides[f] !== undefined) return reply(TYPES[path.extname(f)] || 'text/plain', Buffer.from(overrides[f]));
      const gen = ['/data.js', '/sw.js', '/manifest.json'].includes(f) && dataDir && fs.existsSync(path.join(dataDir, f));
      const p = gen ? path.join(dataDir, f) : path.join(ROOT, f);
      if (!p.startsWith(ROOT) && !gen) { res.writeHead(403); return res.end(); }
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      reply(TYPES[path.extname(p)] || 'application/octet-stream', fs.readFileSync(p));
      }
      function reply(type, body) {
        if (!opts.pages) { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); return res.end(body); }
        const etag = '"' + require('crypto').createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
        const h = { 'content-type': type, 'cache-control': 'max-age=600', etag, 'last-modified': 'Thu, 08 Oct 2026 09:00:00 GMT' };
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
        res.writeHead(200, h); res.end(body);
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ url: 'http://localhost:' + server.address().port + '/', close: () => new Promise(r => server.close(r)),
      override: (p, text) => { overrides[p] = text; }, down: v => { isDown = !!v; },
      delay: (test, ms) => { delays.push([typeof test === 'string' ? f => f === test : f => test.test(f), ms]); }, undelay: () => { delays.length = 0; }, file: p => fs.readFileSync(p === '/sw.js' || p === '/data.js' ? path.join(dataDir, p) : path.join(ROOT, p), 'utf8') }));
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

/* Reachability on the current tab (V-5): every control that isn't hidden or
   inert is displayed, at least 24 x 24 px (WCAG 2.5.8; creator names inside a
   line of credits are the inline exception), in the viewport once scrolled to,
   and the element actually hit at its centre. Returns { n, bad }. */
async function reachability(page) {
  return page.evaluate(() => {
    const bad = [], els = [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter(el => !el.closest('[hidden]') && !el.closest('[inert]'));
    for (const el0 of els) {
      const el = el0.classList.contains('vh') ? el0.closest('label') : el0;     // a visually hidden file input is reached by its label
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const name = el.tagName.toLowerCase() + (el.dataset.act ? '[' + el.dataset.act + (el.dataset.k ? ':' + el.dataset.k : '') + ']' : el.id ? '#' + el.id : '');
      const inline = el.matches('.credits .cname');
      if (r.width < 1 || r.height < 1) bad.push(name + ' has no size');
      else if (!inline && (r.width < 24 || r.height < 24)) bad.push(name + ' is ' + Math.round(r.width) + ' × ' + Math.round(r.height) + ' px, under the 24 px target');
      else if (cs.visibility !== 'visible' || +cs.opacity === 0) bad.push(name + ' is invisible');
      else if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) bad.push(name + ' is off screen');
      else if (!hit || !(hit === el || el.contains(hit))) bad.push(name + ' is covered by ' + (hit ? hit.tagName.toLowerCase() + '.' + hit.className : 'nothing'));
    }
    return { n: els.length, bad };
  });
}
/* Visit each tab with everything open, calling fn(tab) on each. */
async function eachTab(page, fn) {
  for (const tab of ['list', 'reading', 'reviews', 'settings']) {
    if (tab === 'list') await openAll(page);
    else if (tab === 'settings') await openSettings(page);
    else await page.click('#tab-' + tab);
    await fn(tab);
  }
}

/* Poll an async in-page check until it is true (or ms pass); returns whether it
   came true. page.waitForFunction takes an async check's promise as truthy and
   returns at once, so a check that awaits (caches, registrations) needs this. */
async function poll(page, fn, arg, ms) {
  const until = Date.now() + (ms || 15000);
  for (;;) {
    if (await page.evaluate(fn, arg)) return true;
    if (Date.now() > until) return false;
    await new Promise(r => setTimeout(r, 100));
  }
}

module.exports = { browser, closeBrowser, serve, open, openAll, openSettings, rulesFor, reachability, eachTab, poll };
