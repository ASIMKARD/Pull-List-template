/* Under the tab bar (session 4, step 5): the mini progress bar (F-17; on by
   default on the v9 frame, off on the x frame, John 24 Oct) and the persistent banner (F-16, off by default, one line or one
   per format), both showing exactly the header's figures; and table view
   (F-49, S-7), a display option. Heights and widths are measured in
   test/layout/50-table. */
'use strict';
const path = require('path');
const { boot, wait, basic, mixed, build, loadData, openSettings, FIX, openCards } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const seen = s => ({ [ns + 'settings']: JSON.stringify(Object.assign({ v: 3, migrated: { format: 'v2' } }, s || {})) });
  let app = boot(b.out, { storage: seen() });
  let d = app.document;
  await wait(20);
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  const pref = k => $('[data-act="pref"][data-k="' + k + '"]');

  // ------------------------------------------------ defaults
  t.ok('the mini progress bar is off by default on the x frame, as the reference tracker\'s (John, 24 Oct; F-17, S-10)', $('#mini').hidden);
  t.ok('the persistent banner is off by default (T-51, S-11)', $('#pbanner').hidden && $('#pbannerIn').innerHTML === '');
  t.ok('both sit under the tab bar, outside the panes, so every tab has them', $('#tabs').nextElementSibling === $('#pbanner') &&
       $('#pbanner').nextElementSibling === $('#mini') && !$('#mini').closest('.pane'));
  t.eq('…all three in the one sticky stack, in order (F-58; pinned and measured in test/layout/60-stack)', [...$('#stack').children].map(c => c.id), ['tabs', 'pbanner', 'mini']);
  const header = () => $('#pprog .pcount').textContent.match(/(\d+) \/ (\d+)/).slice(1).map(Number);
  t.eq('the mini bar shows the header\'s figures (read of goal)', [+$('#miniBar').value, +$('#miniBar').max], header());
  openSettings(app, ['display']);
  t.ok('Display offers the mini bar, the banner (T-50) and table view (S-7)', !!pref('mini') && !!pref('banner') && !!pref('table') &&
       pref('mini').getAttribute('aria-pressed') === 'false' && pref('banner').getAttribute('aria-pressed') === 'false' && pref('table').getAttribute('aria-pressed') === 'false');
  {
    const v9 = build(path.join(FIX, 'sig-v9', 'dataset.json'), { label: 'mini-v9' }), a9 = boot(v9.out, { storage: {} });
    await wait(20);
    t.ok('…and on by default on the v9 frame, as v9 (a signature skin\'s "frame": "v9"; John, 28 Oct)',
         a9.document.documentElement.getAttribute('data-frame') === 'v9' && !a9.document.querySelector('#mini').hidden);
  }
  pref('mini').click();
  t.ok('turning the mini bar on shows it', !$('#mini').hidden);

  // ------------------------------------------------ the banner
  pref('banner').click();
  t.ok('turning the banner on shows it', !$('#pbanner').hidden);
  t.eq('one combined line for comics-and-more read as one list', $$('#pbannerIn .pbl').length, 1);
  const line = () => $('#pbannerIn .pbl');
  t.eq('…with the header\'s count', line().querySelector('.pbl-count').textContent, header().join(' / ') + ' read');
  t.eq('…and the header\'s time left (the header says "remaining" on the x frame)', [line().querySelector('.pbl-left').dataset.leftMin, line().querySelector('.pbl-left').textContent.replace(/ left$/, '')],
       [$('#pprog .pleft').dataset.leftMin, $('#pprog .pleft').textContent.replace(/ remaining$/, '')]);
  const sumWith = $('.sset[data-k="display"] .sec-sum').textContent;
  t.ok('the Display summary says the banner and the mini bar are on (the x frame\'s default is off)', /banner/.test(sumWith) && /· mini bar/.test(sumWith), sumWith);
  $('#tab-list').click();
  $('.band-head').click();
  $('.era-head').click();
  openCards($('.era'));
  const row = $('.row:not(.inert)');
  row.querySelector('.mark').click(); row.querySelector('.mark').click();             // reading, then read
  t.eq('a mark moves the banner with the header (no full re-render)', line().querySelector('.pbl-count').textContent, header().join(' / ') + ' read');
  t.eq('…and the mini bar', [+$('#miniBar').value, +$('#miniBar').max], header());
  t.ok('…the read count went up by one', header()[0] === 1);
  openSettings(app, ['display']);
  pref('mini').click();
  pref('banner').click();
  t.ok('both turn off: hidden, and the banner empties', $('#mini').hidden && $('#pbanner').hidden && $('#pbannerIn').innerHTML === '');
  t.ok('the summary says so', /\bbanner\b/.test(sumWith) && /mini bar/.test(sumWith) && !/banner|mini bar/.test($('.sset[data-k="display"] .sec-sum').textContent));

  // ------------------------------------------------ table view
  pref('table').click();
  t.eq('table view is a root flag', d.documentElement.getAttribute('data-table'), '1');
  $('#tab-list').click();
  const mu = $('.row .b.mu');
  t.eq('badge words sit in a span table view can fold away; the text reads the same', mu.textContent, 'look up ↗');
  t.ok('…and the core star stays a star, named "core" (x frame)', $$('.row .core-star').length > 0 && $$('.row .core-star').every(s => s.textContent === '★' && s.getAttribute('aria-label') === 'core'));
  t.ok('the look-up link keeps a full name when its words fold away', /^Look up /.test(mu.getAttribute('aria-label')));
  t.ok('…and so does the flashback note button', !$('.row .b.note') || $$('.row .b.note').every(x => !!x.getAttribute('aria-label')));
  t.ok('the summary says table view', /table view/.test($('.sset[data-k="display"] .sec-sum').textContent));
  await wait(450);
  const st = JSON.parse(app.window.localStorage.getItem(ns + 'settings'));
  t.eq('the three are kept in the one store', [st.mini, st.banner, st.table], [false, false, true]);
  t.eq('no runtime errors (banners)', app.errors, []);
  app.window.close();

  // ------------------------------------------------ per format: one line per format, each in its own verb
  const mx = mixed(), Dm = loadData(mx.out);
  app = boot(mx.out, { storage: { [Dm.franchise.key + ':v3:settings']: JSON.stringify({ v: 3, banner: true, progressMode: 'medium' }) } });
  d = app.document;
  await wait(20);
  const lines = [...d.querySelectorAll('#pbannerIn .pbl')];
  t.eq('per-format progress: one banner line per format in the data', lines.map(l => l.querySelector('.pbl-name').textContent), ['Comics', 'Games', 'Shows']);
  t.ok('…each in its own verb (read, beaten, watched)', /read$/.test(lines[0].querySelector('.pbl-count').textContent) &&
       /beaten$/.test(lines[1].querySelector('.pbl-count').textContent) && /watched$/.test(lines[2].querySelector('.pbl-count').textContent));
  const pmed = [...d.querySelectorAll('#pprog .pmed')].map(m => m.querySelector('.pmed-count').textContent);
  t.eq('…with the header\'s per-format counts', lines.map(l => l.querySelector('.pbl-count').textContent.split(' ').slice(0, 3).join(' ')), pmed);
  t.ok('…and the "+N untimed" marker where the header has one', !!lines[1].querySelector('.puntimed') === !!d.querySelector('#pprog .pmed[data-m="1"] .puntimed'));
  t.eq('no runtime errors (per format)', app.errors, []);
  app.window.close();
};
