import { useEffect, useState } from 'react'
import { contrast, hexToRgb, paletteFromCanvas, pdfDocumentColors, rgbToCmyk, wcag } from '../lib/colors'
import { listPresets, savePreset } from '../lib/db'
import { isImage, isPdf } from '../lib/files'
import { Dropzone, Modal, ProjectFilePicker, useToast } from '../components/ui'

const WHITE = [255, 255, 255]
const BLACK = [0, 0, 0]

function Swatch({ color, selected, onSelect }) {
  const toast = useToast()
  const copy = (v) => {
    navigator.clipboard.writeText(v)
    toast(`${v} gekopieerd`)
  }
  const cw = contrast(color.rgb, WHITE)
  const cb = contrast(color.rgb, BLACK)
  return (
    <div className={`swatch glass ${selected ? 'selected' : ''}`}>
      <button className="swatch-color" style={{ background: color.hex }} onClick={onSelect} title="Selecteer voor contrastcheck">
        {selected && <span>✓</span>}
      </button>
      <div className="swatch-info">
        <button className="swatch-hex" onClick={() => copy(color.hex)}>{color.hex}</button>
        <div className="mono dim" onClick={() => copy(`C${color.cmyk[0]} M${color.cmyk[1]} Y${color.cmyk[2]} K${color.cmyk[3]}`)} style={{ cursor: 'copy' }}>
          C{color.cmyk[0]} M{color.cmyk[1]} Y{color.cmyk[2]} K{color.cmyk[3]}{!color.exact && color.space !== 'CMYK' ? ' ≈' : ''}
        </div>
        <div className="mono dim" onClick={() => copy(`rgb(${color.rgb.join(', ')})`)} style={{ cursor: 'copy' }}>RGB {color.rgb.join(' ')}</div>
        <div className="dim" style={{ marginTop: 6 }}>
          {color.share != null ? `${Math.round(color.share * 100)}% van beeld` : `${color.count}× gebruikt · ${color.space}`}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <span className="contrast-chip" style={{ background: color.hex, color: '#fff' }}>Aa {cw}</span>
          <span className="contrast-chip" style={{ background: color.hex, color: '#000' }}>Aa {cb}</span>
        </div>
      </div>
    </div>
  )
}

export default function Colors({ project, preset }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [palette, setPalette] = useState(null)
  const [docColors, setDocColors] = useState(null)
  const [count, setCount] = useState(8)
  const [canvas, setCanvas] = useState(null)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [manual, setManual] = useState('#')
  const toast = useToast()

  const run = async (f) => {
    if (!isPdf(f) && !isImage(f)) return toast('Kies een PDF of afbeelding')
    setFile(f)
    setBusy(true)
    setSelected([])
    setDocColors(null)
    try {
      let c
      if (isPdf(f)) {
        const { loadPdf, renderPage, closePdf } = await import('../lib/pdf')
        const pdf = await loadPdf(f)
        c = await renderPage(pdf, 1, 700)
        closePdf(pdf)
        pdfDocumentColors(f).then(setDocColors).catch(() => setDocColors({ colors: [], spots: [] }))
      } else {
        const { imageToCanvas } = await import('../lib/pdf')
        c = await imageToCanvas(f, 700)
      }
      setCanvas(c)
      setPreview(c.toDataURL('image/jpeg', 0.85))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (canvas) setPalette(paletteFromCanvas(canvas, count))
  }, [canvas, count])

  const all = [...(docColors?.colors || []), ...(palette || [])]
  const pick = (c) =>
    setSelected((sel) => (sel.some((s) => s.hex === c.hex) ? sel.filter((s) => s.hex !== c.hex) : [...sel.slice(-1), c]))

  const addManual = () => {
    if (!/^#?[0-9a-f]{6}$/i.test(manual.trim())) return toast('Gebruik een hex-code, bijv. #A31F34')
    const hex = '#' + manual.trim().replace('#', '').toUpperCase()
    const rgb = hexToRgb(hex)
    setPalette([{ rgb, hex, cmyk: rgbToCmyk(rgb), share: null, count: 1, space: 'HEX', exact: true }, ...(palette || [])])
    setManual('#')
  }

  const pair = selected.length === 2 ? contrast(selected[0].rgb, selected[1].rgb) : null

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="glass panel stack">
        <h2 style={{ margin: 0 }}>Bron</h2>
        <Dropzone multiple={false} accept=".pdf,image/*" onFiles={([f]) => run(f)} compact={!!file} title={file ? 'Ander bestand' : 'Sleep een logo, beeld of PDF'} hint="PNG, JPG, SVG-export of PDF" />
        <ProjectFilePicker project={project} filter={(n) => /\.(pdf|png|jpe?g|webp)$/i.test(n)} onPick={([f]) => f && run(f)} />
        {preview && <img src={preview} alt="" style={{ width: '100%', borderRadius: 6, background: '#fff' }} />}
        {palette && (
          <label className="field">
            Aantal kleuren uit beeld: {count}
            <input type="range" min="3" max="14" value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
        )}
        <div className="row">
          <input className="input mono" style={{ maxWidth: 140 }} value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManual()} />
          <button className="btn small" onClick={addManual}>+ Hex toevoegen</button>
        </div>
      </div>

      <div>
        {!file && !palette ? (
          <div className="glass panel empty">
            <span className="big">Kleuren vinden</span>
            Haal het palet uit een logo of foto, of lees de exacte CMYK- en RGB-waarden en steunkleuren uit een PDF. Klik twee kleuren aan voor een contrastcheck.
          </div>
        ) : busy ? (
          <div className="glass panel empty"><span className="spinner" /></div>
        ) : (
          <>
            <div className="glass panel">
              <div className="row spread" style={{ marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Contrast</h3>
                  <div className="dim">Klik twee kleuren aan. WCAG: 4,5 voor tekst, 3 voor grote tekst.</div>
                </div>
                <button className="btn small primary" disabled={!all.length} onClick={() => setSaveOpen(true)}>
                  {selected.length ? `${selected.length} kleur(en)` : 'Palet'} → klantpreset
                </button>
              </div>
              {pair != null ? (
                <div className="row" style={{ gap: 18 }}>
                  <div className="contrast-demo" style={{ background: selected[0].hex, color: selected[1].hex }}>Kerstfolder 2027</div>
                  <div>
                    <span className="summary-big">{pair}:1</span>
                    <div className={`status ${pair >= 4.5 ? 'ok' : pair >= 3 ? 'warn' : 'fail'}`}>{wcag(pair)}</div>
                  </div>
                </div>
              ) : (
                <p className="dim" style={{ margin: 0 }}>{selected.length === 1 ? 'Kies nog één kleur.' : 'Nog geen kleuren gekozen.'}</p>
              )}
            </div>

            {docColors && (
              <div className="glass panel">
                <h3>Kleuren in de PDF <span className="dim">(exacte waarden)</span></h3>
                {docColors.spots.length > 0 && (
                  <p style={{ marginTop: 0 }}>Steunkleuren: {docColors.spots.map((s) => <span key={s} className="tag">{s}</span>)}</p>
                )}
                {!docColors.colors.length ? (
                  <p className="dim" style={{ margin: 0 }}>Geen kleurwaarden gevonden in de opmaak (mogelijk alleen beeld).</p>
                ) : (
                  <div className="swatches">
                    {docColors.colors.map((c) => (
                      <Swatch key={`d${c.hex}${c.space}`} color={c} selected={selected.some((s) => s.hex === c.hex)} onSelect={() => pick(c)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {palette && (
              <div className="glass panel">
                <h3>Palet uit beeld <span className="dim">(CMYK is een indicatie)</span></h3>
                <div className="swatches">
                  {palette.map((c) => (
                    <Swatch key={`p${c.hex}`} color={c} selected={selected.some((s) => s.hex === c.hex)} onSelect={() => pick(c)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {saveOpen && (
        <SaveColors
          colors={selected.length ? selected : all.slice(0, 10)}
          preferred={preset?.id}
          onClose={() => setSaveOpen(false)}
          onSaved={(p) => {
            setSaveOpen(false)
            toast(`Kleuren opgeslagen in preset ${p.client}`)
          }}
        />
      )}
    </div>
  )
}

function SaveColors({ colors, preferred, onClose, onSaved }) {
  const [presets, setPresets] = useState(null)
  useEffect(() => {
    listPresets().then(setPresets)
  }, [])
  const save = async (p) => {
    const existing = p.colors || []
    const merged = [...existing]
    for (const c of colors) if (!merged.some((m) => m.hex === c.hex)) merged.push({ hex: c.hex, rgb: c.rgb, cmyk: c.cmyk, name: '' })
    const saved = await savePreset({ ...p, colors: merged })
    onSaved(saved)
  }
  return (
    <Modal title="Opslaan in klantpreset" onClose={onClose}>
      <div className="row" style={{ marginBottom: 14, gap: 6 }}>
        {colors.map((c) => <span key={c.hex} style={{ width: 28, height: 28, borderRadius: 6, background: c.hex, border: '1px solid var(--line)' }} />)}
      </div>
      {!presets ? (
        <span className="spinner" />
      ) : !presets.length ? (
        <p className="muted">Nog geen klantpresets. <a href="#/presets">Maak er eerst één aan</a>.</p>
      ) : (
        [...presets].sort((a, b) => (b.id === preferred) - (a.id === preferred)).map((p) => (
          <div key={p.id} className="file-row" style={{ cursor: 'pointer' }} onClick={() => save(p)}>
            <div className="grow">
              {p.client} {p.id === preferred && <span className="badge">dit project</span>}
              <div className="dim">{(p.colors || []).length} kleuren opgeslagen</div>
            </div>
            <span className="dim">→</span>
          </div>
        ))
      )}
    </Modal>
  )
}
