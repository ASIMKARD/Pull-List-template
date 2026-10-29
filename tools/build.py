#!/usr/bin/env python3
"""Pull List v3 build step — stdlib only.

    python3 tools/build.py [dataset.json] [--out DIR] [--check] [--report FILE]
    python3 tools/build.py --validate-issue-ids ID [ID ...]
    python3 tools/build.py --pull-palette   (Pull's default era colours as drawn, and each nudge)

Reads dataset.json (the master) plus its per-era source files and the
canonical event files it lists, then:

  1. stitches every row into one list (event chapters merged on issueId)
  2. derives the era-ranked sort key RRRR·YYYYMM·NNN and the publication-order
     altKey YYYYMM·NNN — keys are never hand-written
  3. validates everything (fails loudly, listing every problem)
  4. resolves creator credits and builds the creator index
  5. writes data.js, sw.js and manifest.json, stamped with one content hash,
     and a readable version that counts up from the previous data.js
  6. writes workbook.xlsx (tools/build_workbook.py) unless the tracker turns
     it off with "deliverables": {"workbook": false}

Every field is read BY NAME. Nothing is read by position.
"""
import hashlib, json, math, os, re, struct, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA_VERSION = 1

FLAG_BITS = {'FB': 1, 'SKIP': 2, 'ALT': 4, 'GAPNOTE': 8, 'RENUM': 16, 'SPECIAL_NUMBERING': 32}
INERT_FLAGS = {'GAPNOTE', 'RENUM'}
GRADES = ['major', 'minor', 'cameo']
SKINS = ['paper', 'newsprint', 'pull', 'night']     # skins styles.css defines (session 4); the first is the base
# icons (D-13): paths from franchise.icons, each checked as a PNG of the right size
DEFAULT_ICONS = {'192': 'icons/icon-192.png', '512': 'icons/icon-512.png', 'maskable': 'icons/icon-maskable.png'}
ICON_SIZES = {'192': (192, 192), '512': (512, 512), 'maskable': (512, 512)}
# sha256 prefixes of the template's own placeholder icons: a tracker must replace them
PLACEHOLDER_ICONS = {'b381faf3f316c831', '915c703c55fc9e4f', '0f5ff9639697a08d'}
COMIC = 'comic'          # every comic counts as one issue, timed by the minutes-per-issue setting
ROLES = ['core', 'tie-in']
UNIVERSAL_STRAND = 'All'

SHELL_FILES = ['index.html', 'app.js', 'styles.css', 'qrcode.js', 'manifest.json']
DELIVERABLES = {'workbook': True}          # on unless dataset.json says "deliverables": {"workbook": false}
WORKBOOK = 'workbook.xlsx'
SW_TEMPLATE = os.path.join('tools', 'templates', 'sw.js')
# index.html's links to the files that change with every build carry the build's
# hash (?v=…), so a new build has new addresses no cache can hold. Within Pages'
# 10 minutes, Chromium reused the old build's app.js and data.js from its memory
# cache across a plain reload, without asking the worker (the v8 -> v9 proof, 9 Oct).
STAMPED = ('styles.css', 'data.js', 'app.js')
STAMP_RX = re.compile(r'((?:href|src)="\./(?:%s))(?:\?v=[0-9a-f]{12})?(?=")' % '|'.join(re.escape(f) for f in STAMPED))

DATE_RX = re.compile(r'^(\d{4})-(\d{2})(?:-(\d{2}))?$')
ISSUE_ID_RX = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
YEAR_TOKEN_RX = re.compile(r'^(1[89]\d\d|20\d\d)$')
UNSOURCED_RX = re.compile(r'cadence|interpolat|assum', re.I)
ID_RX = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')


class BuildError(Exception):
    pass


# --------------------------------------------------------------------------
# the signature skin slot (John, 6 Oct): one skin of the tracker's own, from
# config. It uses the same token system as the shared skins and changes how
# things look, never where they are, so the build refuses anything else.
# --------------------------------------------------------------------------
SIGNATURE = 'signature'
# The frames (John, 25 Oct): "x" is the shared skins' layout, X-Men's arrangement;
# "v9" is the template's arrangement as it was up to v9, which a signature skin
# may keep ("frame": "v9", Absolute's own skin). styles.css scopes every x-only
# rule to :root[data-frame="x"], so the v9 frame is today's rules, untouched.
FRAMES = ('x', 'v9')
SIG_SCOPE = ':root[data-skin="signature"]'
# :root tokens a skin may not set. Every token a Look setting's block sets
# (paper, era colours, text size, density, buttons, marks, the dyslexia font)
# is read from styles.css: the signature's CSS comes later, so setting one would
# override the person's choice. These the page itself owns:
RUNTIME_TOKENS = {'--fs', '--stack-h', '--motion', '--skin-ok', '--qr-paper'}
# Pull's layout exception (John, 9 Oct): tokens only the Pull skin sets (its tab
# bar edge to edge, its solid era boxes). Every other skin keeps the template's
# layout and pale eras, so a signature skin may not set them; 80-guards checks
# styles.css the same way.
PULL_ONLY = {'--tabs-inset', '--tabs-rule', '--era-solid',
             '--era-inset', '--era-space', '--era-pad', '--era-head-gap', '--era-edge', '--era-foot-r', '--era-shadow',
             '--era-tab-a', '--era-tab-pad', '--era-cut', '--era-hatch-w', '--era-strip-pad', '--era-bar-h', '--era-bar-r',
             '--era-frame', '--era-frame-r', '--era-body-pad'}
PULL_ONLY_MSG = "is Pull's layout (John, 9 Oct): every other skin keeps the template's"
COLOUR_PROPS = {'color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
                'border-left-color', 'text-decoration-color', 'caret-color', 'accent-color'}
LOOK_PROPS = COLOUR_PROPS | {
    'background-image', 'background-size', 'background-position', 'background-repeat', 'background-blend-mode',
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-width', 'border-style',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
    'box-shadow', 'text-shadow',
    'font-family', 'font-weight', 'font-style', 'font-size', 'font-variant', 'font-variant-numeric', 'font-feature-settings',
    'font-stretch', 'letter-spacing', 'word-spacing', 'line-height', 'text-transform',
    'text-decoration', 'text-decoration-line', 'text-decoration-style', 'text-decoration-thickness', 'text-underline-offset'}
# named so the message says why: these move things or hide them
MOVES = re.compile(r'^(position|display|inset.*|top|right|bottom|left|order|flex.*|grid.*|float|clear|visibility|z-index|'
                   r'transform.*|translate|rotate|scale|width|height|min-width|max-width|min-height|max-height|margin.*|'
                   r'opacity|content|overflow.*|clip.*)$')
LOOK_WORDS = {'none', 'inherit', 'initial', 'unset', 'transparent', 'currentcolor', 'solid', 'dashed', 'dotted', 'double',
              'groove', 'ridge', 'inset', 'outset', 'hidden', 'normal', 'bold', 'bolder', 'lighter', 'italic', 'oblique',
              'small-caps', 'tabular-nums', 'lining-nums', 'oldstyle-nums', 'uppercase', 'lowercase', 'capitalize',
              'underline', 'overline', 'line-through', 'wavy', 'auto', 'from-font', 'repeat', 'no-repeat', 'repeat-x',
              'repeat-y', 'space', 'round', 'cover', 'contain', 'center', 'to', 'at', 'circle', 'ellipse', 'closest-side',
              'farthest-corner', 'multiply', 'screen', 'overlay', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
              'system-ui', 'ui-monospace', 'ui-serif', 'ui-sans-serif', 'condensed', 'expanded', 'semi-condensed',
              'semi-expanded', 'light', 'dark', 'top', 'bottom', 'left', 'right', 'nowrap', 'pre', 'start', 'end'}
# Decorations (John, 8 Oct): a signature skin may add content of its own on
# ::before and ::after (quoted text, attr(data-n), counters), use counters
# anywhere, and place a pseudo-element absolutely against its host (rows and
# heads are anchors in styles.css). A decoration never takes a tap and is
# silent to screen readers: the build adds pointer-events: none and an empty
# alternative (content: X / "") to every one. It still may not move, hide or
# reorder a control: everything else in MOVES stays refused, everywhere.
PSEUDO_RX = re.compile(r'::(before|after)$')
DECOR_PROPS = {'content', 'position', 'top', 'right', 'bottom', 'left', 'inset', 'width', 'height', 'text-align', 'white-space'}
COUNTER_PROPS = {'counter-reset', 'counter-increment', 'counter-set'}
CONTENT_ATTRS = {'data-n'}          # rows and era names carry their reading position, zero-padded
LIST_STYLES = {'decimal', 'decimal-leading-zero', 'lower-roman', 'upper-roman', 'lower-alpha', 'upper-alpha', 'none'}
_STR = r'(?:"[^"\\\n{};]*"|\'[^\'\\\n{};]*\')'
CONTENT_PART = re.compile(r'\s*(?:(' + _STR + r')|attr\(\s*([\w-]+)\s*\)|counter\(\s*([a-z][\w-]*)\s*(?:,\s*([a-z-]+)\s*)?\)'
                          r'|counters\(\s*([a-z][\w-]*)\s*,\s*' + _STR + r'\s*(?:,\s*([a-z-]+)\s*)?\))')
COUNTER_VALUE = re.compile(r'^(?:none|[a-z][\w-]*(?:\s+-?\d+)?(?:\s+[a-z][\w-]*(?:\s+-?\d+)?)*)$')
LOOK_FUNCS = {'var', 'calc', 'min', 'max', 'clamp', 'hsl', 'hsla', 'oklch', 'linear-gradient', 'radial-gradient',
              'repeating-linear-gradient', 'repeating-radial-gradient', 'url'}
COLOUR_FUNCS = {'hsl', 'hsla', 'oklch'}
IMAGE_DIRS = ('fonts/', 'icons/', 'images/')      # precached by the service worker


def css_args(body):
    """Top-level components of a function's arguments (split on space, comma, slash)."""
    parts, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if depth == 0 and ch in ' \t,/':
            if cur.strip():
                parts.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def look_value_problem(value, prop, tokens_ok, shell_root):
    """None when a value only draws on tokens, numbers and look keywords; else why not."""
    if '!' in value:
        return '!important is not allowed'
    if re.search(r'[;{}<>@\\]', value):
        return 'not a plain value'
    if '#' in value:
        return 'a literal colour (%s): derive colours from tokens' % value
    i, n = 0, len(value)
    while i < n:
        c = value[i]
        if c in ' \t,/+*-' and not (c == '-' and i + 1 < n and (value[i + 1].isalpha() or value[i + 1] == '-')):
            i += 1
            continue
        if c in '"\'':
            j = value.find(c, i + 1)
            if j < 0:
                return 'an unclosed string'
            if prop != 'font-family' and not prop.startswith('--'):
                return 'a string outside font-family'
            i = j + 1
            continue
        m = re.match(r'(\d*\.?\d+)(%|[a-z]+)?', value[i:])
        if m and (c.isdigit() or c == '.'):
            i += m.end()
            continue
        m = re.match(r'-?-?[a-zA-Z][\w-]*', value[i:])
        if not m:
            return 'unexpected %r' % c
        word, j = m.group(0), i + m.end()
        if j < n and value[j] == '(':
            depth, k = 1, j + 1
            while k < n and depth:
                depth += {'(': 1, ')': -1}.get(value[k], 0)
                k += 1
            inner, fn = value[j + 1:k - 1], word.lower()
            if fn not in LOOK_FUNCS:
                return '%s() is not allowed (a literal colour, or not a look value)' % fn
            if fn == 'var':
                name, _, fallback = inner.partition(',')
                if not re.match(r'^--[\w-]+$', name.strip()):
                    return 'var() needs a token name'
                prob = look_value_problem(fallback, prop, tokens_ok, shell_root) if fallback.strip() else None
                if prob:
                    return prob
                i = k
                continue
            elif fn in COLOUR_FUNCS:
                if not all('var(--' in a for a in css_args(inner)):
                    return 'a literal colour (%s(%s)): every component must be a token' % (fn, inner)
            elif fn == 'url':
                if prop != 'background-image':
                    return 'url() only in background-image'
                ref = inner.strip().strip('"\'')
                ref = ref[2:] if ref.startswith('./') else ref
                if not ref.startswith(IMAGE_DIRS) or '..' in ref or not os.path.isfile(os.path.join(shell_root, ref)):
                    return 'url(%s) must name a file in %s (precached)' % (inner, ', '.join(IMAGE_DIRS))
                i = k
                continue
            prob = look_value_problem(inner, prop, tokens_ok, shell_root) if inner.strip() else None
            if prob:
                return prob
            i = k
            continue
        if word.lower() not in LOOK_WORDS:
            return '%r is not a look keyword (a named colour? quote font names)' % word
        i = j
    return None


def content_problem(value):
    """None when a decoration's content is quoted text, attr(data-n) and
    counters, in any sequence; else why not."""
    if value in ('none', 'normal'):
        return None
    pos, n = 0, len(value)
    if not value.strip():
        return 'empty content'
    while pos < n:
        m = CONTENT_PART.match(value, pos)
        if not m:
            return 'content may hold only quoted text, attr(data-n) and counter()s (no url(), no "/": the build adds the empty alternative)'
        if m.group(2) and m.group(2) not in CONTENT_ATTRS:
            return 'attr(%s): only %s' % (m.group(2), ', '.join(sorted(CONTENT_ATTRS)))
        for style in (m.group(4), m.group(6)):
            if style and style not in LIST_STYLES:
                return 'counter style %r: one of %s' % (style, ', '.join(sorted(LIST_STYLES)))
        pos = m.end()
        if pos < n and not value[pos:].strip():
            break
    return None


def counter_problem(value):
    if not COUNTER_VALUE.match(value):
        return 'a counter list: names, each with an optional whole number'
    if any(w in ('inherit', 'initial', 'unset') for w in value.split()):
        return 'not a counter name'
    return None


def root_inputs(shell_root):
    """The :root input tokens a skin may set, read from styles.css: every custom
    property in the :root block except derived colours and setting-owned ones."""
    try:
        with open(os.path.join(shell_root, 'styles.css'), encoding='utf-8') as f:
            css = re.sub(r'/\*[\s\S]*?\*/', '', f.read())
    except OSError:
        return set()
    m = re.search(r'(?:^|\})\s*:root\s*\{([^}]*)\}', css)
    if not m:
        return set()
    owned = set(RUNTIME_TOKENS) | PULL_ONLY
    for sel, body in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        if any(re.match(r'^:root\[data-(?!skin=)[\w-]+="[\w-]+"\]$', x.strip()) for x in sel.split(',')):
            owned |= set(re.findall(r'(--[\w-]+)\s*:', body))
    out = set()
    for decl in m.group(1).split(';'):
        if ':' not in decl:
            continue
        name, val = (x.strip() for x in decl.split(':', 1))
        if name.startswith('--') and name not in owned and not re.search(r'#|\b(hsl|hsla|oklch|rgb|rgba)\(', val):
            out.add(name)
    return out


def signature_skin(sig, base, shell_root, errs):
    """Validate franchise.signature and return {'name', 'css'} (css: @font-face
    rules, the token block, then the scoped look-only rules), or None."""
    w = 'franchise.signature'
    if not isinstance(sig, dict):
        errs.append('%s must be an object {name, tokens, fonts?, stylesheet?}' % w)
        return None
    name = sig.get('name')
    if not isinstance(name, str) or not name.strip() or len(name) > 24:
        errs.append('%s.name must be a short name for the skin control (1-24 characters)' % w)
    inputs = root_inputs(shell_root)
    tokens = sig.get('tokens')
    lines = []
    if not isinstance(tokens, dict) or not tokens:
        errs.append('%s.tokens must set at least one input token, e.g. {"--accent-h": 160}' % w)
        tokens = {}
    for k in sorted(tokens):
        v = tokens[k]
        if k in PULL_ONLY:
            errs.append('%s.tokens: %s %s' % (w, k, PULL_ONLY_MSG))
            continue
        if k not in inputs:
            errs.append('%s.tokens: %s is not a known input token (styles.css :root, less the ones Look settings own)' % (w, k))
            continue
        if isinstance(v, bool) or not isinstance(v, (int, float, str)):
            errs.append('%s.tokens.%s must be a number or a string' % (w, k))
            continue
        v = str(v)
        prob = look_value_problem(v, k, inputs, shell_root)
        if prob:
            errs.append('%s.tokens.%s: %s' % (w, k, prob))
        lines.append('  %s: %s;' % (k, v))
    faces = []
    fonts = sig.get('fonts', [])
    if not isinstance(fonts, list):
        errs.append('%s.fonts must be a list of {family, file, weight?, style?}' % w)
        fonts = []
    for i, f in enumerate(fonts):
        fw = '%s.fonts[%d]' % (w, i)
        if not isinstance(f, dict):
            errs.append('%s must be an object' % fw)
            continue
        fam, file = f.get('family'), f.get('file')
        if not isinstance(fam, str) or not re.match(r'^[A-Za-z0-9][A-Za-z0-9 -]{0,40}$', fam):
            errs.append('%s.family must be a plain font name' % fw)
        if not isinstance(file, str) or not re.match(r'^fonts/[\w.-]+\.woff2$', file) or not os.path.isfile(os.path.join(shell_root, file)):
            errs.append('%s.file must be a .woff2 in fonts/ (precached): %r' % (fw, file))
        weight, style = f.get('weight', 400), f.get('style', 'normal')
        if weight not in (100, 200, 300, 400, 500, 600, 700, 800, 900):
            errs.append('%s.weight must be 100-900 in steps of 100' % fw)
        if style not in ('normal', 'italic'):
            errs.append('%s.style must be normal or italic' % fw)
        faces.append("@font-face { font-family: '%s'; font-style: %s; font-weight: %s; font-display: swap;\n"
                     "  src: url('./%s') format('woff2'); }" % (fam, style, weight, file))
    rules = []
    rel = sig.get('stylesheet')
    if rel is not None:
        if not isinstance(rel, str):
            errs.append('%s.stylesheet must be a path to a .css file' % w)
        else:
            try:
                with open(os.path.join(base, rel), encoding='utf-8') as f:
                    css = f.read()
            except OSError:
                errs.append('%s.stylesheet: missing file %s' % (w, rel))
                css = ''
            rules = signature_rules(css, rel, inputs, shell_root, errs)
    css = '\n'.join(faces + ['%s {\n%s\n}' % (SIG_SCOPE, '\n'.join(lines))] + rules) + '\n'
    # the arrangement it is drawn on (John, 25 Oct): the shared skins' X-Men layout, or v9's, kept exactly
    frame = sig.get('frame', 'x')
    if frame not in FRAMES:
        errs.append('%s.frame must be one of %s: %r' % (w, ', '.join(FRAMES), frame))
        frame = 'x'
    return {'name': name, 'css': css, 'frame': frame}


def signature_rules(css, rel, inputs, shell_root, errs):
    """The signature stylesheet, checked rule by rule and re-emitted normalised:
    every selector scoped to the signature skin, only look properties."""
    src = re.sub(r'/\*[\s\S]*?\*/', '', css)
    out, i = [], 0
    while True:
        open_ = src.find('{', i)
        if open_ < 0:
            if src[i:].strip():
                errs.append('%s: text after the last rule' % rel)
            break
        sel = ' '.join(src[i:open_].split())
        close = src.find('}', open_)
        if close < 0:
            errs.append('%s: unclosed rule %s' % (rel, sel))
            break
        body = src[open_ + 1:close]
        i = close + 1
        if sel.startswith('@') or '{' in body:
            errs.append('%s: %s — at-rules and nesting are not allowed (fonts go in signature.fonts)' % (rel, sel))
            continue
        parts = [p.strip() for p in sel.split(',')]
        bad = [p for p in parts if not re.match(r'^' + re.escape(SIG_SCOPE) + r'(\[data-[\w-]+="[\w-]+"\])*(\s+\S.*)?$', p)]
        if bad or not sel:
            errs.append('%s: selector %r is not scoped to %s' % (rel, (bad or [sel])[0], SIG_SCOPE))
            continue
        decls, decor = [], all(PSEUDO_RX.search(p) for p in parts)
        for d in body.split(';'):
            if not d.strip():
                continue
            if ':' not in d:
                errs.append('%s: %s: %r is not a declaration' % (rel, sel, d.strip()))
                continue
            prop, val = d.split(':', 1)
            prop, val = prop.strip().lower(), ' '.join(val.split())
            where = '%s: %s { %s }' % (rel, sel, prop)
            if prop in COUNTER_PROPS:
                prob = counter_problem(val)
                if prob:
                    errs.append('%s: %s' % (where, prob))
                else:
                    decls.append('  %s: %s;' % (prop, val))
                continue
            if decor and prop in DECOR_PROPS:
                if prop == 'content':
                    prob = content_problem(val)
                    if prob:
                        errs.append('%s: %s' % (where, prob))
                    elif val in ('none', 'normal'):
                        decls.append('  content: %s;' % val)
                    else:                                   # older browsers keep the first; the rest read it silently
                        decls.append('  content: %s;\n  content: %s / "";' % (val, val))
                    continue
                if prop == 'position':
                    if val != 'absolute':
                        errs.append('%s: a decoration is placed absolutely or not at all (position: absolute)' % where)
                    else:
                        decls.append('  position: absolute;')
                    continue
                prob = look_value_problem(val, prop, inputs, shell_root)
                if prob:
                    errs.append('%s: %s' % (where, prob))
                else:
                    decls.append('  %s: %s;' % (prop, val))
                continue
            if prop.startswith('--'):
                if prop in PULL_ONLY:
                    errs.append('%s: %s' % (where, PULL_ONLY_MSG))
                    continue
                if prop not in inputs:
                    errs.append('%s: not a known input token' % where)
                    continue
            elif prop in DECOR_PROPS and prop in ('content', 'position'):
                errs.append('%s: refused — only a ::before or ::after decoration may have %s' % (where, prop))
                continue
            elif MOVES.match(prop):
                errs.append('%s: refused — a skin changes how things look, never where they are' % where)
                continue
            elif prop not in LOOK_PROPS:
                errs.append('%s: not a look property (colours from tokens, background images, borders, radii, '
                            'shadows and font settings)' % where)
                continue
            prob = look_value_problem(val, prop, inputs, shell_root)
            if prob:
                errs.append('%s: %s' % (where, prob))
                continue
            decls.append('  %s: %s;' % (prop, val))
        if decor:
            decls.append('  pointer-events: none;')               # a decoration never takes a tap
        out.append('%s {\n%s\n}' % (',\n'.join(parts), '\n'.join(decls)))
    return out


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
    return re.sub(r'[^a-z0-9]', '', t)


# --------------------------------------------------------------------------
# loading
# --------------------------------------------------------------------------
def is_minutes(v):
    """Durations are whole minutes, 1 or more (bool is an int in Python: refuse it)."""
    return isinstance(v, int) and not isinstance(v, bool) and v >= 1


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


# --------------------------------------------------------------------------
# era colours (session 7). A tracker may give an era its own colour: Pull draws
# it exactly as given, with white text, and the other skins ignore it (John, 9
# and 12 Oct). Where an era has none, Pull uses its default palette (John, 13
# Oct): the reference tracker's eleven era colours, in its order, era i taking
# colour i mod 11. Each default must clear 4.5:1 for white text, for the years
# at 85 % and for white text on its strip; one that doesn't is nudged darker
# only as far as it must. The maths is OKLab's and WCAG 2's contrast.
# --------------------------------------------------------------------------
COLOUR_RX = re.compile(r'^#[0-9A-Fa-f]{6}$')
AA = 4.5
YEARS_ALPHA = 217 / 255                   # a Pull era box's years: white at 85 %, as the reference tracker; browsers draw it at 8-bit alpha (217)
WHITE = (255, 255, 255)


def _to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _to_srgb(v):
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgb_hex(rgb):
    return '#%02X%02X%02X' % tuple(rgb)


def rgb_oklch(rgb):
    r, g, b = (_to_linear(v / 255) for v in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, (a * a + bb * bb) ** 0.5, (math.degrees(math.atan2(bb, a)) % 360)


def oklch_linear(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def oklch_rgb(L, C, H):
    return tuple(round(min(max(_to_srgb(min(max(v, 0.0), 1.0)), 0.0), 1.0) * 255) for v in oklch_linear(L, C, H))


def in_gamut(L, C, H):
    return all(0.0 <= v <= 1.0 for v in oklch_linear(L, C, H))


def max_chroma(L, H):
    """The highest chroma inside sRGB at lightness L and hue H."""
    lo, hi = 0.0, 0.5
    for _ in range(40):
        mid = (lo + hi) / 2
        if in_gamut(L, mid, H):
            lo = mid
        else:
            hi = mid
    return lo


def luminance(rgb):
    return sum(k * _to_linear(v / 255) for k, v in zip((0.2126, 0.7152, 0.0722), rgb))


def contrast(a, b):
    x, y = luminance(a), luminance(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def over(fg, alpha, bg):
    """fg at alpha over bg, blended as browsers blend text (in sRGB values), to 8 bits."""
    return tuple(round(alpha * f + (1 - alpha) * b) for f, b in zip(fg, bg))


def white_ratios(rgb):
    """White text on rgb, and the years (white at 85 %) on it."""
    return contrast(WHITE, rgb), contrast(over(WHITE, YEARS_ALPHA, rgb), rgb)


def strip_shade(rgb):
    """The stats strip under a tracker's own colour: the reference tracker's
    rule, each channel 25 darker, never below 0."""
    return tuple(max(v - 25, 0) for v in rgb)


def passing_shade(rgb):
    """A hint for a colour under AA: the same hue, darker, until white text, the
    85 % years, white text on its strip and the colour as text on Pull's card
    (the review era tag) all clear 4.5:1 (chroma kept where the gamut allows)."""
    L, C, H = rgb_oklch(rgb)
    while L > 0:
        cand = oklch_rgb(L, min(C, max_chroma(L, H)), H)
        if min(white_ratios(cand)) >= AA and contrast(WHITE, strip_shade(cand)) >= AA and text_ratio(cand) >= AA:
            return cand
        L -= 0.001
    return (0, 0, 0)


def oklch_parts(rgb):
    """OKLCH numbers that come back to the same 8-bit colour (checked in 20-build)."""
    L, C, H = rgb_oklch(rgb)
    return [round(L, 6), round(C, 6), round(H, 4)]


# Pull's default palette (John, 13 Oct): the reference tracker's eleven era
# colours, in its order, as test/layout/ref/x-men.json records them (20-build
# checks the two agree). "One colour" gives every era the tracker's own accent
# (franchise.accent; John, 19 and 24 Oct), nudged by the same rule; without one,
# the palette's last, its navy, which is also the reference tracker's accent.
PULL_PALETTE = ['#A6791E', '#A6303C', '#7B3F94', '#2C6E8C', '#1F7A5C', '#B08A1F',
                '#C0622A', '#C21E6D', '#9C4A3C', '#4A2E5C', '#1C3A5E']
PULL_MONO = 10
NUDGE_STEP = 0.0005                       # OKLCH lightness, per step


def passes_aa(rgb):
    """White text, the 85 % years and white text on the strip, each at 4.5:1 or more."""
    return min(white_ratios(rgb)) >= AA and contrast(WHITE, strip_shade(rgb)) >= AA


def nudge(rgb, ok=passes_aa):
    """The least darkening that passes (ok: an era box's white text by default):
    OKLCH lightness lowered a step at a time, hue and chroma kept. Where the
    gamut runs out first (a yellow holds less chroma as it darkens), the chroma
    follows the gamut's edge, so the colour stays inside sRGB. Returns (rgb, None)
    for a colour that already passes, else (rgb, {'steps', 'l', 'c', 'edge'})."""
    if ok(rgb):
        return rgb, None
    L, C, H = rgb_oklch(rgb)
    k = 0
    while k * NUDGE_STEP < L:
        k += 1
        x = L - k * NUDGE_STEP
        c = C if in_gamut(x, C, H) else max_chroma(x, H)
        cand = oklch_rgb(x, c, H)
        if ok(cand):
            return cand, {'steps': k, 'l': round(x, 4), 'c': round(c, 4), 'edge': c < C}
    return (0, 0, 0), {'steps': k, 'l': 0, 'c': 0, 'edge': True}


def pull_palette():
    """The defaults as drawn: [{source, hex, nudged, white, years, strip}], in order."""
    out = []
    for src in PULL_PALETTE:
        rgb, how = nudge(hex_rgb(src))
        white, years = white_ratios(rgb)
        out.append({'source': src, 'hex': rgb_hex(rgb), 'nudged': how, 'white': round(white, 3), 'years': round(years, 3),
                    'strip': round(contrast(WHITE, strip_shade(rgb)), 3)})
    return out


# The reference tracker's arc-type colours (session 8; John, 24 and 28 Oct): an arc
# card's stripe in its type's colour, exactly; its type badge in that colour on a
# 13 % tint of itself, darkened only as far as the badge's text must be to pass on
# Pull's card on every paper. Ruling C (MAIN #266886, SOLO #0A6E51, MINI #A04600)
# passed on the default paper only; on every paper it takes MAIN #206381, SOLO
# #00694D, MINI #994300 (C revised, John, 29 Oct). SPIN-OFF and EVENT pass as they are. A
# type the table doesn't name takes its fallback.
PULL_TYPES = {'MAIN': '#2C6E8C', 'SPIN-OFF': '#7B3F94', 'SOLO': '#1F7A5C', 'MINI': '#C0622A', 'EVENT': '#A6303C'}
PULL_TYPE_OTHER = '#666666'
# Pull's card on each paper swatch, as styles.css draws it (40-look checks they agree)
PULL_CARDS = {'default': (242, 240, 233), 'warm': (248, 241, 227), 'grey': (236, 237, 239), 'rose': (247, 228, 230),
              'mint': (231, 244, 238), 'sky': (227, 238, 248), 'lilac': (238, 230, 245)}
BADGE_ALPHA = 34 / 255                    # the badge's tint: its colour at 0x22, as the reference


def badge_ratio(rgb):
    """The badge's text on its own tint, on the card where it is lowest."""
    return min(contrast(rgb, over(rgb, BADGE_ALPHA, card)) for card in PULL_CARDS.values())


def pull_type(name):
    """What Pull draws for an arc type: its stripe and its badge, as OKLCH numbers."""
    src = PULL_TYPES.get(str(name).upper(), PULL_TYPE_OTHER)
    badge, how = nudge(hex_rgb(src), lambda c: badge_ratio(c) >= AA)
    return {'hex': src, 'stripe': oklch_parts(hex_rgb(src)), 'badgeHex': rgb_hex(badge), 'badge': oklch_parts(badge),
            'ratio': round(badge_ratio(badge), 3), 'nudged': how}


def text_ratio(rgb):
    """A colour as text on Pull's card, on the paper where it is lowest."""
    return min(contrast(rgb, card) for card in PULL_CARDS.values())


def pull_colour(hexcol):
    """What Pull draws for a colour: its tab and strip as OKLCH numbers."""
    rgb = hex_rgb(hexcol)
    return {'hex': hexcol.upper(), 'tab': oklch_parts(rgb), 'strip': oklch_parts(strip_shade(rgb))}


def build(dataset_path, previous_datajs=None, keep=None):
    """Returns (payload, report). Raises BuildError listing every problem.
    keep (a dict) receives the stitched rows, arcs and eras as soon as they are
    stitched, even when validation then fails (the verify gate reads them)."""
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
    # what the build produces besides the app: the workbook is on unless a
    # tracker turns it off (web-app-only trackers, e.g. Absolute and Dark Nights)
    deliverables = ds.get('deliverables', {})
    if not isinstance(deliverables, dict) or any(k not in DELIVERABLES for k in deliverables) or \
            any(not isinstance(v, bool) for v in deliverables.values()):
        errs.append('deliverables must be an object of on/off switches: %s' % ', '.join(sorted(DELIVERABLES)))
        deliverables = {}
    deliverables = dict(DELIVERABLES, **deliverables)

    # ---- franchise ----
    fr = need(ds, 'franchise', 'dataset', dict) or {}
    for k in ('key', 'wordmark', 'title', 'strapline', 'span', 'theme'):
        need(fr, k, 'franchise', str)
    if not re.match(r'^[a-z0-9][a-z0-9-]{1,30}$', str(fr.get('key', ''))):
        errs.append('franchise.key must be a lowercase slug (it namespaces storage and the QR prefix)')
    strict_credits = bool(fr.get('strictCredits', False))
    # skins: which the tracker offers, and the one a first visit opens in
    skins = fr.get('skins', SKINS)
    if not isinstance(skins, list) or not skins or any(k not in SKINS for k in skins) or len(set(skins)) != len(skins):
        errs.append('franchise.skins must be a non-empty list of distinct skins from %s' % ', '.join(SKINS))
        skins = SKINS
    skin = fr.get('skin', skins[0])
    if skin not in skins:
        errs.append('franchise.skin "%s" must be one of franchise.skins (%s)' % (skin, ', '.join(skins)))
    # the signature skin (John, 6 Oct): offered first, and a first visit opens in it
    signature = signature_skin(fr['signature'], base, ROOT, errs) if 'signature' in fr else None
    offered = ([SIGNATURE] if signature else []) + skins
    # an old tracker's skin pick, read once on a first visit: a field of its saved settings + value -> skin
    legacy = (fr.get('storage') or {}).get('legacy') or {}
    if 'skins' in legacy:
        ls = legacy['skins']
        if (not isinstance(ls, dict) or not isinstance(ls.get('field'), str) or not re.match(r'^[\w-]+$', ls['field'])
                or not isinstance(ls.get('map'), dict) or not ls['map']):
            errs.append('franchise.storage.legacy.skins must be {field, map: {old value: skin}}')
        else:
            for old_v, sk in sorted(ls['map'].items()):
                if sk not in offered:
                    errs.append('franchise.storage.legacy.skins.map: %r maps to %r, which this tracker does not offer (%s)'
                                % (old_v, sk, ', '.join(offered)))
    # icons: from config (D-13), every one a real PNG of its size; placeholders warn
    icons = dict(DEFAULT_ICONS)
    cfg_icons = fr.get('icons', {})
    if not isinstance(cfg_icons, dict) or any(k not in DEFAULT_ICONS or not isinstance(v, str) for k, v in cfg_icons.items()):
        errs.append('franchise.icons must map any of %s to a PNG path in the repo' % ', '.join(sorted(DEFAULT_ICONS)))
    else:
        icons.update(cfg_icons)
    placeholders = []
    for k in sorted(icons):
        path = os.path.join(ROOT, icons[k])
        size = png_size(path)
        if size is None:
            errs.append('franchise.icons.%s: %s is not a PNG in the repo' % (k, icons[k]))
        elif size != ICON_SIZES[k]:
            errs.append('franchise.icons.%s: %s is %dx%d, needs %dx%d' % ((k, icons[k]) + size + ICON_SIZES[k]))
        elif sha_prefix(path) in PLACEHOLDER_ICONS:
            placeholders.append(icons[k])
    if placeholders and fr.get('key') != 'starter':
        warns.append('icons: %s %s the template\'s placeholder artwork. Replace with the franchise\'s own before the first deploy '
                     '(iOS caches a home-screen icon at install)' % (', '.join(placeholders), 'is' if len(placeholders) == 1 else 'are'))
    relevance = fr.get('eventRelevance', fr.get('key'))
    # readable versions (decided 4 Oct): a migrated tracker continues its old numbering
    version_start = fr.get('versionStart', 1)
    if not isinstance(version_start, int) or isinstance(version_start, bool) or version_start < 1:
        errs.append('franchise.versionStart must be a whole number, 1 or more (the old tracker\'s last build + 1)')
        version_start = 1

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

    # ---- era colours (session 7): a tracker's own, drawn as given; else Pull's default palette ----
    palette = pull_palette()
    era_colours, under_aa = [], []
    for i, e in enumerate(eras):
        w = 'era %s' % e.get('id', i)
        out = {'pull': pull_colour(palette[i % len(palette)]['hex'])}
        col = e.get('colour')
        if col is not None:
            if not isinstance(col, str) or not COLOUR_RX.match(col):
                errs.append('%s: colour must be #RRGGBB (got %r)' % (w, col))
            else:
                rgb = hex_rgb(col)
                white, years = white_ratios(rgb)
                strip = contrast(WHITE, strip_shade(rgb))
                # the colour as text on Pull's card, on each paper: the x frame's review era tag draws it as given (John, 29 Oct)
                on_card = {k: round(contrast(rgb, c), 3) for k, c in PULL_CARDS.items()}
                out['colour'] = {'hex': col.upper(), 'tab': oklch_parts(rgb), 'strip': oklch_parts(strip_shade(rgb)),
                                 'white': round(white, 3), 'years': round(years, 3), 'stripWhite': round(strip, 3), 'onCard': on_card}
                out['pull'] = pull_colour(col)            # Pull draws a tracker's own colour exactly
                if min(white, years, strip, text_ratio(rgb)) < AA:
                    hint = passing_shade(rgb)
                    under_aa.append(e.get('id'))
                    warns.append('%s: white text on its colour %s is %.2f:1 (the years at 85 %%: %.2f:1; on its strip %s: %.2f:1; as text on Pull\'s card, '
                                 'the review era tag: %.2f:1 at the lowest), under %.1f:1 (WCAG AA). '
                                 'Pull draws it as given (John, 12 and 29 Oct). The nearest shade of its hue where all pass: %s (%.2f:1, %.2f:1)'
                                 % (w, col.upper(), white, years, rgb_hex(strip_shade(rgb)), strip, text_ratio(rgb), AA, rgb_hex(hint), *white_ratios(hint)))
        era_colours.append(out)
    # "One colour": the tracker's accent, darkened only as far as white text, the 85 % years and the strip need; else the navy
    accent = fr.get('accent')
    if accent is not None and (not isinstance(accent, str) or not COLOUR_RX.match(accent)):
        errs.append('franchise.accent must be #RRGGBB (got %r)' % (accent,))
        accent = None
    if accent is None:
        mono_rgb, mono_how = hex_rgb(palette[PULL_MONO]['hex']), None
    else:
        mono_rgb, mono_how = nudge(hex_rgb(accent))
    pull_mono = pull_colour(rgb_hex(mono_rgb))
    one_colour = {'source': accent.upper() if accent else None, 'hex': pull_mono['hex'], 'nudged': mono_how}
    if text_ratio(mono_rgb) < AA:
        warns.append('franchise.accent %s: "One colour" draws every era in %s, which reads %.2f:1 as the review era tag on Pull\'s card at the lowest, '
                     'under %.1f:1 (WCAG AA)' % (accent, pull_mono['hex'], text_ratio(mono_rgb), AA))

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
    # per-format durations (decided 1 Oct): a default length per item for a non-comic medium
    durations = ds.get('durations') or {}
    if not isinstance(durations, dict):
        errs.append('durations must be an object of {medium: minutes}')
        durations = {}
    for m in sorted(durations):
        if m == COMIC:
            errs.append('durations.comic is not allowed: every comic counts as one issue and is timed '
                        'by the minutes-per-issue setting')
        elif m not in media:
            errs.append('durations: unknown medium %r' % m)
        if not is_minutes(durations[m]):
            errs.append('durations.%s must be a whole number of minutes (1 or more)' % m)
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
                                          'duration', 'type', 'note', 'flags') if k in ch}
                new.update(id=cid, era=eera, arc=arc_id, _src='events/%s.json' % eid,
                           _order=len(rows), _event=ei, _eorder=order, _essential=essential)
                rows.append(new)
                by_issue[cid] = new
            n_all += 1
            n_ess += 1 if (row is not None or essential) else 0
        events_out.append({'id': eid, 'name': ev.get('name', eid), 'era': ERA[eera], 'arc': ARC.get(arc_id, -1),
                           'essential': n_ess, 'complete': n_all, 'adds': n_all - n_ess,
                           'hash': ev_hash})

    if keep is not None:
        keep.update(dataset=ds, rows=rows, arcs=arcs, eras=eras, events=events_out)

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
        if 'duration' in r:
            if not is_minutes(r['duration']):
                errs.append('%s: duration must be a whole number of minutes (1 or more)' % w)
            elif r['medium'] == COMIC:
                errs.append('%s: duration on a comic row is not allowed (every comic counts as one issue, '
                            'timed by the minutes-per-issue setting)' % w)
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

    # ---- durations: comics use the minutes-per-issue setting (0); every other
    #      format carries its own minutes (row duration, else durations[medium]);
    #      none at all is -1, which time left leaves out and the app marks "untimed" ----
    need_dur = {}
    for r in rows:
        if r['_inert'] or r['medium'] == COMIC:
            r['_dur'] = 0
            continue
        own = r.get('duration', durations.get(r['medium']))
        r['_dur'] = own if is_minutes(own) else -1
        tot, miss = need_dur.get(r['medium'], (0, 0))
        need_dur[r['medium']] = (tot + 1, miss + (1 if r['_dur'] < 0 else 0))
    timed_total = sum(v[0] for v in need_dur.values())
    timed_missing = sum(v[1] for v in need_dur.values())
    dur_coverage = round(100.0 * (timed_total - timed_missing) / timed_total, 1) if timed_total else 100.0
    for m in media:                          # vocabulary order, so warnings are deterministic
        tot, miss = need_dur.get(m, (0, 0))
        if miss:
            warns.append('durations: %d of %d %s rows have no duration (coverage %.1f%%) — time left '
                         'leaves them out' % (miss, tot, m, round(100.0 * (tot - miss) / tot, 1)))

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
        'franchise': dict({k: canon(fr[k]) for k in ('key', 'wordmark', 'title', 'strapline', 'span', 'theme',
                                                     'background', 'searchUrl', 'dualOrder', 'storage')
                           if k in fr}, skins=skins, skin=skin, icons={k: './' + v for k, v in sorted(icons.items())}),
        'signature': signature,
        'eras': [dict({'id': e['id'], 'name': e['name'], 'rank': e['rank'], 'years': e.get('years', ''),
                       'intro': e.get('intro', '')}, **era_colours[i]) for i, e in enumerate(eras)],
        # what Pull draws for "One colour": every era in the palette's navy; each era carries its own as 'pull'
        'pullMono': pull_mono,
        'periods': [{'id': p.get('id'), 'name': p.get('name', ''), 'label': p.get('label', ''),
                     'blurb': p.get('blurb', ''), 'eras': [ERA[x] for x in p['eras']]} for p in periods],
        'strands': strands,
        'types': types,
        'typeColours': [pull_type(t) for t in types],   # Pull's arc cards (session 8): a stripe and a badge per type
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
        'issueDuration': [r['_dur'] for r in rows],
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
            'durationsCoverage': dur_coverage,
        },
        'timeline': sorted(range(len(rows)), key=lambda i: (ARC[rows[i]['arc']], rows[i]['_key'])),
        'legend': [{'term': x.get('term', ''), 'meaning': x.get('meaning', '')} for x in ds.get('legend') or []],
        'maintenance': ds.get('maintenance') or [],
        # sync: a compact QR code stores marks by POSITION, so it is only valid
        # for the same rows in the same order; this hash says which list it was.
        'dataVersion': hashlib.sha256('\n'.join(r['id'] for r in rows).encode('utf-8')).hexdigest()[:12],
        # the old (v2) QR order is rebuilt from legacy ids PLUS retired ones,
        # so a retired issue keeps its slot and later positions don't shift
        'retiredIds': sorted(retired),
    }
    report = {'warnings': warns, 'rows': len(rows), 'checkable': len(checkable),
              'eras': len(eras), 'events': events_out, 'creditsCoverage': coverage,
              'durationsCoverage': dur_coverage, 'creators': len(creator_names),
              'versionStart': version_start, 'deliverables': deliverables,
              'eraColours': {'set': sum(1 for c in era_colours if 'colour' in c), 'underAA': under_aa}, 'oneColour': one_colour}
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
    for d in ('fonts', 'icons', 'images'):       # images: a signature skin's background images (IMAGE_DIRS)
        p = os.path.join(shell_root, d)
        if os.path.isdir(p):
            out += ['./%s/%s' % (d, n) for n in sorted(os.listdir(p)) if not n.startswith('.')]
    return out


def png_size(path):
    """(width, height) from a PNG's IHDR, or None when it isn't a PNG."""
    try:
        with open(path, 'rb') as f:
            head = f.read(24)
    except OSError:
        return None
    if len(head) < 24 or head[:8] != b'\x89PNG\r\n\x1a\n' or head[12:16] != b'IHDR':
        return None
    return struct.unpack('>II', head[16:24])


def sha_prefix(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def manifest_for(fr):
    bg = fr.get('background', fr['theme'])
    ic = fr.get('icons') or {k: './' + v for k, v in DEFAULT_ICONS.items()}
    return json.dumps({
        'name': fr['title'], 'short_name': fr['wordmark'], 'description': fr['strapline'],
        'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any',
        'background_color': bg, 'theme_color': fr['theme'],
        'icons': [
            {'src': ic['192'], 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': ic['512'], 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
            {'src': ic['maskable'], 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        ]}, indent=2, ensure_ascii=False) + '\n'


def next_version(build_id, previous, version_start):
    """The readable version number. It counts up by itself: the previous data.js's
    number, plus 1 when the content hash changed. Never below versionStart, and
    versionStart when there is no previous version. Nobody bumps it by hand."""
    prev = (previous or {}).get('version')
    if not isinstance(prev, int) or isinstance(prev, bool) or prev < 1:
        return version_start
    return max(version_start, prev if previous.get('build') == build_id else prev + 1)


def stamp_index(html, build_id=None):
    """index.html with each STAMPED link carrying ?v=<build_id>, or with no
    stamp at all (build_id None): the form the content hash reads, so the stamp
    never feeds the hash it is made from."""
    return STAMP_RX.sub(lambda m: m.group(1) + ('?v=' + build_id if build_id else ''), html)


def render_outputs(payload, shell_root, version_start=1, previous=None):
    """data.js, sw.js and manifest.json, all stamped with one content hash, and
    index.html with its links stamped with it. The version is stamped after the
    hash, so it never feeds it: the cache name follows the content, and the
    number only follows the cache name."""
    manifest = manifest_for(payload['franchise'])
    h = hashlib.sha256()
    h.update(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode())
    h.update(manifest.encode())
    for rel in SHELL_FILES[:-1] + [SW_TEMPLATE]:
        p = os.path.join(shell_root, rel)
        if os.path.exists(p):
            with open(p, 'rb') as f:
                body = f.read()
            if rel == 'index.html':
                body = stamp_index(body.decode('utf-8')).encode('utf-8')
            h.update(rel.encode() + b'\0' + body)
    statics = static_files(shell_root)
    for rel in statics:
        with open(os.path.join(shell_root, rel[2:]), 'rb') as f:
            h.update(rel.encode() + b'\0' + f.read())
    build_id = h.hexdigest()[:12]
    version = next_version(build_id, previous, version_start)

    shell = ['./', './index.html', './app.js', './styles.css', './data.js', './qrcode.js', './manifest.json']
    cache = '%s-%s' % (payload['franchise']['key'], build_id)
    # the page reads its own cache name and file list for Settings -> Offline (F-35)
    data = dict(payload, build=build_id, version=version, cache=cache, precache=shell + statics)
    datajs = 'window.TRACKER_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(shell_root, SW_TEMPLATE), encoding='utf-8') as f:
        tpl = f.read()
    sw = (tpl.replace('__CACHE__', cache).replace('__KEY__', payload['franchise']['key'])
             .replace('__SHELL__', json.dumps(shell))
             .replace('__STATIC__', json.dumps(statics, indent=2)))
    files = {'data.js': datajs, 'sw.js': sw, 'manifest.json': manifest}
    index = os.path.join(shell_root, 'index.html')
    if os.path.exists(index):
        with open(index, encoding='utf-8') as f:
            html = f.read()
        stamped = stamp_index(html, build_id)
        missing = [n for n in STAMPED if '/%s?v=%s"' % (n, build_id) not in stamped]
        if missing:
            raise BuildError(['index.html: no link to %s to stamp with the build' % ', '.join(missing)])
        files['index.html'] = stamped
    return files, build_id, version


def main(argv):
    if argv[:1] == ['--validate-issue-ids']:
        print(json.dumps({i: issue_id_problem(i) for i in argv[1:]}))
        return 0
    if argv[:1] == ['--pull-palette']:             # Pull's default era colours as drawn, with every nudge (20-build, and for John)
        print(json.dumps(pull_palette(), indent=1))
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
        previous = os.path.join(out, 'data.js')
        keep = {}
        payload, report = build(dataset, previous_datajs=previous, keep=keep)
        files, build_id, version = render_outputs(payload, ROOT, report['versionStart'], read_datajs(previous))
        if os.path.realpath(out) != os.path.realpath(ROOT):
            files.pop('index.html', None)       # another output folder takes the shell as it is
        binary = {}
        if report['deliverables']['workbook']:
            import build_workbook
            binary[WORKBOOK] = build_workbook.xlsx_bytes(build_workbook.sheets_for(payload, keep))
    except BuildError as e:
        for msg in e.args[0]:
            print('ERROR ' + msg, file=sys.stderr)
        print('BUILD FAILED: %d error(s)' % len(e.args[0]), file=sys.stderr)
        return 1
    for w in report['warnings']:
        print('WARN  ' + w, file=sys.stderr)
    report['build'], report['version'] = build_id, version
    if opts.get('--report'):
        with open(opts['--report'], 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=1)
    workbook_off = os.path.join(out, WORKBOOK) if not report['deliverables']['workbook'] else None
    if check:
        stale = []
        for name, content in files.items():
            p = os.path.join(out, name)
            cur = open(p, encoding='utf-8').read() if os.path.exists(p) else None
            if cur != content:
                stale.append(name)
        for name, content in binary.items():
            p = os.path.join(out, name)
            cur = open(p, 'rb').read() if os.path.exists(p) else None
            if cur != content:
                stale.append(name)
        if workbook_off and os.path.exists(workbook_off):
            stale.append('%s (deliverables.workbook is false: it should not exist)' % WORKBOOK)
        if stale:
            print('STALE: %s — run python3 tools/build.py' % ', '.join(stale), file=sys.stderr)
            return 1
        print('fresh: v%d, build %s (%d rows, %d eras)' % (version, build_id, report['rows'], report['eras']))
        return 0
    os.makedirs(out, exist_ok=True)
    for name, content in files.items():
        with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
            f.write(content)
    for name, content in binary.items():
        with open(os.path.join(out, name), 'wb') as f:
            f.write(content)
    if workbook_off and os.path.exists(workbook_off):
        os.remove(workbook_off)                 # generated, and this tracker has turned it off
        print('removed %s: deliverables.workbook is false' % WORKBOOK)
    print('built v%d (%s): %d rows (%d checkable), %d eras, %d events, %d creators, credits %.1f%%, durations %.1f%%%s'
          % (version, build_id, report['rows'], report['checkable'], report['eras'], len(report['events']),
             report['creators'], report['creditsCoverage'], report['durationsCoverage'],
             ', workbook' if binary else ', no workbook (deliverables.workbook is false)'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
