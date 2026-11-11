  /* ================================================================== PDF: omzetten, samenvoegen */
  var PL = W.PDFLib, CONV_VERSION = 2;
  var A4 = [595.28, 841.89], A4L = [841.89, 595.28];
  var INK = PL.rgb(0.12, 0.14, 0.18), GREY = PL.rgb(0.45, 0.48, 0.53), LINE = PL.rgb(0.75, 0.78, 0.82), HEAD = PL.rgb(0.93, 0.95, 0.97), BLUE = PL.rgb(0.11, 0.31, 0.49);
  var WIN = (function () { var s = {}, i; for (i = 32; i < 127; i++) s[i] = 1; for (i = 160; i < 256; i++) s[i] = 1; '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split('').forEach(function (c) { s[c.charCodeAt(0)] = 1; }); return s; })();
  var MAPC = { '→': '->', '←': '<-', '⇒': '=>', '≥': '>=', '≤': '<=', '≠': '!=', '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '●': '•', '▪': '•', '■': '•', '►': '>', '▶': '>', '◦': '-', '○': 'o', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‎': '', '‏': '', '﻿': '', '‐': '-', '‑': '-', '‒': '-', '−': '-', '­': '', '': '•', '': '•', '': '>', '': 'v', '•': '•' };
  function san(t) {
    var o = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t[i], c = t.charCodeAt(i);
      if (WIN[c]) { o += ch; continue; }
      if (c === 9) { o += '    '; continue; }
      if (c === 10 || c === 13) { o += ' '; continue; }
      if (MAPC[ch] != null) { o += MAPC[ch]; continue; }
      if (c >= 0xD800 && c < 0xDC00) { i++; continue; }
      var n = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      if (n && n !== ch && Array.prototype.every.call(n, function (x) { return WIN[x.charCodeAt(0)]; })) { o += n; continue; }
      o += '?';
    }
    return o;
  }
  async function newDoc() {
    var d = await PL.PDFDocument.create();
    return { doc: d, F: { r: await d.embedFont(PL.StandardFonts.Helvetica), b: await d.embedFont(PL.StandardFonts.HelveticaBold), i: await d.embedFont(PL.StandardFonts.HelveticaOblique), bi: await d.embedFont(PL.StandardFonts.HelveticaBoldOblique) } };
  }
  function Writer(ctx, size, margin) {
    var self = this;
    this.doc = ctx.doc; this.F = ctx.F; this.size = size || A4; this.m = margin || 56; this.page = null; this.y = 0;
    this.W = function () { return self.size[0] - 2 * self.m; };
    this.newPage = function () { self.page = self.doc.addPage(self.size); self.y = self.size[1] - self.m; };
    this.ensure = function (h) { if (!self.page || self.y - h < self.m) self.newPage(); };
    this.font = function (r) { return r.b && r.i ? self.F.bi : r.b ? self.F.b : r.i ? self.F.i : self.F.r; };
    function layout(runs, size, maxW) {
      var lines = [], cur = { segs: [], w: 0 };
      function push() { lines.push(cur); cur = { segs: [], w: 0 }; }
      function add(t, f, sz, c) {
        var last = cur.segs[cur.segs.length - 1], w = f.widthOfTextAtSize(t, sz);
        if (last && last.font === f && last.size === sz && last.color === c) { last.t += t; last.w += w; } else cur.segs.push({ t: t, font: f, size: sz, w: w, color: c });
        cur.w += w;
      }
      runs.forEach(function (r) {
        if (r.br) { push(); return; }
        var f = self.font(r), sz = r.size || size;
        san(r.t || '').split(/(\s+)/).forEach(function (tk) {
          if (!tk) return;
          if (/^\s+$/.test(tk)) { if (!cur.segs.length) return; tk = ' '; }
          var w = f.widthOfTextAtSize(tk, sz);
          if (tk !== ' ' && cur.w + w > maxW && cur.segs.length) push();
          while (w > maxW && tk.length > 1) {
            var k = tk.length; while (k > 1 && f.widthOfTextAtSize(tk.slice(0, k), sz) > maxW - cur.w) k--;
            add(tk.slice(0, k), f, sz, r.color); push(); tk = tk.slice(k); w = f.widthOfTextAtSize(tk, sz);
          }
          add(tk, f, sz, r.color);
        });
      });
      if (cur.segs.length) lines.push(cur);
      return lines;
    }
    this.layout = layout;
    this.drawLines = function (page, lines, x, y, size, o) {
      o = o || {}; var lh = size * (o.lh || 1.3);
      lines.forEach(function (L) {
        var lx = x; if (o.align === 'center') lx = x + (o.w - L.w) / 2; else if (o.align === 'right') lx = x + o.w - L.w;
        L.segs.forEach(function (s) { if (s.t.trim()) page.drawText(s.t, { x: lx, y: y - s.size, size: s.size, font: s.font, color: s.color || o.color || INK }); lx += s.w; });
        y -= lh;
      });
      return y;
    };
    this.para = function (runs, o) {
      o = o || {};
      var size = o.size || 10.5, lh = size * 1.32, indent = o.indent || 0, maxW = self.W() - indent;
      var lines = layout(runs, size, maxW);
      if (o.before && self.page) self.y -= o.before;
      if (!lines.length) { self.ensure(lh); self.y -= lh * 0.55; return; }
      lines.forEach(function (L, li) {
        var lsz = Math.max.apply(null, L.segs.map(function (s) { return s.size; }).concat([size])), llh = lsz * 1.32;
        self.ensure(llh);
        var x = self.m + indent;
        if (o.align === 'center') x = self.m + (self.W() - L.w) / 2; else if (o.align === 'right') x = self.m + self.W() - L.w;
        if (li === 0 && o.bullet) self.page.drawText(san(o.bullet), { x: x - (o.bulletW || 13), y: self.y - lsz, size: size, font: self.F.r, color: o.color || INK });
        L.segs.forEach(function (s) { if (s.t.trim()) self.page.drawText(s.t, { x: x, y: self.y - lsz, size: s.size, font: s.font, color: s.color || o.color || INK }); x += s.w; });
        self.y -= llh;
      });
      self.y -= (o.after != null ? o.after : size * 0.45);
    };
    this.image = function (img, wPt, hPt) {
      var maxW = self.W(), maxH = self.size[1] - 2 * self.m, w = wPt || img.width * 0.75, h = hPt || img.height * 0.75;
      var s = Math.min(1, maxW / w, maxH / h); w *= s; h *= s;
      self.ensure(h + 6); self.page.drawImage(img, { x: self.m, y: self.y - h, width: w, height: h }); self.y -= h + 8;
    };
    this.table = function (rows, o) {
      o = o || {}; if (!rows.length) return;
      var size = o.size || 9, pad = 3, n = Math.max.apply(null, rows.map(function (r) { return r.reduce(function (a, c) { return a + (c.span || 1); }, 0); }));
      var nat = []; for (var i = 0; i < n; i++) nat[i] = 3;
      rows.forEach(function (r) { var ci = 0; r.forEach(function (c) { if ((c.span || 1) === 1) { var len = Math.max.apply(null, String(c.text || '').split('\n').map(function (l) { return l.length; }).concat([0])); nat[ci] = Math.max(nat[ci], Math.min(len, 45)); } ci += c.span || 1; }); });
      var W0 = self.W(), widths, tot;
      for (var tries = 0; tries < 6; tries++) { widths = nat.map(function (x) { return x * size * 0.5 + 2 * pad + 2; }); tot = widths.reduce(function (a, b) { return a + b; }, 0); if (tot <= W0 || size <= 6) break; size = Math.max(6, size * 0.88); }
      var sc = (tot > W0 || o.expand) ? W0 / tot : 1; widths = widths.map(function (x) { return x * sc; });
      var lh = size * 1.25;
      rows.forEach(function (r, ri) {
        var ci = 0, cells = r.map(function (c) {
          var w = 0; for (var k = 0; k < (c.span || 1); k++) w += widths[ci + k] || 0;
          var runs = []; String(c.text || '').split('\n').forEach(function (l, li) { if (li) runs.push({ br: 1 }); runs.push({ t: l, b: c.b || (o.header && ri === 0) }); });
          var lines = self.layout(runs, size, Math.max(10, w - 2 * pad)); var cx = ci; ci += c.span || 1;
          return { lines: lines.slice(0, 40), w: w, ci: cx };
        });
        var h = Math.max(1, Math.max.apply(null, cells.map(function (c) { return c.lines.length; }))) * lh + 2 * pad;
        self.ensure(h);
        var x = self.m;
        cells.forEach(function (c) {
          x = self.m + widths.slice(0, c.ci).reduce(function (a, b) { return a + b; }, 0);
          self.page.drawRectangle({ x: x, y: self.y - h, width: c.w, height: h, borderColor: LINE, borderWidth: 0.5, color: o.header && ri === 0 ? HEAD : undefined });
          self.drawLines(self.page, c.lines, x + pad, self.y - pad, size, { lh: 1.25 });
        });
        self.y -= h;
      });
      self.y -= 8;
    };
  }
  function isPng(b) { return b[0] === 0x89 && b[1] === 0x50; }
  function isJpg(b) { return b[0] === 0xFF && b[1] === 0xD8; }
  async function toPng(bytes, type) {
    try {
      var bm = await createImageBitmap(new Blob([bytes], { type: type || '' })), c = D.createElement('canvas');
      c.width = bm.width; c.height = bm.height; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0);
      var b = await new Promise(function (r) { c.toBlob(r, 'image/png'); }); return new Uint8Array(await b.arrayBuffer());
    } catch (e) { return null; }
  }
  async function embedImg(doc, bytes, type) {
    try { if (isPng(bytes)) return await doc.embedPng(bytes); if (isJpg(bytes)) return await doc.embedJpg(bytes); } catch (e) {}
    var png = await toPng(bytes, type); if (!png) return null;
    try { return await doc.embedPng(png); } catch (e) { return null; }
  }
  function xmlDoc(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
  function kids(e) { return e ? Array.prototype.slice.call(e.children) : []; }
  function ch(e, n) { if (!e) return null; for (var i = 0; i < e.children.length; i++) if (e.children[i].localName === n) return e.children[i]; return null; }
  function desc(e, n) { return e ? Array.prototype.slice.call(e.getElementsByTagNameNS('*', n)) : []; }
  function wv(e) { return e ? (e.getAttribute('w:val') || e.getAttribute('val') || '') : ''; }
  function resolvePath(base, t) { if (!t) return ''; if (t[0] === '/') return t.slice(1); var p = base.split('/'); p.pop(); t.split('/').forEach(function (s) { if (s === '..') p.pop(); else if (s && s !== '.') p.push(s); }); return p.join('/'); }
  async function relsOf(z, part) {
    var p = part.split('/'), f = p.pop(), r = {}, x = z.file(p.concat(['_rels', f + '.rels']).join('/'));
    if (!x) return r;
    desc(xmlDoc(await x.async('string')), 'Relationship').forEach(function (e) { r[e.getAttribute('Id')] = e.getAttribute('TargetMode') === 'External' ? null : resolvePath(part, e.getAttribute('Target')); });
    return r;
  }
  function roman(n) { var v = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1], s = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'], o = ''; for (var i = 0; i < v.length; i++) while (n >= v[i]) { o += s[i]; n -= v[i]; } return o; }
  function fmtNum(n, f) { if (f === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1); if (f === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1); if (f === 'lowerRoman') return roman(n); if (f === 'upperRoman') return roman(n).toUpperCase(); return String(n); }

  /* ---------- Word (.docx) */
  async function docxToPdf(bytes) {
    var z = await JSZip.loadAsync(bytes), main = 'word/document.xml', mf = z.file(main);
    if (!mf) throw new Error('Geen Word-document');
    var x = xmlDoc(await mf.async('string')), rels = await relsOf(z, main);
    var numFmt = {}, nf = z.file('word/numbering.xml');
    if (nf) {
      var nx = xmlDoc(await nf.async('string')), abs = {};
      desc(nx, 'abstractNum').forEach(function (a) { var id = a.getAttribute('w:abstractNumId'); abs[id] = {}; kids(a).filter(function (l) { return l.localName === 'lvl'; }).forEach(function (l) { abs[id][l.getAttribute('w:ilvl')] = wv(ch(l, 'numFmt')); }); });
      desc(nx, 'num').forEach(function (n) { numFmt[n.getAttribute('w:numId')] = abs[wv(ch(n, 'abstractNumId'))] || {}; });
    }
    var styleNames = {}, sf = z.file('word/styles.xml');
    if (sf) desc(xmlDoc(await sf.async('string')), 'style').forEach(function (s) { styleNames[s.getAttribute('w:styleId')] = wv(ch(s, 'name')).toLowerCase(); });
    var ctx = await newDoc(), w = new Writer(ctx, A4, 62), counters = {};
    w.newPage();
    function on(rPr, n) { var e = ch(rPr, n); return !!e && !/^(0|false|off|none)$/i.test(wv(e)); }
    async function para(p) {
      var pPr = ch(p, 'pPr'), sid = wv(ch(pPr, 'pStyle')), sname = styleNames[sid] || sid.toLowerCase();
      if (pPr && on(pPr, 'pageBreakBefore')) w.newPage();
      var hm = /(heading|kop)\s*(\d)/.exec(sname), isTitle = /^(title|titel)$/.test(sname), bullet = null, indent = 0;
      var numPr = ch(pPr, 'numPr');
      if (numPr && wv(ch(numPr, 'numId')) !== '0') {
        var lvl = +(wv(ch(numPr, 'ilvl')) || 0), id = wv(ch(numPr, 'numId')), fmt = (numFmt[id] || {})[lvl] || 'bullet';
        indent = 18 + lvl * 16;
        if (fmt === 'bullet' || fmt === 'none') bullet = lvl % 2 ? '-' : '•';
        else { var k = id + ':' + lvl; counters[k] = (counters[k] || 0) + 1; Object.keys(counters).forEach(function (q) { var p2 = q.split(':'); if (p2[0] === id && +p2[1] > lvl) delete counters[q]; }); bullet = fmtNum(counters[k], fmt) + '.'; }
      } else if (/list/.test(sname)) { bullet = '•'; indent = 18; }
      var ind = ch(pPr, 'ind'); if (ind && !bullet) indent = Math.min(120, Math.max(0, (+(ind.getAttribute('w:left') || ind.getAttribute('w:start') || 0)) / 20));
      var jc = wv(ch(pPr, 'jc')), runs = [], imgs = [], pageBreak = false;
      (function walk(n) {
        kids(n).forEach(function (c) {
          var l = c.localName;
          if (l === 'r') {
            var rPr = ch(c, 'rPr'), b = on(rPr, 'b'), it = on(rPr, 'i'), szE = ch(rPr, 'sz'), sz = szE ? Math.min(30, (+wv(szE)) / 2 * 0.92) : null;
            kids(c).forEach(function (q) {
              var ql = q.localName;
              if (ql === 't') runs.push({ t: q.textContent, b: b, i: it, size: sz });
              else if (ql === 'tab') runs.push({ t: '    ' });
              else if (ql === 'br' || ql === 'cr') { if (q.getAttribute('w:type') === 'page') pageBreak = true; else runs.push({ br: 1 }); }
              else if (ql === 'sym') runs.push({ t: '•' });
              else if (ql === 'drawing' || ql === 'pict' || ql === 'object') {
                var bl = desc(q, 'blip')[0] || desc(q, 'imagedata')[0], ex = desc(q, 'extent')[0], rid = bl && (bl.getAttribute('r:embed') || bl.getAttribute('r:id'));
                if (rid) imgs.push({ id: rid, cx: ex ? +ex.getAttribute('cx') : 0, cy: ex ? +ex.getAttribute('cy') : 0 });
              }
            });
          } else if (/^(hyperlink|ins|smartTag|sdt|sdtContent|fldSimple|customXml|moveTo)$/.test(l)) walk(c);
        });
      })(p);
      var size = 10.5, o = { indent: indent, bullet: bullet, align: jc === 'center' ? 'center' : (jc === 'right' || jc === 'end') ? 'right' : '' };
      if (hm || isTitle) {
        var lv = isTitle ? 0 : +hm[2]; size = [20, 15, 12.5, 11.5, 11, 10.5][Math.min(lv, 5)];
        runs.forEach(function (r) { r.b = true; r.size = null; r.color = BLUE; }); o.before = lv <= 1 ? 10 : 6; o.after = 5;
      }
      o.size = size;
      if (runs.length || !imgs.length) w.para(runs, o);
      for (var i = 0; i < imgs.length; i++) {
        var path = rels[imgs[i].id], zf = path && z.file(path);
        if (!zf) continue;
        var img = await embedImg(ctx.doc, await zf.async('uint8array'), guessMime(path));
        if (img) w.image(img, imgs[i].cx ? imgs[i].cx / 12700 : 0, imgs[i].cy ? imgs[i].cy / 12700 : 0);
        else w.para([{ t: '[afbeelding: ' + path.split('/').pop() + ']', i: true, color: GREY }], { size: 9 });
      }
      if (pageBreak) w.newPage();
    }
    function table(t) {
      var rows = kids(t).filter(function (e) { return e.localName === 'tr'; }).map(function (tr) {
        return kids(tr).filter(function (e) { return e.localName === 'tc'; }).map(function (tc) {
          var tcPr = ch(tc, 'tcPr'), span = +(wv(ch(tcPr, 'gridSpan')) || 1);
          return { span: span, text: desc(tc, 'p').map(function (p) { return desc(p, 't').map(function (t) { return t.textContent; }).join(''); }).join('\n') };
        });
      });
      w.table(rows, { expand: true, size: 9 });
    }
    var body = desc(x, 'body')[0];
    var items = kids(body);
    for (var i = 0; i < items.length; i++) {
      var l = items[i].localName;
      if (l === 'p') await para(items[i]);
      else if (l === 'tbl') table(items[i]);
      else if (l === 'sdt') { items.splice.apply(items, [i + 1, 0].concat(kids(ch(items[i], 'sdtContent')))); }
    }
    return ctx.doc.save();
  }

  /* ---------- Excel (.xlsx) */
  async function xlsxToPdf(bytes) {
    var z = await JSZip.loadAsync(bytes), wbPath = 'xl/workbook.xml', wf = z.file(wbPath);
    if (!wf) throw new Error('Geen Excel-bestand');
    var wb = xmlDoc(await wf.async('string')), rels = await relsOf(z, wbPath), shared = [];
    var ssf = z.file('xl/sharedStrings.xml');
    if (ssf) desc(xmlDoc(await ssf.async('string')), 'si').forEach(function (si) { shared.push(kids(si).filter(function (e) { return e.localName !== 'rPh'; }).map(function (e) { return e.localName === 't' ? e.textContent : desc(e, 't').map(function (t) { return t.textContent; }).join(''); }).join('')); });
    var dateXf = {}, stf = z.file('xl/styles.xml');
    if (stf) {
      var sx = xmlDoc(await stf.async('string')), custom = {};
      desc(sx, 'numFmt').forEach(function (n) { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
      var cx = desc(sx, 'cellXfs')[0];
      kids(cx).forEach(function (xf, i) { var id = +xf.getAttribute('numFmtId'); if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (custom[id] && /[dmy]/i.test(custom[id].replace(/"[^"]*"|\[[^\]]*\]/g, '')))) dateXf[i] = id === 18 || id === 19 || id === 20 || id === 21 || id === 45 || id === 46 || id === 47 ? 'time' : 'date'; });
    }
    function colIdx(r) { var m = /^([A-Z]+)/.exec(r || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
    var ctx = await newDoc(), w = new Writer(ctx, A4L, 36), any = false;
    var sheets = desc(wb, 'sheet');
    for (var s = 0; s < sheets.length; s++) {
      var path = rels[sheets[s].getAttribute('r:id')], sfile = path && z.file(path);
      if (!sfile || /hidden/i.test(sheets[s].getAttribute('state') || '')) continue;
      var sh = xmlDoc(await sfile.async('string')), grid = [], maxC = 0;
      desc(sh, 'row').slice(0, 600).forEach(function (row) {
        var ri = +(row.getAttribute('r') || grid.length + 1) - 1, line = [];
        kids(row).forEach(function (c, k) {
          if (c.localName !== 'c') return;
          var ci = colIdx(c.getAttribute('r')); if (ci < 0) ci = k; if (ci > 40) return;
          var t = c.getAttribute('t'), v = ch(c, 'v'), val = v ? v.textContent : '';
          if (t === 's') val = shared[+val] || '';
          else if (t === 'inlineStr') val = desc(c, 't').map(function (e) { return e.textContent; }).join('');
          else if (t === 'b') val = val === '1' ? 'WAAR' : 'ONWAAR';
          else if (t !== 'str' && t !== 'e' && val !== '' && !isNaN(+val)) {
            var kind = dateXf[+c.getAttribute('s')];
            if (kind) { var d = new Date(Math.round((+val - 25569) * 864e5)); val = kind === 'time' && +val < 1 ? pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) : pad(d.getUTCDate()) + '-' + pad(d.getUTCMonth() + 1) + '-' + d.getUTCFullYear(); }
            else val = (+val).toLocaleString('nl-NL', { maximumFractionDigits: 4 });
          }
          if (val !== '') { line[ci] = val; maxC = Math.max(maxC, ci + 1); }
        });
        grid[ri] = line;
      });
      var rows = [];
      for (var r = 0; r < grid.length; r++) { var ln0 = grid[r] || []; if (!ln0.some(function (x) { return x; })) { if (rows.length) rows.push(null); continue; } var cells = []; for (var c2 = 0; c2 < maxC; c2++) cells.push({ text: ln0[c2] || '' }); rows.push(cells); }
      while (rows.length && rows[rows.length - 1] === null) rows.pop();
      rows = rows.map(function (r) { if (r) return r; var e = []; for (var c3 = 0; c3 < maxC; c3++) e.push({ text: '' }); return e; });
      if (!rows.length) continue;
      if (any) w.newPage(); else w.newPage();
      any = true;
      w.para([{ t: sheets[s].getAttribute('name'), b: true, color: BLUE }], { size: 13, after: 6 });
      w.table(rows, { header: true, size: 8.5 });
    }
    if (!any) { w.newPage(); w.para([{ t: 'Dit Excel-bestand bevat geen gegevens.', i: true }]); }
    return ctx.doc.save();
  }

  /* ---------- PowerPoint (.pptx): zie pptx-render.js */

  /* ---------- OpenDocument tekst (.odt) */
  async function odtToPdf(bytes) {
    var z = await JSZip.loadAsync(bytes), f = z.file('content.xml'); if (!f) throw new Error('Geen ODT');
    var x = xmlDoc(await f.async('string')), ctx = await newDoc(), w = new Writer(ctx); w.newPage();
    desc(x, 'text').forEach(function (body) {
      kids(body).forEach(function walk(e) {
        if (e.localName === 'h') w.para([{ t: e.textContent, b: true, color: BLUE }], { size: 14, before: 6 });
        else if (e.localName === 'p') w.para([{ t: e.textContent }]);
        else if (e.localName === 'list') desc(e, 'p').forEach(function (p) { w.para([{ t: p.textContent }], { bullet: '•', indent: 18 }); });
        else if (e.localName === 'table') w.table(desc(e, 'table-row').map(function (r) { return desc(r, 'table-cell').map(function (c) { return { text: c.textContent }; }); }), { expand: true });
        else if (e.localName === 'section') kids(e).forEach(walk);
      });
    });
    return ctx.doc.save();
  }
  function rtfText(s) {
    return s.replace(/\{\\\*[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '').replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, '')
      .replace(/\\par[d]?\b ?/g, '\n').replace(/\\line\b ?/g, '\n').replace(/\\tab\b ?/g, '\t').replace(/\\'([0-9a-f]{2})/gi, function (m, h) { return decodeText(new Uint8Array([parseInt(h, 16)]), 'windows-1252'); })
      .replace(/\\u(-?\d+)\??/g, function (m, n) { n = +n; return String.fromCharCode(n < 0 ? n + 65536 : n); }).replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  async function textToPdf(title, text, sub) {
    var ctx = await newDoc(), w = new Writer(ctx); w.newPage();
    if (title) w.para([{ t: title, b: true, color: BLUE }], { size: 14, after: sub ? 2 : 10 });
    if (sub) sub.forEach(function (l) { w.para([{ t: l, color: GREY }], { size: 9, after: 1 }); });
    if (sub) w.y -= 8;
    String(text || '').split(/\r?\n/).forEach(function (l) { w.para([{ t: l }], { size: 10, after: 1.5 }); });
    return ctx.doc.save();
  }
  async function imageToPdf(bytes, type) {
    var d = await PL.PDFDocument.create(), img = await embedImg(d, bytes, type);
    if (!img) throw new Error('Afbeelding kan niet worden gelezen');
    var w = img.width, h = img.height, land = w > h, P = land ? A4L : A4, m = 28, s = Math.min((P[0] - 2 * m) / w, (P[1] - 2 * m) / h, 1.5);
    var page = d.addPage(P); page.drawImage(img, { x: (P[0] - w * s) / 2, y: (P[1] - h * s) / 2, width: w * s, height: h * s });
    return d.save();
  }

  /* ---------- hoofdfunctie: bestand -> PDF */
  var CONVERTIBLE = /\.(pdf|docx|docm|dotx|xlsx|xlsm|pptx|pptm|ppsx|odt|rtf|txt|csv|md|log|xml|json|html?|eml|msg|png|jpe?g|gif|bmp|webp|svg)$/i;
  async function convertToPdf(name, type, blob) {
    var bytes = new Uint8Array(await blob.arrayBuffer()), ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf' || /pdf/.test(type) || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return { bytes: bytes, how: 'origineel' };
    var out;
    if (/^(docx|docm|dotx)$/.test(ext)) out = await docxToPdf(bytes);
    else if (/^(xlsx|xlsm)$/.test(ext)) out = await xlsxToPdf(bytes);
    else if (/^(pptx|pptm|ppsx)$/.test(ext)) out = await pptxToPdf(bytes);
    else if (ext === 'odt') out = await odtToPdf(bytes);
    else if (ext === 'rtf') out = await textToPdf(name, rtfText(decodeText(bytes, 'windows-1252')));
    else if (/^(png|jpe?g|gif|bmp|webp|svg)$/.test(ext) || /^image\//.test(type)) out = await imageToPdf(bytes, ext === 'svg' ? 'image/svg+xml' : type);
    else if (ext === 'eml' || ext === 'msg') {
      var mm = rd(bytes, 0) === 0xE011CFD0 ? parseMsg(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) : parseEml(bytes.buffer);
      out = await textToPdf(mm.subject || name, mm.text, [mm.from ? 'Van: ' + mm.from : '', mm.sent && !isNaN(mm.sent) ? 'Verzonden: ' + mm.sent.toLocaleString('nl-NL') : '', mm.attachments.length ? 'Bijlagen: ' + mm.attachments.map(function (a) { return a.name; }).join(', ') : ''].filter(Boolean));
    }
    else if (/^html?$/.test(ext)) out = await textToPdf(name, htmlToText(decodeText(bytes, 'utf-8')));
    else if (/^(txt|csv|md|log|xml|json)$/.test(ext) || /^text\//.test(type)) out = await textToPdf(name, decodeText(bytes, 'utf-8'));
    else return null;
    return { bytes: out, how: 'omgezet' };
  }

  /* ---------- aantekeningen in een PDF branden */
  function hexRgb(h) { var n = parseInt(String(h || '#000').slice(1), 16); return PL.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); }
  function drawShapes(page, shapes, font) {
    (shapes || []).forEach(function (s) {
      try {
        if (s.t === 'mark') {
          s.rects.forEach(function (r) { var opt = { x: r[0], y: r[1], width: r[2] - r[0], height: r[3] - r[1], color: hexRgb(s.c), opacity: 0.42 }; if (PL.BlendMode) opt.blendMode = PL.BlendMode.Multiply; page.drawRectangle(opt); });
        } else if (s.t === 'pen' || s.t === 'hl') {
          var d = s.pts.map(function (q, k) { return (k ? 'L' : 'M') + q[0] + ' ' + (-q[1]); }).join(' ');
          if (s.pts.length === 1) d += ' L' + (s.pts[0][0] + 0.1) + ' ' + (-s.pts[0][1]);
          page.drawSvgPath(d, { x: 0, y: 0, borderColor: hexRgb(s.c), borderWidth: s.w, borderOpacity: s.t === 'hl' ? 0.38 : 1, borderLineCap: PL.LineCapStyle.Round });
        } else if (s.t === 'text') {
          String(s.txt).split('\n').forEach(function (line, k) { if (line.trim()) page.drawText(san(line), { x: s.x, y: s.y - s.s * (0.9 + k * 1.2), size: s.s, font: font, color: hexRgb(s.c) }); });
        }
      } catch (e) { console.error(e); }
    });
  }
  function wrapLines(t, font, size, w) {
    var out = [];
    String(t).split('\n').forEach(function (par) {
      var line = '';
      san(par).split(/(\s+)/).forEach(function (tk) {
        if (!tk) return; var cand = line + tk;
        if (font.widthOfTextAtSize(cand.replace(/\s+$/, ''), size) > w && line.trim()) { out.push(line.replace(/\s+$/, '')); line = /^\s+$/.test(tk) ? '' : tk; }
        else line = cand;
        while (font.widthOfTextAtSize(line, size) > w && line.length > 1) { var k = line.length; while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > w) k--; out.push(line.slice(0, k)); line = line.slice(k); }
      });
      out.push(line.replace(/\s+$/, ''));
    });
    return out;
  }
  function drawPageAnn(page, shapes, font) {
    shapes = shapes || [];
    var notes = shapes.filter(function (s) { return s.t === 'note' || s.t === 'text'; });
    drawShapes(page, shapes.filter(function (s) { return !(s.t === 'note' || s.t === 'text'); }), font);
    if (!notes.length) return;
    var rot = ((page.getRotation().angle || 0) % 360 + 360) % 360, mb = page.getMediaBox(), M = 170, size = 9, lh = 10.8, bw = M - 18;
    if (rot !== 0) { notes.forEach(function (s) { wrapLines(s.txt, font, size, 160).forEach(function (l, k) { page.drawText(l, { x: s.x, y: s.y - size * (1 + k * 1.2), size: size, font: font, color: hexRgb(s.c || '#e8590c') }); }); }); return; }
    var R = mb.x + mb.width;
    page.setMediaBox(mb.x, mb.y, mb.width + M, mb.height);
    try { var cb = page.getCropBox(); page.setCropBox(cb.x, cb.y, cb.width + M + (R - (cb.x + cb.width)), cb.height); } catch (e) {}
    page.drawRectangle({ x: R, y: mb.y, width: M, height: mb.height, color: PL.rgb(1, 1, 1) });
    page.drawLine({ start: { x: R, y: mb.y }, end: { x: R, y: mb.y + mb.height }, thickness: 0.5, color: LINE });
    var boxes = notes.map(function (s) { var lines = wrapLines(s.txt, font, size, bw - 10); return { s: s, lines: lines, h: lines.length * lh + 7 }; }).sort(function (a, b) { return b.s.y - a.s.y; });
    var prevBottom = mb.y + mb.height - 4;
    boxes.forEach(function (b) {
      var top = Math.min(b.s.y + 9, prevBottom), x0 = R + 10, col = hexRgb(b.s.c || '#e8590c');
      page.drawRectangle({ x: x0, y: top - b.h, width: bw, height: b.h, color: PL.rgb(1, 0.985, 0.92) });
      page.drawRectangle({ x: x0, y: top - b.h, width: 2.2, height: b.h, color: col });
      b.lines.forEach(function (l, k) { if (l) page.drawText(l, { x: x0 + 6, y: top - 3.5 - size * 0.86 - k * lh, size: size, font: font, color: INK }); });
      var cy = top - 8, gx = R + 4, wy = b.s.w ? b.s.w[1] - 0.8 : b.s.y, ax = b.s.w ? b.s.w[2] : b.s.x, ay = wy;
      if (b.s.w) page.drawLine({ start: { x: b.s.w[0], y: wy }, end: { x: b.s.w[2], y: wy }, thickness: 1.1, color: col });
      [[x0, cy, gx, cy], [gx, cy, gx, wy], [gx, wy, ax + 1.5, wy]].forEach(function (sg) { page.drawLine({ start: { x: sg[0], y: sg[1] }, end: { x: sg[2], y: sg[3] }, thickness: 0.6, color: col, opacity: 0.85, dashArray: [2.5, 1.8] }); });
      var ang = Math.PI, L = 5, wA = 0.5;
      var p1 = [ax - L * Math.cos(ang - wA), ay - L * Math.sin(ang - wA)], p2 = [ax - L * Math.cos(ang + wA), ay - L * Math.sin(ang + wA)];
      page.drawSvgPath('M' + ax + ' ' + (-ay) + ' L' + p1[0] + ' ' + (-p1[1]) + ' L' + p2[0] + ' ' + (-p2[1]) + ' Z', { x: 0, y: 0, color: col });
      prevBottom = top - b.h - 5;
    });
  }
  async function burnAnnotations(bytes, ann) {
    var d = await PL.PDFDocument.load(bytes, { ignoreEncryption: true }), f = await d.embedFont(PL.StandardFonts.Helvetica), pages = d.getPages();
    Object.keys(ann || {}).forEach(function (k) { var pg = pages[+k - 1]; if (pg) drawPageAnn(pg, ann[k], f); });
    return d.save();
  }

  /* ---------- vergadering -> één PDF */
  function pdfStr(t) { return PL.PDFHexString.fromText(t); }
  function addOutline(doc, items) {
    if (!items.length) return;
    var ctxp = doc.context, root = ctxp.nextRef(), refs = items.map(function () { return ctxp.nextRef(); });
    items.forEach(function (it, i) {
      var d = { Title: pdfStr(it.title), Parent: root, Dest: [it.page.ref, PL.PDFName.of('Fit')] };
      if (i > 0) d.Prev = refs[i - 1]; if (i < items.length - 1) d.Next = refs[i + 1];
      ctxp.assign(refs[i], ctxp.obj(d));
    });
    ctxp.assign(root, ctxp.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: items.length }));
    doc.catalog.set(PL.PDFName.of('Outlines'), root);
    doc.catalog.set(PL.PDFName.of('PageMode'), PL.PDFName.of('UseOutlines'));
  }
  async function buildCover(m, items, startPage) {
    var ctx = await newDoc(), w = new Writer(ctx, A4, 60); w.newPage();
    w.para([{ t: 'AGENDA', b: true, color: GREY }], { size: 9, after: 4 });
    w.para([{ t: m.title || 'Vergadering', b: true, color: BLUE }], { size: 22, after: 4 });
    w.y -= 10;
    var meta = [['Datum', m.date ? fmtLong(m.date) : '—'], ['Tijd', m.start ? m.start + (m.end ? ' – ' + m.end : '') : '—'], ['Locatie', m.location], ['Voorzitter', names(m.invitees)[0] || m.chair], ['Leden', names(m.invitees).slice(1).join(', ')]].filter(function (r) { return r[1]; });
    meta.forEach(function (r) {
      var lines = w.layout([{ t: r[1] }], 11, w.W() - 100), h = Math.max(1, lines.length) * 14.5;
      w.ensure(h); w.page.drawText(r[0], { x: w.m, y: w.y - 11, size: 10, font: ctx.F.b, color: GREY }); w.drawLines(w.page, lines, w.m + 100, w.y, 11, { lh: 1.32 }); w.y -= h + 3;
    });
    w.y -= 10; w.para([{ t: 'Stukken', b: true, color: BLUE }], { size: 12.5, after: 6 });
    if (!items.length) w.para([{ t: 'Geen stukken.', i: true, color: GREY }]);
    items.forEach(function (it, i) {
      var label = (i + 1) + '.  ' + it.f.name, pg = startPage ? 'p. ' + startPage[i] : '', pw = ctx.F.r.widthOfTextAtSize(pg, 10.5);
      var lines = w.layout([{ t: label }], 10.5, w.W() - pw - 30), h = Math.max(1, lines.length) * 14;
      w.ensure(h + 4);
      w.drawLines(w.page, lines, w.m, w.y, 10.5, { lh: 1.33 });
      if (pg) w.page.drawText(pg, { x: w.m + w.W() - pw, y: w.y - 10.5, size: 10.5, font: ctx.F.r, color: GREY });
      var tag = !it.bytes ? 'niet opgenomen' : annCount(it.ann) ? 'met aantekeningen' : it.how === 'omgezet' ? 'omgezet naar PDF' : '';
      if (tag) w.page.drawText(tag, { x: w.m + w.W() - pw - 90, y: w.y - 10, size: 7.5, font: ctx.F.i, color: GREY });
      w.y -= h + 4;
      w.page.drawLine({ start: { x: w.m, y: w.y + 2 }, end: { x: w.m + w.W(), y: w.y + 2 }, thickness: 0.4, color: LINE });
    });
    w.y -= 14; w.para([{ t: 'Samengesteld met MeMeet op ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }), i: true, color: GREY }], { size: 8 });
    return ctx.doc;
  }
  async function mergeMeeting(m, items, progress) {
    var out = await PL.PDFDocument.create(), fr = await out.embedFont(PL.StandardFonts.Helvetica), fb = await out.embedFont(PL.StandardFonts.HelveticaBold);
    out.setTitle((m.title || 'Vergadering') + (m.date ? ' – ' + fmtShort(m.date) : '')); out.setCreator('MeMeet'); out.setProducer('MeMeet');
    for (var i = 0; i < items.length; i++) {
      progress && progress(i + 1, items.length);
      var it = items[i]; it.pages = null;
      if (!it.bytes) continue;
      try { var src = await PL.PDFDocument.load(it.bytes, { ignoreEncryption: true, updateMetadata: false }); it.pages = await out.copyPages(src, src.getPageIndices()); }
      catch (e) { console.error(e); it.pages = null; it.err = 'beveiligd of beschadigd'; }
    }
    var cover1 = await buildCover(m, items, null), coverN = cover1.getPageCount(), p = coverN + 1, starts = [];
    items.forEach(function (it) { starts.push(p); p += it.pages ? it.pages.length : 1; });
    var cover = await buildCover(m, items, starts);
    if (cover.getPageCount() !== coverN) { coverN = cover.getPageCount(); p = coverN + 1; starts = []; items.forEach(function (it) { starts.push(p); p += it.pages ? it.pages.length : 1; }); cover = await buildCover(m, items, starts); }
    var total = p - 1, outline = [], cp = await out.copyPages(cover, cover.getPageIndices());
    cp.forEach(function (pg, k) { out.addPage(pg); if (!k) outline.push({ title: 'Agenda', page: pg }); });
    items.forEach(function (it, i) {
      var label = 'Stuk ' + (i + 1) + ' · ' + it.f.name;
      if (!it.pages) {
        var ph = out.addPage(A4);
        ph.drawText(san(label), { x: 60, y: 760, size: 14, font: fb, color: BLUE });
        ph.drawText(san('Dit stuk kon niet in de PDF worden opgenomen' + (it.err ? ' (' + it.err + ')' : ' (bestandstype wordt niet ondersteund)') + '.'), { x: 60, y: 735, size: 10.5, font: fr, color: INK });
        ph.drawText('Open het origineel vanuit MeMeet.', { x: 60, y: 718, size: 10.5, font: fr, color: INK });
        outline.push({ title: (i + 1) + '. ' + it.f.name, page: ph });
        return;
      }
      it.pages.forEach(function (pg, k) {
        out.addPage(pg);
        if (it.ann && it.ann[k + 1]) drawPageAnn(pg, it.ann[k + 1], fr);
        if (!k) outline.push({ title: (i + 1) + '. ' + it.f.name, page: pg });
        try {
          if ((pg.getRotation().angle || 0) % 360 !== 0) return;
          var mb = pg.getMediaBox(), t = san(label).slice(0, 90), tw = fr.widthOfTextAtSize(t, 7);
          pg.drawText(t, { x: mb.x + mb.width - tw - 18, y: mb.y + mb.height - 14, size: 7, font: fr, color: GREY });
          var pn = 'pagina ' + (starts[i] + k) + ' van ' + total; pg.drawText(pn, { x: mb.x + (mb.width - fr.widthOfTextAtSize(pn, 7)) / 2, y: mb.y + 8, size: 7, font: fr, color: GREY });
        } catch (e) {}
      });
    });
    addOutline(out, outline);
    return out.save();
  }
