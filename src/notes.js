  /* ================================================================== aantekeningen tijdens de vergadering + actielijst */
  var NOTES_DIR = 'Aantekeningen';
  var ACT_RE = /^(\s*)!\s*(.+?)\s*$/;
  function names(s) { return String(s || '').split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function hashStr(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function actId(m, text) { return m.id + ':' + hashStr(String(text).trim().toLowerCase()); }
  function chairOf(m) { return names(m.invitees)[0] || ''; }
  function membersOf(m) { return names(m.invitees).slice(1); }
  function addDays(iso, n) { var d = isoDate(iso) || new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nextMonday() { var d = new Date(), k = (8 - d.getDay()) % 7 || 7; return addDays(todayIso(), k); }
  function fmtDay(iso) { var d = isoDate(iso); return d ? d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }

  function meta(id) { A.data.act = A.data.act || {}; return A.data.act[id] || {}; }
  function setMeta(id, k, v) { A.data.act = A.data.act || {}; var o = A.data.act[id] || (A.data.act[id] = {}); if (v == null || v === '') delete o[k]; else o[k] = v; if (!Object.keys(o).length) delete A.data.act[id]; }
  function migrateActions() {
    if (A.data.done) { Object.keys(A.data.done).forEach(function (id) { setMeta(id, 'done', A.data.done[id]); }); delete A.data.done; }
    A.data.meetings.forEach(function (m) { if (m.chair) { var inv = names(m.invitees); if (!inv.some(function (n) { return n.toLowerCase() === m.chair.toLowerCase(); })) inv.unshift(m.chair); m.invitees = inv.join(', '); } delete m.chair; delete m.present; });
  }
  function actionsOf(m) {
    var out = [], seen = {};
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) { var c = ACT_RE.exec(l); if (!c) return; var id = actId(m, c[2]); if (seen[id]) return; seen[id] = 1; out.push({ id: id, text: c[2] }); });
    return out;
  }
  /* ---------- meeneempunten uit de aantekeningen: "> label: tekst". De regel blijft staan; het punt wordt er telkens uit afgeleid, zoals bij acties. */
  var PT_RE = /^\s*>\s*(.*?)\s*$/;
  function ptMeta(id) { return (A.data.pts || {})[id] || {}; }
  function setPtMeta(id, k, v) { A.data.pts = A.data.pts || {}; var o = A.data.pts[id] || (A.data.pts[id] = {}); if (v == null || v === '') delete o[k]; else o[k] = v; if (!Object.keys(o).length) delete A.data.pts[id]; }
  function pointsOf(m) {
    var out = [], seen = {};
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) {
      var c = PT_RE.exec(l); if (!c || !c[1]) return;
      var body = c[1], lb = /^([^:]{1,40}?)\s*:\s+(\S.*)$/.exec(body), label = '', text = body, key = '', wait = '', exact = false;
      if (lb) { label = lb[1].trim(); text = lb[2].trim(); }
      else if (/:$/.test(body)) return; /* "> Linda:" is nog niet af */
      if (label && /^volgende vergadering$/i.test(label)) { /* de titel van de vergadering waarin je typt, zonder getallen en datums */
        var pt = plainTitle(m.title); if (pt) { key = 'titel:' + pt; label = m.title; wait = m.title; exact = true; } else label = '';
      } else if (label) { var mw = matchWords(label).join(' '); key = 'label:' + (mw || label.toLowerCase()); wait = label; }
      var id = m.id + ':p' + hashStr(key + '|' + text.toLowerCase()); if (seen[id]) return; seen[id] = 1;
      out.push({ id: id, key: key, label: label, wait: wait, exact: exact, text: text, m: m });
    });
    return out;
  }
  function allPoints() {
    var out = [];
    A.data.meetings.slice().sort(function (x, y) { return ((x.date || '') + (x.start || '')).localeCompare((y.date || '') + (y.start || '')); })
      .forEach(function (m) { if (m.minutes && m.minutes.indexOf('>') >= 0) out = out.concat(pointsOf(m)); });
    return out;
  }
  /* ---------- besluiten: regels die met = beginnen ("= livegang schuift naar maart"); een regel van alleen =-tekens telt niet */
  var DEC_RE = /^\s*=(?!=)\s*(\S.*?)\s*$/;
  function isDone(id) { return !!meta(id).done; }
  function allActions() {
    var out = [], t = todayIso();
    A.data.meetings.forEach(function (m) {
      if (!m.minutes) return;
      actionsOf(m).forEach(function (a) {
        var mt = meta(a.id), start = mt.start || m.date || '';
        out.push({ id: a.id, text: a.text, m: m, hidden: !!mt.hidden, done: !!mt.done, start: start, snooze: mt.snooze || '', snoozed: !mt.done && !!mt.snooze && mt.snooze > t, back: !mt.done && !!mt.snooze && mt.snooze <= t });
      });
    });
    /* losse acties, zonder vergadering, zelf toegevoegd op de Actielijst */
    (A.data.todo || []).forEach(function (x) {
      var mt = meta(x.id), start = mt.start || String(x.created || '').slice(0, 10);
      out.push({ id: x.id, text: x.text, m: null, loose: x, hidden: false, done: !!mt.done, start: start, snooze: mt.snooze || '', snoozed: !mt.done && !!mt.snooze && mt.snooze > t, back: !mt.done && !!mt.snooze && mt.snooze <= t });
    });
    return out.sort(function (a, b) { return (b.start + (b.m ? b.m.start || '' : '')).localeCompare(a.start + (a.m ? a.m.start || '' : '')); });
  }
  function openCount() { return allActions().filter(function (a) { return !a.hidden && !a.done && !a.snoozed; }).length; }

  function minutesFileName(m) { return safe(((m.date || '').replace(/-/g, '') || 'zonder-datum') + ' ' + (m.title || 'Vergadering')) + '.txt'; }
  function minutesText(m) {
    var o = [], acts = actionsOf(m);
    o.push(m.title || 'Vergadering'); o.push('='.repeat(Math.min(70, (m.title || 'Vergadering').length)));
    o.push('Datum:      ' + (m.date ? fmtLong(m.date) : '—') + (m.start ? ', ' + m.start + (m.end ? ' – ' + m.end : '') : ''));
    if (m.location) o.push('Locatie:    ' + m.location);
    if (chairOf(m)) o.push('Voorzitter: ' + chairOf(m));
    if (membersOf(m).length) o.push('Leden:      ' + membersOf(m).join(', '));
    o.push('', 'AANTEKENINGEN', '-------------', String(m.minutes || '').replace(/\s+$/, ''), '');
    if (acts.length) { o.push('ACTIES', '------'); acts.forEach(function (a) { var mt = meta(a.id); o.push((mt.done ? '[x] ' : '[ ] ') + a.text + (mt.start ? '  (begin ' + fmtShort(mt.start) + ')' : '')); }); o.push(''); }
    o.push('(Bijgehouden in MeMeet, laatst opgeslagen ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) + ')');
    return o.join('\r\n');
  }
  function actionListText() {
    var all = allActions().filter(function (a) { return !a.hidden; }), o = ['ACTIELIJST', '==========', ''];
    function line(a) { return (a.done ? '[x] ' : '[ ] ') + fmtShort(a.start) + '  ' + a.text + '  —  ' + (a.m ? a.m.title + ' (' + fmtShort(a.m.date) + ')' : 'losse actie') + (a.snoozed ? '  [gesnoozed tot ' + fmtShort(a.snooze) + ']' : ''); }
    var open = all.filter(function (a) { return !a.done && !a.snoozed; }), sn = all.filter(function (a) { return a.snoozed; }), dn = all.filter(function (a) { return a.done; });
    o.push('Open (' + open.length + ')'); open.forEach(function (a) { o.push(line(a)); });
    o.push('', 'Gesnoozed (' + sn.length + ')'); sn.forEach(function (a) { o.push(line(a)); });
    o.push('', 'Afgerond (' + dn.length + ')'); dn.forEach(function (a) { o.push(line(a)); });
    o.push('', '(Bijgehouden in MeMeet, ' + new Date().toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' }) + ')');
    return o.join('\r\n');
  }
  async function writeNotesFiles(m) {
    if (!A.store || A.store.kind !== 'map') return;
    var dir = await A.store.root.getDirectoryHandle(NOTES_DIR, { create: true });
    async function put(name, text) { var h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(new Blob(['﻿' + text], { type: 'text/plain' })); await w.close(); }
    if (m) {
      var name = minutesFileName(m);
      if (m.minutesFile && m.minutesFile !== name) { try { await dir.removeEntry(m.minutesFile); } catch (e) {} }
      if (m.minutes) { await put(name, minutesText(m)); m.minutesFile = name; }
      else if (m.minutesFile) { try { await dir.removeEntry(m.minutesFile); } catch (e) {} m.minutesFile = null; }
    }
    var ad = await A.store.root.getDirectoryHandle(ACTS_DIR, { create: true }), ah = await ad.getFileHandle('Actielijst.txt', { create: true }), aw = await ah.createWritable(); await aw.write(new Blob(['\ufeff' + actionListText()], { type: 'text/plain' })); await aw.close();
  }
  async function saveMinutes(m) {
    m.minutesUpdated = new Date().toISOString();
    try { await writeNotesFiles(m); } catch (e) { console.error(e); toast('Aantekeningenbestand opslaan mislukt: ' + (e.message || e), 'err'); }
    try { await syncPointLists(); } catch (e) { console.error('Meeneempunten bijwerken mislukt', e); }
    await persist(); renderSide();
  }
  /* ---------- links in tekst */
  function urlRe() { return /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi; }
  function hrefOf(u) { return /^www\./i.test(u) ? 'https://' + u : u; }
  function linksIn(text) { var seen = {}, out = []; (String(text || '').match(urlRe()) || []).forEach(function (u) { if (!seen[u]) { seen[u] = 1; out.push(u); } }); return out; }
  function linkListHtml(text) { var l = linksIn(text); return l.length ? '<span class="lbl">Links</span>' + l.map(function (u) { return '<a href="' + esc(hrefOf(u)) + '" target="_blank" rel="noopener" title="Openen in een nieuw tabblad">' + esc(u) + '</a>'; }).join('') : ''; }

  /* ---------- kolom Aantekeningen in de vergadering */
  var NP_MIN = 260;
  function npWidth(set) {
    var ws = $('.ws'), w;
    if (set != null) { w = Math.round(Math.max(NP_MIN, Math.min(set, Math.max(NP_MIN, W.innerWidth * 0.6)))); try { localStorage.setItem('memeet-npw', String(w)); } catch (e) {} }
    else { try { w = +localStorage.getItem('memeet-npw') || 0; } catch (e) { w = 0; } }
    if (ws) { if (w) ws.style.setProperty('--npw', w + 'px'); else ws.style.removeProperty('--npw'); }
    if (PV.fit && $('#pvp') && PV.pages) { clearTimeout(npWidth.t); npWidth.t = setTimeout(function () { layoutPages(); }, 120); }
  }
  function npPopped(m) { return A.npWin && !A.npWin.closed && A.npWinMid === m.id; }
  function renderNotes(m) {
    var np = $('#np'); if (!np) return;
    npWidth();
    var h = '<div class="npgrip" id="npgrip" title="Sleep om de kolom breder of smaller te maken (dubbelklik: standaard)"></div><div class="nphead"><b>Aantekeningen</b><span class="npst" id="npst"></span>' + (m.isNew ? '' : '<button type="button" class="btn sm" id="npmail" title="Het verslag mailen; Outlook opent een nieuwe mail">✉ Mailen</button><button type="button" class="btn sm" id="nppop" title="In een apart venster openen, rechts op je scherm">⧉ Apart venster</button>') + '<button type="button" class="link" id="npclose" title="Kolom sluiten">✕</button></div>';
    if (m.isNew) { setHTML(np, h + '<div class="pvmsg">Sla de vergadering eerst op. Daarna kun je hier aantekeningen maken.</div>'); $('#npclose').onclick = toggleNotes; bindGrip(); return; }
    if (npPopped(m)) {
      setHTML(np, h + '<div class="pvmsg">De aantekeningen staan in een apart venster.<br><button type="button" class="btn sm" id="npfocus">Naar het venster</button> <button type="button" class="btn sm" id="npback">Terugzetten in MeMeet</button></div>');
      $('#npclose').onclick = toggleNotes; $('#npfocus').onclick = function () { A.npWin.focus(); }; $('#npback').onclick = function () { A.npWin.close(); };
      $('#nppop').disabled = true; $('#npmail').onclick = function () { mailMinutes(m); }; bindGrip(); return;
    }
    h += '<textarea id="npt" spellcheck="true" placeholder="Typ hier je aantekeningen…&#10;&#10;Begin een regel met:&#10;! voor een actie: ! Jan stuurt de notitie rond&#10;= voor een besluit: = livegang schuift naar maart&#10;&gt; voor een meeneempunt: &gt; Linda: praten over Jozef&#10;&#10;Acties komen in de Actielijst, meeneempunten bij Meeneempunten.">' + esc(m.minutes || '') + '</textarea>';
    setHTML(np, h);
    var ta = $('#npt'), t;
    function queue() { var st = $('#npst'); if (st) { st.textContent = 'opslaan…'; st.className = 'npst'; } clearTimeout(t); t = setTimeout(async function () { t = null; await saveMinutes(m); var s2 = $('#npst'); if (s2) { s2.textContent = 'opgeslagen ✓'; s2.className = 'npst ok'; } }, 800); }
    ta.addEventListener('input', function () { m.minutes = ta.value; delete m.minutesHtml; queue(); });
    ta.addEventListener('keydown', function (e) { e.stopPropagation(); });
    $('#npclose').onclick = toggleNotes;
    $('#npmail').onclick = async function () { if (t) { clearTimeout(t); t = null; await saveMinutes(m); } if (!(m.minutes || '').trim()) { toast('Er zijn nog geen aantekeningen om te mailen.', 'warn'); return; } mailMinutes(m); };
    $('#nppop').onclick = async function () { if (t) { clearTimeout(t); t = null; await saveMinutes(m); } popNotes(m); };
    var dlb = $('#npdl'); if (dlb) dlb.onclick = function () { dl(new Blob(['﻿' + minutesText(m)], { type: 'text/plain' }), minutesFileName(m)); };
    bindFolders(np); bindGrip();
    A.flushNotes = function () { if (t) { clearTimeout(t); t = null; return saveMinutes(m); } };
  }
  /* sleepbalk links van de kolom: breder of smaller */
  function bindGrip() {
    var g = $('#npgrip'); if (!g) return;
    g.onmousedown = function (e) {
      e.preventDefault(); var np = $('#np'), right = W.innerWidth - np.getBoundingClientRect().right;
      D.body.classList.add('npdrag');
      function mv(ev) { npWidth(W.innerWidth - right - ev.clientX); }
      function up() { D.removeEventListener('mousemove', mv); D.removeEventListener('mouseup', up); D.body.classList.remove('npdrag'); if (PV.fit && $('#pvp') && PV.pages) layoutPages(); }
      D.addEventListener('mousemove', mv); D.addEventListener('mouseup', up);
    };
    g.ondblclick = function () { try { localStorage.removeItem('memeet-npw'); } catch (e) {} npWidth(); };
  }
  /* aantekeningen in een apart browservenster, rechts op het scherm */
  var POP_CSS = ':root{--bg:#fff;--ink:#1b1f24;--mute:#5d6875;--line:#d8dfe7;--soft:#E5F2F9}@media (prefers-color-scheme:dark){:root{--bg:#16202b;--ink:#e7edf3;--mute:#9cadbf;--line:#283544;--soft:#1b2a39}}' +
    '*{box-sizing:border-box}html,body{margin:0;height:100%}body{display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:14px/1.5 "RO Sans","Segoe UI",system-ui,sans-serif}' +
    'header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(90deg,#123a66,#154273 60%,#1a5189);color:#fff;border-bottom:3px solid #007BC7}' +
    'header .t{flex:1;min-width:0}header b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}header small{color:#cfe5f4;font-size:12px}' +
    'header button{border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.12);color:#fff;border-radius:5px;padding:4px 9px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}header button:hover{background:rgba(255,255,255,.25)}' +
    '#st{font-size:11.5px;color:#cfe5f4;white-space:nowrap}' +
    'textarea{flex:1;border:0;resize:none;padding:14px;font:15px/1.6 "RO Sans","Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--ink);outline:none}' +
    '#links{border-top:1px solid var(--line);padding:6px 12px;max-height:30vh;overflow:auto}#links:empty{display:none}#links .lbl{display:block;font-size:12px;font-weight:600;color:var(--mute)}#links a{display:block;color:#01689B;word-break:break-all;font-size:13px;padding:2px 0}' +
    'footer{padding:6px 12px;font-size:12px;color:var(--mute);border-top:1px solid var(--line);background:var(--soft)}';
  function npPopWidth() { return Math.max(360, Math.min(560, Math.round(screen.availWidth * 0.3))); }
  function popNotes(m) {
    var w = npPopWidth(), hgt = screen.availHeight, left = (screen.availLeft || 0) + screen.availWidth - w, top = screen.availTop || 0;
    var win = W.open('', 'memeet-aantekeningen', 'popup=yes,width=' + w + ',height=' + hgt + ',left=' + left + ',top=' + top);
    if (!win) { toast('De browser blokkeerde het venster. Sta pop-ups toe voor MeMeet (het icoontje rechts in de adresbalk).', 'warn'); return; }
    if (A.npWin && A.npWin !== win) { try { A.npWin.close(); } catch (e) {} }
    A.npWin = win; A.npWinMid = m.id;
    var d = win.document;
    d.open(); d.write('<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Aantekeningen: ' + esc(m.title || 'Vergadering') + '</title><style>' + POP_CSS + '</style></head><body>' +
      '<header><div class="t"><b>' + esc(m.title || 'Vergadering') + '</b><small>' + esc(m.date ? fmtLong(m.date) : '') + (m.start ? ', ' + esc(m.start) : '') + '</small></div><span id="st"></span>' +
      '<button id="mail" title="Het verslag mailen">✉ Mailen</button><button id="back" title="Terugzetten in MeMeet">⇤ Terug</button></header>' +
      '<textarea id="t" spellcheck="true" placeholder="Typ hier je aantekeningen…"></textarea><div id="links"></div>' +
      '<footer>Begin een regel met ! voor een actie, = voor een besluit, &gt; voor een meeneempunt (&gt; MT: punt). Alles wordt vanzelf bewaard in MeMeet.</footer></body></html>');
    d.close();
    var ta = d.getElementById('t'), st = d.getElementById('st'), lk = d.getElementById('links'), t = null;
    ta.value = m.minutes || ''; lk.innerHTML = linkListHtml(m.minutes);
    function save() { t = null; return saveMinutes(m).then(function () { st.textContent = 'opgeslagen ✓'; }); }
    ta.addEventListener('input', function () { m.minutes = ta.value; delete m.minutesHtml; st.textContent = 'opslaan…'; clearTimeout(t); t = setTimeout(function () { save(); lk.innerHTML = linkListHtml(m.minutes); }, 800); });
    d.getElementById('mail').onclick = function () { (t ? (clearTimeout(t), save()) : Promise.resolve()).then(function () { mailMinutes(m); }); };
    d.getElementById('back').onclick = function () { win.close(); };
    var done = false;
    function gone() { if (done) return; done = true; if (t) { clearTimeout(t); save(); } if (A.npWin === win) { A.npWin = null; A.npWinMid = null; } var cur = currentMeeting(); if (cur && cur.id === m.id && A.notesOpen) renderNotes(cur); }
    win.addEventListener('pagehide', gone);
    var poll = setInterval(function () { if (win.closed) { clearInterval(poll); gone(); } }, 800);
    ta.focus();
    A.flushNotes = null;
    renderNotes(m);
  }
  /* iBabs in een eigen venster, zonder tabbladenbalk, links op het scherm. Door de vaste naam laadt een volgende klik
     (ook bij een andere vergadering) in hetzelfde venster. iBabs kan niet in MeMeet zelf: iBabs staat dat niet toe. */
  var IBABS_WIN = 'memeet-ibabs';
  function openIbabs(m, beside) {
    var url = String(m.ibabs || '').trim();
    if (!/^https?:\/\//i.test(url)) { toast('Er staat geen iBabs-link bij deze vergadering.', 'warn'); return null; }
    var left = screen.availLeft || 0, top = screen.availTop || 0, hgt = screen.availHeight;
    var w = beside ? Math.max(400, screen.availWidth - npPopWidth()) : Math.max(640, Math.round(screen.availWidth * 0.65));
    var feat = 'popup=yes,width=' + w + ',height=' + hgt + ',left=' + left + ',top=' + top;
    /* Naast elkaar: staat iBabs al open, dan kan MeMeet dat venster niet meer verplaatsen (het is van iBabs). Sluiten en op de goede plek opnieuw openen; je blijft ingelogd. */
    if (beside && A.ibWin && !A.ibWin.closed) { try { A.ibWin.close(); } catch (e) {} }
    /* Een venster met deze naam dat al open is, laadt de nieuwe link; anders opent een nieuw venster op de opgegeven plek.
       (MeMeet moet de 'opener' van het venster blijven: anders kan het venster niet worden hergebruikt.) */
    var win = W.open(url, IBABS_WIN, feat);
    if (!win) { toast('De browser blokkeerde het venster. Sta pop-ups toe voor MeMeet (het icoontje rechts in de adresbalk).', 'warn'); return null; }
    try { win.focus(); } catch (e) {}
    A.ibWin = win;
    return win;
  }
  /* iBabs links en de aantekeningen rechts, elk in een eigen venster. De browser kan het tweede venster als pop-up tegenhouden. */
  function sideBySide(m) {
    if (!openIbabs(m, true)) return;
    popNotes(m);
  }
  function toggleNotes() {
    A.notesOpen = !A.notesOpen; try { localStorage.setItem('memeet-notes', A.notesOpen ? '1' : '0'); } catch (e) {}
    var ws = $('.ws'); if (ws) ws.classList.toggle('n3', A.notesOpen);
    var b = $('#npToggle'); if (b) b.classList.toggle('on', A.notesOpen);
    if (A.notesOpen) { var m = currentMeeting(); if (m) renderNotes(m); var t = $('#npt'); if (t) t.focus(); }
    if (PV.fit && $('#pvp')) setTimeout(layoutPages, 50);
  }

  /* ---------- actielijst */
  function editActionLine(a, newText) {
    var m = a.m, out = [], hit = false;
    String(m.minutes || '').split(/\r?\n/).forEach(function (l) {
      var c = ACT_RE.exec(l);
      if (!hit && c && actId(m, c[2]) === a.id) { hit = true; if (newText) out.push(c[1] + '! ' + newText); return; }
      out.push(l);
    });
    m.minutes = out.join('\n'); delete m.minutesHtml;
    A.data.act = A.data.act || {};
    if (newText) { var nid = actId(m, newText); if (nid !== a.id && A.data.act[a.id]) { A.data.act[nid] = A.data.act[a.id]; delete A.data.act[a.id]; } }
    else delete A.data.act[a.id];
  }
  async function saveActions(m) { await persist(); try { await writeNotesFiles(m); } catch (e) {} renderSide(); }
  function renderActions() {
    var all = allActions(), f = A.af || (A.af = { show: 'open', q: '' }), q = f.q.toLowerCase(), t = todayIso();
    var cnt = { open: 0, snooze: 0, afgerond: 0, alle: 0, weg: 0 };
    all.forEach(function (a) { if (a.hidden) { cnt.weg++; return; } cnt.alle++; if (a.done) cnt.afgerond++; else if (a.snoozed) cnt.snooze++; else cnt.open++; });
    if (f.show === 'weg' && !cnt.weg) f.show = 'open';
    var list = all.filter(function (a) {
      if (f.show === 'weg') return a.hidden && (!q || (a.text + ' ' + (a.m ? a.m.title : '')).toLowerCase().indexOf(q) >= 0);
      if (a.hidden) return false;
      var ok = f.show === 'alle' || (f.show === 'open' && !a.done && !a.snoozed) || (f.show === 'snooze' && a.snoozed) || (f.show === 'afgerond' && a.done);
      return ok && (!q || (a.text + ' ' + (a.m ? a.m.title : 'losse actie')).toLowerCase().indexOf(q) >= 0);
    });
    if (f.show === 'snooze') list.sort(function (x, y) { return x.snooze.localeCompare(y.snooze); });
    var h = '<div class="head"><h1>Actielijst</h1><div class="acts"><button class="btn" id="adl">Download als tekstbestand</button></div></div>';
    h += '<section class="card"><form class="addact" id="addAct" autocomplete="off"><input id="newAct" placeholder="Nieuwe actie, bijvoorbeeld: Offerte opvragen bij de leverancier" aria-label="Nieuwe actie"><input type="date" id="newActD" title="Begindatum (mag leeg blijven)" aria-label="Begindatum"><button type="submit" class="btn pri">+ Toevoegen</button></form>' +
      '<div class="filters"><input id="aq" type="search" placeholder="Zoeken in acties of vergaderingen…" value="' + esc(f.q) + '">' +
      '<div class="seg">' + [['open', 'Open (' + cnt.open + ')'], ['snooze', '⏰ Gesnoozed (' + cnt.snooze + ')'], ['afgerond', 'Afgerond (' + cnt.afgerond + ')'], ['alle', 'Alle (' + cnt.alle + ')']].concat(cnt.weg ? [['weg', 'Verwijderd (' + cnt.weg + ')']] : []).map(function (s) { return '<button type="button" class="' + (f.show === s[0] ? 'on' : '') + '" data-show="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="tw"><table class="acttb"><thead><tr><th style="width:30px"></th><th>Actie</th><th>Begindatum</th><th>Vergadering</th><th style="width:150px"></th></tr></thead><tbody>';
    h += list.length ? list.map(function (a, k) {
      var tag = a.snoozed ? '<span class="bdg snz">⏰ tot ' + esc(fmtDay(a.snooze)) + '</span>' : a.back ? '<span class="bdg back">terug van snooze</span>' : '';
      return '<tr class="' + (a.done ? 'done' : '') + '" data-k="' + k + '"><td><input type="checkbox" class="adone"' + (a.done ? ' checked' : '') + ' title="Afgerond"></td>' +
        '<td><span class="atext" title="Klik om te bewerken">' + esc(a.text) + '</span> ' + tag + '</td>' +
        '<td><input type="date" class="astart" value="' + esc(a.start) + '"></td>' +
        '<td>' + (a.m ? '<a href="#/v/' + encodeURIComponent(a.m.id) + '" data-open-notes="1">' + esc(a.m.title) + '</a><br><small class="muted">' + esc(fmtShort(a.m.date)) + '</small>' : '<span class="muted">Losse actie</span>') + '</td>' +
        '<td class="aact">' + (a.loose ? '<button type="button" class="btn sm asnz"' + (a.done ? ' disabled' : '') + '>⏰ Snooze</button><button type="button" class="link red aldel" title="Deze losse actie verwijderen">✕</button>' : a.hidden ? '<button type="button" class="btn sm arest">↩ Terugzetten</button>' : '<button type="button" class="btn sm asnz"' + (a.done ? ' disabled' : '') + '>⏰ Snooze</button><button type="button" class="link red adel" title="Van de actielijst halen (blijft in de aantekeningen staan)">✕</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">' + (all.length ? (f.show === 'snooze' ? 'Geen gesnoozede acties.' : 'Geen acties met dit filter.') : 'Nog geen acties. Typ hierboven een actie en klik op Toevoegen, of begin in de aantekeningen van een vergadering een regel met !.') + '</td></tr>';
    h += '</tbody></table></div>' + (A.store.kind === 'map' ? '<p class="note">Wordt ook bijgehouden in Actielijst › Actielijst.txt</p>' : '') + '</section>';
    h += '<div class="snzmenu" id="snzmenu" hidden></div>';
    setHTML($('#main'), h);
    function rowA(el) { var tr = el.closest('tr[data-k]'); return tr ? list[+tr.dataset.k] : null; }
    $$('.adone').forEach(function (cb) { cb.onchange = async function () { var a = rowA(cb); setMeta(a.id, 'done', cb.checked ? new Date().toISOString() : null); if (cb.checked) setMeta(a.id, 'snooze', null); await saveActions(a.m); renderActions(); }; });
    $$('.astart').forEach(function (inp) { inp.onchange = async function () { var a = rowA(inp); setMeta(a.id, 'start', inp.value && inp.value !== (a.m ? a.m.date : String(a.loose.created || '').slice(0, 10)) ? inp.value : null); await saveActions(a.m); renderActions(); }; });
    $$('.atext').forEach(function (sp) {
      sp.onclick = function () {
        var a = rowA(sp), inp = el2('input', 'aedit'); inp.value = a.text; sp.replaceWith(inp); inp.focus(); inp.select();
        var fin = false;
        async function done(save) {
          if (fin) return; fin = true; var v = inp.value.trim();
          if (save && v !== a.text) {
            if (!v && !confirm('Lege tekst: actie verwijderen?')) { renderActions(); return; }
            if (a.loose) { if (v) a.loose.text = v; else { A.data.todo = A.data.todo.filter(function (x) { return x !== a.loose; }); delete (A.data.act || {})[a.id]; } }
            else editActionLine(a, v);
            await saveActions(a.m);
          }
          renderActions();
        }
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        inp.addEventListener('blur', function () { done(true); });
      };
    });
    $$('.adel').forEach(function (b) { b.onclick = async function () { var a = rowA(b); setMeta(a.id, 'hidden', new Date().toISOString()); await saveActions(a.m); toast('Van de actielijst gehaald. In de aantekeningen van "' + a.m.title + '" staat de regel nog met !', 'ok'); renderActions(); }; });
    $$('.aldel').forEach(function (b) { b.onclick = async function () { var a = rowA(b); if (!confirm('Losse actie "' + a.text + '" verwijderen?')) return; A.data.todo = (A.data.todo || []).filter(function (x) { return x !== a.loose; }); if (A.data.act) delete A.data.act[a.id]; await saveActions(null); toast('Actie verwijderd.', 'ok'); renderActions(); }; });
    $('#addAct').onsubmit = async function (e) {
      e.preventDefault(); var inp = $('#newAct'), v = inp.value.trim(), d = $('#newActD').value; if (!v) { inp.focus(); return; }
      var x = { id: 'L' + uid(), text: v, created: new Date().toISOString() }; (A.data.todo || (A.data.todo = [])).push(x);
      if (d) setMeta(x.id, 'start', d);
      if (f.show !== 'alle' && f.show !== 'open') f.show = 'open';
      await saveActions(null); toast('Actie toegevoegd.', 'ok'); renderActions(); var n = $('#newAct'); if (n) n.focus();
    };
    $('#newAct').addEventListener('keydown', function (e) { e.stopPropagation(); });
    $$('.arest').forEach(function (b) { b.onclick = async function () { var a = rowA(b); setMeta(a.id, 'hidden', null); await saveActions(a.m); toast('Actie staat weer op de actielijst.', 'ok'); renderActions(); }; });
    var menu = $('#snzmenu');
    $$('.asnz').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); var a = rowA(b), r = b.getBoundingClientRect();
        var opts = [['Morgen', addDays(t, 1)], ['Overmorgen', addDays(t, 2)], ['Volgende week', nextMonday()]];
        var mh = opts.map(function (o) { return '<button type="button" data-d="' + o[1] + '">' + o[0] + '<small>' + esc(fmtDay(o[1])) + '</small></button>'; }).join('') +
          '<label class="snzpick">Kies een datum<input type="date" id="snzd" min="' + addDays(t, 1) + '" value="' + esc(a.snooze > t ? a.snooze : '') + '"></label>' +
          (a.snooze ? '<button type="button" data-d="" class="snzoff">Snooze opheffen</button>' : '');
        setHTML(menu, mh); menu.hidden = false;
        menu.style.top = (r.bottom + W.scrollY + 4) + 'px'; menu.style.left = Math.max(8, r.right + W.scrollX - 230) + 'px';
        async function pick(d) { menu.hidden = true; setMeta(a.id, 'snooze', d || null); await saveActions(a.m); toast(d ? 'Gesnoozed tot ' + fmtLong(d) + '. Dan staat de actie weer bij Open.' : 'Snooze opgeheven.', 'ok'); renderActions(); }
        $$('[data-d]', menu).forEach(function (x) { x.onclick = function () { pick(x.dataset.d); }; });
        $('#snzd').onchange = function () { if (this.value) pick(this.value); };
      };
    });
    if (!A.snzBound) { A.snzBound = true; D.addEventListener('click', function (e) { var mn = $('#snzmenu'); if (mn && !mn.hidden && !e.target.closest('#snzmenu')) mn.hidden = true; }); }
    $$('[data-show]').forEach(function (b) { b.onclick = function () { f.show = b.dataset.show; renderActions(); }; });
    $$('[data-open-notes]').forEach(function (a) { a.onclick = function () { A.notesOpen = true; }; });
    var qi = $('#aq'); qi.oninput = function () { f.q = qi.value; var p = qi.selectionStart; renderActions(); var n = $('#aq'); n.focus(); n.setSelectionRange(p, p); };
    bindFolders($('#main'));
    $('#adl').onclick = function () { dl(new Blob(['﻿' + actionListText()], { type: 'text/plain' }), 'Actielijst.txt'); };
  }
