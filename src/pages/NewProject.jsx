import { useEffect, useState } from 'react'
import { emptyProject, listPresets, saveProject, addFileToProject } from '../lib/db'
import { navigate } from '../lib/router'
import { Dropzone, Field, FileIcon } from '../components/ui'
import { formatBytes } from '../lib/files'

export default function NewProject() {
  const [presets, setPresets] = useState([])
  const [form, setForm] = useState({ name: '', client: '', deadline: '', briefing: '', presetId: '' })
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    listPresets().then(setPresets)
  }, [])

  // Klant kiezen vult de preset automatisch in
  useEffect(() => {
    const match = presets.find((p) => p.client.toLowerCase() === form.client.trim().toLowerCase())
    if (match && !form.presetId) setForm((f) => ({ ...f, presetId: match.id }))
  }, [form.client, presets])

  const create = async () => {
    setBusy(true)
    let project = emptyProject(form)
    for (const f of files) project = await addFileToProject(project, f, { note: 'Bronbestand' })
    project = await saveProject(project)
    navigate(`/project/${project.id}`)
  }

  return (
    <>
      <div className="page-head">
        <div className="crumbs">
          <a href="#/projects">Projecten</a> / <span>Nieuw</span>
        </div>
        <h1>Nieuw project</h1>
        <p>Alleen een naam is verplicht. De rest kun je later aanvullen.</p>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="glass panel stack">
          <Field label="Projectnaam *">
            <input className="input" autoFocus placeholder="Kerstfolder 2027" value={form.name} onChange={set('name')} />
          </Field>
          <div className="grid-2">
            <Field label="Klant">
              <input className="input" list="clients" placeholder="Keurslager" value={form.client} onChange={set('client')} />
              <datalist id="clients">
                {presets.map((p) => (
                  <option key={p.id} value={p.client} />
                ))}
              </datalist>
            </Field>
            <Field label="Deadline">
              <input className="input" type="date" value={form.deadline} onChange={set('deadline')} />
            </Field>
          </div>
          <Field label="Klantpreset" hint="Vaste naamgeving en PDF-eisen per klant. Beheer via Klantpresets.">
            <select className="input" value={form.presetId} onChange={set('presetId')}>
              <option value="">Geen preset</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client} — {p.pdf.width}×{p.pdf.height} mm, {p.pdf.bleed} mm afloop
                </option>
              ))}
            </select>
          </Field>
          <Field label="Briefing">
            <textarea className="input" rows={8} placeholder="Plak hier de briefing van de klant…" value={form.briefing} onChange={set('briefing')} />
          </Field>
        </div>
        <div className="glass panel">
          <h3>Bronbestanden</h3>
          <Dropzone onFiles={(f) => setFiles([...files, ...f])} title="Sleep bronbestanden hierheen" hint="Briefing-PDF, teksten, beeld, logo's…" />
          {files.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {files.map((f, i) => (
                <div className="file-row" key={i}>
                  <FileIcon name={f.name} />
                  <div className="grow ellipsis">{f.name}</div>
                  <span className="dim">{formatBytes(f.size)}</span>
                  <button className="btn ghost small" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="hr" />
          <div className="row spread">
            <a className="btn ghost" href="#/projects">Annuleren</a>
            <button className="btn primary" disabled={!form.name.trim() || busy} onClick={create}>
              {busy ? <span className="spinner" /> : 'Project aanmaken'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
