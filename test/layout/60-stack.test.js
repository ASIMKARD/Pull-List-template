/* The sticky stack, measured (session 4, step 6; F-58, L-1…L-6). The tabs,
   the banner and the mini bar stay pinned together, in every skin; its height
   is measured into --stack-h, so jumps land below it; bands keep their spacing;
   and a swiped row slides under the card edge, not past it. */
'use strict';
const { basic } = require('../lib/helpers');
const { serve, open, openAll, openSettings, closeBrowser } = require('./lib');

const SKINS = ['signature', 'paper', 'newsprint', 'pull', 'night'];     // the basic fixture's demo signature skin first
const seed = (s) => ({ 'fixture:v3:settings': JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s)) });
const geo = () => {
  const g = s => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, pos: getComputedStyle(e).position }; };
  return { stack: g('#stack'), tabs: g('#tabs'), banner: g('#pbanner'), mini: g('#mini'), y: scrollY,
           h: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-h')), sh: document.querySelector('#stack').offsetHeight };
};

module.exports = async function (t) {
  try {
    const srv = await serve(basic().out);
    const pinned = [], under = [], measured = [];
    for (const skin of SKINS) {
      for (const [tab, w] of [['list', 390], ['list', 320], ['settings', 390]]) {
        const pg = await open(srv.url, { width: w, reducedMotion: 'reduce', storage: seed({ skin, banner: true }) });
        if (tab === 'list') await openAll(pg.page); else await openSettings(pg.page);
        await pg.page.evaluate(() => window.scrollTo(0, 700));
        await pg.page.waitForTimeout(50);
        const m = await pg.page.evaluate(geo);
        const at = skin + ' ' + tab + ' @' + w;
        if (m.stack.pos !== 'sticky') pinned.push(at + ': the stack is ' + m.stack.pos);
        if (await pg.page.evaluate(() => document.documentElement.getAttribute('data-skin')) !== skin) pinned.push(at + ': the page is not in that skin');
        if (m.y < 600 || Math.abs(m.tabs.top) >= 1) pinned.push(at + ': tabs at ' + m.tabs.top + ' after scrolling to ' + m.y);
        if (Math.abs(m.banner.top - m.tabs.bottom) >= 2) under.push(at + ': banner ' + (m.banner.top - m.tabs.bottom).toFixed(1) + ' px from the tabs');
        if (Math.abs(m.h - m.sh) > 0.5) measured.push(at + ': --stack-h ' + m.h + ' vs ' + m.sh);
        t.eq(at + ': no page errors', pg.errors, []);
        await pg.close();
      }
    }
    t.eq('the stack holding the tabs is sticky and pins them to the top after scrolling, every skin, Checklist and Settings (L-1, L-2)', pinned, []);
    t.eq('the banner is pinned directly under the tabs (L-3, L-4)', under, []);
    t.eq('--stack-h is the stack\'s measured height (F-58)', measured, []);

    // ------------------------------------------------ measured at runtime: it follows the banner
    let pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed({}) });
    const before = await pg.page.evaluate(geo);
    await openSettings(pg.page);
    await pg.page.click('[data-act="pref"][data-k="banner"]');
    await pg.page.waitForTimeout(100);
    const after = await pg.page.evaluate(geo);
    t.ok('turning the banner on grows the stack, and --stack-h follows without a reload', after.sh > before.sh + 10 && Math.abs(after.h - after.sh) <= 0.5,
         JSON.stringify({ before: [before.h, before.sh], after: [after.h, after.sh] }));
    // ------------------------------------------------ jumps land below the stack
    const landing = await pg.page.evaluate(async () => {
      const out = [], stackBottom = () => document.querySelector('#stack').getBoundingClientRect().bottom;
      document.querySelector('#tab-list').click();
      document.querySelector('.ptools [data-act="collapse-all"]').click();
      for (const e of [...document.querySelectorAll('.era')].slice(1).map(x => +x.dataset.e)) {
        window.scrollTo(0, 0);
        const id = window.TRACKER_DATA.ids[window.TRACKER_DATA.issueEra.indexOf(e)];
        window.PullList.jumpToIssue(id);
        await new Promise(r => setTimeout(r, 30));
        const row = document.querySelector('.row[data-id="' + CSS.escape(id) + '"]');
        if (row) out.push(Math.round(row.getBoundingClientRect().top - stackBottom()));
      }
      return out;
    });
    t.ok('jumping to a row lands it below the stack, never under it (' + landing.length + ' jumps)', landing.length >= 3 && landing.every(g => g >= 0), JSON.stringify(landing));
    await pg.close();
    pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed({ banner: true, eraNav: 'chips' }) });
    const eraLanding = await pg.page.evaluate(async () => {
      const out = [];
      for (const chip of [...document.querySelectorAll('#eranav .chip')].slice(1)) {
        window.scrollTo(0, 0);
        chip.click();
        await new Promise(r => setTimeout(r, 30));
        const head = document.querySelector('.era[data-e="' + chip.dataset.e + '"] > .era-head');
        const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 1;   // the last eras can't scroll to the top
        out.push([Math.round(head.getBoundingClientRect().top - document.querySelector('#stack').getBoundingClientRect().bottom), atEnd]);
      }
      return out;
    });
    t.ok('an era chip scrolls its era to just below the stack, never under it (' + eraLanding.length + ' eras; the page\'s end aside)',
         eraLanding.length >= 3 && eraLanding.every(([g, end]) => g >= 0 && (g <= 16 || end)),
         JSON.stringify(eraLanding));
    await pg.close();

    // ------------------------------------------------ bands: not shifted onto their intro, no big gaps (L-5, L-6)
    const bandFails = [];
    for (const density of ['compact', 'normal', 'roomy']) {
      pg = await open(srv.url, { width: 390, reducedMotion: 'reduce', storage: seed({ density }) });
      const m = await pg.page.evaluate(() => {
        document.querySelector('.ptools [data-act="collapse-all"]').click();
        document.querySelectorAll('.band-head').forEach(h => h.click());
        window.scrollTo(0, 200);
        const bands = [...document.querySelectorAll('.band')];
        return { gaps: bands.slice(0, -1).map((b, i) => Math.round(bands[i + 1].getBoundingClientRect().top - b.getBoundingClientRect().bottom)),
                 intro: bands.map(b => { const i = b.querySelector('.band-intro'), h = b.querySelector('.band-head'); return i ? Math.round(i.getBoundingClientRect().top - h.getBoundingClientRect().bottom) : 0; }) };
      });
      if (m.gaps.some(g => g > 16)) bandFails.push(density + ': gaps ' + m.gaps.join(', '));
      if (m.intro.some(g => g < -1)) bandFails.push(density + ': an intro under its band head ' + m.intro.join(', '));
      await pg.close();
    }
    t.eq('bands sit at most 16 px apart and never on their own intros, in every density (L-5, L-6)', bandFails, []);

    // ------------------------------------------------ a swiped row slides under the card edge
    pg = await open(srv.url, { width: 360, reducedMotion: 'reduce', storage: seed({ swipe: true }) });
    await openAll(pg.page);
    const clip = await pg.page.evaluate(() => {
      const row = document.querySelector('.row:not(.inert)'), arc = row.closest('.arc');
      row.scrollIntoView({ block: 'center' });
      row.dataset.swipe = 'read-go';
      const a = arc.getBoundingClientRect(), r = row.getBoundingClientRect();
      const hit = document.elementFromPoint(a.right + 4, r.top + r.height / 2);
      return { moved: r.right - a.right, hitRow: !!hit && row.contains(hit) };
    });
    t.ok('a row mid-swipe moves past its card\'s edge (28 px), but what pokes out is clipped', clip.moved > 20 && !clip.hitRow, JSON.stringify(clip));
    await pg.close();
    await srv.close();
  } finally { await closeBrowser(); }
};
