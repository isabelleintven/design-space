import { useMemo, useState } from 'react'
import { addFileToProject, saveProject } from '../lib/db'
import { download, extOf, formatBytes, safeName } from '../lib/files'
import { renderPattern } from '../lib/naming'
import { Dropzone, Field, ProjectFilePicker, SaveToProject, useToast } from '../components/ui'

const PRESETS = [
  { label: 'Origineel (alleen opschonen)', value: '{origineel}' },
  { label: 'Klant_Project_Naam_v01', value: '{klant}_{project}_{origineel}_v{versie}' },
  { label: 'Project_01', value: '{project}_{nr}' },
  { label: 'Datum_Naam', value: '{datum}_{origineel}' },
  { label: 'Klant_Project_001', value: '{klant}_{project}_{nr:3}' },
]

export default function Rename({ project, preset, updateProject }) {
  const [files, setFiles] = useState([])
  const [opts, setOpts] = useState({
    pattern: preset?.namingPattern?.replace('{naam}', '{origineel}') || '{origineel}',
    klant: project?.client || '',
    project: project?.name || '',
    start: 1,
    versie: 1,
    separator: preset?.separator ?? '_',
    lowercase: preset?.lowercase ?? false,
    find: '',
    replace: '',
    sort: 'added',
  })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = (k) => (e) => setOpts({ ...opts, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const rows = useMemo(() => {
    const list = opts.sort === 'name' ? [...files].sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true })) : files
    const seen = new Map()
    return list.map((file, i) => {
      let base = file.name.replace(/\.[^.]+$/, '')
      if (opts.find) {
        try {
          base = base.replace(new RegExp(opts.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), opts.replace)
        } catch {
          /* ongeldige invoer negeren */
        }
      }
      let name = renderPattern(
        opts.pattern,
        { klant: opts.klant, project: opts.project, naam: base, origineel: base, nr: Number(opts.start) + i, versie: Number(opts.versie), ext: extOf(file.name) },
        { separator: opts.separator, lowercase: opts.lowercase },
      )
      // dubbele namen voorkomen
      const key = name.toLowerCase()
      const count = seen.get(key) || 0
      seen.set(key, count + 1)
      if (count) name = name.replace(/(\.[^.]+)?$/, `${opts.separator || '-'}${count + 1}$1`)
      return { file, name, changed: name !== file.name }
    })
  }, [files, opts])

  const toZip = async () => {
    setBusy(true)
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const r of rows) zip.file(r.name, r.file)
    download(await zip.generateAsync({ type: 'blob' }), `${safeName(opts.project || 'hernoemd')}_hernoemd.zip`)
    setBusy(false)
  }

  const toFolder = async () => {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
      setBusy(true)
      for (const r of rows) {
        const handle = await dir.getFileHandle(r.name, { create: true })
        const w = await handle.createWritable()
        await w.write(r.file)
        await w.close()
      }
      toast(`${rows.length} bestanden opgeslagen in "${dir.name}"`)
    } catch (e) {
      if (e.name !== 'AbortError') toast('Opslaan in map mislukt')
    } finally {
      setBusy(false)
    }
  }

  const addTo = async (p) => {
    for (const r of rows) p = await addFileToProject(p, new File([r.file], r.name, { type: r.file.type }))
    return p
  }

  return (
    <>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="glass panel stack">
          <h2>Bestanden</h2>
          <Dropzone onFiles={(f) => setFiles([...files, ...f])} compact={files.length > 0} />
          <div className="row spread">
            <span className="dim">{files.length} bestand(en)</span>
            <div className="row">
              <ProjectFilePicker project={project} multiple onPick={(f) => setFiles([...files, ...f])} />
              {files.length > 0 && <button className="btn small ghost" onClick={() => setFiles([])}>Leegmaken</button>}
            </div>
          </div>
        </div>
        <div className="glass panel stack">
          <h2>Patroon</h2>
          <Field label="Naamgevingspatroon" hint="Tokens: {klant} {project} {origineel} {nr} {nr:3} {versie} {datum}">
            <input className="input mono" value={opts.pattern} onChange={set('pattern')} />
          </Field>
          <div className="row">
            {PRESETS.map((p) => (
              <button key={p.value} className="btn small" onClick={() => setOpts({ ...opts, pattern: p.value })}>{p.label}</button>
            ))}
            {preset && <button className="btn small" onClick={() => setOpts({ ...opts, pattern: preset.namingPattern.replace('{naam}', '{origineel}') })}>Preset {preset.client}</button>}
          </div>
          <div className="grid-2">
            <Field label="{klant}"><input className="input" value={opts.klant} onChange={set('klant')} /></Field>
            <Field label="{project}"><input className="input" value={opts.project} onChange={set('project')} /></Field>
          </div>
          <div className="grid-4">
            <Field label="Start {nr}"><input className="input" type="number" value={opts.start} onChange={set('start')} /></Field>
            <Field label="{versie}"><input className="input" type="number" value={opts.versie} onChange={set('versie')} /></Field>
            <Field label="Zoek"><input className="input" value={opts.find} onChange={set('find')} placeholder="IMG_" /></Field>
            <Field label="Vervang door"><input className="input" value={opts.replace} onChange={set('replace')} /></Field>
          </div>
          <div className="row">
            <label className="check">
              spaties →
              <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={opts.separator} onChange={set('separator')}>
                <option value="_">_</option>
                <option value="-">-</option>
                <option value=" ">spatie</option>
                <option value="">weg</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={opts.lowercase} onChange={set('lowercase')} /> kleine letters</label>
            <label className="check">
              volgorde
              <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={opts.sort} onChange={set('sort')}>
                <option value="added">zoals toegevoegd</option>
                <option value="name">op naam</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="glass panel" style={{ marginTop: 18 }}>
          <div className="row spread" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Voorbeeld</h2>
            <div className="row">
              {'showDirectoryPicker' in window && <button className="btn" disabled={busy} onClick={toFolder}>Opslaan in map…</button>}
              {project ? (
                <button className="btn" disabled={busy} onClick={async () => { await updateProject(addTo); toast('Toegevoegd aan project') }}>Toevoegen aan project</button>
              ) : (
                <SaveToProject label="Toevoegen aan project" onSave={async (p) => saveProject(await addTo(p))} />
              )}
              <button className="btn primary" disabled={busy} onClick={toZip}>{busy ? <span className="spinner" /> : 'Download ZIP'}</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Origineel</th><th /><th>Nieuwe naam</th><th>Grootte</th><th /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="mono dim">{r.file.name}</td>
                    <td className="dim">→</td>
                    <td className="mono" style={{ color: r.changed ? 'var(--text)' : 'var(--text-dim)' }}>{r.name}</td>
                    <td className="dim">{formatBytes(r.file.size)}</td>
                    <td><button className="btn small ghost" onClick={() => setFiles(files.filter((f) => f !== r.file))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dim" style={{ marginBottom: 0 }}>
            Je originele bestanden blijven onaangeroerd: je krijgt hernoemde kopieën (ZIP of in een gekozen map).
          </p>
        </div>
      )}
    </>
  )
}
