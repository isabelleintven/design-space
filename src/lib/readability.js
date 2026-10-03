// Leesbaarheid van Nederlandse tekst (Flesch-Douma) + concrete aandachtspunten.

export function syllables(word) {
  const w = word.toLowerCase().replace(/ij/g, 'y').replace(/[^a-zà-ÿy]/g, '')
  if (!w) return 0
  const groups = w.match(/[aeiouyàáâäèéêëìíîïòóôöùúûü]+/g) || []
  return Math.max(1, groups.length)
}

const LEVELS = [
  [80, 'Zeer makkelijk', 'ok'],
  [60, 'Makkelijk (± B1)', 'ok'],
  [50, 'Redelijk', 'warn'],
  [30, 'Moeilijk', 'warn'],
  [-Infinity, 'Zeer moeilijk', 'fail'],
]

export function readability(text) {
  const sentenceMatches = [...text.matchAll(/[^.!?\n]+(?:[.!?]+|\n|$)/g)].filter((m) => /\p{L}/u.test(m[0]))
  const words = text.match(/\p{L}[\p{L}'-]*/gu) || []
  const syl = words.reduce((n, w) => n + syllables(w), 0)
  const wordsPerSentence = words.length / Math.max(1, sentenceMatches.length)
  const sylPerWord = syl / Math.max(1, words.length)
  const score = Math.round(206.835 - 0.93 * wordsPerSentence - 77 * sylPerWord)
  const [, label, status] = LEVELS.find(([min]) => score >= min)

  const issues = []
  for (const m of sentenceMatches) {
    const count = (m[0].match(/\p{L}[\p{L}'-]*/gu) || []).length
    if (count > 22) {
      const start = m.index + m[0].search(/\S/)
      issues.push({
        offset: start,
        length: m[0].trim().length,
        message: `Lange zin (${count} woorden). Voor B1 liever onder de 15–20 woorden: knip hem op.`,
        replacements: [],
        type: 'leesbaarheid',
        source: 'leesbaarheid',
      })
    }
  }
  for (const m of text.matchAll(/\p{L}[\p{L}'-]*/gu)) {
    const w = m[0]
    if ((syllables(w) >= 5 || w.length >= 16) && !/^[A-Z]{2,}$/.test(w))
      issues.push({ offset: m.index, length: w.length, message: `Moeilijk/lang woord (${syllables(w)} lettergrepen). Is er een korter of gewoner woord?`, replacements: [], type: 'leesbaarheid', source: 'leesbaarheid' })
  }
  for (const m of text.matchAll(/\b(wordt|worden|werd|werden)\b(?:\s+\p{L}+){0,5}?\s+(ge\p{L}+(?:d|t|en)|\p{L}+(?:eerd|eert))\b/giu))
    issues.push({ offset: m.index, length: m[0].length, message: 'Lijdende vorm. Actief schrijven ("wij sturen" i.p.v. "wordt gestuurd") leest prettiger.', replacements: [], type: 'leesbaarheid', source: 'leesbaarheid' })

  return {
    score,
    label,
    status,
    words: words.length,
    sentences: sentenceMatches.length,
    wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    longSentences: issues.filter((i) => i.message.startsWith('Lange zin')).length,
    hardWords: issues.filter((i) => i.message.startsWith('Moeilijk')).length,
    passive: issues.filter((i) => i.message.startsWith('Lijdende')).length,
    issues,
  }
}
