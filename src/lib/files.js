export function formatBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatDate(iso, withTime = false) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T23:59:59')
  return Math.ceil((d - new Date()) / 86400000)
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const extOf = (name) => (name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase()

export const isPdf = (file) => file && (file.type === 'application/pdf' || extOf(file.name) === 'pdf')
export const isImage = (file) => file && (file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extOf(file.name)))

/** Maakt een veilige bestandsnaam (geen tekens die Windows/macOS weigeren). */
export function safeName(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
