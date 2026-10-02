/* Pull List template v3 — the app.
   Rules that must keep holding (the harness enforces them):
   - every franchise string comes from window.TRACKER_DATA, never from code;
   - all markup is built with string templates through escapeHtml/escapeAttr;
   - events are delegated: the whole app stays at or under 12 listeners
     (session 2 uses 4: click, input, pagehide, visibilitychange);
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
  /* Pace (decided 2 Oct): minutes per issue drives "time left" on every banner
     (presets from the feel-reference build); issues per week drives the cumulative finish-by date (v2
     presets). Both live in the one settings store; Settings controls: session 3. */
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
  var HAY = new Array(N), CREATORS_HAY = new Array(N);
  var ERA_ROWS = D.eras.map(function () { return []; });
  var BAND_OF_ERA = D.eras.map(function () { return -1; });
  D.periods.forEach(function (p, b) { p.eras.forEach(function (e) { BAND_OF_ERA[e] = b; }); });
  var HAS_ALT = false;
  for (var i0 = 0; i0 < N; i0++) {
    var r0 = D.issues[i0], arc0 = D.arcs[r0[2]];
    ID_I[D.ids[i0]] = i0;
    ERA_ROWS[D.issueEra[i0]].push(i0);
    if (r0[6] & FL.ALT) HAS_ALT = true;
    var names = D.issueWriters[i0].concat(D.issueArtists[i0]).map(function (c) { return D.creators[c].n; }).join(' ');
    CREATORS_HAY[i0] = names.toLowerCase();
    HAY[i0] = (r0[1] + ' ' + arc0.n + ' ' + (r0[7] || '') + ' ' + names).toLowerCase();
  }
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
             eras: [], types: [], media: [], strands: [], alt: true };
  }
  var PERSISTED_FILTERS = ['tier', 'unread', 'hideSkip', 'mandatory', 'eras', 'types', 'media', 'strands', 'alt'];
  var progress = load('progress', null) || { marks: {}, bookmarks: [] };
  progress.marks = progress.marks || {};
  progress.bookmarks = progress.bookmarks || [];
  var reviews = load('reviews', null) || {};
  var settings = load('settings', null) || {};
  settings.v = 3;
  settings.pace = settings.pace || { minutes: 15, weekly: 12 };
  settings.order = settings.order || 'reading';
  settings.events = settings.events || 'essential';
  settings.panelOpen = settings.panelOpen || [];
  var F = defaultFilters();
  (function () {
    var saved = settings.filters || {};
    PERSISTED_FILTERS.forEach(function (k) { if (saved[k] !== undefined) F[k] = saved[k]; });
    if (F.tier > D.tiers.length - 1) F.tier = D.tiers.length - 1;
  })();
  function saveSettings() {
    settings.filters = {};
    PERSISTED_FILTERS.forEach(function (k) { settings.filters[k] = F[k]; });
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
  function narrowing() {
    return !!(F.q || F.creator || F.tier < D.tiers.length - 1 || F.unread || F.hideSkip || F.mandatory ||
              F.eras.length || F.types.length || F.media.length || F.strands.length || !F.alt);
  }
  function matches(i) {
    if (!inView(i)) return false;
    var r = D.issues[i];
    if (F.eras.length && F.eras.indexOf(D.issueEra[i]) === -1) return false;
    if (!F.alt && (r[6] & FL.ALT)) return false;
    if (F.strands.length && !D.arcs[r[2]].s.some(function (s) { return F.strands.indexOf(s) !== -1; })) return false;
    if (isInert(i)) return !narrowing();                       // notes never count as a match
    if (F.q && HAY[i].indexOf(F.q.toLowerCase()) === -1) return false;
    if (F.creator && CREATORS_HAY[i].indexOf(F.creator.toLowerCase()) === -1) return false;
    if (D.issueTier[i] > F.tier) return false;
    if (F.types.length && F.types.indexOf(r[3]) === -1) return false;
    if (F.media.length && F.media.indexOf(D.issueMedium[i]) === -1) return false;
    if (F.mandatory && !r[4]) return false;
    var st = stateOf(i);
    if (F.unread && (st === 'read' || st === 'skip')) return false;
    if (F.hideSkip && st === 'skip') return false;
    return true;
  }

  /* ======================================================================
     STATS AND PACE — goal stats are over the current view (Essential or
     Complete), unaffected by narrowing filters: a banner is a finishable goal.
     ====================================================================== */
  function blank() { return { total: 0, read: 0, skip: 0 }; }
  function computeStats() {
    var s = { all: blank(), era: D.eras.map(blank), band: D.periods.map(blank) };
    for (var i = 0; i < N; i++) {
      if (isInert(i) || !inView(i)) continue;
      var st = stateOf(i), e = D.issueEra[i], b = BAND_OF_ERA[e];
      [s.all, s.era[e], b >= 0 ? s.band[b] : null].forEach(function (t) {
        if (!t) return;
        t.total++;
        if (st === 'read') t.read++; else if (st === 'skip') t.skip++;
      });
    }
    return s;
  }
  function remaining(t) { return t.total - t.read - t.skip; }       // unread + reading, never skipped
  function goal(t) { return t.total - t.skip; }
  function timeLeft(t) {
    var mins = remaining(t) * (settings.pace.minutes || 15);
    if (mins < 60) return { mins: mins, text: mins + 'm' };
    var hrs = mins / 60;
    if (hrs < 24) return { mins: mins, text: Math.round(hrs) + 'h' };
    return { mins: mins, text: (Math.round(hrs / 24 * 10) / 10) + 'd' };
  }
  /* Cumulative: "if you keep reading in order, you'll finish this band by…" —
     the unread issues in this unit plus every unit before it in reading order. */
  function finishBy(cumRemaining) {
    var weeks = cumRemaining / (settings.pace.weekly || 12);
    var d = new Date(Date.now() + weeks * 7 * DAY);
    return { iso: d.toISOString().slice(0, 10),
             text: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) };
  }

  /* ======================================================================
     RENDER — string templates only
     ====================================================================== */
  var open = { b: {}, e: {} };          // session-only: never persisted
  var rendered = {};                     // era index -> body rendered

  function statsHtml(t, finish) {
    var g = goal(t), left = timeLeft(t), done = remaining(t) === 0 && t.total > 0;
    return '<span class="bstats">' +
      '<span class="bcount">' + t.read + ' / ' + g + ' read' + (t.skip ? ' · ' + t.skip + ' skipped' : '') + '</span>' +
      (done ? '<span class="bdone" aria-label="complete">✓</span>'
            : '<span class="bleft" data-left-min="' + left.mins + '">' + left.text + ' left</span>' +
              (finish ? '<span class="bfinish" data-finish="' + finish.iso + '">finish by ' + escapeHtml(finish.text) + '</span>' : '')) +
      '</span><progress class="bar" max="' + (g || 1) + '" value="' + t.read + '" aria-label="progress"></progress>';
  }

  function topUnits() { return HAS_BANDS ? D.periods.map(function (p, b) { return b; }) : D.eras.map(function (e, i) { return i; }); }
  function finishMap(S) {
    var out = {}, cum = 0;
    topUnits().forEach(function (u) {
      var t = HAS_BANDS ? S.band[u] : S.era[u];
      cum += remaining(t);
      out[u] = remaining(t) === 0 ? null : finishBy(cum);
    });
    return out;
  }

  function renderHeader(S) {
    var t = S.all, done = remaining(t) === 0;
    var fin = done ? null : finishBy(remaining(t)), left = timeLeft(t);
    $('#pprog').innerHTML =
      '<progress class="bar pbar" max="' + (goal(t) || 1) + '" value="' + t.read + '" aria-label="Reading progress"></progress>' +
      '<p class="pstats"><span class="pcount">' + t.read + ' / ' + goal(t) + ' read' +
      (t.skip ? ' · ' + t.skip + ' skipped' : '') + '</span>' +
      (done ? '<span class="pdone">All caught up ✓</span>'
            : '<span class="pleft" data-left-min="' + left.mins + '">' + left.text + ' left</span>' +
              '<span class="pfinish" data-finish="' + fin.iso + '">finish by ' + escapeHtml(fin.text) + '</span>') + '</p>';
  }

  function orderedEraRows(e) {
    var rows = ERA_ROWS[e].slice();
    if (settings.order === 'publication') rows.sort(function (a, b) { return D.issues[a][8] - D.issues[b][8]; });
    else if (settings.order === 'arc') rows.sort(function (a, b) { return (D.issues[a][2] - D.issues[b][2]) || (a - b); });
    return rows;
  }

  function creditsLine(i) {
    var w = D.issueWriters[i].map(function (c) { return D.creators[c].n; });
    var a = D.issueArtists[i].map(function (c) { return D.creators[c].n; });
    var bits = [];
    if (w.length) bits.push('Writer' + (w.length > 1 ? 's' : '') + ': ' + w.join(', '));
    if (a.length) bits.push('Art: ' + a.join(', '));
    return bits.join(' · ');
  }

  function rowHtml(i) {
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
    var sub = r[7] && !(flags & (FL.FB | FL.ALT)) ? '<p class="subnote">' + escapeHtml(r[7]) + '</p>' : '';
    return '<div class="row" data-i="' + i + '" data-id="' + escapeAttr(id) + '" data-s="' + st + '">' +
      '<button type="button" class="mark" data-act="mark" aria-label="' + escapeAttr(r[1] + ' — ' + labelOf(i, st)) + '">' +
      GLYPH[st] + '</button><span class="title">' + escapeHtml(r[1]) + '</span>' +
      '<span class="badges">' + badges + '</span>' + sub + '</div>';
  }

  function eraBodyHtml(e) {
    var filt = narrowing(), html = '', curArc = -1, seen = {};
    orderedEraRows(e).forEach(function (i) {
      if (filt ? !matches(i) : !inView(i)) return;
      var a = D.issues[i][2];
      if (a !== curArc) {
        if (curArc !== -1) html += '</div>';
        var arc = D.arcs[a], again = !!seen[a];
        seen[a] = 1; curArc = a;
        var meta = [arc.y].filter(Boolean).join(' · ');
        var cred = again ? '' : creditsLine(i);
        html += '<div class="arc" data-a="' + a + '"><div class="arc-head"><h3>' + escapeHtml(arc.n) +
          (again ? ' · cont.' : '') + '</h3>' + (meta ? '<span class="arc-meta">' + escapeHtml(meta) + '</span>' : '') +
          (cred ? '<p class="credits">' + escapeHtml(cred) + '</p>' : '') +
          (arc.b && !again && arc.b !== D.eras[e].intro ? '<p class="blurb">' + escapeHtml(arc.b) + '</p>' : '') + '</div>';
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
    var visEra = D.eras.map(function () { return !filt; }), any = false;
    if (filt) {
      for (var i = 0; i < N; i++) if (matches(i)) { visEra[D.issueEra[i]] = true; any = true; }
      open = { b: {}, e: {} };
      visEra.forEach(function (v, e) { if (v) { open.e[e] = true; if (BAND_OF_ERA[e] >= 0) open.b[BAND_OF_ERA[e]] = true; } });
    }
    var html = '';
    if (HAS_BANDS) {
      D.periods.forEach(function (p, b) {
        var shown = p.eras.some(function (e) { return visEra[e]; }), isOpen = !!open.b[b];
        html += '<section class="band" data-b="' + b + '"' + (shown ? '' : ' hidden') + '>' +
          '<button type="button" class="band-head" data-act="band" aria-expanded="' + isOpen + '" aria-controls="band-body-' + b + '">' +
          '<span class="bhead"><span class="bname">' + escapeHtml(p.name) + '</span>' +
          (p.label ? '<span class="byears">' + escapeHtml(p.label) + '</span>' : '') + '</span>' +
          statsHtml(S.band[b], fins[b]) + '</button>' +
          '<div class="band-body" id="band-body-' + b + '"' + (isOpen ? '' : ' hidden') + '>' +
          (p.blurb ? '<p class="band-intro">' + escapeHtml(p.blurb) + '</p>' : '') +
          p.eras.map(function (e) { return eraHtml(e, S, null, !visEra[e]); }).join('') + '</div></section>';
      });
    } else {
      D.eras.forEach(function (era, e) { html += eraHtml(e, S, fins[e], !visEra[e]); });
    }
    if (filt && !any) html += '<p class="empty">Nothing matches these filters.</p>';
    var app = $('#app');
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
    D.eras.forEach(function (e, idx) { if (open.e[idx]) rendered[idx] = true; });
    renderHeader(S);
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
      if (F.hideSkip) bits.push('skipped hidden');
      if (F.mandatory) bits.push('mandatory only');
      return bits.length ? bits.join(' · ') : '';
    }
    if (k === 'story') {
      if (F.eras.length) bits.push(F.eras.length === 1 ? D.eras[F.eras[0]].name : F.eras.length + ' eras');
      if (F.types.length) bits.push(names(F.types, function (t) { return D.types[t].toLowerCase(); }));
      if (F.media.length) bits.push(names(F.media, mediumLabel));
      if (!F.alt) bits.push('alternate stories hidden');
      return bits.join(' · ');
    }
    if (k === 'chars') return F.strands.length ? names(F.strands, function (s) { return D.strands[s]; }) : '';
    if (k === 'creators') return F.creator ? '“' + F.creator + '”' : '';
    return orderLabel(settings.order);
  }
  var SUMMARY_DEFAULT = { reading: 'All issues', story: 'Everything', chars: 'All characters', creators: 'All creators' };

  function activeChips() {
    var c = [];
    if (F.q) c.push(['q', '', 'Search: “' + F.q + '”']);
    if (F.creator) c.push(['creator', '', 'Creator: “' + F.creator + '”']);
    if (F.tier < D.tiers.length - 1) c.push(['tier', '', D.tiers[F.tier] + ' tier']);
    if (F.unread) c.push(['unread', '', 'Unread only']);
    if (F.hideSkip) c.push(['hideSkip', '', 'Skipped hidden']);
    if (F.mandatory) c.push(['mandatory', '', 'Mandatory only']);
    F.eras.forEach(function (e) { c.push(['eras', e, D.eras[e].name]); });
    F.types.forEach(function (t) { c.push(['types', t, D.types[t].toLowerCase()]); });
    F.media.forEach(function (m) { c.push(['media', m, mediumLabel(m)]); });
    F.strands.forEach(function (s) { c.push(['strands', s, D.strands[s]]); });
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
      h += '<div class="flabel">Depth</div>';
      D.tiers.forEach(function (t, ti) {
        h += chip('tier', ti, t + ' · ' + countWhere(function (i) { return D.issueTier[i] <= ti; }), F.tier === ti);
      });
      h += '<div class="flabel">Status</div>' + chip('unread', '', 'Unread only', F.unread) +
        chip('hideSkip', '', 'Hide skipped', F.hideSkip) + chip('mandatory', '', 'Mandatory only', F.mandatory);
    } else if (k === 'story') {
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
      D.strands.forEach(function (s, si) { h += chip('strands', si, s, F.strands.indexOf(si) !== -1); });
    } else if (k === 'creators') {
      h += '<input class="search" id="cq" type="search" placeholder="Search writers and artists" aria-label="Search writers and artists" value="' +
        escapeAttr(F.creator) + '" autocomplete="off">';
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
    var shown = countWhere(matches), total = countWhere(function () { return true; });
    $('#fshow').textContent = 'Showing ' + shown.toLocaleString('en-GB') + ' of ' + total.toLocaleString('en-GB') + ' issues';
  }

  function refilter() { saveSettings(); renderPanel(); renderList(); }

  function setFilter(k, v, on) {
    if (k === 'tier') F.tier = v === '' ? D.tiers.length - 1 : +v;
    else if (k === 'order') { settings.order = v; }
    else if (k === 'q' || k === 'creator') { F[k] = ''; var inp = $(k === 'q' ? '#q' : '#cq'); if (inp) inp.value = ''; }
    else if (['eras', 'types', 'media', 'strands'].indexOf(k) !== -1) {
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
    $('#q').value = '';
    open = { b: {}, e: {} };
    refilter();
  }

  /* ======================================================================
     MARKS — ONE path for every surface (Checklist now; Reading tab, swipe and
     bulk marking in session 3 call the same function)
     ====================================================================== */
  function setMark(i, st) {
    var id = D.ids[i];
    if (st === 'unread') delete progress.marks[id]; else progress.marks[id] = st;
    saveProgress();
    $$('.row[data-i="' + i + '"]').forEach(function (row) {
      row.dataset.s = st;
      var m = row.querySelector('.mark');
      m.textContent = GLYPH[st];
      m.setAttribute('aria-label', D.issues[i][1] + ' — ' + labelOf(i, st));
    });
    refreshStats();
    if (narrowing()) renderPanel();
  }
  function toggleBookmark(i, btn) {
    var id = D.ids[i], at = progress.bookmarks.indexOf(id);
    if (at === -1) progress.bookmarks.push(id); else progress.bookmarks.splice(at, 1);
    btn.setAttribute('aria-pressed', at === -1 ? 'true' : 'false');
    btn.textContent = at === -1 ? '★' : '☆';
    saveProgress();
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
    }
  }
  var inputTimer = null;
  function onInput(ev) {
    var id = ev.target.id;
    if (id !== 'q' && id !== 'cq') return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(function () {
      F[id === 'q' ? 'q' : 'creator'] = ev.target.value.trim();
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
  if (migration && legacySummary(migration)) toast(legacySummary(migration));

  /* Small public surface for session 3's Settings actions (and the harness). */
  window.PullList = {
    importLegacy: function () {
      var res = importLegacy();
      renderPanel(); renderList();
      if (legacySummary(res)) toast(legacySummary(res));
      return res;
    },
    jumpToIssue: jumpToIssue,
    pacePresets: { minutes: PACE_MINUTES, weekly: PACE_WEEKLY },
    setPace: function (minutes, weekly) {
      if (minutes) settings.pace.minutes = minutes;
      if (weekly) settings.pace.weekly = weekly;
      saveSettings(); refreshStats();
    }
  };
})();
