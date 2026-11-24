  /* ================================================================== Vervolg: per vergadering een kort document met besluiten (=), acties (!)
     en meeneempunten (>) uit de aantekeningen. Bij een volgende vergadering met dezelfde titel (het vervolgoverleg) staat het document
     van de vorige keer klaar onder de knop Meeneempunten, en het staat bij elk verslag op het tabblad Verslagen. Het opent als popup. */

  /* woorden van een titel: kleine letters, zonder accenten, zonder vulwoorden */
  var MATCH_STOP = { bila: 1, po: 1, overleg: 1, bijpraten: 1, met: 1, de: 1, het: 1, een: 1 };
  function matchWords(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w && !MATCH_STOP[w]; }); }
  /* een titel zonder losse getallen, datums en voorvoegsels ("Teamoverleg 10-11" = "Teamoverleg 17 november" = "Bijgewerkt: Teamoverleg") */
  function plainTitle(s) { return matchWords(cleanSubject(String(s || '')).replace(/\b\d{1,4}[-\/.]\d{1,2}(?:[-\/.]\d{2,4})?\b/g, ' ')).filter(function (w) { return !/^\d+$/.test(w) && !MON[w]; }).join(' '); }
  function meetKey(m) { return (m.date || '') + ' ' + (m.start || ''); }
  function meetName(m) { return m ? m.title + (m.date ? ' (' + fmtShort(m.date) + ')' : '') : ''; }

  /* het vervolgdocument van vergadering m */
  function vervolgOf(m) {
    var acts = actionsOf(m).map(function (a) { return { id: a.id, text: a.text, done: isDone(a.id) }; });
    return { dec: decisionsOf(m), acts: acts, pts: pointsOf(m), n: decisionsOf(m).length + acts.length + pointsOf(m).length };
  }
  function vervolgSummary(v) {
    var o = [], open = v.acts.filter(function (a) { return !a.done; }).length;
    if (v.dec.length) o.push(v.dec.length + ' besluit' + (v.dec.length === 1 ? '' : 'en'));
    if (v.acts.length) o.push(v.acts.length + ' actie' + (v.acts.length === 1 ? '' : 's') + (open !== v.acts.length ? ' (' + open + ' open)' : ''));
    if (v.pts.length) o.push(v.pts.length + ' meeneempunt' + (v.pts.length === 1 ? '' : 'en'));
    return o.join(' · ') || 'niets vastgelegd';
  }
  /* De vorige vergadering voor m: zelf gekozen (m.prevId), of anders de laatste eerdere vergadering met dezelfde titel.
     m.prevId === '' betekent: bewust geen koppeling. */
  function prevMeeting(m) {
    if (m.prevId === '') return null;
    if (m.prevId) { var p = byId(m.prevId); if (p) return p; }
    var t = plainTitle(m.title), k = meetKey(m); if (!t) return null;
    return A.data.meetings.filter(function (x) { return x.id !== m.id && meetKey(x) < k && plainTitle(x.title) === t; })
      .sort(function (a, b) { return meetKey(b).localeCompare(meetKey(a)); })[0] || null;
  }

  /* De popup. src: de vergadering waarvan het document getoond wordt (mag leeg zijn). ctx: de vergadering waarvoor het vervolg
     geopend wordt (vanaf de vergaderpagina); dan kun je ook een andere vorige vergadering kiezen. Escape of klikken naast de popup sluit hem. */
  function openVervolg(src, ctx) {
    closeVervolg();
    var bg = D.createElement('div'); bg.className = 'dlgbg vvbg'; bg.id = 'vvDlg';
    function list(items, empty) { return items.length ? '<ul>' + items.join('') + '</ul>' : '<p class="muted vvnone">' + empty + '</p>'; }
    function draw() {
      var h = '<div class="dlg vv" role="dialog" aria-modal="true" aria-labelledby="vvT"><div class="vvhead"><div><h2 id="vvT">Besluiten, acties en meeneempunten</h2>';
      if (src) {
        var v = vervolgOf(src);
        h += '<p class="muted">' + (ctx && ctx !== src ? 'Uit het vorige overleg: ' : '') + '<b>' + esc(src.title) + '</b>' + (src.date ? ', ' + esc(fmtLong(src.date)) + (src.start ? ' ' + esc(src.start) : '') : '') + '</p></div><button type="button" class="vvx" id="vvX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div><div class="vvbody">';
        h += '<h3>Besluiten</h3>' + list(v.dec.map(function (t) { return '<li>' + esc(t) + '</li>'; }), 'Geen besluiten vastgelegd.');
        h += '<h3>Acties</h3>' + list(v.acts.map(function (a) { return '<li class="vvact' + (a.done ? ' done' : '') + '"><label><input type="checkbox" data-vva="' + esc(a.id) + '"' + (a.done ? ' checked' : '') + '> <span>' + esc(a.text) + '</span></label></li>'; }), 'Geen acties vastgelegd.');
        h += '<h3>Meeneempunten</h3>' + list(v.pts.map(function (t) { return '<li>' + esc(t) + '</li>'; }), 'Geen meeneempunten vastgelegd.');
        if (!v.n) h += '<p class="muted vvtip">Begin in de aantekeningen een regel met <code>=</code> voor een besluit, <code>!</code> voor een actie of <code>&gt;</code> voor een meeneempunt; die komen dan hier.</p>';
        h += '</div><div class="dlgacts"><a class="btn sm" href="#/v/' + encodeURIComponent(src.id) + '" data-vvgo="1">Naar die vergadering</a><a class="btn sm" href="#/verslag/' + encodeURIComponent(src.id) + '" data-vvgo="1">Verslag openen</a><span class="sp"></span>';
      } else {
        h += '<p class="muted">' + (ctx ? esc(ctx.title) : '') + '</p></div><button type="button" class="vvx" id="vvX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div><div class="vvbody">' +
          '<p>Er is nog geen eerdere vergadering met de titel <b>' + esc(ctx ? ctx.title : '') + '</b> gevonden. Kies hieronder zelf de vergadering waar dit het vervolg van is.</p></div><div class="dlgacts"><span class="sp"></span>';
      }
      if (ctx) {
        var auto = (function () { var keep = ctx.prevId; delete ctx.prevId; var r = prevMeeting(ctx); if (keep !== undefined) ctx.prevId = keep; return r; })();
        var opts = A.data.meetings.filter(function (x) { return x.id !== ctx.id && meetKey(x) < meetKey(ctx); }).sort(function (a, b) { return meetKey(b).localeCompare(meetKey(a)); }).slice(0, 60);
        h += '<label class="vvlink">Vervolg van <select id="vvSel"><option value=""' + (ctx.prevId === undefined ? ' selected' : '') + '>Automatisch' + (auto ? ': ' + esc(meetName(auto)) : ' (niets gevonden)') + '</option>' +
          opts.map(function (x) { return '<option value="' + esc(x.id) + '"' + (ctx.prevId === x.id ? ' selected' : '') + '>' + esc(meetName(x)) + '</option>'; }).join('') +
          '<option value="-"' + (ctx.prevId === '' ? ' selected' : '') + '>Geen vorige vergadering</option></select></label>';
      }
      h += '</div></div>';
      setHTML(bg, h);
      $('#vvX', bg).onclick = closeVervolg;
      $$('[data-vvgo]', bg).forEach(function (a) { a.addEventListener('click', function () { closeVervolg(); }); });
      $$('[data-vva]', bg).forEach(function (cb) { cb.onchange = async function () { setMeta(cb.dataset.vva, 'done', cb.checked ? new Date().toISOString() : null); await saveActions(src); draw(); if (ctx) refreshVervolgRow(ctx); }; });
      var sel = $('#vvSel', bg); if (sel) sel.onchange = async function () {
        if (sel.value === '') delete ctx.prevId; else if (sel.value === '-') ctx.prevId = ''; else ctx.prevId = sel.value;
        ctx.updated = new Date().toISOString(); await persist(); src = prevMeeting(ctx); draw(); refreshVervolgRow(ctx);
      };
    }
    draw();
    bg.addEventListener('click', function (e) { if (e.target === bg) closeVervolg(); });
    D.body.appendChild(bg);
    var x = $('#vvX', bg); if (x) x.focus();
  }
  function closeVervolg() { var d = $('#vvDlg'); if (d) d.remove(); }
  /* Escape sluit de popup (vóór andere sneltoetsen, zoals het verkleinen van de viewer) */
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#vvDlg')) { e.preventDefault(); e.stopPropagation(); closeVervolg(); } }, true);
  W.addEventListener('hashchange', closeVervolg);

  /* de regel bovenaan de stukken: het vervolgdocument van de vorige keer */
  function vervolgRowHtml(m) {
    var p = prevMeeting(m); if (!p) return '';
    return '<div class="vvrow" id="vvRow" role="button" tabindex="0" title="Besluiten, acties en meeneempunten van de vorige keer"><span class="vvic">' + ic('checklist') + '</span><span class="vvtx"><b>Vorig overleg</b> · ' + esc(fmtShort(p.date)) + '<small>' + esc(vervolgSummary(vervolgOf(p))) + '</small></span></div>';
  }
  function refreshVervolgRow(m) {
    var old = $('#vvRow'), html = vervolgRowHtml(m), box = D.createElement('div'); setHTML(box, html);
    var nw = box.firstChild;
    if (old && nw) old.replaceWith(nw); else if (old) old.remove(); else if (nw) { var hd = $('.ws .card.list .shead'); if (hd) hd.after(nw); }
    bindVervolgRow(m);
  }
  function bindVervolgRow(m) {
    var r = $('#vvRow'); if (!r) return;
    r.onclick = function () { openVervolg(prevMeeting(m), m); };
    r.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } };
  }
