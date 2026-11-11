  /* ================================================================== originele bestanden bewerken (Word / Excel / PowerPoint / tekst) */
  var EDIT_EXT = /\.(docx|xlsx|pptx|txt|csv|md)$/i;
  function canEdit(f) { return EDIT_EXT.test(f.name || ''); }
  var XMLNS = 'http://www.w3.org/XML/1998/namespace', UNDO_MAX = 20;
  function ser(x) { return new XMLSerializer().serializeToString(x); }
  function el2(tag, cls, txt) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(label, title, cls) { var b = el2('button', 'rb' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (title) b.title = title; b.addEventListener('mousedown', function (e) { e.preventDefault(); }); return b; }
  function sepEl() { return el2('span', 'rsep'); }
  function blockText(div) {
    var o = '';
    (function walk(n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) o += c.nodeValue; else if (c.nodeName === 'BR') o += '\n'; else if (c.nodeType === 1 && !c.classList.contains('lockimg')) { if (c.nodeName === 'DIV' && o && !/\n$/.test(o)) o += '\n'; walk(c); } } })(div);
    return o.replace(/ /g, ' ').replace(/\n$/, '');
  }
  function plainPaste(root) {
    root.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || W.clipboardData).getData('text/plain'); D.execCommand('insertText', false, t); });
    root.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) return; e.preventDefault(); });
  }
  function insertOrdered(parent, el, order) {
    var ix = order.indexOf(el.localName), kids0 = kids(parent);
    for (var i = 0; i < kids0.length; i++) { var j = order.indexOf(kids0[i].localName); if (j > ix || j < 0 && ix >= 0 && false) { parent.insertBefore(el, kids0[i]); return el; } }
    parent.appendChild(el); return el;
  }
  var RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
  var PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
  /* eenvoudige ongedaan-maken-stapel (max. 20) op basis van momentopnamen */
  function History(get, set, onChange) {
    var und = [], red = [], last = 0, lastKind = '';
    function push(kind) { var now = Date.now(); if (kind && kind === lastKind && now - last < 900) { last = now; return; } und.push(get()); if (und.length > UNDO_MAX) und.shift(); red = []; last = now; lastKind = kind || ''; onChange(); }
    return {
      push: push,
      undo: function () { if (!und.length) return; red.push(get()); if (red.length > UNDO_MAX) red.shift(); set(und.pop()); lastKind = ''; onChange(); },
      redo: function () { if (!red.length) return; und.push(get()); if (und.length > UNDO_MAX) und.shift(); set(red.pop()); lastKind = ''; onChange(); },
      canUndo: function () { return und.length > 0; }, canRedo: function () { return red.length > 0; }
    };
  }
  function caretPath(root) {
    var s = W.getSelection(); if (!s.rangeCount || !root.contains(s.anchorNode)) return null;
    var blocks = Array.prototype.slice.call(root.querySelectorAll('[data-i],[data-k]')), b = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement; b = b && b.closest('[data-i],[data-k]');
    var bi = blocks.indexOf(b); if (bi < 0) return null;
    var r = D.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset); return [bi, r.toString().length];
  }
  function setCaretPath(root, cp) {
    if (!cp) return; var b = root.querySelectorAll('[data-i],[data-k]')[cp[0]]; if (!b) return;
    var tw = D.createTreeWalker(b, NodeFilter.SHOW_TEXT), n, left = cp[1];
    while ((n = tw.nextNode())) { if (left <= n.nodeValue.length) { var r = D.createRange(); r.setStart(n, left); r.collapse(true); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r); return; } left -= n.nodeValue.length; }
    var r2 = D.createRange(); r2.selectNodeContents(b); r2.collapse(false); var s2 = W.getSelection(); s2.removeAllRanges(); s2.addRange(r2);
  }
  function selectedBlocks(root) {
    var s = W.getSelection(); if (!s.rangeCount) return [];
    var rg = s.getRangeAt(0); if (!root.contains(rg.commonAncestorContainer)) return [];
    return Array.prototype.filter.call(root.querySelectorAll('[data-i]'), function (d) { return rg.intersectsNode(d) && d.contentEditable !== 'false'; });
  }

  /* ---------- Word */
  async function DocxEditor(blob, onDirty) {
    var z = await JSZip.loadAsync(await blob.arrayBuffer()), part = 'word/document.xml';
    var x = xmlDoc(await z.file(part).async('string')), WN = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    var styleNames = {}, nameToId = {}, sf = z.file('word/styles.xml');
    if (sf) desc(xmlDoc(await sf.async('string')), 'style').forEach(function (s) { var id = s.getAttribute('w:styleId'), nm = wv(ch(s, 'name')).toLowerCase(); styleNames[id] = nm; if (s.getAttribute('w:type') === 'paragraph') nameToId[nm] = id; });
    var bulletNum = null, nf = z.file('word/numbering.xml');
    if (nf) { var nx = xmlDoc(await nf.async('string')), absB = {}; desc(nx, 'abstractNum').forEach(function (a) { var l0 = kids(a).filter(function (l) { return l.localName === 'lvl' && l.getAttribute('w:ilvl') === '0'; })[0]; if (l0 && wv(ch(l0, 'numFmt')) === 'bullet') absB[a.getAttribute('w:abstractNumId')] = 1; }); desc(nx, 'num').forEach(function (n) { if (!bulletNum && absB[wv(ch(n, 'abstractNumId'))]) bulletNum = n.getAttribute('w:numId'); }); }
    var STY = { p: [], h0: ['title', 'titel'], h1: ['heading 1', 'kop 1'], h2: ['heading 2', 'kop 2'], h3: ['heading 3', 'kop 3'], li: ['list bullet', 'list paragraph', 'lijstalinea'] };
    function styleIdFor(k) { var ns = STY[k] || []; for (var i = 0; i < ns.length; i++) if (nameToId[ns[i]]) return nameToId[ns[i]]; return k === 'h0' ? 'Title' : /^h\d$/.test(k) ? 'Heading' + k[1] : null; }
    var map = [], orig = [], locked = [], origSig = [];
    var root = el2('div', 'docx-ed'); root.contentEditable = 'true'; root.spellcheck = true; plainPaste(root);
    function on(rPr, n) { var e = ch(rPr, n); return !!e && !/^(0|false|off|none)$/i.test(wv(e)); }
    function para(p, parent) {
      var i = map.length, div = el2('div', 'dp'), text = '', obj = false, pPr = ch(p, 'pPr'), sid = wv(ch(pPr, 'pStyle')), sn = styleNames[sid] || sid.toLowerCase(), st = 'p';
      var hm = /(heading|kop)\s*(\d)/.exec(sn); if (hm) st = 'h' + Math.min(3, +hm[2]); else if (/^(title|titel)$/.test(sn)) st = 'h0';
      var numPr = ch(pPr, 'numPr'); if ((numPr && wv(ch(numPr, 'numId')) !== '0') || /list/.test(sn)) { st = 'li'; div.style.marginLeft = (22 + 18 * +(wv(ch(numPr, 'ilvl')) || 0)) + 'px'; }
      div.dataset.st = st; div.classList.add('s-' + st);
      var jc = wv(ch(pPr, 'jc')); div.dataset.al = jc === 'center' ? 'center' : (jc === 'right' || jc === 'end') ? 'right' : jc === 'both' ? 'justify' : 'left'; div.style.textAlign = div.dataset.al;
      (function walk(n) {
        kids(n).forEach(function (c) {
          var l = c.localName;
          if (l === 'r') {
            var rPr = ch(c, 'rPr'), b = on(rPr, 'b'), it = on(rPr, 'i'), u = !!ch(rPr, 'u') && wv(ch(rPr, 'u')) !== 'none';
            kids(c).forEach(function (q) {
              var ql = q.localName;
              if (ql === 't') { var s = el2('span', null, q.textContent); if (b) s.style.fontWeight = '700'; if (it) s.style.fontStyle = 'italic'; if (u) s.style.textDecoration = 'underline'; div.appendChild(s); text += q.textContent; }
              else if (ql === 'tab') { div.appendChild(D.createTextNode('\t')); text += '\t'; }
              else if (ql === 'br' || ql === 'cr') { if (q.getAttribute('w:type') === 'page') return; div.appendChild(D.createElement('br')); text += '\n'; }
              else if (/^(drawing|pict|object|fldChar|instrText|sym|footnoteReference|endnoteReference)$/.test(ql)) { obj = true; if (/^(drawing|pict|object)$/.test(ql)) div.appendChild(el2('span', 'lockimg', '🖼 afbeelding')); }
            });
          } else if (/^(hyperlink|ins|smartTag|sdt|sdtContent|customXml|moveTo)$/.test(l)) walk(c);
          else if (l === 'fldSimple' || l === 'oMath' || l === 'oMathPara') { obj = true; walk(c); }
        });
      })(p);
      if (!div.firstChild || /\n$/.test(text)) div.appendChild(D.createElement('br'));
      if (obj) { div.contentEditable = 'false'; div.classList.add('locked'); div.title = 'Deze alinea bevat een afbeelding of veld en kan hier niet worden bewerkt'; }
      div.dataset.i = i; map.push(p); orig.push(text); locked.push(obj); parent.appendChild(div);
    }
    function table(t, parent) {
      var tb = el2('table', 'wtab');
      kids(t).filter(function (e) { return e.localName === 'tr'; }).forEach(function (tr) {
        var row = el2('tr'); tb.appendChild(row);
        kids(tr).filter(function (e) { return e.localName === 'tc'; }).forEach(function (tc) {
          var td = el2('td'), sp = +(wv(ch(ch(tc, 'tcPr'), 'gridSpan')) || 1); if (sp > 1) td.colSpan = sp; row.appendChild(td);
          (function cell(n) { kids(n).forEach(function (e) { if (e.localName === 'p') para(e, td); else if (e.localName === 'tbl') table(e, td); else if (e.localName === 'sdt') cell(ch(e, 'sdtContent')); }); })(tc);
        });
      });
      parent.appendChild(tb);
    }
    (function body(n) { kids(n).forEach(function (e) { if (e.localName === 'p') para(e, root); else if (e.localName === 'tbl') table(e, root); else if (e.localName === 'sdt') body(ch(e, 'sdtContent')); }); })(desc(x, 'body')[0]);

    function segs(div) {
      var out = [];
      (function walk(n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) { if (!c.nodeValue) continue; var f = fmtOf(c.parentElement, div);
            var l = out[out.length - 1]; if (l && l.f.join() === f.join()) l.t += c.nodeValue; else out.push({ t: c.nodeValue, f: f }); }
          else if (c.nodeName === 'BR') { if (c.nextSibling || (c.parentNode !== div)) out.push({ t: '\n', f: [0, 0, 0] }); }
          else if (c.nodeType === 1 && !c.classList.contains('lockimg')) walk(c);
        }
      })(div);
      out.forEach(function (s) { s.t = s.t.replace(/ /g, ' '); });
      return out;
    }
    function fmtOf(el, div) {
      var b = null, it = null, u = null;
      for (var e = el; e && e !== div.parentNode; e = e.parentElement) {
        var st = e.style || {}, tg = e.nodeName;
        if (b === null) { if (tg === 'B' || tg === 'STRONG') b = 1; else if (st.fontWeight) b = (st.fontWeight === 'bold' || +st.fontWeight >= 600) ? 1 : 0; }
        if (it === null) { if (tg === 'I' || tg === 'EM') it = 1; else if (st.fontStyle) it = st.fontStyle === 'italic' ? 1 : 0; }
        if (u === null) { if (tg === 'U') u = 1; else if (st.textDecoration || st.textDecorationLine) u = /underline/.test(st.textDecorationLine || st.textDecoration) ? 1 : 0; }
        if (e === div) break;
      }
      return [b ? 1 : 0, it ? 1 : 0, u ? 1 : 0];
    }
    function sig(div) { return div.dataset.st + '|' + div.dataset.al + '|' + JSON.stringify(segs(div)); }
    function snapshotSigs() { origSig = []; Array.prototype.forEach.call(root.querySelectorAll('[data-i]'), function (d) { if (origSig[+d.dataset.i] == null) origSig[+d.dataset.i] = sig(d); }); }

    function setRuns(p, list) {
      var pPr = ch(p, 'pPr'), r0 = desc(p, 'r').filter(function (r) { return ch(r, 't'); })[0] || desc(p, 'r')[0], base = r0 && ch(r0, 'rPr');
      kids(p).forEach(function (c) { if (c !== pPr) p.removeChild(c); });
      if (!list.length || (list.length === 1 && !list[0].t)) { if (base) { var er = x.createElementNS(WN, 'w:r'); er.appendChild(base.cloneNode(true)); p.appendChild(er); } return; }
      list.forEach(function (sg) {
        var r = x.createElementNS(WN, 'w:r'), rp = base ? base.cloneNode(true) : x.createElementNS(WN, 'w:rPr');
        ['b', 'bCs', 'i', 'iCs', 'u'].forEach(function (n) { var e = ch(rp, n); if (e) rp.removeChild(e); });
        if (sg.f[0]) { insertOrdered(rp, x.createElementNS(WN, 'w:b'), RPR_ORDER); insertOrdered(rp, x.createElementNS(WN, 'w:bCs'), RPR_ORDER); }
        if (sg.f[1]) { insertOrdered(rp, x.createElementNS(WN, 'w:i'), RPR_ORDER); insertOrdered(rp, x.createElementNS(WN, 'w:iCs'), RPR_ORDER); }
        if (sg.f[2]) { var ue = x.createElementNS(WN, 'w:u'); ue.setAttribute('w:val', 'single'); insertOrdered(rp, ue, RPR_ORDER); }
        if (rp.childNodes.length) r.appendChild(rp);
        sg.t.split(/(\t|\n)/).forEach(function (seg) {
          if (seg === '\t') r.appendChild(x.createElementNS(WN, 'w:tab'));
          else if (seg === '\n') r.appendChild(x.createElementNS(WN, 'w:br'));
          else if (seg) { var t = x.createElementNS(WN, 'w:t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = seg; r.appendChild(t); }
        });
        p.appendChild(r);
      });
    }
    function setPPr(p, st, al) {
      var pPr = ch(p, 'pPr'); if (!pPr) { pPr = x.createElementNS(WN, 'w:pPr'); p.insertBefore(pPr, p.firstChild); }
      var ps = ch(pPr, 'pStyle'), np = ch(pPr, 'numPr'), jc = ch(pPr, 'jc');
      var curSn = styleNames[wv(ps)] || wv(ps).toLowerCase(), curSt = /(heading|kop)\s*(\d)/.test(curSn) ? 'h' + Math.min(3, +/(\d)/.exec(curSn)[1]) : /^(title|titel)$/.test(curSn) ? 'h0' : (np || /list/.test(curSn)) ? 'li' : 'p';
      if (st !== curSt) {
        if (ps) pPr.removeChild(ps); if (np && st !== 'li') pPr.removeChild(np);
        var sid = st === 'p' ? null : styleIdFor(st);
        if (sid) { var e = x.createElementNS(WN, 'w:pStyle'); e.setAttribute('w:val', sid); insertOrdered(pPr, e, PPR_ORDER); }
        if (st === 'li' && !ch(pPr, 'numPr') && bulletNum) { var n2 = x.createElementNS(WN, 'w:numPr'), il = x.createElementNS(WN, 'w:ilvl'), ni = x.createElementNS(WN, 'w:numId'); il.setAttribute('w:val', '0'); ni.setAttribute('w:val', bulletNum); n2.appendChild(il); n2.appendChild(ni); insertOrdered(pPr, n2, PPR_ORDER); }
      }
      var want = al === 'center' ? 'center' : al === 'right' ? 'right' : al === 'justify' ? 'both' : '';
      var have = wv(jc); have = have === 'end' ? 'right' : have === 'start' ? 'left' : have;
      if ((want || 'left') !== (have || 'left')) { if (jc) pPr.removeChild(jc); if (want) { var j = x.createElementNS(WN, 'w:jc'); j.setAttribute('w:val', want); insertOrdered(pPr, j, PPR_ORDER); } }
      if (!pPr.childNodes.length) p.removeChild(pPr);
    }
    function newPara(from) {
      var np = x.createElementNS(WN, 'w:p'), pPr = ch(from, 'pPr');
      if (pPr) { var c = pPr.cloneNode(true), sp = ch(c, 'sectPr'); if (sp) c.removeChild(sp); np.appendChild(c); }
      var r0 = desc(from, 'r').filter(function (r) { return ch(r, 't'); })[0]; if (r0 && ch(r0, 'rPr')) { var tmp = x.createElementNS(WN, 'w:r'); tmp.appendChild(ch(r0, 'rPr').cloneNode(true)); np.appendChild(tmp); }
      return np;
    }
    // --- lint
    var tools = el2('div', 'rgroup'), selSt = el2('select', 'rsel'); selSt.title = 'Stijl';
    [['p', 'Normaal'], ['h0', 'Titel'], ['h1', 'Kop 1'], ['h2', 'Kop 2'], ['h3', 'Kop 3'], ['li', '• Opsomming']].forEach(function (o) { var op = el2('option', null, o[1]); op.value = o[0]; selSt.appendChild(op); });
    var bB = btn('B', 'Vet (Ctrl+B)', 'b'), bI = btn('I', 'Cursief (Ctrl+I)', 'i'), bU = btn('U', 'Onderstrepen (Ctrl+U)', 'u'), bL = btn('•≡', 'Opsomming');
    var al = {}; [['left', '⯇≡', 'Links uitlijnen'], ['center', '≡', 'Centreren'], ['right', '≡⯈', 'Rechts uitlijnen'], ['justify', '☰', 'Uitvullen']].forEach(function (a) { al[a[0]] = btn(a[1], a[2], 'al'); });
    tools.appendChild(selSt); tools.appendChild(sepEl()); [bB, bI, bU].forEach(function (b) { tools.appendChild(b); }); tools.appendChild(sepEl()); tools.appendChild(bL); tools.appendChild(sepEl()); Object.keys(al).forEach(function (k) { tools.appendChild(al[k]); });
    var hist = History(function () { return { h: root.innerHTML, c: caretPath(root) }; }, function (s) { root.innerHTML = s.h; root.focus(); setCaretPath(root, s.c); onDirty(); refresh(); }, function () { api.onState && api.onState(); });
    function applyStyle(st) { var bl = selectedBlocks(root); if (!bl.length) return; hist.push(); bl.forEach(function (d) { ['p', 'h0', 'h1', 'h2', 'h3', 'li'].forEach(function (k) { d.classList.remove('s-' + k); }); d.dataset.st = st; d.classList.add('s-' + st); d.style.marginLeft = st === 'li' ? '22px' : ''; }); onDirty(); refresh(); }
    selSt.onchange = function () { applyStyle(selSt.value); root.focus(); };
    bL.onclick = function () { var bl = selectedBlocks(root); applyStyle(bl.length && bl.every(function (d) { return d.dataset.st === 'li'; }) ? 'p' : 'li'); };
    [[bB, 'bold'], [bI, 'italic'], [bU, 'underline']].forEach(function (p2) { p2[0].onclick = function () { hist.push(); D.execCommand(p2[1]); onDirty(); refresh(); }; });
    Object.keys(al).forEach(function (k) { al[k].onclick = function () { var bl = selectedBlocks(root); if (!bl.length) return; hist.push(); bl.forEach(function (d) { d.dataset.al = k; d.style.textAlign = k; }); onDirty(); refresh(); }; });
    function refresh() {
      var bl = selectedBlocks(root), d = bl[0]; if (!d) return;
      selSt.value = d.dataset.st || 'p';
      bB.classList.toggle('on', D.queryCommandState('bold')); bI.classList.toggle('on', D.queryCommandState('italic')); bU.classList.toggle('on', D.queryCommandState('underline'));
      bL.classList.toggle('on', d.dataset.st === 'li'); Object.keys(al).forEach(function (k) { al[k].classList.toggle('on', (d.dataset.al || 'left') === k); });
    }
    D.addEventListener('selectionchange', function () { if (root.isConnected && root.contains(D.activeElement)) refresh(); });
    root.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'historyUndo') { e.preventDefault(); hist.undo(); return; } if (e.inputType === 'historyRedo') { e.preventDefault(); hist.redo(); return; }
      hist.push(/^insertText|^insertComposition/.test(e.inputType) ? 'type' : /^delete/.test(e.inputType) ? 'del' : e.inputType);
    });
    root.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); hist.redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); hist.undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i' || k === 'u')) { e.preventDefault(); hist.push(); D.execCommand(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline'); onDirty(); refresh(); }
    });
    root.addEventListener('input', function () {
      var seen = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-i]'), function (d) { var k = d.dataset.i; if (seen[k] && /^h/.test(d.dataset.st) && !d._fixed) { d.classList.remove('s-' + d.dataset.st); d.dataset.st = 'p'; d.classList.add('s-p'); d._fixed = 1; } seen[k] = 1; });
      onDirty();
    });
    var api = {
      el: root, tools: tools, kind: 'Word-document',
      init: function () { snapshotSigs(); },
      status: function () { var w = (root.innerText.match(/\S+/g) || []).length; return w + ' woorden'; },
      undo: hist.undo, redo: hist.redo, canUndo: hist.canUndo, canRedo: hist.canRedo,
      save: async function () {
        Array.prototype.slice.call(root.querySelectorAll('td')).concat([root]).forEach(function (cont) {
          var prev = null;
          Array.prototype.slice.call(cont.childNodes).forEach(function (n) {
            if (n.nodeType === 1 && n.dataset && n.dataset.i != null) { prev = n; return; }
            if (n.nodeType === 1 && n.nodeName === 'TABLE') { prev = null; return; }
            if ((n.nodeType === 3 && n.nodeValue.trim()) || (n.nodeType === 1 && n.nodeName !== 'TABLE' && n.nodeName !== 'BR')) {
              var d = el2('div', 'dp'); var ref = prev || cont.querySelector('[data-i]'); d.dataset.i = ref ? ref.dataset.i : 0; d.dataset.st = ref ? ref.dataset.st : 'p'; d.dataset.al = ref ? ref.dataset.al : 'left'; cont.insertBefore(d, n); d.appendChild(n); prev = d;
            }
          });
        });
        var seen = {}, last = {};
        Array.prototype.slice.call(root.querySelectorAll('[data-i]')).forEach(function (div) {
          var i = +div.dataset.i, p = map[i]; if (!p) return;
          if (locked[i]) { seen[i] = 1; last[i] = p; return; }
          if (!seen[i]) { seen[i] = 1; if (sig(div) !== origSig[i]) { setRuns(p, segs(div)); setPPr(p, div.dataset.st || 'p', div.dataset.al || 'left'); } last[i] = p; }
          else { var np = newPara(p); setRuns(np, segs(div)); setPPr(np, div.dataset.st || 'p', div.dataset.al || 'left'); last[i].parentNode.insertBefore(np, last[i].nextSibling); last[i] = np; }
        });
        map.forEach(function (p, i) {
          if (seen[i] || locked[i] || !p.parentNode) return;
          var sib = kids(p.parentNode).filter(function (e) { return e.localName === 'p'; });
          if (p.parentNode.localName === 'tc' && sib.length <= 1) setRuns(p, []); else p.parentNode.removeChild(p);
        });
        z.file(part, ser(x));
        var out = await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
        // opnieuw inlezen zodat volgende opslag van de nieuwe toestand uitgaat
        return out;
      }
    };
    return api;
  }

  /* ---------- Excel */
  async function XlsxEditor(blob, onDirty) {
    var z = await JSZip.loadAsync(await blob.arrayBuffer()), wbPath = 'xl/workbook.xml', wb = xmlDoc(await z.file(wbPath).async('string')), rels = await relsOf(z, wbPath);
    var SN = wb.documentElement.namespaceURI, shared = [], ssf = z.file('xl/sharedStrings.xml');
    if (ssf) desc(xmlDoc(await ssf.async('string')), 'si').forEach(function (si) { shared.push(kids(si).filter(function (e) { return e.localName !== 'rPh'; }).map(function (e) { return e.localName === 't' ? e.textContent : desc(e, 't').map(function (t) { return t.textContent; }).join(''); }).join('')); });
    var dateXf = {}, boldXf = {}, alignXf = {}, stf = z.file('xl/styles.xml');
    if (stf) {
      var sx = xmlDoc(await stf.async('string')), custom = {}, fontsB = [];
      desc(sx, 'numFmt').forEach(function (n) { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
      kids(desc(sx, 'fonts')[0]).forEach(function (f) { fontsB.push(!!ch(f, 'b') && ch(f, 'b').getAttribute('val') !== '0'); });
      kids(desc(sx, 'cellXfs')[0]).forEach(function (xf, i) { var id = +xf.getAttribute('numFmtId'); if ((id >= 14 && id <= 17) || id === 22 || (custom[id] && /[dmy]/i.test(custom[id].replace(/"[^"]*"|\[[^\]]*\]/g, '')) && !/h/i.test(custom[id]))) dateXf[i] = 1; if (fontsB[+xf.getAttribute('fontId')]) boldXf[i] = 1; var a = ch(xf, 'alignment'); if (a && a.getAttribute('horizontal')) alignXf[i] = a.getAttribute('horizontal'); });
    }
    var sheets = desc(wb, 'sheet').filter(function (s) { return !/hidden/i.test(s.getAttribute('state') || ''); }).map(function (s) { return { name: s.getAttribute('name'), path: rels[s.getAttribute('r:id')] }; }).filter(function (s) { return s.path && z.file(s.path); });
    var docs = {}, edits = {}, cur = 0, sel = null, editing = null;
    function colName(n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
    function colIdx(r) { var m = /^([A-Z]+)/.exec(r || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
    function serialToDate(v) { var d = new Date(Math.round((+v - 25569) * 864e5)); return pad(d.getUTCDate()) + '-' + pad(d.getUTCMonth() + 1) + '-' + d.getUTCFullYear(); }
    function dateToSerial(s) { var m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s); if (!m) return null; return Date.UTC(+m[3], m[2] - 1, +m[1]) / 864e5 + 25569; }
    async function sheetDoc(i) { if (!docs[i]) docs[i] = xmlDoc(await z.file(sheets[i].path).async('string')); return docs[i]; }
    function cellVal(c) {
      var t = c.getAttribute('t'), v = ch(c, 'v'), val = v ? v.textContent : '';
      if (t === 's') return shared[+val] || '';
      if (t === 'inlineStr') return desc(c, 't').map(function (e) { return e.textContent; }).join('');
      if (t === 'b') return val === '1' ? 'WAAR' : 'ONWAAR';
      if (t !== 'str' && t !== 'e' && val !== '' && !isNaN(+val)) { if (dateXf[+c.getAttribute('s')]) return serialToDate(val); return String(+val).replace('.', ','); }
      return val;
    }
    var wrap = el2('div', 'xl-ed'), fbar = el2('div', 'xlfbar'), nameBox = el2('input', 'xlname'), fx = el2('span', 'xlfx', 'fx'), finp = el2('input', 'xlfinp'), gridBox = el2('div', 'xlgrid'), tabs = el2('div', 'xltabs');
    nameBox.readOnly = true; finp.placeholder = 'Selecteer een cel en typ, of begin met = voor een formule';
    fbar.appendChild(nameBox); fbar.appendChild(fx); fbar.appendChild(finp);
    wrap.appendChild(fbar); wrap.appendChild(gridBox); wrap.appendChild(tabs);
    var tb = null, info = {};
    var und = [], red = [];
    function histChange() { api.onState && api.onState(); }
    function rawOf(ref) { var ed = edits[cur] || {}; if (ref in ed) return ed[ref]; var c = info.cells[ref]; if (!c) return ''; var f = ch(c, 'f'); return f ? '=' + f.textContent : cellVal(c); }
    function shownOf(ref) { var ed = edits[cur] || {}; if (ref in ed) return ed[ref]; var c = info.cells[ref]; return c ? cellVal(c) : ''; }
    function tdOf(ref) { return tb && tb.querySelector('td[data-r="' + ref + '"]'); }
    function setVal(ref, val, sheet, noHist) {
      sheet = sheet == null ? cur : sheet; var ed = edits[sheet] || (edits[sheet] = {});
      var before = ref in ed ? ed[ref] : null;
      if (sheet === cur && (ref in ed ? ed[ref] : rawOf(ref)) === val) return;
      if (!noHist) { und.push({ s: sheet, r: ref, b: before, hadB: ref in ed, a: val }); if (und.length > UNDO_MAX) und.shift(); red = []; histChange(); }
      ed[ref] = val; onDirty();
      if (sheet === cur) { var td = tdOf(ref); if (td) { td.textContent = val; td.classList.add('chg'); td.classList.remove('fx'); } }
    }
    function select(ref, scroll) {
      if (editing) commitEdit(); sel = ref;
      $$('.xt .sel', gridBox).forEach(function (e) { e.classList.remove('sel'); }); $$('.xt .hsel', gridBox).forEach(function (e) { e.classList.remove('hsel'); });
      var td = tdOf(ref); if (!td) return; td.classList.add('sel');
      var ci = colIdx(ref), ri = +ref.replace(/^[A-Z]+/, ''); if (tb.rows[0].cells[ci + 1]) tb.rows[0].cells[ci + 1].classList.add('hsel'); if (tb.rows[ri]) tb.rows[ri].cells[0].classList.add('hsel');
      nameBox.value = ref; finp.value = rawOf(ref);
      if (scroll) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function startEdit(keep) {
      var td = tdOf(sel); if (!td) return; editing = { ref: sel, td: td, old: td.textContent };
      td.contentEditable = 'plaintext-only'; td.classList.add('editing'); if (!keep) td.textContent = rawOf(sel).charAt(0) === '=' && keep !== false ? rawOf(sel) : ''; else td.textContent = rawOf(sel);
      td.focus(); var r = D.createRange(); r.selectNodeContents(td); r.collapse(false); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function commitEdit(cancel) {
      if (!editing) return; var e = editing; editing = null; e.td.contentEditable = 'false'; e.td.classList.remove('editing');
      if (cancel) { e.td.textContent = e.old; return; }
      var v = e.td.textContent; e.td.textContent = e.old; setVal(e.ref, v); finp.value = rawOf(e.ref);
    }
    function move(dr, dc) { var ci = colIdx(sel) + dc, ri = +sel.replace(/^[A-Z]+/, '') + dr; if (ci < 0 || ri < 1 || ci >= info.maxC || ri > info.maxR) return; select(colName(ci) + ri, true); }
    async function show(i) {
      if (editing) commitEdit();
      cur = i; tabs.textContent = '';
      sheets.forEach(function (s, k) { var b = el2('button', 'xltab' + (k === i ? ' on' : ''), s.name); b.type = 'button'; b.onclick = function () { show(k); }; tabs.appendChild(b); });
      var x = await sheetDoc(i), cells = {}, maxR = 0, maxC = 0, widths = {};
      desc(x, 'col').forEach(function (c) { var w = +c.getAttribute('width'); for (var k = +c.getAttribute('min'); k <= +c.getAttribute('max') && k < 80; k++) widths[k - 1] = w; });
      desc(x, 'row').forEach(function (row) { kids(row).forEach(function (c) { if (c.localName !== 'c') return; var r = c.getAttribute('r'), ci = colIdx(r), ri = +r.replace(/^[A-Z]+/, ''); if (ci < 0 || ci > 60 || ri > 1000) return; cells[r] = c; maxR = Math.max(maxR, ri); maxC = Math.max(maxC, ci + 1); }); });
      maxR = Math.min(Math.max(maxR + 5, 30), 1005); maxC = Math.min(Math.max(maxC + 2, 10), 62);
      info = { cells: cells, maxR: maxR, maxC: maxC };
      tb = el2('table', 'xt'); var hr = el2('tr'); hr.appendChild(el2('th', 'corner'));
      for (var c = 0; c < maxC; c++) { var th = el2('th', null, colName(c)); th.style.minWidth = th.style.width = Math.max(48, Math.round((widths[c] || 9.5) * 7.2)) + 'px'; hr.appendChild(th); }
      tb.appendChild(hr);
      var ed = edits[i] || {};
      for (var r = 1; r <= maxR; r++) {
        var tr = el2('tr'); tr.appendChild(el2('th', null, String(r)));
        for (c = 0; c < maxC; c++) {
          var ref = colName(c) + r, ce = cells[ref], td = el2('td'); td.dataset.r = ref;
          td.textContent = ref in ed ? ed[ref] : ce ? cellVal(ce) : '';
          if (ce) { var s = +ce.getAttribute('s'); if (boldXf[s]) td.style.fontWeight = '700'; if (alignXf[s]) td.style.textAlign = alignXf[s]; else if (/^-?[\d.,]+$/.test(td.textContent) || dateXf[s]) td.style.textAlign = 'right'; if (ch(ce, 'f') && !(ref in ed)) td.classList.add('fx'); }
          if (ref in ed) td.classList.add('chg');
          tr.appendChild(td);
        }
        tb.appendChild(tr);
      }
      gridBox.textContent = ''; gridBox.appendChild(tb);
      tb.addEventListener('mousedown', function (e) { var td = e.target.closest('td'); if (!td || td === (editing && editing.td)) return; e.preventDefault(); select(td.dataset.r); gridBox.focus(); });
      tb.addEventListener('dblclick', function (e) { var td = e.target.closest('td'); if (!td) return; select(td.dataset.r); startEdit(true); });
      select('A1');
    }
    gridBox.tabIndex = 0;
    gridBox.addEventListener('keydown', function (e) {
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); if (editing) commitEdit(); api.redo(); return; }
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); if (editing) commitEdit(true); else api.undo(); return; }
      if (editing) {
        if (k === 'Enter') { e.preventDefault(); commitEdit(); move(e.shiftKey ? -1 : 1, 0); gridBox.focus(); }
        else if (k === 'Tab') { e.preventDefault(); commitEdit(); move(0, e.shiftKey ? -1 : 1); gridBox.focus(); }
        else if (k === 'Escape') { e.preventDefault(); commitEdit(true); gridBox.focus(); }
        return;
      }
      if (!sel) return;
      if (k === 'ArrowDown' || k === 'Enter') { e.preventDefault(); move(1, 0); }
      else if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
      else if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
      else if (k === 'ArrowRight' || k === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); setVal(sel, ''); finp.value = ''; }
      else if (k === 'F2') { e.preventDefault(); startEdit(true); }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { startEdit(false); }
    });
    finp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); setVal(sel, finp.value); move(1, 0); gridBox.focus(); } else if (e.key === 'Escape') { finp.value = rawOf(sel); gridBox.focus(); } });
    finp.addEventListener('blur', function () { if (sel && finp.value !== rawOf(sel)) setVal(sel, finp.value); });
    function setCell(x, ref, val) {
      var NS = x.documentElement.namespaceURI, sd = desc(x, 'sheetData')[0], ri = +ref.replace(/^[A-Z]+/, ''), ci = colIdx(ref);
      var row = kids(sd).filter(function (r) { return +r.getAttribute('r') === ri; })[0];
      if (!row) { if (val === '') return; row = x.createElementNS(NS, 'row'); row.setAttribute('r', ri); var after = kids(sd).filter(function (r) { return +r.getAttribute('r') > ri; })[0]; sd.insertBefore(row, after || null); }
      var c = kids(row).filter(function (e) { return e.getAttribute('r') === ref; })[0];
      if (!c) { if (val === '') return; c = x.createElementNS(NS, 'c'); c.setAttribute('r', ref); var nx = kids(row).filter(function (e) { return colIdx(e.getAttribute('r')) > ci; })[0]; row.insertBefore(c, nx || null); }
      kids(c).forEach(function (k) { c.removeChild(k); }); c.removeAttribute('t');
      if (val === '') return;
      var v = val.trim();
      if (v.charAt(0) === '=' && v.length > 1) { var fe = x.createElementNS(NS, 'f'); fe.textContent = v.slice(1); c.appendChild(fe); return; }
      var num = /^-?\d+(?:[.,]\d+)?$/.test(v) ? +v.replace(',', '.') : null, ds = dateToSerial(v);
      if (num !== null || ds !== null) { var ve = x.createElementNS(NS, 'v'); ve.textContent = String(ds !== null ? ds : num); c.appendChild(ve); }
      else { c.setAttribute('t', 'inlineStr'); var is = x.createElementNS(NS, 'is'), t = x.createElementNS(NS, 't'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = val; is.appendChild(t); c.appendChild(is); }
    }
    await show(0);
    var api = {
      el: wrap, tools: null, kind: 'Excel-werkmap',
      init: function () { gridBox.focus(); },
      status: function () { var n = 0; Object.keys(edits).forEach(function (k) { n += Object.keys(edits[k]).length; }); return sheets.length + ' werkblad' + (sheets.length > 1 ? 'en' : '') + (n ? ' · ' + n + ' gewijzigde cel' + (n > 1 ? 'len' : '') : ''); },
      canUndo: function () { return und.length > 0; }, canRedo: function () { return red.length > 0; },
      undo: function () { var h = und.pop(); if (!h) return; red.push(h); var ed = edits[h.s] || (edits[h.s] = {}); if (h.hadB) ed[h.r] = h.b; else delete ed[h.r]; if (h.s !== cur) show(h.s).then(function () { select(h.r, true); }); else { var td = tdOf(h.r); if (td) { td.textContent = shownOf(h.r); td.classList.toggle('chg', h.r in ed); } select(h.r, true); } onDirty(); histChange(); },
      redo: function () { var h = red.pop(); if (!h) return; und.push(h); (edits[h.s] || (edits[h.s] = {}))[h.r] = h.a; if (h.s !== cur) show(h.s).then(function () { select(h.r, true); }); else { var td = tdOf(h.r); if (td) { td.textContent = h.a; td.classList.add('chg'); } select(h.r, true); } onDirty(); histChange(); },
      save: async function () {
        if (editing) commitEdit();
        for (var i in edits) { var x = await sheetDoc(+i); Object.keys(edits[i]).forEach(function (ref) { setCell(x, ref, edits[i][ref]); }); z.file(sheets[+i].path, ser(x)); }
        var cp = desc(wb, 'calcPr')[0]; if (!cp) { cp = wb.createElementNS(SN, 'calcPr'); wb.documentElement.appendChild(cp); } cp.setAttribute('fullCalcOnLoad', '1');
        z.file(wbPath, ser(wb));
        if (z.file('xl/calcChain.xml')) {
          z.remove('xl/calcChain.xml');
          var rp = 'xl/_rels/workbook.xml.rels', rx = xmlDoc(await z.file(rp).async('string')); desc(rx, 'Relationship').forEach(function (r) { if (/calcChain/.test(r.getAttribute('Type') || '')) r.parentNode.removeChild(r); }); z.file(rp, ser(rx));
          var ct = xmlDoc(await z.file('[Content_Types].xml').async('string')); desc(ct, 'Override').forEach(function (o) { if (/calcChain/.test(o.getAttribute('PartName') || '')) o.parentNode.removeChild(o); }); z.file('[Content_Types].xml', ser(ct));
        }
        // gewijzigde cellen staan nu in de XML: opnieuw tonen vanaf de nieuwe toestand
        edits = {}; und = []; red = []; histChange();
        var out = await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
        await show(cur); return out;
      }
    };
    return api;
  }

  /* ---------- PowerPoint */
  async function PptxEditor(blob, onDirty) {
    /* dezelfde weergave als in de PDF (pptx-render.js); de tekstvakken van de dia zelf zijn bewerkbaar */
    var deck = await pptxLoad(await blob.arrayBuffer()), z = deck.z, SWe = deck.SW, SHe = deck.SH;
    var wrap = el2('div', 'pp-ed'), side = el2('div', 'ppside'), main = el2('div', 'ppmain'), slides = [], curS = 0;
    wrap.appendChild(side); wrap.appendChild(main);
    for (var s = 0; s < deck.slides.length; s++) {
      var reg = [], r = await pptxRenderSlide(deck, s, { reg: reg }), part = await pptPart(deck, deck.slides[s].path);
      reg.forEach(function (q) { plainPaste(q.box); });
      slides.push({ path: part.path, x: part.x, shapes: reg.map(function (q) { return { tb: q.tb, box: q.box, orig: null }; }), el: r.el, n: s + 1, h: r.h, hidden: r.hidden });
    }
    var stage = el2('div', 'ppstage'), frame = el2('div', 'ppframe'); stage.appendChild(frame); main.appendChild(stage);
    function place(el, host, w) { el.style.transformOrigin = '0 0'; el.style.transform = 'scale(' + (w / PX_W) + ')'; host.style.height = (w * SHe / SWe) + 'px'; }
    function thumbs() {
      side.textContent = '';
      slides.forEach(function (sl, i) {
        var t = el2('button', 'ppthumb' + (i === curS ? ' on' : '') + (sl.hidden ? ' hid' : '')); t.type = 'button'; t.title = sl.hidden ? 'Verborgen dia' : '';
        var num = el2('span', 'ppn', String(sl.n)), mini = el2('div', 'ppmini');
        var c = sl.el.cloneNode(true); $$('[contenteditable]', c).forEach(function (e) { e.removeAttribute('contenteditable'); }); mini.appendChild(c);
        t.appendChild(num); t.appendChild(mini); side.appendChild(t); t.onclick = function () { go(i); };
        requestAnimationFrame(function () { place(c, mini, mini.clientWidth || 140); });
      });
    }
    function go(i) { curS = i; frame.textContent = ''; if (slides[i]) frame.appendChild(slides[i].el); fit(); $$('.ppthumb', side).forEach(function (t, k) { t.classList.toggle('on', k === i); }); var th = side.children[i]; if (th) th.scrollIntoView({ block: 'nearest' }); }
    function fit() { var w = Math.min(stage.clientWidth - 40, (stage.clientHeight - 40) * SWe / SHe); if (w > 50 && slides[curS]) { frame.style.width = w + 'px'; place(slides[curS].el, frame, w); } }
    if (W.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);
    var tt; function thumbLater() { clearTimeout(tt); tt = setTimeout(thumbs, 400); }
    function getState() { return { s: curS, h: slides.map(function (sl) { return sl.shapes.map(function (sh) { return sh.box.innerHTML; }); }), c: slides[curS] ? caretPath(slides[curS].el) : null }; }
    function setState(st) { slides.forEach(function (sl, i) { sl.shapes.forEach(function (sh, j) { sh.box.innerHTML = st.h[i][j]; }); }); go(st.s); setCaretPath(slides[st.s].el, st.c); onDirty(); thumbs(); }
    var hist = History(getState, setState, function () { api.onState && api.onState(); });
    slides.forEach(function (sl) {
      sl.shapes.forEach(function (sh) {
        sh.orig = sh.box.innerHTML;
        sh.box.addEventListener('beforeinput', function (e) { if (e.inputType === 'historyUndo') { e.preventDefault(); hist.undo(); return; } if (e.inputType === 'historyRedo') { e.preventDefault(); hist.redo(); return; } hist.push(/^insertText/.test(e.inputType) ? 'type' : /^delete/.test(e.inputType) ? 'del' : e.inputType); });
        sh.box.addEventListener('input', function () { onDirty(); thumbLater(); });
        sh.box.addEventListener('keydown', function (e) { var k = e.key.toLowerCase(); if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); hist.redo(); } else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); hist.undo(); } });
      });
    });
    function setPara(p, text) {
      var AN = p.namespaceURI, pPr = ch(p, 'pPr'), end = ch(p, 'endParaRPr'), r0 = kids(p).filter(function (e) { return e.localName === 'r'; })[0], rPr = r0 && ch(r0, 'rPr');
      kids(p).forEach(function (c) { if (c !== pPr && c !== end) p.removeChild(c); });
      if (!text) return;
      var r = p.ownerDocument.createElementNS(AN, 'a:r'); if (rPr) r.appendChild(rPr.cloneNode(true));
      var t = p.ownerDocument.createElementNS(AN, 'a:t'); t.textContent = text; r.appendChild(t); p.insertBefore(r, end || null);
    }
    var api = {
      el: wrap, tools: null, kind: 'PowerPoint-presentatie',
      init: function () { thumbs(); go(0); },
      status: function () { return 'Dia ' + (curS + 1) + ' van ' + slides.length; },
      undo: hist.undo, redo: hist.redo, canUndo: hist.canUndo, canRedo: hist.canRedo,
      save: async function () {
        slides.forEach(function (sl) {
          var any = false;
          sl.shapes.forEach(function (sh) {
            if (sh.box.innerHTML === sh.orig) return; any = true;
            var lines = Array.prototype.slice.call(sh.box.querySelectorAll('.ppp, div')).filter(function (d) { return d.parentNode === sh.box; }).map(function (d) { var c = d.cloneNode(true); $$('.bu', c).forEach(function (b) { b.remove(); }); return blockText(c); }); /* opsommingstekens horen niet bij de tekst */
            if (!lines.length) lines = [blockText(sh.box)];
            var paras = kids(sh.tb).filter(function (e) { return e.localName === 'p'; });
            lines.forEach(function (ln, k) { var p = paras[k]; if (!p) { p = paras[paras.length - 1].cloneNode(true); sh.tb.appendChild(p); paras.push(p); } setPara(p, ln); });
            for (var k = lines.length; k < paras.length; k++) sh.tb.removeChild(paras[k]);
            sh.orig = sh.box.innerHTML;
          });
          if (any) z.file(sl.path, ser(sl.x));
        });
        return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
      }
    };
    return api;
  }

  /* ---------- tekst */
  async function TextEditor(blob, onDirty, name) {
    var ta = el2('textarea', 'tx-ed'); ta.value = decodeText(new Uint8Array(await blob.arrayBuffer()), 'utf-8'); ta.spellcheck = true;
    var hist = History(function () { return { v: ta.value, s: ta.selectionStart }; }, function (s) { ta.value = s.v; ta.setSelectionRange(s.s, s.s); onDirty(); }, function () { api.onState && api.onState(); });
    ta.addEventListener('beforeinput', function (e) { if (e.inputType === 'historyUndo') { e.preventDefault(); hist.undo(); return; } if (e.inputType === 'historyRedo') { e.preventDefault(); hist.redo(); return; } hist.push(/^insertText/.test(e.inputType) ? 'type' : /^delete/.test(e.inputType) ? 'del' : e.inputType); });
    ta.addEventListener('keydown', function (e) { var k = e.key.toLowerCase(); if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); hist.redo(); } else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); hist.undo(); } });
    ta.addEventListener('input', onDirty);
    var api = { el: ta, tools: null, kind: 'Tekstbestand', init: function () { ta.focus(); }, status: function () { return ta.value.split('\n').length + ' regels'; }, undo: hist.undo, redo: hist.redo, canUndo: hist.canUndo, canRedo: hist.canRedo, save: async function () { return new Blob([ta.value], { type: /\.csv$/i.test(name) ? 'text/csv' : 'text/plain' }); } };
    return api;
  }

  async function mountEditor(m, f, box, done) {
    setHTML(box, '<div class="pvmsg">Bestand openen…</div>');
    var ext = (f.name.split('.').pop() || '').toLowerCase(), ed, dirty = false;
    var ribbon = el2('div', 'ribbon rb-' + ext), save = btn('💾 Opslaan', 'Opslaan (Ctrl+S)', 'save'), un = btn('↶', 'Ongedaan maken (Ctrl+Z)'), re = btn('↷', 'Opnieuw (Ctrl+Y)'), st = el2('span', 'edst');
    var foot = el2('div', 'edfoot'), fl = el2('span'), fr = el2('span', 'edtip', 'Liever in Word, Excel of PowerPoint zelf? Download via ⤓ en sleep het bestand met dezelfde naam terug.');
    save.disabled = true;
    function stateBtns() { un.disabled = !ed.canUndo(); re.disabled = !ed.canRedo(); fl.textContent = ed.kind + ' · ' + ed.status(); }
    function onDirty() { if (!dirty) { dirty = true; save.disabled = false; st.textContent = 'Niet opgeslagen wijzigingen'; st.className = 'edst warn'; } if (ed) { clearTimeout(onDirty.t); onDirty.t = setTimeout(stateBtns, 150); } }
    try {
      var blob = await A.store.get(m, f.name);
      ed = ext === 'docx' ? await DocxEditor(blob, onDirty) : ext === 'xlsx' ? await XlsxEditor(blob, onDirty) : ext === 'pptx' ? await PptxEditor(blob, onDirty) : await TextEditor(blob, onDirty, f.name);
    } catch (e) { console.error(e); setHTML(box, '<div class="pvmsg">Dit bestand kan hier niet worden bewerkt (' + esc(e.message || e) + ').<br><small>Download het, bewerk het in Word of Excel en sleep het terug op de vergadering.</small></div>'); return null; }
    ed.onState = stateBtns;
    ribbon.appendChild(save); ribbon.appendChild(sepEl()); ribbon.appendChild(un); ribbon.appendChild(re);
    if (ed.tools) { ribbon.appendChild(sepEl()); ribbon.appendChild(ed.tools); }
    ribbon.appendChild(el2('span', 'rsp')); ribbon.appendChild(st);
    foot.appendChild(fl); foot.appendChild(fr);
    box.textContent = ''; box.appendChild(ribbon);
    var body = el2('div', 'edbody eb-' + ext); body.appendChild(ed.el); box.appendChild(body); box.appendChild(foot);
    if (ed.init) ed.init(); stateBtns();
    un.onclick = function () { ed.undo(); stateBtns(); }; re.onclick = function () { ed.redo(); stateBtns(); };
    async function doSave() {
      if (save.disabled) return;
      save.disabled = true; st.textContent = 'Opslaan…'; st.className = 'edst';
      try { var nb = await ed.save(); await saveEdited(m, f, nb); dirty = false; if (ed.init && ext === 'docx') { /* nieuwe toestand is basis voor volgende opslag */ var fresh = await mountEditor(m, f, box, done); A.edCtl = fresh; toast('Opgeslagen. De PDF is bijgewerkt.', 'ok'); return; } st.textContent = 'Opgeslagen ✓ (PDF bijgewerkt)'; st.className = 'edst ok'; stateBtns(); done && done(); }
      catch (e) { console.error(e); save.disabled = false; st.textContent = 'Opslaan mislukt: ' + (e.message || e); st.className = 'edst err'; }
    }
    save.onclick = doSave;
    box.onkeydown = function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); } setTimeout(stateBtns, 0); };
    return { isDirty: function () { return dirty; } };
  }
  async function saveEdited(m, f, blob) {
    var ext = (/\.[^.]*$/.exec(f.name) || [''])[0], base = f.name.slice(0, f.name.length - ext.length);
    if (!f.backup) { var bn = uniqueName(m, base + ' (oorspronkelijk)' + ext); await A.store.put(m, bn, await A.store.get(m, f.name)); f.backup = bn; }
    await A.store.put(m, f.name, blob); f.size = blob.size; f.edited = new Date().toISOString();
    await makePdf(m, f, blob); m.updated = f.edited; await persist();
  }
