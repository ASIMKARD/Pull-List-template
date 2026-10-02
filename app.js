/* Pull List template v3 — app shell.
   SESSION 1 STUB: boots, applies the franchise from data, namespaces storage
   and renders one collapsed banner per era. Session 2 replaces the rendering
   with the full checklist. Rules that already hold and must keep holding:
   - every franchise string comes from window.TRACKER_DATA, never from code;
   - all markup is built with string templates through escapeHtml/escapeAttr;
   - events are delegated: the whole app stays at or under 12 listeners. */
(function () {
  'use strict';
  var D = window.TRACKER_DATA;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

  /* ---------- storage: namespaced per franchise, localStorage shim ---------- */
  var NS = D.franchise.key + ':v3:';
  var store = (function () {
    var mem = {}, ls = null;
    try { ls = window.localStorage; ls.setItem(NS + 'probe', '1'); ls.removeItem(NS + 'probe'); }
    catch (e) { ls = null; }
    return {
      get: function (k) { var v = ls ? ls.getItem(NS + k) : mem[NS + k]; return v == null ? null : JSON.parse(v); },
      set: function (k, v) { var s = JSON.stringify(v); if (ls) ls.setItem(NS + k, s); else mem[NS + k] = s; }
    };
  })();

  var pending = {}, timer = null;
  function flushNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    Object.keys(pending).forEach(function (k) { store.set(k, pending[k]); delete pending[k]; });
  }
  function save(k, v) {
    pending[k] = v;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushNow, 400);
  }

  var state = { progress: store.get('progress') || {}, open: {} };

  /* ---------- franchise ---------- */
  function applyFranchise() {
    var f = D.franchise;
    document.title = f.title;
    document.getElementById('wordmark').textContent = f.wordmark;
    document.getElementById('strapline').textContent = f.strapline;
    document.getElementById('buildtag').textContent = 'build ' + D.build;
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', f.theme);
    var at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (at) at.setAttribute('content', f.wordmark);
  }

  /* ---------- render: collapsed era banners (session 2 builds the rest) ---------- */
  function eraBanner(era, i) {
    var n = D.eraCounts[i];
    return '<section class="era" data-e="' + i + '">' +
      '<button class="era-head" type="button" data-act="era" aria-expanded="false">' +
      '<span class="ename">' + escapeHtml(era.name) + '</span>' +
      '<span class="eyears">' + escapeHtml(era.years) + '</span>' +
      '<span class="ecount">' + n + ' issues</span></button></section>';
  }
  function render() {
    var app = document.getElementById('app');
    app.innerHTML = D.eras.map(eraBanner).join('');
    app.setAttribute('aria-busy', 'false');
  }

  /* ---------- one delegated listener for the whole app ---------- */
  function onClick(ev) {
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'era') {
      var i = b.closest('.era').dataset.e;
      state.open[i] = !state.open[i];            // session-only: never persisted
      b.setAttribute('aria-expanded', state.open[i] ? 'true' : 'false');
    }
  }

  document.addEventListener('click', onClick);
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushNow();
  });

  applyFranchise();
  render();
  save('seen', D.build);
})();
