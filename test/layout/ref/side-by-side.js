#!/usr/bin/env node
/* Session-only: X-Men | Pull screenshots, side by side, in every view of
   pull-map.js, for John (session 8: "at each step, send me side-by-side
   screenshots of X-Men and Pull at 390 px").

     node test/layout/ref/side-by-side.js OUTDIR [--width 390] [--url URL]

   The left half is the live X-Men tracker, the right half the template's
   pull-ref fixture in Pull, both driven through the same views as 45-pull.
   Each pair is joined by the page's own canvas, so no image library is
   needed. Writes OUTDIR/<view>-<width>.png. */
'use strict';
const fs = require('fs');
const path = require('path');
const { browser, closeBrowser, serve, open } = require('../lib');
const { pullRef } = require('../../lib/helpers');
const PM = require('./pull-map');
const { URL_LIVE } = require('./capture-x-men');

const SHOTS = PM.VIEWS.filter(v => v !== 'extras');

async function shots(page, drive) {
  const out = {};
  for (const v of PM.VIEWS) {
    await drive[v](page);
    if (SHOTS.includes(v)) out[v] = (await page.screenshot({ type: 'png' })).toString('base64');
  }
  return out;
}

async function join(b, w, h, left, right, labels) {
  const ctx = await b.newContext({ viewport: { width: w * 2 + 24, height: h + 28 } });
  const page = await ctx.newPage();
  await page.setContent('<body style="margin:0;background:#888"></body>');
  const png = await page.evaluate(async ([l, r, w, h, labels]) => {
    const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + src; });
    const [a, z] = await Promise.all([load(l), load(r)]);
    const cv = document.createElement('canvas'); cv.width = w * 2 + 24; cv.height = h + 28;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#888'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#fff'; cx.font = '600 14px sans-serif';
    cx.fillText(labels[0], 8, 18); cx.fillText(labels[1], w + 24 + 8, 18);
    cx.drawImage(a, 0, 28); cx.drawImage(z, w + 24, 28);
    return cv.toDataURL('image/png').split(',')[1];
  }, [left, right, w, h, labels]);
  await ctx.close();
  return Buffer.from(png, 'base64');
}

async function main(outDir, w, url) {
  fs.mkdirSync(outDir, { recursive: true });
  const h = PM.HEIGHTS[w], b = await browser();
  const xctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const xp = await xctx.newPage();
  await xp.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* a fresh visit */ } });
  await xp.goto(url);
  const xm = await shots(xp, PM.DRIVE['x-men']);
  await xctx.close();
  const srv = await serve(pullRef().out);
  const pg = await open(srv.url, { width: w, height: h, reducedMotion: 'reduce',
    storage: { 'pull-ref:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'pull' }) } });
  const tp = await shots(pg.page, PM.DRIVE.template);
  await pg.close(); await srv.close();
  const files = [];
  for (const v of SHOTS) {
    const f = path.join(outDir, v + '-' + w + '.png');
    fs.writeFileSync(f, await join(b, w, h, xm[v], tp[v], ['X-Men (live) — ' + v + ', ' + w + ' px', 'Pull (template) — ' + v + ', ' + w + ' px']));
    files.push(f);
  }
  return files;
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
  const outDir = args.find(a => !a.startsWith('--') && a !== opt('--width') && a !== opt('--url'));
  if (!outDir) { console.error('usage: side-by-side.js OUTDIR [--width 390] [--url URL]'); process.exit(2); }
  main(path.resolve(outDir), +(opt('--width') || PM.WIDTH), opt('--url') || URL_LIVE)
    .then(files => files.forEach(f => console.log(f))).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => closeBrowser());
}

module.exports = { main };
