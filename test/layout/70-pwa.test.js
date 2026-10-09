/* The real service worker (session 4, step 7; F-35…F-38, F-59, D-2 live).
   CLAUDE.md: network-first for the shell, cache-first for fonts and icons,
   skipWaiting + clients.claim, every precached path exists, and every fetch
   path ends in a real Response (iOS shows a blank page otherwise). */
'use strict';
const fs = require('fs');
const path = require('path');
const { basic } = require('../lib/helpers');
const { serve, open, openSettings, closeBrowser, poll } = require('./lib');

const seed = { 'fixture:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };

module.exports = async function (t) {
  try {
    const b = basic(), srv = await serve(b.out);
    /* One GitHub Pages user site holds every tracker, and they share one cache
       storage. Seed it the way a phone has it: another tracker's v2 and v3
       caches, and this tracker's own v2 cache, before this worker arrives. */
    const OTHERS = ['spider-man-v12', 'idw-sonic-0123456789ab'], OWN_OLD = 'fixture-v7';
    srv.override('/blank.html', '<!doctype html><title>blank</title>');
    const pg = await open(srv.url + 'blank.html', { width: 390, reducedMotion: 'reduce', storage: seed });
    const page = pg.page;
    await page.evaluate(async names => { for (const n of names) await (await caches.open(n)).put('/seeded', new Response(n)); }, OTHERS.concat(OWN_OLD));
    await page.goto(srv.url);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
    await poll(page, o => caches.has(o).then(h => !h), OWN_OLD, 5000);
    const info = await page.evaluate(async () => ({ keys: (await caches.keys()).sort(), n: (await (await caches.open(window.TRACKER_DATA.cache)).keys()).length,
      want: window.TRACKER_DATA.precache.length, cache: window.TRACKER_DATA.cache }));
    t.ok('the worker installs, claims the page and fills its cache: every precached file, fonts and icons included (F-59, D-2)',
         info.keys.includes(info.cache) && info.n >= info.want, JSON.stringify(info));
    t.eq('…and on a shared origin it removes only its own earlier cache: other trackers\' caches stay',
         info.keys, OTHERS.concat(info.cache).sort());
    await openSettings(page);
    await page.waitForFunction(() => document.querySelector('#offState') && document.querySelector('#offState').dataset.ready === '1', null, { timeout: 5000 });
    t.ok('Settings → Offline reports it: "Ready offline · N of N files saved" (F-35)',
         new RegExp('Ready offline · ' + info.want + ' of ' + info.want + ' files saved').test(await page.textContent('#offState')));

    // ------------------------------------------------ offline: the app boots from the cache
    // the server drops every request (the worker's fetches too) and the page reads offline
    srv.down(true);
    await pg.ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.era-head', { state: 'attached' });   // it reopens on the remembered tab
    const off = await page.evaluate(() => ({ title: document.querySelector('#wordmark').textContent, eras: document.querySelectorAll('.era-head').length,
      body: document.body.classList.contains('offline'), mark: !document.querySelector('#netState').hidden, online: navigator.onLine }));
    t.ok('offline, a reload boots the whole app from the cache', off.title.length > 0 && off.eras > 0 && off.online === false, JSON.stringify(off));
    t.ok('…and marks the page offline (body class, header mark) without a listener (F-36)', off.body && off.mark);
    await openSettings(page);
    await page.click('[data-act="sync-show"]');
    // wait for the box's final state: it starts out saying "Making the QR code…" while qrcode.js loads
    await page.waitForFunction(() => { const q = document.querySelector('#qrbox'); return q && (q.querySelector('svg') || !/Making the QR code/.test(q.textContent)); },
                               null, { timeout: 10000 }).catch(() => null);
    t.ok('…the QR still draws offline: qrcode.js comes from the cache', !!(await page.$('#qrbox svg')), await page.textContent('#qrbox'));
    const responses = await page.evaluate(async () => {
      const r = async u => { try { const x = await fetch(u); return x.status; } catch (e) { return 'network error'; } };
      return { icon: await r('./icons/not-there.png'), shellQuery: await r('./index.html?v=2'), font: await r('./fonts/ibm-plex-sans-400-latin.woff2'),
               page: (await (await fetch('./index.html?v=3')).text()).includes('id="stack"') };
    });
    t.eq('offline, every fetch ends in a real Response: a missing file 504, a shell page falls back to the app, a font from the cache',
         responses, { icon: 504, shellQuery: 200, font: 200, page: true });
    t.eq('no page errors offline (L-9)', pg.errors.filter(e => !/Failed to load resource/.test(e)), []);

    // ------------------------------------------------ back online: network-first shows a deploy at once
    srv.down(false);
    await pg.ctx.setOffline(false);
    srv.override('/index.html', srv.file('/index.html').replace('<title>', '<meta name="x-deploy" content="2">\n<title>'));
    await page.reload();
    t.ok('online, a plain reload shows a new deploy at once: the shell is network-first, never a stale cache',
         (await page.$('meta[name="x-deploy"]')) !== null);

    // ------------------------------------------------ an update (F-38, XM-7)
    const nextCache = 'fixture-next';
    srv.override('/sw.js', srv.file('/sw.js').replace(/const CACHE = '[^']+';/, "const CACHE = '" + nextCache + "';"));
    await openSettings(page);
    await page.click('[data-act="sw-check"]');
    await page.waitForFunction(() => /A new version is ready/.test(document.querySelector('#toastMsg').textContent), null, { timeout: 15000 });
    t.ok('Check for updates finds the new worker; once it is active: "A new version is ready" with Reload',
         (await page.textContent('#toastAct')) === 'Reload' && !!(await page.$('[data-act="sw-reload"]')));
    await poll(page, async n => (await caches.keys()).includes(n) && (await caches.keys()).length === 3, nextCache, 5000);
    t.eq('…and the old cache is gone: only the new one remains (beside the other trackers\')', await page.evaluate(async () => (await caches.keys()).sort()), OTHERS.concat(nextCache).sort());
    t.eq('no page errors (update)', pg.errors.filter(e => !/Failed to load resource/.test(e)), []);
    await pg.close();
    await srv.close();

    // ------------------------------------------------ a deploy on GitHub Pages' caching (the Absolute upgrade proof, 8 Oct)
    /* Pages sends max-age=600: for 10 minutes after a deploy the browser's HTTP
       cache still holds the previous one. The new worker must store the new
       files, never the old ones, so the next open is the new deploy. */
    const gp = await serve(b.out, { pages: true });
    const p2 = await open(gp.url, { width: 390, reducedMotion: 'reduce', storage: seed });
    await p2.page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    await p2.page.reload();                                   // a second visit: every file is in the HTTP cache, fresh for 10 minutes
    await p2.page.waitForSelector('.era-head', { state: 'attached' });
    const dataA = gp.file('/data.js'), verA = await p2.page.evaluate(() => window.TRACKER_DATA.version), cacheB = 'fixture-deploy2';
    const dataB = dataA.replace('"version":' + verA + ',', '"version":' + (verA + 1) + ',').replace(/"cache":"[^"]+"/, '"cache":"' + cacheB + '"');
    gp.override('/data.js', dataB);
    gp.override('/sw.js', gp.file('/sw.js').replace(/const CACHE = '[^']+';/, "const CACHE = '" + cacheB + "';"));
    await p2.page.reload();
    // the old cache goes only at the new worker's activation, after its install stored every file
    const cacheA = gp.file('/sw.js').match(/const CACHE = '([^']+)'/)[1];
    const swapped = await poll(p2.page, async ([nb, na]) => { const k = await caches.keys(); return k.includes(nb) && !k.includes(na); }, [cacheB, cacheA]);
    const stored = await p2.page.evaluate(async n => { const c = await caches.open(n), out = {};
      for (const u of ['./data.js', './index.html', './app.js', './styles.css']) { const r = await c.match(u); out[u] = r ? await r.text() : null; }
      return out; }, cacheB);
    t.ok('on GitHub Pages\' caching (max-age=600) a deploy\'s new worker stores the new files, never the old ones still in the HTTP cache',
         swapped && stored['./data.js'] === dataB && stored['./index.html'] === gp.file('/index.html') && stored['./app.js'] === gp.file('/app.js'),
         JSON.stringify({ swapped, data: (stored['./data.js'] || '').slice(0, 40) }));
    t.eq('no page errors (a deploy on Pages caching)', p2.errors.filter(e => !/Failed to load resource/.test(e)), []);
    await p2.close();
    await gp.close();

    // ------------------------------------------------ one plain reload shows a deploy (the v8 -> v9 proof, 9 Oct)
    /* Within Pages' 10 minutes Chromium reuses a reloaded page's scripts from its
       memory cache without asking the worker, so a reload showed the old build.
       index.html's links carry the build's hash: a new build has new addresses.
       Without the stamps the same reload shows the old build (the check can fail). */
    const reloadOnce = async stamped => {
      const gr = await serve(b.out, { pages: true });
      const idx = gr.file('/index.html'), plain = idx.replace(/\?v=[0-9a-f]{12}/g, '');
      if (!stamped) gr.override('/index.html', plain);
      const pr = await open(gr.url, { width: 390, reducedMotion: 'reduce', storage: seed });
      await pr.page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
      await pr.page.reload();                                 // every file in the HTTP and memory caches
      await pr.page.waitForSelector('.era-head', { state: 'attached' });
      const data = gr.file('/data.js'), ver = await pr.page.evaluate(() => window.TRACKER_DATA.version);
      gr.override('/data.js', data.replace('"version":' + ver + ',', '"version":' + (ver + 1) + ',').replace(/"cache":"[^"]+"/, '"cache":"fixture-deploy3"'));
      gr.override('/sw.js', gr.file('/sw.js').replace(/const CACHE = '[^']+';/, "const CACHE = 'fixture-deploy3';"));
      gr.override('/index.html', stamped ? idx.replace(/\?v=[0-9a-f]{12}/g, '?v=0123456789ab') : plain);
      await pr.page.reload();
      await pr.page.waitForSelector('.era-head', { state: 'attached' });
      const r = await pr.page.evaluate(() => ({ version: window.TRACKER_DATA.version, header: document.querySelector('#buildtag').textContent,
        app: performance.getEntriesByType('resource').filter(x => /\/app\.js/.test(x.name)).map(x => x.name.replace(/^.*\//, '')) }));
      r.was = ver; r.errors = pr.errors.filter(e => !/Failed to load resource/.test(e));
      await pr.close();
      await gr.close();
      return r;
    };
    const fresh = await reloadOnce(true), stale = await reloadOnce(false);
    t.ok('a deploy on Pages\' caching: one plain reload opens the new build (header v' + fresh.version + ', app.js at its new stamp)',
         fresh.version === fresh.was + 1 && fresh.header === 'v' + fresh.version && fresh.app.includes('app.js?v=0123456789ab') && !fresh.errors.length,
         JSON.stringify(fresh));
    t.ok('…and the check can fail: without the stamps the same reload still shows the old build (Chromium\'s memory cache)',
         stale.version === stale.was && stale.header === 'v' + stale.was, JSON.stringify(stale));

    // ------------------------------------------------ an older build's data.js: recovered in place, never a loop
    const gs = await serve(b.out, { pages: true });
    gs.override('/data.js', 'window.TRACKER_DATA = {"franchise":{"key":"old"},"issues":[]};');
    const p3 = await open(gs.url, { width: 390, reducedMotion: 'reduce', storage: seed });
    await p3.page.waitForFunction(() => /halfway through an update/.test(document.getElementById('app').textContent), null, { timeout: 10000 }).catch(() => null);
    await p3.page.evaluate(() => { window.__stay = 1; });
    await new Promise(r => setTimeout(r, 1500));
    const held = await p3.page.evaluate(() => ({ stay: window.__stay === 1, nav: performance.getEntriesByType('navigation')[0].type,
      retried: [...document.querySelectorAll('script[src*="data.js?r="]')].length, text: document.getElementById('app').textContent }));
    t.ok('an older data.js the server still sends: one fresh load, then a message; no reload, no loop', held.stay && held.nav === 'navigate' &&
         held.retried === 1 && /halfway through an update/.test(held.text), JSON.stringify(held));
    gs.override('/data.js', fs.readFileSync(path.join(b.out, 'data.js'), 'utf8'));
    const p4 = await p3.ctx.newPage(), e4 = [];
    p4.on('pageerror', e => e4.push(e.message));
    await p4.goto(gs.url);
    const ok4 = await p4.waitForSelector('.era-head', { state: 'attached', timeout: 10000 }).then(() => true, () => false);
    const r4 = await p4.evaluate(() => ({ nav: performance.getEntriesByType('navigation')[0].type, retried: document.querySelectorAll('script[src*="data.js?r="]').length,
      version: window.TRACKER_DATA && window.TRACKER_DATA.version, beacon: getComputedStyle(document.documentElement).getPropertyValue('--skin-ok').trim() }));
    t.ok('…once the new one is deployed, a page that still gets the old one from a cache recovers in place and opens normally',
         ok4 && e4.length === 0 && r4.version === 1 && r4.beacon === '3', JSON.stringify(Object.assign({ ok4, e4 }, r4)));
    await p3.close();
    await gs.close();
  } finally { await closeBrowser(); }
};
