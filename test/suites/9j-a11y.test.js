/* Accessibility (session 4, step 8; V-7, V-18, XM-3). An audit of the real
   rendered DOM with everything open on every tab: every control has a name,
   every aria reference resolves, states are valid, no id twice, the tabs
   pattern and landmarks hold. Then the keyboard: Reading-tab keys, "/" to
   search, arrow keys between tabs, nothing while typing. Motion and contrast
   are measured in Chromium (test/layout/20-motion, 40-look). */
'use strict';
const { boot, wait, basic, loadData, openSections, openSettings } = require('../lib/helpers');

function nameOf(el, d) {
  const t = s => (s || '').replace(/\s+/g, ' ').trim();
  if (t(el.getAttribute('aria-label'))) return t(el.getAttribute('aria-label'));
  if (el.getAttribute('aria-labelledby')) return t(el.getAttribute('aria-labelledby').split(/\s+/).map(id => (d.getElementById(id) || {}).textContent).join(' '));
  if (el.id && d.querySelector('label[for="' + el.id + '"]')) return t(d.querySelector('label[for="' + el.id + '"]').textContent);
  if (el.closest('label') && el.tagName !== 'BUTTON') return t(el.closest('label').textContent);
  if (/^(BUTTON|A)$/.test(el.tagName)) return t(el.textContent) || t(el.getAttribute('title'));
  return t(el.getAttribute('title'));
}

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const app = boot(b.out, { storage: { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, banner: true, eraNav: 'chips', reveal: true }),
                                       [ns + 'issue-reviews']: JSON.stringify({ 'fixture-hero-1980-1': { r: 4, t: 'Kept.' } }) } });
  const d = app.document, w = app.window;
  await wait(20);
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  const key = (k, opts) => { const el = (opts && opts.on) || d.activeElement || d.body; el.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, opts || {}))); };

  // ------------------------------------------------ open everything, visit every tab
  $('[data-act="panel"]').click();
  openSections(app, 'f');
  $('.ptools [data-act="expand-all"]').click();
  $('.row .b.rv').click();                                             // a review editor open too
  const seenIds = new Set(), dupes = new Set(), unnamed = [], badRefs = [], badStates = [];
  const audit = where => {
    const ids = $$('[id]').map(e => e.id);
    ids.forEach(id => { if (ids.indexOf(id) !== ids.lastIndexOf(id)) dupes.add(where + ': #' + id); seenIds.add(id); });
    $$('button, a[href], input:not([type="hidden"]), select, textarea').filter(el => !el.closest('[hidden]')).forEach(el => {
      if (!nameOf(el, d)) unnamed.push(where + ': ' + el.outerHTML.slice(0, 90));
    });
    $$('[aria-controls], [aria-labelledby]').forEach(el => {
      ['aria-controls', 'aria-labelledby'].forEach(a => (el.getAttribute(a) || '').split(/\s+/).filter(Boolean).forEach(id => {
        if (!d.getElementById(id)) badRefs.push(where + ': ' + a + '="' + id + '" on ' + el.tagName.toLowerCase() + '.' + el.className);
      }));
    });
    $$('[aria-expanded], [aria-pressed], [aria-selected]').forEach(el => ['aria-expanded', 'aria-pressed', 'aria-selected'].forEach(a => {
      if (el.hasAttribute(a) && !/^(true|false)$/.test(el.getAttribute(a))) badStates.push(where + ': ' + a + '="' + el.getAttribute(a) + '"');
    }));
  };
  audit('Checklist');
  $('#tab-reading').click(); audit('Reading');
  $('#tab-reviews').click(); audit('Reviews');
  openSettings(app);
  $('[data-act="sync-show"]').click();
  audit('Settings');
  t.eq('every control has an accessible name, on every tab with everything open (V-18)', unnamed.slice(0, 10), []);
  t.eq('every aria-controls and aria-labelledby points at an element that exists', badRefs.slice(0, 10), []);
  t.eq('every aria-expanded / aria-pressed / aria-selected is "true" or "false"', badStates.slice(0, 10), []);
  t.eq('no id is used twice, whatever is rendered (' + seenIds.size + ' ids seen)', [...dupes].slice(0, 10), []);
  const opener = $$('.sec-head, .era-head, .band-head, [data-act="panel"]');
  t.ok('every section, banner and the filter panel opener says whether it is open, and what it opens (' + opener.length + ')',
       opener.every(h => /^(true|false)$/.test(h.getAttribute('aria-expanded')) && !!d.getElementById(h.getAttribute('aria-controls'))));

  // ------------------------------------------------ structure
  t.ok('the page has a language, a header, the tab navigation and a main region', d.documentElement.lang === 'en' && !!$('header.phead') && !!$('nav#tabs') && !!$('main'));
  const tabs = $$('#tabs [role="tab"]');
  t.ok('tabs: one tablist, four tabs, each controlling a tabpanel labelled by it', $$('[role="tablist"]').length === 1 && tabs.length === 4 &&
       tabs.every(tb => { const p = d.getElementById(tb.getAttribute('aria-controls')); return p && p.getAttribute('role') === 'tabpanel' && p.getAttribute('aria-labelledby') === tb.id; }));
  t.ok('…exactly one selected, and only it in the tab order (roving tabindex)', tabs.filter(tb => tb.getAttribute('aria-selected') === 'true').length === 1 &&
       tabs.every(tb => tb.tabIndex === (tb.getAttribute('aria-selected') === 'true' ? 0 : -1)));
  t.ok('updates are announced: the toast is a polite status, and so are the match count and the pace readout',
       $('#toast').getAttribute('role') === 'status' && $('#toast').getAttribute('aria-live') === 'polite' &&
       $('#fshow').getAttribute('aria-live') === 'polite' && $('#paceOut').getAttribute('aria-live') === 'polite');
  t.ok('every mark names its issue and its state, whatever the mark style shows', $$('.row:not(.inert) .mark').every(m => / — (Unread|Reading|Read|Skipped|Not started|Playing|Beaten|Unwatched|Watching|Watched)$/.test(m.getAttribute('aria-label'))));

  // ------------------------------------------------ the keyboard (V-7, XM-3)
  $('#tab-reading').click();
  const count = () => $('.rcount').textContent;
  const first = count();
  key('ArrowRight', { on: d.body });
  t.ok('Reading tab: → steps to the next entry', count() !== first && /^2 of /.test(count()));
  key('ArrowLeft', { on: d.body });
  t.eq('…← steps back', count(), first);
  const id0 = $('.rcard').dataset.id;
  key('r', { on: d.body });
  t.ok('…R marks it read and steps on', $('.row[data-id="' + id0 + '"]').dataset.s === 'read' && $('.rcard').dataset.id !== id0);
  const id1 = $('.rcard').dataset.id;
  key('X', { on: d.body });
  t.ok('…X skips it (either case)', $('.row[data-id="' + id1 + '"]').dataset.s === 'skip' && $('.rcard').dataset.id !== id1);
  t.ok('…the card shows the keys, in its own verb', /Keys: ← → step · R read · X skip · \/ search/.test($('.rkeys').textContent));
  const id2 = $('.rcard').dataset.id;
  key('r', { on: d.body, ctrlKey: true });
  key('r', { on: d.body, metaKey: true });
  t.ok('…keys with Ctrl or ⌘ held are left to the browser', $('.row[data-id="' + id2 + '"]').dataset.s === 'unread' && $('.rcard').dataset.id === id2);
  key('/', { on: d.body });
  t.ok('"/" goes to search, from any tab', d.activeElement === $('#q') && $('#tab-list').getAttribute('aria-selected') === 'true');
  const typed = (k, el) => { const ev = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; };
  t.ok('typing in a box keeps every key: "/" types a slash in search', !typed('/', $('#q')) && !typed('r', $('#q')) && d.activeElement === $('#q'));
  openSettings(app, ['backup']);
  t.ok('…and in the sync code box', !typed('/', $('#syncIn')) && !typed('ArrowRight', $('#syncIn')));
  $('#tab-reading').click();
  t.ok('…so nothing was marked or stepped meanwhile', $('.rcard').dataset.id === id2 && $('.row[data-id="' + id2 + '"]').dataset.s === 'unread');
  $('#tab-list').focus();
  key('ArrowRight', { on: $('#tab-list') });
  t.ok('on a tab, → moves to the next tab and shows it (the ARIA tabs pattern)', d.activeElement === $('#tab-reading') && $('#tab-reading').getAttribute('aria-selected') === 'true');
  key('End', { on: $('#tab-reading') });
  t.ok('…End goes to the last tab', d.activeElement === $('#tab-settings') && !$('#pane-settings').hidden);
  key('ArrowRight', { on: $('#tab-settings') });
  t.ok('…→ on the last wraps to the first', d.activeElement === $('#tab-list'));
  key('Home', { on: $('#tab-settings') });
  key('ArrowLeft', { on: $('#tab-list') });
  t.ok('…← on the first wraps to the last, and Home goes to the first', d.activeElement === $('#tab-settings'));
  t.eq('no runtime errors (accessibility)', app.errors, []);
  app.window.close();
};
