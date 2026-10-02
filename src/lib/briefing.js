// Haalt de kern uit een briefing, volledig lokaal (geen AI): kernzinnen, data,
// specificaties, budget, contact, op te leveren items en open vragen.

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const MONTH_RE = '(jan(?:uari)?|feb(?:ruari)?|maa(?:rt)?|mrt|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|aug(?:ustus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DAY_RE = '(?:(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo)\\.?\\s+)?'

const STOP = new Set(
  `de het een en van in op te dat die is voor met aan er niet zijn om ook als bij of maar dan nog wel naar uit door over je we wij ze zij hij ik u jullie onze ons hun deze dit wordt worden kan kunnen moet moeten zal zullen heeft hebben had was waren al meer veel zo wat wie waar hoe toch even graag tot per via na ca.`.split(/\s+/),
)

/** Splitst tekst in zinnen/regels, met behoud van opsommingstekens als losse items. */
export function sentences(text) {
  const out = []
  for (const raw of text.replace(/\r/g, '').split(/\n+/)) {
    const line = raw.replace(/^\s*([-*•–·▪]|\d+[.)])\s+/, '').trim()
    if (!line) continue
    if (/^\s*([-*•–·▪]|\d+[.)])\s+/.test(raw) || line.length < 160) {
      out.push(line)
      continue
    }
    line
      .replace(/\b(o\.a|i\.p\.v|bijv|evt|incl|excl|ca|nr|blz|pag|m\.b\.t|t\.a\.v|z\.s\.m|d\.w\.z)\./gi, (m) => m.replace(/\./g, '§'))
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])/)
      .forEach((s) => s.trim() && out.push(s.replace(/§/g, '.').trim()))
  }
  return out
}

function parseDate(str, now = new Date()) {
  let m = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
    return new Date(y, Number(m[2]) - 1, Number(m[1]))
  }
  m = str.match(new RegExp(`(\\d{1,2})\\s+${MONTH_RE}\\.?(?:\\s+(\\d{4}))?`, 'i'))
  if (m) {
    const mi = MONTHS.findIndex((name) => name.startsWith(m[2].toLowerCase().replace('mrt', 'maa').slice(0, 3)))
    let y = m[3] ? Number(m[3]) : now.getFullYear()
    const d = new Date(y, mi, Number(m[1]))
    if (!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)) d.setFullYear(y + 1)
    return d
  }
  m = str.match(/week\s*(\d{1,2})(?:\s+(\d{4}))?/i)
  if (m) {
    // vrijdag van ISO-week
    const y = m[2] ? Number(m[2]) : now.getFullYear()
    const jan4 = new Date(y, 0, 4)
    const monday = new Date(jan4)
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (Number(m[1]) - 1) * 7)
    monday.setDate(monday.getDate() + 4)
    return monday
  }
  return null
}

export const toIso = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '')

const SPEC_PATTERNS = [
  ['Formaat', /\b(A[0-7]|DL|A[0-7]\/?DL|\d{2,4}\s?[x×]\s?\d{2,4}\s?(mm|cm|px)?|vierkant|liggend|staand|gevouwen|wikkelvouw|zigzag|vouwblad|leporello)\b/i],
  ["Omvang", /\b(\d+\s?(pagina'?s|pag\.?|blz|panelen|zijdes?|kanten))\b/i],
  ['Oplage', /\b(oplage|aantal|stuks|exemplaren|ex\.)\b/i],
  ['Papier', /\b(\d{2,3}\s?(gr|grs|gram|g\/m2|g\/m²)|papier|mc|mat|glans|silk|houtvrij|gerecycled|fsc|cover|omslag|laminaat|lak|uv-?lak|foliedruk|preeg)\b/i],
  ['Kleur', /\b(cmyk|rgb|pms|pantone|steunkleur|full ?colou?r|4\/4|4\/0|1\/1|zwart-?wit|huisstijlkleur)\b/i],
  ['Drukwerk', /\b(afloop|bleed|snijtekens|snijlijnen|pdf\/?x|drukker|drukkerij|drukklaar|aanlevering|aanleverspecificatie)\b/i],
  ['Online', /\b(social|instagram|facebook|linkedin|banner|nieuwsbrief|website|story|stories|post|mailing|display|gif|video|animatie)\b/i],
]

const DELIVERABLE = /\b(opleveren|oplevering|aanleveren|leveren|nodig|benodigd|gevraagd|ontwerpen|ontwerp van|vormgeven|maken|realiseren|middelen|uitingen|deliverables?)\b/i
const TONE = /\b(doelgroep|uitstraling|sfeer|tone of voice|toon|stijl|huisstijl|look ?(and|&) ?feel|beeldtaal|merk|positionering|boodschap|doel(stelling)?)\b/i
const DEADLINE = /\b(deadline|uiterlijk|uiterste|vóór|oplever\w*|aanlever\w*|lancering|live|drukker\w*|naar de drukker|verschijn\w*|presentatie|eerste versie|concept|proef|correctie\w*)\b/i

export function summarizeBriefing(text, { maxKey = 5 } = {}) {
  const sents = sentences(text)

  // ---- Kernzinnen: woordfrequentie + positie ----
  const words = (s) => s.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) || []
  const freq = new Map()
  for (const s of sents) for (const w of words(s)) if (!STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1)
  const scored = sents.map((s, i) => {
    const ws = words(s).filter((w) => !STOP.has(w))
    const base = ws.reduce((n, w) => n + (freq.get(w) || 0), 0) / Math.max(4, ws.length ** 0.8)
    const position = i < 3 ? 1.4 : i < 8 ? 1.15 : 1
    const signal = TONE.test(s) || DELIVERABLE.test(s) ? 1.25 : 1
    const tooShort = ws.length < 4 ? 0.3 : 1
    return { s, i, score: base * position * signal * tooShort }
  })
  const key = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKey)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)

  // ---- Data & deadlines ----
  const dateRe = new RegExp(`${DAY_RE}(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{1,2}\\s+${MONTH_RE}\\.?(?:\\s+\\d{4})?|week\\s*\\d{1,2}(?:\\s+\\d{4})?)`, 'gi')
  const dates = []
  for (const s of sents) {
    for (const m of s.matchAll(dateRe)) {
      const date = parseDate(m[0])
      if (!date || isNaN(date)) continue
      dates.push({ label: m[0].trim(), date: toIso(date), context: s, isDeadline: DEADLINE.test(s) })
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date))
  const deadline =
    [...dates].reverse().find((d) => /deadline|uiterlijk|uiterste|oplever|lancering|live|verschijn/i.test(d.context)) ||
    dates.filter((d) => d.isDeadline).at(-1) ||
    null

  // ---- Specificaties ----
  const specs = []
  for (const s of sents) {
    const hits = SPEC_PATTERNS.filter(([, re]) => re.test(s)).map(([k]) => k)
    if (hits.length) specs.push({ kinds: hits, text: s })
  }
  const quantity = text.match(/(?:oplage|aantal)[^\d]{0,20}([\d.]+(?:\s?(?:stuks|ex\.?|exemplaren))?)|([\d.]{3,})\s?(?:stuks|exemplaren|ex\.)/i)

  // ---- Budget ----
  const budget = []
  for (const s of sents) if (/€\s?\d|\d\s?(euro|eur)\b|budget|kosten|offerte|prijs(?:indicatie)?/i.test(s)) budget.push(s)

  // ---- Contact ----
  const emails = [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])]
  const phones = [...new Set((text.match(/(?:\+31|0)[\s-]?(?:\d[\s-]?){8,10}/g) || []).map((p) => p.trim()))]
  const people = []
  for (const s of sents) {
    const m = s.match(/(?:[Cc]ontactpersoon|[Cc]ontact|[Aa]anspreekpunt|[Pp]rojectleider|[Aa]ccountmanager|[Oo]pdrachtgever)\s*(?:is|:)?\s*(?:mevrouw|meneer|mevr\.|dhr\.)?\s*([A-Z][\p{L}]+(?:\s+(?:van|de|der|den|ter|ten)?\s*[A-Z][\p{L}]+)*)/u)
    if (m) people.push(m[1])
  }

  // ---- Op te leveren ----
  // Opsommingen onder een kopje als "Wat we nodig hebben:" tellen als op te leveren items
  const listed = []
  let inList = false
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    const isBullet = /^([-*•–·▪]|\d+[.)])\s+/.test(line)
    if (/:\s*$/.test(line) && DELIVERABLE.test(line)) inList = true
    else if (inList && isBullet) listed.push(line.replace(/^([-*•–·▪]|\d+[.)])\s+/, ''))
    else if (line) inList = false
  }
  const deliverables = [
    ...new Set([
      ...listed,
      ...sents.filter((s) => !/:\s*$/.test(s) && (DELIVERABLE.test(s) || /^\s*(\d+\s*x|\d+\s+(stuks|varianten|formaten))/i.test(s))),
    ]),
  ]

  // ---- Toon, doelgroep, doel ----
  const tone = sents.filter((s) => TONE.test(s))

  // ---- Open vragen ----
  const questions = sents.filter((s) => /\?\s*$/.test(s) || /\b(nog niet bekend|n\.?t\.?b\.?|nader te bepalen|onbekend|volgt nog|wordt nog)\b/i.test(s))

  return {
    stats: { words: (text.match(/\S+/g) || []).length, sentences: sents.length },
    key,
    dates,
    deadline,
    specs,
    quantity: quantity ? (quantity[1] || quantity[2]).trim() : '',
    budget,
    contact: { emails, phones, people: [...new Set(people)] },
    deliverables,
    tone,
    questions,
  }
}

export function summaryToText(sum, title = 'Samenvatting briefing') {
  const sec = (name, items) => (items.length ? [`${name}`, ...items.map((i) => `• ${i}`), ''] : [])
  return [
    title,
    '='.repeat(title.length),
    '',
    ...sec('Kern', sum.key),
    ...sec('Deadline & planning', sum.dates.map((d) => `${d.label} — ${d.context}`)),
    ...sec('Op te leveren', sum.deliverables),
    ...sec('Specificaties', sum.specs.map((s) => s.text)),
    ...sec('Doel, doelgroep & toon', sum.tone),
    ...sec('Budget', sum.budget),
    ...sec('Contact', [...sum.contact.people, ...sum.contact.emails, ...sum.contact.phones]),
    ...sec('Open vragen', sum.questions),
  ].join('\n')
}
