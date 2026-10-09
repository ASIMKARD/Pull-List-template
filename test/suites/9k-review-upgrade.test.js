/* The one-time upgrade from per-arc reviews (builds before 8 Oct) to per-issue
   reviews, as John decided on 8 Oct. Those builds' migration merged each old
   per-issue review into its arc (best stars, texts joined in key order). The
   old keys were never written, so v9 computes that merge again and compares:
   - equal: made by the migration, untouched → the old originals, exactly;
   - no old reviews behind it: written by the person → the arc's first issue;
   - different: migrated, then edited → the originals restored, and the edit
     kept on the arc's first issue (after any original there; its stars);
   - gone: deleted → stays deleted.
   Neither the old per-issue keys nor the per-arc store is ever written. */
'use strict';
const path = require('path');
const { FIX, build, loadData, boot, wait, basic } = require('../lib/helpers');

const OLD = 'fixture-old:v1:';
const canon = o => JSON.stringify(Object.keys(o).sort().reduce((m, k) => { m[k] = o[k]; return m; }, {}));

/* The per-arc merge as shipped before 8 Oct (app.js importLegacy), step for
   step: Object.keys order of the parsed old reviews, best stars, texts joined. */
function shippedMerge(D, oldReviewsJson) {
  const old = JSON.parse(oldReviewsJson), merged = {};
  for (const k of Object.keys(old)) {
    const i = D.ids.indexOf(String(k));
    if (i < 0) continue;
    const arcId = D.arcs[D.issues[i][2]].id, cur = merged[arcId] || { r: 0, t: '' }, r = old[k] || {};
    cur.r = Math.max(cur.r, +r.r || 0);
    cur.t = [cur.t, r.t || ''].filter(Boolean).join('\n\n');
    merged[arcId] = cur;
  }
  return merged;
}

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const V1_REVIEWS = JSON.stringify({
    '198706004': { r: 4, t: 'Great tie-in.' },                         // kestrel-run: left as migrated
    'fixture-hero-1980-0': { r: 3, t: 'Opening.' },                    // origins: migrated, then edited in v8
    'fixture-hero-1980-1': { r: 3, t: 'Slow start.' },
    'fixture-hero-1980-2': { r: 5, t: 'Better.' },
    'orrin-1983-1': { r: 2, t: 'Meh.' }                                // orrin-mini: migrated, then deleted in v8
  });
  const merged = shippedMerge(D, V1_REVIEWS);
  t.eq('setup: the shipped merge gives one review per arc', Object.keys(merged).sort(), ['kestrel-run', 'origins', 'orrin-mini']);
  const ARC_STORE = JSON.stringify({
    'kestrel-run': merged['kestrel-run'],                               // untouched
    origins: { r: 2, t: merged.origins.t + ' Edited in v8.' },          // edited
    mirror: { r: 4, t: 'Written in v8.' },                              // no old reviews behind it
    toons: { r: 0, t: '' },                                             // empty: nothing
    'arc-since-removed': { r: 3, t: 'An arc this list no longer has.' } // kept with the unmatched ones
  });
  const seed = {
    [OLD + 'progress']: JSON.stringify({ p: { '198706004': 'read' }, b: [] }), [OLD + 'reviews']: V1_REVIEWS,
    [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2', at: 1 } }),
    [ns + 'progress']: JSON.stringify({ marks: { '198706004': 'read' }, bookmarks: [] }),
    [ns + 'reviews']: ARC_STORE
  };
  const app = boot(b.out, { storage: seed });
  await wait(20);
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const ls = app.window.localStorage, got = JSON.parse(ls.getItem(ns + 'issue-reviews') || 'null');
  const firstOf = arcId => { const a = D.arcs.findIndex(x => x.id === arcId); return D.ids[D.issues.findIndex((r, i) => r[2] === a && !(r[6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)))]; };
  t.ok('setup: the edited arc\'s first issue has an original of its own (the collision case)', firstOf('origins') === 'fixture-hero-1980-0');
  t.eq('upgraded per issue, as decided (8 Oct)', got && canon(got), canon({
    '198706004': { r: 4, t: 'Great tie-in.' },
    'fixture-hero-1980-0': { r: 2, t: 'Opening.\n\n' + merged.origins.t + ' Edited in v8.' },
    'fixture-hero-1980-1': { r: 3, t: 'Slow start.' },
    'fixture-hero-1980-2': { r: 5, t: 'Better.' },
    [firstOf('mirror')]: { r: 4, t: 'Written in v8.' }
  }));
  t.eq('untouched migrated review → the originals, exactly, and nothing on the arc\'s first issue', [got['198706004'], got[firstOf('kestrel-run')]],
       [{ r: 4, t: 'Great tie-in.' }, undefined]);
  t.ok('migrated then edited → every original restored, and the edit kept on the first issue after its own original', got['fixture-hero-1980-1'].t === 'Slow start.' &&
       got['fixture-hero-1980-0'].r === 2 && /^Opening\.\n\n/.test(got['fixture-hero-1980-0'].t) && /Edited in v8\.$/.test(got['fixture-hero-1980-0'].t));
  t.ok('migrated then deleted → stays deleted', !got['orrin-1983-1']);
  t.ok('written in v8 → the arc\'s first issue', got[firstOf('mirror')] && got[firstOf('mirror')].t === 'Written in v8.');
  const um = JSON.parse(ls.getItem(ns + 'legacy-unmatched') || '{"reviews":{}}');
  t.ok('a review on an arc the list no longer has is kept with the unmatched ones', um.reviews['arc-since-removed'] && um.reviews['arc-since-removed'].t === 'An arc this list no longer has.');
  t.ok('the old per-issue keys and the per-arc store are byte for byte unchanged', ls.getItem(OLD + 'reviews') === V1_REVIEWS && ls.getItem(ns + 'reviews') === ARC_STORE);
  const st = JSON.parse(ls.getItem(ns + 'settings'));
  t.eq('the upgrade is recorded in settings', st.reviewsUpgraded && st.reviewsUpgraded.result, { restored: 4, moved: 1, edited: 1, deleted: 1, kept: 1 });
  t.ok('…and reported once', /Reviews now belong to issues: 4 brought back exactly as they were before, 2 moved to the first issue of their arcs\./.test(app.document.querySelector('#toastMsg').textContent),
       app.document.querySelector('#toastMsg').textContent);
  t.ok('no runtime errors (upgrade)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- once only: a review deleted after the upgrade stays deleted
  const after = {};
  for (const k of Object.keys(seed)) after[k] = seed[k];
  const mine = Object.assign({}, got);
  delete mine['fixture-hero-1980-1'];
  Object.assign(after, { [ns + 'issue-reviews']: JSON.stringify(mine), [ns + 'settings']: ls.getItem(ns + 'settings') });
  const app2 = boot(b.out, { storage: after });
  await wait(20);
  app2.window.dispatchEvent(new app2.window.Event('pagehide'));
  t.eq('it runs once: a later boot changes nothing (a deleted review stays deleted)', canon(JSON.parse(app2.window.localStorage.getItem(ns + 'issue-reviews'))), canon(mine));
  t.ok('…and says nothing', app2.document.querySelector('#toast').hidden);
  app2.window.close();

  // ---- every review the shipped merge touched comes back exactly
  const many = {}, ids = D.ids.filter((id, i) => !(D.issues[i][6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)));
  ids.forEach((id, k) => { if (k % 3 !== 1) many[id] = { r: (k % 5) + 1, t: k % 4 ? 'Note ' + k + ' on ' + id + '.' : '' }; });
  const manyJson = JSON.stringify(many), mergedAll = shippedMerge(D, manyJson);
  const app3 = boot(b.out, { storage: { [OLD + 'reviews']: manyJson, [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }),
                                        [ns + 'reviews']: JSON.stringify(mergedAll) } });
  await wait(20);
  app3.window.dispatchEvent(new app3.window.Event('pagehide'));
  const back = JSON.parse(app3.window.localStorage.getItem(ns + 'issue-reviews'));
  t.eq('a whole list left as migrated (' + Object.keys(many).length + ' reviews in ' + Object.keys(mergedAll).length + ' arcs) comes back exactly, issue by issue',
       canon(back), canon(many));
  app3.window.close();

  // ---- a tracker with no old version: its per-arc reviews were all written by people
  const mx = build(path.join(FIX, 'mixed', 'dataset.json'), { label: 'rvup-mixed' }), MD = loadData(mx.out), mns = MD.franchise.key + ':v3:';
  const arcA = MD.arcs[0].id, arcB = MD.arcs[MD.arcs.length - 1].id;
  const app4 = boot(mx.out, { storage: { [mns + 'reviews']: JSON.stringify({ [arcA]: { r: 5, t: 'Loved it.' }, [arcB]: { r: 1, t: '' } }) } });
  await wait(20);
  app4.window.dispatchEvent(new app4.window.Event('pagehide'));
  const mfirst = arcId => { const a = MD.arcs.findIndex(x => x.id === arcId); return MD.ids[MD.issues.findIndex((r, i) => r[2] === a && !(r[6] & (MD.flagBits.GAPNOTE | MD.flagBits.RENUM)))]; };
  t.eq('no old version: every arc review moves to its arc\'s first issue', canon(JSON.parse(app4.window.localStorage.getItem(mns + 'issue-reviews'))),
       canon({ [mfirst(arcA)]: { r: 5, t: 'Loved it.' }, [mfirst(arcB)]: { r: 1, t: '' } }));
  app4.window.close();

  // ---- a fresh tracker: nothing to upgrade, nothing said
  const app5 = boot(b.out, { storage: { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) } });
  await wait(20);
  app5.window.dispatchEvent(new app5.window.Event('pagehide'));
  t.ok('a fresh tracker starts an empty per-issue store and records no upgrade', app5.window.localStorage.getItem(ns + 'issue-reviews') === '{}' &&
       !JSON.parse(app5.window.localStorage.getItem(ns + 'settings')).reviewsUpgraded && app5.document.querySelector('#toast').hidden);
  app5.window.close();
};
