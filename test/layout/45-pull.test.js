/* Pull = X-Men (John, 6 Oct; the whole page since 24 Oct), measured side by
   side in real Chromium, in every view of ref/pull-map.js at 320, 390 and
   1024 px. The reference (ref/x-men.json) was captured from the live X-Men
   tracker by ref/capture-x-men.js; pull-map.js says which X-Men element each
   template element is measured against.
   - Colours, families, weights, case and style must be exact; sizes and
     positions within 0.5 px.
   - Every difference left is listed in DIFFERENCES with the kept item, the
     ruling or the step of session 8 that explains it, and this suite keeps
     that list true in both directions. A step that is done may leave nothing.
   - Every visible template element is mapped, a wrapper, or listed in ONLY
     with its reason (the inventory); the capture refuses an unmapped X-Men one.
   - The folder tab's shape is read from pixels, on the landing at 390 px. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, pullRef } = require('../lib/helpers');
const { serve, open, closeBrowser } = require('./lib');
const PM = require('./ref/pull-map');
const REF = require('./ref/x-men.json');

const SIZE = /^(fontSize|letterSpacing|border\w*Width|border\w*Radius|box(Left|Width|Height|Top|Bottom)|padding\w+|margin\w+|columnGap|rowGap|gapPrev|rel\w+|scrollY)$/;
const same = (prop, a, b) => {
  if (PM.NEAR[prop] !== undefined) return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= PM.NEAR[prop];
  return SIZE.test(prop) && /px$/.test(a) && /px$/.test(b) ? Math.abs(parseFloat(a) - parseFloat(b)) <= 0.5 : a === b;
};
const glob = p => new RegExp('^' + p.split('*').map(s => s.replace(/[.?+^$()[\]{}|\\/]/g, '\\$&')).join('.*') + '$');
const stepOf = reason => { const m = /^step (\w+):/.exec(reason); return m ? m[1] : null; };
const done = step => PM.STEPS.indexOf(step) !== -1 && PM.STEPS.indexOf(step) <= PM.STEPS.indexOf(PM.CURRENT_STEP);
const mapHash = () => crypto.createHash('sha256').update(JSON.stringify(PM.VIEWS.map(v => PM.MAP[v].map(r => [r[0], r[1], r[3]])))).digest('hex').slice(0, 16);

/* The template side: the pull-ref fixture in Pull, driven through every view
   at one width. Returns { views: {view: styles}, uncovered: {view: {key: n}}, shape, skin, errors }. */
async function measureTemplate(url, w) {
  const pg = await open(url, { width: w, height: PM.HEIGHTS[w], reducedMotion: 'reduce',
    storage: { 'pull-ref:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'pull' }) } });
  const page = pg.page, views = {}, uncovered = {};
  let eraShape = null, finish = null;
  for (const v of PM.VIEWS) {
    await PM.DRIVE.template[v](page);
    if (v === 'landing') finish = await page.evaluate(() => {
      const f = document.querySelector('#pprog .pfinish'), l = document.querySelector('#pprog .pleft');
      if (!f || !l) return null;
      const a = f.getBoundingClientRect(), b = l.getBoundingClientRect();
      return { gap: Math.round(b.left - a.right), dy: Math.round(Math.abs(a.top - b.top)) };
    });
    views[v] = await page.evaluate(([fn, rows]) => eval('(' + fn + ')')(rows, 'template'), [PM.measure.toString(), PM.MAP[v]]);
    const inv = await page.evaluate(([fn, cov]) => eval('(' + fn + ')')(cov), [PM.inventory.toString(), PM.covers('template')]);
    if (Object.keys(inv).length) uncovered[v] = inv;
    if (v === 'landing' && w === PM.WIDTH) eraShape = await PM.shape(page, 'template');
  }
  const skin = await page.evaluate(() => document.documentElement.getAttribute('data-skin'));
  const used = await page.evaluate(sels => sels.map(s => { try { return document.querySelectorAll(s).length; } catch (e) { return 0; } }), PM.ONLY.template.map(o => o[0]));
  await pg.close();
  return { views, uncovered, shape: eraShape, finish, skin, used, errors: pg.errors };
}

module.exports = async function (t) {
  try {
    // ------------------------------------------------ the reference
    t.ok('the reference names its source, its live URL, commit and sha256 (X-Men ' + String(REF.commit).slice(0, 7) + ')',
         REF.source === 'ASIMKARD/X-men' && /^https:\/\//.test(REF.url) && /^[0-9a-f]{40}$/.test(REF.commit) && /^[0-9a-f]{64}$/.test(REF.sha256));
    t.eq('…at every width and in every view this map measures', [REF.widths, REF.views], [PM.WIDTHS, PM.VIEWS]);
    t.eq('…captured with this map (re-capture after changing an X-Men selector or a property)', REF.mapHash, mapHash());
    t.eq('…and the folder tab\'s shape, read from pixels', PM.SHAPE_PROPS.filter(p => !REF.shape || REF.shape[p] == null), []);
    t.ok('…and its eleven era colours, tab and strip, in order (Pull\'s default palette, John, 13 Oct)', Array.isArray(REF.eras) && REF.eras.length === 11 &&
         REF.eras.every(e => /^#[0-9A-F]{6}$/.test(e.tab) && /^#[0-9A-F]{6}$/.test(e.strip)));
    t.eq('…and every X-Men element it maps was found', PM.WIDTHS.flatMap(w => PM.VIEWS.flatMap(v =>
      Object.entries(REF.measured[w].views[v].styles).filter(e => e[1] === null).map(e => v + '/' + e[0] + '@' + w))), []);

    // ------------------------------------------------ the lists' own rules
    const reasons = Object.entries(PM.DIFFERENCES).concat(PM.ONLY['x-men'], PM.ONLY.template);
    t.eq('every difference and one-sided element gives its reason as a kept item, accessible, unseen (X-Men draws it where it never shows), John\'s ruling or a step', reasons.filter(r => !PM.REASON.test(r[1])).map(r => r[0]), []);
    t.eq('…and none is tied to a step already done (step ' + PM.CURRENT_STEP + ')', reasons.filter(r => stepOf(r[1]) && done(stepOf(r[1]))).map(r => r[0]), []);

    // ------------------------------------------------ Pull, measured the same way
    const built = pullRef();
    const srv = await serve(built.out);
    const got = {}, errors = [], skins = [];
    for (const w of PM.WIDTHS) {
      got[w] = await measureTemplate(srv.url, w);
      skins.push(got[w].skin);
      errors.push(...got[w].errors);
    }
    await srv.close();
    t.eq('the template is in Pull at every width', skins, PM.WIDTHS.map(() => 'pull'));
    t.eq('every visible template element is mapped, a wrapper or listed with its reason (the inventory)',
         PM.WIDTHS.flatMap(w => Object.entries(got[w].uncovered).map(([v, inv]) => v + '@' + w + ': ' + Object.keys(inv).join(' '))), []);
    t.eq('every template-only entry still names something on the page', PM.ONLY.template.filter((o, i) => PM.WIDTHS.every(w => !got[w].used[i])).map(o => o[0]), []);

    const differ = [], matched = [];
    for (const w of PM.WIDTHS) {
      for (const v of PM.VIEWS) {
        const ref = REF.measured[w].views[v].styles, tpl = got[w].views[v];
        for (const [what, , , props] of PM.MAP[v]) {
          for (const p of props) {
            const a = ref[what] && ref[what][p], b = tpl[what] ? tpl[what][p] : undefined;
            (same(p, a, b) ? matched : differ).push({ k: v + '/' + what + '.' + p + '@' + w, a, b });
          }
        }
      }
    }
    for (const p of PM.SHAPE_PROPS) {
      const a = REF.shape[p], b = got[PM.WIDTH].shape && got[PM.WIDTH].shape[p];
      (same(p, a, b) ? matched : differ).push({ k: 'landing/era shape.' + p + '@' + PM.WIDTH, a, b });
    }
    // PULL_REPORT=file writes every measured difference and the inventory, for a session's report
    if (process.env.PULL_REPORT) fs.writeFileSync(process.env.PULL_REPORT, JSON.stringify({ differ, uncovered: PM.WIDTHS.map(w => got[w].uncovered) }, null, 1));
    const pats = Object.keys(PM.DIFFERENCES).map(p => [p, glob(p)]);
    const unlisted = differ.filter(d => !pats.some(([, re]) => re.test(d.k)));
    t.eq('every difference from X-Men is listed with its reason (' + matched.length + ' match, ' + differ.length + ' listed)',
         unlisted.map(d => d.k + ': X-Men ' + JSON.stringify(d.a) + ', Pull ' + JSON.stringify(d.b)), []);
    t.eq('…and every listed difference is still one', pats.filter(([, re]) => !differ.some(d => re.test(d.k))).map(([p]) => p), []);
    t.eq('no page errors', errors, []);
    t.eq('the plan\'s finish-by date sits right beside the time remaining, on its line, at every width (John, 24 Oct)',
         PM.WIDTHS.filter(w => !got[w].finish || got[w].finish.dy > 1 || got[w].finish.gap < 0 || got[w].finish.gap > 16).map(w => w + ': ' + JSON.stringify(got[w].finish)), []);

    // ------------------------------------------------ the reference is still X-Men's
    // CI has no X-Men copy and the live site is outside it; a session re-captures and compares.
    const dir = process.env.X_MEN_DIR || path.join(ROOT, '..', 'X-men');
    if (fs.existsSync(path.join(dir, 'index.html')) && process.env.X_MEN_LIVE) {
      const { capture, URL_LIVE } = require('./ref/capture-x-men');
      const { ref, uncovered } = await capture(REF.url || URL_LIVE, dir);
      t.eq('the reference still matches the live X-Men tracker (re-captured now)', [ref.sha256, ref.measured, ref.shape, ref.eras], [REF.sha256, REF.measured, REF.shape, REF.eras]);
      t.eq('…and nothing visible on it is unmapped', uncovered, {});
    } else {
      t.ok('drift check needs a local X-Men copy and X_MEN_LIVE=1 (a session runs it)', true);
    }
  } finally {
    await closeBrowser();
  }
};
