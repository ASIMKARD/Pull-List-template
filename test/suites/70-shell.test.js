/* Boot the REAL index.html + app.js + a generated data.js in jsdom. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, build, loadData, readJSON, writeJSON, copyFixture, boot, wait } = require('../lib/helpers');

async function shellChecks(t, label, dataDir) {
  const D = loadData(dataDir);
  const app = boot(dataDir);
  const atBoot = app.listeners.slice();                     // the app's own, right after boot
  const doc = app.document, w = app.window;
  await wait(20);
  t.ok(label + ': boots with no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  t.ok(label + ': document title comes from config', doc.title === D.franchise.title);
  t.ok(label + ': wordmark comes from config', doc.getElementById('wordmark').textContent === D.franchise.wordmark);
  t.ok(label + ': strapline comes from config', doc.getElementById('strapline').textContent === D.franchise.strapline);
  t.eq(label + ': the header shows the readable version, not the hash', doc.getElementById('buildtag').textContent, 'v' + D.version);
  t.ok(label + ': theme-color meta comes from config', doc.querySelector('meta[name="theme-color"]').content === D.franchise.theme);
  t.ok(label + ': home-screen title comes from config', doc.querySelector('meta[name="apple-mobile-web-app-title"]').content === D.franchise.wordmark);
  const heads = [...doc.querySelectorAll('.era-head')];
  t.ok(label + ': one banner per era', heads.length === D.eras.length);
  t.ok(label + ': lands collapsed (every banner aria-expanded=false)', heads.every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok(label + ': app no longer busy', doc.getElementById('app').getAttribute('aria-busy') === 'false');
  if (heads.length > 1) {
    heads[1].click();
    t.ok(label + ': delegated click opens exactly one banner (each band has its own identity)',
         heads.filter(h => h.getAttribute('aria-expanded') === 'true').length === 1 && heads[1].getAttribute('aria-expanded') === 'true');
    heads[1].click();
    t.ok(label + ': second click closes it', heads[1].getAttribute('aria-expanded') === 'false');
  }
  t.ok(label + ': the app registers at most 12 listeners at boot (' + atBoot.length + ': ' + atBoot.join(', ') + ')', atBoot.length <= 12 && atBoot.length >= 9,
       atBoot.join(','));

  // storage: namespaced, debounced, flushed on pagehide
  const ns = D.franchise.key + ':';
  const keysNow = () => Object.keys(w.localStorage).filter(k => !k.startsWith('__'));
  t.ok(label + ': nothing written before the 400ms debounce', keysNow().length === 0);
  w.dispatchEvent(new w.Event('pagehide'));
  t.ok(label + ': pagehide flushes pending writes immediately', keysNow().length > 0);
  t.ok(label + ': every storage key is namespaced by franchise.key', keysNow().every(k => k.startsWith(ns)), keysNow().join(','));
  t.ok(label + ': expand state is session-only (never stored)', keysNow().every(k => !/open|expand|collapse/i.test(k)));
  app.window.close();
}

module.exports = async function (t) {
  // root (the committed data.js) and the basic fixture
  await shellChecks(t, 'root', ROOT);
  const b = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'shell-basic' });
  t.ok('basic builds', b.status === 0, b.stderr);
  if (b.status === 0) await shellChecks(t, 'basic', b.out);

  // the build tag and the service-worker cache agree because both are the content hash
  const D = loadData(ROOT);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  t.ok('root: build tag and sw.js cache version agree (one hash)', sw.includes("'" + D.franchise.key + '-' + D.build + "'"));

  // visibilitychange to hidden also flushes
  {
    const app = boot(ROOT);
    await wait(10);
    Object.defineProperty(app.document, 'visibilityState', { value: 'hidden', configurable: true });
    app.document.dispatchEvent(new app.window.Event('visibilitychange'));
    t.ok('visibilitychange (hidden) flushes pending writes', Object.keys(app.window.localStorage).some(k => k.startsWith(D.franchise.key + ':')));
    app.window.close();
  }
  // without a flush, the debounce writes after 400ms
  {
    const app = boot(ROOT);
    await wait(450);
    t.ok('debounced write lands after 400ms', Object.keys(app.window.localStorage).some(k => k.startsWith(D.franchise.key + ':')));
    app.window.close();
  }

  // special characters in data are escaped in the real DOM, never parsed as markup
  {
    const dir = copyFixture('broken/_valid', 'escape');
    const ds = readJSON(path.join(dir, 'dataset.json'));
    ds.eras[0].name = 'Era <b>bold</b> & "quoted" it\'s';
    ds.eras[0].years = '<img src=x onerror="window.__pwned=1">';
    writeJSON(path.join(dir, 'dataset.json'), ds);
    const e = build(path.join(dir, 'dataset.json'), { label: 'escape-out' });
    t.ok('escape dataset builds', e.status === 0, e.stderr);
    if (e.status === 0) {
      const app = boot(e.out);
      await wait(20);
      const name = app.document.querySelector('.era .bname');
      t.ok('markup in data renders as text (no <b> element created)', name && !name.querySelector('b'));
      t.ok('special characters survive intact in the DOM', name && name.textContent === ds.eras[0].name);
      t.ok('no injected element runs (no <img>, no handler fired)', !app.document.querySelector('#app img') && !app.window.__pwned);
      app.window.close();
    }
  }
};
