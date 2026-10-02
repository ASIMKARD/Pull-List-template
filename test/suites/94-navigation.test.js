/* jumpToIssue into collapsed sections (D-10), next unread (F-27), toast (B-5). */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, loadData, boot, wait, typeInto, basic } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic();
  const D = loadData(b.out);
  const app = boot(b.out);
  const d = app.document, w = app.window, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  await wait(20);

  // jump into a collapsed band and era
  t.ok('starts collapsed', $$('.row').length === 0);
  t.ok('jumpToIssue reports success', w.PullList.jumpToIssue('198706004') === true);
  const row = $('.row[data-id="198706004"]');
  t.ok('jump renders the target row inside a collapsed era (D-10)', !!row);
  t.ok('jump opens its band and era', row && row.closest('.band').querySelector('.band-head').getAttribute('aria-expanded') === 'true' &&
       row.closest('.era').querySelector('.era-head').getAttribute('aria-expanded') === 'true' && !row.closest('.era-body').hidden);
  t.ok('jump scrolls to the row', w.__scrolledTo === row);
  t.ok('jump flashes the row', row.classList.contains('flash'));
  t.ok('jump moves focus to the row\'s mark', d.activeElement === row.querySelector('.mark'));
  t.ok('only the target era rendered rows', $$('.row').every(r => r.closest('.era') === row.closest('.era')));
  t.ok('an unknown id is refused, not thrown', w.PullList.jumpToIssue('no-such-id') === false);

  // next unread
  $('[data-act="collapse-all"]').click();
  $('[data-act="next"]').click();
  t.ok('next unread jumps to the first unread issue in reading order', w.__scrolledTo && w.__scrolledTo.dataset.id === 'fixture-hero-1980-0');
  $('.row[data-id="fixture-hero-1980-0"] .mark').click(); $('.row[data-id="fixture-hero-1980-0"] .mark').click();
  $('[data-act="next"]').click();
  t.ok('after marking it read, next unread moves on', w.__scrolledTo.dataset.id === 'fixture-hero-1980-1');
  $('.row[data-id="fixture-hero-1980-1"] .mark').click();
  $('[data-act="next"]').click();
  t.ok('a "reading" issue is not unread', w.__scrolledTo.dataset.id === 'fixture-hero-1980-1-5');

  // jump to an issue hidden by filters -> toast offering to clear
  await typeInto(app, '#q', 'Orrin (1983)');
  t.ok('jump refuses an issue the filters hide', w.PullList.jumpToIssue('fixture-quest-1987') === false);
  t.ok('a toast explains why', !$('#toast').hidden && /hidden by your filters/.test($('#toastMsg').textContent));
  t.ok('the toast offers to clear the filters', !$('#toastAct').hidden && $('#toastAct').textContent === 'Clear filters');
  $('#toastAct').click();
  t.ok('clearing from the toast empties the search', $('#q').value === '');
  t.ok('…and then jumps to the issue', !!$('.row[data-id="fixture-quest-1987"]') && w.__scrolledTo.dataset.id === 'fixture-quest-1987');
  t.ok('the toast closes after its action', $('#toast').hidden);

  // next unread with nothing unread in the filtered view
  await typeInto(app, '#q', 'Fixture Hero (1980) #0');
  $('[data-act="next"]').click();
  t.ok('next unread reports when nothing unread matches', /Nothing unread matches these filters/.test($('#toastMsg').textContent));
  t.ok('no alert() anywhere in the app (B-5)', !/\balert\s*\(/.test(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')));
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
};
