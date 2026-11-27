/* Story placements (T6; John, 18 and 20 Nov; Research-Repo
   sessions/2026-11-14-green-lantern/t6-design.md). A row's `place` puts it just
   after, or just before, another issue in the reading order, by a cited note.
   - The build draws it there and keeps its own date (20-build); Publication
     order leaves it at its cover month.
   - In the reading order a line says where it was placed: "Placed after …"
     (or "before"), and "source" opens the note like any note. No line in
     Publication or arc order, and none in Table view, which draws one line a row.
   - The Reading card shows the line and its source.
   - Settings → About explains the line. Without placements in the data, none
     of this renders (9f-visibility). */
'use strict';
const path = require('path');
const { FIX, build, boot, wait, loadData, copyFixture, readJSON, writeJSON, openCards, openSettings } = require('../lib/helpers');

module.exports = async function (t) {
  // ------------------------------------------------ the data: basic, with Kestrel (1986) #6 moved a year back
  const dir = copyFixture('basic', 'placed');
  const storm = path.join(dir, 'data', 'eras', '5020-storm.json'), era = readJSON(storm);
  const SRC = 'fixture ledger (invented): "This story takes place just before Fixture Hero #25"';
  const QS = era.rows.find(r => r.issueId === 'fixture-hero-quiet-storm-1986').place;
  era.rows.find(r => r.issueId === 'kestrel-1986-6').place = { before: 'fixture-hero-1980-25', source: SRC };
  writeJSON(storm, era);
  const b = build(path.join(dir, 'dataset.json'), { label: 'placed-out' });
  t.ok('basic with Kestrel (1986) #6 placed before Fixture Hero (1980) #25 builds', b.status === 0, b.stderr);
  const D = loadData(b.out), at = id => D.ids.indexOf(id), ns = D.franchise.key + ':v3:';
  t.eq('the build draws it just before its target in the reading order', D.ids.slice(at('fixture-hero-1980-25') - 2, at('fixture-hero-1980-25') + 1),
       ['fixture-hero-1980-24', 'kestrel-1986-6', 'fixture-hero-1980-25']);
  t.ok('…and it keeps its own date: its publication key is still May 1987', Math.floor(D.issues[at('kestrel-1986-6')][8] / 1000) === 198705);
  t.ok('basic\'s own placement (Fixture Hero: Quiet Storm after #29) is one the order already agrees with',
       QS && QS.after === 'fixture-hero-1980-29' && at('fixture-hero-quiet-storm-1986') === at('fixture-hero-1980-29') + 1);

  // ------------------------------------------------ the app, in the reading order (the x frame)
  let app = boot(b.out, { storage: {} });
  await wait(20);
  const d = app.document, $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  const openAll = () => { $('[data-act="expand-all"]').click(); openCards($('#app')); };
  const rowIds = () => $$('#app .row').map(r => r.dataset.id);
  const line = id => $(`#app .row[data-id="${id}"] .placed`);
  const order = v => {
    if ($('[data-act="panel"]').getAttribute('aria-expanded') !== 'true') $('[data-act="panel"]').click();
    const h = $('#fsecs .sec-head[data-k="order"]');
    if (h.getAttribute('aria-expanded') !== 'true') h.click();
    $(`#fsecs .chip[data-k="order"][data-v="${v}"]`).click();
    openAll();
  };
  t.ok('the data offers the placement capability', app.window.PullList.has.place === true);
  openAll();
  const ids = rowIds();
  t.eq('reading order: the placed row is drawn just before its target', ids.slice(ids.indexOf('kestrel-1986-6'), ids.indexOf('kestrel-1986-6') + 2),
       ['kestrel-1986-6', 'fixture-hero-1980-25']);
  t.eq('…a line says so, naming the target', line('kestrel-1986-6') && line('kestrel-1986-6').firstChild.textContent.trim(), 'Placed before Fixture Hero (1980) #25');
  t.eq('…as does basic\'s own placement: "Placed after Fixture Hero (1980) #29"',
       line('fixture-hero-quiet-storm-1986') && line('fixture-hero-quiet-storm-1986').firstChild.textContent.trim(), 'Placed after Fixture Hero (1980) #29');
  t.eq('only placed rows carry the line (2)', $$('#app .placed').map(p => p.closest('.row').dataset.id).sort(), ['fixture-hero-quiet-storm-1986', 'kestrel-1986-6']);
  const src = line('kestrel-1986-6') && line('kestrel-1986-6').querySelector('button[data-act="note"]');
  t.ok('…with a "source" button, named for what it opens', !!src && src.textContent === 'source' &&
       src.getAttribute('aria-label') === 'Source: Placed before Fixture Hero (1980) #25' && src.getAttribute('aria-expanded') === 'false');
  if (src) src.click();
  const pop = () => { const r = $('#app .row[data-id="kestrel-1986-6"]'); return r && r.nextElementSibling && r.nextElementSibling.classList.contains('notepop') ? r.nextElementSibling : null; };
  t.eq('tapping it opens the source like a note', pop() && pop().textContent, SRC);
  t.ok('…and says it is open', !!src && src.getAttribute('aria-expanded') === 'true');
  if (src) src.click();
  t.ok('tapping again closes it', !pop() && src.getAttribute('aria-expanded') === 'false');

  // ------------------------------------------------ Publication order: at its cover month, no line
  order('publication');
  const pub = rowIds(), stormRows = D.ids.filter((id, i) => D.issueEra[i] === D.issueEra[at('kestrel-1986-6')] && !D.issueCompleteOnly[i] &&
    !(D.issues[i][6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)));
  const byAlt = stormRows.slice().sort((x, y) => D.issues[at(x)][8] - D.issues[at(y)][8]);
  t.eq('Publication order: the placed row is back at its cover month (after Fixture Quest, March 1987)', pub.filter(id => stormRows.includes(id)), byAlt);
  t.ok('…so it no longer sits before its target', pub.indexOf('kestrel-1986-6') > pub.indexOf('fixture-quest-1987') && pub.indexOf('kestrel-1986-6') !== pub.indexOf('fixture-hero-1980-25') - 1);
  t.eq('…and no placement line is drawn', $$('#app .placed').length, 0);
  order('arc');
  t.eq('arc order draws no placement line either', $$('#app .placed').length, 0);
  order('reading');
  t.eq('back in the reading order, the lines return', $$('#app .placed').length, 2);

  // ------------------------------------------------ Table view: one line a row, so the line is left out (never hidden)
  openSettings(app);
  $('[data-act="pref"][data-k="table"]').click();
  $('#tab-list').click();
  openAll();
  t.eq('Table view leaves the line out (it holds a control, so it is not drawn, rather than hidden)', $$('#app .placed').length, 0);
  openSettings(app);
  $('[data-act="pref"][data-k="table"]').click();
  $('#tab-list').click();
  openAll();
  t.eq('…and draws it again when Table view is off', $$('#app .placed').length, 2);

  // ------------------------------------------------ Settings → About explains it
  openSettings(app);
  const help = $('#settings .placed-help');
  t.ok('Settings → About explains the line, naming the publication order by its label', !!help && /Placed after/.test(help.textContent) &&
       help.textContent.includes(D.franchise.dualOrder.b), help && help.textContent);
  t.eq('no page errors', app.errors, []);
  app.window.close();

  // ------------------------------------------------ the Reading card
  const before = D.ids.slice(0, at('kestrel-1986-6'));
  app = boot(b.out, { storage: { [ns + 'settings']: JSON.stringify({ v: 3, tab: 'reading' }),
    [ns + 'progress']: JSON.stringify({ marks: Object.fromEntries(before.map(id => [id, 'read'])), bookmarks: [] }) } });
  await wait(20);
  const card = app.document.querySelector('#reader .rcard');
  t.eq('the Reading card opens on the first unread issue, the placed one', card && card.dataset.id, 'kestrel-1986-6');
  const rp = app.document.querySelector('#reader .rplaced');
  t.ok('…and shows the line with its source in full', !!rp && rp.firstChild.textContent === 'Placed before Fixture Hero (1980) #25' &&
       rp.querySelector('.rplaced-src').textContent === SRC);
  t.eq('no page errors on the Reading card', app.errors, []);
  app.window.close();

  // ------------------------------------------------ the v9 frame draws the line too
  {
    const v9 = build(path.join(FIX, 'sig-v9', 'dataset.json'), { label: 'placed-v9' }), a9 = boot(v9.out, { storage: {} });
    await wait(20);
    const d9 = a9.document;
    d9.querySelector('[data-act="expand-all"]').click();
    const l9 = d9.querySelector('#app .row[data-id="fixture-hero-quiet-storm-1986"] .placed');
    t.ok('the v9 frame (sig-v9 shares basic\'s rows) draws the line in its row, with the source button',
         d9.documentElement.getAttribute('data-frame') === 'v9' && !!l9 && /^Placed after Fixture Hero \(1980\) #29/.test(l9.textContent) && !!l9.querySelector('[data-act="note"]'));
    a9.window.close();
  }

  // ------------------------------------------------ nothing renders without the data
  {
    const plain = copyFixture('basic', 'unplaced'), f = path.join(plain, 'data', 'eras', '5020-storm.json'), e = readJSON(f);
    delete e.rows.find(r => r.issueId === 'fixture-hero-quiet-storm-1986').place;
    writeJSON(f, e);
    const p = build(path.join(plain, 'dataset.json'), { label: 'unplaced-out' }), P = loadData(p.out);
    const a = boot(p.out, { storage: {} });
    await wait(20);
    a.document.querySelector('[data-act="expand-all"]').click();
    openCards(a.document.querySelector('#app'));
    openSettings(a);
    t.ok('without a placement: no D.placed, no capability, no line and no help copy',
         P.placed === undefined && a.window.PullList.has.place === false && !a.document.querySelector('.placed, .placed-help, .rplaced'));
    a.window.close();
  }
};
