# Design Space

Een modulaire, lokale toolbox voor grafisch vormgevers. Gratis, zonder installatie, en alles wordt **in je eigen browser** verwerkt: er wordt niets geüpload.

**Openen:** https://isabelleintven.github.io/design-space/

## Twee manieren van werken

**Quick Tools**: open Design Space, kies een tool en ga direct aan de slag. Je hoeft geen project aan te maken en er wordt niets bewaard.

**Projecten**: voor grotere opdrachten (bijv. *Keurslager – Kerstfolder 2027*). Design Space onthoudt de klant, deadline, briefing, bronbestanden met versies, correctierondes, exports en de klantpreset. Alle tools werken ook binnen een project en gebruiken die context.

## Tools

| Tool | Wat het doet |
| --- | --- |
| Briefing samenvatten | Kernzinnen, deadline & planning, op te leveren items, specificaties, budget, contact en open vragen uit een briefing. In een project: deadline overnemen en takenlijst maken |
| Bestanden vergelijken | V1 en V2 (PDF/PNG/JPG) visueel vergelijken (verschillen, schuifregelaar of naast elkaar) plus tekstverschillen per pagina |
| PDF-check | Eindformaat, TrimBox, afloop, ingesloten fonts, effectieve beeldresolutie (ppi), RGB/CMYK, steunkleuren en transparantie |
| Feedback naar checklist | Mail of appje van de klant omzetten naar een afvinkbare correctielijst (herkent paginanummers en vragen) |
| Feedback op PDF | Klik op een plek in de PDF en typ een opmerking; export als checklist of als PDF met genummerde markeringen, echte PDF-notities en een opmerkingenpagina |
| Spellingcontrole | Lokale typografie-/tekstcontrole en leesbaarheid (Flesch-Douma, B1: lange zinnen, moeilijke woorden, lijdende vorm), optioneel uitgebreid via LanguageTool (online) |
| Bestanden hernoemen | Batch-hernoemen volgens een patroon, als ZIP of direct in een map (Chrome/Edge) |
| Exportpakket | Eindbestanden bundelen in een nette mappenstructuur met LEESMIJ en correctierondes |
| Kleuren uit PDF of logo | Palet uit beeld of exacte CMYK/RGB en steunkleuren uit een PDF, contrastcheck (WCAG) en opslaan in de klantpreset |
| Beeldformaten | Eén beeld naar alle social- en webformaten (Instagram, Story, LinkedIn, Facebook, YouTube, web, nieuwsbrief) met focuspunt |
| PDF naar tabel | Prijslijsten en tabellen uit een PDF naar Excel (.xlsx), CSV of klembord, met bedragen als echte getallen |

## Projecten: planning & tijdlijn

De homepage toont alle deadlines van de komende 8 weken op één tijdlijn. Per project is er een tijdlijn met versies, correctierondes, exports en mijlpalen. Markeer bij *Bestanden & versies* welke versie naar de klant is verstuurd.

## Klantpresets

Leg per klant de naamgeving (bijv. `{klant}_{project}_{naam}_v{versie}`) en drukwerkeisen (formaat, afloop, ppi) vast. Projecten met een preset gebruiken die automatisch in de PDF-check, bij het hernoemen en in het exportpakket.

## Opslag & delen

Projecten worden opgeslagen in de browser (IndexedDB) op je eigen computer. Wil je een project delen met een collega of een back-up maken? Ga naar **Instellingen → Exporteer project**. Dat levert een `.dspace`-bestand op, dat je collega importeert via **Projecten → Project importeren**.

## Ontwikkelen

```bash
npm install
npm run dev      # lokaal op http://localhost:5173
npm run build    # productiebuild in dist/
```

### Branches

- `developer`: hier wordt aan gewerkt. `npm run deploy` publiceert een preview op https://isabelleintven.github.io/design-space/dev/ (met eigen opslag, herkenbaar aan het rode DEV-label).
- `main`: de versie voor het team. Merge `developer` naar `main` en draai daar `npm run deploy` om de hoofdsite bij te werken.

Gebouwd met React, Vite, pdf.js, pdf-lib en JSZip. Achtergrond: "space cow", gemaakt met Magnific.
