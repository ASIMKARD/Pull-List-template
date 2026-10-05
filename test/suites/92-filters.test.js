/* Filter panel (approved mockup) and search: matches open themselves, clearing
   returns to the collapsed landing, everything stays lazy. */
'use strict';
const { loadData, boot, wait, typeInto, basic, stress } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic();
  const D = loadData(b.out);
  const ns = D.franchise.key + ':v3:';
  let app = boot(b.out);
  let d = app.document;
  const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  await wait(20);
  const total = D.ids.filter((x, i) => !D.issueCompleteOnly[i] && !(D.issues[i][6] & (D.flagBits.GAPNOTE | D.flagBits.RENUM))).length;
  const showing = () => +($('#fshow').textContent.match(/Showing ([\d,]+)/) || [0, '-1'])[1].replace(/,/g, '');
  const landing = () => $$('.band-head, .era-head').every(h => h.getAttribute('aria-expanded') === 'false') && $$('.row').length === 0 &&
                        $$('.band, .era').every(x => !x.hidden);

  // ---- panel structure ----
  t.ok('filter panel sits above the checklist (FP-1)', $('#fpanel').compareDocumentPosition($('#app')) & 4);
  t.ok('panel body starts closed', $('#fbody').hidden);
  $('[data-act="panel"]').click();
  t.ok('Filters button opens the panel', !$('#fbody').hidden && $('[data-act="panel"]').getAttribute('aria-expanded') === 'true');
  t.eq('five sections in order (FP-2)', $$('#fsecs .sec-name').map(n => n.textContent), ['Reading', 'Story', 'Characters', 'Creators', 'Order and display']);
  t.ok('all sections start collapsed (FP-10): heads say so and every body is inert', $$('#fsecs .sec-head').every(h => h.getAttribute('aria-expanded') === 'false') &&
       $$('#fsecs .sec-body').length === 5 && $$('#fsecs .sec-body').every(b => b.hasAttribute('inert')));
  t.ok('collapsed headers show a summary (FP-7)', $$('#fsecs .sec-sum').every(s => s.textContent.length > 0));
  t.eq('default summaries', $$('#fsecs .sec-sum').map(s => s.textContent), ['All issues', 'Everything', 'All characters', 'All creators', 'Story']);  // fixture dualOrder labels reading order 'Story'
  t.ok('"Showing N of M" counts the view', showing() === total && new RegExp('of ' + total + ' issues').test($('#fshow').textContent));
  t.ok('no active chips by default', $$('#fchips .chip').length === 0);

  // ---- sections and their chips ----
  for (const k of ['reading', 'story', 'chars', 'creators', 'order']) $(`#fsecs .sec-head[data-k="${k}"]`).click();
  t.ok('opening sections opens their bodies (no longer inert)', $$('#fsecs .fsec.open').length === 5 && $$('#fsecs .sec-body').every(b => !b.hasAttribute('inert')));
  t.ok('depth chips built, one per tier (T-58)', $$('.chip[data-k="tier"]').length === D.tiers.length);
  t.ok('depth chips carry counts', $$('.chip[data-k="tier"]').every(c => /· \d+$/.test(c.textContent)));
  t.ok('type chips built (T-62)', $$('#fsec-story [data-k="types"]').length === D.types.length);
  t.ok('format row has one chip per medium (T-64)', $$('.chip[data-k="media"]').length === D.media.length);
  t.eq('media chips are labelled Comics/Games/Shows (T-66)', $$('.chip[data-k="media"]').map(c => c.textContent), ['Comics', 'Games', 'Shows']);
  t.ok('no redundant Annuals chip (T-65)', !$$('.chip').some(c => /annual/i.test(c.textContent)));
  t.ok('character chips match the strand list (T-70 re-expressed)', $$('.chip[data-k="strands"]').map(c => c.textContent).join('|') === D.strands.join('|'));
  t.ok('no hardcoded franchise chip (T-69, DOM)', !$$('.chip').some(c => /^ultimate$/i.test(c.textContent)));
  t.ok('era chips, one per era', $$('.chip[data-k="eras"]').length === D.eras.length);
  t.ok('order chips: reading / publication (dualOrder labels) / arc', $$('.chip[data-k="order"]').map(c => c.textContent).join('|') === 'Story|Published|Arc order');
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  t.ok('open sections are remembered in the one settings store (FP-10)',
       JSON.parse(app.window.localStorage.getItem(ns + 'settings')).panelOpen.length === 5);

  // ---- a narrowing filter: mandatory only (T-72/73 re-expressed) ----
  $('.chip[data-k="mandatory"]').click();
  const mand = D.ids.filter((x, i) => !D.issueCompleteOnly[i] && D.issues[i][4] && !(D.issues[i][6] & 24)).length;
  t.ok('mandatory only narrows the count', showing() === mand && mand < total, showing() + ' vs ' + mand);
  t.ok('matching eras open and render automatically', $$('.era-head[aria-expanded="true"]').length > 0 && $$('.row').length === mand);
  t.ok('every rendered row matches', $$('.row').every(r => D.issues[+r.dataset.i][4] === 1));
  t.ok('an active chip appears for it (FP-8)', $$('#fchips .chip').map(c => c.textContent).some(x => /Mandatory only/.test(x)));
  t.ok('the active count shows on the Filters button', /1 active/.test($('#fcount').textContent));
  t.ok('the Reading summary names it', /mandatory only/.test($('#fsecs .sec-head[data-k="reading"] .sec-sum').textContent));
  $('#fchips .chip').click();
  t.ok('removing the chip restores the count (T-73)', showing() === total);
  t.ok('clearing the last filter returns to the collapsed landing', landing());

  // ---- search: a title inside a collapsed era (John's change 1) ----
  t.ok('starts from the collapsed landing', landing());
  await typeInto(app, '#q', 'Kestrel (1986) #7');
  const kRow = $('.row[data-id="198706004"]');
  const storm = D.eras.findIndex(e => e.id === 'storm');
  t.ok('searching for a title inside a collapsed era shows it', !!kRow && !kRow.closest('.era-body').hidden);
  t.ok('its band and era open automatically', $(`.era[data-e="${storm}"] > .era-head`).getAttribute('aria-expanded') === 'true' &&
       kRow.closest('.band').querySelector('.band-head').getAttribute('aria-expanded') === 'true');
  t.ok('only the matching row renders', $$('.row').length === 1);
  t.ok('eras without matches are hidden', $$('.era').filter(e => !e.hidden).length === 1);
  t.ok('bands without matches are hidden (T-75)', $$('.band').filter(x => !x.hidden).length === 1);
  t.ok('Showing N of M reflects the search (T-79 re-expressed)', showing() === 1);
  t.ok('search chip shown', $$('#fchips .chip').some(c => /Search: “Kestrel \(1986\) #7”/.test(c.textContent)));
  await typeInto(app, '#q', '');
  t.ok('clearing the search restores the collapsed landing (T-80)', landing());

  await typeInto(app, '#q', 'gale ferreira');
  const gale = D.ids.filter((x, i) => !D.issueCompleteOnly[i] && !(D.issues[i][6] & 24) && D.issueArtists[i].concat(D.issueWriters[i]).some(c => D.creators[c].n === 'Gale Ferreira')).length;
  t.ok('search matches creator names (CR-9)', showing() === gale && gale > 0, showing() + ' vs ' + gale);
  await typeInto(app, '#q', 'night shift');
  t.ok('search matches arc names', $$('.row').map(r => r.dataset.id).join() === 'vela-and-orrin-1984-1');
  await typeInto(app, '#q', 'mail-away');
  t.ok('search matches notes', $$('.row').map(r => r.dataset.id).join() === 'fixture-hero-1980-half');
  await typeInto(app, '#q', 'zzzz-no-such-thing');
  t.ok('no matches: empty state, every band hidden', !!$('.empty') && $$('.band').every(x => x.hidden));
  t.ok('filter leaves no empty band showing (T-76/77)', $$('.band').filter(x => !x.hidden).length === 0);
  $('[data-act="clear"]').click();
  t.ok('Clear all empties the search box and returns to the landing', $('#q').value === '' && landing());

  // ---- creators section search ----
  await typeInto(app, '#cq', 'quillon');
  const q = D.ids.filter((x, i) => !D.issueCompleteOnly[i] && D.issueArtists[i].some(c => D.creators[c].n === 'Quillon')).length;
  t.ok('creator search filters to that creator\'s work', showing() === q && q > 0);
  t.ok('Creators summary names the search', /quillon/.test($('#fsecs .sec-head[data-k="creators"] .sec-sum').textContent));
  $('[data-act="clear"]').click();

  // ---- era, ALT, type, tier ----
  const echo = D.eras.findIndex(e => e.id === 'echo');
  $(`.chip[data-k="eras"][data-v="${echo}"]`).click();
  t.ok('era chip shows only that era', $$('.era').filter(e => !e.hidden).map(e => +e.dataset.e).join() === String(echo));
  t.ok('Story summary names the era', $('#fsecs .sec-head[data-k="story"] .sec-sum').textContent === 'Echo');
  $('[data-act="clear"]').click();
  $('.chip[data-k="alt"]').click();
  const elsewhere = D.eras.findIndex(e => e.id === 'elsewhere');
  t.ok('hiding alternate stories hides the ALT era', $(`.era[data-e="${elsewhere}"]`).hidden && showing() === total - 4);
  $('[data-act="clear"]').click();
  $('.chip[data-k="tier"][data-v="0"]').click();
  const bare = D.ids.filter((x, i) => !D.issueCompleteOnly[i] && D.issueTier[i] === 0 && !(D.issues[i][6] & 24)).length;
  t.ok('depth tier filter keeps tiers up to the chosen one', showing() === bare && bare > 0);
  $('[data-act="clear"]').click();
  const game = D.types.indexOf('GAME');
  $(`#fsec-story [data-k="types"][data-v="${game}"]`).click();
  t.ok('type chip filters by type', $$('.row').map(r => r.dataset.id).join() === 'fixture-quest-1987');
  $('[data-act="clear"]').click();

  // ---- unread only, after marking ----
  await typeInto(app, '#q', 'Orrin (1983)');
  $('.row[data-id="orrin-1983-1"] .mark').click(); $('.row[data-id="orrin-1983-1"] .mark').click();
  t.ok('row marked read while searching', $('.row[data-id="orrin-1983-1"]').dataset.s === 'read');
  $('.chip[data-k="unread"]').click();
  t.ok('unread only drops read rows', !$('.row[data-id="orrin-1983-1"]') && $$('.row').length === 3);
  $('[data-act="clear"]').click();

  // ---- order ----
  $('.chip[data-k="order"][data-v="publication"]').click();
  t.ok('Order summary shows the publication label', $('#fsecs .sec-head[data-k="order"] .sec-sum').textContent === 'Published');
  t.ok('changing the order is not a narrowing filter (landing stays collapsed)', landing());
  const rising = D.eras.findIndex(e => e.id === 'rising');
  $('.band[data-b="0"] > .band-head').click();
  $(`.era[data-e="${rising}"] > .era-head`).click();
  const ids = $$(`.era[data-e="${rising}"] .row`).map(r => r.dataset.id);
  t.ok('publication order puts the 1984 flashback after the 1983 issues', ids.indexOf('vela-year-zero-1984-1') > ids.indexOf('orrin-1983-4'));
  $('.chip[data-k="order"][data-v="reading"]').click();

  // ---- the panel state survives a reboot; filters persist, search does not ----
  $('.chip[data-k="mandatory"]').click();
  await typeInto(app, '#q', 'Kestrel');
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const saved = {};
  for (const k of Object.keys(app.window.localStorage)) saved[k] = app.window.localStorage.getItem(k);
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();
  app = boot(b.out, { storage: saved });
  d = app.document;
  await wait(20);
  $('[data-act="panel"]').click();
  t.ok('reboot: open sections remembered', $$('#fsecs .sec-head[aria-expanded="true"]').length === 5);
  t.ok('reboot: filters remembered (mandatory only)', $('#fsec-reading .chip[data-k="mandatory"]').getAttribute('aria-pressed') === 'true');
  t.ok('reboot: search is session-only', $('#q').value === '' && !$$('#fchips .chip').some(c => /Search/.test(c.textContent)));
  app.window.close();

  // ---- 5,000 rows: a search renders only the matching eras ----
  const s = stress();
  const big = boot(s.out);
  await wait(20);
  d = big.document;
  await typeInto(big, '#q', 'Series17 (1977) #4');           // matches #4 and #40-#49 in era 17 only
  const rendered = [...d.querySelectorAll('.era')].filter(e => e.querySelector('.row')).map(e => e.dataset.e);
  t.ok('5,000 rows: a search renders only the matching era', rendered.join() === '17', rendered.join());
  t.ok('5,000 rows: only the matching rows render', d.querySelectorAll('.row').length === 11);
  await typeInto(big, '#q', 'Series3');                      // eras 3 and 30-39
  const r2 = [...d.querySelectorAll('.era')].filter(e => e.querySelector('.row')).map(e => +e.dataset.e);
  t.ok('5,000 rows: a wider search renders exactly the eras with matches', r2.join() === '3,30,31,32,33,34,35,36,37,38,39', r2.join());
  t.ok('5,000 rows: eras without matches render nothing', [...d.querySelectorAll('.era')].filter(e => !e.hidden).length === 11);
  await typeInto(big, '#q', '');
  t.ok('5,000 rows: clearing returns to zero rendered rows', d.querySelectorAll('.row').length === 0);
  big.window.close();

  // ---- saved filters are stored by name, so a dataset change cannot shift them ----
  {
    const ds = boot(b.out, { storage: { [ns + 'settings']: JSON.stringify({ v: 3, filters: {
      eras: ['echo', 'era-that-was-removed'], strands: ['Kestrel'], types: ['GAME'], media: ['game'], tier: 'Essential', mandatory: true } }) } });
    await wait(20);
    const dd = ds.document;
    dd.querySelector('[data-act="panel"]').click();
    const chipsTxt = [...dd.querySelectorAll('#fchips .chip')].map(c => c.textContent);
    t.ok('stored filters are restored by name (era, strand, type, medium, tier)',
         ['Echo', 'Kestrel', 'game', 'Games', 'Essential tier', 'Mandatory only'].every(x => chipsTxt.some(c => c.startsWith(x))), chipsTxt.join(' | '));
    t.ok('a stored name that no longer exists is dropped, not mapped to another era', chipsTxt.filter(c => /^Echo|^Era/.test(c)).length === 1);
    ds.window.dispatchEvent(new ds.window.Event('pagehide'));
    const sf = JSON.parse(ds.window.localStorage.getItem(ns + 'settings')).filters;
    t.ok('filters are written back as names, never indices', sf.eras.join() === 'echo' && sf.strands.join() === 'Kestrel' && sf.tier === 'Essential');
    ds.window.close();
  }
};
