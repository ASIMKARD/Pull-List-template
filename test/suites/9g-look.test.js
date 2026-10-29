/* Look (session 4, step 4): four skins as token sets, seven paper swatches,
   era colours, text size, density, button size, mark style and a
   dyslexia-friendly font. Each is a root attribute the stylesheet answers with
   tokens only (80-guards), so no Look setting can move or hide a control
   (V-5). Colours, contrast and sizes are measured in test/layout/40-look. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, build, boot, wait, basic, loadData, copyFixture, readJSON, writeJSON, openSettings, openCards } = require('../lib/helpers');

const ATTRS = ['data-skin', 'data-paper', 'data-eras', 'data-text', 'data-density', 'data-tap', 'data-marks', 'data-dys'];

module.exports = async function (t) {
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const seen = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  let app = boot(b.out, { storage: seen });
  let d = app.document;
  await wait(20);
  const $ = q => d.querySelector(q), $$ = q => [...d.querySelectorAll(q)];
  const attrs = () => ATTRS.map(a => d.documentElement.getAttribute(a));
  const look = (k, v) => $('[data-act="look"][data-k="' + k + '"][data-v="' + v + '"]').click();
  /* everything a person can see or use: element, classes, id, hidden, inert */
  const skeleton = () => [...d.querySelectorAll('#phead *, #tabs *, #main *')]
    .map(el => el.tagName + '.' + el.className + '#' + el.id + (el.hidden ? '[hidden]' : '') + (el.hasAttribute('inert') ? '[inert]' : '')).join('|');

  // ------------------------------------------------ first visit
  t.eq('first visit: the tracker\'s signature skin, the skin\'s own paper, split era colours, medium text, normal density, standard buttons, box marks, no dyslexia font',
       attrs(), ['signature', 'default', 'split', 'm', 'normal', 'standard', 'box', '0']);
  t.eq('the browser chrome falls back to the franchise colour when no paper is computed (jsdom)', $('meta[name="theme-color"]').content, D.franchise.theme);
  openSettings(app, ['look']);
  t.eq('the skin control offers the signature skin first, by its own name, then one option per configured skin, in order (T-97)',
       $$('[data-act="look"][data-k="skin"]').map(x => x.dataset.v + ':' + x.textContent), ['signature:Signal', 'paper:Paper', 'newsprint:Newsprint', 'pull:Pull', 'night:Night']);
  t.eq('seven paper swatches, each named for screen readers (S-4)', $$('.swatch').map(x => x.getAttribute('aria-label')),
       ['Skin default paper', 'Warm paper', 'Grey paper', 'Rose paper', 'Mint paper', 'Sky paper', 'Lilac paper']);
  t.eq('button size has three options (T-54), standard pressed by default (T-55)', $$('[data-act="look"][data-k="tap"]').map(x => x.dataset.v + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')),
       ['compact', 'standard*', 'large']);
  t.eq('text size, density, marks and era colours each offer their options', ['textSize', 'density', 'marks', 'eraHues'].map(k => $$('[data-act="look"][data-k="' + k + '"]').length), [3, 3, 3, 2]);

  // ------------------------------------------------ skins never move or hide a control
  const before = skeleton();
  look('skin', 'night');
  t.eq('choosing a skin sets data-skin', d.documentElement.getAttribute('data-skin'), 'night');
  t.ok('…and nothing else in the page: every element, class, id and hidden state is the same (T-81, V-5)', skeleton() === before);
  t.ok('…keeping the current tab (T-83)', $('#tab-settings').getAttribute('aria-selected') === 'true' && $('#pane-list').hidden);
  look('skin', 'pull');
  t.eq('moving on to another skin leaves no trace of the last one (T-103)', attrs().slice(0, 1), ['pull']);
  look('skin', 'newsprint');
  look('skin', 'paper');
  t.ok('…and switching back round-trips (T-116)', d.documentElement.getAttribute('data-skin') === 'paper' && skeleton() === before);
  t.eq('the Look summary names the skin', $('.sset[data-k="look"] .sec-sum').textContent, 'Paper skin');

  // ------------------------------------------------ every Look option is a root attribute and nothing else
  const opts = $$('#set-look [data-act="look"]').map(x => [x.dataset.k, x.dataset.v]);
  const wrong = [];
  for (const [k, v] of opts) {
    look(k, v);
    const attr = { skin: 'data-skin', paper: 'data-paper', eraHues: 'data-eras', textSize: 'data-text', density: 'data-density', tap: 'data-tap', marks: 'data-marks' }[k];
    if (d.documentElement.getAttribute(attr) !== v) wrong.push(k + '=' + v + ' → ' + d.documentElement.getAttribute(attr));
    if (k !== 'marks' && skeleton() !== before) wrong.push(k + '=' + v + ' changed the page');
  }
  t.eq('all ' + opts.length + ' Look options set their root attribute and change no element', wrong, []);
  t.ok('the pressed option follows the setting', $('[data-act="look"][data-k="paper"][data-v="lilac"]').getAttribute('aria-pressed') === 'true' &&
       $('[data-act="look"][data-k="marks"][data-v="tick"]').getAttribute('aria-pressed') === 'true');
  t.eq('the summary lists what differs from the defaults', $('.sset[data-k="look"] .sec-sum').textContent,
       'Night skin · Lilac paper · one era colour · large text · roomy · large buttons · tick and cross marks');
  $('[data-act="pref"][data-k="dys"]').click();
  t.eq('the dyslexia-friendly font is a root attribute too', d.documentElement.getAttribute('data-dys'), '1');
  t.ok('…and joins the summary', /dyslexia-friendly font$/.test($('.sset[data-k="look"] .sec-sum').textContent));

  // ------------------------------------------------ mark styles change the glyphs (S-5, XM-17)
  $('#tab-list').click();
  $('.era-head').click();
  openCards($('.era'));
  const row = $('.row:not(.inert)'), mark = () => row.querySelector('.mark').textContent;
  const glyphs = {};
  for (const style of ['box', 'dot', 'tick']) {
    $('#tab-settings').click(); look('marks', style); $('#tab-list').click();
    const r = $('.row[data-i="' + row.dataset.i + '"]');
    glyphs[style] = [r.querySelector('.mark').textContent];
    r.querySelector('.mark').click(); r.querySelector('.mark').click();                    // reading, then read
    glyphs[style].push($('.row[data-i="' + row.dataset.i + '"] .mark').textContent);
    $('.row[data-i="' + row.dataset.i + '"] .mark').click();                                // skip
    glyphs[style].push($('.row[data-i="' + row.dataset.i + '"] .mark').textContent);
    $('.row[data-i="' + row.dataset.i + '"] .mark').click();                                // back to unread
  }
  t.eq('box, dot and tick-and-cross marks: unread / read / skipped glyphs (the x frame\'s box is the reference tracker\'s: empty, ✓, ―)', glyphs,
       { box: ['', '✓', '―'], dot: ['○', '●', '⊘'], tick: ['', '✓', '✗'] });
  t.ok('…the label for screen readers still names the state', /— Unread$/.test($('.row[data-i="' + row.dataset.i + '"] .mark').getAttribute('aria-label')));
  {   // the v9 frame keeps its own Box glyphs (John, 25 Oct)
    const v9 = build(path.join(FIX, 'sig-v9', 'dataset.json'), { label: 'look-v9' }), a9 = boot(v9.out, { storage: {} });
    await wait(20);
    const d9 = a9.document, m9 = () => d9.querySelector('.row[data-i="' + i9 + '"] .mark');
    d9.querySelector('[data-act="expand-all"]').click();
    const i9 = d9.querySelector('.row:not(.inert)').dataset.i, seen = [m9().textContent];
    m9().click(); m9().click(); seen.push(m9().textContent); m9().click(); seen.push(m9().textContent);
    t.eq('…the v9 frame keeps its Box glyphs: ☐, ✓, ⊘', [d9.documentElement.getAttribute('data-frame')].concat(seen), ['v9', '☐', '✓', '⊘']);
    a9.window.close();
  }

  // ------------------------------------------------ the one store, and the next visit
  await wait(450);
  const st = JSON.parse(app.window.localStorage.getItem(ns + 'settings'));
  t.eq('the Look lives in the one settings store (after the debounce)', [st.skin, st.paper, st.eraHues, st.textSize, st.density, st.tap, st.marks, st.dys],
       ['night', 'lilac', 'mono', 'l', 'roomy', 'large', 'tick', true]);
  const keep = {};
  for (const k of Object.keys(app.window.localStorage)) keep[k] = app.window.localStorage.getItem(k);
  t.eq('no runtime errors (Look)', app.errors, []);
  app.window.close();
  app = boot(b.out, { storage: keep });
  d = app.document;
  await wait(20);
  t.eq('the next visit opens in the same Look', attrs(), ['night', 'lilac', 'mono', 'l', 'roomy', 'large', 'tick', '1']);
  app.window.close();
  app = boot(b.out, { storage: { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'midnight', paper: 'neon', textSize: 'xl', marks: 'stars', tap: 9, dys: 'yes' }) } });
  d = app.document;
  await wait(20);
  t.eq('values the template doesn\'t know fall back to the defaults', attrs(), ['signature', 'default', 'split', 'm', 'normal', 'standard', 'box', '0']);
  app.window.close();

  // ------------------------------------------------ skins come from the data (T-104, T-97)
  const withSkins = (label, fr) => {           // without the signature skin unless given
    const dir = copyFixture('basic', label), p = path.join(dir, 'dataset.json'), ds = readJSON(p);
    delete ds.franchise.signature;
    delete ds.franchise.storage.legacy.skins;
    Object.assign(ds.franchise, fr);
    writeJSON(p, ds);
    return build(p, { label: label + '-out' });
  };
  const cfgPull = withSkins('skin-pull', { skin: 'pull' });
  app = boot(cfgPull.out, { storage: seen });
  d = app.document;
  await wait(20);
  t.eq('a first visit opens in the skin the data names (T-104)', d.documentElement.getAttribute('data-skin'), 'pull');
  app.window.close();
  const two = withSkins('skin-two', { skins: ['night', 'paper'] });
  app = boot(two.out, { storage: seen });
  d = app.document;
  await wait(20);
  openSettings(app, ['look']);
  t.eq('two configured skins: two options, the first is the default', [$$('[data-act="look"][data-k="skin"]').map(x => x.dataset.v), d.documentElement.getAttribute('data-skin')],
       [['night', 'paper'], 'night']);
  app.window.close();
  const one = withSkins('skin-one', { skins: ['pull'] });
  app = boot(one.out, { storage: seen });
  d = app.document;
  await wait(20);
  openSettings(app, ['look']);
  t.ok('one configured skin: no skin control at all (data-driven visibility), the page is in that skin',
       !$('[data-act="look"][data-k="skin"]') && d.documentElement.getAttribute('data-skin') === 'pull' && $$('.swatch').length === 7);
  app.window.close();

  // ------------------------------------------------ the skin beacon (F-57, T-98)
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  app = boot(b.out, { css: true, storage: seen });
  await wait(20);
  t.ok('the current stylesheet: no stale-styles warning', !/out of date/.test(app.document.querySelector('#toastMsg').textContent));
  app.window.close();
  app = boot(b.out, { cssSrc: css.replace(/--skin-ok:\s*\d+/, '--skin-ok: 2'), storage: seen });
  await wait(20);
  t.ok('an older stylesheet (a stale cache) is caught before the app starts: loaded again where no cache holds it, then the app starts over (9i-pwa)',
       !!app.document.querySelector('link[rel="stylesheet"][href^="./styles.css?r="]') && /Updating to the latest version/.test(app.document.getElementById('app').textContent));
  app.window.close();
  app = boot(b.out, { cssSrc: css.replace(/\s*--skin-ok:\s*\d+;[^\n]*/, ''), storage: seen });
  await wait(20);
  t.ok('…and so is a stylesheet with no beacon at all', /out of date \(missing\)/.test(app.document.querySelector('#toastMsg').textContent));
  app.window.close();

  // ------------------------------------------------ era colours (session 7): each era hands the stylesheet its numbers
  app = boot(b.out, { storage: seen });
  await wait(20);
  const tokens = el => Object.fromEntries((el.getAttribute('style') || '').split(';').filter(Boolean).map(x => x.split(':').map(y => y.trim())));
  const secs = [...app.document.querySelectorAll('section.era')].map(s => [+s.dataset.e, tokens(s)]);
  const six = (k, p) => [[k['--' + p + '-l'], k['--' + p + '-c'], k['--' + p + '-h']].map(Number), [k['--' + p + '-sl'], k['--' + p + '-sc'], k['--' + p + '-sh']].map(Number)];
  t.eq('every era section carries its index and, for Pull, the colour it is drawn in (--ec…) and the one "One colour" draws (--em…), tab and strip, as numbers from data.js',
       secs.filter(([e, k]) => k['--ei'] !== String(e) || k['--ec'] !== '1' || JSON.stringify(six(k, 'ec')) !== JSON.stringify([D.eras[e].pull.tab, D.eras[e].pull.strip]) ||
         JSON.stringify(six(k, 'em')) !== JSON.stringify([D.pullMono.tab, D.pullMono.strip])).map(([e]) => e), []);
  t.eq('…an era with a tracker colour is drawn in it, the others in the palette by index', D.eras.map(e => e.pull.hex),
       D.eras.map((e, i) => e.colour ? e.colour.hex : JSON.parse(require('child_process').spawnSync('python3', [path.join(ROOT, 'tools', 'build.py'), '--pull-palette'], { encoding: 'utf8' }).stdout)[i % 11].hex));
  app.window.close();
  {
    // an older data.js, from before Pull's colours (a stale mix within Pages' 10 minutes): loaded again, never drawn half-done
    const out = path.join(copyFixture('basic', 'old-data'), 'out');
    fs.cpSync(b.out, out, { recursive: true });
    const OD = loadData(out);
    OD.eras.forEach(e => { delete e.pull; delete e.colour; });
    delete OD.pullMono;
    fs.writeFileSync(path.join(out, 'data.js'), 'window.TRACKER_DATA=' + JSON.stringify(OD) + ';\n');
    app = boot(out, { storage: { [OD.franchise.key + ':v3:settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) } });
    await wait(20);
    t.ok('an older data.js without Pull\'s colours is caught as a stale mix: loaded again where no cache holds it, before anything is drawn',
         !!app.document.querySelector('script[src^="./data.js?r="]') && /Updating to the latest version/.test(app.document.getElementById('app').textContent));
    app.window.close();
  }
};
