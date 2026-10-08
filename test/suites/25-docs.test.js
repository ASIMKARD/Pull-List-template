/* The docs (V-28) name only what exists: every path, every command and its
   flags, every npm script and every dataset key in README.md, BUILD-NOTES.md,
   MIGRATING.md and the comic-tracker-build Skill. A doc that points at
   something renamed or removed fails here, not in a session that trusts it. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, ROOT_DATASET, IS_TEMPLATE, readJSON } = require('../lib/helpers');

const DOCS = ['README.md', 'BUILD-NOTES.md', 'MIGRATING.md', '.claude/skills/comic-tracker-build/SKILL.md'];
/* Named on purpose but not in this repo: Research-Repo's toolkit path, the
   pilot's repo, and the optional images folder a signature skin may add. */
const ELSEWHERE = new Set(['toolkit/verify.py', 'ASIMKARD/Absolute-v3', 'images/']);
/* A tracker keeps these docs as they are. Two things they name live only in the
   template: its parity checklist, and the workbook a web-app-only tracker doesn't write. */
const TEMPLATE_ONLY = new Set(IS_TEMPLATE ? [] : ['FEATURE-INVENTORY.md']
  .concat((ROOT_DATASET.deliverables || {}).workbook === false ? ['workbook.xlsx'] : []));
const EXT = /\.(json|py|js|md|css|html|xlsx|woff2|png|yml)$/;

function spans(text) {
  const fenced = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(m => m[1]);
  const inline = [...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim());
  return { fenced, inline };
}
function glob(rel) {
  if (!rel.includes('*')) return fs.existsSync(path.join(ROOT, rel));
  const dir = path.join(ROOT, path.dirname(rel)), rx = new RegExp('^' + path.basename(rel).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  return fs.existsSync(dir) && fs.readdirSync(dir).some(f => rx.test(f));
}
function check(text) {
  const { fenced, inline } = spans(text), out = { paths: [], commands: [], keys: [], missing: [] };
  const pkg = readJSON(path.join(ROOT, 'package.json'));
  const schema = readJSON(path.join(ROOT, 'schema', 'dataset.schema.json'));
  const commands = fenced.flatMap(b => b.split('\n')).concat(inline).map(l => l.replace(/\s+#.*$/, '').trim())
    .filter(l => /^(python3|node|npm) /.test(l));
  for (const c of commands) {
    out.commands.push(c);
    const w = c.split(/\s+/);
    if (w[0] === 'npm') {
      if (w[1] === 'run' && !(pkg.scripts || {})[w[2]]) out.missing.push('npm script "' + w[2] + '" (' + c + ')');
      else if (!['run', 'ci', 'test'].includes(w[1])) out.missing.push('npm command (' + c + ')');
      continue;
    }
    const file = w[1];
    if (!fs.existsSync(path.join(ROOT, file))) { out.missing.push('command file ' + file + ' (' + c + ')'); continue; }
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const f of w.slice(2).filter(x => /^--[\w-]+$/.test(x))) if (!src.includes("'" + f + "'") && !src.includes('"' + f + '"') && !src.includes(f + ' ')) out.missing.push('flag ' + f + ' of ' + file);
  }
  for (const s of inline) {
    if (/^(franchise|deliverables|storage)\.[\w.]+$/.test(s)) {
      out.keys.push(s);
      let node = { properties: schema.properties }, parts = s.split('.');
      if (parts[0] === 'storage') parts = ['franchise'].concat(parts);
      for (const p of parts) node = node && node.properties && node.properties[p];
      if (!node) out.missing.push('dataset key ' + s);
      continue;
    }
    if (/\s|:|<|^-|^\.\.|^https?/.test(s) || !/^[\w.\-*/]+$/.test(s)) continue;
    if (!(s.includes('/') || EXT.test(s))) continue;
    out.paths.push(s);
    if (!ELSEWHERE.has(s) && !TEMPLATE_ONLY.has(s) && !glob(s)) out.missing.push('path ' + s);
  }
  return out;
}

module.exports = async function (t) {
  let paths = 0, commands = 0, keys = 0;
  for (const d of DOCS) {
    const p = path.join(ROOT, d);
    if (!t.ok(d + ' exists', fs.existsSync(p))) continue;
    const r = check(fs.readFileSync(p, 'utf8'));
    paths += r.paths.length; commands += r.commands.length; keys += r.keys.length;
    t.eq(d + ': every path, command, flag, npm script and dataset key it names exists (' + r.paths.length + ' paths, ' + r.commands.length +
         ' commands, ' + r.keys.length + ' keys)', r.missing, []);
  }
  t.ok('…which is a real amount of checking (' + paths + ' paths, ' + commands + ' commands, ' + keys + ' keys)', paths >= 40 && commands >= 10 && keys >= 5);
  const skill = fs.readFileSync(path.join(ROOT, DOCS[3]), 'utf8');
  t.ok('the Skill has the frontmatter a session loads it by (name comic-tracker-build, a description)',
       /^---\nname: comic-tracker-build\ndescription: .{40,}\n---\n/.test(skill));
  const readme = fs.existsSync(path.join(ROOT, 'README.md')) ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : '';
  t.ok('the README points at all three docs and the Skill', ['BUILD-NOTES.md', 'MIGRATING.md', 'CLAUDE.md', '.claude/skills/comic-tracker-build/SKILL.md']
       .every(x => readme.includes('`' + x + '`')));
  // the checker itself catches each kind of mistake
  const bad = check([
    'See `tools/nope.py` and `test/fixtures/none/` and `data/eras/*.yaml`.', '```', 'python3 tools/build.py --no-such-flag', 'node test/gone.js',
    'npm run test:nothing', '```', 'Set `franchise.nonsense` and `storage.legacy.nope`; `ASIMKARD/Absolute-v3` is elsewhere.'].join('\n'));
  t.eq('…the check itself catches a missing file, folder and glob, an unknown flag, a missing script file, an unknown npm script and unknown dataset keys',
       bad.missing, ['flag --no-such-flag of tools/build.py', 'command file test/gone.js (node test/gone.js)', 'npm script "test:nothing" (npm run test:nothing)',
                     'path tools/nope.py', 'path test/fixtures/none/', 'path data/eras/*.yaml', 'dataset key franchise.nonsense', 'dataset key storage.legacy.nope']);
};
