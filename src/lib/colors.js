// Kleuren: palet uit beeld (k-means), exacte kleuren uit PDF-inhoud, omrekenen en contrast.
import { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFRef, PDFDict, decodePDFRawStream } from 'pdf-lib'

export const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** Eenvoudige (niet-ICC) omrekening; geschikt als indicatie, niet als drukproef. */
export function rgbToCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const k = 1 - Math.max(rr, gg, bb)
  if (k >= 1) return [0, 0, 0, 100]
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((v) => Math.round(v * 100))
}

export const cmykToRgb = ([c, m, y, k]) => [c, m, y].map((v) => 255 * (1 - v / 100) * (1 - k / 100))

function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100
}

export const wcag = (ratio) => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA groot' : 'onvoldoende')

/** Palet uit een canvas via k-means op een verkleinde versie. */
export function paletteFromCanvas(canvas, k = 8) {
  const scale = Math.min(1, 140 / Math.max(canvas.width, canvas.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(canvas.width * scale))
  c.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(canvas, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  const px = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) px.push([data[i], data[i + 1], data[i + 2]])
  if (!px.length) return []
  // start: verspreide punten
  let centers = Array.from({ length: k }, (_, i) => px[Math.floor(((i + 0.5) / k) * px.length)])
  let assign = new Array(px.length).fill(0)
  for (let iter = 0; iter < 12; iter++) {
    for (let p = 0; p < px.length; p++) {
      let best = 0
      let bd = Infinity
      for (let j = 0; j < centers.length; j++) {
        const d = (px[p][0] - centers[j][0]) ** 2 + (px[p][1] - centers[j][1]) ** 2 + (px[p][2] - centers[j][2]) ** 2
        if (d < bd) {
          bd = d
          best = j
        }
      }
      assign[p] = best
    }
    const sums = centers.map(() => [0, 0, 0, 0])
    px.forEach((p, i) => {
      const s = sums[assign[i]]
      s[0] += p[0]
      s[1] += p[1]
      s[2] += p[2]
      s[3]++
    })
    centers = sums.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]))
  }
  const counts = centers.map(() => 0)
  assign.forEach((a) => counts[a]++)
  // samenvoegen van bijna-gelijke kleuren
  const out = []
  centers
    .map((c, i) => ({ rgb: c.map(Math.round), share: counts[i] / px.length }))
    .sort((a, b) => b.share - a.share)
    .forEach((col) => {
      const near = out.find((o) => Math.hypot(o.rgb[0] - col.rgb[0], o.rgb[1] - col.rgb[1], o.rgb[2] - col.rgb[2]) < 22)
      if (near) near.share += col.share
      else if (col.share > 0.004) out.push(col)
    })
  return out.map((c) => ({ ...c, hex: toHex(c.rgb), cmyk: rgbToCmyk(c.rgb), exact: false }))
}

/** Exacte kleurwaarden zoals ze in de PDF staan (CMYK- en RGB-operatoren, steunkleuren). */
export async function pdfDocumentColors(file) {
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false })
  const ctx = doc.context
  const lookup = (o) => (o instanceof PDFRef ? ctx.lookup(o) : o)
  const found = new Map()
  const spots = new Set()
  const seen = new Set()
  const num = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\s+'
  const add = (key, entry) => {
    const e = found.get(key)
    if (e) e.count++
    else found.set(key, { ...entry, count: 1 })
  }
  const scan = (stream) => {
    if (!(stream instanceof PDFRawStream)) return
    let t
    try {
      t = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
    } catch {
      return
    }
    for (const m of t.matchAll(new RegExp(`${num}${num}${num}${num}(?:k|K)\\b`, 'g'))) {
      const cmyk = m.slice(1, 5).map((v) => Math.round(Number(v) * 100))
      add(`c${cmyk}`, { cmyk, rgb: cmykToRgb(cmyk).map(Math.round), space: 'CMYK' })
    }
    for (const m of t.matchAll(new RegExp(`${num}${num}${num}(?:rg|RG)\\b`, 'g'))) {
      const rgb = m.slice(1, 4).map((v) => Math.round(Number(v) * 255))
      add(`r${rgb}`, { rgb, cmyk: rgbToCmyk(rgb), space: 'RGB' })
    }
  }
  const walk = (res) => {
    res = lookup(res)
    if (!(res instanceof PDFDict)) return
    const cs = lookup(res.get(PDFName.of('ColorSpace')))
    if (cs instanceof PDFDict)
      for (const [, v] of cs.entries()) {
        const a = lookup(v)
        if (a instanceof PDFArray && lookup(a.get(0))?.decodeText?.() === 'Separation') {
          const name = lookup(a.get(1))?.decodeText?.()
          if (name && !['All', 'None'].includes(name)) spots.add(name)
        }
      }
    const xo = lookup(res.get(PDFName.of('XObject')))
    if (xo instanceof PDFDict)
      for (const [, ref] of xo.entries()) {
        const key = ref.toString()
        if (seen.has(key)) continue
        seen.add(key)
        const obj = lookup(ref)
        if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype'))?.decodeText?.() === 'Form') {
          scan(obj)
          walk(obj.dict.get(PDFName.of('Resources')))
        }
      }
  }
  for (const page of doc.getPages()) {
    walk(page.node.Resources())
    const c = lookup(page.node.get(PDFName.of('Contents')))
    if (c instanceof PDFArray) for (let i = 0; i < c.size(); i++) scan(lookup(c.get(i)))
    else scan(c)
  }
  const colors = [...found.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
    .map((c) => ({ ...c, hex: toHex(c.rgb), exact: true }))
  return { colors, spots: [...spots] }
}
