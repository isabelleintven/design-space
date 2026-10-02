import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getProject,
  saveProject,
  listPresets,
  addFileToProject,
  versionToFile,
  deleteBlob,
  deleteProject,
  exportProjectFile,
} from '../lib/db'
import { TOOLS, getTool } from '../tools'
import { navigate } from '../lib/router'
import { daysUntil, download, formatBytes, formatDate, isPdf, safeName } from '../lib/files'
import { Dropzone, Field, FileIcon, useToast } from '../components/ui'
import { ChecklistView } from '../components/Checklist'

const SECTIONS = [
  { id: '', label: 'Overzicht' },
  { id: 'files', label: 'Bestanden & versies' },
  { id: 'checklists', label: 'Correcties' },
  { id: 'exports', label: 'Exports' },
  { id: 'settings', label: 'Instellingen' },
]

export default function Workspace({ projectId, section = '', toolId, query }) {
  const [project, setProject] = useState(undefined)
  const [presets, setPresets] = useState([])
  const latest = useRef()

  useEffect(() => {
    getProject(projectId).then((p) => {
      latest.current = p
      setProject(p || null)
    })
    listPresets().then(setPresets)
  }, [projectId])

  /** Past het project aan en slaat het direct op. Accepteert object of (async) functie. */
  const update = useCallback(async (change) => {
    const current = latest.current
    const next = typeof change === 'function' ? await change(current) : { ...current, ...change }
    // direct tonen, daarna opslaan
    latest.current = next
    setProject(next)
    const saved = await saveProject(next)
    latest.current = saved
    return saved
  }, [])

  if (project === undefined) return <div className="empty"><span className="spinner" /></div>
  if (project === null)
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <span className="big">Project niet gevonden</span>
        <p>Projecten staan in de browser waarin ze gemaakt zijn.</p>
        <a className="btn" href="#/projects">Naar projecten</a>
      </div>
    )

  const preset = presets.find((p) => p.id === project.presetId) || null
  const tool = toolId ? getTool(toolId) : null
  const base = `#/project/${project.id}`
  const current = toolId ? `tool/${toolId}` : section || ''

  return (
    <>
      <div className="page-head" style={{ paddingBottom: 24 }}>
        <div className="crumbs">
          <a href="#/projects">Projecten</a> / <a href={base}>{project.name}</a>
          {tool && <> / <span>{tool.name}</span></>}
        </div>
        <div className="eyebrow">{project.client || 'Geen klant'}{preset && ' · preset actief'}</div>
        <h1>{tool ? tool.name : project.name}</h1>
      </div>

      <div className="workspace">
        <aside className="sidebar glass">
          <div className="eyebrow">Project</div>
          {SECTIONS.map((s) => (
            <a key={s.id} href={s.id ? `${base}/${s.id}` : base} className={current === s.id ? 'active' : ''}>
              {s.label}
            </a>
          ))}
          <div className="eyebrow" style={{ marginTop: 10 }}>Tools</div>
          {TOOLS.map((t) => (
            <a key={t.id} href={`${base}/tool/${t.id}`} className={`${current === `tool/${t.id}` ? 'active' : ''} ${t.soon ? 'soon' : ''}`}>
              {t.name}
              {t.soon && <span className="dim"> · binnenkort</span>}
            </a>
          ))}
        </aside>

        <div style={{ minWidth: 0 }}>
          {tool && !tool.soon ? (
            <tool.component project={project} preset={preset} updateProject={update} query={query} />
          ) : section === 'files' ? (
            <FilesSection project={project} update={update} base={base} />
          ) : section === 'checklists' ? (
            <ChecklistsSection project={project} update={update} base={base} />
          ) : section === 'exports' ? (
            <ExportsSection project={project} base={base} />
          ) : section === 'settings' ? (
            <SettingsSection project={project} update={update} presets={presets} />
          ) : (
            <Overview project={project} update={update} preset={preset} presets={presets} base={base} />
          )}
        </div>
      </div>
    </>
  )
}

// ---------------- Overzicht ----------------
function Overview({ project, update, preset, presets, base }) {
  const [briefing, setBriefing] = useState(project.briefing)
  const days = daysUntil(project.deadline)
  const items = project.checklists.flatMap((c) => c.items)
  const open = items.filter((i) => !i.done).length
  const versions = project.files.reduce((n, f) => n + f.versions.length, 0)
  const recent = project.files
    .flatMap((f) => f.versions.map((v, i) => ({ f, v, i })))
    .sort((a, b) => b.v.addedAt.localeCompare(a.v.addedAt))
    .slice(0, 5)

  return (
    <>
      <div className="kpis">
        <div className="kpi glass">
          <div className="eyebrow">Deadline</div>
          <div className={`value ${days != null && days <= 3 ? (days < 0 ? 'fail' : 'warn') : ''}`}>
            {days == null ? '—' : days < 0 ? `${-days}d te laat` : days === 0 ? 'Vandaag' : `${days} dagen`}
          </div>
          <div className="dim">{project.deadline ? formatDate(project.deadline) : 'Niet ingesteld'}</div>
        </div>
        <div className="kpi glass">
          <div className="eyebrow">Open correcties</div>
          <div className={`value ${open ? 'warn' : ''}`}>{open}</div>
          <div className="dim">van {items.length} punten</div>
        </div>
        <div className="kpi glass">
          <div className="eyebrow">Bestanden</div>
          <div className="value">{project.files.length}</div>
          <div className="dim">{versions} versies</div>
        </div>
        <div className="kpi glass">
          <div className="eyebrow">Exports</div>
          <div className="value">{project.exports.length}</div>
          <div className="dim">{project.exports[0] ? formatDate(project.exports.at(-1).createdAt) : 'Nog geen'}</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="glass panel">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Briefing</h2>
            <div className="row">
              {briefing !== project.briefing && <button className="btn small primary" onClick={() => update({ briefing })}>Opslaan</button>}
              {project.briefing && <a className="btn small" href={`${base}/tool/summary`}>Vat samen</a>}
            </div>
          </div>
          <textarea
            className="input"
            rows={14}
            placeholder="Plak hier de briefing…"
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            onBlur={() => briefing !== project.briefing && update({ briefing })}
          />
        </div>
        <div>
          <div className="glass panel">
            <h3>Projectgegevens</h3>
            <div className="grid-2">
              <Field label="Klant">
                <input className="input" defaultValue={project.client} onBlur={(e) => e.target.value !== project.client && update({ client: e.target.value })} />
              </Field>
              <Field label="Deadline">
                <input className="input" type="date" value={project.deadline} onChange={(e) => update({ deadline: e.target.value })} />
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Klantpreset">
                <select className="input" value={project.presetId} onChange={(e) => update({ presetId: e.target.value })}>
                  <option value="">Geen preset</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.client}</option>
                  ))}
                </select>
              </Field>
              {preset && (
                <p className="dim" style={{ margin: '8px 0 0' }}>
                  {preset.pdf.width} × {preset.pdf.height} mm · {preset.pdf.bleed} mm afloop · {preset.pdf.minDpi} ppi ·{' '}
                  <span className="mono">{preset.namingPattern}</span>
                </p>
              )}
            </div>
          </div>
          <div className="glass panel">
            <div className="row spread" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Laatst toegevoegd</h3>
              <a className="btn small" href={`${base}/files`}>Alle bestanden</a>
            </div>
            {!recent.length ? (
              <p className="dim">Nog geen bestanden. Sleep ze naar Bestanden & versies.</p>
            ) : (
              recent.map(({ f, v, i }) => (
                <div className="file-row" key={v.id}>
                  <FileIcon name={v.originalName} />
                  <div className="grow">
                    <div className="ellipsis">{f.name} <span className="dim">v{i + 1}</span></div>
                    <div className="dim">{formatDate(v.addedAt, true)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="glass panel">
            <h3>Snel naar</h3>
            <div className="row">
              <a className="btn small" href={`${base}/tool/feedback`}>Feedback verwerken</a>
              <a className="btn small" href={`${base}/tool/pdf-check`}>PDF-check</a>
              <a className="btn small" href={`${base}/tool/compare`}>Versies vergelijken</a>
              <a className="btn small" href={`${base}/tool/export`}>Exportpakket</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------- Bestanden ----------------
function FilesSection({ project, update, base }) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState({})
  const toast = useToast()

  const add = async (files) => {
    setBusy(true)
    await update(async (p) => {
      for (const f of files) p = await addFileToProject(p, f)
      return p
    })
    setBusy(false)
    toast(`${files.length} bestand(en) toegevoegd`)
  }

  const addVersion = async (fileEntry, files) => {
    await update(async (p) => {
      for (const f of files) p = await addFileToProject(p, f, { logicalName: fileEntry.name })
      return p
    })
    setOpen({ ...open, [fileEntry.id]: true })
    toast(`Nieuwe versie van "${fileEntry.name}"`)
  }

  const removeVersion = async (fileEntry, version) => {
    if (!confirm(`Versie "${version.originalName}" verwijderen?`)) return
    await deleteBlob(version.blobId)
    await update((p) => ({
      ...p,
      files: p.files
        .map((f) => (f.id === fileEntry.id ? { ...f, versions: f.versions.filter((v) => v.id !== version.id) } : f))
        .filter((f) => f.versions.length),
    }))
  }

  const saveNote = (fileEntry, version, note) =>
    update((p) => ({
      ...p,
      files: p.files.map((f) =>
        f.id === fileEntry.id ? { ...f, versions: f.versions.map((v) => (v.id === version.id ? { ...v, note } : v)) } : f,
      ),
    }))

  return (
    <>
      <Dropzone onFiles={add} title={busy ? 'Bezig met opslaan…' : 'Sleep bestanden hierheen'} hint="Heet een bestand hetzelfde als een bestaand bestand (bijv. Folder_v2.pdf), dan wordt het automatisch een nieuwe versie." />
      <div className="glass panel" style={{ marginTop: 18 }}>
        {!project.files.length ? (
          <p className="dim" style={{ margin: 0 }}>Nog geen bestanden in dit project.</p>
        ) : (
          project.files.map((f) => {
            const last = f.versions.at(-1)
            const expanded = open[f.id]
            return (
              <div key={f.id} style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 6, marginBottom: 6 }}>
                <div className="file-row" style={{ borderBottom: 0 }}>
                  <FileIcon name={last.originalName} />
                  <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setOpen({ ...open, [f.id]: !expanded })}>
                    <div className="ellipsis">
                      {f.name} <span className="badge">v{f.versions.length}</span>
                    </div>
                    <div className="dim">
                      {last.originalName} · {formatBytes(last.size)} · {formatDate(last.addedAt, true)}
                    </div>
                  </div>
                  <VersionUpload onFiles={(files) => addVersion(f, files)} />
                  {f.versions.length > 1 && (
                    <a className="btn small" href={`${base}/tool/compare?a=${f.versions.at(-2).id}&b=${last.id}`}>Vergelijk met vorige</a>
                  )}
                  {isPdf({ name: last.originalName, type: last.type }) && (
                    <a className="btn small" href={`${base}/tool/pdf-check?v=${last.id}`}>Check</a>
                  )}
                  <button className="btn small ghost" onClick={() => setOpen({ ...open, [f.id]: !expanded })}>{expanded ? '▴' : '▾'}</button>
                </div>
                {expanded && (
                  <table className="table" style={{ marginLeft: 46, width: 'calc(100% - 46px)' }}>
                    <tbody>
                      {[...f.versions].reverse().map((v, ri) => {
                        const n = f.versions.length - ri
                        return (
                          <tr key={v.id}>
                            <td style={{ width: 40 }}>v{n}</td>
                            <td className="ellipsis" style={{ maxWidth: 240 }}>{v.originalName}</td>
                            <td className="dim">{formatDate(v.addedAt, true)}</td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: '4px 8px', fontSize: 12 }}
                                placeholder="Notitie bij deze versie…"
                                defaultValue={v.note}
                                onBlur={(e) => e.target.value !== v.note && saveNote(f, v, e.target.value)}
                              />
                            </td>
                            <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                              <button className="btn small ghost" onClick={async () => download(await versionToFile(v), v.originalName)}>Download</button>
                              <button className="btn small ghost danger" onClick={() => removeVersion(f, v)}>×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function VersionUpload({ onFiles }) {
  const input = useRef()
  return (
    <>
      <input ref={input} type="file" hidden onChange={(e) => e.target.files.length && onFiles([...e.target.files])} />
      <button className="btn small" onClick={() => input.current.click()}>+ Versie</button>
    </>
  )
}

// ---------------- Correcties ----------------
function ChecklistsSection({ project, update, base }) {
  const setChecklist = (cl) => update((p) => ({ ...p, checklists: p.checklists.map((c) => (c.id === cl.id ? cl : c)) }))
  const remove = (cl) => confirm(`"${cl.title}" verwijderen?`) && update((p) => ({ ...p, checklists: p.checklists.filter((c) => c.id !== cl.id) }))
  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <a className="btn primary" href={`${base}/tool/feedback`}>+ Feedback omzetten naar checklist</a>
      </div>
      {!project.checklists.length ? (
        <div className="glass empty">
          <span className="big">Nog geen correctierondes</span>
          <p>Plak klantfeedback in de tool Feedback naar checklist, dan verschijnt de lijst hier.</p>
        </div>
      ) : (
        [...project.checklists].reverse().map((cl) => (
          <div className="glass panel" key={cl.id}>
            <ChecklistView checklist={cl} onChange={setChecklist} onDelete={() => remove(cl)} />
          </div>
        ))
      )}
    </>
  )
}

// ---------------- Exports ----------------
function ExportsSection({ project, base }) {
  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <a className="btn primary" href={`${base}/tool/export`}>+ Nieuw exportpakket</a>
      </div>
      <div className="glass panel">
        {!project.exports.length ? (
          <p className="dim" style={{ margin: 0 }}>Nog geen exports gemaakt.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Pakket</th><th>Bestanden</th><th>Grootte</th><th>Datum</th></tr>
            </thead>
            <tbody>
              {[...project.exports].reverse().map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.fileCount}</td>
                  <td>{formatBytes(e.size)}</td>
                  <td className="dim">{formatDate(e.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ---------------- Instellingen ----------------
function SettingsSection({ project, update, presets }) {
  const [form, setForm] = useState({ name: project.name, client: project.client, deadline: project.deadline, presetId: project.presetId })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <>
      <div className="glass panel stack">
        <h2>Projectgegevens</h2>
        <div className="grid-2">
          <Field label="Projectnaam"><input className="input" value={form.name} onChange={set('name')} /></Field>
          <Field label="Klant"><input className="input" value={form.client} onChange={set('client')} /></Field>
          <Field label="Deadline"><input className="input" type="date" value={form.deadline} onChange={set('deadline')} /></Field>
          <Field label="Klantpreset">
            <select className="input" value={form.presetId} onChange={set('presetId')}>
              <option value="">Geen preset</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.client}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <button className="btn primary" disabled={!form.name.trim()} onClick={async () => { await update(form); toast('Opgeslagen') }}>Opslaan</button>
        </div>
      </div>
      <div className="glass panel">
        <h3>Project delen of back-uppen</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Exporteert het hele project (gegevens, bestanden, versies, correcties en preset) als één <span className="mono">.dspace</span>-bestand.
          Een collega kan dit importeren via Projecten → Project importeren.
        </p>
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            download(await exportProjectFile(project), `${safeName(project.client ? `${project.client} - ${project.name}` : project.name)}.dspace`)
            setBusy(false)
          }}
        >
          {busy ? <span className="spinner" /> : 'Exporteer project'}
        </button>
      </div>
      <div className="glass panel">
        <h3>Project verwijderen</h3>
        <p className="muted" style={{ marginTop: 0 }}>Verwijdert het project en alle bestanden uit deze browser. Dit kan niet ongedaan worden gemaakt.</p>
        <button
          className="btn danger"
          onClick={async () => {
            if (!confirm(`"${project.name}" definitief verwijderen?`)) return
            await deleteProject(project)
            navigate('/projects')
          }}
        >
          Verwijder project
        </button>
      </div>
    </>
  )
}
