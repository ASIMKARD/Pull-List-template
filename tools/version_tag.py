#!/usr/bin/env python3
"""Tag a merge into main with its readable version (John, 12 Oct).

    python3 tools/version_tag.py [--head SHA] [--base SHA] [--remote NAME] [--dry-run]

`.github/workflows/version-tag.yml` runs this on every push to main. When the
readable version in `data.js` at --head differs from the one at --base (the
main before the push; the first parent when there is none), it tags --head
`v<N>` and pushes that one tag. Otherwise it does nothing:
- a merge that leaves the version as it was (docs only) makes no tag;
- a tag that already exists, here or on the remote, is never moved and never
  made twice, so re-running is safe;
- it only ever creates `v<N>`, so rollback tags such as `v7-final` are never
  touched;
- the template itself (franchise key `starter`) makes none: its demo's version
  is not a release.
Exit 1 only when there is no readable version at --head or the push fails.
stdlib only."""
import json, re, subprocess, sys

TEMPLATE_KEY = 'starter'
ZERO = re.compile(r'^0+$')


def git(*args, check=True):
    r = subprocess.run(['git'] + list(args), capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError('git %s: %s' % (' '.join(args), r.stderr.strip()))
    return r


def commit_of(ref):
    r = git('rev-parse', '-q', '--verify', ref + '^{commit}', check=False)
    return r.stdout.strip() if r.returncode == 0 else None


def show(sha, path):
    r = git('show', '%s:%s' % (sha, path), check=False)
    return r.stdout if r.returncode == 0 else None


def tracker_data(sha):
    """The `data.js` payload at a commit, read by name; None when absent."""
    src = show(sha, 'data.js')
    if src is None:
        return None
    m = re.match(r'\s*window\.TRACKER_DATA\s*=\s*(.*?);?\s*$', src, re.S)
    try:
        return json.loads(m.group(1)) if m else None
    except ValueError:
        return None


def version_at(sha):
    d = tracker_data(sha) if sha else None
    v = d.get('version') if isinstance(d, dict) else None
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def remote_tag(remote, tag):
    """The commit a tag points at on the remote, peeled; None when it has none."""
    r = git('ls-remote', '--tags', remote, 'refs/tags/' + tag, 'refs/tags/' + tag + '^{}', check=False)
    if r.returncode != 0:
        raise RuntimeError('cannot read tags from %s: %s' % (remote, r.stderr.strip()))
    refs = dict(reversed(line.split('\t')) for line in r.stdout.splitlines() if '\t' in line)
    return refs.get('refs/tags/%s^{}' % tag) or refs.get('refs/tags/' + tag)


def main(argv):
    opts, it = {'--head': 'HEAD', '--base': '', '--remote': 'origin'}, iter(argv)
    for a in it:
        if a in ('--head', '--base', '--remote'):
            opts[a] = next(it, '')
        elif a == '--dry-run':
            opts[a] = True
        else:
            print('unknown argument: %s' % a, file=sys.stderr)
            return 2
    head = commit_of(opts['--head'])
    if not head:
        print('no such commit: %s' % opts['--head'], file=sys.stderr)
        return 1
    ds = show(head, 'dataset.json')
    try:
        key = json.loads(ds)['franchise']['key'] if ds else None
    except (ValueError, KeyError, TypeError):
        key = None
    if key == TEMPLATE_KEY:
        print('the template itself: no version tags (its demo\'s version is not a release)')
        return 0
    v_head = version_at(head)
    if v_head is None:
        print('no readable version in data.js at %s' % head[:7], file=sys.stderr)
        return 1
    base = opts['--base']
    base = commit_of(base) if base and not ZERO.match(base) else None
    if base is None:
        base = commit_of(head + '^1')              # workflow_dispatch, or a branch's first push
    v_base = version_at(base)
    tag = 'v%d' % v_head
    if v_base == v_head:
        print('v%d unchanged since %s: no tag' % (v_head, base[:7]))
        return 0
    has_remote = opts['--remote'] in git('remote').stdout.split()
    here = commit_of('refs/tags/' + tag)
    there = remote_tag(opts['--remote'], tag) if has_remote else None
    for where, at in (('on ' + opts['--remote'], there), ('here', here)):
        if at and at != head:
            print('::warning::%s already exists (%s, on %s); tags are never moved, so %s stays untagged'
                  % (tag, where, at[:7], head[:7]))
            return 0
        if at == head:
            if has_remote and there is None and not opts.get('--dry-run'):   # made here, never pushed
                git('push', opts['--remote'], 'refs/tags/' + tag)
                print('pushed %s, already on %s here' % (tag, head[:7]))
            else:
                print('%s is already on %s (%s): nothing to do' % (tag, head[:7], where))
            return 0
    build = (tracker_data(head) or {}).get('build', '')
    was = 'v%d' % v_base if v_base is not None else 'no version'
    if opts.get('--dry-run'):
        print('would tag %s as %s (was %s at %s)' % (head[:7], tag, was, base[:7] if base else 'none'))
        return 0
    git('tag', '-a', tag, head, '-m', 'Readable version %s (build %s)' % (tag, build))
    print('tagged %s as %s (was %s at %s)' % (head[:7], tag, was, base[:7] if base else 'none'))
    if has_remote:
        r = git('push', opts['--remote'], 'refs/tags/' + tag, check=False)
        if r.returncode != 0:
            if remote_tag(opts['--remote'], tag) == head:   # another run pushed the same tag first
                print('%s was already pushed' % tag)
                return 0
            print('could not push %s: %s' % (tag, r.stderr.strip()), file=sys.stderr)
            return 1
        print('pushed %s' % tag)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
