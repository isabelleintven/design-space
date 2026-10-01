import { useEffect, useMemo, useState } from 'react'
import { analyzePdf, evaluate, DEFAULT_SPEC } from '../lib/pdfcheck'
import { loadPdf, renderPage, closePdf } from '../lib/pdf'
import { uid, versionToFile } from '../lib/db'
import { download, formatBytes, isPdf, safeName } from '../lib/files'
import { Dropzone, Field, Progress, ProjectFilePicker, StatusDot, useToast } from '../components/ui'

const FORMATS = [
  { label: 'A4', width: 210, height: 297 },
  { label: 'A5', width: 148, height: 210 },
  { label: 'A3', width: 297, height: 420 },
  { label: 'A6', width: 105, height: 148 },
  { label: 'DL', width: 99, height: 210 },
  { label: 'Visitekaartje', width: 85, height: 55 },
]

const STATUS_LABEL = { ok: 'In orde', warn: 'Let op', fail: 'Probleem', info: 'Info' }

export default function PdfCheck({ project, preset, updateProject, query }) {
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [thumb, setThumb] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [spec, setSpec] = useState({ ...DEFAULT_SPEC, ...(preset?.pdf || {}) })
  const [showDetails, setShowDetails] = useState(false)
  const toast = useToast()

  // Vanuit "Bestanden & versies" direct een versie checken
  useEffect(() => {
    if (!project || !query?.v) return
    const v = project.files.flatMap((f) => f.versions).find((x) => x.id === query.v)
    if (v) versionToFile(v).then((f) => f && run(f))
  }, [query?.v])

  useEffect(() => {
    if (preset?.pdf) setSpec((s) => ({ ...s, ...preset.pdf }))
  }, [preset?.id])

  const run = async (f) => {
    if (!isPdf(f)) return setError('Dit is geen PDF.')
    setFile(f)
    setReport(null)
    setThumb(null)
    setError('')
    setProgress(0.05)
    try {
      const pdf = await loadPdf(f)
      const canvas = await renderPage(pdf, 1, 360)
      setThumb(canvas.toDataURL('image/jpeg', 0.8))
      closePdf(pdf)
      setReport(await analyzePdf(f, setProgress))
    } catch (e) {
      console.error(e)
      setError('Deze PDF kon niet gelezen worden. Is hij beveiligd of beschadigd?')
    }
    setProgress(0)
  }

  const checks = useMemo(() => (report ? evaluate(report, spec) : []), [report, spec])
  const counts = checks.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {})
  const overall = counts.fail ? 'fail' : counts.warn ? 'warn' : 'ok'
  const setNum = (k) => (e) => setSpec({ ...spec, [k]: Number(e.target.value) })

  const reportText = () =>
    [
      `PDF-check — ${file.name}`,
      `${new Date().toLocaleString('nl-NL')}`,
      `Eisen: ${spec.width}×${spec.height} mm, ${spec.bleed} mm afloop, ${spec.minDpi} ppi`,
      '',
      ...checks.map((c) => `[${STATUS_LABEL[c.status]}] ${c.label}: ${c.detail}`),
      '',
      `Pagina's: ${report.info.pages} · PDF ${report.info.version} · ${report.info.producer || ''}`,
      '',
      'Lettertypen:',
      ...report.fonts.map((f) => `  ${f.embedded ? '✓' : '✗'} ${f.name} (${f.type})`),
      '',
      'Beelden onder de minimale resolutie:',
      ...report.placements.filter((p) => p.dpi < spec.minDpi).map((p) => `  p.${p.page}: ${p.dpi} ppi (${p.w}×${p.h} px op ${p.widthMm}×${p.heightMm} mm)`),
    ].join('\n')

  const toChecklist = () =>
    updateProject((p) => ({
      ...p,
      checklists: [
        ...p.checklists,
        {
          id: uid(),
          title: `PDF-check ${file.name}`,
          source: 'pdf-check',
          createdAt: new Date().toISOString(),
          items: checks
            .filter((c) => c.status === 'fail' || c.status === 'warn')
            .map((c) => ({ id: uid(), text: `${c.label}: ${c.detail}`, done: false, page: '', kind: 'actie' })),
        },
      ],
    })).then(() => toast('Aandachtspunten toegevoegd aan Correcties'))

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', alignItems: 'start' }}>
      <div>
        <div className="glass panel stack">
          <h2>PDF</h2>
          <Dropzone multiple={false} accept="application/pdf,.pdf" onFiles={([f]) => run(f)} compact={!!file} title={file ? 'Andere PDF' : 'Sleep een PDF hierheen'} />
          <ProjectFilePicker project={project} filter={(n) => /\.pdf$/i.test(n)} onPick={([f]) => f && run(f)} />
          {file && (
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {thumb && <img src={thumb} alt="" style={{ width: 90, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }} />}
              <div className="grow">
                <div className="ellipsis">{file.name}</div>
                <div className="dim">{formatBytes(file.size)}</div>
                {report && <div className="dim">{report.info.pages} pagina's · PDF {report.info.version}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="glass panel stack">
          <h3 style={{ margin: 0 }}>Eisen {preset && <span className="badge">preset {preset.client}</span>}</h3>
          <div className="row">
            {FORMATS.map((f) => (
              <button
                key={f.label}
                className={`btn small ${spec.width === f.width && spec.height === f.height ? 'primary' : ''}`}
                onClick={() => setSpec({ ...spec, width: f.width, height: f.height })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid-2">
            <Field label="Breedte (mm)"><input className="input" type="number" value={spec.width} onChange={setNum('width')} /></Field>
            <Field label="Hoogte (mm)"><input className="input" type="number" value={spec.height} onChange={setNum('height')} /></Field>
            <Field label="Afloop (mm)"><input className="input" type="number" value={spec.bleed} onChange={setNum('bleed')} /></Field>
            <Field label="Min. ppi"><input className="input" type="number" value={spec.minDpi} onChange={setNum('minDpi')} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={spec.requireEmbeddedFonts} onChange={(e) => setSpec({ ...spec, requireEmbeddedFonts: e.target.checked })} /> Fonts moeten ingesloten zijn</label>
          <label className="check"><input type="checkbox" checked={spec.requireCmyk} onChange={(e) => setSpec({ ...spec, requireCmyk: e.target.checked })} /> Waarschuw bij RGB (drukwerk)</label>
        </div>
      </div>

      <div className="glass panel">
        {error && <div className="notice warn">{error}</div>}
        {!file && !error && (
          <div className="empty">
            <span className="big">Nog geen PDF</span>
            Controleert eindformaat, afloop, TrimBox, ingesloten fonts, effectieve beeldresolutie, RGB/CMYK, steunkleuren en transparantie.
          </div>
        )}
        {file && !report && !error && (
          <div className="empty">
            <span className="spinner" /> <span style={{ marginLeft: 10 }}>PDF analyseren…</span>
            <Progress value={progress} />
          </div>
        )}
        {report && (
          <>
            <div className="row spread" style={{ marginBottom: 10 }}>
              <div className="row" style={{ gap: 18 }}>
                <span className="summary-big" style={{ color: `var(--${overall})` }}>
                  {overall === 'ok' ? 'Drukklaar' : overall === 'warn' ? 'Let op' : 'Niet drukklaar'}
                </span>
              </div>
              <div className="row">
                <span className="status ok">{counts.ok || 0}</span>
                <span className="status warn">{counts.warn || 0}</span>
                <span className="status fail">{counts.fail || 0}</span>
              </div>
            </div>
            {checks.map((c, i) => (
              <div className="check-row" key={i}>
                <StatusDot status={c.status} />
                <div className="label">{c.label}</div>
                <div className="detail muted">{c.detail}</div>
              </div>
            ))}
            <div className="hr" />
            <div className="row">
              <button className="btn small" onClick={() => setShowDetails(!showDetails)}>{showDetails ? 'Verberg details' : 'Toon details'}</button>
              <button className="btn small" onClick={() => download(new Blob([reportText()], { type: 'text/plain' }), `PDF-check ${safeName(file.name)}.txt`)}>Rapport downloaden</button>
              {project && (counts.fail || counts.warn) ? <button className="btn small" onClick={toChecklist}>Aandachtspunten → correcties</button> : null}
            </div>
            {showDetails && <Details report={report} spec={spec} />}
          </>
        )}
      </div>
    </div>
  )
}

function Details({ report, spec }) {
  const low = report.placements.filter((p) => p.dpi < spec.minDpi).sort((a, b) => a.dpi - b.dpi)
  return (
    <div style={{ marginTop: 20 }} className="stack">
      <div>
        <div className="eyebrow">Document</div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          {report.info.title && <>Titel: {report.info.title}<br /></>}
          Gemaakt met: {report.info.creator || '—'} · {report.info.producer || '—'}
        </p>
      </div>
      <div className="table-wrap">
        <div className="eyebrow">Pagina's</div>
        <table className="table">
          <thead><tr><th>Pag.</th><th>Eindformaat</th><th>Mediabox</th><th>Afloop</th><th>TrimBox</th></tr></thead>
          <tbody>
            {report.pages.slice(0, 60).map((p) => (
              <tr key={p.n}>
                <td>{p.n}</td>
                <td>{p.trim.w} × {p.trim.h} mm</td>
                <td className="dim">{p.media.w} × {p.media.h} mm</td>
                <td style={{ color: p.bleed < spec.bleed - 0.2 ? 'var(--fail)' : undefined }}>{p.bleed} mm</td>
                <td>{p.hasTrim ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <div className="eyebrow">Lettertypen ({report.fonts.length})</div>
        <table className="table">
          <tbody>
            {report.fonts.map((f, i) => (
              <tr key={i}>
                <td>{f.name}</td>
                <td className="dim">{f.type}{f.subset ? ' · subset' : ''}</td>
                <td style={{ color: f.embedded ? 'var(--ok)' : 'var(--fail)' }}>{f.embedded ? 'ingesloten' : 'niet ingesloten'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {low.length > 0 && (
        <div className="table-wrap">
          <div className="eyebrow">Beelden onder {spec.minDpi} ppi</div>
          <table className="table">
            <thead><tr><th>Pag.</th><th>Resolutie</th><th>Pixels</th><th>Geplaatst</th></tr></thead>
            <tbody>
              {low.slice(0, 50).map((p, i) => (
                <tr key={i}>
                  <td>{p.page}</td>
                  <td style={{ color: p.dpi < spec.minDpi * 0.6 ? 'var(--fail)' : 'var(--warn)' }}>{p.dpi} ppi</td>
                  <td className="dim">{p.w} × {p.h}</td>
                  <td className="dim">{p.widthMm} × {p.heightMm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <div className="eyebrow">Afbeeldingen per kleurruimte</div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          {Object.entries(report.images.reduce((a, i) => ({ ...a, [i.colorSpace]: (a[i.colorSpace] || 0) + 1 }), {}))
            .map(([k, v]) => `${k}: ${v}`)
            .join(' · ') || 'Geen afbeeldingen'}
        </p>
      </div>
    </div>
  )
}
