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
/* A DERIVED colour is a colour function whose every component draws on a
   token, e.g. an era's wash computed from its index: everything it is made of
   still comes from :root, so the single source holds. Anything with a literal
   component (hsl(200 50% 50%), a literal alpha, #fff, rgb()) is not derived. */
function components(args) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of args) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /[\s,/]/.test(ch)) { if (cur.trim()) parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}
function stripDerived(body) {
  const re = /\b(hsl|hsla|oklch)\(/g;
  let out = '', i = 0, m;
  while ((m = re.exec(body))) {
    let depth = 1, j = m.index + m[0].length;
    while (j < body.length && depth) { if (body[j] === '(') depth++; else if (body[j] === ')') depth--; j++; }
    if (components(body.slice(m.index + m[0].length, j - 1)).every(c => /var\(--/.test(c))) {
      out += body.slice(i, m.index) + 'DERIVED'; i = j; re.lastIndex = j;
    }
  }
  return out + body.slice(i);
}

function makeSwContext(existing) {
  const handlers = {}, calls = { addAll: [], skipWaiting: 0, claim: 0, put: 0, respond: [], deleted: [], fetch: [] };
  const cache = {
    addAll: list => { calls.addAll.push(list); return Promise.resolve(); },
    put: () => { calls.put++; return Promise.resolve(); },
    keys: () => Promise.resolve([])
  };
  class Response { constructor(body, init) { this.body = body; this.status = (init && init.status) || 200; this.type = 'basic'; } clone() { return this; } }
  class Request { constructor(url, init) { this.url = url; this.cache = (init && init.cache) || 'default'; } }
  const ctx = {
    URL, Promise, Response, Request, console,
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => { calls.skipWaiting++; return Promise.resolve(); },
      clients: { claim: () => { calls.claim++; return Promise.resolve(); } }
    },
    caches: {
      open: () => Promise.resolve(cache),
      keys: () => Promise.resolve(existing || ['old-cache']),
      delete: k => { calls.deleted.push(k); return Promise.resolve(true); },
      // one stored file, ./app.js as the install stores it (no stamp)
      match: (req, o) => { const u = new URL(req.url || req, 'https://x.local/app/sw.js'); if (o && o.ignoreSearch) u.search = '';
                           return Promise.resolve(u.href === 'https://x.local/app/app.js' ? new Response('stored app.js') : undefined); }
    },
    fetch: (req, init) => { calls.fetch.push({ url: req.url || req, cache: (init && init.cache) || req.cache || 'default' }); return Promise.reject(new Error('offline')); }
  };
  return { ctx, handlers, calls };
}

module.exports = async function (t) {
  // ---- listener budget (spec: <= 12 for the whole app) ----
  const appJs = read('app.js');
  const staticListeners = (codeOnly(appJs).match(/addEventListener\s*\(/g) || []).length;
  t.ok('app.js registers at most 12 listeners (static count: ' + staticListeners + ')', staticListeners <= 12);
  t.ok('no inline on*= handlers in index.html', !/\son[a-z]+\s*=/.test(read('index.html')));
  /* an on-handler assignment (el.onclick = …) is a listener the budget can't
     see. Only real event-handler names count: \`pwa.online = …\` is a field. */
  const { JSDOM } = require('jsdom');
  const hw = new JSDOM('').window;
  const HANDLER_EXTRA = ['onstatechange', 'onupdatefound', 'oncontrollerchange', 'onmessage', 'onbeforeinstallprompt', 'onappinstalled'];
  const isHandler = n => HANDLER_EXTRA.includes(n) || n in hw || n in hw.document || n in hw.HTMLElement.prototype || n in hw.FileReader.prototype;
  const onAssign = src => (src.match(/\.(on[a-z]+)\s*=(?!=)/g) || []).map(m => m.slice(1).replace(/\s*=$/, '')).filter(isHandler);
  t.eq('no element.onclick-style assignments in app.js', onAssign(codeOnly(appJs)), []);
  t.ok('…the check still sees one (el.onclick =, reader.onload =, worker.onstatechange =) and ignores a field named online',
       onAssign('a.onclick = f; r.onload = g; w.onstatechange = h;').length === 3 && onAssign('pwa.online = on; x.onlineCount = 1;').length === 0);

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
  const coloured = cssBlocks(css).filter(b => COLOUR.test(stripDerived(b.body)));
  t.ok('exactly one rule block writes a colour (derived colours aside)', coloured.length === 1, coloured.map(b => b.sel).join(' | '));
  const derived = cssBlocks(css).filter(b => b.sel !== ':root' && COLOUR.test(b.body)).map(b => b.sel);
  t.ok('derived colours outside :root are drawn from tokens only (' + derived.join(', ') + ')', derived.length >= 2);
  const caught = x => COLOUR.test(stripDerived(x));
  t.ok('the derived-colour exemption still catches literals: hsl(200 50% 50%), a literal alpha, a partly literal hsl, #fff, rgb()',
       caught('a: hsl(200 50% 50%)') && caught('a: hsl(var(--h) var(--s) var(--l) / .5)') && caught('a: hsl(var(--h) 50% 50%)') &&
       caught('a: #fff') && caught('a: rgb(var(--r) var(--g) var(--b))') && caught('a: oklch(.9 .03 var(--h))'));
  t.ok('…and lets a token-only formula through (an era wash from its index)',
       !caught('background: oklch(var(--a) var(--c) calc(var(--h0) + var(--ei, 0) * var(--step)))') && !caught('b: hsl(var(--h) var(--s) var(--l))'));
  t.ok('that block is :root (the single token source)', coloured.length === 1 && coloured[0].sel === ':root');
  t.ok('every colour in it is a custom property', coloured.length === 1 &&
       coloured[0].body.split(';').filter(d => COLOUR.test(d)).every(d => /^\s*--[\w-]+\s*:/.test(d)));
  // ---- skins and the Look settings are token sets (V-5: they never move or hide a control) ----
  const LOOK_SEL = /^:root\[data-(skin|paper|eras|text|density|tap|marks|dys)="[\w-]+"\]$|^\.swatch\[data-v="[\w-]+"\]$/;
  const lookBlocks = cssBlocks(css).filter(b => b.sel.split(',').some(x => LOOK_SEL.test(x.trim()) || /\[data-(skin|paper)=/.test(x)));
  const decls = b => b.body.split(';').map(x => x.trim()).filter(Boolean);
  t.ok('skin, paper and Look blocks are bare (no descendant selectors): ' + lookBlocks.length + ' blocks',
       lookBlocks.length >= 16 && lookBlocks.every(b => b.sel.split(',').every(x => LOOK_SEL.test(x.trim()))), lookBlocks.map(b => b.sel).join(' | '));
  t.ok('…and set custom properties only: no position, display, visibility, size or order',
       lookBlocks.every(b => decls(b).every(d => /^--[\w-]+\s*:/.test(d))), lookBlocks.filter(b => !decls(b).every(d => /^--[\w-]+\s*:/.test(d))).map(b => b.sel).join(' | '));
  const tokenOnly = b => decls(b).every(d => /^--[\w-]+\s*:/.test(d));
  t.ok('the token-only check sees a real declaration', !tokenOnly({ body: '--a: 1; position: relative' }) && tokenOnly({ body: '--a: 1; --b: var(--c)' }));
  const buildSkins = (read('tools/build.py').match(/^SKINS = \[([^\]]+)\]/m) || ['', ''])[1].match(/'([\w-]+)'/g).map(x => x.slice(1, -1));
  const appSkins = Object.keys(JSON.parse(appJs.match(/var SKIN_NAMES = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"')));
  t.eq('the build and app.js know the same skins, base first', appSkins, buildSkins);
  t.eq('every skin but the base has its own token block in styles.css', buildSkins.slice(1).filter(k => !cssBlocks(css).some(b => b.sel === ':root[data-skin="' + k + '"]')), []);
  const papers = (appJs.match(/var PAPERS = \[([\s\S]*?)\];/)[1].match(/\['([\w-]+)'/g) || []).map(x => x.slice(2, -1));
  t.eq('every paper swatch but the skin default has its block, colouring the page and its own button',
       papers.filter(k => k !== 'default' && !cssBlocks(css).some(b => b.sel === ':root[data-paper="' + k + '"], .swatch[data-v="' + k + '"]')), []);
  t.ok('the stylesheet carries the skin beacon app.js expects (F-57, T-98)',
       /--skin-ok:\s*(\d+)/.test(css) && css.match(/--skin-ok:\s*(\d+)/)[1] === (appJs.match(/var SKIN_OK = '(\d+)'/) || [])[1]);

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
  // "absolute" is a franchise (the Absolute line) AND a CSS keyword: the CSS
  // declaration is ignored, the word anywhere else is still caught.
  const noCssKeywords = src => src.replace(/position\s*:\s*absolute/gi, 'position: X');
  t.ok('franchise scan: "position: absolute" is not a franchise string, "Absolute Batman" still is',
       !REAL.test(noCssKeywords('.a { position: absolute; }')) && REAL.test(noCssKeywords('Absolute Batman')));
  for (const f of TEMPLATE_CODE) {
    const src = noCssKeywords(read(f));
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
  /* Every tracker on one origin (one GitHub Pages user site) shares one cache
     storage: the worker may only remove this tracker's own earlier caches. */
  const K = D.franchise.key, CUR = K + '-' + D.build;
  const OWN_OLD = [K + '-v7', K + '-0123456789ab'];
  const OTHERS = ['spider-man-v12', 'idw-sonic-0123456789ab', K + 'x-v3', K + '-notes', K + '-v7-extra', K + '-0123456789AB', 'workbox-precache-v2'];
  const { ctx, handlers, calls } = makeSwContext([CUR].concat(OWN_OLD, OTHERS));
  let evalErr = null;
  try { vm.runInNewContext(sw, ctx, { filename: 'sw.js' }); } catch (e) { evalErr = e; }
  t.ok('sw.js evaluates without throwing (catches TDZ errors node --check misses)', !evalErr, evalErr && evalErr.message);
  t.ok('sw.js registers install, activate and fetch', ['install', 'activate', 'fetch'].every(k => typeof handlers[k] === 'function'));
  if (!evalErr && handlers.install) {
    let wait = null;
    handlers.install({ waitUntil: p => { wait = p; } });
    await wait;
    const reqs = calls.addAll[0] || [], list = reqs.map(r => typeof r === 'string' ? r : r.url);
    t.ok('install precaches the shell', ['./', './index.html', './app.js', './styles.css', './data.js', './qrcode.js', './manifest.json']
         .every(p => list.includes(p)));
    t.ok('install precaches all 12 fonts (defect 2)', list.filter(p => /^\.\/fonts\/.+\.woff2$/.test(p)).length === 12);
    t.ok('install precaches the 3 icons (defect 2)', list.filter(p => /^\.\/icons\/.+\.png$/.test(p)).length === 3);
    const missing = list.filter(p => p !== './' && !fs.existsSync(path.join(ROOT, p)));
    t.ok('every precached path exists on disk (addAll rejects on one 404)', missing.length === 0, missing.join(', '));
    t.ok('install calls skipWaiting', calls.skipWaiting === 1);
    /* GitHub Pages: max-age=600. A precache through the browser's HTTP cache can store the previous
       deploy's files under the new cache name (the Absolute upgrade proof, 8 Oct). */
    t.ok('install precaches every file past the browser\'s HTTP cache (cache: \'reload\')', reqs.length > 0 && reqs.every(r => r && r.cache === 'reload'),
         reqs.filter(r => !r || r.cache !== 'reload').map(r => r && r.url || r).join(', '));
    let aw = null;
    handlers.activate({ waitUntil: p => { aw = p; } });
    await aw;
    t.ok('activate claims clients', calls.claim === 1);
    t.eq('activate removes only this tracker\'s own earlier caches (' + OWN_OLD.join(', ') + '): another tracker\'s, and anything else, stay',
         calls.deleted.slice().sort(), OWN_OLD.slice().sort());
    for (const [url, kind] of [['https://x.local/app/index.html', 'shell'], ['https://x.local/app/fonts/anton-400-latin.woff2', 'font']]) {
      let resp = null;
      handlers.fetch({ request: { method: 'GET', url }, respondWith: p => { resp = p; } });
      const r = resp ? await resp : null;
      t.ok('offline ' + kind + ' request still resolves to a real Response (never undefined)', !!r && typeof r.status === 'number');
    }
    {
      let resp = null;
      handlers.fetch({ request: { method: 'GET', url: 'https://x.local/app/app.js?v=0123456789ab' }, respondWith: p => { resp = p; } });
      const r = resp ? await resp : null;
      t.ok('offline, index.html\'s stamped app.js?v=… is answered by the app.js the install stored (never the page, never a 503)',
           !!r && r.status === 200 && r.body === 'stored app.js', r && JSON.stringify(r));
    }
    const shellFetch = calls.fetch.find(f => /index\.html$/.test(f.url));
    t.ok('a shell request is always checked with the server (cache: \'no-cache\'), never served stale from the HTTP cache',
         !!shellFetch && shellFetch.cache === 'no-cache', JSON.stringify(shellFetch));
    t.ok('cache name derives from franchise.key + content hash', sw.includes("'" + D.franchise.key + '-' + D.build + "'"));
  }

  // ---- manifest and icons from config (defect 13) ----
  const man = readJSON(path.join(ROOT, 'manifest.json'));
  t.ok('manifest name is the franchise title, not a placeholder', man.name === D.franchise.title && !/my tracker/i.test(man.name));
  t.ok('manifest icons all exist', man.icons.every(i => fs.existsSync(path.join(ROOT, i.src))));
  t.ok('qrcode.js is the vendored library, unmodified (56,694 bytes)', fs.statSync(path.join(ROOT, 'qrcode.js')).size === 56694);
};
