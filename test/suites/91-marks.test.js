/* Four-state marks through one path: row, banners and header all move, and
   the mark persists keyed on the stable id. */
'use strict';
const path = require('path');
const { loadData, boot, wait, basic, openCards, build, FIX } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic();
  const D = loadData(b.out);
  const ns = D.franchise.key + ':v3:';
  const app = boot(b.out);
  const d = app.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  await wait(20);
  const storm = D.eras.findIndex(e => e.id === 'storm');
  const band = d.querySelector(`.era[data-e="${storm}"]`).closest('.band').dataset.b;
  $(`.band[data-b="${band}"] > .band-head`).click();
  $(`.era[data-e="${storm}"] > .era-head`).click();
  openCards($(`.era[data-e="${storm}"]`));

  const row = () => $('.row[data-id="fixture-hero-1980-21"]');
  const mk = () => row().querySelector('.mark');
  const eraCount = () => $(`.era[data-e="${storm}"] > .era-head .bcount`).textContent;
  const bandCount = () => $(`.band[data-b="${band}"] > .band-head .bcount`).textContent;
  const headCount = () => $('#pprog .pcount').textContent;
  const e0 = eraCount(), b0 = bandCount(), h0 = headCount();

  mk().click();
  t.ok('delegated mark click cycles state: unread -> reading (T-5)', row().dataset.s === 'reading');
  t.ok('reading does not count as read', eraCount() === e0 && headCount() === h0);
  mk().click();
  t.ok('second click: reading -> read', row().dataset.s === 'read');
  t.ok('era banner count moves on a mark ("1/N read" on the x frame, as the reference tracker)', eraCount() !== e0 && /^1\//.test(eraCount()), eraCount());
  t.ok('band banner count moves on a mark', bandCount() !== b0);
  t.ok('header count moves on a mark', headCount() !== h0 && /^1 \//.test(headCount()));
  t.ok('mark label follows the state', /Read$/.test(mk().getAttribute('aria-label')));
  mk().click();
  t.ok('third click: read -> skip', row().dataset.s === 'skip');
  t.ok('a skip leaves the goal (n / N shrinks, "skipped" shown)', /1 skipped/.test(eraCount()));
  mk().click();
  t.ok('fourth click cycles back to unread (T-6)', row().dataset.s === 'unread' && eraCount() === e0 && headCount() === h0);

  // game medium labels
  const game = () => $('.row[data-id="fixture-quest-1987"] .mark');
  game().click(); game().click();
  t.ok('game rows read "Beaten" when done (F-6)', /Beaten$/.test(game().getAttribute('aria-label')));

  // persistence keyed on the stable id, including a migrated legacy id
  const k7 = () => $('.row[data-id="198706004"] .mark');
  k7().click(); k7().click();
  t.ok('migrated row marks under its legacy id', $('.row[data-id="198706004"]').dataset.s === 'read');
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const stored = JSON.parse(app.window.localStorage.getItem(ns + 'progress'));
  t.ok('progress is stored keyed on id', stored.marks['198706004'] === 'read' && stored.marks['fixture-quest-1987'] === 'read');
  t.ok('unread is stored as absence (no "unread" entries)', !Object.values(stored.marks).includes('unread'));

  // bookmark + note popover
  const bm = () => $('.row[data-id="fixture-hero-1980-22"] .b.bm');
  bm().click();
  t.ok('delegated bookmark toggles (T-7)', bm().getAttribute('aria-pressed') === 'true');
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  t.ok('bookmark stored by id', JSON.parse(app.window.localStorage.getItem(ns + 'progress')).bookmarks.includes('fixture-hero-1980-22'));
  bm().click();
  t.ok('bookmark toggles off', bm().getAttribute('aria-pressed') === 'false');

  const rising = D.eras.findIndex(e => e.id === 'rising');
  $('.band[data-b="0"] > .band-head').click();
  $(`.era[data-e="${rising}"] > .era-head`).click();
  openCards($(`.era[data-e="${rising}"]`));
  t.ok('the x frame shows a flashback\'s note under its title, with no note badge (T-8)', !$('.row[data-id="vela-year-zero-1984-1"] .b.note') &&
       /set before the first issue/.test($('.row[data-id="vela-year-zero-1984-1"] .subnote').textContent));
  {   // the v9 frame keeps its badges: the core badge, and the note badge's popover
    const v9 = build(path.join(FIX, 'sig-v9', 'dataset.json'), { label: 'marks-v9' }), a9 = boot(v9.out, { storage: {} });
    await wait(20);
    const d9 = a9.document, q9 = s => d9.querySelector(s);
    q9('[data-act="expand-all"]').click();
    const note = () => q9('.row[data-id="vela-year-zero-1984-1"] .b.note');
    t.ok('the v9 frame keeps the core badge and the note badge (John, 25 Oct)', d9.documentElement.getAttribute('data-frame') === 'v9' &&
         !!q9('.row .b.core') && !q9('.row .core-star') && !!note());
    note().click();
    t.ok('…its note badge opens a popover (T-8)', !!q9('.notepop') && /set before the first issue/.test(q9('.notepop').textContent));
    note().click();
    t.ok('…and closes it again (T-9)', !q9('.notepop'));
    a9.window.close();
  }

  // reboot with the stored state
  const saved = {};
  for (const k of Object.keys(app.window.localStorage)) saved[k] = app.window.localStorage.getItem(k);
  app.window.close();
  const app2 = boot(b.out, { storage: saved });
  await wait(20);
  const d2 = app2.document;
  t.ok('stored marks count in the header after reboot', /^2 \//.test(d2.querySelector('#pprog .pcount').textContent));
  d2.querySelector(`.band[data-b="${band}"] > .band-head`).click();
  d2.querySelector(`.era[data-e="${storm}"] > .era-head`).click();
  openCards(d2.querySelector(`.era[data-e="${storm}"]`));
  t.ok('stored marks restore on rows after reboot', d2.querySelector('.row[data-id="198706004"]').dataset.s === 'read');
  t.ok('no runtime errors', app2.errors.length === 0 && app.errors.length === 0, app.errors.concat(app2.errors).join(' | '));
  app2.window.close();
};
