  /* MeMeet - pdfview: de viewer voor PDF en PowerPoint (pdf.js), met markeren, opmerkingen en zoeken */
  /* ------------------------------------------------------------- viewer met aantekeningen (pdf.js) */
  var PV = { tok: 0, markColor: '#ffd400', noteColor: '#e8590c', scale: 1, fit: true, q: '' };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MARGIN = 170;
  function isNote(s) { return s.t === 'note' || s.t === 'text'; }
  function hasNotes(ann) { return Object.keys(ann || {}).some(function (k) { return (ann[k] || []).some(isNote); }); }
  async function draftPdf(f) { if (f._pdf === undefined) { var r = await convertToPdf(f.name, f.type, f.blob); f._pdf = r ? new Blob([r.bytes], { type: 'application/pdf' }) : null; } return f._pdf; }
  function maxLabel() { return A.pvMax ? 'Verkleinen (Esc)' : ($('.ws.n3') ? 'Vergroten: de viewer neemt de kolom met stukken over, je aantekeningen blijven zichtbaar' : 'Vergroten tot volledig venster'); }
  /* in een vergadering met aantekeningen: de viewer neemt de kolom met stukken over; anders het hele venster */
  function applyMax(el) { var ws = $('.ws.n3'), on = !!A.pvMax; if (ws) { ws.classList.toggle('pvwide', on); el.classList.remove('max'); } else el.classList.toggle('max', on); }
  function maxBtn() { return '<button type="button" class="tl mx' + (A.pvMax ? ' on' : '') + '" data-act="max" title="' + maxLabel() + '" aria-label="' + maxLabel() + '">' + maxInner() + '</button>'; }
  function maxInner() { return ic(A.pvMax ? 'close_fullscreen' : 'open_in_full') + '<span class="mxl">' + (A.pvMax ? 'Verkleinen' : 'Vergroten') + '</span>'; }
  function pvMax(on) {
    var el = $('#pv'); A.pvMax = !!on; if (!el) return;
    applyMax(el);
    var b = $('[data-act=max]', el); if (b) { b.classList.toggle('on', A.pvMax); b.title = maxLabel(); b.setAttribute('aria-label', maxLabel()); setHTML(b, maxInner()); }
    requestAnimationFrame(function () { if (PV.html && $('#hvdoc')) { if (HV.fit) hvFit(); hvPlaceNotes(); return; } if (PV.fit && $('#pvp') && PV.pages) { layoutPages(); if (PV.q) doSearch(PV.q); } });
  }
  /* Ingescande PDF's gebruiken vaak CCITT-fax, JBIG2 of JPEG 2000 voor de pagina-afbeelding. pdf.js pakt die uit met WebAssembly
     (jbig2.wasm, openjpeg.wasm). Die bestanden zitten in MeMeet zelf en worden hier aan pdf.js gegeven, zonder netwerkverkeer. */
  var PDFJS_WASM = __PDFJS_WASM__;
  function EmbeddedBinaryData() {}
  EmbeddedBinaryData.prototype.fetch = function (q) {
    var d = q && q.kind === 'wasmUrl' ? PDFJS_WASM[q.filename] : null;
    return d ? Promise.resolve(b64(d)) : Promise.reject(new Error('Niet meegeleverd in MeMeet: ' + (q && q.filename)));
  };
  function pdfOpts(data) { return { data: data, isEvalSupported: false, wasmUrl: 'memeet-wasm/', useWorkerFetch: false, BinaryDataFactory: EmbeddedBinaryData }; }
  async function pvShow(m, i) {
    var el = $('#pv'); if (!el) return;
    applyMax(el);
    var isNew = !!m.isNew, list = isNew ? (m.pending || []) : m.files, f = list[i];
    if (A.edCtl && A.edCtl.isDirty() && !confirm('Je hebt wijzigingen in het bestand die nog niet zijn opgeslagen. Weggooien?')) return;
    A.edCtl = null;
    if (!A.sel || A.sel.id !== m.id || A.sel.i !== i) PV.q = '';
    var tok = ++PV.tok;
    A.sel = { id: m.id, i: i };
    $$('#docs li[data-sel]').forEach(function (li) { li.classList.toggle('on', +li.dataset.sel === i); });
    if (PV.pdf) { try { PV.pdf.destroy(); } catch (e) {} PV.pdf = null; }
    if (PV.io) { PV.io.disconnect(); PV.io = null; }
    PV.pages = null; PV.hits = []; PV.hi = -1;
    if (!f) { setHTML(el, '<div class="pvmsg">Nog geen stukken.<br><small>Sleep documenten of een mail naar dit venster.</small></div>'); return; }
    /* De viewer toont elk stuk in zijn eigen opmaak, zonder werkbalk vol gereedschap: alleen zoomen, zoeken, downloaden (het
       originele bestand) en vergroten. Markeren, opmerkingen en meeneempunten gaan via het menuutje bij geselecteerde tekst.
       Bewerken gebeurt in het tabblad Bestanden. */
    var editable = !isNew;
    var hb = '<div class="pvbar one simple"><b class="pvname" title="' + esc(f.name) + '">' + esc(f.name) + '</b><span class="pvst" id="pvst"></span><span class="pvnc" id="pvnc" hidden></span><span class="sp"></span>';
    hb += '<button type="button" class="tl" data-act="zout" title="Uitzoomen" aria-label="Uitzoomen">' + ic('zoom_out') + '</button><button type="button" class="tl zl" data-act="fit" id="pvz" title="Passend maken">100%</button><button type="button" class="tl" data-act="zin" title="Inzoomen" aria-label="Inzoomen">' + ic('zoom_in') + '</button>';
    hb += '<span class="srch"><input id="pvq" type="search" placeholder="Zoeken (Ctrl+F)" aria-label="Zoeken in het stuk" value="' + esc(PV.q) + '"><span id="pvqc" class="qc"></span><button type="button" class="tl" data-act="qprev" title="Vorige (Shift+Enter)" aria-label="Vorige treffer">' + ic('keyboard_arrow_up') + '</button><button type="button" class="tl" data-act="qnext" title="Volgende (Enter)" aria-label="Volgende treffer">' + ic('keyboard_arrow_down') + '</button></span>';
    hb += '<button type="button" class="tl" data-act="orig" title="Downloaden (het originele bestand)" aria-label="Downloaden">' + ic('download') + '</button>' + maxBtn() + '</div>';
    hb += '<div class="pvpages" id="pvp"><div class="pvmsg">Stuk wordt klaargemaakt…</div></div>';
    setHTML(el, hb);
    $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); pvAct(b.dataset.act, m, i); }; });
    var qi = $('#pvq'), qt;
    qi.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { doSearch(qi.value); }, 250); });
    qi.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); if (PV.q !== qi.value) doSearch(qi.value); else gotoHit(PV.hi + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') { qi.value = ''; doSearch(''); } });
    /* Word, Excel, tekst en mail in hun eigen opmaak (hview.js); PDF, PowerPoint en afbeeldingen via pdf.js */
    if (hvKind(f)) { var hb0 = null; try { hb0 = isNew ? f.blob : await A.store.get(m, f.name); } catch (e) { console.error(e); } if (tok !== PV.tok) return; if (hb0) { await hvShow(m, f, tok, editable, hb0); return; } }
    PV.html = false;
    var blob = null; try { blob = isNew ? await draftPdf(f) : await getPdf(m, f); } catch (e) { console.error(e); }
    if (tok !== PV.tok) return;
    var pvp = $('#pvp');
    if (!blob) { setHTML(pvp, '<div class="pvmsg">Dit bestand kan de viewer niet tonen.<br><small>Download het origineel om het te openen. Of sla het in Word of Excel op als PDF en sleep die PDF op deze vergadering: dan toont de viewer die.</small><br><button type="button" class="btn" id="pvorig">Origineel downloaden</button></div>'); $('#pvorig').onclick = function () { pvAct('orig', m, i); }; return; }
    var data = new Uint8Array(await blob.arrayBuffer()), pdf;
    try { pdf = await W.pdfjsLib.getDocument(pdfOpts(data.slice())).promise; }
    catch (e) { console.error(e); if (tok === PV.tok) setHTML(pvp, '<div class="pvmsg">Deze PDF kan niet worden getoond (' + esc(e.message || e) + ').<br><button type="button" class="btn" id="pvtab">Openen in nieuw tabblad</button></div>'); var pt = $('#pvtab'); if (pt) pt.onclick = function () { pvAct('tab', m, i); }; return; }
    if (tok !== PV.tok) { pdf.destroy(); return; }
    if (editable && !f.ann) f.ann = {};
    PV.pdf = pdf; PV.m = m; PV.f = f; PV.ann = editable ? f.ann : {}; PV.editable = editable; PV.undo = []; PV.redo = []; PV.pages = [];
    for (var n = 1; n <= pdf.numPages; n++) { var pg = await pdf.getPage(n); if (tok !== PV.tok) return; PV.pages.push({ n: n, page: pg }); }
    bindPvp(pvp);
    layoutPages(); undoBtns(); noteCount();
    if (PV.q) doSearch(PV.q);
  }

  /* ---------- pagina's opbouwen: canvas + tekstlaag + aantekeningen + marge */
  function layoutPages() {
    var box = $('#pvp'); if (!box || !PV.pages) return;
    var keep = box.scrollHeight ? box.scrollTop / box.scrollHeight : 0, keepX = box.scrollWidth > box.clientWidth ? (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth : -1, tok = PV.tok;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (PV.io) PV.io.disconnect();
    PV.margin = PV.editable && (hasNotes(PV.ann) || !!PV.wantMrg);
    var M = PV.margin ? MARGIN : 0, maxW = Math.max.apply(null, PV.pages.map(function (p) { return p.page.getViewport({ scale: 1 }).width; }));
    if (PV.fit) PV.scale = Math.max(0.3, Math.min(3, (box.clientWidth - 36) / (maxW + M)));
    var z = $('#pvz'); if (z) z.textContent = Math.round(PV.scale * 100) + '%';
    PV.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) renderPage(e.target._p); }); }, { root: box, rootMargin: '800px 0px' });
    PV.pages.forEach(function (p) {
      if (p.task) { try { p.task.cancel(); } catch (e) {} p.task = null; }
      p.vp = p.page.getViewport({ scale: PV.scale }); p.rendered = false; p.tl = null; p.tlp = null;
      var mw = M * PV.scale, W0 = p.vp.width, H0 = p.vp.height;
      var wrap = D.createElement('div'); wrap.className = 'pgw'; wrap.style.width = (W0 + mw) + 'px'; wrap.style.height = H0 + 'px'; wrap._p = p;
      var pg = D.createElement('div'); pg.className = 'pg'; pg.style.width = W0 + 'px'; pg.style.height = H0 + 'px';
      pg.style.setProperty('--scale-factor', PV.scale); pg.style.setProperty('--total-scale-factor', PV.scale); pg.style.setProperty('--scale-round-x', '1px'); pg.style.setProperty('--scale-round-y', '1px');
      var cv = D.createElement('canvas'); cv.style.width = W0 + 'px'; cv.style.height = H0 + 'px'; pg.appendChild(cv);
      var tl = D.createElement('div'); tl.className = 'textLayer'; pg.appendChild(tl);
      wrap.appendChild(pg);
      if (mw) { var mg = D.createElement('div'); mg.className = 'mrg'; mg.style.left = W0 + 'px'; mg.style.width = mw + 'px'; wrap.appendChild(mg); p.mrg = mg; } else p.mrg = null;
      var svg = D.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + (W0 + mw) + ' ' + H0); svg.setAttribute('class', 'anl'); svg.style.width = (W0 + mw) + 'px'; svg.style.height = H0 + 'px';
      wrap.appendChild(svg);
      var lbl = D.createElement('div'); lbl.className = 'pgn'; lbl.style.left = (W0 - 40) + 'px'; lbl.textContent = p.n + ' / ' + PV.pages.length; wrap.appendChild(lbl);
      p.wrap = wrap; p.el = pg; p.cv = cv; p.svg = svg; p.tlDiv = tl; box.appendChild(wrap); PV.io.observe(wrap);
      if (PV.editable) bindPage(p);
    });
    box.scrollTop = keep * box.scrollHeight;
    box.scrollLeft = keepX < 0 ? (box.scrollWidth - box.clientWidth) / 2 : keepX * box.scrollWidth - box.clientWidth / 2;
    PV.pages.forEach(function (p) { drawAnn(p); });
    (async function () { for (var k = 0; k < PV.pages.length; k++) { if (tok !== PV.tok || !PV.pages) return; await ensureText(PV.pages[k]); } })();
  }
  function renderPage(p) {
    if (p.rendered) return; p.rendered = true;
    var dpr = Math.min(2, W.devicePixelRatio || 1);
    p.cv.width = Math.floor(p.vp.width * dpr); p.cv.height = Math.floor(p.vp.height * dpr);
    p.task = p.page.render({ canvasContext: p.cv.getContext('2d'), canvas: p.cv, viewport: p.vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    p.task.promise.catch(function () {});
  }
  function ensureText(p) {
    if (p.tlp) return p.tlp;
    var vp = p.vp, div = p.tlDiv;
    p.tlp = (async function () {
      var tc = p.tc || (p.tc = await p.page.getTextContent());
      if (p.vp !== vp) return;
      var tl = new W.pdfjsLib.TextLayer({ textContentSource: tc, container: div, viewport: vp });
      await tl.render();
      if (p.vp !== vp) return;
      p.tl = tl; p.strs = tl.textContentItemsStr.slice(); p.divs = tl.textDivs;
      applyHits(p);
    })().catch(function (e) { console.error(e); });
    return p.tlp;
  }

  /* ---------- zoeken */
  function normS(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s[i], n = c.normalize('NFD')[0].toLowerCase(); o += n.length === 1 ? n : c; } return o; }
  async function doSearch(q) {
    if (PV.html) return hvSearch(q);
    PV.q = q; PV.hits = []; PV.hi = -1;
    var cnt = $('#pvqc'); if (!PV.pages) return;
    var nq = normS(q.trim());
    if (!nq) { PV.pages.forEach(applyHits); if (cnt) cnt.textContent = ''; return; }
    if (cnt) cnt.textContent = '…';
    var tok = PV.tok;
    for (var k = 0; k < PV.pages.length; k++) await ensureText(PV.pages[k]);
    if (tok !== PV.tok || PV.q !== q) return;
    PV.pages.forEach(function (p) {
      if (!p.strs) return;
      var full = '', st = [];
      p.strs.forEach(function (s) { st.push(full.length); full += s; });
      p.starts = st;
      var hay = normS(full), at = 0, ix;
      while ((ix = hay.indexOf(nq, at)) >= 0) { PV.hits.push({ p: p, s: ix, e: ix + nq.length }); at = ix + nq.length; }
    });
    PV.pages.forEach(applyHits);
    if (cnt) cnt.textContent = PV.hits.length ? '' : 'geen';
    if (PV.hits.length) gotoHit(0);
  }
  function applyHits(p) {
    if (!p.divs) return;
    p.divs.forEach(function (d, k) { if (d._hl) { d.textContent = p.strs[k]; d._hl = false; } });
    var hits = (PV.hits || []).map(function (h, idx) { return { h: h, idx: idx }; }).filter(function (x) { return x.h.p === p; });
    if (!hits.length || !p.starts) return;
    var per = {};
    hits.forEach(function (x) {
      for (var k = 0; k < p.strs.length; k++) {
        var a = p.starts[k], b = a + p.strs[k].length;
        if (b <= x.h.s || a >= x.h.e) continue;
        (per[k] = per[k] || []).push([Math.max(0, x.h.s - a), Math.min(b, x.h.e) - a, x.idx]);
      }
    });
    Object.keys(per).forEach(function (k) {
      var d = p.divs[+k], s = p.strs[+k], pos = 0; if (!d) return;
      d.textContent = ''; d._hl = true;
      per[k].sort(function (u, v) { return u[0] - v[0]; }).forEach(function (seg) {
        if (seg[0] > pos) d.appendChild(D.createTextNode(s.slice(pos, seg[0])));
        var sp = D.createElement('span'); sp.className = 'hit' + (seg[2] === PV.hi ? ' cur' : ''); sp.dataset.h = seg[2]; sp.textContent = s.slice(seg[0], seg[1]); d.appendChild(sp); pos = seg[1];
      });
      if (pos < s.length) d.appendChild(D.createTextNode(s.slice(pos)));
    });
  }
  function gotoHit(i) {
    if (PV.html) return hvGoto(i);
    var n = PV.hits.length, cnt = $('#pvqc'); if (!n) return;
    PV.hi = ((i % n) + n) % n;
    $$('#pvp .hit.cur').forEach(function (e) { e.classList.remove('cur'); });
    var els = $$('#pvp .hit[data-h="' + PV.hi + '"]');
    els.forEach(function (e) { e.classList.add('cur'); });
    if (cnt) cnt.textContent = (PV.hi + 1) + '/' + n;
    var h = PV.hits[PV.hi]; renderPage(h.p);
    if (els[0]) els[0].scrollIntoView({ block: 'center', inline: 'nearest' }); else h.p.wrap.scrollIntoView({ block: 'start' });
  }

  /* ---------- aantekeningen tekenen */
  function toVp(p, x, y) { return p.vp.convertToViewportPoint(x, y); }
  function shapeEl(p, s, i) {
    var g = D.createElementNS(SVGNS, 'g'); g.setAttribute('data-i', i);
    if (s.t === 'mark') {
      s.rects.forEach(function (r) {
        var a = toVp(p, r[0], r[1]), b = toVp(p, r[2], r[3]), rc = D.createElementNS(SVGNS, 'rect');
        rc.setAttribute('x', Math.min(a[0], b[0])); rc.setAttribute('y', Math.min(a[1], b[1])); rc.setAttribute('width', Math.abs(b[0] - a[0])); rc.setAttribute('height', Math.abs(b[1] - a[1]));
        rc.setAttribute('fill', s.c); rc.setAttribute('class', 'mk'); g.appendChild(rc);
      });
    } else if (s.t === 'pen' || s.t === 'hl') {
      var d = s.pts.map(function (q, k) { var v = toVp(p, q[0], q[1]); return (k ? 'L' : 'M') + v[0].toFixed(1) + ' ' + v[1].toFixed(1); }).join(' ');
      if (s.pts.length === 1) d += ' l0.1 0';
      var hit = D.createElementNS(SVGNS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hitp'); hit.setAttribute('stroke-width', Math.max(12, s.w * PV.scale)); g.appendChild(hit);
      var path = D.createElementNS(SVGNS, 'path'); path.setAttribute('d', d); path.setAttribute('stroke', s.c); path.setAttribute('stroke-width', s.w * PV.scale); path.setAttribute('class', s.t === 'hl' ? 'hl' : 'pen'); g.appendChild(path);
    }
    return g;
  }
  function drawAnn(p) {
    var svg = p.svg; while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (p.mrg) p.mrg.textContent = '';
    var notes = [];
    (PV.ann[p.n] || []).forEach(function (s, i) { if (isNote(s)) notes.push({ s: s, i: i }); else svg.appendChild(shapeEl(p, s, i)); });
    if (!notes.length || !p.mrg) return;
    var fs = 9 * PV.scale, W0 = p.vp.width;
    notes.forEach(function (n) {
      var v = toVp(p, n.s.x, n.s.y); n.ax = v[0]; n.ay = v[1];
      if (n.s.w) { var w1 = toVp(p, n.s.w[0], n.s.w[1]), w2 = toVp(p, n.s.w[2], n.s.w[3]); n.wx1 = Math.min(w1[0], w2[0]); n.wx2 = Math.max(w1[0], w2[0]); n.wy = Math.max(w1[1], w2[1]) + 1; n.ay = n.wy; n.ax = n.wx2; }
      var bx = D.createElement('div'); bx.className = 'nbox'; bx.style.fontSize = fs + 'px'; bx.style.borderLeftColor = n.s.c || PV.noteColor; bx.dataset.i = n.i;
      var tx = D.createElement('div'); tx.className = 'ntx'; tx.textContent = n.s.txt; bx.appendChild(tx);
      if (PV.editable) { var x = D.createElement('button'); x.type = 'button'; x.className = 'nx'; x.title = 'Opmerking verwijderen'; x.appendChild(icEl('close')); bx.appendChild(x); x.onclick = function (e) { e.stopPropagation(); commit(p, function (arr) { arr.splice(n.i, 1); }); }; }
      bx.addEventListener('click', function () { if (PV.editable) noteEditor(p, n.i, null); });
      bx.addEventListener('mouseenter', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.add('on'); });
      bx.addEventListener('mouseleave', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.remove('on'); });
      p.mrg.appendChild(bx); n.el = bx;
    });
    notes.sort(function (a, b) { return a.ay - b.ay; });
    var prev = 4;
    notes.forEach(function (n) {
      var top = Math.max(n.ay - 9 * PV.scale, prev); n.el.style.top = top + 'px'; prev = top + n.el.offsetHeight + 6;
      var y = top + 8 * PV.scale, x0 = W0 + 10, gx = W0 + 5, col = n.s.c || PV.noteColor, path = D.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + x0 + ' ' + y + ' L' + gx + ' ' + y + ' L' + gx + ' ' + n.ay + ' L' + (n.ax + 2) + ' ' + n.ay);
      if (n.wx1 != null) { var ul = D.createElementNS(SVGNS, 'path'); ul.setAttribute('d', 'M' + n.wx1 + ' ' + n.wy + ' L' + n.wx2 + ' ' + n.wy); ul.setAttribute('class', 'uline'); ul.setAttribute('stroke', col); svg.appendChild(ul); }
      path.setAttribute('class', 'conn'); path.setAttribute('stroke', n.s.c || PV.noteColor); path.setAttribute('data-n', n.i);
      svg.appendChild(path);
      var ang = Math.PI, L = 6, wA = 0.5, ah = D.createElementNS(SVGNS, 'path');
      ah.setAttribute('d', 'M' + n.ax + ' ' + n.ay + ' L' + (n.ax - L * Math.cos(ang - wA)) + ' ' + (n.ay - L * Math.sin(ang - wA)) + ' L' + (n.ax - L * Math.cos(ang + wA)) + ' ' + (n.ay - L * Math.sin(ang + wA)) + ' Z');
      ah.setAttribute('fill', n.s.c || PV.noteColor); ah.setAttribute('class', 'arrow'); svg.appendChild(ah);
    });
  }
  function snapshot() { PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); PV.redo = []; undoBtns(); }
  function undoBtns() { var u = $('#pv [data-act=undo]'), r = $('#pv [data-act=redo]'); if (u) u.disabled = !PV.editable || !(PV.undo && PV.undo.length); if (r) r.disabled = !PV.editable || !(PV.redo && PV.redo.length); }
  function restoreAnn(st) { var prev = JSON.parse(st); Object.keys(PV.ann).forEach(function (k) { delete PV.ann[k]; }); Object.keys(prev).forEach(function (k) { PV.ann[k] = prev[k]; }); layoutPages(); changed(); undoBtns(); }
  function changed() {
    var st = $('#pvst'); if (st) { st.textContent = '…'; st.title = 'Bezig met opslaan'; }
    clearTimeout(PV.saveT);
    var m = PV.m;
    PV.saveT = setTimeout(async function () {
      try { m.updated = new Date().toISOString(); await persist(); var s2 = $('#pvst'); if (s2) { setHTML(s2, ic('check')); s2.title = 'Aantekeningen in het stuk opgeslagen'; } refreshAnnBadge(); noteCount(); }
      catch (e) { toast('Aantekeningen opslaan mislukt: ' + (e.message || e), 'err'); }
    }, 600);
  }
  function refreshAnnBadge() {
    if (!A.sel) return; var li = $('#docs li[data-sel="' + A.sel.i + '"] .dl2'); if (!li) return;
    var b = $('.bdg.ann', li), n = annCount(PV.ann);
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = D.createElement('span'); b.className = 'bdg ann'; b.title = 'Aantekeningen'; li.insertBefore(b, $('.sp', li)); }
    b.textContent = ''; b.appendChild(icEl('edit_note')); b.appendChild(D.createTextNode(' ' + n));
  }
  function commit(p, fn) {
    snapshot(); var arr = PV.ann[p.n] || (PV.ann[p.n] = []); fn(arr); if (!arr.length) delete PV.ann[p.n];
    var needM = PV.editable && (hasNotes(PV.ann) || !!PV.wantMrg);
    if (needM !== !!PV.margin) layoutPages(); else drawAnn(p);
    changed();
  }

  /* ---------- interactie: markeren (uit selectie), opmerkingen, gum */
  /* een tekstselectie omzetten naar rechthoeken (PDF-coördinaten) per pagina; regels op dezelfde hoogte samengevoegd */
  function selRects(rg) {
    var rects = Array.prototype.slice.call(rg.getClientRects()), out = [];
    PV.pages.forEach(function (p) {
      if (!p.tl) return;
      var pr = p.el.getBoundingClientRect(), list = [];
      rects.forEach(function (r) {
        if (r.width < 1 || r.height < 1 || r.height > pr.height * 0.12) return;
        if (r.right < pr.left || r.left > pr.right || r.bottom < pr.top || r.top > pr.bottom) return;
        var a = p.vp.convertToPdfPoint(r.left - pr.left, r.top - pr.top), b = p.vp.convertToPdfPoint(r.right - pr.left, r.bottom - pr.top);
        list.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
      });
      if (!list.length) return;
      list.sort(function (u, v) { return v[1] - u[1] || u[0] - v[0]; });
      var merged = [];
      list.forEach(function (r) { var l = merged[merged.length - 1]; if (l && Math.abs(l[1] - r[1]) < 2 && Math.abs(l[3] - r[3]) < 2 && r[0] <= l[2] + 2) { l[2] = Math.max(l[2], r[2]); l[0] = Math.min(l[0], r[0]); } else merged.push(r.slice()); });
      out.push({ p: p, rects: merged.map(function (r) { return r.map(function (v) { return Math.round(v * 10) / 10; }); }) });
    });
    return out;
  }
  function markSel(rg, color) {
    var made = false;
    selRects(rg).forEach(function (x) { commit(x.p, function (arr) { arr.push({ t: 'mark', c: color || PV.markColor, rects: x.rects }); }); made = true; });
    return made;
  }
  /* de kleine werkbalk bij een tekstselectie: markeren, opmerking of meeneempunt (en bij een markering: weghalen) */
  function killSelTb() { var o = $('.seltb'); if (o) o.remove(); }
  function selTb(x, y, btns) {
    killSelTb(); var box = $('#pvp'); if (!box) return;
    var r = box.getBoundingClientRect(), b = D.createElement('div'); b.className = 'seltb'; b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', 'Selectie');
    btns.forEach(function (x0) { var e = D.createElement('button'); e.type = 'button'; setHTML(e, x0[0]); e.onmousedown = function (ev) { ev.preventDefault(); }; e.onclick = function () { killSelTb(); x0[1](); }; b.appendChild(e); });
    box.appendChild(b);
    b.style.left = Math.max(4, Math.min(x - r.left + box.scrollLeft - 20, box.scrollLeft + box.clientWidth - b.offsetWidth - 6)) + 'px';
    b.style.top = (y - r.top + box.scrollTop + 12) + 'px';
  }
  /* een meeneempunt van de geselecteerde tekst: "> tekst" onderaan de aantekeningen, met de cursor direct na "> " */
  function selToPoint(txt) {
    var t = txt.length > 140 ? txt.slice(0, 137).replace(/\s+\S*$/, '') + '…' : txt, m = PV.m, ta = $('#npt');
    if (!m) return;
    var cur = ta ? ta.value : String(m.minutes || ''), pre = cur && !/\n$/.test(cur) ? '\n' : '', nv = cur + pre + '> ' + t, caret = cur.length + pre.length + 2;
    if (ta) { ta.value = nv; ta.focus(); ta.setSelectionRange(caret, caret); ta.dispatchEvent(new Event('input')); ta.scrollTop = ta.scrollHeight; }
    else { m.minutes = nv; delete m.minutesHtml; saveMinutes(m); }
    toast('Toegevoegd aan je aantekeningen. Typ er nog een naam of “Overleg:” voor.', 'ok');
  }
  function bindPvp(box) {
    box.addEventListener('mouseup', function (e) {
      if (!PV.editable || e.target.closest('.seltb,.nbox,.nedit')) return;
      setTimeout(function () {
        var sel = W.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) { return; }
        var rg = sel.getRangeAt(0);
        var txt = String(sel).replace(/\s+/g, ' ').trim(); if (txt.length < 3 || !selRects(rg).length) return;
        var rg2 = rg.cloneRange();
        selTb(e.clientX, e.clientY, [
          ['<span class="sw"></span>Markeren', function () { markSel(rg2); W.getSelection().removeAllRanges(); }],
          [ic('add_comment') + ' Opmerking', function () {
            var xs = selRects(rg2); if (!xs.length) return; var x = xs[0], r0 = x.rects[0];
            W.getSelection().removeAllRanges(); PV.wantMrg = true; if (!x.p.mrg) layoutPages(); PV.wantMrg = false; noteEditor(PV.pages[x.p.n - 1], -1, [r0[2], r0[1]], r0);
          }],
          [ic('add') + ' Meeneempunt', function () { W.getSelection().removeAllRanges(); selToPoint(txt); }]
        ]);
      }, 0);
    });
    box.addEventListener('scroll', killSelTb);
    box.addEventListener('mousedown', function (e) { if (!e.target.closest('.seltb')) killSelTb(); });
  }
  /* aantal opmerkingen in dit stuk, in de werkbalk van de viewer */
  function noteCount() {
    var el = $('#pvnc'); if (!el) return;
    var n = Object.keys(PV.ann || {}).reduce(function (a, k) { return a + (PV.ann[k] || []).filter(isNote).length; }, 0);
    el.hidden = !n; el.textContent = n + ' opmerking' + (n === 1 ? '' : 'en');
  }
  function bindPage(p) {
    p.el.addEventListener('click', function (e) {
      if (PV.editable && e.button === 0) {
        var s0 = W.getSelection(); if (s0 && !s0.isCollapsed) return;
        var r0 = p.el.getBoundingClientRect(), q0 = p.vp.convertToPdfPoint(e.clientX - r0.left, e.clientY - r0.top), arr0 = PV.ann[p.n] || [], hit = -1;
        arr0.forEach(function (s, i) { if (s.t === 'mark' && (s.rects || []).some(function (rc) { return q0[0] >= rc[0] - 1 && q0[0] <= rc[2] + 1 && q0[1] >= rc[1] - 1 && q0[1] <= rc[3] + 1; })) hit = i; });
        if (hit >= 0) selTb(e.clientX, e.clientY, [[ic('ink_eraser') + ' Markering weghalen', function () { commit(p, function (arr) { arr.splice(hit, 1); }); }]]);
        return;
      }
    });
  }
  function noteEditor(p, idx, at, wr) {
    if (!p.mrg) { layoutPages(); p = PV.pages[p.n - 1]; if (!p.mrg) return; }
    var old = idx >= 0 ? PV.ann[p.n][idx] : null, anchor = old ? toVp(p, old.x, old.y) : toVp(p, at[0], at[1]);
    var ta = D.createElement('textarea'); ta.className = 'nedit'; ta.value = old ? old.txt : ''; ta.placeholder = 'Typ je opmerking… (Ctrl+Enter = klaar)';
    ta.style.fontSize = 9 * PV.scale + 'px'; ta.style.top = Math.max(4, anchor[1] - 9 * PV.scale) + 'px'; ta.style.borderLeftColor = old ? old.c : PV.noteColor;
    if (old) { var bx = p.mrg.querySelector('.nbox[data-i="' + idx + '"]'); if (bx) { ta.style.top = bx.style.top; bx.style.visibility = 'hidden'; } }
    p.mrg.appendChild(ta);
    var tmp = null;
    if (!old) { tmp = D.createElementNS(SVGNS, 'circle'); tmp.setAttribute('cx', anchor[0]); tmp.setAttribute('cy', anchor[1]); tmp.setAttribute('r', 3); tmp.setAttribute('fill', PV.noteColor); p.svg.appendChild(tmp); }
    ta.focus();
    var done = false;
    function finish(save) {
      if (done) return; done = true; var txt = ta.value.replace(/\s+$/, ''); ta.remove(); if (tmp) tmp.remove();
      if (!save) { drawAnn(p); return; }
      if (old) commit(p, function (arr) { if (txt) { var o = { t: 'note', c: old.c || PV.noteColor, x: old.x, y: old.y, txt: txt }; if (old.w) o.w = old.w; arr[idx] = o; } else arr.splice(idx, 1); });
      else if (txt) commit(p, function (arr) { var o = { t: 'note', c: PV.noteColor, x: at[0], y: at[1], txt: txt }; if (wr) o.w = wr; arr.push(o); });
    }
    ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') finish(false); else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true); });
    ta.addEventListener('blur', function () { finish(true); });
    ta.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  async function pvAct(a, m, i) {
    var list = m.isNew ? m.pending : m.files, f = list[i];
    if (PV.html && /^(zin|zout|fit|qnext|qprev)$/.test(a)) return hvAct(a);
    if (a === 'max') return pvMax(!A.pvMax);
    if (a === 'qnext' || a === 'qprev') { var qi = $('#pvq'); if (qi && qi.value !== PV.q) return doSearch(qi.value); return gotoHit(PV.hi + (a === 'qnext' ? 1 : -1)); }
    if (a === 'zin' || a === 'zout') { PV.fit = false; PV.scale = Math.max(0.3, Math.min(4, PV.scale * (a === 'zin' ? 1.2 : 1 / 1.2))); layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'fit') { PV.fit = true; layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'undo') { if (!PV.undo || !PV.undo.length) return; (PV.redo = PV.redo || []).push(JSON.stringify(PV.ann)); if (PV.redo.length > 20) PV.redo.shift(); restoreAnn(PV.undo.pop()); return; }
    if (a === 'redo') { if (!PV.redo || !PV.redo.length) return; PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); restoreAnn(PV.redo.pop()); return; }
    if (a === 'orig') { dl(m.isNew ? f.blob : await A.store.get(m, f.name), f.name); return; }
  }
  function initPv() {
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('.seltb') && !e.defaultPrevented && !$('.dlgbg')) { e.preventDefault(); killSelTb(); return; }
      if (e.key === 'Escape' && A.pvMax && $('#pv') && !e.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') && !e.target.isContentEditable) { e.preventDefault(); pvMax(false); return; }
      if (!$('#pv') || !PV.pages) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { var qi = $('#pvq'); if (qi) { e.preventDefault(); qi.focus(); qi.select(); } return; }
      if (!PV.editable || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable) return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ((k === 'z' && e.shiftKey) || k === 'y')) { e.preventDefault(); pvAct('redo', PV.m, A.sel ? A.sel.i : 0); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); pvAct('undo', PV.m, A.sel ? A.sel.i : 0); }
    });
    var rt; W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (PV.html && $('#hvdoc')) { if (HV.fit) hvFit(); hvPlaceNotes(); return; } if (PV.fit && $('#pvp') && PV.pages) { layoutPages(); if (PV.q) doSearch(PV.q); } }, 200); });
  }
