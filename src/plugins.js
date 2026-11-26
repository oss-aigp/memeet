  /* MeMeet - plugins: een eenvoudig uitbreidingssysteem. Uitbreidingen zitten in MeMeet.html (map src/plugins/), maar staan standaard
     uit. Zolang een uitbreiding uitstaat, wordt geen enkel haakje aangeroepen: geen knoppen, geen meldingen, geen timers, geen
     toestemmingsvragen en geen bestandstoegang. Aan of uit staat in memeet.json (A.data.plugins), dus het gaat mee met de datamap.

     Een uitbreiding meldt zich aan met registerPlugin({ id, naam, omschrijving, privacy, ...haakjes }). Haakjes (alle optioneel):
       onStart()             bij het starten van MeMeet, of direct na aanzetten
       onTick()              elke minuut
       installHtml() / bindInstall(root)   een eigen onderdeel in het installatiescherm
       homeHtml() / bindHome(root)         een blok op de pagina Vergaderingen
       helpHtml (tekst of functie) / bindHelp(root)   een onderwerp in de help (tabblad Uitbreidingen)
       onCleanup()           meedoen met het jaarlijks opschonen
       onDisable()           bij uitzetten: alles opruimen
       forget: { vraag, run() }   een vraag na het uitzetten, bijvoorbeeld om een koppeling te vergeten
     Elke aanroep staat in try/catch: een fout pauzeert alleen die uitbreiding (tot de volgende start of tot Opnieuw starten). */
  var PLUGINS = [], PL = { timer: null };
  function registerPlugin(p) { if (p && p.id && !PLUGINS.some(function (x) { return x.id === p.id; })) PLUGINS.push(p); }
  function plugin(id) { return PLUGINS.filter(function (p) { return p.id === id; })[0]; }
  function plState(id) { var all = A.data.plugins || (A.data.plugins = {}); return all[id] || (all[id] = { on: false }); }
  function plEnabled(p) { return !!(A.data && A.data.plugins && A.data.plugins[p.id] && A.data.plugins[p.id].on); }
  function plOn(p) { return plEnabled(p) && !p._paused; }
  function plFail(p, hook, e) {
    console.error('Uitbreiding ' + p.id + ' (' + hook + ')', e);
    if (p._paused) return; p._paused = true; plTimer();
    try { if (typeof p.onDisable === 'function') p.onDisable(true); } catch (e2) {}
    toast('Uitbreiding ' + p.naam + ' gaf een fout en is gepauzeerd.', 'err');
  }
  /* één haakje van één uitbreiding aanroepen; geeft het resultaat (of een Promise) terug, of undefined bij uit/fout */
  function plCall(p, hook, args) {
    if (!plOn(p) || typeof p[hook] !== 'function') return;
    try { var r = p[hook].apply(p, args || []); if (r && typeof r.then === 'function') return r.catch(function (e) { plFail(p, hook, e); }); return r; }
    catch (e) { plFail(p, hook, e); }
  }
  async function plCallAll(hook, args) { for (var i = 0; i < PLUGINS.length; i++) await plCall(PLUGINS[i], hook, args); }
  function plHtml(hook) { return PLUGINS.map(function (p) { var h = plCall(p, hook); return typeof h === 'string' ? h : ''; }).join(''); }
  function plBind(hook, root) { PLUGINS.forEach(function (p) { plCall(p, hook, [root]); }); }
  /* één timer voor alle uitbreidingen, alleen als er een aanstaat */
  function plTimer() {
    var any = PLUGINS.some(function (p) { return plOn(p) && typeof p.onTick === 'function'; });
    if (any && !PL.timer) PL.timer = setInterval(function () { PLUGINS.forEach(function (p) { plCall(p, 'onTick'); }); }, 60000);
    if (!any && PL.timer) { clearInterval(PL.timer); PL.timer = null; }
  }
  async function plStartAll() { for (var i = 0; i < PLUGINS.length; i++) { PLUGINS[i]._paused = false; await plCall(PLUGINS[i], 'onStart'); } plTimer(); }

  /* ---------- lijst met uitbreidingen (help, tabblad Uitbreidingen, en installatiescherm) */
  function plListHtml() {
    if (!PLUGINS.length) return '<p class="muted">Er zijn geen uitbreidingen.</p>';
    return '<p>Uitbreidingen zitten in MeMeet, maar staan standaard uit. Zolang een uitbreiding uitstaat, doet hij niets: geen knoppen, geen meldingen en geen toegang tot bestanden. Je keuze wordt bewaard in je datamap.</p>' +
      PLUGINS.map(function (p) {
        var on = plEnabled(p);
        return '<div class="plcard' + (on ? ' on' : '') + '" data-plid="' + esc(p.id) + '"><div class="plhead"><b>' + esc(p.naam) + '</b>' +
          (p._paused && on ? '<span class="plpaused">gepauzeerd</span><button type="button" class="btn sm" data-plrestart="' + esc(p.id) + '">Opnieuw starten</button>' : '') +
          '<label class="plswitch"><input type="checkbox" role="switch" data-plt="' + esc(p.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(p.naam) + ' aan of uit"><span>' + (on ? 'Aan' : 'Uit') + '</span></label></div>' +
          '<p>' + esc(p.omschrijving) + '</p><p class="plpriv"><b>Privacy:</b> ' + esc(p.privacy) + '</p></div>';
      }).join('');
  }
  function plBindList(root, after) {
    $$('[data-plt]', root).forEach(function (cb) { cb.onchange = async function () {
      var p = plugin(cb.dataset.plt); if (!p) return;
      if (cb.checked) { cb.checked = false; if (await plConfirm(p)) await plEnable(p); }
      else await plDisable(p);
      after && after();
    }; });
    $$('[data-plrestart]', root).forEach(function (b) { b.onclick = async function () { var p = plugin(b.dataset.plrestart); if (!p) return; p._paused = false; await plCall(p, 'onStart'); plTimer(); after && after(); route(); }; });
  }
  /* bevestiging bij aanzetten, met de privacytekst */
  function plConfirm(p) {
    return new Promise(function (res) {
      var bg = D.createElement('div'); bg.className = 'dlgbg'; bg.id = 'plDlg';
      setHTML(bg, '<div class="dlg pldlg" role="dialog" aria-modal="true" aria-labelledby="plT"><h2 id="plT">' + esc(p.naam) + ' aanzetten?</h2><p>' + esc(p.omschrijving) + '</p>' +
        '<p class="plpriv"><b>Privacy:</b> ' + esc(p.privacy) + '</p><div class="dlgacts"><button type="button" class="btn pri" id="plYes">Aanzetten</button><button type="button" class="btn" id="plNo">Annuleren</button></div></div>');
      D.body.appendChild(bg);
      function end(v) { bg.remove(); res(v); }
      $('#plYes', bg).onclick = function () { end(true); }; $('#plNo', bg).onclick = function () { end(false); };
      bg.addEventListener('mousedown', function (e) { if (e.target === bg) end(false); });
      bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); end(false); } });
      try { $('#plYes', bg).focus(); } catch (e) {}
    });
  }
  async function plEnable(p) {
    plState(p.id).on = true; p._paused = false; await persist();
    await plCall(p, 'onStart'); plTimer();
    toast(p.naam + ' staat aan.', 'ok'); route();
  }
  async function plDisable(p) {
    try { if (typeof p.onDisable === 'function') await p.onDisable(false); } catch (e) { console.error(e); }
    plState(p.id).on = false; p._paused = false; await persist(); plTimer();
    route();
    if (p.forget && confirm(p.forget.vraag)) { try { await p.forget.run(); } catch (e) { console.error(e); } }
    toast(p.naam + ' staat uit.', 'ok');
  }
  /* help: tabblad Uitbreidingen = de lijst, en daaronder de uitleg van elke uitbreiding die aanstaat */
  function plHelpHtml() {
    return '<h2 class="helph">Uitbreidingen</h2>' + plListHtml() + PLUGINS.map(function (p) {
      if (!plOn(p)) return ''; var h = typeof p.helpHtml === 'function' ? plCall(p, 'helpHtml') : p.helpHtml; return h ? '<hr><h2 class="helph">' + esc(p.naam) + '</h2>' + h : '';
    }).join('');
  }
  function plBindHelp(body, rerender) { plBindList(body, rerender); plBind('bindHelp', body); }
