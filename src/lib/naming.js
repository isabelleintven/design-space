import { safeName } from './files'

const pad = (n, len) => String(n).padStart(len, '0')

/**
 * Vult een naamgevingspatroon in.
 * Tokens: {klant} {project} {naam} {origineel} {nr} {versie} {datum}
 * Optioneel met lengte: {nr:3} → 001, {versie:1} → 2
 */
export function renderPattern(pattern, values, { separator = '_', lowercase = false } = {}) {
  const d = values.datum instanceof Date ? values.datum : new Date()
  const map = {
    klant: values.klant || '',
    project: values.project || '',
    naam: values.naam || '',
    origineel: values.origineel || '',
    datum: `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`,
  }
  let name = pattern.replace(/\{(\w+)(?::(\d))?\}/g, (m, key, len) => {
    if (key === 'nr') return pad(values.nr ?? 1, Number(len || 2))
    if (key === 'versie') return pad(values.versie ?? 1, Number(len || 2))
    return key in map ? map[key] : m
  })
  name = safeName(name)
  if (separator !== ' ') name = name.replace(/ /g, separator)
  if (separator) {
    const esc = separator.replace(/[-_]/g, '\\$&')
    name = name.replace(new RegExp(`(${esc}){2,}`, 'g'), separator).replace(new RegExp(`^(${esc})+|(${esc})+$`, 'g'), '')
  }
  if (lowercase) name = name.toLowerCase()
  return values.ext ? `${name}.${values.ext}` : name
}
