/* One namespaced store, and the read-only legacy migration (John's change 2). */
'use strict';
const path = require('path');
const { FIX, build, loadData, boot, wait, basic } = require('../lib/helpers');

const OLD = 'fixture-old:v1:';
const V2_PROGRESS = JSON.stringify({ p: { '198706004': 'read', 'fixture-hero-1980-1': 'reading', 'fixture-hero-1980-2': 'skip',
  'fixture-hero-1980-3': 'read', 'no-such-issue-1999-1': 'read' }, b: ['198706004', 'gone-1999-1'] });
const V2_REVIEWS = JSON.stringify({ '198706004': { r: 4, t: 'Great tie-in.' }, 'fixture-hero-1980-1': { r: 3, t: 'Slow start.' },
  'fixture-hero-1980-2': { r: 5, t: 'Better.' }, 'gone-1999-1': { r: 2, t: 'An issue that no longer exists.' } });
const UNRELATED = { 'other-tracker:v1:progress': '{"p":{"1":"read"}}' };

function snapshot(w) { const o = {}; for (const k of Object.keys(w.localStorage)) o[k] = w.localStorage.getItem(k); return o; }

module.exports = async function (t) {
  const b = basic();
  const D = loadData(b.out);
  const ns = D.franchise.key + ':v3:';
  const seed = Object.assign({ [OLD + 'progress']: V2_PROGRESS, [OLD + 'reviews']: V2_REVIEWS }, UNRELATED);
  const app = boot(b.out, { storage: seed });
  const d = app.document;
  await wait(20);
  t.ok('boots clean with legacy data present', app.errors.length === 0, app.errors.join(' | '));
  const w = app.window;
  w.dispatchEvent(new w.Event('pagehide'));
  const after = snapshot(w);

  // ---- strictly read-only ----
  t.ok('old progress key is byte-identical after migration', after[OLD + 'progress'] === V2_PROGRESS);
  t.ok('old reviews key is byte-identical after migration', after[OLD + 'reviews'] === V2_REVIEWS);
  t.ok('old keys are not deleted or added to', Object.keys(after).filter(k => k.startsWith(OLD)).sort().join() === [OLD + 'progress', OLD + 'reviews'].join());
  t.ok('another tracker\'s keys are untouched', after['other-tracker:v1:progress'] === UNRELATED['other-tracker:v1:progress']);

  // ---- copied into the one v3 store ----
  const prog = JSON.parse(after[ns + 'progress']);
  t.eq('marks copied for every id that exists', Object.keys(prog.marks).sort(), ['198706004', 'fixture-hero-1980-1', 'fixture-hero-1980-2', 'fixture-hero-1980-3']);
  t.ok('mark states carried over exactly', prog.marks['198706004'] === 'read' && prog.marks['fixture-hero-1980-1'] === 'reading' && prog.marks['fixture-hero-1980-2'] === 'skip');
  t.eq('bookmarks copied (unknown ids skipped)', prog.bookmarks, ['198706004']);
  const rv = JSON.parse(after[ns + 'issue-reviews']);
  t.eq('reviews come over per issue, exactly as the old tracker kept them (John, 8 Oct)', rv,
       { '198706004': { r: 4, t: 'Great tie-in.' }, 'fixture-hero-1980-1': { r: 3, t: 'Slow start.' }, 'fixture-hero-1980-2': { r: 5, t: 'Better.' } });
  t.ok('…two reviews in one arc stay two reviews, nothing merged', D.issues[D.ids.indexOf('fixture-hero-1980-1')][2] === D.issues[D.ids.indexOf('fixture-hero-1980-2')][2]);
  t.ok('…and no per-arc store is written', !(ns + 'reviews' in after));
  const um = JSON.parse(after[ns + 'legacy-unmatched'] || 'null');
  t.ok('an unmatchable review is kept, not dropped', !!um && um.reviews['gone-1999-1'] && um.reviews['gone-1999-1'].t === 'An issue that no longer exists.');
  const toast = d.querySelector('#toastMsg').textContent;
  t.ok('the toast reports what came over', /Brought over 4 marks, 1 bookmark, 3 reviews/.test(toast), toast);
  t.ok('the toast reports the unmatched review', /1 review could not be matched/.test(toast), toast);
  t.ok('the header reflects the migrated marks', /^2 \//.test(d.querySelector('#pprog .pcount').textContent));
  const settings = JSON.parse(after[ns + 'settings']);
  t.ok('a migrated flag is stored in the v3 settings', settings.migrated && settings.migrated.format === 'v2' && settings.migrated.result.marks === 4);

  // ---- one store, namespaced ----
  const v3keys = Object.keys(after).filter(k => k.startsWith(ns)).map(k => k.slice(ns.length)).sort();
  t.eq('the v3 store is progress, issue reviews, settings (+ kept legacy leftovers)', v3keys, ['issue-reviews', 'legacy-unmatched', 'progress', 'settings']);
  t.ok('settings, filters, pace and panel state live in ONE settings object (T-46 re-expressed)',
       settings.filters && settings.pace && Array.isArray(settings.panelOpen) && settings.order);
  t.ok('pace defaults: 15 min/issue, 12 issues/week', settings.pace.minutes === 15 && settings.pace.weekly === 12);
  app.window.close();

  // ---- runs once ----
  const v3only = {};
  for (const [k, v] of Object.entries(after)) v3only[k] = v;
  const p2 = JSON.parse(v3only[ns + 'progress']);
  delete p2.marks['fixture-hero-1980-3'];                  // the reader unmarks it in v3
  v3only[ns + 'progress'] = JSON.stringify(p2);
  const app2 = boot(b.out, { storage: v3only });
  await wait(20);
  app2.window.dispatchEvent(new app2.window.Event('pagehide'));
  const again = JSON.parse(app2.window.localStorage.getItem(ns + 'progress'));
  t.ok('a second boot does not re-run the migration (an unmarked issue stays unmarked)', !again.marks['fixture-hero-1980-3']);
  t.ok('no migration toast on the second boot', app2.document.querySelector('#toast').hidden);

  // ---- the re-run (Settings, session 3) fills gaps and never overwrites newer v3 marks ----
  const p3 = JSON.parse(app2.window.localStorage.getItem(ns + 'progress'));
  t.ok('setup: the v3 store has a newer mark for 198706004', p3.marks['198706004'] === 'read');
  app2.window.close();
  p3.marks['198706004'] = 'skip';                           // newer than the old 'read'
  const r3 = JSON.parse(v3only[ns + 'issue-reviews']);
  r3['fixture-hero-1980-1'] = { r: 1, t: 'Changed my mind.' };      // edited in v3
  delete r3['198706004'];                                         // deleted in v3: the re-run fills it again
  const s4 = Object.assign({}, v3only, { [ns + 'progress']: JSON.stringify(p3), [ns + 'issue-reviews']: JSON.stringify(r3) });
  const app3 = boot(b.out, { storage: s4 });
  await wait(20);
  const res = app3.window.PullList.importLegacy();
  app3.window.dispatchEvent(new app3.window.Event('pagehide'));
  const p4 = JSON.parse(app3.window.localStorage.getItem(ns + 'progress'));
  t.ok('re-run never overwrites a newer v3 mark', p4.marks['198706004'] === 'skip');
  t.ok('re-run fills the gap left by a missing v3 mark', p4.marks['fixture-hero-1980-3'] === 'read' && res.marks === 1);
  t.ok('re-run does not duplicate bookmarks', p4.bookmarks.filter(x => x === '198706004').length === 1);
  t.ok('re-run leaves the old keys byte-identical', app3.window.localStorage.getItem(OLD + 'progress') === V2_PROGRESS &&
       app3.window.localStorage.getItem(OLD + 'reviews') === V2_REVIEWS);
  const rv4 = JSON.parse(app3.window.localStorage.getItem(ns + 'issue-reviews'));
  t.eq('re-run never overwrites an existing v3 review, and fills the gaps', [rv4['fixture-hero-1980-1'], rv4['198706004'], res.reviews],
       [{ r: 1, t: 'Changed my mind.' }, { r: 4, t: 'Great tie-in.' }, 1]);
  app3.window.close();

  // ---- the oldest v2 shape (a bare {key: state} map) ----
  const app5 = boot(b.out, { storage: { [OLD + 'progress']: '{"fixture-hero-1980-5":"read"}' } });
  await wait(20);
  app5.window.dispatchEvent(new app5.window.Event('pagehide'));
  t.ok('the oldest v2 shape is read too', JSON.parse(app5.window.localStorage.getItem(ns + 'progress')).marks['fixture-hero-1980-5'] === 'read');
  app5.window.close();

  // ---- no legacy config: nothing is read (the minimal fixture has none) ----
  const mb = build(path.join(FIX, 'minimal', 'dataset.json'), { label: 'storage-minimal' }), mk = loadData(mb.out).franchise.key + ':v3:';
  const plain = boot(mb.out, { storage: seed });
  await wait(20);
  plain.window.dispatchEvent(new plain.window.Event('pagehide'));
  const rs = JSON.parse(plain.window.localStorage.getItem(mk + 'settings'));
  t.ok('without storage.legacy no migration runs', !rs.migrated && plain.window.localStorage.getItem(mk + 'progress') === null);
  plain.window.close();
};
