# MeMeet – gebruiksinstructie: privacy en veilig gebruik

MeMeet is een hulpmiddel voor je eigen vergaderwerk. Je aantekeningen zijn persoonlijke werkaantekeningen. Deze instructie zegt hoe je MeMeet veilig gebruikt op je werkplek. Lees hem één keer door voordat je begint.

## In het kort

1. Zet de datamap in **Documenten\MeMeet** en **versleutel** de map `memeet-data` met je Windows-account.
2. Noteer **feitelijk en zakelijk**. Geen gezondheid, BSN of oordelen over personen.
3. Bewaar **gevoelige stukken** niet in MeMeet; lees ze in iBabs of de bron.
4. Controleer bij **mailen** altijd de ontvangers in Outlook.
5. **Schoon elk jaar op** in de laatste week van december.
6. Gebruik alleen een **MeMeet.html** van je IV-afdeling of van de officiële GitHub-pagina, met een kloppend controlegetal.

## 1. Waar staan je gegevens?

- Alles staat op je eigen werkplek: in de map `memeet-data` die je bij de installatie kiest, of (tijdelijk) in de opslag van de browser.
- MeMeet maakt **geen verbinding met internet**. Er is geen server, geen account en niemand anders kan meekijken. Een beveiligingsregel in het bestand (Content-Security-Policy) blokkeert elke verbinding vanuit de app.
- Iets verlaat je werkplek alleen als jij dat doet: een mail versturen in Outlook, of een Teams- of iBabs-link openen.

## 2. De datamap kiezen en versleutelen

Kies als datamap de map **Documenten\MeMeet**. Zet de datamap **niet** in OneDrive, Teams of een gedeelde netwerkmap: dan kunnen anderen erbij of staat hij buiten je werkplek. Wordt je map Documenten met OneDrive gesynchroniseerd (het installatiescherm van MeMeet waarschuwt dan), kies dan een map **MeMeet** direct in je gebruikersmap: `C:\Users\jouwnaam\MeMeet`.

Je werkplek heeft meestal al schijfversleuteling (BitLocker). Versleutel daarnaast de map `memeet-data` met je eigen Windows-account. Dan kan niemand anders die bestanden openen, ook niet met een ander account op dezelfde computer. MeMeet merkt er niets van en vraagt geen wachtwoord.

1. Open de map **Documenten\MeMeet** in Verkenner. In MeMeet kan dat ook via **Help › Installatie** › *memeet-data openen in Verkenner*.
2. Klik met de rechtermuisknop op de map **memeet-data** en kies **Eigenschappen**.
3. Klik op het tabblad **Algemeen** op **Geavanceerd…**.
4. Vink **Inhoud versleutelen om gegevens te beveiligen** aan, klik op **OK** en daarna op **Toepassen**.
5. Kies **Wijzigingen toepassen op deze map, submappen en bestanden** en klik op **OK**. De bestanden krijgen een slotje.

Vraagt Windows om een back-up van je versleutelingssleutel te maken, volg dan die stappen of vraag de servicedesk hoe dat bij jouw organisatie gaat. Is de optie grijs of ontbreekt hij, dan heeft je organisatie mapversleuteling uitgezet. De schijfversleuteling van de werkplek beschermt je gegevens dan.

## 3. Wat noteer je wel, en wat niet?

Schrijf op wat je nodig hebt om je werk te doen: besluiten, acties, afspraken en punten voor een volgend overleg.

**Wel**
- Feiten en afspraken: *"= begroting 2027 gaat naar de raad"*, *"! Petra stuurt de planning"*.
- Punten om later in te brengen: *"> Jan: opleidingsplan"*.

**Niet**
- Gegevens over **gezondheid**, ziekte of verzuim van een persoon, **godsdienst**, **etnische afkomst**, **lidmaatschap van een vakbond** of andere bijzondere persoonsgegevens.
- **Burgerservicenummers** (BSN) en **strafrechtelijke** gegevens.
- **Oordelen of meningen over personen** (*"Jan functioneert slecht"*). Schrijf liever wat er is afgesproken (*"> Jan: escalatieafspraken bespreken"*).

Ook je eigen aantekeningen kunnen onder een verzoek op grond van de **Wet open overheid** (Woo) of een **inzageverzoek** van een collega vallen. Schrijf daarom alleen wat je ook zou kunnen laten zien.

## 4. Vergaderstukken

- Gevoelige stukken (bijvoorbeeld over personeel, gezondheid of strafzaken) lees je in **iBabs** of in de bron, niet in MeMeet.
- Heb je zo'n stuk toch in MeMeet gezet? Verwijder het als je het niet meer nodig hebt (rechts **✕** bij het stuk).

## 5. Delen en mailen

- **Mail** bij een vergadering maakt een conceptmail in Outlook. Controleer altijd de ontvangers en de tekst voordat je op Verzenden klikt.
- Punten die met `>` beginnen en ideeën met `?` gaan **nooit** mee in de mail; die blijven privé.
- Een bestand mailen vanuit **Bestanden** maakt ook een conceptmail; controleer ook daar de ontvangers.

## 6. Bewaren en elk jaar opschonen

Bewaar je aantekeningen niet langer dan nodig. Schoon daarom **elk jaar in de laatste week van december** je gegevens op. MeMeet herinnert je daaraan met een balk bovenaan de pagina Vergaderingen; klik op **Gegevens opschonen**. Het kan ook op een ander moment, via **Help** of het installatiescherm.

| Wordt verwijderd | Blijft bewaard |
| --- | --- |
| Alle vergaderingen tot en met vandaag, met de stukken, originele mails, eerdere versies, markeringen, aantekeningen en acties | Herinneringspunten die aan een overleg gekoppeld zijn of op een overleg wachten |
| De losse acties en mails op de actielijst | Je ideeën |
| Afgevinkte herinneringen | Vergaderingen na vandaag, met wat erbij hoort |

Punten en ideeën uit de aantekeningen van een verwijderde vergadering worden losse herinneringen en komen gewoon op bij hetzelfde overleg. **Wat weg is, kun je niet terughalen.**

## 7. Back-up

- Een back-up is een kopie van de hele map `memeet-data`.
- Zet die kopie alleen op een plek die even goed beveiligd is, bijvoorbeeld je persoonlijke netwerkschijf.
- Niet op een USB-stick, in OneDrive of in een gedeelde map: daar is de kopie niet versleuteld of kunnen anderen erbij.
- Schoon je je gegevens op, verwijder dan ook oude back-ups.

## 8. Bijwerken naar een nieuwe versie

- Krijg je MeMeet via je IV-afdeling, gebruik dan die versie.
- Haal je MeMeet zelf van [GitHub](https://github.com/oss-aigp/memeet/blob/main/dist/MeMeet.html), controleer dan het controlegetal. Klik in Downloads met de rechtermuisknop op een lege plek, kies **In Terminal openen** en typ:

```powershell
Get-FileHash MeMeet.html
```

- De lange code moet gelijk zijn aan die in [MeMeet.html.sha256](https://github.com/oss-aigp/memeet/blob/main/dist/MeMeet.html.sha256) (hoofd- of kleine letters maakt niet uit). Is hij anders, gebruik het bestand dan niet en meld het bij de servicedesk.

## 9. Verzoeken van collega's of over de Woo

Vraagt de functionaris gegevensbescherming (FG) of de Woo-coördinator je om gegevens over een persoon of onderwerp? Zoek dan in MeMeet:

- op de pagina **Vergaderingen** met het zoekvak (titel, namen en aantekeningen);
- in **Bestanden** (bestandsnamen en vergaderingen);
- in **Herinneringen**.

Lever wat je vindt aan zoals gevraagd. Pas onjuiste gegevens aan of verwijder ze als dat wordt gevraagd.

## 10. Kwijt of misgegaan?

Is je laptop kwijt, heb je een mail naar de verkeerde persoon gestuurd, of denk je dat iemand bij je gegevens kon? Meld het **direct** bij de servicedesk of het meldpunt datalekken van je organisatie. Ook als je twijfelt.


## 11. Uitbreiding Postvak (optioneel)

Het Postvak staat standaard uit. Zet het alleen aan als je stukken via een gedeelde map wilt ontvangen, bijvoorbeeld van je secretaresse.

**Aanzetten en het postvak kiezen**

1. Vraag beheer om een map op de netwerkschijf waar **alleen jij en je secretaresse** bij kunnen. Beheer stelt de toegangsrechten in; doe dat niet zelf.
2. Open in MeMeet de help (**?**) › tabblad **Uitbreidingen** en zet **Postvak** aan. Lees de privacytekst en klik op **Aanzetten**.
3. Open **Help › Installatie** (of het installatiescherm) en klik bij **Uitbreiding Postvak** op **Postvak kiezen…**. Kies de map en klik op **Toestaan**.
4. MeMeet maakt in het postvak een map per vergadering van de komende 14 dagen, en de mappen `Nog in te delen` en `Verwerkt`.

Bij elke start vraagt de browser of MeMeet het postvak weer mag gebruiken. Is de netwerkschijf niet verbonden, dan meldt MeMeet dat op de pagina Vergaderingen.

**Gebruik**

- Zet een stuk in de map van de vergadering. Binnen een minuut staat het bij die vergadering, met het kenmerk *via postvak*.
- Een uitnodiging of een mail met stukken mag ook in de hoofdmap van het postvak. Wat MeMeet niet kan koppelen, staat op de pagina Vergaderingen onder **Postvak: nog in te delen**; kies daar de vergadering.
- Na verwerken gaat het bestand naar `Verwerkt` (of wordt het verwijderd, als je dat in het installatiescherm kiest).

**Veiligheid**

- Gebruik op een gedeelde map **geen** Windows-mapversleuteling ("Inhoud versleutelen"): dan kan je secretaresse er niet meer bij. De map wordt beschermd door de toegangsrechten die beheer instelt, en door de beveiliging van de netwerkschijf.
- Er gaat niets van je datamap naar het postvak. De mapnamen bevatten alleen de datum, de tijd en de titel van je vergaderingen. Wie bij het postvak kan, ziet die titels.
- Het jaarlijks opschonen maakt ook de map `Verwerkt` leeg. Vraag je secretaresse geen kopieën elders te bewaren.
- Zet je de uitbreiding uit, dan vraagt MeMeet of het de koppeling met het postvak moet vergeten. De map zelf en wat erin staat, blijven bestaan.

**Outlook**

De eenvoudigste werkwijze: een regel in Outlook zet mails met stukken in een Outlook-map **MeMeet**. Daaruit sleep je ze naar het postvak in Verkenner, of rechtstreeks naar MeMeet.

- *Klassieke Outlook:* maak een map **MeMeet** onder Postvak IN. Kies **Bestand › Regels en waarschuwingen beheren › Nieuwe regel › Regel toepassen op berichten die ik ontvang**, kies de voorwaarden (bijvoorbeeld *van* je secretaresse en *met een bijlage*) en de actie **verplaatsen naar de opgegeven map › MeMeet**.
- *Nieuwe Outlook:* maak een submap **MeMeet**. Kies **Instellingen › Mail › Regels › Nieuwe regel toevoegen**, met als actie **Verplaatsen naar › MeMeet**. Kun je een mail niet slepen, kies dan bij de mail **⋯ › Opslaan als** en zet het bestand in het postvak.
- *Extra, alleen klassieke Outlook:* de macro `MeMeet-naar-postvak` (in de help van de uitbreiding, met een knop om te kopiëren) zet geselecteerde mails als `.msg` in het postvak. Hij werkt ook in een regel met de actie **een script uitvoeren**, als je organisatie dat toestaat.

---

*Deze instructie hoort bij MeMeet 1.9.0 en sluit aan op de [DPIA voor MeMeet](20261126%20DPIA%20MeMeet%20v1.9.0.pdf).*
