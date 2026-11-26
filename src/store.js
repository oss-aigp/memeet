  /* MeMeet - store: waar MeMeet zijn gegevens bewaart */
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
    /* mails op de actielijst staan in Actielijst › Mails, elk in een eigen map */
    this.mailsDir = async function () { return (await root.getDirectoryHandle(ACTS_DIR, { create: true })).getDirectoryHandle('Mails', { create: true }); };
    this.dir = async function (m) { return (m.sub === 'act' ? await this.mailsDir() : await this.meetingsDir()).getDirectoryHandle(m.folder, { create: true }); };
    this.put = async function (m, name, blob) { await writeFile(await this.dir(m), name, blob); };
    this.get = async function (m, name) { return (await (await this.dir(m)).getFileHandle(name)).getFile(); };
    this.del = async function (m, name) { try { await (await this.dir(m)).removeEntry(name); } catch (e) {} };
    this.delMeeting = async function (m) { if (!m.folder) return; try { await (m.sub === 'act' ? await this.mailsDir() : await this.meetingsDir()).removeEntry(m.folder, { recursive: true }); } catch (e) { if (e.name !== 'NotFoundError') throw e; } };
  }
  function BrowserStore() {
    this.kind = 'browser'; this.name = 'deze browser';
    this.load = function () { return kvGet('data'); };
    this.save = function (data) { return kvSet('data', data); };
    this.put = function (m, name, blob) { return tx('files', 'readwrite', function (s) { return s.put(blob, m.id + '/' + name); }); };
    this.get = function (m, name) { return tx('files', 'readonly', function (s) { return s.get(m.id + '/' + name); }).then(function (b) { if (!b) throw new Error('Bestand niet gevonden'); return b; }); };
    this.del = function (m, name) { return tx('files', 'readwrite', function (s) { return s.delete(m.id + '/' + name); }); };
    this.delMeeting = function (m) { var self = this; return Promise.all(m.files.reduce(function (a, f) { a.push(self.del(m, f.name)); if (f.pdf && f.pdf !== f.name) a.push(self.del(m, f.pdf)); olderOf(f).forEach(function (n) { a.push(self.del(m, n)); }); return a; }, []).concat(m.source && m.source.file ? [self.del(m, m.source.file)] : [])); };
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
    if (migrateAnnotations()) await st.save(A.data); /* aparte annotaties van versie 1.5 worden tekst in de aantekeningen */
    if (st.kind === 'map') await migrateLayout(st);
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
