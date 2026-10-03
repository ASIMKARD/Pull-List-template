/* Tabs and the Settings shell (session 3, step 2): one tab nav, the filter
   panel on Checklist only, the active tab remembered, sectioned Settings with
   pace controls and the pace readout, progress per format, the refresh
   reminder actually consumed, About & legend, bookmarks (pinned bar + list),
   Clear all progress with an in-page confirm and a snapshot undo, and
   Import from previous version. */
'use strict';
const path = require('path');
const { ROOT, build, loadData, boot, wait, basic, mixed } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1), DAY = 864e5;

module.exports = async function (t) {
  const mx = mixed(), D = loadData(mx.out), ns = D.franchise.key + ':v3:';
  const stored = (app, k) => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + k)); };
  const visible = el => !!el && !el.closest('[hidden]');

  // ------------------------------------------------------------ tabs
  let app = boot(mx.out, { now: NOW });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  t.ok('exactly one #tabs nav (T-2)', $$('#tabs').length === 1 && $$('nav').length === 1 && $('#tabs').getAttribute('role') === 'tablist');
  t.eq('tabs in order', $$('#tabs [role="tab"]').map(b => b.textContent), ['Checklist', 'Reading', 'Reviews', 'Settings']);
  t.ok('Checklist is the default tab: its pane shows, Settings is hidden', visible($('#app')) && $('#pane-settings').hidden &&
       $('#tab-list').getAttribute('aria-selected') === 'true');
  t.ok('the filter panel shows on Checklist', visible($('#fpanel')));
  $('[data-act="panel"]').click();
  $('.fsec-head[data-k="reading"]').click();
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  const countBefore = $('#pprog .pcount').textContent;
  $('#tab-settings').click();
  t.ok('Settings tab opens its pane (T-114, T-121)', visible($('#settings')) && $('#settings').children.length > 0 && $('#pane-list').hidden);
  t.ok('tab state is exposed to assistive tech (aria-selected, roving tabindex)',
       $('#tab-settings').getAttribute('aria-selected') === 'true' && $('#tab-list').getAttribute('aria-selected') === 'false' &&
       $('#tab-settings').tabIndex === 0 && $('#tab-list').tabIndex === -1);
  t.ok('no filter panel on Settings (T-89/T-92 re-expressed: Checklist only, every skin)', !visible($('#fpanel')) && !visible($('#q')));
  $('#tab-list').click();
  t.ok('Checklist pane visible again (T-122)', visible($('#app')) && $('#pane-settings').hidden);
  t.ok('filters survive a round trip through another tab (T-41)', $$('#fchips .chip').some(c => /Mandatory only/.test(c.textContent)) &&
       $('#pprog .pcount').textContent === countBefore);
  $('#tab-settings').click();
  t.ok('the active tab is stored in the one settings store (S-29)', stored(app, 'settings').tab === 'settings');
  const keep = { [ns + 'settings']: app.window.localStorage.getItem(ns + 'settings') };
  app.window.close();
  app = boot(mx.out, { now: NOW, storage: keep });
  d = app.document;
  await wait(20);
  t.ok('the next boot opens on the remembered tab', visible($('#settings')) && $('#tab-settings').getAttribute('aria-selected') === 'true');
  t.ok('…and the checklist behind it still landed collapsed (no rows rendered)', d.querySelectorAll('.row').length === 0);
  t.eq('Settings is sectioned, at least 4 heads (T-11)', $$('#settings .sset > .seth').map(h => h.textContent),
       ['Reading behaviour', 'Display', 'Touch', 'Bulk actions', 'Data', 'Backup']);
  app.window.close();

  // ------------------------------------------- pace controls and readout
  app = boot(mx.out, { now: NOW });
  d = app.document;
  await wait(20);
  $('#tab-settings').click();
  const segVals = act => $$(`#settings [data-act="${act}"]`).map(b => +b.dataset.v);
  const pressed = act => $$(`#settings [data-act="${act}"][aria-pressed="true"]`).map(b => +b.dataset.v);
  t.eq('minutes-per-issue control offers the presets (S-18)', segVals('pace-min'), app.window.PullList.pacePresets.minutes.map(p => p[2]));
  t.eq('issues-per-week control offers the presets', segVals('pace-week'), app.window.PullList.pacePresets.weekly.map(p => p[2]));
  t.ok('the defaults are pressed (15 min, 12 a week)', pressed('pace-min')[0] === 15 && pressed('pace-week')[0] === 12);
  $('#settings [data-act="pace-min"][data-v="25"]').click();
  t.ok('Deep dive is pressed after the tap', pressed('pace-min')[0] === 25 && pressed('pace-min').length === 1);
  t.ok('…and the header moves: 8 comics x 25 + shows 88 + game 1500 = 1788 min', $('#pprog .pleft').dataset.leftMin === '1788');
  $('#settings [data-act="pace-week"][data-v="50"]').focus();
  $('#settings [data-act="pace-week"][data-v="50"]').click();
  const hw = +$('#pprog .pfinish').dataset.weeks;
  t.ok('Marathon: finish-by = 1788 / (50 x 25) weeks', hw === 1788 / 1250, hw);
  const st = stored(app, 'settings');
  t.ok('pace lives in the one settings store', st.pace.minutes === 25 && st.pace.weekly === 50);
  const out = $('#paceOut');
  t.ok('pace readout reads "N left · W weeks at P a week · done Mon YYYY" (F-18)',
       /^\d+ left · \d+ weeks? at 50 a week · done [A-Z][a-z]{2} \d{4} · \+1 untimed$/.test(out.textContent), out.textContent);
  t.ok('readout N = the header\'s remaining count (13 entries, none marked)', +out.querySelector('b').textContent === D.counts.total && D.counts.total === 13,
       out.querySelector('b').textContent);
  t.ok('readout weeks = the header\'s weeks, rounded up', new RegExp('· ' + Math.ceil(hw) + ' weeks? at').test(out.textContent));
  t.ok('readout date = the header\'s finish-by date', out.querySelector('[data-finish]').dataset.finish === $('#pprog .pfinish').dataset.finish);
  t.ok('pace buttons keep keyboard focus across the re-render', d.activeElement && d.activeElement.dataset.act === 'pace-week' && d.activeElement.dataset.v === '50');

  // ------------------------------------------------ progress per format
  const pm = $$('#settings [data-act="pmode"]');
  t.eq('progress mode has 2 options (T-59)', pm.map(b => b.textContent), ['Combined', 'Per format']);
  t.ok('combined by default: no per-format lines', !$('#pprog .pmedia'));
  $('#settings [data-act="pmode"][data-v="medium"]').click();
  app.window.PullList.setPace(15, 12);
  const lines = $$('#pprog .pmed');
  const line = m => lines.find(l => +l.dataset.m === D.media.indexOf(m));
  t.ok('per format: one line per format in the data', lines.length === 3);
  t.ok('per format: comics line = 0 / 8 and 8 x 15 = 120 min left', /0 \/ 8/.test(line('comic').textContent) && line('comic').querySelector('.pmed-left').dataset.leftMin === '120');
  t.ok('per format: shows line = 88 min (22 + 22 + 44)', line('screen').querySelector('.pmed-left').dataset.leftMin === '88');
  t.ok('per format: games line = 1500 min and "+1 untimed"', line('game').querySelector('.pmed-left').dataset.leftMin === '1500' &&
       line('game').querySelector('.puntimed').dataset.untimed === '1');
  t.ok('progress mode is stored', stored(app, 'settings').progressMode === 'medium');
  $('#settings [data-act="pmode"][data-v="combined"]').click();
  t.ok('back to combined: the lines go', !$('#pprog .pmedia'));

  // ----------------------------------------------- jump button (XM-19)
  const next = () => $('.ptools [data-act="next"]');
  t.ok('Next unread button shows by default', !next().hidden);
  $('#settings [data-act="pref"][data-k="showJump"]').click();
  t.ok('switching it off hides the button', next().hidden && stored(app, 'settings').showJump === false);
  $('#settings [data-act="pref"][data-k="showJump"]').click();
  t.ok('switching it on shows it again', !next().hidden);

  // --------------------------------------------- About & legend (F-31)
  t.ok('About shows the title, counts and build', new RegExp(D.counts.total + ' entries').test($('.about').textContent) &&
       $('.about').textContent.includes('build ' + D.build));
  t.eq('legend terms come from the data', $$('.legend dt').map(x => x.textContent), D.legend.map(l => l.term));
  t.eq('maintenance notes come from the data', $$('.maint li').map(x => x.textContent), D.maintenance);
  t.ok('no import button when the data declares no previous version', !$('[data-act="import-legacy"]'));
  t.ok('no runtime errors (settings)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------------------------ refresh reminder
  app = boot(mx.out, { now: NOW });
  d = app.document;
  await wait(20);
  $('#tab-settings').click();
  t.eq('refresh reminder has 4 options including Off (T-60, T-61)', $$('#settings [data-act="refresh"]').map(b => b.textContent),
       ['Monthly', 'Quarterly', 'Yearly', 'Off']);
  t.ok('quarterly by default', $('#settings [data-act="refresh"][aria-pressed="true"]').dataset.v === 'quarter');
  t.ok('first run starts the clock, with no reminder', stored(app, 'settings').refreshSeen === NOW && $('#toast').hidden);
  app.window.close();
  const seen = (every, daysAgo) => ({ [ns + 'settings']: JSON.stringify({ v: 3, refreshEvery: every, refreshSeen: NOW - daysAgo * DAY }) });
  app = boot(mx.out, { now: NOW, storage: seen('quarter', 100) });
  d = app.document;
  await wait(20);
  t.ok('100 days on a quarterly reminder: the toast says so (T-44, interval consumed)', !$('#toast').hidden &&
       /last checked 100 days ago/.test($('#toastMsg').textContent), $('#toastMsg').textContent);
  $('#toastAct').click();
  t.ok('Dismiss resets the clock', stored(app, 'settings').refreshSeen === NOW && $('#toast').hidden);
  app.window.close();
  for (const [every, label] of [['year', 'yearly'], ['off', 'off'], ['month', 'monthly']]) {
    app = boot(mx.out, { now: NOW, storage: seen(every, every === 'month' ? 20 : 100) });
    await wait(20);
    t.ok(`${label}: no reminder before it is due`, app.document.querySelector('#toast').hidden);
    app.window.close();
  }
  app = boot(mx.out, { now: NOW, storage: seen('month', 31) });
  await wait(20);
  t.ok('monthly at 31 days: reminder due', !app.document.querySelector('#toast').hidden);
  app.document.querySelector('#tab-settings').click();
  app.document.querySelector('#settings [data-act="refresh"][data-v="year"]').click();
  t.ok('choosing a new interval restarts the clock', stored(app, 'settings').refreshSeen === NOW && stored(app, 'settings').refreshEvery === 'year');
  app.window.close();

  // ------------------------------------- bookmarks: pinned bar and list
  const bms = ['mixed-hero-1990-5', 'mixed-hero-1990-1'];
  app = boot(mx.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify({ marks: {}, bookmarks: bms }) } });
  d = app.document;
  await wait(20);
  t.eq('pinned bar lists bookmarks sorted as displayed (XM-4)', $$('#pinchips .pin').map(c => c.dataset.id), ['mixed-hero-1990-1', 'mixed-hero-1990-5']);
  t.ok('pinned bar is visible on the Checklist', visible($('#pinchips')));
  $('#pinchips .pin[data-id="mixed-hero-1990-5"]').click();
  t.ok('a pinned chip jumps to its row (era opened, row rendered)', !!$('.row[data-id="mixed-hero-1990-5"]') && visible($('.row[data-id="mixed-hero-1990-5"]')));
  $('#tab-settings').click();
  t.eq('Settings lists every bookmark, not a jump to the first one (F-28, T-49)', $$('.bmlist [data-act="bm-jump"]').map(b => b.dataset.id),
       ['mixed-hero-1990-1', 'mixed-hero-1990-5']);
  $('.bmlist [data-act="bm-jump"][data-id="mixed-hero-1990-1"]').click();
  t.ok('Jump from Settings switches to the Checklist and opens the row (F-29)', !$('#pane-list').hidden &&
       visible($('.row[data-id="mixed-hero-1990-1"]')) && $('#tab-list').getAttribute('aria-selected') === 'true');
  $('#tab-settings').click();
  $('.bmlist [data-act="bm-remove"][data-id="mixed-hero-1990-5"]').click();
  t.ok('Remove takes it off the list and the pinned bar', $$('.bmlist [data-act="bm-jump"]').length === 1 && $$('#pinchips .pin').length === 1);
  t.ok('…and un-stars its row', $('.row[data-id="mixed-hero-1990-5"] .bm').getAttribute('aria-pressed') === 'false');
  t.eq('…and is saved', stored(app, 'progress').bookmarks, ['mixed-hero-1990-1']);
  $('#tab-list').click();
  $('.row[data-id="mixed-hero-1990-1"] .bm').click();
  t.ok('un-starring the last bookmark hides the pinned bar', $('#pinbar').hidden);
  $('.row[data-id="mixed-hero-1990-1"] .bm').click();
  t.ok('starring a row shows it in the pinned bar again', !$('#pinbar').hidden && $$('#pinchips .pin').length === 1);
  app.window.close();

  // ----------------------------- Clear all progress: confirm + undo (F-32)
  const marks = { 'mixed-hero-1990-1': 'read', 'mixed-hero-1990-2': 'reading', 'mixed-quest-1990': 'skip' };
  const before = { marks, bookmarks: ['mixed-hero-1990-3'] };
  const revs = { opening: { r: 4, t: 'Great start.' } };
  app = boot(mx.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify(before), [ns + 'reviews']: JSON.stringify(revs) } });
  d = app.document;
  await wait(20);
  const readCount = () => $('#pprog .pcount').textContent;
  const startCount = readCount();
  $('#tab-settings').click();
  $('[data-act="clear-ask"]').click();
  t.ok('Clear all asks first, in the page (no window.confirm)', !!$('.confirm [data-act="clear-yes"]') && !!$('.confirm [data-act="clear-no"]'));
  $('[data-act="clear-no"]').click();
  t.ok('Cancel leaves everything as it was', !$('.confirm') && stored(app, 'progress').marks['mixed-hero-1990-1'] === 'read');
  $('[data-act="clear-ask"]').click();
  $('[data-act="clear-yes"]').click();
  const cleared = stored(app, 'progress');
  t.ok('Clear all removes every mark', Object.keys(cleared.marks).length === 0 && /^0 \//.test(readCount()));
  t.ok('…keeps bookmarks and reviews', JSON.stringify(cleared.bookmarks) === JSON.stringify(before.bookmarks) &&
       JSON.stringify(stored(app, 'reviews')) === JSON.stringify(revs));
  t.ok('…and offers Undo', !$('#toast').hidden && $('#toastAct').textContent === 'Undo');
  $('#toastAct').click();
  t.eq('Undo restores the previous progress exactly', stored(app, 'progress'), before);
  t.ok('…and the figures come back', readCount() === startCount);
  t.ok('no runtime errors (clear/undo)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------ Import from previous version (basic)
  const b = basic(), Db = loadData(b.out), nsb = Db.franchise.key + ':v3:', leg = Db.franchise.storage.legacy.prefix;
  const legacyId = Db.ids.find(id => /^\d{9}$/.test(id));
  app = boot(b.out, { now: NOW, storage: { [nsb + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }),
                                           [leg + 'progress']: JSON.stringify({ p: { [legacyId]: 'read' }, b: [] }) } });
  d = app.document;
  await wait(20);
  const bootListeners = app.listeners.length;
  t.ok('already migrated: nothing imported at boot', !JSON.parse(app.window.localStorage.getItem(nsb + 'progress') || '{"marks":{}}').marks[legacyId]);
  $('#tab-settings').click();
  t.ok('Settings offers "Import from previous version" when the data declares one', !!$('[data-act="import-legacy"]'));
  $('[data-act="import-legacy"]').click();
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  t.ok('…and it brings the old marks over', JSON.parse(app.window.localStorage.getItem(nsb + 'progress')).marks[legacyId] === 'read');
  t.ok('…reporting what came over', /Brought over 1 mark/.test($('#toastMsg').textContent), $('#toastMsg').textContent);
  $('[data-act="import-legacy"]').click();
  t.ok('a second run says there is nothing new', /Nothing new/.test($('#toastMsg').textContent));
  t.ok('tabs and Settings add no listeners (all delegated)', app.listeners.length === bootListeners, app.listeners.join(','));
  t.ok('no runtime errors (import)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ----------------------- comics-only data: no progress-mode control
  const rootB = build(path.join(ROOT, 'dataset.json'), { label: 'tabs-root' });
  app = boot(rootB.out, { now: NOW });
  await wait(20);
  app.document.querySelector('#tab-settings').click();
  t.ok('a single-format tracker shows no progress-mode control', !app.document.querySelector('[data-act="pmode"]'));
  app.window.close();
};
