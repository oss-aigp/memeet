  /* ================================================================== Viewer: weergave in de eigen opmaak (HTML)
     Word (.docx) met docx-preview (Apache-2.0): pagina's met lettertypes, kleuren, arcering, tabellen, kop- en voetteksten.
     Excel (.xlsx, .xlsm) en CSV als raster met tabbladen (de rasterweergave van MeMeet, alleen lezen). Tekst als tekst, een mail
     met afzender, onderwerp, bijlagen en tekst. PDF, PowerPoint en afbeeldingen gaan via pdf.js (zie pvShow).
     Markeringen en opmerkingen op deze weergave worden bewaard als tekstanker (het fragment met wat tekst ervoor en erna), niet als
     HTML: f.hann = [{ id, t: 'mark'|'note', q, pre, suf, txt }]. */
  function hvKind(f) {
    var n = String(f.name || '').toLowerCase();
    if (f.pdf && f.conv === 'vervangen') return null; /* een eigen PDF-versie die je erbij hebt gezet: die tonen */
    if (/\.docx$/.test(n)) return 'docx';
    if (/\.(xlsx|xlsm)$/.test(n)) return 'xlsx';
    if (/\.(txt|md|log|json|xml|csv)$/.test(n)) return 'text';
    if (/\.(eml|msg)$/.test(n)) return 'mail';
    return null;
  }
  var HV = { zoom: 1, fit: true, hits: [], hi: -1 };
  /* links uit een document alleen naar het web of mail, in een nieuw tabblad (nooit javascript: of iets anders) */
  function hvSafeLinks(root) {
    $$('a', root).forEach(function (a) { var h = a.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else if (!/^#/.test(h)) a.removeAttribute('href'); });
  }
  /* bouwt de weergave van een bestand in de eigen opmaak op in 'doc' (gooit een fout als dat niet lukt) */
  async function hvRender(doc, f, blob) {
    var kind = hvKind(f);
    if (kind === 'docx') {
      doc.textContent = '';
      await W.docx.renderAsync(blob, doc, doc, { className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true, renderComments: false, renderChanges: false, renderAltChunks: false, experimental: false, useBase64URL: true });
      hvSafeLinks(doc);
    } else if (kind === 'xlsx') {
      var ed = await XlsxEditor(blob, function () {});
      doc.textContent = ''; doc.appendChild(ed.el); if (ed.init) ed.init();
      /* alleen lezen */
      $$('[contenteditable]', doc).forEach(function (e) { e.setAttribute('contenteditable', 'false'); });
      $$('input,textarea', doc).forEach(function (e) { e.readOnly = true; });
      doc.classList.add('hvxl');
    } else if (kind === 'text') {
      var t = (await blob.text()).replace(/^﻿/, '');
      setHTML(doc, '<pre class="hvtext"></pre>'); $('.hvtext', doc).textContent = t;
    } else if (kind === 'mail') {
      var mm = await readMail(blob, f.name), sent = mm.sent && !isNaN(mm.sent) ? mm.sent.toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) : '';
      var atts = (mm.attachments || []).filter(function (a) { return !a.inline; }).map(function (a) { return a.name; });
      setHTML(doc, '<div class="hvmail"><h2></h2><div class="hvmh"></div>' + (atts.length ? '<div class="hvatt"></div>' : '') + '<div class="hvbody"></div></div>');
      $('.hvmail h2', doc).textContent = mm.subject || '(geen onderwerp)';
      $('.hvmh', doc).textContent = [mm.from ? 'Van: ' + mm.from : '', sent].filter(Boolean).join(' · ');
      if (atts.length) $('.hvatt', doc).textContent = 'Bijlagen: ' + atts.join(', ');
      $('.hvbody', doc).textContent = String(mm.text || '').trim();
    }
  }
  async function hvShow(m, f, tok, editable, blob) {
    var pvp = $('#pvp'); if (!pvp) return;
    PV.html = true; PV.m = m; PV.f = f; PV.editable = editable; PV.pages = null; HV.zoom = HV.zoom || 1; HV.hits = []; HV.hi = -1;
    setHTML(pvp, '<div class="hv" id="hv"><div class="hvdoc" id="hvdoc"><div class="pvmsg">Stuk wordt klaargemaakt…</div></div><div class="hvrail" id="hvrail" hidden></div></div>');
    var doc = $('#hvdoc');
    try {
      await hvRender(doc, f, blob);
    } catch (e) { console.error(e); if (tok !== PV.tok) return; setHTML(doc, '<div class="pvmsg">Dit bestand kan de viewer niet tonen (' + esc(e.message || e) + ').<br><button type="button" class="btn" id="pvorig">' + ic('download') + ' Downloaden</button></div>'); var po = $('#pvorig'); if (po) po.onclick = function () { pvAct('orig', m, A.sel ? A.sel.i : 0); }; return; }
    if (tok !== PV.tok) return;
    if (HV.fit) hvFit(); else hvApplyZoom();
    requestAnimationFrame(function () { if (tok === PV.tok && HV.fit) { hvFit(); hvPlaceNotes(); } });
    if (editable && !f.hann) f.hann = [];
    hvDrawAnn();
    hvBind(pvp);
    if (PV.q) hvSearch(PV.q);
  }
  /* passend: een Word-pagina zo groot dat hij precies in de kolom past (niet groter dan 100%) */
  function hvFit() {
    var pvp = $('#pvp'), doc = $('#hvdoc'), sec = doc && $('section.docx', doc), rail = $('#hvrail');
    HV.zoom = 1;
    if (sec && pvp) { var avail = pvp.clientWidth - 22 - (rail && !rail.hidden ? 222 : 0); HV.zoom = Math.max(0.4, Math.min(1, Math.floor(avail / sec.offsetWidth * 100) / 100)); }
    hvApplyZoom();
  }
  function hvApplyZoom() { var d = $('#hvdoc'), z = $('#pvz'); if (d) d.style.zoom = HV.zoom; if (z) z.textContent = Math.round(HV.zoom * 100) + '%'; }
  function hvAct(a) {
    if (a === 'zin') { HV.fit = false; HV.zoom = Math.min(3, Math.round(HV.zoom * 1.15 * 100) / 100); }
    else if (a === 'zout') { HV.fit = false; HV.zoom = Math.max(0.4, Math.round(HV.zoom / 1.15 * 100) / 100); }
    else if (a === 'fit') { HV.fit = true; hvFit(); hvPlaceNotes(); return; }
    else if (a === 'qnext' || a === 'qprev') { var qi = $('#pvq'); if (qi && qi.value !== PV.q) return hvSearch(qi.value); return hvGoto(HV.hi + (a === 'qnext' ? 1 : -1)); }
    hvApplyZoom(); hvPlaceNotes();
  }

  /* ---------- tekstanker: de tekst van het document als één reeks, met de plek van elke tekstknoop */
  function hvTextNodes(root) {
    var out = [], pos = 0, w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; return p && /^(SCRIPT|STYLE)$/.test(p.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n;
    while ((n = w.nextNode())) { out.push({ n: n, s: pos }); pos += n.nodeValue.length; }
    return { nodes: out, text: out.map(function (x) { return x.n.nodeValue; }).join('') };
  }
  function hvOffset(tn, node, off) {
    for (var i = 0; i < tn.nodes.length; i++) if (tn.nodes[i].n === node) return tn.nodes[i].s + off;
    /* een element als grens: de eerste tekstknoop vanaf die plek */
    if (node.nodeType === 1) {
      var k = node.childNodes[off] || null;
      for (var j = 0; j < tn.nodes.length; j++) {
        var x = tn.nodes[j].n;
        if (k ? (k === x || k.contains(x) || (k.compareDocumentPosition(x) & 4)) : (!node.contains(x) && (node.compareDocumentPosition(x) & 4))) return tn.nodes[j].s;
      }
      return tn.text.length;
    }
    return -1;
  }
  function hvAnchorOf(rg) {
    var doc = $('#hvdoc'), tn = hvTextNodes(doc), s = hvOffset(tn, rg.startContainer, rg.startOffset), e = hvOffset(tn, rg.endContainer, rg.endOffset);
    if (s < 0 || e <= s) return null;
    return { q: tn.text.slice(s, e), pre: tn.text.slice(Math.max(0, s - 32), s), suf: tn.text.slice(e, e + 32) };
  }
  /* de plek van een anker terugvinden: de keer dat het fragment voorkomt met de best passende tekst ervoor en erna */
  function hvFind(tn, a) {
    var best = -1, bestScore = -1, i = tn.text.indexOf(a.q);
    while (i >= 0) {
      var sc = 0, pre = tn.text.slice(Math.max(0, i - a.pre.length), i), suf = tn.text.slice(i + a.q.length, i + a.q.length + a.suf.length);
      for (var k = 1; k <= Math.min(pre.length, a.pre.length) && pre[pre.length - k] === a.pre[a.pre.length - k]; k++) sc++;
      for (var j = 0; j < Math.min(suf.length, a.suf.length) && suf[j] === a.suf[j]; j++) sc++;
      if (sc > bestScore) { bestScore = sc; best = i; }
      i = tn.text.indexOf(a.q, i + 1);
    }
    return best;
  }
  /* tekst van s tot e omwikkelen met <mark>, per tekstknoop */
  function hvWrap(tn, s, e, cls, id) {
    var made = [];
    tn.nodes.forEach(function (x) {
      var ns = x.s, ne = x.s + x.n.nodeValue.length; if (ne <= s || ns >= e) return;
      var a = Math.max(s, ns) - ns, b = Math.min(e, ne) - ns, node = x.n;
      if (!node.nodeValue.slice(a, b).trim() && b - a < node.nodeValue.length) return;
      if (b < node.nodeValue.length) node.splitText(b);
      var mid = a > 0 ? node.splitText(a) : node;
      var mk = D.createElement('mark'); mk.className = cls; if (id) mk.dataset.a = id;
      mid.parentNode.insertBefore(mk, mid); mk.appendChild(mid); made.push(mk);
    });
    return made;
  }
  function hvUnwrap(sel) { $$(sel, $('#hvdoc')).forEach(function (mk) { var p = mk.parentNode; while (mk.firstChild) p.insertBefore(mk.firstChild, mk); p.removeChild(mk); p.normalize(); }); }

  /* ---------- markeringen en opmerkingen tekenen */
  function hvDrawAnn() {
    var doc = $('#hvdoc'), f = PV.f; if (!doc || !f) return;
    hvUnwrap('mark.hl,mark.cm');
    (f.hann || []).forEach(function (a) { var tn = hvTextNodes(doc), at = hvFind(tn, a); if (at >= 0) hvWrap(tn, at, at + a.q.length, a.t === 'note' ? 'cm' : 'hl', a.id); });
    hvPlaceNotes(); hvCount();
  }
  function hvCount() { var el = $('#pvnc'); if (!el) return; var n = (PV.f && PV.f.hann || []).filter(function (a) { return a.t === 'note'; }).length; el.hidden = !n; el.textContent = n + ' opmerking' + (n === 1 ? '' : 'en'); }
  function hvSave() { clearTimeout(HV.st); var st = $('#pvst'); if (st) { st.textContent = '…'; st.title = 'Bezig met opslaan'; } HV.st = setTimeout(async function () { PV.m.updated = new Date().toISOString(); await persist(); var s2 = $('#pvst'); if (s2) { setHTML(s2, ic('check')); s2.title = 'Opgeslagen'; } }, 500); }
  /* de briefjes in de kantlijn, op de hoogte van hun tekst */
  function hvPlaceNotes(focusId) {
    var rail = $('#hvrail'), hv = $('#hv'), f = PV.f; if (!rail || !hv || !f) return;
    var notes = (f.hann || []).filter(function (a) { return a.t === 'note'; });
    rail.hidden = !notes.length && !focusId; rail.textContent = '';
    var hr = hv.getBoundingClientRect(), last = -999;
    notes.forEach(function (a) {
      var mk = $('mark.cm[data-a="' + a.id + '"]', hv); if (!mk) return;
      var top = Math.max(mk.getBoundingClientRect().top - hr.top + hv.scrollTop, last + 6);
      var box = D.createElement('div'); box.className = 'hvnote'; box.dataset.a = a.id; box.style.top = top + 'px';
      var x = D.createElement('button'); x.type = 'button'; x.className = 'hvnx'; x.title = 'Opmerking verwijderen'; x.setAttribute('aria-label', 'Opmerking verwijderen'); x.appendChild(icEl('close'));
      var ta = D.createElement('textarea'); ta.value = a.txt || ''; ta.placeholder = 'Typ je opmerking…'; ta.setAttribute('aria-label', 'Opmerking');
      box.appendChild(x); box.appendChild(ta); rail.appendChild(box);
      function fit() { ta.style.height = 'auto'; ta.style.height = Math.max(40, ta.scrollHeight) + 'px'; } fit();
      last = top + box.offsetHeight;
      ta.addEventListener('input', function () { a.txt = ta.value; fit(); hvSave(); });
      ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') ta.blur(); });
      ta.addEventListener('focus', function () { $$('mark.cm[data-a="' + a.id + '"]', hv).forEach(function (m0) { m0.classList.add('on'); }); });
      ta.addEventListener('blur', function () { $$('mark.cm[data-a="' + a.id + '"]', hv).forEach(function (m0) { m0.classList.remove('on'); }); if (!ta.value.trim()) { f.hann = f.hann.filter(function (b) { return b !== a; }); hvDrawAnn(); } hvSave(); });
      x.onclick = function () { f.hann = f.hann.filter(function (b) { return b !== a; }); hvDrawAnn(); hvSave(); };
      if (focusId === a.id) ta.focus();
    });
  }
  /* ---------- tekst selecteren: markeren, opmerking of meeneempunt; klik op een markering: weghalen */
  function hvBind(pvp) {
    pvp.addEventListener('mouseup', function (e) {
      if (!PV.html || e.target.closest('.seltb,.hvnote')) return;
      setTimeout(function () {
        var sel = W.getSelection(), doc = $('#hvdoc'); if (!doc) return;
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          var mk = e.target.closest && e.target.closest('mark.hl,mark.cm');
          if (mk && PV.editable) {
            if (mk.classList.contains('cm')) { var b = $('.hvnote[data-a="' + mk.dataset.a + '"] textarea'); if (b) b.focus(); return; }
            selTb(e.clientX, e.clientY, [[ic('ink_eraser') + ' Markering weghalen', function () { PV.f.hann = PV.f.hann.filter(function (a) { return a.id !== mk.dataset.a; }); hvDrawAnn(); hvSave(); }]]);
          }
          return;
        }
        var rg = sel.getRangeAt(0); if (!doc.contains(rg.commonAncestorContainer)) return;
        var txt = String(sel).replace(/\s+/g, ' ').trim(); if (txt.length < 3) return;
        var an = PV.editable ? hvAnchorOf(rg) : null;
        var btns = [];
        if (an) {
          btns.push(['<span class="sw"></span>Markeren', function () { an.id = 'h' + uid(); an.t = 'mark'; PV.f.hann.push(an); W.getSelection().removeAllRanges(); hvDrawAnn(); hvSave(); }]);
          btns.push([ic('add_comment') + ' Opmerking', function () { an.id = 'h' + uid(); an.t = 'note'; an.txt = ''; PV.f.hann.push(an); W.getSelection().removeAllRanges(); hvDrawAnn(); hvPlaceNotes(an.id); }]);
        }
        btns.push([ic('add') + ' Meeneempunt', function () { W.getSelection().removeAllRanges(); selToPoint(txt); }]);
        selTb(e.clientX, e.clientY, btns);
      }, 0);
    });
    pvp.addEventListener('scroll', killSelTb);
    pvp.addEventListener('mousedown', function (e) { if (!e.target.closest('.seltb')) killSelTb(); });
  }
  /* ---------- zoeken in deze weergave */
  function hvSearch(q) {
    PV.q = q; hvUnwrap('mark.hit'); HV.hits = []; HV.hi = -1;
    var doc = $('#hvdoc'), qc = $('#pvqc'); if (!doc) return;
    var needle = String(q || '').trim().toLowerCase();
    if (needle.length >= 2) {
      var tn = hvTextNodes(doc), low = tn.text.toLowerCase(), i = low.indexOf(needle), spans = [];
      while (i >= 0 && spans.length < 500) { spans.push(i); i = low.indexOf(needle, i + needle.length); }
      spans.reverse().forEach(function (s) { var t2 = hvTextNodes(doc); var made = hvWrap(t2, s, s + needle.length, 'hit'); if (made[0]) HV.hits.unshift(made[0]); });
    }
    if (qc) qc.textContent = needle.length >= 2 ? (HV.hits.length ? '' : '0') : '';
    if (HV.hits.length) hvGoto(0);
    hvPlaceNotes();
  }
  function hvGoto(i) {
    if (!HV.hits.length) return; HV.hi = (i + HV.hits.length) % HV.hits.length;
    HV.hits.forEach(function (h, k) { h.classList.toggle('cur', k === HV.hi); });
    HV.hits[HV.hi].scrollIntoView({ block: 'center' });
    var qc = $('#pvqc'); if (qc) qc.textContent = (HV.hi + 1) + '/' + HV.hits.length;
  }
