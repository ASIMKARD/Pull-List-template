/* Offline and updates (session 4, step 7; F-35…F-38, F-59, XM-7, D-13).
   jsdom has no service worker, so this suite stands one in (registration,
   update(), a worker going through its states, a cache store, the connection)
   and checks what the page does with them. The real worker, offline reloads
   and a real update are measured in test/layout/70-pwa. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, build, boot, wait, basic, loadData, copyFixture, readJSON, writeJSON, openSettings } = require('../lib/helpers');

/* A stand-in service worker, cache store and connection, installed before the app runs. */
function standIns(opts) {
  const state = { online: true, updates: 0, registered: null, reg: null };
  const setup = w => {
    const worker = s => { const x = w.document.createElement('i'); x.state = s; x.go = n => { x.state = n; x.dispatchEvent(new w.Event('statechange')); }; return x; };
    const reg = state.reg = { installing: opts.installing ? worker('installing') : null, waiting: opts.waiting ? worker('installed') : null, active: worker('activated'),
      update() { state.updates++; if (opts.next) this.installing = worker('installing'); return opts.updateFails ? Promise.reject(new Error('net')) : Promise.resolve(); } };
    if (opts.sw !== false) {
      Object.defineProperty(w.navigator, 'serviceWorker', { configurable: true,
        value: { controller: opts.controlled ? {} : null, register: url => { state.registered = url; return Promise.resolve(reg); } } });
    }
    Object.defineProperty(w.navigator, 'onLine', { configurable: true, get: () => state.online });
    const later = v => opts.slowCaches ? new Promise(r => setTimeout(() => r(v), opts.slowCaches)) : Promise.resolve(v);
    w.caches = { has: n => later(opts.cached !== undefined && n === opts.cacheName),
                 open: () => Promise.resolve({ match: u => Promise.resolve(opts.cached === 'all' || (opts.cached || []).includes(u) ? {} : undefined) }) };
  };
  return { state, setup };
}

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const seen = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  const go = async opts => {
    const s = standIns(Object.assign({ cacheName: D.cache }, opts));
    const app = boot(b.out, { storage: seen, setup: s.setup });
    await wait(30);
    return { app, s, d: app.document, $: q => app.document.querySelector(q) };
  };
  const offSec = x => { openSettings(x.app, ['offline']); return x.$('#set-offline').textContent; };

  // ------------------------------------------------ the build hands the page its cache name and file list
  const sw = fs.readFileSync(path.join(b.out, 'sw.js'), 'utf8');
  const swList = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\]);/)[1]).concat(JSON.parse(sw.match(/const STATIC = (\[[\s\S]*?\]);/)[1]));
  t.eq('data.js names the cache the worker uses (<key>-<build>)', [D.cache, sw.match(/const CACHE = '([^']+)'/)[1]], [D.franchise.key + '-' + D.build, D.cache]);
  t.eq('…and lists exactly the files it precaches', D.precache, swList);

  // ------------------------------------------------ no service worker here
  let x = await go({ sw: false });
  t.ok('without service workers, Settings → Offline says so plainly', /isn't available in this browser/.test(offSec(x)) && !x.$('[data-act="sw-check"]'));
  t.eq('…and its summary', x.$('.sset[data-k="offline"] .sec-sum').textContent, 'Not available here');
  t.eq('no runtime errors (no service worker)', x.app.errors, []);
  x.app.window.close();

  // ------------------------------------------------ registered, every file cached
  x = await go({ cached: 'all' });
  t.eq('the page registers ./sw.js', x.s.state.registered, './sw.js');
  t.ok('every precached file is in the cache: "Ready offline · N of N files saved" (F-35)',
       new RegExp('Ready offline · ' + D.precache.length + ' of ' + D.precache.length + ' files saved').test(offSec(x)) && x.$('#offState').dataset.ready === '1');
  t.ok('…the summary says so, and the version shows the build', /^Ready offline/.test(x.$('.sset[data-k="offline"] .sec-sum').textContent) &&
       x.$('#set-offline').textContent.includes('build ' + D.build));
  x.$('[data-act="sw-check"]').click();
  await wait(20);
  t.ok('Check for updates asks the worker (XM-7)', x.s.state.updates === 1);
  t.eq('…and says when this is the latest', x.$('#toastMsg').textContent, 'You have the latest version (build ' + D.build + ').');
  x.app.window.close();
  x = await go({ cached: ['./', './index.html', './app.js'] });
  t.ok('a partly filled cache: "Not ready yet · 3 of N", keep the page open while online', /Not ready yet · 3 of \d+ files saved\. Keep this page open while online\./.test(offSec(x)));
  x.app.window.close();

  // ------------------------------------------------ an async change redraws the Offline section only
  x = await go({ cached: 'all', slowCaches: 80 });
  openSettings(x.app, ['backup', 'offline']);
  const display = x.$('.sset[data-k="display"]'), half = x.app.window.PullList.syncCodes().full.slice(0, 20);
  x.$('#syncIn').value = half;                                                 // half-typed when readiness lands
  await wait(150);
  t.ok('readiness lands while a sync code is half typed: the Offline section updates…', x.$('#offState').dataset.ready === '1');
  t.ok('…the half-typed code is kept, and no other section is redrawn (a full redraw wiped it, and cut short an opening section)',
       x.$('#syncIn').value === half && x.$('.sset[data-k="display"]') === display);
  x.app.window.close();

  // ------------------------------------------------ an update (F-38)
  x = await go({ cached: 'all', controlled: true, next: true });
  x.$('[data-act="sw-check"]') || openSettings(x.app, ['offline']);
  offSec(x);
  x.$('[data-act="sw-check"]').click();
  await wait(20);
  t.eq('a new version found: it downloads', x.$('#toastMsg').textContent, 'Downloading the new version…');
  const w = x.s.state.reg.installing;
  w.go('installed'); w.go('activating');
  t.ok('…nothing claims to be ready until the new worker is active', !/new version is ready/.test(x.$('#toastMsg').textContent));
  w.go('activated');
  await wait(10);
  t.ok('…then "A new version is ready" with Reload', x.$('#toastMsg').textContent === 'A new version is ready.' && x.$('#toastAct').textContent === 'Reload');
  t.ok('…Settings → Offline offers Reload now, and its summary says an update is ready',
       !!x.$('[data-act="sw-reload"]') && /update ready/.test(x.$('.sset[data-k="offline"] .sec-sum').textContent));
  t.eq('no runtime errors (update)', x.app.errors, []);
  x.app.window.close();
  x = await go({ cached: 'all', controlled: true, waiting: true });
  t.ok('a new version already waiting at boot is announced', x.$('#toastMsg').textContent === 'A new version is ready.');
  x.app.window.close();
  x = await go({ cached: 'all', controlled: false, installing: true });
  x.s.state.reg.installing.go('activated');
  await wait(10);
  t.ok('a first install is not "a new version" (nothing older ran this page)', !/new version/.test(x.$('#toastMsg').textContent));
  x.app.window.close();
  x = await go({ cached: 'all', controlled: true });
  x.d.dispatchEvent(new x.app.window.Event('visibilitychange'));
  await wait(10);
  t.ok('coming back to the page looks for an update quietly', x.s.state.updates === 1 && x.$('#toast').hidden);
  x.app.window.close();
  x = await go({ cached: 'all', updateFails: true });
  offSec(x);
  x.$('[data-act="sw-check"]').click();
  await wait(20);
  t.eq('a failed check says so', x.$('#toastMsg').textContent, 'Couldn\'t check for updates just now.');
  x.app.window.close();

  // ------------------------------------------------ online and offline, without listeners (F-36)
  x = await go({ cached: 'all' });
  t.ok('online at boot: no offline mark, no toast', !x.d.body.classList.contains('offline') && x.$('#netState').hidden && x.$('#toast').hidden);
  x.s.state.online = false;
  x.d.dispatchEvent(new x.app.window.Event('visibilitychange'));
  t.ok('offline, noticed when the page is shown again: the body class, the header mark and a toast',
       x.d.body.classList.contains('offline') && !x.$('#netState').hidden && /You're offline\. Everything still works/.test(x.$('#toastMsg').textContent));
  offSec(x);
  t.ok('…Settings → Offline says so', /Offline: everything still works/.test(x.$('#netLine').textContent) && /offline now/.test(x.$('.sset[data-k="offline"] .sec-sum').textContent));
  const before = x.s.state.updates;
  x.$('[data-act="sw-check"]').click();
  t.ok('…and Check for updates waits for a connection instead of failing', x.s.state.updates === before && /check again when you're connected/.test(x.$('#toastMsg').textContent));
  x.s.state.online = true;
  x.$('#tab-list').click();
  t.ok('back online, noticed on the next tap', !x.d.body.classList.contains('offline') && x.$('#netState').hidden && x.$('#toastMsg').textContent === 'Back online.');
  t.ok('…with no online/offline listeners (decided 2 Oct)', !x.app.listeners.includes('online') && !x.app.listeners.includes('offline'));
  x.app.window.close();

  // ------------------------------------------------ the install prompt (F-37)
  for (const outcome of ['accepted', 'dismissed']) {
    x = await go({ cached: 'all' });
    let prompted = 0, prevented = 0;
    const ev = new x.app.window.Event('beforeinstallprompt');
    ev.preventDefault = () => { prevented++; };
    ev.prompt = () => { prompted++; };
    ev.userChoice = Promise.resolve({ outcome });
    x.app.window.dispatchEvent(ev);
    t.ok(outcome + ': the browser\'s own bar is held back, and a toast offers Install', prevented === 1 && x.$('#toastAct').textContent === 'Install' &&
         /Install this tracker as an app/.test(x.$('#toastMsg').textContent));
    offSec(x);
    t.ok(outcome + ': Settings → Offline offers it too', !!x.$('[data-act="install"]'));
    x.$('#toastAct').click();
    await wait(10);
    t.ok(outcome + ': tapping Install opens the prompt once and reports the outcome', prompted === 1 &&
         x.$('#toastMsg').textContent === (outcome === 'accepted' ? 'Installed.' : 'Not installed. You can install it later from Settings → Offline.') && !x.$('[data-act="install"]'));
    x.app.window.close();
  }

  // ------------------------------------------------ icons from config (D-13)
  x = await go({ cached: 'all' });
  t.ok('the page\'s icon links follow the configured icons', [...x.d.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].every(l => l.getAttribute('href') === D.franchise.icons['192']));
  x.app.window.close();
  const man = JSON.parse(fs.readFileSync(path.join(b.out, 'manifest.json'), 'utf8'));
  t.eq('the manifest\'s icons are the configured ones', man.icons.map(i => i.src), [D.franchise.icons['192'], D.franchise.icons['512'], D.franchise.icons.maskable]);
  t.ok('a tracker still on the template\'s placeholder icons is warned before deploy', /placeholder artwork/.test(b.stderr));
  const root = build(path.join(ROOT, 'dataset.json'), { label: 'pwa-root' });
  t.ok('…the template itself (key "starter") is not', root.status === 0 && !/placeholder artwork/.test(root.stderr));
  const custom = copyFixture('basic', 'icons-custom'), cp = path.join(custom, 'dataset.json'), cds = readJSON(cp);
  cds.franchise.icons = { maskable: 'icons/icon-512.png' };
  writeJSON(cp, cds);
  const cb = build(cp, { label: 'icons-custom-out' });
  t.eq('a configured path replaces the default', JSON.parse(fs.readFileSync(path.join(cb.out, 'manifest.json'), 'utf8')).icons[2].src, './icons/icon-512.png');
};
