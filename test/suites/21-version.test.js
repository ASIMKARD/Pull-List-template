/* Readable versions (decided 4 Oct): the header says "v13", not a hash. The
   build counts the number up by itself from the previous data.js, +1 only when
   the content hash changed. The hash keeps its job: the cache name follows the
   content, never the number. A migrated tracker continues its old numbering
   through franchise.versionStart. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, BUILD, ROOT_DATASET, build, loadData, readJSON, writeJSON, copyFixture, tmpdir, boot, wait, openSettings } = require('../lib/helpers');

const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const cacheName = dir => (read(dir, 'sw.js').match(/const CACHE = '([^']+)'/) || [])[1];

module.exports = async function (t) {
  // ---- the first build uses versionStart (default 1) ----
  const root = build(path.join(ROOT, 'dataset.json'), { label: 'v-root' });
  const R = loadData(root.out);
  const start = ROOT_DATASET.franchise.versionStart || 1;
  t.eq('the root dataset starts at its versionStart (v' + start + '; the template demo has none, so v1)', R.version, start);
  t.ok('the report and the build line both name the version', root.report && root.report.version === start &&
       new RegExp('^built v' + start + ' \\(').test(root.stdout), root.stdout);

  const dir = copyFixture('minimal', 'v-min');
  const ds = path.join(dir, 'dataset.json');
  const src = readJSON(ds);
  src.franchise.versionStart = 13;
  writeJSON(ds, src);
  const out = tmpdir('v-min-out');
  const b1 = build(ds, { out });
  t.ok('a tracker with versionStart 13 builds', b1.status === 0, b1.stderr);
  const D1 = loadData(out), data1 = read(out, 'data.js'), sw1 = read(out, 'sw.js'), cache1 = cacheName(out);
  t.eq('…and its first build is v13', D1.version, 13);
  t.ok('the version is stamped after the hash: data.js holds both', /^[0-9a-f]{12}$/.test(D1.build) && Number.isInteger(D1.version));

  // ---- an unchanged rebuild keeps the number ----
  const b2 = build(ds, { out });
  t.ok('an unchanged rebuild succeeds', b2.status === 0, b2.stderr);
  t.eq('…keeps the number (v13)', loadData(out).version, 13);
  t.ok('…and every generated file is byte-identical', read(out, 'data.js') === data1 && read(out, 'sw.js') === sw1);

  // ---- --check is deterministic and never writes ----
  const chk = () => spawnSync('python3', [BUILD, ds, '--out', out, '--check'], { encoding: 'utf8', cwd: ROOT });
  const c1 = chk(), c2 = chk();
  t.ok('--check on a fresh build passes, twice, with the same output', c1.status === 0 && c2.status === 0 && c1.stdout === c2.stdout, c1.stderr);
  t.ok('…and names the version', /^fresh: v13, build [0-9a-f]{12} /.test(c1.stdout), c1.stdout);

  // ---- a content change adds exactly 1, and changes the cache name ----
  src.franchise.strapline = src.franchise.strapline + ' · changed';
  writeJSON(ds, src);
  const s1 = chk(), s2 = chk();
  t.ok('--check after a content change says STALE, twice (it never writes)', s1.status === 1 && s2.status === 1 &&
       /STALE: data\.js/.test(s1.stderr) && s1.stderr === s2.stderr && read(out, 'data.js') === data1, s1.stderr);
  const b3 = build(ds, { out });
  const D3 = loadData(out);
  t.ok('a content change rebuilds', b3.status === 0, b3.stderr);
  t.eq('…and adds exactly 1 (v14)', D3.version, 14);
  t.ok('…with a new hash and a new cache name', D3.build !== D1.build && cacheName(out) !== cache1 && cacheName(out) === D3.cache);
  t.eq('a rebuild after that keeps v14', (build(ds, { out }), loadData(out).version), 14);
  src.franchise.strapline += ' again';
  writeJSON(ds, src);
  build(ds, { out });
  t.eq('a second content change adds 1 more (v15)', loadData(out).version, 15);

  // ---- versionStart lifts the number, never lowers it, and never feeds the hash ----
  const before = loadData(out), swBefore = read(out, 'sw.js');
  src.franchise.versionStart = 40;
  writeJSON(ds, src);
  build(ds, { out });
  const D40 = loadData(out);
  t.eq('raising versionStart above the current number lifts it (v40)', D40.version, 40);
  t.ok('…without changing the hash, the cache name or sw.js (the cache follows the content, not the number)',
       D40.build === before.build && D40.cache === before.cache && read(out, 'sw.js') === swBefore);
  src.franchise.versionStart = 2;
  writeJSON(ds, src);
  build(ds, { out });
  t.eq('lowering versionStart never lowers the number', loadData(out).version, 40);
  {
    const a = tmpdir('v-hash-a'), b = tmpdir('v-hash-b');
    build(ds, { out: a });
    src.franchise.versionStart = 7;
    writeJSON(ds, src);
    build(ds, { out: b });
    t.ok('two first builds that differ only in versionStart share the hash and sw.js', loadData(a).build === loadData(b).build &&
         read(a, 'sw.js') === read(b, 'sw.js') && loadData(a).version === 2 && loadData(b).version === 7);
  }

  // ---- a data.js from before readable versions (no number) starts at versionStart ----
  {
    const o = tmpdir('v-legacy');
    build(ds, { out: o });
    const D = loadData(o);
    delete D.version;
    fs.writeFileSync(path.join(o, 'data.js'), 'window.TRACKER_DATA=' + JSON.stringify(D) + ';\n');
    build(ds, { out: o });
    t.eq('a previous data.js with no version starts the count at versionStart', loadData(o).version, 7);
  }

  // ---- versionStart must be a whole number, 1 or more ----
  for (const bad of [0, -3, 2.5, '8', true]) {
    const d = copyFixture('minimal', 'v-bad');
    const s = readJSON(path.join(d, 'dataset.json'));
    s.franchise.versionStart = bad;
    writeJSON(path.join(d, 'dataset.json'), s);
    const r = build(path.join(d, 'dataset.json'), { label: 'v-bad-out' });
    t.ok('versionStart ' + JSON.stringify(bad) + ' fails the build', r.status === 1 && /franchise\.versionStart must be a whole number/.test(r.stderr), r.stderr);
  }

  // ---- the app: the header shows "v13"; About shows the version and the hash ----
  const dir13 = copyFixture('minimal', 'v-app');
  const s13 = readJSON(path.join(dir13, 'dataset.json'));
  s13.franchise.versionStart = 13;
  writeJSON(path.join(dir13, 'dataset.json'), s13);
  const a13 = build(path.join(dir13, 'dataset.json'), { label: 'v-app-out' });
  const D13 = loadData(a13.out);
  const app = boot(a13.out);
  await wait(20);
  const $ = s => app.document.querySelector(s);
  t.eq('the header shows "v13"', $('#buildtag').textContent, 'v13');
  t.ok('…and not the hash', !$('.pmeta').textContent.includes(D13.build));
  openSettings(app);
  await wait(20);
  t.ok('About shows "Version 13"', /· Version 13\b/.test($('.about').textContent), $('.about').textContent);
  t.eq('…with the hash in small print', ($('.about small.buildhash') || {}).textContent, 'build ' + D13.build);
  t.ok('Settings → Offline shows "v13"', /Version\s*v13(?!\d)/.test($('#set-offline').textContent), $('#set-offline').textContent);
  t.ok('no runtime errors (versions)', app.errors.length === 0, app.errors.join(' | '));
  app.window.close();

  // ---- index.html links the files each build changes at that build (9 Oct) ----
  /* Within Pages' 10 minutes Chromium reused a reloaded page's app.js and data.js
     from its memory cache: the v8 -> v9 proof's reload showed v8. Stamped links
     are new addresses for every build (measured in Chromium by 70-pwa). */
  const RD = loadData(ROOT), html = read(ROOT, 'index.html'), STAMPED = ['styles.css', 'data.js', 'app.js'];
  t.eq('index.html links ' + STAMPED.join(', ') + ' at this build (?v=' + RD.build + ')',
       STAMPED.map(f => (html.match(new RegExp('(?:href|src)="\\./' + f.replace('.', '\\.') + '(\\?v=[0-9a-f]{12})?"', 'g')) || []).join(' ')),
       STAMPED.map(f => (f === 'styles.css' ? 'href' : 'src') + '="./' + f + '?v=' + RD.build + '"'));
  {
    // a root build in a copy of this repo: the shell's files copied, its folders linked
    const shell = tmpdir('v-shell'), GEN = ['data.js', 'sw.js', 'manifest.json', 'workbook.xlsx', 'index.html'];
    for (const e of fs.readdirSync(ROOT)) {
      if (['.git', 'node_modules', 'test'].concat(GEN).includes(e)) continue;
      if (fs.statSync(path.join(ROOT, e)).isDirectory()) fs.symlinkSync(path.join(ROOT, e), path.join(shell, e));
      else fs.copyFileSync(path.join(ROOT, e), path.join(shell, e));
    }
    const plain = html.replace(/\?v=[0-9a-f]{12}/g, '');
    fs.writeFileSync(path.join(shell, 'index.html'), plain);
    const run = (args, cwd) => spawnSync('python3', [path.join(shell, 'tools', 'build.py')].concat(args || []), { encoding: 'utf8', cwd: cwd || shell });
    const r1 = run();
    const SD = r1.status === 0 && loadData(shell), stamped = read(shell, 'index.html');
    t.ok('a root build stamps index.html\'s three links with its build', r1.status === 0 && STAMPED.every(f => stamped.includes('/' + f + '?v=' + SD.build + '"')) &&
         stamped.replace(/\?v=[0-9a-f]{12}/g, '') === plain, r1.stderr);
    t.ok('…and the stamp never feeds the hash: an unstamped copy of this repo builds the same hash as the repo', SD && SD.build === RD.build, SD && SD.build + ' vs ' + RD.build);
    t.ok('…a rebuild is byte-identical, and --check passes', (run(), read(shell, 'index.html') === stamped) && run(['--check']).status === 0);
    fs.writeFileSync(path.join(shell, 'index.html'), stamped.replace('app.js?v=' + SD.build, 'app.js?v=0123456789ab'));
    const st = run(['--check']);
    t.ok('a stale stamp: --check says STALE: index.html, and writes nothing', st.status === 1 && /STALE: index\.html/.test(st.stderr) &&
         read(shell, 'index.html').includes('app.js?v=0123456789ab'), st.stderr);
    fs.writeFileSync(path.join(shell, 'index.html'), stamped);
    const other = tmpdir('v-shell-out'), ro = run([path.join(shell, 'dataset.json'), '--out', other]);
    t.ok('a build into another folder leaves the shell\'s index.html alone and writes none there', ro.status === 0 &&
         read(shell, 'index.html') === stamped && !fs.existsSync(path.join(other, 'index.html')), ro.stderr);
    fs.writeFileSync(path.join(shell, 'index.html'), plain.replace(/<script defer src="\.\/app\.js"><\/script>/, ''));
    const rm = run();
    t.ok('an index.html without a link to stamp fails the build, saying which', rm.status === 1 && /index\.html: no link to app\.js to stamp with the build/.test(rm.stderr), rm.stderr);
  }
};
