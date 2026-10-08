/* Offline and updates (session 4, step 7; F-35…F-38, F-59, XM-7, D-13).
   jsdom has no service worker, so this suite stands one in (registration,
   update(), a worker going through its states, a cache store, the connection)
   and checks what the page does with them. The real worker, offline reloads
   and a real update are measured in test/layout/70-pwa. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, IS_TEMPLATE, build, boot, wait, basic, loadData, copyFixture, readJSON, writeJSON, openSettings } = require('../lib/helpers');

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
  t.ok('…the summary says so, and the Version row shows "vN"', /^Ready offline/.test(x.$('.sset[data-k="offline"] .sec-sum').textContent) &&
       /Version\s*v\d+(?!\d)/.test(x.$('#set-offline').textContent) && x.$('#set-offline').textContent.includes('v' + D.version));
  x.$('[data-act="sw-check"]').click();
  await wait(20);
  t.ok('Check for updates asks the worker (XM-7)', x.s.state.updates === 1);
  t.eq('…and says when this is the latest', x.$('#toastMsg').textContent, 'You have the latest version (v' + D.version + ').');
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
  const root = build(path.join(ROOT, 'dataset.json'), { label: 'pwa-root' });
  if (IS_TEMPLATE) {
    t.ok('a tracker still on the template\'s placeholder icons is warned before deploy', /placeholder artwork/.test(b.stderr));
    t.ok('…the template itself (key "starter") is not', root.status === 0 && !/placeholder artwork/.test(root.stderr));
  } else {
    // a tracker's icons/ hold its own artwork (the template's tests the warning itself)
    t.ok('this tracker\'s icons are its own: no placeholder warning for it or a fixture using them',
         root.status === 0 && !/placeholder artwork/.test(root.stderr) && !/placeholder artwork/.test(b.stderr));
  }
  const custom = copyFixture('basic', 'icons-custom'), cp = path.join(custom, 'dataset.json'), cds = readJSON(cp);
  cds.franchise.icons = { maskable: 'icons/icon-512.png' };
  writeJSON(cp, cds);
  const cb = build(cp, { label: 'icons-custom-out' });
  t.eq('a configured path replaces the default', JSON.parse(fs.readFileSync(path.join(cb.out, 'manifest.json'), 'utf8')).icons[2].src, './icons/icon-512.png');

  // ------------------------------------------------ a stale mix (the Absolute upgrade proof, 8 Oct)
  /* GitHub Pages lets a browser keep every file for 10 minutes, and within them
     a reload takes scripts and styles from the browser's caches: after a deploy
     this app.js can meet an older data.js or styles.css. It must load both
     again at an address no cache holds and start over, once, never read the old
     data, and never loop. (Real Chromium: test/layout/70-pwa.) */
  const old = path.join(require('../lib/helpers').tmpdir('stale-data'), 'data.js');
  fs.writeFileSync(old, 'window.TRACKER_DATA = {"franchise":{"key":"old"},"issues":[[202412001,"An issue"]],"eras":[]};');
  const injected = d => ({ js: [...d.querySelectorAll('script[src]')].map(x => x.getAttribute('src')),
                           css: [...d.querySelectorAll('link[rel="stylesheet"]')].map(x => x.getAttribute('href')) });
  const stale = boot(path.dirname(old));
  await wait(30);
  const inj = injected(stale.document);
  t.eq('an older data.js is caught before anything reads it: no crash', stale.errors, []);
  t.ok('…data.js and styles.css are loaded again at an address no cache holds (?r=<time>), and the page says it is updating',
       inj.js.length === 1 && /^\.\/data\.js\?r=\d+$/.test(inj.js[0]) && inj.css.some(h => /^\.\/styles\.css\?r=\d+$/.test(h)) &&
       /Updating to the latest version/.test(stale.document.getElementById('app').textContent), JSON.stringify(inj));
  // the fresh files arrive: the current data, then both load events
  stale.window.eval(fs.readFileSync(path.join(b.out, 'data.js'), 'utf8'));
  for (const el of [stale.document.querySelector('script[src^="./data.js?r="]'), stale.document.querySelector('link[href^="./styles.css?r="]')]) el.dispatchEvent(new stale.window.Event('load'));
  await wait(30);
  t.ok('…once they arrive the app starts over and opens normally, on the new stylesheet only', stale.errors.length === 0 &&
       stale.document.querySelectorAll('.era').length > 0 && injected(stale.document).css.length === 1 && /\?r=/.test(injected(stale.document).css[0]),
       JSON.stringify({ errors: stale.errors, css: injected(stale.document).css }));
  stale.window.close();
  const again = boot(path.dirname(old), { setup: w => { w.__shellRetried = true; } });
  await wait(30);
  t.ok('if the files are still stale after that one retry, it says so and loads nothing more (no loop)', injected(again.document).js.length === 0 &&
       /halfway through an update/.test(again.document.getElementById('app').textContent) && again.errors.length === 0, again.errors.join(' | '));
  again.window.close();
  const fine = boot(b.out);
  await wait(30);
  t.ok('the current data.js boots as normal: nothing loaded again', injected(fine.document).js.length === 0 && fine.errors.length === 0 &&
       fine.document.querySelectorAll('.era').length > 0, fine.errors.join(' | '));
  fine.window.close();
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8').replace(/--skin-ok:\s*3;/, '--skin-ok: 2;');
  const oldCss = boot(b.out, { cssSrc: css });
  await wait(30);
  const computed = oldCss.window.getComputedStyle(oldCss.document.documentElement).getPropertyValue('--skin-ok').trim();
  t.ok('an older styles.css (beacon ' + (computed || 'not computed') + ') is caught the same way', computed === '2' &&
       injected(oldCss.document).js.some(x => /\?r=/.test(x)), JSON.stringify(injected(oldCss.document)));
  oldCss.window.close();
};
