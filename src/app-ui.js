  /* ================================================================== Vergaderapp */
  var DEFAULT_TYPES = ['Overleg', 'MT DGSenB', 'PMT DGSenB', 'Stafoverleg DGSenB/MRB', 'Stafoverleg DGSenB/SJenV', 'Stafoverleg DGSenB/SRb'];
  var A = { store: null, data: { version: 1, types: DEFAULT_TYPES.slice(), meetings: [] }, sort: { key: 'date', dir: 1 }, f: { q: '', type: '', year: '' }, draft: null };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nl2iso(s) { var m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s || ''); return m ? m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]) : ''; }
  function isoDate(iso) { var p = (iso || '').split('-'); return p.length === 3 ? new Date(+p[0], p[1] - 1, +p[2]) : null; }
  function fmtLong(iso) { var d = isoDate(iso); return d ? d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Geen datum'; }
  function fmtShort(iso) { var d = isoDate(iso); return d ? pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() : '—'; }
  function safe(n) { return String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90) || 'bestand'; }
  function isCal(f) { return /\.ics$/i.test(f.name) || f.type === 'text/calendar'; }
  function isMail(f) { return /\.(msg|eml)$/i.test(f.name) || f.type === 'message/rfc822' || f.type === 'application/vnd.ms-outlook'; }
  function toast(t, kind) { var e = $('#toast'); e.textContent = t; e.className = 'show ' + (kind || ''); clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ''; }, 4200); }

  /* ------------------------------------------------------------- opslag: map (File System Access) of browser (IndexedDB) */
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open('vergaderapp', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); r.result.createObjectStore('files'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function tx(store, mode, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = function () { res(q && q.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  var kvGet = function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); };
  var kvSet = function (k, v) { return tx('kv', 'readwrite', function (s) { return s.put(v, k); }); };

  /* Gegevens van vóór MeMeet herkennen. Alleen hier staan de oude namen van de datamap, het register en twee browserinstellingen.
     Het oude register wordt gelezen als er nog geen memeet.json is; MeMeet bewaart daarna in memeet.json en laat het oude bestand staan. */
  var DATA_DIR = 'memeet-data', INDEX = 'memeet.json', OLD_DATA_DIR = 'mebabs-data', OLD_INDEX = 'mebabs.json';
  var INDEX_NAMES = [INDEX, OLD_INDEX, 'vergaderingen.json'];
  function migrateLocalPrefs() {
    var old = { 'memeet-npw': 'mebabs-npw', 'memeet-notes': 'mebabs-notes' };
    try { Object.keys(old).forEach(function (k) { var v = localStorage.getItem(old[k]); if (v != null && localStorage.getItem(k) == null) localStorage.setItem(k, v); }); } catch (e) {}
  }

  function FolderStore(root) {
    this.kind = 'map'; this.root = root; this.name = root.name;
    async function writeFile(dir, name, blob) { var h = await dir.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(blob); await w.close(); }
    this.load = async function () {
      for (var nm of INDEX_NAMES) {
        try { var h = await root.getFileHandle(nm); var d = JSON.parse(await (await h.getFile()).text()); this.fromOld = nm !== INDEX; return d; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      }
      return null;
    };
    this.save = async function (data) {
      await writeFile(root, 'memeet.json.tmp', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      await writeFile(root, 'memeet.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      try { await root.removeEntry('memeet.json.tmp'); } catch (e) {}
    };
    this.meetingsDir = function () { return root.getDirectoryHandle(MEET_DIR, { create: true }); };
    this.dir = async function (m) { return (await this.meetingsDir()).getDirectoryHandle(m.folder, { create: true }); };
    this.put = async function (m, name, blob) { await writeFile(await this.dir(m), name, blob); };
    this.get = async function (m, name) { return (await (await this.dir(m)).getFileHandle(name)).getFile(); };
    this.del = async function (m, name) { try { await (await this.dir(m)).removeEntry(name); } catch (e) {} };
    this.delMeeting = async function (m) { if (!m.folder) return; try { await (await this.meetingsDir()).removeEntry(m.folder, { recursive: true }); } catch (e) { if (e.name !== 'NotFoundError') throw e; } };
  }
  function BrowserStore() {
    this.kind = 'browser'; this.name = 'deze browser';
    this.load = function () { return kvGet('data'); };
    this.save = function (data) { return kvSet('data', data); };
    this.put = function (m, name, blob) { return tx('files', 'readwrite', function (s) { return s.put(blob, m.id + '/' + name); }); };
    this.get = function (m, name) { return tx('files', 'readonly', function (s) { return s.get(m.id + '/' + name); }).then(function (b) { if (!b) throw new Error('Bestand niet gevonden'); return b; }); };
    this.del = function (m, name) { return tx('files', 'readwrite', function (s) { return s.delete(m.id + '/' + name); }); };
    this.delMeeting = function (m) { var self = this; return Promise.all(m.files.reduce(function (a, f) { a.push(self.del(m, f.name)); if (f.pdf && f.pdf !== f.name) a.push(self.del(m, f.pdf)); if (f.backup) a.push(self.del(m, f.backup)); return a; }, []).concat(m.source && m.source.file ? [self.del(m, m.source.file)] : [])); };
  }
  /* oude indeling (alles los in de hoofdmap) omzetten naar Vergaderingen / Aantekeningen / Actielijst */
  async function copyDir(src, dst) {
    for await (var e of src.values()) {
      if (e.kind === 'directory') await copyDir(e, await dst.getDirectoryHandle(e.name, { create: true }));
      else { var f = await e.getFile(), h = await dst.getFileHandle(e.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
    }
  }
  async function migrateLayout(st) {
    var root = st.root, moved = 0;
    async function has(name, kind) { try { return kind === 'dir' ? await root.getDirectoryHandle(name) : await root.getFileHandle(name); } catch (e) { return null; } }
    if (A.data.layout !== 2) {
      var md = await st.meetingsDir();
      for (var i = 0; i < A.data.meetings.length; i++) {
        var m = A.data.meetings[i], old = m.folder && await has(m.folder, 'dir');
        if (!old) continue;
        await copyDir(old, await md.getDirectoryHandle(m.folder, { create: true }));
        await root.removeEntry(m.folder, { recursive: true }); moved++;
      }
      var nd = await has(NOTES_DIR, 'dir'); if (nd) { try { await nd.removeEntry('Actielijst.txt'); } catch (e) {} }
      A.data.layout = 2; await st.save(A.data);
      if (await has('vergaderingen.json')) { try { await root.removeEntry('vergaderingen.json'); } catch (e) {} }
      if (moved) setTimeout(function () { toast('De map "' + st.name + '" is opnieuw ingedeeld: Vergaderingen, Aantekeningen en Actielijst.', 'ok'); }, 600);
    }
    for (var d of [MEET_DIR, NOTES_DIR, ACTS_DIR]) { try { await root.getDirectoryHandle(d, { create: true }); } catch (e) {} }
    /* elke vergadering heeft een eigen map, ook zonder stukken (bijvoorbeeld geïmporteerd uit de agenda) */
    try { var mdir = await root.getDirectoryHandle(MEET_DIR, { create: true }); for (var mi = 0; mi < A.data.meetings.length; mi++) { if (A.data.meetings[mi].folder) try { await mdir.getDirectoryHandle(A.data.meetings[mi].folder, { create: true }); } catch (e) {} } } catch (e) {}
    try { await writeNotesFiles(null); } catch (e) {}
  }
  async function useStore(st) {
    var d = await st.load();
    A.store = st;
    if (d && d.meetings) { A.data = d; if (!A.data.types || !A.data.types.length) A.data.types = DEFAULT_TYPES.slice(); if (st.fromOld) await st.save(A.data); /* ingelezen uit een oud register: meteen als memeet.json bewaren */ }
    else { A.data = { version: 1, types: DEFAULT_TYPES.slice(), meetings: [] }; await st.save(A.data); }
    migrateActions();
    if (st.kind === 'map') await migrateLayout(st);
    if (st.kind === 'map') try { await migrateAnnoDir(st.root); } catch (e) { console.error(e); }
    /* meeneempunten (regels met >) die al in aantekeningen staan, in een lijstje zetten */
    try { var sig = JSON.stringify([A.data.pts || null, (A.data.annos || []).length]); await syncPointLists(); if (JSON.stringify([A.data.pts || null, (A.data.annos || []).length]) !== sig) await st.save(A.data); } catch (e) { console.error(e); }
    await kvSet('mode', st.kind);
    route();
  }
  async function chooseFolder() {
    if (!W.showDirectoryPicker) { toast('Deze browser kan geen map kiezen. De gegevens worden in de browser bewaard.', 'warn'); return useStore(new BrowserStore()); }
    try {
      var h = await W.showDirectoryPicker({ id: 'vergaderapp', mode: 'readwrite', startIn: 'documents' });
      var hasIndex = false, n = 0;
      var subs = {};
      for await (var e of h.values()) { n++; if (INDEX_NAMES.indexOf(e.name) >= 0) hasIndex = true; if (e.kind === 'directory') subs[e.name.toLowerCase()] = e; }
      /* Bevat de gekozen map al gegevens, dan gebruiken we die. Staat er een datamap in, dan die; anders maakt MeMeet er de map memeet-data in. */
      var appDir = null, low = h.name.toLowerCase();
      if (!hasIndex && low !== DATA_DIR && low !== OLD_DATA_DIR) { appDir = h; h = subs[DATA_DIR] || subs[OLD_DATA_DIR] || await h.getDirectoryHandle(DATA_DIR, { create: true }); }
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Geen schrijfrechten op de map');
      var first = true;
      for (var ix of [INDEX, OLD_INDEX]) if (await h.getFileHandle(ix).then(function () { return true; }, function () { return false; })) first = false;
      await kvSet('dir', h);
      if (appDir) { try { await putIconNextToApp(appDir); } catch (e2) { console.warn(e2); } }
      await useStore(new FolderStore(h));
      toast('Gegevens worden bewaard in de map "' + h.name + '".', 'ok');
      if (first) location.hash = '#/installatie';
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      toast('Map kiezen lukt niet (' + (e.message || e.name) + '). Kies "In de browser bewaren".', 'err');
    }
  }
  async function reconnect() {
    var h = await kvGet('dir').catch(function () { return null; });
    try { if (h && (await h.requestPermission({ mode: 'readwrite' })) === 'granted') return useStore(new FolderStore(h)); } catch (e) {}
    return chooseFolder();
  }
  async function persist() { A.data.updated = new Date().toISOString(); await A.store.save(A.data); }

  /* ------------------------------------------------------------- mail -> vergadering */
  async function parseMailFile(file) {
    var buf = await file.arrayBuffer(), u = new Uint8Array(buf), m;
    if (rd(u, 0) === 0xE011CFD0) m = parseMsg(buf);
    else if (/\.msg$/i.test(file.name)) throw new Error('"' + file.name + '" is geen geldig Outlook-bestand');
    else m = parseEml(buf);
    if (!m.subject && !m.from && !m.start && !m.attachments.length) throw new Error('In "' + file.name + '" is geen mail herkend');
    var r = analyse(m);
    return { r: r, m: m };
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
    return {
      id: uid(), isNew: true, type: guessType(r.title), title: r.title || '(zonder titel)', location: r.location, link: r.link || '', ibabs: r.ibabs || '', date: nl2iso(r.date), start: r.start, end: r.end,
      chair: '', invitees: '', notes: r.notes,
      source: { from: m.from || '', sent: m.sent && !isNaN(m.sent) ? m.sent.toISOString() : '', mail: file.name, skipped: m.skipped || [], how: r.src, recurring: !!r.recurring },
      files: [], pending: m.attachments.map(function (a) { return { name: a.name, type: a.type || guessMime(a.name), blob: new Blob([a.data], { type: a.type }), on: !a.inline, inline: a.inline }; }),
      mailBlob: file
    };
  }
  function uniqueName(m, name) {
    name = safe(name); var base = name.replace(/(\.[^.]*)?$/, ''), ext = (/\.[^.]*$/.exec(name) || [''])[0], n = 1;
    var taken = m.files.reduce(function (a, f) { a.push(f.name.toLowerCase()); if (f.pdf) a.push(f.pdf.toLowerCase()); if (f.backup) a.push(f.backup.toLowerCase()); return a; }, []).concat(m.source && m.source.file ? [m.source.file.toLowerCase()] : []);
    while (taken.indexOf(name.toLowerCase()) >= 0) name = base + ' (' + (++n) + ')' + ext;
    return name;
  }
  async function addFileTo(m, name, type, blob) {
    var n = uniqueName(m, name);
    try { await A.store.put(m, n, blob); }
    catch (e) { n = uniqueName(m, n.normalize('NFKD').replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7e]/g, '')); await A.store.put(m, n, blob); }
    var rec = { name: n, type: type || guessMime(n), size: blob.size, added: new Date().toISOString() };
    m.files.push(rec);
    await makePdf(m, rec, blob);
    return n;
  }
  async function makePdf(m, f, blob) {
    try {
      var r = await convertToPdf(f.name, f.type, blob);
      if (!r) { f.conv = 'niet'; f.convV = CONV_VERSION; return null; }
      if (r.how === 'origineel') { f.pdf = f.name; f.conv = 'origineel'; return blob; }
      var pb = new Blob([r.bytes], { type: 'application/pdf' }), pn = f.pdf && f.pdf !== f.name ? f.pdf : uniqueName(m, f.name.replace(/\.[^.]*$/, '') + '.pdf');
      try { await A.store.put(m, pn, pb); } catch (e) { pn = uniqueName(m, pn.normalize('NFKD').replace(/[^\x20-\x7e]/g, '')); await A.store.put(m, pn, pb); }
      f.pdf = pn; f.conv = 'omgezet'; f.convV = CONV_VERSION; return pb;
    } catch (e) { console.error(e); f.conv = 'niet'; f.convErr = String(e.message || e); f.convV = CONV_VERSION; return null; }
  }
  async function getPdf(m, f) {
    /* PowerPoint-stukken van vóór de nieuwe dia-weergave opnieuw omzetten (niet als er al aantekeningen op staan: die zouden verschuiven) */
    if (f.pdf && f.conv === 'omgezet' && /\.(pptx|pptm|ppsx)$/i.test(f.name) && (f.convV || 1) < CONV_VERSION && !annCount(f.ann)) {
      try { var r0 = await makePdf(m, f, await A.store.get(m, f.name)); await persist(); if (r0) return r0; } catch (e) { console.warn(e); }
    }
    if (f.pdf) { try { return await A.store.get(m, f.pdf); } catch (e) { f.pdf = null; } }
    if (f.conv === 'niet' && f.convV === CONV_VERSION) return null;
    var r = await makePdf(m, f, await A.store.get(m, f.name)); await persist(); return r;
  }
  function agendaFirst(list) { return list.slice().sort(function (a, b) { return (/agenda/i.test(b.name) ? 1 : 0) - (/agenda/i.test(a.name) ? 1 : 0); }); }
  async function ensureFolder(m) { if (A.store && A.store.kind === 'map' && m.folder) { try { await A.store.dir(m); } catch (e) { console.warn('Map aanmaken mislukt', e); } } }
  async function saveDraft(d) {
    var m = { id: d.id, type: d.type, title: d.title, location: d.location, link: d.link || '', ibabs: d.ibabs || '', date: d.date, start: d.start, end: d.end, chair: d.chair, invitees: d.invitees, notes: d.notes,
      source: d.source, files: [], created: new Date().toISOString() };
    m.folder = safe((m.date || 'zonder datum') + ' ' + m.title).slice(0, 70) + ' [' + m.id.slice(-4) + ']';
    var todo = agendaFirst((d.pending || []).filter(function (f) { return f.on; }));
    for (var i = 0; i < todo.length; i++) { toast('Stukken omzetten naar PDF… (' + (i + 1) + '/' + todo.length + ')'); await addFileTo(m, todo[i].name, todo[i].type, todo[i].blob); }
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
    try {
      if (cur && !cur.isNew) {
        var n = 0;
        for (var i = 0; i < docs.length; i++) {
          var same = cur.files.filter(function (f) { return f.name.toLowerCase() === safe(docs[i].name).toLowerCase(); })[0];
          if (same && confirm('"' + same.name + '" bestaat al in deze vergadering.\n\nOK = de oude versie vervangen door deze nieuwe\nAnnuleren = als extra stuk toevoegen')) {
            toast('Nieuwe versie opslaan…'); await saveEdited(cur, same, docs[i]); n++; continue;
          }
          var base = docs[i].name.replace(/\.[^.]*$/, '').toLowerCase(), twin = /\.pdf$/i.test(docs[i].name) && cur.files.filter(function (f) { return (f.conv === 'omgezet' || f.conv === 'niet') && f.name.replace(/\.[^.]*$/, '').toLowerCase() === base; })[0];
          if (twin && confirm('Wil je "' + docs[i].name + '" gebruiken als PDF-versie van "' + twin.name + '"?\n(OK = gebruiken als PDF-versie, Annuleren = toevoegen als apart stuk)')) {
            var tpn = twin.pdf && twin.pdf !== twin.name ? twin.pdf : uniqueName(cur, docs[i].name); await A.store.put(cur, tpn, docs[i]); twin.pdf = tpn; twin.conv = 'vervangen'; delete twin.convErr; n++; continue;
          }
          toast('Omzetten naar PDF: ' + docs[i].name + '…'); await addFileTo(cur, docs[i].name, docs[i].type, docs[i]); n++;
        }
        for (i = 0; i < mails.length; i++) {
          var p = await parseMailFile(mails[i]), atts = p.m.attachments.filter(function (a) { return !a.inline; });
          if (confirm('Wat wil je met de mail "' + (p.m.subject || mails[i].name) + '"?\n\nOK = de ' + atts.length + ' bijlage(n) toevoegen aan deze vergadering\nAnnuleren = de mail zelf als document toevoegen')) {
            for (var j = 0; j < atts.length; j++) { await addFileTo(cur, atts[j].name, atts[j].type, new Blob([atts[j].data], { type: atts[j].type })); n++; }
          } else { await addFileTo(cur, mails[i].name, mails[i].type, mails[i]); n++; }
        }
        cur.updated = new Date().toISOString(); await persist(); renderDetail(cur); toast(n + ' document(en) toegevoegd.', 'ok'); return;
      }
      if (cur && cur.isNew) {
        docs.forEach(function (f) { cur.pending.push({ name: f.name, type: f.type || guessMime(f.name), blob: f, on: true }); });
        if (mails.length) for (i = 0; i < mails.length; i++) {
          var q = await parseMailFile(mails[i]);
          q.m.attachments.forEach(function (a) { cur.pending.push({ name: a.name, type: a.type, blob: new Blob([a.data], { type: a.type }), on: !a.inline, inline: a.inline }); });
        }
        renderDetail(cur); toast('Toegevoegd aan de nieuwe vergadering. Klik op Opslaan.', 'ok'); return;
      }
      if (!mails.length) { toast('Sleep een mail (.msg of .eml) om een vergadering te maken. Losse documenten sleep je op een geopende vergadering.', 'warn'); return; }
      if (mails.length === 1) { A.draft = await draftFromMail(mails[0]); location.hash = '#/nieuw'; route(); return; }
      var made = 0;
      for (i = 0; i < mails.length; i++) { var d = await draftFromMail(mails[i]); if (!findDup(d)) { await saveDraft(d); made++; } }
      route(); toast(made + ' vergadering(en) aangemaakt' + (made < mails.length ? ' (' + (mails.length - made) + ' bestonden al)' : '') + '.', 'ok');
    } catch (e) { console.error(e); toast('Kon de mail niet lezen: ' + (e.message || e), 'err'); }
  }


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
      '<li>Kies bij <b>Datumbereik</b> bijvoorbeeld <i>Volgende 7 dagen</i> en bij <b>Detail</b> <i>Volledige details</i>. Wil je de bijlagen van afspraken als stukken, vink dan onder <b>Geavanceerd</b> ook <b>Bijlagen bij agenda-items opnemen</b> aan. Klik op <b>OK</b> en daarna op <b>Opslaan</b>.</li></ol>' +
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
      '<li>Klik op <b>Meer opties</b>, kies <i>Volgende 7 dagen</i> en <i>Volledige details</i> (en eventueel <b>Bijlagen bij agenda-items opnemen</b>), klik op <b>OK</b> en <b>Opslaan</b>.</li></ol>' +
      '<p class="muted">Zie je de werkbalk niet? Klik met de rechtermuisknop op het lint en kies <b>Werkbalk Snelle toegang weergeven</b>.</p></details></section>';
    h += '<section class="card wk"><details><summary><b>Sneltoets met macro</b> <span class="muted">(alleen als je organisatie macro\'s toestaat)</span></summary><ol>' +
      '<li>Druk in Outlook op <b>Alt+F11</b>. De Visual Basic-editor opent.</li>' +
      '<li>Klik links met de rechtermuisknop op <b>Project1</b> en kies <b>Invoegen › Module</b>.</li>' +
      '<li>Klik hieronder op <b>Code kopiëren</b>, plak de code in de lege module (Ctrl+V), druk op <b>Ctrl+S</b> en sluit de editor.</li>' +
      '<li>Kies in Outlook <b>Bestand › Opties › Werkbalk Snelle toegang</b>. Kies bij <b>Kies opdrachten uit</b> de optie <b>Macro\'s</b>, selecteer <b>Project1.MeMeetWeekagenda</b> en klik op <b>Toevoegen</b>. Met <b>Wijzigen</b> geef je hem een icoon en de naam <i>MeMeet weekagenda</i>. Klik op <b>OK</b>.</li>' +
      '<li>De knop staat nu bovenin Outlook. Druk op <b>Alt</b> om te zien welk cijfer erbij hoort: <b>Alt</b> plus dat cijfer is je sneltoets. Zie je de werkbalk niet? Klik met de rechtermuisknop op het lint en kies <b>Werkbalk Snelle toegang weergeven</b>.</li></ol>' +
      '<p class="muted">De macro slaat de komende 7 dagen op. Wil je een andere periode, verander dan in de code het getal achter <code>DAGEN As Integer =</code>. Vraagt Outlook bij het starten of je macro\'s wilt inschakelen, kies dan <b>Macro\'s inschakelen</b>. Krijg je bij het opslaan een melding over het digitale certificaat, of wordt de macro geblokkeerd, dan staat je organisatie geen macro\'s toe. Gebruik dan de sneltoets zonder macro.</p>' +
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
  function isMailAtt(a) { return /\.(msg|eml)$/i.test(a.name) || /ms-outlook|rfc822/i.test(a.type || ''); }
  function attTarget(a) { return isMailAtt(a) ? a.name.replace(/\.[^.]*$/, '') + '.pdf' : a.name; } /* mails worden als PDF opgeslagen */
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
    var h = '<section class="card wkplan"><div class="wkhead"><h2>Kies wat je wilt importeren</h2><button type="button" class="btn sm" id="wkIgn">⚙ Niet importeren…</button></div><p class="muted">' + esc(plan.names.join(', ')) + ' · ' + shown.length + ' afspra' + (shown.length === 1 ? 'ak' : 'ken') + (skip.length ? ' · niet getoond: ' + skip.join(', ') : '') +
      '. Vink uit wat je niet wilt importeren. Wat je uitvinkt, staat de volgende keer ook uit.</p>';
    if (nMinor) h += '<p class="wklegend">' + nMinor + ' afspra' + (nMinor === 1 ? 'ak wordt' : 'ken worden') + ' overgeslagen (blokken, reistijd, uitloop of korte afspraken direct naast een andere vergadering). <button type="button" class="link" id="wkShowMin">' + (plan.showMinor ? 'Verbergen' : 'Toon welke') + '</button></p>' + (plan.showMinor ? '<ul class="wkmin">' + plan.items.filter(function (p) { return p.minor; }).map(function (p) { return '<li>' + esc(fmtShort(p.date)) + ' ' + esc((p.r.start || '') + (p.r.end ? '–' + p.r.end : '')) + ' <b>' + esc(p.title) + '</b> <span class="muted">(' + esc(p.minor) + ')</span></li>'; }).join('') + '</ul>' : '');
    h += '<div class="tw"><table class="wkt"><thead><tr><th class="cb"><input type="checkbox" id="wkall" title="Alles aan of uit"' + (act.length && nOn === act.length ? ' checked' : '') + '></th><th>Datum</th><th>Tijd</th><th>Afspraak</th><th>Locatie</th><th>Bijlagen</th><th>Status</th></tr></thead><tbody>';
    h += plan.items.map(function (p, i) {
      if (p.minor) return '';
      var r = p.r, dim = p.status === 'ongewijzigd';
      return '<tr data-wk="' + i + '" class="' + (dim ? 'dim' : p.on ? 'sel' : 'off') + (p.minor ? ' minor' : '') + '"' + (p.minor ? ' title="Waarschijnlijk geen vergadering: ' + esc(p.minor) + '"' : '') + '><td class="cb">' + (dim ? '' : '<input type="checkbox"' + (p.on ? ' checked' : '') + '>') + '</td><td>' + esc(fmtShort(p.date)) + '</td><td>' + esc((r.start || '') + (r.end ? '–' + r.end : '')) + '</td><td><b>' + esc(p.title) + '</b></td><td>' + esc(r.location || '') + '</td>' +
        '<td>' + (p.atts.length ? '<span title="' + esc(p.atts.map(function (a) { return attTarget(a); }).join('\n')) + '">📎 ' + p.atts.length + '</span>' : '') + '</td>' +
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
        '<div class="chips">' + (g.words.length ? g.words.map(function (w, i) { return '<span class="chip">' + esc(w) + '<button type="button" data-rmw="' + i + '" title="Verwijderen" aria-label="' + esc(w) + ' verwijderen">✕</button></span>'; }).join('') : '<span class="muted">Geen trefwoorden.</span>') + '</div>' +
        '<form class="addw" id="addW"><input id="newW" placeholder="Nieuw trefwoord, bijv. Lunch of Focustijd" autocomplete="off"><button type="submit" class="btn sm">Toevoegen</button></form>' +
        '<label class="chk2"><input type="checkbox" id="shortOn"' + (g.shortOn ? ' checked' : '') + '> Ook afspraken van <input type="number" id="shortMin" min="5" max="60" step="5" value="' + g.shortMin + '"> minuten of korter overslaan als ze direct voor of na een andere vergadering liggen</label>' +
        (skipT.length ? '<h3>Eerder uitgevinkt</h3><p class="muted">Deze titels staan bij een volgende import standaard uit. Haal ze hier weg om ze weer aan te zetten.</p><div class="chips">' + skipT.map(function (t) { return '<span class="chip grey">' + esc(t) + '<button type="button" data-rmt="' + esc(t) + '" title="Weghalen">✕</button></span>'; }).join('') + '</div>' : '') +
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
            if (isMailAtt(a)) {
              var cv = null; try { cv = await convertToPdf(a.name, a.type || guessMime(a.name), blob); } catch (e) { console.error(e); }
              if (cv && cv.bytes) await addFileTo(m, attTarget(a), 'application/pdf', new Blob([cv.bytes], { type: 'application/pdf' }));
              else await addFileTo(m, a.name, a.type, blob);
            } else await addFileTo(m, a.name, a.type, blob);
            nAtt++;
          } catch (e) { console.error(e); failAtt.push(a.name); }
        }
      }
    } finally { await persist(); }
    A.wkPlan = null;
    var res = '<div class="info ' + (failAtt.length ? 'warn' : 'ok') + '">Geïmporteerd: <b>' + made.length + ' nieuw</b>, ' + upd.length + ' bijgewerkt' + (nAtt ? ', ' + nAtt + ' stuk' + (nAtt === 1 ? '' : 'ken') + ' toegevoegd' : '') + '.' + (failAtt.length ? ' Niet gelukt: ' + esc(failAtt.join(', ')) + '.' : '') + '</div>';
    var rows = made.map(function (m) { return [m, 'Nieuw']; }).concat(upd.map(function (m) { return [m, 'Bijgewerkt']; }))
      .sort(function (a, b) { return ((a[0].date || '') + (a[0].start || '')).localeCompare((b[0].date || '') + (b[0].start || '')); });
    if (rows.length) res += '<section class="card"><div class="tw"><table><thead><tr><th>Datum</th><th>Tijd</th><th>Vergadering</th><th>Stukken</th><th></th></tr></thead><tbody>' + rows.map(function (x) {
      var m = x[0]; return '<tr data-id="' + esc(m.id) + '"><td>' + esc(fmtShort(m.date)) + '</td><td>' + esc((m.start || '') + (m.end ? '–' + m.end : '')) + '</td><td><b>' + esc(m.title) + '</b></td><td>' + (m.files.length || '') + '</td><td><span class="pill">' + x[1] + '</span></td></tr>';
    }).join('') + '</tbody></table></div></section>';
    renderWeekImport(res);
    $$('#main tr[data-id]').forEach(function (tr) { tr.onclick = function () { location.hash = '#/v/' + encodeURIComponent(tr.dataset.id); }; });
    toast('Import klaar.', 'ok');
  }

  /* ------------------------------------------------------------- weergave */
  function route() {
    var h = location.hash || '#/'; $('#main').classList.remove('detail');
    renderSide();
    if (h === '#/installatie') return renderInstall();
    if (!A.store) return renderWelcome();
    if (h === '#/nieuw') { if (!A.draft) A.draft = blankDraft(); return renderDetail(A.draft); }
    var mm = /^#\/v\/(.+)$/.exec(h);
    if (mm) { var m = byId(decodeURIComponent(mm[1])); if (m) return renderDetail(m); }
    A.draft = null;
    var rm = /^#\/verslag\/(.+)$/.exec(h);
    if (rm) { var rmm = byId(decodeURIComponent(rm[1])); if (rmm) return renderReport(rmm); }
    if (h === '#/weekagenda') { var wr = A.wkRes; A.wkRes = null; return renderWeekImport(wr); }
    if (h === '#/verslagen') return renderReports();
    if (h === '#/acties') return renderActions();
    if (h === '#/annotaties') { location.replace('#/meeneempunten'); return; } /* oude adressen */
    if (/^#\/annotatie\//.test(h)) { location.replace(h.replace('#/annotatie/', '#/meeneempunt/')); return; }
    if (h === '#/bespreekpunten') { location.replace('#/meeneempunten'); return; } /* Bespreekpunten heet nu Meeneempunten */
    if (/^#\/bespreekpunt\//.test(h)) { location.replace(h.replace('#/bespreekpunt/', '#/meeneempunt/')); return; }
    if (h === '#/meeneempunten') return renderAnnos();
    var anm = /^#\/meeneempunt\/(.+)$/.exec(h); if (anm) { var ao = annoById(decodeURIComponent(anm[1])); if (ao) return renderAnno(ao); location.hash = '#/meeneempunten'; return; }
    if (h === '#/bestanden') return renderFiles(true);
    renderHome();
  }
  function byId(id) { return A.data.meetings.filter(function (m) { return m.id === id; })[0]; }
  function currentMeeting() { var h = location.hash; if (h === '#/nieuw') return A.draft; var mm = /^#\/v\/(.+)$/.exec(h); return mm ? byId(decodeURIComponent(mm[1])) : null; }
  function blankDraft() { return { id: uid(), isNew: true, type: 'Overleg', title: '', location: '', link: '', ibabs: '', date: todayIso(), start: '', end: '', chair: '', invitees: '', notes: '', source: null, files: [], pending: [] }; }

  function renderSide() {
    var s = $('#side'), h = '', hs = location.hash || '#/';
    var nOpen = A.store ? openCount() : 0;
    h += '<nav class="topnav"><a href="#/" class="' + (/^#\/(v\/|nieuw)?$/.test(hs) || hs === '#/' ? 'on' : '') + '">Vergaderingen</a><a href="#/verslagen" class="' + (/^#\/verslag/.test(hs) ? 'on' : '') + '">Verslagen</a><a href="#/acties" class="' + (hs === '#/acties' ? 'on' : '') + '">Actielijst' + (nOpen ? ' <span class="cnt">' + nOpen + '</span>' : '') + '</a><a href="#/meeneempunten" class="' + (/^#\/meeneempunt/.test(hs) ? 'on' : '') + '">Meeneempunten</a><a href="#/bestanden" class="' + (hs === '#/bestanden' ? 'on' : '') + '">Bestanden</a></nav><span class="sp"></span>';
    if (A.store) {
      h += '<span class="tinfo" title="Hier worden alle vergaderingen, stukken en aantekeningen bewaard">📁 ' + (A.store.kind === 'map' ? 'Map: <b>' + esc(A.store.name) + '</b>' : 'In de browser') + ' <button class="link" id="chgStore">' + (A.store.kind === 'map' ? 'wijzig' : 'map kiezen') + '</button></span>';
    }
    setHTML(s, h);
    var cs = $('#chgStore', s); if (cs) cs.onclick = chooseFolder;
    bindFolders(s);
  }
  function renderWelcome() {
    var fsOk = !!W.showDirectoryPicker, here = htmlPathWin();
    setHTML($('#main'), '<div class="card welcome"><h1>Welkom bij MeMeet</h1>' +
      '<p>Sleep mails en uitnodigingen uit Outlook naar MeMeet. Er wordt dan automatisch een vergadering aangemaakt, met de titel, datum, tijd, locatie en alle stukken.</p>' +
      '<ol class="steps"><li><b>Geef MeMeet een vaste plek</b>: zet <code>MeMeet.html</code> in <b>Documenten\\MeMeet</b>' + (here ? ' <span class="muted">(nu: ' + esc(here) + ')</span>' : '') + '.</li>' +
      '<li><b>Kies de datamap</b>: klik hieronder en kies de map <b>MeMeet</b> waar dit bestand in staat. MeMeet maakt daarin de map <b>memeet-data</b> aan en zet er het icoon naast.</li>' +
      '<li><b>Maak een snelkoppeling</b> op je bureaublad en in de taakbalk, met <code>C:\\Windows\\explorer.exe</code> ervoor. Hoe dat stap voor stap gaat, laat MeMeet je zien na het kiezen van de map.</li></ol>' +
      (fsOk ? '<p><button class="btn pri" id="pickDir">📁 Datamap kiezen…</button> <a class="btn" href="#/installatie">Uitgebreide uitleg</a></p>' : '<p class="note">Deze browser kan geen map op je computer gebruiken. Open MeMeet in Microsoft Edge of Google Chrome.</p>') +
      '<p class="note"><b>Back-up:</b> kopieer af en toe de hele map <b>memeet-data</b>, mét het bestand <b>memeet.json</b> erin, naar bijvoorbeeld OneDrive of een netwerkschijf. Terugzetten doe je door die map weer als datamap te kiezen. Meer uitleg vind je onder de knop <b>?</b> rechtsboven.</p>' +
      '<p class="note">Mag je geen map kiezen? <button class="link" id="useIdb">Bewaar alles in de browser</button> (alleen op deze computer, zonder bestanden).</p>' +
      (A.hadDir ? '<button class="btn" id="recon">Verder met de vorige map</button>' : '') + '</div>');
    var p = $('#pickDir'); if (p) p.onclick = chooseFolder;
    $('#useIdb').onclick = function () { useStore(new BrowserStore()); };
    var r = $('#recon'); if (r) r.onclick = reconnect;
  }
  /* ------------------------------------------------------------- installatie: datamap, snelkoppeling via explorer.exe, icoon */
  var MEMEET_ICO = __MEMEET_ICO__; /* icons/2-tafel.ico, door het buildscript ingevoegd */
  function htmlPathWin() {
    if (location.protocol !== 'file:') return null;
    var p = decodeURIComponent(location.pathname);
    if (location.host) return '\\\\' + location.host + p.replace(/\//g, '\\');
    p = p.replace(/^\/([A-Za-z]:)/, '$1');
    return /^[A-Za-z]:/.test(p) ? p.replace(/\//g, '\\') : null;
  }
  function htmlDirWin() { var p = htmlPathWin(); return p ? p.replace(/\\[^\\]*$/, '') : null; }
  function icoBlob() { return new Blob([b64(MEMEET_ICO)], { type: 'image/x-icon' }); }
  async function putIconNextToApp(dir) {
    var name = (decodeURIComponent(location.pathname).split('/').pop() || '');
    var hasApp = name && await dir.getFileHandle(name).then(function () { return true; }, function () { return false; });
    if (!hasApp) return false; /* alleen naast MeMeet.html */
    var exists = await dir.getFileHandle('MeMeet.ico').then(function () { return true; }, function () { return false; });
    if (!exists) { var fh = await dir.getFileHandle('MeMeet.ico', { create: true }), w = await fh.createWritable(); await w.write(icoBlob()); await w.close(); }
    A.iconPlaced = true; return true;
  }
  function renderInstall() {
    var here = htmlPathWin(), dir = htmlDirWin(), inDocs = here && /\\(Documents|Documenten)\\MeMeet\\[^\\]+$/i.test(here), cmd = 'C:\\Windows\\explorer.exe "' + (here || 'C:\\Users\\JOUWNAAM\\Documents\\MeMeet\\MeMeet.html') + '"';
    var h = '<div class="crumb"><a href="#/">Vergaderingen</a> › Installatie</div><div class="head"><h1>MeMeet installeren</h1></div>';
    h += '<section class="card wk"><h2>1. Een vaste plek voor MeMeet</h2>' +
      '<p>Zet <code>MeMeet.html</code> in een eigen map <b>MeMeet</b> in <b>Documenten</b>. Op die plek vervang je het bestand later ook door een nieuwe versie.</p>' +
      (here ? '<p class="' + (inDocs ? 'okline' : 'warnline') + '">' + (inDocs ? '✓ Dit bestand staat op een goede plek: ' : 'Dit bestand staat nu hier: ') + '<code>' + esc(here) + '</code>' + (inDocs ? '' : '. Verplaats het naar <code>Documenten\\MeMeet</code> en open het daar opnieuw, voordat je de snelkoppeling maakt.') + '</p>' : '<p class="warnline">Open MeMeet als bestand (dubbelklik op <code>MeMeet.html</code>) om de snelkoppeling te kunnen maken.</p>') + '</section>';
    h += '<section class="card wk"><h2>2. De datamap</h2>' +
      (A.store && A.store.kind === 'map' ? '<p class="okline">✓ De gegevens staan in de map <b>' + esc(A.store.name) + '</b>.</p>' : A.store ? '<p>De gegevens worden nu in de browser bewaard. Wil je ze in een map op je computer? Klik dan op <b>Datamap kiezen</b>.</p>' : '') +
      '<p>Klik op <b>Datamap kiezen</b> en kies de map <b>MeMeet</b> waar <code>MeMeet.html</code> in staat. MeMeet maakt daarin de map <b>memeet-data</b> aan, met de submappen <b>Vergaderingen</b>, <b>Aantekeningen</b> en <b>Actielijst</b>, en zet het icoon <code>MeMeet.ico</code> naast <code>MeMeet.html</code>.</p>' +
      '<pre class="tree">Documenten\\MeMeet\\\n  MeMeet.html\n  MeMeet.ico\n  memeet-data\\\n    Vergaderingen\\\n    Aantekeningen\\\n    Actielijst\\\n    Meeneempunten\\\n    memeet.json</pre>' +
      '<p><button class="btn' + (A.store && A.store.kind === 'map' ? '' : ' pri') + '" id="insPick">📁 Datamap kiezen…</button></p></section>';
    h += '<section class="card wk"><h2>3. Snelkoppeling op het bureaublad en in de taakbalk</h2>' +
      '<p>De snelkoppeling start <code>explorer.exe</code> met MeMeet als bestand. Omdat het doel een programma is, kun je hem daarna ook naar de taakbalk slepen.</p><ol>' +
      '<li>Klik met de rechtermuisknop op een lege plek op het bureaublad en kies <b>Nieuw</b> › <b>Snelkoppeling</b>.</li>' +
      '<li>Plak bij <i>Typ de locatie van het item</i> deze regel' + (here ? ' (klik op <b>Kopiëren</b>)' : ' en vervang het pad door de plek van jouw <code>MeMeet.html</code>') + ':</li></ol>' +
      '<div class="cmdbox"><code id="insCmd">' + esc(cmd) + '</code><button class="btn sm" id="insCopy">Kopiëren</button></div><ol start="3">' +
      '<li>Klik op <b>Volgende</b>, typ als naam <b>MeMeet</b> en klik op <b>Voltooien</b>.</li>' +
      '<li>Klik met de rechtermuisknop op de nieuwe snelkoppeling en kies <b>Eigenschappen</b>. Klik op <b>Ander pictogram…</b> › <b>Bladeren</b>, kies <code>' + esc((dir || 'Documenten\\MeMeet') + '\\MeMeet.ico') + '</code> en klik twee keer op <b>OK</b>.</li>' +
      '<li>Sleep de snelkoppeling van het bureaublad naar de <b>taakbalk</b>. Of klik er met de rechtermuisknop op en kies <b>Aan taakbalk vastmaken</b> (in Windows 11 eerst <b>Meer opties weergeven</b>).</li></ol>' +
      '<p class="muted">' + (A.iconPlaced ? 'Het icoon <code>MeMeet.ico</code> heeft MeMeet al naast <code>MeMeet.html</code> gezet. ' : 'Het icoon <code>MeMeet.ico</code> zet MeMeet naast <code>MeMeet.html</code> als je in stap 2 de map MeMeet kiest. Staat het er niet? ') + '<button type="button" class="link" id="insIco">Icoon downloaden</button> en zet het naast <code>MeMeet.html</code>.</p></section>';
    h += '<section class="card wk"><h2>4. Bijwerken naar een nieuwe versie</h2>' + UPGRADE_HTML + '</section>';
    h += '<section class="card wk"><h2>5. Back-up</h2>' + BACKUP_HTML.replace(/<h3>/g, '<h3 class="sub">') + '</section>';
    h += '<p><a class="btn" href="#/">Klaar, naar de vergaderingen</a></p>';
    setHTML($('#main'), h);
    $('#insPick').onclick = chooseFolder;
    $('#insIco').onclick = function () { dl(icoBlob(), 'MeMeet.ico'); };
    var c = $('#insCopy'); if (c) c.onclick = async function () { var ok = false; try { await navigator.clipboard.writeText(cmd); ok = true; } catch (e) {} toast(ok ? 'Gekopieerd. Plak het met Ctrl+V.' : 'Kopiëren lukte niet. Selecteer de tekst en druk op Ctrl+C.', ok ? 'ok' : 'warn'); };
  }
  function row(m, cols) {
    return '<tr data-id="' + esc(m.id) + '">' + cols.map(function (c) { return '<td class="c-' + c + '">' + cell(m, c) + '</td>'; }).join('') + '</tr>';
  }
  function cell(m, c) {
    if (c === 'date') return esc(fmtShort(m.date));
    if (c === 'files') return m.files.length ? '<span class="pill">' + m.files.length + '</span>' : '';
    if (c === 'title') return '<b>' + esc(m.title) + '</b>';
    return esc(m[c] || '');
  }
  /* rev: archief. Bij sorteren op datum staat in "Komend" de eerstvolgende vergadering bovenaan (datum + starttijd), en in het archief de laatste. */
  function sorted(list, rev) {
    var k = A.sort.key, dir = A.sort.dir * (rev && k === 'date' ? -1 : 1);
    return list.slice().sort(function (a, b) {
      var x, y;
      if (k === 'date') { x = (a.date || '9999-99-99') + ' ' + (a.start || '00:00'); y = (b.date || '9999-99-99') + ' ' + (b.start || '00:00'); }
      else if (k === 'files') { x = a.files.length; y = b.files.length; }
      else { x = (a[k] || '').toLowerCase(); y = (b[k] || '').toLowerCase(); }
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  function renderHome() {
    var t = todayIso(), ms = A.data.meetings;
    var today = ms.filter(function (m) { return m.date === t; }).sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; });
    function dayList(arr) { return '<ul class="tl">' + arr.map(function (m) {
        return '<li data-id="' + esc(m.id) + '"><span class="tm">' + esc(m.start || '—') + (m.end ? '<small>' + esc(m.end) + '</small>' : '') + '</span><span class="tt"><b>' + esc(m.title) + '</b><small>' + esc(m.location || '') + '</small></span><span class="tact"><span class="tst">' + (m.files.length ? '<span class="pill">' + m.files.length + ' stuk' + (m.files.length > 1 ? 'ken' : '') + '</span>' : '') + '</span><span class="tjn">' + (m.ibabs ? '<button type="button" class="btn sm ibabs" data-ib="' + esc(m.id) + '" title="Stukken in iBabs, in een eigen venster">iBabs</button>' : '') + (m.link ? '<a class="btn sm join" href="' + esc(m.link) + '" target="_blank" rel="noopener" title="Deelnemen aan de online vergadering">Deelnemen</a>' : '') + '</span></span></li>';
      }).join('') + '</ul>'; }
    var tm0 = new Date(); tm0.setDate(tm0.getDate() + 1); var tmw = tm0.getFullYear() + '-' + pad(tm0.getMonth() + 1) + '-' + pad(tm0.getDate());
    var tomorrow = ms.filter(function (m) { return m.date === tmw; }).sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; });
    var years = {}; ms.forEach(function (m) { if (m.date) years[m.date.slice(0, 4)] = 1; });
    var f = A.f, q = f.q.toLowerCase();
    var list = ms.filter(function (m) {
      return (!f.year || (m.date || '').slice(0, 4) === f.year) &&
        (!q || [m.title, m.location, m.chair, m.invitees, m.minutes].join(' ').toLowerCase().indexOf(q) >= 0);
    });
    var Q = [["Wie weet, spreekt niet; wie spreekt, weet niet.", "Lao Tse, Tao Te Ching"], ["Een reis van duizend mijl begint met één stap.", "Lao Tse, Tao Te Ching"], ["Wie anderen kent, is verstandig; wie zichzelf kent, is verlicht.", "Lao Tse, Tao Te Ching"], ["Wie anderen overwint, is sterk; wie zichzelf overwint, is machtig.", "Lao Tse, Tao Te Ching"], ["Wie weet dat hij genoeg heeft, is rijk.", "Lao Tse, Tao Te Ching"], ["Niets ter wereld is zachter dan water, toch overwint niets beter wat hard is.", "vrij naar Lao Tse, Tao Te Ching"], ["De beste leider is degene van wie men nauwelijks merkt dat hij er is.", "vrij naar Lao Tse, Tao Te Ching"], ["Als het werk klaar is, zeggen de mensen: dat hebben we zelf gedaan.", "vrij naar Lao Tse, Tao Te Ching"], ["Een boom die je niet kunt omvatten, groeit uit een kleine spruit.", "vrij naar Lao Tse, Tao Te Ching"], ["Een toren van negen verdiepingen begint met een hoopje aarde.", "Lao Tse, Tao Te Ching"], ["Pak het moeilijke aan zolang het nog makkelijk is.", "vrij naar Lao Tse, Tao Te Ching"], ["Grote dingen beginnen altijd klein.", "vrij naar Lao Tse, Tao Te Ching"], ["Wie op zijn tenen staat, staat niet stevig.", "Lao Tse, Tao Te Ching"], ["Ware woorden zijn niet mooi; mooie woorden zijn niet waar.", "Lao Tse, Tao Te Ching"], ["Regeer een groot land zoals je een kleine vis bakt: roer er niet te veel in.", "vrij naar Lao Tse, Tao Te Ching"], ["Veel woorden putten uit; houd het bij het midden.", "vrij naar Lao Tse, Tao Te Ching"], ["Het zachte en zwakke overwint het harde en sterke.", "Lao Tse, Tao Te Ching"], ["Wie tevreden is, hoeft zich niet te schamen.", "vrij naar Lao Tse, Tao Te Ching"], ["Wie zichzelf niet op de voorgrond zet, valt juist op.", "vrij naar Lao Tse, Tao Te Ching"], ["Een goede wandelaar laat geen sporen na.", "Lao Tse, Tao Te Ching"], ["Leren zonder nadenken is zinloos; nadenken zonder leren is gevaarlijk.", "Confucius, Analecten"], ["Waar drie mensen samen lopen, is er altijd één van wie ik kan leren.", "Confucius, Analecten"], ["Weten dat je iets weet, en weten dat je iets niet weet: dat is weten.", "Confucius, Analecten"], ["Wat je zelf niet wilt, doe dat een ander ook niet aan.", "Confucius, Analecten"], ["Een fout maken en die niet herstellen: dat is pas een fout.", "Confucius, Analecten"], ["De edele mens is zuinig met woorden en royaal met daden.", "vrij naar Confucius, Analecten"], ["De edele mens zoekt harmonie, geen eenvormigheid.", "Confucius, Analecten"], ["Wie het oude bestudeert en er het nieuwe in ziet, kan anderen onderwijzen.", "vrij naar Confucius, Analecten"], ["Zie je iemand die wijs is, probeer dan aan hem gelijk te worden.", "vrij naar Confucius, Analecten"], ["Wie haast heeft, bereikt zijn doel niet; wie op kleine voordelen let, bereikt geen grote dingen.", "vrij naar Confucius, Analecten"], ["De edele mens vraagt het van zichzelf; de kleine mens vraagt het van anderen.", "vrij naar Confucius, Analecten"], ["Leer alsof je het nooit zult bijhouden, en alsof je bang bent het te verliezen.", "vrij naar Confucius, Analecten"], ["Is het geen vreugde als vrienden van ver komen?", "Confucius, Analecten"], ["Maak je niet druk of anderen jou kennen; maak je druk of jij hen kent.", "vrij naar Confucius, Analecten"], ["Met een kikker in een put kun je niet over de zee praten.", "Zhuangzi"], ["Woorden zijn er voor de betekenis; heb je de betekenis, dan kun je de woorden vergeten.", "vrij naar Zhuangzi"], ["Wie alles gelooft wat in de boeken staat, kan beter geen boeken hebben.", "Mencius"], ["Zonder passer en winkelhaak maak je geen cirkel of vierkant.", "vrij naar Mencius"], ["Horen is beter dan niet horen, zien is beter dan horen, doen is beter dan zien.", "vrij naar Xunzi"], ["Ken de ander en ken jezelf, en je komt in honderd slagen niet in gevaar.", "Sun Tzu, De kunst van het oorlogvoeren"], ["De hoogste kunst is de ander te winnen zonder te strijden.", "vrij naar Sun Tzu, De kunst van het oorlogvoeren"], ["Wie weet wanneer hij wel en wanneer hij niet moet strijden, wint.", "vrij naar Sun Tzu, De kunst van het oorlogvoeren"], ["Beter dan duizend holle woorden is één woord dat rust brengt.", "vrij naar Boeddha, Dhammapada"], ["Vijandschap houdt nooit op door vijandschap, alleen door het loslaten ervan.", "vrij naar Boeddha, Dhammapada"], ["Zoals een rots niet wankelt in de wind, zo blijven wijzen kalm bij lof en kritiek.", "vrij naar Boeddha, Dhammapada"], ["Wie zichzelf overwint, is een grotere winnaar dan wie duizend anderen verslaat.", "vrij naar Boeddha, Dhammapada"], ["Wat we zijn, komt voort uit wat we denken.", "vrij naar Boeddha, Dhammapada"], ["Een druppel per keer vult de waterpot.", "vrij naar Boeddha, Dhammapada"], ["Je hebt recht op je werk, niet op de vruchten ervan.", "vrij naar de Bhagavad Gita"], ["De wereld is één familie.", "vrij naar de Maha Upanishad"], ["In de geest van de beginner zijn er veel mogelijkheden, in die van de deskundige maar weinig.", "Shunryu Suzuki"], ["Vergeet je beginnersgeest niet.", "Zeami"], ["Ichi-go ichi-e: elke ontmoeting gebeurt maar één keer.", "Japans gezegde uit de theeceremonie"], ["Heb je haast, neem dan een omweg.", "Japans spreekwoord"], ["Zeven keer vallen, acht keer opstaan.", "Japans spreekwoord"], ["Ook de aap valt weleens uit de boom.", "Japans spreekwoord"], ["Drie mensen samen hebben de wijsheid van Monju.", "Japans spreekwoord"], ["De spijker die uitsteekt, wordt erin geslagen.", "Japans spreekwoord"], ["Zelfs een steen wordt warm als je er drie jaar op zit.", "Japans spreekwoord"], ["Stof dat zich opstapelt, wordt een berg.", "Japans spreekwoord"], ["Niet alles zeggen is een bloem.", "Japans spreekwoord"], ["Als het water zakt, komen de stenen boven.", "Japans spreekwoord"], ["Wie twee hazen najaagt, vangt er geen een.", "Japans spreekwoord"], ["Na de regen wordt de grond harder.", "Japans spreekwoord"], ["Vroeg opstaan levert drie mon op.", "Japans spreekwoord"], ["De kikker in de put kent de grote zee niet.", "Japans spreekwoord"], ["Wie een vraag stelt, is even dom; wie het niet doet, blijft dom.", "Chinees spreekwoord"], ["Eén gesprek met een wijs mens is meer waard dan tien jaar boeken lezen.", "Chinees spreekwoord"], ["Met één hand kun je niet klappen.", "Chinees spreekwoord"], ["Een dijk van duizend mijl bezwijkt door een mierenhol.", "Han Feizi"], ["Als iedereen hout sprokkelt, brandt het vuur hoog.", "Chinees spreekwoord"], ["Drie gewone schoenmakers samen zijn zo slim als Zhuge Liang.", "Chinees spreekwoord"], ["Water dat te helder is, heeft geen vissen.", "Chinees spreekwoord"], ["Honderd keer horen is niet zo goed als één keer zien.", "Chinees spreekwoord"], ["Langzaam gaan is niet erg; stilstaan wel.", "Chinees spreekwoord"], ["Eén boom maakt nog geen bos.", "Chinees spreekwoord"], ["Denk bij het drinken van water aan de bron.", "Chinees spreekwoord"], ["Een kleine vonk kan een hele vlakte in brand zetten.", "Chinees spreekwoord"], ["Wie één moment zijn boosheid inhoudt, bespaart zich honderd dagen zorgen.", "Chinees spreekwoord"], ["Jade die niet wordt bewerkt, wordt geen sieraad.", "vrij naar het Boek der Riten"], ["Als de reiger en de mossel vechten, wint de visser.", "Chinees spreekwoord"], ["Teken geen pootjes aan een slang.", "Chinees spreekwoord"], ["Heb de bamboe al in je hoofd voordat je hem schildert.", "Chinees spreekwoord"], ["Het is nooit te laat om de schaapskooi te herstellen.", "Chinees spreekwoord"], ["Wie de bel heeft opgehangen, moet hem ook weer losmaken.", "Chinees spreekwoord"], ["Wie bergop wil, begint onderaan.", "vrij naar de Leer van het Midden"], ["Zelfs een vel papier is lichter als je het samen draagt.", "Koreaans spreekwoord"], ["Met te veel schippers vaart de boot de berg op.", "Koreaans spreekwoord"], ["Woorden hebben geen voeten, maar reizen duizend li.", "Koreaans spreekwoord"], ["Beginnen is al de helft.", "Koreaans spreekwoord"], ["Overdag luisteren de vogels, 's nachts de muizen.", "Koreaans spreekwoord"], ["Ook een stenen brug moet je aftikken voordat je oversteekt.", "Koreaans spreekwoord"], ["Een leider is als een herder: hij blijft achter de kudde en laat de vlugsten voorgaan; de anderen volgen, zonder te merken dat ze van achteren worden geleid.", "vrij naar Nelson Mandela, De lange weg naar de vrijheid"], ["Moed is niet de afwezigheid van angst, maar de overwinning erop.", "vrij naar Nelson Mandela, De lange weg naar de vrijheid"], ["Onderwijs is het krachtigste wapen om de wereld te veranderen.", "Nelson Mandela, 2003"], ["Leiderschap en leren kunnen niet zonder elkaar.", "John F. Kennedy, 1963"], ["Vraag niet wat je land voor jou kan doen, vraag wat jij voor je land kunt doen.", "John F. Kennedy, 1961"], ["Plannen zijn waardeloos, maar plannen maken is onmisbaar.", "vrij naar Dwight D. Eisenhower, 1957"], ["Wat belangrijk is, is zelden dringend, en wat dringend is, zelden belangrijk.", "vrij naar Dwight D. Eisenhower, 1954"], ["Een huis dat tegen zichzelf verdeeld is, kan niet blijven staan.", "Abraham Lincoln, 1858"], ["De prijs van grootheid is verantwoordelijkheid.", "Winston Churchill, 1943"], ["Ik ben altijd bereid om te leren, al vind ik het niet altijd prettig om iets geleerd te krijgen.", "Winston Churchill, 1952"], ["Je kunt maar één schakel van de keten tegelijk aanpakken.", "vrij naar Winston Churchill, 1945"], ["Niet de criticus telt, maar wie zelf in de arena staat.", "vrij naar Theodore Roosevelt, 1910"], ["Doe wat je kunt, met wat je hebt, waar je bent.", "Theodore Roosevelt, Autobiografie"], ["Het enige wat we moeten vrezen, is de angst zelf.", "Franklin D. Roosevelt, 1933"], ["De maat van een mens is niet waar hij staat in tijden van gemak, maar waar hij staat in tijden van uitdaging en strijd.", "Martin Luther King Jr., 1963"], ["Kracht, moed en vertrouwen win je bij elke ervaring waarin je de angst echt in de ogen kijkt.", "vrij naar Eleanor Roosevelt, 1960"], ["Verspil geen tijd meer aan praten over wat een goed mens is. Wees er een.", "Marcus Aurelius, Overpeinzingen"], ["Wat de weg verspert, wordt de weg.", "vrij naar Marcus Aurelius, Overpeinzingen"], ["Niet omdat het moeilijk is, durven we niet; omdat we niet durven, is het moeilijk.", "Seneca, Brieven aan Lucilius"], ["Geen wind is gunstig voor wie niet weet naar welke haven hij vaart.", "vrij naar Seneca, Brieven aan Lucilius"], ["Men hoeft niet te hopen om te ondernemen, noch te slagen om te volharden.", "toegeschreven aan Willem van Oranje"], ["Verandering komt niet als we wachten op iemand anders of een ander moment. Wij zijn degenen op wie we hebben gewacht.", "Barack Obama, 2008"], ["Vecht voor wat je belangrijk vindt, maar doe het zo dat anderen zich bij je willen aansluiten.", "vrij naar Ruth Bader Ginsburg, 2015"], ["Het is verbazingwekkend wat je bereikt als het je niet uitmaakt wie de eer krijgt.", "toegeschreven aan Harry S. Truman"], ["De verantwoordelijkheid ligt hier.", "Harry S. Truman, bordje op zijn bureau"], ["Ik schrijf mijn succes hieraan toe: ik gaf nooit een excuus en nam er nooit een aan.", "Florence Nightingale"], ["Hoop is niet de overtuiging dat iets goed afloopt, maar de zekerheid dat iets zin heeft, hoe het ook afloopt.", "vrij naar Václav Havel"], ["Een leider is een handelaar in hoop.", "toegeschreven aan Napoleon Bonaparte"]];
    /* elke dag een andere wijsheid: een vaste, door elkaar gehusselde volgorde, zodat er pas na de hele reeks één terugkomt */
    function qPick() { if (!A.qbag || !A.qbag.length) { A.qbag = Q.map(function (q, k) { return k; }).filter(function (k) { return k !== A.qi; }); } return A.qbag.splice(Math.floor(Math.random() * A.qbag.length), 1)[0]; }
    if (A.qi == null || A.qi >= Q.length) A.qi = qPick(); /* elke keer dat MeMeet opent een willekeurige wijsheid */
    var hr = new Date().getHours(), greet = hr < 6 ? 'Goedenacht' : hr < 12 ? 'Goedemorgen' : hr < 18 ? 'Goedemiddag' : 'Goedenavond';
    var nowHm = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()), over = today.length && today.every(function (m) { return (m.end || m.start || '00:00') <= nowHm; });
    var sum = !today.length ? 'Je hebt vandaag geen vergaderingen.' : (over ? 'Je had' : 'Je hebt') + ' vandaag <b>' + today.length + ' vergadering' + (today.length === 1 ? '' : 'en') + '</b>.';
    var h = '<section class="quote" id="quote"><div class="qhi"><b>' + greet + '</b><span>' + sum + '</span></div><figure class="qfig"><blockquote id="qtxt">' + esc(Q[A.qi][0]) + '</blockquote><figcaption id="qwho">' + esc(Q[A.qi][1]) + '</figcaption></figure><button type="button" class="qnext" id="qnext" title="Andere wijsheid" aria-label="Andere wijsheid">↻</button></section>';
    h += '<div class="head"><h1>Vergaderingen</h1><div class="acts"><a class="btn" href="#/weekagenda" title="Je Outlook-agenda van de komende dagen in één keer inlezen">📅 Importeer weekagenda</a><button class="btn" id="imp">Mail importeren…</button><a class="btn pri" href="#/nieuw" id="new">+ Nieuwe vergadering</a></div></div>';
    h += '<div class="dropbar">Sleep een mail of agenda-uitnodiging uit Outlook naar dit venster. Er wordt dan een vergadering aangemaakt, met de stukken als bijlage.</div>';
    var nowD = new Date(), late = nowD.getHours() * 60 + nowD.getMinutes() >= 20 * 60 + 30;
    if (A.showToday == null || A.showTodayDay !== t + (late ? 'L' : '')) { A.showToday = !late; A.showTodayDay = t + (late ? 'L' : ''); } /* standaard open, na 20:30 standaard dicht */
    h += '<section class="card today arch"><button type="button" class="archbtn daybtn" id="tdy" aria-expanded="' + (A.showToday ? 'true' : 'false') + '"><span>' + (!today.length ? '' : A.showToday ? '▾' : '▸') + '</span> Vandaag <span class="muted">' + esc(fmtLong(t)) + ' · ' + (today.length ? today.length + ' vergadering' + (today.length === 1 ? '' : 'en') : 'geen vergaderingen') + '</span><span class="sp"></span>' + (today.length ? '<span class="link">' + (A.showToday ? 'verbergen' : 'weergeven') + '</span>' : '') + '</button>';
    if (!A.showToday) { /* ingeklapt */ }
    else if (today.length) {
      h += dayList(today);
    } /* geen vergaderingen vandaag: niets eronder (de kop zegt het al) */
    h += '</section>';
    if (A.showTomorrow == null) A.showTomorrow = true; /* standaard open */
    h += '<section class="card today tomorrow arch"><button type="button" class="archbtn daybtn" id="tmr" aria-expanded="' + (A.showTomorrow ? 'true' : 'false') + '"><span>' + (!tomorrow.length ? '' : A.showTomorrow ? '▾' : '▸') + '</span> Morgen <span class="muted">' + esc(fmtLong(tmw)) + ' · ' + (tomorrow.length ? tomorrow.length + ' vergadering' + (tomorrow.length === 1 ? '' : 'en') : 'geen vergaderingen') + '</span><span class="sp"></span>' + (tomorrow.length ? '<span class="link">' + (A.showTomorrow ? 'verbergen' : 'weergeven') + '</span>' : '') + '</button>' +
      (A.showTomorrow && tomorrow.length ? dayList(tomorrow) : '') + '</section>';
    var showF = A.showUp || A.showArch || q || f.year;
    if (showF) h += '<section class="card fcard"><div class="filters"><input id="q" type="search" placeholder="Zoeken op titel, locatie, namen of aantekeningen…" value="' + esc(f.q) + '">' +
      '<select id="fYear"><option value="">Alle jaren</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (f.year === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div></section>';
    var cols = [['title', 'Titel'], ['date', 'Datum'], ['start', 'Start'], ['end', 'Eind'], ['location', 'Locatie'], ['files', 'Stukken']];
    var hs = A.hsel || (A.hsel = {}); Object.keys(hs).forEach(function (id) { if (!byId(id)) delete hs[id]; });
    var nSel = Object.keys(hs).length;
    h += '<div class="bulkbar" id="bulkbar"' + (nSel ? '' : ' hidden') + '><b id="bulkN"></b><button type="button" class="btn sm danger" id="bulkDel">🗑 Verwijderen</button><button type="button" class="link" id="bulkClr">Selectie opheffen</button></div>';
    function tbl(rows, empty, arch) {
      rows = sorted(rows, arch);
      var allOn = rows.length && rows.every(function (m) { return hs[m.id]; });
      var o = '<div class="tw"><table class="mtb"><thead><tr><th class="cb"><input type="checkbox" data-all="' + (arch ? 'arch' : 'up') + '" title="Alles in deze lijst selecteren"' + (allOn ? ' checked' : '') + '></th>' + cols.map(function (c) { var on = A.sort.key === c[0], dn = A.sort.dir * (arch && c[0] === 'date' ? -1 : 1) < 0; return '<th class="c-' + c[0] + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + '<i>' + (on ? (dn ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '</tr></thead><tbody>';
      o += rows.length ? rows.map(function (m) { return row(m, cols.map(function (c) { return c[0]; })).replace('<tr data-id="' + esc(m.id) + '">', '<tr data-id="' + esc(m.id) + '"' + (hs[m.id] ? ' class="sel"' : '') + '><td class="cb"><input type="checkbox" data-hs="' + esc(m.id) + '"' + (hs[m.id] ? ' checked' : '') + '></td>'); }).join('') : '<tr><td colspan="7" class="empty">' + empty + '</td></tr>';
      return o + '</tbody></table></div>';
    }
    var upcoming = list.filter(function (m) { return !m.date || m.date > tmw; }), past = list.filter(function (m) { return m.date && m.date < t; });
    A.hlists = { up: sorted(upcoming), arch: sorted(past, true) };
    h += '<section class="card arch upc"><button type="button" class="archbtn" id="upc" aria-expanded="' + (A.showUp ? 'true' : 'false') + '"><span>' + (A.showUp ? '▾' : '▸') + '</span> Volgende vergaderingen <span class="muted">' + upcoming.length + ' vergadering' + (upcoming.length === 1 ? '' : 'en') + (q || f.year ? ' met deze filters' : '') + '</span><span class="sp"></span><span class="link">' + (A.showUp ? 'verbergen' : 'weergeven') + '</span></button>';
    if (A.showUp) h += '<div class="upbody">' + tbl(upcoming, ms.length ? (past.length ? 'Geen komende vergaderingen' + (q || f.year ? ' met deze filters' : '') + '. Eerdere vergaderingen staan in het archief.' : 'Geen vergaderingen gevonden met deze filters.') : 'Nog geen vergaderingen. Sleep een mail naar dit venster om te beginnen.');
    if (A.showUp) h += '<p class="note">Klik op een kolomkop om te sorteren.</p></div>';
    h += '</section>';
    h += '<section class="card arch"><button type="button" class="archbtn" id="arch"><span>' + (A.showArch ? '▾' : '▸') + '</span> Archief <span class="muted">' + past.length + ' eerdere vergadering' + (past.length === 1 ? '' : 'en') + (q || f.year ? ' met deze filters' : '') + '</span><span class="sp"></span><span class="link">' + (A.showArch ? 'verbergen' : 'weergeven') + '</span></button>';
    if (A.showArch) h += tbl(past, 'Geen eerdere vergaderingen' + (q || f.year ? ' met deze filters' : '') + '.', true);
    h += '</section>';
    setHTML($('#main'), h);
    function keepScroll(fn) { var sy = W.scrollY; fn(); renderHome(); W.scrollTo(0, Math.min(sy, D.documentElement.scrollHeight)); }
    $('#arch').onclick = function () { keepScroll(function () { A.showArch = !A.showArch; }); };
    $('#upc').onclick = function () { keepScroll(function () { A.showUp = !A.showUp; }); };
    $('#tdy').onclick = function () { keepScroll(function () { A.showToday = !A.showToday; }); };
    $('#tmr').onclick = function () { keepScroll(function () { A.showTomorrow = !A.showTomorrow; }); };
    $('#imp').onclick = function () { $('#pickMail').click(); };
    var qn = $('#qnext'); if (qn) qn.onclick = function () { A.qi = qPick(); var f = $('#quote'); f.classList.remove('in'); void f.offsetWidth; $('#qtxt').textContent = Q[A.qi][0]; $('#qwho').textContent = Q[A.qi][1]; f.classList.add('in'); };
    bindFolders($('#main'));
    $('#new').onclick = function () { A.draft = blankDraft(); };
    $$('[data-ib]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var im = byId(b.dataset.ib); if (im) openIbabs(im); }; });
    $$('[data-id]').forEach(function (r) { r.onclick = function (e) { if (e.target.tagName === 'A' || e.target.closest('button')) return; if (e.target.closest('td.cb')) return; location.hash = '#/v/' + encodeURIComponent(r.dataset.id); }; });
    function updBulk() {
      var n = Object.keys(hs).length, bar = $('#bulkbar'); if (!bar) return;
      bar.hidden = !n; $('#bulkN').textContent = n + ' vergadering' + (n === 1 ? '' : 'en') + ' geselecteerd';
      $$('tr[data-id]').forEach(function (tr) { var on = !!hs[tr.dataset.id], cb = tr.querySelector('input[data-hs]'); tr.classList.toggle('sel', on); if (cb) cb.checked = on; });
      $$('[data-all]').forEach(function (cb) { var l = A.hlists[cb.dataset.all] || []; cb.checked = !!l.length && l.every(function (m) { return hs[m.id]; }); });
    }
    $$('td.cb').forEach(function (td) { td.onclick = function (e) { e.stopPropagation(); var cb = td.querySelector('input'); if (e.target !== cb) cb.checked = !cb.checked; if (cb.checked) hs[cb.dataset.hs] = 1; else delete hs[cb.dataset.hs]; updBulk(); }; });
    $$('[data-all]').forEach(function (cb) { cb.onclick = function (e) { e.stopPropagation(); }; cb.onchange = function () { var on = cb.checked; (A.hlists[cb.dataset.all] || []).forEach(function (m) { if (on) hs[m.id] = 1; else delete hs[m.id]; }); updBulk(); }; });
    var bd = $('#bulkDel'); if (bd) bd.onclick = function () { deleteMeetings(Object.keys(hs).map(byId).filter(Boolean)); };
    var bc = $('#bulkClr'); if (bc) bc.onclick = function () { Object.keys(hs).forEach(function (k) { delete hs[k]; }); updBulk(); };
    updBulk();
    $$('[data-sort]').forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; A.sort = { key: k, dir: A.sort.key === k ? -A.sort.dir : 1 }; renderHome(); }; });
    var qi = $('#q'); if (qi) qi.oninput = function () { A.f.q = qi.value; var pos = qi.selectionStart; renderHome(); var n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    var fy = $('#fYear'); if (fy) fy.onchange = function () { A.f.year = this.value; renderHome(); };
  }

  /* Meerdere vergaderingen verwijderen, met alles wat erbij hoort: de map met stukken en originele mail, de aantekeningen en de acties. */
  async function deleteMeetings(list) {
    if (!list.length) return;
    var names = list.slice(0, 12).map(function (m) { return '• ' + (m.date ? fmtShort(m.date) + ' ' : '') + m.title; }).join('\n') + (list.length > 12 ? '\n… en nog ' + (list.length - 12) : '');
    if (!confirm(list.length + ' vergadering' + (list.length === 1 ? '' : 'en') + ' verwijderen?\n\n' + names + '\n\nAlles wat erbij hoort wordt gewist: de stukken, de originele mails, de gewijzigde versies, de aantekeningen en de acties. Dit kun je niet ongedaan maken.')) return;
    var fail = [], nd = null;
    if (A.store.kind === 'map') { try { nd = await A.store.root.getDirectoryHandle(NOTES_DIR); } catch (e) {} }
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      toast('Verwijderen… (' + (i + 1) + '/' + list.length + ')');
      try { await A.store.delMeeting(m); } catch (e) { console.error(e); fail.push(m.title); continue; }
      if (nd && m.minutesFile) { try { await nd.removeEntry(m.minutesFile); } catch (e) {} }
      A.data.meetings = A.data.meetings.filter(function (x) { return x !== m; });
      if (A.hsel) delete A.hsel[m.id];
      annos().forEach(function (x) { if (x.mid === m.id) x.mid = null; });
    }
    await persist();
    try { await writeNotesFiles(null); } catch (e) {}
    if (typeof FX !== 'undefined') FX.items = null;
    var sy = W.scrollY; renderSide(); renderHome(); W.scrollTo(0, Math.min(sy, D.documentElement.scrollHeight));
    toast(fail.length ? 'Niet alles kon worden verwijderd: ' + fail.join(', ') : (list.length - fail.length) + ' vergadering' + (list.length - fail.length === 1 ? '' : 'en') + ' verwijderd.', fail.length ? 'err' : 'ok');
  }

  function renderDetail(m) {
    var isNew = !!m.isNew, h = '', list = isNew ? (m.pending || []) : m.files;
    var sel = A.sel && A.sel.id === m.id ? Math.min(A.sel.i, Math.max(0, list.length - 1)) : 0;
    /* geen kruimelpad: datum en titel staan al in het formulier, en de ruimte is beter voor de stukken */
    if (isNew && m.source) {
      var miss = []; if (!m.date) miss.push('datum'); if (!m.start) miss.push('tijd');
      h += '<div class="info ' + (miss.length ? 'warn' : 'ok') + '">' + (m.source.how === 'agenda-export' ? 'Gegevens overgenomen uit je Outlook-agenda.' : m.source.how === 'agenda-uitnodiging' ? 'Gegevens overgenomen uit de agenda-uitnodiging.' + (m.source.recurring ? ' Dit is een terugkerende afspraak: datum en tijd zijn van de eerstvolgende keer.' : '') : 'Gegevens uit de tekst van de mail gehaald.') + (miss.length ? ' Er is geen ' + miss.join(' en ') + ' gevonden. Vul dat zelf in.' : ' Controleer alles en klik op Opslaan.') + '</div>';
    }
    h += '<form class="card meta" id="frm" autocomplete="off"><div class="mtop"><input class="ttl" name="title" required placeholder="Titel van de vergadering" value="' + esc(m.title) + '">' +
      '<button type="submit" class="btn pri" id="save">Opslaan</button>' + (isNew ? '' : '<button type="button" class="btn' + (A.notesOpen ? ' on' : '') + '" id="npToggle" title="Kolom voor aantekeningen tijdens de vergadering">✎ Aantekeningen</button><button type="button" class="btn" id="exp">Exporteer als één PDF</button><button type="button" class="btn red" id="del" title="Vergadering verwijderen">Verwijder</button>') + '<a class="btn" href="#/">Terug</a></div>';
    h += '<div class="mrow"><label>Datum<input type="date" name="date" value="' + esc(m.date) + '"></label><label>Van<input type="time" name="start" value="' + esc(m.start) + '"></label><label>Tot<input type="time" name="end" value="' + esc(m.end) + '"></label>' +
      '<label class="grow">Locatie<input name="location" value="' + esc(m.location) + '"></label>' +
      '<label class="grow2">Vergaderlink<span class="lk"><input name="link" type="url" placeholder="Geen link gevonden. Plak hier eventueel een Teams- of andere link" value="' + esc(m.link || '') + '"><a class="btn sm join" id="joinBtn" target="_blank" rel="noopener" href="' + esc(m.link || '#') + '"' + (m.link ? '' : ' hidden') + '>Deelnemen</a></span></label>' +
      '<label class="grow2">iBabs-link<span class="lk"><input name="ibabs" type="url" placeholder="Plak hier eventueel de link naar de stukken in iBabs" value="' + esc(m.ibabs || '') + '"><button type="button" class="btn sm ibabs" id="ibBtn" title="De stukken in iBabs openen, in een eigen venster"' + (m.ibabs ? '' : ' hidden') + '>Stukken in iBabs</button>' + (isNew ? '' : '<button type="button" class="btn sm" id="ibSide" title="iBabs links en je aantekeningen rechts op het scherm, elk in een eigen venster"' + (m.ibabs ? '' : ' hidden') + '>Naast elkaar</button>') + '</span></label>' +
      '<label class="grow">Genodigden<input name="invitees" placeholder="Namen, gescheiden door komma\'s. De eerste is de voorzitter" value="' + esc(m.invitees) + '"></label></div></form>';
    h += '<div class="ws' + (A.notesOpen && !isNew ? ' n3' : '') + '"><section class="card list"><div class="shead"><h2>Stukken <span class="muted">' + list.length + '</span></h2><span class="shacts">' + (isNew ? '' : '<button type="button" class="link" id="annoAdd" title="Meeneempunten bij deze vergadering maken">+ Meeneempunten</button>') + '</span></div>';
    /* meeneempunten bovenaan de stukken: gekoppeld aan deze vergadering, of wachtend op (of vastgepind bij) een vergadering met deze titel */
    if (!isNew) { var linked = annos().filter(function (x) { return annoShowsAt(x, m); }).sort(function (x, y) { return (x.created || '').localeCompare(y.created || ''); }); if (linked.length) h += '<ul class="docs annos">' + linked.map(function (x) {
      var op = !!(A.annOpen && A.annOpen[x.id]), np = openPointCount(x), wt = !x.mid && !x.archived;
      return '<li class="annitem' + (op ? ' open' : '') + (x.archived ? ' isarch' : '') + '" data-annid="' + esc(x.id) + '"><div class="annrow"><button type="button" class="annlink" aria-expanded="' + op + '" title="Klik om open of dicht te klappen"><span class="aic">' + (op ? '▾' : '▸') + '</span><span class="fn">' + esc(x.title || 'Meeneempunten') + '</span>' + (np ? '<span class="atag">' + np + ' punt' + (np === 1 ? '' : 'en') + '</span>' : '') + (x.archived ? '<span class="atag">archief</span>' : wt ? '<span class="atag" title="' + (x.pin ? 'Vastgepind: staat bij elke vergadering met ' : 'Wacht op de eerstvolgende vergadering met ') + esc(waitLabel(x)) + '">' + (x.pin ? 'vast' : 'wacht') + '</span>' : '') + '</button>' + (wt ? '<button type="button" class="annskip" data-skip="' + esc(x.id) + '" title="' + (x.pin ? 'Niet bij deze vergadering tonen' : 'Niet bij deze vergadering; het lijstje wacht op de volgende passende vergadering') + '">Niet hier</button>' : '') + '<a class="annedit" href="#/meeneempunt/' + encodeURIComponent(x.id) + '" title="Openen en bewerken">✎</a></div>' + (op ? '<div class="annbody">' + annoBodyHtml(x) + '</div>' : '') + '</li>'; }).join('') + '</ul>'; }
    h += '<ul class="docs" id="docs">';
    list.forEach(function (f, i) {
      if (isNew) {
        h += '<li data-sel="' + i + '"><div class="dl1"><input type="checkbox" data-p="' + i + '"' + (f.on ? ' checked' : '') + ' title="Meenemen bij opslaan"><span class="fn">' + esc(f.name) + '</span></div>' +
          (f.inline ? '<div class="dl2"><small>afbeelding uit de mailtekst</small></div>' : '') + '</li>';
      } else {
        var badge = f.conv === 'vervangen' ? '<span class="bdg ok">eigen PDF</span>' : f.conv === 'niet' ? '<span class="bdg no" title="' + esc(f.convErr || 'Dit bestandstype kan niet worden omgezet') + '">geen PDF</span>' : '';
        var na = annCount(f.ann);
        h += '<li data-sel="' + i + '"><div class="dl1"><span class="num">' + (i + 1) + '</span><span class="fn" title="' + esc(f.name) + '">' + esc(f.name) + '</span></div>' +
          '<div class="dl2">' + badge + (na ? '<span class="bdg ann" title="Aantekeningen">✎ ' + na + '</span>' : '') + '<span class="sp"></span>' +
          '<button type="button" class="link" data-up="' + i + '" title="Omhoog"' + (i ? '' : ' disabled') + '>▲</button><button type="button" class="link" data-down="' + i + '" title="Omlaag"' + (i < list.length - 1 ? '' : ' disabled') + '>▼</button>' +
          '<button type="button" class="link" data-dl="' + i + '" title="Origineel downloaden">⤓</button><button type="button" class="link red" data-rm="' + i + '" title="Verwijderen">✕</button></div></li>';
      }
    });
    if (!list.length) h += '<li class="muted empty">Nog geen stukken.</li>';
    h += '</ul><div class="dz small" id="addDocs" role="button" tabindex="0" title="Klik om stukken te kiezen">Sleep documenten of een mail hierheen, of klik om ze te kiezen</div>';
    /* Outlook-items in de mail (bij terugkerende afspraken vaak tientallen naamloze uitzonderingen) worden stil overgeslagen */
    if (m.source && m.source.how === 'agenda-export') h += '<p class="note">Uit je Outlook-agenda.</p>';
    else if (m.source) h += '<p class="note">Uit de mail' + (m.source.from ? ' van ' + esc(m.source.from) : '') + (m.source.sent ? ', ' + esc(new Date(m.source.sent).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })) : '') + '.' + (m.source.file && !isNew ? ' <a href="#" id="origMail">Originele mail</a>' : '') + '</p>';
    h += '</section><section class="card pv" id="pv"></section><section class="card np" id="np"></section></div>';
    setHTML($('#main'), h); $('#main').classList.add('detail');

    var frm = $('#frm');
    function readForm() { $$('[name]', frm).forEach(function (x) { m[x.name] = x.value.trim(); }); }
    frm.onsubmit = async function (e) {
      e.preventDefault(); readForm();
      if (!m.title) { toast('Vul een titel in.', 'warn'); $('[name=title]', frm).focus(); return; }
      try {
        if (isNew) {
          var dup = findDup(m);
          if (dup && !confirm('Er bestaat al een vergadering "' + dup.title + '" op ' + fmtShort(dup.date) + '. Toch een nieuwe aanmaken?')) { location.hash = '#/v/' + encodeURIComponent(dup.id); return; }
          $('#save').disabled = true;
          var saved = await saveDraft(m); A.draft = null; A.sel = { id: saved.id, i: 0 };
          toast('Vergadering "' + saved.title + '" opgeslagen met ' + saved.files.length + ' stuk(ken).', 'ok'); location.hash = '#/v/' + encodeURIComponent(saved.id);
        } else { m.updated = new Date().toISOString(); await persist(); toast('Opgeslagen.', 'ok'); renderSide(); }
      } catch (er) { $('#save').disabled = false; toast('Opslaan mislukt: ' + (er.message || er), 'err'); }
    };
    var del = $('#del'); if (del) del.onclick = async function () {
      if (!confirm('Vergadering "' + m.title + '" verwijderen?\n\nAlle bestanden van deze vergadering worden gewist: de stukken, de originele mail en alle gewijzigde versies.' + (m.minutes ? '\nJe aantekeningen blijven staan in de map Aantekeningen.' : ''))) return;
      try { await A.store.delMeeting(m); } catch (er) { toast('Verwijderen van de bestanden mislukt: ' + (er.message || er), 'err'); return; }
      A.data.meetings = A.data.meetings.filter(function (x) { return x !== m; }); annos().forEach(function (x) { if (x.mid === m.id) x.mid = null; }); await persist();
      try { await writeNotesFiles(null); } catch (e) {}
      toast('Verwijderd.'); location.hash = '#/';
    };
    var ex = $('#exp'); if (ex) ex.onclick = function () { readForm(); exportMeeting(m); };
    $('#addDocs').onclick = function () { readForm(); $('#pickDocs').click(); };
    $('#addDocs').onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } };
    /* + Meeneempunten: zijn er al meeneempunten bij deze vergadering, dan die uitklappen; anders een nieuw lijstje maken */
    var aa = $('#annoAdd'); if (aa) aa.onclick = function () {
      var items = $$('.annitem'); if (!items.length) return newAnno(m.id);
      items.forEach(function (li) { if (!li.classList.contains('open')) $('.annlink', li).click(); li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); });
      items[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    /* meeneempunten open- en dichtklappen in de kolom, elk hoogstens een kwart van de kolom hoog */
    function annFit() { var col = $('.ws .card.list'), mh = col ? Math.max(110, Math.round(col.clientHeight * 0.25)) : 200; $$('.annbody').forEach(function (b) { b.style.maxHeight = mh + 'px'; }); }
    $$('.annitem').forEach(function (li) {
      var id = li.dataset.annid;
      $('.annlink', li).onclick = function () {
        A.annOpen = A.annOpen || {}; var x = annoById(id), body = $('.annbody', li), btn = $('.annlink', li);
        if (body) { li.removeChild(body); li.classList.toggle('open', false); delete A.annOpen[id]; $('.aic', li).textContent = '▸'; btn.setAttribute('aria-expanded', 'false'); return; }
        if (!x) return; body = D.createElement('div'); body.className = 'annbody'; setHTML(body, annoBodyHtml(x)); linkify(body); li.appendChild(body); bindAnnBody(body, x);
        li.classList.add('open'); A.annOpen[id] = 1; $('.aic', li).textContent = '▾'; btn.setAttribute('aria-expanded', 'true'); annFit();
      };
      var sk = $('[data-skip]', li); if (sk) sk.onclick = async function () { var x = annoById(id); if (!x) return; readForm(); await skipAnnoAt(x, m); renderDetail(m); };
    });
    /* punten in een lijstje afvinken of verbergen, zonder de vergaderpagina opnieuw op te bouwen */
    function bindAnnBody(body, x) { bindPoints(body, x, function () { setHTML(body, annoBodyHtml(x)); linkify(body); bindAnnBody(body, x); var li = body.closest('.annitem'), np = openPointCount(x), tg = li && li.querySelector('.annlink .atag'); if (tg && /punt/.test(tg.textContent)) { if (np) tg.textContent = np + ' punt' + (np === 1 ? '' : 'en'); else tg.remove(); } }); }
    $$('.annbody').forEach(function (b) { linkify(b); var x = annoById(b.closest('.annitem').dataset.annid); if (x) bindAnnBody(b, x); });
    var aul = $('.docs.annos'); if (aul) aul.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('.annbody a'); if (l && !/^#/.test(l.getAttribute('href') || '')) { e.preventDefault(); W.open(l.href, '_blank', 'noopener'); } });
    annFit();
    if (!A.annFitBound) { A.annFitBound = true; W.addEventListener('resize', function () { if ($('.annbody')) annFit(); }); }
    $$('[data-p]').forEach(function (c) { c.onclick = function (e) { e.stopPropagation(); }; c.onchange = function () { m.pending[+c.dataset.p].on = c.checked; }; });
    $$('#docs li[data-sel]').forEach(function (li) { li.onclick = function (e) { if (e.target.closest('button,input')) return; pvShow(m, +li.dataset.sel); }; });
    $$('[data-up],[data-down]').forEach(function (b) { b.onclick = async function () { var i = +(b.dataset.up || b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1; if (j < 0 || j >= m.files.length) return; readForm(); var t = m.files[i]; m.files[i] = m.files[j]; m.files[j] = t; if (A.sel && A.sel.i === i) A.sel.i = j; await persist(); renderDetail(m); }; });
    $$('[data-dl]').forEach(function (a) { a.onclick = async function () { var f = m.files[+a.dataset.dl]; dl(await A.store.get(m, f.name), f.name); }; });
    $$('[data-rm]').forEach(function (a) { a.onclick = async function () { var f = m.files[+a.dataset.rm]; if (!confirm('"' + f.name + '" verwijderen' + (annCount(f.ann) ? ', inclusief je aantekeningen' : '') + '?')) return; readForm(); await A.store.del(m, f.name); if (f.pdf && f.pdf !== f.name) await A.store.del(m, f.pdf); if (f.backup) await A.store.del(m, f.backup); m.files.splice(+a.dataset.rm, 1); await persist(); renderDetail(m); }; });
    var om = $('#origMail'); if (om) om.onclick = async function (e) { e.preventDefault(); dl(await A.store.get(m, m.source.file), m.source.file); };
    $$('[name]', frm).forEach(function (x) { x.addEventListener('input', function () { m[x.name] = x.value; }); });
    var nt = $('#npToggle'); if (nt) nt.onclick = toggleNotes;
    bindFolders($('#main'));
    var li = $('[name=link]', frm), jb = $('#joinBtn');
    function upd() { var v = li.value.trim(); var ok = /^https?:\/\//i.test(v); jb.hidden = !ok; if (ok) jb.href = v; }
    li.addEventListener('input', upd); li.addEventListener('change', async function () { readForm(); if (!isNew) { m.updated = new Date().toISOString(); await persist(); } });
    /* iBabs-link: de knoppen verschijnen zodra er een link staat; een gewijzigde link wordt meteen bewaard, net als de vergaderlink */
    var ib = $('[name=ibabs]', frm), ibB = $('#ibBtn'), ibS = $('#ibSide');
    function updIb() { var ok = /^https?:\/\//i.test(ib.value.trim()); ibB.hidden = !ok; if (ibS) ibS.hidden = !ok; }
    ib.addEventListener('input', updIb); ib.addEventListener('change', async function () { readForm(); if (!isNew) { m.updated = new Date().toISOString(); await persist(); } });
    ibB.onclick = function () { readForm(); openIbabs(m); };
    if (ibS) ibS.onclick = async function () { readForm(); if (A.flushNotes) { try { await A.flushNotes(); } catch (e) {} } sideBySide(m); };
    if (!isNew && m.link === undefined && m.source && m.source.file) {
      A.store.get(m, m.source.file).then(function (b) { return parseMailFile(b); }).then(async function (pm) { m.link = pm.r.link || ''; await persist(); if (m.link && currentMeeting() === m && !li.value) { li.value = m.link; upd(); toast('Vergaderlink gevonden in de originele mail.', 'ok'); } }).catch(function () { m.link = ''; });
    }
    if (A.notesOpen && !isNew) renderNotes(m);
    pvShow(m, sel);
  }
  function annCount(a) { if (!a) return 0; return Object.keys(a).reduce(function (n, k) { return n + (a[k] ? a[k].length : 0); }, 0); }

  /* ------------------------------------------------------------- map openen in Verkenner */
  function urlToWinPath(u) {
    var url = new URL(u), p = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    if (url.host) return '\\\\' + url.host + p.replace(/\//g, '\\');
    return p.replace(/^\/(?=[A-Za-z]:)/, '').replace(/\//g, '\\');
  }
  function baseCandidates(name) {
    if (location.protocol !== 'file:') return [];
    var href = location.href.split(/[?#]/)[0], dir = href.slice(0, href.lastIndexOf('/') + 1), enc = encodeURIComponent(name), out = [];
    function add(u) { if (out.indexOf(u) < 0) out.push(u); }
    var segs = dir.replace(/\/$/, '').split('/'), last = decodeURIComponent(segs[segs.length - 1] || '');
    if (last.toLowerCase() === name.toLowerCase()) add(dir);
    add(dir + enc + '/');
    var parent = segs.slice(0, -1).join('/') + '/'; if (parent.length > 8) add(parent + enc + '/');
    var hm = /^(file:\/\/[^\/]*\/(?:[A-Za-z]:\/)?(?:users|home)\/[^\/]+\/)/i.exec(dir);
    if (hm) { ['Desktop/', 'Bureaublad/', 'Documents/', 'Documenten/', 'Downloads/', ''].forEach(function (s) { add(hm[1] + s + enc + '/'); }); }
    var od = /^(.*?\/OneDrive[^\/]*\/)/i.exec(dir);
    if (od) { ['Desktop/', 'Bureaublad/', 'Documents/', 'Documenten/', ''].forEach(function (s) { add(od[1] + s + enc + '/'); }); }
    return out;
  }
  function probe(url, token) {
    return new Promise(function (res) {
      var sc = D.createElement('script'), ok = false, fin = false;
      function end(v) { if (fin) return; fin = true; sc.remove(); res(v); }
      W.__memeetMark = function (t) { if (t === token) { ok = true; end(true); } };
      sc.onload = function () { setTimeout(function () { end(ok); }, 30); }; sc.onerror = function () { end(false); };
      setTimeout(function () { end(ok); }, 2500);
      sc.src = url + 'memeet-locatie.js?' + token; D.head.appendChild(sc);
    });
  }
  async function findBase(token) {
    var c = baseCandidates(A.store.name);
    for (var i = 0; i < c.length; i++) { if (await probe(c[i], token)) return urlToWinPath(c[i]); }
    return null;
  }
  async function detectBase() {
    if (!A.store || A.store.kind !== 'map' || location.protocol !== 'file:') return null;
    var key = 'basePath:' + A.store.name, known = await kvGet(key).catch(function () { return null; });
    if (known) return known;
    if (A.detecting) return A.detecting;
    A.detecting = (async function () {
      var token = uid(), h;
      try { h = await A.store.root.getFileHandle('memeet-locatie.js', { create: true }); var w = await h.createWritable(); await w.write('window.__memeetMark&&window.__memeetMark(' + JSON.stringify(token) + ');'); await w.close(); } catch (e) { return null; }
      var found = await findBase(token);
      try { await A.store.root.removeEntry('memeet-locatie.js'); } catch (e) {}
      if (found) await kvSet(key, found);
      return found;
    })();
    var r = await A.detecting; A.detecting = null; return r;
  }
  async function basePath(ask) {
    var key = 'basePath:' + A.store.name, b = await kvGet(key).catch(function () { return null; });
    if (b && !ask) return b;
    if (!ask) { b = await detectBase(); if (b) return b; }
    var v = prompt('MeMeet kon de map "' + A.store.name + '" niet vanzelf vinden op je computer. Dat lukt wel als MeMeet.html in dezelfde map staat als de map "' + A.store.name + '", of erin.\n\nJe kunt het pad ook één keer plakken: open de map in Verkenner, klik op de adresbalk en kopieer het pad (Ctrl+C).', b || '');
    if (!v) return null;
    v = v.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
    if (!/^([a-zA-Z]:\\|\\\\)/.test(v)) { toast('Dat is geen geldig Windows-pad. Het moet beginnen met bijvoorbeeld C:\\', 'warn'); return null; }
    await kvSet(key, v); return v;
  }
  async function openInExplorer(rel, ask) {
    if (!A.store || A.store.kind !== 'map') return;
    var b = await basePath(ask); if (!b) return;
    var full = b + (rel ? '\\' + rel.replace(/\//g, '\\') : '');
    try { await navigator.clipboard.writeText(full); } catch (e) {}
    var a = D.createElement('a'); a.href = 'search-ms:displayname=' + encodeURIComponent((rel || A.store.name).split('/').pop()) + '&crumb=location:' + encodeURIComponent(full); D.body.appendChild(a); a.click(); a.remove();
    toast('Verkenner wordt geopend. Vraagt Edge om toestemming? Kies dan Openen. Lukt het niet, dan staat het pad op je klembord: Windows-toets + E, Ctrl+L, Ctrl+V. (Shift+klik om het pad te wijzigen.)');
  }
  function bindFolders(root) { $$('a.fold', root).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); openInExplorer(a.dataset.fold, e.shiftKey); }; }); }

  /* ------------------------------------------------------------- viewer met aantekeningen (pdf.js) */
  var PV = { tok: 0, tool: 'select', colors: { mark: '#ffd400' }, noteColor: '#e8590c', scale: 1, fit: true, q: '' };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var TOOLS = [['select', 'Tekst', 'Tekst selecteren en kopiëren', 'Aa'], ['mark', 'Markeren', 'Selecteer tekst; die wordt dan gemarkeerd', '🖍'], ['note', 'Opmerking', 'Klik op een woord om er een opmerking bij te zetten', '💬'], ['erase', 'Gum', 'Klik op een markering of opmerking om die te verwijderen', '⌫']];
  var COLORS = ['#ffd400', '#7ee081'];
  var MARGIN = 170;
  function isNote(s) { return s.t === 'note' || s.t === 'text'; }
  function hasNotes(ann) { return Object.keys(ann || {}).some(function (k) { return (ann[k] || []).some(isNote); }); }
  async function draftPdf(f) { if (f._pdf === undefined) { var r = await convertToPdf(f.name, f.type, f.blob); f._pdf = r ? new Blob([r.bytes], { type: 'application/pdf' }) : null; } return f._pdf; }
  function maxLabel() { return A.pvMax ? 'Verkleinen (Esc)' : 'Vergroten tot volledig venster'; }
  function maxBtn() { return '<button type="button" class="tl mx' + (A.pvMax ? ' on' : '') + '" data-act="max" title="' + maxLabel() + '" aria-label="' + maxLabel() + '"><span class="mxi"></span></button>'; }
  function pvMax(on) {
    var el = $('#pv'); A.pvMax = !!on; if (!el) return;
    el.classList.toggle('max', A.pvMax);
    var b = $('[data-act=max]', el); if (b) { b.classList.toggle('on', A.pvMax); b.title = maxLabel(); b.setAttribute('aria-label', maxLabel()); }
    requestAnimationFrame(function () { if (PV.fit && $('#pvp') && PV.pages) { layoutPages(); if (PV.q) doSearch(PV.q); } });
  }
  async function pvShow(m, i) {
    var el = $('#pv'); if (!el) return;
    el.classList.toggle('max', !!A.pvMax);
    var isNew = !!m.isNew, list = isNew ? (m.pending || []) : m.files, f = list[i];
    if (A.edCtl && A.edCtl.isDirty() && !confirm('Je hebt wijzigingen in het bestand die nog niet zijn opgeslagen. Weggooien?')) return;
    A.edCtl = null;
    if (!A.sel || A.sel.id !== m.id || A.sel.i !== i) { PV.mode = 'pdf'; PV.q = ''; }
    var tok = ++PV.tok;
    A.sel = { id: m.id, i: i };
    $$('#docs li[data-sel]').forEach(function (li) { li.classList.toggle('on', +li.dataset.sel === i); });
    if (PV.pdf) { try { PV.pdf.destroy(); } catch (e) {} PV.pdf = null; }
    if (PV.io) { PV.io.disconnect(); PV.io = null; }
    PV.pages = null; PV.hits = []; PV.hi = -1;
    if (!f) { setHTML(el, '<div class="pvmsg">Nog geen stukken.<br><small>Sleep documenten of een mail naar dit venster.</small></div>'); return; }
    var editable = !isNew;
    if (!editable && PV.tool !== 'select') PV.tool = 'select';
    var editMode = PV.mode === 'edit' && !isNew && canEdit(f);
    var tabs = !isNew && canEdit(f) ? '<div class="vtabs"><button type="button" data-mode="pdf" class="' + (editMode ? '' : 'on') + '">PDF</button><button type="button" data-mode="edit" class="' + (editMode ? 'on' : '') + '" title="Het originele bestand bewerken">Bewerken</button></div>' : '';
    if (editMode) {
      setHTML(el, '<div class="pvbar"><div class="pvt">' + tabs + '<b class="pvname" title="' + esc(f.name) + '">' + (i + 1) + '. ' + esc(f.name) + '</b></div><div class="pvtools"><button type="button" class="tl" data-act="prev" title="Vorig stuk"' + (i ? '' : ' disabled') + '>‹</button><button type="button" class="tl" data-act="next" title="Volgend stuk"' + (i < list.length - 1 ? '' : ' disabled') + '>›</button><button type="button" class="tl" data-act="orig" title="Origineel downloaden">⤓</button>' + maxBtn() + '</div></div><div class="edwrap" id="edw"></div>');
      $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { switchMode(m, i, b.dataset.mode); }; });
      $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); pvAct(b.dataset.act, m, i); }; });
      A.edCtl = await mountEditor(m, f, $('#edw'), function () { renderDocList(m); });
      return;
    }
    var hint = !editable ? 'Sla de vergadering eerst op. Daarna kun je markeren en opmerkingen maken.' : f.conv === 'omgezet' ? 'Automatisch omgezet naar PDF. De opmaak kan afwijken van het origineel.' : '';
    var hb = '<div class="pvbar one" title="' + esc((isNew ? '' : (i + 1) + '. ') + f.name) + '"><div class="pvtools">' + tabs + (hint ? '<span class="pvinfo' + (!editable ? ' warn' : '') + '" title="' + esc(hint) + '" aria-label="' + esc(hint) + '">i</span>' : '') + '<span class="pvst" id="pvst"></span>';
    TOOLS.forEach(function (t) { hb += '<button type="button" class="tl' + (PV.tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '" title="' + t[1] + ': ' + t[2] + '"' + (!editable && t[0] !== 'select' ? ' disabled' : '') + '><span class="tic">' + t[3] + '</span><span class="tlb">' + t[1] + '</span></button>'; });
    hb += '<span class="cols" id="pvcols">' + COLORS.map(function (c) { return '<button type="button" class="col" data-color="' + c + '" title="Kleur" style="--c:' + c + '"></button>'; }).join('') + '</span>';
    hb += '<button type="button" class="tl" data-act="undo" title="Ongedaan maken (Ctrl+Z)"' + (editable ? '' : ' disabled') + '>↶</button><button type="button" class="tl" data-act="redo" title="Opnieuw (Ctrl+Y)"' + (editable ? '' : ' disabled') + '>↷</button><span class="sep"></span>';
    hb += '<button type="button" class="tl" data-act="zout" title="Kleiner">−</button><button type="button" class="tl zl" data-act="fit" id="pvz" title="Passend maken">100%</button><button type="button" class="tl" data-act="zin" title="Groter">+</button><span class="sep"></span>';
    hb += '<button type="button" class="tl" data-act="prev" title="Vorig stuk"' + (i ? '' : ' disabled') + '>‹</button><button type="button" class="tl" data-act="next" title="Volgend stuk"' + (i < list.length - 1 ? '' : ' disabled') + '>›</button>';
    hb += maxBtn() + '<button type="button" class="tl" data-act="more" title="Meer">⋯</button><div class="pvmenu" id="pvmenu" hidden>' +
      (editable ? '<button type="button" data-act="dlann">PDF met aantekeningen downloaden</button><button type="button" data-act="clear">Alle aantekeningen in dit stuk wissen</button>' : '') +
      '<button type="button" data-act="orig">Origineel downloaden</button><button type="button" data-act="tab">PDF openen in nieuw tabblad</button></div><span class="sp"></span><span class="srch"><input id="pvq" type="search" placeholder="Zoeken in PDF (Ctrl+F)" value="' + esc(PV.q) + '"><span id="pvqc" class="qc"></span><button type="button" class="tl" data-act="qprev" title="Vorige (Shift+Enter)">‹</button><button type="button" class="tl" data-act="qnext" title="Volgende (Enter)">›</button></span></div></div>';
    hb += '<div class="pvpages" id="pvp"><div class="pvmsg">PDF wordt klaargemaakt…</div></div>';
    setHTML(el, hb);
    $$('[data-color]', el).forEach(function (b) { b.onclick = function () { if (PV.tool !== 'mark' && PV.tool !== 'note') setTool('mark'); PV.colors[PV.tool] = b.dataset.color; markColor(); }; });
    $$('button[data-tool]', el).forEach(function (b) { b.onclick = function () { setTool(b.dataset.tool); }; });
    $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { switchMode(m, i, b.dataset.mode); }; });
    $$('[data-act]', el).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); pvAct(b.dataset.act, m, i); }; });
    var qi = $('#pvq'), qt;
    qi.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { doSearch(qi.value); }, 250); });
    qi.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); if (PV.q !== qi.value) doSearch(qi.value); else gotoHit(PV.hi + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') { qi.value = ''; doSearch(''); } });
    markColor();
    var blob = null; try { blob = isNew ? await draftPdf(f) : await getPdf(m, f); } catch (e) { console.error(e); }
    if (tok !== PV.tok) return;
    var pvp = $('#pvp');
    if (!blob) { setHTML(pvp, '<div class="pvmsg">Dit bestand kan niet als PDF worden getoond.<br><small>Open het origineel in Word of Excel, sla het op als PDF en sleep die PDF op deze vergadering.</small><br><button type="button" class="btn" id="pvorig">Origineel downloaden</button></div>'); $('#pvorig').onclick = function () { pvAct('orig', m, i); }; return; }
    var data = new Uint8Array(await blob.arrayBuffer()), pdf;
    try { pdf = await W.pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise; }
    catch (e) { console.error(e); if (tok === PV.tok) setHTML(pvp, '<div class="pvmsg">Deze PDF kan niet worden getoond (' + esc(e.message || e) + ').<br><button type="button" class="btn" id="pvtab">Openen in nieuw tabblad</button></div>'); var pt = $('#pvtab'); if (pt) pt.onclick = function () { pvAct('tab', m, i); }; return; }
    if (tok !== PV.tok) { pdf.destroy(); return; }
    if (editable && !f.ann) f.ann = {};
    PV.pdf = pdf; PV.data = data; PV.m = m; PV.f = f; PV.ann = editable ? f.ann : {}; PV.editable = editable; PV.undo = []; PV.redo = []; PV.pages = [];
    for (var n = 1; n <= pdf.numPages; n++) { var pg = await pdf.getPage(n); if (tok !== PV.tok) return; PV.pages.push({ n: n, page: pg }); }
    bindPvp(pvp);
    layoutPages(); undoBtns();
    if (PV.q) doSearch(PV.q);
  }
  function switchMode(m, i, mode) {
    if (PV.mode === mode) return;
    if (mode === 'pdf' && A.edCtl && A.edCtl.isDirty() && !confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Weggooien?')) return;
    A.edCtl = null; PV.mode = mode; pvShow(m, i);
  }
  function renderDocList(m) { $$('#docs li[data-sel]').forEach(function (li) { var f = m.files[+li.dataset.sel]; var sz = $('.sz', li); if (f && sz) sz.textContent = kb(f.size || 0); }); }
  function markColor() { var c = PV.colors[PV.tool] || ''; $$('#pvcols .col').forEach(function (b) { b.classList.toggle('on', b.dataset.color === c); }); var cs = $('#pvcols'); if (cs) cs.classList.toggle('dim', !(PV.tool in PV.colors)); }
  function setTool(t) {
    var needLayout = PV.pages && t === 'note' && !PV.margin;
    PV.tool = t; $$('#pv button[data-tool]').forEach(function (b) { b.classList.toggle('on', b.dataset.tool === t); }); markColor();
    var box = $('#pvp'); if (box) box.dataset.t = t;
    if (needLayout) layoutPages();
  }

  /* ---------- pagina's opbouwen: canvas + tekstlaag + aantekeningen + marge */
  function layoutPages() {
    var box = $('#pvp'); if (!box || !PV.pages) return;
    var keep = box.scrollHeight ? box.scrollTop / box.scrollHeight : 0, keepX = box.scrollWidth > box.clientWidth ? (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth : -1, tok = PV.tok;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (PV.io) PV.io.disconnect();
    box.dataset.t = PV.tool;
    PV.margin = PV.editable && (hasNotes(PV.ann) || PV.tool === 'note');
    var M = PV.margin ? MARGIN : 0, maxW = Math.max.apply(null, PV.pages.map(function (p) { return p.page.getViewport({ scale: 1 }).width; }));
    if (PV.fit) PV.scale = Math.max(0.3, Math.min(3, (box.clientWidth - 36) / (maxW + M)));
    var z = $('#pvz'); if (z) z.textContent = Math.round(PV.scale * 100) + '%';
    PV.io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) renderPage(e.target._p); }); }, { root: box, rootMargin: '800px 0px' });
    PV.pages.forEach(function (p) {
      if (p.task) { try { p.task.cancel(); } catch (e) {} p.task = null; }
      p.vp = p.page.getViewport({ scale: PV.scale }); p.rendered = false; p.tl = null; p.tlp = null;
      var mw = M * PV.scale, W0 = p.vp.width, H0 = p.vp.height;
      var wrap = D.createElement('div'); wrap.className = 'pgw'; wrap.style.width = (W0 + mw) + 'px'; wrap.style.height = H0 + 'px'; wrap._p = p;
      var pg = D.createElement('div'); pg.className = 'pg'; pg.style.width = W0 + 'px'; pg.style.height = H0 + 'px';
      pg.style.setProperty('--scale-factor', PV.scale); pg.style.setProperty('--total-scale-factor', PV.scale); pg.style.setProperty('--scale-round-x', '1px'); pg.style.setProperty('--scale-round-y', '1px');
      var cv = D.createElement('canvas'); cv.style.width = W0 + 'px'; cv.style.height = H0 + 'px'; pg.appendChild(cv);
      var tl = D.createElement('div'); tl.className = 'textLayer'; pg.appendChild(tl);
      wrap.appendChild(pg);
      if (mw) { var mg = D.createElement('div'); mg.className = 'mrg'; mg.style.left = W0 + 'px'; mg.style.width = mw + 'px'; wrap.appendChild(mg); p.mrg = mg; } else p.mrg = null;
      var svg = D.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + (W0 + mw) + ' ' + H0); svg.setAttribute('class', 'anl'); svg.style.width = (W0 + mw) + 'px'; svg.style.height = H0 + 'px';
      wrap.appendChild(svg);
      var lbl = D.createElement('div'); lbl.className = 'pgn'; lbl.style.left = (W0 - 40) + 'px'; lbl.textContent = p.n + ' / ' + PV.pages.length; wrap.appendChild(lbl);
      p.wrap = wrap; p.el = pg; p.cv = cv; p.svg = svg; p.tlDiv = tl; box.appendChild(wrap); PV.io.observe(wrap);
      if (PV.editable) bindPage(p);
    });
    box.scrollTop = keep * box.scrollHeight;
    box.scrollLeft = keepX < 0 ? (box.scrollWidth - box.clientWidth) / 2 : keepX * box.scrollWidth - box.clientWidth / 2;
    PV.pages.forEach(function (p) { drawAnn(p); });
    (async function () { for (var k = 0; k < PV.pages.length; k++) { if (tok !== PV.tok || !PV.pages) return; await ensureText(PV.pages[k]); } })();
  }
  function renderPage(p) {
    if (p.rendered) return; p.rendered = true;
    var dpr = Math.min(2, W.devicePixelRatio || 1);
    p.cv.width = Math.floor(p.vp.width * dpr); p.cv.height = Math.floor(p.vp.height * dpr);
    p.task = p.page.render({ canvasContext: p.cv.getContext('2d'), canvas: p.cv, viewport: p.vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
    p.task.promise.catch(function () {});
  }
  function ensureText(p) {
    if (p.tlp) return p.tlp;
    var vp = p.vp, div = p.tlDiv;
    p.tlp = (async function () {
      var tc = p.tc || (p.tc = await p.page.getTextContent());
      if (p.vp !== vp) return;
      var tl = new W.pdfjsLib.TextLayer({ textContentSource: tc, container: div, viewport: vp });
      await tl.render();
      if (p.vp !== vp) return;
      p.tl = tl; p.strs = tl.textContentItemsStr.slice(); p.divs = tl.textDivs;
      applyHits(p);
    })().catch(function (e) { console.error(e); });
    return p.tlp;
  }

  /* ---------- zoeken */
  function normS(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s[i], n = c.normalize('NFD')[0].toLowerCase(); o += n.length === 1 ? n : c; } return o; }
  async function doSearch(q) {
    PV.q = q; PV.hits = []; PV.hi = -1;
    var cnt = $('#pvqc'); if (!PV.pages) return;
    var nq = normS(q.trim());
    if (!nq) { PV.pages.forEach(applyHits); if (cnt) cnt.textContent = ''; return; }
    if (cnt) cnt.textContent = '…';
    var tok = PV.tok;
    for (var k = 0; k < PV.pages.length; k++) await ensureText(PV.pages[k]);
    if (tok !== PV.tok || PV.q !== q) return;
    PV.pages.forEach(function (p) {
      if (!p.strs) return;
      var full = '', st = [];
      p.strs.forEach(function (s) { st.push(full.length); full += s; });
      p.starts = st;
      var hay = normS(full), at = 0, ix;
      while ((ix = hay.indexOf(nq, at)) >= 0) { PV.hits.push({ p: p, s: ix, e: ix + nq.length }); at = ix + nq.length; }
    });
    PV.pages.forEach(applyHits);
    if (cnt) cnt.textContent = PV.hits.length ? '' : 'geen';
    if (PV.hits.length) gotoHit(0);
  }
  function applyHits(p) {
    if (!p.divs) return;
    p.divs.forEach(function (d, k) { if (d._hl) { d.textContent = p.strs[k]; d._hl = false; } });
    var hits = (PV.hits || []).map(function (h, idx) { return { h: h, idx: idx }; }).filter(function (x) { return x.h.p === p; });
    if (!hits.length || !p.starts) return;
    var per = {};
    hits.forEach(function (x) {
      for (var k = 0; k < p.strs.length; k++) {
        var a = p.starts[k], b = a + p.strs[k].length;
        if (b <= x.h.s || a >= x.h.e) continue;
        (per[k] = per[k] || []).push([Math.max(0, x.h.s - a), Math.min(b, x.h.e) - a, x.idx]);
      }
    });
    Object.keys(per).forEach(function (k) {
      var d = p.divs[+k], s = p.strs[+k], pos = 0; if (!d) return;
      d.textContent = ''; d._hl = true;
      per[k].sort(function (u, v) { return u[0] - v[0]; }).forEach(function (seg) {
        if (seg[0] > pos) d.appendChild(D.createTextNode(s.slice(pos, seg[0])));
        var sp = D.createElement('span'); sp.className = 'hit' + (seg[2] === PV.hi ? ' cur' : ''); sp.dataset.h = seg[2]; sp.textContent = s.slice(seg[0], seg[1]); d.appendChild(sp); pos = seg[1];
      });
      if (pos < s.length) d.appendChild(D.createTextNode(s.slice(pos)));
    });
  }
  function gotoHit(i) {
    var n = PV.hits.length, cnt = $('#pvqc'); if (!n) return;
    PV.hi = ((i % n) + n) % n;
    $$('#pvp .hit.cur').forEach(function (e) { e.classList.remove('cur'); });
    var els = $$('#pvp .hit[data-h="' + PV.hi + '"]');
    els.forEach(function (e) { e.classList.add('cur'); });
    if (cnt) cnt.textContent = (PV.hi + 1) + '/' + n;
    var h = PV.hits[PV.hi]; renderPage(h.p);
    if (els[0]) els[0].scrollIntoView({ block: 'center', inline: 'nearest' }); else h.p.wrap.scrollIntoView({ block: 'start' });
  }

  /* ---------- aantekeningen tekenen */
  function toVp(p, x, y) { return p.vp.convertToViewportPoint(x, y); }
  function shapeEl(p, s, i) {
    var g = D.createElementNS(SVGNS, 'g'); g.setAttribute('data-i', i);
    if (s.t === 'mark') {
      s.rects.forEach(function (r) {
        var a = toVp(p, r[0], r[1]), b = toVp(p, r[2], r[3]), rc = D.createElementNS(SVGNS, 'rect');
        rc.setAttribute('x', Math.min(a[0], b[0])); rc.setAttribute('y', Math.min(a[1], b[1])); rc.setAttribute('width', Math.abs(b[0] - a[0])); rc.setAttribute('height', Math.abs(b[1] - a[1]));
        rc.setAttribute('fill', s.c); rc.setAttribute('class', 'mk'); g.appendChild(rc);
      });
    } else if (s.t === 'pen' || s.t === 'hl') {
      var d = s.pts.map(function (q, k) { var v = toVp(p, q[0], q[1]); return (k ? 'L' : 'M') + v[0].toFixed(1) + ' ' + v[1].toFixed(1); }).join(' ');
      if (s.pts.length === 1) d += ' l0.1 0';
      var hit = D.createElementNS(SVGNS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hitp'); hit.setAttribute('stroke-width', Math.max(12, s.w * PV.scale)); g.appendChild(hit);
      var path = D.createElementNS(SVGNS, 'path'); path.setAttribute('d', d); path.setAttribute('stroke', s.c); path.setAttribute('stroke-width', s.w * PV.scale); path.setAttribute('class', s.t === 'hl' ? 'hl' : 'pen'); g.appendChild(path);
    }
    return g;
  }
  function drawAnn(p) {
    var svg = p.svg; while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (p.mrg) p.mrg.textContent = '';
    var notes = [];
    (PV.ann[p.n] || []).forEach(function (s, i) { if (isNote(s)) notes.push({ s: s, i: i }); else svg.appendChild(shapeEl(p, s, i)); });
    if (!notes.length || !p.mrg) return;
    var fs = 9 * PV.scale, W0 = p.vp.width;
    notes.forEach(function (n) {
      var v = toVp(p, n.s.x, n.s.y); n.ax = v[0]; n.ay = v[1];
      if (n.s.w) { var w1 = toVp(p, n.s.w[0], n.s.w[1]), w2 = toVp(p, n.s.w[2], n.s.w[3]); n.wx1 = Math.min(w1[0], w2[0]); n.wx2 = Math.max(w1[0], w2[0]); n.wy = Math.max(w1[1], w2[1]) + 1; n.ay = n.wy; n.ax = n.wx2; }
      var bx = D.createElement('div'); bx.className = 'nbox'; bx.style.fontSize = fs + 'px'; bx.style.borderLeftColor = n.s.c || PV.noteColor; bx.dataset.i = n.i;
      var tx = D.createElement('div'); tx.className = 'ntx'; tx.textContent = n.s.txt; bx.appendChild(tx);
      if (PV.editable) { var x = D.createElement('button'); x.type = 'button'; x.className = 'nx'; x.title = 'Opmerking verwijderen'; x.textContent = '×'; bx.appendChild(x); x.onclick = function (e) { e.stopPropagation(); commit(p, function (arr) { arr.splice(n.i, 1); }); }; }
      bx.addEventListener('click', function () { if (!PV.editable) return; if (PV.tool === 'erase') { commit(p, function (arr) { arr.splice(n.i, 1); }); return; } noteEditor(p, n.i, null); });
      bx.addEventListener('mouseenter', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.add('on'); });
      bx.addEventListener('mouseleave', function () { var l = svg.querySelector('[data-n="' + n.i + '"]'); if (l) l.classList.remove('on'); });
      p.mrg.appendChild(bx); n.el = bx;
    });
    notes.sort(function (a, b) { return a.ay - b.ay; });
    var prev = 4;
    notes.forEach(function (n) {
      var top = Math.max(n.ay - 9 * PV.scale, prev); n.el.style.top = top + 'px'; prev = top + n.el.offsetHeight + 6;
      var y = top + 8 * PV.scale, x0 = W0 + 10, gx = W0 + 5, col = n.s.c || PV.noteColor, path = D.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + x0 + ' ' + y + ' L' + gx + ' ' + y + ' L' + gx + ' ' + n.ay + ' L' + (n.ax + 2) + ' ' + n.ay);
      if (n.wx1 != null) { var ul = D.createElementNS(SVGNS, 'path'); ul.setAttribute('d', 'M' + n.wx1 + ' ' + n.wy + ' L' + n.wx2 + ' ' + n.wy); ul.setAttribute('class', 'uline'); ul.setAttribute('stroke', col); svg.appendChild(ul); }
      path.setAttribute('class', 'conn'); path.setAttribute('stroke', n.s.c || PV.noteColor); path.setAttribute('data-n', n.i);
      svg.appendChild(path);
      var ang = Math.PI, L = 6, wA = 0.5, ah = D.createElementNS(SVGNS, 'path');
      ah.setAttribute('d', 'M' + n.ax + ' ' + n.ay + ' L' + (n.ax - L * Math.cos(ang - wA)) + ' ' + (n.ay - L * Math.sin(ang - wA)) + ' L' + (n.ax - L * Math.cos(ang + wA)) + ' ' + (n.ay - L * Math.sin(ang + wA)) + ' Z');
      ah.setAttribute('fill', n.s.c || PV.noteColor); ah.setAttribute('class', 'arrow'); svg.appendChild(ah);
    });
  }
  function snapshot() { PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); PV.redo = []; undoBtns(); }
  function undoBtns() { var u = $('#pv [data-act=undo]'), r = $('#pv [data-act=redo]'); if (u) u.disabled = !PV.editable || !(PV.undo && PV.undo.length); if (r) r.disabled = !PV.editable || !(PV.redo && PV.redo.length); }
  function restoreAnn(st) { var prev = JSON.parse(st); Object.keys(PV.ann).forEach(function (k) { delete PV.ann[k]; }); Object.keys(prev).forEach(function (k) { PV.ann[k] = prev[k]; }); layoutPages(); changed(); undoBtns(); }
  function changed() {
    var st = $('#pvst'); if (st) st.textContent = 'opslaan…';
    clearTimeout(PV.saveT);
    var m = PV.m;
    PV.saveT = setTimeout(async function () {
      try { m.updated = new Date().toISOString(); await persist(); var s2 = $('#pvst'); if (s2) s2.textContent = 'opgeslagen ✓'; refreshAnnBadge(); }
      catch (e) { toast('Aantekeningen opslaan mislukt: ' + (e.message || e), 'err'); }
    }, 600);
  }
  function refreshAnnBadge() {
    if (!A.sel) return; var li = $('#docs li[data-sel="' + A.sel.i + '"] .dl2'); if (!li) return;
    var b = $('.bdg.ann', li), n = annCount(PV.ann);
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = D.createElement('span'); b.className = 'bdg ann'; b.title = 'Aantekeningen'; li.insertBefore(b, $('.sp', li)); }
    b.textContent = '✎ ' + n;
  }
  function commit(p, fn) {
    snapshot(); var arr = PV.ann[p.n] || (PV.ann[p.n] = []); fn(arr); if (!arr.length) delete PV.ann[p.n];
    var needM = PV.editable && (hasNotes(PV.ann) || PV.tool === 'note');
    if (needM !== !!PV.margin) layoutPages(); else drawAnn(p);
    changed();
  }

  /* ---------- interactie: markeren (uit selectie), opmerkingen, gum */
  function bindPvp(box) {
    box.addEventListener('mouseup', function () {
      if (PV.tool !== 'mark' || !PV.editable) return;
      setTimeout(function () {
        var sel = W.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        var rg = sel.getRangeAt(0), rects = Array.prototype.slice.call(rg.getClientRects()), made = false;
        PV.pages.forEach(function (p) {
          if (!p.tl) return;
          var pr = p.el.getBoundingClientRect(), list = [];
          rects.forEach(function (r) {
            if (r.width < 1 || r.height < 1 || r.height > pr.height * 0.12) return;
            if (r.right < pr.left || r.left > pr.right || r.bottom < pr.top || r.top > pr.bottom) return;
            var a = p.vp.convertToPdfPoint(r.left - pr.left, r.top - pr.top), b = p.vp.convertToPdfPoint(r.right - pr.left, r.bottom - pr.top);
            list.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
          });
          if (!list.length) return;
          list.sort(function (u, v) { return v[1] - u[1] || u[0] - v[0]; });
          var merged = [];
          list.forEach(function (r) { var l = merged[merged.length - 1]; if (l && Math.abs(l[1] - r[1]) < 2 && Math.abs(l[3] - r[3]) < 2 && r[0] <= l[2] + 2) { l[2] = Math.max(l[2], r[2]); l[0] = Math.min(l[0], r[0]); } else merged.push(r.slice()); });
          merged = merged.map(function (r) { return r.map(function (v) { return Math.round(v * 10) / 10; }); });
          commit(p, function (arr) { arr.push({ t: 'mark', c: PV.colors.mark, rects: merged }); }); made = true;
        });
        if (made) sel.removeAllRanges();
      }, 0);
    });
  }
  function bindPage(p) {
    p.el.addEventListener('click', function (e) {
      if (PV.tool !== 'note' || e.button > 0) return;
      var sel = W.getSelection(); if (sel && !sel.isCollapsed) return;
      var r = p.el.getBoundingClientRect(), q = p.vp.convertToPdfPoint(e.clientX - r.left, e.clientY - r.top), wr = null;
      try {
        var cr = D.caretRangeFromPoint ? D.caretRangeFromPoint(e.clientX, e.clientY) : null, nd = cr && cr.startContainer;
        if (nd && nd.nodeType === 3 && p.tlDiv.contains(nd)) {
          var t = nd.nodeValue, a = cr.startOffset, b = a;
          while (a > 0 && /\S/.test(t[a - 1])) a--; while (b < t.length && /\S/.test(t[b])) b++;
          if (b > a) { var wrg = D.createRange(); wrg.setStart(nd, a); wrg.setEnd(nd, b); var bb = wrg.getBoundingClientRect();
            if (bb.width > 0 && bb.height < r.height * 0.1) { var c1 = p.vp.convertToPdfPoint(bb.left - r.left, bb.top - r.top), c2 = p.vp.convertToPdfPoint(bb.right - r.left, bb.bottom - r.top); wr = [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])].map(function (v) { return Math.round(v * 10) / 10; }); } }
        }
      } catch (er) {}
      var at = wr ? [wr[2], wr[1]] : [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];
      noteEditor(p, -1, at, wr);
    });
    p.svg.addEventListener('click', function (e) {
      if (PV.tool !== 'erase') return;
      var g = e.target.closest && e.target.closest('g[data-i]'); if (g) commit(p, function (arr) { arr.splice(+g.getAttribute('data-i'), 1); });
    });
  }
  function noteEditor(p, idx, at, wr) {
    if (!p.mrg) { layoutPages(); p = PV.pages[p.n - 1]; if (!p.mrg) return; }
    var old = idx >= 0 ? PV.ann[p.n][idx] : null, anchor = old ? toVp(p, old.x, old.y) : toVp(p, at[0], at[1]);
    var ta = D.createElement('textarea'); ta.className = 'nedit'; ta.value = old ? old.txt : ''; ta.placeholder = 'Typ je opmerking… (Ctrl+Enter = klaar)';
    ta.style.fontSize = 9 * PV.scale + 'px'; ta.style.top = Math.max(4, anchor[1] - 9 * PV.scale) + 'px'; ta.style.borderLeftColor = old ? old.c : PV.noteColor;
    if (old) { var bx = p.mrg.querySelector('.nbox[data-i="' + idx + '"]'); if (bx) { ta.style.top = bx.style.top; bx.style.visibility = 'hidden'; } }
    p.mrg.appendChild(ta);
    var tmp = null;
    if (!old) { tmp = D.createElementNS(SVGNS, 'circle'); tmp.setAttribute('cx', anchor[0]); tmp.setAttribute('cy', anchor[1]); tmp.setAttribute('r', 3); tmp.setAttribute('fill', PV.noteColor); p.svg.appendChild(tmp); }
    ta.focus();
    var done = false;
    function finish(save) {
      if (done) return; done = true; var txt = ta.value.replace(/\s+$/, ''); ta.remove(); if (tmp) tmp.remove();
      if (!save) { drawAnn(p); return; }
      if (old) commit(p, function (arr) { if (txt) { var o = { t: 'note', c: old.c || PV.noteColor, x: old.x, y: old.y, txt: txt }; if (old.w) o.w = old.w; arr[idx] = o; } else arr.splice(idx, 1); });
      else if (txt) commit(p, function (arr) { var o = { t: 'note', c: PV.noteColor, x: at[0], y: at[1], txt: txt }; if (wr) o.w = wr; arr.push(o); });
    }
    ta.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') finish(false); else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true); });
    ta.addEventListener('blur', function () { finish(true); });
    ta.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  async function pvAct(a, m, i) {
    var list = m.isNew ? m.pending : m.files, f = list[i], menu = $('#pvmenu');
    if (a === 'more') { if (menu) { menu.hidden = !menu.hidden; var mb = $('[data-act=more]'), mr = mb && mb.getBoundingClientRect(); if (mr && !menu.hidden) { menu.style.position = 'fixed'; menu.style.top = (mr.bottom + 4) + 'px'; menu.style.right = 'auto'; menu.style.left = Math.max(8, Math.min(W.innerWidth - 280, mr.right - 260)) + 'px'; } } return; }
    if (menu) menu.hidden = true;
    if (a === 'max') return pvMax(!A.pvMax);
    if (a === 'prev' && i > 0) return pvShow(m, i - 1);
    if (a === 'next' && i < list.length - 1) return pvShow(m, i + 1);
    if (a === 'qnext' || a === 'qprev') { var qi = $('#pvq'); if (qi && qi.value !== PV.q) return doSearch(qi.value); return gotoHit(PV.hi + (a === 'qnext' ? 1 : -1)); }
    if (a === 'zin' || a === 'zout') { PV.fit = false; PV.scale = Math.max(0.3, Math.min(4, PV.scale * (a === 'zin' ? 1.2 : 1 / 1.2))); layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'fit') { PV.fit = true; layoutPages(); if (PV.q) doSearch(PV.q); return; }
    if (a === 'undo') { if (!PV.undo || !PV.undo.length) return; (PV.redo = PV.redo || []).push(JSON.stringify(PV.ann)); if (PV.redo.length > 20) PV.redo.shift(); restoreAnn(PV.undo.pop()); return; }
    if (a === 'redo') { if (!PV.redo || !PV.redo.length) return; PV.undo.push(JSON.stringify(PV.ann)); if (PV.undo.length > 20) PV.undo.shift(); restoreAnn(PV.redo.pop()); return; }
    if (a === 'clear') { if (!annCount(PV.ann) || !confirm('Alle markeringen en opmerkingen in "' + f.name + '" wissen?')) return; snapshot(); Object.keys(PV.ann).forEach(function (k) { delete PV.ann[k]; }); layoutPages(); changed(); return; }
    if (a === 'orig') { dl(m.isNew ? f.blob : await A.store.get(m, f.name), f.name); return; }
    if (a === 'tab') { if (!PV.data) return; var u = URL.createObjectURL(new Blob([PV.data], { type: 'application/pdf' })); W.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 120000); return; }
    if (a === 'dlann') { if (!PV.data) return; try { var out = await burnAnnotations(PV.data, PV.ann); dl(new Blob([out], { type: 'application/pdf' }), safe(f.name.replace(/\.[^.]*$/, '')) + (annCount(PV.ann) ? ' (met aantekeningen)' : '') + '.pdf'); } catch (e) { toast('Downloaden mislukt: ' + (e.message || e), 'err'); } }
  }
  function initPv() {
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && A.pvMax && $('#pv') && !e.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') && !e.target.isContentEditable) { e.preventDefault(); pvMax(false); return; }
      if (!$('#pv') || !PV.pages) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { var qi = $('#pvq'); if (qi) { e.preventDefault(); qi.focus(); qi.select(); } return; }
      if (!PV.editable || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable) return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ((k === 'z' && e.shiftKey) || k === 'y')) { e.preventDefault(); pvAct('redo', PV.m, A.sel ? A.sel.i : 0); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); pvAct('undo', PV.m, A.sel ? A.sel.i : 0); }
    });
    D.addEventListener('click', function (e) { var mn = $('#pvmenu'); if (mn && !mn.hidden && !e.target.closest('#pvmenu')) mn.hidden = true; });
    var rt; W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (PV.fit && $('#pvp') && PV.pages) { layoutPages(); if (PV.q) doSearch(PV.q); } }, 200); });
  }
  /* ------------------------------------------------------------- export */
  function exportName(m) { return safe((m.title || 'Vergadering') + ' - ' + (m.date ? fmtShort(m.date) : 'zonder datum') + (m.start ? ' ' + m.start.replace(':', '.') + (m.end ? '-' + m.end.replace(':', '.') : '') : '')).slice(0, 150) + '.pdf'; }
  async function exportMeeting(m) {
    var btn = $('#exp'); if (btn) btn.disabled = true;
    try {
      var items = [];
      for (var i = 0; i < m.files.length; i++) {
        toast('Stuk ' + (i + 1) + ' van ' + m.files.length + ' klaarmaken…');
        var f = m.files[i], b = await getPdf(m, f).catch(function () { return null; });
        items.push({ f: f, how: f.conv, ann: f.ann, bytes: b ? new Uint8Array(await b.arrayBuffer()) : null });
      }
      toast('PDF samenvoegen…');
      var bytes = await mergeMeeting(m, items), name = exportName(m), blob = new Blob([bytes], { type: 'application/pdf' });
      dl(blob, name);
      var where = 'in je map Downloads';
      if (A.store.kind === 'map') { try { await A.store.put(m, name, blob); where += ' en in de map van de vergadering'; } catch (e) {} }
      var missing = items.filter(function (x) { return !x.bytes || !x.pages; }).length;
      toast('"' + name + '" staat ' + where + '.' + (missing ? ' ' + missing + ' stuk(ken) konden niet worden opgenomen.' : ''), missing ? 'warn' : 'ok');
    } catch (e) { console.error(e); toast('Exporteren mislukt: ' + (e.message || e), 'err'); }
    finally { if (btn) btn.disabled = false; }
  }
  function openBlob(b, name, type) {
    var blob = type && b.type !== type ? new Blob([b], { type: type }) : b;
    if (/\.(pdf|png|jpe?g|gif|txt)$/i.test(name)) { var u = URL.createObjectURL(blob); W.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); }
    else dl(blob, name);
  }
  /* Downloaden. Begint een download pas na rekenwerk (PDF maken, mail opbouwen), dan ziet de browser hem als automatische download en
     kan hij hem stil blokkeren. Daarom staat er rechtsonder steeds een balkje met "Opnieuw downloaden": die klik komt van jou en wordt niet geblokkeerd. */
  function dlFire(u, name) { var a = D.createElement('a'); a.href = u; a.download = name; D.body.appendChild(a); a.click(); a.remove(); }
  function dl(b, name) {
    var u = URL.createObjectURL(b); dlFire(u, name);
    var old = $('#dlbar'); if (old) { clearTimeout(old._t); old._close(); }
    var bar = D.createElement('div'); bar.id = 'dlbar'; bar.setAttribute('role', 'status');
    var tx = D.createElement('div'); tx.className = 'dlt';
    var nm = D.createElement('b'); nm.textContent = '⤓ ' + name; var sub = D.createElement('span'); sub.textContent = 'Staat het niet in je Downloads?';
    tx.appendChild(nm); tx.appendChild(sub);
    var again = D.createElement('button'); again.type = 'button'; again.className = 'btn sm'; again.textContent = 'Opnieuw downloaden';
    var x = D.createElement('button'); x.type = 'button'; x.className = 'dlx'; x.title = 'Sluiten'; x.textContent = '✕';
    bar.appendChild(tx); bar.appendChild(again); bar.appendChild(x); D.body.appendChild(bar);
    bar._close = function () { if (bar.parentNode) bar.parentNode.removeChild(bar); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); };
    again.onclick = function () { dlFire(u, name); clearTimeout(bar._t); bar._t = setTimeout(bar._close, 25000); };
    x.onclick = function () { clearTimeout(bar._t); bar._close(); };
    bar._t = setTimeout(bar._close, 25000);
  }

  /* ------------------------------------------------------------- start */
  function initDrop() {
    var ov = $('#overlay'), depth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    D.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; var c = currentMeeting(); $('#ovText').textContent = c ? 'Laat los om toe te voegen aan "' + (c.title || 'deze vergadering') + '"' : 'Laat los om een vergadering aan te maken'; ov.className = 'on'; });
    D.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    D.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; ov.className = ''; } });
    D.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return; e.preventDefault(); depth = 0; ov.className = '';
      if (!e.dataTransfer.files.length) { toast('Er kwam geen bestand mee. Sleep de mail eerst naar je bureaublad en daarna hierheen.', 'warn'); return; }
      var c = currentMeeting(); if (c) { var frm = $('#frm'); if (frm) $$('[name]', frm).forEach(function (x) { c[x.name] = x.value; }); }
      handleDrop(e.dataTransfer.files);
    });
    $('#pickMail').onchange = function () { var f = this.files; if (f.length) handleDrop(f); this.value = ''; };
    $('#pickDocs').onchange = function () { var f = this.files; if (f.length) handleDrop(f); this.value = ''; };
  }
  migrateLocalPrefs();
  try { A.notesOpen = localStorage.getItem('memeet-notes') === '1'; } catch (e) {}
  W.addEventListener('hashchange', function () { if (A.flushNotes) { try { A.flushNotes(); } catch (e) {} A.flushNotes = null; } });
  W.addEventListener('beforeunload', function (e) { if (A.npWin && !A.npWin.closed) { try { A.npWin.close(); } catch (er) {} } if (A.flushNotes) A.flushNotes(); if (A.edCtl && A.edCtl.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  async function start() {
    initHelp();
    initDrop(); initPv();
    W.addEventListener('hashchange', route);
    var mode = await kvGet('mode').catch(function () { return null; });
    if (mode === 'browser') return useStore(new BrowserStore());
    if (mode === 'map') {
      var h = await kvGet('dir').catch(function () { return null; });
      if (h) {
        A.hadDir = true;
        try { if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return useStore(new FolderStore(h)); } catch (e) {}
        route();
        setHTML($('#main'), '<div class="card welcome"><h1>Welkom terug</h1><p>Edge vraagt om opnieuw toegang te geven tot de map <b>' + esc(h.name) + '</b>.</p><button class="btn pri" id="recon">Map openen</button> <button class="btn" id="other">Andere map kiezen</button></div>');
        $('#recon').onclick = reconnect; $('#other').onclick = chooseFolder;
        return;
      }
    }
    route();
  }
  start().catch(function (e) { setHTML($('#main'), '<div class="card welcome"><h1>Er ging iets mis bij het starten</h1><p>' + esc(e.message || e) + '</p><button class="btn" id="useIdb">In de browser bewaren</button></div>'); $('#useIdb').onclick = function () { useStore(new BrowserStore()); }; });
  if (W.__VA_TEST) W.__va = { htmlPathWin: htmlPathWin, findBase: findBase, baseCandidates: baseCandidates, detectBase: detectBase, kvSet: kvSet, findLink: findLink, convertToPdf: convertToPdf, mergeMeeting: mergeMeeting, A: A, useStore: useStore, FolderStore: FolderStore, BrowserStore: BrowserStore, handleDrop: handleDrop };
