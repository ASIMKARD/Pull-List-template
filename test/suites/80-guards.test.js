/* Structural guards from spec §5: listener budget, one colour-token block,
   zero !important, sw.js evaluated, no duplicate functions, no franchise
   strings, every precached path exists. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, loadData, readJSON } = require('../lib/helpers');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// files shipped to the browser that are TEMPLATE code (data is excluded by design)
const TEMPLATE_CODE = ['index.html', 'app.js', 'styles.css', 'tools/templates/sw.js'];

/* Strip comments, strings, template literals and regex literals, keeping
   braces that are code. Good enough for our own hand-written sources. */
function codeOnly(src) {
  let out = '', i = 0, prev = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; prev = '"'; continue;
    }
    if (c === '/' && /[(,=:[!&|?{};]/.test(prev)) {          // regex literal
      i++;
      let cls = false;
      while (i < src.length && (src[i] !== '/' || cls)) {
        if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
        i++;
      }
      i++; while (/[a-z]/.test(src[i] || '')) i++;
      out += '/r/'; prev = '/'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/* Function declarations grouped by the scope they live in (brace depth path). */
function duplicateFunctions(src) {
  const code = codeOnly(src);
  const stack = [0], seen = {}, dups = [];
  let scopeId = 0;
  const rx = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|[{}]/g;
  let m;
  while ((m = rx.exec(code))) {
    if (m[0] === '{') { stack.push(++scopeId); continue; }
    if (m[0] === '}') { stack.pop(); continue; }
    const key = stack[stack.length - 1] + ':' + m[1];
    if (seen[key]) dups.push(m[1]); else seen[key] = 1;
  }
  return { dups, balanced: stack.length === 1 };
}

/* CSS rule blocks (selector + body), recursing into @media. */
function cssBlocks(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  (function walk(s) {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const sel = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      const body = s.slice(open + 1, j - 1);
      if (sel.startsWith('@')) walk(body); else blocks.push({ sel, body });
      i = j;
    }
  })(css);
  return blocks;
}
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|lab|color-mix)\(/;

function makeSwContext() {
  const handlers = {}, calls = { addAll: [], skipWaiting: 0, claim: 0, put: 0, respond: [] };
  const cache = {
    addAll: list => { calls.addAll.push(list); return Promise.resolve(); },
    put: () => { calls.put++; return Promise.resolve(); },
    keys: () => Promise.resolve([])
  };
  class Response { constructor(body, init) { this.body = body; this.status = (init && init.status) || 200; this.type = 'basic'; } clone() { return this; } }
  const ctx = {
    URL, Promise, Response, console,
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => { calls.skipWaiting++; return Promise.resolve(); },
      clients: { claim: () => { calls.claim++; return Promise.resolve(); } }
    },
    caches: {
      open: () => Promise.resolve(cache),
      keys: () => Promise.resolve(['old-cache']),
      delete: () => Promise.resolve(true),
      match: () => Promise.resolve(undefined)
    },
    fetch: () => Promise.reject(new Error('offline'))
  };
  return { ctx, handlers, calls };
}

module.exports = async function (t) {
  // ---- listener budget (spec: <= 12 for the whole app) ----
  const appJs = read('app.js');
  const staticListeners = (codeOnly(appJs).match(/addEventListener\s*\(/g) || []).length;
  t.ok('app.js registers at most 12 listeners (static count: ' + staticListeners + ')', staticListeners <= 12);
  t.ok('no inline on*= handlers in index.html', !/\son[a-z]+\s*=/.test(read('index.html')));
  t.ok('no element.onclick-style assignments in app.js', !/\.on[a-z]+\s*=/.test(codeOnly(appJs)));

  // ---- no function defined twice in the same scope (brace-depth scan) ----
  for (const f of ['app.js', 'tools/templates/sw.js']) {
    const r = duplicateFunctions(read(f));
    t.ok(f + ': braces balance under the scanner', r.balanced);
    t.ok(f + ': no function is defined twice (the later copy silently wins)', r.dups.length === 0, r.dups.join(', '));
  }
  // a var/let/const with a function's name silently replaces the function (hoisting)
  for (const f of ['app.js']) {
    const code = codeOnly(read(f));
    const fns = new Set((code.match(/\bfunction\s+([A-Za-z_$][\w$]*)/g) || []).map(x => x.split(/\s+/)[1]));
    const vars = (code.match(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g) || []).map(x => x.split(/\s+/)[1]);
    const clash = [...new Set(vars.filter(v => fns.has(v)))];
    t.ok(f + ': no variable shares a name with a function (it would replace it)', clash.length === 0, clash.join(', '));
  }
  {
    const r = duplicateFunctions('(function(){ function a(){} function b(){ function a(){} } function a(){} })();');
    t.ok('the duplicate scanner itself catches a same-scope duplicate and ignores a nested one',
         r.dups.length === 1 && r.dups[0] === 'a');
    const s = duplicateFunctions('var x = "function a(){}"; /* function a(){} */ function a(){}');
    t.ok('the duplicate scanner ignores strings and comments', s.dups.length === 0);
  }
  // app.js must parse
  let parsed = true;
  try { new vm.Script(appJs, { filename: 'app.js' }); } catch (e) { parsed = false; }
  t.ok('app.js parses', parsed);
  t.ok('app.js builds markup through escapeHtml', /function escapeHtml/.test(appJs) && /function escapeAttr/.test(appJs));

  // ---- one colour-token block, zero !important ----
  const css = read('styles.css');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  t.ok('zero !important in styles.css', !/!\s*important/i.test(cssCode));
  t.ok('the !important guard sees a real declaration', /!\s*important/i.test('a{color:red ! important}'));
  t.ok('zero !important in index.html', !/!important/i.test(read('index.html')));
  const coloured = cssBlocks(css).filter(b => COLOUR.test(b.body));
  t.ok('exactly one rule block declares colours', coloured.length === 1, coloured.map(b => b.sel).join(' | '));
  t.ok('that block is :root (the single token source)', coloured.length === 1 && coloured[0].sel === ':root');
  t.ok('every colour in it is a custom property', coloured.length === 1 &&
       coloured[0].body.split(';').filter(d => COLOUR.test(d)).every(d => /^\s*--[\w-]+\s*:/.test(d)));
  t.ok('index.html carries no colour literal outside meta theme-color',
       !COLOUR.test(read('index.html').replace(/<meta name="theme-color"[^>]*>/, '')));

  // ---- index.html hygiene ----
  const html = read('index.html');
  const ids = (html.match(/\sid="([^"]+)"/g) || []).map(s => s.slice(5, -1));
  t.ok('index.html declares no id twice', new Set(ids).size === ids.length, ids.join(','));
  t.ok('index.html has no inline style attributes', !/\sstyle="/.test(html));

  // ---- no franchise strings in template code ----
  const REAL = /spider|spidey|\bultimate\b|sonic|x-?men|batman|superman|wonder woman|absolute|archie|\bidw\b|hulk|lantern|spawn|dark nights|fantastic four|new 52|SPDY|xmen/i;
  const FIXTURE = /fixture|vela|orrin|kestrel|shattered|mirror hero|quill|delune|starter|placeholder writer/i;
  for (const f of TEMPLATE_CODE) {
    const src = read(f);
    const hit = (src.match(REAL) || src.match(FIXTURE) || [])[0];
    t.ok(f + ': no franchise or fixture strings', !hit, 'found: ' + hit);
  }

  // ---- no haptics (declined in an earlier round, re-confirmed 3 Oct) ----
  // Comments are stripped but strings are KEPT, so navigator['vibrate'] is caught too.
  const noComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
  for (const f of TEMPLATE_CODE) {
    t.ok(f + ': never calls navigator.vibrate (no haptics)', !/vibrate/i.test(noComments(read(f))));
  }

  // ---- service worker: EVALUATED, not just parsed ----
  const D = loadData(ROOT);
  const sw = read('sw.js');
  const { ctx, handlers, calls } = makeSwContext();
  let evalErr = null;
  try { vm.runInNewContext(sw, ctx, { filename: 'sw.js' }); } catch (e) { evalErr = e; }
  t.ok('sw.js evaluates without throwing (catches TDZ errors node --check misses)', !evalErr, evalErr && evalErr.message);
  t.ok('sw.js registers install, activate and fetch', ['install', 'activate', 'fetch'].every(k => typeof handlers[k] === 'function'));
  if (!evalErr && handlers.install) {
    let wait = null;
    handlers.install({ waitUntil: p => { wait = p; } });
    await wait;
    const list = calls.addAll[0] || [];
    t.ok('install precaches the shell', ['./', './index.html', './app.js', './styles.css', './data.js', './qrcode.js', './manifest.json']
         .every(p => list.includes(p)));
    t.ok('install precaches all 12 fonts (defect 2)', list.filter(p => /^\.\/fonts\/.+\.woff2$/.test(p)).length === 12);
    t.ok('install precaches the 3 icons (defect 2)', list.filter(p => /^\.\/icons\/.+\.png$/.test(p)).length === 3);
    const missing = list.filter(p => p !== './' && !fs.existsSync(path.join(ROOT, p)));
    t.ok('every precached path exists on disk (addAll rejects on one 404)', missing.length === 0, missing.join(', '));
    t.ok('install calls skipWaiting', calls.skipWaiting === 1);
    let aw = null;
    handlers.activate({ waitUntil: p => { aw = p; } });
    await aw;
    t.ok('activate claims clients', calls.claim === 1);
    for (const [url, kind] of [['https://x.local/app/index.html', 'shell'], ['https://x.local/app/fonts/anton-400-latin.woff2', 'font']]) {
      let resp = null;
      handlers.fetch({ request: { method: 'GET', url }, respondWith: p => { resp = p; } });
      const r = resp ? await resp : null;
      t.ok('offline ' + kind + ' request still resolves to a real Response (never undefined)', !!r && typeof r.status === 'number');
    }
    t.ok('cache name derives from franchise.key + content hash', sw.includes("'" + D.franchise.key + '-' + D.build + "'"));
  }

  // ---- manifest and icons from config (defect 13) ----
  const man = readJSON(path.join(ROOT, 'manifest.json'));
  t.ok('manifest name is the franchise title, not a placeholder', man.name === D.franchise.title && !/my tracker/i.test(man.name));
  t.ok('manifest icons all exist', man.icons.every(i => fs.existsSync(path.join(ROOT, i.src))));
  t.ok('qrcode.js is the vendored library, unmodified (56,694 bytes)', fs.statSync(path.join(ROOT, 'qrcode.js')).size === 56694);
};
