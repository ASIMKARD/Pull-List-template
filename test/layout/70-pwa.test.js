/* The real service worker (session 4, step 7; F-35…F-38, F-59, D-2 live).
   CLAUDE.md: network-first for the shell, cache-first for fonts and icons,
   skipWaiting + clients.claim, every precached path exists, and every fetch
   path ends in a real Response (iOS shows a blank page otherwise). */
'use strict';
const { basic } = require('../lib/helpers');
const { serve, open, openSettings, closeBrowser } = require('./lib');

const seed = { 'fixture:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };

module.exports = async function (t) {
  try {
    const b = basic(), srv = await serve(b.out);
    const pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed });
    const page = pg.page;
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
    const info = await page.evaluate(async () => ({ keys: await caches.keys(), n: (await (await caches.open(window.TRACKER_DATA.cache)).keys()).length,
      want: window.TRACKER_DATA.precache.length, cache: window.TRACKER_DATA.cache }));
    t.ok('the worker installs, claims the page and fills its cache: every precached file, fonts and icons included (F-59, D-2)',
         info.keys.length === 1 && info.keys[0] === info.cache && info.n >= info.want, JSON.stringify(info));
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
    await page.waitForFunction(async n => (await caches.keys()).join() === n, nextCache, { timeout: 5000 }).catch(() => null);
    t.eq('…and the old cache is gone: only the new one remains', await page.evaluate(() => caches.keys()), [nextCache]);
    t.eq('no page errors (update)', pg.errors.filter(e => !/Failed to load resource/.test(e)), []);
    await pg.close();
    await srv.close();
  } finally { await closeBrowser(); }
};
