  /* ================================================================== tabblad Bestanden (alleen lezen) */
  var FX = { folder: '', q: '', f: {}, sort: { k: 'date', d: -1 }, sel: {}, items: null, loading: false, group: true, showHidden: false };
  function fxHidden() { return A.data.fxHidden || (A.data.fxHidden = {}); } /* uit het overzicht verwijderd; het bestand zelf blijft in de vergadering */
  var TOPS = ['Vergaderingen']; /* aantekeningen, actielijst en originele mails staan niet in dit overzicht */
  function extOf(n) { var m = /\.([^.]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; }
  function fmtDT(t) { if (!t) return ''; var d = new Date(t); return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function classify(m, name) {
    if (!m) return 'Overig';
    var low = name.toLowerCase();
    for (var i = 0; i < m.files.length; i++) {
      var f = m.files[i];
      if (f.name.toLowerCase() === low) return 'Stuk';
      if (f.pdf && f.pdf !== f.name && f.pdf.toLowerCase() === low) return 'PDF-versie';
      if (f.backup && f.backup.toLowerCase() === low) return 'Vorige versie';
    }
    if (m.source && m.source.file && m.source.file.toLowerCase() === low) return 'Originele mail';
    if (/\.pdf$/i.test(name) && low === exportName(m).toLowerCase()) return 'Export';
    return 'Overig';
  }
  async function collectFiles() {
    var out = [];
    if (A.store.kind === 'map') {
      var byFolder = {}; A.data.meetings.forEach(function (m) { if (m.folder) byFolder[m.folder] = m; });
      var notesBy = {}; A.data.meetings.forEach(function (m) { if (m.minutesFile) notesBy[m.minutesFile] = m; });
      async function walk(dir, top, rel, m) {
        for await (var e of dir.values()) {
          if (e.kind === 'directory') { await walk(e, top, rel ? rel + '/' + e.name : e.name, top === 'Vergaderingen' && !rel ? byFolder[e.name] : m); continue; }
          if (/\.tmp$/i.test(e.name) || e.name === 'memeet-locatie.js') continue;
          var file = await e.getFile(), mm = m || (top === 'Aantekeningen' ? notesBy[e.name] : null);
          out.push({ id: top + '/' + (rel ? rel + '/' : '') + e.name, name: e.name, top: top, sub: rel, m: mm, kind: top === 'Vergaderingen' ? classify(mm, e.name) : top === 'Aantekeningen' ? 'Aantekeningen' : top === 'Actielijst' ? 'Actielijst' : 'Overig', ext: extOf(e.name), size: file.size, mod: file.lastModified, get: (function (h) { return function () { return h.getFile(); }; })(e) });
        }
      }
      for (var i = 0; i < TOPS.length; i++) { var d; try { d = await A.store.root.getDirectoryHandle(TOPS[i]); } catch (er) { continue; } await walk(d, TOPS[i], '', null); }
    } else {
      A.data.meetings.forEach(function (m) {
        function add(name, kind, size) { out.push({ id: m.id + '/' + name, name: name, top: 'Vergaderingen', sub: m.folder || m.title, m: m, kind: kind, ext: extOf(name), size: size || 0, mod: Date.parse(m.updated || m.created || '') || 0, get: function () { return A.store.get(m, name); } }); }
        m.files.forEach(function (f) { add(f.name, 'Stuk', f.size); if (f.pdf && f.pdf !== f.name) add(f.pdf, 'PDF-versie'); if (f.backup) add(f.backup, 'Vorige versie'); });
      });
    }
    return out.filter(function (it) { return it.kind !== 'Originele mail'; });
  }
  function meetLabel(it) { return it.m ? it.m.title : (it.top === 'Vergaderingen' && it.sub ? it.sub.split('/')[0] : ''); }
  function fxVal(it, k) {
    if (k === 'name') return it.name; if (k === 'kind') return it.kind; if (k === 'meet') return meetLabel(it); if (k === 'date') return it.m && it.m.date ? it.m.date : '';
    if (k === 'ext') return it.ext.toUpperCase(); if (k === 'size') return it.size; if (k === 'mod') return it.mod; if (k === 'folder') return it.top + (it.sub ? ' › ' + it.sub.replace(/\//g, ' › ') : ''); return '';
  }
  var FXCOLS = [['name', 'Naam', 'text'], ['date', 'Vergaderdatum', 'text'], ['ext', 'Type', 'select'], ['size', 'Grootte', 'none']];
  function fxShown(it, k) { if (k === 'date') return it.m && it.m.date ? fmtShort(it.m.date) : ''; if (k === 'size') return it.size ? kb(it.size) : ''; if (k === 'mod') return fmtDT(it.mod); return String(fxVal(it, k)); }
  function fxFiltered(src) {
    var q = FX.q.trim().toLowerCase(), list = src.filter(function (it) {
      if (FX.folder) { var fp = it.top + (it.sub ? '/' + it.sub : ''); if (fp !== FX.folder && fp.indexOf(FX.folder + '/') !== 0) return false; }
      if (q && (it.name + ' ' + meetLabel(it) + ' ' + it.kind).toLowerCase().indexOf(q) < 0) return false;
      for (var k in FX.f) { var v = FX.f[k]; if (!v) continue; var col = FXCOLS.filter(function (c) { return c[0] === k; })[0]; if (col && col[2] === 'select') { if (String(fxVal(it, k)) !== v) return false; } else if (fxShown(it, k).toLowerCase().indexOf(v.toLowerCase()) < 0) return false; }
      return true;
    });
    var k = FX.sort.k, d = FX.sort.d;
    return list.sort(function (a, b) { var x = fxVal(a, k), y = fxVal(b, k); if (typeof x === 'string') { x = x.toLowerCase(); y = String(y).toLowerCase(); } return (x < y ? -1 : x > y ? 1 : 0) * d; });
  }
  /* Zelfde bestand in een ander formaat of een vorige versie ((oorspronkelijk), PDF-versie) samenvoegen tot één regel */
  var VER_RANK = { 'Stuk': 0, 'Aantekeningen': 0, 'Actielijst': 0, 'PDF-versie': 1, 'Vorige versie': 2 };
  function baseKey(it) { return it.top + '/' + it.sub + '/' + it.name.replace(/\.[^.]*$/, '').replace(/ \(oorspronkelijk\)$/i, '').toLowerCase(); }
  function groupItems(list) {
    var map = {}, out = [];
    list.forEach(function (it) {
      if (it.top !== 'Vergaderingen' || it.kind === 'Originele mail' || it.kind === 'Export') { it.vers = [it]; out.push(it); return; }
      var k = baseKey(it), g = map[k];
      if (!g) { g = map[k] = { items: [] }; g.slot = out.length; out.push(null); }
      g.items.push(it);
    });
    Object.keys(map).forEach(function (k) {
      var g = map[k], v = g.items.sort(function (a, b) { var ra = VER_RANK[a.kind], rb = VER_RANK[b.kind]; return (ra == null ? 1 : ra) - (rb == null ? 1 : rb) || a.name.localeCompare(b.name); });
      v[0].vers = v; out[g.slot] = v[0];
    });
    return out;
  }
  var VER_LABEL = { 'Stuk': 'Huidige versie', 'PDF-versie': 'PDF-versie', 'Vorige versie': 'Oorspronkelijke versie' };
  function showVersions(it, x, y) {
    var menu = $('#vermenu'); if (!menu) return;
    var vs = it.vers || [it], h = '<div class="vhead">' + esc(it.name.replace(/\.[^.]*$/, '')) + '<small>' + vs.length + ' versie' + (vs.length === 1 ? '' : 's') + '</small></div>';
    h += vs.map(function (v, i) {
      return '<div class="vrow"><span class="fic">' + esc(v.ext.slice(0, 4).toUpperCase() || '—') + '</span><span class="vn" title="' + esc(v.name) + '">' + esc(v.name) + '<small>' + esc(VER_LABEL[v.kind] || v.kind) + (v.size ? ' · ' + esc(kb(v.size)) : '') + ' · ' + esc(fmtDT(v.mod)) + '</small></span>' +
        '<button type="button" class="link" data-vo="' + i + '" title="Openen">👁</button><button type="button" class="btn sm" data-vmail="' + i + '" title="Deze versie mailen">✉ Mailen</button><button type="button" class="btn sm" data-vd="' + i + '" title="Deze versie downloaden">⤓ Download</button></div>';
    }).join('');
    setHTML(menu, h); menu.hidden = false;
    var w = menu.offsetWidth, hh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, W.innerWidth - w - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(y, W.innerHeight - hh - 8)) + 'px';
    $$('[data-vd]', menu).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); fileAction('dl', [vs[+b.dataset.vd]]); }; });
    $$('[data-vmail]', menu).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var rc = b.getBoundingClientRect(); menu.hidden = true; fileAction('mail', [vs[+b.dataset.vmail]], { getBoundingClientRect: function () { return rc; } }); }; });
    $$('[data-vo]', menu).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); fileAction('open', [vs[+b.dataset.vo]]); }; });
  }
  async function renderFiles(reload) {
    var main = $('#main');
    if (!FX.items || reload) {
      setHTML(main, '<div class="head"><h1>Bestanden</h1></div><div class="card"><p class="muted">Bestanden ophalen…</p></div>');
      try { FX.items = await collectFiles(); } catch (e) { console.error(e); setHTML(main, '<div class="card"><p>Bestanden ophalen mislukt: ' + esc(e.message || e) + '</p></div>'); return; }
      if ((location.hash || '') !== '#/bestanden') return;
      FX.sel = {};
    }
    var hid = fxHidden(), nHid = FX.items.filter(function (it) { return hid[it.id]; }).length;
    if (!nHid) FX.showHidden = false;
    var all = FX.items.filter(function (it) { return FX.showHidden ? !!hid[it.id] : !hid[it.id]; }), flat = fxFiltered(all), list = FX.group ? groupItems(flat) : (flat.forEach(function (it) { it.vers = [it]; }), flat);
    // mappenboom
    var tree = {}; all.forEach(function (it) { var t = tree[it.top] || (tree[it.top] = { n: 0, subs: {} }); t.n++; if (it.sub) { var s0 = it.sub.split('/')[0]; t.subs[s0] = t.subs[s0] || { n: 0, label: it.top === 'Vergaderingen' && it.m ? (it.m.date ? fmtShort(it.m.date) + ' ' : '') + it.m.title : s0 }; t.subs[s0].n++; } });
    var th = '<button type="button" class="fxt' + (!FX.folder ? ' on' : '') + '" data-folder="">🗂 Alle bestanden <small>' + all.length + '</small></button>';
    TOPS.forEach(function (t) {
      var node = tree[t] || { n: 0, subs: {} }, open = FX.folder === t || FX.folder.indexOf(t + '/') === 0;
      th += '<button type="button" class="fxt top' + (FX.folder === t ? ' on' : '') + '" data-folder="' + t + '">' + (t === 'Vergaderingen' ? '📁' : t === 'Aantekeningen' ? '📝' : t === 'Actielijst' ? '✅' : '📁') + ' ' + t + ' <small>' + node.n + '</small></button>';
      if (open) Object.keys(node.subs).sort().reverse().forEach(function (s0) { var key = t + '/' + s0; th += '<button type="button" class="fxt sub' + (FX.folder === key ? ' on' : '') + '" data-folder="' + esc(key) + '" title="' + esc(node.subs[s0].label) + '"><span>' + esc(node.subs[s0].label) + '</span><small>' + node.subs[s0].n + '</small></button>'; });
    });
    var opts = {}; ['kind', 'ext'].forEach(function (k) { var set = {}; all.forEach(function (it) { set[fxVal(it, k)] = 1; }); opts[k] = Object.keys(set).filter(Boolean).sort(); });
    var nSel = Object.keys(FX.sel).length;
    var h = '<div class="head"><h1>Bestanden</h1><div class="acts"><button class="btn" id="fxre" title="Opnieuw inlezen">↻ Vernieuwen</button></div></div>';
    h += '<div class="fx-wrap"><nav class="card fxtree">' + th + '</nav><section class="card fxmain">';
    h += '<div class="fxbar"><input type="search" id="fxq" placeholder="Zoeken in bestandsnamen en vergaderingen…" value="' + esc(FX.q) + '">' +
      '<span class="fxsel">' + (nSel ? nSel + ' geselecteerd' : '') + '</span>' +
      '<button class="btn sm" data-fa="open"' + (nSel ? '' : ' disabled') + '>👁 Openen</button><button class="btn sm" data-fa="dl"' + (nSel ? '' : ' disabled') + '>⤓ Downloaden</button><button class="btn sm" data-fa="mail"' + (nSel ? '' : ' disabled') + '>✉ Mailen</button>' +
      (FX.showHidden ? '<button class="btn sm" data-fa="restore"' + (nSel ? '' : ' disabled') + ' title="Weer tonen in het overzicht">↩ Terugzetten</button>' : '<button class="btn sm" data-fa="hide"' + (nSel ? '' : ' disabled') + ' title="Alleen uit dit overzicht halen. Het bestand blijft in de vergadering.">🗑 Verwijderen</button>') + '</div>';
    if (nHid) h += '<div class="fxhid">' + (FX.showHidden ? 'Je ziet de bestanden die uit het overzicht zijn verwijderd. <button type="button" class="link" id="fxhid">‹ Terug naar alle bestanden</button>' : '<button type="button" class="link" id="fxhid">Verwijderd (' + nHid + ') tonen</button>') + '</div>';
    h += '<div class="tw fxtw"><table class="fxtb"><thead><tr><th class="cb"><input type="checkbox" id="fxall"' + (list.length && list.every(function (it) { return FX.sel[it.id]; }) ? ' checked' : '') + ' title="Alles selecteren"></th>' +
      FXCOLS.map(function (c) { var on = FX.sort.k === c[0]; return '<th class="c-' + c[0] + (on ? ' on' : '') + '" data-fs="' + c[0] + '">' + c[1] + '<i>' + (on ? (FX.sort.d < 0 ? '▼' : '▲') : '↕') + '</i></th>'; }).join('') + '<th class="c-go">Ga naar</th><th></th></tr>';
    h += '<tr class="fltr"><th></th>' + FXCOLS.map(function (c) {
      var v = FX.f[c[0]] || '';
      if (c[2] === 'select') return '<th><select data-ff="' + c[0] + '"><option value="">Alle</option>' + opts[c[0]].map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></th>';
      if (c[2] === 'none') return '<th></th>';
      return '<th><input data-ff="' + c[0] + '" value="' + esc(v) + '" placeholder="filter"></th>';
    }).join('') + '<th></th><th></th></tr></thead><tbody>';
    h += list.length ? list.map(function (it, i) {
      return '<tr data-fi="' + i + '" class="' + (FX.sel[it.id] ? 'sel' : '') + '"><td class="cb"><input type="checkbox"' + (FX.sel[it.id] ? ' checked' : '') + '></td>' +
        '<td class="c-name">' + esc(it.name) + (it.vers.length > 1 ? ' <button type="button" class="vbadge" data-vm="1" title="Versies tonen (of klik met de rechtermuisknop)">' + it.vers.length + ' versies ▾</button>' : '') + '</td>' +
        '<td class="c-date">' + esc(fxShown(it, 'date')) + '</td>' +
        '<td class="c-ext">' + esc(it.vers.map(function (v) { return v.ext.toUpperCase(); }).filter(function (e, i, a) { return a.indexOf(e) === i; }).join(', ')) + '</td><td class="c-size">' + esc(fxShown(it, 'size')) + '</td>' +
        '<td class="c-go">' + (it.m ? '<button type="button" class="btn sm go" data-go="1" title="Open de vergadering' + (it.kind === 'Stuk' || it.kind === 'PDF-versie' || it.kind === 'Vorige versie' ? ' met dit stuk in de viewer' : '') + '">Vergadering ›</button>' : '') + '</td><td class="fxact"><button class="link" data-ra="open" title="Openen">👁</button><button class="link" data-ra="dl" title="Downloaden">⤓</button><button class="link" data-ra="mail" title="Mailen">✉</button>' + (FX.showHidden ? '<button class="link" data-ra="restore" title="Terugzetten in het overzicht">↩</button>' : '<button class="link" data-ra="hide" title="Uit het overzicht verwijderen (blijft in de vergadering)">🗑</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="' + (FXCOLS.length + 3) + '" class="empty">' + (all.length ? 'Geen bestanden met deze zoekopdracht of filters.' : 'Nog geen bestanden.') + '</td></tr>';
    h += '</tbody></table></div><p class="note">' + list.length + (FX.group ? ' regels (' + flat.length + ' bestanden)' : ' van ' + all.length + ' bestanden') + ' · alleen lezen · dubbelklik om te openen · rechtermuisknop toont de versies</p></section></div>';
    h += '<div class="vermenu" id="vermenu" hidden></div>';
    setHTML(main, h);
    $$('[data-folder]').forEach(function (b) { b.onclick = function () { FX.folder = b.dataset.folder; renderFiles(); }; });
    $('#fxre').onclick = function () { renderFiles(true); };
    var qi = $('#fxq'); qi.oninput = function () { FX.q = qi.value; var p = qi.selectionStart; renderFiles(); var n = $('#fxq'); n.focus(); n.setSelectionRange(p, p); };
    $$('[data-fs]').forEach(function (t) { t.onclick = function () { var k = t.dataset.fs; FX.sort = { k: k, d: FX.sort.k === k ? -FX.sort.d : (k === 'mod' || k === 'date' || k === 'size' ? -1 : 1) }; renderFiles(); }; });
    $$('[data-ff]').forEach(function (inp) {
      var ev = inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(ev, function () { FX.f[inp.dataset.ff] = inp.value; var k = inp.dataset.ff, pos = inp.selectionStart; renderFiles(); var n = $('[data-ff="' + k + '"]'); if (n && n.tagName === 'INPUT') { n.focus(); n.setSelectionRange(pos, pos); } });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
    });
    $('#fxall').onchange = function () { var on = this.checked; list.forEach(function (it) { if (on) FX.sel[it.id] = 1; else delete FX.sel[it.id]; }); renderFiles(); };
    $$('.fxtb tbody tr[data-fi]').forEach(function (tr) {
      var it = list[+tr.dataset.fi];
      tr.onclick = function (e) {
        if (e.target.closest('a')) return;
        if (e.target.closest('[data-go]')) { e.stopPropagation(); goMeeting(it); return; }
        var vm = e.target.closest('[data-vm]'); if (vm) { e.stopPropagation(); var vr = vm.getBoundingClientRect(); showVersions(it, vr.left, vr.bottom + 4); return; }
        var ra = e.target.closest('[data-ra]'); if (ra) { e.stopPropagation(); fileAction(ra.dataset.ra, ra.dataset.ra === 'hide' || ra.dataset.ra === 'restore' ? it.vers : [it], ra); return; }
        if (e.target.type === 'checkbox' || e.ctrlKey || e.metaKey) { if (FX.sel[it.id]) delete FX.sel[it.id]; else FX.sel[it.id] = 1; }
        else { FX.sel = {}; FX.sel[it.id] = 1; }
        renderFiles();
      };
      tr.oncontextmenu = function (e) { e.preventDefault(); showVersions(it, e.clientX, e.clientY); };
      tr.ondblclick = function (e) { if (!e.target.closest('a,button,input')) fileAction('open', [it]); };
    });
    $$('[data-fa]').forEach(function (b) { b.onclick = function (e) {
      e.stopPropagation(); var a = b.dataset.fa, picked = list.filter(function (it) { return FX.sel[it.id]; });
      fileAction(a, a === 'hide' || a === 'restore' ? [].concat.apply([], picked.map(function (it) { return it.vers; })) : picked, b);
    }; });
    var hb = $('#fxhid'); if (hb) hb.onclick = function () { FX.showHidden = !FX.showHidden; FX.sel = {}; renderFiles(); };
    if (!A.mailBound) { A.mailBound = true; D.addEventListener('click', function (e) { var mn = $('#mailmenu'); if (mn && !mn.hidden && !e.target.closest('#mailmenu')) mn.hidden = true; var vn = $('#vermenu'); if (vn && !vn.hidden && !e.target.closest('#vermenu')) vn.hidden = true; }); D.addEventListener('keydown', function (e) { var vn = $('#vermenu'); if (e.key === 'Escape' && vn) vn.hidden = true; }); W.addEventListener('scroll', function () { var vn = $('#vermenu'); if (vn) vn.hidden = true; }, true); }
  }
  function goMeeting(it) {
    var m = it.m; if (!m) return;
    var low = it.name.toLowerCase(), idx = m.files.findIndex(function (f) { return f.name.toLowerCase() === low || (f.pdf && f.pdf.toLowerCase() === low) || (f.backup && f.backup.toLowerCase() === low); });
    A.sel = { id: m.id, i: idx >= 0 ? idx : 0 };
    if (it.kind === 'Aantekeningen') A.notesOpen = true;
    location.hash = '#/v/' + encodeURIComponent(m.id);
  }
  function openTab(blob, type) { var u = URL.createObjectURL(type && blob.type !== type ? new Blob([blob], { type: type }) : blob); var w = W.open(u, '_blank'); setTimeout(function () { URL.revokeObjectURL(u); }, 300000); if (!w) toast('Je browser blokkeerde het nieuwe tabblad. Sta pop-ups toe voor MeMeet.', 'warn'); }
  async function openItem(it) {
    var f = await it.get(), ext = it.ext;
    if (ext === 'pdf') return openTab(f, 'application/pdf');
    if (/^(png|jpe?g|gif|webp|bmp|svg)$/.test(ext)) return openTab(f, guessMime(it.name));
    if (/^(txt|csv|md|log|json)$/.test(ext)) return openTab(f, 'text/plain;charset=utf-8');
    var rec = it.m && it.kind === 'Stuk' ? it.m.files.filter(function (x) { return x.name === it.name; })[0] : null;
    if (rec && rec.pdf && rec.pdf !== rec.name) { try { return openTab(await A.store.get(it.m, rec.pdf), 'application/pdf'); } catch (e) {} }
    toast('Omzetten naar PDF om te bekijken…');
    var r = null; try { r = await convertToPdf(it.name, f.type || guessMime(it.name), f); } catch (e) { console.error(e); }
    if (r) return openTab(new Blob([r.bytes], { type: 'application/pdf' }), 'application/pdf');
    toast('Dit bestandstype kan niet worden getoond. Het wordt gedownload.', 'warn'); dl(f, it.name);
  }
  function b64Lines(u8) { var s = '', C = 0x8000; for (var i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s).replace(/.{76}/g, '$&\r\n'); }
  function encWord(t) { return /^[\x20-\x7e]*$/.test(t) ? t : '=?utf-8?B?' + btoa(unescape(encodeURIComponent(t))) + '?='; }
  async function buildEml(items) {
    var bnd = '----MeMeet' + uid(), subj = items.length === 1 ? items[0].name : items.length + ' bestanden uit MeMeet';
    var meets = {}; items.forEach(function (it) { if (it.m) meets[it.m.title + (it.m.date ? ' (' + fmtShort(it.m.date) + ')' : '')] = 1; });
    var body = 'Beste,\r\n\r\nBijgevoegd ' + (items.length === 1 ? 'het bestand' : 'de bestanden') + (Object.keys(meets).length ? ' voor ' + Object.keys(meets).join(', ') : '') + ':\r\n' + items.map(function (it) { return '- ' + it.name; }).join('\r\n') + '\r\n\r\nMet vriendelijke groet,\r\n';
    var o = ['To: ', 'Subject: ' + encWord(subj), 'X-Unsent: 1', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + bnd + '"', '', '--' + bnd, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64Lines(new TextEncoder().encode(body))];
    for (var i = 0; i < items.length; i++) {
      var f = await items[i].get(), u8 = new Uint8Array(await f.arrayBuffer()), nm = encWord(items[i].name).replace(/"/g, '');
      o.push('--' + bnd, 'Content-Type: ' + (guessMime(items[i].name) || 'application/octet-stream') + '; name="' + nm + '"', 'Content-Disposition: attachment; filename="' + nm + '"', 'Content-Transfer-Encoding: base64', '', b64Lines(u8));
    }
    o.push('--' + bnd + '--', '');
    return { blob: new Blob([o.join('\r\n')], { type: 'message/rfc822' }), name: safe('Mail - ' + subj.replace(/\.[^.]+$/, '')) + '.eml' };
  }
  async function fileAction(a, items, anchor) {
    if (!items.length) return;
    if (a === 'hide' || a === 'restore') {
      var hd = fxHidden(); items.forEach(function (it) { if (a === 'hide') hd[it.id] = 1; else delete hd[it.id]; });
      FX.sel = {}; await persist(); renderFiles();
      toast(a === 'hide' ? (items.length === 1 ? '"' + items[0].name + '" is' : items.length + ' bestanden zijn') + ' uit het overzicht gehaald. In de vergadering staan ze er nog. Terugzetten kan via "Verwijderd tonen".' : 'Weer zichtbaar in het overzicht.', 'ok');
      return;
    }
    if (a === 'open') { if (items.length > 5 && !confirm(items.length + ' bestanden openen in nieuwe tabbladen?')) return; for (var i = 0; i < items.length; i++) { await openItem(items[i]); } return; }
    if (a === 'dl') { for (var j = 0; j < items.length; j++) { dl(await items[j].get(), items[j].name); await sleep(350); } if (items.length > 1) toast(items.length + ' bestanden staan in je map Downloads. Vraagt Edge om toestemming voor meerdere downloads? Klik dan op Toestaan.', 'ok'); return; }
    if (a === 'mail') {
      try { var em = await buildEml(items); dl(em.blob, em.name); toast('Open het gedownloade bestand "' + em.name + '" (onderaan of in Downloads). Outlook opent dan een nieuwe mail met ' + (items.length === 1 ? 'de bijlage' : 'de ' + items.length + ' bijlagen') + ', klaar om te versturen.', 'ok'); }
      catch (e) { toast('Mail maken mislukt: ' + (e.message || e), 'err'); }
    }
  }
