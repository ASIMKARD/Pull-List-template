/* Story, character and creator filters; presets (session 3, step 7).
   - Essential / Complete (V-10, FP-4): a PLAN setting. Totals follow it; in
     Essential view the event's own heading says "Complete view adds N".
   - Appearances (V-11, FP-5): BROWSE. Meaningful (major + minor) by default,
     cameos on request.
   - Creators (CR-7/8/10): a picker with counts and a writers / artists
     switch; tapping a credited name filters to that creator's work exactly.
   - Presets (F-22, S-24, FP-9): saved by name, applied, deleted with Undo.
   - Importance (V-12) on arc heads. */
'use strict';
const { loadData, boot, wait, typeInto, basic, stress, openSettings } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:', FL = D.flagBits;
  const inert = i => !!(D.issues[i][6] & (FL.GAPNOTE | FL.RENUM));
  const all = D.ids.map((id, i) => i);
  const essential = i => !inert(i) && !D.issueCompleteOnly[i];
  const base = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  let app = boot(b.out, { now: NOW, storage: base });
  let d = app.document;
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  await wait(20);
  const stored = () => { app.window.dispatchEvent(new app.window.Event('pagehide')); return JSON.parse(app.window.localStorage.getItem(ns + 'settings')); };
  const showing = () => +($('#fshow').textContent.match(/Showing ([\d,]+)/)[1].replace(/,/g, ''));
  const goal = () => $('#pprog .pcount').textContent.match(/\/ (\d+)/)[1];
  const marked = () => !!$('#pprog .pfiltered');
  $('[data-act="panel"]').click();
  ['story', 'chars', 'creators'].forEach(k => $(`#fsecs .sec-head[data-k="${k}"]`).click());

  // ------------------------------------------------ Essential / Complete
  const evArc = D.events[0].arc;
  t.ok('the build names each event\'s own arc', D.arcs[evArc].id === 'shattered-sky');
  t.ok('Story offers Essential / Complete, Essential pressed (FP-4)', $('#fsec-story .chip[data-k="events"][data-v="essential"]').getAttribute('aria-pressed') === 'true' &&
       !!$('#fsec-story .chip[data-k="events"][data-v="complete"]'));
  t.ok('Essential view: the header counts the essential issues', +goal() === D.counts.total);
  W_jump('shattered-sky-1987-1');
  const evHead = () => $(`.arc[data-a="${evArc}"] .arc-head`);
  t.ok('the event\'s own heading says "Complete view adds 2 issues" (V-10)', /Complete view adds 2 issues/.test(evHead().textContent));
  const otherHeads = $$('.arc-head').filter(h => +h.closest('.arc').dataset.a !== evArc);
  t.ok('…and only that heading (chapters merged into other arcs get no note)', otherHeads.every(h => !/Complete view/.test(h.textContent)));
  t.ok('complete-only chapters are not listed in Essential view', !$('.row[data-id="other-guy-1985-22"]'));
  evHead().querySelector('.evnote button').click();
  t.ok('tapping it switches to Complete view: totals recompute', +goal() === D.counts.completeTotal);
  W_jump('other-guy-1985-22');
  t.ok('…and the complete-only chapters are listed', !!$('.row[data-id="other-guy-1985-22"]'));
  t.ok('…the heading now says what Complete adds', /Complete view: 2 issues more than Essential/.test(evHead().textContent));
  t.ok('Complete is a plan setting: never marked "filtered"', !marked());
  t.ok('…shown as an active chip and in the Story summary (nothing applied is hidden)',
       $$('#fchips .chip').some(c => /Complete events/.test(c.textContent)) && /complete events/.test($('#fsecs .sec-head[data-k="story"] .sec-sum').textContent));
  t.ok('…stored in the one settings store', stored().events === 'complete');
  openSettings(app);
  t.ok('Settings shows the same choice', $('#settings [data-act="events-view"][aria-pressed="true"]').dataset.v === 'complete');
  $('#settings [data-act="events-view"][data-v="essential"]').click();
  $('#tab-list').click();
  t.ok('switching back in Settings restores the essential totals', +goal() === D.counts.total && !$$('#fchips .chip').some(c => /Complete/.test(c.textContent)));
  $('#fsec-story .chip[data-k="events"][data-v="complete"]').click();
  $('[data-act="clear"]').click();
  t.ok('Clear all returns to Essential', +goal() === D.counts.total && stored().events === 'essential');
  ['story', 'chars', 'creators'].forEach(k => { if ($(`#fsecs .sec-head[data-k="${k}"]`).getAttribute('aria-expanded') !== 'true') $(`#fsecs .sec-head[data-k="${k}"]`).click(); });

  // ------------------------------------------------ appearances
  t.eq('Characters: strands, then a chip per character (T-70 with presence)', $$('#fsec-chars .chip[data-k="chars"]').map(c => c.textContent), D.characters);
  const kest = D.characters.indexOf('Kestrel');
  const withK = cameos => all.filter(i => essential(i) && D.issuePresence[i].some(p => p[0] === kest && (p[1] < 2 || cameos))).length;
  $(`#fsec-chars .chip[data-k="chars"][data-v="${kest}"]`).click();
  t.ok('a character shows their meaningful appearances (major + minor) by default (V-11)', showing() === withK(false) && withK(false) === 13, showing());
  t.ok('appearances are a browse filter: marked "filtered"', marked());
  $('#fsec-chars .chip[data-k="cameos"]').click();
  t.ok('Include cameos adds the cameo appearances (FP-5)', showing() === withK(true) && withK(true) === 17, showing());
  t.ok('the chip and summary say so', $$('#fchips .chip').some(c => /Kestrel \(incl\. cameos\)/.test(c.textContent)) &&
       /Kestrel incl\. cameos/.test($('#fsecs .sec-head[data-k="chars"] .sec-sum').textContent));
  const st1 = stored();
  t.ok('stored by name, like every saved filter', JSON.stringify(st1.filters.chars) === '["Kestrel"]' && st1.filters.cameos === true);
  $('[data-act="clear"]').click();
  ['story', 'chars', 'creators'].forEach(k => { if ($(`#fsecs .sec-head[data-k="${k}"]`).getAttribute('aria-expanded') !== 'true') $(`#fsecs .sec-head[data-k="${k}"]`).click(); });

  // ------------------------------------------------ creators
  const cnt = (c, role) => role === 'w' ? c.w : role === 'a' ? c.a : c.w + c.a;
  const pickerNames = () => $$('#fsec-creators .cpick [data-act="creator"]').map(x => x.dataset.n);
  const expectPicker = (role, q) => D.creators.filter(c => cnt(c, role) > 0 && (!q || c.n.toLowerCase().includes(q)))
    .sort((x, y) => cnt(y, role) - cnt(x, role) || (x.n < y.n ? -1 : 1)).slice(0, 12).map(c => c.n);
  t.eq('the picker lists creators by issue count (CR-7)', pickerNames(), expectPicker('any', ''));
  t.ok('…each with its count', $('#fsec-creators .cpick [data-act="creator"] .cnt').textContent === String(D.creators.find(c => c.n === pickerNames()[0]).w +
       D.creators.find(c => c.n === pickerNames()[0]).a));
  $('#fsec-creators .chip[data-k="role"][data-v="w"]').click();
  t.eq('the writers switch counts writing credits only', pickerNames(), expectPicker('w', ''));
  t.ok('…and drops artist-only names', !pickerNames().includes('Cass Delune'));
  $('#fsec-creators .chip[data-k="role"][data-v="any"]').click();
  await typeInto(app, '#cq', 'quill');
  t.eq('typing narrows the picker', pickerNames(), expectPicker('any', 'quill'));
  const ci = n => D.creators.findIndex(c => c.n === n);
  const credited = (n, role) => all.filter(i => essential(i) && ((role !== 'a' && D.issueWriters[i].includes(ci(n))) || (role !== 'w' && D.issueArtists[i].includes(ci(n))))).length;
  const typedQuill = all.filter(i => essential(i) && D.issueWriters[i].concat(D.issueArtists[i]).some(c => D.creators[c].n.toLowerCase().includes('quill'))).length;
  t.ok('typed text is a substring search ("quill" matches Avery Quill and Quillon)', showing() === typedQuill && typedQuill === credited('Avery Quill') + credited('Quillon'));
  $('#fsec-creators .cpick [data-act="creator"][data-n="Quillon"]').click();
  t.ok('a picked name matches exactly: only Quillon\'s issues', showing() === credited('Quillon') && credited('Quillon') === 4, showing());
  t.ok('…chip and summary name the creator (CR-10)', $$('#fchips .chip').some(c => c.textContent.includes('Creator: “Quillon”')) &&
       $('#fsecs .sec-head[data-k="creators"] .sec-sum').textContent === '“Quillon”');
  $('#fsec-creators .cpick [data-act="creator"][data-n="Quillon"]').click();
  t.ok('tapping the picked name again clears it', !$$('#fchips .chip').some(c => /Creator/.test(c.textContent)));
  $('#fsec-creators .chip[data-k="role"][data-v="a"]').click();
  await typeInto(app, '#cq', 'Dorian');
  $('#fsec-creators .cpick [data-act="creator"][data-n="Dorian Vale"]').click();
  t.ok('role "artists" + a pick: only the issues Dorian Vale drew', showing() === credited('Dorian Vale', 'a') && credited('Dorian Vale', 'a') !== credited('Dorian Vale'));
  t.ok('…and the chip says "as artist"', $$('#fchips .chip').some(c => c.textContent.includes('Creator: “Dorian Vale” as artist')));
  $('[data-act="clear"]').click();
  ['story', 'chars', 'creators'].forEach(k => { if ($(`#fsecs .sec-head[data-k="${k}"]`).getAttribute('aria-expanded') !== 'true') $(`#fsecs .sec-head[data-k="${k}"]`).click(); });
  W_jump('fixture-hero-1980-1');
  const nameBtn = $('.era[data-e="0"] .arc-head .credits .cname');
  const tapped = nameBtn.dataset.n;
  t.ok('credited names on arc heads are buttons; the credits read as before', !!nameBtn && /^Writer: .+ · Art: .+$/.test(nameBtn.closest('.credits').textContent));
  nameBtn.click();
  t.ok('tapping a name filters to that creator\'s work, exactly (CR-8)', showing() === credited(tapped) && $$('#fchips .chip').some(c => c.textContent.includes('“' + tapped + '”')));
  t.ok('…opening the matches', $$('.row').length > 0 && $$('.row:not(.inert)').every(r => D.issueWriters[+r.dataset.i].concat(D.issueArtists[+r.dataset.i]).includes(ci(tapped))));
  $('[data-act="clear"]').click();
  ['story', 'chars', 'creators'].forEach(k => { if ($(`#fsecs .sec-head[data-k="${k}"]`).getAttribute('aria-expanded') !== 'true') $(`#fsecs .sec-head[data-k="${k}"]`).click(); });

  // ------------------------------------------------ presets
  $('#fsecs .sec-head[data-k="reading"]').click();
  $('#fsec-reading .chip[data-k="mandatory"]').click();
  $(`#fsec-chars .chip[data-k="chars"][data-v="${kest}"]`).click();
  const wanted = showing();
  t.ok('Save as preset sits at the bottom of the panel (FP-9)', !!$('#fpresets [data-act="preset-new"]'));
  $('#fpresets [data-act="preset-new"]').click();
  $('#fpresets [data-act="preset-save"]').click();
  t.ok('a preset needs a name', /name first/.test($('#toastMsg').textContent) && !!$('#presetName'));
  $('#presetName').value = 'Kestrel, mandatory';
  $('#fpresets [data-act="preset-save"]').click();
  const p0 = stored().presets;
  t.ok('saved by name, with the filters stored by name (S-24)', p0.length === 1 && p0[0].name === 'Kestrel, mandatory' &&
       p0[0].filters.mandatory === true && JSON.stringify(p0[0].filters.chars) === '["Kestrel"]');
  t.ok('the preset shows as a chip', $$('#fpresets [data-act="preset-apply"]').map(x => x.textContent).join() === 'Kestrel, mandatory');
  $('[data-act="clear"]').click();
  t.ok('Clear all leaves presets alone', stored().presets.length === 1 && showing() !== wanted);
  $('#fpresets [data-act="preset-apply"]').click();
  t.ok('applying it brings the filters back (F-22)', showing() === wanted && $$('#fchips .chip').some(c => /Mandatory only/.test(c.textContent)) &&
       $$('#fchips .chip').some(c => /Kestrel/.test(c.textContent)));
  $('#fpresets [data-act="preset-new"]').click();
  $('#presetName').value = 'Kestrel, mandatory';
  $('#fpresets [data-act="preset-save"]').click();
  t.ok('saving the same name updates it, no duplicate', stored().presets.length === 1 && /Updated/.test($('#toastMsg').textContent));
  $('#fpresets [data-act="preset-del"]').click();
  t.ok('× deletes it, with Undo', stored().presets.length === 0 && $('#toastAct').textContent === 'Undo');
  $('#toastAct').click();
  t.ok('Undo puts it back', stored().presets.length === 1);
  const saved = app.window.localStorage.getItem(ns + 'settings');
  t.ok('no runtime errors', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // presets survive a reboot; a saved character that no longer exists is dropped
  const st = JSON.parse(saved);
  st.filters = { chars: ['Kestrel', 'Someone Removed'] };
  app = boot(b.out, { now: NOW, storage: { [ns + 'settings']: JSON.stringify(st) } });
  d = app.document;
  await wait(20);
  t.ok('presets survive a reboot', d.querySelectorAll('#fpresets [data-act="preset-apply"]').length === 1);
  t.ok('a saved character name that no longer exists is dropped; the rest restore', [...d.querySelectorAll('#fchips .chip')].map(c => c.textContent).join('|') === 'Kestrel ×');

  // importance on arc heads (V-12)
  d.querySelector('[data-act="clear"]').click();             // the saved Kestrel filter would hide this row
  app.window.PullList.jumpToIssue('fixture-hero-1980-1');
  const origins = D.arcs.findIndex(a => a.id === 'origins');
  t.ok('an arc\'s importance shows on its heading (V-12)', /importance 5\/5/.test(d.querySelector(`.arc[data-a="${origins}"] .arc-meta`).textContent));
  t.ok('no runtime errors (reboot)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // exact picks on data where one name is a prefix of others ("Writer Number1" vs "…10"–"…19")
  const big = stress(), Ds = loadData(big.out);
  app = boot(big.out, { now: NOW });
  d = app.document;
  await wait(20);
  d.querySelector('[data-act="panel"]').click();
  d.querySelector('#fsecs .sec-head[data-k="creators"]').click();
  await typeInto(app, '#cq', 'Writer Number1');
  const typed = +d.querySelector('#fshow').textContent.match(/Showing ([\d,]+)/)[1].replace(/,/g, '');
  t.ok('typed "Writer Number1" also matches Number10–19 (a search: 11 eras x 125)', typed === 11 * 125, typed);
  d.querySelector('#fsec-creators .cpick [data-act="creator"][data-n="Writer Number1"]').click();
  const picked = +d.querySelector('#fshow').textContent.match(/Showing ([\d,]+)/)[1].replace(/,/g, '');
  t.ok('picking "Writer Number1" matches only that creator (125), never Number10–19', picked === Ds.perEra || picked === 125, picked);
  t.ok('no runtime errors (exact picks)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  function W_jump(id) { app.window.PullList.jumpToIssue(id); }
};
