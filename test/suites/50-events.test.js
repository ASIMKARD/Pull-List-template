/* Essential/Complete Event Standard at the data level, plus drift detection. */
'use strict';
const fs = require('fs');
const path = require('path');
const { FIX, build, loadData, sha12, copyFixture } = require('../lib/helpers');

module.exports = async function (t) {
  const b = build(path.join(FIX, 'basic', 'dataset.json'), { label: 'events' });
  t.ok('basic builds', b.status === 0, b.stderr);
  if (b.status !== 0) return;
  const D = loadData(b.out);
  const E = D.events[0];
  t.ok('one event emitted', D.events.length === 1 && E.id === 'shattered-sky');
  t.ok('event era is the stated era (storm)', D.eras[E.era].id === 'storm');
  t.eq('Complete view counts every chapter', E.complete, 6);
  t.eq('Essential view counts core + this tracker\'s chapters', E.essential, 4);
  t.eq('"Complete view adds N issues" figure', E.adds, 2);
  const only = D.issueIds.filter((_, i) => D.issueCompleteOnly[i]);
  t.eq('non-relevant tie-ins are Complete-only', only.sort(), ['bystander-1987-1', 'other-guy-1985-22']);
  t.ok('Essential total = Complete total - adds', D.counts.total === D.counts.completeTotal - E.adds);
  t.ok('era counts use the Essential view', D.eraCounts.reduce((a, n) => a + n, 0) === D.counts.total);
  t.ok('every chapter row is tagged with its event',
       D.issueEvent.filter(e => e === 0).length === E.complete);

  // drift: the built hash identifies the exact event file; a changed copy is detectable
  const master = path.join(FIX, 'basic', 'events', 'shattered-sky.json');
  t.ok('event hash matches its source file', E.hash === sha12(master));
  const dir = copyFixture('basic', 'drift');
  const f = path.join(dir, 'events', 'shattered-sky.json');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"Shattered Sky"', '"Shattered Sky (local edit)"'));
  const d2 = build(path.join(dir, 'dataset.json'), { label: 'drift-out' });
  t.ok('an edited copy still builds', d2.status === 0, d2.stderr);
  if (d2.status === 0) t.ok('an edited copy is detectable by hash (drift)', loadData(d2.out).events[0].hash !== sha12(master));
};
