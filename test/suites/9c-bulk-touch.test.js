/* Bulk marking and touch (session 3, step 6).
   - Bulk: era (read / unread), a range of eras, an arc. They mark the rows the
     current view counts, through the same applyMark path, then save and refresh
     once. Undo restores every row's PREVIOUS state (B-2, V-27).
   - Touch, both off by default (decided 3 Oct): swipe right = read, left =
     skip, with the row sliding over a coloured backing; long-press a band / era
     / arc head to mark it all read. No haptics: navigator.vibrate is never
     called (guarded statically in 80-guards and at runtime here). */
'use strict';
const { loadData, boot, wait, basic, stress, openSettings } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:', FL = D.flagBits;
  const inert = i => !!(D.issues[i][6] & (FL.GAPNOTE | FL.RENUM));
  const counted = i => !inert(i) && !D.issueCompleteOnly[i];
  const start = { 'fixture-hero-1980-1': 'reading', 'fixture-hero-1980-2': 'skip', 'fixture-hero-1980-3': 'read' };
  let app = boot(b.out, { now: NOW, storage: { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }),
                                               [ns + 'progress']: JSON.stringify({ marks: start, bookmarks: [] }) } });
  let d = app.document, W = app.window;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  let vibrations = 0;
  W.navigator.vibrate = () => { vibrations++; return true; };
  const marks = () => { W.dispatchEvent(new W.Event('pagehide')); return JSON.parse(W.localStorage.getItem(ns + 'progress')).marks; };
  const undo = () => { t.ok('…offered with Undo', !$('#toast').hidden && $('#toastAct').textContent === 'Undo'); $('#toastAct').click(); };
  const eraRows = e => D.ids.map((id, i) => i).filter(i => D.issueEra[i] === e && counted(i));

  // ------------------------------------------------ Settings sections
  openSettings(app);
  t.ok('Settings has Touch and Bulk actions sections', !!$('.sset[data-k="touch"] .seth') && !!$('.sset[data-k="bulk"] .seth'));
  const chip = k => $(`#settings [data-act="pref"][data-k="${k}"]`);
  t.ok('touch chips exist (T-20)', !!chip('swipe') && !!chip('press'));
  t.ok('both are off by default (opt-in, decided 3 Oct)', chip('swipe').getAttribute('aria-pressed') === 'false' && chip('press').getAttribute('aria-pressed') === 'false');
  t.eq('bulk era select lists every era (T-18)', [...$('#bulkEra').options].map(o => o.textContent), D.eras.map(e => e.name));
  t.ok('range selects default to the full span (T-19)', $('#bulkFrom').value === '0' && $('#bulkTo').value === String(D.eras.length - 1));

  // ------------------------------------------------ era: read, then Undo (B-2)
  $('[data-act="bulk-era"][data-st="read"]').click();
  const m1 = marks();
  t.ok('bulk mark era marks every row it counts read (T-21)', eraRows(0).every(i => m1[D.ids[i]] === 'read'), eraRows(0).length);
  t.ok('…leaves other eras alone', D.ids.every((id, i) => D.issueEra[i] === 0 || m1[id] === start[id]));
  t.ok('…and its banner turns ✓', !!$('.era[data-e="0"] > .era-head .bdone'));
  t.ok('…saying how many changed', /^\d+ marked read in Dawn\.$/.test($('#toastMsg').textContent), $('#toastMsg').textContent);
  undo();
  t.eq('Undo restores the previous states exactly: "reading" stays reading, "skip" stays skipped (B-2, V-27)', marks(), start);
  t.ok('…and the banner moves back', !$('.era[data-e="0"] > .era-head .bdone'));
  $('[data-act="bulk-era"][data-st="unread"]').click();
  t.ok('bulk unmark era clears them (T-22)', eraRows(0).every(i => !marks()[D.ids[i]]));
  undo();
  t.eq('Undo after clearing restores them too', marks(), start);

  // ------------------------------------------------ range across eras (T-23)
  const to = $('#bulkTo');
  to.value = '2';
  to.dispatchEvent(new W.Event('change', { bubbles: true }));
  $('#settings [data-act="pace-min"][data-v="8"]').click();
  t.ok('the range survives a Settings re-render', $('#bulkTo').value === '2');
  $('[data-act="bulk-range"]').click();
  const m2 = marks();
  t.ok('bulk mark range covers more than one era (T-23)', [0, 1, 2].every(e => eraRows(e).every(i => m2[D.ids[i]] === 'read')) &&
       eraRows(3).every(i => m2[D.ids[i]] !== 'read'));
  undo();
  t.eq('…and Undo restores', marks(), start);

  // ------------------------------------------------ respects the view
  $('#tab-list').click();
  $('[data-act="panel"]').click();
  $('#fsecs .sec-head[data-k="reading"]').click();
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  openSettings(app);
  $('[data-act="bulk-era"][data-st="read"]').click();
  const m3 = marks();
  t.ok('with "mandatory only" on, bulk marks only what the view counts', eraRows(0).every(i => (m3[D.ids[i]] === 'read') === (D.issues[i][4] === 1 || start[D.ids[i]] === 'read')));
  undo();
  $('#tab-list').click();
  $('#fsec-reading .chip[data-k="mandatory"]').click();

  // ------------------------------------------------ arc (XM-11)
  W.PullList.jumpToIssue('fixture-hero-1980-6');
  const arcHead = $('.era[data-e="0"] .arc-head'), a = +arcHead.closest('.arc').dataset.a;
  const arcRows = D.ids.map((id, i) => i).filter(i => D.issues[i][2] === a && counted(i));
  // what a person sees: every rendered row of the arc, its state and its glyph
  const shown = () => arcRows.map(i => { const r = $('.row[data-i="' + i + '"]'); return r ? r.dataset.s + ' ' + r.querySelector('.mark').textContent : 'not rendered'; });
  const arcBefore = shown();
  t.ok('the arc\'s rows are rendered (its era is open)', arcBefore.length > 1 && arcBefore.every(x => x !== 'not rendered'), arcBefore.join(' | '));
  arcHead.querySelector('[data-act="arc-mark"][data-st="read"]').click();
  t.ok('"Mark arc read" on the arc head marks the whole arc (XM-11)', arcRows.every(i => marks()[D.ids[i]] === 'read'));
  t.ok('…and every rendered row of the arc shows it: state and glyph', shown().every(x => x === 'read ✓'), shown().join(' | '));
  undo();
  t.eq('…Undo restores the start', marks(), start);
  t.eq('…and puts every rendered row back as it was', shown(), arcBefore);
  arcHead.querySelector('[data-act="arc-mark"][data-st="unread"]').click();
  t.ok('"Mark arc unread" clears it', arcRows.every(i => !marks()[D.ids[i]]));
  undo();
  t.eq('…Undo restores the start (only the latest action is undoable: one toast)', marks(), start);

  // ------------------------------------------------ swipe (T-24, XM-12)
  const touchAt = (el, type, x, y) => {
    const p = { clientX: x, clientY: y, identifier: 1, target: el };
    el.dispatchEvent(new W.TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [p], changedTouches: [p] }));
  };
  const swipe = (el, dx, dy, mid, late) => {
    touchAt(el, 'touchstart', 100, 100);
    touchAt(el, 'touchmove', 100 + dx / 4, 100 + dy / 4);
    if (mid) mid();
    touchAt(el, 'touchmove', 100 + dx, 100 + dy);
    if (late) late();
    touchAt(el, 'touchend', 100 + dx, 100 + dy);
  };
  const row = id => $(`.row[data-id="${id}"]`);
  swipe(row('fixture-hero-1980-4'), 120, 0);
  t.ok('swipe is off by default: a swipe marks nothing', !marks()['fixture-hero-1980-4']);
  openSettings(app);
  chip('swipe').click();
  t.ok('swipe toggle flips and is stored (T-24)', chip('swipe').getAttribute('aria-pressed') === 'true' &&
       (W.dispatchEvent(new W.Event('pagehide')), JSON.parse(W.localStorage.getItem(ns + 'settings')).swipe === true));
  $('#tab-list').click();
  let mid = '', late = '';
  swipe(row('fixture-hero-1980-4'), 120, 0, () => { mid = row('fixture-hero-1980-4').dataset.swipe; },
        () => { late = row('fixture-hero-1980-4').dataset.swipe; });
  t.ok('mid-swipe the row slides over its backing (data-swipe, XM-12)', mid === 'read', mid);
  t.ok('…and past the threshold the backing says it will commit', late === 'read-go', late);
  t.ok('swipe right marks read', marks()['fixture-hero-1980-4'] === 'read' && row('fixture-hero-1980-4').dataset.s === 'read');
  t.ok('…and the slide resets', row('fixture-hero-1980-4').dataset.swipe === '');
  swipe(row('fixture-hero-1980-5'), -120, 0);
  t.ok('swipe left skips', marks()['fixture-hero-1980-5'] === 'skip');
  swipe(row('fixture-hero-1980-7'), 30, 0);
  t.ok('a short swipe does nothing', !marks()['fixture-hero-1980-7']);
  swipe(row('fixture-hero-1980-7'), 120, 80);
  t.ok('a mostly vertical drag (a scroll) does nothing', !marks()['fixture-hero-1980-7']);
  const header = $('#pprog .pcount').textContent;
  t.ok('swipe marks go through setMark: the header counted them', /^[1-9]\d* \//.test(header));

  // ------------------------------------------------ long-press (T-25)
  const eraHead = () => $('.era[data-e="1"] > .era-head');
  const press = async (el, ms, moveBy) => {
    touchAt(el, 'touchstart', 50, 50);
    if (moveBy) touchAt(el, 'touchmove', 50 + moveBy, 50);
    await wait(ms);
    touchAt(el, 'touchend', 50 + (moveBy || 0), 50);
    el.click();                                              // the lift's click
  };
  const expanded = () => eraHead().getAttribute('aria-expanded');
  const before = expanded();
  await press(eraHead(), 700);
  t.ok('long-press is off by default: nothing marked, the tap just toggles', eraRows(1).every(i => !marks()[D.ids[i]]) && expanded() !== before);
  eraHead().click();
  openSettings(app);
  chip('press').click();
  t.ok('long-press toggle flips (T-25)', chip('press').getAttribute('aria-pressed') === 'true');
  $('#tab-list').click();
  const before2 = expanded();
  await press(eraHead(), 700);
  t.ok('holding an era head marks the era read', eraRows(1).every(i => marks()[D.ids[i]] === 'read'));
  t.ok('…and the lift does not also toggle the era open or shut', expanded() === before2);
  undo();
  await press(eraHead(), 700, 30);
  t.ok('moving the finger cancels the long-press', eraRows(1).every(i => marks()[D.ids[i]] !== 'read'));
  await press(eraHead(), 200);
  t.ok('a short tap is not a long-press', eraRows(1).every(i => marks()[D.ids[i]] !== 'read'));
  const bandHead = $('.band[data-b="1"] > .band-head');
  const bandRows = D.ids.map((id, i) => i).filter(i => D.periods[1].eras.includes(D.issueEra[i]) && counted(i));
  await press(bandHead, 700);
  t.ok('holding a band head marks the whole band read', bandRows.every(i => marks()[D.ids[i]] === 'read'));
  undo();

  // ------------------------------------------------ no haptics, listener budget
  t.ok('navigator.vibrate was never called by any gesture (no haptics)', vibrations === 0, vibrations);
  const mine = ['click', 'input', 'change', 'keydown', 'touchstart', 'touchmove', 'touchend', 'pagehide', 'visibilitychange', 'beforeinstallprompt'];
  t.ok('the 10 standing app listeners, one each, all delegated, and nothing else after every gesture', mine.every(type => app.listeners.filter(x => x === type).length === 1) &&
       app.listeners.every(type => mine.includes(type)), app.listeners.join(','));
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------------------------ 5,000 rows: one refresh
  const s = stress(), Ds = loadData(s.out);
  app = boot(s.out, { now: NOW });
  d = app.document;
  await wait(20);
  openSettings(app);
  const t0 = Date.now();
  d.querySelector('[data-act="bulk-range"]').click();
  const ms = Date.now() - t0;
  t.ok('5,000 rows marked read in one bulk action, under 1.5 s (' + ms + ' ms)', ms < 1500);
  t.ok('…every era banner shows ✓', d.querySelectorAll('.era-head .bdone').length === Ds.eras.length);
  t.ok('…and the toast counts them all', new RegExp('^5,000 marked read').test(d.querySelector('#toastMsg').textContent), d.querySelector('#toastMsg').textContent);
  t.ok('no runtime errors (5,000 rows)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
