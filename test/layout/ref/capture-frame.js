#!/usr/bin/env node
/* Session-only: record (or compare) a v9-frame reference for 47-frame-v9.

     node test/layout/ref/capture-frame.js --fixture test/fixtures/sig-v9/dataset.json   (writes frame-ref.json beside it)
     node test/layout/ref/capture-frame.js --root                                        (the repo's own dataset: ./frame-ref.json)
     node test/layout/ref/capture-frame.js --dir DIR [--out FILE]                         (any built tracker, served as it is: an old version)
     … --compare FILE                                                                     (measure, and list every difference from FILE)

   Run it by hand only, after John has seen the measured difference (John, 25
   Oct: Absolute's own skin keeps v9 exactly; 47-frame-v9 holds it there). */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { ROOT, build, loadData } = require('../../lib/helpers');
const { serve, open, closeBrowser } = require('../lib');
const FM = require('./frame-map');

/* Serve a whole directory as it is (an old version of a tracker, its own shell). */
function serveDir(dir) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
  return new Promise(ok => {
    const srv = http.createServer((q, r) => {
      let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/') f = '/index.html';
      const p = path.join(dir, f);
      if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(c => srv.close(c)) }));
  });
}

/* Measure one served tracker at every width. D is its data (for the seed). */
async function measureAll(url, D) {
  const measured = {};
  for (const w of FM.WIDTHS) {
    const pg = await open(url, { width: w, height: FM.HEIGHTS[w], reducedMotion: 'reduce', storage: FM.seed(D) });
    measured[w] = await FM.measurePage(pg.page);
    if (pg.errors.length) throw new Error('page errors at ' + w + ' px: ' + pg.errors.join(' | '));
    await pg.close();
  }
  return measured;
}

async function measureSource(opts) {
  if (opts.dir) {
    const dir = path.resolve(opts.dir), srv = await serveDir(dir);
    try { return { source: path.basename(dir), measured: await measureAll(srv.url, loadData(dir)) }; } finally { await srv.close(); }
  }
  if (opts.root) {
    const srv = await serve(null);
    try { return { source: 'the repo\'s own dataset', measured: await measureAll(srv.url, loadData(ROOT)) }; } finally { await srv.close(); }
  }
  const b = build(path.resolve(opts.fixture), { label: 'frame-ref' });
  if (b.status !== 0) throw new Error('the fixture does not build:\n' + b.stderr);
  const srv = await serve(b.out);
  try { return { source: path.relative(ROOT, path.resolve(opts.fixture)), measured: await measureAll(srv.url, loadData(b.out)) }; } finally { await srv.close(); }
}

function diffAll(ref, got) {
  const out = [];
  for (const w of FM.WIDTHS) for (const v of FM.VIEWS) for (const d of FM.compare(ref.measured[w][v], got.measured[w][v])) out.push(v + '@' + w + ' ' + d);
  return out;
}

module.exports = { measureSource, measureAll, serveDir, diffAll };

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
  const opts = { fixture: opt('--fixture'), dir: opt('--dir'), root: args.includes('--root') };
  if (!opts.fixture && !opts.dir && !opts.root) { console.error('usage: capture-frame.js --fixture DATASET | --root | --dir DIR [--out FILE] [--compare FILE]'); process.exit(2); }
  measureSource(opts).then(got => {
    const ref = Object.assign({ frame: 'v9', widths: FM.WIDTHS, views: FM.VIEWS, captured: new Date().toISOString().slice(0, 10) }, got);
    const cmp = opt('--compare');
    if (cmp) {
      const diffs = diffAll(JSON.parse(fs.readFileSync(cmp, 'utf8')), ref);
      console.log(diffs.length ? diffs.join('\n') : 'no differences');
      console.log(diffs.length + ' differences, ' + FM.WIDTHS.length * FM.VIEWS.length + ' views measured');
      return;
    }
    const out = opt('--out') || (opts.root ? path.join(ROOT, 'frame-ref.json') : opts.dir ? null : path.join(path.dirname(path.resolve(opts.fixture)), 'frame-ref.json'));
    if (!out) { console.error('--dir needs --out (or --compare)'); process.exitCode = 2; return; }
    fs.writeFileSync(out, JSON.stringify(ref) + '\n');
    console.log('wrote ' + path.relative(process.cwd(), out));
  }).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => closeBrowser());
}
