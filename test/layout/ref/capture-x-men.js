#!/usr/bin/env node
/* Session-only: capture the X-Men tracker's whole page into x-men.json, in
   every view of pull-map.js at every width, from the live site, with the
   folder tab's shape read from pixels and its eleven era colours.

     node test/layout/ref/capture-x-men.js [--dir path] [--url url] [--print]

   --url is the live tracker (default https://asimkard.github.io/X-men/).
   --dir is a local read-only clone (default ../X-men, or X_MEN_DIR): the live
   page must be byte-identical to its index.html, and the reference records
   that commit. X-Men is read-only (CLAUDE.md): this script only reads it.
   It refuses to write a reference while any visible X-Men element is neither
   mapped nor listed (pull-map.js ONLY and WRAPPERS). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { browser, closeBrowser } = require('../lib');
const PM = require('./pull-map');

const OUT = path.join(__dirname, 'x-men.json');
const URL_LIVE = 'https://asimkard.github.io/X-men/';

async function capture(url, dir) {
  const local = fs.readFileSync(path.join(dir, 'index.html'));
  const commit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const b = await browser();
  const widths = {}, uncovered = {};
  let sha = null, eraShape = null, eras = null;
  for (const w of PM.WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: PM.HEIGHTS[w] }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* a fresh visit */ } });
    const res = await page.goto(url);
    const body = await res.body();
    sha = crypto.createHash('sha256').update(body).digest('hex');
    if (!body.equals(local)) throw new Error('the live page (' + url + ') is not the clone\'s index.html at ' + commit.slice(0, 7) + ': pull the clone first');
    const views = {};
    for (const v of PM.VIEWS) {
      await PM.DRIVE['x-men'][v](page);
      const styles = await page.evaluate(([fn, rows]) => eval('(' + fn + ')')(rows, 'x-men'), [PM.measure.toString(), PM.MAP[v]]);
      const inv = await page.evaluate(([fn, cov]) => eval('(' + fn + ')')(cov), [PM.inventory.toString(), PM.covers('x-men')]);
      views[v] = { styles };
      if (Object.keys(inv).length) uncovered[v + '@' + w] = inv;
      if (v === 'landing' && w === PM.WIDTH) {
        eraShape = await PM.shape(page, 'x-men');
        // every era box's colours, in order: Pull's default palette is these (John, 13 Oct; tools/build.py PULL_PALETTE)
        eras = await page.evaluate(() => {
          const hex = c => '#' + c.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();
          return [...document.querySelectorAll('.era-divider')].map(d => ({ tab: hex(getComputedStyle(d.querySelector('.tab')).backgroundColor),
            strip: hex(getComputedStyle(d.querySelector('.era-stats')).backgroundColor) }));
        });
      }
    }
    widths[w] = { views };
    await ctx.close();
  }
  const mapHash = crypto.createHash('sha256').update(JSON.stringify(PM.VIEWS.map(v => PM.MAP[v].map(r => [r[0], r[1], r[3]])))).digest('hex').slice(0, 16);
  return { ref: { source: 'ASIMKARD/X-men', url, commit, sha256: sha, width: PM.WIDTH, widths: PM.WIDTHS, mapHash, views: PM.VIEWS,
                  measured: widths, shape: eraShape, eras }, uncovered };
}

module.exports = { capture, OUT, URL_LIVE };

if (require.main === module) {
  const args = process.argv.slice(2), print = args.includes('--print');
  const opt = k => { const i = args.indexOf(k); return i === -1 ? null : args[i + 1]; };
  const dir = path.resolve(opt('--dir') || process.env.X_MEN_DIR || path.join(__dirname, '..', '..', '..', '..', 'X-men'));
  capture(opt('--url') || URL_LIVE, dir).then(({ ref, uncovered }) => {
    if (Object.keys(uncovered).length) {
      console.error('Not written: visible X-Men elements that nothing maps (add them to pull-map.js MAP, ONLY or WRAPPERS):');
      console.error(JSON.stringify(uncovered, null, 1));
      process.exitCode = 1;
      return;
    }
    const txt = JSON.stringify(ref, null, 1) + '\n';
    if (print) process.stdout.write(txt); else { fs.writeFileSync(OUT, txt); console.log('wrote ' + path.relative(process.cwd(), OUT) + ' from ' + ref.url + ' = X-Men ' + ref.commit.slice(0, 7)); }
  }).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => closeBrowser());
}
