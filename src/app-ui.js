  /* MeMeet - app-ui: schermen (startscherm, vergadering, stukkenlijst), thema en het starten van de app */
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
    if (h === '#/herinneringen') return renderReminders();
    /* het tabblad Meeneempunten (eerder Bespreekpunten, Annotaties) bestaat niet meer: zulke oude adressen gaan naar het startscherm */
    if (/^#\/(meeneempunt|bespreekpunt|annotatie)/.test(h)) { location.replace('#/'); return; }
    if (h === '#/bestanden') return renderFiles(true);
    renderHome();
  }
  function byId(id) { return A.data.meetings.filter(function (m) { return m.id === id; })[0]; }
  function currentMeeting() { var h = location.hash; if (h === '#/nieuw') return A.draft; var mm = /^#\/v\/(.+)$/.exec(h); return mm ? byId(decodeURIComponent(mm[1])) : null; }
  function blankDraft() { return { id: uid(), isNew: true, type: 'Overleg', title: '', location: '', link: '', ibabs: '', date: todayIso(), start: '', end: '', chair: '', invitees: '', notes: '', source: null, files: [], pending: [] }; }

  function renderSide() {
    var s = $('#side'), h = '', hs = location.hash || '#/';
    h += '<nav class="topnav"><a href="#/" class="' + (/^#\/(v\/|nieuw)?$/.test(hs) || hs === '#/' ? 'on' : '') + '">Vergaderingen</a><a href="#/herinneringen" class="' + (hs === '#/herinneringen' ? 'on' : '') + '">Herinneringen</a><a href="#/acties" class="' + (hs === '#/acties' ? 'on' : '') + '">Actielijst</a><a href="#/verslagen" class="' + (/^#\/verslag/.test(hs) ? 'on' : '') + '">Verslagen</a><a href="#/bestanden" class="' + (hs === '#/bestanden' ? 'on' : '') + '">Bestanden</a></nav><span class="sp"></span>';
    if (A.store) {
      h += '<button type="button" class="tinfo" id="chgStore" title="' + esc('Alle vergaderingen, stukken en aantekeningen staan ' + (A.store.kind === 'map' ? 'in de map ' + A.store.name : 'in de browser, alleen op deze computer') + '. Klik om een andere datamap te kiezen.') + '">' + ic('folder') + ' Wijzig datamap</button>';
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
      (fsOk ? '<p><button class="btn pri" id="pickDir">' + ic('folder') + ' Datamap kiezen…</button> <a class="btn" href="#/installatie">Uitgebreide uitleg</a></p>' : '<p class="note">Deze browser kan geen map op je computer gebruiken. Open MeMeet in Microsoft Edge of Google Chrome.</p>') +
      '<p class="note"><b>Back-up:</b> kopieer af en toe de hele map <b>memeet-data</b>, mét het bestand <b>memeet.json</b> erin, naar bijvoorbeeld OneDrive of een netwerkschijf. Terugzetten doe je door die map weer als datamap te kiezen. Meer uitleg vind je onder de knop <b>?</b> rechtsboven.</p>' +
      '<p class="note">Mag je geen map kiezen? <button class="link" id="useIdb">Bewaar alles in de browser</button> (alleen op deze computer, zonder bestanden).</p>' +
      (A.hadDir ? '<button class="btn" id="recon">Verder met de vorige map</button>' : '') + '</div>');
    var p = $('#pickDir'); if (p) p.onclick = chooseFolder;
    $('#useIdb').onclick = function () { useStore(new BrowserStore()); };
    var r = $('#recon'); if (r) r.onclick = reconnect;
  }
  function row(m, cols) {
    return '<tr data-id="' + esc(m.id) + '">' + cols.map(function (c) { return '<td class="c-' + c + '">' + cell(m, c) + '</td>'; }).join('') + '</tr>';
  }
  function cell(m, c) {
    if (c === 'date') return esc(fmtShort(m.date));
    if (c === 'files') return m.files.length ? '<span class="pill">' + m.files.length + '</span>' : '';
    if (c === 'title') { var n = A.ibHome ? ibCountFor(m, A.ibHome) : 0; return '<b>' + esc(m.title) + '</b>' + (n ? ' <span class="ibbadge" title="Punten om in te brengen">' + n + ' inbrengen</span>' : ''); }
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
    var ibA = ibAll(); A.ibHome = ibA; function ibC(m) { return ibCountFor(m, ibA); }
    var t = todayIso(), ms = A.data.meetings;
    var today = ms.filter(function (m) { return m.date === t; }).sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; });
    function dayList(arr) { return '<ul class="tl">' + arr.map(function (m) {
        return '<li data-id="' + esc(m.id) + '"><span class="tm">' + esc(m.start || '—') + (m.end ? '<small>' + esc(m.end) + '</small>' : '') + '</span><span class="tt"><b>' + esc(m.title) + '</b><small>' + esc(m.location || '') + '</small></span><span class="tact"><span class="tin">' + (ibC(m) ? '<span class="ibbadge" title="Punten om in te brengen">' + ibC(m) + ' inbrengen</span>' : '') + '</span><span class="tst">' + (m.files.length ? '<span class="pill">' + m.files.length + ' stuk' + (m.files.length > 1 ? 'ken' : '') + '</span>' : '') + '</span><span class="tib">' + (m.ibabs ? '<button type="button" class="btn sm ibabs" data-ib="' + esc(m.id) + '" title="Stukken in iBabs, in een eigen tabblad">iBabs</button>' : '') + '</span><span class="tjn">' + (m.link ? '<a class="btn sm join" href="' + esc(m.link) + '" target="_blank" rel="noopener" title="Deelnemen aan de online vergadering">' + ic('videocam') + ' Deelnemen</a>' : '') + '</span></span></li>';
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
    var h = '<section class="quote" id="quote"><div class="qhi"><b>' + greet + '</b><span>' + sum + '</span></div><figure class="qfig"><blockquote id="qtxt">' + esc(Q[A.qi][0]) + '</blockquote><figcaption id="qwho">' + esc(Q[A.qi][1]) + '</figcaption></figure><button type="button" class="qnext" id="qnext" title="Andere wijsheid" aria-label="Andere wijsheid">' + ic('refresh') + '</button></section>';
    h += ibBannerHtml(ibA);
    h += '<div class="head"><h1>Vergaderingen</h1><div class="acts"><a class="btn" href="#/weekagenda" title="Je Outlook-agenda van de komende dagen in één keer inlezen">' + ic('calendar_month') + ' Importeer weekagenda</a><a class="btn pri" href="#/nieuw" id="new">' + ic('add') + ' Nieuwe vergadering</a></div></div>';
    h += '<div class="dropbar">Sleep een mail of agenda-uitnodiging uit Outlook naar dit venster. Er wordt dan een vergadering aangemaakt, met de stukken als bijlage.</div>';
    var nowD = new Date(), late = nowD.getHours() * 60 + nowD.getMinutes() >= 20 * 60 + 30;
    /* alle vier de onderdelen (vandaag, morgen, volgende, archief) staan standaard open; dichtklappen geldt tot je MeMeet opnieuw opent */
    if (A.showToday == null) A.showToday = true;
    h += '<section class="card today arch"><button type="button" class="archbtn daybtn" id="tdy" aria-expanded="' + (A.showToday ? 'true' : 'false') + '"><span>' + (!today.length ? '' : A.showToday ? '' + ic('keyboard_arrow_down') + '' : '' + ic('chevron_right') + '') + '</span> Vandaag <span class="muted">' + esc(fmtLong(t)) + ' · ' + (today.length ? today.length + ' vergadering' + (today.length === 1 ? '' : 'en') : 'geen vergaderingen') + '</span><span class="sp"></span>' + (today.length ? '<span class="link">' + (A.showToday ? 'verbergen' : 'weergeven') + '</span>' : '') + '</button>';
    if (!A.showToday) { /* ingeklapt */ }
    else if (today.length) {
      h += dayList(today);
    } /* geen vergaderingen vandaag: niets eronder (de kop zegt het al) */
    h += '</section>';
    if (A.showTomorrow == null) A.showTomorrow = true; /* standaard open */
    h += '<section class="card today tomorrow arch"><button type="button" class="archbtn daybtn" id="tmr" aria-expanded="' + (A.showTomorrow ? 'true' : 'false') + '"><span>' + (!tomorrow.length ? '' : A.showTomorrow ? '' + ic('keyboard_arrow_down') + '' : '' + ic('chevron_right') + '') + '</span> Morgen <span class="muted">' + esc(fmtLong(tmw)) + ' · ' + (tomorrow.length ? tomorrow.length + ' vergadering' + (tomorrow.length === 1 ? '' : 'en') : 'geen vergaderingen') + '</span><span class="sp"></span>' + (tomorrow.length ? '<span class="link">' + (A.showTomorrow ? 'verbergen' : 'weergeven') + '</span>' : '') + '</button>' +
      (A.showTomorrow && tomorrow.length ? dayList(tomorrow) : '') + '</section>';
    /* wachtende punten en ideeën (alleen als er iets is) */
    var nWait = ibA.pts.filter(function (p) { return p.r.st === 'wait'; }).length;
    if (nWait || ibA.ideas.length) h += '<div class="ibgrid ibhome">' + (nWait ? ibWaitHtml(ibA) : '') + (ibA.ideas.length ? ibIdeasHtml(ibA) : '') + '</div>';
    if (A.showUp == null) A.showUp = true;
    if (A.showArch == null) A.showArch = true;
    var showF = A.showUp || A.showArch || q || f.year;
    if (showF) h += '<section class="card fcard"><div class="filters"><input id="q" type="search" placeholder="Zoeken op titel, locatie, namen of aantekeningen…" value="' + esc(f.q) + '">' +
      '<select id="fYear"><option value="">Alle jaren</option>' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (f.year === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div></section>';
    var cols = [['title', 'Titel'], ['date', 'Datum'], ['start', 'Start'], ['end', 'Eind'], ['location', 'Locatie'], ['files', 'Stukken']];
    var hs = A.hsel || (A.hsel = {}); Object.keys(hs).forEach(function (id) { if (!byId(id)) delete hs[id]; });
    var nSel = Object.keys(hs).length;
    h += '<div class="bulkbar" id="bulkbar"' + (nSel ? '' : ' hidden') + '><b id="bulkN"></b><button type="button" class="btn sm danger" id="bulkDel">' + ic('delete') + ' Verwijderen</button><button type="button" class="link" id="bulkClr">Selectie opheffen</button></div>';
    function tbl(rows, empty, arch) {
      rows = sorted(rows, arch);
      var allOn = rows.length && rows.every(function (m) { return hs[m.id]; });
      var o = '<div class="tw"><table class="mtb"><thead><tr><th class="cb"><input type="checkbox" data-all="' + (arch ? 'arch' : 'up') + '" title="Alles in deze lijst selecteren"' + (allOn ? ' checked' : '') + '></th>' + cols.map(function (c) { var on = A.sort.key === c[0], dn = A.sort.dir * (arch && c[0] === 'date' ? -1 : 1) < 0; return '<th class="c-' + c[0] + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + '<i>' + (on ? (dn ? '' + ic('arrow_downward') + '' : '' + ic('arrow_upward') + '') : '' + ic('unfold_more') + '') + '</i></th>'; }).join('') + '</tr></thead><tbody>';
      o += rows.length ? rows.map(function (m) { return row(m, cols.map(function (c) { return c[0]; })).replace('<tr data-id="' + esc(m.id) + '">', '<tr data-id="' + esc(m.id) + '"' + (hs[m.id] ? ' class="sel"' : '') + '><td class="cb"><input type="checkbox" data-hs="' + esc(m.id) + '"' + (hs[m.id] ? ' checked' : '') + '></td>'); }).join('') : '<tr><td colspan="7" class="empty">' + empty + '</td></tr>';
      return o + '</tbody></table></div>';
    }
    var upcoming = list.filter(function (m) { return !m.date || m.date > tmw; }), past = list.filter(function (m) { return m.date && m.date < t; });
    A.hlists = { up: sorted(upcoming), arch: sorted(past, true) };
    h += '<section class="card arch upc"><button type="button" class="archbtn" id="upc" aria-expanded="' + (A.showUp ? 'true' : 'false') + '"><span>' + (A.showUp ? '' + ic('keyboard_arrow_down') + '' : '' + ic('chevron_right') + '') + '</span> Volgende vergaderingen <span class="muted">' + upcoming.length + ' vergadering' + (upcoming.length === 1 ? '' : 'en') + (q || f.year ? ' met deze filters' : '') + '</span><span class="sp"></span><span class="link">' + (A.showUp ? 'verbergen' : 'weergeven') + '</span></button>';
    if (A.showUp) h += '<div class="upbody">' + tbl(upcoming, ms.length ? (past.length ? 'Geen komende vergaderingen' + (q || f.year ? ' met deze filters' : '') + '. Eerdere vergaderingen staan in het archief.' : 'Geen vergaderingen gevonden met deze filters.') : 'Nog geen vergaderingen. Sleep een mail naar dit venster om te beginnen.');
    if (A.showUp) h += '<p class="note">Klik op een kolomkop om te sorteren.</p></div>';
    h += '</section>';
    h += '<section class="card arch"><button type="button" class="archbtn" id="arch"><span>' + (A.showArch ? '' + ic('keyboard_arrow_down') + '' : '' + ic('chevron_right') + '') + '</span> Archief <span class="muted">' + past.length + ' eerdere vergadering' + (past.length === 1 ? '' : 'en') + (q || f.year ? ' met deze filters' : '') + '</span><span class="sp"></span><span class="link">' + (A.showArch ? 'verbergen' : 'weergeven') + '</span></button>';
    if (A.showArch) h += tbl(past, 'Geen eerdere vergaderingen' + (q || f.year ? ' met deze filters' : '') + '.', true);
    h += '</section>';
    setHTML($('#main'), h);
    function keepScroll(fn) { var sy = W.scrollY; fn(); renderHome(); W.scrollTo(0, Math.min(sy, D.documentElement.scrollHeight)); }
    $('#arch').onclick = function () { keepScroll(function () { A.showArch = !A.showArch; }); };
    $('#upc').onclick = function () { keepScroll(function () { A.showUp = !A.showUp; }); };
    $('#tdy').onclick = function () { keepScroll(function () { A.showToday = !A.showToday; }); };
    $('#tmr').onclick = function () { keepScroll(function () { A.showTomorrow = !A.showTomorrow; }); };
    var qn = $('#qnext'); if (qn) qn.onclick = function () { A.qi = qPick(); var f = $('#quote'); f.classList.remove('in'); void f.offsetWidth; $('#qtxt').textContent = Q[A.qi][0]; $('#qwho').textContent = Q[A.qi][1]; f.classList.add('in'); };
    ibBindLists($('#main'), ibA, renderHome);
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
    /* één compacte regel: titel, datum, tijd, locatie, links en knoppen (zo blijft er zoveel mogelijk ruimte voor de stukken).
       Een bestaande vergadering wordt vanzelf bewaard zodra je een veld wijzigt; alleen een nieuwe vergadering heeft Opslaan. */
    var inv = names(m.invitees), invShort = inv.map(function (n) { return String(n).split(/\s+/)[0].split('@')[0]; });
    h += '<form class="card meta mline" id="frm" autocomplete="off"><a class="btn sm" href="#/" title="Terug naar de vergaderingen">' + ic('arrow_back') + ' Terug</a><input class="ttl" name="title" required placeholder="Titel van de vergadering" title="Titel" value="' + esc(m.title) + '">' +
      '<input type="date" name="date" title="Datum" value="' + esc(m.date) + '"><span class="tsp"><input type="time" name="start" title="Van" value="' + esc(m.start) + '">–<input type="time" name="end" title="Tot" value="' + esc(m.end) + '"></span>' +
      '<input class="loc" name="location" placeholder="Locatie" title="Locatie" value="' + esc(m.location) + '">' +
      (inv.length ? '<span class="minv" title="Deelnemers: ' + esc(inv.join(', ')) + '">' + ic('group') + ' ' + esc(invShort.slice(0, 3).join(', ') + (inv.length > 3 ? ' +' + (inv.length - 3) : '')) + '</span>' : '') +
      (!isNew && m.date && ibFinished(m) ? '<span class="mdone" title="Dit overleg is voorbij">Afgerond</span>' : '') +
      '<span class="lk"><a class="btn sm join" id="joinBtn" target="_blank" rel="noopener" title="Deelnemen aan de online vergadering" href="' + esc(m.link || '#') + '">' + ic('videocam') + ' Deelnemen</a><button type="button" class="btn sm icon" id="linkEd" title="' + (m.link ? 'Vergaderlink wijzigen' : 'Vergaderlink toevoegen (Teams, Zoom …)') + '" aria-label="Vergaderlink">' + ic('link') + '</button></span>' +
      '<span class="lk"><button type="button" class="btn sm ibabs" id="ibBtn">iBabs</button><button type="button" class="btn sm icon" id="ibEd" aria-label="iBabs-link">' + ic('link') + '</button></span>' +
      '<span class="macts">' + (isNew ? '<button type="submit" class="btn sm pri" id="save">Opslaan</button>' : '<span class="svst" id="svst"></span><button type="button" class="btn sm red icon" id="del" title="Vergadering verwijderen" aria-label="Vergadering verwijderen">' + ic('delete') + '</button>') + '</span></form>';
    h += '<div class="ws' + (!isNew ? ' n3' : '') + '"><section class="card list"><div class="shead"><h2>Stukken <span class="muted">' + list.length + '</span></h2></div>';
    /* het vervolgdocument van het vorige overleg met deze titel (besluiten, acties, meeneempunten) */
    var dsel = isNew ? {} : docSel(m);
    h += '<ul class="docs" id="docs">';
    list.forEach(function (f, i) {
      if (isNew) {
        h += '<li data-sel="' + i + '"><div class="dl1"><input type="checkbox" data-p="' + i + '"' + (f.on ? ' checked' : '') + ' title="Meenemen bij opslaan"><span class="fn">' + esc(f.name) + '</span></div>' +
          (f.inline ? '<div class="dl2"><small>afbeelding uit de mailtekst</small></div>' : '') + '</li>';
      } else {
        /* één regel per stuk: nummer, naam en verwijderen. Bijzonderheden staan in de tooltip van de naam; ordenen gaat door te slepen,
           het origineel downloaden via ⋯ in de viewer. */
        var na = annCount(f.ann), tip = f.name + (f.conv === 'vervangen' ? '\nDe viewer toont de PDF-versie die je erbij hebt gezet.' : '') + (!canView(f.name, f.type) ? '\nDit bestandstype kan de viewer niet tonen; download het origineel via ⋯ in de viewer.' : '') + (na ? '\n' + na + ' aantekening' + (na === 1 ? '' : 'en') + ' in dit stuk.' : '');
        h += '<li data-sel="' + i + '" draggable="true"' + (dsel[f.name] ? ' class="picked"' : '') + '><div class="dl1"><span class="num">' + (i + 1) + '</span><span class="fn" title="' + esc(tip) + '">' + esc(f.name) + '</span>' +
          '<button type="button" class="link red rmx" data-rm="' + i + '" title="Verwijderen" aria-label="' + esc(f.name) + ' verwijderen">' + ic('close') + '</button></div></li>';
      }
    });
    if (!list.length) h += '<li class="muted empty">Nog geen stukken.</li>';
    h += '</ul><div class="dz small" id="addDocs" role="button" tabindex="0" title="Klik om stukken te kiezen">Sleep documenten of een mail hierheen, of klik om ze te kiezen</div>';
    /* Outlook-items in de mail (bij terugkerende afspraken vaak tientallen naamloze uitzonderingen) worden stil overgeslagen */
    if (m.source && m.source.how === 'agenda-export') h += '<p class="note">Uit je Outlook-agenda.</p>';
    else if (m.source) h += '<p class="note">Uit de mail' + (m.source.from ? ' van ' + esc(m.source.from) : '') + (m.source.sent ? ', ' + esc(new Date(m.source.sent).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })) : '') + '.' + (m.source.file && !isNew ? ' <a href="#" id="origMail">Originele mail</a>' : '') + '</p>';
    h += '</section>' + (isNew ? '' : '<div class="lsgrip" id="lsgrip" title="Sleep om de kolom met stukken breder of smaller te maken (dubbelklik: standaard)"></div>') + '<section class="card pv" id="pv"></section><section class="card np" id="np"></section></div>';
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
        } else { await autoSave(); }
      } catch (er) { var sb = $('#save'); if (sb) sb.disabled = false; toast('Opslaan mislukt: ' + (er.message || er), 'err'); }
    };
    /* een bestaande vergadering: elk gewijzigd veld wordt meteen bewaard */
    async function autoSave() {
      if (isNew) return; readForm();
      if (!m.title) { toast('Vul een titel in.', 'warn'); return; }
      m.updated = new Date().toISOString(); await persist(); renderSide();
      var st = $('#svst'); if (st) { setHTML(st, 'opgeslagen ' + ic('check')); clearTimeout(autoSave.t); autoSave.t = setTimeout(function () { var s2 = $('#svst'); if (s2) s2.textContent = ''; }, 1800); }
    }
    if (!isNew) $$('[name]', frm).forEach(function (x) { if (x.name !== 'link' && x.name !== 'ibabs') x.addEventListener('change', autoSave); });
    var del = $('#del'); if (del) del.onclick = async function () {
      if (!confirm('Vergadering "' + m.title + '" verwijderen?\n\nAlle bestanden van deze vergadering worden gewist: de stukken, de originele mail en alle gewijzigde versies.' + (m.minutes ? '\nJe aantekeningen blijven staan in de map Aantekeningen.' : ''))) return;
      try { await A.store.delMeeting(m); } catch (er) { toast('Verwijderen van de bestanden mislukt: ' + (er.message || er), 'err'); return; }
      A.data.meetings = A.data.meetings.filter(function (x) { return x !== m; }); await persist();
      try { await writeNotesFiles(null); } catch (e) {}
      toast('Verwijderd.'); location.hash = '#/';
    };
    $('#addDocs').onclick = function () { readForm(); $('#pickDocs').click(); };
    $('#addDocs').onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } };
    /* Meeneempunten: het vervolgdocument van het vorige overleg met deze titel, als popup */
    $$('[data-p]').forEach(function (c) { c.onclick = function (e) { e.stopPropagation(); }; c.onchange = function () { m.pending[+c.dataset.p].on = c.checked; }; });
    if (isNew) $$('#docs li[data-sel]').forEach(function (li) { li.onclick = function (e) { if (e.target.closest('button,input')) return; pvShow(m, +li.dataset.sel); }; });
    else bindDocList(m);
    bindListGrip();
    $$('[data-rm]').forEach(function (a) { a.onclick = async function () { var f = m.files[+a.dataset.rm]; if (!confirm('"' + f.name + '" verwijderen' + (annCount(f.ann) ? ', inclusief je aantekeningen' : '') + '?')) return; readForm(); await A.store.del(m, f.name); if (f.pdf && f.pdf !== f.name) await A.store.del(m, f.pdf); for (var vi = 0, ov = olderOf(f); vi < ov.length; vi++) await A.store.del(m, ov[vi]); m.files.splice(+a.dataset.rm, 1); await persist(); renderDetail(m); }; });
    var om = $('#origMail'); if (om) om.onclick = async function (e) { e.preventDefault(); dl(await A.store.get(m, m.source.file), m.source.file); };
    $$('[name]', frm).forEach(function (x) { x.addEventListener('input', function () { m[x.name] = x.value; }); });
    bindFolders($('#main'));
    /* Vergaderlink en iBabs-link: geen invoervakken. Zonder link is de knop grijs; met het link-icoon ernaast (of een klik op de
       grijze knop) plak je de link. Een leeg vak haalt de link weg. Een bestaande vergadering wordt meteen bewaard. */
    var jb = $('#joinBtn'), le = $('#linkEd'), ibB = $('#ibBtn'), ibE = $('#ibEd');
    function isUrl(v) { return /^https?:\/\//i.test(String(v || '').trim()); }
    function upd() {
      var ok = isUrl(m.link); jb.classList.toggle('off', !ok); jb.href = ok ? m.link : '#';
      jb.title = ok ? 'Deelnemen aan de online vergadering' : 'Nog geen vergaderlink. Klik om er een te plakken.';
      le.title = ok ? 'Vergaderlink wijzigen' : 'Vergaderlink toevoegen (Teams, Zoom …)';
      var oi = isUrl(m.ibabs); ibB.classList.toggle('off', !oi);
      ibB.title = oi ? 'De stukken in iBabs openen, in een eigen tabblad' : 'Nog geen iBabs-link. Klik om er een te plakken.';
      ibE.title = oi ? 'iBabs-link wijzigen' : 'iBabs-link toevoegen';
    }
    async function askLink(key, what, hint) {
      var v = prompt(what + (hint ? ' (' + hint + ')' : '') + '.\nLaat het vak leeg om de link weg te halen.', m[key] || ''); if (v === null) return false;
      v = v.trim(); if (v && !isUrl(v)) { toast('Dat is geen geldige link: hij moet met https:// beginnen.', 'warn'); return false; }
      m[key] = v; upd(); if (!isNew) { m.updated = new Date().toISOString(); await persist(); toast(v ? what + ' bewaard.' : what + ' weggehaald.', 'ok'); }
      return true;
    }
    le.onclick = function () { askLink('link', 'Vergaderlink', 'Teams, Zoom of een andere link'); };
    ibE.onclick = function () { askLink('ibabs', 'iBabs-link', 'de link naar de vergadering in iBabs'); };
    jb.addEventListener('click', function (e) { if (!isUrl(m.link)) { e.preventDefault(); le.click(); } });
    ibB.onclick = function () { readForm(); if (!isUrl(m.ibabs)) { ibE.click(); return; } openIbabs(m); };
    upd();
    if (!isNew && m.link === undefined && m.source && m.source.file) {
      A.store.get(m, m.source.file).then(function (b) { return parseMailFile(b); }).then(async function (pm) { m.link = pm.r.link || ''; await persist(); if (m.link && currentMeeting() === m) { upd(); toast('Vergaderlink gevonden in de originele mail.', 'ok'); } }).catch(function () { m.link = ''; });
    }
    if (!isNew) renderNotes(m); /* de aantekeningen staan altijd open */
    pvShow(m, sel);
  }
  /* ---------- stukken: meer tegelijk selecteren (Ctrl+klik, Shift+klik) en slepen om de volgorde te veranderen */
  function docSel(m) {
    A.docSel = A.docSel || {}; var s = A.docSel[m.id] || (A.docSel[m.id] = {});
    Object.keys(s).forEach(function (k) { if (!m.files.some(function (f) { return f.name === k; })) delete s[k]; });
    return s;
  }
  function isDocDrag(e) { return Array.prototype.indexOf.call((e.dataTransfer && e.dataTransfer.types) || [], 'text/x-memeet-stukken') >= 0; }
  function bindDocList(m) {
    var ul = $('#docs'); if (!ul) return; var sel = docSel(m);
    function items() { return $$('#docs li[data-sel]'); }
    function paint() { items().forEach(function (li) { var f = m.files[+li.dataset.sel]; li.classList.toggle('picked', !!(f && sel[f.name])); }); }
    function clear() { Object.keys(sel).forEach(function (k) { delete sel[k]; }); }
    function marks() { items().forEach(function (li) { li.classList.remove('drop-before', 'drop-after'); }); }
    items().forEach(function (li) {
      var i = +li.dataset.sel, f = m.files[i];
      li.onclick = function (e) {
        if (e.target.closest('button,input,a')) return;
        if (e.ctrlKey || e.metaKey) { if (sel[f.name]) delete sel[f.name]; else sel[f.name] = 1; A.docAnchor = { id: m.id, i: i }; paint(); return; }
        if (e.shiftKey && A.docAnchor && A.docAnchor.id === m.id) { clear(); for (var k = Math.min(A.docAnchor.i, i); k <= Math.max(A.docAnchor.i, i); k++) sel[m.files[k].name] = 1; paint(); return; }
        clear(); sel[f.name] = 1; A.docAnchor = { id: m.id, i: i }; paint(); pvShow(m, i);
      };
      li.addEventListener('dragstart', function (e) {
        if (!sel[f.name]) { clear(); sel[f.name] = 1; paint(); }
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-memeet-stukken', Object.keys(sel).join('\n'));
        ul.classList.add('dragging');
      });
      li.addEventListener('dragend', function () { ul.classList.remove('dragging'); marks(); });
      li.addEventListener('dragover', function (e) {
        if (!isDocDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        var r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2; marks(); li.classList.add(after ? 'drop-after' : 'drop-before');
      });
      li.addEventListener('drop', function (e) {
        if (!isDocDrag(e)) return; e.preventDefault(); e.stopPropagation();
        var r = li.getBoundingClientRect(); marks(); moveDocs(m, i, e.clientY > r.top + r.height / 2);
      });
    });
  }
  /* de geselecteerde stukken (in hun huidige volgorde) vóór of na stuk nummer target zetten */
  async function moveDocs(m, target, after) {
    var sel = docSel(m), tf = m.files[target]; if (!tf || sel[tf.name]) return;
    var viewed = m.files[A.sel && A.sel.id === m.id ? A.sel.i : 0];
    var moving = m.files.filter(function (f) { return sel[f.name]; }), rest = m.files.filter(function (f) { return !sel[f.name]; });
    if (!moving.length) return;
    var at = rest.indexOf(tf) + (after ? 1 : 0); rest.splice.apply(rest, [at, 0].concat(moving)); m.files = rest;
    if (viewed) A.sel = { id: m.id, i: m.files.indexOf(viewed) };
    m.updated = new Date().toISOString(); await persist(); renderDetail(m);
  }
  /* ---------- de kolom met stukken breder of smaller slepen */
  function lwDefault() { var ws = $('.ws'); return ws && ws.classList.contains('n3') ? 260 : 300; }
  function applyLw() { var ws = $('.ws'); if (!ws) return; var w = 0; try { w = +localStorage.getItem('memeet-lw') || 0; } catch (e) {} ws.style.setProperty('--lw', (w || lwDefault()) + 'px'); }
  function bindListGrip() {
    applyLw(); var g = $('#lsgrip'); if (!g) return;
    function relayout() { if (PV.fit && $('#pvp') && PV.pages) layoutPages(); }
    g.onmousedown = function (e) {
      e.preventDefault(); var ws = $('.ws'), left = ws.getBoundingClientRect().left; D.body.classList.add('lsdrag');
      function mv(ev) { var w = Math.round(Math.max(180, Math.min(ev.clientX - left, ws.clientWidth * 0.55))); ws.style.setProperty('--lw', w + 'px'); try { localStorage.setItem('memeet-lw', String(w)); } catch (er) {} }
      function up() { D.removeEventListener('mousemove', mv); D.removeEventListener('mouseup', up); D.body.classList.remove('lsdrag'); relayout(); }
      D.addEventListener('mousemove', mv); D.addEventListener('mouseup', up);
    };
    g.ondblclick = function () { try { localStorage.removeItem('memeet-lw'); } catch (e) {} applyLw(); relayout(); };
  }
  function annCount(a) { if (!a) return 0; return Object.keys(a).reduce(function (n, k) { return n + (a[k] ? a[k].length : 0); }, 0); }

  /* ------------------------------------------------------------- start */
  function initDrop() {
    var ov = $('#overlay'), depth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    D.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; var c = currentMeeting(); $('#ovText').textContent = location.hash === '#/acties' ? 'Laat de mail los: het onderwerp wordt een actie' : c ? 'Laat los om toe te voegen aan "' + (c.title || 'deze vergadering') + '"' : 'Laat los om een vergadering aan te maken'; ov.className = 'on'; });
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
  /* donkere modus: de schakelaar rechtsboven. Zonder eigen keuze volgt MeMeet de instelling van Windows. */
  function curTheme() { return D.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function setTheme(t, save) {
    D.documentElement.dataset.theme = t;
    var b = $('#themeBtn'); if (b) { var dk = t === 'dark'; b.setAttribute('aria-checked', dk ? 'true' : 'false'); b.title = dk ? 'Lichte modus' : 'Donkere modus'; setHTML(b, ic(dk ? 'light_mode' : 'dark_mode')); }
    if (save) { try { localStorage.setItem('memeet-theme', t); } catch (e) {} }
  }
  function initTheme() {
    var saved = null; try { saved = localStorage.getItem('memeet-theme'); } catch (e) {}
    var mq = W.matchMedia ? W.matchMedia('(prefers-color-scheme: dark)') : null;
    setTheme(saved || (mq && mq.matches ? 'dark' : 'light'), false);
    if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { var s = null; try { s = localStorage.getItem('memeet-theme'); } catch (er) {} if (!s) setTheme(e.matches ? 'dark' : 'light', false); });
    var b = $('#themeBtn'); if (b) b.onclick = function () { setTheme(curTheme() === 'dark' ? 'light' : 'dark', true); };
  }
  initTheme();
  A.notesOpen = true; /* de kolom Aantekeningen staat altijd open */
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
  if (W.__VA_TEST) W.__va = { ibParse: ibParse, ibResolve: ibResolve, ibAll: ibAll, ibItemsOf: ibItemsOf, ibRemSrc: ibRemSrc, ibStripPriv: ibStripPriv, minutesMailText: minutesMailText, htmlPathWin: htmlPathWin, findBase: findBase, baseCandidates: baseCandidates, detectBase: detectBase, kvSet: kvSet, findLink: findLink, convertToPdf: convertToPdf, expandFiles: expandFiles, prevMeeting: prevMeeting, A: A, useStore: useStore, FolderStore: FolderStore, BrowserStore: BrowserStore, handleDrop: handleDrop };
