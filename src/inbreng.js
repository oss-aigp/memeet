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
  /* staat de woordreeks "part" achter elkaar in de titel? ("Balie" in "Projectoverleg Digitale Balie", "MT" in "MT-overleg", niet "mt" in "Commitment") */
  function ibInTitle(part, title) {
    var p = ibWords(part), t = ibWords(title); if (!p.length) return false;
    for (var i = 0; i + p.length <= t.length; i++) { var ok = true; for (var j = 0; j < p.length; j++) if (t[i + j] !== p[j]) { ok = false; break; } if (ok) return true; }
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
  function ibKnownTitle(part, people) {
    var k = ibNorm(part); if (!k) return false;
    if ((people || ibPeople())[k] || ibExtra()[k]) return true;
    return A.data.meetings.some(function (c) { return ibInTitle(part, c.title); });
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
    var an = src.annotation; if (an && an.items) an.items.forEach(function (x, ai) { String(x.fb || '').split(/\r?\n/).forEach(function (l, li) { var it = ibParse(l, src, ctx); if (it) { it.where = 'ann'; it.ai = ai; it.al = li; add(it); } }); });
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
      if (c.id === p.src.id || !c.date || ibKey(c) <= from) return false;
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
    return '<button type="button" class="link ibsrc" data-ibctx="' + esc(p.id) + '" title="Bekijk waar dit punt vandaan komt">uit ' + esc(ibName(p.src)) + (p.where === 'ann' ? ' (annotatie)' : '') + '</button>';
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
      acts = '<a class="btn" href="#/herinneringen">Naar Herinneringen</a>';
    } else if (p.where === 'ann' && s.annotation) {
      var x = s.annotation.items[p.ai] || { t: '', body: '', fb: '' };
      head = '<p class="muted ibsmall">Waar dit punt vandaan komt</p><h2 id="ibCtxT">' + esc(s.title) + '</h2><p class="muted">' + esc(fmtLong(s.date)) + (s.start ? ', ' + esc(s.start) : '') + ' · annotatie van ' + esc(s.annotation.from || '') + '</p>';
      body = '<div class="ait">' + esc(x.t) + '</div><div class="aib">' + esc(x.body) + '</div><p class="muted ibsmall">Jouw terugkoppeling</p><pre class="ibnotes">' + String(x.fb || '').split(/\r?\n/).map(function (l, i) { return i === p.al ? '<mark>' + esc(l) + '</mark>' : esc(l); }).join('\n') + '</pre>';
      acts = '<a class="btn" href="#/v/' + esc(encodeURIComponent(s.id)) + '" data-ibann="' + esc(s.id) + '">Open dat overleg</a>';
    } else {
      head = '<p class="muted ibsmall">Waar dit punt vandaan komt</p><h2 id="ibCtxT">' + esc(s.title) + '</h2><p class="muted">' + esc(fmtLong(s.date)) + (s.start ? ', ' + esc(s.start) : '') + (names(s.invitees).length ? ' · ' + esc(names(s.invitees).join(', ')) : '') + '</p>';
      body = '<pre class="ibnotes">' + String(s.minutes || '').split(/\r?\n/).map(function (l, i) { return i === p.line ? '<mark>' + esc(l) + '</mark>' : esc(l); }).join('\n') + '</pre>' +
        '<p class="muted ibsmall">Stukken van dat overleg: ' + (s.files && s.files.length ? s.files.map(function (f) { return esc(f.name); }).join(', ') : 'geen') + '</p>';
      acts = '<a class="btn" href="#/v/' + esc(encodeURIComponent(s.id)) + '">Open dat overleg</a>';
    }
    setHTML(bg, '<div class="dlg ibctx" role="dialog" aria-modal="true" aria-labelledby="ibCtxT"><div class="vvhead"><div>' + head + '</div><button type="button" class="vvx" id="ibCtxX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
      '<div class="ibctxb">' + body + '</div><div class="dlgacts">' + acts + '<span class="sp"></span><button type="button" class="btn pri" id="ibCtxOk">Terug naar waar ik was</button></div></div>');
    D.body.appendChild(bg);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeIbCtx(); });
    $('#ibCtxX', bg).onclick = closeIbCtx; $('#ibCtxOk', bg).onclick = closeIbCtx;
    $$('a.btn', bg).forEach(function (a) { a.addEventListener('click', function () { if (a.dataset.ibann) A.npTab = Object.assign(A.npTab || {}, (function () { var o = {}; o[a.dataset.ibann] = 'ann'; return o; })()); closeIbCtx(); }); });
    var mk = $('mark', bg); if (mk) mk.scrollIntoView({ block: 'center' });
    try { $('#ibCtxOk', bg).focus(); } catch (e) {}
  }
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#ibCtx')) { e.preventDefault(); e.stopPropagation(); closeIbCtx(); } }, true);
  W.addEventListener('hashchange', function () { closeIbCtx(); });
