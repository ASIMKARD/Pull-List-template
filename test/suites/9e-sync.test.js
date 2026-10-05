/* Sync and backup (session 3, step 8; decided 3 Oct, QR compression added at
   approval).
   - QR (compact): version, franchise prefix, dataVersion hash, 2-bit marks in
     the current row order (run-length or raw, whichever is smaller) and
     bookmark positions. Small for realistic progress; a different list is
     refused; over capacity falls back cleanly to the copy-code.
   - Full (copy-code, #sync= link, file): id-keyed, change-tolerant JSON.
   - Merge (never downgrades a read mark) or Replace (exact, snapshotted, Undo).
   - Old v2 codes: positions rebuilt from legacy ids plus retiredIds. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, FIX, build, loadData, readJSON, writeJSON, copyFixture, boot, wait, tmpdir, basic, mixed, stress, openSettings } = require('../lib/helpers');

const NOW = Date.UTC(2026, 0, 1);
const QR_SRC = fs.readFileSync(path.join(ROOT, 'qrcode.js'), 'utf8');
/* The real qrcode.js in a vm: type 0 picks the smallest version, level L; it
   throws past capacity. */
function qrVersion(text) {
  const ctx = {};
  vm.runInNewContext(QR_SRC + '\n;this.qr = qrcode;', ctx);
  const q = ctx.qr(0, 'L');
  q.addData(text);
  q.make();
  return (q.getModuleCount() - 17) / 4;
}
const b64urlBytes = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
/* Order-insensitive equality: maps compare by content, not key order. */
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v;

module.exports = async function (t) {
  const same = (name, a, b) => t.eq(name, canon(a), canon(b));
  // --------------------------------------------------- 5,000 rows: QR size
  const big = stress(), Dg = loadData(big.out), nsg = Dg.franchise.key + ':v3:';
  const realistic = {};
  Dg.ids.forEach((id, i) => { if (i < 1200) realistic[id] = 'read'; });
  [300, 800, 1500, 2600, 4000].forEach(i => { realistic[Dg.ids[i]] = 'skip'; });
  realistic[Dg.ids[1200]] = 'reading';
  const bms = [Dg.ids[1201], Dg.ids[2500], Dg.ids[4999]];
  let app = boot(big.out, { now: NOW, storage: { [nsg + 'progress']: JSON.stringify({ marks: realistic, bookmarks: bms }) } });
  await wait(20);
  let codes = app.window.PullList.syncCodes();
  t.ok('the QR code carries the franchise prefix, the version and the dataVersion (D-7)', codes.qr.startsWith('BIG:q3.' + Dg.dataVersion + '.'));
  t.ok('the QR holds it as a #sync= link, so a camera scan opens the tracker', codes.qrText === 'https://tracker.local/#sync=' + codes.qr);
  const v1 = qrVersion(codes.qrText);
  t.ok('5,000 rows of realistic progress (1,200 read, a few skips) make a QR of version 15 or below (' + v1 + ', ' + codes.qrText.length + ' chars)', v1 <= 15);
  const payload = b64urlBytes(codes.qr.split('.').pop());
  t.ok('realistic progress is run-length encoded (mode 1)', payload[0] === 1);
  let back = app.window.PullList.readCode(codes.qrText);
  same('…and round-trips exactly: every mark', back.data.marks, realistic);
  t.eq('…and every bookmark', back.data.bookmarks.slice().sort(), bms.slice().sort());
  // the same states packed raw (mode 2) decode identically, and are bigger
  const states = Dg.ids.map(id => ({ unread: 0, read: 1, reading: 2, skip: 3 })[realistic[id] || 'unread']);
  const raw = [2];
  let n = Dg.ids.length; while (n > 127) { raw.push((n % 128) + 128); n = Math.floor(n / 128); } raw.push(n);
  for (let i = 0; i < states.length; i += 4) raw.push(states[i] | (states[i + 1] || 0) << 2 | (states[i + 2] || 0) << 4 | (states[i + 3] || 0) << 6);
  raw.push(0);
  const rawCode = 'BIG:q3.' + Dg.dataVersion + '.' + Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  t.ok('the encoder chose the smaller encoding (run-length beats raw here)', payload.length < raw.length, payload.length + ' vs ' + raw.length);
  same('raw packing of the same marks decodes identically', app.window.PullList.readCode(rawCode).data.marks, realistic);
  app.window.close();

  const mixedMarks = {};
  Dg.ids.forEach((id, i) => { const s = ['unread', 'read', 'reading', 'skip'][(i * 7 + (i >> 3)) % 4]; if (s !== 'unread') mixedMarks[id] = s; });
  app = boot(big.out, { now: NOW, storage: { [nsg + 'progress']: JSON.stringify({ marks: mixedMarks, bookmarks: bms }) } });
  await wait(20);
  codes = app.window.PullList.syncCodes();
  let v2 = null;
  try { v2 = qrVersion(codes.qrText); } catch (e) { v2 = 'overflow'; }
  t.ok('5,000 rows of mixed marks (all four states) still fit in a QR (' + v2 + ')', typeof v2 === 'number' && v2 <= 40);
  t.ok('mixed marks pack raw (mode 2): the smaller encoding', b64urlBytes(codes.qr.split('.').pop())[0] === 2);
  back = app.window.PullList.readCode(codes.qrText);
  same('…and round-trip exactly', back.data.marks, mixedMarks);
  app.window.close();

  // --------------------------------- 10,000 rows, worst case: clean fallback
  const huge = stress(80, 125), Dh = loadData(huge.out), nsh = Dh.franchise.key + ':v3:';
  const alt = {};
  Dh.ids.forEach((id, i) => { if (i % 2) alt[id] = 'read'; });
  app = boot(huge.out, { now: NOW, storage: { [nsh + 'progress']: JSON.stringify({ marks: alt, bookmarks: [] }) } });
  let d = app.document;
  await wait(20);
  openSettings(app, ['backup']);
  d.querySelector('[data-act="sync-show"]').click();
  const sc = d.querySelector('script[data-qr]');
  t.ok('the QR maker loads on demand, only when asked for', !!sc && /qrcode\.js$/.test(sc.getAttribute('src')));
  app.window.eval(QR_SRC);
  sc.dispatchEvent(new app.window.Event('load'));
  const box = d.querySelector('#qrbox'), fullOut = d.querySelector('#syncOut').value;
  if (box.querySelector('svg')) {
    t.ok('10,000 alternating marks: it fit, and round-trips', JSON.stringify(app.window.PullList.readCode(app.window.PullList.syncCodes().qrText).data.marks) === JSON.stringify(alt));
  } else {
    t.ok('10,000 alternating marks overflow a QR: a clear message, no QR drawn', /Too much progress for a QR code: use the copy-code/.test(box.textContent) && box.getAttribute('data-version') === '');
    t.ok('…and the copy-code is right there and round-trips', fullOut.startsWith('BIG:s3.') && JSON.stringify(app.window.PullList.readCode(fullOut).data.marks) === JSON.stringify(alt));
  }
  t.ok('no runtime errors (10,000 rows)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // --------------------------------------------- basic: the UI and the rules
  const b = basic(), D = loadData(b.out), ns = D.franchise.key + ':v3:';
  const baseSettings = { v: 3, migrated: { format: 'v2' } };
  const A = {
    progress: { marks: { 'fixture-hero-1980-1': 'read', 'fixture-hero-1980-2': 'reading', 'fixture-hero-1980-3': 'skip' }, bookmarks: ['fixture-hero-1980-4'] },
    reviews: { origins: { r: 5, t: 'Device A notes.' } },
    settings: Object.assign({}, baseSettings, { pace: { minutes: 25, weekly: 5 }, filters: { mandatory: true }, presets: [{ name: 'A', filters: { unread: true }, order: 'reading', events: 'essential' }] })
  };
  const store = st => ({ [ns + 'progress']: JSON.stringify(st.progress), [ns + 'reviews']: JSON.stringify(st.reviews), [ns + 'settings']: JSON.stringify(st.settings) });
  app = boot(b.out, { now: NOW, storage: store(A) });
  await wait(20);
  const codeA = app.window.PullList.syncCodes();
  t.ok('the copy-code is the full id-keyed format with this tracker\'s prefix', codeA.full.startsWith('FIXTURE:s3.'));
  const flush = a => { a.window.dispatchEvent(new a.window.Event('pagehide')); };
  flush(app);
  const savedA = { progress: JSON.parse(app.window.localStorage.getItem(ns + 'progress')), reviews: JSON.parse(app.window.localStorage.getItem(ns + 'reviews')),
                   settings: JSON.parse(app.window.localStorage.getItem(ns + 'settings')) };
  // file export: capture the download
  let href = null, fileName = null;
  app.window.HTMLAnchorElement.prototype.click = function () { href = this.href; fileName = this.download; };
  openSettings(app, ['backup']);
  app.document.querySelector('[data-act="backup-export"]').click();
  t.ok('Export backup downloads <key>-backup-YYYY-MM-DD.json', fileName === 'fixture-backup-2026-01-01.json', fileName);
  const fileJson = decodeURIComponent(href.replace(/^data:application\/json;charset=utf-8,/, ''));
  t.ok('…holding the full format', JSON.parse(fileJson).format === 'pull-list-backup' && JSON.parse(fileJson).key === 'fixture');
  t.ok('no runtime errors (device A)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // device B: different state; paste A's code; Merge
  const B = { progress: { marks: { 'fixture-hero-1980-1': 'reading', 'fixture-hero-1980-2': 'read', 'fixture-hero-1980-5': 'read' }, bookmarks: [] },
              reviews: {}, settings: Object.assign({}, baseSettings) };
  app = boot(b.out, { now: NOW, storage: store(B) });
  d = app.document;
  await wait(20);
  const $ = q => d.querySelector(q);
  const stored = () => { flush(app); return { progress: JSON.parse(app.window.localStorage.getItem(ns + 'progress')), reviews: JSON.parse(app.window.localStorage.getItem(ns + 'reviews') || '{}'),
                                              settings: JSON.parse(app.window.localStorage.getItem(ns + 'settings')) }; };
  const savedB = stored();
  $('#tab-settings').click();
  const openBackup = () => { const h = $('.sec-head[data-g="s"][data-k="backup"]'); if (h.getAttribute('aria-expanded') !== 'true') h.click(); };
  const paste = text => { openBackup(); $('#syncIn').value = text; $('[data-act="sync-read"]').click(); };
  paste(codeA.full);
  t.ok('reading a code previews what it holds before anything changes', /A backup: 3 marks, 1 bookmark, 1 review\./.test($('.syncpend').textContent) &&
       JSON.stringify(stored().progress) === JSON.stringify(savedB.progress));
  $('[data-act="sync-merge"]').click();
  const m1 = stored().progress.marks;
  t.ok('Merge never downgrades a read mark (#2 stays read, not "reading")', m1['fixture-hero-1980-2'] === 'read');
  t.ok('…brings in what is new (#3 skip) and upgrades the rest (#1 reading → read)', m1['fixture-hero-1980-3'] === 'skip' && m1['fixture-hero-1980-1'] === 'read');
  t.ok('…keeps marks only this device had (#5)', m1['fixture-hero-1980-5'] === 'read');
  t.ok('…adds bookmarks and fills in reviews', stored().progress.bookmarks.includes('fixture-hero-1980-4') && stored().reviews.origins.t === 'Device A notes.');
  t.ok('…and says what it did, including the read mark it kept', /Merged 2 marks, 1 bookmark, 1 review\. Kept 1 read mark you already had\./.test($('#toastMsg').textContent),
       $('#toastMsg').textContent);
  app.window.close();

  // Replace restores exactly; Undo restores the previous state exactly
  app = boot(b.out, { now: NOW, storage: store(B) });
  d = app.document;
  await wait(20);
  $('#tab-settings').click();
  paste(codeA.full);
  $('[data-act="sync-replace-ask"]').click();
  t.ok('Replace asks first, in the page', !!$('[data-act="sync-replace-yes"]') && !!$('[data-act="sync-replace-no"]'));
  $('[data-act="sync-replace-yes"]').click();
  const afterReplace = stored();
  same('Replace restores the backup exactly: progress', afterReplace.progress, savedA.progress);
  same('…reviews', afterReplace.reviews, savedA.reviews);
  same('…and settings (pace, filters, presets), exactly as exported', afterReplace.settings, savedA.settings);
  t.ok('…and the figures follow (mandatory-only filter and 25 min pace now applied)', $$q(d, '#fchips .chip').some(c => /Mandatory only/.test(c.textContent)));
  t.ok('…with Undo offered', $('#toastAct').textContent === 'Undo');
  $('#toastAct').click();
  const undone = stored();
  same('Undo after Replace restores the previous progress exactly', undone.progress, savedB.progress);
  same('…reviews', undone.reviews, savedB.reviews);
  same('…and settings', undone.settings, Object.assign({}, savedB.settings, { tab: 'settings', settingsOpen: ['backup'] }));   // where you were: the tab and the open section
  // Undo after Clear all (the same snapshot path)
  openSettings(app, ['data']);
  $('[data-act="clear-ask"]').click();
  $('[data-act="clear-yes"]').click();
  t.ok('Clear all empties the marks', Object.keys(stored().progress.marks).length === 0);
  $('#toastAct').click();
  same('Undo after Clear all restores the previous state exactly', stored().progress, savedB.progress);

  // the QR code: same list round-trips; a different list is refused, nothing changes
  paste(codeA.qrText || app.window.PullList.syncCodes().qrText);
  t.ok('a QR code from the same list is read (positions line up)', !!$('.syncpend') && /A QR code: 3 marks, 1 bookmark\./.test($('.syncpend').textContent));
  const tampered = codeA.qr.replace(D.dataVersion, 'ffffffffffff');
  paste(tampered);
  t.ok('a QR code from a different list is refused, pointing to the code or file', /different version of this list/.test($('.syncerr').textContent) &&
       /copy-code or a backup file/.test($('.syncerr').textContent) && !$('.syncpend'));
  same('…and nothing changed', stored().progress, savedB.progress);
  paste('OTHER:s3.eyJ2IjozfQ');
  t.ok('a code from another tracker is refused', /different tracker/.test($('.syncerr').textContent));
  paste(mixedFullCode());
  t.ok('…including a real one (the mixed fixture\'s code)', /different tracker/.test($('.syncerr').textContent));

  // file import round-trip
  const input = $('#importFile');
  Object.defineProperty(input, 'files', { value: [new app.window.File([fileJson], 'fixture-backup-2026-01-01.json', { type: 'application/json' })] });
  input.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  await wait(60);
  t.ok('Import from file reads the backup and previews it', /A backup: 3 marks/.test(($('.syncpend') || { textContent: '' }).textContent));
  $('[data-act="sync-replace-ask"]').click();
  $('[data-act="sync-replace-yes"]').click();
  same('…and Replace from the file restores device A exactly', stored().progress, savedA.progress);
  t.ok('no runtime errors (device B)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // #sync= on open: merges, reports, clears the link
  app = boot(b.out, { now: NOW, url: 'https://tracker.local/#sync=' + codeA.full, storage: store(B) });
  d = app.document;
  await wait(20);
  t.ok('a #sync= link imports on open and merges (XM-6)', stored().progress.marks['fixture-hero-1980-3'] === 'skip' && stored().progress.marks['fixture-hero-1980-2'] === 'read');
  t.ok('…reporting what came in', /^Merged 2 marks/.test(d.querySelector('#toastMsg').textContent), d.querySelector('#toastMsg').textContent);
  t.ok('…and clears the link so a reload does not import again', app.window.location.hash === '');
  app.window.close();
  app = boot(b.out, { now: NOW, url: codeA.qrText, storage: store(B) });
  await wait(20);
  t.ok('scanning the QR (a #sync= link with the compact code) merges too', stored().progress.marks['fixture-hero-1980-3'] === 'skip');
  app.window.close();

  // tolerant: rows added since, and ids that left the list
  const grown = copyFixture('basic', 'sync-grown');
  const eraFile = path.join(grown, 'data', 'eras', '5000-dawn.json'), ef = readJSON(eraFile);
  ef.rows.push({ issueId: 'late-addition-1982-1', series: 'Late Addition', vol: '1982', num: '1', title: 'Late Addition (1982) #1', arc: ef.rows[0].arc,
                 date: { cover: '1982-12', source: 'fixture ledger (invented)' } });
  writeJSON(eraFile, ef);
  const gb = build(path.join(grown, 'dataset.json'), { label: 'sync-grown-out' }), Dgr = loadData(gb.out);
  t.ok('the grown list has a new dataVersion', gb.status === 0 && Dgr.dataVersion !== D.dataVersion, gb.stderr);
  const withGhost = JSON.parse(Buffer.from(codeA.full.slice('FIXTURE:s3.'.length).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  withGhost.marks['row-that-left-the-list'] = 'read';
  const ghostCode = 'FIXTURE:s3.' + Buffer.from(JSON.stringify(withGhost), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  app = boot(gb.out, { now: NOW, storage: { [ns + 'settings']: JSON.stringify(baseSettings) } });
  d = app.document;
  await wait(20);
  openSettings(app, ['backup']);
  d.querySelector('#syncIn').value = codeA.qr;
  d.querySelector('[data-act="sync-read"]').click();
  t.ok('the old list\'s QR code is refused on the grown list', /different version of this list/.test(d.querySelector('.syncerr').textContent));
  d.querySelector('#syncIn').value = ghostCode;
  d.querySelector('[data-act="sync-read"]').click();
  d.querySelector('[data-act="sync-merge"]').click();
  flush(app);
  const gm = JSON.parse(app.window.localStorage.getItem(ns + 'progress')).marks;
  t.ok('the full code still applies after the list grew (X-3, B-4)', gm['fixture-hero-1980-1'] === 'read' && gm['fixture-hero-1980-3'] === 'skip');
  t.ok('…the new row starts unread', !gm['late-addition-1982-1']);
  t.ok('…and an id that left the list is ignored and reported', !gm['row-that-left-the-list'] && /1 no longer in the list/.test(d.querySelector('#toastMsg').textContent));
  t.ok('no runtime errors (grown list)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ------------------------------- old v2 codes, with a retired id mid-list
  const v2dir = tmpdir('v2qr'), base = readJSON(path.join(FIX, 'broken', '_valid', 'dataset.json'));
  base.franchise.storage = { legacy: { prefix: 'probe-old:v1:', format: 'v2', qrPrefix: 'PROB1:' } };
  base.retiredIds = ['199001003'];
  base.rows = [1, 2, 4, 5, 6].map(k => ({ id: '19900100' + k, issueId: 'probe-1990-' + k, series: 'Probe', vol: '1990', num: String(k),
    title: 'Probe (1990) #' + k, era: k < 4 ? 'one' : 'two', arc: k < 4 ? 'a' : 'b', date: { cover: '1990-0' + k, source: 'fixture ledger (invented)' } }));
  writeJSON(path.join(v2dir, 'dataset.json'), base);
  const pb = build(path.join(v2dir, 'dataset.json'), { label: 'v2qr-out' });
  t.ok('a migrated list with a retired id builds, and carries retiredIds', pb.status === 0 && JSON.stringify(loadData(pb.out).retiredIds) === '["199001003"]', pb.stderr);
  // the v2 encoding: positions in old key order, first row in the high bits
  const oldOrder = ['199001001', '199001002', '199001003', '199001004', '199001005', '199001006'];
  const oldStates = { '199001001': 1, '199001003': 1, '199001004': 3, '199001006': 2 };   // read, (retired) read, skip, reading
  const bytes = new Uint8Array(Math.ceil(oldOrder.length * 2 / 8));
  oldOrder.forEach((k, i) => { const v = oldStates[k] || 0, bit = i * 2; bytes[bit >> 3] |= v << (6 - (bit & 7)); });
  const v2body = { v: 1, d: '6-199001001-199001006', p: Buffer.from(bytes).toString('base64'), b: [199001005], s: {}, f: {}, r: { 199001005: { r: 4, t: 'Old note.' } } };
  const v2code = 'PROB1:' + Buffer.from(JSON.stringify(v2body), 'utf8').toString('base64');
  app = boot(pb.out, { now: NOW, storage: { 'broken-case:v3:settings': JSON.stringify({ v: 3, migrated: { format: 'v2' } }) } });
  const got = app.window.PullList.readCode(v2code).data;
  same('v2 code: every position after the retired id still lands on the right row', got.marks, { '199001001': 'read', '199001004': 'skip', '199001006': 'reading' });
  t.ok('…the retired row\'s mark is dropped', !('199001003' in got.marks));
  t.ok('…bookmarks and per-issue reviews come across (reviews mapped to arcs)', got.bookmarks[0] === '199001005' && got.reviews.b.r === 4);
  let refused = '';
  try { app.window.PullList.readCode('PROB1:' + Buffer.from(JSON.stringify(Object.assign({}, v2body, { d: '5-199001001-199001006' })), 'utf8').toString('base64')); }
  catch (e) { refused = e.message; }
  t.ok('a v2 code from a different old list is refused', /different version of the old list/.test(refused), refused);
  app.window.close();

  function mixedFullCode() {
    const mx = mixed();
    const a = boot(mx.out, { now: NOW });
    const c = a.window.PullList.syncCodes().full;
    a.window.close();
    return c;
  }
  function $$q(doc, q) { return [...doc.querySelectorAll(q)]; }
};
