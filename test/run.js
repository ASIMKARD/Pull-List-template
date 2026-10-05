#!/usr/bin/env node
/* Pull List v3 test harness.

     node test/run.js            run every suite in test/suites/
     node test/run.js build      run only suites whose file name contains "build"

   Exit code 1 when ANY assertion fails, ANY suite crashes, or the run made
   ZERO assertions. A crashed harness reporting "0 failed" looks exactly like a
   pass — so a crash is a failure, and so is an empty run. Always report the
   assertion count, not just the failures. */
'use strict';
const fs = require('fs');
const path = require('path');

const SUITES = path.resolve(process.env.HARNESS_SUITES || path.join(__dirname, 'suites'));
const filter = process.argv[2] || '';

let total = 0, failed = 0, crashed = 0;
const failures = [];

function makeT(suite) {
  return {
    ok(name, cond, detail) {
      total++;
      if (cond) { console.log('ok   ' + suite + ': ' + name); return true; }
      failed++;
      failures.push(suite + ': ' + name);
      console.log('FAIL ' + suite + ': ' + name);
      if (detail !== undefined) console.log('     ' + String(typeof detail === 'function' ? detail() : detail).slice(0, 400));
      return false;
    },
    eq(name, actual, expected) {
      const a = JSON.stringify(actual), e = JSON.stringify(expected);
      return this.ok(name, a === e, 'expected ' + e + ', got ' + a);
    }
  };
}

(async function main() {
  let files = [];
  try {
    files = fs.readdirSync(SUITES).filter(f => f.endsWith('.test.js') && f.includes(filter)).sort();
  } catch (e) { /* missing dir: zero assertions, fails below */ }
  for (const f of files) {
    const name = f.replace(/\.test\.js$/, '');
    try {
      const suite = require(path.join(SUITES, f));
      await suite(makeT(name));
    } catch (e) {
      crashed++;
      failures.push(name + ': CRASHED');
      console.log('FAIL ' + name + ': suite crashed — ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join(' | '));
    }
  }
  console.log('');
  console.log(total + ' assertions, ' + failed + ' failed, ' + crashed + ' suites crashed (' + files.length + ' suites)');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  if (total === 0) console.log('NO ASSERTIONS RAN — treating as a failure.');
  process.exit(failed || crashed || total === 0 ? 1 : 0);
})();
