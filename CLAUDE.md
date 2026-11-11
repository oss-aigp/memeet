# MeMeet: werkafspraken

## Commit en push
- Maak bij **elke wijziging** meteen een commit en push die naar `main`. Vraag niet eerst om toestemming.
- Haal eerst de laatste stand op (`git fetch origin main`) en zorg dat de push een gewone fast-forward is. Gebruik nooit een force push zonder uitdrukkelijke toestemming.
- Commitberichten in het Nederlands, in de stijl `vX.Y.Z: korte omschrijving`.

## Versies en bouwen
- Code staat in `src/`. Het eindproduct is `dist/MeMeet.html` (één zelfstandig HTML-bestand).
- Verhoog bij een wijziging aan de app de versie in `package.json` en draai daarna `npm run build`. Het buildscript bewaart de vorige versie automatisch als `dist/archive/MeMeet-v<versie>.html`. Commit die mee.
- Werk de README bij als er iets verandert dat gebruikers zien.

## Let op in de code
- `setHTML` (in `src/mail-parser.js`) bouwt elementen zelf op en ondersteunt geen SVG. Gebruik voor iconen tekst of CSS.
- Test wijzigingen aan de interface in een browser (Playwright, `dist/MeMeet.html` via `file://`).
