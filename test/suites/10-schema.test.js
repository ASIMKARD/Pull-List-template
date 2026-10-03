/* Every fixture validates against schema/*.json, and the schema agrees with
   tools/build.py — so the formal contract and the enforcing code cannot drift. */
'use strict';
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const { ROOT, FIX, readJSON, build, validateIssueIds } = require('../lib/helpers');

module.exports = async function (t) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const S = n => readJSON(path.join(ROOT, 'schema', n));
  ajv.addSchema(S('dataset.schema.json'), 'dataset.schema.json');
  ajv.addSchema(S('era-file.schema.json'), 'era-file.schema.json');
  ajv.addSchema(S('event.schema.json'), 'event.schema.json');
  const check = (schema, file) => {
    const v = ajv.getSchema(schema);
    const ok = v(readJSON(file));
    return { ok, why: ok ? '' : ajv.errorsText(v.errors) };
  };

  for (const ds of ['dataset.json', 'test/fixtures/basic/dataset.json', 'test/fixtures/no-periods/dataset.json',
                    'test/fixtures/mixed/dataset.json', 'test/fixtures/broken/_valid/dataset.json']) {
    const r = check('dataset.schema.json', path.join(ROOT, ds));
    t.ok('schema accepts ' + ds, r.ok, r.why);
  }
  const eraDir = path.join(FIX, 'basic', 'data', 'eras');
  for (const f of fs.readdirSync(eraDir).sort()) {
    const r = check('era-file.schema.json', path.join(eraDir, f));
    t.ok('schema accepts era file ' + f, r.ok, r.why);
  }
  const evDir = path.join(FIX, 'basic', 'events');
  for (const f of fs.readdirSync(evDir).sort()) {
    const r = check('event.schema.json', path.join(evDir, f));
    t.ok('schema accepts event ' + f, r.ok, r.why);
  }
  const masterEvents = fs.readdirSync(path.join(ROOT, 'events')).filter(f => f.endsWith('.json'));
  for (const f of masterEvents) {
    const r = check('event.schema.json', path.join(ROOT, 'events', f));
    t.ok('schema accepts master event ' + f, r.ok, r.why);
  }

  // every broken case is rejected — by the schema (shape) or by the build (rules)
  const brokenDir = path.join(FIX, 'broken');
  for (const name of fs.readdirSync(brokenDir).filter(n => n !== '_valid').sort()) {
    const file = path.join(brokenDir, name, 'dataset.json');
    const bySchema = !check('dataset.schema.json', file).ok;
    const byBuild = bySchema ? false : build(file, { label: 'schema-' + name }).status !== 0;
    t.ok('broken/' + name + ' is rejected (schema or build)', bySchema || byBuild);
  }

  // the schema's issueId pattern and the build's validator agree on every case
  const ids = ['justice-league-2016-32', 'x-men-1963-annual-1', 'series-1980-half', 'series-1995-minus-1',
    'series-1980-1-5', 'series-1980-1000000', 'x-men-god-loves-man-kills-1982', 'sonic-frontiers-2022',
    'sonic-prime-2022-s1e3', 'spider-man-2099-1992-1',
    'Justice-League-2016-32', 'justice league-2016-32', 'justice-league-2016-#32', 'series-1980-½',
    'justice--league-2016-32', 'justice-league-2016-32-', 'justice-league-32', '1980-1', ''];
  const byBuild = validateIssueIds(ids);
  const pat = new RegExp(S('dataset.schema.json').$defs.issueId.pattern);
  const disagree = ids.filter(id => (byBuild[id] === null) !== (pat.test(id) && id.length <= 120));
  t.ok('schema issueId pattern agrees with build.py on ' + ids.length + ' cases', disagree.length === 0,
       'disagree: ' + disagree.join(', '));
};
