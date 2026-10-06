#!/usr/bin/env python3
"""The workbook (V-23), generated from dataset.json — never hand-edited.

    python3 tools/build_workbook.py [dataset.json] [--out FILE] [--shuffle-columns SEED]

tools/build.py writes it as workbook.xlsx next to data.js on every build, and
--check covers it, unless the tracker turns it off with
"deliverables": {"workbook": false} (web-app-only trackers, e.g. Absolute).

Five sheets: Reading Order, Arcs, Eras, Creators, Events. Every sheet has one
named header row, frozen, with a filter on it. Columns are meant to be read
by header name, never by position (v2's generator read columns by index; a
missing column shifted every field after it into garbage). --shuffle-columns
writes the same data in another column order, so a reader can prove it reads
by name.

Deterministic bytes: entries stored (not deflated, so zlib versions can't
change them), fixed timestamps, fixed order, inline strings. stdlib only.
"""
import os, random, re, sys, zipfile
from io import BytesIO
from xml.sax.saxutils import escape

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
SHEETS = ['Reading Order', 'Arcs', 'Eras', 'Creators', 'Events']
FIXED_TIME = (1980, 1, 1, 0, 0, 0)
XML_BAD = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f]')


def yes(b):
    return 'yes' if b else 'no'


def sheets_for(payload, keep):
    """[(sheet name, headers, rows)] from a build's payload (the order the app
    shows) and its stitched rows (dates and sources), joined by id."""
    D = payload
    stitched = {r.get('id'): r for r in keep['rows']}
    arcs_src = {a['id']: a for a in keep['arcs']}
    names = [c['n'] for c in D['creators']]
    flag_names = sorted(D['flagBits'], key=lambda k: D['flagBits'][k])
    eras = D['eras']
    period_of = {}
    for p in D['periods']:
        for e in p['eras']:
            period_of[e] = p['name']

    ro_h = ['#', 'Id', 'Issue ID', 'Title', 'Series', 'Volume', 'Number', 'Era', 'Arc', 'Type', 'Mandatory', 'Core',
            'Tier', 'Medium', 'Minutes', 'Cover date', 'On sale', 'Date source', 'Writers', 'Artists', 'Event',
            'Complete only', 'Flags', 'Note', 'Sort key', 'Publication key']
    ro = []
    for i, iss in enumerate(D['issues']):
        key, title, arc, typ, mand, core, flags, note, alt = iss
        src = stitched.get(D['ids'][i], {})
        date = src.get('date') if isinstance(src.get('date'), dict) else {}
        dur = D['issueDuration'][i]
        ev = D['issueEvent'][i]
        ro.append([i + 1, D['ids'][i], D['issueIds'][i], title, src.get('series') or '', src.get('vol') or '',
                   '' if src.get('num') is None else str(src.get('num')), eras[D['issueEra'][i]]['name'], D['arcs'][arc]['n'],
                   D['types'][typ], yes(mand), yes(core), D['tiers'][D['issueTier'][i]], D['media'][D['issueMedium'][i]],
                   dur if dur > 0 else '', date.get('cover') or '', date.get('onsale') or '', date.get('source') or '',
                   '; '.join(names[w] for w in D['issueWriters'][i]), '; '.join(names[a] for a in D['issueArtists'][i]),
                   D['events'][ev]['name'] if ev >= 0 else '', yes(D['issueCompleteOnly'][i]),
                   ' '.join(f for f in flag_names if flags & D['flagBits'][f]), note, key, alt])

    per_arc, per_era = {}, {}
    for i, iss in enumerate(D['issues']):
        per_arc[iss[2]] = per_arc.get(iss[2], 0) + 1
        per_era[D['issueEra'][i]] = per_era.get(D['issueEra'][i], 0) + 1
    arc_h = ['Id', 'Name', 'Era', 'Strands', 'Type', 'Mandatory', 'Tier', 'Importance', 'Quality', 'Year', 'Writers',
             'Artists', 'Blurb', 'Issues']
    arc_rows = []
    for ai, a in enumerate(D['arcs']):
        cr = (arcs_src.get(a['id']) or {}).get('credits') or {}
        arc_rows.append([a['id'], a['n'], eras[a['e']]['name'], '; '.join(D['strands'][s] for s in a['s']), D['types'][a['t']],
                         yes(a['m']), D['tiers'][a['tier']], a['i'] or '', a['q'] or '', a['y'], '; '.join(cr.get('writers') or []),
                         '; '.join(cr.get('artists') or []), a['b'], per_arc.get(ai, 0)])
    era_h = ['Id', 'Name', 'Rank', 'Years', 'Period', 'Intro', 'Issues']
    era_rows = [[e['id'], e['name'], e['rank'], e['years'], period_of.get(ei, ''), e['intro'], per_era.get(ei, 0)]
                for ei, e in enumerate(eras)]
    cr_h = ['Name', 'Written', 'Drawn']
    cr_rows = [[c['n'], c['w'], c['a']] for c in D['creators']]
    ev_h = ['Id', 'Name', 'Era', 'Arc', 'Essential', 'Complete', 'Adds', 'Hash']
    ev_rows = [[e['id'], e['name'], eras[e['era']]['name'], D['arcs'][e['arc']]['n'] if e['arc'] >= 0 else '',
                e['essential'], e['complete'], e['adds'], e['hash']] for e in D['events']]
    return [('Reading Order', ro_h, ro), ('Arcs', arc_h, arc_rows), ('Eras', era_h, era_rows),
            ('Creators', cr_h, cr_rows), ('Events', ev_h, ev_rows)]


def col_name(n):
    s = ''
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def cell(ref, v, style=0):
    st = ' s="%d"' % style if style else ''
    if isinstance(v, bool):
        v = yes(v)
    if isinstance(v, (int, float)):
        return '<c r="%s"%s><v>%s</v></c>' % (ref, st, repr(v) if isinstance(v, float) else v)
    t = XML_BAD.sub('', str(v))
    if t == '':
        return ''
    return '<c r="%s"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, st, escape(t))


def sheet_xml(headers, rows):
    ncol, nrow = len(headers), len(rows) + 1
    widths = [min(60, max([len(str(h))] + [len(str(r[c])) for r in rows]) + 2) for c, h in enumerate(headers)]
    last = col_name(ncol - 1)
    out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n',
           '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
           '<dimension ref="A1:%s%d"/>' % (last, nrow),
           '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
           '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>',
           '<cols>' + ''.join('<col min="%d" max="%d" width="%d" customWidth="1"/>' % (c + 1, c + 1, w) for c, w in enumerate(widths)) + '</cols>',
           '<sheetData>']
    out.append('<row r="1">' + ''.join(cell(col_name(c) + '1', h, 1) for c, h in enumerate(headers)) + '</row>')
    for ri, r in enumerate(rows, 2):
        out.append('<row r="%d">' % ri + ''.join(cell(col_name(c) + str(ri), v) for c, v in enumerate(r)) + '</row>')
    out.append('</sheetData><autoFilter ref="A1:%s%d"/></worksheet>' % (last, nrow))
    return ''.join(out)


STYLES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
          '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
          '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
          '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
          '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
          '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
          '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')


def xlsx_bytes(sheets, shuffle_seed=None):
    """The .xlsx file for [(name, headers, rows)], byte for byte the same for
    the same input. shuffle_seed permutes each sheet's columns (a test of
    readers, never used by the build)."""
    if shuffle_seed is not None:
        rnd, mixed = random.Random(shuffle_seed), []
        for name, h, rows in sheets:
            order = list(range(len(h)))
            while len(order) > 1 and order == sorted(order):
                rnd.shuffle(order)
            mixed.append((name, [h[c] for c in order], [[r[c] for c in order] for r in rows]))
        sheets = mixed
    n = len(sheets)
    parts = [
        ('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/>'
         '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
         '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
         + ''.join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % (i + 1)
                   for i in range(n)) + '</Types>'),
        ('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
         '</Relationships>'),
        ('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
         '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
         'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
         + ''.join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (escape(s[0]), i + 1, i + 1) for i, s in enumerate(sheets))
         + '</sheets><definedNames>'
         + ''.join('<definedName name="_xlnm._FilterDatabase" localSheetId="%d" hidden="1">\'%s\'!$A$1:$%s$%d</definedName>'
                   % (i, escape(s[0]), col_name(len(s[1]) - 1), len(s[2]) + 1) for i, s in enumerate(sheets))
         + '</definedNames></workbook>'),
        ('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         + ''.join('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet%d.xml"/>'
                   % (i + 1, i + 1) for i in range(n))
         + '<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' % (n + 1)
         + '</Relationships>'),
        ('xl/styles.xml', STYLES),
    ] + [('xl/worksheets/sheet%d.xml' % (i + 1), sheet_xml(h, rows)) for i, (_, h, rows) in enumerate(sheets)]
    buf = BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_STORED) as z:
        for name, text in parts:
            info = zipfile.ZipInfo(name, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 0
            info.external_attr = 0o644 << 16
            z.writestr(info, text.encode('utf-8'))
    return buf.getvalue()


def main(argv):
    sys.path.insert(0, TOOLS)
    import build as B
    out, seed, args = None, None, []
    it = iter(argv)
    for a in it:
        if a == '--out':
            out = next(it, None)
        elif a == '--shuffle-columns':
            seed = int(next(it, '0'))
        else:
            args.append(a)
    dataset = args[0] if args else os.path.join(ROOT, 'dataset.json')
    keep = {}
    try:
        payload, report = B.build(dataset, keep=keep)
    except B.BuildError as e:
        for m in e.args[0]:
            print('ERROR ' + m, file=sys.stderr)
        return 1
    data = xlsx_bytes(sheets_for(payload, keep), seed)
    out = out or os.path.join(os.path.dirname(os.path.abspath(dataset)), 'workbook.xlsx')
    with open(out, 'wb') as f:
        f.write(data)
    print('wrote %s (%d bytes, %d rows)' % (out, len(data), len(payload['issues'])))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
