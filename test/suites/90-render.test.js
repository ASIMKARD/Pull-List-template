/* Rendering against the real DOM: collapsed landing, goal banners, lazy eras,
   arcs, rows, escaping. */
'use strict';
const { loadData, boot, wait, basic, noPeriods, stress } = require('../lib/helpers');

module.exports = async function (t) {
  const b = basic();
  t.ok('basic builds', b.status === 0, b.stderr);
  const D = loadData(b.out);
  const app = boot(b.out);
  const d = app.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  await wait(20);
  t.ok('boots with no runtime errors', app.errors.length === 0, app.errors.join(' | '));

  // ---- landing ----
  t.ok('one band per period (T-26)', $$('.band').length === D.periods.length);
  t.ok('band heads carry names (T-33)', $$('.band .band-head .bname').map(n => n.textContent).join('|') === D.periods.map(p => p.name).join('|'));
  t.ok('bands carry their own identity, data-b (T-102, V-4)', $$('.band').every((s, i) => s.dataset.b === String(i)));
  t.ok('eras nest inside bands (T-34)', $$('.band .era').length === D.eras.length && $$('.era').length === D.eras.length);
  t.ok('lands collapsed: every band head aria-expanded=false (V-3)', $$('.band-head').every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok('lands collapsed: every era head aria-expanded=false', $$('.era-head').every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok('lands collapsed: band bodies hidden', $$('.band-body').every(x => x.hidden));
  t.ok('lazy: no row is rendered at landing (T-3 re-expressed, V-15)', $$('.row').length === 0);
  t.ok('progress header is visible (T-105)', !$('#phead').hidden && !!$('#pprog progress'));
  t.ok('top-level banners show read count', $$('.band-head .bcount').every(x => /\d+ \/ \d+ read/.test(x.textContent)));
  t.ok('top-level banners show time left', $$('.band-head .bleft').length === D.periods.length);
  t.ok('top-level banners show a finish-by date', $$('.band-head .bfinish').length === D.periods.length);
  t.ok('era banners inside a band show time left but no finish-by', $$('.era-head .bleft').length === D.eras.length && $$('.era-head .bfinish').length === 0);
  t.ok('banners carry a progress bar', $$('.band-head progress, .era-head progress').length === D.periods.length + D.eras.length);

  // ---- open a band, then an era: only that era renders ----
  $('.band[data-b="1"] > .band-head').click();
  t.ok('opening a band shows its body', !$('.band[data-b="1"] > .band-body').hidden);
  t.ok('opening a band renders no rows yet', $$('.row').length === 0);
  const storm = D.eras.findIndex(e => e.id === 'storm');
  $(`.era[data-e="${storm}"] > .era-head`).click();
  const want = D.issueEra.map((e, i) => i).filter(i => D.issueEra[i] === storm && !D.issueCompleteOnly[i]);
  const rows = $$('.row');
  t.ok('opening an era renders exactly its in-view rows', rows.length === want.length && rows.every(r => D.issueEra[+r.dataset.i] === storm), rows.length + ' vs ' + want.length);
  t.ok('Complete-only tie-ins are not rendered in Essential view', !$$('.row').some(r => /other-guy|bystander/.test(r.dataset.id)));
  t.ok('every rendered row appears once', new Set(rows.map(r => r.dataset.i)).size === rows.length);
  t.ok('a recurring arc is marked cont.', $$(`.era[data-e="${storm}"] .arc-head h3`).some(h => /Stormfront · cont\./.test(h.textContent)));
  t.ok('arc heads list credits', $$(`.era[data-e="${storm}"] .credits`).some(c => /Writer: Bram Ostrow · Art: Gale Ferreira/.test(c.textContent)));
  const longT = $('.row[data-id="fixture-hero-presents-1988-1"] .title');
  t.ok('a very long title renders in full', !!longT && longT.textContent.length > 150 && /Part One of Seven \(1988\) #1$/.test(longT.textContent));
  t.ok('migrated row renders under its legacy id', !!$('.row[data-id="198706004"]'));
  t.ok('mark buttons are delegation-tagged (T-4)', $$('.row:not(.inert) .mark').every(m => m.dataset.act === 'mark'));
  t.ok('mark labels follow the medium (game: Not started)', /Not started$/.test($('.row[data-id="fixture-quest-1987"] .mark').getAttribute('aria-label')));
  t.ok('core badge shown on core rows', !!$('.row[data-id="fixture-hero-quiet-storm-1986"] .b.core'));
  t.ok('lookup link uses the configured searchUrl', $('.row[data-id="fixture-hero-1980-21"] a.mu').href.startsWith('https://example.invalid/search?q='));
  // closing keeps the body, reopening does not rebuild it
  $(`.era[data-e="${storm}"] > .era-head`).click();
  t.ok('closing an era hides its body', $(`.era[data-e="${storm}"] > .era-body`).hidden);

  // ---- inert rows, escaping, flashback ----
  const rising = D.eras.findIndex(e => e.id === 'rising');
  $('.band[data-b="0"] > .band-head').click();
  $(`.era[data-e="${rising}"] > .era-head`).click();
  const gap = $('.row[data-id="gap-1983-hiatus"]');
  t.ok('inert row renders with no mark button (F-7)', gap && gap.classList.contains('inert') && !gap.querySelector('.mark'));
  const vo = $('.row[data-id="vela-and-orrin-1984-1"] .title');
  t.ok('special characters in titles render as text', vo && vo.textContent === 'Vela & Orrin: The "Long" Night\'s <End> (1984) #1');
  t.ok('markup in a title never becomes an element', vo && vo.children.length === 0);
  const fbRow = $('.row[data-id="vela-year-zero-1984-1"]');
  t.ok('flashback reads first in its era', $(`.era[data-e="${rising}"] .row`) === fbRow);
  t.ok('flashback carries a note badge', !!(fbRow && fbRow.querySelector('.b.note')));

  // ---- expand all / collapse all (T-74, F-26) ----
  t.ok('expand/collapse buttons exist (T-74)', !!$('[data-act="expand-all"]') && !!$('[data-act="collapse-all"]'));
  $('[data-act="expand-all"]').click();
  const inView = D.ids.filter((x, i) => !D.issueCompleteOnly[i]).length;
  t.ok('expand all renders every in-view row', $$('.row').length === inView, $$('.row').length + ' vs ' + inView);
  t.ok('all rows sit inside a band (T-35)', $$('.band .row').length === $$('.row').length);
  $('[data-act="collapse-all"]').click();
  t.ok('collapse all closes every band and era', $$('.band-head, .era-head').every(h => h.getAttribute('aria-expanded') === 'false'));
  t.ok('no runtime errors after interaction (T-123)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- no bands ----
  const np = noPeriods();
  const a2 = boot(np.out);
  await wait(20);
  const d2 = a2.document;
  t.ok('no-periods: no band elements (T-27)', d2.querySelectorAll('.band').length === 0);
  t.ok('no-periods: eras are top-level banners with finish-by', d2.querySelectorAll('#app > .era .era-head .bfinish').length === loadData(np.out).eras.length);
  t.ok('no-periods: boots clean', a2.errors.length === 0, a2.errors.join(' | '));
  a2.window.close();

  // ---- 5,000 rows: landing renders nothing heavy; one era renders only itself ----
  const s = stress();
  t.ok('5,000-row dataset builds', s.status === 0, s.stderr);
  const a3 = boot(s.out);
  await wait(20);
  const d3 = a3.document;
  t.ok('5,000 rows: landing renders zero rows', d3.querySelectorAll('.row').length === 0);
  t.ok('5,000 rows: one banner per era', d3.querySelectorAll('.era').length === s.eras);
  d3.querySelector('.era[data-e="17"] > .era-head').click();
  t.ok('5,000 rows: opening one era renders only its rows', d3.querySelectorAll('.row').length === s.perEra &&
       [...d3.querySelectorAll('.row')].every(r => r.closest('.era').dataset.e === '17'));
  a3.window.close();

  // ---- [hidden] wins against the REAL stylesheet (a class's display must never override it) ----
  {
    const a4 = boot(b.out, { css: true });
    await wait(20);
    const d4 = a4.document;
    const leaks = () => [...d4.querySelectorAll('[hidden]')].filter(el => a4.window.getComputedStyle(el).display !== 'none')
      .map(el => el.id || el.className || el.tagName);
    t.ok('styles: every hidden element computes to display:none at landing', leaks().length === 0, leaks().join(', '));
    t.ok('styles: the idle toast is not displayed', a4.window.getComputedStyle(d4.querySelector('#toast')).display === 'none');
    d4.querySelector('[data-act="panel"]').click();
    d4.querySelector('[data-act="expand-all"]').click();
    d4.querySelector('[data-act="collapse-all"]').click();
    t.ok('styles: every hidden element computes to display:none after interaction', leaks().length === 0, leaks().join(', '));
    d4.querySelector('[data-act="expand-all"]').click();
    /* B-6: no inline styles. A custom property that hands the stylesheet a
       number (an era's index for its derived colour) is a token, not a style. */
    const tokensOnly = v => v.split(';').map(x => x.trim()).filter(Boolean).every(x => /^--[\w-]+\s*:\s*[\w.-]+$/.test(x));
    const styled = [...d4.querySelectorAll('[style]')].filter(el => !tokensOnly(el.getAttribute('style')));
    t.ok('rendered markup carries no inline styles, only token values (B-6)', styled.length === 0 && d4.querySelectorAll('.era[style]').length > 0,
         styled.map(el => el.getAttribute('style')).join(' | '));
    t.ok('the inline-style check still catches a real style', !tokensOnly('color: red') && !tokensOnly('--ei: 3; width: 9px') && tokensOnly('--ei:3'));
    a4.window.close();
  }
};
