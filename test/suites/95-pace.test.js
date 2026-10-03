/* Pace (decided 2 Oct; per-format durations 1 Oct): time left sums each
   remaining row's own minutes (comics at minutes per issue, shows and games at
   their own duration); finish-by = minutes left / (issues per week x minutes
   per issue), cumulative on the header and top-level banners. */
'use strict';
const { loadData, boot, wait, basic, noPeriods } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);              // fixed clock: 1 Jan 2026
const DAY = 864e5;
const iso = weeksFloat => new Date(NOW + weeksFloat * 7 * DAY).toISOString().slice(0, 10);
const timeText = mins => mins < 60 ? mins + 'm' : (mins / 60 < 24 ? Math.round(mins / 60) + 'h' : (Math.round(mins / 60 / 24 * 10) / 10) + 'd');

function goalStats(D, pred, marks) {
  let total = 0, read = 0, skip = 0, comics = 0, fixed = 0;
  D.ids.forEach((id, i) => {
    if (D.issueCompleteOnly[i] || (D.issues[i][6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)) || !pred(i)) return;
    total++;
    const s = (marks || {})[id];
    if (s === 'read') read++; else if (s === 'skip') skip++;
    else if (D.issueDuration[i] === 0) comics++; else if (D.issueDuration[i] > 0) fixed += D.issueDuration[i];
  });
  return { total, read, skip, left: total - read - skip, mins: m => comics * m + fixed };
}

module.exports = async function (t) {
  const b = basic();
  const D = loadData(b.out);
  const ns = D.franchise.key + ':v3:';
  const bandOf = e => D.periods.findIndex(p => p.eras.includes(e));

  // ---- defaults: 15 min/issue, 12 issues/week ----
  let app = boot(b.out, { now: NOW });
  let d = app.document;
  await wait(20);
  t.eq('minutes-per-issue presets (Quick / Average / Deep dive)', app.window.PullList.pacePresets.minutes.map(p => p[1] + ' ' + p[2]),
       ['Quick 8', 'Average 15', 'Deep dive 25']);
  t.eq('issues-per-week presets', app.window.PullList.pacePresets.weekly.map(p => p[2]), [5, 12, 25, 50]);

  const all = goalStats(D, () => true);
  const hLeft = d.querySelector('#pprog .pleft'), hFin = d.querySelector('#pprog .pfinish');
  t.ok('basic is fully timed: a game and a show carry their own minutes', D.issueDuration.some(x => x > 0) && !D.issueDuration.includes(-1));
  t.ok('header time left = each remaining row\'s own minutes (comics x 15)', +hLeft.dataset.leftMin === all.mins(15), hLeft.dataset.leftMin + ' vs ' + all.mins(15));
  t.ok('header time left text', hLeft.textContent === timeText(all.mins(15)) + ' left', hLeft.textContent);
  t.ok('header finish-by = minutes left / (12 x 15) per week', hFin.dataset.finish === iso(all.mins(15) / 180), hFin.dataset.finish + ' vs ' + iso(all.mins(15) / 180));
  t.ok('finish-by reads as a month and year', /^finish by [A-Z][a-z]{2} \d{4}$/.test(hFin.textContent), hFin.textContent);

  // per band, cumulative in reading order
  const bandLeft = D.periods.map((p, bi) => goalStats(D, i => bandOf(D.issueEra[i]) === bi).mins(15));
  let cum = 0;
  D.periods.forEach((p, bi) => {
    cum += bandLeft[bi];
    const f = d.querySelector(`.band[data-b="${bi}"] > .band-head .bfinish`);
    t.ok(`band ${bi}: finish-by counts this band plus every band before it`, f && f.dataset.finish === iso(cum / 180),
         (f && f.dataset.finish) + ' vs ' + iso(cum / 180));
    const l = d.querySelector(`.band[data-b="${bi}"] > .band-head .bleft`);
    t.ok(`band ${bi}: time left is this band only`, +l.dataset.leftMin === bandLeft[bi]);
  });
  t.ok('the last band\'s finish-by equals the header\'s', d.querySelector(`.band[data-b="${D.periods.length - 1}"] .bfinish`).dataset.finish === hFin.dataset.finish);
  D.eras.forEach((e, ei) => {
    const l = d.querySelector(`.era[data-e="${ei}"] > .era-head .bleft`);
    t.ok(`era ${e.id}: time left on its banner`, +l.dataset.leftMin === goalStats(D, i => D.issueEra[i] === ei).mins(15));
  });
  app.window.close();

  // ---- a finished band shows a tick; later bands count only what is left ----
  const marks = {};
  D.ids.forEach((id, i) => { if (bandOf(D.issueEra[i]) === 0 && !D.issueCompleteOnly[i]) marks[id] = 'read'; });
  marks['fixture-hero-1980-21'] = 'skip';                   // a skip in band 1 leaves its goal
  app = boot(b.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify({ marks, bookmarks: [] }) } });
  d = app.document;
  await wait(20);
  t.ok('a completed band shows ✓ instead of a date', !!d.querySelector('.band[data-b="0"] > .band-head .bdone') &&
       !d.querySelector('.band[data-b="0"] > .band-head .bfinish'));
  const b1 = goalStats(D, i => bandOf(D.issueEra[i]) === 1, marks);
  t.ok('a skipped issue is not counted as remaining', b1.skip === 1);
  t.ok('next band\'s finish-by counts only unread, non-skipped issues', d.querySelector('.band[data-b="1"] .bfinish').dataset.finish === iso(b1.mins(15) / 180));
  t.ok('band shows "n skipped" and a goal without them', new RegExp('0 / ' + (b1.total - 1) + ' read · 1 skipped').test(d.querySelector('.band[data-b="1"] .bcount').textContent));

  // ---- changing the pace moves both figures ----
  app.window.PullList.setPace(25, 5);
  const all2 = goalStats(D, () => true, marks);
  t.ok('Deep dive (25 min) changes time left (the comics part only)', +d.querySelector('#pprog .pleft').dataset.leftMin === all2.mins(25));
  t.ok('5 per week changes finish-by (weekly minutes = 5 x 25)', d.querySelector('#pprog .pfinish').dataset.finish === iso(all2.mins(25) / 125));
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const st = JSON.parse(app.window.localStorage.getItem(ns + 'settings'));
  t.ok('pace is stored in the one settings store', st.pace.minutes === 25 && st.pace.weekly === 5);
  app.window.close();

  // ---- everything read: header says caught up ----
  const allRead = {};
  D.ids.forEach((id, i) => { if (!D.issueCompleteOnly[i]) allRead[id] = 'read'; });
  app = boot(b.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify({ marks: allRead, bookmarks: [] }) } });
  await wait(20);
  t.ok('all read: header shows "All caught up ✓"', /All caught up/.test(app.document.querySelector('#pprog').textContent) &&
       !app.document.querySelector('#pprog .pfinish'));
  t.ok('all read: every band shows ✓', app.document.querySelectorAll('.band-head .bdone').length === D.periods.length);
  app.window.close();

  // ---- no bands: eras are the top-level banners, cumulative too ----
  const np = noPeriods();
  const Dn = loadData(np.out);
  app = boot(np.out, { now: NOW });
  await wait(20);
  let c2 = 0, ok = true;
  Dn.eras.forEach((e, ei) => {
    c2 += goalStats(Dn, i => Dn.issueEra[i] === ei).mins(15);
    const f = app.document.querySelector(`#app > .era[data-e="${ei}"] .bfinish`);
    if (!f || f.dataset.finish !== iso(c2 / 180)) ok = false;
  });
  t.ok('no bands: each era banner\'s finish-by is cumulative', ok);

  // ---- formatting ----
  t.ok('time formats: minutes under an hour, hours under a day, else days',
       timeText(45) === '45m' && timeText(120) === '2h' && timeText(60 * 30) === '1.3d');
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
