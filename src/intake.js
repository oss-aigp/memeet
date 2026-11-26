  /* MeMeet - intake: een mail, uitnodiging of weekagenda omzetten naar vergaderingen */
  /* ------------------------------------------------------------- mail -> vergadering */
  /* een mailbestand (.msg of .eml) lezen, zonder het te controleren */
  async function readMail(blob, name) {
    var buf = await blob.arrayBuffer(), u = new Uint8Array(buf);
    if (rd(u, 0) === 0xE011CFD0) return parseMsg(buf);
    if (/\.msg$/i.test(name || blob.name || '')) throw new Error('"' + (name || blob.name) + '" is geen geldig Outlook-bestand');
    return parseEml(buf);
  }
  async function parseMailFile(file) {
    var m = await readMail(file, file.name);
    if (!m.subject && !m.from && !m.start && !m.attachments.length) throw new Error('In "' + file.name + '" is geen mail herkend');
    var r = analyse(m);
    return { r: r, m: m };
  }
  function isZipName(it) { return /\.zip$/i.test(it.name || '') || /^application\/(x-)?zip(-compressed)?$/i.test(it.type || ''); }
  function isMailItem(it) { return /\.(msg|eml)$/i.test(it.name || '') || /ms-outlook|rfc822/i.test(it.type || ''); }
  /* Bestanden klaarmaken om als stukken toe te voegen. Alles blijft in zijn eigen formaat, met twee uitzonderingen:
     een zip wordt uitgepakt (de bestanden erin worden losse stukken), en bij een mail komen de bijlagen als losse stukken
     achter de mail. Dat werkt ook genest (een zip in een mail, een mail in een mail), tot vier niveaus diep.
     items: [{ name, type, blob }]; geeft dezelfde vorm terug. */
  async function expandFiles(items, depth) {
    depth = depth || 0; var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (isZipName(it) && depth < 4 && W.JSZip) {
        try {
          var z = await W.JSZip.loadAsync(it.blob), ents = [];
          z.forEach(function (p, e) { if (!e.dir && !/(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i.test(p)) ents.push(e); });
          ents.sort(function (a, b) { return a.name.localeCompare(b.name, 'nl', { numeric: true }); });
          var inner = [];
          for (var k = 0; k < ents.length; k++) { var nm = ents[k].name.split('/').pop(), b = await ents[k].async('blob'); inner.push({ name: nm, type: guessMime(nm), blob: new Blob([b], { type: guessMime(nm) }) }); }
          out = out.concat(await expandFiles(inner, depth + 1));
          continue;
        } catch (e) { console.warn('Zip niet uit te pakken: ' + it.name, e); } /* geen geldige zip: als bestand toevoegen */
      }
      out.push(it);
      if (isMailItem(it) && depth < 4) {
        try {
          var mm = await readMail(it.blob, it.name);
          var atts = mm.attachments.filter(function (a) { return !a.inline; }).map(function (a) { var t = a.type || guessMime(a.name); return { name: a.name, type: t, blob: new Blob([a.data], { type: t }) }; });
          out = out.concat(await expandFiles(atts, depth + 1));
        } catch (e) { console.warn('Bijlagen van de mail niet gelezen: ' + it.name, e); }
      }
    }
    return out;
  }
  function guessType(title) {
    var t = (title || '').toLowerCase(), best = '';
    A.data.types.forEach(function (ty) { if (ty !== 'Overleg' && t.indexOf(ty.toLowerCase()) >= 0 && ty.length > best.length) best = ty; });
    if (!best && /\bpmt\b/.test(t)) best = A.data.types.filter(function (x) { return /^pmt/i.test(x); })[0] || '';
    if (!best && /\bmt\b/.test(t)) best = A.data.types.filter(function (x) { return /^mt/i.test(x); })[0] || '';
    return best || 'Overleg';
  }
  async function draftFromMail(file) {
    var p = await parseMailFile(file), r = p.r, m = p.m;
    /* bijlagen worden stukken; een mail als bijlage komt er met zijn eigen bijlagen apart bij, een zip wordt uitgepakt */
    var real = await expandFiles(m.attachments.filter(function (a) { return !a.inline; }).map(function (a) { var t = a.type || guessMime(a.name); return { name: a.name, type: t, blob: new Blob([a.data], { type: t }) }; }));
    var pending = real.map(function (a) { return { name: a.name, type: a.type, blob: a.blob, on: true }; })
      .concat(m.attachments.filter(function (a) { return a.inline; }).map(function (a) { return { name: a.name, type: a.type || guessMime(a.name), blob: new Blob([a.data], { type: a.type }), on: false, inline: true }; }));
    return {
      id: uid(), isNew: true, type: guessType(r.title), title: r.title || '(zonder titel)', location: r.location, link: r.link || '', ibabs: r.ibabs || '', date: nl2iso(r.date), start: r.start, end: r.end,
      chair: '', invitees: '', notes: r.notes,
      source: { from: m.from || '', sent: m.sent && !isNaN(m.sent) ? m.sent.toISOString() : '', mail: file.name, skipped: m.skipped || [], how: r.src, recurring: !!r.recurring },
      files: [], pending: pending,
      mailBlob: file
    };
  }
  function uniqueName(m, name) {
    name = safe(name); var base = name.replace(/(\.[^.]*)?$/, ''), ext = (/\.[^.]*$/.exec(name) || [''])[0], n = 1;
    var taken = m.files.reduce(function (a, f) { a.push(f.name.toLowerCase()); if (f.pdf) a.push(f.pdf.toLowerCase()); olderOf(f).forEach(function (n) { a.push(n.toLowerCase()); }); return a; }, []).concat(m.source && m.source.file ? [m.source.file.toLowerCase()] : []);
    while (taken.indexOf(name.toLowerCase()) >= 0) name = base + ' (' + (++n) + ')' + ext;
    return name;
  }
  async function addFileTo(m, name, type, blob) {
    var n = uniqueName(m, name);
    try { await A.store.put(m, n, blob); }
    catch (e) { n = uniqueName(m, n.normalize('NFKD').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e]/g, '')); await A.store.put(m, n, blob); }
    /* het stuk blijft in zijn eigen formaat; de viewer zet het pas om bij het tonen (zie getPdf), zonder een PDF op te slaan */
    var rec = { name: n, type: type || guessMime(n), size: blob.size, added: new Date().toISOString() };
    m.files.push(rec);
    return n;
  }
  /* Weergave in de viewer. Een PDF wordt zelf getoond. Een ander bestand wordt in het geheugen omgezet naar een PDF om te tonen;
     die wordt niet opgeslagen. Stukken van vóór versie 1.1 hebben soms al een opgeslagen PDF-versie (f.pdf); die wordt gebruikt,
     net als een eigen PDF-versie die je erbij hebt gesleept. De laatste omzettingen blijven even in het geheugen. */
  var PDFMEM = { keys: [], map: {} };
  function memKey(m, f) { return m.id + '/' + f.name + '/' + (f.edited || f.added || '') + '/' + (f.size || 0); }
  async function getPdf(m, f) {
    /* PowerPoint-stukken met een opgeslagen omzetting van vóór de nieuwe dia-weergave: die PDF niet meer gebruiken (tenzij er al aantekeningen op staan: die zouden verschuiven) */
    if (f.pdf && f.conv === 'omgezet' && /\.(pptx|pptm|ppsx)$/i.test(f.name) && (f.convV || 1) < CONV_VERSION && !annCount(f.ann)) {
      try { await A.store.del(m, f.pdf); } catch (e) {} f.pdf = null; delete f.conv; delete f.convV; await persist();
    }
    if (f.pdf) { try { return await A.store.get(m, f.pdf); } catch (e) { f.pdf = null; } }
    var k = memKey(m, f); if (Object.prototype.hasOwnProperty.call(PDFMEM.map, k)) return PDFMEM.map[k];
    var blob = await A.store.get(m, f.name), out = null;
    try { var r = await convertToPdf(f.name, f.type, blob); if (r) out = r.how === 'origineel' ? blob : new Blob([r.bytes], { type: 'application/pdf' }); }
    catch (e) { console.error(e); f.convErr = String(e.message || e); }
    PDFMEM.map[k] = out; PDFMEM.keys.push(k);
    while (PDFMEM.keys.length > 12) delete PDFMEM.map[PDFMEM.keys.shift()];
    return out;
  }
  /* geeft de viewer een eigen weergave voor dit stuk (na bewerken of vervangen): de oude omzetting uit het geheugen halen */
  function forgetPdf(m, f) { Object.keys(PDFMEM.map).forEach(function (k) { if (k.indexOf(m.id + '/' + f.name + '/') === 0) delete PDFMEM.map[k]; }); PDFMEM.keys = PDFMEM.keys.filter(function (k) { return PDFMEM.map.hasOwnProperty(k); }); }
  function agendaFirst(list) { return list.slice().sort(function (a, b) { return (/agenda/i.test(b.name) ? 1 : 0) - (/agenda/i.test(a.name) ? 1 : 0); }); }
  async function ensureFolder(m) { if (A.store && A.store.kind === 'map' && m.folder) { try { await A.store.dir(m); } catch (e) { console.warn('Map aanmaken mislukt', e); } } }
  async function saveDraft(d) {
    var m = { id: d.id, type: d.type, title: d.title, location: d.location, link: d.link || '', ibabs: d.ibabs || '', date: d.date, start: d.start, end: d.end, chair: d.chair, invitees: d.invitees, notes: d.notes,
      source: d.source, files: [], created: new Date().toISOString() };
    m.folder = safe((m.date || 'zonder datum') + ' ' + m.title).slice(0, 70) + ' [' + m.id.slice(-4) + ']';
    var todo = agendaFirst((d.pending || []).filter(function (f) { return f.on; }));
    for (var i = 0; i < todo.length; i++) { toast('Stukken opslaan… (' + (i + 1) + '/' + todo.length + ')'); await addFileTo(m, todo[i].name, todo[i].type, todo[i].blob); }
    if (d.mailBlob) { var mn = uniqueName(m, 'Originele mail' + (/\.msg$/i.test(d.mailBlob.name) ? '.msg' : '.eml')); await A.store.put(m, mn, d.mailBlob); m.source.file = mn; }
    A.data.meetings.push(m); await ensureFolder(m); await persist();
    return m;
  }
  function findDup(d) { return A.data.meetings.filter(function (m) { return m.date === d.date && m.title.toLowerCase() === (d.title || '').toLowerCase(); })[0]; }

  async function handleDrop(files) {
    if (!A.store) { toast('Kies eerst waar de gegevens bewaard worden.', 'warn'); return; }
    files = Array.prototype.slice.call(files);
    var cals = files.filter(isCal);
    if (cals.length && (location.hash === '#/weekagenda' || !currentMeeting())) {
      try { await importCalendars(cals); } catch (e) { console.error(e); toast('Kon de agenda niet lezen: ' + (e.message || e), 'err'); }
      return;
    }
    var mails = files.filter(isMail), docs = files.filter(function (f) { return !isMail(f); });
    var cur = currentMeeting();
    function item(f) { return { name: f.name, type: f.type || guessMime(f.name), blob: f }; }
    /* op de Actielijst: elke mail wordt een actie */
    if (location.hash === '#/acties') {
      if (mails.length) await addMailActions(mails);
      if (docs.length) toast('Op de Actielijst kun je alleen mails slepen (.msg of .eml). Het onderwerp wordt dan de actie.', 'warn');
      return;
    }
    try {
      if (cur && !cur.isNew) {
        var n = 0, list = await expandFiles(docs.map(item)); /* zips uitpakken */
        /* een mail: alleen de mail, of de mail met de bijlagen als losse stukken erachter */
        for (var i = 0; i < mails.length; i++) {
          var p = await parseMailFile(mails[i]), atts = p.m.attachments.filter(function (a) { return !a.inline; });
          if (atts.length && confirm('Wat wil je met de mail "' + (p.m.subject || mails[i].name) + '"?\n\nOK = de mail én de ' + atts.length + ' bijlage' + (atts.length === 1 ? '' : 'n') + ' toevoegen, elk als apart stuk\nAnnuleren = alleen de mail toevoegen')) list = list.concat(await expandFiles([item(mails[i])]));
          else list.push(item(mails[i]));
        }
        for (i = 0; i < list.length; i++) {
          var it = list[i], same = cur.files.filter(function (f) { return f.name.toLowerCase() === safe(it.name).toLowerCase(); })[0];
          if (same && confirm('"' + same.name + '" bestaat al in deze vergadering.\n\nOK = de oude versie vervangen door deze nieuwe\nAnnuleren = als extra stuk toevoegen')) {
            toast('Nieuwe versie opslaan…'); await saveEdited(cur, same, it.blob); n++; continue;
          }
          /* een PDF met dezelfde naam als een stuk dat geen PDF is: eventueel gebruiken als PDF-versie voor de viewer */
          var base = it.name.replace(/\.[^.]*$/, '').toLowerCase(), twin = /\.pdf$/i.test(it.name) && cur.files.filter(function (f) { return !/\.pdf$/i.test(f.name) && f.conv !== 'vervangen' && f.name.replace(/\.[^.]*$/, '').toLowerCase() === base; })[0];
          if (twin && confirm('Wil je "' + it.name + '" gebruiken als PDF-versie van "' + twin.name + '"?\n(OK = gebruiken als PDF-versie, Annuleren = toevoegen als apart stuk)')) {
            var tpn = twin.pdf && twin.pdf !== twin.name ? twin.pdf : uniqueName(cur, it.name); await A.store.put(cur, tpn, it.blob); twin.pdf = tpn; twin.conv = 'vervangen'; delete twin.convErr; forgetPdf(cur, twin); n++; continue;
          }
          toast('Toevoegen: ' + it.name + '…'); await addFileTo(cur, it.name, it.type, it.blob); n++;
        }
        cur.updated = new Date().toISOString(); await persist(); renderDetail(cur); toast(n + ' stuk' + (n === 1 ? '' : 'ken') + ' toegevoegd.', 'ok'); return;
      }
      if (cur && cur.isNew) {
        var add = await expandFiles(docs.map(item).concat(mails.map(item)));
        add.forEach(function (f) { cur.pending.push({ name: f.name, type: f.type, blob: f.blob, on: true }); });
        renderDetail(cur); toast('Toegevoegd aan de nieuwe vergadering. Klik op Opslaan.', 'ok'); return;
      }
      if (!mails.length) { toast('Sleep een mail (.msg of .eml) om een vergadering te maken. Losse documenten sleep je op een geopende vergadering.', 'warn'); return; }
      var made = 0, moved = [], same0 = 0, last = null;
      for (i = 0; i < mails.length; i++) {
        var d = await draftFromMail(mails[i]), ex = sameDay(d);
        /* bestaat deze vergadering op die dag al, dan is het een verplaatsing: alleen de tijd bijwerken */
        if (ex) { if (d.start && (ex.start !== d.start || ex.end !== d.end)) { ex.start = d.start; if (d.end) ex.end = d.end; ex.updated = new Date().toISOString(); moved.push(ex); } else same0++; last = ex; continue; }
        if (mails.length === 1) { A.draft = d; location.hash = '#/nieuw'; route(); return; }
        await saveDraft(d); made++;
      }
      if (moved.length) await persist();
      var msg = [];
      if (made) msg.push(made + ' vergadering' + (made === 1 ? '' : 'en') + ' aangemaakt');
      if (moved.length) msg.push(moved.length === 1 ? 'De vergadering "' + moved[0].title + '" op ' + fmtShort(moved[0].date) + ' bestond al: de tijd is bijgewerkt naar ' + moved[0].start + (moved[0].end ? '–' + moved[0].end : '') : moved.length + ' vergaderingen bestonden al: de tijd is bijgewerkt');
      if (same0) msg.push(same0 + ' bestond' + (same0 === 1 ? '' : 'en') + ' al, met dezelfde tijd');
      if (mails.length === 1 && last) { location.hash = '#/v/' + encodeURIComponent(last.id); route(); } else route();
      toast(msg.join('. ') + '.', 'ok');
    } catch (e) { console.error(e); toast('Kon de mail niet lezen: ' + (e.message || e), 'err'); }
  }
  /* dezelfde vergadering op dezelfde dag (zelfde titel, zonder voorvoegsels als "Bijgewerkt:") */
  function sameDay(d) { if (!d.date) return null; var t = calNorm(d.title); return A.data.meetings.filter(function (m) { return m.date === d.date && calNorm(m.title) === t; })[0] || null; }


  var MEET_DIR = 'Vergaderingen', ACTS_DIR = 'Actielijst';

  /* ------------------------------------------------------------- weekagenda (.ics-export uit Outlook) */
  var OUTLOOK_MACRO = __OUTLOOK_MACRO__;
  function renderWeekImport(res) {
    var h = '<div class="crumb"><a href="#/">Vergaderingen</a> › Weekagenda importeren</div><div class="head"><h1>Weekagenda importeren</h1></div>';
    if (res) h += res;
    if (A.wkPlan) h += planHtml(A.wkPlan);
    h += '<section class="card wk"><h2>1. Sla je agenda op in Outlook</h2>' +
      '<p>Zo gaat het (onderaan staat hoe je hier een sneltoets voor maakt):</p><ol>' +
      '<li>Ga in Outlook naar <b>Agenda</b> en klik links op je eigen agenda.</li>' +
      '<li>Kies <b>Bestand</b> › <b>Agenda opslaan in bestand</b> en klik onderin op <b>Meer opties</b>.</li>' +
      '<li>Kies bij <b>Datumbereik</b> bijvoorbeeld <i>Volgende 30 dagen</i> en bij <b>Detail</b> <i>Volledige details</i>. Wil je de bijlagen van afspraken als stukken, vink dan onder <b>Geavanceerd</b> ook <b>Bijlagen bij agenda-items opnemen</b> aan. Klik op <b>OK</b> en daarna op <b>Opslaan</b>.</li></ol>' +
      '<h2>2. Lees het bestand hier in</h2>' +
      '<p class="muted">Blokken, reistijd, uitloop en korte afspraken direct naast een andere vergadering worden niet geïmporteerd. <button type="button" class="link" id="wkIgn2">Aanpassen…</button></p>' +
      '<div class="dz wkdz">Sleep het .ics-bestand hierheen of <button type="button" class="btn pri" id="icsPick">Kies het agendabestand…</button></div>' +
      '<input type="file" id="pickIcs" accept=".ics,text/calendar" multiple hidden>' +
      '<p class="muted">Je ziet eerst alle afspraken en vinkt aan wat je wilt importeren. Nieuwe afspraken worden vergaderingen. Bijlagen worden stukken; mails (.msg en .eml) worden daarbij omgezet naar PDF. Staat een afspraak er al, omdat je hem eerder importeerde of de uitnodiging erin sleepte, dan worden datum, tijd, locatie en vergaderlink bijgewerkt. Stukken en aantekeningen blijven staan. Je kunt dus elke week opnieuw importeren. Hele-dag-afspraken, geannuleerde afspraken en afspraken die al geweest zijn, worden overgeslagen. Een afspraak die je in Outlook verwijdert, blijft in MeMeet staan.</p></section>';
    h += '<section class="card wk"><details><summary><b>Sneltoets zonder macro</b> <span class="muted">(werkt altijd, klassieke Outlook voor Windows)</span></summary>' +
      '<p>Hiermee open je met één toetscombinatie het venster om de agenda op te slaan. De periode en Volledige details kies je daarna zelf.</p><ol>' +
      '<li>Kies in Outlook <b>Bestand › Opties › Werkbalk Snelle toegang</b>.</li>' +
      '<li>Kies bij <b>Kies opdrachten uit</b> de optie <b>Alle opdrachten</b>, selecteer <b>Opslaan als agenda</b> en klik op <b>Toevoegen</b>. Klik op <b>OK</b>.</li>' +
      '<li>Ga naar <b>Agenda</b> en klik links op je eigen agenda. Druk op <b>Alt</b> om te zien welk cijfer bij de knop hoort: <b>Alt</b> plus dat cijfer opent het venster om de agenda op te slaan.</li>' +
      '<li>Klik op <b>Meer opties</b>, kies <i>Volgende 30 dagen</i> en <i>Volledige details</i> (en eventueel <b>Bijlagen bij agenda-items opnemen</b>), klik op <b>OK</b> en <b>Opslaan</b>.</li></ol>' +
      '<p class="muted">Zie je de werkbalk niet? Klik met de rechtermuisknop op het lint en kies <b>Werkbalk Snelle toegang weergeven</b>.</p></details></section>';
    h += '<section class="card wk"><details><summary><b>Sneltoets met macro</b> <span class="muted">(alleen als je organisatie macro\'s toestaat)</span></summary><ol>' +
      '<li>Druk in Outlook op <b>Alt+F11</b>. De Visual Basic-editor opent.</li>' +
      '<li>Klik links met de rechtermuisknop op <b>Project1</b> en kies <b>Invoegen › Module</b>.</li>' +
      '<li>Klik hieronder op <b>Code kopiëren</b>, plak de code in de lege module (Ctrl+V), druk op <b>Ctrl+S</b> en sluit de editor.</li>' +
      '<li>Kies in Outlook <b>Bestand › Opties › Werkbalk Snelle toegang</b>. Kies bij <b>Kies opdrachten uit</b> de optie <b>Macro\'s</b>, selecteer <b>Project1.MeMeetWeekagenda</b> en klik op <b>Toevoegen</b>. Met <b>Wijzigen</b> geef je hem een icoon en de naam <i>MeMeet weekagenda</i>. Klik op <b>OK</b>.</li>' +
      '<li>De knop staat nu bovenin Outlook. Druk op <b>Alt</b> om te zien welk cijfer erbij hoort: <b>Alt</b> plus dat cijfer is je sneltoets. Zie je de werkbalk niet? Klik met de rechtermuisknop op het lint en kies <b>Werkbalk Snelle toegang weergeven</b>.</li></ol>' +
      '<p class="muted">De macro slaat de komende 30 dagen op. Wil je een andere periode, verander dan in de code het getal achter <code>DAGEN As Integer =</code>. Vraagt Outlook bij het starten of je macro\'s wilt inschakelen, kies dan <b>Macro\'s inschakelen</b>. Krijg je bij het opslaan een melding over het digitale certificaat, of wordt de macro geblokkeerd, dan staat je organisatie geen macro\'s toe. Gebruik dan de sneltoets zonder macro.</p>' +
      '<textarea readonly class="macro" id="macro" spellcheck="false">' + esc(OUTLOOK_MACRO) + '</textarea>' +
      '<p><button type="button" class="btn sm" id="macroCopy">Code kopiëren</button></p></details></section>';
    setHTML($('#main'), h);
    bindPlan();
    $('#wkIgn2').onclick = function () { ignoreDialog(); };
    var pk = $('#pickIcs');
    $('#icsPick').onclick = function () { pk.click(); };
    pk.onchange = function () { var f = this.files; if (f.length) handleDrop(f); this.value = ''; };
    $('#macroCopy').onclick = async function () {
      var ta = $('#macro'), ok = false;
      try { await navigator.clipboard.writeText(OUTLOOK_MACRO); ok = true; } catch (e) { try { ta.focus(); ta.select(); ok = D.execCommand('copy'); } catch (e2) {} }
      toast(ok ? 'De code staat op het klembord. Plak hem in Outlook met Ctrl+V.' : 'Kopiëren lukte niet. Selecteer de code en druk op Ctrl+C.', ok ? 'ok' : 'warn');
    };
  }
  function calNorm(t) { return cleanSubject(t || '').toLowerCase(); }
  function hasStuk(m, name) { var a = name.toLowerCase(), b = safe(name).toLowerCase(); return m.files.some(function (f) { return [f.name, f.pdf || ''].some(function (x) { x = x.toLowerCase(); return x === a || x === b; }); }); }
  function attTarget(a) { return a.name; } /* elk stuk houdt zijn eigen naam en formaat */
  /* Stap 1: het bestand lezen en laten zien wat er gebeurt. Er wordt nog niets opgeslagen. */
  async function importCalendars(files) {
    if (!A.store) { toast('Kies eerst waar de gegevens bewaard worden.', 'warn'); return; }
    var plan = { items: [], skipDay: 0, skipCan: 0, names: [] }, found = 0, skipT = A.data.icsSkip || {};
    for (var fi = 0; fi < files.length; fi++) {
      var cal = parseCalendar(await files[fi].text()), name = files[fi].name;
      found += cal.events; plan.names.push(name);
      cal.items.forEach(function (it) {
        if (it.allDay) { plan.skipDay++; return; }
        if (it.cancelled) { plan.skipCan++; return; }
        if (!it.title) { plan.skipNoTitle = (plan.skipNoTitle || 0) + 1; if (it.priv) plan.skipPriv = (plan.skipPriv || 0) + 1; return; } /* geen titel te vinden: niet importeren */
        var r = analyse({ subject: it.title, text: it.text, html: it.html, start: it.start, end: it.end, allDay: false, location: it.location });
        var p = { it: it, r: r, file: name, date: nl2iso(r.date), title: r.title || '(zonder titel)', link: r.link || findLink(it.teams, ''), ibabs: r.ibabs || '', inv: it.attendees.join(', ') };
        p.ex = A.data.meetings.filter(function (m) { return m.icsKey === it.key; })[0] ||
          A.data.meetings.filter(function (m) { return !m.icsKey && m.date === p.date && calNorm(m.title) === calNorm(p.title); })[0] || null;
        p.atts = (it.atts || []).filter(function (a) { return !p.ex || !hasStuk(p.ex, attTarget(a)); });
        if (!p.ex) p.status = 'nieuw';
        else {
          var e = p.ex, diff = ['date', 'start', 'end', 'title', 'location', 'link', 'ibabs'].some(function (k) { var v = k === 'date' ? p.date : k === 'title' ? p.title : k === 'link' ? p.link : k === 'ibabs' ? p.ibabs : r[k]; return v && e[k] !== v; }) ||
            (!e.invitees && p.inv) || (!e.notes && r.notes) || e.icsKey !== it.key || p.atts.length;
          p.status = diff ? 'bijwerken' : 'ongewijzigd';
        }
        p.on = p.status !== 'ongewijzigd' && !skipT[calNorm(p.title)];
        plan.items.push(p);
      });
    }
    if (!found) { toast('In dit bestand staan geen afspraken. Sla in Outlook de agenda op als .ics-bestand.', 'warn'); return; }
    markMinor(plan.items);
    A.wkPlan = plan;
    if (location.hash !== '#/weekagenda') { location.hash = '#/weekagenda'; return; }
    renderWeekImport();
  }
  /* Waarschijnlijk geen echte vergadering: blokken, reistijd, uitloop, en korte afspraken (tot 20 minuten) die direct voor of na een andere afspraak liggen */
  /* Instellingen voor wat niet geïmporteerd wordt: trefwoorden in de titel, en korte afspraken die direct voor of na een andere afspraak liggen */
  var IGNORE_DEF = ['Blok', 'Blokken', 'Reistijd', 'Uitloop'];
  function icsIgnore() { var g = A.data.icsIgnore || (A.data.icsIgnore = { words: IGNORE_DEF.slice(), shortOn: true, shortMin: 20 }); if (!g.words) g.words = IGNORE_DEF.slice(); if (g.shortMin == null) g.shortMin = 20; return g; }
  function wordRe(w) { return new RegExp('(^|[^\\p{L}\\p{N}])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])', 'iu'); }
  function markMinor(items) {
    var g = icsIgnore(), res = g.words.filter(Boolean).map(function (w) { return { w: w, re: wordRe(w) }; });
    items.forEach(function (p) { p.minor = null; });
    items.forEach(function (p) {
      var hit = res.filter(function (r) { return r.re.test(p.title); })[0];
      if (hit) { p.minor = 'trefwoord "' + hit.w + '"'; return; }
      var st = p.it.start, en = p.it.end, dur = (en - st) / 60000;
      if (g.shortOn && dur > 0 && dur <= g.shortMin && items.some(function (q) { return q !== p && !q.minor && (q.it.end - q.it.start) / 60000 > dur && Math.min(Math.abs(q.it.end - st), Math.abs(en - q.it.start)) <= 5 * 60000; })) p.minor = 'korte afspraak naast een andere vergadering';
    });
  }
  function planHtml(plan) {
    var shown = plan.items.filter(function (p) { return !p.minor; }), act = shown.filter(function (p) { return p.status !== 'ongewijzigd'; }), nOn = act.filter(function (p) { return p.on; }).length;
    var skip = []; if (plan.skipDay) skip.push(plan.skipDay + ' hele-dag-afspraak' + (plan.skipDay === 1 ? '' : 'en')); if (plan.skipCan) skip.push(plan.skipCan + ' geannuleerd'); if (plan.skipNoTitle) skip.push(plan.skipNoTitle + ' zonder titel' + (plan.skipPriv ? ' (privé: vink in Outlook bij Meer opties ook Details van privé-items opnemen aan)' : ''));
    var nMinor = plan.items.filter(function (p) { return p.minor; }).length;
    var h = '<section class="card wkplan"><div class="wkhead"><h2>Kies wat je wilt importeren</h2><button type="button" class="btn sm" id="wkIgn">' + ic('settings') + ' Niet importeren…</button></div><p class="muted">' + esc(plan.names.join(', ')) + ' · ' + shown.length + ' afspra' + (shown.length === 1 ? 'ak' : 'ken') + (skip.length ? ' · niet getoond: ' + skip.join(', ') : '') +
      '. Vink uit wat je niet wilt importeren. Wat je uitvinkt, staat de volgende keer ook uit.</p>';
    if (nMinor) h += '<p class="wklegend">' + nMinor + ' afspra' + (nMinor === 1 ? 'ak wordt' : 'ken worden') + ' overgeslagen (blokken, reistijd, uitloop of korte afspraken direct naast een andere vergadering). <button type="button" class="link" id="wkShowMin">' + (plan.showMinor ? 'Verbergen' : 'Toon welke') + '</button></p>' + (plan.showMinor ? '<ul class="wkmin">' + plan.items.filter(function (p) { return p.minor; }).map(function (p) { return '<li>' + esc(fmtShort(p.date)) + ' ' + esc((p.r.start || '') + (p.r.end ? '–' + p.r.end : '')) + ' <b>' + esc(p.title) + '</b> <span class="muted">(' + esc(p.minor) + ')</span></li>'; }).join('') + '</ul>' : '');
    h += '<div class="tw"><table class="wkt"><thead><tr><th class="cb"><input type="checkbox" id="wkall" title="Alles aan of uit"' + (act.length && nOn === act.length ? ' checked' : '') + '></th><th>Datum</th><th>Tijd</th><th>Afspraak</th><th>Locatie</th><th>Bijlagen</th><th>Status</th></tr></thead><tbody>';
    h += plan.items.map(function (p, i) {
      if (p.minor) return '';
      var r = p.r, dim = p.status === 'ongewijzigd';
      return '<tr data-wk="' + i + '" class="' + (dim ? 'dim' : p.on ? 'sel' : 'off') + (p.minor ? ' minor' : '') + '"' + (p.minor ? ' title="Waarschijnlijk geen vergadering: ' + esc(p.minor) + '"' : '') + '><td class="cb">' + (dim ? '' : '<input type="checkbox"' + (p.on ? ' checked' : '') + '>') + '</td><td>' + esc(fmtShort(p.date)) + '</td><td>' + esc((r.start || '') + (r.end ? '–' + r.end : '')) + '</td><td><b>' + esc(p.title) + '</b></td><td>' + esc(r.location || '') + '</td>' +
        '<td>' + (p.atts.length ? '<span title="' + esc(p.atts.map(function (a) { return attTarget(a); }).join('\n')) + '">' + ic('attach_file') + ' ' + p.atts.length + '</span>' : '') + '</td>' +
        '<td><span class="pill' + (dim ? ' grey' : '') + '">' + (p.status === 'nieuw' ? 'Nieuw' : p.status === 'bijwerken' ? 'Bijwerken' : 'Staat er al') + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<div class="wkacts"><button type="button" class="btn pri" id="wkGo"' + (nOn ? '' : ' disabled') + '>Importeer geselecteerde (' + nOn + ')</button><button type="button" class="btn" id="wkCancel">Annuleren</button></div></section>';
    return h;
  }
  function bindPlan() {
    var plan = A.wkPlan; if (!plan) return;
    function refresh() {
      var act = plan.items.filter(function (p) { return p.status !== 'ongewijzigd' && !p.minor; }), nOn = act.filter(function (p) { return p.on; }).length, go = $('#wkGo'), all = $('#wkall');
      $$('tr[data-wk]').forEach(function (tr) { var p = plan.items[+tr.dataset.wk]; if (p.status === 'ongewijzigd') return; tr.className = (p.on ? 'sel' : 'off') + (p.minor ? ' minor' : ''); tr.querySelector('input').checked = p.on; });
      go.textContent = 'Importeer geselecteerde (' + nOn + ')'; go.disabled = !nOn; all.checked = !!act.length && nOn === act.length;
    }
    $$('tr[data-wk]').forEach(function (tr) { var p = plan.items[+tr.dataset.wk]; if (p.status === 'ongewijzigd') return; tr.onclick = function () { p.on = !p.on; p.touched = true; refresh(); }; });
    $('#wkall').onchange = function () { var on = this.checked; plan.items.forEach(function (p) { if (p.status !== 'ongewijzigd' && !p.minor) p.on = on; }); refresh(); };
    var sm = $('#wkShowMin'); if (sm) sm.onclick = function () { plan.showMinor = !plan.showMinor; renderWeekImport(); };
    $('#wkIgn').onclick = function () { ignoreDialog(); };
    $('#wkCancel').onclick = function () { A.wkPlan = null; renderWeekImport(); toast('Er is niets geïmporteerd.'); };
    $('#wkGo').onclick = function () { this.disabled = true; applyPlan(plan); };
  }
  /* Dialoogvenster: trefwoorden en instellingen voor wat niet geïmporteerd wordt, en eerder uitgevinkte titels */
  function ignoreDialog() {
    var g = icsIgnore(), dlg = D.createElement('div');
    dlg.className = 'dlgbg';
    function draw() {
      var skipT = Object.keys(A.data.icsSkip || {}).sort();
      setHTML(dlg, '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">Niet importeren</h2>' +
        '<p class="muted">Afspraken met een van deze woorden in de titel worden overgeslagen. Hoofdletters maken niet uit.</p>' +
        '<div class="chips">' + (g.words.length ? g.words.map(function (w, i) { return '<span class="chip">' + esc(w) + '<button type="button" data-rmw="' + i + '" title="Verwijderen" aria-label="' + esc(w) + ' verwijderen">' + ic('close') + '</button></span>'; }).join('') : '<span class="muted">Geen trefwoorden.</span>') + '</div>' +
        '<form class="addw" id="addW"><input id="newW" placeholder="Nieuw trefwoord, bijv. Lunch of Focustijd" autocomplete="off"><button type="submit" class="btn sm">Toevoegen</button></form>' +
        '<label class="chk2"><input type="checkbox" id="shortOn"' + (g.shortOn ? ' checked' : '') + '> Ook afspraken van <input type="number" id="shortMin" min="5" max="60" step="5" value="' + g.shortMin + '"> minuten of korter overslaan als ze direct voor of na een andere vergadering liggen</label>' +
        (skipT.length ? '<h3>Eerder uitgevinkt</h3><p class="muted">Deze titels staan bij een volgende import standaard uit. Haal ze hier weg om ze weer aan te zetten.</p><div class="chips">' + skipT.map(function (t) { return '<span class="chip grey">' + esc(t) + '<button type="button" data-rmt="' + esc(t) + '" title="Weghalen">' + ic('close') + '</button></span>'; }).join('') + '</div>' : '') +
        '<div class="dlgacts"><button type="button" class="btn" id="dlgReset">Standaard herstellen</button><span class="sp"></span><button type="button" class="btn pri" id="dlgClose">Klaar</button></div></div>');
      $$('[data-rmw]', dlg).forEach(function (b) { b.onclick = function () { g.words.splice(+b.dataset.rmw, 1); changed(); }; });
      $$('[data-rmt]', dlg).forEach(function (b) { b.onclick = function () { delete A.data.icsSkip[b.dataset.rmt]; changed(); }; });
      $('#addW', dlg).onsubmit = function (e) { e.preventDefault(); var v = $('#newW', dlg).value.trim(); if (v && !g.words.some(function (w) { return w.toLowerCase() === v.toLowerCase(); })) g.words.push(v); changed(); var n = $('#newW', dlg); if (n) n.focus(); };
      $('#shortOn', dlg).onchange = function () { g.shortOn = this.checked; changed(true); };
      $('#shortMin', dlg).onchange = function () { g.shortMin = Math.max(5, Math.min(60, +this.value || 20)); changed(true); };
      $('#dlgReset', dlg).onclick = function () { g.words = IGNORE_DEF.slice(); g.shortOn = true; g.shortMin = 20; changed(); };
      $('#dlgClose', dlg).onclick = close;
    }
    function changed(keep) {
      persist();
      if (A.wkPlan) { markMinor(A.wkPlan.items); var skipT = A.data.icsSkip || {}; A.wkPlan.items.forEach(function (p) { if (p.status !== 'ongewijzigd' && !p.minor && !p.touched) p.on = !skipT[calNorm(p.title)]; }); }
      if (!keep) draw();
    }
    function close() { dlg.remove(); D.removeEventListener('keydown', esc1); if ((location.hash || '') === '#/weekagenda') renderWeekImport(); }
    function esc1(e) { if (e.key === 'Escape') close(); }
    dlg.onclick = function (e) { if (e.target === dlg) close(); };
    D.addEventListener('keydown', esc1);
    draw(); D.body.appendChild(dlg); var n = $('#newW', dlg); if (n) n.focus();
  }
  /* Stap 2: de aangevinkte afspraken opslaan, met bijlagen als stukken (mails omgezet naar PDF). */
  async function applyPlan(plan) {
    var now = new Date().toISOString(), made = [], upd = [], nAtt = 0, failAtt = [], skipT = A.data.icsSkip || (A.data.icsSkip = {}), titlesOn = {};
    var ibBefore = {}; ibAll().pts.forEach(function (p) { ibBefore[p.id] = p.r.st; });
    var todo = plan.items.filter(function (p) { return p.status !== 'ongewijzigd' && !p.minor; });
    todo.forEach(function (p) { if (p.on) titlesOn[calNorm(p.title)] = 1; });
    todo.forEach(function (p) { var k = calNorm(p.title); if (titlesOn[k]) delete skipT[k]; else skipT[k] = 1; });
    var sel = todo.filter(function (p) { return p.on; }), totalAtt = sel.reduce(function (n, p) { return n + p.atts.length; }, 0);
    try {
      for (var i = 0; i < sel.length; i++) {
        var p = sel[i], r = p.r, m = p.ex;
        if (m) {
          ['date', 'start', 'end', 'title', 'location', 'link', 'ibabs'].forEach(function (k) { var v = k === 'date' ? p.date : k === 'title' ? p.title : k === 'link' ? p.link : k === 'ibabs' ? p.ibabs : r[k]; if (v) m[k] = v; }); /* een import zonder link laat een bestaande of zelf geplakte link staan */
          if (!m.invitees && p.inv) m.invitees = p.inv;
          if (!m.notes && r.notes) m.notes = r.notes;
          m.icsKey = p.it.key; m.updated = now; upd.push(m); await ensureFolder(m);
        } else {
          m = { id: uid(), type: guessType(p.title), title: p.title, location: r.location || '', link: p.link, ibabs: p.ibabs, date: p.date, start: r.start, end: r.end, chair: '', invitees: p.inv, notes: r.notes || '',
            source: { from: '', sent: '', mail: p.file, skipped: [], how: 'agenda-export' }, files: [], created: now, icsKey: p.it.key };
          m.folder = safe((m.date || 'zonder datum') + ' ' + m.title).slice(0, 70) + ' [' + m.id.slice(-4) + ']';
          A.data.meetings.push(m); made.push(m); await ensureFolder(m);
        }
        for (var j = 0; j < p.atts.length; j++) {
          var a = p.atts[j], blob = new Blob([a.data], { type: a.type || guessMime(a.name) });
          toast('Stukken toevoegen… (' + (nAtt + failAtt.length + 1) + '/' + totalAtt + ') ' + a.name);
          try {
            /* een mail blijft een mail; zijn bijlagen komen als losse stukken erachter. Een zip wordt uitgepakt. */
            var parts = await expandFiles([{ name: a.name, type: a.type || guessMime(a.name), blob: blob }]);
            for (var q = 0; q < parts.length; q++) if (q === 0 || !hasStuk(m, parts[q].name)) await addFileTo(m, parts[q].name, parts[q].type, parts[q].blob);
            nAtt++;
          } catch (e) { console.error(e); failAtt.push(a.name); }
        }
      }
    } finally { await persist(); }
    A.wkPlan = null;
    var ibFound = ibAll().pts.filter(function (p) { return ibBefore[p.id] === 'wait' && p.r.st === 'open'; }).length;
    var ibMsg = ibFound ? ' ' + ibFound + ' wachtend' + (ibFound === 1 ? ' punt heeft' : 'e punten hebben') + ' een plek gevonden.' : '';
    var res = '<div class="info ' + (failAtt.length ? 'warn' : 'ok') + '">Geïmporteerd: <b>' + made.length + ' nieuw</b>, ' + upd.length + ' bijgewerkt' + (nAtt ? ', ' + nAtt + ' stuk' + (nAtt === 1 ? '' : 'ken') + ' toegevoegd' : '') + '.' + esc(ibMsg) + (failAtt.length ? ' Niet gelukt: ' + esc(failAtt.join(', ')) + '.' : '') + '</div>';
    var rows = made.map(function (m) { return [m, 'Nieuw']; }).concat(upd.map(function (m) { return [m, 'Bijgewerkt']; }))
      .sort(function (a, b) { return ((a[0].date || '') + (a[0].start || '')).localeCompare((b[0].date || '') + (b[0].start || '')); });
    if (rows.length) res += '<section class="card"><div class="tw"><table><thead><tr><th>Datum</th><th>Tijd</th><th>Vergadering</th><th>Stukken</th><th></th></tr></thead><tbody>' + rows.map(function (x) {
      var m = x[0]; return '<tr data-id="' + esc(m.id) + '"><td>' + esc(fmtShort(m.date)) + '</td><td>' + esc((m.start || '') + (m.end ? '–' + m.end : '')) + '</td><td><b>' + esc(m.title) + '</b></td><td>' + (m.files.length || '') + '</td><td><span class="pill">' + x[1] + '</span></td></tr>';
    }).join('') + '</tbody></table></div></section>';
    renderWeekImport(res);
    $$('#main tr[data-id]').forEach(function (tr) { tr.onclick = function () { location.hash = '#/v/' + encodeURIComponent(tr.dataset.id); }; });
    toast('Import klaar.' + ibMsg, 'ok');
  }
