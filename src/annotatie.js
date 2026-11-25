  /* ================================================================== Annotatie van een medewerker
     Een memo met advies per agendapunt (.docx, .txt of een mail). MeMeet herkent de agendapunten aan nummering ("1.", "2)"),
     Word-kopstijlen of "Agendapunt …"; "Van: …" (of de afzender van de mail) bepaalt van wie hij is. Per agendapunt is er een vak
     "Wat ik heb ingebracht…". Regels daarin die met > of ? beginnen, zijn meeneempunten en ideeën (zie inbreng.js) en gaan nooit
     mee in de mail terug. Opslag per vergadering: m.annotation = { from, mail, file, items: [{ t, body, fb }], added }. */

  /* de tekst van een Word-document, per alinea; koppen krijgen "# " en genummerde alinea's hun nummer */
  async function annDocxText(bytes) {
    var z = await JSZip.loadAsync(bytes), mf = z.file('word/document.xml');
    if (!mf) throw new Error('Geen Word-document');
    var x = xmlDoc(await mf.async('string')), styleNames = {}, sf = z.file('word/styles.xml'), numKind = {}, nf = z.file('word/numbering.xml');
    if (sf) desc(xmlDoc(await sf.async('string')), 'style').forEach(function (s) { styleNames[s.getAttribute('w:styleId')] = wv(ch(s, 'name')).toLowerCase(); });
    if (nf) {
      var nx = xmlDoc(await nf.async('string')), abs = {};
      desc(nx, 'abstractNum').forEach(function (a) { var lv = kids(a).filter(function (l) { return l.localName === 'lvl'; })[0]; abs[a.getAttribute('w:abstractNumId')] = lv ? wv(ch(lv, 'numFmt')) : ''; });
      desc(nx, 'num').forEach(function (n) { numKind[n.getAttribute('w:numId')] = abs[wv(ch(n, 'abstractNumId'))] || ''; });
    }
    var out = [], cnt = {};
    desc(x, 'p').forEach(function (p) {
      var txt = desc(p, 't').map(function (t) { return t.textContent; }).join('').replace(/\s+/g, ' ').trim(); if (!txt) return;
      var pPr = ch(p, 'pPr'), sname = styleNames[wv(ch(pPr, 'pStyle'))] || wv(ch(pPr, 'pStyle')).toLowerCase(), numPr = ch(pPr, 'numPr');
      if (/heading|kop|title|titel/.test(sname)) { out.push('# ' + txt); return; }
      if (numPr && wv(ch(numPr, 'numId')) !== '0' && +(wv(ch(numPr, 'ilvl')) || 0) === 0 && numKind[wv(ch(numPr, 'numId'))] !== 'bullet') { var id = wv(ch(numPr, 'numId')); cnt[id] = (cnt[id] || 0) + 1; out.push(cnt[id] + '. ' + txt); return; }
      out.push(txt);
    });
    return out.join('\n');
  }
  /* agendapunten herkennen */
  function annParse(text, fallbackFrom) {
    var lines = String(text || '').replace(/\r/g, '').split('\n'), from = fallbackFrom || '', items = [], cur = null, title = '';
    lines.forEach(function (l) {
      var t = l.trim(), mm; if (!t) return;
      if ((mm = /^van\s*:\s*(.+)$/i.exec(t)) && !items.length) { from = mm[1].trim(); return; }
      if (!items.length && /^(aan|datum|onderwerp|betreft)\s*:/i.test(t)) return;
      var isHead = /^#+\s*\S/.test(t) || /^\d{1,2}\s*[.)]\s+\S/.test(t) || /^agendapunt\b/i.test(t);
      if (isHead && t.length <= 120) {
        var tt = t.replace(/^#+\s*/, '').replace(/^agendapunt\s*/i, '').replace(/^(\d{1,2})\s*[.)]?\s*[:.-]?\s*/, '$1. ').trim();
        if (!items.length && /^#/.test(t) && !/^\d/.test(tt) && /^annotatie/i.test(tt)) { title = tt; return; } /* de titel van het memo zelf */
        cur = { t: tt, body: '', fb: '' }; items.push(cur); return;
      }
      if (!cur) { cur = { t: 'Algemeen', body: '', fb: '' }; items.push(cur); }
      cur.body += (cur.body ? '\n' : '') + t;
    });
    return { from: from || 'medewerker', items: items, title: title };
  }
  async function annRead(f) {
    var n = f.name || '', a;
    if (/\.docx$/i.test(n)) a = annParse(await annDocxText(await f.arrayBuffer()), n.replace(/\.[^.]+$/, ''));
    else if (/\.(eml|msg)$/i.test(n)) {
      var mm = await readMail(f, n); a = annParse(mm.text || '', mm.from || '');
      if (mm.from && !/^van\s*:/im.test(mm.text || '')) a.from = mm.from;
      a.mail = mm.fromAddr || ''; a.subject = mm.subject || '';
    } else a = annParse(await f.text(), n.replace(/\.[^.]+$/, ''));
    a.file = n; a.mail = a.mail || ((/[^\s<>"]+@[^\s<>"]+/.exec(a.from) || [])[0] || '');
    a.from = a.from.replace(/\s*<[^>]*>\s*$/, '').trim();
    return a;
  }
  function annFirst(a) { return String(a.from || '').split(/\s+/)[0] || 'medewerker'; }
  function annMailable(fb) { return ibStripPriv(fb).trim(); }
  function annProgress(a) { return a.items.filter(function (x) { return annMailable(x.fb); }).length + '/' + a.items.length; }

  /* opslaan: bij de vergadering, en het bestand ook als stuk (zodat je erin kunt markeren); een vorige annotatie vervangt hij */
  async function annSet(m, a, file) {
    var old = m.files.filter(function (f) { return f.annDoc; });
    for (var i = 0; i < old.length; i++) { try { await A.store.del(m, old[i].name); } catch (e) {} }
    m.files = m.files.filter(function (f) { return !f.annDoc; });
    var name = await addFileTo(m, file.name, file.type || guessMime(file.name), file);
    var rec = m.files.filter(function (f) { return f.name === name; })[0]; if (rec) rec.annDoc = true;
    m.annotation = { from: a.from, mail: a.mail || '', file: name, items: a.items, added: new Date().toISOString() };
    m.updated = new Date().toISOString(); await persist();
    A.npTab = A.npTab || {}; A.npTab[m.id] = 'ann';
    if (currentMeeting() === m) route();
    toast('Annotatie van ' + a.from + ' toegevoegd: ' + a.items.length + ' agendapunt' + (a.items.length === 1 ? '' : 'en') + '. Hij staat ook bij de stukken.', 'ok');
  }
  function closeAnnDlg() { var d = $('#annDlg'); if (d) d.remove(); }
  function annUpload(m) {
    closeAnnDlg();
    var bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'annDlg';
    setHTML(bg, '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="annDlgT"><div class="vvhead"><div><h2 id="annDlgT">' + (m.annotation ? 'Annotatie vervangen' : 'Annotatie toevoegen') + '</h2><p class="muted">Een memo van een medewerker met advies per agendapunt</p></div><button type="button" class="vvx" id="annX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="anndz" id="annDz">Sleep het bestand hierheen, of <label class="btn pri sm">Kies bestand…<input type="file" id="annF" accept=".docx,.txt,.md,.eml,.msg" hidden></label>' +
      '<p class="muted">Word (.docx), tekst (.txt) of een mail (.eml of .msg). MeMeet herkent de agendapunten aan nummers (1., 2)), kopjes of "Agendapunt".' + (m.annotation ? ' De huidige annotatie en je terugkoppeling worden vervangen.' : '') + '</p></div></div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeAnnDlg(); });
    $('#annX', bg).onclick = closeAnnDlg;
    async function take(f) {
      if (!f) return;
      try {
        var a = await annRead(f);
        if (!a.items.length) { toast('In dit bestand vond MeMeet geen tekst.', 'warn'); return; }
        if (m.annotation && m.annotation.items.some(function (x) { return (x.fb || '').trim(); }) && !confirm('De huidige annotatie heeft al terugkoppeling. Vervangen?')) return;
        closeAnnDlg(); await annSet(m, a, f);
      } catch (e) { console.error(e); toast('Dit bestand kon MeMeet niet lezen. Probeer een .docx, .txt of een mail.', 'err'); }
    }
    $('#annF', bg).onchange = function () { take(this.files[0]); };
    var dz = $('#annDz', bg);
    dz.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add('on'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('on'); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove('on'); take(e.dataTransfer.files[0]); });
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#annDlg')) { e.preventDefault(); e.stopPropagation(); closeAnnDlg(); } }, true);
  W.addEventListener('hashchange', closeAnnDlg);

  /* ---------- het tabblad Annotatie in de kolom aantekeningen */
  function annTabHtml(m) {
    var a = m.annotation;
    return '<div class="annwrap" id="annWrap"><div class="annh"><div><b>' + esc(a.from) + '</b><div class="muted annfile">' + esc(a.file || '') + ' · <button type="button" class="link" id="annRe" title="Een andere annotatie laden">Vervangen…</button></div></div><button type="button" class="btn sm pri" id="annMail" title="Terugkoppeling mailen naar ' + esc(a.from) + '">' + ic('mail') + ' Mail terug</button></div>' +
      '<p class="muted annintro">Per agendapunt het advies van ' + esc(annFirst(a)) + '. Zet eronder wat jij hebt ingebracht of wat er is besloten. Een regel met <code>&gt;</code> wordt een meeneempunt.</p>' +
      a.items.map(function (x, i) {
        return '<div class="ai"><div class="ait">' + esc(x.t) + '</div><div class="aib">' + esc(x.body) + '</div>' +
          '<textarea class="aifb" data-fb="' + i + '" spellcheck="true" placeholder="Wat ik heb ingebracht…" aria-label="Terugkoppeling bij ' + esc(x.t) + '">' + esc(x.fb || '') + '</textarea><div class="ac" data-annac="' + i + '" hidden></div><div class="aipv" data-aipv="' + i + '"></div></div>';
      }).join('') + '</div>';
  }
  function annPv(m, i) {
    var box = $('[data-aipv="' + i + '"]'); if (!box) return;
    var all = ibAll(), byId = {}; all.pts.forEach(function (p) { byId[p.id] = p; });
    var its = ibItemsOf(m).filter(function (it) { return it.where === 'ann' && it.ai === i; });
    /* een regel die ook in de aantekeningen staat, telt maar één keer: dan zoeken we hem hier zelf op */
    String((m.annotation.items[i] || {}).fb || '').split(/\r?\n/).forEach(function (l, li) { var it = ibParse(l, m, { people: all.people }); if (it && !its.some(function (x) { return x.id === it.id; })) { it.where = 'ann'; it.ai = i; it.al = li; its.push(it); } });
    setHTML(box, its.map(function (it) {
      if (it.k === '?') return '<div><span class="k">?</span> ' + esc(it.text) + ' <span class="to">→ Ideeën-inbox</span></div>';
      var p = byId[it.id], r = p ? p.r : ibResolve(it);
      return '<div><span class="k">&gt;</span> ' + esc(it.text) + ' ' + (r.st === 'open' ? '<span class="to go">→ ' + esc(ibName(r.m)) + '</span>' : r.st === 'done' ? '<span class="to go">' + ic('check') + ' besproken</span>' : '<span class="to wait">⏳ wacht: ' + esc(ibWaitWhy(it, all.people)) + '</span>') + '</div>';
    }).join('') + (its.length ? '<div class="why">Privé: gaat niet mee in de mail.</div>' : ''));
  }
  function annBind(m) {
    var a = m.annotation, t = null;
    function save() { clearTimeout(t); t = setTimeout(async function () { t = null; m.updated = new Date().toISOString(); await persist(); var st = $('#npst'); if (st) { setHTML(st, ic('check')); st.title = 'Opgeslagen'; st.className = 'npst ok'; } }, 600); }
    A.flushNotes = function () { if (t) { clearTimeout(t); t = null; return persist(); } };
    $$('[data-fb]').forEach(function (el) {
      var i = +el.dataset.fb, box = $('[data-annac="' + i + '"]');
      function fit() { el.style.height = 'auto'; el.style.height = Math.max(54, el.scrollHeight + 2) + 'px'; }
      fit(); annPv(m, i);
      el.addEventListener('input', function () {
        a.items[i].fb = el.value; fit(); annPv(m, i); ibAc(el, box); save();
        var c = $('#annProg'); if (c) c.textContent = annProgress(a);
        var st = $('#npst'); if (st) { st.textContent = '…'; st.className = 'npst'; }
      });
      el.addEventListener('keydown', function (e) { e.stopPropagation(); });
      el.addEventListener('blur', function () { setTimeout(function () { if (box && D.activeElement !== el) box.hidden = true; }, 150); });
    });
    $('#annMail').onclick = async function () { if (t) { clearTimeout(t); t = null; await persist(); } openAnnMail(m); };
  }

  /* ---------- mail terug: per agendapunt "Jouw annotatie" en "Terugkoppeling", zonder regels met > of ? */
  function annMailSubject(m) { return 'Terugkoppeling annotatie ' + (m.title || 'vergadering') + (m.date ? ' ' + fmtShort(m.date) : ''); }
  function annMailText(m) {
    var a = m.annotation;
    return 'Hoi ' + annFirst(a) + ',\n\nDank voor je annotatie bij het ' + (m.title || 'overleg') + (m.date ? ' van ' + fmtLong(m.date) : '') + '. Hieronder per agendapunt wat ik heb ingebracht.\n\n' +
      a.items.map(function (x) { return x.t + '\nJouw annotatie: ' + String(x.body || '').replace(/\s+/g, ' ').trim() + '\nTerugkoppeling: ' + (annMailable(x.fb) || 'Niet aan toegekomen.'); }).join('\n\n') + '\n\nGroet,';
  }
  function annPrivCount(m) { return m.annotation.items.reduce(function (n, x) { return n + String(x.fb || '').split(/\r?\n/).filter(function (l) { return ibIsPriv(l) && l.replace(/^\s*[>?]\s*/, '').trim(); }).length; }, 0); }
  function openAnnMail(m) {
    closeAnnDlg();
    var a = m.annotation, body = annMailText(m), open = a.items.filter(function (x) { return !annMailable(x.fb); }).length, priv = annPrivCount(m), subj = annMailSubject(m);
    var bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'annDlg';
    setHTML(bg, '<div class="dlg annmail" role="dialog" aria-modal="true" aria-labelledby="annMT"><div class="vvhead"><div><h2 id="annMT">Terugkoppeling mailen</h2>' +
      (open ? '<p class="annwarn">' + open + ' agendapunt' + (open === 1 ? ' heeft' : 'en hebben') + ' nog geen terugkoppeling.</p>' : '<p class="muted">Alle agendapunten hebben een terugkoppeling.</p>') + '</div><button type="button" class="vvx" id="annX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      (priv ? '<p class="why annpriv">' + priv + ' meeneempunt' + (priv === 1 ? '' : 'en') + ' uit je terugkoppeling ' + (priv === 1 ? 'blijft' : 'blijven') + ' privé en ' + (priv === 1 ? 'gaat' : 'gaan') + ' niet mee.</p>' : '') +
      '<div class="mailh"><span>Aan</span><b>' + esc(a.from) + (a.mail ? ' &lt;' + esc(a.mail) + '&gt;' : '') + '</b><span>Onderwerp</span><b>' + esc(subj) + '</b></div><pre class="ibnotes annbody">' + esc(body) + '</pre>' +
      '<div class="dlgacts"><button type="button" class="btn" id="annCopy">' + ic('content_copy') + ' Tekst kopiëren</button><span class="sp"></span><button type="button" class="btn pri" id="annOut">' + ic('mail') + ' Openen in Outlook</button></div></div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeAnnDlg(); });
    $('#annX', bg).onclick = closeAnnDlg;
    $('#annCopy', bg).onclick = async function () { try { await navigator.clipboard.writeText(body); toast('Gekopieerd.', 'ok'); } catch (e) { toast('Kopiëren lukte niet. Selecteer de tekst en druk op Ctrl+C.', 'warn'); } };
    $('#annOut', bg).onclick = function () { closeAnnDlg(); mailText(subj, body, a.mail || ''); };
  }
