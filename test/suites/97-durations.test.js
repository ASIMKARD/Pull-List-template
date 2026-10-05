/* Per-format durations (decided 1 Oct; untimed rows decided 3 Oct).
   - Comics are one issue each at the minutes-per-issue setting. Shows take the
     dataset's per-medium default unless a row overrides it; games carry their
     own duration. A non-comic row with no duration warns at build time, adds
     nothing to the figures and shows as "+N untimed".
   - Time left sums each remaining row's own minutes.
   - Finish-by: weekly minutes = issues per week x minutes per issue; weeks
     left = minutes left / weekly minutes. For comics-only data this must give
     EXACTLY the session-2 figures, proved arithmetically and on the real DOM. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, build, loadData, readJSON, writeJSON, copyFixture, boot, wait, tmpdir, stress, mixed } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1), DAY = 864e5;
const MINUTES = [8, 15, 25], WEEKLY = [5, 12, 25, 50];
const dateOf = weeks => new Date(NOW + weeks * 7 * DAY);
const isoOf = weeks => dateOf(weeks).toISOString().slice(0, 10);
const textOf = weeks => dateOf(weeks).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const timeText = mins => mins < 60 ? mins + 'm' : (mins / 60 < 24 ? Math.round(mins / 60) + 'h' : (Math.round(mins / 60 / 24 * 10) / 10) + 'd');

/* Per unit (whole tracker, each era, each band): remaining rows split into
   comics (timed by the setting), fixed minutes (shows, games) and untimed. */
function tally(D, marks, pred) {
  const one = () => ({ total: 0, read: 0, skip: 0, comics: 0, fixed: 0, untimed: 0 });
  const all = one(), era = D.eras.map(one), band = D.periods.map(one);
  D.ids.forEach((id, i) => {
    if (D.issueCompleteOnly[i] || (D.issues[i][6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM)) || !(pred || (() => true))(i)) return;
    const s = (marks || {})[id], du = D.issueDuration[i], e = D.issueEra[i];
    const b = D.periods.findIndex(p => p.eras.includes(e));
    [all, era[e], b >= 0 ? band[b] : null].forEach(x => {
      if (!x) return;
      x.total++;
      if (s === 'read') x.read++; else if (s === 'skip') x.skip++;
      else if (du === 0) x.comics++; else if (du > 0) x.fixed += du; else x.untimed++;
    });
  });
  return { all, era, band };
}
const left = x => x.total - x.read - x.skip;

/* Read every figure off the real DOM. */
function readFigures(doc, D) {
  const pick = (head, p) => {
    if (!head) return null;
    const l = head.querySelector('.' + p + 'left'), f = head.querySelector('.' + p + 'finish'), u = head.querySelector('.' + p + 'untimed');
    return { left: l ? +l.dataset.leftMin : null, leftText: l ? l.textContent : null,
             weeks: f ? f.dataset.weeks : null, finish: f ? f.dataset.finish : null, finishText: f ? f.textContent : null,
             untimed: u ? +u.dataset.untimed : 0 };
  };
  return {
    header: pick(doc.querySelector('#pprog'), 'p'),
    bands: D.periods.map((p, b) => pick(doc.querySelector(`.band[data-b="${b}"] > .band-head`), 'b')),
    eras: D.eras.map((e, ei) => pick(doc.querySelector(`.era[data-e="${ei}"] > .era-head`), 'b'))
  };
}

/* The session-2 formulas, kept verbatim as the oracle for comics-only data:
   time left = remaining x minutes per issue; finish-by = cumulative remaining
   / issues per week, top-level units only. `weeks` is compared as the full
   double (data-weeks), so "exactly" means bit-identical, not just the same day. */
function oldFigures(D, T, m, w) {
  const unit = (x, cumRemaining) => {
    if (left(x) === 0) return { left: null, leftText: null, weeks: null, finish: null, finishText: null, untimed: 0 };
    return { left: left(x) * m, leftText: timeText(left(x) * m) + ' left',
             weeks: cumRemaining == null ? null : String(cumRemaining / w),
             finish: cumRemaining == null ? null : isoOf(cumRemaining / w),
             finishText: cumRemaining == null ? null : 'finish by ' + textOf(cumRemaining / w), untimed: 0 };
  };
  const bands = D.periods.length > 0;
  let cum = 0;
  const top = (bands ? T.band : T.era).map(x => { cum += left(x); return unit(x, cum); });
  return {
    header: unit(T.all, left(T.all)),
    bands: bands ? top : [],
    eras: bands ? T.era.map(x => unit(x, null)) : top
  };
}

/* The new model: own minutes; finish = cumulative minutes / (w x m). */
function newFigures(D, T, m, w) {
  const mins = x => x.comics * m + x.fixed;
  const unit = (x, cumMins) => {
    if (left(x) === 0) return { left: null, leftText: null, weeks: null, finish: null, finishText: null, untimed: 0 };
    const onlyUntimed = left(x) === x.untimed;
    return { left: onlyUntimed ? null : mins(x), leftText: onlyUntimed ? null : timeText(mins(x)) + ' left',
             weeks: cumMins == null ? null : String(cumMins / (w * m)),
             finish: cumMins == null ? null : isoOf(cumMins / (w * m)),
             finishText: cumMins == null ? null : 'finish by ' + textOf(cumMins / (w * m)), untimed: x.untimed };
  };
  const bands = D.periods.length > 0;
  let cum = 0;
  const top = (bands ? T.band : T.era).map(x => { cum += mins(x); return unit(x, cum); });
  return { header: unit(T.all, mins(T.all)), bands: bands ? top : [], eras: bands ? T.era.map(x => unit(x, null)) : top };
}

/* Comics-only copies of basic and no-periods: the game and the show removed. */
function comicsOnlyFixtures() {
  const root = tmpdir('comics-only');
  fs.cpSync(path.join(FIX, 'basic'), path.join(root, 'basic'), { recursive: true });
  fs.cpSync(path.join(FIX, 'no-periods'), path.join(root, 'no-periods'), { recursive: true });
  const eraDir = path.join(root, 'basic', 'data', 'eras');
  let dropped = 0;
  for (const f of fs.readdirSync(eraDir)) {
    const p = path.join(eraDir, f), d = readJSON(p);
    const keep = d.rows.filter(r => !r.medium || r.medium === 'comic');
    dropped += d.rows.length - keep.length;
    d.rows = keep;
    writeJSON(p, d);
  }
  for (const name of ['basic', 'no-periods']) {
    const p = path.join(root, name, 'dataset.json'), d = readJSON(p);
    d.media = ['comic'];
    delete d.durations;
    writeJSON(p, d);
  }
  return {
    dropped,
    basic: build(path.join(root, 'basic', 'dataset.json'), { label: 'comics-basic' }),
    noPeriods: build(path.join(root, 'no-periods', 'dataset.json'), { label: 'comics-np' })
  };
}

module.exports = async function (t) {
  // ------------------------------------------------------------- 1. build
  const mx = mixed();
  t.ok('mixed fixture builds (a missing game duration warns, never fails)', mx.status === 0, mx.stderr);
  if (mx.status !== 0) return;
  const D = loadData(mx.out);
  const dur = id => D.issueDuration[D.ids.indexOf(id)];
  t.eq('issueDuration: comic 0 (minutes per issue), show default 22, override 44, game 1500, untimed game -1, gap note 0',
       ['mixed-hero-1990-1', 'mixed-toons-1991-s1e1', 'mixed-toons-1991-s1e2', 'mixed-toons-1991-s1e3', 'mixed-quest-1990',
        'mixed-quest-ii-1992', 'gap-middle'].map(dur), [0, 22, 22, 44, 1500, -1, 0]);
  t.ok('coverage warning names the medium and the count, like credits',
       /WARN  durations: 1 of 2 game rows have no duration \(coverage 50\.0%\)/.test(mx.stderr), mx.stderr);
  t.ok('no warning for shows: the dataset default times them all', !/durations: .* screen rows/.test(mx.stderr));
  t.ok('counts.durationsCoverage is the overall % (4 of 5 non-comic rows timed)', D.counts.durationsCoverage === 80);
  t.ok('the build summary prints the durations coverage', /durations 80\.0%/.test(mx.stdout), mx.stdout);
  t.ok('basic is fully timed: no durations warning', !/WARN  durations/.test(build(path.join(FIX, 'basic', 'dataset.json'), { label: 'dur-basic' }).stderr));
  const cases = ['duration-on-comic', 'durations-comic-default', 'duration-not-integer'];
  t.ok('broken fixtures exist for each duration rule (60-validation runs them)',
       cases.every(c => fs.existsSync(path.join(FIX, 'broken', c, 'expect.txt'))));
  for (const c of cases) {
    const r = build(path.join(FIX, 'broken', c, 'dataset.json'), { label: 'dur-' + c });
    t.ok(c + ' fails the build', r.status === 1 && r.stderr.includes(fs.readFileSync(path.join(FIX, 'broken', c, 'expect.txt'), 'utf8').trim()), r.stderr);
  }
  // an event chapter carries its duration into the placed row
  const evDir = copyFixture('basic', 'dur-event');
  const evFile = path.join(evDir, 'events', 'shattered-sky.json'), ev = readJSON(evFile);
  ev.chapters.push({ issueId: 'shattered-sky-the-game-1987', series: 'Shattered Sky The Game', vol: '1987', title: 'Shattered Sky: The Game (1987)',
                     date: { cover: '1987-12', source: 'fixture ledger (invented)' }, order: 1 + Math.max(...ev.chapters.map(c => c.order)),
                     role: 'core', relevant: [], medium: 'game', duration: 300 });
  writeJSON(evFile, ev);
  const evB = build(path.join(evDir, 'dataset.json'), { label: 'dur-event-out' });
  const evD = evB.status === 0 ? loadData(evB.out) : null;
  t.ok('an event chapter\'s duration reaches its placed row', evD && evD.issueDuration[evD.issueIds.indexOf('shattered-sky-the-game-1987')] === 300, evB.stderr);

  // ------------------------------------------------- 2-3. time left, finish-by
  const ns = D.franchise.key + ':v3:';
  let app = boot(mx.out, { now: NOW });
  let d = app.document;
  await wait(20);
  const $ = q => d.querySelector(q);
  let T = tally(D, {});
  t.ok('oracle sanity: 8 comics x 15 + shows 22 + 22 + 44 + game 1500 = 1708 minutes', T.all.comics * 15 + T.all.fixed === 1708);
  t.eq('mixed: every figure = each remaining row\'s own minutes; finish-by = minutes / (12 x 15)', readFigures(d, D), newFigures(D, T, 15, 12));
  t.ok('header time left is 1708 min', $('#pprog .pleft').dataset.leftMin === '1708');

  const mark = (id, clicks) => {
    app.window.PullList.jumpToIssue(id);
    for (let k = 0; k < clicks; k++) $(`.row[data-id="${id}"] .mark`).click();
  };
  const hLeft = () => +$('#pprog .pleft').dataset.leftMin;
  mark('mixed-quest-1990', 1);
  t.ok('a game in progress ("Playing") still counts in full', hLeft() === 1708);
  mark('mixed-quest-1990', 1);
  t.ok('marking the 1500-minute game beaten drops time left by exactly 1500', hLeft() === 208, hLeft());
  mark('mixed-toons-1991-s1e1', 3);
  t.ok('skipping a 22-minute episode drops time left by exactly 22', hLeft() === 186, hLeft());
  const marks1 = { 'mixed-quest-1990': 'read', 'mixed-toons-1991-s1e1': 'skip' };
  t.eq('after marking: every figure follows the own-minutes model', readFigures(d, D), newFigures(D, tally(D, marks1), 15, 12));
  app.window.PullList.setPace(25, 5);
  t.ok('Deep dive (25 min) changes only the comics part: 8 x 25 + 22 + 44', hLeft() === 266, hLeft());
  t.eq('pace 25 min / 5 a week: finish-by = minutes / (5 x 25), cumulative', readFigures(d, D), newFigures(D, tally(D, marks1), 25, 5));
  t.ok('no runtime errors (marks, pace)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------------------------------------ 5. untimed
  app = boot(mx.out, { now: NOW });
  d = app.document;
  await wait(20);
  const late = D.periods.findIndex(p => p.id === 'late'), early = D.periods.findIndex(p => p.id === 'early');
  const three = D.eras.findIndex(e => e.id === 'three');
  t.ok('header shows "+1 untimed"', $('#pprog .puntimed') && $('#pprog .puntimed').dataset.untimed === '1' && /\+1 untimed/.test($('#pprog .puntimed').textContent));
  t.ok('the band holding the untimed game shows the marker; the other band does not',
       !!$(`.band[data-b="${late}"] > .band-head .buntimed`) && !$(`.band[data-b="${early}"] > .band-head .buntimed`));
  t.ok('its era banner shows the marker too', !!$(`.era[data-e="${three}"] > .era-head .buntimed`));
  app.window.close();
  const onlyUntimed = { 'mixed-hero-1990-6': 'read', 'mixed-hero-1990-7': 'read', 'mixed-elsewhere-1992-1': 'read' };
  app = boot(mx.out, { now: NOW, storage: { [ns + 'progress']: JSON.stringify({ marks: onlyUntimed, bookmarks: [] }) } });
  d = app.document;
  await wait(20);
  const lateHead = () => $(`.band[data-b="${late}"] > .band-head`);
  t.ok('only an untimed row left: no "0m left", just the marker', !lateHead().querySelector('.bleft') && !!lateHead().querySelector('.buntimed') &&
       !/0m left/.test(lateHead().textContent));
  t.ok('…and its finish-by adds nothing for it (same date as the band before)',
       lateHead().querySelector('.bfinish').dataset.finish === $(`.band[data-b="${early}"] > .band-head .bfinish`).dataset.finish);
  t.eq('only-untimed figures match the model', readFigures(d, D), newFigures(D, tally(D, onlyUntimed), 15, 12));
  mark('mixed-quest-ii-1992', 2);
  t.ok('marking the untimed game beaten: the band is complete (✓) and the markers go', !!lateHead().querySelector('.bdone') &&
       !$('#pprog .puntimed') && !d.querySelector('.buntimed'));
  t.ok('no runtime errors (untimed)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------------------- 4. format as a plan filter
  app = boot(mx.out, { now: NOW });
  d = app.document;
  await wait(20);
  $('[data-act="panel"]').click();
  $('#fsecs .sec-head[data-k="story"]').click();
  const chip = m => $(`#fsec-story .chip[data-k="media"][data-v="${D.media.indexOf(m)}"]`);
  const marked = () => !!$('#pprog .pfiltered') || !!d.querySelector('.bfiltered');
  const byMedium = m => i => D.media[D.issueMedium[i]] === m;
  chip('game').click();
  t.eq('format = Games: totals are the games\' own minutes (+1 untimed), finish-by from them', readFigures(d, D), newFigures(D, tally(D, {}, byMedium('game')), 15, 12));
  t.ok('format = Games: header time left 1500, "+1 untimed"', $('#pprog .pleft').dataset.leftMin === '1500' && $('#pprog .puntimed').dataset.untimed === '1');
  t.ok('format = Games is a plan filter, never marked "filtered"', !marked());
  chip('game').click();
  chip('screen').click();
  t.eq('format = Shows: 22 + 22 + 44 minutes, no untimed marker', readFigures(d, D), newFigures(D, tally(D, {}, byMedium('screen')), 15, 12));
  t.ok('format = Shows: header time left 88', $('#pprog .pleft').dataset.leftMin === '88' && !$('#pprog .puntimed'));
  chip('screen').click();
  chip('comic').click();
  const Tc = tally(D, {}, byMedium('comic'));
  t.eq('format = Comics on mixed data: exactly the session-2 figures (count x 15, count / 12 a week)', readFigures(d, D), oldFigures(D, Tc, 15, 12));
  chip('comic').click();
  t.eq('format cleared: figures revert to the whole plan', readFigures(d, D), newFigures(D, tally(D, {}), 15, 12));
  t.ok('no runtime errors (format)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------------------ 6. comics-only = exactly today
  // (a) the arithmetic: integers r*m and w*m are exact, IEEE division is
  // correctly rounded, so (r*m)/(w*m) and r/w are the same double.
  for (const m of MINUTES) for (const w of WEEKLY) {
    let bad = null;
    for (let r = 0; r <= 5000 && bad === null; r++) if (!Object.is((r * m) / (w * m), r / w)) bad = r;
    t.ok(`(r x ${m}) / (${w} x ${m}) is bit-identical to r / ${w} for every r in 0..5000`, bad === null, 'first mismatch at r=' + bad);
  }
  // (b) the real DOM against the session-2 oracle, every preset pair, with marks
  const co = comicsOnlyFixtures();
  t.ok('comics-only variants: the game and the show removed, both build', co.dropped === 2 && co.basic.status === 0 && co.noPeriods.status === 0,
       co.basic.stderr + co.noPeriods.stderr);
  const big = stress();
  const rootB = build(path.join(ROOT, 'dataset.json'), { label: 'dur-root' });
  const datasets = [['basic (comics only)', co.basic], ['no-periods (comics only)', co.noPeriods], ['5,000-row stress', big], ['root starter', rootB]];
  for (const [name, b] of datasets) {
    const Dc = loadData(b.out);
    t.ok(name + ': every row is a comic timed by the setting', Dc.issueDuration.every(x => x === 0));
    const mk = {};
    Dc.ids.forEach((id, i) => { const s = i % 7 === 0 ? 'skip' : i % 3 === 0 ? 'read' : i % 11 === 0 ? 'reading' : null; if (s) mk[id] = s; });
    const a = boot(b.out, { now: NOW, storage: { [Dc.franchise.key + ':v3:progress']: JSON.stringify({ marks: mk, bookmarks: [] }) } });
    await wait(20);
    const Tn = tally(Dc, mk);
    for (const m of MINUTES) for (const w of WEEKLY) {
      a.window.PullList.setPace(m, w);
      t.eq(`${name}, ${m} min x ${w}/week: every header, band and era figure equals the session-2 result`,
           readFigures(a.document, Dc), oldFigures(Dc, Tn, m, w));
    }
    t.ok(name + ': no runtime errors', a.errors.length === 0, a.errors.join(' | '));
    a.window.close();
  }
};
