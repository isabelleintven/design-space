import { useMemo, useState } from 'react'
import { loadPdf, closePdf } from '../lib/pdf'
import { extractTables, toCsv, toTsv, toXlsx } from '../lib/pdftable'
import { addFileToProject, saveProject } from '../lib/db'
import { download, isPdf, safeName } from '../lib/files'
import { Dropzone, Progress, ProjectFilePicker, SaveToProject, useToast } from '../components/ui'

export default function PdfTable({ project, updateProject }) {
  const [file, setFile] = useState(null)
  const [tables, setTables] = useState(null) // [{ page, rows }]
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [opts, setOpts] = useState({ header: true, numbers: true, merge: true, dropTitles: true })
  const toast = useToast()

  const run = async (f, o = opts) => {
    if (!isPdf(f)) return setError('Dit is geen PDF.')
    setFile(f)
    setTables(null)
    setError('')
    setProgress(0.05)
    try {
      const pdf = await loadPdf(f)
      const all = []
      for (let n = 1; n <= pdf.numPages; n++) {
        all.push(...(await extractTables(pdf, [n], { dropTitles: o.dropTitles })))
        setProgress(n / pdf.numPages)
      }
      closePdf(pdf)
      const withText = all.filter((t) => t.rows.length)
      if (!withText.length) setError('Geen tekst gevonden. Is dit een scan? Dan bevat de PDF alleen beeld en geen tekst.')
      setTables(withText)
      setCurrent(0)
    } catch (e) {
      console.error(e)
      setError('Deze PDF kon niet gelezen worden.')
    }
    setProgress(0)
  }

  const edit = (ti, fn) => setTables(tables.map((t, i) => (i === ti ? { ...t, rows: fn(t.rows) } : t)))

  // Alle pagina's samenvoegen: herhaalde kopregels op volgende pagina's weglaten
  const sheets = useMemo(() => {
    if (!tables?.length) return []
    if (!opts.merge) return tables.map((t) => ({ name: `Pagina ${t.page}`, rows: t.rows }))
    const width = Math.max(...tables.map((t) => t.rows[0]?.length || 0))
    const pad = (r) => [...r, ...new Array(Math.max(0, width - r.length)).fill('')]
    const head = tables[0].rows[0]?.join('|')
    const rows = tables.flatMap((t, i) => (i > 0 && opts.header && t.rows[0]?.join('|') === head ? t.rows.slice(1) : t.rows)).map(pad)
    return [{ name: 'Tabel', rows }]
  }, [tables, opts.merge, opts.header])

  const base = file ? safeName(file.name.replace(/\.pdf$/i, '')) : 'tabel'
  const makeXlsx = () => toXlsx(sheets, opts)
  const addTo = async (p) => addFileToProject(p, new File([await makeXlsx()], `${base}.xlsx`), { note: 'Uit PDF naar tabel' })

  const t = tables?.[current]

  return (
    <>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="glass panel stack">
          <h2 style={{ margin: 0 }}>PDF</h2>
          <Dropzone multiple={false} accept="application/pdf,.pdf" onFiles={([f]) => run(f)} compact={!!file} title={file ? 'Andere PDF' : 'Sleep een PDF hierheen'} hint="Prijslijsten, tabellen, overzichten" />
          <ProjectFilePicker project={project} filter={(n) => /\.pdf$/i.test(n)} onPick={([f]) => f && run(f)} />
          {file && <div className="ellipsis dim">{file.name}</div>}
          <div className="hr" style={{ margin: '4px 0' }} />
          <label className="check"><input type="checkbox" checked={opts.header} onChange={(e) => setOpts({ ...opts, header: e.target.checked })} /> Eerste rij is een kopregel</label>
          <label className="check"><input type="checkbox" checked={opts.numbers} onChange={(e) => setOpts({ ...opts, numbers: e.target.checked })} /> Bedragen & getallen als getal (Excel)</label>
          <label className="check"><input type="checkbox" checked={opts.dropTitles} onChange={(e) => {
                const next = { ...opts, dropTitles: e.target.checked }
                setOpts(next)
                if (file) run(file, next)
              }} /> Titels boven de tabel weglaten</label>
          <label className="check"><input type="checkbox" checked={opts.merge} onChange={(e) => setOpts({ ...opts, merge: e.target.checked })} /> Alle pagina's in één tabblad</label>
        </div>

        <div className="glass panel">
          {error && <div className="notice warn" style={{ marginBottom: 12 }}>{error}</div>}
          {!file && !error && (
            <div className="empty">
              <span className="big">Nog geen PDF</span>
              Design Space herkent kolommen aan de witruimte tussen de tekst. Je kunt rijen en kolommen daarna nog weghalen voordat je exporteert.
            </div>
          )}
          {file && !tables && !error && (
            <div className="empty">
              <span className="spinner" /> <span style={{ marginLeft: 10 }}>Tabellen zoeken…</span>
              <Progress value={progress} />
            </div>
          )}
          {t && (
            <>
              <div className="row spread" style={{ marginBottom: 14 }}>
                <div>
                  <span className="summary-big">{sheets.reduce((n, s) => n + s.rows.length, 0)} rijen</span>
                  <div className="dim" style={{ marginTop: 6 }}>{tables.length} pagina('s) · {Math.max(...tables.map((x) => x.rows[0]?.length || 0))} kolommen</div>
                </div>
                <div className="row">
                  <button className="btn small" onClick={() => { navigator.clipboard.writeText(sheets.map((s) => toTsv(s.rows)).join('\n')); toast('Gekopieerd: plak direct in Excel of Numbers') }}>Kopieer voor Excel</button>
                  <button className="btn small" onClick={() => download(new Blob([toCsv(sheets.flatMap((s) => s.rows))], { type: 'text/csv' }), `${base}.csv`)}>CSV</button>
                  {project ? (
                    <button className="btn small" onClick={async () => { await updateProject(addTo); toast('Excel-bestand toegevoegd aan project') }}>Bewaar in project</button>
                  ) : (
                    <SaveToProject onSave={async (p) => saveProject(await addTo(p))} />
                  )}
                  <button className="btn small primary" onClick={async () => download(await makeXlsx(), `${base}.xlsx`)}>Download Excel</button>
                </div>
              </div>
              {tables.length > 1 && (
                <div className="page-pills" style={{ marginBottom: 14 }}>
                  {tables.map((x, i) => (
                    <button key={x.page} className={`page-pill ${i === current ? 'active' : ''}`} onClick={() => setCurrent(i)}>{x.page}</button>
                  ))}
                </div>
              )}
              <div className="table-wrap" style={{ maxHeight: 560, overflow: 'auto' }}>
                <table className="table data-table">
                  <thead>
                    <tr>
                      {t.rows[0]?.map((_, ci) => (
                        <th key={ci}>
                          <button className="btn small ghost" title="Kolom verwijderen" onClick={() => edit(current, (rows) => rows.map((r) => r.filter((_, j) => j !== ci)))}>× kol. {ci + 1}</button>
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, ri) => (
                      <tr key={ri} className={opts.header && ri === 0 ? 'head-row' : ''}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => e.currentTarget.textContent !== cell && edit(current, (rows) => rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? e.currentTarget.textContent : c)) : r)))}
                          >
                            {cell}
                          </td>
                        ))}
                        <td style={{ width: 30 }}>
                          <button className="btn small ghost" title="Rij verwijderen" onClick={() => edit(current, (rows) => rows.filter((_, i) => i !== ri))}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dim" style={{ marginBottom: 0 }}>Klik in een cel om de tekst aan te passen.</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
