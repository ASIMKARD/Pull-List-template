/* Shared harness helpers: run the real build, load the real data.js, boot the
   real index.html in jsdom. Nothing here fabricates DOM or data. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FIX = path.join(ROOT, 'test', 'fixtures');
const BUILD = path.join(ROOT, 'tools', 'build.py');

let tmpBase = null;
function tmpdir(label) {
  if (!tmpBase) tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'pull-list-harness-'));
  const d = path.join(tmpBase, label + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/* Run tools/build.py. Returns { status, stdout, stderr, out, report }. */
function build(dataset, opts) {
  opts = opts || {};
  const out = opts.out || tmpdir(opts.label || 'build');
  const reportFile = path.join(out, '.report.json');
  const args = [BUILD, dataset, '--out', out, '--report', reportFile].concat(opts.args || []);
  const r = spawnSync('python3', args, { encoding: 'utf8', cwd: ROOT });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch (e) { /* failed build */ }
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', out, report };
}

/* Evaluate a generated data.js the way a browser would. */
function loadData(dir) {
  const src = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: 'data.js' });
  return sandbox.window.TRACKER_DATA;
}

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1)); }
function sha12(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }

/* Copy a fixture directory so a test can mutate it without touching the original. */
function copyFixture(name, label) {
  const dst = tmpdir(label || name);
  fs.cpSync(path.join(FIX, name), dst, { recursive: true });
  return dst;
}

/* Validate issueIds through the build's own validator (one source of truth). */
function validateIssueIds(ids) {
  const r = spawnSync('python3', [BUILD, '--validate-issue-ids'].concat(ids), { encoding: 'utf8', cwd: ROOT });
  return JSON.parse(r.stdout);
}

/* Boot the REAL index.html with the REAL app.js and a generated data.js.
   Local <script src> tags are inlined (jsdom does not fetch file URLs by
   default). opts.appSrc replaces app.js and opts.cssSrc inlines a given
   stylesheet (mutation self-tests, the stale-styles beacon).
   Returns { window, document, errors, listeners }. */
function boot(dataDir, opts) {
  opts = opts || {};
  const { JSDOM, VirtualConsole } = require('jsdom');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message) || e)));
  vc.on('error', m => errors.push('console.error: ' + m));
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script(?: defer)? src="\.\/([\w.-]+)(?:\?v=[0-9a-f]{12})?"><\/script>/g, (m, file) => {
    const p = file === 'data.js' ? path.join(dataDir, 'data.js') : path.join(ROOT, file);
    const raw = file === 'app.js' && opts.appSrc !== undefined ? opts.appSrc : fs.readFileSync(p, 'utf8');
    const src = raw.split('</scr' + 'ipt>').join('<\\/scr' + 'ipt>');
    return '<script>' + src + '</scr' + 'ipt>';
  });
  if (opts.css || opts.cssSrc) {
    const css = opts.cssSrc || fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css(?:\?v=[0-9a-f]{12})?">/, () => '<style>' + css + '</style>');
  }
  const listeners = [];
  const dom = new JSDOM(html, {
    url: opts.url || 'https://tracker.local/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const orig = w.EventTarget.prototype.addEventListener;
      w.EventTarget.prototype.addEventListener = function (type) {
        // the app's listeners only: jsdom's selector engine (nwsapi) adds its own
        // mouseover/mouseout on each document it starts, which aren't the app's
        const caller = (new Error().stack.split('\n')[2] || '');
        if (!/node_modules[\\/]/.test(caller)) listeners.push(type);
        return orig.apply(this, arguments);
      };
      w.Element.prototype.scrollIntoView = function () { w.__scrolledTo = this; };
      /* A closed section's body is inert: a person can't tap or focus anything in
         it, so neither can a test (jsdom doesn't implement inert itself). */
      const click = w.HTMLElement.prototype.click, focus = w.HTMLElement.prototype.focus;
      w.HTMLElement.prototype.click = function () { if (!this.closest('[inert]')) return click.apply(this, arguments); };
      w.HTMLElement.prototype.focus = function () { if (!this.closest('[inert]')) return focus.apply(this, arguments); };
      if (opts.now) { const fixed = opts.now; w.Date.now = () => fixed; }
      w.scrollTo = function () {};
      if (opts.storage) for (const k of Object.keys(opts.storage)) w.localStorage.setItem(k, opts.storage[k]);
      if (opts.setup) opts.setup(w);                          // stand-ins jsdom lacks (a service worker, caches), set before the app runs
    }
  });
  return { dom, window: dom.window, document: dom.window.document, errors, listeners };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

/* Open collapsible sections the way a person does: tap the head of each closed
   one. g is 'f' (filter panel) or 's' (Settings); no keys means all of them. */
function openSections(app, g, keys) {
  const heads = [...app.document.querySelectorAll('.sec-head[data-g="' + g + '"]')];
  heads.filter(h => !keys || keys.includes(h.dataset.k)).forEach(h => { if (h.getAttribute('aria-expanded') !== 'true') h.click(); });
}
/* Go to Settings and open its sections (all of them unless keys are named). */
function openSettings(app, keys) {
  app.document.querySelector('#tab-settings').click();
  openSections(app, 's', keys);
}

/* Type into a search box the way a person does: set the value, fire input,
   wait out the 180 ms debounce. */
async function typeInto(app, selector, value) {
  const el = app.document.querySelector(selector);
  el.value = value;
  el.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  await wait(260);
}

/* A generated big dataset: nEras eras x perEra rows (5,000 rows by default). */
let stressCache = null;
function stress(nEras, perEra, franchise) {
  nEras = nEras || 40; perEra = perEra || 125;
  const key = nEras + 'x' + perEra + JSON.stringify(franchise || {});
  if (stressCache && stressCache.key === key) return stressCache;
  const dir = tmpdir('stress5k');
  const eras = [], arcs = [], rows = [];
  for (let e = 0; e < nEras; e++) {
    eras.push({ id: 'era-' + e, name: 'Era ' + e, rank: 5000 + 10 * e, years: String(1960 + e) });
    arcs.push({ id: 'arc-' + e, name: 'Arc ' + e, era: 'era-' + e, strands: ['Main'], type: 'MAIN', mo: 'M', tier: 'All',
                credits: { writers: ['Writer Number' + e], artists: ['Artist Number' + e] } });
    for (let n = 1; n <= perEra; n++) {
      const series = 'Series' + e;
      rows.push({ issueId: 'series' + e + '-' + (1960 + e) + '-' + n, series, vol: String(1960 + e), num: String(n),
                  title: series + ' (' + (1960 + e) + ') #' + n, era: 'era-' + e, arc: 'arc-' + e,
                  date: { cover: (1600 + e * 11 + Math.floor((n - 1) / 12)) + '-' + String(((n - 1) % 12) + 1).padStart(2, '0'), source: 'generated' } });
    }
  }
  writeJSON(path.join(dir, 'dataset.json'), {
    schemaVersion: 1, franchise: Object.assign({ key: 'big', wordmark: 'Big', title: 'Big', strapline: '', span: '', theme: '#000000' }, franchise || {}),
    eras, strands: ['Main'], types: ['MAIN'], tiers: ['All'], media: ['comic'], arcs, rows });
  const b = build(path.join(dir, 'dataset.json'), { label: 'stress5k-out' });
  stressCache = { key, out: b.out, status: b.status, stderr: b.stderr, rows: nEras * perEra, eras: nEras, perEra };
  return stressCache;
}

/* Build the basic fixture once per process. */
let basicCache = null;
function basic() {
  if (!basicCache) basicCache = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'basic-shared' });
  return basicCache;
}
let npCache = null;
function noPeriods() {
  if (!npCache) npCache = build(path.join(FIX, 'no-periods', 'dataset.json'), { label: 'np-shared' });
  return npCache;
}

/* The mixed-format fixture (comics, a show, a timed and an untimed game). */
let mixedCache = null;
function mixed() {
  if (!mixedCache) mixedCache = build(path.join(FIX, 'mixed', 'dataset.json'), { label: 'mixed-shared' });
  return mixedCache;
}

/* The repo's own dataset. In the template it is the demo (key "starter"); in a
   tracker built from the template it is that tracker's data, and the suites
   check it as it is. A few checks only make sense in one of the two (the
   template's placeholder icons, its parity checklist); IS_TEMPLATE says which. */
const ROOT_DATASET = readJSON(path.join(ROOT, 'dataset.json'));
const IS_TEMPLATE = ROOT_DATASET.franchise.key === 'starter';

module.exports = { ROOT, FIX, BUILD, ROOT_DATASET, IS_TEMPLATE, tmpdir, build, loadData, readJSON, writeJSON, sha12, copyFixture,
                   validateIssueIds, boot, wait, openSections, openSettings, typeInto, stress, basic, noPeriods, mixed };
