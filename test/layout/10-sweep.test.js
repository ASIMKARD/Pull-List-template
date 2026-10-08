/* The 320 px sweep (session 3's lesson, L-9): every tab, with everything open,
   at 320, 360 and 390 px, on four datasets, the full fixture and the repo's own
   dataset (the demo, or a tracker's real data) in every skin it offers and with
   large text and large buttons. No horizontal overflow, all four tabs
   fully visible in the bar, no page or console errors. Real fonts.

   Buttons fit (John's phone, 5 Oct): page overflow alone missed a depth chip
   cut off inside its own scrolling row, and Settings rows that left one chip
   beside the label and dropped the rest under it. So every control is also
   checked against every box that clips it, every Settings row keeps its
   controls together, and the depth chips stay on one line (T-95). */
'use strict';
const path = require('path');
const { ROOT, FIX, ROOT_DATASET, IS_TEMPLATE, build, basic, mixed } = require('../lib/helpers');
const { serve, open, openAll, openSettings, closeBrowser } = require('./lib');

const WIDTHS = [320, 360, 390];
const TABS = ['list', 'reading', 'reviews', 'settings'];

/* Chip bars that scroll sideways by design: the era jump bar and the pins. */
const SCROLLERS = '.eranav-in, .pinbar-in';

/* Measured on the current tab, without scrolling anything:
   clipped: a control (not hidden, not inert) that reaches past the inside edge
            of an ancestor that clips sideways (overflow-x other than visible);
   split:   a Settings row with controls both on the label's line and under it;
   depth:   the depth chips not on one line, or their row hiding any of them. */
async function fit(page) {
  return page.evaluate(sel => {
    const name = el => el.tagName.toLowerCase() + (el.dataset.act ? '[' + el.dataset.act + (el.dataset.k ? ':' + el.dataset.k : '') +
      (el.dataset.v !== undefined ? '=' + el.dataset.v : '') + ']' : el.id ? '#' + el.id : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
    const live = el => !el.closest('[hidden]') && !el.closest('[inert]') && el.getClientRects().length > 0;
    const controls = [...document.querySelectorAll('button, a[href], input:not(.vh), select, textarea')].filter(live);
    const clipped = [];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === 'visible' || a.matches(sel)) continue;
        const ar = a.getBoundingClientRect(), left = ar.left + a.clientLeft, right = left + a.clientWidth;
        if (r.left < left - 0.5 || r.right > right + 0.5) {
          clipped.push(name(el) + ' is cut off by ' + a.tagName.toLowerCase() + '.' + [...a.classList].join('.') + ' (' +
            Math.round(Math.max(left - r.left, r.right - right)) + ' px hidden)');
          break;
        }
      }
    }
    const split = [];
    for (const row of document.querySelectorAll('#settings .srow')) {
      if (!live(row)) continue;
      const lab = row.querySelector('.slabel').getBoundingClientRect();
      const ctl = [...row.querySelectorAll('button, a[href], select, input:not(.vh), label')].filter(live).map(el => el.getBoundingClientRect());
      const beside = ctl.filter(r => r.top < lab.bottom - 0.5).length, under = ctl.length - beside;
      if (beside && under) split.push(row.querySelector('.slabel').textContent + ': ' + beside + ' beside the label, ' + under + ' under it');
    }
    const row = document.querySelector('#fsec-reading .depthrow');
    let depth = null;
    if (row && live(row)) {
      depth = [];
      const tops = [...row.children].map(c => Math.round(c.getBoundingClientRect().top));
      if (new Set(tops).size > 1) depth.push('the chips wrap onto ' + new Set(tops).size + ' lines');
      if (row.scrollWidth > row.clientWidth + 0.5) depth.push('the row hides ' + (row.scrollWidth - row.clientWidth) + ' px of chips');
    }
    return { clipped, split, depth };
  }, SCROLLERS);
}

module.exports = async function (t) {
  const minimal = build(path.join(FIX, 'minimal', 'dataset.json'), { label: 'layout-minimal' });
  const FK = 'fixture', RF = ROOT_DATASET.franchise, RK = RF.key, rn = IS_TEMPLATE ? 'starter' : RK;
  // the root opens in its signature skin if it has one, else the first it offers; then every other skin it offers
  const rootSkins = (RF.skins || ['paper', 'newsprint', 'pull', 'night']).filter((s, i) => RF.signature || i > 0);
  const sets = [['basic', basic().out], ['mixed', mixed().out], ['minimal', minimal.out], [rn, ROOT]]
    .concat(['paper', 'newsprint', 'pull', 'night'].map(skin => ['basic in ' + skin, basic().out, { skin }, FK]))   // 'basic' itself opens in its signature skin
    .concat([['basic, large text and buttons', basic().out, { textSize: 'l', tap: 'large' }, FK]])
    .concat(rootSkins.map(skin => [rn + ' in ' + skin, ROOT, { skin }, RK]))
    .concat([[rn + ', large text and buttons', ROOT, { textSize: 'l', tap: 'large' }, RK]]);
  try {
    for (const [name, dir, look, key] of sets) {
      const srv = await serve(dir);
      for (const w of WIDTHS) {
        const storage = look ? { [key + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, look)) } : undefined;
        const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage });
        const over = [], cut = [], clipped = [], split = [], depth = [];
        let hasDepth = false;
        for (const tab of TABS) {
          if (tab === 'list') await openAll(pg.page);
          else if (tab === 'settings') await openSettings(pg.page);
          else await pg.page.click('#tab-' + tab);
          const m = await pg.page.evaluate(() => {
            const vw = window.innerWidth, nav = document.querySelector('#tabs'), nr = nav.getBoundingClientRect();
            const hidden = [...nav.querySelectorAll('[role="tab"]')].filter(b => {
              const r = b.getBoundingClientRect();
              return r.left < Math.max(0, nr.left) - 0.5 || r.right > Math.min(vw, nr.right) + 0.5;
            }).map(b => b.textContent);
            return { sw: document.documentElement.scrollWidth, vw, hidden, navScroll: nav.scrollWidth - nav.clientWidth };
          });
          if (m.sw > m.vw) over.push(tab + ': ' + m.sw + ' px');
          if (m.hidden.length || m.navScroll > 0) cut.push(tab + ': ' + (m.hidden.join(', ') || 'the bar scrolls ' + m.navScroll + ' px'));
          const f = await fit(pg.page);
          clipped.push(...f.clipped.map(x => tab + ': ' + x));
          if (tab === 'settings') split.push(...f.split);
          if (tab === 'list' && f.depth) { hasDepth = true; depth.push(...f.depth); }
        }
        t.eq(name + ' @ ' + w + ' px: no horizontal overflow on any tab, everything open', over, []);
        t.eq(name + ' @ ' + w + ' px: all four tabs fully visible in the bar', cut, []);
        t.eq(name + ' @ ' + w + ' px: no control is cut off by a box that clips it', clipped, []);
        t.eq(name + ' @ ' + w + ' px: every Settings row keeps its controls together, beside the label or under it', split, []);
        if (hasDepth) t.eq(name + ' @ ' + w + ' px: the depth chips sit on one line and none is cut off (T-95)', depth, []);
        t.eq(name + ' @ ' + w + ' px: no page or console errors (L-9)', pg.errors, []);
        await pg.close();
      }
      await srv.close();
    }
  } finally { await closeBrowser(); }
};
