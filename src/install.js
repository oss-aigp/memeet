  /* MeMeet - install: installatiescherm, datamap en mappen openen in Verkenner */
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
    var inOd = here && /\\OneDrive[^\\]*\\/i.test(here);
    h += '<section class="card wk"><h2>2. De datamap</h2>' +
      (inOd ? '<p class="warnline">Dit bestand staat in een map die met <b>OneDrive</b> wordt gesynchroniseerd (<code>' + esc(here) + '</code>). Kies een datamap buiten OneDrive, bijvoorbeeld een map <b>MeMeet</b> direct in je gebruikersmap, zodat je aantekeningen niet in de cloud komen.</p>' : '') +
      (A.store && A.store.kind === 'map' ? '<p class="okline">✓ De gegevens staan in de map <b>' + esc(A.store.name) + '</b>.</p>' : A.store ? '<p>De gegevens worden nu in de browser bewaard. Wil je ze in een map op je computer? Klik dan op <b>Datamap kiezen</b>.</p>' : '') +
      '<p>Klik op <b>Datamap kiezen</b> en kies de map <b>MeMeet</b> waar <code>MeMeet.html</code> in staat. MeMeet maakt daarin de map <b>memeet-data</b> aan, met de submappen <b>Vergaderingen</b>, <b>Aantekeningen</b> en <b>Actielijst</b>, en zet het icoon <code>MeMeet.ico</code> naast <code>MeMeet.html</code>.</p>' +
      '<pre class="tree">Documenten\\MeMeet\\\n  MeMeet.html\n  MeMeet.ico\n  memeet-data\\\n    Vergaderingen\\\n    Aantekeningen\\\n    Actielijst\\\n    memeet.json</pre>' +
      '<p><button class="btn' + (A.store && A.store.kind === 'map' ? '' : ' pri') + '" id="insPick">' + ic('folder') + ' Datamap kiezen…</button></p></section>';
    h += '<section class="card wk" id="insCrypt"><h2>3. Versleutel de datamap</h2>' + CRYPT_HTML +
      (A.store && A.store.kind === 'map' ? '<p><a href="#" class="btn fold" data-fold="">' + ic('folder_open') + ' memeet-data openen in Verkenner</a></p>' : '') + '</section>';
    h += '<section class="card wk"><h2>4. Snelkoppeling op het bureaublad en in de taakbalk</h2>' +
      '<p>De snelkoppeling start <code>explorer.exe</code> met MeMeet als bestand. Omdat het doel een programma is, kun je hem daarna ook naar de taakbalk slepen.</p><ol>' +
      '<li>Klik met de rechtermuisknop op een lege plek op het bureaublad en kies <b>Nieuw</b> › <b>Snelkoppeling</b>.</li>' +
      '<li>Plak bij <i>Typ de locatie van het item</i> deze regel' + (here ? ' (klik op <b>Kopiëren</b>)' : ' en vervang het pad door de plek van jouw <code>MeMeet.html</code>') + ':</li></ol>' +
      '<div class="cmdbox"><code id="insCmd">' + esc(cmd) + '</code><button class="btn sm" id="insCopy">Kopiëren</button></div><ol start="3">' +
      '<li>Klik op <b>Volgende</b>, typ als naam <b>MeMeet</b> en klik op <b>Voltooien</b>.</li>' +
      '<li>Klik met de rechtermuisknop op de nieuwe snelkoppeling en kies <b>Eigenschappen</b>. Klik op <b>Ander pictogram…</b> › <b>Bladeren</b>, kies <code>' + esc((dir || 'Documenten\\MeMeet') + '\\MeMeet.ico') + '</code> en klik twee keer op <b>OK</b>.</li>' +
      '<li>Sleep de snelkoppeling van het bureaublad naar de <b>taakbalk</b>. Of klik er met de rechtermuisknop op en kies <b>Aan taakbalk vastmaken</b> (in Windows 11 eerst <b>Meer opties weergeven</b>).</li></ol>' +
      '<p class="muted">' + (A.iconPlaced ? 'Het icoon <code>MeMeet.ico</code> heeft MeMeet al naast <code>MeMeet.html</code> gezet. ' : 'Het icoon <code>MeMeet.ico</code> zet MeMeet naast <code>MeMeet.html</code> als je in stap 2 de map MeMeet kiest. Staat het er niet? ') + '<button type="button" class="link" id="insIco">Icoon downloaden</button> en zet het naast <code>MeMeet.html</code>.</p></section>';
    h += '<section class="card wk"><h2>5. Bijwerken naar een nieuwe versie</h2>' + UPGRADE_HTML + '</section>';
    h += '<section class="card wk"><h2>6. Back-up</h2>' + BACKUP_HTML.replace(/<h3>/g, '<h3 class="sub">') + '</section>';
    h += '<section class="card wk"><h2>7. Elk jaar opschonen</h2>' + CLEAN_HTML + '<p><a class="btn" href="#/opschonen">' + ic('delete_sweep') + ' Gegevens opschonen…</a></p></section>';
    h += '<section class="card wk" id="insPlugins"><h2>8. Uitbreidingen (optioneel)</h2>' + plListHtml() + '</section>' + plHtml('installHtml');
    h += '<p><a class="btn" href="#/">Klaar, naar de vergaderingen</a></p>';
    setHTML($('#main'), h);
    $('#insPick').onclick = chooseFolder; plBindList($('#main'), renderInstall); plBind('bindInstall', $('#main')); bindFolders($('#main'));
    $('#insIco').onclick = function () { dl(icoBlob(), 'MeMeet.ico'); };
    var c = $('#insCopy'); if (c) c.onclick = async function () { var ok = false; try { await navigator.clipboard.writeText(cmd); ok = true; } catch (e) {} toast(ok ? 'Gekopieerd. Plak het met Ctrl+V.' : 'Kopiëren lukte niet. Selecteer de tekst en druk op Ctrl+C.', ok ? 'ok' : 'warn'); };
  }

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
