/* Reading tab (session 3, step 4): a one-entry stepper over the current view.
   It resumes at the first entry not yet done until the user steps; marks go
   through the one setMark path, so the header and every banner move (D-1);
   labels follow the medium (T-52). S-17 is re-expressed here: the checklist
   always lands collapsed, and the Reading tab is where "resume" lives. */
'use strict';
const { loadData, boot, wait, typeInto, mixed } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const mx = mixed(), D = loadData(mx.out), ns = D.franchise.key + ':v3:';
  const order = ['mixed-hero-1990-1', 'mixed-hero-1990-2', 'mixed-quest-1990', 'mixed-hero-1990-3', 'mixed-toons-1991-s1e1',
                 'mixed-toons-1991-s1e2', 'mixed-toons-1991-s1e3', 'mixed-hero-1990-4', 'mixed-hero-1990-5', 'mixed-hero-1990-6',
                 'mixed-quest-ii-1992', 'mixed-hero-1990-7', 'mixed-elsewhere-1992-1'];
  const visible = el => !!el && !el.closest('[hidden]');
  let app = boot(mx.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify({ marks: { 'mixed-hero-1990-1': 'read', 'mixed-hero-1990-2': 'skip' }, bookmarks: [] }) } });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const stored = k => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + k)); };
  const card = () => $('#reader .rcard');
  const cur = () => card() && card().dataset.id;
  const btn = act => $(`#reader [data-act="${act}"]`);

  t.eq('tabs in order: Checklist, Reading, Reviews, Settings', $$('#tabs [role="tab"]').map(b => b.textContent), ['Checklist', 'Reading', 'Reviews', 'Settings']);
  $('#tab-reading').click();
  t.ok('Reading tab opens its pane; no filter panel there (T-91 re-expressed)', visible($('#reader')) && !visible($('#fpanel')));
  t.ok('the stepper shows a title (T-118)', $('#reader .rtitle').textContent === 'Mixed Quest (1990)');
  t.ok('it resumes at the first entry not yet done (read and skipped ones are passed over)', cur() === 'mixed-quest-1990');
  t.ok('"n of N" counts the view, inert gap notes excluded', $('#reader .rcount').textContent === '3 of 13');
  t.ok('era pill, format pill, and arc · type', /One/.test($('#reader .rpills').textContent) && /Games/.test($('#reader .rpills').textContent) &&
       $('#reader .rmeta').textContent === 'The Game · game');

  // ---- labels follow the medium (T-52)
  t.ok('a game reads "Not started" and offers "Mark Beaten" (T-52)', $('#reader .rstate').textContent === 'Not started' && btn('rd-done').textContent === 'Mark Beaten');

  // ---- D-1: a Reading-tab mark moves every counter
  const era0 = () => $('.era[data-e="0"] > .era-head .bcount').textContent;
  const band0 = () => $('.band[data-b="0"] > .band-head .bcount').textContent;
  const hdr = () => $('#pprog .pcount').textContent;
  const before = [hdr(), band0(), era0()];
  btn('rd-done').click();
  t.ok('the done button persists the mark (T-119)', stored('progress').marks['mixed-quest-1990'] === 'read');
  t.ok('header, band and era counters all move (D-1)', hdr() !== before[0] && band0() !== before[1] && era0() !== before[2] &&
       /^2 \//.test(hdr()) && /^2 \//.test(band0()) && /^2 \//.test(era0()), [hdr(), band0(), era0()].join(' | '));
  t.ok('…and the time left drops by the game\'s 1500 minutes (two comics were already done)', $('#pprog .pleft').dataset.leftMin === String(1708 - 15 - 15 - 1500));
  t.ok('marking steps on to the next entry', cur() === 'mixed-hero-1990-3' && btn('rd-done').textContent === 'Mark Read');
  btn('rd-prev').click();
  t.ok('Previous goes back; a done game shows "Beaten ✓"', cur() === 'mixed-quest-1990' && btn('rd-done').textContent === 'Beaten ✓' &&
       btn('rd-done').getAttribute('aria-pressed') === 'true');
  btn('rd-done').click();
  t.ok('tapping "Beaten ✓" again clears the mark and stays put', cur() === 'mixed-quest-1990' && !stored('progress').marks['mixed-quest-1990'] &&
       btn('rd-done').textContent === 'Mark Beaten');
  btn('rd-next').click(); btn('rd-next').click();
  t.ok('a show offers "Mark Watched"', cur() === 'mixed-toons-1991-s1e1' && btn('rd-done').textContent === 'Mark Watched' &&
       $('#reader .rstate').textContent === 'Unwatched');
  btn('rd-skip').click();
  t.ok('Skip marks it skipped and steps on', stored('progress').marks['mixed-toons-1991-s1e1'] === 'skip' && cur() === 'mixed-toons-1991-s1e2');
  btn('rd-prev').click();
  t.ok('…shown as "Skipped" when you go back', btn('rd-skip').textContent === 'Skipped' && btn('rd-skip').getAttribute('aria-pressed') === 'true');

  // ---- the checklist row follows a Reading-tab mark (one setMark path)
  app.window.PullList.jumpToIssue('mixed-toons-1991-s1e1');
  t.ok('the checklist row shows the mark made in Reading', $('.row[data-id="mixed-toons-1991-s1e1"]').dataset.s === 'skip');
  $('.row[data-id="mixed-toons-1991-s1e1"] .mark').click();
  $('#tab-reading').click();
  t.ok('…and a checklist mark shows in Reading (stepped position kept in the session)', cur() === 'mixed-toons-1991-s1e1' &&
       btn('rd-skip').textContent === 'Skip');

  // ---- Pin
  btn('rd-pin').click();
  t.ok('Pin bookmarks the entry and shows it pinned', btn('rd-pin').textContent === '★ Pinned' && stored('progress').bookmarks.includes('mixed-toons-1991-s1e1'));
  t.ok('…and the pinned bar picks it up', $$('#pinchips .pin').some(c => c.dataset.id === 'mixed-toons-1991-s1e1'));
  t.ok('…and the checklist star', $('.row[data-id="mixed-toons-1991-s1e1"] .bm').getAttribute('aria-pressed') === 'true');
  btn('rd-pin').click();
  t.ok('Pin again un-pins', btn('rd-pin').textContent === '☆ Pin for later' && !stored('progress').bookmarks.includes('mixed-toons-1991-s1e1'));

  // ---- ends of the list
  for (let k = 0; k < 20; k++) btn('rd-prev').click();
  t.ok('Previous is disabled on the first entry', cur() === order[0] && btn('rd-prev').disabled);
  for (let k = 0; k < 20; k++) btn('rd-next').click();
  t.ok('Next is disabled on the last entry', cur() === order[order.length - 1] && btn('rd-next').disabled);
  t.ok('the stepper walks the whole view in reading order', $('#reader .rcount').textContent === '13 of 13');

  // ---- filters: the stepper follows the view, and filters survive the trip
  $('#tab-list').click();
  $('[data-act="panel"]').click();
  $('#fsecs .sec-head[data-k="story"]').click();
  $(`#fsec-story .chip[data-k="media"][data-v="${D.media.indexOf('game')}"]`).click();
  const shown = $('#fshow').textContent;
  $('#tab-reading').click();
  t.ok('format = Games: the stepper covers the two games', /of 2$/.test($('#reader .rcount').textContent) && /Mixed Quest/.test($('#reader .rtitle').textContent));
  $('#tab-list').click();
  t.ok('filters survive a round trip through Reading (T-41)', $('#fshow').textContent === shown &&
       $$('#fchips .chip').some(c => /Games/.test(c.textContent)));
  $(`#fsec-story .chip[data-k="media"][data-v="${D.media.indexOf('game')}"]`).click();
  await typeInto(app, '#q', 'nothing-matches-this');
  $('#tab-reading').click();
  t.ok('nothing in the view: the stepper says so', /Nothing matches/.test($('#reader').textContent));
  $('#tab-list').click();
  await typeInto(app, '#q', '');
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- S-17 re-expressed: boot on Reading, checklist still collapsed
  app = boot(mx.out, { now: NOW, storage: {
    [ns + 'settings']: JSON.stringify({ v: 3, tab: 'reading' }),
    [ns + 'progress']: JSON.stringify({ marks: Object.fromEntries(order.slice(0, 5).map(id => [id, 'read'])), bookmarks: [] }) } });
  d = app.document;
  await wait(20);
  t.ok('booting on Reading resumes at the first unread (S-17 re-expressed)', cur() === order[5] && visible($('#reader')));
  t.ok('…while the checklist behind it landed collapsed, no rows rendered', d.querySelectorAll('#app .row').length === 0 &&
       [...d.querySelectorAll('.era-head')].every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok('no runtime errors (boot on Reading)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
