  /* MeMeet - uitbreiding Postvak (standaard uit). Een map die jij kiest, bijvoorbeeld een map op de netwerkschijf waar je secretaresse
     ook bij kan. Wat daarin komt, haalt MeMeet elke minuut op als stuk van de juiste vergadering. Er gaat niets van je datamap naar het
     postvak: MeMeet maakt daar alleen mappen met de datum, tijd en titel van je komende vergaderingen. */
  (function () {
    var PV_UNSORTED = 'Nog in te delen', PV_DONE = 'Verwerkt', PV_DAYS = 14;
    var P = { dir: null, status: 'none', seen: {}, unsorted: [], busy: false, retry: null, warned: false, last: null };
    function st() { var s = plState('postvak'); if (!s.dirs) s.dirs = {}; if (!s.done) s.done = []; if (!s.na) s.na = 'verplaatsen'; return s; }
    function skipName(n) { return /^~|\.tmp$|^\.|^desktop\.ini$|^thumbs\.db$/i.test(n); }
    function isoDay(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function folderName(m) { return safe(m.date + ' ' + (m.start || '00:00').replace(':', '.') + ' ' + (cleanSubject(m.title || '').trim() || m.title || 'Vergadering')).slice(0, 80); }
    function item(f) { return { name: f.name, type: f.type || guessMime(f.name), blob: f }; }
    /* de inhoud in het geheugen lezen: een File uit het postvak verwijst naar het bestand op schijf, en dat gaat daarna naar Verwerkt */
    async function copyOf(f) { return new File([await f.arrayBuffer()], f.name, { type: f.type || guessMime(f.name), lastModified: f.lastModified }); }

    /* ---------- het postvak: handle bewaren in de browser (zoals de datamap), toestemming alleen als de uitbreiding aanstaat */
    async function openDir() {
      var h = null;
      /* in de tests (window.__VA_TEST) komt het nagebootste postvak rechtstreeks uit OPFS: een OPFS-koppeling teruglezen uit IndexedDB laat de testbrowser vastlopen */
      try { h = W.__VA_TEST && W.__pvTestDir && st().name ? await W.__pvTestDir() : await kvGet('postvakDir'); } catch (e) {}
      if (!h) { P.dir = null; P.status = 'none'; return null; }
      try { if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') { P.dir = h; P.status = 'perm'; return null; } }
      catch (e) { P.dir = null; P.status = 'unreachable'; return null; }
      try { var it = h.values(); await it.next(); }
      catch (e) { P.dir = h; P.status = 'unreachable'; if (!P.warned) { P.warned = true; toast('Het postvak "' + h.name + '" is niet bereikbaar. Is de netwerkschijf verbonden?', 'warn'); } return null; }
      P.dir = h; P.status = 'ok'; P.warned = false; return h;
    }
    async function pick() {
      if (!W.showDirectoryPicker) { toast('Deze browser kan geen map kiezen.', 'warn'); return; }
      try {
        var h = await W.showDirectoryPicker({ id: 'memeet-postvak', mode: 'readwrite' });
        if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Geen schrijfrechten op het postvak');
        await kvSet('postvakDir', h); var s = st(); s.name = h.name; s.dirs = {}; await persist();
        P.dir = h; P.status = 'ok'; await scan(); toast('Postvak "' + h.name + '" gekozen. MeMeet maakt daarin een map per vergadering van de komende ' + PV_DAYS + ' dagen.', 'ok'); route();
      } catch (e) { if (e && e.name === 'AbortError') return; console.error(e); toast('Postvak kiezen lukte niet: ' + (e.message || e), 'err'); }
    }
    async function grant() {
      if (!P.dir) return pick();
      try { if ((await P.dir.requestPermission({ mode: 'readwrite' })) === 'granted') { P.status = 'ok'; await scan(); route(); } } catch (e) { toast('Toegang geven lukte niet: ' + (e.message || e), 'err'); }
    }

    /* ---------- mappen: een per vergadering van de komende 14 dagen, plus Nog in te delen en Verwerkt; lege oude mappen weg */
    async function isEmpty(dir) { for await (var e of dir.values()) { if (e) return false; } return true; }
    async function syncFolders(root) {
      var s = st(), today = isoDay(0), until = isoDay(PV_DAYS), want = {};
      A.data.meetings.filter(function (m) { return !m.isNew && m.date && m.date >= today && m.date <= until; }).forEach(function (m) { want[folderName(m)] = m.id; });
      for (var n in want) { if (!s.dirs[n] || s.dirs[n] !== want[n]) { await root.getDirectoryHandle(n, { create: true }); s.dirs[n] = want[n]; } else await root.getDirectoryHandle(n, { create: true }); }
      await root.getDirectoryHandle(PV_UNSORTED, { create: true }); await root.getDirectoryHandle(PV_DONE, { create: true });
      for (var o of Object.keys(s.dirs)) {
        if (want[o]) continue;
        var d = null; try { d = await root.getDirectoryHandle(o); } catch (e) { delete s.dirs[o]; continue; }
        if (await isEmpty(d)) { try { await root.removeEntry(o); } catch (e) {} delete s.dirs[o]; }
        else if (!byId(s.dirs[o])) delete s.dirs[o]; /* vergadering verwijderd maar map niet leeg: bestanden behandelen als los */
      }
    }

    /* ---------- koppelen aan een vergadering via de titelherkenning (en een datum in de naam) */
    function dateIn(t) {
      var a = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (a) return a[1] + '-' + pad(+a[2]) + '-' + pad(+a[3]);
      var b = /(^|\D)(\d{1,2})[-.](\d{1,2})[-.](\d{4})(\D|$)/.exec(t); if (b) return b[4] + '-' + pad(+b[3]) + '-' + pad(+b[2]);
      return '';
    }
    function matchMeeting(text) {
      var t = String(text || '').replace(/\.[^.]{1,5}$/, '').replace(/[_]+/g, ' '), day = dateIn(t), today = isoDay(0);
      var ms = A.data.meetings.filter(function (m) { return !m.isNew && m.date; });
      var hits = ms.filter(function (m) { var p = cleanSubject(m.title || '').trim(); return p && ibInTitle(p, t); });
      if (day) {
        var both = hits.filter(function (m) { return m.date === day; }); if (both.length === 1) return both[0]; if (both.length > 1) return null;
        var onDay = ms.filter(function (m) { return m.date === day; }); return onDay.length === 1 && !hits.length ? onDay[0] : null;
      }
      var up = hits.filter(function (m) { return m.date >= today; }).sort(ibSort); if (!up.length) return null;
      var groups = {}; up.forEach(function (m) { groups[ibNorm(cleanSubject(m.title))] = 1; });
      return Object.keys(groups).length === 1 ? up[0] : null;
    }

    /* ---------- toevoegen aan een vergadering; een zelfde naam wordt een nieuwe versie (de vorige blijft bewaard) */
    async function addItems(m, list) {
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        var it = list[i], same = m.files.filter(function (f) { return f.name.toLowerCase() === safe(it.name).toLowerCase(); })[0];
        if (same) { await saveEdited(m, same, it.blob); same.via = 'postvak'; }
        else { var nm = await addFileTo(m, it.name, it.type, it.blob), rec = m.files.filter(function (f) { return f.name === nm; })[0]; if (rec) rec.via = 'postvak'; }
        n++;
      }
      m.updated = new Date().toISOString(); return n;
    }
    async function uniqueIn(dir, name) {
      var base = name.replace(/(\.[^.]*)?$/, ''), ext = (/\.[^.]*$/.exec(name) || [''])[0], n = 1, nm = name;
      for (;;) { try { await dir.getFileHandle(nm); nm = base + ' (' + (++n) + ')' + ext; } catch (e) { return nm; } }
    }
    async function moveFile(fromDir, h, name, toDir) {
      var nm = await uniqueIn(toDir, name);
      if (typeof h.move === 'function') { try { await h.move(toDir, nm); return; } catch (e) { console.warn('Verplaatsen met move lukte niet, nu kopiëren', e); } }
      var f = await h.getFile(), nh = await toDir.getFileHandle(nm, { create: true }), w = await nh.createWritable(); await w.write(f); await w.close();
      await fromDir.removeEntry(name);
    }
    /* na verwerken: naar Verwerkt\JJJJ-MM-DD\ of verwijderen (instelling) */
    async function finish(root, dir, h, name) {
      if (st().na === 'verwijderen') { await dir.removeEntry(name); return; }
      var vd = await (await root.getDirectoryHandle(PV_DONE, { create: true })).getDirectoryHandle(isoDay(0), { create: true });
      await moveFile(dir, h, name, vd);
    }

    /* ---------- één bestand verwerken. Geeft { m, n } bij succes, 'later' (nog niet te koppelen) of null */
    async function handle(f, m) {
      if (m) return { m: m, n: await addItems(m, await expandFiles([item(f)])) };
      if (isMailItem(f)) {
        var p = await parseMailFile(f);
        if (p.r.date) { /* een uitnodiging: nieuwe of bijgewerkte vergadering; bij een bestaande komen mail en bijlagen erbij */
          var d = await draftFromMail(f), ex = sameDay(d);
          if (ex) { if (d.start) { ex.start = d.start; if (d.end) ex.end = d.end; } return { m: ex, n: await addItems(ex, await expandFiles([item(f)])) }; }
          var nm = await saveDraft(d); nm.files.forEach(function (x) { x.via = 'postvak'; }); return { m: nm, n: nm.files.length, made: true };
        }
        var mm = matchMeeting(p.m.subject || f.name); if (mm) return { m: mm, n: await addItems(mm, await expandFiles([item(f)])) };
        return 'later';
      }
      var m2 = matchMeeting(f.name); if (m2) return { m: m2, n: await addItems(m2, await expandFiles([item(f)])) };
      return 'later';
    }

    /* ---------- ophalen: bij de start en elke minuut. Een bestand dat nog groeit (grootte of tijd veranderd sinds de vorige controle) wacht. */
    async function scan() {
      if (P.busy) return; P.busy = true; clearTimeout(P.retry); P.retry = null;
      var root = null, waiting = 0, got = {}, total = 0, made = 0, changed = [];
      try {
        root = await openDir(); if (!root) return;
        await syncFolders(root);
        var s = st(), jobs = [], uns = [];
        for await (var e of root.values()) {
          if (e.kind === 'file') jobs.push({ dir: root, h: e, m: null, path: '' });
          else if (e.name === PV_UNSORTED) { for await (var u of e.values()) if (u.kind === 'file' && !skipName(u.name)) uns.push(u.name); }
          else if (e.name !== PV_DONE) { var mid = s.dirs[e.name], mt = mid && byId(mid); for await (var g of e.values()) if (g.kind === 'file') jobs.push({ dir: e, h: g, m: mt || null, path: e.name }); }
        }
        P.unsorted = uns.sort(function (a, b) { return a.localeCompare(b, 'nl', { numeric: true }); });
        for (var i = 0; i < jobs.length; i++) {
          var j = jobs[i], name = j.h.name; if (skipName(name)) continue;
          var f = await j.h.getFile(), key = j.path + '/' + name, sig = f.size + '|' + f.lastModified;
          if (P.seen[key] !== sig) { P.seen[key] = sig; waiting++; continue; } /* eerste keer gezien of nog in beweging: volgende controle */
          if (s.done.indexOf(key + '|' + sig) >= 0) { try { await finish(root, j.dir, j.h, name); } catch (er) {} continue; } /* al verwerkt (verplaatsen mislukte eerder) */
          var r;
          try { r = await handle(await copyOf(f), j.m); }
          catch (er) { console.error(er); toast('"' + name + '" uit je postvak kon niet worden gelezen en staat bij Nog in te delen.', 'warn'); r = 'later'; }
          if (r === 'later') { var ud = await root.getDirectoryHandle(PV_UNSORTED, { create: true }), un = await uniqueIn(ud, name); await moveFile(j.dir, j.h, name, ud); P.unsorted.push(un); delete P.seen[key]; continue; }
          s.done.push(key + '|' + sig); if (s.done.length > 300) s.done.splice(0, s.done.length - 300);
          delete P.seen[key];
          if (r && r.m) { got[r.m.title] = (got[r.m.title] || 0) + r.n; total += r.n; if (r.made) made++; if (changed.indexOf(r.m) < 0) changed.push(r.m); }
          try { await finish(root, j.dir, j.h, name); } catch (er) { console.warn('Bestand niet verplaatst', er); }
        }
        await persist();
        P.last = new Date();
      } finally {
        P.busy = false;
        if (waiting && plOn(plugin('postvak'))) P.retry = setTimeout(function () { plCall(plugin('postvak'), 'onTick'); }, 4000);
      }
      if (total) {
        toast(total + ' nieuw' + (total === 1 ? ' stuk' : 'e stukken') + ' uit je postvak: ' + Object.keys(got).map(function (t) { return t + ' (' + got[t] + ')'; }).join(', ') + (made ? '. ' + made + ' nieuwe vergadering' + (made === 1 ? '' : 'en') + '.' : '.'), 'ok');
        refresh(changed);
      } else if (/^#\/?$/.test(location.hash || '#/')) refresh([]);
    }
    /* scherm bijwerken, zonder iemand te storen die aan het typen is */
    function refresh(changed) {
      var h = location.hash || '#/', ae = D.activeElement, typing = ae && /^(TEXTAREA|INPUT|SELECT)$/.test(ae.tagName);
      try { renderSide(); } catch (e) {}
      if (/^#\/?$/.test(h)) { if (!typing) renderHome(); return; }
      var mm = /^#\/v\/(.+)$/.exec(h); if (mm && !typing) { var m = byId(decodeURIComponent(mm[1])); if (m && changed.indexOf(m) >= 0) renderDetail(m); }
      if (h === '#/bestanden' && typeof FX !== 'undefined') FX.items = null;
    }
    /* een stuk uit Nog in te delen toewijzen aan een vergadering */
    async function assign(name, mid) {
      var m = byId(mid); if (!m || !P.dir) return;
      var root = P.dir, ud = await root.getDirectoryHandle(PV_UNSORTED), h = await ud.getFileHandle(name), f = await copyOf(await h.getFile());
      var n = await addItems(m, await expandFiles([item(f)]));
      await finish(root, ud, h, name); await persist();
      P.unsorted = P.unsorted.filter(function (x) { return x !== name; });
      toast('"' + name + '" staat nu bij ' + m.title + (n > 1 ? ' (' + n + ' stukken)' : '') + '.', 'ok'); refresh([m]);
    }

    /* ---------- schermen */
    function homeHtml() {
      var s = st(), msg = '';
      if (P.status === 'perm') msg = '<p class="pvwarn">MeMeet heeft opnieuw toegang nodig tot je postvak <b>' + esc(s.name || '') + '</b>. <button type="button" class="btn sm" id="pvGrant">Toegang geven</button></p>';
      else if (P.status === 'unreachable') msg = '<p class="pvwarn">Je postvak <b>' + esc(s.name || '') + '</b> is niet bereikbaar. Is de netwerkschijf verbonden? <button type="button" class="btn sm" id="pvGrant">Opnieuw proberen</button></p>';
      else if (P.status === 'none') msg = '<p class="pvwarn">Kies je postvak in het <a href="#/installatie">installatiescherm</a>.</p>';
      if (!msg && !P.unsorted.length) return '';
      var opts = A.data.meetings.filter(function (m) { return !m.isNew && m.date && m.date >= isoDay(-7) && m.date <= isoDay(60); }).sort(ibSort)
        .map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(fmtShort(m.date) + (m.start ? ' ' + m.start : '') + ' · ' + m.title) + '</option>'; }).join('');
      return '<section class="card pvhome" id="pvHome"><h2>' + ic('inbox') + ' Postvak' + (P.unsorted.length ? ': nog in te delen <span class="muted">' + P.unsorted.length + '</span>' : '') + '</h2>' + msg +
        (P.unsorted.length ? '<ul class="pvlist">' + P.unsorted.map(function (n) { return '<li><span class="fn" title="' + esc(n) + '">' + esc(n) + '</span><select data-pvas="' + esc(n) + '" aria-label="Vergadering voor ' + esc(n) + '"><option value="">Vergadering kiezen…</option>' + opts + '</select></li>'; }).join('') + '</ul>' +
          '<p class="muted small">Of sleep het bestand in Verkenner naar de map van de vergadering in je postvak.</p>' : '') + '</section>';
    }
    function bindHome(root) {
      var g = $('#pvGrant', root); if (g) g.onclick = grant;
      $$('[data-pvas]', root).forEach(function (s) { s.onchange = function () { if (s.value) assign(s.dataset.pvas, s.value).catch(function (e) { console.error(e); toast('Toewijzen lukte niet: ' + (e.message || e), 'err'); }); }; });
    }
    function installHtml() {
      var s = st();
      return '<section class="card wk" id="insPostvak"><h2>Uitbreiding Postvak</h2>' +
        '<p>Kies een map als postvak, bijvoorbeeld een map op de netwerkschijf waar alleen jij en je secretaresse bij kunnen. MeMeet maakt daarin een map per vergadering van de komende ' + PV_DAYS + ' dagen, en de mappen <b>' + PV_UNSORTED + '</b> en <b>' + PV_DONE + '</b>. Wat in het postvak komt, staat binnen een minuut bij de vergadering.</p>' +
        (s.name ? '<p class="' + (P.status === 'ok' ? 'okline' : 'warnline') + '">' + (P.status === 'ok' ? '✓ Postvak: ' : 'Postvak (niet bereikbaar of geen toegang): ') + '<b>' + esc(s.name) + '</b></p>' : '') +
        '<p><button type="button" class="btn' + (s.name ? '' : ' pri') + '" id="pvPick">' + ic('folder') + ' Postvak kiezen…</button></p>' +
        '<p>Na verwerken: <label><input type="radio" name="pvna" value="verplaatsen"' + (s.na !== 'verwijderen' ? ' checked' : '') + '> verplaatsen naar <b>' + PV_DONE + '\\JJJJ-MM-DD</b></label> <label><input type="radio" name="pvna" value="verwijderen"' + (s.na === 'verwijderen' ? ' checked' : '') + '> verwijderen</label></p>' +
        '<p class="muted">Gebruik op een gedeelde map geen Windows-mapversleuteling: dan kan je secretaresse er niet meer bij. Laat beheer de toegangsrechten instellen.</p></section>';
    }
    function bindInstall(root) {
      var b = $('#pvPick', root); if (b) b.onclick = pick;
      $$('input[name=pvna]', root).forEach(function (r) { r.onchange = async function () { st().na = r.value; await persist(); toast(r.value === 'verwijderen' ? 'Verwerkte bestanden worden verwijderd uit het postvak.' : 'Verwerkte bestanden gaan naar de map Verwerkt.', 'ok'); }; });
    }
    function helpHtml() {
      return '<p>Wat in je postvak komt, haalt MeMeet elke minuut op. Een bestand in de map van een vergadering wordt een stuk van die vergadering. Een uitnodiging (.msg of .eml) wordt een vergadering; een mail bij een bestaande vergadering komt daar met de bijlagen bij. Zips en doorgestuurde mails worden uitgepakt. Een los bestand met een datum of titel in de naam wordt gekoppeld; wat niet te koppelen is, staat op de pagina Vergaderingen onder <b>Postvak: nog in te delen</b>. Heet een bestand hetzelfde als een stuk, dan wordt het een nieuwe versie. Een bestand dat nog wordt gekopieerd, wacht tot het klaar is.</p>' +
        '<h3>Outlook: mails met stukken in het postvak</h3><p>De eenvoudigste werkwijze: een regel zet mails met stukken in een Outlook-map <b>MeMeet</b>. Daaruit sleep je ze naar je postvak in Verkenner, of rechtstreeks naar MeMeet.</p>' +
        '<p><b>Klassieke Outlook</b></p><ol><li>Maak een map <b>MeMeet</b>: rechtermuisknop op <i>Postvak IN</i> › <b>Nieuwe map</b>.</li><li><b>Bestand</b> › <b>Regels en waarschuwingen beheren</b> › <b>Nieuwe regel</b> › <i>Regel toepassen op berichten die ik ontvang</i>.</li><li>Kies de voorwaarden, bijvoorbeeld <i>van</i> je secretaresse en <i>met een bijlage</i>, of een woord als <i>stukken</i> in het onderwerp.</li><li>Kies de actie <b>verplaatsen naar de opgegeven map</b> › <b>MeMeet</b> en klik op <b>Voltooien</b>.</li></ol>' +
        '<p><b>Nieuwe Outlook</b></p><ol><li>Maak een map <b>MeMeet</b>: rechtermuisknop op <i>Postvak IN</i> › <b>Nieuwe submap maken</b>.</li><li><b>Instellingen</b> (tandwiel) › <b>Mail</b> › <b>Regels</b> › <b>Nieuwe regel toevoegen</b>.</li><li>Geef een naam, kies een voorwaarde en als actie <b>Verplaatsen naar</b> › <b>MeMeet</b>, en klik op <b>Opslaan</b>.</li><li>Kun je een mail niet slepen, kies dan bij de mail <b>⋯</b> › <b>Opslaan als</b> en zet het bestand in je postvak.</li></ol>' +
        '<h3>Extra: een macro (alleen klassieke Outlook)</h3><p>De macro <code>MeMeet-naar-postvak</code> zet geselecteerde mails als <code>.msg</code> in je postvak. Hij werkt ook in een regel, met de actie <b>een script uitvoeren</b>. Zet in de eerste regels het pad naar je postvak. Plak de code in Outlook via <b>Alt+F11</b> › <b>Invoegen</b> › <b>Module</b>.</p>' +
        '<p class="muted">Beperkingen: de nieuwe Outlook kent geen macro\'s. Een script in een regel werkt alleen als je organisatie dat toestaat; vraag het beheer.</p>' +
        '<pre class="pvmacro" id="pvMacro"></pre><p><button type="button" class="btn sm" id="pvCopy">Code kopiëren</button></p>' +
        '<h3>Veiligheid</h3><ul><li>Laat beheer de toegang tot het postvak instellen: alleen jij en je secretaresse.</li><li>Gebruik op een gedeelde map geen Windows-mapversleuteling.</li><li>Er gaat niets van je datamap naar het postvak. De mapnamen bevatten alleen de datum, de tijd en de titel van de vergadering.</li><li>Het jaarlijks opschonen maakt ook de map <b>' + PV_DONE + '</b> leeg.</li></ul>';
    }
    function bindHelp(root) {
      var pre = $('#pvMacro', root); if (pre) pre.textContent = POSTVAK_MACRO;
      var c = $('#pvCopy', root); if (c) c.onclick = async function () { var ok = false; try { await navigator.clipboard.writeText(POSTVAK_MACRO); ok = true; } catch (e) {} toast(ok ? 'Gekopieerd. Plak het in Outlook met Ctrl+V.' : 'Kopiëren lukte niet. Selecteer de tekst en druk op Ctrl+C.', ok ? 'ok' : 'warn'); };
    }
    async function onCleanup() {
      var root = await openDir(); if (!root) return;
      try { await root.removeEntry(PV_DONE, { recursive: true }); } catch (e) {}
      await root.getDirectoryHandle(PV_DONE, { create: true }); st().done = [];
    }
    function onDisable() { clearTimeout(P.retry); P.retry = null; P.dir = null; P.status = 'none'; P.seen = {}; P.unsorted = []; P.busy = false; }

    var POSTVAK_MACRO = __POSTVAK_MACRO__;
    registerPlugin({
      id: 'postvak', naam: 'Postvak',
      omschrijving: 'Een map (bijvoorbeeld op de netwerkschijf) waarin jij of je secretaresse stukken en mails zet. MeMeet haalt ze elke minuut op en zet ze bij de juiste vergadering.',
      privacy: 'MeMeet leest alleen de map die jij als postvak kiest en zet wat erin komt als stuk in je datamap. Er gaat niets van je datamap naar het postvak: daar maakt MeMeet alleen mappen met de datum, tijd en titel van je komende vergaderingen. Wie bij het postvak kan, ziet die mapnamen en wat erin wordt gezet. MeMeet maakt geen verbinding met internet.',
      onStart: scan, onTick: scan, homeHtml: homeHtml, bindHome: bindHome, installHtml: installHtml, bindInstall: bindInstall,
      helpHtml: helpHtml, bindHelp: bindHelp, onCleanup: onCleanup, onDisable: onDisable,
      forget: { vraag: 'Koppeling met de postvak-map ook vergeten?\n\nOK = MeMeet vergeet welke map je postvak was (de map zelf en wat erin staat blijven bestaan).\nAnnuleren = de koppeling bewaren voor als je de uitbreiding later weer aanzet.', run: async function () { await kvSet('postvakDir', null); var s = st(); s.name = null; s.dirs = {}; s.done = []; await persist(); } },
      /* voor de tests */
      _scan: scan, _assign: assign, _match: matchMeeting, _state: function () { return P; }
    });
  })();
