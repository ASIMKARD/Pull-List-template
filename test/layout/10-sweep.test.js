/* The 320 px sweep (session 3's lesson, L-9): every tab, with everything open,
   at 320, 360 and 390 px, on four datasets, and the full fixture in every
   skin. No horizontal overflow, all four tabs fully visible in the bar, no
   page or console errors. Real fonts. */
'use strict';
const path = require('path');
const { ROOT, FIX, build, basic, mixed } = require('../lib/helpers');
const { serve, open, openAll, openSettings, closeBrowser } = require('./lib');

const WIDTHS = [320, 360, 390];
const TABS = ['list', 'reading', 'reviews', 'settings'];

module.exports = async function (t) {
  const minimal = build(path.join(FIX, 'minimal', 'dataset.json'), { label: 'layout-minimal' });
  const sets = [['basic', basic().out], ['mixed', mixed().out], ['minimal', minimal.out], ['starter', ROOT]]
    .concat(['newsprint', 'pull', 'night'].map(skin => ['basic in ' + skin, basic().out, skin]));
  try {
    for (const [name, dir, skin] of sets) {
      const srv = await serve(dir);
      for (const w of WIDTHS) {
        const storage = skin ? { 'fixture:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin }) } : undefined;
        const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage });
        const over = [], cut = [];
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
        }
        t.eq(name + ' @ ' + w + ' px: no horizontal overflow on any tab, everything open', over, []);
        t.eq(name + ' @ ' + w + ' px: all four tabs fully visible in the bar', cut, []);
        t.eq(name + ' @ ' + w + ' px: no page or console errors (L-9)', pg.errors, []);
        await pg.close();
      }
      await srv.close();
    }
  } finally { await closeBrowser(); }
};
