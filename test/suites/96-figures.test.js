/* John's closing fixes for session 2 (2 Oct):
   1. every boot lands collapsed, whatever filters were saved; only a change
      made during the visit auto-expands matches;
   2. banner/header figures: PLAN filters (incl. format) always count, BROWSE filters count
      while active (marked "filtered"), DISPLAY-ONLY filters never count.
      Finish-by stays cumulative in reading order in every case. */
'use strict';
const { loadData, boot, wait, typeInto, basic, stress } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1), DAY = 864e5;
const iso = w => new Date(NOW + w * 7 * DAY).toISOString().slice(0, 10);

module.exports = async function (t) {
  // ---------------------------------------------------------------- 1. landing
  const s = stress();
  const st = boot(s.out, { storage: { 'big:v3:settings': JSON.stringify({ v: 3, filters: { unread: true } }) } });
  await wait(20);
  let d = st.document;
  t.ok('5,000 rows + saved "unread only": boot lands collapsed', [...d.querySelectorAll('.era-head')].every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok('5,000 rows + saved "unread only": zero rows rendered', d.querySelectorAll('.row').length === 0);
  t.ok('the saved filter is still applied (chip shown)', [...d.querySelectorAll('#fchips .chip')].some(c => /Unread only/.test(c.textContent)));
  await typeInto(st, '#q', 'Series5 (1965) #1');
  t.ok('changing a filter mid-visit still expands the matches', d.querySelector('.era[data-e="5"] > .era-head').getAttribute('aria-expanded') === 'true' &&
       d.querySelectorAll('.row').length > 0 && [...d.querySelectorAll('.row')].every(r => r.closest('.era').dataset.e === '5'));
  st.window.close();

  const st2 = boot(s.out, { storage: { 'big:v3:settings': JSON.stringify({ v: 3, filters: { eras: ['era-3'], mandatory: true } }) } });
  await wait(20);
  d = st2.document;
  t.ok('saved browse + plan filters: boot still lands collapsed with zero rows', d.querySelectorAll('.row').length === 0 &&
       [...d.querySelectorAll('.era-head')].every(h => h.getAttribute('aria-expanded') === 'false'));
  st2.window.close();

  // ---------------------------------------------------------------- 2. figures
  const b = basic();
  const D = loadData(b.out);
  const INERT = D.flagBits.GAPNOTE | D.flagBits.RENUM;
  const bandOf = e => D.periods.findIndex(p => p.eras.includes(e));
  const hay = i => (D.issues[i][1] + ' ' + D.arcs[D.issues[i][2]].n + ' ' + (D.issues[i][7] || '') + ' ' +
    D.issueWriters[i].concat(D.issueArtists[i]).map(c => D.creators[c].n).join(' ')).toLowerCase();
  // minutes left: comics at 15 min each, shows and games at their own duration;
  // finish-by = minutes / (12 a week x 15 min)
  function fig(pred, marks) {
    const one = () => ({ total: 0, read: 0, skip: 0, mins: 0 });
    const all = one(), band = D.periods.map(one);
    D.ids.forEach((id, i) => {
      if (D.issueCompleteOnly[i] || (D.issues[i][6] & INERT) || !pred(i)) return;
      const m = (marks || {})[id], du = D.issueDuration[i];
      [all, band[bandOf(D.issueEra[i])]].forEach(x => {
        x.total++;
        if (m === 'read') x.read++; else if (m === 'skip') x.skip++; else x.mins += du === 0 ? 15 : Math.max(du, 0);
      });
    });
    const left = x => x.total - x.read - x.skip;
    let cum = 0;
    const fins = band.map(x => { cum += x.mins; return left(x) ? iso(cum / 180) : null; });
    return { count: all.read + ' / ' + (all.total - all.skip) + ' read', finish: left(all) ? iso(all.mins / 180) : null, fins, all, band };
  }
  const marks = { 'fixture-hero-1980-1': 'read', 'fixture-hero-1980-2': 'read', 'fixture-hero-1980-3': 'skip', '198706004': 'read' };
  const app = boot(b.out, { now: NOW, storage: { [D.franchise.key + ':v3:progress']: JSON.stringify({ marks, bookmarks: [] }) } });
  d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const read = () => ({
    count: $('#pprog .pcount').textContent.replace(/ · \d+ skipped/, ''),
    finish: ($('#pprog .pfinish') || {}).dataset ? $('#pprog .pfinish').dataset.finish : null,
    fins: D.periods.map((p, bi) => { const f = $(`.band[data-b="${bi}"] > .band-head .bfinish`); return f ? f.dataset.finish : null; }),
    bandCounts: D.periods.map((p, bi) => $(`.band[data-b="${bi}"] > .band-head .bcount`).textContent.replace(/ · \d+ skipped/, '')),
    marked: !!$('#pprog .pfiltered') || $$('.bfiltered').length > 0
  });
  const expectFig = (label, f) => {
    const r = read();
    t.eq(label + ': header count', r.count, f.count);
    t.eq(label + ': header finish-by', r.finish, f.finish);
    t.eq(label + ': band finish-by, cumulative in reading order', r.fins, f.fins);
    t.eq(label + ': band counts', r.bandCounts, f.band.map(x => x.read + ' / ' + (x.total - x.skip) + ' read'));
  };
  const base = fig(() => true, marks);
  expectFig('default', base);
  t.ok('default: no "filtered" marker', !read().marked);

  $('[data-act="panel"]').click();
  $('#fsecs .sec-head[data-k="reading"]').click();
  $('#fsecs .sec-head[data-k="story"]').click();

  // ---- plan filters always count ----
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  expectFig('plan: mandatory only', fig(i => D.issues[i][4] === 1, marks));
  t.ok('plan: no "filtered" marker (plan figures are the plan, not a filtered view)', !read().marked);
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  $('#fsec-reading .chip[data-k="tier"][data-v="0"]').click();
  expectFig('plan: Barebones tier', fig(i => D.issueTier[i] === 0, marks));
  $('#fsec-reading .chip[data-k="tier"][data-v="2"]').click();
  $('#fsec-story .chip[data-k="alt"]').click();
  expectFig('plan: alternate stories off', fig(i => !(D.issues[i][6] & D.flagBits.ALT), marks));
  t.ok('plan: ALT off is not marked as filtered', !read().marked);
  $('#fsec-story .chip[data-k="alt"]').click();
  // format is a PLAN filter (decided 2 Oct): figures follow it, never marked "filtered"
  const comic = D.media.indexOf('comic'), game = D.media.indexOf('game');
  $(`#fsec-story .chip[data-k="media"][data-v="${game}"]`).click();
  expectFig('plan: format = Games', fig(i => D.issueMedium[i] === game, marks));
  t.ok('plan: format is not marked as filtered', !read().marked);
  $(`#fsec-story .chip[data-k="media"][data-v="${game}"]`).click();
  $(`#fsec-story .chip[data-k="media"][data-v="${comic}"]`).click();
  expectFig('plan: format = Comics', fig(i => D.issueMedium[i] === comic, marks));
  t.ok('plan: format = Comics is not marked as filtered', !read().marked);
  $(`#fsec-story .chip[data-k="media"][data-v="${comic}"]`).click();
  expectFig('plan: format cleared, figures revert', base);
  $('#fsec-reading .chip[data-k="hideSkip"]').click();
  expectFig('plan: hide skipped', fig(i => marks[D.ids[i]] !== 'skip', marks));
  t.ok('plan: hide skipped drops the "skipped" note from the header', !/skipped/.test($('#pprog .pcount').textContent));
  $('#fsec-reading .chip[data-k="hideSkip"]').click();
  expectFig('plan cleared: back to default', base);

  // ---- browse filters count while active, marked, and revert ----
  await typeInto(app, '#q', 'Kestrel');
  const kest = fig(i => hay(i).includes('kestrel'), marks);
  expectFig('browse: search "Kestrel"', kest);
  t.ok('browse: header shows the "filtered view" marker', !!$('#pprog .pfiltered'));
  t.ok('browse: banners show the "filtered" marker', $$('.band-head .bfiltered').length === D.periods.length);
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  expectFig('browse + plan combined', fig(i => hay(i).includes('kestrel') && D.issues[i][4] === 1, marks));
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  await typeInto(app, '#q', '');
  expectFig('browse cleared: figures revert', base);
  t.ok('browse cleared: marker gone', !read().marked);
  const storm = D.eras.findIndex(e => e.id === 'storm');
  $(`#fsec-story .chip[data-k="eras"][data-v="${storm}"]`).click();
  expectFig('browse: era chip', fig(i => D.issueEra[i] === storm, marks));
  t.ok('browse: era chip is marked as filtered', read().marked);
  $(`#fsec-story .chip[data-k="eras"][data-v="${storm}"]`).click();
  expectFig('era chip cleared: figures revert', base);

  // ---- display-only filters never change a number ----
  $('#fsec-reading .chip[data-k="unread"]').click();
  expectFig('display-only: unread only leaves every figure unchanged', base);
  t.ok('display-only: unread only is not marked as filtered', !read().marked);
  t.ok('display-only: unread only still hides read rows from the list', !$('.row[data-id="fixture-hero-1980-1"]') && $$('.row').length > 0);
  $('#fsec-reading .chip[data-k="unread"]').click();
  $('#fsecs .sec-head[data-k="order"]').click();
  $('.chip[data-k="order"][data-v="publication"]').click();
  expectFig('display-only: publication order leaves every figure unchanged', base);
  $('.chip[data-k="order"][data-v="reading"]').click();

  // ---- a mark made while browsing updates the filtered figures ----
  await typeInto(app, '#q', 'Kestrel');
  $('.row[data-id="kestrel-1986-6"] .mark').click(); $('.row[data-id="kestrel-1986-6"] .mark').click();
  const m2 = Object.assign({}, marks, { 'kestrel-1986-6': 'read' });
  expectFig('browse: marking updates the filtered figures', fig(i => hay(i).includes('kestrel'), m2));
  await typeInto(app, '#q', '');
  expectFig('…and the full figures after clearing', fig(() => true, m2));
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
