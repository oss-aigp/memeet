  /* ================================================================== Annotatie van een medewerker
     Een memo met advies (.docx, .txt of een mail). MeMeet zet de platte tekst ervan onderaan de aantekeningen; de terugkoppeling
     typ je er zelf onder, en mailen gaat met de gewone knop Mail. Regels met > of ? blijven daarbij privé, zoals altijd. */

  /* de tekst van een Word-document, per alinea; genummerde alinea's krijgen hun nummer */
  async function annDocxText(bytes) {
    var z = await JSZip.loadAsync(bytes), mf = z.file('word/document.xml');
    if (!mf) throw new Error('Geen Word-document');
    var x = xmlDoc(await mf.async('string')), numKind = {}, nf = z.file('word/numbering.xml');
    if (nf) {
      var nx = xmlDoc(await nf.async('string')), abs = {};
      desc(nx, 'abstractNum').forEach(function (a) { var lv = kids(a).filter(function (l) { return l.localName === 'lvl'; })[0]; abs[a.getAttribute('w:abstractNumId')] = lv ? wv(ch(lv, 'numFmt')) : ''; });
      desc(nx, 'num').forEach(function (n) { numKind[n.getAttribute('w:numId')] = abs[wv(ch(n, 'abstractNumId'))] || ''; });
    }
    var out = [], cnt = {};
    desc(x, 'p').forEach(function (p) {
      var txt = desc(p, 't').map(function (t) { return t.textContent; }).join('').replace(/\s+/g, ' ').trim(); if (!txt) return;
      var numPr = ch(ch(p, 'pPr'), 'numPr');
      if (numPr && wv(ch(numPr, 'numId')) !== '0') {
        var id = wv(ch(numPr, 'numId')), lvl = +(wv(ch(numPr, 'ilvl')) || 0);
        if (numKind[id] === 'bullet') { out.push((lvl ? '  ' : '') + '- ' + txt); return; }
        if (!lvl) { cnt[id] = (cnt[id] || 0) + 1; out.push(cnt[id] + '. ' + txt); return; }
      }
      out.push(txt);
    });
    return out.join('\n');
  }
  /* de platte tekst van een annotatiebestand; bij een mail met de afzender erboven */
  async function annText(f) {
    var n = f.name || '';
    if (/\.docx$/i.test(n)) return annDocxText(await f.arrayBuffer());
    if (/\.(eml|msg)$/i.test(n)) { var mm = await readMail(f, n); return (mm.from && !/^\s*van\s*:/im.test(mm.text || '') ? 'Van: ' + mm.from + '\n' : '') + String(mm.text || '').trim(); }
    return (await f.text()).replace(/^﻿/, '');
  }
  /* onderaan de aantekeningen zetten, met een witregel ervoor, en het tekstvak meteen bijwerken */
  async function annInsert(m, f, text) {
    var body = String(text || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!body) { toast('In dit bestand vond MeMeet geen tekst.', 'warn'); return; }
    var ta = currentMeeting() === m ? $('#npt') : null, cur = ta ? ta.value : String(m.minutes || ''), pre = cur.trim() ? (/\n\n$/.test(cur) ? '' : /\n$/.test(cur) ? '\n' : '\n\n') : '';
    var nv = cur + pre + 'Annotatie: ' + (f.name || 'bestand') + '\n' + body + '\n';
    if (ta) { ta.value = nv; ta.focus(); ta.setSelectionRange(nv.length, nv.length); ta.scrollTop = ta.scrollHeight; ta.dispatchEvent(new Event('input')); }
    else { m.minutes = nv; delete m.minutesHtml; await saveMinutes(m); }
    toast('De tekst van de annotatie staat onderaan je aantekeningen. Zet je terugkoppeling eronder.', 'ok');
  }
  function closeAnnDlg() { var d = $('#annDlg'); if (d) d.remove(); }
  function annUpload(m) {
    closeAnnDlg();
    var bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'annDlg';
    setHTML(bg, '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="annDlgT"><div class="vvhead"><div><h2 id="annDlgT">Annotatie toevoegen</h2><p class="muted">De tekst komt onderaan je aantekeningen</p></div><button type="button" class="vvx" id="annX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="anndz" id="annDz">Sleep het bestand hierheen, of <label class="btn pri sm">Kies bestand…<input type="file" id="annF" accept=".docx,.txt,.md,.eml,.msg" hidden></label>' +
      '<p class="muted">Word (.docx), tekst (.txt) of een mail (.eml of .msg).</p></div></div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeAnnDlg(); });
    $('#annX', bg).onclick = closeAnnDlg;
    async function take(f) {
      if (!f) return;
      try { var t = await annText(f); closeAnnDlg(); await annInsert(m, f, t); }
      catch (e) { console.error(e); toast('Dit bestand kon MeMeet niet lezen. Probeer een .docx, .txt of een mail.', 'err'); }
    }
    $('#annF', bg).onchange = function () { take(this.files[0]); };
    var dz = $('#annDz', bg);
    dz.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add('on'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('on'); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove('on'); take(e.dataTransfer.files[0]); });
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#annDlg')) { e.preventDefault(); e.stopPropagation(); closeAnnDlg(); } }, true);
  W.addEventListener('hashchange', closeAnnDlg);

  /* Versie 1.5 bewaarde een annotatie apart (m.annotation, met terugkoppeling per agendapunt). Die zetten we eenmalig om naar
     platte tekst onderaan de aantekeningen; er gaat niets verloren. Geeft true als er iets is omgezet. */
  function migrateAnnotations() {
    var n = 0;
    A.data.meetings.forEach(function (m) {
      var a = m.annotation; if (!a) return;
      if (a.items && a.items.length) {
        var t = 'Annotatie: ' + (a.file || 'annotatie') + (a.from ? '\nVan: ' + a.from : '') + '\n' + a.items.map(function (x) { return [x.t, x.body, String(x.fb || '').trim()].filter(Boolean).join('\n'); }).join('\n\n');
        var cur = String(m.minutes || ''); m.minutes = cur + (cur.trim() ? (/\n$/.test(cur) ? '\n' : '\n\n') : '') + t + '\n'; delete m.minutesHtml;
      }
      delete m.annotation; n++;
    });
    return n > 0;
  }
