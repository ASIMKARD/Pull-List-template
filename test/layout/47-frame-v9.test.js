/* The v9 frame stays v9 (John, 25 Oct): a signature skin with "frame": "v9"
   (Absolute's own) looks and works exactly as the template did up to v9, while
   the shared skins move to X-Men's layout. Every visible element in five views
   (the landing, an era open, an arc's rows, scrolled, Reading) at 320, 390 and
   1024 px is compared with a recorded reference: its place and size within
   0.5 px, its look and its ::before and ::after decorations exactly
   (ref/frame-map.js).
   - The template's own: test/fixtures/sig-v9, whose skin has all five of v7's
     kinds of touch, against its frame-ref.json. It equals main at 4db1ba1 but for
     v9's 6 px mini bar (John, 28 Oct) and session 7's era-box rules, which v9
     never had (measured, 28 Oct). On Absolute's own data the v9 frame measured
     no difference at all from Absolute v9 (27dca56), in all 15 views.
   - A tracker's own: when the repo's signature skin is on the v9 frame and a
     frame-ref.json sits beside dataset.json (Absolute's, captured from v9 itself),
     so a template change copied in can't move its skin either.
   Symbols (★ ✎ ↗ …) are drawn from one face on every machine (ref/frame-map.js).
   Re-capture only after John has seen the difference: ref/capture-frame.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, FIX, ROOT_DATASET, build, loadData } = require('../lib/helpers');
const { serve, open, closeBrowser } = require('./lib');
const FM = require('./ref/frame-map');
const { measureAll } = require('./ref/capture-frame');

function check(t, name, ref, got) {
  t.ok(name + ': the reference is on the v9 frame, at every width and in every view', ref.frame === 'v9' &&
       JSON.stringify(ref.widths) === JSON.stringify(FM.WIDTHS) && JSON.stringify(ref.views) === JSON.stringify(FM.VIEWS));
  const diffs = [];
  for (const w of FM.WIDTHS) for (const v of FM.VIEWS) for (const d of FM.compare(ref.measured[w][v], got[w][v])) diffs.push(v + '@' + w + ' ' + d);
  const n = FM.WIDTHS.reduce((a, w) => a + FM.VIEWS.reduce((b, v) => b + Object.keys(got[w][v].elements).length, 0), 0);
  t.eq(name + ': every visible element where it was and as it looked, ' + n + ' measured in ' + FM.WIDTHS.length * FM.VIEWS.length + ' views', diffs.slice(0, 40), []);
}

module.exports = async function (t) {
  try {
    // ------------------------------------------------ the template's own v9-frame skin
    const dir = path.join(FIX, 'sig-v9'), ref = JSON.parse(fs.readFileSync(path.join(dir, 'frame-ref.json'), 'utf8'));
    const b = build(path.join(dir, 'dataset.json'), { label: 'sig-v9' });
    t.eq('the sig-v9 fixture builds, its signature skin on the v9 frame', [b.status, loadData(b.out).signature.frame], [0, 'v9']);
    let srv = await serve(b.out);
    const got = await measureAll(srv.url, loadData(b.out));
    await srv.close();
    t.ok('…and draws the page on it (data-frame="v9", in the signature skin)', FM.WIDTHS.every(w => FM.VIEWS.every(v => got[w][v].frame === 'v9' && got[w][v].skin === 'signature')));
    check(t, 'sig-v9', ref, got);
    t.ok('…its mini bar is v9\'s 6 px, as the progress bars\' rule draws it (John, 28 Oct)', FM.VIEWS.every(v => {
      const m = got[390][v], k = Object.keys(m.elements).find(x => /^progress#miniBar/.test(x));
      return !k || m.elements[k][0][3] === 6;
    }) && Object.keys(got[390].landing.elements).some(x => /^progress#miniBar/.test(x)));

    // ------------------------------------------------ a skin change that crosses frames draws it all again
    srv = await serve(b.out);
    const pg = await open(srv.url, { width: 390, height: 844, reducedMotion: 'reduce', storage: FM.seed(loadData(b.out)) });
    const state = () => pg.page.evaluate(() => ({ root: document.documentElement.getAttribute('data-frame'), list: document.querySelector('#app').getAttribute('data-frame'),
      foot: !!document.querySelector('.era-head .bfoot') }));
    await pg.page.waitForSelector('.era-head');
    const before = await state();
    await pg.page.click('#tab-settings');
    await pg.page.click('#settings .sec-head[data-k="look"]');
    await pg.page.click('[data-act="look"][data-k="skin"][data-v="pull"]');
    const inPull = await state();
    await pg.page.click('[data-act="look"][data-k="skin"][data-v="signature"]');
    const back = await state();
    t.eq('switching skins redraws the page on the new skin\'s frame: signature (v9) → Pull (x) → signature (v9)', [before, inPull, back],
         [{ root: 'v9', list: 'v9', foot: false }, { root: 'x', list: 'x', foot: true }, { root: 'v9', list: 'v9', foot: false }]);
    // the x frame moves the header's and the filter bar's controls (app.js placeChrome); back on v9 every one is where it was
    await pg.page.click('#tab-list');
    await pg.page.evaluate(() => scrollTo(0, 0));
    await FM.symbols(pg.page);
    await FM.DRIVE.landing(pg.page);
    const again = await pg.page.evaluate(([fn, L, P]) => eval('(' + fn + ')')(L, P), [FM.inventory.toString(), FM.LOOK, FM.PSEUDO]);
    t.eq('…and back on v9 the landing at 390 px is as recorded: every control the x frame moved is in its v9 place again', FM.compare(ref.measured[390].landing, again).slice(0, 20), []);
    t.eq('…with no page errors', pg.errors, []);
    await pg.close();
    await srv.close();

    // ------------------------------------------------ the repo's own, when its signature skin is on the v9 frame
    const sig = ROOT_DATASET.franchise.signature, own = path.join(ROOT, 'frame-ref.json');
    if (sig && sig.frame === 'v9') {
      t.ok('this tracker\'s signature skin is on the v9 frame, and its reference is here (frame-ref.json)', fs.existsSync(own));
      if (fs.existsSync(own)) {
        srv = await serve(null);
        const mine = await measureAll(srv.url, loadData(ROOT));
        await srv.close();
        check(t, ROOT_DATASET.franchise.wordmark, JSON.parse(fs.readFileSync(own, 'utf8')), mine);
      }
    } else {
      t.ok('the repo\'s own skin isn\'t on the v9 frame: only the fixture is held to it', true);
    }
  } finally {
    await closeBrowser();
  }
};
