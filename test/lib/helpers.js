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
   default). Returns { window, document, errors, listeners }. */
function boot(dataDir, opts) {
  opts = opts || {};
  const { JSDOM, VirtualConsole } = require('jsdom');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message) || e)));
  vc.on('error', m => errors.push('console.error: ' + m));
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="\.\/([\w.-]+)"><\/script>/g, (m, file) => {
    const p = file === 'data.js' ? path.join(dataDir, 'data.js') : path.join(ROOT, file);
    const src = fs.readFileSync(p, 'utf8').split('</scr' + 'ipt>').join('<\\/scr' + 'ipt>');
    return '<script>' + src + '</scr' + 'ipt>';
  });
  const listeners = [];
  const dom = new JSDOM(html, {
    url: 'https://tracker.local/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const orig = w.EventTarget.prototype.addEventListener;
      w.EventTarget.prototype.addEventListener = function (type) {
        listeners.push(type);
        return orig.apply(this, arguments);
      };
      w.Element.prototype.scrollIntoView = function () {};
      w.scrollTo = function () {};
      if (opts.storage) for (const k of Object.keys(opts.storage)) w.localStorage.setItem(k, opts.storage[k]);
    }
  });
  return { dom, window: dom.window, document: dom.window.document, errors, listeners };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = { ROOT, FIX, BUILD, tmpdir, build, loadData, readJSON, writeJSON, sha12, copyFixture,
                   validateIssueIds, boot, wait };
