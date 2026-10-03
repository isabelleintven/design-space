# Overdracht — Design Space

_Bijgewerkt: 3 oktober 2026, branch `developer` (gemerged naar `main`)_

## Waar we gebleven waren
- Nieuw logo en favicon: koe in een retro-ufo als dunne lijntekening (`src/App.jsx`, `public/favicon.svg`; favicon past zich aan licht/donker tabblad aan).
- Landingspagina compacter: Quick Tools staan direct onder de knoppen en zijn zonder scrollen zichtbaar; achtergrond iets hoger uitgelijnd.
- Achtergrond is nu de "space cow" (Magnific-afbeelding), met de titel weer gecentreerd; uitsnede afgestemd op desktop en telefoon.
- Glas-effect echt werkend gemaakt: de minifier gooide `backdrop-filter` weg als `-webkit-` erachter stond. Zet in `styles.css` altijd eerst `-webkit-backdrop-filter`, daarna `backdrop-filter`.
- Nieuwe tools: Feedback op PDF (pins + PDF met notities), Kleuren uit PDF of logo (palet, exacte CMYK/RGB, contrast, naar klantpreset) en Beeldformaten (10 social/web-formaten met focuspunt).
- Spellingcontrole heeft nu een leesbaarheidsscore (Flesch-Douma/B1).
- Homepage: Planning-tijdlijn met alle deadlines (8 weken). Project: tab Tijdlijn + knop "Verstuurd?" per versie.
- Klantpresets kunnen huisstijlkleuren bewaren.
- Alle 18 end-to-end-stappen in Chrome groen, geen console-fouten.

## Wat nog open staat
- Spellingcontrole zonder LanguageTool vangt geen echte spelfouten.
- Projecten synchroniseren niet tussen collega's (alleen export/import via `.dspace`).
- Leesbaarheid: een lange-zinmelding verbergt meldingen binnen die zin (meldingen mogen elkaar niet overlappen).
- Automatisch publiceren via GitHub Actions kan pas na `gh auth refresh -h github.com -s workflow`.

## Zo pak je het weer op
1. `cd "/Users/isabelleintven/Documents/AI/Team Vormgeving/Design Space"`, `git checkout developer`, `git pull`
2. `npm install` en `npm run dev` → http://localhost:5173
3. Preview: `npm run deploy` op `developer` → https://isabelleintven.github.io/design-space/dev/
4. Live zetten: `git checkout main && git merge developer && git push && npm run deploy && git checkout developer`
