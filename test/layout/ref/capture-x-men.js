#!/usr/bin/env node
/* Session-only: capture X-Men's computed styles at 393 px into x-men.json.

     node test/layout/ref/capture-x-men.js [path to a local X-Men copy]   (default ../X-men)
     node test/layout/ref/capture-x-men.js --print [path]                  (print, don't write)

   X-Men is read-only (CLAUDE.md): clone or pull it, never write to it. This
   script only serves its files to Chromium and reads computed styles. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { browser, closeBrowser } = require('../lib');
const { WIDTH, HEIGHT, MAP, measure, prepareXMen } = require('./pull-map');

const OUT = path.join(__dirname, 'x-men.json');

async function capture(dir) {
  const commit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const srv = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]);
    if (f === '/') f = '/index.html';
    const p = path.join(dir, f);
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    fs.createReadStream(p).pipe(r);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const b = await browser();
  const ctx = await b.newContext({ viewport: { width: WIDTH, height: HEIGHT }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* fresh visit */ } });
  await page.goto('http://localhost:' + srv.address().port + '/');
  await page.evaluate(() => document.fonts.ready);
  await prepareXMen(page);
  const styles = await page.evaluate(([fn, map]) => eval('(' + fn + ')')(map, 'x-men'), [measure.toString(), MAP]);
  await ctx.close();
  srv.close();
  return { source: 'ASIMKARD/X-men', commit, width: WIDTH, styles };
}

module.exports = { capture, OUT };

if (require.main === module) {
  const args = process.argv.slice(2), print = args.includes('--print');
  const dir = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', '..', '..', 'X-men'));
  capture(dir).then(ref => {
    const txt = JSON.stringify(ref, null, 1) + '\n';
    if (print) process.stdout.write(txt); else { fs.writeFileSync(OUT, txt); console.log('wrote ' + path.relative(process.cwd(), OUT) + ' from X-Men ' + ref.commit.slice(0, 7)); }
  }).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => closeBrowser());
}
