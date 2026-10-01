// Zet vrije klantfeedback (mail, WhatsApp, notities) om naar losse actiepunten.
import { uid } from './db'

const GREETING = /^(hoi|hi|hallo|hey|beste|dag|goedemorgen|goedemiddag|goedenavond|lieve)\b.{0,40}[,!]?$/i
const CLOSING = /^(groet(en|jes)?|met vriendelijke groet|mvg|vriendelijke groet|hartelijke groet|thanks|dank( je| u)?( wel)?|bedankt|alvast bedankt|fijne dag|tot (snel|later|zo))\b/i
const SIGNATURE = /^(verzonden (met|vanaf)|sent from|op .* schreef .*:|from:|van:|aan:|to:|onderwerp:|subject:|datum:|date:|tel(efoon)?[.:]|www\.|https?:\/\/)/i
const ACTION =
  /\b(graag|aanpassen|wijzig|wijzigen|veranderen|vervang|vervangen|toevoegen|voeg|weghalen|verwijder|verwijderen|schrappen|moet|moeten|mag|mogen|kan|kunnen|zou|zouden|liever|groter|kleiner|dikker|dunner|hoger|lager|verplaats|verschuif|omdraaien|kleur|logo|foto|beeld|afbeelding|tekst|titel|kop|lettertype|font|prijs|datum|adres|spelfout|typfout|fout|klopt niet|niet goed|ontbreekt|mist|vergeten|niet|wel|ipv|i\.p\.v\.|in plaats van|wordt|worden|maak|maken|zet|zetten|plaats|centreer|uitlijnen)\b/i

const PAGE = /\b(?:pagina|pag\.?|blz\.?|p\.)\s*(\d+(?:\s*(?:-|t\/m|en|&)\s*\d+)?)/i

function splitSentences(paragraph) {
  // splits op zinseinde, maar niet bij afkortingen als "o.a." of "p. 3"
  return paragraph
    .replace(/\b(o\.a|i\.p\.v|bijv|evt|incl|excl|ca|nr|blz|pag|p|m\.b\.t|t\.a\.v|z\.s\.m|a\.u\.b|d\.w\.z)\./gi, (m) => m.replace(/\./g, '§'))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘(])/)
    .map((s) => s.replace(/§/g, '.').trim())
    .filter(Boolean)
}

export function parseFeedback(text) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())

  // Stop bij het geciteerde deel van een doorgestuurde mail
  const cut = lines.findIndex((l) => /^(-{2,}|_{3,}|>|op .* schreef|on .* wrote|-----original message)/i.test(l))
  const relevant = cut > 0 ? lines.slice(0, cut) : lines

  const items = []
  let currentPage = null

  for (const raw of relevant) {
    if (!raw) continue
    const isBullet = /^([-*•–·▪︎>]|\d+[.)]|[a-z][.)])\s+/i.test(raw)
    const line = raw.replace(/^([-*•–·▪︎]|\d+[.)]|[a-z][.)])\s+/i, '').trim()
    if (!line) continue
    if (GREETING.test(line) || CLOSING.test(line) || SIGNATURE.test(line)) continue

    // Kopjes als "Pagina 3:" of "Achterkant:" gelden als context voor volgende regels
    const heading = line.match(/^([^.!?]{1,32}):$/)
    if (heading) {
      currentPage = heading[1]
      continue
    }

    const parts = isBullet || line.length < 140 ? [line] : splitSentences(line)
    for (const part of parts) {
      if (part.length < 3) continue
      if (GREETING.test(part) || CLOSING.test(part)) continue
      const isQuestion = /\?\s*$/.test(part)
      const actionable = isBullet || ACTION.test(part) || isQuestion
      if (!actionable) continue
      const page = part.match(PAGE)?.[1] || currentPage || ''
      items.push({
        id: uid(),
        text: part.replace(/\s+/g, ' '),
        done: false,
        page: page ? String(page) : '',
        kind: isQuestion ? 'vraag' : 'actie',
      })
    }
  }
  return items
}

export function checklistToText(title, items) {
  const lines = [title, '='.repeat(title.length), '']
  for (const it of items) {
    lines.push(`[${it.done ? 'x' : ' '}] ${it.kind === 'vraag' ? '(vraag) ' : ''}${it.page ? `[${/^\d/.test(it.page) ? 'p.' : ''}${it.page}] ` : ''}${it.text}`)
  }
  return lines.join('\n')
}
