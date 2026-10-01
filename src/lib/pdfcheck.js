// Preflight-achtige PDF-controle, volledig in de browser.
// pdf-lib leest de structuur (boxen, fonts, kleurruimtes), pdf.js de beeldplaatsing (DPI).
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFRef,
  PDFNumber,
  decodePDFRawStream,
} from 'pdf-lib'
import { loadPdf, closePdf, pdfjs, PT_TO_MM } from './pdf'

const mm = (pt) => Math.round(pt * PT_TO_MM * 10) / 10

export const DEFAULT_SPEC = { width: 210, height: 297, bleed: 3, minDpi: 300, requireEmbeddedFonts: true, requireCmyk: true }

export async function analyzePdf(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const ctx = doc.context
  const lookup = (o) => (o instanceof PDFRef ? ctx.lookup(o) : o)
  const header = new TextDecoder().decode(bytes.slice(0, 16)).match(/%PDF-(\d\.\d)/)?.[1]

  const info = {
    pages: doc.getPageCount(),
    version: header || '?',
    title: safe(() => doc.getTitle()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
    encrypted: doc.isEncrypted,
  }

  const fonts = new Map()
  const images = new Map() // ref → { colorSpace, w, h }
  const spots = new Set()
  const colors = { rgb: 0, cmyk: 0, gray: 0 }
  let transparency = false
  const visited = new Set()

  function colorSpaceName(cs) {
    cs = lookup(cs)
    if (!cs) return '?'
    if (cs instanceof PDFName) return cs.decodeText().replace('Device', '')
    if (cs instanceof PDFArray) {
      const kind = lookup(cs.get(0))?.decodeText?.()
      if (kind === 'ICCBased') {
        const stream = lookup(cs.get(1))
        const n = stream?.dict?.get(PDFName.of('N'))
        const v = n instanceof PDFNumber ? n.asNumber() : 0
        return v === 4 ? 'CMYK' : v === 1 ? 'Gray' : 'RGB'
      }
      if (kind === 'Separation') {
        const name = lookup(cs.get(1))?.decodeText?.()
        if (name && !['All', 'None'].includes(name)) spots.add(name)
        return `Steunkleur (${name})`
      }
      if (kind === 'DeviceN') {
        const names = lookup(cs.get(1))
        if (names instanceof PDFArray) {
          for (let i = 0; i < names.size(); i++) {
            const n = lookup(names.get(i))?.decodeText?.()
            if (n && !['Cyan', 'Magenta', 'Yellow', 'Black', 'None', 'All'].includes(n)) spots.add(n)
          }
        }
        return 'DeviceN'
      }
      if (kind === 'Indexed') return `Indexed ${colorSpaceName(cs.get(1))}`
      return kind || '?'
    }
    return '?'
  }

  function scanContent(stream) {
    if (!(stream instanceof PDFRawStream)) return
    let text
    try {
      text = new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
    } catch {
      return
    }
    const num = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)\\s+'
    colors.rgb += (text.match(new RegExp(`(?:${num}){3}(?:rg|RG)\\b`, 'g')) || []).length
    colors.cmyk += (text.match(new RegExp(`(?:${num}){4}(?:k|K)\\b`, 'g')) || []).length
    colors.gray += (text.match(new RegExp(`${num}(?:g|G)\\b`, 'g')) || []).length
  }

  function scanResources(res) {
    res = lookup(res)
    if (!(res instanceof PDFDict)) return

    const fontDict = lookup(res.get(PDFName.of('Font')))
    if (fontDict instanceof PDFDict) {
      for (const [, ref] of fontDict.entries()) {
        const key = ref.toString()
        if (fonts.has(key)) continue
        const font = lookup(ref)
        if (!(font instanceof PDFDict)) continue
        fonts.set(key, describeFont(font))
      }
    }

    const csDict = lookup(res.get(PDFName.of('ColorSpace')))
    if (csDict instanceof PDFDict) for (const [, cs] of csDict.entries()) colorSpaceName(cs)

    const gs = lookup(res.get(PDFName.of('ExtGState')))
    if (gs instanceof PDFDict) {
      for (const [, ref] of gs.entries()) {
        const g = lookup(ref)
        if (!(g instanceof PDFDict)) continue
        const ca = lookup(g.get(PDFName.of('ca')))
        const CA = lookup(g.get(PDFName.of('CA')))
        const smask = lookup(g.get(PDFName.of('SMask')))
        const bm = lookup(g.get(PDFName.of('BM')))
        if (
          (ca instanceof PDFNumber && ca.asNumber() < 1) ||
          (CA instanceof PDFNumber && CA.asNumber() < 1) ||
          (smask && !(smask instanceof PDFName && smask.decodeText() === 'None')) ||
          (bm instanceof PDFName && !['Normal', 'Compatible'].includes(bm.decodeText()))
        )
          transparency = true
      }
    }

    const xo = lookup(res.get(PDFName.of('XObject')))
    if (xo instanceof PDFDict) {
      for (const [, ref] of xo.entries()) {
        const key = ref.toString()
        if (visited.has(key)) continue
        visited.add(key)
        const obj = lookup(ref)
        if (!(obj instanceof PDFRawStream)) continue
        const sub = obj.dict.get(PDFName.of('Subtype'))?.decodeText?.()
        if (sub === 'Image') {
          const isMask = lookup(obj.dict.get(PDFName.of('ImageMask')))?.toString() === 'true'
          if (lookup(obj.dict.get(PDFName.of('SMask')))) transparency = true
          images.set(key, {
            colorSpace: isMask ? 'Masker' : colorSpaceName(obj.dict.get(PDFName.of('ColorSpace'))),
            w: lookup(obj.dict.get(PDFName.of('Width')))?.asNumber?.(),
            h: lookup(obj.dict.get(PDFName.of('Height')))?.asNumber?.(),
          })
        } else if (sub === 'Form') {
          if (lookup(obj.dict.get(PDFName.of('Group')))) transparency = true
          scanContent(obj)
          scanResources(obj.dict.get(PDFName.of('Resources')))
        }
      }
    }
  }

  function describeFont(font) {
    const subtype = lookup(font.get(PDFName.of('Subtype')))?.decodeText?.() || '?'
    let name = lookup(font.get(PDFName.of('BaseFont')))?.decodeText?.() || '(naamloos)'
    let descriptorHolder = font
    if (subtype === 'Type0') {
      const desc = lookup(font.get(PDFName.of('DescendantFonts')))
      if (desc instanceof PDFArray) descriptorHolder = lookup(desc.get(0))
    }
    if (subtype === 'Type3') return { name, type: 'Type3', embedded: true, subset: false }
    const fd = lookup(descriptorHolder?.get?.(PDFName.of('FontDescriptor')))
    const embedded =
      fd instanceof PDFDict &&
      ['FontFile', 'FontFile2', 'FontFile3'].some((k) => fd.get(PDFName.of(k)))
    const subset = /^[A-Z]{6}\+/.test(name)
    name = name.replace(/^[A-Z]{6}\+/, '')
    return { name, type: subtype, embedded, subset }
  }

  const pages = doc.getPages().map((page, i) => {
    const media = page.getMediaBox()
    const trim = page.getTrimBox()
    const bleed = page.getBleedBox()
    const hasTrim = !!page.node.get(PDFName.of('TrimBox'))
    const hasBleed = !!page.node.get(PDFName.of('BleedBox'))
    // Effectieve afloop: ruimte tussen trim en bleedbox (of mediabox als er geen bleedbox is)
    const outer = hasBleed ? bleed : media
    const bleedSides = [
      trim.x - outer.x,
      trim.y - outer.y,
      outer.x + outer.width - (trim.x + trim.width),
      outer.y + outer.height - (trim.y + trim.height),
    ].map(mm)

    scanResources(page.node.Resources())
    const contents = lookup(page.node.get(PDFName.of('Contents')))
    if (contents instanceof PDFArray) for (let j = 0; j < contents.size(); j++) scanContent(lookup(contents.get(j)))
    else scanContent(contents)

    return {
      n: i + 1,
      rotation: page.getRotation().angle,
      media: { w: mm(media.width), h: mm(media.height) },
      trim: { w: mm(trim.width), h: mm(trim.height) },
      hasTrim,
      bleed: Math.min(...bleedSides),
    }
  })

  onProgress(0.3)
  const placements = await imagePlacements(file, (p) => onProgress(0.3 + p * 0.7))

  return {
    info,
    pages,
    fonts: [...fonts.values()].sort((a, b) => a.name.localeCompare(b.name)),
    images: [...images.values()],
    placements,
    colors: { ...colors, spots: [...spots] },
    transparency,
  }
}

/** Bepaalt de effectieve resolutie van geplaatste beelden via de pdf.js operatorlijst. */
async function imagePlacements(file, onProgress) {
  const { OPS } = pdfjs
  const pdf = await loadPdf(file)
  const result = []
  const multiply = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  const maxPages = Math.min(pdf.numPages, 200)
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p)
    const ops = await page.getOperatorList()
    let ctm = [1, 0, 0, 1, 0, 0]
    const stack = []
    const record = (w, h, id) => {
      const placedW = Math.hypot(ctm[0], ctm[1]) / 72
      const placedH = Math.hypot(ctm[2], ctm[3]) / 72
      if (!w || !h || placedW < 0.05 || placedH < 0.05) return // te klein om te tellen
      const dpi = Math.round(Math.min(w / placedW, h / placedH))
      result.push({ page: p, id, w, h, dpi, widthMm: Math.round(placedW * 25.4), heightMm: Math.round(placedH * 25.4) })
    }
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]
      const args = ops.argsArray[i]
      if (fn === OPS.save) stack.push(ctm)
      else if (fn === OPS.restore) ctm = stack.pop() || ctm
      else if (fn === OPS.transform) ctm = multiply(ctm, args)
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm)
        if (args?.[0]) ctm = multiply(ctm, Array.from(args[0]))
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm
      else if (fn === OPS.paintImageXObject) record(args[1], args[2], args[0])
      else if (fn === OPS.paintInlineImageXObject) record(args[0]?.width, args[0]?.height, `inline-${p}-${i}`)
    }
    page.cleanup()
    onProgress(p / maxPages)
  }
  await closePdf(pdf)
  return result
}

/** Zet de analyse om in een lijst controles (ok / warn / fail / info) tegen de specificatie. */
export function evaluate(report, spec) {
  const checks = []
  const add = (status, label, detail) => checks.push({ status, label, detail })
  const tol = 0.6

  // Formaat
  if (spec.width && spec.height) {
    const wrong = report.pages.filter((p) => {
      const { w, h } = p.trim
      const direct = Math.abs(w - spec.width) <= tol && Math.abs(h - spec.height) <= tol
      const spread = Math.abs(w - spec.width * 2) <= tol && Math.abs(h - spec.height) <= tol
      return !direct && !spread
    })
    const rotated = wrong.filter((p) => Math.abs(p.trim.w - spec.height) <= tol && Math.abs(p.trim.h - spec.width) <= tol)
    if (!wrong.length) add('ok', 'Eindformaat', `Alle pagina's zijn ${spec.width} × ${spec.height} mm.`)
    else if (rotated.length === wrong.length)
      add('warn', 'Eindformaat', `${wrong.length} pagina('s) staan gedraaid (${spec.height} × ${spec.width} mm). Liggend bedoeld?`)
    else
      add(
        'fail',
        'Eindformaat',
        `Verwacht ${spec.width} × ${spec.height} mm. Afwijkend: ${wrong
          .slice(0, 6)
          .map((p) => `p.${p.n} (${p.trim.w} × ${p.trim.h})`)
          .join(', ')}${wrong.length > 6 ? ' …' : ''}`,
      )
  }

  // Trimbox & afloop
  const noTrim = report.pages.filter((p) => !p.hasTrim)
  if (noTrim.length === report.pages.length)
    add('warn', 'Snijlijnen / TrimBox', 'Geen TrimBox gevonden: het eindformaat is afgeleid van het paginaformaat. Exporteer met "Gebruik afloopinstellingen document".')
  else if (noTrim.length) add('warn', 'Snijlijnen / TrimBox', `${noTrim.length} pagina('s) zonder TrimBox.`)
  else add('ok', 'Snijlijnen / TrimBox', 'Alle pagina\'s hebben een TrimBox.')

  if (spec.bleed > 0) {
    const minBleed = Math.min(...report.pages.map((p) => p.bleed))
    if (minBleed >= spec.bleed - 0.2) add('ok', 'Afloop', `Minimaal ${minBleed} mm afloop (vereist ${spec.bleed} mm).`)
    else if (minBleed <= 0) add('fail', 'Afloop', `Geen afloop gevonden (vereist ${spec.bleed} mm).`)
    else add('fail', 'Afloop', `Slechts ${minBleed} mm afloop gevonden (vereist ${spec.bleed} mm).`)
  }

  // Fonts
  const notEmbedded = report.fonts.filter((f) => !f.embedded)
  if (!report.fonts.length) add('info', 'Lettertypen', 'Geen lettertypen gevonden (alle tekst omgezet naar contouren of geen tekst).')
  else if (!notEmbedded.length) add('ok', 'Lettertypen', `Alle ${report.fonts.length} lettertypen zijn ingesloten.`)
  else
    add(
      spec.requireEmbeddedFonts ? 'fail' : 'warn',
      'Lettertypen',
      `Niet ingesloten: ${notEmbedded.map((f) => f.name).join(', ')}`,
    )

  // Resolutie
  if (spec.minDpi) {
    const low = report.placements.filter((pl) => pl.dpi < spec.minDpi)
    const veryLow = low.filter((pl) => pl.dpi < spec.minDpi * 0.6)
    if (!report.placements.length) add('info', 'Beeldresolutie', 'Geen geplaatste afbeeldingen gevonden.')
    else if (!low.length)
      add('ok', 'Beeldresolutie', `Alle ${report.placements.length} geplaatste beelden ≥ ${spec.minDpi} ppi.`)
    else
      add(
        veryLow.length ? 'fail' : 'warn',
        'Beeldresolutie',
        `${low.length} beeld(en) onder ${spec.minDpi} ppi. Laagste: ${Math.min(...low.map((l) => l.dpi))} ppi.`,
      )
  }

  // Kleur
  const rgbImages = report.images.filter((i) => i.colorSpace === 'RGB' || i.colorSpace === 'Indexed RGB')
  if (spec.requireCmyk) {
    if (!rgbImages.length && !report.colors.rgb) add('ok', 'Kleurruimte', 'Geen RGB gevonden.')
    else
      add(
        'warn',
        'Kleurruimte',
        [rgbImages.length && `${rgbImages.length} RGB-afbeelding(en)`, report.colors.rgb && `${report.colors.rgb} RGB-kleurtoewijzingen in vectoren/tekst`]
          .filter(Boolean)
          .join(' en ') + '. Controleer of dit bewust is.',
      )
  } else {
    add('info', 'Kleurruimte', `${rgbImages.length} RGB-afbeelding(en), ${report.images.length - rgbImages.length} overige.`)
  }
  if (report.colors.spots.length) add('info', 'Steunkleuren', report.colors.spots.join(', '))
  else add('info', 'Steunkleuren', 'Geen steunkleuren.')

  add('info', 'Transparantie', report.transparency ? 'Transparantie aanwezig (geen probleem voor PDF/X-4).' : 'Geen transparantie gevonden.')
  if (report.info.encrypted) add('warn', 'Beveiliging', 'PDF is beveiligd/versleuteld.')

  return checks
}

function safe(fn) {
  try {
    return fn() || ''
  } catch {
    return ''
  }
}
