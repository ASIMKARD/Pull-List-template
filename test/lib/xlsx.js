/* A small .xlsx reader for the harness: unzips with node's zlib, then reads
   each sheet BY HEADER NAME (row 1 names the columns), never by position.
   Handles stored and deflated entries, inline and shared strings. */
'use strict';
const zlib = require('zlib');

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {}, order = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    const lh = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.slice(lh, lh + size);
    files[name] = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : null;
    order.push({ name, method });
    p += 46 + nameLen + extra + comment;
  }
  return { files, order };
}

const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (tag, a) => { const m = tag.match(new RegExp('\\s' + a + '="([^"]*)"')); return m ? unxml(m[1]) : null; };

/* { names: [sheet names in order], sheets: { name: { headers, rows: [[raw]], records: [{header: value}] , xml } }, parts } */
function readWorkbook(buf) {
  const { files, order } = unzip(buf);
  const text = n => files[n] ? files[n].toString('utf8') : null;
  const shared = [];
  const ss = text('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => unxml(x[1])).join(''));
  const rels = {};
  for (const m of (text('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)) rels[attr(m[0], 'Id')] = attr(m[0], 'Target');
  const names = [], sheets = {};
  for (const m of (text('xl/workbook.xml') || '').matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = attr(m[0], 'name'), target = 'xl/' + rels[attr(m[0], 'r:id')].replace(/^\/?xl\//, '');
    const xml = text(target);
    const grid = [];
    for (const r of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = {};
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(' ' + c[1], 'r'), t = attr(' ' + c[1], 't'), body = c[2] || '';
        const col = ref.replace(/\d+$/, '');
        let v;
        if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => unxml(x[1])).join('');
        else if (t === 's') v = shared[+(body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]];
        else if (t === 'str') v = unxml((body.match(/<v>([\s\S]*?)<\/v>/) || ['', ''])[1]);
        else { const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; v = raw === undefined ? '' : Number(raw); }
        cells[col] = v;
      }
      grid.push({ r: +r[1], cells });
    }
    const head = grid.find(g => g.r === 1) || { cells: {} };
    const cols = Object.keys(head.cells);
    const headers = cols.map(c => head.cells[c]);
    const body = grid.filter(g => g.r > 1);
    const records = body.map(g => Object.fromEntries(cols.map(c => [head.cells[c], g.cells[c] === undefined ? '' : g.cells[c]])));
    names.push(name);
    sheets[name] = { headers, records, rows: body.map(g => cols.map(c => g.cells[c] === undefined ? '' : g.cells[c])), xml };
  }
  return { names, sheets, parts: order, files };
}

module.exports = { readWorkbook, unzip };
