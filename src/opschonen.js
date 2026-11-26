  /* MeMeet - opschonen: één keer per jaar (in de laatste week van december) alle gegevens verwijderen, behalve de herinneringspunten die
     aan een overleg gekoppeld zijn of op een overleg wachten, en de ideeën. Aantekeningen in MeMeet zijn persoonlijke werkaantekeningen;
     die horen niet langer bewaard te worden dan nodig. */

  /* de laatste week van december: 25 tot en met 31 december */
  function cleanSeason(d) { d = d || (A.fakeNow ? new Date(A.fakeNow.replace(" ", "T")) : new Date()); return d.getMonth() === 11 && d.getDate() >= 25; }
  function cleanYear() { return new Date().getFullYear(); }

  /* wat er weggaat en wat er blijft */
  function cleanPlan() {
    var today = todayIso(), all = ibAll();
    var del = A.data.meetings.filter(function (m) { return !m.date || m.date <= today; });
    var future = A.data.meetings.filter(function (m) { return del.indexOf(m) < 0; });
    var pts = all.pts.filter(function (p) { return p.r.st === 'open' || p.r.st === 'wait'; });
    var todo = A.data.todo || [];
    var doneRems = ibRems().filter(function (r) { return !pts.concat(all.ideas).some(function (it) { return it.src.rem === r; }); });
    return { del: del, future: future, keep: pts.concat(all.ideas), nPts: pts.length, nIdeas: all.ideas.length, todo: todo, doneRems: doneRems };
  }

  /* balk op de pagina Vergaderingen, alleen in de laatste week van december en zolang er dit jaar nog niet is opgeschoond */
  function cleanBannerHtml() {
    if (!cleanSeason() || A.data.cleanedYear === cleanYear()) return '';
    try { if (localStorage.getItem('memeet-clean-later') === todayIso()) return ''; } catch (e) {}
    return '<section class="cleanbar" role="status"><span class="cleanic" aria-hidden="true">' + ic('delete_sweep') + '</span><div class="cleantx"><b>Het is de laatste week van december: tijd om op te schonen</b>' +
      '<span>Verwijder je vergaderingen, stukken, aantekeningen en acties van dit jaar. Herinneringen die nog open staan en je ideeën blijven bewaard.</span></div>' +
      '<a class="btn danger" href="#/opschonen">' + ic('delete_sweep') + ' Gegevens opschonen</a><button type="button" class="btn" id="cleanLater">Later</button></section>';
  }
  function bindCleanBanner() {
    var b = $('#cleanLater'); if (b) b.onclick = function () { try { localStorage.setItem('memeet-clean-later', todayIso()); } catch (e) {} var s = b.closest('.cleanbar'); if (s) s.remove(); };
  }

  /* de pop-up: eerst laten zien wat er gebeurt, dan pas verwijderen */
  function openCleanup() {
    if (!A.store) return;
    var p = cleanPlan(), old = $('#cleanDlg'); if (old) old.remove();
    var nAct = p.todo.length, mails = p.todo.filter(function (x) { return x.mail; }).length;
    var bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'cleanDlg';
    setHTML(bg, '<div class="dlg cleandlg" role="dialog" aria-modal="true" aria-labelledby="cleanT"><div class="vvhead"><div><h2 id="cleanT">' + ic('delete_sweep') + ' Gegevens opschonen</h2>' +
      '<p class="muted">Doe dit elk jaar in de laatste week van december. Wat weg is, kun je niet terughalen.</p></div><button type="button" class="vvx" id="cleanX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="cleancols"><div><h3>Wordt verwijderd</h3><ul>' +
      '<li><b>' + p.del.length + '</b> vergadering' + (p.del.length === 1 ? '' : 'en') + ' tot en met vandaag, met de stukken, originele mails, eerdere versies, markeringen, aantekeningen en acties</li>' +
      '<li><b>' + nAct + '</b> losse actie' + (nAct === 1 ? '' : 's') + (mails ? ' (waarvan ' + mails + ' mail' + (mails === 1 ? '' : 's') + ')' : '') + '</li>' +
      '<li><b>' + p.doneRems.length + '</b> afgevinkte of weggehaalde herinnering' + (p.doneRems.length === 1 ? '' : 'en') + '</li></ul></div>' +
      '<div><h3>Blijft bewaard</h3><ul>' +
      '<li><b>' + p.nPts + '</b> herinneringspunt' + (p.nPts === 1 ? '' : 'en') + ' die aan een overleg gekoppeld zijn of op een overleg wachten</li>' +
      '<li><b>' + p.nIdeas + '</b> idee' + (p.nIdeas === 1 ? '' : 'ën') + '</li>' +
      '<li><b>' + p.future.length + '</b> vergadering' + (p.future.length === 1 ? '' : 'en') + ' na vandaag, met wat erbij hoort</li></ul>' +
      '<p class="muted small">Punten en ideeën die in de aantekeningen van een verwijderde vergadering stonden, worden losse herinneringen. Ze komen gewoon op bij hetzelfde overleg.</p></div></div>' +
      '<label class="cleanok"><input type="checkbox" id="cleanOk"> Ik begrijp dat dit niet ongedaan kan worden' + (A.store.kind === 'map' ? ' (wil je een kopie, kopieer dan eerst de map <code>memeet-data</code>)' : '') + '</label>' +
      '<div class="dlgacts"><button type="button" class="btn danger" id="cleanGo" disabled>' + ic('delete_sweep') + ' Nu verwijderen</button><button type="button" class="btn" id="cleanNo">Annuleren</button></div></div>');
    D.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    $('#cleanX', bg).onclick = close; $('#cleanNo', bg).onclick = close;
    $('#cleanOk', bg).onchange = function () { $('#cleanGo', bg).disabled = !this.checked; };
    $('#cleanGo', bg).onclick = async function () { this.disabled = true; setHTML(this, 'Bezig met verwijderen…'); try { await doCleanup(p); } catch (e) { console.error(e); toast('Opschonen mislukt: ' + (e.message || e), 'err'); } close(); route(); };
    bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    try { $('#cleanOk', bg).focus(); } catch (e) {}
  }

  async function doCleanup(p) {
    var del = p.del, fail = [];
    /* 0. de voornamen die in bewaarde punten staan, blijven bekend (anders herkent MeMeet "> Ahmed …" niet meer als persoon) */
    var ppl = ibPeople(), kp = {}; p.keep.forEach(function (it) { (it.persons || []).forEach(function (k) { if (ppl[k]) kp[k] = ppl[k]; }); });
    A.data.ibPeopleKeep = kp;
    /* 1. punten en ideeën uit aantekeningen van een vergadering die weggaat, worden losse herinneringen; ze houden hun overleg */
    p.keep.forEach(function (it) {
      if (it.src.rem || del.indexOf(it.src) < 0) return;
      var line = String(it.src.minutes || '').split(/\r?\n/)[it.line]; if (!line) return;
      /* "> tekst" zonder naam of titel betekent: het volgende overleg met dezelfde titel. Die titel schrijven we er nu bij. */
      if (it.k === '>' && !it.title && !(it.persons || []).length) line = '> ' + ibTitleOf(it.src) + ': ' + it.text;
      var when = new Date((it.src.date || todayIso()) + 'T' + (it.src.start || '00:00') + ':00');
      var r = { id: 'R' + uid(), created: (isNaN(when) ? new Date() : when).toISOString(), line: line.trim() }; ibRems().push(r);
      var ni = ibItemsOf(ibRemSrc(r))[0], st = ibGet(it.id);
      if (ni) { if (st.pin && del.indexOf(byId(st.pin)) < 0) ibSet(ni.id, 'pin', st.pin); if (st.keep) ibSet(ni.id, 'keep', 1); }
    });
    /* 2. afgevinkte en weggehaalde losse herinneringen */
    A.data.rem = ibRems().filter(function (r) { return p.doneRems.indexOf(r) < 0; });
    /* 3. de vergaderingen tot en met vandaag, met alles wat erbij hoort */
    var nd = null; if (A.store.kind === 'map') { try { nd = await A.store.root.getDirectoryHandle(NOTES_DIR); } catch (e) {} }
    for (var i = 0; i < del.length; i++) {
      var m = del[i]; if (i % 5 === 0) toast('Verwijderen… (' + (i + 1) + '/' + del.length + ')');
      try { await A.store.delMeeting(m); } catch (e) { console.error(e); fail.push(m.title); continue; }
      if (nd && m.minutesFile) { try { await nd.removeEntry(m.minutesFile); } catch (e) {} }
      A.data.meetings = A.data.meetings.filter(function (x) { return x !== m; });
    }
    /* 4. de losse acties, ook de mails op de actielijst */
    for (var j = 0; j < p.todo.length; j++) { var x = p.todo[j]; if (x.mail) { try { await A.store.delMeeting(actBox(x)); } catch (e) { console.error(e); } } }
    A.data.todo = []; A.data.act = {};
    /* 5. eigen mappen in Bestanden leeg, en de status van punten die er niet meer zijn */
    A.data.fxIn = {}; if (A.data.fxHidden) A.data.fxHidden = {};
    var alive = {}, all = ibAll(); all.pts.concat(all.ideas).forEach(function (it) { alive[it.id] = 1; });
    Object.keys(ibState()).forEach(function (id) { if (!alive[id]) delete ibState()[id]; });
    await plCallAll('onCleanup'); /* uitbreidingen die aanstaan, schonen mee op (het Postvak: de map Verwerkt) */
    A.data.cleanedYear = cleanYear(); A.data.cleaned = new Date().toISOString(); A.hsel = {};
    await persist();
    try { await writeNotesFiles(null); } catch (e) {}
    if (typeof FX !== 'undefined') FX.items = null;
    toast(fail.length ? 'Niet alles kon worden verwijderd: ' + fail.join(', ') : 'Opgeschoond. ' + del.length + ' vergadering' + (del.length === 1 ? '' : 'en') + ' verwijderd; je open herinneringen en ideeën zijn bewaard.', fail.length ? 'err' : 'ok');
  }
