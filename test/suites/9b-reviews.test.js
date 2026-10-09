/* Reviews (session 3, step 5; per issue since session 6, John 8 Oct): one per
   issue, keyed by row id, 1–5 stars and text. The ✎ button (.b.rv, D-4 /
   T-53) sits on every row, in both layouts. The Reviews tab lists them in
   reading order and jumps; reviews the list has no issue for are listed,
   never dropped. The per-arc store of earlier builds is never written. */
'use strict';
const { loadData, boot, wait, basic } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const INERT = D.flagBits.GAPNOTE | D.flagBits.RENUM;
  const visible = el => !!el && !el.closest('[hidden]');
  const base = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  let app = boot(b.out, { now: NOW, storage: base });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const stored = () => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + 'issue-reviews') || '{}'); };
  const idx = id => D.ids.indexOf(id);

  t.eq('tabs in order', $$('#tabs [role="tab"]').map(x => x.textContent), ['Checklist', 'Reading', 'Reviews', 'Settings']);
  $('#tab-reviews').click();
  t.ok('Reviews pane visible (T-120)', visible($('#reviews')) && $('#pane-list').hidden);
  t.ok('empty state tells you where the ✎ is', /No reviews yet\. Tap ✎ on any issue/.test($('#reviews').textContent));
  $('#tab-list').click();

  // ---- the ✎ button on every row (T-53, D-4)
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const rows = $$('.era[data-e="0"] .row');
  const live = rows.filter(r => !r.classList.contains('inert')), inert = rows.filter(r => r.classList.contains('inert'));
  t.ok('every row carries its own review button, targetable as .b.rv (T-53, D-4)', live.length > 3 &&
       live.every(r => r.querySelectorAll('.b.rv[data-act="rv"]').length === 1 && r.querySelector('.b.rv').dataset.i === r.dataset.i));
  t.ok('…an inert row (a gap note) has none, and no arc head has one', inert.every(r => !r.querySelector('.b.rv')) && !$('.arc-head .b.rv'));
  const i1 = idx('fixture-hero-1980-1'), i3 = idx('fixture-hero-1980-3');
  t.ok('two issues of the same arc', D.issues[i1][2] === D.issues[i3][2]);
  const rvBtn = i => $(`.row[data-i="${i}"] .b.rv`);
  t.ok('unreviewed: a bare ✎, named for its issue', rvBtn(i1).textContent === '✎' && rvBtn(i1).getAttribute('aria-label') === 'Review ' + D.issues[i1][1]);
  rvBtn(i1).click();
  const ed = i => $(`.review[data-i="${i}"]`);
  t.ok('✎ opens an editor under its row: 5 stars and a notes box, named for the issue', !!ed(i1) && ed(i1).querySelectorAll('.star').length === 5 &&
       !!ed(i1).querySelector('textarea') && rvBtn(i1).getAttribute('aria-expanded') === 'true' && d.activeElement === ed(i1).querySelector('textarea') &&
       $(`.row[data-i="${i1}"]`).nextElementSibling === ed(i1) && ed(i1).querySelector('textarea').getAttribute('aria-label') === 'Notes on ' + D.issues[i1][1]);
  ed(i1).querySelector('.star[data-n="4"]').click();
  t.eq('four stars are stored under the row id', stored()['fixture-hero-1980-1'], { r: 4, t: '' });
  t.ok('the button shows the rating', rvBtn(i1).textContent === '✎ ★★★★' && /4 of 5 stars/.test(rvBtn(i1).getAttribute('aria-label')));
  t.eq('stars 1–4 pressed', [...ed(i1).querySelectorAll('.star')].map(x => x.getAttribute('aria-pressed')), ['true', 'true', 'true', 'true', 'false']);
  const ta = ed(i1).querySelector('textarea');
  ta.value = 'A strong start.';
  ta.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  t.eq('text typed and closed at once still reaches storage (flushed on pagehide, no lost debounce)', stored()['fixture-hero-1980-1'], { r: 4, t: 'A strong start.' });
  rvBtn(i3).click();
  ed(i3).querySelector('.star[data-n="2"]').click();
  t.eq('another issue of the same arc keeps its own review', [stored()['fixture-hero-1980-1'], stored()['fixture-hero-1980-3']],
       [{ r: 4, t: 'A strong start.' }, { r: 2, t: '' }]);
  t.ok('…each button and editor shows its own', rvBtn(i3).textContent === '✎ ★★' && rvBtn(i1).textContent === '✎ ★★★★' &&
       [...ed(i3).querySelectorAll('.star')].filter(x => x.getAttribute('aria-pressed') === 'true').length === 2);
  ed(i1).querySelector('.star[data-n="4"]').click();
  t.ok('tapping the same star again clears the rating; the text stays', stored()['fixture-hero-1980-1'].r === 0 && rvBtn(i1).textContent === '✎ noted');
  ta.value = '';
  ta.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  t.ok('clearing both deletes the review', !('fixture-hero-1980-1' in stored()) && rvBtn(i1).textContent === '✎');
  rvBtn(i1).click();
  t.ok('✎ again closes the editor', !ed(i1) && rvBtn(i1).getAttribute('aria-expanded') === 'false');
  t.ok('the per-arc store of earlier builds is never written', app.window.localStorage.getItem(ns + 'reviews') === null);
  t.ok('no runtime errors (editor)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- the Reviews tab: reading order, jump, kept old reviews
  const lastLive = D.ids.filter((id, i) => !(D.issues[i][6] & INERT)).pop(), firstLive = D.ids.find((id, i) => !(D.issues[i][6] & INERT));
  const mid = 'fixture-hero-1980-3';
  const revs = { [lastLive]: { r: 2, t: 'Ends oddly.' }, [firstLive]: { r: 5, t: 'Classic.' }, [mid]: { r: 0, t: 'Notes only.' },
                 'issue-since-removed-1990-1': { r: 3, t: 'From an older list.' } };
  app = boot(b.out, { now: NOW, storage: Object.assign({}, base, {
    [ns + 'issue-reviews']: JSON.stringify(revs),
    [ns + 'legacy-unmatched']: JSON.stringify({ reviews: { '199901001': { r: 1, t: 'Old per-issue note.' } } }) }) });
  d = app.document;
  await wait(20);
  $('#tab-reviews').click();
  t.ok('the heading counts the reviews on issues in this list', $('#reviews .pane-h').textContent === 'Reviews · 3');
  t.eq('listed in reading order (F-3)', $$('#reviews ol.revlist [data-act="rv-jump"]').map(x => x.dataset.id), [firstLive, mid, lastLive]);
  const firstItem = $('#reviews ol.revlist .rev-item');
  t.ok('each shows the issue, its stars, its arc and era, and the text', firstItem.textContent.indexOf(D.issues[idx(firstLive)][1]) >= 0 &&
       /★★★★★/.test(firstItem.textContent) && /Classic\./.test(firstItem.textContent) &&
       firstItem.querySelector('.rev-era').textContent === D.arcs[D.issues[idx(firstLive)][2]].n + ' · ' + D.eras[0].name);
  const kept = $$('#reviews .kept .rev-item').map(x => x.textContent);
  t.ok('reviews that match no issue are kept and listed, never dropped', kept.length === 2 && kept.some(x => /issue-since-removed/.test(x) && /From an older list/.test(x)) &&
       kept.some(x => /199901001/.test(x) && /Old per-issue note/.test(x)));
  $(`#reviews [data-act="rv-jump"][data-id="${lastLive}"]`).click();
  t.ok('tapping a review jumps to its issue in the checklist', !$('#pane-list').hidden && visible($(`.row[data-i="${idx(lastLive)}"]`)));
  t.ok('…whose ✎ shows the rating', $(`.row[data-i="${idx(lastLive)}"] .b.rv`).textContent === '✎ ★★');
  t.ok('no runtime errors (Reviews tab)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- layout C: every row carries its ✎ too
  app = boot(b.out, { now: NOW, storage: Object.assign({}, base, { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, layout: 'rows' }) }) });
  d = app.document;
  await wait(20);
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const rowsC = $$('.era[data-e="0"] .row:not(.inert)');
  t.ok('layout C: every row carries its own ✎', rowsC.length > 3 && rowsC.every(r => r.querySelectorAll('.b.rv').length === 1));
  rowsC[2].querySelector('.b.rv').click();
  t.ok('…and opens the editor under that row', rowsC[2].nextElementSibling && rowsC[2].nextElementSibling.classList.contains('review') &&
       rowsC[2].nextElementSibling.dataset.i === rowsC[2].dataset.i);
  t.ok('no runtime errors (layout C)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
