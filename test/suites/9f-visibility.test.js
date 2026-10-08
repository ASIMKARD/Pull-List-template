/* Data-driven visibility (decided 4 Oct; CLAUDE.md → UI rules). A control or
   section renders only when the dataset gives it something to do.

   ROWS pairs every conditional control with the capability that offers it.
   - On `minimal` (comics only, one era, no extras) none of them appear, on
     any tab, with the panel and every section opened, and the controls every
     tracker has still do.
   - On the full fixture (`basic` plus one untimed game, added here because
     `basic` is fully timed by design) all of them appear.
   - A permanent self-test forces each capability on in turn in a copy of
     app.js; each one must make its own rows appear on `minimal`. A capability
     with no row fails the suite, so every new control gets a row. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, build, boot, wait, mixed, copyFixture, readJSON, writeJSON } = require('../lib/helpers');

const text = (d, sel) => [...d.querySelectorAll(sel)].map(e => e.textContent).join(' ');
const any = (d, sel) => !!d.querySelector(sel);
const label = (d, name) => [...d.querySelectorAll('#fsecs .flabel')].some(l => l.textContent === name);

/* tab: where the control lives. cap: the capability that offers it (an array
   means any of them). */
const ROWS = [
  // one medium: no per-format lines, format filter, progress mode, duration copy, format pill
  { cap: 'media', tab: 'list', what: 'per-format header lines', has: d => any(d, '#pprog .pmedia') },
  { cap: 'media', tab: 'list', what: 'Format filter', has: d => label(d, 'Format') || any(d, '#fsecs .chip[data-k="media"]') },
  { cap: 'media', tab: 'settings', what: 'progress-mode setting', has: d => any(d, '[data-act="pmode"]') },
  { cap: 'media', tab: 'settings', what: 'duration copy', has: d => any(d, '.pace-dur') },
  { cap: 'media', tab: 'reading', what: 'format pill on the Reading card', has: d => any(d, '.rmed') },
  { cap: 'media', tab: 'list', what: 'per-format banner lines', has: d => any(d, '#pbannerIn .pbl[data-m]') },
  // characters
  { cap: ['presence', 'strands'], tab: 'list', what: 'Characters section', has: d => any(d, '.fsec[data-k="chars"]') },
  { cap: 'presence', tab: 'list', what: 'appearance chips', has: d => label(d, 'Appearances') },
  { cap: 'strands', tab: 'list', what: 'strand chips', has: d => label(d, 'Strands') || any(d, '#fsecs .chip[data-k="strands"]') },
  { cap: 'cameos', tab: 'list', what: 'Include cameos', has: d => any(d, '#fsecs .chip[data-k="cameos"]') },
  // creators
  { cap: 'credits', tab: 'list', what: 'Creators section', has: d => any(d, '.fsec[data-k="creators"]') },
  { cap: 'credits', tab: 'list', what: 'tappable creator names', has: d => any(d, '#app .cname') },
  { cap: 'credits', tab: 'list', what: '"creators" in the search hint', has: d => /creators/.test(d.querySelector('#q').placeholder) },
  // events, ALT, orders
  { cap: 'events', tab: 'list', what: 'Essential/Complete chips', has: d => any(d, '#fsecs .chip[data-k="events"]') },
  { cap: 'events', tab: 'settings', what: 'Essential/Complete setting', has: d => any(d, '[data-act="events-view"]') },
  { cap: 'alt', tab: 'list', what: 'ALT toggle', has: d => any(d, '#fsecs .chip[data-k="alt"]') },
  { cap: ['publication', 'arcOrder'], tab: 'list', what: 'order switch', has: d => any(d, '.fsec[data-k="order"]') },
  { cap: 'publication', tab: 'list', what: 'publication order chip', has: d => any(d, '#fsecs .chip[data-k="order"][data-v="publication"]') },
  { cap: 'arcOrder', tab: 'list', what: 'arc order chip', has: d => any(d, '#fsecs .chip[data-k="order"][data-v="arc"]') },
  // bands and eras
  { cap: 'bands', tab: 'list', what: 'period bands', has: d => any(d, '#app .band') },
  { cap: 'bands', tab: 'settings', what: 'help copy naming bands', has: d => /\bband\b/.test(text(d, '#settings')) },
  { cap: 'eras', tab: 'list', what: 'era jump bar', has: d => !d.querySelector('#eranav').hidden && any(d, '#eranav .chip, #eranav select') },
  { cap: 'eras', tab: 'list', what: 'era filter', has: d => label(d, 'Era') || any(d, '#fsecs .chip[data-k="eras"]') },
  { cap: 'eras', tab: 'settings', what: 'era navigation setting', has: d => any(d, '[data-act="eranav"]') },
  { cap: 'eras', tab: 'settings', what: 'Newest era first', has: d => any(d, '[data-act="pref"][data-k="rev"]') },
  { cap: 'eras', tab: 'settings', what: 'era picker for Mark era', has: d => any(d, '#bulkEra') },
  { cap: 'eras', tab: 'settings', what: 'Mark range', has: d => any(d, '#bulkFrom, [data-act="bulk-range"]') },
  // the rule applied further (plan step 1)
  { cap: ['events', 'eras', 'media', 'types', 'alt'], tab: 'list', what: 'Story section', has: d => any(d, '.fsec[data-k="story"]') },
  { cap: 'tiers', tab: 'list', what: 'depth chips', has: d => any(d, '#fsecs .chip[data-k="tier"]') },
  { cap: 'types', tab: 'list', what: 'type chips', has: d => label(d, 'Type') || any(d, '#fsecs .chip[data-k="types"]') },
  { cap: 'mandatory', tab: 'list', what: 'Mandatory only', has: d => any(d, '#fsecs .chip[data-k="mandatory"]') },
  { cap: 'notes', tab: 'list', what: 'Notes only', has: d => any(d, '#fsecs .chip[data-k="notesOnly"]') },
  { cap: 'notes', tab: 'list', what: '"notes" in the search hint', has: d => /notes/.test(d.querySelector('#q').placeholder) },
  { cap: 'reveal', tab: 'settings', what: 'Tap to reveal notes', has: d => any(d, '[data-act="pref"][data-k="reveal"]') },
  { cap: 'gapNotes', tab: 'settings', what: 'Gap notes toggle', has: d => any(d, '[data-act="pref"][data-k="gapNotes"]') },
  { cap: 'lookup', tab: 'list', what: 'look-up link', has: d => any(d, '#app .b.mu') },
  { cap: 'legacy', tab: 'settings', what: 'Import from previous version', has: d => any(d, '[data-act="import-legacy"]') },
  { cap: 'skins', tab: 'settings', what: 'skin control (more than one skin offered)', has: d => any(d, '[data-act="look"][data-k="skin"]') },
  { cap: 'eras', tab: 'settings', what: 'era colours setting', has: d => any(d, '[data-act="look"][data-k="eraHues"]') }
];
/* Shown by the data itself rather than a capability: no flag to force. */
const DATA_ROWS = [
  { tab: 'list', what: '"+N untimed"', has: d => any(d, '[data-untimed]') || /untimed/.test(text(d, '#pprog, #app')) },
  { tab: 'list', what: 'tap-to-reveal note button', has: d => any(d, '#app .b.reveal') },
  { tab: 'list', what: 'Complete-view note on an event', has: d => any(d, '#app .evnote') }
];
/* Every tracker has these, whatever its data. */
const ALWAYS = [
  { tab: 'list', what: 'search box', has: d => any(d, '#q') },
  { tab: 'list', what: 'four tabs', has: d => d.querySelectorAll('#tabs [role="tab"]').length === 4 },
  { tab: 'list', what: 'Next unread, Expand all, Collapse all', has: d => any(d, '.ptools [data-act="next"]') && any(d, '.ptools [data-act="expand-all"]') && any(d, '.ptools [data-act="collapse-all"]') },
  { tab: 'list', what: 'era banners', has: d => any(d, '#app .era-head') },
  { tab: 'list', what: 'marks and bookmarks on rows', has: d => any(d, '#app .row .mark') && any(d, '#app .row .bm') },
  { tab: 'list', what: 'review ✎ and Mark arc read', has: d => any(d, '#app .b.rv') && any(d, '#app [data-act="arc-mark"]') },
  { tab: 'list', what: 'Reading section: Unread only, Hide skipped', has: d => any(d, '.fsec[data-k="reading"]') && any(d, '#fsecs .chip[data-k="unread"]') && any(d, '#fsecs .chip[data-k="hideSkip"]') },
  { tab: 'list', what: 'Save as preset', has: d => any(d, '[data-act="preset-new"]') },
  { tab: 'reading', what: 'Reading card with Skip / Mark', has: d => any(d, '[data-act="rd-done"]') && any(d, '[data-act="rd-skip"]') },
  { tab: 'settings', what: 'pace controls and readout', has: d => any(d, '[data-act="pace-min"]') && any(d, '[data-act="pace-week"]') && any(d, '#paceOut') },
  { tab: 'settings', what: 'Display: badges, combo, arc headings', has: d => any(d, '[data-k="badges"]') && any(d, '[data-k="combo"]') && any(d, '[data-act="layout"]') },
  { tab: 'settings', what: 'Touch: swipe and long-press', has: d => any(d, '[data-k="swipe"]') && any(d, '[data-k="press"]') },
  { tab: 'settings', what: 'Bulk: Mark era read / unread', has: d => d.querySelectorAll('[data-act="bulk-era"]').length === 2 },
  { tab: 'settings', what: 'Data: refresh reminder, Clear all progress', has: d => any(d, '[data-act="refresh"]') && any(d, '[data-act="clear-ask"]') },
  { tab: 'settings', what: 'Backup: sync code, export', has: d => any(d, '[data-act="sync-show"]') && any(d, '[data-act="backup-export"]') },
  { tab: 'settings', what: 'Offline: readiness, connection, version', has: d => any(d, '#offState') && any(d, '#netLine') && /Version\s*v\d+/.test(text(d, '#set-offline')) },
  { tab: 'settings', what: 'Look: seven paper swatches, text size, density, button size, marks, dyslexia font',
    has: d => d.querySelectorAll('.swatch[data-act="look"]').length === 7 && ['textSize', 'density', 'tap', 'marks'].every(k => any(d, '[data-act="look"][data-k="' + k + '"]')) &&
             any(d, '[data-act="pref"][data-k="dys"]') }
];
/* A capability whose controls live inside another's section is forced
   together with it. */
const REQUIRES = { cameos: ['presence'] };
/* Settings that make a capability's control show when it is offered. */
const SEED = { progressMode: 'medium', eraNav: 'chips', reveal: true, gapNotes: true, banner: true };

/* Open everything a person could open, then report which rows are present. */
function audit(app, rows) {
  const d = app.document, found = rows.map(() => false);
  const look = tab => rows.forEach((r, k) => { if (r.tab === tab && r.has(d)) found[k] = true; });
  d.querySelector('#tab-list').click();
  const panel = d.querySelector('[data-act="panel"]');
  if (panel.getAttribute('aria-expanded') !== 'true') panel.click();
  let head, guard = 0;
  while ((head = d.querySelector('#fsecs .sec-head[aria-expanded="false"]')) && guard++ < 20) head.click();
  d.querySelector('.ptools [data-act="expand-all"]').click();
  look('list');
  d.querySelector('#tab-reading').click();
  look('reading');
  d.querySelector('#tab-settings').click();
  guard = 0;
  while ((head = d.querySelector('#settings .sec-head[aria-expanded="false"]')) && guard++ < 20) head.click();
  look('settings');
  return found;
}
const names = (rows, found, want) => rows.filter((r, k) => found[k] !== want).map(r => r.what + (r.cap ? ' [' + r.cap + ']' : ''));
const seeded = key => ({ [key + ':v3:settings']: JSON.stringify(SEED) });

module.exports = async function (t) {
  // ---------------------------------------------------------------- fixtures
  const bare = build(path.join(FIX, 'minimal', 'dataset.json'), { label: 'minimal' });
  t.ok('the minimal fixture builds', bare.status === 0, bare.stderr);
  const fullDir = copyFixture('basic', 'full');
  const storm = path.join(fullDir, 'data', 'eras', '5020-storm.json'), era = readJSON(storm);
  const at = era.rows.findIndex(r => r.issueId === 'fixture-quest-1987');
  era.rows.splice(at + 1, 0, { issueId: 'fixture-quest-ii-1987', series: 'Fixture Quest II', vol: '1987', title: 'Fixture Quest II (1987)',
    arc: 'fixture-quest', date: { cover: '1987-04', source: 'fixture ledger (invented)' }, type: 'GAME', medium: 'game' });
  writeJSON(storm, era);
  const full = build(path.join(fullDir, 'dataset.json'), { label: 'full-out' });
  t.ok('the full fixture builds (basic + one untimed game)', full.status === 0, full.stderr);

  // ---------------------------------------------------------------- the capability map
  let app = boot(full.out, { storage: seeded('fixture') });
  await wait(20);
  const HASFULL = app.window.PullList.has;
  const caps = Object.keys(HASFULL);
  t.ok('PullList.has is a read-only copy', Object.isFrozen(HASFULL));
  t.eq('the full fixture offers every capability', caps.filter(c => !HASFULL[c]), []);
  t.eq('every capability has at least one row in this suite', caps.filter(c => !ROWS.some(r => [].concat(r.cap).includes(c))), []);
  t.eq('every row names a real capability', ROWS.filter(r => [].concat(r.cap).some(c => !caps.includes(c))).map(r => r.what), []);

  // ---------------------------------------------------------------- full: everything appears
  let found = audit(app, ROWS);
  t.eq('full fixture: every conditional control appears', names(ROWS, found, true), []);
  found = audit(app, DATA_ROWS);
  t.eq('full fixture: the data-driven markers appear ("+N untimed", note button, event note)', names(DATA_ROWS, found, true), []);
  found = audit(app, ALWAYS);
  t.eq('full fixture: the controls every tracker has appear', names(ALWAYS, found, true), []);
  t.eq('full fixture: no page errors', app.errors, []);

  // ---------------------------------------------------------------- minimal: none appear
  app = boot(bare.out, { storage: seeded('minimal') });
  await wait(20);
  const HASBARE = app.window.PullList.has;
  t.eq('minimal fixture: no capability is offered', caps.filter(c => HASBARE[c]), []);
  found = audit(app, ROWS);
  t.eq('minimal fixture: no conditional control appears on any tab', names(ROWS, found, false), []);
  found = audit(app, DATA_ROWS);
  t.eq('minimal fixture: no "+N untimed", note button or event note', names(DATA_ROWS, found, false), []);
  found = audit(app, ALWAYS);
  t.eq('minimal fixture: the controls every tracker has still appear', names(ALWAYS, found, true), []);
  const d = app.document;
  t.eq('minimal fixture: the filter panel offers the Reading section only', [...d.querySelectorAll('#fsecs .fsec')].map(s => s.dataset.k), ['reading']);
  d.querySelector('#tab-reading').click();
  t.eq('one medium: the verb is plain "Read"', d.querySelector('[data-act="rd-done"]').textContent, 'Mark Read');
  const words = [...['#tab-list', '#tab-reading', '#tab-settings'].map(tab => { d.querySelector(tab).click(); return ['#phead', '#tabs', '#main', '#toast'].map(q => d.querySelector(q).innerHTML).join(' '); })].join(' ');
  t.ok('one medium: no other format\'s words anywhere (Beaten, Watched, Playing, Not started, untimed, format)',
       !/Beaten|Watched|Watching|Playing|Not started|Unwatched|untimed|[Ff]ormat\b/.test(words), (words.match(/Beaten|Watched|Watching|Playing|Not started|Unwatched|untimed|[Ff]ormat\b/) || [])[0]);
  t.eq('the search hint names only what there is to search', [d.querySelector('#q').placeholder, d.querySelector('#q').getAttribute('aria-label')],
       ['Search titles, arcs…', 'Search titles and arcs']);
  t.eq('minimal fixture: no page errors', app.errors, []);

  // ---------------------------------------------------------------- saved state for controls that aren't offered
  app = boot(bare.out, { storage: { 'minimal:v3:settings': JSON.stringify({ order: 'publication', events: 'complete',
    filters: { tier: 'Everything', mandatory: true, notesOnly: true, types: ['MAIN'], eras: ['main'], media: ['comic'], strands: ['Main'], alt: false } }) } });
  await wait(20);
  const a = app.document;
  t.eq('saved filters for controls that aren\'t offered are ignored: no active chips', a.querySelector('#fchips').textContent, 'None');
  t.ok('…and nothing is filtered away (notes only would have hidden every row)', /Showing 6 of 6/.test(a.querySelector('#fshow').textContent),
       a.querySelector('#fshow').textContent);
  app.window.dispatchEvent(new app.window.Event('pagehide'));
  const st = JSON.parse(app.window.localStorage.getItem('minimal:v3:settings'));
  t.eq('a saved order or events view the data doesn\'t offer falls back (reading, essential)', [st.order, st.events], ['reading', 'essential']);

  // ---------------------------------------------------------------- a second order is measured, not declared
  app = boot(mixed().out);
  await wait(20);
  const mh = app.window.PullList.has, m = app.document;
  t.eq('mixed: publication order changes nothing there, so only arc order is a second order', [mh.publication, mh.arcOrder], [false, true]);
  m.querySelector('[data-act="panel"]').click();
  m.querySelector('#fsecs .sec-head[data-k="order"]').click();
  t.eq('mixed: the order switch offers Reading and Arc, not a publication chip that changes nothing',
       [...m.querySelectorAll('#fsecs .chip[data-k="order"]')].map(c => c.dataset.v), ['reading', 'arc']);
  t.ok('mixed: strands without presence data and only one strand — no Characters section', !m.querySelector('.fsec[data-k="chars"]'));

  // ---------------------------------------------------------------- self-test: forcing each capability on is caught
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const HOOK = 'var HAS = buildHas();';
  t.ok('the self-test can inject (app.js builds HAS in exactly one place)', src.split(HOOK).length === 2);
  const missed = [];
  for (const cap of caps) {
    const force = [cap].concat(REQUIRES[cap] || []);
    const mutated = src.replace(HOOK, HOOK + ' ' + force.map(c => 'HAS.' + c + ' = true;').join(' '));
    const m2 = boot(bare.out, { appSrc: mutated, storage: seeded('minimal') });
    await wait(10);
    const f2 = audit(m2, ROWS);
    const own = ROWS.map((r, k) => [].concat(r.cap).includes(cap) && f2[k]).some(Boolean);
    if (!own) missed.push(cap);
  }
  t.eq('forcing any one capability on is caught: its own controls appear on minimal (' + caps.length + ' capabilities)', missed, []);
};
