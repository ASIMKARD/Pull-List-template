/* Automatic version tags (John, 12 Oct): `.github/workflows/version-tag.yml`
   runs `tools/version_tag.py` on every push to main. Tested on real git repos
   with a bare repo as the remote, the way the workflow meets GitHub:
   - a merge that changes the readable version gets exactly one tag, vN, on the
     merge commit, pushed;
   - a docs-only merge gets none;
   - re-running never makes a tag twice and never moves one;
   - rollback tags (v7-final, v8-final) are never touched;
   - the template itself makes none. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, tmpdir } = require('../lib/helpers');

const TAGGER = path.join(ROOT, 'tools', 'version_tag.py');
const ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: 'Harness', GIT_AUTHOR_EMAIL: 'harness@example.invalid',
  GIT_COMMITTER_NAME: 'Harness', GIT_COMMITTER_EMAIL: 'harness@example.invalid', GIT_CONFIG_NOSYSTEM: '1', HOME: tmpdir('vt-home') });

module.exports = async function (t) {
  const origin = tmpdir('vt-origin'), repo = tmpdir('vt-repo');
  const git = (args, cwd) => {
    const r = spawnSync('git', args, { cwd: cwd || repo, encoding: 'utf8', env: ENV });
    if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr);
    return r.stdout.trim();
  };
  const tagger = (args, cwd) => spawnSync('python3', [TAGGER].concat(args), { cwd: cwd || repo, encoding: 'utf8', env: ENV });
  const write = (file, text, cwd) => fs.writeFileSync(path.join(cwd || repo, file), text);
  const data = (version, build) => 'window.TRACKER_DATA=' + JSON.stringify({ franchise: { key: 'fixture' }, build, version, issues: [] }) + ';\n';
  const commit = (msg, files, cwd) => { for (const f of Object.keys(files)) write(f, files[f], cwd); git(['add', '-A'], cwd); git(['commit', '-q', '-m', msg], cwd); return git(['rev-parse', 'HEAD'], cwd); };
  const mergeBranch = (name, files) => {               // a branch with one commit, merged into main the way a PR is
    git(['checkout', '-q', '-b', name]);
    commit(name, files);
    git(['checkout', '-q', 'main']);
    git(['merge', '-q', '--no-ff', '-m', 'Merge ' + name, name]);
    git(['push', '-q', 'origin', 'main']);
    return git(['rev-parse', 'HEAD']);
  };
  const tags = cwd => { const o = git(['for-each-ref', '--format=%(refname:short) %(*objectname)%(objectname)', 'refs/tags'], cwd); return o ? o.split('\n').sort() : []; };
  const remoteTags = () => { const o = git(['ls-remote', '--tags', 'origin']); return o ? o.split('\n').sort() : []; };
  const at = (tag, cwd) => git(['rev-parse', tag + '^{commit}'], cwd);

  git(['init', '-q', '--bare', origin], ROOT);
  git(['init', '-q', '-b', 'main', repo], ROOT);
  git(['remote', 'add', 'origin', origin]);
  const ds = JSON.stringify({ franchise: { key: 'fixture' } });

  // ---- a tracker's history so far: v7 and v8, with their rollback tags
  const c7 = commit('v7', { 'dataset.json': ds, 'data.js': data(7, 'a7'), 'README.md': 'v7\n' });
  git(['tag', 'v7-final', c7]);                                           // lightweight, as made by hand
  const c8 = commit('v8', { 'data.js': data(8, 'a8') });
  git(['tag', '-a', 'v8-final', '-m', 'v8 rollback', c8]);                // annotated
  git(['push', '-q', 'origin', 'main', '--tags']);
  const rollback = [at('v7-final'), at('v8-final')], rollbackRemote = remoteTags().filter(l => /-final/.test(l));

  // ---- a merge that changes the version: one tag, on the merge commit, pushed
  let before = tags(), r;
  const m9 = mergeBranch('v9-work', { 'data.js': data(9, 'b9') });
  r = tagger(['--head', m9, '--base', c8]);
  t.ok('a version change: the tagger succeeds', r.status === 0, r.stderr + r.stdout);
  t.eq('…and makes exactly one tag, v9', tags().filter(x => !before.includes(x)).map(x => x.split(' ')[0]), ['v9']);
  t.eq('…on the merge commit itself', at('v9'), m9);
  t.ok('…annotated, naming the version and the build', /Readable version v9 \(build b9\)/.test(git(['tag', '-n1', '-l', 'v9'])), git(['tag', '-n1', '-l', 'v9']));
  t.ok('…and pushed: the remote has v9 on the merge commit', remoteTags().some(l => l === m9 + '\trefs/tags/v9^{}'), remoteTags().join(' | '));

  // ---- a docs-only merge: no tag
  before = tags();
  const beforeRemote = remoteTags();
  const docs = mergeBranch('docs-only', { 'README.md': 'v9, with better docs\n' });
  r = tagger(['--head', docs, '--base', m9]);
  t.ok('a docs-only merge (version unchanged): no tag, here or on the remote', r.status === 0 && /v9 unchanged since/.test(r.stdout) &&
       JSON.stringify(tags()) === JSON.stringify(before) && JSON.stringify(remoteTags()) === JSON.stringify(beforeRemote), r.stdout + r.stderr);

  // ---- re-running: never twice, never moved
  before = tags();
  const r1 = tagger(['--head', m9, '--base', c8]), r2 = tagger(['--head', m9, '--base', c8]);
  t.ok('re-running the v9 merge\'s run, twice: nothing new, nothing moved', r1.status === 0 && r2.status === 0 && /already on/.test(r1.stdout) &&
       JSON.stringify(tags()) === JSON.stringify(before) && at('v9') === m9, r1.stdout + r2.stdout);
  git(['tag', '-d', 'v9']);                                                // a checkout that hasn't fetched the tag yet
  r = tagger(['--head', m9, '--base', c8]);
  t.ok('…with the tag only on the remote: it reads the remote and makes no second one', r.status === 0 && /already on .* \(on origin\)/.test(r.stdout) &&
       !tags().some(x => /^v9 /.test(x)) && remoteTags().some(l => l === m9 + '\trefs/tags/v9^{}'), r.stdout + r.stderr);
  git(['fetch', '-q', 'origin', '--tags']);
  r = tagger(['--head', docs, '--base', c8]);                               // the same version, asked for on another commit
  t.ok('a run that would put v9 on another commit leaves it where it is, and warns', r.status === 0 && /::warning::v9 already exists/.test(r.stdout) &&
       at('v9') === m9 && remoteTags().some(l => l === m9 + '\trefs/tags/v9^{}'), r.stdout + r.stderr);
  git(['tag', '-d', 'v9']);
  git(['tag', 'v9', c8]);                                                  // a stray local v9 the remote disagrees with
  r = tagger(['--head', m9, '--base', c8]);
  t.ok('…and the remote\'s tag wins over a stray local one: nothing is pushed or moved', r.status === 0 && /already on .* \(on origin\)/.test(r.stdout) &&
       remoteTags().some(l => l === m9 + '\trefs/tags/v9^{}'), r.stdout + r.stderr);
  git(['tag', '-d', 'v9']);
  git(['fetch', '-q', 'origin', '--tags']);

  // ---- the workflow's other entry points: no `before` (workflow_dispatch) or an all-zero one (a new branch)
  const m10 = mergeBranch('v10-work', { 'data.js': data(10, 'c10') });
  r = tagger(['--head', m10, '--base', '0000000000000000000000000000000000000000']);
  t.ok('no usable base: it compares with the first parent, and tags v10 on the merge commit', r.status === 0 && at('v10') === m10, r.stdout + r.stderr);
  r = tagger(['--head', m10]);
  t.ok('…and run again without a base, it makes nothing new', r.status === 0 && /already on/.test(r.stdout), r.stdout + r.stderr);

  // ---- a push that lands several commits at once: compared with main before the push
  const pre = git(['rev-parse', 'HEAD']);
  commit('v10.1 data', { 'data.js': data(11, 'c11') });
  const tip = commit('docs after it', { 'README.md': 'v11 docs\n' });
  git(['push', '-q', 'origin', 'main']);
  r = tagger(['--head', tip, '--base', pre]);
  t.ok('a push of two commits (a version change, then docs): compared with main before the push, it tags the pushed head v11',
       r.status === 0 && at('v11') === tip, r.stdout + r.stderr);

  // ---- rollback tags are never touched
  t.eq('v7-final and v8-final still point where they did, here and on the remote', [at('v7-final'), at('v8-final'), remoteTags().filter(l => /-final/.test(l))],
       [rollback[0], rollback[1], rollbackRemote]);
  t.eq('every tag on the remote: the two rollback tags, v9, v10 and v11, nothing else', remoteTags().map(l => l.split('\trefs/tags/')[1]).filter(x => !/\^\{\}$/.test(x)).sort(),
       ['v10', 'v11', 'v7-final', 'v8-final', 'v9']);

  // ---- no readable version, a dry run, the template itself
  const broken = mergeBranch('no-data', { 'data.js': 'not a tracker\n' });
  r = tagger(['--head', broken]);
  t.ok('no readable version at the head: it fails, and says so', r.status === 1 && /no readable version/.test(r.stderr), r.stderr);
  const m12 = mergeBranch('v12-work', { 'data.js': data(12, 'd12') });
  before = tags();
  r = tagger(['--head', m12, '--dry-run']);
  t.ok('--dry-run says what it would do and does nothing', r.status === 0 && /would tag .* as v12/.test(r.stdout) && JSON.stringify(tags()) === JSON.stringify(before), r.stdout);
  const tpl = tmpdir('vt-template');
  git(['init', '-q', '-b', 'main', tpl], ROOT);
  commit('demo v1', { 'dataset.json': JSON.stringify({ franchise: { key: 'starter' } }), 'data.js': data(1, 'e1') }, tpl);
  const t2 = commit('demo v2', { 'data.js': data(2, 'e2') }, tpl);
  r = tagger(['--head', t2], tpl);
  t.ok('the template itself (key "starter") makes no version tags', r.status === 0 && /the template itself/.test(r.stdout) && tags(tpl).length === 0, r.stdout + r.stderr);

  // ---- the workflow file
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'version-tag.yml'), 'utf8');
  t.ok('the workflow runs on pushes to main only (and by hand)', /on:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n\s+workflow_dispatch:/.test(wf));
  t.ok('…asks for contents: write for itself', /\npermissions:\s*\n\s+contents: write\s*\n/.test(wf));
  t.ok('…checks out the full history and tags, and passes the push\'s `before` as the base', /fetch-depth: 0/.test(wf) &&
       /BASE: \$\{\{ github\.event\.before \}\}/.test(wf) && /python3 tools\/version_tag\.py --head "\$GITHUB_SHA" --base "\$BASE"/.test(wf));
  const code = fs.readFileSync(TAGGER, 'utf8');
  t.ok('neither the workflow nor the tagger can force, move or delete a tag', !/--force|\s-f\b|'-f'|'-d'|--delete|push.*\+refs/.test(wf + code));
};
