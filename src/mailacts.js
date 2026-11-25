  /* ================================================================== Mails op de actielijst
     Een mail die je op de Actielijst sleept, wordt een losse actie: het onderwerp is de tekst van de actie.
     De mail zelf wordt bewaard (in de datamap onder Actielijst › Mails); de bijlagen worden bij het openen uit de mail gehaald.
     Klik je op zo'n actie, dan toont een viewer de mail en de bijlagen. */
  function actBox(x) { return { id: 'act-' + x.id, folder: x.mail.folder, sub: 'act', files: [{ name: x.mail.file }] }; }
  async function addMailActions(files) {
    var n = 0, last = null;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      try {
        var mm = await readMail(f, f.name);
        var subj = (cleanSubject(mm.subject || '') || mm.subject || '').trim() || String(f.name || 'Mail').replace(/\.[^.]+$/, '');
        var x = { id: 'L' + uid(), text: subj, created: new Date().toISOString() };
        var name = safe(f.name || 'mail.eml'); if (!/\.(msg|eml)$/i.test(name)) name += /outlook/i.test(f.type || '') ? '.msg' : '.eml';
        x.mail = { file: name, type: f.type || guessMime(name), size: f.size, from: mm.from || '', sent: mm.sent && !isNaN(mm.sent) ? mm.sent.toISOString() : '',
          folder: safe(subj).slice(0, 60) + ' [' + x.id.slice(-4) + ']', atts: mm.attachments.filter(function (a) { return !a.inline; }).length };
        var box = actBox(x);
        try { await A.store.put(box, name, f); }
        catch (e) { x.mail.file = name = safe(name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')); box = actBox(x); await A.store.put(box, name, f); }
        (A.data.todo || (A.data.todo = [])).push(x); n++; last = x;
      } catch (e) { console.error(e); toast('Kon "' + f.name + '" niet lezen als mail: ' + (e.message || e), 'err'); }
    }
    if (!n) return;
    var af = A.af || (A.af = { show: 'open', q: '' }); if (af.show !== 'alle' && af.show !== 'open') af.show = 'open';
    await saveActions(null);
    toast(n === 1 ? 'Actie toegevoegd: "' + last.text + '". Klik erop om de mail te lezen.' : n + ' acties toegevoegd uit mails.', 'ok');
    if (location.hash === '#/acties') renderActions();
  }
  async function dropMailAction(x) { if (!x || !x.mail) return; try { await A.store.delMeeting(actBox(x)); } catch (e) { console.warn(e); } }

  /* ---------- viewer: de mail en de bijlagen */
  var MA = { tok: 0, pdf: null };
  function closeMailAct() {
    if (MA.ed && MA.ed.isDirty() && !confirm('Je hebt wijzigingen in het bestand die nog niet zijn opgeslagen. Weggooien?')) return false;
    MA.ed = null;
    var d = $('#maDlg'); if (d) d.remove();
    if (MA.pdf) { try { MA.pdf.destroy(); } catch (e) {} MA.pdf = null; }
    MA.tok++; MA.items = null;
    if (MA.focus && MA.focus.isConnected) { try { MA.focus.focus(); } catch (e) {} } MA.focus = null;
  }
  async function openMailAct(x) {
    if (closeMailAct() === false) return;
    MA.focus = D.activeElement;
    var bg = D.createElement('div'); bg.className = 'dlgbg mabg'; bg.id = 'maDlg';
    var sent = x.mail.sent ? new Date(x.mail.sent) : null;
    var sub = [x.mail.from ? 'Van ' + x.mail.from : '', sent && !isNaN(sent) ? sent.toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : ''].filter(Boolean).join(' · ');
    setHTML(bg, '<div class="dlg ma" role="dialog" aria-modal="true" aria-label="Actie uit een mail">' +
      '<div class="mahead"><span class="maic" aria-hidden="true">' + ic('mail') + '</span><div class="mattl"><input id="maT" class="matitle" value="' + esc(x.text) + '" aria-label="Tekst van de actie" title="Tekst van de actie; je kunt hem hier aanpassen"><small class="muted">' + esc(sub) + '</small></div>' +
      '<button type="button" class="btn sm" id="maDl" title="Het geselecteerde bestand downloaden">' + ic('download') + ' Download</button><button type="button" class="vvx" id="maX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="mabody"><ul class="malist" id="maList"><li class="muted">Mail wordt gelezen…</li></ul><div class="mapv" id="maPv"><div class="pvmsg">Even geduld…</div></div></div></div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeMailAct(); });
    $('#maX', bg).onclick = closeMailAct;
    var ti = $('#maT', bg);
    ti.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') ti.blur(); else if (e.key === 'Escape') { ti.value = x.text; closeMailAct(); } });
    ti.addEventListener('change', async function () { var v = ti.value.trim(); if (!v) { ti.value = x.text; return; } if (v === x.text) return; x.text = v; await saveActions(null); if (location.hash === '#/acties') renderActions(); });
    var blob;
    try { blob = await A.store.get(actBox(x), x.mail.file); } catch (e) { setHTML($('#maPv', bg), '<div class="pvmsg">De mail is niet meer gevonden in de datamap.</div>'); setHTML($('#maList', bg), ''); return; }
    var items = await expandFiles([{ name: x.mail.file, type: x.mail.type || guessMime(x.mail.file), blob: blob }]);
    if (!$('#maDlg')) return;
    MA.items = items;
    setHTML($('#maList', bg), items.map(function (it, i) {
      return '<li><button type="button" data-mi="' + i + '" title="' + esc(it.name) + '"><span class="mii" aria-hidden="true">' + (i ? (isMailItem(it) ? '' + ic('mail') + '' : '' + ic('attach_file') + '') : '' + ic('mail') + '') + '</span><span class="fn">' + esc(i ? it.name : 'Mail') + '</span>' + (i ? '<small class="muted">' + esc(kb(it.blob ? it.blob.size : it.size || 0)) + '</small>' : '') + '</button></li>';
    }).join('') + (items.length > 1 ? '' : '<li class="muted manone">Geen bijlagen</li>'));
    $$('[data-mi]', bg).forEach(function (b) { b.onclick = function () { showMailItem(+b.dataset.mi); }; });
    $('#maDl', bg).onclick = function () { var it = MA.items && MA.items[MA.cur || 0]; if (it) dl(it.blob, it.name); };
    showMailItem(0);
  }
  /* Dezelfde viewer als pop-up voor bestanden (tabblad Bestanden): links de bestanden, rechts het bestand. Esc sluit hem.
     items: [{ name, size, get() }], start: het bestand dat eerst getoond wordt. */
  function openFilePopup(items, start, title) {
    if (closeMailAct() === false) return;
    MA.focus = D.activeElement;
    var bg = D.createElement('div'); bg.className = 'dlgbg mabg'; bg.id = 'maDlg';
    var it0 = items[start || 0];
    setHTML(bg, '<div class="dlg ma" role="dialog" aria-modal="true" aria-labelledby="maT">' +
      '<div class="mahead"><span class="maic" aria-hidden="true">' + ic('description') + '</span><div class="mattl"><b id="maT" class="mastatic">' + esc(title || it0.name) + '</b><small class="muted" id="maSub">' + esc(items.length > 1 ? items.length + ' bestanden' : (it0.sub || '')) + '</small></div>' +
      '<button type="button" class="btn sm" id="maEd" hidden title="Het bestand hier bewerken (Word, Excel, PowerPoint of tekst)">' + ic('edit') + ' Bewerken</button><button type="button" class="btn sm" id="maDl" title="Het getoonde bestand downloaden">' + ic('download') + ' Download</button><button type="button" class="vvx" id="maX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="mabody' + (items.length > 1 ? '' : ' one') + '"><ul class="malist" id="maList">' + items.map(function (it, i) {
        return '<li><button type="button" data-mi="' + i + '" title="' + esc(it.name) + '"><span class="mii" aria-hidden="true">' + ic(isMailItem(it) ? 'mail' : 'description') + '</span><span class="fn">' + esc(it.name) + '</span>' + (it.size ? '<small class="muted">' + esc(kb(it.size)) + '</small>' : '') + '</button></li>';
      }).join('') + '</ul><div class="mapv" id="maPv"><div class="pvmsg">Even geduld…</div></div></div></div>');
    D.body.appendChild(bg);
    MA.items = items;
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeMailAct(); });
    $('#maX', bg).onclick = closeMailAct;
    $$('[data-mi]', bg).forEach(function (b) { b.onclick = function () { if (MA.ed && MA.ed.isDirty() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Weggooien?')) return; MA.ed = null; showMailItem(+b.dataset.mi); if (items.length > 1) $('#maT').textContent = items[+b.dataset.mi].name; }; });
    $('#maDl', bg).onclick = async function () { var it = MA.items && MA.items[MA.cur || 0]; if (it) dl(it.blob || await it.get(), it.name); };
    /* bewerken (alleen een stuk van een vergadering in een formaat dat MeMeet kan bewerken) */
    $('#maEd', bg).onclick = async function () {
      var it = MA.items[MA.cur || 0], pv = $('#maPv'), b = $('#maEd');
      if (MA.ed) { if (MA.ed.isDirty() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Weggooien?')) return; MA.ed = null; it.blob = null; showMailItem(MA.cur || 0); return; }
      MA.tok++; if (MA.pdf) { try { MA.pdf.destroy(); } catch (e) {} MA.pdf = null; }
      pv.classList.add('editing'); setHTML(pv, '<div class="edwrap" id="maEdw"></div>');
      setHTML(b, ic('visibility') + ' Bekijken'); b.title = 'Terug naar bekijken';
      MA.ed = await mountEditor(it.m, it.rec, $('#maEdw'), function () {}) || null;
      it.blob = null;
    };
    try { $('#maX', bg).focus(); } catch (e) {}
    showMailItem(start || 0);
  }
  async function showMailItem(i) {
    var it = MA.items && MA.items[i], pv = $('#maPv'); if (!it || !pv) return;
    MA.cur = i; var tok = ++MA.tok;
    $$('#maList [data-mi]').forEach(function (b) { b.classList.toggle('on', +b.dataset.mi === i); });
    pv.classList.remove('editing');
    var eb = $('#maEd'); if (eb) { eb.hidden = !(it.m && it.rec && canEdit(it.rec)); setHTML(eb, ic('edit') + ' Bewerken'); eb.title = 'Het bestand hier bewerken (Word, Excel, PowerPoint of tekst)'; }
    if (MA.pdf) { try { MA.pdf.destroy(); } catch (e) {} MA.pdf = null; }
    setHTML(pv, '<div class="pvmsg">Wordt klaargemaakt…</div>');
    var out = null;
    try { if (!it.blob) it.blob = await it.get(); var r = await convertToPdf(it.name, it.type || guessMime(it.name), it.blob); if (r) out = r.how === 'origineel' ? it.blob : new Blob([r.bytes], { type: 'application/pdf' }); } catch (e) { console.error(e); }
    if (tok !== MA.tok) return;
    if (!out) { setHTML(pv, '<div class="pvmsg">Dit bestand kan de viewer niet tonen.<br><small>Download het en open het in het programma dat erbij hoort.</small><br><button type="button" class="btn" id="maDl2">' + ic('download') + ' Download</button></div>'); $('#maDl2').onclick = function () { dl(it.blob, it.name); }; return; }
    var pdf;
    try { pdf = await W.pdfjsLib.getDocument(pdfOpts(new Uint8Array(await out.arrayBuffer()))).promise; }
    catch (e) { if (tok === MA.tok) setHTML(pv, '<div class="pvmsg">Dit bestand kan niet worden getoond (' + esc(e.message || e) + ').</div>'); return; }
    if (tok !== MA.tok) { pdf.destroy(); return; }
    MA.pdf = pdf; pv.textContent = ''; pv.scrollTop = 0;
    var width = Math.max(320, pv.clientWidth - 40), dpr = W.devicePixelRatio || 1;
    for (var n = 1; n <= pdf.numPages; n++) {
      var pg = await pdf.getPage(n); if (tok !== MA.tok) return;
      var base = pg.getViewport({ scale: 1 }), sc = Math.min(width / base.width, 1.6), vp = pg.getViewport({ scale: sc * dpr });
      var cv = D.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height); cv.style.width = Math.floor(vp.width / dpr) + 'px'; cv.style.height = Math.floor(vp.height / dpr) + 'px'; cv.className = 'mapg';
      pv.appendChild(cv);
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#maDlg') && !e.target.closest('.edbody')) { e.preventDefault(); e.stopPropagation(); closeMailAct(); } }, true);
  W.addEventListener('hashchange', function () { if ($('#maDlg')) closeMailAct(); });
