# Overdracht — Design Space

_Bijgewerkt: 2 oktober 2026, branch `developer`_

## Waar we gebleven waren
- Werkwijze met twee branches: werken op `developer`, uitbrengen via `main`. `npm run deploy` publiceert vanaf `developer` naar `/dev/` (eigen database, DEV-label) en vanaf `main` naar de hoofdsite.
- Nieuwe achtergrond: zonnige wei (iStock-foto) met een "space cow": SVG-ruimtehelm, antenne en twinkelende sterren. Foto gespiegeld en aangevuld, zodat het kalf rechts naast de tekst staat; aparte uitsneden voor desktop, tablet en telefoon.
- Nieuw logo: planeet met ring, maantje en ster (lijnstijl).
- Nieuwe tools: *Briefing samenvatten* (lokaal, zonder AI) en *PDF naar tabel* (kolommen via witruimte, export naar .xlsx/.csv/klembord, eigen xlsx-schrijver).
- Build duurt nu 0,2 s (de oude bosfoto in de CSS was de vertrager).
- Alle 13 end-to-end-stappen in Chrome groen, geen console-fouten.

## Wat nog open staat
- Wachten op keuze van de gebruiker uit de lijst met extra kansen (zie gesprek van 2 okt).
- `developer` is nog niet naar `main` gemerged; de hoofdsite toont nog de bos-versie.
- Spellingcontrole zonder LanguageTool vangt geen echte spelfouten.
- Projecten synchroniseren niet tussen collega's (alleen export/import via `.dspace`).
- Automatisch publiceren via GitHub Actions kan pas na `gh auth refresh -h github.com -s workflow`.

## Zo pak je het weer op
1. `cd "/Users/isabelleintven/Documents/AI/Team Vormgeving/Design Space"`, `git checkout developer`, `git pull`
2. `npm install` en `npm run dev` → http://localhost:5173
3. Preview online: `npm run deploy` op `developer` → https://isabelleintven.github.io/design-space/dev/
4. Uitbrengen: `git checkout main && git merge developer && git push && npm run deploy`
