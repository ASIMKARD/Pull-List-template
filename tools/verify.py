"""Verify gate: run before ANY workbook/app build. Exit code 1 = do not ship.

dataset.json schema (the master copy for a franchise):
{
  "franchise": "archie-sonic",
  "order_basis": "cover" | "onsale",
  "eras":  [{"id": "classic", "name": "...", "intro": "..."}],
  "arcs":  [{"id": "endgame", "name": "...", "era": "classic", "strands": [...],
             "type": "MAIN", "importance": 1-3, "creative": "...", "key_events": "...",
             "collected_in": "...", "blurb": "...", "source": "url or page title"}],
  "rows":  [{"series": "Sonic the Hedgehog", "vol": "1993", "num": "47",
             "title": "Sonic the Hedgehog #47", "cover": "1997-06", "onsale": "1997-04-16",
             "arc": "endgame", "mandatory": true, "core": false,
             "flags": ["ALT"], "note": "", "date_source": "Sonic Wiki",
             "read_after": null}]
}
Rules enforced here are the lessons of the Sept 2026 audit.
"""
import json, re, sys, collections

FAIL, WARN = [], []


def ym(s):
    y, m = s.split('-')[:2]
    return int(y) * 12 + int(m)


def check(ds, sources_check=None):
    rows, arcs = ds['rows'], {a['id']: a for a in ds['arcs']}
    eras = {e['id'] for e in ds['eras']}
    basis = ds.get('order_basis', 'cover')

    # 1. every row dated from a named source, never interpolated
    for r in rows:
        if 'GAP' in r.get('flags', []):
            continue
        if not r.get(basis if basis == 'cover' else 'onsale'):
            FAIL.append(f"undated: {r['title']}")
        if not r.get('date_source') or re.search(r'cadence|interpolat|assum', r.get('date_source', ''), re.I):
            FAIL.append(f"date not sourced: {r['title']} ({r.get('date_source')})")

    # 2. referential integrity
    for r in rows:
        if r['arc'] not in arcs:
            FAIL.append(f"unknown arc {r['arc']!r}: {r['title']}")
    for a in arcs.values():
        if a['era'] not in eras:
            FAIL.append(f"arc {a['id']} has unknown era {a['era']}")
        if not a.get('strands'):
            FAIL.append(f"arc {a['id']} has no strands (blanks the app)")
        for f in ('creative', 'collected_in', 'key_events'):
            if a.get(f) and not a.get('source'):
                WARN.append(f"arc {a['id']}: {f} filled but no source recorded")

    # 3. duplicate titles (the Justice League (2016)/(2018) trap)
    for t, n in collections.Counter(r['title'] for r in rows).items():
        if n > 1:
            FAIL.append(f"duplicate title x{n}: {t}")

    # 4. order: sort by date, then read_after overrides; within a series numbers must rise
    order = sorted(rows, key=lambda r: (r.get(basis) or '9999', r.get('seq', 0)))
    last = {}
    for i, r in enumerate(order):
        key = (r['series'], r.get('vol'))
        if r.get('num', '').lstrip('-').isdigit():
            n = int(r['num'])
            if key in last and n < last[key][0] and 'SPECIAL_NUMBERING' not in r.get('flags', []):
                FAIL.append(f"numbering goes backwards: {r['title']} after #{last[key][0]}")
            last[key] = (n, i)

    # 5. blocking detector: two series running concurrently must interleave
    spans = collections.defaultdict(list)
    for i, r in enumerate(order):
        if r.get(basis):
            spans[(r['series'], r.get('vol'))].append((i, ym(r[basis][:7])))
    keys = [k for k, v in spans.items() if len(v) >= 6]
    for a in keys:
        for b in keys:
            if a >= b:
                continue
            A, B = spans[a], spans[b]
            lo, hi = max(A[0][1], B[0][1]), min(A[-1][1], B[-1][1])
            if hi - lo < 6:
                continue
            ia = [i for i, m in A if lo <= m <= hi]
            ib = [i for i, m in B if lo <= m <= hi]
            if ia and ib and (max(ia) < min(ib) or max(ib) < min(ia)):
                FAIL.append(f"blocked, not interleaved: {a[0]} vs {b[0]} ({lo//12}-{hi//12})")

    # 6. optional: re-check dates against source caches
    if sources_check:
        for msg in sources_check(rows):
            FAIL.append(msg)

    return FAIL, WARN


if __name__ == '__main__':
    ds = json.load(open(sys.argv[1]))
    f, w = check(ds)
    for x in w[:50]:
        print('WARN', x)
    for x in f[:200]:
        print('FAIL', x)
    print(f"{len(ds['rows'])} rows, {len(f)} failures, {len(w)} warnings")
    sys.exit(1 if f else 0)


def check_built(datajs_path):
    """Check the ORDER THE APP ACTUALLY SHOWS (primary sort key), not just the dataset.
    Flags backwards numbering and concurrent series shown as blocks."""
    from seed_from_live import load_datajs
    d = load_datajs(datajs_path)
    iss = sorted(d['issues'], key=lambda r: r[0])
    out, last, spans = [], {}, collections.defaultdict(list)
    for i, r in enumerate(iss):
        m = re.match(r'(.*?)\s*#\s*(-?\d+)$', r[1])
        if not m:
            continue
        s, n = m.group(1), int(m.group(2))
        if r[6] & 4:  # ALT rows are walled off by design
            continue
        if s in last and n < last[s]:
            out.append(f"shown backwards: {r[1]} after #{last[s]}")
        last[s] = n
        real = r[8] if len(r) > 8 and r[8] else r[0]
        spans[s].append((i, (real // 10**5) * 12 + real // 1000 % 100))
    keys = [k for k, v in spans.items() if len(v) >= 6]
    for a in keys:
        for b in keys:
            if a >= b:
                continue
            A, B = spans[a], spans[b]
            lo, hi = max(min(x for _, x in A), min(x for _, x in B)), min(max(x for _, x in A), max(x for _, x in B))
            if hi - lo < 6:
                continue
            ia = [i for i, x in A if lo <= x <= hi]
            ib = [i for i, x in B if lo <= x <= hi]
            if len(ia) < 3 or len(ib) < 3:
                continue
            seq = [lab for _, lab in sorted([(i, 'A') for i in ia] + [(i, 'B') for i in ib])]
            switches = sum(1 for x, y in zip(seq, seq[1:]) if x != y)
            if switches < 0.25 * min(len(ia), len(ib)):
                out.append(f"shown as blocks: {a} vs {b} ({lo//12}-{hi//12}, {switches} switches over {len(ia)}+{len(ib)} issues)")
    return out
