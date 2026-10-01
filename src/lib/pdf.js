// Gedeelde PDF-hulpfuncties op basis van pdf.js (rendering + tekst).
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjs }

/** Geeft het geheugen van een geladen PDF vrij (API verschilt per pdf.js-versie). */
export function closePdf(pdf) {
  try {
    if (pdf?.loadingTask?.destroy) return pdf.loadingTask.destroy()
    if (typeof pdf?.destroy === 'function') return pdf.destroy()
  } catch {
    /* negeren */
  }
}

export async function loadPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjs.getDocument({ data }).promise
}

/** Rendert een pagina naar een canvas met een maximale breedte in pixels. */
export async function renderPage(pdf, pageNumber, targetWidth = 900) {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: targetWidth / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport }).promise
  return canvas
}

export async function pageText(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber)
  const content = await page.getTextContent()
  let out = ''
  for (const item of content.items) {
    out += item.str
    out += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' '
  }
  return out.replace(/[ \t]+/g, ' ').replace(/ \n/g, '\n').trim()
}

export async function pdfText(file) {
  const pdf = await loadPdf(file)
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) pages.push(await pageText(pdf, i))
  return pages
}

/** Laadt een afbeelding als canvas (voor vergelijken van PNG/JPG). */
export async function imageToCanvas(file, targetWidth = 900) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, targetWidth / bmp.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas
}

export const PT_TO_MM = 25.4 / 72
