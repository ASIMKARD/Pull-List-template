/* Pull List template v3 — the app.
   Rules that must keep holding (the harness enforces them):
   - every franchise string comes from window.TRACKER_DATA, never from code;
   - all markup is built with string templates through escapeHtml/escapeAttr;
   - events are delegated: the whole app stays at or under 12 listeners
     (8: click, input, change, touchstart, touchmove, touchend, pagehide,
     visibilitychange);
   - ONE settings store; progress is keyed on the stable row id;
   - lands collapsed; an era's rows render only when it is first opened. */
(function () {
  'use strict';
  var D = window.TRACKER_DATA;
  var N = D.issues.length;
  var FL = D.flagBits;
  var INERT = FL.GAPNOTE | FL.RENUM;
  var CYCLE = ['unread', 'reading', 'read', 'skip'];
  var GLYPH = { unread: '☐', reading: '◐', read: '✓', skip: '⊘' };
  var LABELS = {
    comic:  { unread: 'Unread', reading: 'Reading', read: 'Read', skip: 'Skipped' },
    game:   { unread: 'Not started', reading: 'Playing', read: 'Beaten', skip: 'Skipped' },
    screen: { unread: 'Unwatched', reading: 'Watching', read: 'Watched', skip: 'Skipped' }
  };
  var MEDIUM_NAME = { comic: 'Comics', game: 'Games', screen: 'Shows' };
  /* Pace (decided 2 Oct; per-format durations 1 Oct):
     - time left sums each remaining row's OWN minutes: a comic is one issue at
       the minutes-per-issue setting (presets from the feel-reference build); a
       show or game carries its own minutes (D.issueDuration, built from the row's
       duration or the dataset's per-medium default); a row with none is "untimed"
       and adds nothing, shown as "+N untimed";
     - finish-by works from reading time: weekly minutes = issues per week x
       minutes per issue (v2 presets), weeks left = minutes left / weekly minutes.
       For comics-only data that is (r*m)/(w*m), bit-identical to r/w.
     Both live in the one settings store. */
  var PACE_MINUTES = [['quick', 'Quick', 8], ['average', 'Average', 15], ['deep', 'Deep dive', 25]];
  var PACE_WEEKLY = [['light', 'Light', 5], ['steady', 'Steady', 12], ['heavy', 'Heavy', 25], ['marathon', 'Marathon', 50]];
  var DAY = 864e5;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* ======================================================================
     MODEL — indexes built once from data.js; counts come from here, never
     from the DOM (rows render lazily, so the DOM is never the whole truth).
     ====================================================================== */
  var HAS_BANDS = D.periods.length > 0;
  var ID_I = {};
  var HAY = new Array(N), CREATORS_HAY = new Array(N), W_HAY = new Array(N), A_HAY = new Array(N);
  var CREATOR_I = {};
  D.creators.forEach(function (c, ci) { CREATOR_I[c.n] = ci; });
  /* Each event's own arc (stated in dataset.json or synthesised by the build):
     its heading carries "Complete view adds N". Chapters merged into the
     tracker's own arcs keep those arcs, so they never get the note. */
  var ARC_EVENT = D.arcs.map(function () { return -1; });
  D.events.forEach(function (ev, k) { if (ev.arc >= 0 && ARC_EVENT[ev.arc] === -1) ARC_EVENT[ev.arc] = k; });
  var ERA_ROWS = D.eras.map(function () { return []; });
  var BAND_OF_ERA = D.eras.map(function () { return -1; });
  D.periods.forEach(function (p, b) { p.eras.forEach(function (e) { BAND_OF_ERA[e] = b; }); });
  var HAS_ALT = false;
  var ARC_I = {}, ARC_FIRST = D.arcs.map(function () { return -1; });
  D.arcs.forEach(function (a, ai) { ARC_I[a.id] = ai; });
  for (var i0 = 0; i0 < N; i0++) {
    var r0 = D.issues[i0], arc0 = D.arcs[r0[2]];
    ID_I[D.ids[i0]] = i0;
    if (ARC_FIRST[r0[2]] === -1) ARC_FIRST[r0[2]] = i0;
    ERA_ROWS[D.issueEra[i0]].push(i0);
    if (r0[6] & FL.ALT) HAS_ALT = true;
    var credited = D.issueWriters[i0].concat(D.issueArtists[i0]).map(function (c) { return D.creators[c].n; }).join(' ');
    W_HAY[i0] = D.issueWriters[i0].map(function (c) { return D.creators[c].n; }).join(' ').toLowerCase();
    A_HAY[i0] = D.issueArtists[i0].map(function (c) { return D.creators[c].n; }).join(' ').toLowerCase();
    CREATORS_HAY[i0] = credited.toLowerCase();
    HAY[i0] = (r0[1] + ' ' + arc0.n + ' ' + (r0[7] || '') + ' ' + credited).toLowerCase();
  }
  var MEDIA_USED = D.media.map(function (m, mi) { return mi; }).filter(function (mi) {
    for (var i = 0; i < N; i++) if (D.issueMedium[i] === mi && !(D.issues[i][6] & INERT)) return true;
    return false;
  });
  function isInert(i) { return !!(D.issues[i][6] & INERT); }
  function mediumOf(i) { return D.media[D.issueMedium[i]] || 'comic'; }
  function labelOf(i, st) { return (LABELS[mediumOf(i)] || LABELS.comic)[st]; }

  /* ======================================================================
     STORAGE — namespaced per franchise, localStorage with an in-memory
     fallback, writes debounced 400 ms and flushed on pagehide / hidden.
     ====================================================================== */
  var NS = D.franchise.key + ':v3:';
  var LS = (function () {
    try { var s = window.localStorage; s.setItem(NS + 'probe', '1'); s.removeItem(NS + 'probe'); return s; }
    catch (e) { return null; }
  })();
  var MEM = {};
  function readRaw(fullKey) { try { return LS ? LS.getItem(fullKey) : (MEM[fullKey] == null ? null : MEM[fullKey]); } catch (e) { return null; } }
  function load(k, fallback) {
    var v = readRaw(NS + k);
    if (v == null) return fallback;
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }
  var pending = {}, timer = null;
  function flushNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    Object.keys(pending).forEach(function (k) {
      var s = JSON.stringify(pending[k]);
      try { if (LS) LS.setItem(NS + k, s); else MEM[NS + k] = s; } catch (e) { /* quota: keep in memory */ MEM[NS + k] = s; }
      delete pending[k];
    });
  }
  function save(k, v) {
    pending[k] = v;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushNow, 400);
  }

  function defaultFilters() {
    return { q: '', creator: '', tier: D.tiers.length - 1, unread: false, hideSkip: false, mandatory: false,
             eras: [], types: [], media: [], strands: [], alt: true, notesOnly: false,
             chars: [], cameos: false, role: 'any', creatorExact: false };
  }
  var PERSISTED_FILTERS = ['tier', 'unread', 'hideSkip', 'mandatory', 'eras', 'types', 'media', 'strands', 'alt', 'notesOnly',
                           'chars', 'cameos'];
  var progress = load('progress', null) || { marks: {}, bookmarks: [] };
  progress.marks = progress.marks || {};
  progress.bookmarks = progress.bookmarks || [];
  var reviews = load('reviews', null) || {};
  var ERA_NAV = ['scroll', 'chips', 'dropdown'];        // era navigation style (XM-8)
  /* ONE settings store. Defaults are filled in here and nowhere else, so a
     restored snapshot or an imported backup gets exactly the same treatment. */
  function withDefaults(s) {
    s = s && typeof s === 'object' ? s : {};
    s.v = 3;
    s.pace = s.pace || { minutes: 15, weekly: 12 };
    s.order = s.order || 'reading';
    s.events = s.events || 'essential';
    s.panelOpen = s.panelOpen || [];
    s.tab = s.tab || 'list';
    s.progressMode = s.progressMode || 'combined';
    s.refreshEvery = s.refreshEvery || 'quarter';
    [['showJump', true], ['badges', true], ['combo', false], ['rev', false], ['reveal', false], ['gapNotes', true],
     ['swipe', false], ['press', false]].forEach(function (d) {          // touch gestures: off by default (decided 3 Oct)
      if (typeof s[d[0]] !== 'boolean') s[d[0]] = d[1];
    });
    s.eraNav = ERA_NAV.indexOf(s.eraNav) === -1 ? 'scroll' : s.eraNav;
    s.layout = s.layout === 'rows' ? 'rows' : 'arcs';
    s.events = s.events === 'complete' ? 'complete' : 'essential';
    s.presets = Array.isArray(s.presets) ? s.presets : [];
    return s;
  }
  var settings = withDefaults(load('settings', null));
  var F = defaultFilters();
  /* Multi-select filters are stored by id/name, never by index: a dataset
     update that inserts an era or a strand must not shift saved filters onto
     the wrong ones. Names that no longer exist are dropped. */
  var FILTER_VOCAB = {
    eras: D.eras.map(function (e) { return e.id; }), types: D.types, media: D.media, strands: D.strands, chars: D.characters,
    tier: D.tiers
  };
  function toNames(k, list) { return list.map(function (i) { return FILTER_VOCAB[k][i]; }); }
  function toIdx(k, list) {
    return (Array.isArray(list) ? list : []).map(function (n) { return FILTER_VOCAB[k].indexOf(n); })
      .filter(function (i) { return i !== -1; });
  }
  function filtersFromSettings() {
    var saved = settings.filters || {};
    F = defaultFilters();
    PERSISTED_FILTERS.forEach(function (k) {
      if (saved[k] === undefined) return;
      if (k === 'tier') { var ti = D.tiers.indexOf(saved.tier); if (ti !== -1) F.tier = ti; }
      else if (FILTER_VOCAB[k]) F[k] = toIdx(k, saved[k]);
      else F[k] = !!saved[k];
    });
  }
  filtersFromSettings();
  function saveSettings() {
    settings.filters = {};
    PERSISTED_FILTERS.forEach(function (k) {
      settings.filters[k] = k === 'tier' ? D.tiers[F.tier] : (FILTER_VOCAB[k] ? toNames(k, F[k]) : F[k]);
    });
    save('settings', settings);
  }
  function saveProgress() { save('progress', progress); }

  function stateOf(i) { return progress.marks[D.ids[i]] || 'unread'; }
  function inView(i) { return settings.events === 'complete' || !D.issueCompleteOnly[i]; }

  /* ======================================================================
     MIGRATION — read the previous version's progress. STRICTLY READ-ONLY:
     the old keys are never written, moved or deleted (the -archive copy of
     the old site shares this origin and keeps using them). Runs once; the
     re-run (Settings, session 3) only fills gaps and never overwrites a v3
     mark, bookmark or review.
     ====================================================================== */
  var LEGACY_READERS = {
    v2: function (prefix) {
      var out = { marks: {}, bookmarks: [], reviews: {} };
      var p = null, rv = null;
      try { p = JSON.parse(readRaw(prefix + 'progress') || 'null'); } catch (e) { p = null; }
      try { rv = JSON.parse(readRaw(prefix + 'reviews') || 'null'); } catch (e) { rv = null; }
      if (p && typeof p === 'object') {
        if (p.p && typeof p.p === 'object') { out.marks = p.p; out.bookmarks = Array.isArray(p.b) ? p.b : []; }
        else if (!Array.isArray(p)) out.marks = p;              // oldest v2: a bare {key: state} map
      }
      if (rv && typeof rv === 'object') out.reviews = rv;
      return out;
    }
  };
  function importLegacy() {
    var cfg = D.franchise.storage && D.franchise.storage.legacy;
    var res = { marks: 0, bookmarks: 0, reviews: 0, unmatchedMarks: 0, unmatchedReviews: 0 };
    if (!cfg || !LEGACY_READERS[cfg.format]) return res;
    var old = LEGACY_READERS[cfg.format](cfg.prefix);
    Object.keys(old.marks).forEach(function (k) {
      var st = old.marks[k], id = String(k);
      if (CYCLE.indexOf(st) < 1) return;
      if (ID_I[id] === undefined) { res.unmatchedMarks++; return; }
      if (progress.marks[id]) return;                          // never overwrite a v3 mark
      progress.marks[id] = st; res.marks++;
    });
    old.bookmarks.forEach(function (k) {
      var id = String(k);
      if (ID_I[id] !== undefined && progress.bookmarks.indexOf(id) === -1) { progress.bookmarks.push(id); res.bookmarks++; }
    });
    var unmatched = load('legacy-unmatched', null) || { reviews: {} };
    var merged = {};
    Object.keys(old.reviews).forEach(function (k) {
      var r = old.reviews[k] || {}, i = ID_I[String(k)];
      if (i === undefined) {                                   // kept, never silently dropped
        if (!unmatched.reviews[k]) { unmatched.reviews[k] = r; res.unmatchedReviews++; }
        return;
      }
      var arcId = D.arcs[D.issues[i][2]].id;
      if (reviews[arcId] && !merged[arcId]) return;            // never overwrite a v3 review
      var cur = merged[arcId] || { r: 0, t: '' };
      cur.r = Math.max(cur.r, +r.r || 0);
      cur.t = [cur.t, r.t || ''].filter(Boolean).join('\n\n');
      if (!merged[arcId]) res.reviews++;
      merged[arcId] = cur;
      reviews[arcId] = cur;
    });
    if (res.unmatchedReviews) save('legacy-unmatched', unmatched);
    if (res.marks || res.bookmarks) saveProgress();
    if (res.reviews) save('reviews', reviews);
    return res;
  }
  function legacySummary(res) {
    var bits = [];
    if (res.marks) bits.push(res.marks + ' mark' + (res.marks === 1 ? '' : 's'));
    if (res.bookmarks) bits.push(res.bookmarks + ' bookmark' + (res.bookmarks === 1 ? '' : 's'));
    if (res.reviews) bits.push(res.reviews + ' review' + (res.reviews === 1 ? '' : 's'));
    var msg = bits.length ? 'Brought over ' + bits.join(', ') + ' from the previous version.' : '';
    if (res.unmatchedReviews) msg += ' ' + res.unmatchedReviews + ' review' + (res.unmatchedReviews === 1 ? '' : 's') +
      ' could not be matched to an arc (kept, not lost).';
    return msg.trim();
  }

  /* ======================================================================
     FILTERS
     ====================================================================== */
  /* Three kinds of filter (decided 2 Oct):
     - PLAN   (depth tier, mandatory only, hide skipped, ALT, format; Essential/Complete):
              progress, time left and finish-by ALWAYS follow these.
     - BROWSE (search, creator, era, type, character strand, appearances): while any is
              active, banners and header count only that view, marked "filtered".
     - DISPLAY-ONLY (unread only, notes only, order): never change any number.
       Notes only is the feel-reference build's "landmarks only": its landmark notes are the row note. */
  function browsing() {
    return !!(F.q || F.creator || F.eras.length || F.types.length || F.strands.length || F.chars.length);
  }
  function narrowing() {
    return !!(browsing() || F.tier < D.tiers.length - 1 || F.media.length || F.unread || F.hideSkip || F.mandatory || !F.alt ||
              F.notesOnly);
  }
  function planOk(i) {
    var r = D.issues[i];
    if (!inView(i)) return false;
    if (!F.alt && (r[6] & FL.ALT)) return false;
    if (isInert(i)) return true;
    if (D.issueTier[i] > F.tier) return false;
    if (F.mandatory && !r[4]) return false;
    if (F.hideSkip && stateOf(i) === 'skip') return false;
    if (F.media.length && F.media.indexOf(D.issueMedium[i]) === -1) return false;
    return true;
  }
  function browseOk(i) {
    var r = D.issues[i];
    if (F.eras.length && F.eras.indexOf(D.issueEra[i]) === -1) return false;
    if (F.strands.length && !D.arcs[r[2]].s.some(function (s) { return F.strands.indexOf(s) !== -1; })) return false;
    if (isInert(i)) return true;
    if (F.q && HAY[i].indexOf(F.q.toLowerCase()) === -1) return false;
    if (F.creator && !creatorOk(i)) return false;
    if (F.types.length && F.types.indexOf(r[3]) === -1) return false;
    if (F.chars.length && !presenceOk(i)) return false;
    return true;
  }
  /* Creators (CR-7/CR-8): a picked or tapped name matches exactly through the
     build's creator index; typed text matches as a substring. The role switch
     narrows either to writers or to artists. */
  function creatorOk(i) {
    if (F.creatorExact && CREATOR_I[F.creator] !== undefined) {
      var ci = CREATOR_I[F.creator];
      return (F.role !== 'a' && D.issueWriters[i].indexOf(ci) !== -1) || (F.role !== 'w' && D.issueArtists[i].indexOf(ci) !== -1);
    }
    var hay = F.role === 'w' ? W_HAY[i] : F.role === 'a' ? A_HAY[i] : CREATORS_HAY[i];
    return hay.indexOf(F.creator.toLowerCase()) !== -1;
  }
  /* Appearances (V-11, FP-5): meaningful = major or minor; cameos only when asked. */
  function presenceOk(i) {
    return D.issuePresence[i].some(function (p) { return F.chars.indexOf(p[0]) !== -1 && (p[1] < 2 || F.cameos); });
  }
  /* What the list shows: plan + browse + display-only. */
  function matches(i) {
    if (!planOk(i) || !browseOk(i)) return false;
    if (isInert(i)) return !narrowing();                       // notes never count as a match
    var st = stateOf(i);
    if (F.unread && (st === 'read' || st === 'skip')) return false;
    if (F.notesOnly && !D.issues[i][7]) return false;
    return true;
  }

  /* ======================================================================
     STATS AND PACE — banners and header count the PLAN always and the
     BROWSE view while one is active; display-only filters never count.
     ====================================================================== */
  /* cl: remaining rows timed by minutes per issue (comics); fm: the fixed
     minutes of remaining shows and games; ut: remaining rows with no duration. */
  function blank() { return { total: 0, read: 0, skip: 0, cl: 0, fm: 0, ut: 0 }; }
  function computeStats() {
    var s = { all: blank(), era: D.eras.map(blank), band: D.periods.map(blank), med: D.media.map(blank) }, br = browsing();
    for (var i = 0; i < N; i++) {
      if (isInert(i) || !planOk(i) || (br && !browseOk(i))) continue;
      var st = stateOf(i), e = D.issueEra[i], b = BAND_OF_ERA[e], du = D.issueDuration[i];
      [s.all, s.era[e], b >= 0 ? s.band[b] : null, s.med[D.issueMedium[i]]].forEach(function (t) {
        if (!t) return;
        t.total++;
        if (st === 'read') t.read++;
        else if (st === 'skip') t.skip++;
        else if (du === 0) t.cl++;
        else if (du > 0) t.fm += du;
        else t.ut++;
      });
    }
    return s;
  }
  function remaining(t) { return t.total - t.read - t.skip; }       // unread + reading, never skipped
  function goal(t) { return t.total - t.skip; }
  function paceMinutes() { return settings.pace.minutes || 15; }
  function minutesLeft(t) { return t.cl * paceMinutes() + t.fm; }  // untimed rows add nothing
  function timeLeft(t) {
    var mins = minutesLeft(t);
    if (mins < 60) return { mins: mins, text: mins + 'm' };
    var hrs = mins / 60;
    if (hrs < 24) return { mins: mins, text: Math.round(hrs) + 'h' };
    return { mins: mins, text: (Math.round(hrs / 24 * 10) / 10) + 'd' };
  }
  /* Cumulative: "if you keep reading in order, you'll finish this band by…" —
     the minutes left in this unit plus every unit before it in reading order. */
  function finishBy(cumMinutes) {
    var weeks = cumMinutes / ((settings.pace.weekly || 12) * paceMinutes());
    var d = new Date(Date.now() + weeks * 7 * DAY);
    return { iso: d.toISOString().slice(0, 10), weeks: weeks,
             text: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) };
  }

  /* ======================================================================
     RENDER — string templates only
     ====================================================================== */
  var open = { b: {}, e: {} };          // session-only: never persisted
  var rendered = {};                     // era index -> body rendered
  var wasNarrowing = false;              // leaving a search/filter returns to the collapsed landing
  var expandMatches = false;             // only a change made during THIS visit auto-expands matches;
                                         // every boot lands collapsed, whatever filters were saved

  /* "+N untimed": remaining rows with no duration add nothing to the figures,
     so the gap is shown instead of an invented number. */
  function untimedHtml(t, cls) {
    return t.ut ? '<span class="' + cls + '" data-untimed="' + t.ut + '" title="' + t.ut + ' left with no length in the data, so not in the time left">+' +
      t.ut + ' untimed</span>' : '';
  }
  function leftHtml(t, cls) {
    if (remaining(t) === t.ut) return '';                            // only untimed rows left: no "0m left"
    var left = timeLeft(t);
    return '<span class="' + cls + '" data-left-min="' + left.mins + '">' + left.text + ' left</span>';
  }
  function statsHtml(t, finish) {
    var g = goal(t), done = remaining(t) === 0 && t.total > 0;
    return '<span class="bstats">' +
      '<span class="bcount">' + t.read + ' / ' + g + ' read' + (t.skip ? ' · ' + t.skip + ' skipped' : '') + '</span>' +
      (browsing() ? '<span class="bfiltered">filtered</span>' : '') +
      (done ? '<span class="bdone" aria-label="complete">✓</span>'
            : leftHtml(t, 'bleft') + untimedHtml(t, 'buntimed') +
              (finish ? '<span class="bfinish" data-finish="' + finish.iso + '" data-weeks="' + finish.weeks + '">finish by ' + escapeHtml(finish.text) + '</span>' : '')) +
      '</span><progress class="bar" max="' + (g || 1) + '" value="' + t.read + '" aria-label="progress"></progress>';
  }

  function topUnits() { return HAS_BANDS ? D.periods.map(function (p, b) { return b; }) : D.eras.map(function (e, i) { return i; }); }
  function finishMap(S) {
    var out = {}, cum = 0;
    topUnits().forEach(function (u) {
      var t = HAS_BANDS ? S.band[u] : S.era[u];
      cum += minutesLeft(t);
      out[u] = remaining(t) === 0 ? null : finishBy(cum);
    });
    return out;
  }

  function renderHeader(S) {
    var t = S.all, done = remaining(t) === 0;
    var fin = done ? null : finishBy(minutesLeft(t));
    $('#pprog').innerHTML =
      '<progress class="bar pbar" max="' + (goal(t) || 1) + '" value="' + t.read + '" aria-label="Reading progress"></progress>' +
      '<p class="pstats"><span class="pcount">' + t.read + ' / ' + goal(t) + ' read' +
      (t.skip ? ' · ' + t.skip + ' skipped' : '') + '</span>' +
      (browsing() ? '<span class="pfiltered" title="Counting only what your search or browse filters show">filtered view</span>' : '') +
      (done ? '<span class="pdone">All caught up ✓</span>'
            : leftHtml(t, 'pleft') + untimedHtml(t, 'puntimed') +
              '<span class="pfinish" data-finish="' + fin.iso + '" data-weeks="' + fin.weeks + '">finish by ' + escapeHtml(fin.text) + '</span>') + '</p>' +
      (perFormat() ? '<ul class="pmedia">' + MEDIA_USED.map(function (m) {
        var x = S.med[m];
        return '<li class="pmed" data-m="' + m + '"><span class="pmed-name">' + escapeHtml(mediumLabel(m)) + '</span>' +
          '<span class="pmed-count">' + x.read + ' / ' + goal(x) + '</span>' +
          (remaining(x) === 0 ? (x.total ? '<span class="pdone">✓</span>' : '') : leftHtml(x, 'pmed-left') + untimedHtml(x, 'puntimed')) +
          '<progress class="bar" max="' + (goal(x) || 1) + '" value="' + x.read + '" aria-label="' + escapeAttr(mediumLabel(m)) + ' progress"></progress></li>';
      }).join('') + '</ul>' : '');
    if (activeTab === 'settings') { var po = $('#paceOut'); if (po) po.innerHTML = paceReadout(S); }
  }
  /* Progress mode (S-19): one combined line, or one line per format as well.
     Offered only when the data really mixes formats. */
  function perFormat() { return settings.progressMode === 'medium' && MEDIA_USED.length > 1; }

  function orderedEraRows(e) {
    var rows = ERA_ROWS[e].slice();
    if (settings.order === 'publication') rows.sort(function (a, b) { return D.issues[a][8] - D.issues[b][8]; });
    else if (settings.order === 'arc') rows.sort(function (a, b) { return (D.issues[a][2] - D.issues[b][2]) || (a - b); });
    return rows;
  }

  /* Credits on arc heads: every name is a button that filters to that
     creator's work, matched exactly through the creator index (CR-8). */
  function creditsHtml(i) {
    var nameBtn = function (c) {
      var n = D.creators[c].n;
      return '<button type="button" class="cname" data-act="creator" data-n="' + escapeAttr(n) + '" aria-label="Show work by ' + escapeAttr(n) + '">' +
        escapeHtml(n) + '</button>';
    };
    var w = D.issueWriters[i], a = D.issueArtists[i], bits = [];
    if (w.length) bits.push('Writer' + (w.length > 1 ? 's' : '') + ': ' + w.map(nameBtn).join(', '));
    if (a.length) bits.push('Art: ' + a.map(nameBtn).join(', '));
    return bits.join(' · ');
  }
  /* Essential / Complete (V-10): in Essential view an event's heading says
     what the Complete view would add, and switches to it when tapped. */
  function eventNote(a) {
    var k = ARC_EVENT[a], ev = k >= 0 ? D.events[k] : null;
    if (!ev || !ev.adds) return '';
    var n = ev.adds + ' issue' + (ev.adds === 1 ? '' : 's');
    return settings.events === 'essential'
      ? '<p class="evnote"><button type="button" class="linkbtn" data-act="f" data-k="events" data-v="complete">Complete view adds ' + n + '</button></p>'
      : '<p class="evnote">Complete view: ' + n + ' more than Essential</p>';
  }

  function rowHtml(i, rvArc) {
    var r = D.issues[i], flags = r[6], id = D.ids[i];
    if (flags & INERT) {
      return '<div class="row inert" data-i="' + i + '" data-id="' + escapeAttr(id) + '">' +
        '<span class="mark-inert" aria-hidden="true">' + (flags & FL.RENUM ? '⟳' : '↷') + '</span>' +
        '<span class="title">' + escapeHtml(r[1]) + '</span>' +
        (r[7] ? '<p class="subnote">' + escapeHtml(r[7]) + '</p>' : '') + '</div>';
    }
    var st = stateOf(i), bm = progress.bookmarks.indexOf(id) !== -1;
    var badges = '';
    if (r[5]) badges += '<span class="b core">★ core</span>';
    if (flags & FL.FB) badges += '<button type="button" class="b note" data-act="note" aria-expanded="false" data-note="' +
      escapeAttr(r[7] || 'Published later than it reads: this story fills in earlier events.') + '">↺ flashback</button>';
    if (flags & FL.ALT) badges += '<button type="button" class="b note" data-act="note" aria-expanded="false" data-note="' +
      escapeAttr(r[7] || 'A separate continuity from the main line.') + '">alt</button>';
    badges += '<button type="button" class="b bm" data-act="bm" aria-pressed="' + bm + '" aria-label="Bookmark ' +
      escapeAttr(r[1]) + '">' + (bm ? '★' : '☆') + '</button>';
    if (D.franchise.searchUrl) badges += '<a class="b mu" href="' + escapeAttr(D.franchise.searchUrl +
      encodeURIComponent(r[1])) + '" target="_blank" rel="noopener">look up ↗</a>';
    var hasSub = r[7] && !(flags & (FL.FB | FL.ALT));
    /* tap to reveal (S-16; the feel-reference build's landmark notes): the note waits behind a button */
    if (hasSub && settings.reveal) badges += '<button type="button" class="b reveal" data-act="reveal" aria-expanded="false">note</button>';
    var sub = hasSub ? '<p class="subnote"' + (settings.reveal ? ' hidden' : '') + '>' + escapeHtml(r[7]) + '</p>' : '';
    var label = settings.layout === 'rows' ? '<span class="arclabel">' + escapeHtml(D.arcs[r[2]].n) + '</span>' : '';
    return '<div class="row" data-i="' + i + '" data-id="' + escapeAttr(id) + '" data-s="' + st + '">' +
      '<button type="button" class="mark" data-act="mark" aria-label="' + escapeAttr(r[1] + ' — ' + labelOf(i, st)) + '">' +
      GLYPH[st] + '</button><span class="title">' + escapeHtml(r[1]) + label + '</span>' +
      '<span class="badges">' + badges + (rvArc >= 0 ? rvButton(rvArc) : '') + '</span>' + sub + '</div>';
  }

  function eraBodyHtml(e) {
    var filt = narrowing(), html = '', curArc = -1, seen = {};
    if (settings.layout === 'rows') {                         // layout C (X-1): per-row arc labels, no arc heads
      orderedEraRows(e).forEach(function (i) {
        if ((filt ? !matches(i) : !inView(i)) || (!settings.gapNotes && (D.issues[i][6] & FL.GAPNOTE))) return;
        var a = D.issues[i][2], first = a !== curArc && !isInert(i);
        if (first) curArc = a;
        html += rowHtml(i, first ? a : -1);                    // no arc heads: the ✎ rides on the run's first row
      });
      return (D.eras[e].intro ? '<p class="era-intro">' + escapeHtml(D.eras[e].intro) + '</p>' : '') + '<div class="arc rows">' + html + '</div>';
    }
    orderedEraRows(e).forEach(function (i) {
      if (filt ? !matches(i) : !inView(i)) return;
      if (!settings.gapNotes && (D.issues[i][6] & FL.GAPNOTE)) return;   // gap notes off (XM-10)
      var a = D.issues[i][2];
      if (a !== curArc) {
        if (curArc !== -1) html += '</div>';
        var arc = D.arcs[a], again = !!seen[a];
        seen[a] = 1; curArc = a;
        var meta = [arc.y, arc.i ? 'importance ' + arc.i + '/5' : ''].filter(Boolean).join(' · ');   // V-12
        var cred = again ? '' : creditsHtml(i);
        html += '<div class="arc" data-a="' + a + '"><div class="arc-head"><h3>' + escapeHtml(arc.n) +
          (again ? ' · cont.' : '') + '</h3>' + (meta ? '<span class="arc-meta">' + escapeHtml(meta) + '</span>' : '') +
          (cred ? '<p class="credits">' + cred + '</p>' : '') + (again ? '' : eventNote(a)) +
          (arc.b && !again && arc.b !== D.eras[e].intro ? '<p class="blurb">' + escapeHtml(arc.b) + '</p>' : '') +
          '<div class="arc-acts">' + rvButton(a) +
          '<button type="button" class="b" data-act="arc-mark" data-a="' + a + '" data-st="read">Mark arc read</button>' +
          '<button type="button" class="b" data-act="arc-mark" data-a="' + a + '" data-st="unread">Mark arc unread</button></div></div>';
      }
      html += rowHtml(i);
    });
    if (curArc !== -1) html += '</div>';
    var intro = D.eras[e].intro ? '<p class="era-intro">' + escapeHtml(D.eras[e].intro) + '</p>' : '';
    return intro + html;
  }

  function eraHtml(e, S, fin, hidden) {
    var era = D.eras[e], isOpen = !!open.e[e];
    return '<section class="era" data-e="' + e + '"' + (hidden ? ' hidden' : '') + '>' +
      '<button type="button" class="era-head" data-act="era" aria-expanded="' + isOpen + '" aria-controls="era-body-' + e + '">' +
      '<span class="bhead"><span class="bname">' + escapeHtml(era.name) + '</span>' +
      (era.years ? '<span class="byears">' + escapeHtml(era.years) + '</span>' : '') + '</span>' +
      statsHtml(S.era[e], fin) + '</button>' +
      '<div class="era-body" id="era-body-' + e + '"' + (isOpen ? '' : ' hidden') + '>' +
      (isOpen ? eraBodyHtml(e) : '') + '</div></section>';
  }

  function renderList() {
    var S = computeStats(), fins = finishMap(S), filt = narrowing();
    rendered = {};
    if (!filt && wasNarrowing) open = { b: {}, e: {} };
    wasNarrowing = filt;
    var visEra = D.eras.map(function () { return !filt; }), any = false;
    if (filt) {
      for (var i = 0; i < N; i++) if (matches(i)) { visEra[D.issueEra[i]] = true; any = true; }
      if (expandMatches) {
        open = { b: {}, e: {} };
        visEra.forEach(function (v, e) { if (v) { open.e[e] = true; if (BAND_OF_ERA[e] >= 0) open.b[BAND_OF_ERA[e]] = true; } });
      }
    }
    /* newest era first (S-13) reverses bands and eras, never the rows inside
       an era; finish-by stays cumulative in READING order (fins by unit). */
    var html = '', rev = function (list) { return settings.rev ? list.slice().reverse() : list; };
    if (HAS_BANDS) {
      rev(D.periods.map(function (p, b) { return b; })).forEach(function (b) {
        var p = D.periods[b], shown = p.eras.some(function (e) { return visEra[e]; }), isOpen = !!open.b[b];
        html += '<section class="band" data-b="' + b + '"' + (shown ? '' : ' hidden') + '>' +
          '<button type="button" class="band-head" data-act="band" aria-expanded="' + isOpen + '" aria-controls="band-body-' + b + '">' +
          '<span class="bhead"><span class="bname">' + escapeHtml(p.name) + '</span>' +
          (p.label ? '<span class="byears">' + escapeHtml(p.label) + '</span>' : '') + '</span>' +
          statsHtml(S.band[b], fins[b]) + '</button>' +
          '<div class="band-body" id="band-body-' + b + '"' + (isOpen ? '' : ' hidden') + '>' +
          (p.blurb ? '<p class="band-intro">' + escapeHtml(p.blurb) + '</p>' : '') +
          rev(p.eras).map(function (e) { return eraHtml(e, S, null, !visEra[e]); }).join('') + '</div></section>';
      });
    } else {
      rev(D.eras.map(function (era, e) { return e; })).forEach(function (e) { html += eraHtml(e, S, fins[e], !visEra[e]); });
    }
    if (filt && !any) html += '<p class="empty">Nothing matches these filters.</p>';
    var app = $('#app');
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
    D.eras.forEach(function (e, idx) { if (open.e[idx]) rendered[idx] = true; });
    renderHeader(S);
    renderPinbar();                       // sorted as displayed, so it follows the order setting
    renderEraNav(visEra);
  }

  /* Repaint numbers only (after a mark): banners and header, no list rebuild. */
  function refreshStats() {
    var S = computeStats(), fins = finishMap(S);
    D.eras.forEach(function (era, e) {
      var head = $('.era[data-e="' + e + '"] > .era-head');
      if (!head) return;
      var old = head.querySelector('.bstats'), bar = head.querySelector('progress');
      var tmp = document.createElement('div');
      tmp.innerHTML = statsHtml(S.era[e], HAS_BANDS ? null : fins[e]);
      old.replaceWith(tmp.firstChild); bar.replaceWith(tmp.lastChild);
    });
    D.periods.forEach(function (p, b) {
      var head = $('.band[data-b="' + b + '"] > .band-head');
      if (!head) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = statsHtml(S.band[b], fins[b]);
      head.querySelector('.bstats').replaceWith(tmp.firstChild);
      head.querySelector('progress').replaceWith(tmp.lastChild);
    });
    renderHeader(S);
  }

  /* ======================================================================
     FILTER PANEL — five collapsible sections (approved mockup, 1 Oct)
     ====================================================================== */
  var SECTIONS = [['reading', '☰', 'Reading'], ['story', '⧗', 'Story'], ['chars', '☺', 'Characters'],
                  ['creators', '✎', 'Creators'], ['order', '⇅', 'Order and display']];
  function orderLabel(o) {
    var d = D.franchise.dualOrder;
    if (o === 'reading') return d ? d.a : 'Reading order';
    if (o === 'publication') return d ? d.b : 'Publication order';
    return 'Arc order';
  }
  function mediumLabel(m) { var n = D.media[m]; return MEDIUM_NAME[n] || (n.charAt(0).toUpperCase() + n.slice(1)); }
  function names(list, of) { return list.map(of).join(', '); }
  function summary(k) {
    var bits = [];
    if (k === 'reading') {
      if (F.tier < D.tiers.length - 1) bits.push(D.tiers[F.tier] + ' tier');
      if (F.unread) bits.push('unread only');
      if (F.notesOnly) bits.push('notes only');
      if (F.hideSkip) bits.push('skipped hidden');
      if (F.mandatory) bits.push('mandatory only');
      return bits.length ? bits.join(' · ') : '';
    }
    if (k === 'story') {
      if (settings.events === 'complete' && D.events.length) bits.push('complete events');
      if (F.eras.length) bits.push(F.eras.length === 1 ? D.eras[F.eras[0]].name : F.eras.length + ' eras');
      if (F.types.length) bits.push(names(F.types, function (t) { return D.types[t].toLowerCase(); }));
      if (F.media.length) bits.push(names(F.media, mediumLabel));
      if (!F.alt) bits.push('alternate stories hidden');
      return bits.join(' · ');
    }
    if (k === 'chars') {
      if (F.strands.length) bits.push(names(F.strands, function (s) { return D.strands[s]; }));
      if (F.chars.length) bits.push(names(F.chars, function (c) { return D.characters[c]; }) + (F.cameos ? ' incl. cameos' : ''));
      return bits.join(' · ');
    }
    if (k === 'creators') return F.creator ? '“' + F.creator + '”' + ROLE_NOTE[F.role] : (F.role !== 'any' ? ROLE_LABEL[F.role].toLowerCase() + ' only' : '');
    return orderLabel(settings.order);
  }
  var SUMMARY_DEFAULT = { reading: 'All issues', story: 'Everything', chars: 'All characters', creators: 'All creators' };
  var ROLE_LABEL = { any: 'Writers and artists', w: 'Writers', a: 'Artists' };
  var ROLE_NOTE = { any: '', w: ' as writer', a: ' as artist' };

  function activeChips() {
    var c = [];
    if (F.q) c.push(['q', '', 'Search: “' + F.q + '”']);
    if (F.creator) c.push(['creator', '', 'Creator: “' + F.creator + '”' + ROLE_NOTE[F.role]]);
    if (settings.events === 'complete' && D.events.length) c.push(['events', 'essential', 'Complete events']);
    if (F.tier < D.tiers.length - 1) c.push(['tier', '', D.tiers[F.tier] + ' tier']);
    if (F.unread) c.push(['unread', '', 'Unread only']);
    if (F.notesOnly) c.push(['notesOnly', '', 'Notes only']);
    if (F.hideSkip) c.push(['hideSkip', '', 'Skipped hidden']);
    if (F.mandatory) c.push(['mandatory', '', 'Mandatory only']);
    F.eras.forEach(function (e) { c.push(['eras', e, D.eras[e].name]); });
    F.types.forEach(function (t) { c.push(['types', t, D.types[t].toLowerCase()]); });
    F.media.forEach(function (m) { c.push(['media', m, mediumLabel(m)]); });
    F.strands.forEach(function (s) { c.push(['strands', s, D.strands[s]]); });
    F.chars.forEach(function (ch) { c.push(['chars', ch, D.characters[ch] + (F.cameos ? ' (incl. cameos)' : '')]); });
    if (!F.alt) c.push(['alt', '', 'No alternate stories']);
    return c;
  }

  function chip(k, v, label, on) {
    return '<button type="button" class="chip" data-act="f" data-k="' + k + '" data-v="' + escapeAttr(v) + '" aria-pressed="' +
      !!on + '">' + escapeHtml(label) + '</button>';
  }
  function countWhere(pred) {
    var n = 0;
    for (var i = 0; i < N; i++) if (!isInert(i) && inView(i) && pred(i)) n++;
    return n;
  }
  function sectionBody(k) {
    var h = '';
    if (k === 'reading') {
      h += '<div class="flabel">Depth</div><div class="depthrow">';      // one row that never wraps (T-95)
      D.tiers.forEach(function (t, ti) {
        h += chip('tier', ti, t + ' · ' + countWhere(function (i) { return D.issueTier[i] <= ti; }), F.tier === ti);
      });
      h += '</div>';
      h += '<div class="flabel">Status</div>' + chip('unread', '', 'Unread only', F.unread) + chip('notesOnly', '', 'Notes only', F.notesOnly) +
        chip('hideSkip', '', 'Hide skipped', F.hideSkip) + chip('mandatory', '', 'Mandatory only', F.mandatory);
    } else if (k === 'story') {
      if (D.events.length) {                                   // Essential / Complete (V-10, FP-4): a plan setting
        h += '<div class="flabel">Events</div>' + chip('events', 'essential', 'Essential', settings.events === 'essential') +
          chip('events', 'complete', 'Complete', settings.events === 'complete');
      }
      h += '<div class="flabel">Era</div>';
      D.eras.forEach(function (e, ei) { h += chip('eras', ei, e.name, F.eras.indexOf(ei) !== -1); });
      if (D.media.length > 1) {
        h += '<div class="flabel">Format</div>';
        D.media.forEach(function (m, mi) { h += chip('media', mi, mediumLabel(mi), F.media.indexOf(mi) !== -1); });
      }
      h += '<div class="flabel">Type</div>';
      D.types.forEach(function (t, ti) { h += chip('types', ti, t.toLowerCase(), F.types.indexOf(ti) !== -1); });
      if (HAS_ALT) h += '<div class="flabel">Alternate stories</div>' + chip('alt', '', 'Show alternate stories', F.alt);
    } else if (k === 'chars') {
      if (D.characters.length) h += '<div class="flabel">Strands</div>';
      D.strands.forEach(function (s, si) { h += chip('strands', si, s, F.strands.indexOf(si) !== -1); });
      if (D.characters.length) {
        h += '<div class="flabel">Appearances</div>';
        D.characters.forEach(function (c, ci) { h += chip('chars', ci, c, F.chars.indexOf(ci) !== -1); });
        h += '<div class="flabel">Counts as an appearance</div>' + chip('cameos', '', 'Include cameos', F.cameos);
      }
    } else if (k === 'creators') {
      h += '<input class="search" id="cq" type="search" placeholder="Search writers and artists" aria-label="Search writers and artists" value="' +
        escapeAttr(F.creator) + '" autocomplete="off">';
      h += '<div class="flabel">Credited as</div>';
      ['any', 'w', 'a'].forEach(function (r) { h += chip('role', r, ROLE_LABEL[r], F.role === r); });
      h += creatorPicker();
    } else {
      ['reading', 'publication', 'arc'].forEach(function (o) { h += chip('order', o, orderLabel(o), settings.order === o); });
    }
    return '<div class="fsec-body" id="fsec-' + k + '">' + h + '</div>';
  }

  function renderPanel() {
    var chips = activeChips();
    $('#fcount').textContent = chips.length ? '· ' + chips.length + ' active' : '';
    $('#fchips').innerHTML = chips.length ? chips.map(function (c) {
      return '<button type="button" class="chip on" data-act="unset" data-k="' + c[0] + '" data-v="' + escapeAttr(c[1]) +
        '" aria-label="Remove filter: ' + escapeAttr(c[2]) + '">' + escapeHtml(c[2]) + ' <span aria-hidden="true">×</span></button>';
    }).join('') : '<span class="muted">None</span>';
    var focusCq = document.activeElement && document.activeElement.id === 'cq';
    $('#fsecs').innerHTML = SECTIONS.map(function (s) {
      var isOpen = settings.panelOpen.indexOf(s[0]) !== -1, sum = summary(s[0]);
      return '<div class="fsec' + (isOpen ? ' open' : '') + '" data-k="' + s[0] + '">' +
        '<button type="button" class="fsec-head" data-act="sec" data-k="' + s[0] + '" aria-expanded="' + isOpen + '" aria-controls="fsec-' + s[0] + '">' +
        '<span class="fsec-ico" aria-hidden="true">' + s[1] + '</span><span class="fsec-t"><span class="fsec-name">' + s[2] + '</span>' +
        '<span class="fsec-sum' + (sum ? '' : ' muted') + '">' + escapeHtml(sum || SUMMARY_DEFAULT[s[0]]) + '</span></span>' +
        '<span class="fsec-chev" aria-hidden="true">▾</span></button>' + (isOpen ? sectionBody(s[0]) : '') + '</div>';
    }).join('');
    if (focusCq && $('#cq')) { var c = $('#cq'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
    $('#fpresets').innerHTML = presetsHtml();
    var shown = countWhere(matches), total = countWhere(function () { return true; });
    $('#fshow').textContent = 'Showing ' + shown.toLocaleString('en-GB') + ' of ' + total.toLocaleString('en-GB') + ' issues';
  }

  /* Creator picker (CR-7): the creator index filtered by what is typed,
     counted by the chosen role, most-credited first. */
  function creatorCount(c) { return F.role === 'w' ? c.w : F.role === 'a' ? c.a : c.w + c.a; }
  function creatorPicker() {
    var q = F.creator.toLowerCase();
    var list = D.creators.filter(function (c) { return creatorCount(c) > 0 && (!q || c.n.toLowerCase().indexOf(q) !== -1); })
      .sort(function (x, y) { return creatorCount(y) - creatorCount(x) || (x.n < y.n ? -1 : 1); });
    if (!list.length) return '<p class="muted cpick-none">No one matches.</p>';
    return '<div class="cpick">' + list.slice(0, 12).map(function (c) {
      return '<button type="button" class="chip" data-act="creator" data-n="' + escapeAttr(c.n) + '" aria-pressed="' +
        (F.creatorExact && F.creator === c.n) + '">' + escapeHtml(c.n) + ' <span class="cnt">' + creatorCount(c) + '</span></button>';
    }).join('') + (list.length > 12 ? '<p class="muted">' + (list.length - 12) + ' more: keep typing</p>' : '') + '</div>';
  }
  function pickCreator(n) {
    if (CREATOR_I[n] === undefined) return;
    if (F.creatorExact && F.creator === n) { F.creator = ''; F.creatorExact = false; }   // tapping the picked name again clears it
    else { F.creator = n; F.creatorExact = true; }
    var inp = $('#cq'); if (inp) inp.value = F.creator;
    if (activeTab !== 'list') showTab('list');
    refilter();
  }

  /* Presets (F-22, FP-9): the persisted filters (stored by name, like the
     saved filters themselves), plus order and Essential/Complete. */
  var presetForm = false;
  function presetsHtml() {
    var h = '<div class="flabel">Presets</div><div class="presetrow">' + (settings.presets.length ? settings.presets.map(function (p) {
      return '<span class="preset"><button type="button" class="chip" data-act="preset-apply" data-n="' + escapeAttr(p.name) + '">' + escapeHtml(p.name) +
        '</button><button type="button" class="linkbtn" data-act="preset-del" data-n="' + escapeAttr(p.name) + '" aria-label="Delete preset ' +
        escapeAttr(p.name) + '">×</button></span>';
    }).join('') : '<span class="muted">None saved yet.</span>') + '</div>';
    return h + (presetForm
      ? '<div class="preset-form"><input class="search" id="presetName" maxlength="40" placeholder="Name these filters" aria-label="Preset name" autocomplete="off">' +
        '<button type="button" class="tool" data-act="preset-save">Save</button><button type="button" class="tool" data-act="preset-cancel">Cancel</button></div>'
      : '<button type="button" class="tool" data-act="preset-new">Save as preset</button>');
  }
  function presetIndex(name) {
    for (var k = 0; k < settings.presets.length; k++) if (settings.presets[k].name === name) return k;
    return -1;
  }
  function savePreset() {
    var name = ($('#presetName') ? $('#presetName').value : '').trim().slice(0, 40);
    if (!name) { toast('Give the preset a name first.'); return; }
    saveSettings();                                            // settings.filters now mirrors F, by name
    var p = { name: name, filters: JSON.parse(JSON.stringify(settings.filters)), order: settings.order, events: settings.events };
    var at = presetIndex(name);
    if (at === -1) settings.presets.push(p); else settings.presets[at] = p;
    presetForm = false;
    saveSettings(); renderPanel();
    toast((at === -1 ? 'Saved' : 'Updated') + ' preset “' + name + '”.');
  }
  function applyPreset(name) {
    var p = settings.presets[presetIndex(name)];
    if (!p) return;
    var keep = { q: F.q, creator: F.creator, creatorExact: F.creatorExact, role: F.role };   // search stays session-only
    settings.filters = JSON.parse(JSON.stringify(p.filters));
    filtersFromSettings();
    Object.keys(keep).forEach(function (k) { F[k] = keep[k]; });
    settings.order = p.order || settings.order;
    settings.events = p.events === 'complete' ? 'complete' : 'essential';
    refilter();
    toast('Applied preset “' + name + '”.');
  }
  function deletePreset(name) {
    var at = presetIndex(name);
    if (at === -1) return;
    var gone = settings.presets.splice(at, 1)[0];
    saveSettings(); renderPanel();
    toast('Deleted preset “' + name + '”.', 'Undo', function () { settings.presets.splice(at, 0, gone); saveSettings(); renderPanel(); });
  }

  function refilter() { expandMatches = true; saveSettings(); renderPanel(); renderList(); }

  function setFilter(k, v, on) {
    if (k === 'tier') F.tier = v === '' ? D.tiers.length - 1 : +v;
    else if (k === 'order') { settings.order = v; }
    else if (k === 'q' || k === 'creator') {
      F[k] = '';
      if (k === 'creator') F.creatorExact = false;
      var inp = $(k === 'q' ? '#q' : '#cq'); if (inp) inp.value = '';
    }
    else if (k === 'events') settings.events = v === 'complete' ? 'complete' : 'essential';
    else if (k === 'role') F.role = ROLE_LABEL[v] ? v : 'any';
    else if (['eras', 'types', 'media', 'strands', 'chars'].indexOf(k) !== -1) {
      var n = +v, at = F[k].indexOf(n);
      if (on === undefined) on = at === -1;
      if (on && at === -1) F[k].push(n);
      if (!on && at !== -1) F[k].splice(at, 1);
    } else if (k === 'alt') F.alt = on === undefined ? !F.alt : on;
    else F[k] = on === undefined ? !F[k] : on;
    refilter();
  }
  function clearFilters() {
    var keepOrder = settings.order;
    F = defaultFilters();
    settings.order = keepOrder;
    settings.events = 'essential';                            // shown as an active chip, so Clear all clears it
    $('#q').value = '';
    open = { b: {}, e: {} };
    refilter();
  }

  /* ======================================================================
     MARKS — ONE path for every surface (Checklist now; Reading tab, swipe and
     bulk marking in session 3 call the same function)
     ====================================================================== */
  /* applyMark changes one row's state and its rendered row; every mark goes
     through it. setMark is one mark + one refresh; bulkMark is many marks +
     ONE save and ONE refresh. */
  function applyMark(i, st) {
    var id = D.ids[i];
    if (st === 'unread') delete progress.marks[id]; else progress.marks[id] = st;
    $$('.row[data-i="' + i + '"]').forEach(function (row) {
      row.dataset.s = st;
      var m = row.querySelector('.mark');
      m.textContent = GLYPH[st];
      m.setAttribute('aria-label', D.issues[i][1] + ' — ' + labelOf(i, st));
    });
  }
  function afterMarks() {
    saveProgress();
    refreshStats();
    if (narrowing()) renderPanel();
  }
  function setMark(i, st) {
    applyMark(i, st);
    afterMarks();
  }
  /* Bulk marking (F-23, XM-11, long-press): the rows the current view counts —
     the same rows a banner counts, so "mark this era read" turns its banner ✓.
     Every touched row's PREVIOUS state is snapshotted, so Undo restores a
     "reading" row as "reading", not "unread" (B-2, V-27). */
  function counted(i) { return !isInert(i) && planOk(i) && (!browsing() || browseOk(i)); }
  function rowsWhere(pred) { var out = []; for (var i = 0; i < N; i++) if (counted(i) && pred(i)) out.push(i); return out; }
  function bulkMark(list, st, what) {
    var prev = {}, changed = 0;
    list.forEach(function (i) {
      var before = stateOf(i);
      if (before === st) return;
      prev[D.ids[i]] = before;
      applyMark(i, st);
      changed++;
    });
    var verb = st === 'unread' ? 'cleared' : 'marked ' + st;
    if (!changed) { toast('Nothing to change in ' + what + '.'); return 0; }
    afterMarks();
    if (activeTab === 'reading') renderReading();
    toast(changed.toLocaleString('en-GB') + ' ' + verb + ' in ' + what + '.', 'Undo', function () {
      Object.keys(prev).forEach(function (id) { if (ID_I[id] !== undefined) applyMark(ID_I[id], prev[id]); });
      afterMarks();
      if (activeTab === 'reading') renderReading();
      toast('Undone: ' + changed.toLocaleString('en-GB') + ' restored.');
    });
    return changed;
  }
  function bulkEra(lo, hi, st) {
    var a = Math.min(lo, hi), b = Math.max(lo, hi);
    return bulkMark(rowsWhere(function (i) { return D.issueEra[i] >= a && D.issueEra[i] <= b; }), st,
      a === b ? D.eras[a].name : D.eras[a].name + ' – ' + D.eras[b].name);
  }
  function bulkArc(a, st) { return bulkMark(rowsWhere(function (i) { return D.issues[i][2] === a; }), st, D.arcs[a].n); }
  function bulkBand(b, st) { return bulkMark(rowsWhere(function (i) { return BAND_OF_ERA[D.issueEra[i]] === b; }), st, D.periods[b].name); }
  function toggleBookmark(i, btn) {
    var id = D.ids[i], at = progress.bookmarks.indexOf(id);
    if (at === -1) progress.bookmarks.push(id); else progress.bookmarks.splice(at, 1);
    btn.setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
    btn.textContent = at === -1 ? '★' : '☆';
    saveProgress();
    renderPinbar();
  }

  /* ======================================================================
     OPEN / CLOSE, NAVIGATION
     ====================================================================== */
  function setEraOpen(e, on) {
    open.e[e] = on;
    var sec = $('.era[data-e="' + e + '"]');
    if (!sec) return;
    var body = sec.querySelector('.era-body');
    if (on && !rendered[e]) { body.innerHTML = eraBodyHtml(e); rendered[e] = true; }
    body.hidden = !on;
    sec.querySelector('.era-head').setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function setBandOpen(b, on) {
    open.b[b] = on;
    var sec = $('.band[data-b="' + b + '"]');
    if (!sec) return;
    sec.querySelector('.band-body').hidden = !on;
    sec.querySelector('.band-head').setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function setAll(on) {
    D.periods.forEach(function (p, b) { if (!$('.band[data-b="' + b + '"]').hidden) setBandOpen(b, on); });
    D.eras.forEach(function (era, e) { var s = $('.era[data-e="' + e + '"]'); if (s && !s.hidden) setEraOpen(e, on); });
  }

  function jumpToIssue(id) {
    var i = ID_I[id];
    if (i === undefined) return false;
    if (activeTab !== 'list') showTab('list');
    if (narrowing() && !matches(i)) {
      toast('That issue is hidden by your filters.', 'Clear filters', function () { clearFilters(); jumpToIssue(id); });
      return false;
    }
    var e = D.issueEra[i];
    if (BAND_OF_ERA[e] >= 0) setBandOpen(BAND_OF_ERA[e], true);
    setEraOpen(e, true);
    var row = $('.row[data-i="' + i + '"]');
    if (!row) return false;
    row.scrollIntoView({ block: 'center' });
    row.classList.add('flash');
    setTimeout(function () { row.classList.remove('flash'); }, 1200);
    var m = row.querySelector('.mark');
    if (m) m.focus({ preventScroll: true });
    return true;
  }
  function nextUnread() {
    var filt = narrowing();
    for (var i = 0; i < N; i++) {
      if (isInert(i) || !inView(i) || (filt && !matches(i))) continue;
      if (stateOf(i) === 'unread') return jumpToIssue(D.ids[i]);
    }
    toast(filt ? 'Nothing unread matches these filters.' : 'Nothing unread — all caught up.');
    return false;
  }

  /* ======================================================================
     TABS — one nav. The filter panel lives inside the Checklist pane, so it
     shows on Checklist only. The active tab is remembered (S-29); the
     checklist itself still lands collapsed.
     ====================================================================== */
  var TABS = ['list', 'reading', 'reviews', 'settings'];
  var activeTab = 'list';
  function showTab(name) {
    if (TABS.indexOf(name) === -1) name = 'list';
    activeTab = name;
    TABS.forEach(function (t) {
      var on = t === name, b = $('#tab-' + t);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $('#pane-' + t).hidden = !on;
    });
    if (settings.tab !== name) { settings.tab = name; saveSettings(); }
    if (name === 'settings') renderSettings();
    if (name === 'reading') renderReading();
    if (name === 'reviews') renderReviews();
  }

  /* ======================================================================
     REVIEWS — one per arc (the session-2 migration maps old per-issue
     reviews onto arcs): 1–5 stars and text. The ✎ button (.b.rv, D-4) sits
     on the arc head; in layout C, on the first row of the arc's run.
     ====================================================================== */
  function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function rvTag(rv) { return rv ? (rv.r ? ' ' + '★'.repeat(rv.r) : ' noted') : ' review'; }
  function rvLabel(a) {
    var rv = reviews[D.arcs[a].id];
    return 'Review ' + D.arcs[a].n + (rv ? (rv.r ? ' (' + rv.r + ' of 5 stars)' : ' (notes)') : '');
  }
  function rvButton(a) {
    return '<button type="button" class="b rv" data-act="rv" data-a="' + a + '" aria-expanded="false" aria-label="' +
      escapeAttr(rvLabel(a)) + '">✎' + rvTag(reviews[D.arcs[a].id]) + '</button>';
  }
  function reviewEditorHtml(a) {
    var arc = D.arcs[a], cur = reviews[arc.id] || { r: 0, t: '' }, h = '';
    for (var n = 1; n <= 5; n++) {
      h += '<button type="button" class="star" data-act="rv-star" data-a="' + a + '" data-n="' + n + '" aria-pressed="' + (n <= cur.r) +
        '" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">★</button>';
    }
    return '<div class="review" data-a="' + a + '"><div class="stars" role="group" aria-label="Rating for ' + escapeAttr(arc.n) + '">' + h +
      '</div><textarea class="rvtext" data-a="' + a + '" rows="3" placeholder="Notes on ' + escapeAttr(arc.n) + '" aria-label="Notes on ' +
      escapeAttr(arc.n) + '">' + escapeHtml(cur.t || '') + '</textarea></div>';
  }
  function toggleReview(btn) {
    var host = btn.closest('.arc-head') || btn.closest('.row'), next = host.nextElementSibling;
    if (next && next.classList.contains('review')) { next.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
    host.insertAdjacentHTML('afterend', reviewEditorHtml(+btn.dataset.a));
    btn.setAttribute('aria-expanded', 'true');
    host.nextElementSibling.querySelector('textarea').focus();
  }
  /* Stars or text (undefined = leave as is). Clearing both deletes the review. */
  function commitReview(a, r, t) {
    var id = D.arcs[a].id, cur = reviews[id] || { r: 0, t: '' };
    if (r !== undefined) cur.r = r;
    if (t !== undefined) cur.t = t;
    if (!cur.r && !cur.t) delete reviews[id]; else reviews[id] = cur;
    save('reviews', reviews);
    $$('.b.rv[data-a="' + a + '"]').forEach(function (b) {
      b.textContent = '✎' + rvTag(reviews[id]);
      b.setAttribute('aria-label', rvLabel(a));
    });
    $$('.review[data-a="' + a + '"] .star').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.n <= cur.r ? 'true' : 'false'); });
  }
  /* The Reviews tab (F-3): sorted by each arc's first key, tap to jump. Old
     reviews the migration could not match are listed, never dropped. */
  function firstInView(a) {
    for (var i = ARC_FIRST[a]; i >= 0 && i < N; i++) if (D.issues[i][2] === a && !isInert(i) && inView(i)) return i;
    return -1;
  }
  function renderReviews() {
    var known = Object.keys(reviews).filter(function (id) { return ARC_I[id] !== undefined; })
      .sort(function (x, y) { return ARC_FIRST[ARC_I[x]] - ARC_FIRST[ARC_I[y]]; });
    var orphans = Object.keys(reviews).filter(function (id) { return ARC_I[id] === undefined; });
    var legacy = (load('legacy-unmatched', null) || { reviews: {} }).reviews || {};
    var item = function (name, rv, extra) {
      return '<li class="rev-item"><div class="rev-top">' + name +
        (rv.r ? '<span class="rev-stars" aria-label="' + rv.r + ' of 5 stars">' + stars(rv.r) + '</span>' : '') + (extra || '') + '</div>' +
        (rv.t ? '<p class="rev-t">' + escapeHtml(rv.t) + '</p>' : '') + '</li>';
    };
    var h = '<h2 class="pane-h">Reviews' + (known.length ? ' · ' + known.length : '') + '</h2>';
    h += known.length ? '<ol class="revlist">' + known.map(function (id) {
      var a = ARC_I[id], first = ARC_FIRST[a];
      return item('<button type="button" class="linkbtn rev-name" data-act="rv-jump" data-a="' + a + '">' + escapeHtml(D.arcs[a].n) + '</button>',
        reviews[id], first >= 0 ? '<span class="rev-era">' + escapeHtml(D.eras[D.issueEra[first]].name) + '</span>' : '');
    }).join('') + '</ol>' : '<p class="muted">No reviews yet. Tap ✎ on any arc to rate it.</p>';
    var kept = orphans.map(function (id) { return [id, reviews[id]]; })
      .concat(Object.keys(legacy).map(function (k) { return [k, legacy[k] || {}]; }));
    if (kept.length) {
      h += '<h3 class="ssub">Kept from the previous version</h3><p class="muted">These could not be matched to an arc in this list. ' +
        'They are kept, never dropped.</p><ul class="revlist kept">' + kept.map(function (k) {
          return item('<span class="rev-name">' + escapeHtml(k[0]) + '</span>', { r: +k[1].r || 0, t: k[1].t || '' });
        }).join('') + '</ul>';
    }
    $('#reviews').innerHTML = h;
  }

  /* ======================================================================
     READING TAB (F-2) — one entry at a time over the current view (plan and
     browse filters, and the display-only ones), in reading order within the
     chosen order, never reversed. It resumes at the first entry not yet done
     until the user steps; the position is session-only. Marks go through
     setMark, so every banner and the header move with them (D-1).
     ====================================================================== */
  var reader = { id: null, touched: false };
  function readerList() {
    var filt = narrowing(), out = [];
    D.eras.forEach(function (era, e) {
      orderedEraRows(e).forEach(function (i) {
        if (!isInert(i) && (filt ? matches(i) : inView(i))) out.push(i);
      });
    });
    return out;
  }
  function doneLabel(i) { return (LABELS[mediumOf(i)] || LABELS.comic).read; }
  function renderReading() {
    var list = readerList(), host = $('#reader');
    if (!list.length) {
      host.innerHTML = '<p class="empty">Nothing matches the current filters.</p>';
      return;
    }
    var at = reader.id == null ? -1 : list.indexOf(ID_I[reader.id]);
    if (!reader.touched || at === -1) {
      at = 0;
      for (var k = 0; k < list.length; k++) {
        var s0 = stateOf(list[k]);
        if (s0 !== 'read' && s0 !== 'skip') { at = k; break; }
      }
    }
    var i = list[at], r = D.issues[i], arc = D.arcs[r[2]], st = stateOf(i), id = D.ids[i];
    var pinned = progress.bookmarks.indexOf(id) !== -1, done = doneLabel(i);
    reader.id = id;
    host.innerHTML = '<div class="rcard" data-i="' + i + '" data-id="' + escapeAttr(id) + '" data-s="' + st + '">' +
      '<p class="rcount">' + (at + 1).toLocaleString('en-GB') + ' of ' + list.length.toLocaleString('en-GB') + '</p>' +
      '<p class="rpills"><span class="rpill">' + escapeHtml(D.eras[D.issueEra[i]].name) + '</span>' +
      (MEDIA_USED.length > 1 ? '<span class="rpill rmed">' + escapeHtml(mediumLabel(D.issueMedium[i])) + '</span>' : '') + '</p>' +
      '<h2 class="rtitle">' + escapeHtml(r[1]) + '</h2>' +
      '<p class="rmeta">' + escapeHtml(arc.n + ' · ' + D.types[r[3]].toLowerCase()) + '</p>' +
      '<p class="rstate">' + escapeHtml(labelOf(i, st)) + '</p>' +
      (r[7] ? '<p class="rnote">' + escapeHtml(r[7]) + '</p>' : '') +
      (arc.b ? '<p class="rblurb">' + escapeHtml(arc.b) + '</p>' : '') +
      '<div class="racts">' +
      '<button type="button" class="rbtn ghost" data-act="rd-skip" aria-pressed="' + (st === 'skip') + '">' + (st === 'skip' ? 'Skipped' : 'Skip') + '</button>' +
      '<button type="button" class="rbtn solid" data-act="rd-done" aria-pressed="' + (st === 'read') + '">' +
      escapeHtml(st === 'read' ? done + ' ✓' : 'Mark ' + done) + '</button></div>' +
      '<div class="rnav">' +
      '<button type="button" class="linkbtn" data-act="rd-prev"' + (at === 0 ? ' disabled' : '') + '>← Previous</button>' +
      '<button type="button" class="linkbtn" data-act="rd-pin" aria-pressed="' + pinned + '">' + (pinned ? '★ Pinned' : '☆ Pin for later') + '</button>' +
      '<button type="button" class="linkbtn" data-act="rd-next"' + (at === list.length - 1 ? ' disabled' : '') + '>Next →</button>' +
      '</div></div>';
  }
  function readerStep(delta) {
    var list = readerList(), at = list.indexOf(ID_I[reader.id]);
    if (at === -1) return;
    var to = Math.max(0, Math.min(list.length - 1, at + delta));
    reader.touched = true;
    reader.id = D.ids[list[to]];
    renderReading();
  }
  /* Mark from the Reading tab: the same setMark every surface uses. Setting a
     state steps on to the next entry; tapping it again clears it and stays. */
  function readerMark(want) {
    var i = ID_I[reader.id];
    if (i === undefined) return;
    var list = readerList(), at = list.indexOf(i), next = stateOf(i) === want ? 'unread' : want;
    setMark(i, next);
    if (next !== 'unread' && at !== -1 && at < list.length - 1) { reader.touched = true; reader.id = D.ids[list[at + 1]]; }
    renderReading();
  }

  /* ---- bookmarks: the pinned bar (XM-4) and the Settings list (F-28),
     both sorted as the checklist displays them ---- */
  function displayOrder(a, b) {
    var ea = D.issueEra[a], eb = D.issueEra[b];
    if (ea !== eb) return settings.rev ? eb - ea : ea - eb;
    if (settings.order === 'publication') return D.issues[a][8] - D.issues[b][8];
    if (settings.order === 'arc') return (D.issues[a][2] - D.issues[b][2]) || (a - b);
    return a - b;
  }
  function bookmarked() {
    return progress.bookmarks.map(function (id) { return ID_I[id]; })
      .filter(function (i) { return i !== undefined; }).sort(displayOrder);
  }
  function renderPinbar() {
    var list = bookmarked();
    $('#pinbar').hidden = !list.length;
    $('#pinchips').innerHTML = list.map(function (i) {
      return '<button type="button" class="chip pin" data-act="bm-jump" data-id="' + escapeAttr(D.ids[i]) + '">★ ' +
        escapeHtml(D.issues[i][1]) + '</button>';
    }).join('');
  }
  function removeBookmark(id) {
    var at = progress.bookmarks.indexOf(id);
    if (at === -1) return;
    progress.bookmarks.splice(at, 1);
    saveProgress();
    $$('.row[data-i="' + ID_I[id] + '"] .bm').forEach(function (btn) { btn.setAttribute('aria-pressed', 'false'); btn.textContent = '☆'; });
    renderPinbar();
    if (activeTab === 'settings') renderSettings();
  }

  /* ---- pace readout (F-18): "N left · W weeks · done Mon YYYY", from the
     same minutes maths as the header, so the two never disagree ---- */
  function paceReadout(S) {
    var t = (S || computeStats()).all;
    if (remaining(t) === 0) return 'All caught up ✓';
    var fin = finishBy(minutesLeft(t)), wk = Math.ceil(fin.weeks);
    return '<b>' + remaining(t).toLocaleString('en-GB') + '</b> left · ' + wk + (wk === 1 ? ' week' : ' weeks') + ' at ' +
      settings.pace.weekly + ' a week · done <span data-finish="' + fin.iso + '">' + escapeHtml(fin.text) + '</span>' +
      (t.ut ? ' · <span class="pace-untimed" data-untimed="' + t.ut + '">+' + t.ut + ' untimed</span>' : '');
  }
  function setPace(minutes, weekly) {
    // whole numbers only: integer minutes keep the comics-only figures exact
    if (minutes) settings.pace.minutes = Math.max(1, Math.round(minutes));
    if (weekly) settings.pace.weekly = Math.max(1, Math.round(weekly));
    saveSettings(); refreshStats();
    if (activeTab === 'settings') renderSettings();
  }

  /* ---- refresh reminder (F-34): the interval is consumed at boot, not just
     stored. The first run starts the clock; Dismiss resets it. ---- */
  var REFRESH = [['month', 'Monthly', 30], ['quarter', 'Quarterly', 91], ['year', 'Yearly', 365], ['off', 'Off', 0]];
  function refreshDays() {
    for (var k = 0; k < REFRESH.length; k++) if (REFRESH[k][0] === settings.refreshEvery) return REFRESH[k][2];
    return 0;
  }
  function checkRefresh() {
    var days = refreshDays(), last = +(settings.refreshSeen || 0);
    if (!days) return false;
    if (!last) { settings.refreshSeen = Date.now(); saveSettings(); return false; }
    if (Date.now() - last <= days * DAY) return false;
    toast('This list was last checked ' + Math.round((Date.now() - last) / DAY) + ' days ago. New issues may have shipped — reload to pick them up.',
      'Dismiss', function () { settings.refreshSeen = Date.now(); saveSettings(); });
    return true;
  }

  /* ---- safety snapshot: the full state, taken before anything that wipes
     it (Clear all progress; Replace on import), restored exactly by Undo ---- */
  function takeSnapshot() { return JSON.stringify({ progress: progress, reviews: reviews, settings: settings }); }
  function restoreSnapshot(snap) {
    var s = JSON.parse(snap), q = F.q, cr = F.creator;
    progress = s.progress;
    reviews = s.reviews;
    settings = withDefaults(s.settings);
    filtersFromSettings();
    F.q = q; F.creator = cr;                                   // search text is session-only
    saveProgress(); save('reviews', reviews); saveSettings();
    rerenderAll();
  }
  function rerenderAll() {
    renderPanel(); renderList(); applyPrefs();
    if (activeTab === 'settings') renderSettings();
  }
  var confirming = '';                    // which in-page confirm is open; never window.confirm
  var bulkSel = { era: 0, from: 0, to: D.eras.length - 1 };   // range defaults to the full span (T-19)
  function clearProgress() {
    var snap = takeSnapshot();
    progress.marks = {};
    confirming = '';
    saveProgress();
    rerenderAll();
    toast('All progress cleared. Reviews and bookmarks kept.', 'Undo', function () {
      restoreSnapshot(snap);
      toast('Progress restored.');
    });
  }
  function runImportLegacy() {
    var res = importLegacy();
    rerenderAll();
    toast(legacySummary(res) || 'Nothing new to bring over from the previous version.');
    return res;
  }

  /* ---- preferences: on/off settings. CSS-only ones become root flags in
     applyPrefs; the ones that change what is rendered re-render the list. ---- */
  var PREFS = { showJump: 'css', badges: 'css', combo: 'css', rev: 'list', reveal: 'list', gapNotes: 'list', swipe: 'css', press: 'css' };
  function applyPrefs() {
    var root = document.documentElement;
    $('.ptools [data-act="next"]').hidden = !settings.showJump;
    root.setAttribute('data-badges', settings.badges ? '1' : '0');
    root.setAttribute('data-combo', settings.combo ? '1' : '0');
    root.setAttribute('data-reveal', settings.reveal ? '1' : '0');
    root.setAttribute('data-layout', settings.layout);
  }
  function togglePref(k) {
    if (!PREFS[k]) return;
    settings[k] = !settings[k];
    saveSettings(); applyPrefs();
    if (PREFS[k] === 'list') renderList();
    renderSettings();
  }

  /* ---- era navigation (XM-8): a jump bar above the checklist — chips, a
     dropdown, or none (plain scroll, the default). It jumps, it never filters:
     the Story section's era chips are the filter. ---- */
  function renderEraNav(visEra) {
    var bar = $('#eranav'), eras = D.eras.map(function (e, i) { return i; }).filter(function (e) { return visEra[e]; });
    if (settings.rev) eras.reverse();
    bar.hidden = settings.eraNav === 'scroll' || !eras.length;
    if (bar.hidden) { $('#eranavIn').innerHTML = ''; return; }
    $('#eranavIn').innerHTML = settings.eraNav === 'chips'
      ? eras.map(function (e) { return '<button type="button" class="chip" data-act="era-jump" data-e="' + e + '">' + escapeHtml(D.eras[e].name) + '</button>'; }).join('')
      : '<select class="erasel" id="eraJump" aria-label="Jump to an era"><option value="">Jump to an era…</option>' +
        eras.map(function (e) { return '<option value="' + e + '">' + escapeHtml(D.eras[e].name) + '</option>'; }).join('') + '</select>';
  }
  function jumpToEra(e) {
    if (activeTab !== 'list') showTab('list');
    var sec = $('.era[data-e="' + e + '"]');
    if (!sec || sec.hidden) return false;
    if (BAND_OF_ERA[e] >= 0) setBandOpen(BAND_OF_ERA[e], true);
    setEraOpen(e, true);
    sec.scrollIntoView({ block: 'start' });
    sec.querySelector('.era-head').focus({ preventScroll: true });
    return true;
  }

  /* ======================================================================
     SETTINGS — sectioned (F-4); string templates like everything else
     ====================================================================== */
  function seg(act, label, opts, cur) {
    return '<div class="seg" role="group" aria-label="' + escapeAttr(label) + '">' + opts.map(function (o) {
      return '<button type="button" class="segbtn" data-act="' + act + '" data-v="' + escapeAttr(o[0]) + '" aria-pressed="' +
        (String(o[0]) === String(cur)) + '">' + escapeHtml(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function srow(label, control) { return '<div class="srow"><span class="slabel">' + escapeHtml(label) + '</span>' + control + '</div>'; }
  function sset(id, title, body) {
    return '<section class="sset" id="set-' + id + '" aria-labelledby="seth-' + id + '"><h2 class="seth" id="seth-' + id + '">' +
      escapeHtml(title) + '</h2>' + body + '</section>';
  }
  function pref(k, label) {
    return '<button type="button" class="chip" data-act="pref" data-k="' + k + '" aria-pressed="' + !!settings[k] + '">' + escapeHtml(label) + '</button>';
  }
  function bookmarksHtml() {
    var list = bookmarked();
    if (!list.length) return '<p class="muted">No bookmarks yet. Tap ☆ on any row.</p>';
    return '<ol class="bmlist">' + list.map(function (i) {
      var id = escapeAttr(D.ids[i]), title = D.issues[i][1];
      return '<li><button type="button" class="linkbtn" data-act="bm-jump" data-id="' + id + '">' + escapeHtml(title) + '</button>' +
        '<button type="button" class="linkbtn" data-act="bm-remove" data-id="' + id + '" aria-label="Remove bookmark: ' + escapeAttr(title) + '">Remove</button></li>';
    }).join('') + '</ol>';
  }
  function clearHtml() {
    if (confirming !== 'clear') return srow('Progress', '<button type="button" class="tool" data-act="clear-ask">Clear all progress…</button>');
    return '<div class="confirm" role="group" aria-labelledby="clear-q"><p id="clear-q">Clear every mark? Reviews and bookmarks stay, ' +
      'and you can undo straight after.</p><button type="button" class="tool danger" data-act="clear-yes">Clear all progress</button>' +
      '<button type="button" class="tool" data-act="clear-no">Cancel</button></div>';
  }
  function aboutHtml() {
    var c = D.counts;
    return '<h3 class="ssub">About this list</h3><p class="about">' + escapeHtml(D.franchise.title) + ' · ' +
      c.total.toLocaleString('en-GB') + ' entries · ' + c.core + ' core · ' + c.mandatory + ' mandatory · build ' + escapeHtml(D.build) + '</p>' +
      (D.legend.length ? '<dl class="legend">' + D.legend.map(function (l) {
        return '<dt>' + escapeHtml(l.term) + '</dt><dd>' + escapeHtml(l.meaning) + '</dd>';
      }).join('') + '</dl>' : '') +
      (D.maintenance.length ? '<ul class="maint">' + D.maintenance.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>' : '');
  }
  function renderSettings() {
    var S = computeStats(), ae = document.activeElement, keep = ae && ae.dataset ? [ae.dataset.act, ae.dataset.v, ae.dataset.k] : null;
    var h = sset('reading', 'Reading behaviour',
      srow('Minutes per issue', seg('pace-min', 'Minutes per issue', PACE_MINUTES.map(function (p) { return [p[2], p[1] + ' · ' + p[2] + ' min']; }), settings.pace.minutes)) +
      srow('Issues per week', seg('pace-week', 'Issues per week', PACE_WEEKLY.map(function (p) { return [p[2], p[1] + ' · ' + p[2]]; }), settings.pace.weekly)) +
      '<p class="pace" id="paceOut" aria-live="polite">' + paceReadout(S) + '</p>' +
      (MEDIA_USED.length > 1 ? srow('Progress', seg('pmode', 'Progress', [['combined', 'Combined'], ['medium', 'Per format']], settings.progressMode)) : '') +
      (D.events.length ? srow('Events', seg('events-view', 'Events', [['essential', 'Essential'], ['complete', 'Complete']], settings.events)) : '') +
      srow('Next unread button', pref('showJump', 'Show it')));
    h += sset('display', 'Display',
      srow('Rows', pref('badges', 'Badges') + pref('combo', 'Combo badge') + pref('reveal', 'Tap to reveal notes') + pref('gapNotes', 'Gap notes')) +
      srow('Order', pref('rev', 'Newest era first')) +
      srow('Arc headings', seg('layout', 'Arc headings', [['arcs', 'Headings'], ['rows', 'Label on each row']], settings.layout)) +
      srow('Era navigation', seg('eranav', 'Era navigation', [['scroll', 'Plain scroll'], ['chips', 'Chips'], ['dropdown', 'Dropdown']], settings.eraNav)));
    h += sset('touch', 'Touch',
      srow('Gestures', pref('swipe', 'Swipe to mark') + pref('press', 'Long-press to mark all read')) +
      '<p class="muted shelp">Swipe a row right to mark it read, left to skip it. Hold a band, era or arc heading to mark everything in it read; ' +
      'Undo puts every row back.</p>');
    var eraOpts = function (cur) {
      return D.eras.map(function (e, ei) { return '<option value="' + ei + '"' + (ei === cur ? ' selected' : '') + '>' + escapeHtml(e.name) + '</option>'; }).join('');
    };
    h += sset('bulk', 'Bulk actions',
      srow('Sections', '<button type="button" class="tool" data-act="expand-all">Expand all</button>' +
        '<button type="button" class="tool" data-act="collapse-all">Collapse all</button>') +
      srow('Mark era', '<select class="erasel" id="bulkEra" aria-label="Era to mark">' + eraOpts(bulkSel.era) + '</select>' +
        '<button type="button" class="tool" data-act="bulk-era" data-st="read">Mark read</button>' +
        '<button type="button" class="tool" data-act="bulk-era" data-st="unread">Mark unread</button>') +
      srow('Mark range', '<select class="erasel" id="bulkFrom" aria-label="Range start">' + eraOpts(bulkSel.from) + '</select>' +
        '<span class="muted">through</span><select class="erasel" id="bulkTo" aria-label="Range end">' + eraOpts(bulkSel.to) + '</select>' +
        '<button type="button" class="tool" data-act="bulk-range">Mark read</button>'));
    h += sset('data', 'Data',
      srow('Refresh reminder', seg('refresh', 'Refresh reminder', REFRESH.map(function (r) { return [r[0], r[1]]; }), settings.refreshEvery)) +
      '<h3 class="ssub">Bookmarks</h3>' + bookmarksHtml() +
      (D.franchise.storage && D.franchise.storage.legacy
        ? srow('Previous version', '<button type="button" class="tool" data-act="import-legacy">Import from previous version</button>') : '') +
      clearHtml() + aboutHtml());
    $('#settings').innerHTML = h;
    if (keep && keep[0]) {                                     // keep keyboard focus across the re-render
      var again = $$('#settings [data-act="' + keep[0] + '"]').filter(function (el) {
        return el.dataset.v === keep[1] && el.dataset.k === keep[2];
      })[0];
      if (again) again.focus();
    }
  }

  /* ======================================================================
     TOAST
     ====================================================================== */
  var toastAction = null, toastTimer = null;
  function toast(msg, actLabel, fn) {
    var t = $('#toast'), a = $('#toastAct');
    $('#toastMsg').textContent = msg;
    a.hidden = !actLabel;
    a.textContent = actLabel || '';
    toastAction = fn || null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, actLabel ? 8000 : 4000);
  }

  /* ======================================================================
     EVENTS — one delegated click handler and one input handler for the app
     ====================================================================== */
  function rowIndex(el) { var row = el.closest('.row'); return row ? +row.dataset.i : -1; }
  function onClick(ev) {
    if (swallowClick) { swallowClick = false; if (ev.target.closest('.band-head, .era-head, .arc-head')) return; }
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act, i;
    switch (act) {
      case 'mark':
        i = rowIndex(b);
        setMark(i, CYCLE[(CYCLE.indexOf(stateOf(i)) + 1) % CYCLE.length]);
        break;
      case 'bm': toggleBookmark(rowIndex(b), b); break;
      case 'note': {
        var row = b.closest('.row'), isOpen = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        var pop = row.nextElementSibling && row.nextElementSibling.classList.contains('notepop') ? row.nextElementSibling : null;
        if (isOpen) { if (pop) pop.remove(); }
        else if (!pop) row.insertAdjacentHTML('afterend', '<p class="notepop">' + escapeHtml(b.dataset.note) + '</p>');
        break;
      }
      case 'era': { var e = +b.closest('.era').dataset.e; setEraOpen(e, !open.e[e]); break; }
      case 'band': { var bd = +b.closest('.band').dataset.b; setBandOpen(bd, !open.b[bd]); break; }
      case 'panel': {
        var body = $('#fbody'), show = body.hidden;
        body.hidden = !show;
        b.setAttribute('aria-expanded', show ? 'true' : 'false');
        break;
      }
      case 'sec': {
        var k = b.dataset.k, at = settings.panelOpen.indexOf(k);
        if (at === -1) settings.panelOpen.push(k); else settings.panelOpen.splice(at, 1);
        saveSettings(); renderPanel();
        break;
      }
      case 'f': setFilter(b.dataset.k, b.dataset.v); break;
      case 'unset': setFilter(b.dataset.k, b.dataset.v, b.dataset.k === 'alt'); break;
      case 'clear': clearFilters(); break;
      case 'next': nextUnread(); break;
      case 'expand-all': setAll(true); break;
      case 'collapse-all': setAll(false); break;
      case 'toast-act': { $('#toast').hidden = true; var fn = toastAction; toastAction = null; if (fn) fn(); break; }
      case 'tab': showTab(b.dataset.tab); break;
      case 'pace-min': setPace(+b.dataset.v, 0); break;
      case 'pace-week': setPace(0, +b.dataset.v); break;
      case 'pmode': settings.progressMode = b.dataset.v === 'medium' ? 'medium' : 'combined'; saveSettings(); refreshStats(); renderSettings(); break;
      case 'refresh':
        settings.refreshEvery = b.dataset.v; settings.refreshSeen = Date.now();   // a new interval restarts the clock
        saveSettings(); renderSettings();
        break;
      case 'pref': togglePref(b.dataset.k); break;
      case 'layout': settings.layout = b.dataset.v === 'rows' ? 'rows' : 'arcs'; saveSettings(); applyPrefs(); renderList(); renderSettings(); break;
      case 'eranav':
        settings.eraNav = ERA_NAV.indexOf(b.dataset.v) === -1 ? 'scroll' : b.dataset.v;
        saveSettings(); renderList(); renderSettings();
        break;
      case 'era-jump': jumpToEra(+b.dataset.e); break;
      case 'rv': toggleReview(b); break;
      case 'creator': pickCreator(b.dataset.n); break;
      case 'events-view': setFilter('events', b.dataset.v); renderSettings(); break;
      case 'preset-new': presetForm = true; renderPanel(); if ($('#presetName')) $('#presetName').focus(); break;
      case 'preset-cancel': presetForm = false; renderPanel(); break;
      case 'preset-save': savePreset(); break;
      case 'preset-apply': applyPreset(b.dataset.n); break;
      case 'preset-del': deletePreset(b.dataset.n); break;
      case 'arc-mark': bulkArc(+b.dataset.a, b.dataset.st === 'unread' ? 'unread' : 'read'); break;
      case 'bulk-era': bulkEra(bulkSel.era, bulkSel.era, b.dataset.st === 'unread' ? 'unread' : 'read'); break;
      case 'bulk-range': bulkEra(bulkSel.from, bulkSel.to, 'read'); break;
      case 'rv-star': {
        var ra = +b.dataset.a, rn = +b.dataset.n, rcur = reviews[D.arcs[ra].id];
        commitReview(ra, rcur && rcur.r === rn ? 0 : rn);
        break;
      }
      case 'rv-jump': { var fi = firstInView(+b.dataset.a); if (fi >= 0) jumpToIssue(D.ids[fi]); break; }
      case 'rd-done': readerMark('read'); break;
      case 'rd-skip': readerMark('skip'); break;
      case 'rd-prev': readerStep(-1); break;
      case 'rd-next': readerStep(1); break;
      case 'rd-pin': {
        var ri = ID_I[reader.id], rb = $('.row[data-i="' + ri + '"] .bm');
        if (rb) toggleBookmark(ri, rb);
        else {
          var pat = progress.bookmarks.indexOf(reader.id);
          if (pat === -1) progress.bookmarks.push(reader.id); else progress.bookmarks.splice(pat, 1);
          saveProgress(); renderPinbar();
        }
        renderReading();
        break;
      }
      case 'reveal': {
        var note = b.closest('.row').querySelector('.subnote'), shown = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', shown ? 'false' : 'true');
        if (note) note.hidden = shown;
        break;
      }
      case 'bm-jump': jumpToIssue(b.dataset.id); break;
      case 'bm-remove': removeBookmark(b.dataset.id); break;
      case 'clear-ask': confirming = 'clear'; renderSettings(); break;
      case 'clear-no': confirming = ''; renderSettings(); break;
      case 'clear-yes': clearProgress(); break;
      case 'import-legacy': runImportLegacy(); break;
    }
  }
  /* change: the one listener for <select> controls (era dropdown now; bulk
     ranges and file import later). */
  var BULK_SELECTS = { bulkEra: 'era', bulkFrom: 'from', bulkTo: 'to' };
  function onChange(ev) {
    var id = ev.target.id;
    if (id === 'eraJump' && ev.target.value !== '') { jumpToEra(+ev.target.value); ev.target.value = ''; }
    if (BULK_SELECTS[id]) bulkSel[BULK_SELECTS[id]] = +ev.target.value;   // kept across Settings re-renders
  }

  /* ======================================================================
     TOUCH (opt-in, both off by default): swipe a row right = read, left =
     skip, with the row sliding over a coloured backing (XM-12); long-press a
     band / era / arc head to mark it all read, with Undo. Three passive,
     delegated listeners. No haptics: navigator.vibrate is never called
     (declined; a guard enforces it).
     ====================================================================== */
  var SWIPE = 60, PRESS_MS = 600;
  var touch = null, pressTimer = null, swallowClick = false;
  function onTouchStart(ev) {
    var p = ev.touches && ev.touches[0];
    if (!p) return;
    touch = { x: p.clientX, y: p.clientY, row: settings.swipe ? ev.target.closest('.row:not(.inert)') : null };
    var head = settings.press ? ev.target.closest('.band-head, .era-head, .arc-head') : null;
    clearTimeout(pressTimer);
    if (head) pressTimer = setTimeout(function () {
      pressTimer = null;
      swallowClick = true;                                     // the lift that follows must not also toggle the head
      if (head.classList.contains('band-head')) bulkBand(+head.closest('.band').dataset.b, 'read');
      else if (head.classList.contains('era-head')) bulkEra(+head.closest('.era').dataset.e, +head.closest('.era').dataset.e, 'read');
      else bulkArc(+head.closest('.arc').dataset.a, 'read');
    }, PRESS_MS);
  }
  function onTouchMove(ev) {
    var p = ev.touches && ev.touches[0];
    if (!p || !touch) return;
    var dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    if (pressTimer && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { clearTimeout(pressTimer); pressTimer = null; }
    if (touch.row) touch.row.dataset.swipe = Math.abs(dy) > 40 || Math.abs(dx) < 16 ? '' :
      (dx > 0 ? 'read' : 'skip') + (Math.abs(dx) >= SWIPE ? '-go' : '');
  }
  function onTouchEnd(ev) {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    var p = ev.changedTouches && ev.changedTouches[0], t = touch;
    touch = null;
    if (!t || !t.row || !p) return;
    t.row.dataset.swipe = '';
    var dx = p.clientX - t.x, dy = p.clientY - t.y;
    if (Math.abs(dx) < SWIPE || Math.abs(dy) > 40) return;
    setMark(+t.row.dataset.i, dx > 0 ? 'read' : 'skip');
  }
  var inputTimer = null;
  function onInput(ev) {
    var id = ev.target.id;
    if (ev.target.classList.contains('rvtext')) { commitReview(+ev.target.dataset.a, undefined, ev.target.value); return; }
    if (id !== 'q' && id !== 'cq') return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(function () {
      F[id === 'q' ? 'q' : 'creator'] = ev.target.value.trim();
      if (id === 'cq') F.creatorExact = false;                // typed text is a search, not a pick
      refilter();
    }, 180);
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  function applyFranchise() {
    var f = D.franchise;
    document.title = f.title;
    $('#wordmark').textContent = f.wordmark;
    $('#strapline').textContent = f.strapline;
    $('#buildtag').textContent = 'build ' + D.build;
    var tc = $('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', f.theme);
    var at = $('meta[name="apple-mobile-web-app-title"]');
    if (at) at.setAttribute('content', f.wordmark);
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });

  applyFranchise();
  var migration = null;
  if (D.franchise.storage && D.franchise.storage.legacy && !settings.migrated) {
    migration = importLegacy();
    settings.migrated = { format: D.franchise.storage.legacy.format, at: Date.now(), result: migration };
  }
  saveSettings();
  renderPanel();
  renderList();
  applyPrefs();
  showTab(settings.tab);
  if (migration && legacySummary(migration)) toast(legacySummary(migration));
  else checkRefresh();

  /* Small public surface for session 3's Settings actions (and the harness). */
  window.PullList = {
    importLegacy: runImportLegacy,
    jumpToIssue: jumpToIssue,
    showTab: showTab,
    pacePresets: { minutes: PACE_MINUTES, weekly: PACE_WEEKLY },
    setPace: setPace
  };
})();
