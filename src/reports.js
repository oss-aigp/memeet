  /* ================================================================== Verslagen: aantekeningen in een Word-achtige editor */
  var REP_BLOCK = { P: 'p', DIV: 'p', H1: 'h1', H2: 'h2', LI: 'li' };
  /* DOM van de editor -> beperkte, veilige HTML (alleen b, i, u, p, h1, h2, ul, ol, li, br) en platte tekst */
  function repSerialize(root) {
    var html = '', lines = [];
    function inl(n) {
      var o = '', t = '';
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { o += esc(c.nodeValue); t += c.nodeValue; }
        else if (c.nodeType === 1) {
          var tag = c.nodeName;
          if (tag === 'BR') { o += '<br>'; t += '\n'; continue; }
          if (REP_BLOCK[tag] || tag === 'UL' || tag === 'OL') continue;
          var r = inl(c), fw = c.style && c.style.fontWeight, fs = c.style && c.style.fontStyle, td = c.style && c.style.textDecorationLine || c.style && c.style.textDecoration || '';
          var b = tag === 'B' || tag === 'STRONG' || fw === 'bold' || +fw >= 600, i = tag === 'I' || tag === 'EM' || fs === 'italic', u = tag === 'U' || /underline/.test(td);
          var h = r.h; if (u) h = '<u>' + h + '</u>'; if (i) h = '<i>' + h + '</i>'; if (b) h = '<b>' + h + '</b>';
          o += h; t += r.t;
        }
      }
      return { h: o, t: t };
    }
    function hasBlock(n) { return !!n.querySelector('p,div,h1,h2,ul,ol,li'); }
    function flushInline(nodes) {
      if (!nodes.length) return;
      var tmp = D.createElement('div'); nodes.forEach(function (x) { tmp.appendChild(x.cloneNode(true)); });
      var r = inl(tmp); if (r.t.trim() || r.h) { html += '<p>' + (r.h || '<br>') + '</p>'; lines.push(r.t); }
    }
    function blocks(n) {
      var run = [];
      for (var c = n.firstChild; c; c = c.nextSibling) {
        var tag = c.nodeType === 1 ? c.nodeName : '';
        if (tag === 'UL' || tag === 'OL') { flushInline(run); run = []; var lt = tag.toLowerCase(); html += '<' + lt + '>'; blocks(c); html += '</' + lt + '>'; continue; }
        if (REP_BLOCK[tag]) {
          flushInline(run); run = [];
          if ((tag === 'DIV' || tag === 'P') && hasBlock(c)) { blocks(c); continue; }
          var k = REP_BLOCK[tag], r = inl(c); r.t = r.t.replace(/\n$/, ''); html += '<' + k + '>' + (r.h || '<br>') + '</' + k + '>'; lines.push(r.t);
          if (tag === 'LI') { for (var q = c.firstChild; q; q = q.nextSibling) if (q.nodeName === 'UL' || q.nodeName === 'OL') { var l2 = q.nodeName.toLowerCase(); html += '<' + l2 + '>'; blocks(q); html += '</' + l2 + '>'; } }
          continue;
        }
        if (tag === 'BR') { flushInline(run); run = []; html += '<p><br></p>'; lines.push(''); continue; }
        run.push(c);
      }
      flushInline(run);
    }
    blocks(root);
    return { html: html, text: lines.join('\n').replace(/\u00a0/g, ' ').replace(/\s+$/, '') };
  }
  function repHtmlOf(m) {
    if (m.minutesHtml) return m.minutesHtml;
    var ls = String(m.minutes || '').split(/\r?\n/);
    return ls.map(function (l) { return '<p>' + (l ? esc(l) : '<br>') + '</p>'; }).join('') || '<p><br></p>';
  }

  function renderReports() {
    var f = A.rf || (A.rf = { q: '', all: false, key: 'changed', dir: -1 }), q = f.q.toLowerCase();
    var list = A.data.meetings.filter(function (m) {
      if (!f.all && !(m.minutes || '').trim()) return false;
      return !q || [m.title, m.minutes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var key = f.key, dir = f.dir;
    list.sort(function (a, b) {
      var x, y;
      if (key === 'name') { x = (a.title || '').toLowerCase(); y = (b.title || '').toLowerCase(); }
      else if (key === 'date') { x = (a.date || '') + ' ' + (a.start || ''); y = (b.date || '') + ' ' + (b.start || ''); }
      else { x = a.minutesUpdated || ''; y = b.minutesUpdated || ''; }
      var r = x < y ? -1 : x > y ? 1 : 0;
      return (r || (a.title || '').localeCompare(b.title || '', 'nl')) * (r ? dir : 1);
    });
    var cols = [['name', 'Naam'], ['date', 'Datum'], ['changed', 'Gewijzigd']];
    var h = '<div class="head"><h1>Verslagen</h1></div><section class="card"><div class="filters"><input id="rq" type="search" placeholder="Zoeken in verslagen…" value="' + esc(f.q) + '">' +
      '<label class="chk"><input type="checkbox" id="rall"' + (f.all ? ' checked' : '') + '> Ook vergaderingen zonder aantekeningen</label></div>';
    h += '<div class="tw"><table><thead><tr>' + cols.map(function (c) { var on = f.key === c[0]; return '<th class="' + (on ? 'on' : '') + '" data-rsort="' + c[0] + '">' + c[1] + '<i>' + (on ? (f.dir < 0 ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '</tr></thead><tbody>';
    h += list.length ? list.map(function (m) {
      var chg = m.minutesUpdated ? new Date(m.minutesUpdated) : null;
      return '<tr class="rrow" data-rid="' + esc(m.id) + '"><td><b>' + esc(m.title || 'Vergadering') + '</b></td><td>' + esc(fmtShort(m.date)) + '</td><td>' + (chg ? esc(pad(chg.getDate()) + '-' + pad(chg.getMonth() + 1) + '-' + chg.getFullYear() + ' ' + pad(chg.getHours()) + ':' + pad(chg.getMinutes())) : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="3" class="empty">' + (A.data.meetings.length ? 'Geen verslagen gevonden. Maak aantekeningen bij een vergadering, of vink hierboven de vergaderingen zonder aantekeningen aan.' : 'Nog geen vergaderingen.') + '</td></tr>';
    h += '</tbody></table></div><p class="note">' + list.length + ' verslag' + (list.length === 1 ? '' : 'en') + ' · Klik op een kolomkop om te sorteren, en op een verslag om het te bewerken.</p></section>';
    setHTML($('#main'), h);
    $$('[data-rsort]').forEach(function (th) { th.onclick = function () { var k = th.dataset.rsort; f.dir = f.key === k ? -f.dir : (k === 'name' ? 1 : -1); f.key = k; renderReports(); }; });
    $$('.rrow').forEach(function (r) { r.onclick = function () { location.hash = '#/verslag/' + encodeURIComponent(r.dataset.rid); }; });
    var qi = $('#rq'); qi.oninput = function () { f.q = qi.value; var pos = qi.selectionStart; renderReports(); var n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#rall').onchange = function () { f.all = this.checked; renderReports(); };
  }

  /* Webadressen in de editor als link tonen. Bij het opslaan blijft alleen de tekst bewaard; bij het openen worden het weer links. */
  function caretOff(root) { var s = W.getSelection(); if (!s.rangeCount || !root.contains(s.anchorNode)) return -1; var r = D.createRange(); r.selectNodeContents(root); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length; }
  function setCaretOff(root, off) {
    if (off < 0) return; var w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, left = off;
    while ((n = w.nextNode())) { if (left <= n.nodeValue.length) { var r = D.createRange(); r.setStart(n, left); r.collapse(true); var s = W.getSelection(); s.removeAllRanges(); s.addRange(r); return; } left -= n.nodeValue.length; }
  }
  function linkify(root) {
    var changed = false;
    /* links waarvan de tekst geen webadres meer is, weer gewone tekst maken */
    $$('a', root).forEach(function (a) { var tx = a.textContent; if (!/^(?:https?:\/\/|www\.)\S+$/i.test(tx)) { a.replaceWith(D.createTextNode(tx)); changed = true; } else if (a.getAttribute('href') !== hrefOf(tx)) a.setAttribute('href', hrefOf(tx)); });
    root.normalize();
    var w = D.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) if (!(n.parentElement && n.parentElement.closest('a')) && urlRe().test(n.nodeValue)) list.push(n);
    list.forEach(function (node) {
      var tx = node.nodeValue, re = urlRe(), m, last = 0, frag = D.createDocumentFragment();
      while ((m = re.exec(tx))) {
        if (m.index > last) frag.appendChild(D.createTextNode(tx.slice(last, m.index)));
        var a = D.createElement('a'); a.href = hrefOf(m[0]); a.target = '_blank'; a.rel = 'noopener'; a.title = 'Klik om te openen in een nieuw tabblad'; a.textContent = m[0]; frag.appendChild(a); last = m.index + m[0].length;
      }
      if (last < tx.length) frag.appendChild(D.createTextNode(tx.slice(last)));
      node.replaceWith(frag); changed = true;
    });
    return changed;
  }
  /* Word-achtige editor. opts: html, status, actions (knop ! Actie), foot, onSave(r) (async), download(r) */
  function repEditor(box, opts) {
    var ribbon = el2('div', 'ribbon rb-rep'), st = el2('span', 'edst');
    var sel = el2('select', 'rsel'); sel.title = 'Stijl';
    [['p', 'Normale tekst'], ['h1', 'Kop 1'], ['h2', 'Kop 2']].forEach(function (o) { var op = el2('option', null, o[1]); op.value = o[0]; sel.appendChild(op); });
    var bB = btn('B', 'Vet (Ctrl+B)', 'b'), bI = btn('I', 'Cursief (Ctrl+I)', 'i'), bU = btn('U', 'Onderstreept (Ctrl+U)', 'u'), bUl = btn('• Lijst', 'Opsomming'), bOl = btn('1. Lijst', 'Genummerde lijst'), un = btn('↶', 'Ongedaan maken (Ctrl+Z)'), re = btn('↷', 'Opnieuw (Ctrl+Y)'), bAct = opts.actions ? btn('! Actie', 'Begin deze regel met ! zodat de regel in de Actielijst komt') : null;
    var dlB = btn('⤓ Tekstbestand', 'Download als tekstbestand');
    [un, re, null, sel, null, bB, bI, bU, null, bUl, bOl].concat(bAct ? [null, bAct] : []).concat([null, dlB]).forEach(function (x) { ribbon.appendChild(x || sepEl()); });
    ribbon.appendChild(el2('span', 'rsp')); ribbon.appendChild(st);
    var body = el2('div', 'edbody eb-rep'), ed = el2('div', 'docx-ed rep-ed'), foot = el2('div', 'edfoot');
    ed.contentEditable = 'true'; ed.spellcheck = true; ed.lang = 'nl';
    setHTML(ed, opts.html || '<p><br></p>'); linkify(ed); try { D.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    body.appendChild(ed); foot.appendChild(el2('span', null, opts.foot || '')); foot.appendChild(el2('span', 'edtip', 'Wijzigingen worden automatisch bewaard.'));
    box.appendChild(ribbon); box.appendChild(body); box.appendChild(foot);
    var t = null;
    function status(txt, cls) { st.textContent = txt; st.className = 'edst' + (cls ? ' ' + cls : ''); }
    async function save() { t = null; await opts.onSave(repSerialize(ed)); status('Opgeslagen ✓', 'ok'); }
    function queue() { status('Opslaan…'); clearTimeout(t); t = setTimeout(save, 800); }
    function flush() { if (t) { clearTimeout(t); return save(); } return Promise.resolve(); }
    function cmd(c, v) { ed.focus(); D.execCommand(c, false, v || null); queue(); refresh(); }
    function refresh() {
      var b = D.queryCommandValue('formatBlock').toLowerCase().replace(/[<>]/g, '');
      sel.value = b === 'h1' || b === 'h2' ? b : 'p';
      bB.classList.toggle('on', D.queryCommandState('bold')); bI.classList.toggle('on', D.queryCommandState('italic')); bU.classList.toggle('on', D.queryCommandState('underline'));
      bUl.classList.toggle('on', D.queryCommandState('insertUnorderedList')); bOl.classList.toggle('on', D.queryCommandState('insertOrderedList'));
    }
    bB.onclick = function () { cmd('bold'); }; bI.onclick = function () { cmd('italic'); }; bU.onclick = function () { cmd('underline'); };
    bUl.onclick = function () { cmd('insertUnorderedList'); }; bOl.onclick = function () { cmd('insertOrderedList'); };
    un.onclick = function () { cmd('undo'); }; re.onclick = function () { cmd('redo'); };
    sel.onchange = function () { cmd('formatBlock', sel.value === 'p' ? 'P' : sel.value.toUpperCase()); };
    if (bAct) bAct.onclick = function () { ed.focus(); var s = W.getSelection(); if (!s.rangeCount) return; var bl = s.anchorNode; while (bl && bl !== ed && !(bl.nodeType === 1 && /^(P|DIV|H1|H2|LI)$/.test(bl.nodeName))) bl = bl.parentNode; if (!bl || bl === ed) { D.execCommand('insertText', false, '! '); } else if (!/^\s*!/.test(bl.textContent)) { var r = D.createRange(); r.setStart(bl, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); D.execCommand('insertText', false, '! '); } queue(); };
    dlB.onclick = function () { opts.download(repSerialize(ed)); };
    ed.addEventListener('input', queue);
    ed.addEventListener('keyup', refresh); ed.addEventListener('mouseup', refresh);
    /* links maken en de cursor terugzetten. Staat de cursor in een knoop die niet veranderd is (bijvoorbeeld een nieuwe, lege regel na Enter),
       dan blijft hij precies daar; anders via de tekstpositie. */
    function relink() {
      var s = W.getSelection(), n = s.rangeCount ? s.anchorNode : null, o = s.anchorOffset, off = caretOff(ed);
      if (!linkify(ed)) return;
      if (n && n.isConnected && ed.contains(n)) { try { var r = D.createRange(); r.setStart(n, Math.min(o, n.nodeType === 3 ? n.nodeValue.length : n.childNodes.length)); r.collapse(true); s.removeAllRanges(); s.addRange(r); return; } catch (e) {} }
      setCaretOff(ed, off);
    }
    ed.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') relink(); });
    ed.addEventListener('blur', relink);
    /* een link aanklikken opent hem in een nieuw tabblad */
    ed.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a'); if (a && ed.contains(a)) { e.preventDefault(); W.open(a.href, '_blank', 'noopener'); } });
    ed.addEventListener('keydown', function (e) { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); clearTimeout(t); save(); } });
    ed.addEventListener('paste', function (e) { e.preventDefault(); var tx = (e.clipboardData || W.clipboardData).getData('text/plain'); D.execCommand('insertText', false, tx); relink(); });
    ed.addEventListener('drop', function (e) { e.preventDefault(); });
    status(opts.status || '');
    return { ed: ed, flush: flush, text: function () { return repSerialize(ed).text; } };
  }
  /* Een tekst mailen. Kort: via mailto, dan opent Outlook direct een nieuwe mail. Lang (een mailto-link kan maar weinig tekst meegeven):
     een conceptmail (.eml) met de hele tekst; die opent in Outlook als nieuwe mail. */
  var MAILTO_MAX = 1800;
  function draftEml(subject, text) {
    var body = String(text || '').replace(/\r?\n/g, '\r\n');
    var o = ['To: ', 'Subject: ' + encWord(subject), 'X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64Lines(new TextEncoder().encode(body)), ''];
    return new Blob([o.join('\r\n')], { type: 'message/rfc822' });
  }
  async function mailText(subject, text) {
    var body = String(text || '').replace(/\r?\n/g, '\r\n');
    var url = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    if (url.length <= MAILTO_MAX) {
      W.__lastMailto = url; /* voor tests */
      location.href = url;
      toast('Outlook opent een nieuwe mail met de tekst. Vul de ontvanger in.', 'ok');
      return;
    }
    var name = safe('Mail - ' + subject.replace(/\s*:\s*/g, ' - ')).slice(0, 120) + '.eml';
    W.__lastMailto = null; W.__lastDraft = { name: name, subject: subject, text: text }; /* voor tests */
    dl(draftEml(subject, text), name);
    toast('De tekst is te lang om direct door te geven. Open het gedownloade bestand "' + name + '" (onderaan of in Downloads): Outlook opent dan een nieuwe mail met de hele tekst.', 'ok');
  }
  /* De aantekeningen, met één regel over de vergadering erboven. Eerst de besluiten (=), dan de acties (!), dan de overige regels in typvolgorde.
     Meeneempunten (>) zijn privé en gaan niet mee. Zonder besluiten en acties: alleen de aantekeningen, zonder kopjes. */
  function minutesMailText(m) {
    var head = 'Aantekeningen ' + (m.title || 'vergadering') + (m.date ? ', ' + fmtLong(m.date) + (m.start ? ' ' + m.start : '') : '');
    var dec = [], act = [], rest = [];
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) {
      var c;
      if (PT_RE.test(l)) return;
      if ((c = DEC_RE.exec(l))) dec.push('- ' + c[1]);
      else if ((c = ACT_RE.exec(l))) act.push('- ' + c[2]);
      else rest.push(l);
    });
    if (!dec.length && !act.length) return head + '\n\n' + rest.join('\n').replace(/\s+$/, '');
    var body = rest.join('\n').replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
    var o = [head];
    if (dec.length) o.push('', 'Besluiten', dec.join('\n'));
    if (act.length) o.push('', 'Acties', act.join('\n'));
    if (body.trim()) o.push('', 'Aantekeningen', body);
    return o.join('\n');
  }
  function mailMinutes(m) { return mailText('Aantekeningen: ' + (m.title || 'Vergadering') + (m.date ? ' (' + fmtShort(m.date) + ')' : ''), minutesMailText(m)); }
  function renderReport(m) {
    var h = '<div class="head"><h1>' + esc(m.title || 'Vergadering') + ' <span class="muted rdate">' + esc(fmtShort(m.date)) + '</span></h1><div class="acts"><button type="button" class="btn" id="repMail" title="Het verslag mailen; Outlook opent een nieuwe mail">✉ Mailen</button><a class="btn" href="#/v/' + esc(encodeURIComponent(m.id)) + '">Naar vergadering</a><a class="btn" href="#/verslagen">Terug naar verslagen</a></div></div>';
    h += '<section class="card repcard"><div class="edwrap" id="repbox"></div></section>';
    setHTML($('#main'), h);
    var E = repEditor($('#repbox'), {
      html: repHtmlOf(m), actions: true, foot: 'Begin een regel met ! voor een actie (komt in de Actielijst), = voor een besluit, > voor een meeneempunt (> MT: punt).',
      status: m.minutesUpdated ? 'Laatst gewijzigd ' + new Date(m.minutesUpdated).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      onSave: async function (r) { m.minutesHtml = r.html; m.minutes = r.text; await saveMinutes(m); },
      download: function (r) { m.minutes = r.text; dl(new Blob(['﻿' + minutesText(m)], { type: 'text/plain' }), minutesFileName(m)); }
    });
    A.flushNotes = E.flush;
    $('#repMail').onclick = async function () { await E.flush(); mailMinutes(m); };
    E.ed.focus();
  }
