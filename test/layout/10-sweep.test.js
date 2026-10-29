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
const { ROOT, FIX, ROOT_DATASET, IS_TEMPLATE, build, basic, mixed, copyFixture, readJSON, writeJSON } = require('../lib/helpers');
const { serve, open, openAll, openSettings, closeBrowser } = require('./lib');

const WIDTHS = [320, 360, 390];
const TABS = ['list', 'reading', 'reviews', 'settings'];

/* Chip bars that scroll sideways by design: the era jump bar and the pins. */
const SCROLLERS = '.eranav-in, .pinbar-in';

/* Measured on the current tab, without scrolling anything:
   clipped: a control (not hidden, not inert) that reaches past the inside edge
            of an ancestor that clips sideways (overflow-x other than visible);
   split:   a Settings row with controls both on the label's line and under it;
   depth:   the depth chips not on one line, or their row hiding any of them;
   rings:   a focus ring inside an x-frame card cut by a box that clips it (the card
            clips what reaches past its edge, for swipe): each control there is
            focused from the keyboard, and its ring (the control grown by its
            outline; the browser's own draws 2 px) must fit inside (session 8, step 5). */
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
    /* the folder tab (Pull, session 7): no era text crosses the cut or sits in the painted corner. The cut runs
       from (100 % − cut) of the tab's width at its top to 100 % at its bottom; with no cut (every other skin)
       this asks that the text stay inside the tab. Each line of text, and each name's box (decorations included). */
    const cutText = [];
    for (const tab of document.querySelectorAll('.era-head .bhead')) {
      if (!live(tab)) continue;
      const t = tab.getBoundingClientRect(), f = (parseFloat(getComputedStyle(tab).getPropertyValue('--era-cut')) || 0) / 100;
      const edge = y => t.left + t.width * (1 - f) + f * t.width * Math.max(0, y - t.top) / t.height;
      const rects = [];
      for (const el of tab.querySelectorAll('.bname, .byears')) rects.push(...el.getClientRects());
      const walk = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) { const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...rg.getClientRects()); }
      const over = rects.filter(r => r.width && r.right > edge(r.top) + 0.5);
      if (over.length) cutText.push('"' + tab.textContent.trim().slice(0, 24) + '" crosses the cut by ' + Math.round(Math.max(...over.map(r => r.right - edge(r.top)))) + ' px');
    }
    const row = document.querySelector('#fsec-reading .depthrow');
    let depth = null;
    if (row && live(row)) {
      depth = [];
      const tops = [...row.children].map(c => Math.round(c.getBoundingClientRect().top));
      if (new Set(tops).size > 1) depth.push('the chips wrap onto ' + new Set(tops).size + ' lines');
      if (row.scrollWidth > row.clientWidth + 0.5) depth.push('the row hides ' + (row.scrollWidth - row.clientWidth) + ' px of chips');
    }
    const rings = [];
    for (const el of controls.filter(c => c.closest('.arc.card'))) {
      el.focus({ preventScroll: true });
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (!el.matches(':focus-visible') || cs.outlineStyle === 'none') { rings.push(name(el) + ' shows no focus ring'); continue; }
      const g = Math.max(parseFloat(cs.outlineWidth) || 0, cs.outlineStyle === 'auto' ? 2 : 0) + (parseFloat(cs.outlineOffset) || 0);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if ((ac.overflowX === 'visible' && ac.overflowY === 'visible') || a.matches(sel)) continue;
        const ar = a.getBoundingClientRect(), left = ar.left + a.clientLeft, top = ar.top + a.clientTop;
        const over = Math.max(left - (r.left - g), top - (r.top - g), r.right + g - (left + a.clientWidth), r.bottom + g - (top + a.clientHeight));
        if (over > 0.5) { rings.push(name(el) + '\'s focus ring is cut by ' + a.tagName.toLowerCase() + '.' + [...a.classList].join('.') + ' (' + over.toFixed(1) + ' px)'); break; }
      }
    }
    if (document.activeElement) document.activeElement.blur();
    return { clipped, split, depth, cutText, rings };
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
        const over = [], cut = [], clipped = [], split = [], depth = [], cutText = [], rings = [];
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
          if (tab === 'list') await pg.page.keyboard.press('Shift');      // keyboard modality: a focused control shows its ring
          const f = await fit(pg.page);
          clipped.push(...f.clipped.map(x => tab + ': ' + x));
          if (tab === 'settings') split.push(...f.split);
          if (tab === 'list' && f.depth) { hasDepth = true; depth.push(...f.depth); }
          if (tab === 'list') { cutText.push(...f.cutText); rings.push(...f.rings); }
        }
        t.eq(name + ' @ ' + w + ' px: no horizontal overflow on any tab, everything open', over, []);
        t.eq(name + ' @ ' + w + ' px: all four tabs fully visible in the bar', cut, []);
        t.eq(name + ' @ ' + w + ' px: no control is cut off by a box that clips it', clipped, []);
        t.eq(name + ' @ ' + w + ' px: every Settings row keeps its controls together, beside the label or under it', split, []);
        if (hasDepth) t.eq(name + ' @ ' + w + ' px: the depth chips sit on one line and none is cut off (T-95)', depth, []);
        t.eq(name + ' @ ' + w + ' px: no era text crosses its tab\'s cut or leaves the tab (Pull\'s folder tab)', cutText, []);
        t.eq(name + ' @ ' + w + ' px: no focus ring inside a card is cut by a box that clips it (x frame)', rings, []);
        t.eq(name + ' @ ' + w + ' px: no page or console errors (L-9)', pg.errors, []);
        await pg.close();
      }
      await srv.close();
    }
    // the folder tab with era names long enough to wrap, at 320 px and on a wide screen (where its cut is widest):
    // every skin, default and the largest text. The real build of the basic fixture with its eras renamed.
    const long = copyFixture('basic', 'long-eras'), lds = readJSON(path.join(long, 'dataset.json'));
    lds.eras.forEach(e => { e.name = e.name + ' and the Long Years of Its Many Crossovers'; e.years = e.years + ', and after'; });
    writeJSON(path.join(long, 'dataset.json'), lds);
    const lb = build(path.join(long, 'dataset.json'), { label: 'long-eras-out' });
    const wide = [], srv = await serve(lb.out);
    let tabs = 0;
    for (const skin of ['signature', 'paper', 'newsprint', 'pull', 'night']) {
      for (const w of [320, 1024]) {
        for (const look of [{}, { textSize: 'l', tap: 'large', dys: true }]) {
          const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: { [FK + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' }, skin }, look)) } });
          await openAll(pg.page);
          const f = await fit(pg.page);
          tabs += await pg.page.evaluate(() => document.querySelectorAll('.era-head .bhead').length);
          wide.push(...f.cutText.map(x => skin + ' @' + w + (look.textSize ? ' largest' : '') + ': ' + x));
          await pg.close();
        }
      }
    }
    await srv.close();
    t.eq('era names long enough to wrap, at 320 and 1024 px, in every skin with default and the largest text: no era text crosses its tab\'s cut (' + tabs + ' tabs)',
         lb.status === 0 ? wide : ['the build failed: ' + lb.stderr.slice(-200)], []);

    // the pinned header (the x frame; John, 24 Oct): it pins under the tabs, as the reference tracker's, whenever it
    // takes at most 35 % of the screen, and never more; with the largest text on a 320 × 568 phone the tabs pin alone
    const pins = [], psrv = await serve(basic().out);
    let worst = 0;
    for (const skin of ['signature', 'paper', 'newsprint', 'pull', 'night']) {
      for (const [w, h, look] of [[320, 568, {}], [390, 844, {}], [320, 568, { textSize: 'l', tap: 'large', density: 'roomy', dys: true }], [390, 844, { textSize: 'l' }]]) {
        const pg = await open(psrv.url, { width: w, height: h, reducedMotion: 'reduce', storage: { [FK + ':v3:settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' }, skin }, look)) } });
        await openAll(pg.page);
        await pg.page.evaluate(() => window.scrollTo(0, 900));
        await pg.page.waitForTimeout(50);
        const m = await pg.page.evaluate(() => {
          const ph = document.querySelector('#phead'), r = ph.getBoundingClientRect(), st = document.querySelector('#stack').getBoundingClientRect();
          const pinned = getComputedStyle(ph).position === 'sticky' && Math.abs(r.top) < 1;
          return { frame: document.documentElement.getAttribute('data-frame'), y: scrollY, pinned, fits: ph.offsetHeight <= innerHeight * 0.35,
                   share: Math.max(st.bottom, pinned ? r.bottom : 0) / innerHeight };
        });
        const at = skin + ' @' + w + '×' + h + (look.textSize ? ' largest' : '');
        worst = Math.max(worst, m.share);
        if (m.frame !== 'x' || m.y < 800) pins.push(at + ': not on the x frame, scrolled (' + m.frame + ', ' + m.y + ')');
        else if (m.share > 0.35) pins.push(at + ': ' + Math.round(m.share * 100) + ' % of the screen stays pinned');
        else if (m.fits !== m.pinned) pins.push(at + ': the header ' + (m.pinned ? 'pins at more than 35 %' : 'fits in 35 % but doesn\'t pin'));
        await pg.close();
      }
    }
    await psrv.close();
    t.eq('the x frame\'s header pins under the tabs whenever it takes at most 35 % of the screen, never more: every skin at 320 × 568 and 390 × 844, default and the largest text (worst ' +
         Math.round(worst * 100) + ' %)', pins, []);
  } finally { await closeBrowser(); }
};
