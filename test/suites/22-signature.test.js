/* The signature skin slot (John, 6 Oct): one skin of the tracker's own, from
   config. Same token system as the shared skins, and the build refuses
   anything that would move or hide a control, or write a colour that isn't
   derived from tokens. Its contrast, reachability, overflow, stack and motion
   are measured in real Chromium with the others (test/layout). */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, build, loadData, readJSON, writeJSON, copyFixture, boot, wait, basic, openSettings } = require('../lib/helpers');

const SCOPE = ':root[data-skin="signature"]';

/* A copy of the minimal fixture with franchise changes and an optional stylesheet. */
function withSig(label, fr, css) {
  const dir = copyFixture('minimal', label), p = path.join(dir, 'dataset.json'), ds = readJSON(p);
  Object.assign(ds.franchise, fr);
  writeJSON(p, ds);
  if (css !== undefined) fs.writeFileSync(path.join(dir, 'signature.css'), css);
  const b = build(p, { label: label + '-out' });
  return Object.assign(b, { D: b.status === 0 ? loadData(b.out) : null, dir });
}
const sig = (extra) => ({ signature: Object.assign({ name: 'Demo', tokens: { '--accent-h': 176 } }, extra || {}) });
const styled = css => withSig('sig-css', sig({ stylesheet: 'signature.css' }), css);

module.exports = async function (t) {
  // ---------------------------------------------------------------- the demo in the basic fixture
  const b = basic(), D = loadData(b.out);
  t.eq('the basic fixture carries a demo signature skin, named from config', D.signature && D.signature.name, 'Signal');
  const css = D.signature.css;
  t.ok('its CSS starts with its font, which swaps (never invisible text)', /^@font-face \{ font-family: 'Fixture Signal';[^}]*font-display: swap;[^}]*src: url\('\.\/fonts\/ibm-plex-mono-500-latin\.woff2'\)/.test(css), css.slice(0, 200));
  t.ok('…then one token block, scoped to the signature skin', css.split(SCOPE + ' {').length === 2 && /--accent-h: 176;/.test(css));
  const sels = (css.replace(/@font-face \{[^}]*\}/g, '').match(/(^|\})\s*([^{}]+)\{/g) || []).map(x => x.replace(/^\}?\s*/, '').replace(/\{$/, '').trim());
  t.ok('every selector in it is scoped to ' + SCOPE + ' (' + sels.length + ' rules)', sels.length >= 5 &&
       sels.every(s => s.split(',').every(p => p.trim().startsWith(SCOPE))), sels.join(' | '));
  t.ok('…with no !important and no literal colour', !/!important|#[0-9a-f]{3}/i.test(css));
  t.ok('the skin\'s font is precached (it lives in fonts/)', D.precache.includes('./fonts/ibm-plex-mono-500-latin.woff2'));
  {
    const dir = copyFixture('basic', 'sig-order'), p = path.join(dir, 'dataset.json'), ds = readJSON(p);
    const tk = ds.franchise.signature.tokens;
    ds.franchise.signature.tokens = Object.fromEntries(Object.keys(tk).reverse().map(k => [k, tk[k]]));
    writeJSON(p, ds);
    const r = build(p, { label: 'sig-order-out' });
    t.ok('the order tokens are written in never changes the output (read by name)', r.status === 0 &&
         fs.readFileSync(path.join(r.out, 'data.js'), 'utf8') === fs.readFileSync(path.join(b.out, 'data.js'), 'utf8'), r.stderr);
  }
  const none = withSig('sig-none', {});
  t.ok('a tracker without one has no signature skin', none.status === 0 && none.D.signature === null, none.stderr);
  const tokensOnly = withSig('sig-tokens', sig());
  t.ok('tokens alone are a signature skin (no font, no stylesheet)', tokensOnly.status === 0 &&
       tokensOnly.D.signature.css === SCOPE + ' {\n  --accent-h: 176;\n}\n', tokensOnly.stderr + JSON.stringify(tokensOnly.D && tokensOnly.D.signature));
  const rich = styled([SCOPE + ' .phead { background-image: linear-gradient(to right, var(--accent-wash), transparent), url(./icons/icon-192.png);',
    '  border-bottom: 2px dashed hsl(var(--accent-h) var(--accent-s) var(--l-accent)); text-shadow: 0 1px 0 var(--card); }',
    SCOPE + '[data-table="1"] .row .title, ' + SCOPE + ' .bname { font-family: \'Fixture Face\', var(--font-body, serif); letter-spacing: -.01em;',
    '  text-transform: uppercase; border-radius: 0 var(--radius) 0 0; --l-accent: 30%; }'].join('\n'));
  t.ok('a look-only stylesheet passes: gradients and colours from tokens, a precached image, borders, shadows, fonts, radii, an input token',
       rich.status === 0, rich.stderr);

  {
    // a background image of the skin's own lives in images/: allowed, and precached so it works offline
    const dir = path.join(ROOT, 'images'), made = !fs.existsSync(dir), img = path.join(dir, 'harness-texture.png');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'icons', 'icon-192.png'), img);
      const r = styled(SCOPE + ' .phead { background-image: url(./images/harness-texture.png); }');
      t.ok('a background image in images/ is accepted and precached (offline)', r.status === 0 && r.D.precache.includes('./images/harness-texture.png'), r.stderr);
    } finally {
      fs.rmSync(img, { force: true });
      if (made) fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------- what the build refuses
  const refuse = (what, r, rx) => t.ok(what + ' fails the build', r.status === 1 && rx.test(r.stderr), r.stderr.split('\n')[0]);
  refuse('an unknown token', withSig('sig-x', sig({ tokens: { '--nope': 1 } })), /--nope is not a known input token/);
  for (const owned of ['--scale', '--era-h0', '--font-body', '--tap', '--row-pad', '--paper-h', '--stack-h', '--motion'])
    refuse('a token a Look setting or the page owns (' + owned + ')', withSig('sig-own', sig({ tokens: { [owned]: 1 } })), new RegExp(owned + ' is not a known input token'));
  refuse('a literal colour as a token value', withSig('sig-x', sig({ tokens: { '--l-accent': '#123456' } })), /a literal colour/);
  refuse('a named colour as a token value', withSig('sig-x', sig({ tokens: { '--font-mono': 'red' } })), /'red' is not a look keyword/);
  refuse('a missing name', withSig('sig-x', { signature: { tokens: { '--accent-h': 1 } } }), /signature\.name must be/);
  refuse('a font file that does not exist', withSig('sig-x', sig({ fonts: [{ family: 'X Face', file: 'fonts/nope.woff2' }] })), /fonts\[0\]\.file must be a \.woff2 in fonts\//);
  refuse('a font outside fonts/ (not precached)', withSig('sig-x', sig({ fonts: [{ family: 'X Face', file: 'icons/icon-192.png' }] })), /fonts\[0\]\.file must be/);
  refuse('a missing stylesheet', withSig('sig-x', sig({ stylesheet: 'nope.css' })), /stylesheet: missing file nope\.css/);
  refuse('an at-rule (@media)', styled('@media (min-width: 1px) { ' + SCOPE + ' .a { color: var(--ink); } }'), /at-rules and nesting are not allowed/);
  refuse('one unscoped part of a selector list', styled(SCOPE + ' .a, .b { color: var(--ink); }'), /selector '\.b' is not scoped/);
  refuse('a look-alike scope', styled(':root[data-skin="signature"].x .a { color: var(--ink); }'), /is not scoped/);
  refuse('!important', styled(SCOPE + ' .a { color: var(--ink) !important; }'), /!important is not allowed/);
  refuse('a named colour', styled(SCOPE + ' .a { color: red; }'), /'red' is not a look keyword/);
  refuse('rgb()', styled(SCOPE + ' .a { color: rgb(var(--r) var(--g) var(--b)); }'), /rgb\(\) is not allowed/);
  refuse('a literal alpha in a token colour', styled(SCOPE + ' .a { color: hsl(var(--ink-h) var(--ink-s) var(--l-ink) / .5); }'), /a literal colour/);
  for (const [prop, val] of [['display', 'none'], ['visibility', 'hidden'], ['margin', '0'], ['width', '10px'], ['height', '10px'], ['inset', '0'],
                             ['top', '0'], ['order', '2'], ['flex', '1'], ['grid-template-columns', '1fr'], ['float', 'left'], ['z-index', '3'],
                             ['transform', 'none'], ['opacity', '0'], ['content', 'none']])
    refuse('"' + prop + '" (moves or hides things)', styled(SCOPE + ' .a { ' + prop + ': ' + val + '; }'), new RegExp('\\{ ' + prop + ' \\}: refused'));
  refuse('a property that isn\'t a look (cursor, transition)', styled(SCOPE + ' .a { cursor: pointer; }'), /\{ cursor \}: not a look property/);
  refuse('a transition (motion stays with the reduced-motion token)', styled(SCOPE + ' .a { transition: color 1s; }'), /\{ transition \}: not a look property/);
  refuse('a setting-owned token in a rule', styled(SCOPE + ' .a { --row-pad: 2px; }'), /\{ --row-pad \}: not a known input token/);
  refuse('an image that isn\'t in the repo', styled(SCOPE + ' .a { background-image: url(./images/nope.png); }'), /must name a file in fonts\/, icons\/, images\//);
  refuse('url() outside background-image', styled(SCOPE + ' .a { border-image: url(./icons/icon-192.png); }'), /border-image \}: not a look property/);
  refuse('a legacy skin map pointing at a skin the tracker doesn\'t offer',
         withSig('sig-x', { storage: { legacy: { prefix: 'm:v1:', format: 'v2', skins: { field: 'layout', map: { pull: 'pull' } } } } }), /maps to 'pull', which this tracker does not offer/);
  refuse('a legacy map to the signature skin when there is none',
         withSig('sig-x', { storage: { legacy: { prefix: 'm:v1:', format: 'v2', skins: { field: 'layout', map: { abs: 'signature' } } } } }), /maps to 'signature'/);

  // ---------------------------------------------------------------- decorations (John, 8 Oct)
  /* ::before and ::after may carry content (quoted text, attr(data-n), counters),
     counters may run anywhere, and a pseudo-element may be placed absolutely
     against its host. The build adds an empty alternative (silent to screen
     readers) and pointer-events: none to every decoration. Nothing else that
     moves, hides or reorders a control is allowed, on a pseudo-element or not. */
  const pseudoRules = css.split('\n}').filter(r => /::(before|after)\s*\{/.test(r));
  t.ok('the demo skin decorates: ' + pseudoRules.length + ' ::before/::after rules (row numbers, an arc prefix, era numerals, bracket marks)',
       pseudoRules.length >= 6 && /\.row::after \{[^}]*content: attr\(data-n\);/.test(css) && /\.mark::after \{[^}]*content: "\[ \]";/.test(css));
  t.ok('…every one silent to screen readers: the build adds the empty alternative after each content', pseudoRules.every(r => {
    const cs = r.match(/content: [^;]+;/g) || [];
    return cs.every(c => /content: none;/.test(c) || cs.includes(c.replace(/;$/, ' / "";')) || / \/ "";$/.test(c));
  }) && (css.match(/content: attr\(data-n\) \/ "";/g) || []).length >= 1, pseudoRules.find(r => !/\/ ""/.test(r) && !/content: none/.test(r)));
  t.ok('…and never takes a tap: the build adds pointer-events: none to every one', pseudoRules.every(r => /pointer-events: none;/.test(r)));
  t.ok('…while the demo\'s ordinary rules get no pointer-events of their own', css.split('\n}').filter(r => !/::(before|after)\s*\{/.test(r)).every(r => !/pointer-events/.test(r)));
  const decor = styled([SCOPE + ' .era { counter-increment: era; }', SCOPE + ' #app { counter-reset: era 0 row; }',
    SCOPE + ' .era-head .bname::before { content: counter(era, decimal-leading-zero) ". "; color: var(--accent); }',
    SCOPE + ' .row::after { content: attr(data-n); position: absolute; top: 0; right: -2px; width: 2em; height: auto; text-align: right; white-space: nowrap; }',
    SCOPE + '[data-table="1"] .row::after { content: none; }', SCOPE + ' .mark { font-size: 0; }', SCOPE + ' .mark::after { content: \'[X]\'; }'].join('\n'));
  t.ok('decorations pass: counters anywhere, counter() and attr(data-n) content, an absolutely placed pseudo-element, a glyph mark', decor.status === 0, decor.stderr);
  const dec = (rule) => styled(SCOPE + ' ' + rule);
  for (const [what, rule, rx] of [
    ['content on an ordinary element', '.a { content: "x"; }', /\{ content \}: refused — only a ::before or ::after decoration may have content/],
    ['position on an ordinary element', '.a { position: absolute; }', /\{ position \}: refused — only a ::before or ::after decoration may have position/],
    ['a decoration placed fixed', '.a::after { content: "x"; position: fixed; }', /placed absolutely or not at all/],
    ['a decoration placed relative (the sticky trap)', '.a::before { content: "x"; position: relative; }', /placed absolutely or not at all/],
    ['a decoration raised over the page (z-index)', '.a::after { content: "x"; z-index: 5; }', /\{ z-index \}: refused/],
    ['a decoration that hides (display)', '.a::after { display: none; }', /\{ display \}: refused/],
    ['a decoration that fades (opacity)', '.a::after { content: "x"; opacity: .5; }', /\{ opacity \}: refused/],
    ['a decoration that moves (transform)', '.a::after { content: "x"; transform: translateX(4px); }', /\{ transform \}: refused/],
    ['a decoration with margins', '.a::before { content: "x"; margin-left: 4px; }', /\{ margin-left \}: refused/],
    ['an image as content', '.a::after { content: url(./icons/icon-192.png); }', /content may hold only quoted text/],
    ['any other attribute as content', '.a::after { content: attr(title); }', /attr\(title\): only data-n/],
    ['a hand-written alternative', '.a::after { content: "x" / "y"; }', /content may hold only quoted text/],
    ['an unknown counter style', '.a::after { content: counter(x, fancy); }', /counter style 'fancy'/],
    ['a counter list that isn\'t one', '.a { counter-reset: 5; }', /a counter list/],
    ['a decoration on a selector list where one part is ordinary', '.a::after, ' + SCOPE + ' .b { content: "x"; }', /\{ content \}: refused/]])
    refuse(what, dec(rule), rx);

  // ---------------------------------------------------------------- the app
  const ns = D.franchise.key + ':v3:', oldKey = D.franchise.storage.legacy.prefix + 'settings';
  const seen = { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' } }) };
  let app = boot(b.out, { css: true, storage: seen });
  await wait(20);
  let d = app.document;
  const styles = d.querySelectorAll('style#skin-signature');
  t.ok('the app adds the signature CSS once, as it came from the build', styles.length === 1 && styles[0].textContent === css);
  t.eq('…and opens in it on a first visit', d.documentElement.getAttribute('data-skin'), 'signature');
  t.ok('…without tripping the stale-styles beacon (it only reads the page\'s own stylesheet)', !/out of date/.test(d.querySelector('#toastMsg').textContent));
  d.querySelector('.ptools [data-act="expand-all"]').click();
  const padTo = (n, w) => String(n).padStart(w, '0'), rw = Math.max(2, String(D.issues.length).length);
  const rowsN = [...d.querySelectorAll('.row[data-i]')];
  t.ok('every row carries its reading position for decorations (data-n, zero-padded to the list\'s width), inert rows too',
       rowsN.length > 10 && rowsN.some(r => r.classList.contains('inert')) && rowsN.every(r => r.dataset.n === padTo(+r.dataset.i + 1, rw)), rowsN.slice(0, 3).map(r => r.dataset.n).join());
  t.eq('…and every era name its number', [...d.querySelectorAll('.era-head .bname')].map(x => x.dataset.n), D.eras.map((e, k) => padTo(k + 1, 2)));
  app.window.close();

  const firstVisit = async (old, extra) => {
    const storage = Object.assign({}, extra || {});
    if (old !== undefined) storage[oldKey] = old;
    const a = boot(b.out, { storage });
    await wait(20);
    const skin = a.document.documentElement.getAttribute('data-skin');
    await wait(450);
    const after = a.window.localStorage.getItem(oldKey);
    a.window.close();
    return { skin, after };
  };
  let r = await firstVisit(JSON.stringify({ layout: 'pull', other: 1 }));
  t.eq('a first visit takes the old tracker\'s pick through the data\'s map (layout "pull" → Pull)', r.skin, 'pull');
  t.eq('…and never writes the old tracker\'s settings', r.after, JSON.stringify({ layout: 'pull', other: 1 }));
  t.eq('the old default ("tabs", saved even when nobody chose it) maps to the signature skin', (await firstVisit(JSON.stringify({ layout: 'tabs' }))).skin, 'signature');
  t.eq('the old signature look ("sig") maps to the signature skin', (await firstVisit(JSON.stringify({ layout: 'sig' }))).skin, 'signature');
  t.eq('a value the map doesn\'t list falls back to the signature skin', (await firstVisit(JSON.stringify({ layout: 'classic' }))).skin, 'signature');
  t.eq('unreadable old settings fall back to the signature skin', (await firstVisit('{not json')).skin, 'signature');
  t.eq('the last skin used wins over the old pick on every later visit',
       (await firstVisit(JSON.stringify({ layout: 'pull' }), { [ns + 'settings']: JSON.stringify({ v: 3, migrated: { format: 'v2' }, skin: 'night' }) })).skin, 'night');

  const noSig = (() => {
    const dir = copyFixture('basic', 'sig-legacy'), p = path.join(dir, 'dataset.json'), ds = readJSON(p);
    delete ds.franchise.signature;
    Object.assign(ds.franchise, { skin: 'newsprint' });
    ds.franchise.storage.legacy.skins = { field: 'layout', map: { pull: 'pull' } };
    writeJSON(p, ds);
    return build(p, { label: 'sig-legacy-out' });
  })();
  const visit = async (dir, old) => {
    const a = boot(dir, { storage: old ? { [oldKey]: old } : {} });
    await wait(20);
    const out = [a.document.documentElement.getAttribute('data-skin'), !!a.document.querySelector('#skin-signature')];
    openSettings(a, ['look']);
    out.push([...a.document.querySelectorAll('[data-act="look"][data-k="skin"]')].map(x => x.dataset.v).join(','));
    a.window.close();
    return out;
  };
  t.eq('no signature skin: the old pick still applies through the map', await visit(noSig.out, JSON.stringify({ layout: 'pull' })),
       ['pull', false, 'paper,newsprint,pull,night']);
  t.eq('…and an unmapped value falls back to the configured skin', (await visit(noSig.out, JSON.stringify({ layout: 'tabs' }))).slice(0, 2), ['newsprint', false]);
  const pair = withSig('sig-pair', Object.assign(sig(), { skins: ['night'] }));
  t.eq('a signature skin and one shared skin: the skin control appears with both (data-driven visibility)', await visit(pair.out),
       ['signature', true, 'signature,night']);
  t.eq('a tracker without one: no signature CSS, no signature option', await visit(none.out), ['paper', false, '']);
};
