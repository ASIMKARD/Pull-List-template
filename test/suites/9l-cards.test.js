/* The x frame's arc cards (John, 24 Oct; session 8, step 4a). An open era shows
   its arcs as collapsed cards, the reference tracker's: one per run of an arc's
   rows in the era's order ("· cont." when an arc comes back), each drawing its
   rows on its first open. The name, the stripe, the count and the chevron toggle
   it; ⓘ shows the blurb and the credits; Expand all, Collapse all, a jump, a
   search and an era chip reach the cards; the count follows the marks. "Label on
   each row" keeps its rows, and the v9 frame keeps its arc headings. */
'use strict';
const path = require('path');
const { boot, wait, pullRef, build, loadData, FIX, typeInto } = require('../lib/helpers');

module.exports = async function (t) {
  const b = pullRef(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const seed = s => ({ [ns + 'settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s || {})) });
  let app = boot(b.out, { storage: seed() });
  await wait(20);
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  t.eq('the fixture opens on the x frame', d.documentElement.getAttribute('data-frame'), 'x');

  // the cards an era should show: one per run of an arc's in-view rows, in reading order
  const runs = e => {
    const out = [], seen = {};
    D.issueEra.forEach((era, i) => {
      if (era !== e || D.issueCompleteOnly[i]) return;
      const a = D.issues[i][2], last = out[out.length - 1];
      if (last && last.a === a) { last.rows.push(i); return; }
      seen[a] = (seen[a] || 0) + 1;
      out.push({ a, n: seen[a] - 1, rows: [i] });
    });
    return out;
  };
  const era = e => $(`.era[data-e="${e}"]`), cards = e => [...era(e).querySelectorAll('.arc.card')];
  const shut = c => c.querySelector('.arc-body').hidden && c.querySelector('.arc-toggle').getAttribute('aria-expanded') === 'false' && !c.classList.contains('open');
  const isOpen = c => !c.querySelector('.arc-body').hidden && c.querySelector('.arc-toggle').getAttribute('aria-expanded') === 'true' && c.classList.contains('open');
  const rowIds = c => [...c.querySelectorAll('.row')].map(r => +r.dataset.i);

  // ------------------------------------------------ an era opens to its cards
  t.ok('at landing no era shows a card', $$('.arc.card').length === 0);
  era(0).querySelector('.era-head').click();
  const r0 = runs(0);
  t.eq('an open era shows one card per run of an arc\'s rows, in reading order, "· cont." when an arc comes back',
       cards(0).map(c => c.querySelector('.arc-name').textContent), r0.map(r => D.arcs[r.a].n + (r.n ? ' · cont.' : '')));
  t.ok('…every one shut, with no row drawn', cards(0).every(shut) && !era(0).querySelector('.row'));
  t.ok('…each with its stripe, its count and its chevron in the head', cards(0).every(c => ['.arc-tab', '.arc-frac', '.arc-chev'].every(s => c.querySelector('.arc-head ' + s))));

  // ------------------------------------------------ opening and shutting one
  const c0 = cards(0)[0];
  c0.querySelector('.arc-toggle').click();
  t.ok('its name opens it: the body shows, and only its own rows are drawn', isOpen(c0) && JSON.stringify(rowIds(c0)) === JSON.stringify(r0[0].rows) &&
       $$('.row').length === r0[0].rows.length);
  t.ok('…with Mark arc read and Mark arc unread at its top', !!c0.querySelector('.arc-body > .arc-acts [data-act="arc-mark"][data-st="read"]') &&
       !!c0.querySelector('.arc-body > .arc-acts [data-act="arc-mark"][data-st="unread"]'));
  const drawn = c0.querySelector('.row');
  c0.querySelector('.arc-toggle').click();
  t.ok('…and shuts it again', shut(c0));
  const parts = [];
  for (const part of ['.arc-tab', '.arc-frac', '.arc-chev']) {
    c0.querySelector('.arc-head ' + part).click();
    const opened = isOpen(c0);
    c0.querySelector('.arc-head ' + part).click();
    if (!opened || !shut(c0)) parts.push(part);
  }
  t.eq('the stripe, the count and the chevron open and shut it too', parts, []);
  c0.querySelector('.arc-toggle').click();
  t.ok('reopening keeps the rows it drew: no rebuild', c0.querySelector('.row') === drawn);
  c0.querySelector('.arc-toggle').click();

  // ------------------------------------------------ ⓘ
  const infoOf = c => { const r = r0[cards(0).indexOf(c)], arc = D.arcs[r.a], i = r.rows[0];
    return !r.n && ((arc.b && arc.b !== D.eras[0].intro) || D.issueWriters[i].length || D.issueArtists[i].length); };
  t.ok('ⓘ appears on exactly the cards with a blurb or credits', cards(0).every(c => !!c.querySelector('.info-btn') === !!infoOf(c)) &&
       cards(0).some(c => c.querySelector('.info-btn')));
  const ci = cards(0).find(c => c.querySelector('.info-btn')), ib = ci.querySelector('.info-btn'), panel = ci.querySelector('.arc-info');
  ib.click();
  t.ok('ⓘ shows the blurb without opening the card', !panel.hidden && ib.getAttribute('aria-expanded') === 'true' && shut(ci) &&
       panel.textContent.includes(D.arcs[+ci.dataset.a].b));
  ib.click();
  t.ok('…and hides it again', panel.hidden && ib.getAttribute('aria-expanded') === 'false');

  // ------------------------------------------------ the count follows the marks
  const ck = cards(0).find(c => runs(0)[cards(0).indexOf(c)].rows.length > 1);
  ck.querySelector('.arc-toggle').click();
  const frac0 = ck.querySelector('.arc-frac').textContent;
  ck.querySelector('.row:not(.inert) .mark').click(); ck.querySelector('.row:not(.inert) .mark').click();   // reading, then read
  const INERT = D.flagBits.GAPNOTE | D.flagBits.RENUM;                  // as app.js: a gap note or a renumbering note is no issue
  const n = runs(0)[cards(0).indexOf(ck)].rows.filter(i => !(D.issues[i][6] & INERT)).length;
  t.eq('a card counts its own rows, and a mark moves its count', [frac0, ck.querySelector('.arc-frac').textContent], ['0/' + n, '1/' + n]);
  ck.querySelector('.row:not(.inert) .mark').click(); ck.querySelector('.row:not(.inert) .mark').click();   // skip, then unread
  ck.querySelector('.arc-toggle').click();

  // ------------------------------------------------ Expand all, Collapse all
  $('[data-act="expand-all"]').click();
  const inView = D.issueEra.filter((e, i) => !D.issueCompleteOnly[i]).length;
  t.ok('Expand all opens every era and every card in it, every row drawn', $$('.arc.card').length === D.eras.reduce((s, e, i) => s + runs(i).length, 0) &&
       $$('.arc.card').every(isOpen) && $$('.row').length === inView);
  $('[data-act="collapse-all"]').click();
  t.ok('Collapse all shuts every card and every era', $$('.arc.card').every(shut) && $$('.era-head').every(h => h.getAttribute('aria-expanded') === 'false'));

  // ------------------------------------------------ a jump opens the row's own card
  const r1 = runs(1), target = r1[r1.length - 1].rows[0];
  app.window.PullList.jumpToIssue(D.ids[target]);
  const tc = d.querySelector(`.row[data-i="${target}"]`).closest('.arc');
  t.ok('a jump opens the card its row sits in, and only that one', isOpen(tc) && cards(1).filter(c => c !== tc).every(shut));
  $('[data-act="collapse-all"]').click();

  // ------------------------------------------------ a search opens the cards it matches
  const word = D.issues[r1[0].rows[0]][1];
  await typeInto(app, '#q', word);
  const shown = $$('.era:not([hidden]) .arc.card');
  t.ok('a search opens the cards it matches, showing the matching rows', shown.length > 0 && shown.every(isOpen) &&
       $$('.row').length > 0 && $$('.row').every(r => D.issues[+r.dataset.i][1].toLowerCase().includes(word.toLowerCase())));
  await typeInto(app, '#q', '');
  t.ok('…and clearing it lands collapsed again', $$('.arc.card').length === 0 && $$('.era-head').every(h => h.getAttribute('aria-expanded') === 'false'));
  app.window.close();

  // ------------------------------------------------ an era chip opens the era, its cards shut
  app = boot(b.out, { storage: seed({ eraNav: 'chips' }) });
  await wait(20);
  d = app.document;
  d.querySelector('#eranav .chip[data-act="era-jump"][data-e="1"]').click();
  t.ok('an era chip opens its era with every card shut', d.querySelector('.era[data-e="1"] > .era-head').getAttribute('aria-expanded') === 'true' &&
       [...d.querySelectorAll('.era[data-e="1"] .arc.card')].every(shut) && !d.querySelector('.era[data-e="1"] .row'));
  app.window.close();

  // ------------------------------------------------ "Label on each row" keeps its rows
  app = boot(b.out, { storage: seed({ layout: 'rows' }) });
  await wait(20);
  d = app.document;
  d.querySelector('.era[data-e="0"] > .era-head').click();
  t.ok('"Label on each row" draws no cards: an open era shows its rows, each labelled with its arc', !d.querySelector('.arc.card') &&
       d.querySelectorAll('.era[data-e="0"] .row').length === runs(0).reduce((s, r) => s + r.rows.length, 0) && !!d.querySelector('.row .arclabel'));
  app.window.close();

  // ------------------------------------------------ the v9 frame keeps its arc headings
  const v9 = build(path.join(FIX, 'sig-v9', 'dataset.json'), { label: 'cards-v9' });
  app = boot(v9.out, { storage: {} });
  await wait(20);
  d = app.document;
  d.querySelector('.era-head').click();
  t.ok('the v9 frame draws no cards: an open era shows its arc headings and rows at once (John, 25 Oct)',
       d.documentElement.getAttribute('data-frame') === 'v9' && !d.querySelector('.arc.card, .arc-toggle') &&
       d.querySelectorAll('.era .arc-head h3').length > 0 && d.querySelectorAll('.era .row').length > 0);
  app.window.close();
};
