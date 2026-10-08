/* Sections animate open and shut (FP-11), and reduced motion stops every
   transition. Measured through the browser's own animation list, so the
   result doesn't depend on how fast the machine is. */
'use strict';
const { mixed, basic } = require('../lib/helpers');
const { serve, open, closeBrowser } = require('./lib');

/* Elements with any non-zero transition or animation duration. */
const moving = () => [...document.querySelectorAll('*')].filter(el => {
  const cs = getComputedStyle(el), on = v => v.split(',').some(d => parseFloat(d) > 0);
  return on(cs.transitionDuration) || on(cs.animationDuration);
}).map(el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));

module.exports = async function (t) {
  try {
    const srv = await serve(mixed().out);
    const toggle = async (page, head, bodySel) => page.evaluate(async ([h, b]) => {
      const body = document.querySelector(b);
      document.querySelector(h).click();
      const anims = body.getAnimations().map(a => a.transitionProperty || a.animationName);
      const start = body.getBoundingClientRect().height;
      await Promise.all(document.getAnimations().map(a => a.finished));
      return { anims, start, end: body.getBoundingClientRect().height, content: body.firstElementChild.scrollHeight };
    }, [head, bodySel]);

    // ------------------------------------------------ normal motion: it animates
    let pg = await open(srv.url, { width: 390 });
    await pg.page.click('#tab-settings');
    let r = await toggle(pg.page, '.sec-head[data-g="s"][data-k="display"]', '#set-display');
    t.ok('a Settings section animates open: its body runs a grid-template-rows transition', r.anims.includes('grid-template-rows'), JSON.stringify(r.anims));
    t.ok('…starting from shut and ending at its full height', r.start < r.end / 2 && r.end > 0 && Math.abs(r.end - r.content) <= 1, JSON.stringify(r));
    r = await toggle(pg.page, '.sec-head[data-g="s"][data-k="display"]', '#set-display');
    t.ok('…and animates shut again, to zero height', r.anims.includes('grid-template-rows') && r.end === 0, JSON.stringify(r));
    await pg.page.click('#tab-list');
    await pg.page.click('[data-act="panel"]');
    r = await toggle(pg.page, '#fsecs .sec-head[data-k="reading"]', '#fsec-reading');
    t.ok('a filter-panel section animates the same way (one component)', r.anims.includes('grid-template-rows') && Math.abs(r.end - r.content) <= 1, JSON.stringify(r));
    const normal = await pg.page.evaluate(moving);
    t.ok('the scan sees transitions when motion is allowed (' + normal.length + ' elements)', normal.length > 0);
    t.eq('no page errors (motion)', pg.errors, []);
    await pg.close();

    // ------------------------------------------------ reduced motion: nothing moves
    pg = await open(srv.url, { width: 390, reducedMotion: 'reduce' });
    await pg.page.click('#tab-settings');
    r = await toggle(pg.page, '.sec-head[data-g="s"][data-k="display"]', '#set-display');
    t.ok('reduced motion: a section opens at once, with no transition', r.anims.length === 0 && Math.abs(r.start - r.content) <= 1, JSON.stringify(r));
    await pg.page.evaluate(() => { document.querySelector('#tab-list').click(); document.querySelector('[data-act="panel"]').click(); document.querySelector('.ptools [data-act="expand-all"]').click(); });
    t.eq('reduced motion: no element anywhere has a transition or animation duration', await pg.page.evaluate(moving), []);
    t.eq('no page errors (reduced motion)', pg.errors, []);
    await pg.close();
    await srv.close();

    // ------------------------------------------------ the signature skin can't bring motion back
    const ssrv = await serve(basic().out);
    pg = await open(ssrv.url, { width: 390, reducedMotion: 'reduce' });
    await pg.page.evaluate(() => { document.querySelector('[data-act="panel"]').click(); document.querySelector('.ptools [data-act="expand-all"]').click(); });
    t.eq('the signature skin, reduced motion: the page is in it, and nothing anywhere moves',
         [await pg.page.evaluate(() => document.documentElement.getAttribute('data-skin')), await pg.page.evaluate(moving)], ['signature', []]);
    await pg.close();
    pg = await open(ssrv.url, { width: 390 });
    await pg.page.click('#tab-settings');
    r = await toggle(pg.page, '.sec-head[data-g="s"][data-k="display"]', '#set-display');
    t.ok('…and with motion allowed, its sections still animate (one component)', r.anims.includes('grid-template-rows') && Math.abs(r.end - r.content) <= 1, JSON.stringify(r));
    t.eq('no page errors (signature skin motion)', pg.errors, []);
    await pg.close();
    await ssrv.close();
  } finally { await closeBrowser(); }
};
