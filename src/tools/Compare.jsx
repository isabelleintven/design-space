import { useEffect, useRef, useState } from 'react'
import { diffWordsWithSpace } from 'diff'
import { loadPdf, renderPage, pageText, imageToCanvas, closePdf } from '../lib/pdf'
import { versionToFile } from '../lib/db'
import { formatBytes, isImage, isPdf } from '../lib/files'
import { Dropzone, FileIcon, Progress, ProjectFilePicker } from '../components/ui'

// ---------- bronnen laden & renderen ----------
async function loadSource(file) {
  if (isPdf(file)) {
    const pdf = await loadPdf(file)
    return { kind: 'pdf', file, pdf, pages: pdf.numPages }
  }
  if (isImage(file)) return { kind: 'image', file, pages: 1 }
  throw new Error('Alleen PDF, PNG of JPG')
}

async function renderSource(src, n, width) {
  if (!src || n > src.pages) return null
  return src.kind === 'pdf' ? renderPage(src.pdf, n, width) : imageToCanvas(src.file, width)
}

/** Pixelvergelijking: geeft een overlay-canvas en het percentage gewijzigde pixels. */
function diffCanvases(a, b) {
  const w = Math.max(a?.width || 0, b?.width || 0)
  const h = Math.max(a?.height || 0, b?.height || 0)
  const get = (c) => {
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    const ctx = tmp.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    if (c) ctx.drawImage(c, 0, 0)
    return ctx.getImageData(0, 0, w, h)
  }
  const A = get(a)
  const B = get(b)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  const img = octx.createImageData(w, h)
  const CELL = 10
  const cols = Math.ceil(w / CELL)
  const cells = new Uint8Array(cols * Math.ceil(h / CELL))
  let changed = 0
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])
    const p = i / 4
    if (d > 70) {
      changed++
      img.data[i] = 255
      img.data[i + 1] = 0
      img.data[i + 2] = 128
      img.data[i + 3] = 255
      cells[Math.floor(Math.floor(p / w) / CELL) * cols + Math.floor((p % w) / CELL)] = 1
    } else {
      // nieuwe versie lichtgrijs als achtergrond
      const g = 255 - (255 - (B.data[i] + B.data[i + 1] + B.data[i + 2]) / 3) * 0.35
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g
      img.data[i + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  // gewijzigde gebieden extra markeren
  octx.fillStyle = 'rgba(255, 0, 128, 0.14)'
  for (let c = 0; c < cells.length; c++) if (cells[c]) octx.fillRect((c % cols) * CELL, Math.floor(c / cols) * CELL, CELL, CELL)
  return { canvas: out, ratio: changed / (w * h), changed }
}

function CanvasHost({ canvas, style }) {
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    if (canvas) el.appendChild(canvas)
  }, [canvas])
  return <div ref={ref} style={style} />
}

// ---------- slot voor één bestand ----------
function Slot({ label, file, onFile, project }) {
  return (
    <div className="glass panel">
      <div className="row spread" style={{ marginBottom: 10 }}>
        <div className="eyebrow">{label}</div>
        <ProjectFilePicker project={project} filter={(n) => /\.(pdf|png|jpe?g|webp)$/i.test(n)} onPick={([f]) => f && onFile(f)} />
      </div>
      {file ? (
        <Dropzone multiple={false} compact onFiles={([f]) => onFile(f)} className="filled">
          <div className="row">
            <FileIcon name={file.name} />
            <div className="grow">
              <div className="ellipsis">{file.versionLabel || file.name}</div>
              <div className="dim">{formatBytes(file.size)} · klik of sleep om te vervangen</div>
            </div>
          </div>
        </Dropzone>
      ) : (
        <Dropzone multiple={false} accept=".pdf,image/*" onFiles={([f]) => onFile(f)} title={`Sleep ${label.toLowerCase()} hierheen`} hint="PDF, PNG of JPG" />
      )}
    </div>
  )
}

// ---------- tool ----------
export default function Compare({ project, query }) {
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [srcA, setSrcA] = useState(null)
  const [srcB, setSrcB] = useState(null)
  const [overview, setOverview] = useState(null) // [{ n, ratio }]
  const [progress, setProgress] = useState(0)
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState('diff')
  const [view, setView] = useState(null) // { a, b, diff, ratio }
  const [texts, setTexts] = useState(null)
  const [error, setError] = useState('')

  // Vanuit het project: ?a=versionId&b=versionId
  useEffect(() => {
    if (!project || !query?.a) return
    const all = project.files.flatMap((f) => f.versions.map((v, i) => ({ v, label: `${f.name} — v${i + 1}` })))
    const load = async (id, setter) => {
      const hit = all.find((x) => x.v.id === id)
      if (!hit) return
      const f = await versionToFile(hit.v)
      if (f) {
        f.versionLabel = hit.label
        setter(f)
      }
    }
    load(query.a, setFileA)
    load(query.b, setFileB)
  }, [query?.a, query?.b])

  useEffect(() => {
    let cancelled = false
    let loaded = []
    setError('')
    Promise.all([fileA && loadSource(fileA), fileB && loadSource(fileB)])
      .then(([a, b]) => {
        loaded = [a, b]
        if (cancelled) return
        setSrcA(a || null)
        setSrcB(b || null)
      })
      .catch((e) => setError(e.message || 'Bestand kon niet geladen worden'))
    return () => {
      cancelled = true
      // geheugen van de vorige PDF's vrijgeven (iets later, zodat lopende renders afronden)
      setTimeout(() => loaded.forEach((src) => src?.pdf && closePdf(src.pdf)), 5000)
    }
  }, [fileA, fileB])

  // Overzicht: welke pagina's zijn gewijzigd (op lage resolutie)
  useEffect(() => {
    if (!srcA || !srcB) return
    let cancelled = false
    ;(async () => {
      setOverview(null)
      setPage(1)
      const total = Math.max(srcA.pages, srcB.pages)
      const limit = Math.min(total, 150)
      const result = []
      for (let n = 1; n <= limit; n++) {
        if (cancelled) return
        const [a, b] = await Promise.all([renderSource(srcA, n, 500), renderSource(srcB, n, 500)])
        const d = !a || !b ? { ratio: 1, changed: Infinity } : diffCanvases(a, b)
        result.push({ n, ratio: d.ratio, isChanged: d.changed > 6, missing: !a ? 'a' : !b ? 'b' : null })
        setProgress(n / limit)
      }
      if (!cancelled) {
        setOverview(result)
        const first = result.find((r) => r.isChanged)
        if (first) setPage(first.n)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [srcA, srcB])

  // Geselecteerde pagina op hoge resolutie + tekstverschil
  useEffect(() => {
    if (!srcA || !srcB) return
    let cancelled = false
    ;(async () => {
      setView(null)
      const [a, b] = await Promise.all([renderSource(srcA, page, 1100), renderSource(srcB, page, 1100)])
      const d = diffCanvases(a, b)
      if (!cancelled) setView({ a, b, diff: d.canvas, ratio: d.ratio })
      if (srcA.kind === 'pdf' && srcB.kind === 'pdf') {
        const [ta, tb] = await Promise.all([
          page <= srcA.pages ? pageText(srcA.pdf, page) : '',
          page <= srcB.pages ? pageText(srcB.pdf, page) : '',
        ])
        if (!cancelled) setTexts(diffWordsWithSpace(ta, tb))
      } else setTexts(null)
    })()
    return () => {
      cancelled = true
    }
  }, [srcA, srcB, page])

  const changedPages = overview?.filter((o) => o.isChanged) || []

  return (
    <>
      <div className="grid-2">
        <Slot label="Oude versie" file={fileA} onFile={setFileA} project={project} />
        <Slot label="Nieuwe versie" file={fileB} onFile={setFileB} project={project} />
      </div>
      {error && <div className="notice warn" style={{ marginTop: 18 }}>{error}</div>}

      {srcA && srcB && (
        <div className="glass panel" style={{ marginTop: 18 }}>
          {!overview ? (
            <div className="empty">
              <span className="spinner" /> <span style={{ marginLeft: 10 }}>Pagina's vergelijken…</span>
              <Progress value={progress} />
            </div>
          ) : (
            <>
              <div className="row spread" style={{ marginBottom: 14 }}>
                <div>
                  <span className="summary-big">
                    {changedPages.length ? `${changedPages.length} gewijzigd` : 'Geen verschillen'}
                  </span>
                  <div className="dim" style={{ marginTop: 6 }}>
                    {srcA.pages} → {srcB.pages} pagina's
                    {srcA.pages !== srcB.pages && <span style={{ color: 'var(--warn)' }}> · aantal pagina's verschilt</span>}
                  </div>
                </div>
                <div className="row">
                  {[
                    ['diff', 'Verschillen'],
                    ['swipe', 'Schuif'],
                    ['side', 'Naast elkaar'],
                  ].map(([id, label]) => (
                    <button key={id} className={`btn small ${mode === id ? 'primary' : ''}`} onClick={() => setMode(id)}>{label}</button>
                  ))}
                </div>
              </div>
              {overview.length > 1 && (
                <div className="page-pills" style={{ marginBottom: 16 }}>
                  {overview.map((o) => (
                    <button
                      key={o.n}
                      className={`page-pill ${page === o.n ? 'active' : ''} ${o.isChanged ? 'changed' : 'same'}`}
                      title={o.missing ? (o.missing === 'a' ? 'Nieuwe pagina' : 'Pagina verwijderd') : o.isChanged ? `${Math.max(0.01, o.ratio * 100).toFixed(2)}% gewijzigd` : 'Geen verschil'}
                      onClick={() => setPage(o.n)}
                    >
                      {o.n}
                    </button>
                  ))}
                </div>
              )}

              {!view ? (
                <div className="empty"><span className="spinner" /></div>
              ) : mode === 'diff' ? (
                <div className="compare-stage" style={{ maxWidth: 900, margin: '0 auto' }}>
                  <CanvasHost canvas={view.diff} />
                </div>
              ) : mode === 'swipe' ? (
                <Swipe a={view.a} b={view.b} />
              ) : (
                <div className="side-by-side">
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Oud · pagina {page}</div>
                    <div className="compare-stage">{view.a ? <CanvasHost canvas={view.a} /> : <div className="empty" style={{ color: '#333' }}>Bestaat niet</div>}</div>
                  </div>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>Nieuw · pagina {page}</div>
                    <div className="compare-stage">{view.b ? <CanvasHost canvas={view.b} /> : <div className="empty" style={{ color: '#333' }}>Bestaat niet</div>}</div>
                  </div>
                </div>
              )}
              {mode === 'diff' && <p className="dim" style={{ textAlign: 'center' }}>Roze = gewijzigd ten opzichte van de oude versie</p>}

              {texts && (
                <>
                  <div className="hr" />
                  <div className="row spread" style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: 0 }}>Tekstverschillen pagina {page}</h3>
                    <span className="dim">
                      <span style={{ color: '#ff8f80' }}>doorgestreept = verwijderd</span> · <span style={{ color: 'var(--ok)' }}>groen = nieuw</span>
                    </span>
                  </div>
                  {texts.some((p) => p.added || p.removed) ? (
                    <div className="diff-text">
                      {texts.map((part, i) =>
                        part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>,
                      )}
                    </div>
                  ) : (
                    <p className="dim">Geen tekstwijzigingen op deze pagina.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function Swipe({ a, b }) {
  const [pos, setPos] = useState(50)
  const stage = useRef()
  const drag = useRef(false)
  const move = (e) => {
    if (!drag.current) return
    const r = stage.current.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)))
  }
  const w = Math.max(a?.width || 0, b?.width || 0)
  return (
    <>
      <div
        ref={stage}
        className="compare-stage"
        style={{ maxWidth: 900, margin: '0 auto', cursor: 'ew-resize' }}
        onPointerDown={(e) => {
          drag.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = false)}
      >
        <CanvasHost canvas={b} style={{ width: b && w ? `${(b.width / w) * 100}%` : '100%' }} />
        <div className="top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <CanvasHost canvas={a?.cloneNode ? cloneCanvas(a) : null} style={{ width: a && w ? `${(a.width / w) * 100}%` : '100%' }} />
        </div>
        <div className="handle" style={{ left: `${pos}%` }} />
      </div>
      <p className="dim" style={{ textAlign: 'center' }}>Links oud · rechts nieuw — sleep om te vergelijken</p>
    </>
  )
}

// Een canvas kan maar op één plek in de DOM staan; voor de schuif-weergave maken we een kopie.
const clones = new WeakMap()
function cloneCanvas(c) {
  if (clones.has(c)) return clones.get(c)
  const copy = document.createElement('canvas')
  copy.width = c.width
  copy.height = c.height
  copy.getContext('2d').drawImage(c, 0, 0)
  clones.set(c, copy)
  return copy
}
