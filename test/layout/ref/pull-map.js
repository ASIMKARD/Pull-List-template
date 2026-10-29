/* Pull = X-Men (John, 6 Oct; the whole page since 24 Oct): which X-Men
   element each template element is measured against, in every view, at every
   width, and what is measured. Shared by the capture script (capture-x-men.js,
   session-only: it reads the live X-Men tracker) and test/layout/45-pull, so
   both always measure the same things.

   Session 8 (John, 24 Oct): the whole page, in seven views (the Checklist
   landing, an era open, an arc open, scrolled, Reading, Reviews, Settings) plus
   "extras" (a core row and a gap note), at 320, 390 and 1024 px. The template
   side is the pull-ref fixture in Pull: top-level eras with X-Men's type names
   and its first six era colours. Every visible X-Men element is mapped or
   listed in ONLY['x-men'] with the kept item that explains it, and every
   visible template element likewise (45-pull's inventory checks). Every
   difference left is in DIFFERENCES, tied to a kept item, to John's ruling,
   or to the step of session 8 that fixes it.

   Colours, font families, weights, case and style compare exactly; sizes and
   positions within 0.5 px. */
'use strict';

const WIDTHS = [320, 390, 1024];
const HEIGHTS = { 320: 568, 390: 844, 1024: 768 };
const WIDTH = 390;                       // the screenshots, the folder tab's shape and the era colours
const HEIGHT = HEIGHTS[WIDTH];
const VIEWS = ['landing', 'era', 'arc', 'scrolled', 'reading', 'reviews', 'settings', 'extras'];
const SCROLL = 300;                      // the scrolled view: both pages scrolled this far

/* The steps of session 8, in order (PROGRESS.md). A difference tied to a step
   that is done (at or before CURRENT_STEP) fails 45-pull: that step should
   have fixed it. Session 8 is closed (step 9), so no difference may be tied to a step. */
const STEPS = ['1', '1b', '2', '3', '4a', '4b', '5', '6a', '6b', '7', '8', '9'];
const CURRENT_STEP = '9';

const TEXT = ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'fontStyle', 'lineHeight', 'color'];   // line height too (John, 29 Oct: the eras read bigger)
/* Text drawn on a coloured box is compared by the colour you see: its colour
   times every opacity above it (X-Men's years are white at opacity .85). */
const SEEN = TEXT.slice(0, -1).concat(['effectiveColor']);
const PAD = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
const EDGE = ['borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius'];
const RADII = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];

/* MAP[view] = [what, X-Men selector, template selector, properties, options].
   A selector ending in @N is its Nth match. Options: anchor (another row of
   the same view: rel* positions are measured from its box), leaf (false: the
   row's descendants are not covered by it; rows with text are leaves). */
const MAP = {
  landing: [
    ['page background', 'body', 'body', ['backgroundColor', 'lineHeight']],
    ['header', '.topbar', '#phead', ['effectiveBackground', 'boxLeft', 'boxWidth', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor', 'position'], { leaf: false }],
    ['title', '.topbar h1', '.ptitle', TEXT.concat(['lineHeight', 'relLeft', 'relTop']), { anchor: 'header' }],
    ['offline line', '.topbar .offline-badge', '.pbadge', SEEN.concat(['relLeft', 'relTop']), { anchor: 'header' }],
    ['subtitle', '.topbar .subtitle', '.pmeta', TEXT.concat(['relLeft', 'relTop']), { anchor: 'header' }],
    ['progress track', '.topbar .progress-track', '#pprog .pbar', ['backgroundColor', 'boxHeight', 'borderTopWidth', 'borderTopColor', 'borderTopLeftRadius', 'relLeft', 'relRight'], { anchor: 'header' }],
    ['progress fill', '.topbar .progress-fill', '#pprog .pbar', ['fillColor']],
    ['progress label', '.topbar .progress-label', '#pprog .pstats', ['fontFamily', 'fontSize', 'color'], { leaf: false }],
    ['read count', '#overallLabel', '.pcount', TEXT.concat(['relLeft']), { anchor: 'header' }],
    ['time remaining', '#overallTime', '.pleft', TEXT.concat(['relRight']), { anchor: 'header' }],
    ['tab bar', '.tabbar', '#tabs', ['backgroundColor', 'boxLeft', 'boxWidth', 'boxHeight', 'borderTopLeftRadius'], { leaf: false }],
    ['tab', '.tabbar button:not(.active)', '.tab[aria-selected="false"]', TEXT.concat(['paddingTop', 'paddingBottom'])],
    ['selected tab', '.tabbar button.active', '.tab[aria-selected="true"]', TEXT.concat(['borderBottomColor', 'borderBottomWidth'])],
    ['filter bar', '.filterbar', '#fpanel', ['effectiveBackground', 'borderBottomWidth', 'borderBottomColor', 'boxLeft', 'boxWidth'], { leaf: false }],
    ['search row', '.search-row', '.fbar', ['relLeft', 'relTop', 'relRight'], { anchor: 'filter bar', leaf: false }],
    ['search box', '#searchInput', '#q', ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderTopLeftRadius', 'boxHeight', 'paddingLeft']],
    ['next unread', '#jumpBtn', '.fbar .jump', TEXT.concat(['backgroundColor', 'borderTopWidth', 'borderTopLeftRadius', 'paddingLeft', 'paddingRight', 'boxHeight', 'relRight']), { anchor: 'filter bar' }],
    ['era box', '.era-divider', '.era-head', ['boxLeft', 'boxWidth', 'boxHeight'].concat(RADII, ['borderTopWidth', 'boxShadow']), { leaf: false }],
    ['era spacing', '.era-divider@2', '.era-head@2', ['gapPrev']],
    ['era tab', '.era-divider .tab', '.era-head .bhead', PAD.concat(['boxHeight']), { leaf: false }],
    ['era name', '.era-divider .era-name', '.era-head .bname', SEEN.concat(['relLeft', 'relTop']), { anchor: 'era tab' }],
    ['era years', '.era-divider .era-years', '.era-head .byears', SEEN.concat(['relLeft', 'relTop']), { anchor: 'era tab' }],
    ['era strip', '.era-divider .era-stats', '.era-head .bfoot', PAD.concat(['fontFamily', 'fontSize', 'boxHeight']), { leaf: false }],
    ['era count', '.era-divider .era-stats > span:first-child', '.era-head .bcount', SEEN.concat(['relLeft']), { anchor: 'era strip' }],
    ['era bar', '.era-divider .era-progress-track', '.era-head progress.bar', ['backgroundColor', 'boxHeight', 'borderTopLeftRadius', 'relSibLeft', 'relSibRight']],
    ['era bar fill', '.era-divider .era-progress-fill', '.era-head progress.bar', ['fillColor']],
    ['era time', '.era-divider .era-stats > span:last-child', '.era-head .bleft', SEEN.concat(['relRight']), { anchor: 'era strip' }],
  ],
  era: [
    ['era body', '.era-body', '.era-body', ['effectiveBackground', 'boxLeft', 'boxWidth', 'paddingTop', 'paddingLeft', 'borderLeftWidth', 'borderLeftColor',
      'borderBottomWidth', 'borderBottomLeftRadius'], { leaf: false }],
    ['era intro', '.era-intro', '.era-body .era-intro', TEXT.concat(['paddingTop', 'paddingLeft', 'borderBottomStyle', 'borderBottomWidth', 'borderBottomColor', 'relLeft', 'relTop']), { anchor: 'era body' }],
    ['arc card', '.arc-row', '.era-body .arc', ['effectiveBackground', 'borderTopWidth', 'borderTopColor', 'borderTopLeftRadius', 'boxWidth', 'relLeft'], { anchor: 'era body', leaf: false }],
    ['arc spacing', '.arc-row@2', '.era-body .arc@2', ['gapPrev']],
    ['arc head', '.arc-row .arc-head', '.era-body .arc .arc-head', ['boxHeight'], { leaf: false }],
    ['arc stripe', '.arc-row .arc-tab', '.era-body .arc .arc-tab', ['backgroundColor', 'boxWidth', 'borderTopLeftRadius', 'relLeft', 'relTop'], { anchor: 'arc card' }],
    ['arc name', '.arc-row .arc-head .name', '.era-body .arc .arc-name', TEXT.concat(['whiteSpace', 'textOverflow', 'relLeft', 'relTop']), { anchor: 'arc card' }],
    ['type badge', '.arc-row .type-badge', '.era-body .arc .type-badge', TEXT.concat(['backgroundColor', 'paddingTop', 'paddingLeft', 'borderTopLeftRadius', 'relLeft']), { anchor: 'arc card' }],
    ['arc count', '.arc-row .arc-frac', '.era-body .arc .arc-frac', TEXT],
    ['info button', '.arc-row .info-btn', '.era-body .arc .info-btn', TEXT.concat(['backgroundColor', 'boxWidth', 'boxHeight', 'borderTopWidth', 'borderTopColor', 'borderTopLeftRadius', 'relRight']), { anchor: 'arc card' }],
    ['arc chevron', '.arc-row .arc-chevron', '.era-body .arc .arc-chev', TEXT.concat(['relRight']), { anchor: 'arc card' }],
  ],
  arc: [
    ['open arc', '.arc-row.expanded', '.era-body .arc', ['effectiveBackground', 'boxWidth'], { leaf: false }],
    ['arc actions', '.arc-row.expanded .arc-actions', '.era-body .arc .arc-acts', ['paddingLeft', 'paddingBottom', 'columnGap', 'relLeft'], { anchor: 'open arc', leaf: false }],
    ['arc action', '.arc-row.expanded .arc-actions button', '.era-body .arc .arc-acts .b', TEXT.concat(PAD, EDGE, ['backgroundColor', 'boxHeight'])],
    ['issue list', '.arc-row.expanded .issue-list', '.era-body .arc .arc-rows', ['borderTopWidth', 'borderTopColor'], { leaf: false }],
    ['row', '.issue-row', '.row:not(.inert)', ['effectiveBackground', 'borderBottomColor', 'borderBottomWidth', 'paddingTop', 'paddingLeft', 'columnGap'], { leaf: false }],
    ['read mark', '.issue-row .tri-check', '.row:not(.inert) .mark', ['boxWidth', 'boxHeight', 'backgroundColor'].concat(EDGE, ['relLeft']), { anchor: 'row' }],
    ['read mark, read', '.issue-row.state-read .tri-check', '.row[data-s="read"] .mark', ['backgroundColor', 'color', 'fontSize', 'fontWeight']],
    ['read mark, unread', '.issue-row.state-unread .tri-check', '.row[data-s="unread"] .mark', ['backgroundColor'].concat(EDGE)],
    ['row title', '.issue-row .title', '.row:not(.inert) .title', TEXT.concat(['relLeft']), { anchor: 'row' }],
    ['row title, read', '.issue-row.state-read .title', '.row[data-s="read"] .title', ['color', 'textDecorationLine', 'textDecorationColor']],
    ['row with a note', '.issue-row:has(.issue-note)', '.row:has(.subnote)', ['paddingTop'], { leaf: false }],
    ['row note', '.issue-row .issue-note', '.row .subnote', TEXT.concat(['relLeft', 'relTop']), { anchor: 'row with a note' }],
    ['bookmark', '.issue-row .bookmark-btn:not(.on)', '.row:not(.inert) .b.bm[aria-pressed="false"]', ['fontSize', 'color', 'backgroundColor', 'borderTopWidth', 'boxWidth', 'boxHeight', 'relRight'], { anchor: 'row' }],
    ['bookmark, on', '.issue-row .bookmark-btn.on', '.row .b.bm[aria-pressed="true"]', ['fontSize', 'color']],
    ['pinned bar', '#pinnedBar .chip-row', '#pinbar .pinbar-in', ['paddingTop', 'paddingLeft'], { leaf: false }],
    ['pinned label', '#pinnedBar .chip-row > span', '#pinbar .pin-label', TEXT],
    ['pinned chip', '#pinnedBar .chip', '#pinbar .chip', TEXT.concat(PAD, EDGE, ['backgroundColor'])],
  ],
  scrolled: [
    ['scroll', 'html', 'html', ['scrollY'], { leaf: false }],
    ['pinned header', '.topbar', '#phead', ['boxTop', 'boxBottom'], { leaf: false }],
    ['pinned tab bar', '.tabbar', '#tabs', ['boxTop', 'boxBottom'], { leaf: false }],
  ],
  reading: [
    ['reading view', '.reading-view', '#reader', ['paddingTop', 'paddingLeft', 'effectiveBackground'], { leaf: false }],
    ['reading counter', '.reading-counter', '.rcount', TEXT.concat(['textAlign'])],
    ['reading card', '.reading-card', '.rcard', ['textAlign', 'rowGap', 'effectiveBackground'], { leaf: false }],
    ['reading era', '.reading-era-chip', '.rpill', TEXT.concat(['backgroundColor', 'paddingTop', 'paddingLeft', 'borderTopLeftRadius'])],
    ['reading title', '.reading-title', '.rtitle', TEXT.concat(['lineHeight', 'textAlign'])],
    ['reading arc', '.reading-arc', '.rmeta', TEXT],
    ['reading note', '.reading-note', '.rnote', TEXT],
    ['reading blurb', '.reading-blurb', '.rblurb', TEXT.concat(['borderTopStyle', 'borderTopColor', 'paddingTop'])],
    ['reading skip', '#readSkipBtn', '.racts .rbtn.ghost', TEXT.concat(['backgroundColor', 'paddingTop', 'boxHeight'], EDGE)],
    ['reading read', '#readReadBtn', '.racts .rbtn.solid', TEXT.concat(['backgroundColor', 'paddingTop', 'boxHeight'], EDGE)],
    ['reading nav', '.reading-nav button', '.rnav .linkbtn', TEXT.concat(['paddingTop'])],
  ],
  reviews: [
    ['review card', '.review-card', '.rev-item', ['effectiveBackground', 'paddingTop', 'paddingLeft', 'boxLeft', 'boxWidth'].concat(EDGE), { leaf: false }],
    ['review era', '.review-card .era-tag', '.rev-item .rev-era', TEXT],
    ['review title', '.review-card .arc', '.rev-item .rev-name', TEXT],
    ['review stars', '.review-card .stars', '.rev-item .rev-stars', TEXT],
    ['review text', '.review-card .review-text', '.rev-item .rev-t', TEXT],
    ['review edit', '.review-card [data-editreview]', '.rev-item .rev-edit', TEXT.concat(PAD, EDGE, ['backgroundColor'])],
  ],
  settings: [
    ['settings section', '.settings-section', '#settings .sec', ['paddingTop', 'paddingLeft', 'borderBottomWidth', 'borderBottomColor'], { leaf: false }],
    ['settings heading', '.settings-section h3', '#settings .sec-name', TEXT],
    ['setting row', '.setting-row', '#settings .srow', ['paddingTop', 'paddingBottom', 'columnGap'], { leaf: false }],
    ['setting label', '.setting-label', '#settings .slabel', TEXT],
    ['setting desc', '.setting-desc', '#settings .sdesc', TEXT.concat(['marginTop'])],
    ['segmented', '.settings-section .segmented', '#settings .seg', EDGE, { leaf: false }],
    ['segment', '.settings-section .segmented button:not(.on)', '#settings .segbtn[aria-pressed="false"]', TEXT.concat(['backgroundColor', 'paddingTop', 'paddingLeft'])],
    ['segment, on', '.settings-section .segmented button.on', '#settings .segbtn[aria-pressed="true"]', ['backgroundColor', 'color']],
    ['switch', '.settings-section .toggle:not(.on)', '#settings .tog[aria-pressed="false"]', ['backgroundColor', 'boxWidth', 'boxHeight', 'borderTopLeftRadius']],
    ['switch, on', '.settings-section .toggle.on', '#settings .tog[aria-pressed="true"]', ['backgroundColor']],
    ['settings button', '.settings-section button.mini', '#settings .tool', TEXT.concat(PAD, EDGE, ['backgroundColor'])],
    ['swatch', '.settings-section .swatch', '#settings .swatch', ['boxWidth', 'boxHeight', 'borderTopLeftRadius', 'borderTopWidth']],
  ],
  extras: [
    ['core star', '.issue-row .core-star', '.row .core-star', TEXT.concat(['marginLeft'])],
    ['gap note', '.gapnote-row', '.row.inert', TEXT.concat(PAD, ['effectiveBackground', 'borderBottomColor'])],
  ],
};

/* Elements that exist on one side only, each with the kept item or ruling
   that explains it (its descendants are covered too). */
const ONLY = {
  'x-men': [
    ['.filterbar #depthSeg', 'kept:filters: the depth control is in the Filters panel (John, 1 Oct)'],
    ['.filterbar .chip-row', 'kept:filters: the type, era and preset chips are in the Filters panel (John, 1 Oct)'],
    ['.arc-actions [data-reviewtoggle]', 'kept:reviews: reviews are per issue, with ✎ on every row (John, 8 Oct)'],
    ['.review-edit-panel', 'kept:reviews: reviews are per issue (John, 8 Oct)'],
    ['.settings-section .row-buttons', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['.settings-section select', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['.refresh-box', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['.empty-state', 'kept:v3: an empty state the template words its own way'],
    ['.era-divider .chevron', 'unseen: X-Men draws its era chevron inside the tab\'s clipped corner, so it never shows, open or shut (read from pixels at 3x, 28 Oct)'],
  ],
  template: [
    ['.ftoggle', 'kept:filters: the Filters button (John, 1 Oct)'],
    ['.ftools', 'kept:filters: the Filters button, with Expand all and Collapse all beside it, under the search box (John, 1 and 24 Oct)'],
    ['#fshow', 'kept:filters: "Showing X of Y issues" belongs to the Filters panel (John, 1 Oct)'],
    ['#fbody', 'kept:filters: the collapsible sections (John, 1 Oct)'],
    ['.pfinish', 'John (24 Oct): the plan\'s finish-by date sits beside the time remaining'],
    ['.era-body > .efinish', 'John (24 Oct): an era\'s finish-by date is the first line of its open body, above the intro'],
    ['.b.rv', 'kept:reviews: ✎ on every row (John, 8 Oct)'],
    ['.review', 'kept:reviews: the per-issue review editor (John, 8 Oct)'],
    ['.arc-meta', 'kept:v3: an arc\'s year and importance, beside its type badge'],
    ['#eranav', 'kept:v3: the era jump bar (off by default)'],
    ['#pbanner', 'kept:v3: the persistent banner (off by default)'],
    ['.rkeys', 'kept:v3: the Reading tab\'s key hint (hidden on touch screens)'],
    ['#settings .sec-ico', 'kept:settings: the collapsible sections\' icon, summary and chevron (John, 24 Oct)'],
    ['#settings .sec-sum', 'kept:settings: as the icon (John, 24 Oct)'],
    ['#settings .sec-chev', 'kept:settings: as the icon (John, 24 Oct)'],
    ['#settings .sctl', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings select', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings textarea', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .muted', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .ssub', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .pace', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .offstate', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .sgrp', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .seth', 'kept:settings: the collapsible sections (John, 24 Oct)'],
    ['#settings .about', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .filelabel', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#settings .bmlist', 'kept:settings: the template\'s own rows (John, 24 Oct)'],
    ['#reviews .pane-h', 'kept:reviews: the Reviews heading with its count, for screen readers only (the reference shows none), so it measures 1 px'],
    // the template as it stands at step 1; each goes in the step named
  ],
};

/* Containers that draw nothing of their own (their children are mapped). */
const WRAPPERS = {
  'x-men': ['#app', '.tabpanel', '#eraList', '#pinnedBar', '#eraList > div', '.era-divider + .era-body > div', '.arc-title', '.arc-title .meta',
    '.issue-body', '.overall-progress', '.reading-actions', '.reading-nav', '.settings-section > div:not([class])', '.setting-row > div:not([class])'],
  template: ['main', '.pane', '#app', '#stack', '#pprog', '.pstats .pright', '.pbadge .pver', '#pinbar', '.badges', '.bstats', '#reader', '.racts', '.rnav', '.rpills', '#pinchips', '#settings', '#settings .sec-pad',
    '#settings .sec-head', '#settings .sec-t', '#settings .sec-body', '#settings .sec-in', '#reviews', '.revlist', '.arc', '.arc-head', '.era', '.era-body', '.swatches',
    '.card .arc-head h3', '.arc-toggle', '.arc-sub', '.arc-body', '.rbody'],
};

/* The differences left, each tied to a kept item, to John's ruling, or to the
   step of session 8 that fixes it. Keys are view/what.property@width, and *
   matches anything in its place. 45-pull fails on a difference that isn't
   listed, a listed one that no longer differs anywhere, a reason that isn't
   one of the forms below, and a step that is already done. */
const REASON = /^(kept:(filters|title|reviews|mark24|outlines|settings|v3)|accessible|unseen|John \(\d{1,2} [A-Z][a-z]{2}\)|step (1b|2|3|4a|4b|5|6a|6b|7|8|9)): .{10,}/;
const DIFFERENCES = {
  // kept (decided)
  'landing/selected tab.borderBottomColor@*': 'kept:outlines: X-Men\'s navy underline is 1.52:1 on the bar; Pull uses the same hue at 3:1 (John, 9 Oct)',
  'landing/search box.borderTopColor@*': 'kept:outlines: X-Men\'s field outline is 1.53:1; Pull keeps the 3:1 control outline (John, 9 Oct)',
  'arc/read mark.boxWidth@*': 'kept:mark24: the mark keeps the accessible 24 px minimum, with the Button size setting (John, 9 Oct)',
  'arc/read mark.boxHeight@*': 'kept:mark24: as the width (22 px in X-Men)',
  // step 2 (done): what the header still draws differently, each from a ruling
  'landing/offline line.effectiveColor@*': 'accessible: the offline line in the ink at 64 %, the least that passes in every skin × paper with a step in hand (X-Men\'s 60 % is 4.25:1; John, 28 Oct)',
  'landing/subtitle.relTop@390': 'John (24 Oct): the offline line ends "· vN", so at 390 px it takes a second line and the lines under it sit 16 px lower',
  'scrolled/pinned header.boxBottom@320': 'John (24 Oct): the plan\'s finish-by date sits beside the time remaining, so at 320 px they take a line of their own',
  'scrolled/pinned header.boxBottom@390': 'John (24 Oct): the offline line ends "· vN" (its second line at 390 px)',
  'arc/pinned chip.borderTopColor@*': 'accessible: a pinned chip\'s outline is the control outline, 3:1 on every paper it sits on (X-Men\'s #C9C4B5 is 1.37:1 there, G\'s #8F8A7C 2.71:1; John, 28 Oct)',
  // step 3 (done): the era box and the open era's body
  'landing/era tab.paddingRight@1024': 'accessible: the tab keeps its text clear of the cut at every width, max(44 px, 12 %); X-Men\'s 44 px lets a long name run under its clipped corner at 1024 px (John, 28 Oct)',
  'era/era intro.relTop@*': 'John (24 Oct): the era\'s finish-by date is the first line of its open body, so the intro sits under it',
  // step 4b (done): the arc cards
  'era/type badge.color@*': 'accessible: the type badges darkened to pass on their tint on every paper (MAIN #206381, SOLO #00694D, MINI #994300; C revised to every paper, John, 29 Oct)',
  'era/type badge.backgroundColor@*': 'accessible: …and the tint follows the badge\'s colour, mixed into the card (C; John, 29 Oct)',
  'era/info button.borderTopColor@*': 'accessible: ⓘ\'s outline #8A8577, 3:1 on its card on every paper (X-Men\'s #C9C4B5 is 1.53:1; G revised to every paper, John, 29 Oct)',
  'arc/arc action.borderTopColor@*': 'accessible: Mark arc read and unread outlined as ⓘ (G; John, 29 Oct)',
  'arc/arc action.boxHeight@320': 'kept:reviews: X-Men\'s third button, Rate & review, makes its row wrap at 320 px; reviews are per issue, with ✎ on every row (John, 8 Oct)',
  // step 5: issue rows
  'arc/read mark, read.fontSize@*': 'kept:mark24: the mark\'s 34 px box draws the 18 px glyph X-Men\'s own 34 px (large-touch) box does',
  'arc/row title.relLeft@*': 'kept:mark24: the titles\' column starts after the mark (10 + 34 + 9 px; X-Men\'s 22 px mark gives 41)',
  'arc/row note.relLeft@*': 'kept:mark24: the note sits under the title, in its column',
  'extras/gap note.paddingLeft@*': 'kept:mark24: a gap note starts in the titles\' column, as X-Men\'s does',
  'arc/bookmark.boxWidth@*': 'accessible: the star button at 24 × 24 px, its glyph unchanged (E; John, 28 Oct)',
  'arc/bookmark.boxHeight@*': 'accessible: …24 px high (E; John, 28 Oct)',
  'arc/bookmark.color@*': 'accessible: the quiet star #6D685B, X-Men\'s #C9C4B5 (1.53:1) made to pass 4.5:1 on the card on every paper (A revised to every paper, John, 29 Oct)',
  'arc/bookmark, on.color@*': 'accessible: a bookmark that is on in the gold #836400, X-Men\'s #B08A1F (2.83:1) made to pass on every paper (B revised to every paper, John, 29 Oct)',
  'extras/core star.color@*': 'accessible: the core star in the same gold (B; John, 29 Oct)',
  'settings/settings button.borderTopColor@*': 'accessible: Settings\' buttons in the control outline, 3:1 on the paper they sit on (X-Men\'s #C9C4B5 is 1.53:1), as the pinned chips (G; John, 28 Oct)',
  'settings/swatch.boxWidth@*': 'accessible: the paper swatches at 24 × 24 px, X-Men\'s 22 px under the target size (E; John, 28 Oct)',
  'settings/swatch.boxHeight@*': 'accessible: …24 px high (E; John, 28 Oct)',
  'reviews/review stars.color@*': 'accessible: the review stars in the gold #836400 (B revised to every paper, John, 29 Oct)',
  'reviews/review edit.borderTopColor@*': 'accessible: Edit outlined as ⓘ and Mark arc are, #8A8577, 3:1 on its card on every paper (G revised to every paper, John, 29 Oct)',
  // step 6: the other tabs
};

/* In-page: the computed values for one side of one view's map. */
function measure(rows, side) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgbA = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data]; };
  const str = d => 'rgba(' + [d[0], d[1], d[2], +(d[3] / 255).toFixed(2)].join(', ') + ')';
  const rgb = c => str(rgbA(c));
  const all = sel => { try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; } };
  const pick = sel => { const m = /^(.*)@(\d+)$/.exec(sel); return m ? all(m[1])[+m[2] - 1] || null : all(sel)[0] || null; };
  const px = v => Math.round(v * 10) / 10 + 'px';
  /* A <progress>'s fill: Chromium doesn't compute ::-webkit-progress-value, so
     find the most specific rule for it that matches, and resolve its var(). */
  const spec = sel => [/#[\w-]+/g, /(\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+)/g, /(^|[\s>+~])[a-z]+/gi].map(re => (sel.match(re) || []).length);
  const later = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const progressFill = el => {
    let best = null, bestSpec = null;
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (!r.selectorText || !/::-webkit-progress-value/.test(r.selectorText)) continue;
        for (const one of r.selectorText.split(',')) {
          const base = one.replace('::-webkit-progress-value', '').trim();
          if (!base || !el.matches(base)) continue;
          const sp = spec(base);
          if (!bestSpec || later(sp, bestSpec) >= 0) { best = r; bestSpec = sp; }
        }
      }
    }
    if (!best) return 'rgba(0, 0, 0, 0)';
    const probe = document.createElement('i');
    probe.style.background = best.style.background || best.style.backgroundColor;
    el.parentElement.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  };
  const rect = {}, out = {};
  for (const [what, xm, tpl] of rows) { const el = pick(side === 'x-men' ? xm : tpl); rect[what] = el ? el.getBoundingClientRect() : null; }
  for (const [what, xm, tpl, props, opts] of rows) {
    const sel = side === 'x-men' ? xm : tpl, el = pick(sel);
    if (!el) { out[what] = null; continue; }
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), a = opts && opts.anchor ? rect[opts.anchor] : null, v = {};
    for (const p of props) {
      let x = cs[p] === undefined ? null : cs[p];
      if (p === 'effectiveBackground') {
        x = 'rgba(0, 0, 0, 0)';
        for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (!/, 0\)$/.test(c)) { x = c; break; } }
      } else if (p === 'effectiveColor') {
        const d = rgbA(cs.color); let al = d[3] / 255;
        for (let e = el; e; e = e.parentElement) al *= parseFloat(getComputedStyle(e).opacity);
        x = 'rgba(' + [d[0], d[1], d[2], +al.toFixed(2)].join(', ') + ')';
      } else if (p === 'fillColor') {
        x = rgb(el.tagName === 'PROGRESS' ? progressFill(el) : cs.backgroundColor);
      } else if (p === 'gapPrev') {
        const m = /^(.*)@(\d+)$/.exec(sel), prev = m && +m[2] > 1 ? all(m[1])[+m[2] - 2] : null;
        x = prev ? px(r.top - prev.getBoundingClientRect().bottom) : null;
      } else if (p === 'scrollY') x = Math.round(window.scrollY) + 'px';
      else if (/^box(Left|Width|Height|Top|Bottom)$/.test(p)) x = px({ boxLeft: r.left, boxWidth: r.width, boxHeight: r.height, boxTop: r.top, boxBottom: r.bottom }[p]);
      else if (/^rel(Left|Top|Right|Bottom)$/.test(p)) x = a ? px({ relLeft: r.left - a.left, relTop: r.top - a.top, relRight: a.right - r.right, relBottom: a.bottom - r.bottom }[p]) : null;
      else if (p === 'relSibLeft' || p === 'relSibRight') {   // the gap to the element beside it, whatever the figures' lengths
        const sib = p === 'relSibLeft' ? el.previousElementSibling : el.nextElementSibling;
        x = sib ? px(p === 'relSibLeft' ? r.left - sib.getBoundingClientRect().right : sib.getBoundingClientRect().left - r.right) : null;
      }
      else if (/color$/i.test(p)) x = rgb(x);
      else if (p === 'boxShadow') x = x === 'none' ? 'none' : x.replace(/rgba?\([^)]*\)/g, c => rgb(c));
      else if (p === 'fontFamily') x = x.split(',')[0].replace(/["']/g, '').trim();
      else if (p === 'letterSpacing') x = x === 'normal' ? '0px' : x;
      else if (p === 'lineHeight' && x !== 'normal') x = (parseFloat(x) / parseFloat(cs.fontSize)).toFixed(2);
      else if ((p === 'columnGap' || p === 'rowGap') && x === 'normal') x = '0px';
      v[p] = x;
    }
    out[what] = v;
  }
  return out;
}

/* In-page: every visible element (in the viewport, with a box, not hidden or
   transparent) that no row, ONLY entry or wrapper covers. A row with text, or
   an ONLY entry, covers its descendants too. Returns { key: count }. */
function inventory(covers) {
  const all = sel => { try { return [...document.querySelectorAll(sel.replace(/@\d+$/, ''))]; } catch (e) { return []; } };
  const exact = new Set(), deep = [];
  for (const [sel, leaf] of covers) for (const el of all(sel)) { exact.add(el); if (leaf) deep.push(el); }
  const out = {};
  for (const el of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|TEMPLATE|BR|WBR|NOSCRIPT|svg|path|rect|g|line|circle|polyline|polygon)$/i.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    let seen = getComputedStyle(el).visibility !== 'hidden';
    for (let e = el; e && seen; e = e.parentElement) if (parseFloat(getComputedStyle(e).opacity) === 0) seen = false;
    if (!seen || exact.has(el) || deep.some(d => d !== el && d.contains(el))) continue;
    const k = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/* The selectors one side's inventory treats as covered: every view's rows
   (an element measured in one view is covered in all of them, so the header
   is measured once, on the landing), ONLY and the wrappers. */
function covers(side) {
  const s = side === 'x-men' ? 1 : 2, list = [];
  for (const v of VIEWS) {
    for (const row of MAP[v]) {
      const leaf = row[4] && row[4].leaf !== undefined ? row[4].leaf : row[3].some(p => /^(font|color|effectiveColor)/.test(p));
      list.push([row[s], leaf]);
    }
  }
  for (const [sel] of ONLY[side]) list.push([sel, true]);
  for (const sel of WRAPPERS[side]) list.push([sel, false]);
  return list;
}

/* The folder tab, read from a screenshot of the first era box. Paper is the
   page colour; the cut is where the paper at the tab's right edge begins along
   a row of the tab, as a fraction of the box's width, at its top, middle and bottom; fill and strip
   are the colours painted there; hatch is the share of the tab's corner (its
   last 14 px at the bottom) drawn darker than the fill. */
const SHAPE = {
  'x-men': { box: '.era-divider', tab: '.era-divider .tab', strip: '.era-divider .era-stats' },
  template: { box: '.era-head', tab: '.era-head .bhead', strip: '.era-head .bfoot' },
};
const SHAPE_PROPS = ['cutTop', 'cutMiddle', 'cutBottom', 'fill', 'strip', 'hatch'];
const NEAR = { cutTop: 0.015, cutMiddle: 0.015, cutBottom: 0.015, hatch: 0.12 };
async function shape(page, side) {
  const sel = SHAPE[side];
  const box0 = await page.evaluate(s => { const b = document.querySelector(s); if (!b) return false; b.scrollIntoView({ block: 'center' }); return true; }, sel.box);
  if (!box0) return null;
  await page.waitForTimeout(50);
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  const out = await page.evaluate(async ([s, png]) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + png; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const px = (x, y) => [...cx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const str = d => 'rgba(' + [d[0], d[1], d[2], 1].join(', ') + ')';
    const r = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
    const box = r(s.box), tab = r(s.tab) || box, strip = r(s.strip);
    const paperAt = px(2, tab.top + tab.height / 2);
    const paper = d => d.slice(0, 3).every((v, i) => Math.abs(v - paperAt[i]) <= 6);
    /* Read from the right edge inwards, where only paper and the cut can be: a
       scan from the left met an antialiased pixel inside the era's name that
       matched the paper (CI's fonts, 28 Oct). */
    const cut = y => {
      let x = Math.floor(box.right) - 2;
      if (!paper(px(x, y))) return 1;
      while (x > box.left + 10 && paper(px(x - 1, y))) x--;
      return Math.round((x - box.left) / box.width * 100) / 100;
    };
    const fill = px(box.left + 6, tab.top + tab.height / 2);
    let dark = 0, all = 0;
    for (let x = Math.ceil(box.right - 14); x < box.right - 1; x++) {
      for (let y = Math.ceil(tab.bottom - 8); y < tab.bottom - 1; y++) {
        const d = px(x, y);
        if (paper(d)) continue;
        all++;
        if (d[0] + d[1] + d[2] < fill[0] + fill[1] + fill[2] - 15) dark++;
      }
    }
    return { cutTop: cut(tab.top + 2), cutMiddle: cut(tab.top + tab.height / 2), cutBottom: cut(tab.bottom - 2), fill: str(fill),
             strip: strip ? str(px(box.left + 6, strip.top + strip.height / 2)) : null, hatch: all ? Math.round(dark / all * 10) / 10 : 0 };
  }, [sel, png]);
  await page.evaluate(() => scrollTo(0, 0));
  return out;
}

/* Getting each page into each view, in VIEWS order, from the view before.
   Both pages are driven the same way, through their own controls: the first
   era opened, its first arc opened, its first issue marked read and its second
   bookmarked; scrolled by SCROLL; a review of four stars written; the
   Settings tab with its sections open. */
const pause = page => page.waitForTimeout(80);
const DRIVE = {
  'x-men': {
    async landing(page) { await page.waitForSelector('.era-divider .tab'); await page.evaluate(() => document.fonts.ready); },
    async era(page) { await page.click('.era-divider .tab'); await page.waitForSelector('.era-body .arc-row'); },
    async arc(page) {
      await page.click('.arc-row .arc-head .arc-title');
      await page.waitForSelector('.issue-row .tri-check');
      await page.click('.issue-row .tri-check');
      await page.click('.issue-row >> nth=1 >> .bookmark-btn');
      await pause(page);
    },
    async scrolled(page) { await page.evaluate(y => scrollTo(0, y), SCROLL); await pause(page); },
    async reading(page) { await page.evaluate(() => scrollTo(0, 0)); await page.click('.tabbar button[data-tab="reading"]'); await pause(page); },
    async reviews(page) {
      await page.click('.tabbar button[data-tab="checklist"]');
      if (!(await page.$('.arc-row.expanded'))) await page.click('.arc-row .arc-head .arc-title');   // the tab re-renders: arcs close, eras stay open
      await page.click('.arc-row.expanded [data-reviewtoggle]');
      await page.click('.review-edit-panel .star-picker button >> nth=3');
      await page.fill('.review-edit-panel .review-edit', 'A review for the comparison.');
      await page.click('.review-edit-panel [data-savereview]');
      await page.waitForSelector('#toast:not(.show)', { state: 'attached', timeout: 5000 });   // "Review saved" fades after 2.2 s
      await page.evaluate(() => scrollTo(0, 0));
      await page.click('.tabbar button[data-tab="reviews"]');
      await pause(page);
    },
    async settings(page) { await page.click('.tabbar button[data-tab="settings"]'); await pause(page); },
    async extras(page) {
      await page.click('.tabbar button[data-tab="checklist"]');
      const keys = await page.evaluate(() => {
        /* global ISSUES */
        const core = ISSUES.find(i => i.core), gap = ISSUES.find(i => i.isGap);
        return [core && [core.era, core.era + '||' + core.arc], gap && [gap.era, gap.era + '||' + gap.arc]];
      });
      for (const k of keys.filter(Boolean)) {
        const era = '.era-divider[data-era="' + k[0] + '"]';
        if (!(await page.$(era + '.expanded'))) await page.click(era + ' .tab');
        const arc = '.arc-row[data-arckey="' + k[1].replace(/"/g, '\\"') + '"]';
        await page.waitForSelector(arc);
        if (!(await page.$(arc + '.expanded'))) await page.click(arc + ' .arc-head .arc-title');
      }
      await pause(page);
    },
  },
  template: {
    async landing(page) { await page.waitForSelector('.era-head'); await page.evaluate(() => document.fonts.ready); },
    async era(page) { await page.click('.era-head'); await page.waitForSelector('.era-body:not([hidden]) .arc'); },
    async arc(page) {
      if (await page.$('.arc-toggle')) await page.click('.arc-toggle');
      await page.waitForSelector('.row:not(.inert) .mark');
      await page.click('.row:not(.inert) .mark');
      await page.click('.row:not(.inert) .mark');
      await page.click('.row:not(.inert) >> nth=1 >> .b.bm');
      await pause(page);
    },
    async scrolled(page) { await page.evaluate(y => scrollTo(0, y), SCROLL); await pause(page); },
    async reading(page) {     // the reference opens Reading at its first issue; the template resumes at the first not done (v3), so step back to it
      await page.evaluate(() => scrollTo(0, 0)); await page.click('#tab-reading');
      if (await page.$('#reader [data-act="rd-prev"]:not([disabled])')) await page.click('#reader [data-act="rd-prev"]');
      await pause(page);
    },
    async reviews(page) {
      await page.click('#tab-list');
      await page.click('.row:not(.inert) .b.rv');
      await page.click('.review .star[data-n="4"]');
      await page.fill('.review .rvtext', 'A review for the comparison.');
      await page.waitForTimeout(500);
      await page.evaluate(() => scrollTo(0, 0));
      await page.click('#tab-reviews');
      await pause(page);
    },
    async settings(page) {
      await page.click('#tab-settings');
      for (const h of await page.$$('#settings .sec-head[aria-expanded="false"]')) await h.click();
      await pause(page);
    },
    async extras(page) {
      await page.click('#tab-list');
      for (const [e, a] of [[0, 1], [1, 7]]) {
        const head = '.era[data-e="' + e + '"] > .era-head';
        if ((await page.getAttribute(head, 'aria-expanded')) !== 'true') await page.click(head);
        const t = '.era[data-e="' + e + '"] .arc[data-a="' + a + '"] .arc-toggle';
        if ((await page.$(t)) && (await page.getAttribute(t, 'aria-expanded')) !== 'true') await page.click(t);
      }
      await pause(page);
    },
  },
};

module.exports = { WIDTHS, HEIGHTS, WIDTH, HEIGHT, VIEWS, SCROLL, STEPS, CURRENT_STEP, MAP, ONLY, WRAPPERS, REASON, DIFFERENCES,
                   SHAPE, SHAPE_PROPS, NEAR, measure, inventory, covers, shape, DRIVE };
