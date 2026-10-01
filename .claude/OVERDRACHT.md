# Overdracht — Design Space

_Bijgewerkt: 1 oktober 2026, branch `main`_

## Waar we gebleven waren
- Design Space gebouwd als gratis web-app (React + Vite), gehost op GitHub Pages: https://isabelleintven.github.io/design-space/
- Alles draait lokaal in de browser (pdf.js, pdf-lib, JSZip); projecten worden opgeslagen in IndexedDB en zijn te delen als `.dspace`-bestand.
- Werkende tools: Bestanden vergelijken, PDF-check, Feedback naar checklist, Spellingcontrole (lokaal + optioneel LanguageTool), Bestanden hernoemen, Exportpakket.
- Project workspace: overzicht (deadline, briefing, KPI's), bestanden met versies, correctierondes, exports, instellingen, plus klantpresets (naamgeving + PDF-eisen).
- Glass-stijl met bosachtergrond (Unsplash), Italiana-serif koppen en dunne frame-lijnen zoals in het voorbeeld.
- Getest in Chrome met een end-to-end script (alle stappen groen, geen console-fouten).

## Wat nog open staat
- "Briefing samenvatten" en "PDF naar tabel" staan als *binnenkort* op het home screen.
- Spellingcontrole zonder LanguageTool vangt geen echte spelfouten (alleen typografie/dubbele woorden; de browser onderstreept in het tekstvak).
- Projecten staan per browser; er is geen automatische synchronisatie tussen collega's (alleen export/import).
- Publiceren gaat via `npm run deploy` (gh-pages-branch), omdat het gh-token geen `workflow`-scope heeft. Wil je automatisch publiceren bij elke push: `gh auth refresh -h github.com -s workflow` en voeg een Pages-workflow toe.
- Lokale build is traag (~1,5 min) doordat de map in Documenten staat.

## Zo pak je het weer op
1. `cd "/Users/isabelleintven/Documents/AI/Team Vormgeving/Design Space"` en `git pull`
2. `npm install` en `npm run dev` → open http://localhost:5173
3. Wijzigingen online zetten: `npm run deploy` (daarna 1–2 minuten wachten)
4. Volgende stap: een van de *binnenkort*-tools bouwen of feedback van het team verwerken
