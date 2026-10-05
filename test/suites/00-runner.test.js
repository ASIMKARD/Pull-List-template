/* The harness must fail when it proves nothing: zero assertions, or a crash. */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { ROOT, tmpdir } = require('../lib/helpers');

function runWith(suites) {
  const dir = tmpdir('runner');
  for (const [name, body] of Object.entries(suites)) fs.writeFileSync(path.join(dir, name), body);
  return spawnSync('node', [path.join(ROOT, 'test', 'run.js')], {
    encoding: 'utf8', env: Object.assign({}, process.env, { HARNESS_SUITES: dir })
  });
}

module.exports = async function (t) {
  const empty = runWith({});
  t.ok('a run with no suites exits non-zero', empty.status === 1, empty.stdout);
  t.ok('a run with no suites reports 0 assertions', /0 assertions/.test(empty.stdout));

  const silent = runWith({ 'a.test.js': 'module.exports = async function () {};' });
  t.ok('a suite that asserts nothing still fails the run', silent.status === 1, silent.stdout);

  const crash = runWith({ 'a.test.js': 'module.exports = async function (t) { t.ok("x", true); throw new Error("boom"); };' });
  t.ok('a crashing suite fails the run even after passing assertions', crash.status === 1, crash.stdout);
  t.ok('a crash is reported by name', /suite crashed/.test(crash.stdout));

  const fail = runWith({ 'a.test.js': 'module.exports = async function (t) { t.ok("x", false); };' });
  t.ok('a failing assertion fails the run', fail.status === 1);

  const pass = runWith({ 'a.test.js': 'module.exports = async function (t) { t.ok("x", true); };' });
  t.ok('a passing run exits zero', pass.status === 0, pass.stdout);
  t.ok('a passing run reports its count', /1 assertions, 0 failed/.test(pass.stdout));

  // the real-browser layout suite (session 4): present, and run by CI with the same rules
  const fsx = require('fs'), px = require('path'), root = px.resolve(__dirname, '..', '..');
  const layoutSuites = fsx.readdirSync(px.join(root, 'test', 'layout')).filter(f => f.endsWith('.test.js'));
  t.ok('test/layout holds real-browser suites (' + layoutSuites.length + ')', layoutSuites.length >= 3);
  const wf = fsx.readFileSync(px.join(root, '.github', 'workflows', 'harness.yml'), 'utf8');
  t.ok('CI installs Chromium and runs the layout suite through the same runner', /playwright-core install[^\n]*chromium/.test(wf) &&
       /HARNESS_SUITES=test\/layout node test\/run\.js/.test(wf));
  t.ok('…and fails on a zero count for it as well as for the harness', /for log in harness layout/.test(wf));
};
