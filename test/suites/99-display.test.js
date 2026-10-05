/* Display options (session 3, step 3). Every one is display-only: it changes
   what the list shows or how, never a figure.
   - notes only (T-12/13; the feel-reference build's "landmarks only"), a filter chip;
   - newest era first (T-14/15), tap to reveal (T-16), combo badge (T-17),
     badges on/off, gap notes on/off, era navigation style, layout C;
   - the depth chips sit in one row that never wraps (T-95). */
'use strict';
const { loadData, boot, wait, basic, noPeriods, openSettings } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:', FL = D.flagBits;
  const marks = { 'fixture-hero-1980-1': 'read', 'fixture-hero-1980-2': 'skip', 'fixture-hero-1980-6': 'reading' };
  const storage = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }),
                    [ns + 'progress']: JSON.stringify({ marks, bookmarks: ['fixture-hero-1980-1'] }) };
  let app = boot(b.out, { now: NOW, css: true, storage });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const root = () => d.documentElement;
  const figures = () => JSON.stringify({
    h: [...d.querySelectorAll('#pprog .pcount, #pprog .pleft, #pprog .pfinish, #pprog .puntimed')].map(x => x.textContent + '|' + (x.dataset.weeks || '')),
    b: D.periods.map((p, bi) => [...d.querySelectorAll(`.band[data-b="${bi}"] > .band-head .bstats > span`)].map(x => x.textContent)),
    e: D.eras.map((e, ei) => [...d.querySelectorAll(`.era[data-e="${ei}"] > .era-head .bstats > span`)].map(x => x.textContent))
  });
  const base = figures();
  const settingsTab = () => openSettings(app);
  const listTab = () => $('#tab-list').click();
  const pref = k => $(`#settings [data-act="pref"][data-k="${k}"]`);
  const stored = () => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + 'settings')); };

  // ------------------------------------------------- the Display section
  settingsTab();
  t.ok('Settings has a Display section', !!$('.sset[data-k="display"] .seth') && $('.sset[data-k="display"] .sec-name').textContent === 'Display');
  t.eq('display toggles exist (T-10 re-expressed: the v2 view chips)', ['badges', 'combo', 'reveal', 'gapNotes', 'rev'].map(k => !!pref(k)), [true, true, true, true, true]);
  t.eq('defaults: badges on, combo off, reveal off, gap notes on, oldest era first', ['badges', 'combo', 'reveal', 'gapNotes', 'rev'].map(k => pref(k).getAttribute('aria-pressed')),
       ['true', 'false', 'false', 'true', 'false']);
  t.eq('arc headings control has 2 options', $$('#settings [data-act="layout"]').map(x => x.textContent), ['Headings', 'Label on each row']);
  t.eq('era navigation offers chips / dropdown / plain scroll (XM-8)', $$('#settings [data-act="eranav"]').map(x => x.dataset.v), ['scroll', 'chips', 'dropdown']);

  // ---------------------------------------------- T-95: one depth row
  listTab();
  $('[data-act="panel"]').click();
  $('#fsecs .sec-head[data-k="reading"]').click();
  const depth = $('#fsec-reading .depthrow'), cs = app.window.getComputedStyle(depth);
  t.ok('depth chips sit in one row that never wraps (T-95)', cs.flexWrap === 'nowrap' && cs.whiteSpace === 'nowrap' &&
       $$('#fsec-reading .chip[data-k="tier"]').every(c => c.parentElement === depth), cs.flexWrap + ' ' + cs.whiteSpace);

  // --------------------------------------- notes only (T-12 / T-13)
  const withNotes = D.ids.map((id, i) => i).filter(i => D.issues[i][7] && !(D.issues[i][6] & (FL.GAPNOTE | FL.RENUM)) && !D.issueCompleteOnly[i]);
  $('#fsec-reading .chip[data-k="notesOnly"]').click();
  const shownRows = $$('.row:not(.inert)');
  t.ok('notes only narrows the list to rows with a note (T-12)', shownRows.length === withNotes.length &&
       shownRows.every(r => D.issues[+r.dataset.i][7]), shownRows.length + ' vs ' + withNotes.length);
  t.ok('notes only shows as a removable chip and in the Reading summary', $$('#fchips .chip').some(c => /Notes only/.test(c.textContent)) &&
       /notes only/.test($('#fsecs .sec-head[data-k="reading"] .sec-sum').textContent));
  t.ok('"Showing N of M" counts the notes', new RegExp('Showing ' + withNotes.length + ' of').test($('#fshow').textContent), $('#fshow').textContent);
  t.ok('notes only never changes a figure (display-only)', figures() === base);
  $('#fsec-reading .chip[data-k="notesOnly"]').click();
  t.ok('notes only off restores the list: back to the collapsed landing (T-13)', $$('.row').length === 0 &&
       $$('.era-head').every(h => h.getAttribute('aria-expanded') === 'false'));

  // --------------------------------- newest era first (T-14 / T-15)
  settingsTab();
  pref('rev').click();
  listTab();
  const bandOrder = () => $$('#app > .band').map(x => +x.dataset.b);
  const eraOrder = () => $$('.band-body > .era').map(x => +x.dataset.e);
  t.eq('newest era first reverses the bands (T-14)', bandOrder(), D.periods.map((p, i) => i).reverse());
  t.eq('…and the eras inside them', eraOrder(), D.eras.map((e, i) => i).reverse());
  t.ok('…without changing a figure (finish-by stays cumulative in reading order)', figures() === base);
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  const rowsDawn = $$('.era[data-e="0"] .row').map(r => +r.dataset.i);
  t.ok('rows inside an era stay in reading order', rowsDawn.every((x, k) => k === 0 || x > rowsDawn[k - 1]));
  settingsTab();
  pref('rev').click();
  listTab();
  t.eq('turning it off restores the order (T-15)', bandOrder(), D.periods.map((p, i) => i));
  t.ok('newest era first is stored', stored().rev === false);

  // ---------------------------------------------- tap to reveal (T-16)
  settingsTab();
  pref('reveal').click();
  t.ok('tap to reveal sets the root flag (T-16)', root().getAttribute('data-reveal') === '1');
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  const row6 = () => $('.row[data-id="fixture-hero-1980-6"]');
  t.ok('a row\'s note waits behind a "note" button', row6().querySelector('.subnote').hidden && !!row6().querySelector('[data-act="reveal"]'));
  row6().querySelector('[data-act="reveal"]').click();
  t.ok('tapping it shows the note', !row6().querySelector('.subnote').hidden && row6().querySelector('[data-act="reveal"]').getAttribute('aria-expanded') === 'true');
  row6().querySelector('[data-act="reveal"]').click();
  t.ok('tapping again hides it', row6().querySelector('.subnote').hidden);
  t.ok('rows without a note get no reveal button', !$('.row[data-id="fixture-hero-1980-1"] [data-act="reveal"]'));
  t.ok('tap to reveal never changes a figure', figures() === base);
  settingsTab();
  pref('reveal').click();
  t.ok('off again: notes inline, flag cleared', root().getAttribute('data-reveal') === '0');

  // ------------------------------------------------- combo badge (T-17)
  pref('combo').click();
  t.ok('combo badge sets the root flag (T-17)', root().getAttribute('data-combo') === '1');
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const star = $('.row[data-id="fixture-hero-1980-1"] .bm');
  const comboRules = () => [...d.styleSheets].flatMap(sh => [...sh.cssRules]).filter(r => r.selectorText && /data-combo/.test(r.selectorText) && star.matches(r.selectorText));
  t.ok('a read + bookmarked row matches the real stylesheet\'s combo rule', comboRules().length === 1 && /background/.test(comboRules()[0].cssText));
  settingsTab();
  pref('combo').click();
  t.ok('combo off: the rule no longer applies', comboRules().length === 0);

  // --------------------------------------------------- badges on / off
  pref('badges').click();
  listTab();
  t.ok('badges off: root flag set and the badges compute to display:none', root().getAttribute('data-badges') === '0' &&
       app.window.getComputedStyle(star.closest('.badges')).display === 'none');
  t.ok('badges off never changes a figure', figures() === base);
  settingsTab();
  pref('badges').click();
  t.ok('badges on again: visible', app.window.getComputedStyle($('.row[data-id="fixture-hero-1980-1"] .badges')).display !== 'none');

  // ---------------------------------------------- gap notes (XM-10)
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  const rising = D.eras.findIndex(e => e.id === 'rising');
  $(`.era[data-e="${rising}"] > .era-head`).click();
  t.ok('gap notes show by default', !!$('.row[data-id="gap-1983-hiatus"]'));
  settingsTab();
  pref('gapNotes').click();
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  $(`.era[data-e="${rising}"] > .era-head`).click();
  t.ok('gap notes off hides them (XM-10)', !$('.row[data-id="gap-1983-hiatus"]') && $$(`.era[data-e="${rising}"] .row`).length > 0);
  t.ok('…and never changes a figure', figures() === base);
  settingsTab();
  pref('gapNotes').click();

  // ------------------------------------------------------ layout C (X-1)
  $('#settings [data-act="layout"][data-v="rows"]').click();
  t.ok('layout C sets the root flag', root().getAttribute('data-layout') === 'rows');
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  const dawnRows = $$('.era[data-e="0"] .row:not(.inert)');
  t.ok('layout C: no arc headings (X-1)', !$('.era[data-e="0"] .arc-head') && dawnRows.length > 0);
  t.ok('layout C: every row carries its arc name', dawnRows.every(r => r.querySelector('.arclabel') && r.querySelector('.arclabel').textContent === D.arcs[D.issues[+r.dataset.i][2]].n));
  t.ok('layout C never changes a figure', figures() === base);
  settingsTab();
  $('#settings [data-act="layout"][data-v="arcs"]').click();
  app.window.PullList.jumpToIssue('fixture-hero-1980-6');
  t.ok('headings again: arc heads back, no per-row labels', !!$('.era[data-e="0"] .arc-head') && !$('.era[data-e="0"] .arclabel'));

  // ------------------------------------------ era navigation (XM-8)
  t.ok('plain scroll by default: no era bar', $('#eranav').hidden);
  settingsTab();
  $('#settings [data-act="eranav"][data-v="chips"]').click();
  listTab();
  $$('.era-head').forEach(h => { if (h.getAttribute('aria-expanded') === 'true') h.click(); });
  t.eq('chips: one per era, in display order', $$('#eranavIn [data-act="era-jump"]').map(c => +c.dataset.e), D.eras.map((e, i) => i));
  $('#eranavIn [data-act="era-jump"][data-e="3"]').click();
  t.ok('a chip opens its era (and its band) and scrolls to it', $('.era[data-e="3"] > .era-head').getAttribute('aria-expanded') === 'true' &&
       app.window.__scrolledTo === $('.era[data-e="3"]') && !$('.band[data-b="1"] > .band-body').hidden);
  t.ok('jumping never filters: every era is still listed', $$('.era').every(x => !x.hidden));
  settingsTab();
  $('#settings [data-act="eranav"][data-v="dropdown"]').click();
  const sel = $('#eraJump');
  t.ok('dropdown: a select with one option per era', !!sel && sel.options.length === D.eras.length + 1);
  listTab();
  $$('.era-head').forEach(h => { if (h.getAttribute('aria-expanded') === 'true') h.click(); });
  sel.value = '1';
  sel.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  t.ok('choosing an era opens it (one delegated change listener)', $('.era[data-e="1"] > .era-head').getAttribute('aria-expanded') === 'true' &&
       sel.value === '' && app.listeners.filter(x => x === 'change').length === 1);
  t.ok('era navigation never changes a figure', figures() === base);

  // ---------------------------------------------- stored in one place
  const st = stored();
  t.ok('display options live in the one settings store', st.eraNav === 'dropdown' && st.layout === 'arcs' && st.badges === true && st.gapNotes === true);
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  const saved = app.window.localStorage.getItem(ns + 'settings');
  app.window.close();

  // a fresh boot keeps them, and still lands collapsed
  app = boot(b.out, { now: NOW, storage: { [ns + 'settings']: saved } });
  d = app.document;
  await wait(20);
  t.ok('a fresh boot keeps the era dropdown and lands collapsed', !!d.querySelector('#eraJump') && d.querySelectorAll('.row').length === 0);
  app.window.close();

  // no bands: newest era first reverses the top-level eras
  const np = noPeriods(), Dn = loadData(np.out);
  app = boot(np.out, { now: NOW, storage: { [Dn.franchise.key + ':v3:settings']: JSON.stringify({ v: 3, rev: true }) } });
  await wait(20);
  t.eq('no bands: newest era first reverses the eras', [...app.document.querySelectorAll('#app > .era')].map(x => +x.dataset.e), Dn.eras.map((e, i) => i).reverse());
  t.ok('no runtime errors (no bands)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  function visible(el) { return !!el && !el.closest('[hidden]'); }
};
