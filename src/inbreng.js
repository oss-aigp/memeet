  /* ================================================================== Inbrengen: meeneempunten die vanzelf in het juiste overleg verschijnen
     Een regel die met > begint, is een meeneempunt. Waar hij heen gaat:
       > MT: tekst          het eerstvolgende overleg met "MT" in de titel (deel vóór de : is hooguit 4 woorden en een bekende titel,
                            een voornaam van een genodigde, of een titel die je zelf als overleg hebt aangemerkt; anders is het gewone tekst)
       > Jan tekst          het eerstvolgende overleg waar Jan genodigde is ("> Jan en Petra …" = Jan óf Petra)
       > tekst              de volgende keer van dit overleg (dezelfde titel, zoals vroeger)
       > MT: 15-1 tekst     niet vóór 15 januari (een maand vóór die van de bron = volgend jaar)
     Een regel die met ? begint, is een los idee (Ideeën-inbox). Beide zijn privé: ze gaan nooit mee in een mail.
     De punten worden steeds uit de tekst afgeleid (aantekeningen, terugkoppelvakken van een annotatie, losse herinneringen);
     alleen de status per punt wordt bewaard in A.data.pts[id] = { done: id-overleg, pin: id-overleg, keep: 1, dismiss: 1 }. */

  /* ---------- hulpjes */
  function ibNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function ibWords(s) { return ibNorm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean); }
  /* Staat de woordreeks "part" achter elkaar in de titel? Hele woorden ("Balie" in "Projectoverleg Digitale Balie", "MT" in "MT-overleg",
     niet "mt" in "Commitment"), of het begin van een woord vanaf drie letters ("Team" in "Teamoverleg", "project" in "Projectoverleg").
     exact: alleen hele woorden. */
  function ibInTitle(part, title, exact) {
    var p = ibWords(part), t = ibWords(title); if (!p.length) return false;
    for (var i = 0; i + p.length <= t.length; i++) {
      var ok = true;
      for (var j = 0; j < p.length; j++) { var a = p[j], b = t[i + j]; if (b !== a && (exact || a.length < 3 || b.indexOf(a) !== 0)) { ok = false; break; } }
      if (ok) return true;
    }
    return false;
  }
  /* de voornaam van een genodigde ("Jan de Vries" → jan, "jan.devries@org.nl" → jan) */
  function ibFirst(n) { n = String(n || '').trim(); if (/@/.test(n)) n = n.split('@')[0].split(/[._-]/)[0]; return ibNorm(n.split(/\s+/)[0]).replace(/[^\p{L}-]/gu, ''); }
  function ibInvFirst(m) { return names(m.invitees).map(ibFirst).filter(Boolean); }
  function ibState() { return A.data.pts || (A.data.pts = {}); }
  function ibGet(id) { return ibState()[id] || {}; }
  function ibSet(id, k, v) { var s = ibState(), o = s[id] || (s[id] = {}); if (v == null || v === '' || v === false) delete o[k]; else o[k] = v; if (!Object.keys(o).length) delete s[id]; }
  function ibNowKey() { if (A.fakeNow) return A.fakeNow; var d = new Date(); return todayIso() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ibKey(m) { return (m.date || '') + ' ' + (m.start || '00:00'); }
  /* een overleg is voorbij als de eindtijd verstreken is (zonder tijden: aan het eind van de dag) */
  function ibFinished(m) { return (m.date || '9999') + ' ' + (m.end || m.start || '23:59') <= ibNowKey(); }
  function ibSort(a, b) { return ibKey(a) < ibKey(b) ? -1 : ibKey(a) > ibKey(b) ? 1 : 0; }

  /* ---------- wat MeMeet kent: voornamen van genodigden, titels van overleggen, en titels die je zelf als overleg hebt aangemerkt */
  function ibPeople() {
    var o = {}; A.data.meetings.forEach(function (m) { names(m.invitees).forEach(function (n) { var f = ibFirst(n); if (f && f.length > 1 && !o[f]) o[f] = String(n).trim().split(/\s+/)[0].split('@')[0].replace(/^./, function (c) { return c.toUpperCase(); }); }); });
    return o;
  }
  function ibExtra() { return A.data.ibTitles || (A.data.ibTitles = {}); }
  function ibKnownTitle(part, people, exact) {
    var k = ibNorm(part); if (!k) return false;
    if ((people || ibPeople())[k] || ibExtra()[k]) return true;
    return A.data.meetings.some(function (c) { return ibInTitle(part, c.title, exact); });
  }

  /* ---------- de bronnen: vergaderingen (aantekeningen en annotatie) en losse herinneringen */
  function ibRems() { return A.data.rem || (A.data.rem = []); }
  /* een losse herinnering gedraagt zich als een bron met een datum en tijd (het moment van toevoegen) */
  function ibRemSrc(r) { var d = new Date(r.created); return { id: r.id, rem: r, title: 'Losse herinnering', date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), start: pad(d.getHours()) + ':' + pad(d.getMinutes()), invitees: '' }; }

  /* één regel lezen. src: de bron (vergadering of herinnering). Geeft null voor een gewone regel. */
  function ibParse(line, src, ctx) {
    var c, people = (ctx && ctx.people) || ibPeople();
    if ((c = /^\s*>\s*(.+?)\s*$/.exec(line))) {
      var body = c[1], persons = [], title = '', rest = body, unk = '', cm = /^([^:]{1,60}?)\s*:\s*(.*)$/.exec(body);
      var short = cm && cm[1].trim().split(/\s+/).length <= 4 && !/[>?!=]/.test(cm[1]);
      if (short && (src.rem || ibKnownTitle(cm[1], people))) { title = cm[1].trim(); rest = cm[2]; }
      else {
        if (short) unk = cm[1].trim();
        var ws = body.split(/\s+/), i = 0;
        while (i < ws.length) {
          var f = ibNorm(ws[i].replace(/[,;]+$/, ''));
          if (people[f]) { if (persons.indexOf(f) < 0) persons.push(f); i++; }
          else if (persons.length && /^(en|of|\+|&)$/i.test(ws[i]) && ws[i + 1] && people[ibNorm(ws[i + 1].replace(/[,;]+$/, ''))]) i++;
          else break;
        }
        if (persons.length && i >= ws.length) { persons = []; i = 0; } /* alleen een naam en verder niets: gewone tekst */
        rest = ws.slice(i).join(' ');
        if (persons.length) unk = '';
        /* een losse herinnering zonder dubbele punt: begint hij met (een deel van) een bekende overlegtitel, dan is dat de bestemming
           ("> Teamoverleg rooster bespreken", "> Stuurgroep Huisvesting budget"). Alleen hele woorden, en er moet tekst overblijven. */
        if (src.rem && !persons.length) {
          for (var nw = Math.min(4, ws.length - 1); nw >= 1; nw--) {
            var cand = ws.slice(0, nw).join(' ').replace(/[,;]+$/, '');
            if (!people[ibNorm(cand)] && (ibExtra()[ibNorm(cand)] || A.data.meetings.some(function (c) { return ibInTitle(cand, c.title, true); }))) { title = cand; rest = ws.slice(nw).join(' '); unk = ''; break; }
          }
        }
      }
      var gate = '', g = /^(\d{1,2})-(\d{1,2})(?:\s+|$)(.*)$/.exec(rest);
      if (g && +g[2] >= 1 && +g[2] <= 12 && +g[1] >= 1 && +g[1] <= 31) {
        var y = +String(src.date || todayIso()).slice(0, 4), mo = +g[2]; if (src.date && mo < +src.date.slice(5, 7)) y++;
        gate = y + '-' + pad(mo) + '-' + pad(+g[1]); rest = g[3];
      }
      var it = { k: '>', raw: line, body: body, text: rest || body, persons: persons, title: title, gate: gate, unk: unk, src: src, id: src.id + '|' + ibNorm(body) };
      if (src.rem && !title && !persons.length) { it.k = '?'; it.id = src.id + '|?' + ibNorm(body); } /* losse herinnering zonder bestemming: naar de inbox */
      return it;
    }
    if ((c = /^\s*\?\s*(.+?)\s*$/.exec(line))) return { k: '?', raw: line, body: c[1], text: c[1].replace(/^idee\s*:\s*/i, ''), src: src, id: src.id + '|?' + ibNorm(c[1]) };
    return null;
  }
  /* alle punten en ideeën van een bron, met de plek waar ze staan (regel in de aantekeningen, of agendapunt en regel in de annotatie) */
  function ibItemsOf(src, ctx) {
    var out = [], seen = {};
    function add(it) { if (!it || seen[it.id]) return; seen[it.id] = 1; out.push(it); }
    if (src.rem) { var it = ibParse(/^\s*[>?]/.test(src.rem.line) ? src.rem.line : '> ' + src.rem.line, src, ctx); if (it) { it.where = 'rem'; add(it); } return out; }
    String(src.minutes || '').split(/\r?\n/).forEach(function (l, i) { var it = ibParse(l, src, ctx); if (it) { it.where = 'notes'; it.line = i; add(it); } });
    return out;
  }
  function ibSources() { return A.data.meetings.concat(ibRems().map(ibRemSrc)); }

  /* ---------- de kern: bij welk overleg hoort een punt? */
  function ibMatches(p, c) {
    if (p.title) return ibInTitle(p.title, c.title);
    if (p.persons.length) { var inv = ibInvFirst(c); return p.persons.some(function (x) { return inv.indexOf(x) >= 0; }); }
    var t = plainTitle(p.src.title); return !!t && plainTitle(c.title) === t;
  }
  /* geeft { st: 'open'|'done'|'wait', m: overleg, path: [langsgekomen overleggen], carried: aantal keer doorgeschoven } */
  function ibResolve(p) {
    var st = ibGet(p.id), pin = st.pin ? byId(st.pin) : null, from = ibKey(p.src);
    var cands = A.data.meetings.filter(function (c) {
      /* na de bron; een overleg zonder tijd telt op zijn datum de hele dag */
      if (c.id === p.src.id || !c.date || (c.start ? ibKey(c) <= from : c.date < p.src.date || (c.date === p.src.date && !p.src.rem && !p.src.start))) return false;
      if (p.gate && c.date < p.gate) return false;
      return pin ? (c === pin || (ibKey(c) > ibKey(pin) && ibMatches(p, c))) : ibMatches(p, c);
    }).sort(ibSort);
    var path = [], carried = 0;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i]; path.push(c);
      if (st.done === c.id) return { st: 'done', m: c, path: path, carried: carried };
      if (ibFinished(c)) { carried++; continue; }
      return { st: 'open', m: c, path: path, carried: carried };
    }
    if (st.done) return { st: 'done', m: byId(st.done), path: path, carried: carried };
    return { st: 'wait', path: path, carried: carried };
  }
  function ibWaitWhy(p, people) {
    var w; people = people || ibPeople();
    if (p.title) w = 'nog geen overleg met “' + p.title + '” in de titel';
    else if (p.persons.length) w = 'nog geen overleg met ' + p.persons.map(function (x) { return people[x] || x; }).join(' of ') + ' in je agenda';
    else w = 'nog geen volgend “' + p.src.title + '” in je agenda';
    if (p.gate) w += ' (en niet vóór ' + fmtDay(p.gate) + ')';
    return w;
  }
  /* alle punten (zonder de weggehaalde), met de toewijzing erbij; en alle ideeën */
  function ibAll() {
    var ctx = { people: ibPeople() }, pts = [], ideas = [];
    ibSources().forEach(function (s) { ibItemsOf(s, ctx).forEach(function (it) { if (it.k === '?') ideas.push(it); else if (!ibGet(it.id).dismiss) { it.r = ibResolve(it); pts.push(it); } }); });
    return { pts: pts, ideas: ideas, people: ctx.people };
  }
  function ibOpenFor(m, all) { return (all || ibAll()).pts.filter(function (p) { return p.r.st === 'open' && p.r.m === m; }); }
  /* de naam van een overleg of bron, kort: "MT · di 24 nov" of "losse herinnering · 25 nov 10:12" */
  function ibName(m) { return !m ? '' : m.rem ? 'losse herinnering · ' + fmtDay(m.date) + ' ' + m.start : (m.title || 'Vergadering') + (m.date ? ' · ' + fmtDay(m.date) : ''); }
  /* regels die met > of ? beginnen zijn privé: die gaan nooit mee in een mail */
  function ibIsPriv(l) { return /^\s*[>?]/.test(l); }
  function ibStripPriv(text) { return String(text || '').split(/\r?\n/).filter(function (l) { return !ibIsPriv(l); }).join('\n'); }

  /* ================================================================== weergave op de vergaderpagina */
  /* het gele vak boven de aantekeningen: wat je in dit overleg inbrengt (zonder titel). Punten die hier langskwamen maar
     doorgeschoven of elders besproken zijn, staan grijs met waar ze nu staan. */
  function ibHereList(m, all) {
    return all.pts.filter(function (p) { return p.r.path.indexOf(m) >= 0 || (p.r.st === 'done' && p.r.m === m); });
  }
  function ibSrcLink(p) {
    return '<button type="button" class="link ibsrc" data-ibctx="' + esc(p.id) + '" title="Bekijk waar dit punt vandaan komt">uit ' + esc(ibName(p.src)) + '</button>';
  }
  function ibInbHtml(m, all) {
    var pts = ibHereList(m, all); if (!pts.length) return '';
    return '<div class="inb" id="ibInb"><ul>' + pts.map(function (p) {
      var st = p.r.st === 'done' && p.r.m === m ? 'ticked' : p.r.st === 'open' && p.r.m === m ? 'open' : 'moved';
      var nC = st === 'moved' ? 0 : p.r.carried;
      var where = st !== 'moved' ? '' : p.r.st === 'open' ? 'doorgeschoven naar ' + ibName(p.r.m) : p.r.st === 'done' ? 'besproken in ' + ibName(p.r.m) : 'wacht op een volgend overleg';
      var ask = st === 'open' && p.r.carried >= 2 && !ibGet(p.id).keep ? '<div class="ask">Nog relevant? <button type="button" class="btn sm" data-ibkeep="' + esc(p.id) + '">Ja, laten staan</button><button type="button" class="btn sm" data-ibdrop="' + esc(p.id) + '">Nee, weg</button></div>' : '';
      return '<li class="' + st + '"><input type="checkbox" data-ibtick="' + esc(p.id) + '"' + (st === 'ticked' ? ' checked' : '') + (st === 'moved' ? ' disabled' : '') + ' title="' + (st === 'moved' ? '' : 'Besproken in dit overleg') + '" aria-label="Besproken: ' + esc(p.text) + '">' +
        '<div><span class="tx">' + esc(p.text) + '</span>' + (nC ? '<span class="tag" title="' + nC + '× doorgeschoven">' + nC + '×</span>' : '') + ' <span class="src">' + ibSrcLink(p) + (where ? ' · ' + esc(where) : '') + '</span>' + ask + '</div></li>';
    }).join('') + '</ul></div>';
  }
  /* "Herkend": per regel met > ? ! = waar hij heen gaat; de bestemming is een keuzelijst (vastzetten of automatisch) */
  function ibPreviewHtml(m, all) {
    var lines = String(m.minutes || '').split(/\r?\n/), ctx = { people: all.people }, rows = [], byId = {};
    all.pts.forEach(function (p) { byId[p.id] = p; });
    var opts = A.data.meetings.filter(function (c) { return c.date && c.id !== m.id && ibKey(c) > ibKey(m) && !ibFinished(c); }).sort(ibSort).slice(0, 40);
    lines.forEach(function (l) {
      var it = ibParse(l, m, ctx), c;
      if (it && it.k === '>') {
        var p = byId[it.id], to;
        if (ibGet(it.id).dismiss) to = '<span class="to muted">weggehaald</span>';
        else if (p && p.r.st === 'done') to = '<span class="to go">' + ic('check') + ' besproken ' + esc(fmtDay(p.r.m.date)) + '</span>';
        else {
          var r = p ? p.r : ibResolve(it), pin = ibGet(it.id).pin;
          to = '<select class="to ' + (r.st === 'open' ? 'go' : 'wait') + '" data-ibpin="' + esc(it.id) + '" title="Klopt dit niet? Kies een ander overleg.">' +
            (r.st === 'open' ? '<option value="">→ ' + esc(ibName(r.m)) + '</option>' : '<option value="">⏳ wacht: ' + esc(ibWaitWhy(it, all.people)) + '</option>') +
            opts.filter(function (c) { return !(r.st === 'open' && c === r.m && !pin); }).map(function (c) { return '<option value="' + esc(c.id) + '"' + (pin === c.id ? ' selected' : '') + '>→ ' + esc(ibName(c)) + '</option>'; }).join('') +
            (pin ? '<option value="-">↺ automatisch</option>' : '') + '</select>';
        }
        var hint = it.unk ? '<div class="why">“' + esc(it.unk) + '” ken ik niet als overleg. <button type="button" class="link" data-ibextra="' + esc(it.unk) + '">Het is een overleg</button></div>' : '';
        rows.push('<li><span class="k">&gt;</span><span class="t">' + esc(it.text) + ibChips(it, all.people) + '</span>' + to + hint + '</li>');
      } else if (it && it.k === '?') rows.push('<li><span class="k">?</span><span class="t">' + esc(it.text) + '</span><span class="to">→ Ideeën-inbox</span></li>');
      else if ((c = ACT_RE.exec(l))) rows.push('<li><span class="k">!</span><span class="t">' + esc(c[2]) + '</span><span class="to muted">→ Actielijst</span></li>');
      else if ((c = DEC_RE.exec(l))) rows.push('<li><span class="k">=</span><span class="t">' + esc(c[1]) + '</span><span class="to muted">besluit</span></li>');
    });
    return rows.length ? '<h4>Herkend</h4><ul>' + rows.join('') + '</ul>' : '';
  }
  function ibChips(p, people) {
    var h = '';
    if (ibGet(p.id).pin) h += '<span class="chip">zelf gekozen</span>';
    else if (p.title) h += '<span class="chip">titel bevat “' + esc(p.title) + '”</span>';
    else if (p.persons.length) h += '<span class="chip">met ' + esc(p.persons.map(function (x) { return (people || {})[x] || x; }).join(' of ')) + '</span>';
    if (p.gate) h += '<span class="chip">niet vóór ' + esc(fmtDay(p.gate)) + '</span>';
    return h ? ' ' + h : '';
  }
  /* de bestemming als klein keuzelijstje: laat zien waarop het punt wacht ("titel bevat …", "met Jan") en laat je zelf een overleg kiezen */
  function ibRouteLabel(p, people) {
    var pin = ibGet(p.id).pin, pm = pin ? byId(pin) : null;
    if (pm) return 'zelf gekozen: ' + ibName(pm);
    if (p.title) return 'titel bevat “' + p.title + '”';
    if (p.persons.length) return 'met ' + p.persons.map(function (x) { return (people || {})[x] || x; }).join(' of ');
    return 'volgende ' + (p.src.title || 'overleg');
  }
  function ibChipSel(p, people) {
    var pin = ibGet(p.id).pin, from = ibKey(p.src);
    var opts = A.data.meetings.filter(function (c) { return c.date && !ibFinished(c) && c.id !== p.src.id && (c.start ? ibKey(c) > from : c.date >= p.src.date); }).sort(ibSort).slice(0, 40);
    return '<select class="chipsel" data-ibpinsel="' + esc(p.id) + '" title="Kies zelf een overleg voor dit punt" aria-label="Overleg kiezen voor: ' + esc(p.text) + '"><option value="">' + esc(ibRouteLabel(p, people)) + ' ▾</option>' +
      opts.filter(function (c) { return c.id !== pin; }).map(function (c) { return '<option value="' + esc(c.id) + '">→ ' + esc(ibName(c)) + '</option>'; }).join('') +
      (pin ? '<option value="-">↺ weer automatisch</option>' : '') + '</select>' + (p.gate ? '<span class="chip">niet vóór ' + esc(fmtDay(p.gate)) + '</span>' : '');
  }
  var IB_LEGEND = '<div class="iblegend" title="&gt; Jan … gaat naar het eerstvolgende overleg met Jan&#10;&gt; MT: … gaat naar het eerstvolgende overleg met MT in de titel&#10;&gt; MT: 15-1 … niet vóór 15 januari&#10;&gt; … zonder naam of overleg: de volgende keer van dit overleg&#10;? … een los idee, in de Ideeën-inbox&#10;! … een actie (Actielijst)   = … een besluit&#10;Regels met &gt; en ? zijn privé: ze gaan niet mee in de mail."><code>!</code> actie · <code>=</code> besluit · <code>?</code> idee · <code>&gt;</code> meeneempunt (<code>&gt; Jan</code>, <code>&gt; MT:</code>)</div>';

  /* het vak en Herkend opnieuw tekenen, zonder het tekstvak aan te raken */
  function ibRefresh(m) {
    var all = ibAll(), inb = $('#ibInbW'), pv = $('#ibPvw');
    if (inb) { setHTML(inb, ibInbHtml(m, all)); }
    if (pv) { var ph = ibPreviewHtml(m, all); setHTML(pv, ph); pv.hidden = !ph; }
    ibBind(m);
  }
  async function ibSave(m) { await persist(); if (typeof renderSide === 'function') renderSide(); ibRefresh(m); }
  function ibBind(m) {
    var np = $('#np'); if (!np) return;
    $$('[data-ibtick]', np).forEach(function (cb) { cb.onchange = function () { ibSet(cb.dataset.ibtick, 'done', cb.checked ? m.id : null); ibSave(m); }; });
    $$('[data-ibkeep]', np).forEach(function (b) { b.onclick = function () { ibSet(b.dataset.ibkeep, 'keep', 1); ibSave(m); }; });
    $$('[data-ibdrop]', np).forEach(function (b) { b.onclick = function () { ibSet(b.dataset.ibdrop, 'dismiss', 1); ibSave(m); toast('Punt uit de wachtrij gehaald. De regel blijft in je aantekeningen staan.', 'ok'); }; });
    $$('[data-ibpin]', np).forEach(function (s) { s.onchange = function () { if (s.value === '-') ibSet(s.dataset.ibpin, 'pin', null); else if (s.value) ibSet(s.dataset.ibpin, 'pin', s.value); ibSave(m); toast(s.value === '-' ? 'Weer automatisch.' : 'Bestemming aangepast.', 'ok'); }; });
    $$('[data-ibextra]', np).forEach(function (b) { b.onclick = function () { ibExtra()[ibNorm(b.dataset.ibextra)] = 1; ibSave(m); toast('Onthouden: “' + b.dataset.ibextra + '” is een overleg. Het punt wacht tot dat overleg in je agenda staat.', 'ok'); }; });
    ibBindCtx(np);
  }
  function ibBindCtx(root) { $$('[data-ibctx]', root).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openIbCtx(b.dataset.ibctx); }; }); }

  /* ---------- voorstellen tijdens het typen: direct na > personen (voornaam + spatie) en overleggen (titel + ": ") */
  function ibTitleSugs() {
    var seen = {}, out = [];
    A.data.meetings.slice().sort(ibSort).reverse().forEach(function (c) { var t = cleanSubject(c.title || '').replace(/\s+\d{1,2}[-\/.]\d{1,2}([-\/.]\d{2,4})?$/, '').trim(); var k = ibNorm(t); if (t && !seen[k]) { seen[k] = 1; out.push(t); } });
    Object.keys(ibExtra()).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    return out;
  }
  function ibAc(el, box, alwaysPoint) {
    if (!box) return;
    var before = el.value.slice(0, el.selectionStart), line = before.split('\n').pop();
    if (alwaysPoint && !/^\s*[>?]/.test(line)) line = '> ' + line;
    var mm = /^\s*>\s*([^\s:]*)$/.exec(line);
    if (!mm) { setHTML(box, ''); box.hidden = true; return; }
    var t = ibNorm(mm[1]), people = ibPeople();
    var ppl = Object.keys(people).filter(function (k) { return k.indexOf(t) === 0; }).sort().slice(0, 8);
    var ttl = ibTitleSugs().filter(function (x) { return !t || ibNorm(x).split(' ').concat(ibWords(x)).some(function (w) { return w.indexOf(t) === 0; }); }).slice(0, 8);
    if (!ppl.length && !ttl.length) { setHTML(box, ''); box.hidden = true; return; }
    setHTML(box, '<span class="aclbl">Persoon</span>' + (ppl.map(function (k) { return '<button type="button" class="chip btn" data-ins="' + esc(people[k]) + ' ">' + esc(people[k]) + '</button>'; }).join('') || '—') +
      '<span class="aclbl">Overleg</span>' + (ttl.map(function (x) { return '<button type="button" class="chip btn" data-ins="' + esc(x) + ': ">' + esc(x) + ':</button>'; }).join('') || '—'));
    box.hidden = false;
    $$('[data-ins]', box).forEach(function (c) { c.onmousedown = function (e) {
      e.preventDefault(); var pos = el.selectionStart;
      el.setRangeText(c.dataset.ins, pos - mm[1].length, pos, 'end'); el.dispatchEvent(new Event('input')); el.focus(); ibAc(el, box, alwaysPoint);
    }; });
  }

  /* ---------- context: waar komt een punt vandaan? */
  function ibFindPoint(id) { var all = ibAll(); return all.pts.concat(all.ideas).filter(function (p) { return p.id === id; })[0]; }
  function closeIbCtx() { var d = $('#ibCtx'); if (d) d.remove(); }
  function openIbCtx(id) {
    var p = ibFindPoint(id); if (!p) return;
    closeIbCtx();
    var s = p.src, bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'ibCtx';
    var head, body, acts;
    if (s.rem) {
      head = '<h2 id="ibCtxT">Losse herinnering</h2><p class="muted">Toegevoegd op ' + esc(fmtLong(s.date)) + ' om ' + esc(s.start) + '</p>';
      body = '<pre class="ibnotes"><mark>' + esc(s.rem.line) + '</mark></pre><p class="muted ibsmall">Deze herinnering heb je los van een overleg toegevoegd, op het tabblad Herinneringen.</p>';
      acts = '';
    } else {
      head = '<p class="muted ibsmall">Waar dit punt vandaan komt</p><h2 id="ibCtxT">' + esc(s.title) + '</h2><p class="muted">' + esc(fmtLong(s.date)) + (s.start ? ', ' + esc(s.start) : '') + (names(s.invitees).length ? ' · ' + esc(names(s.invitees).join(', ')) : '') + '</p>';
      body = '<pre class="ibnotes">' + String(s.minutes || '').split(/\r?\n/).map(function (l, i) { return i === p.line ? '<mark>' + esc(l) + '</mark>' : esc(l); }).join('\n') + '</pre>' +
        '<p class="muted ibsmall">Stukken van dat overleg: ' + (s.files && s.files.length ? s.files.map(function (f) { return esc(f.name); }).join(', ') : 'geen') + '</p>';
      acts = '<a class="btn" href="#/v/' + esc(encodeURIComponent(s.id)) + '">Open dat overleg</a>';
    }
    setHTML(bg, '<div class="dlg ibctx" role="dialog" aria-modal="true" aria-labelledby="ibCtxT"><div class="vvhead"><div>' + head + '</div><button type="button" class="vvx" id="ibCtxX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="ibctxb">' + body + '</div>' + (acts ? '<div class="dlgacts">' + acts + '</div>' : '') + '</div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeIbCtx(); });
    $('#ibCtxX', bg).onclick = closeIbCtx;
    $$('a.btn', bg).forEach(function (a) { a.addEventListener('click', function () { closeIbCtx(); }); });
    var mk = $('mark', bg); if (mk) mk.scrollIntoView({ block: 'center' });
    try { $('#ibCtxX', bg).focus(); } catch (e) {}
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#ibCtx')) { e.preventDefault(); e.stopPropagation(); closeIbCtx(); } }, true);
  W.addEventListener('hashchange', function () { closeIbCtx(); });

  /* ================================================================== startscherm en tabblad Herinneringen */
  function ibCountFor(m, all) { return all.pts.filter(function (p) { return p.r.st === 'open' && p.r.m === m; }).length; }
  function ibOpenCount() { return ibAll().pts.filter(function (p) { return p.r.st !== 'done'; }).length; }
  /* banner met het eerstvolgende overleg en wat je daar inbrengt */
  function ibBannerHtml(all) {
    var next = A.data.meetings.filter(function (m) { return m.date && !ibFinished(m); }).sort(ibSort)[0];
    if (!next) return '';
    var pts = all.pts.filter(function (p) { return p.r.st === 'open' && p.r.m === next; }), today = todayIso();
    return '<section class="ibbanner"><div class="ibbtx"><div class="ibbwhen">Eerstvolgend overleg' + (next.date === today ? ', vandaag' : ', ' + esc(fmtLong(next.date))) + '</div>' +
      '<div class="ibbig">' + esc(next.start || '') + '  ' + esc(next.title) + '</div>' +
      (pts.length ? '<ul>' + pts.slice(0, 6).map(function (p) { return '<li>' + esc(p.text) + '</li>'; }).join('') + (pts.length > 6 ? '<li>… en nog ' + (pts.length - 6) + '</li>' : '') + '</ul>' : '<div class="ibbnone">Niets om in te brengen.</div>') +
      '</div><a class="btn" href="#/v/' + esc(encodeURIComponent(next.id)) + '">Openen</a></section>';
  }
  function ibWaitHtml(all) {
    var w = all.pts.filter(function (p) { return p.r.st === 'wait'; });
    return '<section class="card ibcard"><h2>Wacht op overleg <span class="muted">' + w.length + '</span></h2>' + (w.length ? '<ul class="iblist">' + w.map(function (p) {
      return '<li class="ibrow"><b>' + esc(p.text) + '</b>' + ibChipSel(p, all.people) + '<span class="src">' + ibSrcLink(p) + '</span>' + (p.src.rem ? '<button type="button" class="link ibx" data-ibdel="' + esc(p.src.id) + '" title="Herinnering verwijderen" aria-label="Herinnering verwijderen">' + ic('close') + '</button>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="muted ibempty">Alles heeft een plek gevonden.</p>') + '</section>';
  }
  /* de Ideeën-inbox: alle ?-regels. Koppelen herschrijft de regel op de plek waar hij staat naar "> Jan tekst" of "> MT: tekst". */
  function ibLinkTargets(all) {
    var cnt = {}; A.data.meetings.forEach(function (m) { if (m.date >= addDays(todayIso(), -60)) ibInvFirst(m).forEach(function (f) { cnt[f] = (cnt[f] || 0) + 1; }); });
    var ppl = Object.keys(cnt).filter(function (k) { return all.people[k]; }).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 8).map(function (k) { return { to: all.people[k], label: all.people[k] }; });
    var seen = {}, ttl = A.data.meetings.filter(function (m) { return m.date && !ibFinished(m); }).sort(ibSort).map(function (m) { return cleanSubject(m.title || '').trim(); })
      .filter(function (t) { var k = ibNorm(t); if (!t || seen[k] || all.people[k]) return false; seen[k] = 1; return true; }).slice(0, 6).map(function (t) { return { to: t + ':', label: t }; });
    return ppl.concat(ttl);
  }
  function ibIdeasHtml(all) {
    var ideas = all.ideas, tg = ibLinkTargets(all);
    return '<section class="card ibcard"><h2>Ideeën-inbox <span class="muted">' + ideas.length + '</span></h2>' + (ideas.length ? '<ul class="iblist">' + ideas.map(function (it, i) {
      return '<li><b>' + esc(it.text) + '</b>' + (it.src.rem ? ' <button type="button" class="link ibx" data-ibdel="' + esc(it.src.id) + '" title="Idee verwijderen" aria-label="Idee verwijderen">' + ic('close') + '</button>' : '') + '<div class="src">' + ibSrcLink(it) + '</div>' +
        (tg.length ? '<div class="iblink">Koppel aan: ' + tg.map(function (t) { return '<button type="button" class="chip btn" data-ibidea="' + i + '" data-to="' + esc(t.to) + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="muted ibempty">Leeg. Begin een regel met <code>?</code> voor een los idee.</p>') + '</section>';
  }
  async function ibRelink(it, to) {
    var nl = '> ' + to + ' ' + it.text, s = it.src;
    if (it.where === 'rem') s.rem.line = nl;
    else { var ls = String(s.minutes || '').split(/\r?\n/); ls[it.line] = nl; s.minutes = ls.join('\n'); delete s.minutesHtml; if (typeof saveMinutes === 'function') { await saveMinutes(s); return; } }
    await persist();
  }
  /* knoppen in de lijsten (startscherm en Herinneringen); after: opnieuw tekenen */
  function ibBindLists(root, all, after) {
    $$('[data-ibidea]', root).forEach(function (b) { b.onclick = async function () {
      var it = all.ideas[+b.dataset.ibidea]; await ibRelink(it, b.dataset.to); after();
      toast('Gekoppeld aan ' + b.dataset.to.replace(/:$/, '') + '. Het ligt klaar bij het eerstvolgende passende overleg.', 'ok');
    }; });
    $$('[data-ibpinsel]', root).forEach(function (s) { s.onchange = async function () {
      if (!s.value) return; ibSet(s.dataset.ibpinsel, 'pin', s.value === '-' ? null : s.value); await persist(); after();
      toast(s.value === '-' ? 'Weer automatisch.' : 'Komt op bij ' + ibName(byId(s.value)) + '.', 'ok');
    }; });
    $$('[data-ibdel]', root).forEach(function (b) { b.onclick = async function (e) {
      e.stopPropagation(); A.data.rem = ibRems().filter(function (r) { return r.id !== b.dataset.ibdel; }); await persist(); after(); toast('Herinnering verwijderd.', 'ok');
    }; });
    ibBindCtx(root);
  }

  /* ---------- tabblad Herinneringen: rechts naast de titel een vak om een herinnering toe te voegen; daaronder vier gelijke vakken */
  function renderReminders() {
    var all = ibAll(), main = $('#main');
    var h = '<div class="head ibremhead"><h1>Herinneringen</h1><span class="hhint">Alles wat je ergens wilt inbrengen, op één plek</span>' +
      '<div class="remadd"><div class="qa"><input id="remIn" autocomplete="off" spellcheck="false" placeholder="Nieuwe herinnering, bijvoorbeeld: Jan opleidingsbudget, of MT: begroting" aria-label="Nieuwe herinnering" title="Jan … = eerstvolgende overleg met Jan&#10;MT: … = overleg met MT in de titel (ook als het nog niet in je agenda staat)&#10;MT: 15-1 … = niet vóór 15 januari&#10;Zonder naam of overleg: naar de Ideeën-inbox"><button type="button" class="btn pri" id="remAdd">' + ic('add') + ' Toevoegen</button></div>' +
      '<div class="ac" id="remAc" hidden></div><div class="qprev" id="remPv"></div></div></div>';
    var groups = {}, order = [];
    all.pts.forEach(function (p) { if (p.r.st !== 'open') return; var id = p.r.m.id; if (!groups[id]) { groups[id] = []; order.push(p.r.m); } groups[id].push(p); });
    order.sort(ibSort);
    var nOpen = order.reduce(function (a, m) { return a + groups[m.id].length; }, 0);
    var done = all.pts.filter(function (p) { return p.r.st === 'done'; });
    h += '<div class="ibquad">';
    h += '<section class="card ibcard"><h2>Komt op <span class="muted">' + nOpen + '</span></h2><div class="ibscroll">' + (order.length ? order.map(function (m) {
      return '<div class="ibgrp"><h3><a href="#/v/' + esc(encodeURIComponent(m.id)) + '">' + esc(m.title) + '</a><span class="muted">' + esc(fmtLong(m.date)) + (m.start ? ', ' + esc(m.start) : '') + '</span></h3><ul>' +
        groups[m.id].map(function (p) { return '<li class="ibrow"><span class="ibdot"></span><span class="ibtx">' + esc(p.text) + '</span>' + (p.r.carried ? '<span class="tag">' + p.r.carried + '×</span>' : '') + ibChipSel(p, all.people) + '<span class="src">' + ibSrcLink(p) + '</span>' + (p.src.rem ? '<button type="button" class="link ibx" data-ibdel="' + esc(p.src.id) + '" title="Herinnering verwijderen" aria-label="Herinnering verwijderen">' + ic('close') + '</button>' : '') + '</li>'; }).join('') + '</ul></div>';
    }).join('') : '<p class="muted ibempty">Er ligt niets klaar.</p>') + '</div></section>';
    h += '<section class="card ibcard"><h2>Besproken <span class="muted">' + done.length + '</span></h2><div class="ibscroll">' + (done.length ? '<ul class="iblist">' +
      done.map(function (p) { return '<li class="ibrow"><s>' + esc(p.text) + '</s><span class="src">besproken in ' + esc(ibName(p.r.m)) + ' · ' + ibSrcLink(p) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted ibempty">Nog niets afgevinkt.</p>') + '</div></section>';
    h += ibWaitHtml(all).replace(/(<h2>[\s\S]*?<\/h2>)([\s\S]*)<\/section>$/, '$1<div class="ibscroll">$2</div></section>');
    h += ibIdeasHtml(all).replace(/(<h2>[\s\S]*?<\/h2>)([\s\S]*)<\/section>$/, '$1<div class="ibscroll">$2</div></section>');
    h += '</div>';
    setHTML(main, h);
    ibBindLists(main, all, renderReminders);
    var qa = $('#remIn'), box = $('#remPv');
    function lineOf(v) { return /^\s*[>?]/.test(v) ? v : '> ' + v; }
    function prev() {
      var v = qa.value.trim(); if (!v) { setHTML(box, ''); return; }
      var src = ibRemSrc({ id: 'tmp', created: new Date().toISOString(), line: lineOf(v) }), it = ibParse(lineOf(v), src);
      if (!it || it.k === '?') { setHTML(box, '<span class="to wait">Geen naam of overleg herkend: gaat naar de Ideeën-inbox.</span>'); return; }
      var r = ibResolve(it);
      setHTML(box, '<span class="chip">' + esc(ibRouteLabel(it, all.people)) + '</span> ' + (r.st === 'open' ? '<span class="to go">→ ' + esc(ibName(r.m)) + '</span>' : '<span class="to wait">⏳ wacht tot er een passend overleg in je agenda staat</span>'));
    }
    async function add() {
      var v = qa.value.trim(); if (!v) { qa.focus(); return; }
      var r = { id: 'R' + uid(), created: new Date().toISOString(), line: lineOf(v) }; ibRems().push(r); await persist();
      var it = ibItemsOf(ibRemSrc(r))[0], rr = it && it.k === '>' ? ibResolve(it) : null;
      renderReminders(); renderSide(); var n = $('#remIn'); if (n) n.focus();
      toast(!rr ? 'In de Ideeën-inbox gezet.' : rr.st === 'open' ? 'Komt op bij ' + ibName(rr.m) + '.' : 'Bewaard. Wacht tot er een passend overleg in je agenda staat.', 'ok');
    }
    qa.addEventListener('input', function () { prev(); ibAc(qa, $('#remAc'), true); });
    qa.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); add(); } });
    qa.addEventListener('blur', function () { setTimeout(function () { var b = $('#remAc'); if (b && D.activeElement !== qa) b.hidden = true; }, 150); });
    $('#remAdd').onclick = add;
  }
