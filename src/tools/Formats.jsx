import { useEffect, useRef, useState } from 'react'
import { addFileToProject, saveProject } from '../lib/db'
import { download, isImage, isPdf, safeName } from '../lib/files'
import { Dropzone, ProjectFilePicker, SaveToProject, useToast } from '../components/ui'

export const FORMATS = [
  { id: 'ig-square', group: 'Instagram', name: 'Post 1:1', w: 1080, h: 1080 },
  { id: 'ig-portrait', group: 'Instagram', name: 'Post 4:5', w: 1080, h: 1350 },
  { id: 'story', group: 'Instagram / TikTok', name: 'Story & Reel 9:16', w: 1080, h: 1920 },
  { id: 'fb-link', group: 'Facebook / LinkedIn', name: 'Linkpost', w: 1200, h: 628 },
  { id: 'fb-cover', group: 'Facebook', name: 'Omslagfoto', w: 1640, h: 624 },
  { id: 'li-banner', group: 'LinkedIn', name: 'Bannerfoto', w: 1584, h: 396 },
  { id: 'x-header', group: 'X', name: 'Header', w: 1500, h: 500 },
  { id: 'yt-thumb', group: 'YouTube', name: 'Thumbnail', w: 1280, h: 720 },
  { id: 'web-hero', group: 'Web', name: 'Hero 16:9', w: 1920, h: 1080 },
  { id: 'mail', group: 'Nieuwsbrief', name: 'Header', w: 1200, h: 400 },
]

/** Uitsnede (cover) rond het focuspunt, binnen de randen van het beeld. */
function cropRect(srcW, srcH, w, h, fx, fy) {
  const scale = Math.max(w / srcW, h / srcH)
  const cw = w / scale
  const ch = h / scale
  const x = Math.min(Math.max(fx * srcW - cw / 2, 0), srcW - cw)
  const y = Math.min(Math.max(fy * srcH - ch / 2, 0), srcH - ch)
  return { x, y, cw, ch }
}

function renderFormat(bitmap, fmt, focus, maxW) {
  const s = maxW ? Math.min(1, maxW / fmt.w) : 1
  const c = document.createElement('canvas')
  c.width = Math.round(fmt.w * s)
  c.height = Math.round(fmt.h * s)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const r = cropRect(bitmap.width, bitmap.height, fmt.w, fmt.h, focus.x, focus.y)
  ctx.drawImage(bitmap, r.x, r.y, r.cw, r.ch, 0, 0, c.width, c.height)
  return c
}

/** "Instagram / TikTok" + "Story & Reel 9:16" → "Instagram-TikTok-Story-en-Reel-9x16" */
const slug = (f) =>
  safeName(`${f.group} ${f.name}`.replace(/(\d+):(\d+)/g, '$1x$2').replace(/&/g, 'en'))
    .replace(/[\s/:]+/g, '-')
    .replace(/-+/g, '-')

const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q))

export default function Formats({ project, updateProject }) {
  const [file, setFile] = useState(null)
  const [bitmap, setBitmap] = useState(null)
  const [preview, setPreview] = useState(null)
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 })
  const [chosen, setChosen] = useState(() => new Set(FORMATS.slice(0, 4).map((f) => f.id)))
  const [type, setType] = useState('image/jpeg')
  const [thumbs, setThumbs] = useState({})
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const stage = useRef()

  const load = async (f) => {
    if (!f) return
    let bmp
    if (isPdf(f)) {
      const { loadPdf, renderPage, closePdf } = await import('../lib/pdf')
      const pdf = await loadPdf(f)
      bmp = await renderPage(pdf, 1, 2400)
      closePdf(pdf)
    } else if (isImage(f)) bmp = await createImageBitmap(f)
    else return toast('Kies een afbeelding of PDF')
    setFile(f)
    setBitmap(bmp)
    setFocus({ x: 0.5, y: 0.5 })
    const c = document.createElement('canvas')
    const s = Math.min(1, 900 / bmp.width)
    c.width = bmp.width * s
    c.height = bmp.height * s
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    setPreview(c.toDataURL('image/jpeg', 0.85))
  }

  useEffect(() => {
    if (!bitmap) return
    const t = {}
    for (const f of FORMATS) t[f.id] = renderFormat(bitmap, f, focus, 360).toDataURL('image/jpeg', 0.8)
    setThumbs(t)
  }, [bitmap, focus])

  const setFromEvent = (e) => {
    const r = stage.current.getBoundingClientRect()
    setFocus({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) })
  }

  const base = file ? safeName(file.name.replace(/\.[^.]+$/, '')) : 'beeld'
  const ext = type === 'image/png' ? 'png' : 'jpg'
  const outputs = async () => {
    const list = []
    for (const f of FORMATS.filter((x) => chosen.has(x.id))) {
      const blob = await toBlob(renderFormat(bitmap, f, focus), type, 0.9)
      list.push(new File([blob], `${base}_${slug(f)}_${f.w}x${f.h}.${ext}`, { type }))
    }
    return list
  }

  const zip = async () => {
    setBusy(true)
    const { default: JSZip } = await import('jszip')
    const z = new JSZip()
    for (const f of await outputs()) z.file(f.name, f)
    download(await z.generateAsync({ type: 'blob' }), `${base}_formaten.zip`)
    setBusy(false)
  }

  const addTo = async (p) => {
    for (const f of await outputs()) p = await addFileToProject(p, f, { note: 'Beeldformaten' })
    return p
  }

  const tooSmall = bitmap && FORMATS.filter((f) => chosen.has(f.id)).filter((f) => {
    const r = cropRect(bitmap.width, bitmap.height, f.w, f.h, 0.5, 0.5)
    return r.cw < f.w * 0.8
  })

  return (
    <>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="glass panel stack">
          <div className="row spread">
            <h2 style={{ margin: 0 }}>Beeld</h2>
            <ProjectFilePicker project={project} filter={(n) => /\.(png|jpe?g|webp|pdf)$/i.test(n)} onPick={([f]) => load(f)} />
          </div>
          {!preview ? (
            <Dropzone multiple={false} accept="image/*,.pdf" onFiles={([f]) => load(f)} title="Sleep een beeld hierheen" hint="Foto, key visual of PDF (eerste pagina)" />
          ) : (
            <>
              <div
                ref={stage}
                className="focus-stage"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setFromEvent(e)
                }}
                onPointerMove={(e) => e.buttons && setFromEvent(e)}
              >
                <img src={preview} alt="" draggable={false} />
                <span className="focus-dot" style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }} />
              </div>
              <div className="row spread">
                <span className="dim">Klik of sleep om het focuspunt te zetten (bijv. op een gezicht of product).</span>
                <Dropzone compact multiple={false} accept="image/*,.pdf" onFiles={([f]) => load(f)} title="Ander beeld" hint=" " />
              </div>
              {tooSmall?.length > 0 && (
                <div className="notice warn">
                  Het beeld is te klein voor: {tooSmall.map((f) => `${f.group} ${f.name}`).join(', ')}. Het wordt opgeschaald en kan onscherp worden.
                </div>
              )}
            </>
          )}
        </div>

        <div className="glass panel stack">
          <div className="row spread">
            <h2 style={{ margin: 0 }}>Formaten</h2>
            <div className="row">
              <button className="btn small ghost" onClick={() => setChosen(new Set(FORMATS.map((f) => f.id)))}>Alles</button>
              <button className="btn small ghost" onClick={() => setChosen(new Set())}>Niets</button>
            </div>
          </div>
          <div className="format-list">
            {FORMATS.map((f) => (
              <label key={f.id} className={`format-item ${chosen.has(f.id) ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={chosen.has(f.id)}
                  onChange={(e) => {
                    const next = new Set(chosen)
                    e.target.checked ? next.add(f.id) : next.delete(f.id)
                    setChosen(next)
                  }}
                />
                <span className="format-shape" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
                  {thumbs[f.id] && <img src={thumbs[f.id]} alt="" />}
                </span>
                <span>
                  <span className="eyebrow" style={{ display: 'block' }}>{f.group}</span>
                  {f.name}
                  <span className="dim" style={{ display: 'block' }}>{f.w} × {f.h}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="row spread">
            <label className="check">
              Bestandstype
              <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
              </select>
            </label>
            <div className="row">
              {project ? (
                <button className="btn small" disabled={!bitmap || !chosen.size || busy} onClick={async () => { setBusy(true); await updateProject(addTo); setBusy(false); toast('Formaten toegevoegd aan project') }}>Bewaar in project</button>
              ) : (
                <SaveToProject disabled={!bitmap || !chosen.size} onSave={async (p) => saveProject(await addTo(p))} />
              )}
              <button className="btn primary" disabled={!bitmap || !chosen.size || busy} onClick={zip}>
                {busy ? <span className="spinner" /> : `Download ${chosen.size} formaten`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
