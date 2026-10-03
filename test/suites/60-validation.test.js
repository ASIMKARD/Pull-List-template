/* Every broken fixture fails for exactly its stated reason; fields are read by
   name, so their order inside a row never matters (defect 8). */
'use strict';
const fs = require('fs');
const path = require('path');
const { FIX, build, readJSON, writeJSON, copyFixture } = require('../lib/helpers');

function shuffleKeys(o, seed) {
  if (Array.isArray(o)) return o.map((x, i) => shuffleKeys(x, seed + i));
  if (!o || typeof o !== 'object') return o;
  const keys = Object.keys(o).sort((a, b) => ((a.length * 7 + seed) % 5) - ((b.length * 7 + seed) % 5) || (a < b ? 1 : -1));
  const out = {};
  for (const k of keys) out[k] = shuffleKeys(o[k], seed + 1);
  return out;
}

module.exports = async function (t) {
  const dir = path.join(FIX, 'broken');
  const valid = build(path.join(dir, '_valid', 'dataset.json'), { label: 'valid' });
  t.ok('the broken cases\' valid base builds (each case differs by one change)', valid.status === 0, valid.stderr);
  for (const name of fs.readdirSync(dir).filter(n => n !== '_valid').sort()) {
    const expect = fs.readFileSync(path.join(dir, name, 'expect.txt'), 'utf8').trim();
    const r = build(path.join(dir, name, 'dataset.json'), { label: name });
    t.ok('broken/' + name + ' fails with: ' + expect, r.status === 1 && r.stderr.includes(expect), r.stderr.split('\n')[0]);
  }

  // field order inside rows, arcs and eras does not change the output
  const a = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'order-a' });
  const copy = copyFixture('basic', 'shuffled');
  for (const f of ['dataset.json'].concat(fs.readdirSync(path.join(copy, 'data', 'eras')).map(n => path.join('data', 'eras', n)))) {
    const p = path.join(copy, f);
    writeJSON(p, shuffleKeys(readJSON(p), 3));
  }
  const b = build(path.join(copy, 'dataset.json'), { label: 'order-b' });
  t.ok('shuffled field order still builds', b.status === 0, b.stderr);
  t.ok('shuffled field order gives byte-identical data.js',
       b.status === 0 && fs.readFileSync(path.join(a.out, 'data.js'), 'utf8') === fs.readFileSync(path.join(b.out, 'data.js'), 'utf8'));
};
