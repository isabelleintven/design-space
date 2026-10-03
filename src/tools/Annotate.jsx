import { useEffect, useRef, useState } from 'react'
import { loadPdf, renderPage, closePdf } from '../lib/pdf'
import { saveProject, uid } from '../lib/db'
import { download, isPdf, safeName } from '../lib/files'
import { Dropzone, ProjectFilePicker, SaveToProject, useToast } from '../components/ui'

// Alleen tekens die in de standaard PDF-fonts (WinAnsi) passen
const winAnsi = (s) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E -ÿ€]/g, '')

function wrap(text, font, size, width) {
  const lines = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line)
        line = word
      } else line = test
    }
    lines.push(line)
  }
  return lines
}

/** Maakt een PDF met genummerde markeringen, echte PDF-notities en een opmerkingenpagina. */
async function annotatedPdf(file, pins, title) {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFHexString } = await import('pdf-lib')
  const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pink = rgb(1, 0.24, 0.55)
  const pages = doc.getPages()
  pins.forEach((pin, i) => {
    const page = pages[pin.page - 1]
    if (!page) return
    const box = page.getCropBox()
    const x = box.x + pin.x * box.width
    const y = box.y + (1 - pin.y) * box.height
    const r = Math.max(9, box.width / 60)
    page.drawCircle({ x, y, size: r, color: pink, borderColor: rgb(1, 1, 1), borderWidth: 1.5 })
    const label = String(i + 1)
    const fs = r * 1.1
    page.drawText(label, { x: x - bold.widthOfTextAtSize(label, fs) / 2, y: y - fs * 0.36, size: fs, font: bold, color: rgb(1, 1, 1) })
    // Echte notitie, zichtbaar in Acrobat/Voorvertoning als opmerking
    const annot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [x + r, y, x + r + 18, y + 18],
      Contents: PDFHexString.fromText(`${i + 1}. ${pin.text}`),
      T: PDFString.of('Design Space'),
      Name: 'Comment',
      C: [1, 0.24, 0.55],
      F: 4,
    })
    const ref = doc.context.register(annot)
    const annots = page.node.lookup(PDFName.of('Annots'))
    if (annots) annots.push(ref)
    else page.node.set(PDFName.of('Annots'), doc.context.obj([ref]))
  })

  // Opmerkingenpagina achteraan (A4)
  let page = doc.addPage([595.28, 841.89])
  let y = 790
  page.drawText(winAnsi(title), { x: 50, y, size: 18, font: bold })
  y -= 30
  pins.forEach((pin, i) => {
    const lines = wrap(winAnsi(pin.text || '(geen tekst)'), font, 11, 440)
    if (y - lines.length * 15 < 60) {
      page = doc.addPage([595.28, 841.89])
      y = 790
    }
    page.drawCircle({ x: 60, y: y + 4, size: 9, color: pink })
    const label = String(i + 1)
    page.drawText(label, { x: 60 - bold.widthOfTextAtSize(label, 9) / 2, y: y + 1, size: 9, font: bold, color: rgb(1, 1, 1) })
    page.drawText(`Pagina ${pin.page}${pin.done ? '  (verwerkt)' : ''}`, { x: 80, y, size: 9, font: bold, color: rgb(0.45, 0.45, 0.45) })
    y -= 15
    for (const l of lines) {
      page.drawText(l, { x: 80, y, size: 11, font })
      y -= 15
    }
    y -= 10
  })
  return new Blob([await doc.save()], { type: 'application/pdf' })
}

export default function Annotate({ project, updateProject }) {
  const [file, setFile] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [page, setPage] = useState(1)
  const [img, setImg] = useState(null)
  const [pins, setPins] = useState([])
  const [active, setActive] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const inputs = useRef({})

  const load = async (f) => {
    if (!f || !isPdf(f)) return toast('Kies een PDF')
    if (pdf) closePdf(pdf)
    setFile(f)
    setPins([])
    setPage(1)
    setPdf(await loadPdf(f))
  }

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    setImg(null)
    renderPage(pdf, page, 1100).then((c) => !cancelled && setImg(c.toDataURL('image/jpeg', 0.88)))
    return () => {
      cancelled = true
    }
  }, [pdf, page])

  useEffect(() => {
    if (active) setTimeout(() => inputs.current[active]?.focus(), 30)
  }, [active])

  const addPin = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const pin = { id: uid(), page, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, text: '', done: false }
    setPins([...pins, pin])
    setActive(pin.id)
  }
  const patch = (id, change) => setPins(pins.map((p) => (p.id === id ? { ...p, ...change } : p)))
  const ordered = [...pins].sort((a, b) => a.page - b.page || a.y - b.y)
  const numberOf = (pin) => ordered.indexOf(pin) + 1

  const title = `Opmerkingen ${file?.name || ''}`.trim()
  const checklist = () => ({
    id: uid(),
    title,
    source: 'annotate',
    createdAt: new Date().toISOString(),
    items: ordered.filter((p) => p.text.trim()).map((p) => ({ id: uid(), text: p.text.trim(), done: p.done, page: String(p.page), kind: /\?\s*$/.test(p.text) ? 'vraag' : 'actie' })),
  })
  const addTo = (p) => ({ ...p, checklists: [...p.checklists, checklist()] })

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="glass panel">
        {!pdf ? (
          <>
            <Dropzone multiple={false} accept=".pdf,application/pdf" onFiles={([f]) => load(f)} title="Sleep een PDF hierheen" hint="Bijv. de proef die de klant heeft bekeken" />
            <div style={{ marginTop: 12 }}>
              <ProjectFilePicker project={project} filter={(n) => /\.pdf$/i.test(n)} onPick={([f]) => load(f)} />
            </div>
          </>
        ) : (
          <>
            <div className="row spread" style={{ marginBottom: 12 }}>
              <div className="ellipsis grow">{file.name}</div>
              <div className="row">
                <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
                <span className="dim">pagina {page} / {pdf.numPages}</span>
                <button className="btn small" disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)}>→</button>
                <button className="btn small ghost" onClick={() => { closePdf(pdf); setPdf(null); setFile(null); setPins([]) }}>Andere PDF</button>
              </div>
            </div>
            <div className="annotate-stage" onClick={addPin}>
              {img ? <img src={img} alt="" draggable={false} /> : <div className="empty" style={{ color: '#333' }}><span className="spinner" /></div>}
              {pins.filter((p) => p.page === page).map((p) => (
                <button
                  key={p.id}
                  className={`pin ${active === p.id ? 'active' : ''} ${p.done ? 'done' : ''}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  onClick={(e) => { e.stopPropagation(); setActive(p.id) }}
                >
                  {numberOf(p)}
                </button>
              ))}
            </div>
            <p className="dim" style={{ marginBottom: 0 }}>Klik op de plek waar iets moet veranderen en typ je opmerking.</p>
          </>
        )}
      </div>

      <div className="glass panel">
        <div className="row spread" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{pins.length} opmerking{pins.length === 1 ? '' : 'en'}</h3>
        </div>
        {!pins.length ? (
          <p className="dim">Nog geen opmerkingen.</p>
        ) : (
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {ordered.map((p) => (
              <div key={p.id} className={`issue ${active === p.id ? 'active' : ''}`} onClick={() => { setActive(p.id); setPage(p.page) }}>
                <div className="row spread">
                  <span className="row" style={{ gap: 8 }}>
                    <span className="pin static">{numberOf(p)}</span>
                    <span className="dim">pagina {p.page}</span>
                  </span>
                  <span className="row" style={{ gap: 4 }}>
                    <label className="check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={p.done} onChange={(e) => patch(p.id, { done: e.target.checked })} /> verwerkt</label>
                    <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); setPins(pins.filter((x) => x.id !== p.id)) }}>×</button>
                  </span>
                </div>
                <textarea
                  ref={(el) => (inputs.current[p.id] = el)}
                  className="input"
                  style={{ minHeight: 60, marginTop: 8 }}
                  rows={2}
                  placeholder="Wat moet er anders?"
                  value={p.text}
                  onChange={(e) => patch(p.id, { text: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        <div className="hr" />
        <div className="row">
          <button
            className="btn small primary"
            disabled={!pins.length || busy}
            onClick={async () => {
              setBusy(true)
              download(await annotatedPdf(file, ordered, title), `${safeName(file.name.replace(/\.pdf$/i, ''))}_opmerkingen.pdf`)
              setBusy(false)
            }}
          >
            {busy ? <span className="spinner" /> : 'PDF met opmerkingen'}
          </button>
          {project ? (
            <button className="btn small" disabled={!pins.some((p) => p.text.trim())} onClick={async () => { await updateProject(addTo); toast('Opmerkingen toegevoegd aan Correcties') }}>
              Checklist → project
            </button>
          ) : (
            <SaveToProject label="Checklist → project" disabled={!pins.some((p) => p.text.trim())} onSave={(p) => saveProject(addTo(p))} />
          )}
        </div>
      </div>
    </div>
  )
}
