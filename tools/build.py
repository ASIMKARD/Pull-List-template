#!/usr/bin/env python3
"""Pull List v3 build step — stdlib only.

    python3 tools/build.py [dataset.json] [--out DIR] [--check] [--report FILE]
    python3 tools/build.py --validate-issue-ids ID [ID ...]

Reads dataset.json (the master) plus its per-era source files and the
canonical event files it lists, then:

  1. stitches every row into one list (event chapters merged on issueId)
  2. derives the era-ranked sort key RRRR·YYYYMM·NNN and the publication-order
     altKey YYYYMM·NNN — keys are never hand-written
  3. validates everything (fails loudly, listing every problem)
  4. resolves creator credits and builds the creator index
  5. writes data.js, sw.js and manifest.json, stamped with one content hash

Every field is read BY NAME. Nothing is read by position.
"""
import hashlib, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_VERSION = 1

FLAG_BITS = {'FB': 1, 'SKIP': 2, 'ALT': 4, 'GAPNOTE': 8, 'RENUM': 16, 'SPECIAL_NUMBERING': 32}
INERT_FLAGS = {'GAPNOTE', 'RENUM'}
GRADES = ['major', 'minor', 'cameo']
ROLES = ['core', 'tie-in']
UNIVERSAL_STRAND = 'All'

SHELL_FILES = ['index.html', 'app.js', 'styles.css', 'qrcode.js', 'manifest.json']
SW_TEMPLATE = os.path.join('tools', 'templates', 'sw.js')

DATE_RX = re.compile(r'^(\d{4})-(\d{2})(?:-(\d{2}))?$')
ISSUE_ID_RX = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
YEAR_TOKEN_RX = re.compile(r'^(1[89]\d\d|20\d\d)$')
UNSOURCED_RX = re.compile(r'cadence|interpolat|assum', re.I)
ID_RX = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')


class BuildError(Exception):
    pass


# --------------------------------------------------------------------------
# identity helpers
# --------------------------------------------------------------------------
def issue_id_problem(s):
    """None if s is a valid issueId, else a short reason.

    Format: <series>-<volume-start-year>[-<token>...], lowercase kebab.
    The number part is optional and may be any slug token, so graphic novels
    (x-men-god-loves-man-kills-1982), games (sonic-frontiers-2022) and TV
    episodes (sonic-prime-2022-s1e3) are valid alongside numbered issues."""
    if not isinstance(s, str) or not s:
        return 'empty'
    if len(s) > 120:
        return 'longer than 120 characters'
    if not ISSUE_ID_RX.match(s):
        return 'not lowercase kebab-case (a-z, 0-9, single hyphens)'
    tokens = s.split('-')
    if not any(YEAR_TOKEN_RX.match(t) for t in tokens[1:]):
        return 'no volume-start-year token (e.g. -1963) after the series name'
    return None


def slugify(text):
    t = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode()
    t = t.lower().replace('&', ' and ').replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


FRACTIONS = {'½': 'half', '¼': 'quarter', '¾': 'three-quarters'}


def num_slug(num):
    s = str(num).strip().replace(',', '')
    for k, v in FRACTIONS.items():
        s = s.replace(k, v)
    neg = s.startswith('-')
    if neg:
        s = s[1:]
    s = slugify(s.replace('.', '-'))
    return ('minus-' + s) if neg else s


def num_value(num):
    """(subseries, numeric value) for per-series ordering, or None if the
    number is not orderable (e.g. 's1e3')."""
    s = str(num).strip().replace(',', '')
    if s in FRACTIONS:
        return ('', {'half': .5, 'quarter': .25, 'three-quarters': .75}[FRACTIONS[s]])
    if re.match(r'^-?\d+(\.\d+)?$', s):
        return ('', float(s))
    m = re.match(r'^([A-Za-z]+)\s+(-?\d+(?:\.\d+)?)$', s)
    if m:
        return (m.group(1).lower(), float(m.group(2)))
    return None


def creator_norm(name):
    t = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z]', '', t)


# --------------------------------------------------------------------------
# loading
# --------------------------------------------------------------------------
def load_json(path, errs):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        errs.append('missing file: %s' % os.path.relpath(path, ROOT))
    except json.JSONDecodeError as e:
        errs.append('invalid JSON in %s: %s' % (os.path.relpath(path, ROOT), e))
    return None


def parse_date(s):
    """'YYYY-MM' or 'YYYY-MM-DD' -> (y, m, d) with d=0 when absent, else None."""
    if not isinstance(s, str):
        return None
    m = DATE_RX.match(s)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
    if not (1 <= mo <= 12) or not (0 <= d <= 31) or not (1000 <= y <= 2999):
        return None
    return (y, mo, d)


def build(dataset_path, previous_datajs=None):
    """Returns (payload, report). Raises BuildError listing every problem."""
    errs, warns = [], []
    base = os.path.dirname(os.path.abspath(dataset_path))
    ds = load_json(dataset_path, errs)
    if ds is None:
        raise BuildError(errs)

    def need(obj, key, where, kind=None):
        if key not in obj:
            errs.append('%s: missing "%s"' % (where, key))
            return None
        v = obj[key]
        if kind and not isinstance(v, kind):
            errs.append('%s: "%s" has the wrong type' % (where, key))
            return None
        return v

    if ds.get('schemaVersion') != SCHEMA_VERSION:
        errs.append('schemaVersion must be %d' % SCHEMA_VERSION)

    # ---- franchise ----
    fr = need(ds, 'franchise', 'dataset', dict) or {}
    for k in ('key', 'wordmark', 'title', 'strapline', 'span', 'theme'):
        need(fr, k, 'franchise', str)
    if not re.match(r'^[a-z0-9][a-z0-9-]{1,30}$', str(fr.get('key', ''))):
        errs.append('franchise.key must be a lowercase slug (it namespaces storage and the QR prefix)')
    strict_credits = bool(fr.get('strictCredits', False))
    relevance = fr.get('eventRelevance', fr.get('key'))

    # ---- eras / periods ----
    eras = need(ds, 'eras', 'dataset', list) or []
    if not eras:
        errs.append('dataset: at least one era is required')
    ERA, last_rank = {}, None
    for i, e in enumerate(eras):
        w = 'era %s' % e.get('id', i)
        eid = need(e, 'id', w, str)
        need(e, 'name', w, str)
        rank = need(e, 'rank', w, int)
        if eid in ERA:
            errs.append('duplicate era id: %s' % eid)
        ERA[eid] = i
        if isinstance(rank, int):
            if not 1000 <= rank <= 9999:
                errs.append('%s: rank %d outside 1000-9999 (4 digits)' % (w, rank))
            if last_rank is not None and rank <= last_rank:
                errs.append('%s: ranks must ascend in era order (%d after %d)' % (w, rank, last_rank))
            last_rank = rank

    periods = ds.get('periods') or []
    if periods:
        flat = [x for p in periods for x in (p.get('eras') or [])]
        for p in periods:
            for x in p.get('eras') or []:
                if x not in ERA:
                    errs.append('period %s: unknown era %s' % (p.get('id'), x))
        if flat != [e.get('id') for e in eras]:
            errs.append('periods must cover every era exactly once, in era order')
    PERIOD_OF = {x: pi for pi, p in enumerate(periods) for x in (p.get('eras') or [])}

    # ---- vocabularies ----
    types = need(ds, 'types', 'dataset', list) or []
    tiers = need(ds, 'tiers', 'dataset', list) or []
    media = ds.get('media') or ['comic']
    default_medium = ds.get('defaultMedium', media[0])
    strands = list(ds.get('strands') or [])
    universal = False
    if not strands:                         # defect 6: an empty list blanks the app
        strands = [UNIVERSAL_STRAND]
        universal = True
        warns.append('no strands listed: using one universal strand "%s"' % UNIVERSAL_STRAND)
    chars = ds.get('characters') or []
    CHAR = {c.get('id'): i for i, c in enumerate(chars)}
    mononyms = set(ds.get('creatorMononyms') or [])

    # ---- arcs ----
    arcs = need(ds, 'arcs', 'dataset', list) or []
    ARC = {}
    for i, a in enumerate(arcs):
        w = 'arc %s' % a.get('id', i)
        aid = need(a, 'id', w, str)
        if aid in ARC:
            errs.append('duplicate arc id: %s' % aid)
        ARC[aid] = i
        need(a, 'name', w, str)
        if a.get('era') not in ERA:
            errs.append('%s: unknown era %r' % (w, a.get('era')))
        if a.get('type') not in types:
            errs.append('%s: unknown type %r' % (w, a.get('type')))
        if a.get('mo') not in ('M', 'O'):
            errs.append('%s: mo must be "M" or "O"' % w)
        if a.get('tier') not in tiers:
            errs.append('%s: unknown tier %r' % (w, a.get('tier')))
        if universal:
            a = dict(a, strands=[UNIVERSAL_STRAND]); arcs[i] = a
        if not a.get('strands'):
            errs.append('%s: no strands (an arc with no strand never shows)' % w)
        for s in a.get('strands') or []:
            if s not in strands:
                errs.append('%s: unknown strand %r' % (w, s))
        for k in ('importance', 'quality'):
            if k in a and a[k] not in (1, 2, 3, 4, 5):
                errs.append('%s: %s must be 1-5' % (w, k))

    # ---- rows: stitch sources ----
    rows = []
    if 'rows' in ds and 'sources' in ds:
        errs.append('dataset: give either inline "rows" or "sources", not both')
    if 'rows' in ds:
        for r in ds['rows'] or []:
            rows.append(dict(r, _src='dataset.json'))
    for rel in ds.get('sources') or []:
        f = load_json(os.path.join(base, rel), errs)
        if f is None:
            continue
        fera = f.get('era')
        if fera is not None and fera not in ERA:
            errs.append('%s: unknown era %r' % (rel, fera))
        for r in f.get('rows') or []:
            if 'era' in r and fera is not None and r['era'] != fera:
                errs.append('%s: row %s says era %r inside a file for era %r'
                            % (rel, r.get('id') or r.get('issueId'), r['era'], fera))
            rr = dict(r, _src=rel)
            rr.setdefault('era', fera)
            rows.append(rr)

    for i, r in enumerate(rows):
        r['_order'] = i
        if 'id' not in r and 'issueId' in r:
            r['id'] = r['issueId']             # new trackers: id defaults to issueId

    # ---- events: merge on issueId, place unmatched chapters inside the stated era ----
    events_dir = os.path.join(base, ds.get('eventsDir', 'events'))
    events_out = []
    by_issue = {}
    for r in rows:
        if r.get('issueId'):
            by_issue.setdefault(r['issueId'], r)
    for ei, ref in enumerate(ds.get('events') or []):
        eid, eera = ref.get('id'), ref.get('era')
        w = 'event %s' % eid
        if eera not in ERA:
            errs.append('%s: unknown era %r (each event must state an era that exists)' % (w, eera))
            continue
        path = os.path.join(events_dir, '%s.json' % eid)
        ev = load_json(path, errs)
        if ev is None:
            continue
        if ev.get('id') != eid:
            errs.append('%s: file id %r does not match' % (w, ev.get('id')))
        with open(path, 'rb') as fh:
            ev_hash = hashlib.sha256(fh.read()).hexdigest()[:12]
        arc_id = ref.get('arc')
        if arc_id is None:                       # synthetic arc named after the event
            arc_id = 'event-%s' % eid
            if arc_id not in ARC:
                ARC[arc_id] = len(arcs)
                arcs.append({'id': arc_id, 'name': ev.get('name', eid), 'era': eera,
                             'strands': [strands[0]] if universal else list(strands),
                             'type': 'EVENT' if 'EVENT' in types else types[0],
                             'mo': 'O', 'tier': tiers[-1] if tiers else None})
        elif arc_id not in ARC:
            errs.append('%s: unknown arc %r' % (w, arc_id))
        seen_orders, seen_ids = set(), set()
        n_ess = n_all = 0
        for ch in ev.get('chapters') or []:
            cid = ch.get('issueId')
            prob = issue_id_problem(cid)
            if prob:
                errs.append('%s: bad chapter issueId %r (%s)' % (w, cid, prob))
                continue
            if cid in seen_ids:
                errs.append('%s: chapter %s listed twice' % (w, cid))
            seen_ids.add(cid)
            order = ch.get('order')
            if not isinstance(order, int) or order in seen_orders:
                errs.append('%s: chapter %s needs a unique integer "order"' % (w, cid))
            seen_orders.add(order)
            role = ch.get('role')
            if role not in ROLES:
                errs.append('%s: chapter %s role must be core or tie-in' % (w, cid))
            relevant = ch.get('relevant') or []
            essential = role == 'core' or relevance in relevant
            row = by_issue.get(cid)
            if row is not None:                   # dedupe: the tracker's own row wins
                row['_event'], row['_eorder'], row['_essential'] = ei, order, True
                row.setdefault('credits', ch.get('credits'))
                if row['credits'] is None:
                    del row['credits']
            else:
                new = {k: ch[k] for k in ('issueId', 'series', 'vol', 'num', 'title', 'date',
                                          'sortDate', 'seq', 'credits', 'presence', 'medium',
                                          'type', 'note', 'flags') if k in ch}
                new.update(id=cid, era=eera, arc=arc_id, _src='events/%s.json' % eid,
                           _order=len(rows), _event=ei, _eorder=order, _essential=essential)
                rows.append(new)
                by_issue[cid] = new
            n_all += 1
            n_ess += 1 if (row is not None or essential) else 0
        events_out.append({'id': eid, 'name': ev.get('name', eid), 'era': ERA[eera],
                           'essential': n_ess, 'complete': n_all, 'adds': n_all - n_ess,
                           'hash': ev_hash})

    # ---- per-row validation ----
    ids, iids, titles = {}, {}, {}
    for r in rows:
        w = 'row %s (%s)' % (r.get('id') or r.get('issueId') or r.get('title'), r['_src'])
        flags = r.get('flags') or []
        for fl in flags:
            if fl not in FLAG_BITS:
                errs.append('%s: unknown flag %r' % (w, fl))
        inert = bool(INERT_FLAGS & set(flags))
        r['_inert'] = inert
        rid = r.get('id')
        if not isinstance(rid, str) or not ID_RX.match(rid):
            errs.append('%s: needs a string "id" (or an issueId to default it)' % w)
        elif rid in ids:
            errs.append('duplicate id %s (%s and %s)' % (rid, ids[rid], r['_src']))
        else:
            ids[rid] = r['_src']
        iid = r.get('issueId')
        if iid is None and not inert:
            errs.append('%s: missing issueId' % w)
        if iid is not None:
            prob = issue_id_problem(iid)
            if prob:
                errs.append('%s: bad issueId %r (%s)' % (w, iid, prob))
            elif iid in iids:
                errs.append('duplicate issueId %s (%s and %s)' % (iid, iids[iid], r['_src']))
            else:
                iids[iid] = r['_src']
            if r.get('series') is not None and r.get('vol') is not None and not prob:
                prefix = '%s-%s' % (slugify(r['series']), r['vol'])
                want = prefix + ('-' + num_slug(r['num']) if r.get('num') not in (None, '') else '')
                ok = iid == want if r.get('num') not in (None, '') else (iid == prefix or iid.startswith(prefix + '-'))
                if not ok:
                    errs.append('%s: issueId %r does not match series/vol/num (expected %r)' % (w, iid, want))
        t = r.get('title')
        if not isinstance(t, str) or not t.strip():
            errs.append('%s: missing title' % w)
        elif not inert:
            if t in titles:
                errs.append('duplicate title %r (disambiguate the volume)' % t)
            titles[t] = 1
        if r.get('era') not in ERA:
            errs.append('%s: unknown era %r' % (w, r.get('era')))
        if r.get('arc') not in ARC:
            errs.append('%s: unknown arc %r' % (w, r.get('arc')))
        arc = arcs[ARC[r['arc']]] if r.get('arc') in ARC else {}
        r.setdefault('type', arc.get('type'))
        r.setdefault('mo', arc.get('mo'))
        r.setdefault('tier', arc.get('tier'))
        r.setdefault('medium', default_medium)
        if r['type'] not in types:
            errs.append('%s: unknown type %r' % (w, r['type']))
        if r['medium'] not in media:
            errs.append('%s: unknown medium %r' % (w, r['medium']))
        if r['tier'] not in tiers:
            errs.append('%s: unknown tier %r' % (w, r['tier']))
        d = r.get('date') or {}
        r['_cover'] = parse_date(d.get('cover'))
        if r['_cover'] is None:
            errs.append('%s: date.cover must be YYYY-MM or YYYY-MM-DD' % w)
        if d.get('onsale') is not None and parse_date(d['onsale']) is None:
            errs.append('%s: date.onsale must be YYYY-MM-DD' % w)
        if not inert:
            src = d.get('source')
            if not isinstance(src, str) or not src.strip():
                errs.append('%s: date.source missing (every date is sourced individually)' % w)
            elif UNSOURCED_RX.search(src):
                errs.append('%s: date.source %r is not a source (no cadence/interpolation)' % (w, src))
        r['_place'] = r['_cover']
        if 'sortDate' in r:
            r['_place'] = parse_date(r['sortDate'])
            if r['_place'] is None:
                errs.append('%s: sortDate must be YYYY-MM or YYYY-MM-DD' % w)
        if 'seq' in r and (not isinstance(r['seq'], int) or r['seq'] < 0):
            errs.append('%s: seq must be a non-negative integer' % w)
        if 'importance' in r and r['importance'] not in (1, 2, 3, 4, 5):
            errs.append('%s: importance must be 1-5' % w)
        seen_who = set()
        for p in r.get('presence') or []:
            if p.get('who') not in CHAR:
                errs.append('%s: presence names unknown character %r' % (w, p.get('who')))
            if p.get('grade') not in GRADES:
                errs.append('%s: presence grade must be major, minor or cameo' % w)
            if p.get('who') in seen_who:
                errs.append('%s: %s listed twice in presence' % (w, p.get('who')))
            seen_who.add(p.get('who'))

    if errs:
        raise BuildError(errs)

    # ---- keys: RRRR·YYYYMM·NNN, NNN assigned within era + month ----
    groups = {}
    for r in rows:
        y, m, _ = r['_place']
        groups.setdefault((r['era'], y, m), []).append(r)
    for (era_id, y, m), grp in groups.items():
        grp.sort(key=lambda r: (r['_place'], r.get('seq', 0), r.get('_eorder', 0), r['_order']))
        if len(grp) > 999:
            errs.append('era %s month %04d-%02d holds more than 999 rows' % (era_id, y, m))
        rank = eras[ERA[era_id]]['rank']
        for n, r in enumerate(grp, 1):
            r['_key'] = rank * 10**9 + y * 10**5 + m * 10**3 + n
    # altKey: pure publication order, YYYYMM·NNN, no era rank
    pub = {}
    for r in rows:
        y, m, _ = r['_cover']
        pub.setdefault((y, m), []).append(r)
    for (y, m), grp in pub.items():
        grp.sort(key=lambda r: (r['_cover'], (r.get('date') or {}).get('onsale') or '',
                                r.get('seq', 0), r['_key']))
        if len(grp) > 999:
            errs.append('cover month %04d-%02d holds more than 999 rows' % (y, m))
        for n, r in enumerate(grp, 1):
            r['_alt'] = y * 10**5 + m * 10**3 + n
    rows.sort(key=lambda r: r['_key'])
    keys = [r['_key'] for r in rows]
    if len(set(keys)) != len(keys) or keys != sorted(keys):
        errs.append('internal: keys not unique and ascending')

    # ---- per-series order in the order the app shows (verify.py rule) ----
    last = {}
    for r in rows:
        flags = set(r.get('flags') or [])
        if r['_inert'] or 'ALT' in flags or 'SPECIAL_NUMBERING' in flags:
            continue                     # ALT rows are walled off by design
        if r.get('series') is None or r.get('num') in (None, ''):
            continue
        nv = num_value(r['num'])
        if nv is None:
            continue
        k = (r['series'], r.get('vol'), nv[0])
        if k in last and nv[1] < last[k][0]:
            errs.append('numbering goes backwards: %s shown after %s' % (r['title'], last[k][1]))
        last[k] = (nv[1], r['title'])

    # ---- credits ----
    spellings = {}
    def check_names(names, w):
        for nm in names or []:
            if not isinstance(nm, str) or not nm.strip():
                errs.append('%s: empty creator name' % w); continue
            if len(nm.split()) < 2 and nm not in mononyms:
                errs.append('%s: creator %r is not a full canonical name '
                            '(add it to creatorMononyms if it really is one name)' % (w, nm))
            spellings.setdefault(creator_norm(nm), set()).add(nm)
    for a in arcs:
        c = a.get('credits') or {}
        check_names(c.get('writers'), 'arc %s' % a['id'])
        check_names(c.get('artists'), 'arc %s' % a['id'])
        for sp in a.get('creditSplits') or []:
            check_names(sp.get('writers'), 'arc %s split' % a['id'])
            check_names(sp.get('artists'), 'arc %s split' % a['id'])
    for r in rows:
        c = r.get('credits') or {}
        check_names(c.get('writers'), 'row %s' % r['id'])
        check_names(c.get('artists'), 'row %s' % r['id'])
    for norm, forms in spellings.items():
        if len(forms) > 1:
            errs.append('conflicting creator spellings: %s' % ' / '.join(sorted(forms)))

    POS = {r['id']: i for i, r in enumerate(rows)}
    splits = {}
    for a in arcs:
        for sp in a.get('creditSplits') or []:
            fid = sp.get('fromId')
            if fid not in POS:
                errs.append('arc %s: creditSplit fromId %r is not a row id' % (a['id'], fid))
            elif rows[POS[fid]].get('arc') != a['id']:
                errs.append('arc %s: creditSplit fromId %r is not in this arc' % (a['id'], fid))
            else:
                splits.setdefault(a['id'], []).append((POS[fid], sp))
    for v in splits.values():
        v.sort(key=lambda x: x[0])

    def resolve(r, i, role):
        own = (r.get('credits') or {}).get(role)
        if own:
            return list(own)
        for pos, sp in reversed(splits.get(r['arc'], [])):
            if pos <= i and sp.get(role):
                return list(sp[role])
        return list(((arcs[ARC[r['arc']]].get('credits') or {}).get(role)) or [])

    if errs:
        raise BuildError(errs)

    creators = {}
    for i, r in enumerate(rows):
        r['_w'] = resolve(r, i, 'writers')
        r['_a'] = resolve(r, i, 'artists')
        if r['_inert']:
            continue
        for nm in r['_w']:
            creators.setdefault(nm, [0, 0])[0] += 1
        for nm in r['_a']:
            creators.setdefault(nm, [0, 0])[1] += 1
    checkable = [r for r in rows if not r['_inert']]
    missing = [r['id'] for r in checkable if not r['_w']]
    coverage = round(100.0 * (len(checkable) - len(missing)) / len(checkable), 1) if checkable else 100.0
    if missing:
        msg = 'credits: %d of %d issues have no writer (coverage %.1f%%)' % (len(missing), len(checkable), coverage)
        (errs if strict_credits else warns).append(msg + ('' if not strict_credits else ' [strictCredits]'))
    if errs:
        raise BuildError(errs)

    # ---- id stability: an id that disappears orphans someone's saved progress ----
    retired = set(ds.get('retiredIds') or [])
    if previous_datajs:
        prev = read_datajs(previous_datajs)
        if prev is not None:
            gone = sorted(set(prev.get('ids') or []) - set(ids) - retired)
            if gone:
                errs.append('ids removed since the last build (saved progress would be orphaned): %s '
                            '— restore them or list them in retiredIds' % ', '.join(gone[:20]))
    for rid in sorted(retired & set(ids)):
        warns.append('retiredIds lists %s but it is still in the data' % rid)
    if errs:
        raise BuildError(errs)

    # ---- payload ----
    creator_names = sorted(creators, key=lambda n: (creator_norm(n), n))
    CI = {n: i for i, n in enumerate(creator_names)}
    TYP = {t: i for i, t in enumerate(types)}
    MED = {m: i for i, m in enumerate(media)}
    TIER = {t: i for i, t in enumerate(tiers)}
    STR = {s: i for i, s in enumerate(strands)}

    issues = []
    for r in rows:
        fl = 0
        for f in r.get('flags') or []:
            fl |= FLAG_BITS[f]
        issues.append([r['_key'], r['title'], ARC[r['arc']], TYP[r['type']], 1 if r['mo'] == 'M' else 0,
                       1 if r.get('core') else 0, fl, r.get('note') or '', r['_alt']])

    def count(pred):
        return sum(1 for r in checkable if pred(r))

    essential_view = [r for r in checkable if r.get('_essential', True)]
    era_counts = [0] * len(eras)
    for r in essential_view:
        era_counts[ERA[r['era']]] += 1

    payload = {
        'schemaVersion': SCHEMA_VERSION,
        'franchise': {k: canon(fr[k]) for k in ('key', 'wordmark', 'title', 'strapline', 'span', 'theme',
                                                'background', 'searchUrl', 'dualOrder', 'storage')
                      if k in fr},
        'eras': [{'id': e['id'], 'name': e['name'], 'rank': e['rank'], 'years': e.get('years', ''),
                  'intro': e.get('intro', '')} for e in eras],
        'periods': [{'id': p.get('id'), 'name': p.get('name', ''), 'label': p.get('label', ''),
                     'blurb': p.get('blurb', ''), 'eras': [ERA[x] for x in p['eras']]} for p in periods],
        'strands': strands,
        'types': types,
        'tiers': tiers,
        'media': media,
        'characters': [c.get('name', c.get('id')) for c in chars],
        'grades': GRADES,
        'flagBits': FLAG_BITS,
        'arcs': [{'id': a['id'], 'n': a['name'], 'e': ERA[a['era']], 's': [STR[s] for s in a['strands']],
                  't': TYP[a['type']], 'm': 1 if a['mo'] == 'M' else 0, 'tier': TIER.get(a.get('tier'), 0),
                  'i': a.get('importance', 0), 'q': a.get('quality', 0), 'y': a.get('year', ''),
                  'b': a.get('blurb', '')} for a in arcs],
        'issues': issues,
        'issueLayout': ['key', 'title', 'arc', 'type', 'mandatory', 'core', 'flags', 'note', 'altKey'],
        'ids': [r['id'] for r in rows],
        'issueIds': [r.get('issueId') or '' for r in rows],
        'issueEra': [ERA[r['era']] for r in rows],
        'issuePeriod': [PERIOD_OF[r['era']] for r in rows] if periods else [],
        'issueMedium': [MED[r['medium']] for r in rows],
        'issueTier': [TIER[r['tier']] for r in rows],
        'issueImportance': [r.get('importance', 0) for r in rows],
        'issueEvent': [r.get('_event', -1) for r in rows],
        'issueCompleteOnly': [0 if r.get('_essential', True) else 1 for r in rows],
        'issuePresence': [[[CHAR[p['who']], GRADES.index(p['grade'])] for p in (r.get('presence') or [])]
                          for r in rows],
        'issueWriters': [[CI[n] for n in r['_w']] for r in rows],
        'issueArtists': [[CI[n] for n in r['_a']] for r in rows],
        'creators': [{'n': n, 'w': creators[n][0], 'a': creators[n][1]} for n in creator_names],
        'events': events_out,
        'eraCounts': era_counts,
        'counts': {
            'total': len(essential_view),
            'completeTotal': len(checkable),
            'core': count(lambda r: r.get('core') and r.get('_essential', True)),
            'mandatory': count(lambda r: r['mo'] == 'M' and r.get('_essential', True)),
            'gapnotes': sum(1 for r in rows if 'GAPNOTE' in (r.get('flags') or [])),
            'renumbers': sum(1 for r in rows if 'RENUM' in (r.get('flags') or [])),
            'creditsCoverage': coverage,
        },
        'timeline': sorted(range(len(rows)), key=lambda i: (ARC[rows[i]['arc']], rows[i]['_key'])),
        'legend': [{'term': x.get('term', ''), 'meaning': x.get('meaning', '')} for x in ds.get('legend') or []],
        'maintenance': ds.get('maintenance') or [],
    }
    report = {'warnings': warns, 'rows': len(rows), 'checkable': len(checkable),
              'eras': len(eras), 'events': events_out, 'creditsCoverage': coverage,
              'creators': len(creator_names)}
    return payload, report


# --------------------------------------------------------------------------
# output
# --------------------------------------------------------------------------
def canon(v):
    """Pass-through objects get sorted keys, so input field order never
    changes the output (fields are read by name, never by position)."""
    if isinstance(v, dict):
        return {k: canon(v[k]) for k in sorted(v)}
    if isinstance(v, list):
        return [canon(x) for x in v]
    return v


def read_datajs(path):
    try:
        with open(path, encoding='utf-8') as f:
            txt = f.read()
    except FileNotFoundError:
        return None
    m = re.match(r'^window\.TRACKER_DATA=(.*);\s*$', txt, re.S)
    return json.loads(m.group(1)) if m else None


def static_files(shell_root):
    out = []
    for d in ('fonts', 'icons'):
        p = os.path.join(shell_root, d)
        if os.path.isdir(p):
            out += ['./%s/%s' % (d, n) for n in sorted(os.listdir(p)) if not n.startswith('.')]
    return out


def manifest_for(fr):
    bg = fr.get('background', fr['theme'])
    return json.dumps({
        'name': fr['title'], 'short_name': fr['wordmark'], 'description': fr['strapline'],
        'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any',
        'background_color': bg, 'theme_color': fr['theme'],
        'icons': [
            {'src': './icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': './icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': './icons/icon-maskable.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ]}, indent=2, ensure_ascii=False) + '\n'


def render_outputs(payload, shell_root):
    """data.js, sw.js and manifest.json, all stamped with one content hash."""
    manifest = manifest_for(payload['franchise'])
    h = hashlib.sha256()
    h.update(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode())
    h.update(manifest.encode())
    for rel in SHELL_FILES[:-1] + [SW_TEMPLATE]:
        p = os.path.join(shell_root, rel)
        if os.path.exists(p):
            with open(p, 'rb') as f:
                h.update(rel.encode() + b'\0' + f.read())
    statics = static_files(shell_root)
    for rel in statics:
        with open(os.path.join(shell_root, rel[2:]), 'rb') as f:
            h.update(rel.encode() + b'\0' + f.read())
    build_id = h.hexdigest()[:12]

    data = dict(payload, build=build_id)
    datajs = 'window.TRACKER_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(shell_root, SW_TEMPLATE), encoding='utf-8') as f:
        tpl = f.read()
    shell = ['./', './index.html', './app.js', './styles.css', './data.js', './qrcode.js', './manifest.json']
    sw = (tpl.replace('__CACHE__', '%s-%s' % (payload['franchise']['key'], build_id))
             .replace('__SHELL__', json.dumps(shell))
             .replace('__STATIC__', json.dumps(statics, indent=2)))
    return {'data.js': datajs, 'sw.js': sw, 'manifest.json': manifest}, build_id


def main(argv):
    if argv[:1] == ['--validate-issue-ids']:
        print(json.dumps({i: issue_id_problem(i) for i in argv[1:]}))
        return 0
    args = [a for a in argv if not a.startswith('--')]
    opts = {}
    it = iter(argv)
    for a in it:
        if a in ('--out', '--report'):
            opts[a] = next(it, None)
            args = [x for x in args if x != opts[a]]
        elif a.startswith('--'):
            opts[a] = True
    dataset = args[0] if args else os.path.join(ROOT, 'dataset.json')
    out = opts.get('--out') or ROOT
    check = bool(opts.get('--check'))
    try:
        payload, report = build(dataset, previous_datajs=os.path.join(out, 'data.js'))
        files, build_id = render_outputs(payload, ROOT)
    except BuildError as e:
        for msg in e.args[0]:
            print('ERROR ' + msg, file=sys.stderr)
        print('BUILD FAILED: %d error(s)' % len(e.args[0]), file=sys.stderr)
        return 1
    for w in report['warnings']:
        print('WARN  ' + w, file=sys.stderr)
    report['build'] = build_id
    if opts.get('--report'):
        with open(opts['--report'], 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=1)
    if check:
        stale = []
        for name, content in files.items():
            p = os.path.join(out, name)
            cur = open(p, encoding='utf-8').read() if os.path.exists(p) else None
            if cur != content:
                stale.append(name)
        if stale:
            print('STALE: %s — run python3 tools/build.py' % ', '.join(stale), file=sys.stderr)
            return 1
        print('fresh: build %s (%d rows, %d eras)' % (build_id, report['rows'], report['eras']))
        return 0
    os.makedirs(out, exist_ok=True)
    for name, content in files.items():
        with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
            f.write(content)
    print('built %s: %d rows (%d checkable), %d eras, %d events, %d creators, credits %.1f%%'
          % (build_id, report['rows'], report['checkable'], report['eras'], len(report['events']),
             report['creators'], report['creditsCoverage']))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
