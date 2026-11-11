  /* ================================================================== Help: per pagina een uitleg in een paneel rechts (knop ? of F1) */
  var BACKUP_HTML = '<h3>Back-up maken</h3><ol>' +
    '<li>Sluit MeMeet.</li>' +
    '<li>Kopieer de <b>hele map <code>memeet-data</code></b>, mét het bestand <code>memeet.json</code> erin, naar bijvoorbeeld OneDrive, een netwerkschijf of een USB-stick.</li></ol>' +
    '<p><code>memeet.json</code> is het register van MeMeet: daarin staan de vergaderingen, aantekeningen, acties en je markeringen en opmerkingen in de PDF\'s. Zonder dat bestand zijn alleen de losse stukken terug te halen.</p>' +
    '<h3>Back-up terugzetten</h3><ol><li>Zet de gekopieerde map <code>memeet-data</code> terug, bijvoorbeeld in <code>Documenten\\MeMeet</code>.</li>' +
    '<li>Open MeMeet, klik rechtsboven bij de map op <b>wijzig</b> en kies die map <code>memeet-data</code>.</li></ol>' +
    '<p class="muted">Losse vergadermappen terugkopiëren in <code>Vergaderingen</code> werkt niet: MeMeet werkt vanuit <code>memeet.json</code>. Zet altijd de hele map terug.</p>';

  var GITHUB = 'https://github.com/oss-aigp/memeet', GITHUB_DL = 'https://github.com/oss-aigp/memeet/blob/main/dist/MeMeet.html';
  /* versienummer staat als opmerking bovenaan het bestand (<!-- MeMeet-versie: x -->) */
  function memeetVersion() { for (var n = D.firstChild; n; n = n.nextSibling) { if (n.nodeType === 8) { var m = /MeMeet-versie:\s*([^\s]+)/.exec(n.nodeValue); if (m) return m[1]; } } return ''; }
  var UPGRADE_HTML = '<ol><li>Maak eerst een back-up: kopieer de hele map <code>memeet-data</code>.</li>' +
    '<li>Open <a href="' + GITHUB_DL + '" target="_blank" rel="noopener">MeMeet.html op GitHub</a> en klik rechtsboven op het pijltje <b>Download raw file</b>. Het bestand komt in je map <b>Downloads</b>.</li>' +
    '<li>Sluit MeMeet (alle tabbladen met MeMeet).</li>' +
    '<li>Verplaats het gedownloade <code>MeMeet.html</code> naar <code>Documenten\\MeMeet</code> en kies <b>Het bestand in de doelmap vervangen</b>. Heet het bestand in Downloads <code>MeMeet (1).html</code>, geef het dan eerst de naam <code>MeMeet.html</code>.</li>' +
    '<li>Open MeMeet weer via je snelkoppeling. Je vergaderingen staan er gewoon: die staan in <code>memeet-data</code>, niet in het HTML-bestand.</li></ol>' +
    '<p class="muted">Je gebruikt nu versie <b>' + esc(memeetVersion() || 'onbekend') + '</b>. Welke versie de nieuwste is, zie je op <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a> bij de laatste wijziging.</p>';
  var SHORTCUT_HTML = '<ol><li>Klik met de rechtermuisknop op een lege plek op het bureaublad en kies <b>Nieuw</b> › <b>Snelkoppeling</b>.</li>' +
    '<li>Typ of plak bij <i>Typ de locatie van het item</i>: <code>C:\\Windows\\explorer.exe "C:\\Users\\JOUWNAAM\\Documents\\MeMeet\\MeMeet.html"</code>, met het pad naar jouw <code>MeMeet.html</code>. Op de pagina <a href="#/installatie">MeMeet installeren</a> staat de regel met jouw pad en een knop Kopiëren.</li>' +
    '<li>Klik op <b>Volgende</b>, noem hem <b>MeMeet</b> en klik op <b>Voltooien</b>.</li>' +
    '<li>Rechtermuisknop › <b>Eigenschappen</b> › <b>Ander pictogram…</b> › <b>Bladeren</b> en kies <code>MeMeet.ico</code> naast <code>MeMeet.html</code>.</li>' +
    '<li>Sleep de snelkoppeling naar de <b>taakbalk</b>. Dat kan omdat het doel <code>explorer.exe</code> is en niet het HTML-bestand zelf.</li></ol>';
  var FAQ = [
    ['Hoe installeer ik MeMeet?', '<ol><li>Download <a href="' + GITHUB_DL + '" target="_blank" rel="noopener">MeMeet.html van GitHub</a> (rechtsboven: <b>Download raw file</b>).</li>' +
      '<li>Maak in <b>Documenten</b> een map <b>MeMeet</b> en zet <code>MeMeet.html</code> daarin.</li>' +
      '<li>Dubbelklik op het bestand. Het opent in Edge of Chrome. Werkt het in een andere browser, kies dan met de rechtermuisknop <b>Openen met › Microsoft Edge</b>.</li>' +
      '<li>Klik op <b>Datamap kiezen</b> en kies de map <b>MeMeet</b>. MeMeet maakt daarin <code>memeet-data</code> aan en zet het icoon <code>MeMeet.ico</code> ernaast.</li>' +
      '<li>Maak een snelkoppeling op het bureaublad en in de taakbalk (zie de vraag hieronder).</li></ol>'],
    ['Hoe maak ik een snelkoppeling op het bureaublad en in de taakbalk?', SHORTCUT_HTML],
    ['Er komt niets in mijn Downloads. Wat nu?', '<p>Klik rechtsonder in het balkje op <b>Opnieuw downloaden</b>. Dat werkt bijna altijd.</p>' +
      '<p>Komt er dan nog steeds niets? Dan blokkeert de browser automatische downloads van MeMeet. Zo zet je dat aan in Edge:</p><ol>' +
      '<li>Kijk rechts in de adresbalk of er een downloadpictogram met een rood kruisje staat. Klik erop en kies <b>Altijd toestaan</b>.</li>' +
      '<li>Of ga naar <b>Instellingen › Cookies en sitemachtigingen › Automatische downloads</b> en haal MeMeet (of <code>file:///</code>) weg bij <b>Blokkeren</b>.</li>' +
      '<li>Laad MeMeet opnieuw (F5).</li></ol>'],
    ['Hoe maak ik een back-up, en hoe zet ik die terug?', BACKUP_HTML],
    ['Hoe upgrade ik MeMeet naar een nieuwe versie?', UPGRADE_HTML],
    ['Ik wil MeMeet zelf doorontwikkelen. Hoe doe ik dat?', '<p>De broncode staat openbaar op <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a>.</p><ol>' +
      '<li>Installeer <a href="https://nodejs.org/" target="_blank" rel="noopener">Node.js</a> (versie 18 of nieuwer) en Git.</li>' +
      '<li>Haal de code op: <code>git clone ' + GITHUB + '.git</code>, of download de ZIP via de groene knop <b>Code</b>.</li>' +
      '<li>Ga in de map staan en voer <code>npm install</code> uit, daarna <code>npm run build</code>. Dat maakt <code>dist/MeMeet.html</code>.</li>' +
      '<li>De code staat in <code>src/</code>: <code>app.html</code> (HTML en alle opmaak), <code>app-ui.js</code> (schermen en opslag), <code>mail-parser.js</code> (mails en agenda lezen), <code>convert.js</code> en <code>pptx-render.js</code> (omzetten naar PDF), <code>editor.js</code> (bewerken), <code>notes.js</code>, <code>reports.js</code>, <code>files.js</code> en <code>help.js</code>.</li>' +
      '<li>Test je wijziging door <code>dist/MeMeet.html</code> in Edge te openen. Verhoog bij een nieuwe versie het versienummer in <code>package.json</code>.</li>' +
      '<li>Wil je je wijziging teruggeven? Maak een eigen kopie (<b>Fork</b>) op GitHub en stuur een <b>pull request</b>.</li></ol>' +
      '<p class="muted">In <code>CLAUDE.md</code> staan de werkafspraken, ook handig als je met een AI-assistent werkt. MeMeet valt onder de <b>EUPL 1.2</b>, de open-sourcelicentie van de Europese Unie: je mag MeMeet gebruiken, aanpassen en verspreiden, mits je je aangepaste versie ook onder de EUPL (of een daarmee verenigbare licentie) beschikbaar stelt en de broncode deelt. De tekst staat in <code>LICENSE</code>; de licenties van de meegeleverde onderdelen staan in <code>THIRD-PARTY-NOTICES.md</code>.</p>'],
    ['Hoe zit het met de veiligheid van mijn informatie?', '<ul>' +
      '<li><b>Alles blijft op je eigen computer.</b> MeMeet is één HTML-bestand dat in je browser draait. Er is geen server en geen account, en MeMeet stuurt geen mails, stukken of aantekeningen naar internet. Alle onderdelen zitten in het bestand zelf, dus MeMeet werkt ook zonder internet.</li>' +
      '<li><b>Toegang tot één map.</b> MeMeet kan alleen bij de datamap die jij kiest, en pas nadat je browser daar toestemming voor heeft gevraagd. Daarom vraagt de browser bij elke start of MeMeet de map weer mag gebruiken.</li>' +
      '<li><b>Je gegevens zijn gewone bestanden</b> in <code>memeet-data</code>, niet versleuteld. Ze zijn net zo goed beveiligd als je andere documenten: via je Windows-account en de beveiliging van je werkplek.</li>' +
      '<li><b>OneDrive.</b> Wordt je map Documenten met OneDrive gesynchroniseerd, dan komt <code>memeet-data</code> ook in de OneDrive van je organisatie. Voor gewone werkstukken is dat meestal prima; volg voor vertrouwelijke of gerubriceerde informatie de regels van je organisatie.</li>' +
      '<li><b>Bewaar je alles in de browser</b>, dan staan de gegevens in je browserprofiel op deze computer. Wis je de browsergegevens, dan ben je ze kwijt: maak dan regelmatig een export.</li>' +
      '<li><b>Wat wel naar buiten gaat:</b> alleen wat je zelf doet, zoals <b>Deelnemen</b> (opent de Teams-link), <b>Stukken in iBabs</b> (opent iBabs in een eigen venster), een conceptmail die je in Outlook verstuurt, of een link naar GitHub in deze help.</li>' +
      '<li><b>Let op bij delen:</b> een PDF die je downloadt met aantekeningen, of de export als één PDF, bevat je markeringen en opmerkingen.</li></ul>'],
    ['Waarom vraagt de browser elke keer om toestemming?', '<p>Dat is een beveiligingsregel van de browser: een webpagina mag pas bij een map op je computer als jij daar in die sessie toestemming voor geeft. Klik op <b>Map openen</b> en daarna op <b>Toestaan</b>.</p>'],
    ['Kan ik MeMeet op meerdere computers gebruiken?', '<p>Ja, maar niet tegelijk met dezelfde gegevens. Kopieer de hele map <code>memeet-data</code> naar de andere computer en kies daar die map. Werk niet op twee computers tegelijk in dezelfde map (bijvoorbeeld via OneDrive): dan kunnen wijzigingen elkaar overschrijven.</p>'],
  ];
  var ABOUT_HTML = '<p><b>MeMeet</b> is een vergaderapp in één HTML-bestand. Je sleept mails en uitnodigingen uit Outlook erin, en MeMeet maakt er vergaderingen van met alle stukken, die je kunt lezen, markeren, bewerken en exporteren. Alles blijft op je eigen computer.</p>' +
    '<h3>Zo werkt het</h3><ol><li><b>Vergaderingen maken</b>: sleep een mail of uitnodiging erin, of lees met <b>Importeer weekagenda</b> je Outlook-agenda in. Titel, datum, tijd, locatie, vergaderlink, iBabs-link, genodigden en bijlagen worden overgenomen.</li>' +
    '<li><b>Stukken</b>: Word, Excel, PowerPoint, afbeeldingen en mails worden automatisch omgezet naar PDF. In de viewer kun je zoeken, markeren en opmerkingen maken; bij Bewerken pas je het origineel aan.</li>' +
    '<li><b>Vergaderen</b>: met <b>Deelnemen</b> open je de online vergadering, met <b>Stukken in iBabs</b> de stukken in iBabs, en met <b>✎ Aantekeningen</b> maak je aantekeningen. <b>Naast elkaar</b> zet iBabs links en je aantekeningen rechts. Regels die met <code>!</code> beginnen, worden acties; met <code>=</code> besluiten; met <code>&gt;</code> meeneempunten voor een volgende vergadering.</li>' +
    '<li><b>Afronden</b>: <b>Exporteer als één PDF</b> maakt één document met agenda, stukken en aantekeningen. Verslagen en acties vind je terug in de tabbladen <b>Verslagen</b> en <b>Actielijst</b>.</li>' +
    '<li><b>Terugvinden</b>: in <b>Bestanden</b> staan alle stukken, met versies, en kun je ze openen, downloaden en mailen.</li></ol>' +
    '<h3>Waar staat wat?</h3><pre class="tree">Documenten\\MeMeet\\\n  MeMeet.html      de app\n  MeMeet.ico       het icoon\n  memeet-data\\     je gegevens\n    Vergaderingen\\  per vergadering de stukken\n    Aantekeningen\\  de verslagen als .txt\n    Actielijst\\     Actielijst.txt\n    Meeneempunten\\ de meeneempunten als .txt\n    memeet.json     het register</pre>' +
    '<h3>Tabbladen</h3><ul><li><b>Vergaderingen</b>: vandaag, morgen, volgende vergaderingen en het archief.</li><li><b>Verslagen</b>: alle aantekeningen als verslag, met een Word-achtige editor.</li><li><b>Actielijst</b>: alle acties uit vergaderingen en losse acties, met toevoegen, afvinken, snoozen en een begindatum.</li><li><b>Meeneempunten</b>: lijstjes met punten om mee te nemen naar een vergadering: gekoppeld aan een vergadering, wachtend op een vergadering met een bepaalde titel, of los.</li><li><b>Bestanden</b>: een verkenner met alle stukken.</li></ul>' +
    '<p>De volledige handleiding staat in de <a href="' + GITHUB + '#readme" target="_blank" rel="noopener">README op GitHub</a>.</p>' +
    '<h3>Licentie</h3><p>MeMeet is open source onder de <a href="https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32017D0863" target="_blank" rel="noopener">European Union Public Licence 1.2</a> (EUPL), ook in het Nederlands. MeMeet bevat pdf.js (Apache 2.0), pdf-lib en JSZip (MIT); zie <code>THIRD-PARTY-NOTICES.md</code> op GitHub.</p>';
  var HELP = {
    home: { t: 'Vergaderingen', h:
      '<p>Het startscherm met je vergaderingen van vandaag en morgen, en de lijsten met volgende en eerdere vergaderingen.</p>' +
      '<h3>Een vergadering maken</h3><ul>' +
      '<li><b>Sleep een mail of uitnodiging</b> uit Outlook naar het venster. MeMeet haalt titel, datum, tijd, locatie, vergaderlink en genodigden eruit en zet de bijlagen als stukken klaar. Controleer alles en klik op <b>Opslaan</b>.</li>' +
      '<li>Lukt slepen niet (soms in de nieuwe Outlook)? Sleep de mail eerst naar het bureaublad en dan naar MeMeet, of gebruik <b>Mail importeren…</b>.</li>' +
      '<li>Meerdere mails tegelijk slepen maakt meerdere vergaderingen in één keer.</li>' +
      '<li>Bij een <b>terugkerende afspraak</b> krijgt de vergadering de datum en tijd van de eerstvolgende keer.</li>' +
      '<li><b>📅 Importeer weekagenda</b> leest je hele Outlook-agenda van de komende dagen in één keer in.</li>' +
      '<li><b>+ Nieuwe vergadering</b> maakt een lege vergadering die je zelf invult.</li></ul>' +
      '<h3>De balk bovenaan</h3><p>Een begroeting met het aantal vergaderingen van vandaag, en een willekeurige wijsheid of uitspraak over leiderschap. Met <b>↻</b> zie je een andere.</p>' +
      '<h3>Vandaag en Morgen</h3><ul><li>Klik op een vergadering om hem te openen.</li><li><b>Deelnemen</b> opent de Teams-, Zoom- of andere vergaderlink.</li><li><b>iBabs</b> (oranje) staat er als de stukken in iBabs staan, en opent iBabs in een eigen venster.</li>' +
      '<li>Vandaag en Morgen kun je in- en uitklappen met <b>weergeven</b>/<b>verbergen</b>; in de kop zie je hoeveel vergaderingen er zijn. Vandaag is na 20:30 standaard ingeklapt, Morgen staat standaard open.</li></ul>' +
      '<h3>Volgende vergaderingen en Archief</h3><ul><li>Beide lijsten zijn standaard ingeklapt. Klik op de kop of op <b>weergeven</b>.</li>' +
      '<li>Volgende vergaderingen begint bij overmorgen. Het Archief bevat de vergaderingen die geweest zijn.</li>' +
      '<li>Klik op een kolomkop om te sorteren. Met het zoekvak zoek je op titel, locatie, namen en aantekeningen; met het keuzemenu kies je een jaar.</li></ul>' +
      '<h3>Vergaderingen verwijderen</h3><ul><li>Vink vergaderingen aan (of het vinkje in de kop voor de hele lijst). Onderaan verschijnt een balk met <b>🗑 Verwijderen</b>.</li>' +
      '<li>Daarbij wordt alles gewist wat erbij hoort: de map met stukken, de originele mail, gewijzigde versies, de aantekeningen en de acties. Dit kun je niet ongedaan maken.</li></ul>' },
    meeting: { t: 'Een vergadering', h:
      '<h3>Gegevens</h3><ul><li>Titel, datum, tijd, locatie, vergaderlink en genodigden pas je bovenaan aan. Klik op <b>Opslaan</b> om ze te bewaren.</li>' +
      '<li>Genodigden scheid je met komma\'s. De <b>eerste naam is de voorzitter</b>.</li>' +
      '<li><b>Deelnemen</b> verschijnt zodra er een vergaderlink is.</li>' +
      '<li>De <b>iBabs-link</b> is een eigen veld, apart van de vergaderlink. MeMeet vult hem vanzelf als de uitnodiging een link naar iBabs bevat (bij inslepen en bij de weekimport). Je kunt hem ook zelf plakken of wijzigen. Staat een iBabs-link bij een oudere vergadering nog in het veld Vergaderlink, knip hem dan daar weg en plak hem bij iBabs-link.</li></ul>' +
      '<h3>iBabs</h3><ul><li><b>Stukken in iBabs</b> opent de vergadering in iBabs in een eigen venster, zonder tabbladen. Klik je bij een andere vergadering, dan laadt die in hetzelfde venster. Ben je al ingelogd in iBabs, dan hoeft dat niet opnieuw.</li>' +
      '<li><b>Naast elkaar</b> zet iBabs links op je scherm en je aantekeningen rechts, elk in een eigen venster. Houdt de browser het tweede venster tegen, sta dan één keer pop-ups toe voor MeMeet (het icoontje rechts in de adresbalk). De vensters komen op het scherm waar MeMeet staat; het venster van MeMeet zelf verschuift niet.</li>' +
      '<li>iBabs kan niet in MeMeet zelf worden getoond: iBabs staat dat niet toe.</li></ul>' +
      '<h3>Stukken</h3><ul><li>Sleep documenten op de vergadering, of klik op het vak <i>Sleep documenten of een mail hierheen</i> om ze te kiezen. Word, Excel, PowerPoint, afbeeldingen, tekst en mails worden automatisch omgezet naar PDF.</li>' +
      '<li>Met <b>▲ ▼</b> bepaal je de volgorde; die geldt ook voor de export. <b>⤓</b> downloadt het origineel, <b>✕</b> verwijdert het stuk.</li>' +
      '<li>Sleep je een bestand met <b>dezelfde naam</b> erop, dan vraagt MeMeet of de oude versie vervangen moet worden.</li>' +
      '<li>Een stuk met het label "geen PDF" (bijvoorbeeld een oud .doc-bestand) zet je zelf om in Word via <b>Opslaan als › PDF</b> en sleep je daarna op de vergadering.</li></ul>' +
      '<h3>De viewer (tabblad PDF)</h3><ul>' +
      '<li><b>Tekst</b>: tekst selecteren en kopiëren (Ctrl+C).</li>' +
      '<li><b>Markeren</b>: selecteer tekst; die wordt geel of groen gemarkeerd. Kies de kleur met de bolletjes.</li>' +
      '<li><b>Opmerking</b>: klik op een woord en typ. De opmerking komt in de rechtermarge; Ctrl+Enter is klaar.</li>' +
      '<li><b>Gum</b>: klik op een markering of opmerking om hem weg te halen.</li>' +
      '<li><b>↶ ↷</b>: ongedaan maken en opnieuw, tot 20 stappen (Ctrl+Z en Ctrl+Y).</li>' +
      '<li><b>Zoeken</b>: Ctrl+F, daarna Enter voor de volgende treffer en Shift+Enter voor de vorige.</li>' +
      '<li>Alle knoppen boven het stuk staan op één regel. Is de kolom smal, dan tonen ze alleen een symbool (Aa = tekst, 🖍 = markeren, 💬 = opmerking, ⌫ = gum); wijs een knop aan voor de naam. Een melding over het stuk staat achter het rondje <b>i</b>.</li>' +
      '<li><b>− 100% +</b>: kleiner en groter. Klik op het percentage om de pagina weer passend te maken.</li>' +
      '<li><b>Vierkantje met hoekjes</b>: de viewer vergroten tot het hele venster. Nog eens klikken of Esc maakt hem weer klein.</li>' +
      '<li><b>⋯</b>: het stuk downloaden met je aantekeningen, alle aantekeningen wissen, het origineel downloaden of de PDF in een nieuw tabblad openen.</li></ul>' +
      '<h3>Bewerken</h3><ul><li>Het tabblad <b>Bewerken</b> boven de viewer past het originele bestand aan.</li>' +
      '<li>Word: stijlen, vet, cursief, onderstrepen, opsomming en uitlijnen. Excel: typ in een cel; Enter, Tab en de pijltjes bewegen, F2 past een cel aan, Delete wist, met = begin je een formule. PowerPoint: klik in een tekstvak op de dia.</li>' +
      '<li>Opslaan met <b>💾 Opslaan</b> of Ctrl+S. De eerste keer bewaart MeMeet een kopie "(oorspronkelijk)" en daarna wordt de PDF bijgewerkt.</li>' +
      '<li>Liever in Office zelf? Download het stuk met ⤓, bewerk het en sleep het met dezelfde naam terug op de vergadering.</li></ul>' +
      '<h3>Aantekeningen en acties</h3><ul><li><b>✎ Aantekeningen</b> opent een kolom rechts. Alles wordt vanzelf bewaard en ook als tekstbestand in de map Aantekeningen gezet.</li>' +
      '<li>Een regel die begint met <code>!</code> wordt een actie, bijvoorbeeld <code>! Jan stuurt de notitie rond</code>. Die staat daarna in de Actielijst.</li>' +
      '<li>Een regel die begint met <code>=</code> is een besluit, bijvoorbeeld <code>= livegang schuift naar maart</code>. Bij <b>✉ Mailen</b> staan de besluiten bovenaan, dan de acties, dan de rest van je aantekeningen.</li>' +
      '<li>Een regel die begint met <code>&gt;</code> is een meeneempunt voor een andere vergadering: <code>&gt; Linda: praten over Jozef</code> komt in het lijstje <i>Linda</i> op het tabblad Meeneempunten, en staat bij de eerstvolgende vergadering met Linda in de titel. <code>&gt; volgende vergadering: …</code> gaat naar de volgende vergadering met dezelfde titel; zonder label komt het punt in <i>Nog te plaatsen</i>. Meeneempunten zijn privé: ze gaan niet mee met Mailen.</li>' +
      '<li>Je regels blijven staan zoals je ze typt, ook in het tekstbestand.</li>' +
            '<li>Maak de kolom <b>breder of smaller</b> door de linkerrand te verslepen (dubbelklik: standaardbreedte).</li>' +
      '<li><b>⧉ Apart venster</b> zet de aantekeningen in een eigen venster rechts op je scherm. Dat kun je los verschuiven en naast andere programma\'s zetten. Met <b>⇤ Terug</b> of door het venster te sluiten, staan ze weer in MeMeet.</li></ul>' +
      '<h3>Exporteren en verwijderen</h3><ul><li><b>Exporteer als één PDF</b> maakt één bestand met een agendapagina, alle stukken met paginanummers en bladwijzers, en je aantekeningen. Het komt in Downloads en in de map van de vergadering.</li>' +
      '<li><b>Verwijder</b> wist de vergadering met al haar stukken. Je aantekeningen blijven in de map Aantekeningen staan.</li></ul>' },
    reports: { t: 'Verslagen', h:
      '<p>Alle aantekeningen van je vergaderingen op een rij, als verslagen.</p><ul>' +
      '<li>Sorteer op naam, vergaderdatum of datum gewijzigd door op de kolomkop te klikken. Zoek met het zoekvak in titels en tekst.</li>' +
      '<li>Vink <b>Ook vergaderingen zonder aantekeningen</b> aan om ook vergaderingen zonder verslag te zien, bijvoorbeeld om er een te beginnen.</li>' +
      '<li>Klik op een verslag om het te bewerken in een Word-achtige editor: koppen, vet, cursief, onderstreept en lijsten. Wijzigingen worden vanzelf bewaard.</li>' +
      '<li>Een webadres (https://… of www.…) wordt vanzelf een link. Klik erop om hem in een nieuw tabblad te openen.</li>' +
      '<li>Regels die met <code>!</code> beginnen, zijn acties en staan ook in de Actielijst. Regels met <code>=</code> zijn besluiten; regels met <code>&gt;</code> zijn meeneempunten (zie Meeneempunten).</li>' +
      '<li><b>✉ Mailen</b> zet de tekst van je aantekeningen in een nieuwe mail in Outlook (ook in de kolom Aantekeningen bij een vergadering). Eerst komen de besluiten, dan de acties, dan de overige aantekeningen; regels met <code>&gt;</code> gaan niet mee. Bij een korte tekst opent de mail direct. Bij een lange tekst downloadt MeMeet een conceptmail: open dat bestand en Outlook toont een nieuwe mail met de hele tekst.</li>' +
      '<li>Elk verslag staat ook als tekstbestand in de map <code>memeet-data\\Aantekeningen</code>, als <code>jjjjmmdd Titel.txt</code>. Pas die bestanden niet buiten MeMeet aan: MeMeet schrijft ze opnieuw bij de volgende wijziging.</li></ul>' },
    actions: { t: 'Actielijst', h:
      '<p>Alle acties: uit de aantekeningen van vergaderingen, en losse acties die je hier zelf toevoegt.</p><ul>' +
      '<li><b>Losse actie toevoegen</b>: typ de actie in het vak bovenaan, kies eventueel een begindatum, en klik op <b>+ Toevoegen</b> of druk op Enter. Klik op de tekst om hem te wijzigen; <b>✕</b> verwijdert een losse actie.</li>' +
      '<li><b>Actie uit een vergadering</b>: begin in de aantekeningen een regel met <code>!</code>. Wijzig je de tekst hier, dan verandert de regel in de aantekeningen mee.</li>' +
      '<li>Met de knoppen bovenaan kies je wat je ziet: <b>Open</b>, <b>⏰ Gesnoozed</b>, <b>Afgerond</b>, <b>Alle</b>, en <b>Verwijderd</b> als je acties van de lijst hebt gehaald.</li>' +
      '<li>Klik op de tekst om een actie te bewerken. Vink hem af als hij klaar is.</li>' +
      '<li><b>⏰ Snoozen</b> verbergt een actie tot morgen, overmorgen, volgende week of een datum die je kiest. Daarna staat hij weer bij Open.</li>' +
      '<li>Een <b>begindatum</b> zegt vanaf wanneer je met een actie aan de slag gaat.</li>' +
      '<li><b>Van de lijst halen</b> verwijdert de actie uit dit overzicht; de regel blijft in de aantekeningen staan. Onder Verwijderd zet je hem terug.</li>' +
      '<li>Klik op de vergadering om ernaartoe te gaan. De actielijst staat ook als <code>Actielijst.txt</code> in de map Actielijst.</li></ul>' },
    files: { t: 'Bestanden', h:
      '<p>Een verkenner met alle stukken uit je datamap. Je kunt hier bestanden bekijken, downloaden en mailen, maar niet bewerken.</p><ul>' +
      '<li>Links kies je een map, of <b>Alle bestanden</b>. Zoek met het zoekvak en filter per kolom.</li>' +
      '<li>Hetzelfde stuk in een ander formaat of een vorige versie (PDF-versie, "(oorspronkelijk)") staat op één regel. Klik met de rechtermuisknop of op <b>versies</b> om alle versies te zien, elk met openen, mailen en downloaden.</li>' +
      '<li>Dubbelklik of <b>👁</b> opent een bestand, <b>⤓</b> downloadt het, <b>✉</b> maakt een conceptmail met het bestand als bijlage: open het gedownloade bestand en Outlook start een nieuwe mail.</li>' +
      '<li><b>Vergadering ›</b> opent de bijbehorende vergadering, met het stuk in de viewer.</li>' +
      '<li><b>🗑 Verwijderen</b> haalt een bestand alleen uit dit overzicht; in de vergadering blijft het staan. Met <b>Verwijderd tonen</b> en <b>↩ Terugzetten</b> haal je het terug.</li>' +
      '<li>Selecteer meerdere bestanden met de vinkjes (of Ctrl+klik) om ze in één keer te openen, downloaden, mailen of verwijderen.</li></ul>' },
    annos: { t: 'Meeneempunten', h:
      '<p>Meeneempunten zijn lijstjes in dezelfde vorm als een verslag: voor punten die je wilt inbrengen, voorbereiding, ideeën of gespreksnotities. (Dit tabblad heette eerder Bespreekpunten.)</p>' +
      '<h3>Een lijstje maken</h3><ul>' +
      '<li><b>+ Meeneempuntenlijstje toevoegen</b> maakt een nieuw lijstje en je kunt meteen typen. De <b>eerste regel</b> is de titel: die wordt vanzelf vet en is de naam in de lijst. Op de lege eerste regel staat in grijs een voorstel (bijvoorbeeld <i>Meeneempunten bij Teamoverleg</i>); druk op <b>Enter</b> om dat als titel over te nemen. Daaronder typ je gewone tekst. De Word-achtige editor kent koppen, vet, cursief, onderstreept en lijsten. Alles wordt vanzelf bewaard.</li>' +
      '<li>Bij <b>Vergadering</b> koppel je het lijstje aan een vergadering, of laat je het los staan. Op de pagina van die vergadering staat het lijstje dan bovenaan de stukken. Klik op de titel om de tekst daar open of dicht te klappen (met een schuifbalk als hij lang is); klik op ✎ om hem te bewerken. Met <b>+ Meeneempunten</b> bovenaan de stukken maak je daar direct meeneempunten bij die vergadering. Zijn die er al, dan klapt dezelfde knop ze open.</li>' +
      '<li>Laat je een nieuw lijstje leeg en ga je weg, dan wordt het niet bewaard.</li></ul>' +
      '<h3>Wachten op een vergadering</h3><ul>' +
      '<li>Bestaat de vergadering nog niet, vul dan bij <b>of wacht op titel</b> een naam of woord in, bijvoorbeeld <i>Linda</i> of <i>MT</i>. Het lijstje staat dan bij de eerstvolgende vergadering (vandaag of later) met dat woord in de titel. Een vergadering die je later importeert of insleept, pakt het lijstje vanzelf op.</li>' +
      '<li>Er wordt gezocht op hele woorden, zonder hoofdletters en accenten: <i>Linda</i> past bij <i>bila Linda</i> en <i>PO Linda</i>, niet bij <i>Belinda</i>. De woorden bila, po, overleg, bijpraten, met, de, het en een tellen niet mee.</li>' +
      '<li><b>Niet hier</b> bij het lijstje op de vergaderpagina slaat die vergadering over; het lijstje wacht dan op de volgende.</li>' +
      '<li>Is de vergadering voorbij en heb je het lijstje niet gearchiveerd, dan schuift het door naar de volgende passende vergadering.</li>' +
      '<li><b>Vastpinnen</b> maakt er een vaste lijst opletpunten van: het lijstje staat dan bij elke passende vergadering en schuift niet door.</li>' +
      '<li>Het tabblad toont drie groepen: <b>bij een vergadering of los</b>, <b>wachtend op een vergadering</b> (met de volgende vergadering, of hoe lang het al wacht) en het <b>archief</b>.</li></ul>' +
      '<h3>Punten uit je aantekeningen</h3><ul>' +
      '<li>Typ in je aantekeningen een regel als <code>&gt; MT: begroting agenderen</code>. Het punt komt in het lijstje <i>MT</i>; bestaat dat nog niet, dan maakt MeMeet het aan, wachtend op een vergadering met MT in de titel. Punten met hetzelfde label uit verschillende vergaderingen komen in hetzelfde lijstje.</li>' +
      '<li>Een punt staat niet bij de vergadering waarin je het typte, maar bij de volgende.</li>' +
      '<li><code>&gt; volgende vergadering: …</code> gebruikt de titel van de vergadering waarin je typt (getallen en datums in de titel tellen niet mee). Zonder label, zoals <code>&gt; idee uitwerken</code>, komt het punt in het lijstje <i>Nog te plaatsen</i>.</li>' +
      '<li>In het lijstje staan de punten bovenaan als afvinkbare regels, met de vergadering waar ze vandaan komen. Daaronder staat de tekst die je zelf typt. <b>✕</b> verbergt een punt. De regel blijft in je aantekeningen staan, net als bij acties.</li>' +
      '<li>Meeneempunten zijn privé: ze gaan niet mee als je je aantekeningen mailt.</li></ul>' +
      '<h3>Verder</h3><ul>' +
      '<li><b>✉ Mailen</b> opent een nieuwe mail in Outlook met de open punten en de tekst. <b>Verwijder</b> wist het lijstje.</li>' +
      '<li>Sorteer op naam, vergadering of datum gewijzigd, en zoek met het zoekvak.</li>' +
      '<li><b>Archiveren</b> (in de lijst of bovenaan een lijstje) zet een lijstje in het <b>Archief</b> onderaan het tabblad. Dat archief is standaard ingeklapt. Met <b>Terugzetten</b> haal je een lijstje terug. Bij de vergadering blijft een gearchiveerd lijstje zichtbaar, met het label <i>archief</i>; bij een wachtend lijstje legt MeMeet vast bij welke vergadering het stond.</li>' +
      '<li>Elk lijstje staat ook als tekstbestand in <code>memeet-data\\Meeneempunten</code>. Had je een map <code>Bespreekpunten</code>, dan zet MeMeet die bestanden eenmalig over. Verdwijnt een gekoppelde vergadering, dan blijft het lijstje bestaan, los.</li></ul>' },
    week: { t: 'Weekagenda importeren', h:
      '<p>Je Outlook-agenda van de komende dagen in één keer inlezen als vergaderingen.</p>' +
      '<h3>1. Agenda opslaan in Outlook</h3><ol><li>Ga naar <b>Agenda</b> en klik links op je eigen agenda.</li><li>Kies <b>Bestand › Agenda opslaan in bestand</b> en klik op <b>Meer opties</b>.</li>' +
      '<li>Kies bijvoorbeeld <i>Volgende 7 dagen</i> en <i>Volledige details</i>. Wil je bijlagen als stukken, vink dan onder Geavanceerd <b>Bijlagen bij agenda-items opnemen</b> aan.</li></ol>' +
      '<p>Sneller: zet de opdracht <b>Opslaan als agenda</b> in de werkbalk Snelle toegang. Hoe dat gaat, staat onderaan de pagina.</p>' +
      '<h3>2. Inlezen en kiezen</h3><ul><li>Kies het .ics-bestand of sleep het in MeMeet. Je ziet eerst een lijst: <b>Nieuw</b>, <b>Bijwerken</b> of <b>Staat er al</b>.</li>' +
      '<li>Klik op een regel om hem aan of uit te zetten en klik op <b>Importeer geselecteerde</b>. Wat je uitvinkt, staat de volgende keer ook uit.</li>' +
      '<li>Blokken, reistijd, uitloop en korte afspraken direct naast een andere vergadering worden overgeslagen. Met <b>⚙ Niet importeren…</b> beheer je de trefwoorden en minuten, en geef je eerder uitgevinkte titels weer vrij.</li>' +
      '<li>Hele-dag-afspraken, geannuleerde afspraken, afspraken die geweest zijn en afspraken zonder titel worden niet geïmporteerd.</li></ul>' +
      '<h3>Wat er gebeurt</h3><ul><li>Elke afspraak wordt een vergadering met datum, tijd, locatie, vergaderlink en genodigden (de organisator vooraan). Een link naar iBabs in de tekst van de afspraak komt in het veld iBabs-link; een import zonder iBabs-link laat een bestaande of zelf geplakte link staan.</li>' +
      '<li>Bijlagen worden stukken; mails als bijlage worden omgezet naar PDF.</li>' +
      '<li>Opnieuw importeren werkt bestaande vergaderingen bij; stukken en aantekeningen blijven staan. Een afspraak die je in Outlook verwijdert, blijft in MeMeet staan.</li></ul>' },
    install: { t: 'Installatie en back-up', h:
      '<h3>Installeren</h3><ol><li>Zet <code>MeMeet.html</code> in <code>Documenten\\MeMeet</code>.</li>' +
      '<li>Open het bestand in Edge of Chrome en klik op <b>Datamap kiezen</b>. Kies de map <b>MeMeet</b>; MeMeet maakt daarin <code>memeet-data</code> aan en zet <code>MeMeet.ico</code> naast <code>MeMeet.html</code>.</li>' +
      '<li>Maak een snelkoppeling op het bureaublad en sleep hem naar de taakbalk (zie hieronder).</li></ol>' +
      '<p>Bij elke start vraagt de browser één keer of MeMeet de map weer mag gebruiken: klik op <b>Map openen</b> en <b>Toestaan</b>.</p>' +
      '<h3>Snelkoppeling</h3>' + SHORTCUT_HTML + '<h3>Bijwerken naar een nieuwe versie</h3>' + UPGRADE_HTML + BACKUP_HTML },
  };
  function helpTopic() {
    var h = location.hash || '#/';
    if (!A.store) return 'install';
    if (h === '#/nieuw' || /^#\/v\//.test(h)) return 'meeting';
    if (/^#\/verslag/.test(h)) return 'reports';
    if (h === '#/acties') return 'actions';
    if (/^#\/(meeneempunt|bespreekpunt|annotatie)/.test(h)) return 'annos';
    if (h === '#/bestanden') return 'files';
    if (h === '#/weekagenda') return 'week';
    if (h === '#/installatie') return 'install';
    return 'home';
  }
  function faqHtml() { return '<p>Klik op een vraag voor het antwoord.</p>' + FAQ.map(function (q) { return '<details class="faq"><summary>' + esc(q[0]) + '</summary><div>' + q[1] + '</div></details>'; }).join(''); }
  function openHelp(tab) {
    if ($('#helpPanel')) { closeHelp(); return; }
    var k = helpTopic(), bg = D.createElement('div'), p = D.createElement('aside');
    bg.className = 'helpbg'; bg.id = 'helpBg'; p.className = 'helppanel'; p.id = 'helpPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-labelledby', 'helpT');
    setHTML(p, '<div class="helphead"><span class="helpq">?</span><h2 id="helpT">Help</h2><button type="button" class="helpx" id="helpX" title="Sluiten (Esc)" aria-label="Sluiten">✕</button></div>' +
      '<div class="helptabs" role="tablist"><button type="button" role="tab" data-tab="page">' + esc(HELP[k].t) + '</button><button type="button" role="tab" data-tab="faq">Veelgestelde vragen</button><button type="button" role="tab" data-tab="about">Hoe werkt MeMeet</button></div>' +
      '<div class="helpbody" id="helpBody"></div><div class="helpfoot">MeMeet ' + esc(memeetVersion()) + ' · EUPL-1.2 · <a href="' + GITHUB + '" target="_blank" rel="noopener">GitHub</a></div>');
    D.body.appendChild(bg); D.body.appendChild(p);
    requestAnimationFrame(function () { bg.classList.add('on'); p.classList.add('on'); });
    bg.onclick = closeHelp; $('#helpX').onclick = closeHelp;
    function show(t, topic) {
      var body = $('#helpBody'), key = topic || k;
      $$('[data-tab]', p).forEach(function (b) { var on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      if (t === 'faq') setHTML(body, faqHtml());
      else if (t === 'about') setHTML(body, ABOUT_HTML);
      else setHTML(body, '<h2 class="helph">' + esc(HELP[key].t) + '</h2>' + HELP[key].h + '<hr><p class="muted">Andere onderwerpen: ' + Object.keys(HELP).filter(function (x) { return x !== key; }).map(function (x) { return '<button type="button" class="link" data-help="' + x + '">' + esc(HELP[x].t) + '</button>'; }).join(' · ') + '</p>');
      body.scrollTop = 0;
      $$('[data-help]', body).forEach(function (b) { b.onclick = function () { show('page', b.dataset.help); }; });
      $$('a[href^="#"]', body).forEach(function (a) { a.addEventListener('click', closeHelp); });
    }
    $$('[data-tab]', p).forEach(function (b) { b.onclick = function () { show(b.dataset.tab); }; });
    show(tab || 'page');
    $('#helpX').focus();
  }
  function closeHelp() { var p = $('#helpPanel'), bg = $('#helpBg'); if (p) p.remove(); if (bg) bg.remove(); }
  function initHelp() {
    var b = $('#helpBtn'); if (b) b.onclick = function () { openHelp(); };
    D.addEventListener('keydown', function (e) {
      if (e.key === 'F1') { e.preventDefault(); openHelp(); }
      else if (e.key === 'Escape' && $('#helpPanel')) { e.stopPropagation(); closeHelp(); }
    }, true);
    W.addEventListener('hashchange', closeHelp);
  }
