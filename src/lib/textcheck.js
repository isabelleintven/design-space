// Lokale tekstcontroles (zonder internet) + optionele LanguageTool-koppeling.

export function localChecks(text) {
  const issues = []
  const push = (index, length, message, replacement, type = 'stijl') =>
    issues.push({ offset: index, length, message, replacements: replacement != null ? [replacement] : [], type, source: 'lokaal' })

  // Dubbele woorden: "de de"
  for (const m of text.matchAll(/\b([\p{L}]+)\s+\1\b/giu)) push(m.index, m[0].length, `Dubbel woord: "${m[1]}"`, m[1], 'spelling')
  // Dubbele spaties
  for (const m of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) push(m.index, m[0].length, 'Dubbele spatie', ' ', 'typografie')
  // Spatie vóór leesteken
  for (const m of text.matchAll(/ +([,.;:!?])(?!\d)/g)) push(m.index, m[0].length, 'Spatie vóór leesteken', m[1], 'typografie')
  // Geen spatie na leesteken
  for (const m of text.matchAll(/(?<=[a-zÀ-ſ])([,;:])(?=[A-Za-zÀ-ſ])/g)) push(m.index, 1, 'Geen spatie na leesteken', `${m[1]} `, 'typografie')
  // Herhaalde leestekens
  for (const m of text.matchAll(/([!?.,])\1+(?!\.)/g)) if (m[0] !== '...') push(m.index, m[0].length, 'Herhaald leesteken', m[1], 'typografie')
  // Kleine letter aan begin van zin
  for (const m of text.matchAll(/(?:^|[.!?]\s+)([a-zà-ÿ])/gm)) {
    const idx = m.index + m[0].length - 1
    const before = text.slice(Math.max(0, idx - 6), idx)
    if (/\b(?:[a-z]\.){1,3}\s*$|(?:bijv|ca|nr|evt|incl|blz|pag)\.\s*$/i.test(before)) continue
    if (/^'[st]\b/.test(text.slice(idx - 1))) continue
    push(idx, 1, 'Zin begint met kleine letter', m[1].toUpperCase(), 'hoofdletter')
  }
  // Rechte aanhalingstekens (typografisch)
  for (const m of text.matchAll(/"([^"\n]{1,200})"/g)) push(m.index, m[0].length, 'Rechte aanhalingstekens; typografisch is “…”', `“${m[1]}”`, 'typografie')
  // Streepje tussen getallen → en-dash
  for (const m of text.matchAll(/(\d) ?- ?(\d)/g)) push(m.index, m[0].length, 'Gebruik een en-dash (–) tussen getallen', `${m[1]}–${m[2]}`, 'typografie')
  // Bedragen: "€5" → "€ 5"
  for (const m of text.matchAll(/€(\d)/g)) push(m.index, 2, 'Zet een (vaste) spatie na het euroteken', `€ ${m[1]}`, 'typografie')
  return issues
}

/** Uitgebreide spelling-/grammaticacontrole via de gratis LanguageTool API (tekst gaat naar languagetool.org). */
export async function languageToolCheck(text) {
  const chunks = chunk(text, 18000)
  const all = []
  let offset = 0
  for (const c of chunks) {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: c, language: 'nl', level: 'default' }),
    })
    if (res.status === 429) throw new Error('LanguageTool: te veel aanvragen. Probeer het over een minuut opnieuw.')
    if (!res.ok) throw new Error(`LanguageTool gaf een fout (${res.status}).`)
    const data = await res.json()
    for (const m of data.matches) {
      all.push({
        offset: m.offset + offset,
        length: m.length,
        message: m.message,
        replacements: m.replacements.slice(0, 5).map((r) => r.value),
        type: m.rule?.issueType === 'misspelling' ? 'spelling' : m.rule?.category?.name?.toLowerCase() || 'grammatica',
        source: 'LanguageTool',
      })
    }
    offset += c.length
  }
  return all
}

function chunk(text, size) {
  if (text.length <= size) return [text]
  const out = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(text.length, i + size)
    if (end < text.length) {
      const br = text.lastIndexOf('\n', end)
      if (br > i + size / 2) end = br + 1
    }
    out.push(text.slice(i, end))
    i = end
  }
  return out
}

/** Verwijdert overlappende meldingen (LanguageTool heeft voorrang). */
export function mergeIssues(...lists) {
  const merged = []
  for (const list of lists) {
    for (const issue of list) {
      const overlap = merged.some((m) => issue.offset < m.offset + m.length && m.offset < issue.offset + issue.length)
      if (!overlap) merged.push(issue)
    }
  }
  return merged.sort((a, b) => a.offset - b.offset)
}
