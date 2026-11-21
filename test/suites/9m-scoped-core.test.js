/* Per-character CORE (T1). A row's `coreFor` names the characters it is core
   for. With a character chosen in Characters → Appearances, the core star and
   the narrowest depth (Barebones, the core path) follow the chosen characters'
   picks; several chips combine as OR. With none chosen, everything is the
   overall CORE, exactly as before. The build checks the names (broken/corefor-*). */
'use strict';
const { loadData, boot, wait, basic } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:', FL = D.flagBits;
  const inert = i => !!(D.issues[i][6] & (FL.GAPNOTE | FL.RENUM));
  const live = i => !inert(i) && !D.issueCompleteOnly[i];
  const C = n => D.characters.indexOf(n);
  const idsWhere = pred => D.ids.filter((id, i) => live(i) && pred(i)).sort();

  // ------------------------------------------------ the build
  t.ok('the build emits issueCoreFor, one list per row', Array.isArray(D.issueCoreFor) && D.issueCoreFor.length === D.ids.length);
  t.eq('…naming characters by index, on the rows whose coreFor names them',
       D.ids.map((id, i) => [id, D.issueCoreFor[i].map(c => D.characters[c]).join('+')]).filter(x => x[1]).sort(),
       [['fixture-hero-1980-1', 'Vela'], ['fixture-hero-1980-21', 'Kestrel'], ['kestrel-1986-6', 'Kestrel'],
        ['orrin-1983-1', 'Orrin'], ['vela-and-orrin-1984-1', 'Vela+Orrin']]);

  const run = async storage => {
    const app = boot(b.out, storage ? { storage } : {});
    await wait(20);
    return app;
  };
  let app = await run(), d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  const showing = () => +($('#fshow').textContent.match(/Showing ([\d,]+)/) || [0, '-1'])[1].replace(/,/g, '');
  const tierCount = ti => +$(`#fsecs .chip[data-k="tier"][data-v="${ti}"] .tcount`).textContent;
  const openPanel = () => {
    $('[data-act="panel"]').click();
    ['reading', 'chars'].forEach(k => { const h = $(`#fsecs .sec-head[data-k="${k}"]`); if (h.getAttribute('aria-expanded') !== 'true') h.click(); });
  };
  const stars = () => $$('#app .row').filter(r => r.querySelector('.core-star, .b.core')).map(r => r.dataset.id).sort();
  const shown = () => $$('#app .row:not(.inert)').map(r => r.dataset.id).sort();
  const char = n => $(`#fsecs .chip[data-k="chars"][data-v="${C(n)}"]`);
  openPanel();

  // ------------------------------------------------ no character chosen: the overall CORE
  t.ok('the Characters section explains it (shown because the data has coreFor)', !!$('#fsecs .corehint') && /Barebones/.test($('#fsecs .corehint').textContent));
  const overallBare = idsWhere(i => D.issueTier[i] === 0);
  t.ok('no character chosen: Barebones counts the overall core path', tierCount(0) === overallBare.length && overallBare.length > 0, tierCount(0));
  $('#fsecs .chip[data-k="tier"][data-v="0"]').click();
  t.eq('…and shows it', shown(), overallBare);
  t.eq('…with ★ on the overall CORE rows', stars(), idsWhere(i => D.issueTier[i] === 0 && D.issues[i][5]));

  // ------------------------------------------------ one character: that character's picks
  char('Vela').click();
  const velaPicks = ['fixture-hero-1980-1', 'vela-and-orrin-1984-1'];
  t.eq('Vela chosen: Barebones shows Vela\'s core picks', shown(), velaPicks);
  t.ok('…and its chip counts them', tierCount(0) === 2, tierCount(0));
  t.eq('…each with ★', stars(), velaPicks);
  $('#fsecs .chip[data-k="tier"][data-v="2"]').click();
  t.ok('Everything with Vela chosen: all her appearances are listed', showing() === idsWhere(i => D.issuePresence[i].some(p => p[0] === C('Vela') && p[1] <= 1)).length);
  t.eq('…but ★ marks only her picks, not the overall CORE rows', stars().filter(id => shown().includes(id)), velaPicks);
  t.ok('…so an overall CORE row of hers shows no ★ while she is chosen', shown().includes('fixture-hero-1980-3') && !stars().includes('fixture-hero-1980-3'));

  // ------------------------------------------------ two characters: OR
  char('Orrin').click();
  $('#fsecs .chip[data-k="tier"][data-v="0"]').click();
  t.eq('Vela and Orrin chosen: Barebones shows either one\'s picks (OR)', shown(), ['fixture-hero-1980-1', 'orrin-1983-1', 'vela-and-orrin-1984-1']);
  t.ok('…and its chip counts 3', tierCount(0) === 3, tierCount(0));

  // ------------------------------------------------ saved by name, restored
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const saved = JSON.parse(app.window.localStorage.getItem(ns + 'settings'));
  t.ok('the choice is stored by name (characters and depth)', JSON.stringify(saved.filters.chars) === '["Vela","Orrin"]' && saved.filters.tier === 'Barebones');
  app.window.close();
  app = await run({ [ns + 'settings']: JSON.stringify(saved) });
  d = app.document;
  openPanel();
  t.ok('a reload restores the scoped Barebones (the list lands collapsed: its count says so)', showing() === 3 && tierCount(0) === 3,
       showing() + ' / ' + tierCount(0));

  // ------------------------------------------------ clearing the characters restores the overall CORE
  char('Vela').click();
  char('Orrin').click();
  t.eq('with no character chosen again, Barebones is the overall core path', shown(), overallBare);
  t.ok('…and its chip counts it again', tierCount(0) === overallBare.length);
  t.eq('…and ★ is the overall CORE again', stars(), idsWhere(i => D.issueTier[i] === 0 && D.issues[i][5]));
  app.window.close();
};
