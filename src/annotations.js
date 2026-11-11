  /* ================================================================== Meeneempunten (in de code: annos): lijstjes in verslagvorm, gekoppeld aan een vergadering,
     wachtend op een vergadering met een bepaalde titel, of los. Punten uit de aantekeningen (regels met >) komen er vanzelf in. */
  var ANNO_DIR = 'Meeneempunten', OLD_ANNO_DIRS = ['Bespreekpunten', 'Annotaties'], annoDir = ANNO_DIR;
  /* De map heette eerst Annotaties en daarna Bespreekpunten: zet de bestanden eenmalig over naar Meeneempunten.
     Lukt dat niet, dan blijft de oude map in gebruik. Bestaat Meeneempunten al, dan blijft een oude map onaangeroerd staan. */
  async function migrateAnnoDir(root) {
    async function dirOf(n) { try { return await root.getDirectoryHandle(n); } catch (e) { return null; } }
    annoDir = ANNO_DIR;
    var cur = await dirOf(ANNO_DIR);
    for (var i = 0; i < OLD_ANNO_DIRS.length; i++) {
      var name = OLD_ANNO_DIRS[i], old = await dirOf(name);
      if (!old || cur) continue;
      try {
        var nw = await root.getDirectoryHandle(ANNO_DIR, { create: true });
        for await (var e of old.values()) { if (e.kind !== 'file') continue; var f = await e.getFile(), h = await nw.getFileHandle(e.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
      } catch (er) {
        console.error('Map ' + name + ' omzetten naar ' + ANNO_DIR + ' mislukt', er);
        try { await root.removeEntry(ANNO_DIR, { recursive: true }); } catch (e2) {}
        annoDir = name; return;
      }
      try { await root.removeEntry(name, { recursive: true }); } catch (er) { console.warn(er); }
      cur = nw;
    }
  }
  function annos() { var l = A.data.annos || (A.data.annos = []); for (var i = 0; i < l.length; i++) if (!l[i].v2) annoMigrate(l[i]); return l; }
  function annoById(id) { return annos().filter(function (a) { return a.id === id; })[0]; }
  function annoFileName(a) { return safe(a.title || 'Meeneempunten').slice(0, 80) + ' [' + a.id.slice(-4) + '].txt'; }
  /* de titel is de eerste regel van de tekst */
  function annoTitleOf(text) { var l = String(text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || ''; return l.slice(0, 120) || 'Nieuw lijstje'; }
  /* oudere lijstjes (annotaties) hadden een los titelveld: zet die titel eenmalig als eerste regel in de tekst */
  function annoMigrate(a) {
    if (a.v2) return; a.v2 = true;
    var first = String(a.text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || '';
    /* een standaardtitel ("Nieuwe annotatie", "Annotatie bij …") was geen echte titel en gaat niet in de tekst */
    var real = a.title && a.title !== 'Nieuwe annotatie' && a.title !== 'Annotatie' && a.title !== 'Nieuw bespreekpunt' && a.title !== 'Nieuw lijstje' && !/^Annotatie bij /.test(a.title);
    if (real && first !== a.title.trim()) { a.html = '<p>' + esc(a.title) + '</p>' + (a.text || a.html ? annoHtmlOf(a) : ''); a.text = a.title + (a.text ? '\n' + a.text : ''); }
    /* de titel is altijd de eerste regel van de tekst */
    if (String(a.text || '').trim()) a.title = annoTitleOf(a.text);
  }
  function annoHtmlOf(a) { return a.html || String(a.text || '').split(/\r?\n/).map(function (l) { return '<p>' + (l ? esc(l) : '<br>') + '</p>'; }).join('') || '<p><br></p>'; }

  /* ---------- wachten op een vergadering met een bepaalde titel */
  /* woorden van een titel: kleine letters, zonder accenten, zonder vulwoorden */
  var MATCH_STOP = { bila: 1, po: 1, overleg: 1, bijpraten: 1, met: 1, de: 1, het: 1, een: 1 };
  function matchWords(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w && !MATCH_STOP[w]; }); }
  /* een titel zonder losse getallen en datums ("Teamoverleg 10-11" = "Teamoverleg 17 november") */
  function plainTitle(s) { return matchWords(String(s || '').replace(/\b\d{1,4}[-\/.]\d{1,2}(?:[-\/.]\d{2,4})?\b/g, ' ')).filter(function (w) { return !/^\d+$/.test(w) && !MON[w]; }).join(' '); }
  /* past de titel van vergadering m bij waar het lijstje op wacht? Per heel woord: "Linda" past bij "bila Linda", niet bij "Belinda". */
  function annoMatches(a, m) {
    if (!a.wait || !m || !m.title) return false;
    if (a.waitExact) { var pw = plainTitle(a.wait); return !!pw && plainTitle(m.title) === pw; }
    var w = matchWords(a.wait), t = matchWords(m.title);
    return !!w.length && w.every(function (x) { return t.indexOf(x) >= 0; });
  }
  function meetKey(m) { return (m.date || '') + ' ' + (m.start || ''); }
  function isWaiting(a) { return !a.mid && !!String(a.wait || '').trim(); }
  /* de vergadering waar een wachtend lijstje nu staat: de eerstvolgende passende vergadering van vandaag of later (niet afgehandeld schuift zo vanzelf door) */
  function annoTarget(a) {
    if (!isWaiting(a) || a.pin) return null;
    if (a.archived) return a.archMid ? byId(a.archMid) || null : null;
    var t = todayIso(), skip = (a.skip || []).slice();
    /* een punt dat je in een vergadering typt, is voor de volgende keer: de vergaderingen waar de punten vandaan komen, tellen niet mee */
    if (a.ptKey != null) annoPoints(a).forEach(function (p) { skip.push(p.m.id); });
    return A.data.meetings.filter(function (m) { return m.date && m.date >= t && skip.indexOf(m.id) < 0 && annoMatches(a, m); })
      .sort(function (x, y) { return meetKey(x).localeCompare(meetKey(y)); })[0] || null;
  }
  /* staat lijstje a bij vergadering m? Gekoppeld: alleen daar. Vastgepind: bij elke passende vergadering. Wachtend: bij de eerstvolgende. */
  function annoShowsAt(a, m) {
    if (a.mid) return a.mid === m.id;
    if (!isWaiting(a)) return false;
    if (a.pin) return a.archived ? a.archMid === m.id : (a.skip || []).indexOf(m.id) < 0 && annoMatches(a, m);
    var tg = annoTarget(a); return !!tg && tg.id === m.id;
  }
  function annoMeetLabel(a) { var m = a.mid ? byId(a.mid) : null; return m ? m.title + (m.date ? ' (' + fmtShort(m.date) + ')' : '') : ''; }
  function meetName(m) { return m ? m.title + (m.date ? ' (' + fmtShort(m.date) + ')' : '') : ''; }
  function waitLabel(a) { return a.waitExact ? 'dezelfde titel als "' + a.wait + '"' : '"' + a.wait + '"'; }
  function waitDays(a) { var d = Math.floor((Date.now() - new Date(a.waitSince || a.created || Date.now()).getTime()) / 864e5); return d < 1 ? 'sinds vandaag' : d === 1 ? '1 dag' : d + ' dagen'; }
  /* waar het lijstje staat, als tekst (voor de lijst, zoeken en sorteren) */
  function annoWhere(a) {
    if (a.mid) return annoMeetLabel(a);
    if (!isWaiting(a)) return '';
    if (a.archived) return a.archMid && byId(a.archMid) ? meetName(byId(a.archMid)) : 'wachtte op ' + waitLabel(a);
    if (a.pin) return 'vast bij ' + waitLabel(a);
    var tg = annoTarget(a);
    return 'wacht op ' + waitLabel(a) + ' · ' + (tg ? 'volgende: ' + meetName(tg) : 'nog geen vergadering, wacht ' + waitDays(a));
  }

  /* ---------- punten uit de aantekeningen (regels met >), gegroepeerd per label */
  /* elk punt hoort bij één lijstje (in het register: pts[id].a); punten zonder lijstje gaan naar het lijstje met hetzelfde label, dat zo nodig wordt aangemaakt */
  function ptListFor(key) { return annos().filter(function (a) { return a.ptKey === key && !a.archived; })[0]; }
  function annoPoints(a) { return allPoints().filter(function (p) { return ptMeta(p.id).a === a.id; }); }
  function ptSig(a) { return annoPoints(a).map(function (p) { var mt = ptMeta(p.id); return p.id + (mt.done ? 'x' : '') + (mt.hidden ? 'h' : ''); }).join(','); }
  /* Na het opslaan van aantekeningen: punten aan een lijstje toewijzen en lijstjes aanmaken. Een automatisch gemaakt lijstje dat leeg is geraakt
     (bijvoorbeeld door een half getypte regel) en waar je zelf niets aan hebt veranderd, verdwijnt weer. Bewaart zelf niet; de aanroeper doet persist(). */
  async function syncPointLists() {
    var pts = allPoints(), live = {}, list = annos(), touched = [];
    pts.forEach(function (p) {
      live[p.id] = 1;
      var mt = ptMeta(p.id), cur = mt.a ? annoById(mt.a) : null;
      if (cur) return;
      var a = ptListFor(p.key);
      if (!a) {
        var now = new Date().toISOString(), title = p.key ? p.label : 'Nog te plaatsen';
        a = { id: uid(), title: title, text: title, html: '<p>' + esc(title) + '</p>', mid: null, created: now, updated: now, v2: true, auto: true, ptKey: p.key };
        if (p.key) { a.wait = p.wait; a.waitSince = now; if (p.exact) a.waitExact = true; }
        list.push(a);
      }
      setPtMeta(p.id, 'a', a.id);
      if (touched.indexOf(a) < 0) touched.push(a);
    });
    /* registerregels zonder punt en zonder vinkje of verbergen: opruimen */
    var reg = A.data.pts || {};
    Object.keys(reg).forEach(function (id) { if (!live[id] && !reg[id].done && !reg[id].hidden) delete reg[id]; });
    var drop = list.filter(function (a) { return a.auto && !a.archived && !a.mid && !annoPoints(a).length && String(a.text || '').trim() === String(a.title || '').trim(); });
    for (var i = 0; i < drop.length; i++) { try { await writeAnnoFile(drop[i], true); } catch (e) {} }
    if (drop.length) A.data.annos = list.filter(function (a) { return drop.indexOf(a) < 0; });
    /* tekstbestanden bijwerken van lijstjes waarvan de punten veranderd zijn */
    var lists = annos().filter(function (a) { return a.ptKey != null || touched.indexOf(a) >= 0; });
    for (var j = 0; j < lists.length; j++) {
      var s = ptSig(lists[j]); if (s === (lists[j].ptSig || '')) continue;
      lists[j].ptSig = s; try { await writeAnnoFile(lists[j]); } catch (e) { console.warn(e); }
    }
  }
  /* de punten van een lijstje als afvinkbare regels, met herkomst */
  function pointsHtml(a, showHidden) {
    var ps = annoPoints(a), vis = ps.filter(function (p) { return !ptMeta(p.id).hidden; }), hid = ps.length - vis.length;
    if (!ps.length) return '';
    var rows = (showHidden ? ps : vis).slice().sort(function (x, y) { return (ptMeta(x.id).done ? 1 : 0) - (ptMeta(y.id).done ? 1 : 0); });
    var h = '<ul class="ptlist">' + rows.map(function (p) {
      var mt = ptMeta(p.id);
      return '<li class="pt' + (mt.done ? ' done' : '') + (mt.hidden ? ' hid' : '') + '" data-pt="' + esc(p.id) + '"><input type="checkbox" class="ptdone" title="Afgehandeld"' + (mt.done ? ' checked' : '') + '><span class="pttx">' + esc(p.text) + '</span>' +
        (mt.hidden ? '<button type="button" class="link ptrest" title="Weer tonen">↩</button>' : '<button type="button" class="link ptdel" title="Verbergen (de regel blijft in de aantekeningen staan)">✕</button>') +
        '<small class="ptsrc">uit <a href="#/v/' + encodeURIComponent(p.m.id) + '">' + esc(p.m.title + (p.m.date ? ' ' + fmtShort(p.m.date).slice(0, 5) : '')) + '</a></small></li>';
    }).join('') + '</ul>';
    if (hid) h += '<p class="pthid"><button type="button" class="link" data-pthid="1">' + (showHidden ? 'Verborgen punten niet tonen' : hid + ' verborgen punt' + (hid === 1 ? '' : 'en') + ' tonen') + '</button></p>';
    return h;
  }
  /* afvinken en verbergen werken als bij acties: de regel blijft in de aantekening staan, het vinkje staat apart in het register */
  function bindPoints(root, a, redraw) {
    async function done() { try { a.ptSig = ptSig(a); await writeAnnoFile(a); } catch (e) {} await persist(); redraw(); }
    $$('.ptdone', root).forEach(function (cb) { cb.onclick = function (e) { e.stopPropagation(); }; cb.onchange = function () { setPtMeta(cb.closest('[data-pt]').dataset.pt, 'done', cb.checked ? new Date().toISOString() : null); done(); }; });
    $$('.ptdel', root).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); setPtMeta(b.closest('[data-pt]').dataset.pt, 'hidden', new Date().toISOString()); done(); }; });
    $$('.ptrest', root).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); setPtMeta(b.closest('[data-pt]').dataset.pt, 'hidden', null); done(); }; });
    $$('[data-pthid]', root).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); A.ptShowHidden = !A.ptShowHidden; redraw(); }; });
  }
  /* de inhoud van een lijstje bij een vergadering: eerst de punten, dan de vrije tekst */
  function annoBodyHtml(a) { return pointsHtml(a, false) + '<div class="anntext">' + annoHtmlOf(a) + '</div>'; }
  function openPointCount(a) { return annoPoints(a).filter(function (p) { var mt = ptMeta(p.id); return !mt.done && !mt.hidden; }).length; }

  function annoText(a) {
    var m = a.mid ? byId(a.mid) : null, o = [String(a.text || '').replace(/\s+$/, '') || a.title || 'Meeneempunten'];
    var ps = annoPoints(a).filter(function (p) { return !ptMeta(p.id).hidden; });
    if (ps.length) { o.push('', 'PUNTEN UIT AANTEKENINGEN', '------------------------'); ps.forEach(function (p) { o.push((ptMeta(p.id).done ? '[x] ' : '[ ] ') + p.text + '  (uit ' + meetName(p.m) + ')'); }); }
    if (m) o.push('', 'Vergadering: ' + m.title + (m.date ? ' (' + fmtLong(m.date) + ')' : ''));
    else if (isWaiting(a)) o.push('', (a.pin ? 'Vast bij vergaderingen met ' : 'Wacht op een vergadering met ') + waitLabel(a));
    o.push('', '(Bijgehouden in MeMeet, laatst opgeslagen ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) + ')');
    return o.join('\r\n');
  }
  /* het tekstbestand in memeet-data\Meeneempunten bijwerken (of weghalen) */
  async function writeAnnoFile(a, remove) {
    if (!A.store || A.store.kind !== 'map') return;
    var dir = await A.store.root.getDirectoryHandle(annoDir, { create: true }), name = annoFileName(a);
    if (a.file && (remove || a.file !== name)) { try { await dir.removeEntry(a.file); } catch (e) {} a.file = null; }
    if (remove) return;
    var h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(new Blob(['﻿' + annoText(a)], { type: 'text/plain' })); await w.close(); a.file = name;
  }
  async function saveAnno(a) { if (a.dropped) return; a.updated = new Date().toISOString(); try { await writeAnnoFile(a); } catch (e) { console.error(e); toast('Lijstje als bestand opslaan mislukt: ' + (e.message || e), 'err'); } await persist(); }
  async function newAnno(mid) {
    var now = new Date().toISOString();
    var a = { id: uid(), title: 'Nieuw lijstje', html: '', text: '', mid: mid || null, created: now, updated: now, v2: true };
    annos().push(a); await saveAnno(a);
    A.annoNew = a.id; location.hash = '#/meeneempunt/' + encodeURIComponent(a.id);
  }
  async function deleteAnno(a) {
    var np = annoPoints(a).length;
    if (!confirm('Lijstje "' + (a.title || 'Meeneempunten') + '" verwijderen?\n\nDe tekst en het tekstbestand in de map ' + annoDir + ' worden gewist.' + (np ? '\nDe ' + np + ' punt(en) uit je aantekeningen blijven daar staan en komen bij het volgende opslaan weer in een lijstje.' : ''))) return false;
    try { await writeAnnoFile(a, true); } catch (e) {}
    A.data.annos = annos().filter(function (x) { return x !== a; });
    var reg = A.data.pts || {}; Object.keys(reg).forEach(function (id) { if (reg[id].a === a.id) delete reg[id].a; });
    await persist();
    toast('Lijstje verwijderd.', 'ok'); return true;
  }
  /* een nieuw lijstje dat leeg blijft, wordt bij het verlaten weer weggegooid */
  function dropEmptyAnno(a) {
    a.dropped = true; A.data.annos = annos().filter(function (x) { return x !== a; });
    (async function () { try { await writeAnnoFile(a, true); } catch (e) {} await persist(); })();
  }
  /* archiveren of terugzetten (de datum Gewijzigd blijft gelijk). Bij een wachtend lijstje wordt vastgelegd bij welke vergadering het op dat moment stond. */
  async function setAnnoArchived(a, on, at) {
    if (on) { if (isWaiting(a)) { var tg = at || annoTarget(a); if (tg) a.archMid = tg.id; else delete a.archMid; } a.archived = new Date().toISOString(); }
    else { delete a.archived; delete a.archMid; }
    await persist(); toast(on ? 'Naar het archief verplaatst.' : 'Teruggezet uit het archief.', 'ok');
  }
  /* "Niet hier": deze vergadering overslaan; het lijstje wacht op de volgende passende vergadering */
  async function skipAnnoAt(a, m) { a.skip = (a.skip || []).concat([m.id]); delete a.auto; await persist(); toast('Het lijstje wacht nu op de volgende vergadering met ' + waitLabel(a) + '.', 'ok'); }

  function renderAnnos() {
    var f = A.nf || (A.nf = { q: '', key: 'changed', dir: -1 }), q = f.q.toLowerCase();
    var all = annos().filter(function (a) { return !q || [a.title, a.text, annoWhere(a), annoPoints(a).map(function (p) { return p.text; }).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0; });
    all.sort(function (a, b) {
      var x, y; if (f.key === 'name') { x = (a.title || '').toLowerCase(); y = (b.title || '').toLowerCase(); } else if (f.key === 'meet') { x = annoWhere(a).toLowerCase(); y = annoWhere(b).toLowerCase(); } else { x = a.updated || ''; y = b.updated || ''; }
      var r = x < y ? -1 : x > y ? 1 : 0; return (r || (a.title || '').localeCompare(b.title || '', 'nl')) * (r ? f.dir : 1);
    });
    var list = all.filter(function (a) { return !a.archived && !isWaiting(a); }), wait = all.filter(function (a) { return !a.archived && isWaiting(a); }), arch = all.filter(function (a) { return a.archived; });
    var nArch = annos().filter(function (a) { return a.archived; }).length, nWait = annos().filter(function (a) { return !a.archived && isWaiting(a); }).length;
    var cols = [['name', 'Naam'], ['meet', 'Vergadering'], ['changed', 'Gewijzigd']];
    function table(rows, inArch, emptyTxt) {
      var t = '<div class="tw"><table><thead><tr>' + cols.map(function (c) { var on = f.key === c[0]; return '<th class="' + (on ? 'on' : '') + '" data-nsort="' + c[0] + '">' + c[1] + '<i>' + (on ? (f.dir < 0 ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '<th class="nosort"></th></tr></thead><tbody>';
      t += rows.length ? rows.map(function (a) {
        var d = a.updated ? new Date(a.updated) : null, np = openPointCount(a), where;
        if (a.mid && byId(a.mid)) where = '<a href="#/v/' + encodeURIComponent(a.mid) + '">' + esc(annoMeetLabel(a)) + '</a>';
        else if (isWaiting(a)) { var tg = a.archived ? (a.archMid && byId(a.archMid)) : (!a.pin && annoTarget(a)); where = tg ? (a.archived ? '' : '<span class="muted">wacht op ' + esc(waitLabel(a)) + ' · volgende:</span> ') + '<a href="#/v/' + encodeURIComponent(tg.id) + '">' + esc(meetName(tg)) + '</a>' : '<span class="muted">' + esc(annoWhere(a)) + '</span>'; }
        else where = '<span class="muted">—</span>';
        return '<tr class="rrow" data-aid="' + esc(a.id) + '"><td><b>' + esc(a.title || 'Meeneempunten') + '</b>' + (np ? ' <span class="pill">' + np + ' punt' + (np === 1 ? '' : 'en') + '</span>' : '') + (a.pin && !a.archived ? ' <span class="bdg">vast</span>' : '') + '</td><td>' + where + '</td>' +
          '<td>' + (d ? esc(pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())) : '—') + '</td><td class="aact">' +
          (inArch ? '<button type="button" class="link" data-aarch="0" data-id="' + esc(a.id) + '" title="Terug naar de meeneempunten">Terugzetten</button>' : '<button type="button" class="link" data-aarch="1" data-id="' + esc(a.id) + '" title="Naar het archief onderaan">Archiveren</button>') +
          '<button type="button" class="link red" data-adel="' + esc(a.id) + '" title="Verwijderen">✕</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="empty">' + emptyTxt + '</td></tr>';
      return t + '</tbody></table></div>';
    }
    var h = '<div class="head"><h1>Meeneempunten</h1><div class="acts"><button type="button" class="btn pri" id="annoNew">+ Meeneempuntenlijstje toevoegen</button></div></div>';
    h += '<section class="card"><div class="filters"><input id="nq" type="search" placeholder="Zoeken in meeneempunten…" value="' + esc(f.q) + '"></div>';
    h += '<h2 class="anngrp">Bij een vergadering of los</h2>';
    h += table(list, false, annos().length - nArch - nWait ? 'Geen lijstjes gevonden.' : 'Nog geen lijstjes. Klik op <b>+ Meeneempuntenlijstje toevoegen</b> om er een te maken, los of bij een vergadering, of begin in je aantekeningen een regel met <code>&gt;</code>.');
    h += '<h2 class="anngrp">Wachtend op een vergadering</h2>';
    h += table(wait, false, nWait ? 'Geen wachtende lijstjes met deze zoekterm.' : 'Geen lijstjes die wachten. Vul bij een lijstje <b>Wacht op titel</b> in, bijvoorbeeld <i>Linda</i> of <i>MT</i>, of typ in je aantekeningen <code>&gt; MT: punt</code>.');
    h += '<p class="note">' + (list.length + wait.length) + ' lijstje' + (list.length + wait.length === 1 ? '' : 's') + (A.store.kind === 'map' ? ' · Ook bewaard als tekstbestand in memeet-data\\' + esc(annoDir) : '') + '</p></section>';
    /* archief onderaan, standaard ingeklapt */
    h += '<section class="card arch annarch"><button type="button" class="archbtn" id="annArch" aria-expanded="' + (A.showAnnArch ? 'true' : 'false') + '"><span>' + (A.showAnnArch ? '▾' : '▸') + '</span> Archief <span class="muted">' + arch.length + ' lijstje' + (arch.length === 1 ? '' : 's') + (q && arch.length !== nArch ? ' met deze zoekterm' : '') + '</span><span class="sp"></span><span class="link">' + (A.showAnnArch ? 'verbergen' : 'weergeven') + '</span></button>';
    if (A.showAnnArch) h += table(arch, true, nArch ? 'Geen gearchiveerde lijstjes met deze zoekterm.' : 'Het archief is leeg. Met <b>Archiveren</b> zet je een lijstje hier neer.');
    h += '</section>';
    setHTML($('#main'), h);
    $('#annoNew').onclick = function () { newAnno(null); };
    $('#annArch').onclick = function () { A.showAnnArch = !A.showAnnArch; var y = W.scrollY; renderAnnos(); W.scrollTo(0, y); };
    $$('[data-nsort]').forEach(function (th) { th.onclick = function () { var k = th.dataset.nsort; f.dir = f.key === k ? -f.dir : (k === 'changed' ? -1 : 1); f.key = k; renderAnnos(); }; });
    $$('tr[data-aid]').forEach(function (r) { r.onclick = function (e) { if (e.target.closest('a,button')) return; location.hash = '#/meeneempunt/' + encodeURIComponent(r.dataset.aid); }; });
    $$('[data-aarch]').forEach(function (b) { b.onclick = async function (e) { e.stopPropagation(); var a = annoById(b.dataset.id); if (!a) return; var y = W.scrollY; await setAnnoArchived(a, b.dataset.aarch === '1'); renderAnnos(); W.scrollTo(0, y); }; });
    $$('[data-adel]').forEach(function (b) { b.onclick = async function (e) { e.stopPropagation(); var a = annoById(b.dataset.adel); if (a && await deleteAnno(a)) renderAnnos(); }; });
    var qi = $('#nq'); qi.oninput = function () { f.q = qi.value; var p = qi.selectionStart; renderAnnos(); var n = $('#nq'); n.focus(); n.setSelectionRange(p, p); };
  }
  function renderAnno(a) {
    var ms = A.data.meetings.slice().sort(function (x, y) { return ((y.date || '') + (y.start || '')).localeCompare((x.date || '') + (x.start || '')); });
    annoMigrate(a);
    var back = a.mid && byId(a.mid) ? byId(a.mid) : annoTarget(a);
    var tg = isWaiting(a) && !a.pin ? annoTarget(a) : null;
    var waitInfo = !isWaiting(a) ? '' : a.pin ? 'Vastgepind: staat bij elke vergadering met ' + esc(waitLabel(a)) + '.' : a.archived ? (a.archMid && byId(a.archMid) ? 'Gearchiveerd bij <a href="#/v/' + encodeURIComponent(a.archMid) + '">' + esc(meetName(byId(a.archMid))) + '</a>.' : 'Gearchiveerd.') :
      tg ? 'Staat nu bij <a href="#/v/' + encodeURIComponent(tg.id) + '">' + esc(meetName(tg)) + '</a>.' : 'Nog geen vergadering met deze titel; wacht ' + esc(waitDays(a)) + '.';
    var h = '<section class="card meta annohead"><div class="mtop">' +
      '<label class="annomeet">Vergadering <select id="annoM"><option value="">— geen vergadering —</option>' + ms.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === a.mid ? ' selected' : '') + '>' + esc((m.date ? fmtShort(m.date) + ' ' : '') + m.title) + '</option>'; }).join('') + '</select>' +
      (a.mid && byId(a.mid) ? ' <a href="#/v/' + encodeURIComponent(a.mid) + '">Naar vergadering ›</a>' : '') + '</label><div class="acts">' +
      '<button type="button" class="btn" id="annoMail" title="Het lijstje mailen; Outlook opent een nieuwe mail">✉ Mailen</button><button type="button" class="btn" id="annoArch" title="' + (a.archived ? 'Terug naar de meeneempunten' : 'Naar het archief op het tabblad Meeneempunten') + '">' + (a.archived ? 'Terugzetten' : 'Archiveren') + '</button><button type="button" class="btn red" id="annoDel">Verwijder</button><a class="btn" href="' + (back ? '#/v/' + encodeURIComponent(back.id) : '#/meeneempunten') + '" title="' + (back ? 'Naar de vergadering' : 'Terug naar de lijst') + '">Terug</a></div></div>' +
      '<div class="annowait"><label>of wacht op titel <input id="annoW" placeholder="bijvoorbeeld Linda of MT" value="' + esc(a.wait || '') + '"' + (a.mid ? ' disabled title="Het lijstje is gekoppeld aan een vergadering. Kies — geen vergadering — om te wachten op een titel."' : '') + '></label>' +
      '<label class="chk" title="Vastgepind staat het lijstje bij elke vergadering met deze titel en schuift het niet door"><input type="checkbox" id="annoPin"' + (a.pin ? ' checked' : '') + (a.mid ? ' disabled' : '') + '> Vastpinnen</label>' +
      '<span class="muted" id="annoWI">' + waitInfo + '</span></div></section>';
    var ph = pointsHtml(a, !!A.ptShowHidden);
    if (ph) h += '<section class="card ptcard"><h2>Punten uit aantekeningen</h2><div id="annopts">' + ph + '</div></section>';
    h += '<section class="card repcard"><div class="edwrap anno-ed" id="annobox"></div></section>';
    setHTML($('#main'), h);
    var pc = $('#annopts');
    function redrawPts() { setHTML(pc, pointsHtml(a, !!A.ptShowHidden)); bindPoints(pc, a, redrawPts); }
    if (pc) bindPoints(pc, a, redrawPts);
    var E = repEditor($('#annobox'), {
      html: annoHtmlOf(a), foot: 'De eerste regel is de titel van het lijstje.',
      status: a.updated ? 'Laatst gewijzigd ' + new Date(a.updated).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      onSave: async function (r) { if (a.dropped) return; a.html = r.html; a.text = r.text; a.title = annoTitleOf(r.text); delete a.auto; await saveAnno(a); },
      download: function (r) { a.text = r.text; dl(new Blob(['﻿' + annoText(a)], { type: 'text/plain' }), annoFileName(a)); }
    });
    var fresh = A.annoNew === a.id; A.annoNew = null;
    A.flushNotes = function () { if (fresh && !E.text().trim() && !String(a.wait || '').trim()) { dropEmptyAnno(a); return Promise.resolve(); } return E.flush(); };
    var sug = a.mid && byId(a.mid) ? 'Meeneempunten bij ' + annoMeetLabel(a) : 'Meeneempunten';
    E.ed.style.setProperty('--ph', JSON.stringify(sug));
    function empt() { E.ed.classList.toggle('empty', !E.ed.textContent.trim() && E.ed.children.length <= 1); }
    E.ed.addEventListener('input', empt); empt();
    /* Shift+Enter in de titelregel: gewoon een nieuwe alinea, zodat alleen de titel vet is */
    E.ed.addEventListener('keydown', function (e) {
      /* Enter in een leeg lijstje: de grijze suggestie wordt de (vette) titel en je gaat door op de volgende regel */
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && E.ed.classList.contains('empty')) {
        e.preventDefault(); var f = E.ed.firstChild, r = D.createRange(), sl = W.getSelection();
        if (f) { r.setStart(f, 0); r.collapse(true); sl.removeAllRanges(); sl.addRange(r); }
        D.execCommand('insertText', false, sug); D.execCommand('insertParagraph'); return;
      }
      if (e.key !== 'Enter' || !e.shiftKey) return; var s = W.getSelection(), n = s.rangeCount && s.anchorNode;
      while (n && n.parentNode !== E.ed) n = n.parentNode;
      if (n && n === E.ed.firstChild) { e.preventDefault(); D.execCommand('insertParagraph'); }
    }, true);
    $('#annoM').onchange = async function () { a.mid = this.value || null; delete a.auto; await saveAnno(a); await E.flush(); renderAnno(a); toast(a.mid ? 'Gekoppeld aan ' + annoMeetLabel(a) + '.' : 'Het lijstje staat nu niet meer bij een vergadering.', 'ok'); };
    var wi = $('#annoW');
    wi.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); wi.blur(); } });
    wi.onchange = async function () {
      var v = wi.value.trim(); if (v === String(a.wait || '')) return;
      if (v && !a.wait) a.waitSince = new Date().toISOString();
      if (v) a.wait = v; else { delete a.wait; delete a.waitSince; }
      delete a.waitExact; delete a.skip; delete a.auto;
      await saveAnno(a); await E.flush(); renderAnno(a);
      var t2 = annoTarget(a); toast(!v ? 'Het lijstje wacht niet meer op een titel.' : a.pin ? 'Vastgepind bij vergaderingen met "' + v + '".' : t2 ? 'Staat nu bij ' + meetName(t2) + '.' : 'Wacht op een vergadering met "' + v + '".', 'ok');
    };
    $('#annoPin').onchange = async function () { if (this.checked) a.pin = true; else delete a.pin; delete a.auto; await saveAnno(a); await E.flush(); renderAnno(a); };
    $('#annoMail').onclick = async function () {
      await E.flush();
      var ps = annoPoints(a).filter(function (p) { var mt = ptMeta(p.id); return !mt.done && !mt.hidden; });
      var where = a.mid && byId(a.mid) ? annoMeetLabel(a) : '';
      mailText((a.title || 'Meeneempunten') + (where ? ' – ' + where : ''), (ps.length ? ps.map(function (p) { return '- ' + p.text; }).join('\n') + '\n\n' : '') + String(a.text || '').replace(/\s+$/, '') + (where ? '\n\n(Bij de vergadering ' + where + ')' : ''));
    };
    $('#annoArch').onclick = async function () { await E.flush(); var on = !a.archived; var at = back; await setAnnoArchived(a, on); if (on) { A.flushNotes = null; location.hash = at ? '#/v/' + encodeURIComponent(at.id) : '#/meeneempunten'; } else renderAnno(a); };
    $('#annoDel').onclick = async function () { if (await deleteAnno(a)) { A.flushNotes = null; location.hash = '#/meeneempunten'; } };
    E.ed.focus();
  }
