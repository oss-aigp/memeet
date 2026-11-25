  /* ================================================================== Help: per pagina een uitleg in een paneel rechts (knop ? of F1) */
  var BACKUP_HTML = '<h3>Back-up maken</h3><ol>' +
    '<li>Sluit MeMeet.</li>' +
    '<li>Kopieer de <b>hele map <code>memeet-data</code></b>, mét het bestand <code>memeet.json</code> erin, naar bijvoorbeeld OneDrive, een netwerkschijf of een USB-stick.</li></ol>' +
    '<p><code>memeet.json</code> is het register van MeMeet: daarin staan de vergaderingen, aantekeningen, acties en je markeringen en opmerkingen in de PDF\'s. Zonder dat bestand zijn alleen de losse stukken terug te halen.</p>' +
    '<h3>Back-up terugzetten</h3><ol><li>Zet de gekopieerde map <code>memeet-data</code> terug, bijvoorbeeld in <code>Documenten\\MeMeet</code>.</li>' +
    '<li>Open MeMeet, klik rechtsboven op <b>' + ic('folder') + ' Wijzig datamap</b> en kies die map <code>memeet-data</code>.</li></ol>' +
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
      '<li><b>Wat wel naar buiten gaat:</b> alleen wat je zelf doet, zoals <b>Deelnemen</b> (opent de Teams-link), <b>iBabs</b> (opent iBabs in een eigen tabblad), een conceptmail die je in Outlook verstuurt, of een link naar GitHub in deze help.</li>' +
      '<li><b>Let op bij delen:</b> een PDF die je downloadt met aantekeningen bevat je markeringen en opmerkingen.</li></ul>'],
    ['Waarom vraagt de browser elke keer om toestemming?', '<p>Dat is een beveiligingsregel van de browser: een webpagina mag pas bij een map op je computer als jij daar in die sessie toestemming voor geeft. Klik op <b>Map openen</b> en daarna op <b>Toestaan</b>.</p>'],
    ['Kan ik MeMeet op meerdere computers gebruiken?', '<p>Ja, maar niet tegelijk met dezelfde gegevens. Kopieer de hele map <code>memeet-data</code> naar de andere computer en kies daar die map. Werk niet op twee computers tegelijk in dezelfde map (bijvoorbeeld via OneDrive): dan kunnen wijzigingen elkaar overschrijven.</p>'],
  ];
  var ABOUT_HTML = '<p><b>MeMeet</b> is een vergaderapp in één HTML-bestand. Je sleept mails en uitnodigingen uit Outlook erin, en MeMeet maakt er vergaderingen van met alle stukken, die je kunt lezen, markeren en bewerken. Alles blijft op je eigen computer.</p>' +
    '<h3>Zo werkt het</h3><ol><li><b>Vergaderingen maken</b>: sleep een mail of uitnodiging erin, of lees met <b>Importeer weekagenda</b> je Outlook-agenda in. Titel, datum, tijd, locatie, vergaderlink, iBabs-link en bijlagen worden overgenomen.</li>' +
    '<li><b>Stukken</b>: elk stuk blijft in zijn eigen formaat (Word, Excel, PowerPoint, PDF, afbeeldingen, mails). Een zip wordt uitgepakt; bij een mail komen de bijlagen als losse stukken erachter. De viewer toont ze allemaal; daarin kun je zoeken, markeren en opmerkingen maken. Bij Bewerken pas je het origineel aan.</li>' +
    '<li><b>Vergaderen</b>: met <b>Deelnemen</b> open je de online vergadering, met <b>iBabs</b> de stukken in iBabs, en rechts maak je aantekeningen. Regels die met <code>!</code> beginnen, worden acties; met <code>=</code> besluiten; met <code>&gt;</code> meeneempunten, die vanzelf in het juiste toekomstige overleg verschijnen (<code>&gt; Jan …</code>, <code>&gt; MT: …</code>); met <code>?</code> losse ideeën.</li>' +
    '<li><b>Afronden</b>: verslagen en acties vind je terug in de tabbladen <b>Verslagen</b> en <b>Actielijst</b>. Wat je wilde inbrengen, staat bij het volgende passende overleg bovenaan de aantekeningen; wat niet besproken is, schuift door.</li>' +
    '<li><b>Terugvinden</b>: in <b>Bestanden</b> staan alle stukken, met versies, en kun je ze openen, downloaden en mailen.</li></ol>' +
    '<h3>Waar staat wat?</h3><pre class="tree">Documenten\\MeMeet\\\n  MeMeet.html      de app\n  MeMeet.ico       het icoon\n  memeet-data\\     je gegevens\n    Vergaderingen\\  per vergadering de stukken\n    Aantekeningen\\  de verslagen als .txt\n    Actielijst\\     Actielijst.txt\n    memeet.json     het register</pre>' +
    '<h3>Rechtsboven</h3><ul><li><b>' + ic('folder') + ' Wijzig datamap</b>: kies waar MeMeet je gegevens bewaart.</li><li>' + ic('dark_mode') + ' / ' + ic('light_mode') + ' zet de <b>donkere modus</b> aan of uit. MeMeet onthoudt je keuze; zonder keuze volgt MeMeet de instelling van Windows. De viewer, de pop-ups en de aantekeningen blijven altijd wit met zwarte letters, zodat stukken en tekst er hetzelfde uitzien.</li><li>' + ic('help') + ' opent deze help (of druk op F1).</li></ul>' +
    '<h3>Tabbladen</h3><ul><li><b>Vergaderingen</b>: vandaag, morgen, volgende vergaderingen en het archief.</li><li><b>Verslagen</b>: alle aantekeningen als verslag, met een Word-achtige editor, en per vergadering de besluiten, acties en meeneempunten.</li><li><b>Actielijst</b>: alle acties uit vergaderingen en losse acties, met toevoegen, afvinken, snoozen en een begindatum.</li><li><b>Bestanden</b>: een verkenner met alle stukken.</li></ul>' +
    '<p>De volledige handleiding staat in de <a href="' + GITHUB + '#readme" target="_blank" rel="noopener">README op GitHub</a>.</p>' +
    '<h3>Licentie</h3><p>MeMeet is open source onder de <a href="https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32017D0863" target="_blank" rel="noopener">European Union Public Licence 1.2</a> (EUPL), ook in het Nederlands. MeMeet bevat pdf.js (Apache 2.0), pdf-lib en JSZip (MIT); zie <code>THIRD-PARTY-NOTICES.md</code> op GitHub.</p>';
  var HELP = {
    home: { t: 'Vergaderingen', h:
      '<p>Het startscherm met je vergaderingen van vandaag en morgen, en de lijsten met volgende en eerdere vergaderingen.</p>' +
      '<h3>Een vergadering maken</h3><ul>' +
      '<li><b>Sleep een mail of uitnodiging</b> uit Outlook naar het venster. MeMeet haalt titel, datum, tijd, locatie, vergaderlink en iBabs-link eruit en zet de bijlagen als stukken klaar (een mail als bijlage komt er met zijn eigen bijlagen apart bij). Controleer alles en klik op <b>Opslaan</b>.</li>' +
      '<li>Bestaat de vergadering op die dag al (dezelfde titel), dan is het een verplaatsing: MeMeet werkt alleen de tijd bij.</li>' +
      '<li>Lukt slepen niet (soms in de nieuwe Outlook)? Sleep de mail eerst naar het bureaublad en dan naar MeMeet.</li>' +
      '<li>Meerdere mails tegelijk slepen maakt meerdere vergaderingen in één keer.</li>' +
      '<li>Bij een <b>terugkerende afspraak</b> krijgt de vergadering de datum en tijd van de eerstvolgende keer.</li>' +
      '<li><b>' + ic('calendar_month') + ' Importeer weekagenda</b> leest je hele Outlook-agenda van de komende dagen in één keer in.</li>' +
      '<li><b>' + ic('add') + ' Nieuwe vergadering</b> maakt een lege vergadering die je zelf invult.</li></ul>' +
      '<h3>De balk bovenaan</h3><p>Een begroeting met het aantal vergaderingen van vandaag, en een willekeurige wijsheid of uitspraak over leiderschap. Met <b>' + ic('refresh') + '</b> zie je een andere.</p>' +
      '<h3>Vandaag en Morgen</h3><ul><li>Klik op een vergadering om hem te openen.</li><li><b>Deelnemen</b> opent de Teams-, Zoom- of andere vergaderlink.</li><li><b>iBabs</b> (oranje) staat er als de stukken in iBabs staan, en opent iBabs in een eigen tabblad.</li>' +
      '<li>Alle onderdelen (Vandaag, Morgen, Volgende vergaderingen en Archief) staan open. Met <b>verbergen</b> klap je er een in; als je MeMeet opnieuw opent, staat alles weer open. In de kop zie je hoeveel vergaderingen er zijn.</li></ul>' +
      '<h3>Inbrengen</h3><ul><li>Bovenaan staat het <b>eerstvolgende overleg</b>, met de punten die je daar wilt inbrengen. Bij elke vergadering zie je hoeveel punten er klaarliggen (<b>3 inbrengen</b>).</li><li><b>Wacht op overleg</b> en de <b>Ideeën-inbox</b> verschijnen als er iets in staat; meer daarover op het tabblad Herinneringen.</li></ul>' +
      '<h3>Volgende vergaderingen en Archief</h3><ul><li>Beide lijsten staan standaard open. Klik op de kop of op <b>verbergen</b> om er een in te klappen.</li>' +
      '<li>Volgende vergaderingen begint bij overmorgen. Het Archief bevat de vergaderingen die geweest zijn.</li>' +
      '<li>Klik op een kolomkop om te sorteren. Met het zoekvak zoek je op titel, locatie, namen en aantekeningen; met het keuzemenu kies je een jaar.</li></ul>' +
      '<h3>Vergaderingen verwijderen</h3><ul><li>Vink vergaderingen aan (of het vinkje in de kop voor de hele lijst). Onderaan verschijnt een balk met <b>' + ic('delete') + ' Verwijderen</b>.</li>' +
      '<li>Daarbij wordt alles gewist wat erbij hoort: de map met stukken, de originele mail, gewijzigde versies, de aantekeningen en de acties. Dit kun je niet ongedaan maken.</li></ul>' },
    meeting: { t: 'Een vergadering', h:
      '<h3>Gegevens</h3><ul><li>Titel, datum, tijd, locatie, Deelnemen en de iBabs-link staan samen op één regel bovenaan, zodat er zoveel mogelijk ruimte is voor de stukken. Is het venster te smal, dan krijgt die regel een schuifbalk; hij valt nooit over twee regels. Wijzig je iets, dan wordt het vanzelf bewaard (je ziet even <i>opgeslagen ' + ic('check') + '</i>). Alleen een nieuwe vergadering heeft een knop <b>Opslaan</b>.</li>' +
      '<li><b>Deelnemen</b> opent de vergaderlink (Teams, Zoom …) uit de uitnodiging. Met <b>' + ic('link') + '</b> ernaast voeg je een vergaderlink toe of wijzig je hem; laat je het vak leeg, dan gaat de link weg.</li>' +
      '<li>De <b>iBabs-link</b> staat apart van de vergaderlink. MeMeet vult hem vanzelf als de uitnodiging een link naar iBabs bevat (bij inslepen en bij de weekimport). Is er een iBabs-link, dan is de knop <b>iBabs</b> oranje; zonder link is hij grijs. Met ' + ic('link') + ' naast iBabs plak of wijzig je de link (een klik op de grijze knop doet hetzelfde); laat je het vak leeg, dan gaat de link weg. Zo werkt het ook bij <b>Deelnemen</b>: grijs zonder vergaderlink, en ' + ic('link') + ' ernaast om hem te plakken.</li>' +
      '<li>Opent Deelnemen bij een oudere vergadering iBabs, haal de link dan met ' + ic('link') + ' naast Deelnemen weg en plak hem met ' + ic('link') + ' naast iBabs.</li></ul>' +
      '<h3>iBabs</h3><ul><li><b>iBabs</b> opent de vergadering in iBabs in een eigen tabblad. Klik je bij een andere vergadering, dan laadt die in hetzelfde tabblad. Wil je iBabs en MeMeet naast elkaar, sleep dat tabblad dan los naar een eigen venster. Ben je al ingelogd in iBabs, dan hoeft dat niet opnieuw.</li>' +
      '<li>iBabs kan niet in MeMeet zelf worden getoond: iBabs staat dat niet toe.</li></ul>' +
      '<h3>Stukken</h3><ul><li>Sleep documenten op de vergadering, of klik op het vak <i>Sleep documenten of een mail hierheen</i> om ze te kiezen. Elk stuk blijft in zijn eigen formaat; MeMeet maakt er geen PDF van. De viewer toont Word, Excel, PowerPoint, PDF, afbeeldingen, tekst en mails.</li>' +
      '<li>Een <b>zip</b> wordt uitgepakt: de bestanden erin worden losse stukken.</li>' +
      '<li>Sleep je een <b>mail met bijlagen</b> op de vergadering, dan kies je: <b>alleen de mail</b>, of <b>de mail én de bijlagen</b>, elk als apart stuk. Zit er in de mail weer een mail met bijlagen, dan komen die er ook apart bij.</li>' +
      '<li><b>Volgorde</b>: sleep een stuk omhoog of omlaag. Met <b>Ctrl+klik</b> selecteer je meer stukken, met <b>Shift+klik</b> een reeks; sleep je er een, dan gaan ze allemaal mee.</li>' +
      '<li>Elk stuk staat op één regel, met rechts <b>' + ic('close') + '</b> om het te verwijderen. Bijzonderheden (een eigen PDF-versie, een bestand dat de viewer niet kan tonen, het aantal aantekeningen) zie je als je met de muis op de naam gaat. Het origineel download je via <b>' + ic('more_horiz') + '</b> in de viewer.</li>' +
      '<li>Maak de kolom met stukken <b>breder of smaller</b> door de rand rechts ervan te verslepen (dubbelklik: standaardbreedte).</li>' +
      '<li>Sleep je een bestand met <b>dezelfde naam</b> erop, dan vraagt MeMeet of de oude versie vervangen moet worden.</li>' +
      '<li>Een stuk dat de viewer niet kan tonen (bijvoorbeeld een oud .doc-bestand) download je via <b>' + ic('more_horiz') + '</b> › <i>Origineel downloaden</i> en open je in Word. Wil je het in de viewer zien, sla het dan in Word op als PDF en sleep die PDF met dezelfde naam erop: MeMeet vraagt dan of het de PDF-versie is.</li></ul>' +
      '<h3>Inbrengen: punten die vanzelf in het juiste overleg komen</h3><ul>' +
      '<li>Bovenaan de aantekeningen staat een geel vak met wat je in dít overleg wilt inbrengen: meeneempunten (<code>&gt;</code>) uit eerdere overleggen. Vink een punt af als het besproken is. Is er niets, dan is er geen vak.</li>' +
      '<li>Niet afgevinkt en het overleg is voorbij? Dan schuift het punt vanzelf door naar het volgende passende overleg, met een label <b>1×</b>, <b>2×</b>. Na twee keer vraagt MeMeet <b>Nog relevant?</b>: <i>Ja, laten staan</i> of <i>Nee, weg</i> (de regel in je aantekeningen blijft staan).</li>' +
      '<li>Grijze punten kwamen hier langs, maar zijn doorgeschoven of elders besproken; erachter staat waar ze nu zijn.</li>' +
      '<li>Klik op <b>uit …</b> om te zien waar een punt vandaan komt: de aantekeningen van dat overleg, met de regel geel gemarkeerd, en de stukken. <b>Esc</b> sluit het venster.</li>' +
      '<li>De besluiten, acties en meeneempunten van een eerder overleg vind je op het tabblad <b>Verslagen</b>.</li></ul>' +
      '<h3>Annotatie van een medewerker</h3><ul><li>Klik in de kolom Aantekeningen op ' + ic('note_add') + ' (<b>+ Annotatie</b>) en kies of sleep een Word-bestand (.docx), tekst (.txt) of mail (.eml of .msg). De platte tekst ervan komt onderaan je aantekeningen; zet je terugkoppeling er gewoon onder. Mailen gaat met de knop <b>' + ic('mail') + ' Mail</b>, zoals altijd (regels met <code>&gt;</code> en <code>?</code> gaan niet mee).</li></ul>' +
      '<h3>De viewer</h3><ul>' +
      '<li>De viewer toont elk stuk in zijn eigen opmaak: een PDF als PDF, een Word-document als pagina\'s, Excel als tabel, PowerPoint als dia\'s, een mail met afzender en tekst, tekst als tekst. Het bestand zelf blijft zoals het is.</li>' +
      '<li>Boven het stuk staan alleen <b>' + ic('zoom_out') + ' ' + ic('zoom_in') + '</b> (uit- en inzoomen; klik op het percentage om de pagina weer passend te maken), het <b>zoekvak</b> (Ctrl+F; Enter voor de volgende treffer, Shift+Enter voor de vorige), <b>' + ic('download') + '</b> (het originele bestand downloaden) en <b>' + ic('open_in_full') + ' Vergroten</b> (de viewer neemt de kolom met stukken over; nog eens klikken of Esc zet hem terug).</li>' +
      '<li><b>Tekst selecteren</b>: er verschijnt een menuutje met <b>Markeren</b> (geel), <b>Opmerking</b> (de tekst wordt onderstreept en er komt een geel briefje in de kantlijn) en <b>+ Meeneempunt</b> (de tekst komt als <code>&gt; …</code> onderaan je aantekeningen; typ er een naam of <code>Overleg:</code> voor). Klik op een markering voor <b>Markering weghalen</b>; klik op een briefje om het te bewerken, het kruisje haalt het weg. Ctrl+Z maakt ongedaan.</li>' +
      '<li>Een stuk bewerken doe je in het tabblad <b>Bestanden</b>.</li></ul>' +
      '<h3>Aantekeningen en acties</h3><ul><li>Rechts staat altijd de kolom <b>Aantekeningen</b>. Alles wordt vanzelf bewaard en ook als tekstbestand in de map Aantekeningen gezet.</li>' +
      '<li>Een regel die begint met <code>!</code> wordt een actie, bijvoorbeeld <code>! Jan stuurt de notitie rond</code>. Die staat daarna in de Actielijst.</li>' +
      '<li>Een regel die begint met <code>=</code> is een besluit, bijvoorbeeld <code>= livegang schuift naar maart</code>. Bij <b>' + ic('mail') + ' Mail</b> staan de besluiten bovenaan, dan de acties, dan de rest van je aantekeningen.</li>' +
      '<li>Een regel die begint met <code>&gt;</code> is een <b>meeneempunt</b>. Waar het heen gaat:<br><code>&gt; Jan hij moet eerder escaleren</code>: het eerstvolgende overleg waar Jan genodigde is (<code>&gt; Jan en Petra …</code>: Jan óf Petra);<br><code>&gt; MT: reorganisatie agenderen</code>: het eerstvolgende overleg met "MT" in de titel (alleen als dat een bekende titel of naam is; <code>&gt; let op: …</code> blijft gewone tekst);<br><code>&gt; begroting opnieuw</code>: de volgende keer van dit overleg (dezelfde titel);<br><code>&gt; MT: 15-1 evaluatie</code>: niet vóór 15 januari.</li>' +
      '<li>Een regel die begint met <code>?</code> is een <b>los idee</b>; dat komt in de Ideeën-inbox. Meeneempunten en ideeën zijn privé: ze gaan nooit mee met ' + ic('mail') + ' Mail.</li>' +
      '<li>Direct na <code>&gt;</code> stelt MeMeet personen en overleggen voor; klik erop om ze in te vullen.</li>' +
      '<li>Onder het tekstvak staat <b>Herkend</b>: per regel met <code>&gt;</code>, <code>?</code>, <code>!</code> of <code>=</code> waar hij heen gaat. Klopt het niet, kies dan in de keuzelijst een ander overleg (of <i>automatisch</i>). Kent MeMeet een titel vóór de <code>:</code> niet, klik dan op <b>Het is een overleg</b>: het punt wacht dan tot dat overleg in je agenda staat. Met de muis op de regel met tekens eronder zie je de hele uitleg.</li>' +
      '<li>Je regels blijven staan zoals je ze typt, ook in het tekstbestand.</li>' +
      '<li>Maak de kolom <b>breder of smaller</b> door de linkerrand te verslepen (dubbelklik: standaardbreedte).</li>' +
      '<li><b>' + ic('open_in_new') + ' Apart venster</b> zet de aantekeningen in een eigen venster rechts op je scherm. Dat kun je los verschuiven en naast andere programma\'s zetten. Met <b>' + ic('arrow_back') + ' Terug</b> of door het venster te sluiten, staan ze weer in MeMeet.</li></ul>' +
      '<h3>Verwijderen</h3><ul><li>De <b>prullenbak ' + ic('delete') + '</b> bovenaan wist de vergadering met al haar stukken. Je aantekeningen blijven in de map Aantekeningen staan.</li></ul>' },
    reports: { t: 'Verslagen', h:
      '<p>Alle aantekeningen van je vergaderingen op een rij, als verslagen.</p><ul>' +
      '<li>Sorteer op naam, vergaderdatum of datum gewijzigd door op de kolomkop te klikken. Zoek met het zoekvak in titels en tekst.</li>' +
      '<li>Vink <b>Ook vergaderingen zonder aantekeningen</b> aan om ook vergaderingen zonder verslag te zien, bijvoorbeeld om er een te beginnen.</li>' +
      '<li>Klik op een verslag om het te bewerken in een Word-achtige editor: koppen, vet, cursief, onderstreept en lijsten. Wijzigingen worden vanzelf bewaard.</li>' +
      '<li>Een webadres (https://… of www.…) wordt vanzelf een link. Klik erop om hem in een nieuw tabblad te openen.</li>' +
      '<li>Regels die met <code>!</code> beginnen, zijn acties en staan ook in de Actielijst. Regels met <code>=</code> zijn besluiten; regels met <code>&gt;</code> zijn meeneempunten voor het vervolgoverleg.</li>' +
      '<li>Achter de titel van een vergadering staat rechts <b>' + ic('checklist') + ' Besluitenlijst</b> als er besluiten, acties of meeneempunten zijn (de Besluiten, acties en meeneempunten; met de muis erop zie je hoeveel). Klik erop voor de popup (<b>Esc</b> sluit hem). Op een verslag zelf doet de knop <b>' + ic('checklist') + ' Besluiten en acties</b> hetzelfde. Bij het vervolgoverleg staat dit overzicht klaar onder <b>' + ic('checklist') + ' Meeneempunten</b>.</li>' +
      '<li><b>' + ic('mail') + ' Mail</b> zet de tekst van je aantekeningen in een nieuwe mail in Outlook (ook in de kolom Aantekeningen bij een vergadering). Eerst komen de besluiten, dan de acties, dan de overige aantekeningen; regels met <code>&gt;</code> gaan niet mee. Bij een korte tekst opent de mail direct. Bij een lange tekst downloadt MeMeet een conceptmail: open dat bestand en Outlook toont een nieuwe mail met de hele tekst.</li>' +
      '<li>Elk verslag staat ook als tekstbestand in de map <code>memeet-data\\Aantekeningen</code>, als <code>jjjjmmdd Titel.txt</code>. Pas die bestanden niet buiten MeMeet aan: MeMeet schrijft ze opnieuw bij de volgende wijziging.</li></ul>' },
    reminders: { t: 'Herinneringen', h:
      '<p>Alles wat je ergens wilt inbrengen, op één plek.</p><ul>' +
      '<li><b>Nieuwe herinnering</b>: typ rechts naast de titel en druk op Enter of klik op <b>Toevoegen</b>. <code>Jan …</code> gaat naar het eerstvolgende overleg met Jan; <code>MT: …</code> naar het eerstvolgende overleg met MT in de titel (ook als het nog niet in je agenda staat); <code>MT: 15-1 …</code> niet vóór 15 januari. Het begin van een woord is genoeg (<code>Team: …</code> vindt Teamoverleg), en bij een herinnering mag de dubbele punt weg als je met de titel begint (<code>Teamoverleg rooster bespreken</code>). Zonder naam of overleg gaat de herinnering naar de Ideeën-inbox. Onder het vak zie je meteen waar hij heen gaat.</li>' +
      '<li>Links staat <b>Komt op</b>: per overleg, op tijd, elk punt op één regel. Klik op de naam van het overleg om het te openen; met <b>' + ic('add') + '</b> voeg je een punt toe dat je in dat overleg wilt inbrengen. Daaronder staat <b>Besproken</b> (ingeklapt; klik erop om het te openen). Klik bij een besproken punt op het overleg om het verslag in een venster te zien.</li>' +
      '<li>Rechts staan <b>Wacht op overleg</b> en de <b>Ideeën-inbox</b>.</li>' +
      '<li>Achter elk punt staat waar het op wacht, bijvoorbeeld <b>titel “MT”</b> of <b>met Jan</b>. Klik erop om zelf een overleg te kiezen; <i>weer automatisch</i> zet het terug.</li>' +
      '<li>Klik op <b>uit …</b> om te zien waar een punt vandaan komt; ' + ic('close') + ' verwijdert een losse herinnering.</li>' +
      '<li>In de <b>Ideeën-inbox</b> klik je bij <b>Koppel aan</b> op een persoon, of kies je bij <b>overleg kiezen</b> een vergadering: de regel wordt dan op zijn plek <code>&gt; Jan …</code> of <code>&gt; MT: …</code>.</li>' +
      '<li>Staat een overleg nog niet in je agenda, importeer dan je agenda opnieuw (of maak de vergadering aan op het startscherm): wachtende punten die erbij passen, schuiven er vanzelf naartoe.</li></ul>' },
    actions: { t: 'Actielijst', h:
      '<p>Alle acties: uit de aantekeningen van vergaderingen, en losse acties die je hier zelf toevoegt.</p><ul>' +
      '<li><b>Losse actie toevoegen</b>: typ de actie in het vak bovenaan, kies eventueel een begindatum, en klik op <b>+ Toevoegen</b> of druk op Enter. Klik op de tekst om hem te wijzigen; <b>' + ic('close') + '</b> verwijdert een losse actie.</li>' +
      '<li><b>Actie uit een vergadering</b>: begin in de aantekeningen een regel met <code>!</code>. Wijzig je de tekst hier, dan verandert de regel in de aantekeningen mee.</li>' +
      '<li>Met de knoppen bovenaan kies je wat je ziet: <b>Open</b>, <b>' + ic('snooze') + ' Gesnoozed</b>, <b>Afgerond</b>, <b>Alle</b>, en <b>Verwijderd</b> als je acties van de lijst hebt gehaald.</li>' +
      '<li>Klik op de tekst om een actie te bewerken. Vink hem af als hij klaar is.</li>' +
      '<li><b>Mail als actie</b>: sleep een mail uit Outlook naar de Actielijst. Het onderwerp wordt de actie, met ' + ic('mail') + ' ervoor (en ' + ic('attach_file') + ' met het aantal bijlagen). Klik op zo\'n actie: een viewer toont de mail, en links de bijlagen die je aanklikt om ze te bekijken. Bovenin pas je de tekst van de actie aan; <b>' + ic('download') + ' Download</b> bewaart het bestand dat je ziet. <b>Esc</b> sluit de viewer. Verwijder je de actie, dan gaat de bewaarde mail ook weg.</li>' +
      '<li><b>' + ic('snooze') + ' Snoozen</b> verbergt een actie tot morgen, overmorgen, volgende week of een datum die je kiest. Daarna staat hij weer bij Open.</li>' +
      '<li>Een <b>begindatum</b> zegt vanaf wanneer je met een actie aan de slag gaat.</li>' +
      '<li><b>Van de lijst halen</b> verwijdert de actie uit dit overzicht; de regel blijft in de aantekeningen staan. Onder Verwijderd zet je hem terug.</li>' +
      '<li>Klik op de vergadering om ernaartoe te gaan. De actielijst staat ook als <code>Actielijst.txt</code> in de map Actielijst; mails die je als actie hebt toegevoegd, staan in <code>Actielijst\\Mails</code>.</li></ul>' },
    files: { t: 'Bestanden', h:
      '<p>Een verkenner met alle stukken uit je datamap. Je kunt hier bestanden bekijken, bewerken, downloaden en mailen.</p><ul>' +
      '<li><b>Bewerken</b>: open een stuk (dubbelklik) en klik in de pop-up op <b>' + ic('edit') + ' Bewerken</b>. Dat kan bij Word, Excel, PowerPoint en tekst. Word: stijlen, vet, cursief, onderstrepen, opsomming en uitlijnen. Excel: typ in een cel; Enter, Tab en de pijltjes bewegen, F2 past een cel aan, met = begin je een formule. PowerPoint: klik in een tekstvak op de dia. Opslaan met <b>Opslaan</b> of Ctrl+S; de eerste keer bewaart MeMeet een kopie "(oorspronkelijk)". Met <b>Bekijken</b> zie je het resultaat.</li>' +
      '<li>Links kies je een map, of <b>Alle bestanden</b> (dat is de standaard). Zoek met het zoekvak en filter per kolom.</li>' +
      '<li><b>Mijn mappen</b>: met <b>' + ic('create_new_folder') + ' Nieuwe map</b> maak je een eigen map. Sleep bestanden (één regel, of alle geselecteerde regels) naar die map om ze te ordenen; klik op de map om alleen die bestanden te zien. Dubbelklik op een map om de naam te wijzigen, ' + ic('close') + ' haalt de map weg. Met <b>Geselecteerde bestanden uit deze map halen</b> haal je bestanden er weer uit. De mappen zijn een indeling binnen MeMeet: de bestanden zelf blijven bij hun vergadering en staan altijd onder Alle bestanden.</li>' +
      '<li>Hetzelfde stuk in een ander formaat of een vorige versie (PDF-versie, "(oorspronkelijk)") staat op één regel. Klik met de rechtermuisknop of op <b>versies</b> om alle versies te zien, elk met openen, mailen en downloaden.</li>' +
      '<li>Dubbelklik of <b>' + ic('visibility') + '</b> opent een bestand in de viewer, als pop-up (<b>Esc</b> sluit hem). Kies je <b>Openen</b> met meer bestanden geselecteerd, dan staan ze links in de pop-up en klik je van het een naar het ander.</li><li><b>' + ic('download') + '</b> downloadt het, <b>' + ic('mail') + '</b> maakt een conceptmail met het bestand als bijlage: open het gedownloade bestand en Outlook start een nieuwe mail.</li>' +
      '<li><b>Vergadering ›</b> opent de bijbehorende vergadering, met het stuk in de viewer.</li>' +
      '<li><b>' + ic('delete') + ' Verwijderen</b> haalt een bestand alleen uit dit overzicht; in de vergadering blijft het staan. Met <b>Verwijderd tonen</b> en <b>' + ic('restore_from_trash') + ' Terugzetten</b> haal je het terug.</li>' +
      '<li>Selecteer meerdere bestanden met de vinkjes of met <b>Ctrl+klik</b>. Met <b>Shift+klik</b> selecteer je een reeks: klik op het eerste bestand, houd Shift ingedrukt en klik op het laatste. Daarna kun je ze in één keer openen, downloaden, mailen of verwijderen, of het hele pakket naar een van <b>Mijn mappen</b> slepen.</li></ul>' },
    week: { t: 'Weekagenda importeren', h:
      '<p>Je Outlook-agenda van de komende dagen in één keer inlezen als vergaderingen.</p>' +
      '<h3>1. Agenda opslaan in Outlook</h3><ol><li>Ga naar <b>Agenda</b> en klik links op je eigen agenda.</li><li>Kies <b>Bestand › Agenda opslaan in bestand</b> en klik op <b>Meer opties</b>.</li>' +
      '<li>Kies bijvoorbeeld <i>Volgende 30 dagen</i> en <i>Volledige details</i>. Wil je bijlagen als stukken, vink dan onder Geavanceerd <b>Bijlagen bij agenda-items opnemen</b> aan.</li></ol>' +
      '<p>Sneller: zet de opdracht <b>Opslaan als agenda</b> in de werkbalk Snelle toegang. Hoe dat gaat, staat onderaan de pagina.</p>' +
      '<h3>2. Inlezen en kiezen</h3><ul><li>Kies het .ics-bestand of sleep het in MeMeet. Je ziet eerst een lijst: <b>Nieuw</b>, <b>Bijwerken</b> of <b>Staat er al</b>.</li>' +
      '<li>Klik op een regel om hem aan of uit te zetten en klik op <b>Importeer geselecteerde</b>. Wat je uitvinkt, staat de volgende keer ook uit.</li>' +
      '<li>Blokken, reistijd, uitloop en korte afspraken direct naast een andere vergadering worden overgeslagen. Met <b>' + ic('settings') + ' Niet importeren…</b> beheer je de trefwoorden en minuten, en geef je eerder uitgevinkte titels weer vrij.</li>' +
      '<li>Hele-dag-afspraken, geannuleerde afspraken, afspraken die geweest zijn en afspraken zonder titel worden niet geïmporteerd.</li></ul>' +
      '<h3>Wat er gebeurt</h3><ul><li>Elke afspraak wordt een vergadering met datum, tijd, locatie, vergaderlink en genodigden (de organisator vooraan). Een link naar iBabs in de tekst van de afspraak komt in het veld iBabs-link; een import zonder iBabs-link laat een bestaande of zelf geplakte link staan.</li>' +
      '<li>Bijlagen worden stukken, in hun eigen formaat. Een mail als bijlage blijft een mail; zijn bijlagen komen er als losse stukken achter. Een zip wordt uitgepakt.</li>' +
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
    if (h === '#/herinneringen') return 'reminders';
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
    setHTML(p, '<div class="helphead"><span class="helpq">' + ic('help') + '</span><h2 id="helpT">Help</h2><button type="button" class="helpx" id="helpX" title="Sluiten (Esc)" aria-label="Sluiten">' + ic('close') + '</button></div>' +
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
