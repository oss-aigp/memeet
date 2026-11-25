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
