#!/usr/bin/env python3
"""The verify gate (V-22): Research-Repo's verify.py, run on a v3 tracker.

    python3 tools/verify_gate.py [dataset.json ...] [--adapted FILE]

For each dataset (default: the root dataset.json):

  0. the pin: tools/verify.py must be byte-identical to the copy recorded in
     tools/verify.lock (commit and sha256). Never edit it here.
  1. the build's own validation (tools/build.py), reported as "build:".
  2. verify.check() on the stitched dataset, adapted to verify.py's model BY
     NAME: rows {series, vol, num, title, cover, onsale, arc, flags,
     date_source, mandatory, core, seq}. It runs even when the build fails, so
     its own verdict is always shown ("verify:").
  3. check_shown(): v3's equivalent of verify.check_built, which reads v2's
     data.js. In the order the app shows, numbers within a series rise and
     series that ran at the same time interleave ("shown:").

Exit code 1 = do not ship. stdlib only.
"""
import collections, hashlib, json, os, sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)
import build as B        # noqa: E402  (the stitch and the per-series number reading)
import verify as V       # noqa: E402  (the pinned gate, unchanged)


def pin_problem():
    with open(os.path.join(TOOLS, 'verify.lock'), encoding='utf-8') as f:
        lock = json.load(f)
    with open(os.path.join(TOOLS, 'verify.py'), 'rb') as f:
        got = hashlib.sha256(f.read()).hexdigest()
    if got != lock['sha256']:
        return 'tools/verify.py is not the pinned copy (sha256 %s, verify.lock says %s from %s@%s)' % (
            got[:12], lock['sha256'][:12], lock['source'], lock['commit'][:7])
    return None


def adapt(keep):
    """The stitched v3 dataset in verify.py's model. Inert marker rows (gap
    notes, renumberings) carry GAP, verify.py's own marker, and no date."""
    arcs = {a.get('id'): a for a in keep.get('arcs') or []}
    rows = []
    for r in keep.get('rows') or []:
        flags = [f for f in (r.get('flags') or []) if isinstance(f, str)]
        inert = bool(B.INERT_FLAGS & set(flags))
        d = r.get('date') if isinstance(r.get('date'), dict) else {}
        arc = arcs.get(r.get('arc'), {})
        num = r.get('num')
        row = {'series': r.get('series') if r.get('series') is not None else r.get('title', ''),
               'vol': r.get('vol'), 'num': '' if inert or num in (None, '') else str(num),
               'title': r.get('title', ''), 'arc': r.get('arc'),
               'flags': flags + (['GAP'] if inert else []),
               'date_source': d.get('source') or '',
               'mandatory': (r.get('mo') or arc.get('mo')) == 'M', 'core': bool(r.get('core')),
               'seq': r.get('seq', 0) if isinstance(r.get('seq'), int) else 0,
               'note': r.get('note', ''), 'id': r.get('id') or r.get('issueId')}
        if not inert:
            row['cover'] = d.get('cover')
            if d.get('onsale'):
                row['onsale'] = d['onsale']
        rows.append(row)
    return {'franchise': ((keep.get('dataset') or {}).get('franchise') or {}).get('key'),
            'order_basis': 'cover',
            'eras': [{'id': e.get('id'), 'name': e.get('name', '')} for e in keep.get('eras') or []],
            'arcs': [{'id': a.get('id'), 'name': a.get('name', ''), 'era': a.get('era'), 'strands': a.get('strands') or [],
                      'type': a.get('type'), 'importance': a.get('importance', 0), 'blurb': a.get('blurb', '')}
                     for a in keep.get('arcs') or []],
            'rows': rows}


def check_shown(payload, adapted):
    """verify.check_built for v3: walk the rows in the order the app shows them
    (data.js order = the derived sort key), reading series and number by name.
    ALT rows are walled off by design; inert rows and special numbering are skipped."""
    by_id = {r['id']: r for r in adapted['rows']}
    out, last, spans = [], {}, collections.defaultdict(list)
    for i, rid in enumerate(payload['ids']):
        r = by_id.get(rid)
        if r is None or 'GAP' in r['flags'] or 'ALT' in r['flags']:
            continue
        s = (r['series'], r['vol'])
        nv = B.num_value(r['num']) if r['num'] else None
        if nv is not None and 'SPECIAL_NUMBERING' not in r['flags']:
            k = s + (nv[0],)
            if k in last and nv[1] < last[k][0]:
                out.append('shown backwards: %s after %s' % (r['title'], last[k][1]))
            last[k] = (nv[1], r['title'])
        if r.get('cover'):
            y, m = r['cover'].split('-')[:2]
            spans[s].append((i, int(y) * 12 + int(m)))
    keys = sorted(k for k, v in spans.items() if len(v) >= 6)
    for ai, a in enumerate(keys):
        for b in keys[ai + 1:]:
            A, Bs = spans[a], spans[b]
            lo = max(min(x for _, x in A), min(x for _, x in Bs))
            hi = min(max(x for _, x in A), max(x for _, x in Bs))
            if hi - lo < 6:
                continue
            ia = [i for i, x in A if lo <= x <= hi]
            ib = [i for i, x in Bs if lo <= x <= hi]
            if len(ia) < 3 or len(ib) < 3:
                continue
            seq = [lab for _, lab in sorted([(i, 'A') for i in ia] + [(i, 'B') for i in ib])]
            switches = sum(1 for x, y in zip(seq, seq[1:]) if x != y)
            if switches < 0.25 * min(len(ia), len(ib)):
                out.append('shown as blocks: %s (%s) vs %s (%s), %d-%d: %d switches over %d+%d issues'
                           % (a[0], a[1], b[0], b[1], lo // 12, hi // 12, switches, len(ia), len(ib)))
    return out


def gate(dataset_path):
    """{'fails': [...], 'warns': [...], 'rows': n, 'adapted': dataset}"""
    fails, warns = [], []
    pin = pin_problem()
    if pin:
        fails.append('pin: ' + pin)
    keep, payload = {}, None
    try:
        payload, report = B.build(dataset_path, keep=keep)
        warns += ['build: ' + w for w in report['warnings']]
    except B.BuildError as e:
        fails += ['build: ' + m for m in e.args[0]]
    adapted = adapt(keep)
    if adapted['rows']:
        del V.FAIL[:], V.WARN[:]               # verify.py keeps its findings in module lists
        f, w = V.check(adapted)
        fails += ['verify: ' + x for x in f]
        warns += ['verify: ' + x for x in w]
    else:
        fails.append('verify: nothing to check (the dataset did not stitch)')
    if payload is not None:
        fails += ['shown: ' + x for x in check_shown(payload, adapted)]
    return {'fails': fails, 'warns': warns, 'rows': len(adapted['rows']), 'adapted': adapted}


def main(argv):
    adapted_out = None
    if '--adapted' in argv:
        i = argv.index('--adapted')
        adapted_out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    paths = [a for a in argv if not a.startswith('--')] or [os.path.join(ROOT, 'dataset.json')]
    status = 0
    for p in paths:
        g = gate(p)
        for x in g['warns']:
            print('WARN ' + x)
        for x in g['fails']:
            print('FAIL ' + x)
        name = os.path.relpath(p, ROOT)
        print('%s: %d rows, %d failures, %d warnings — %s' % (name, g['rows'], len(g['fails']), len(g['warns']),
                                                            'gate passed' if not g['fails'] else 'DO NOT SHIP'))
        if adapted_out:
            with open(adapted_out, 'w', encoding='utf-8') as f:
                json.dump(g['adapted'], f, indent=1, ensure_ascii=False)
        status |= 1 if g['fails'] else 0
    return status


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
