/* Reviews (session 3, step 5): one per arc, 1–5 stars and text. The ✎
   button (.b.rv, D-4 / T-53) sits on arc heads (on the first row of each arc
   run in layout C). The Reviews tab lists them by each arc's first key and
   jumps; reviews the migration could not match are listed, never dropped. */
'use strict';
const { loadData, boot, wait, basic } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const visible = el => !!el && !el.closest('[hidden]');
  const base = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  let app = boot(b.out, { now: NOW, storage: base });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const stored = () => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + 'reviews') || '{}'); };
  const arcIdx = id => D.arcs.findIndex(a => a.id === id);

  t.eq('tabs in order', $$('#tabs [role="tab"]').map(x => x.textContent), ['Checklist', 'Reading', 'Reviews', 'Settings']);
  $('#tab-reviews').click();
  t.ok('Reviews pane visible (T-120)', visible($('#reviews')) && $('#pane-list').hidden);
  t.ok('empty state tells you where the ✎ is', /No reviews yet/.test($('#reviews').textContent));
  $('#tab-list').click();

  // ---- the ✎ button on every arc head (T-53, D-4)
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const heads = $$('.era[data-e="0"] .arc-head');
  t.ok('every arc head carries a review button targetable as .b.rv (T-53, D-4)', heads.length > 0 && heads.every(h => h.querySelector('.b.rv[data-act="rv"]')));
  const firstArc = +heads[0].closest('.arc').dataset.a, arcId = D.arcs[firstArc].id;
  const rvBtn = () => $(`.arc[data-a="${firstArc}"] .arc-head .b.rv`);
  t.ok('unreviewed: "✎ review"', rvBtn().textContent === '✎ review');
  rvBtn().click();
  const ed = () => $(`.review[data-a="${firstArc}"]`);
  t.ok('✎ opens an editor under the arc head: 5 stars and a notes box', !!ed() && ed().querySelectorAll('.star').length === 5 &&
       !!ed().querySelector('textarea') && rvBtn().getAttribute('aria-expanded') === 'true' && d.activeElement === ed().querySelector('textarea'));
  ed().querySelector('.star[data-n="4"]').click();
  t.eq('four stars are stored under the arc id', stored()[arcId], { r: 4, t: '' });
  t.ok('the button shows the rating', rvBtn().textContent === '✎ ★★★★' && /4 of 5 stars/.test(rvBtn().getAttribute('aria-label')));
  t.eq('stars 1–4 pressed', [...ed().querySelectorAll('.star')].map(x => x.getAttribute('aria-pressed')), ['true', 'true', 'true', 'true', 'false']);
  const ta = ed().querySelector('textarea');
  ta.value = 'A strong start.';
  ta.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  t.eq('text typed and closed at once still reaches storage (flushed on pagehide, no lost debounce)', stored()[arcId], { r: 4, t: 'A strong start.' });
  ed().querySelector('.star[data-n="4"]').click();
  t.ok('tapping the same star again clears the rating; the text stays', stored()[arcId].r === 0 && rvBtn().textContent === '✎ noted');
  ta.value = '';
  ta.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  t.ok('clearing both deletes the review', !(arcId in stored()) && rvBtn().textContent === '✎ review');
  rvBtn().click();
  t.ok('✎ again closes the editor', !ed() && rvBtn().getAttribute('aria-expanded') === 'false');
  t.ok('no runtime errors (editor)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- the Reviews tab: sorted by first key, jump, kept old reviews
  const late = D.arcs[D.issues[D.issues.length - 1][2]].id, early = D.arcs[D.issues[0][2]].id;
  const revs = { [late]: { r: 2, t: 'Ends oddly.' }, [early]: { r: 5, t: 'Classic.' }, 'arc-since-removed': { r: 3, t: 'From an older list.' } };
  app = boot(b.out, { now: NOW, storage: Object.assign({}, base, {
    [ns + 'reviews']: JSON.stringify(revs),
    [ns + 'legacy-unmatched']: JSON.stringify({ reviews: { '199901001': { r: 1, t: 'Old per-issue note.' } } }) }) });
  d = app.document;
  await wait(20);
  $('#tab-reviews').click();
  t.ok('the heading counts matched reviews', $('#reviews .pane-h').textContent === 'Reviews · 2');
  t.eq('listed by each arc\'s first key (F-3)', $$('#reviews ol.revlist [data-act="rv-jump"]').map(x => D.arcs[+x.dataset.a].id), [early, late]);
  const firstItem = $('#reviews ol.revlist .rev-item');
  t.ok('each shows stars, era and text', /★★★★★/.test(firstItem.textContent) && /Classic\./.test(firstItem.textContent) && !!firstItem.querySelector('.rev-era'));
  const kept = $$('#reviews .kept .rev-item').map(x => x.textContent);
  t.ok('reviews that match no arc are kept and listed, never dropped', kept.length === 2 && kept.some(x => /arc-since-removed/.test(x) && /From an older list/.test(x)) &&
       kept.some(x => /199901001/.test(x) && /Old per-issue note/.test(x)));
  $(`#reviews [data-act="rv-jump"][data-a="${arcIdx(late)}"]`).click();
  const lastArcRow = D.issues.findIndex(r => r[2] === arcIdx(late));
  t.ok('tapping a review jumps to its arc in the checklist', !$('#pane-list').hidden && visible($(`.row[data-i="${lastArcRow}"]`)));
  t.ok('…whose head shows the rating', $(`.arc[data-a="${arcIdx(late)}"] .arc-head .b.rv`).textContent === '✎ ★★');
  t.ok('no runtime errors (Reviews tab)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- layout C: the ✎ rides on the first row of each arc run
  app = boot(b.out, { now: NOW, storage: Object.assign({}, base, { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, layout: 'rows' }) }) });
  d = app.document;
  await wait(20);
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const rows = $$('.era[data-e="0"] .row:not(.inert)');
  const runStarts = rows.filter((r, k) => k === 0 || D.issues[+r.dataset.i][2] !== D.issues[+rows[k - 1].dataset.i][2]);
  t.ok('layout C: each arc run\'s first row carries the ✎, no other row does', rows.filter(r => r.querySelector('.b.rv')).length === runStarts.length &&
       runStarts.every(r => r.querySelector('.b.rv')));
  runStarts[0].querySelector('.b.rv').click();
  t.ok('…and opens the editor under that row', runStarts[0].nextElementSibling && runStarts[0].nextElementSibling.classList.contains('review'));
  t.ok('no runtime errors (layout C)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
