import { useState } from 'react'
import { uid, versionToFile } from '../lib/db'
import { download, extOf, formatBytes, formatDate, safeName } from '../lib/files'
import { renderPattern } from '../lib/naming'
import { checklistToText } from '../lib/feedback'
import { Dropzone, Field, FileIcon, ProjectFilePicker, useToast } from '../components/ui'

const FOLDERS = ['01 Drukwerk', '02 Digitaal', '03 Open bestanden', '04 Lettertypen', '05 Overig']

function guessFolder(name) {
  const ext = extOf(name)
  if (ext === 'pdf') return FOLDERS[0]
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'mov', 'html'].includes(ext)) return FOLDERS[1]
  if (['indd', 'idml', 'ai', 'psd', 'eps', 'fig', 'sketch', 'afdesign', 'afpub', 'xd'].includes(ext)) return FOLDERS[2]
  if (['otf', 'ttf', 'woff', 'woff2'].includes(ext)) return FOLDERS[3]
  return FOLDERS[4]
}

export default function ExportPackage({ project, preset, updateProject }) {
  const [items, setItems] = useState([]) // { file, folder }
  const [opts, setOpts] = useState({
    name: project ? safeName([project.client, project.name].filter(Boolean).join(' - ')) : 'Oplevering',
    readme: true,
    checklists: !!project,
    usePattern: false,
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = (k) => (e) => setOpts({ ...opts, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const add = (files) => setItems([...items, ...files.map((file) => ({ file, folder: guessFolder(file.name) }))])

  const addLatestFromProject = async () => {
    const files = []
    for (const f of project.files) {
      const file = await versionToFile(f.versions.at(-1))
      if (file) files.push(file)
    }
    add(files)
  }

  const finalName = (file, i) =>
    opts.usePattern && preset
      ? renderPattern(
          preset.namingPattern,
          { klant: project?.client || preset.client, project: project?.name, naam: file.name.replace(/\.[^.]+$/, ''), origineel: file.name.replace(/\.[^.]+$/, ''), nr: i + 1, versie: 1, ext: extOf(file.name) },
          preset,
        )
      : file.name

  const build = async () => {
    setBusy(true)
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const root = zip.folder(safeName(opts.name) || 'Oplevering')
    const listing = []
    items.forEach(({ file, folder }, i) => {
      const name = finalName(file, i)
      root.folder(folder).file(name, file)
      listing.push(`${folder}/${name}  (${formatBytes(file.size)})`)
    })
    if (opts.readme) {
      const lines = [
        opts.name,
        '='.repeat(opts.name.length),
        '',
        project?.client && `Klant:      ${project.client}`,
        project?.name && `Project:    ${project.name}`,
        `Opgeleverd: ${formatDate(new Date().toISOString(), true)}`,
        project?.deadline && `Deadline:   ${formatDate(project.deadline)}`,
        '',
        opts.note && `${opts.note}\n`,
        'Inhoud',
        '------',
        ...listing,
        '',
        preset && `Specificaties drukwerk: ${preset.pdf.width} × ${preset.pdf.height} mm, ${preset.pdf.bleed} mm afloop`,
        '',
        'Samengesteld met Design Space',
      ].filter((l) => l !== false && l != null && l !== undefined)
      root.file('LEESMIJ.txt', lines.join('\n'))
    }
    if (opts.checklists && project?.checklists.length) {
      const folder = root.folder('Correcties')
      project.checklists.forEach((c, i) => folder.file(`${String(i + 1).padStart(2, '0')} ${safeName(c.title)}.txt`, checklistToText(c.title, c.items)))
    }
    const blob = await zip.generateAsync({ type: 'blob' }, () => {})
    const zipName = `${safeName(opts.name) || 'Oplevering'}.zip`
    download(blob, zipName)
    if (project)
      await updateProject((p) => ({
        ...p,
        exports: [...p.exports, { id: uid(), name: zipName, createdAt: new Date().toISOString(), size: blob.size, fileCount: items.length }],
      }))
    setBusy(false)
    toast('Exportpakket gedownload')
  }

  const total = items.reduce((n, i) => n + i.file.size, 0)
  const openPoints = project?.checklists.flatMap((c) => c.items).filter((i) => !i.done).length || 0

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="glass panel">
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Inhoud</h2>
          <div className="row">
            {project && <button className="btn small" disabled={!project.files.length} onClick={addLatestFromProject}>Alle laatste versies</button>}
            <ProjectFilePicker project={project} multiple onPick={add} label="Kies versies" />
          </div>
        </div>
        <Dropzone onFiles={add} compact={items.length > 0} title="Sleep eindbestanden hierheen" hint="Bestanden worden automatisch in de juiste map gezet" />
        {items.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {items.map((it, i) => (
              <div className="file-row" key={i}>
                <FileIcon name={it.file.name} />
                <div className="grow">
                  <div className="ellipsis">{finalName(it.file, i)}</div>
                  <div className="dim">{formatBytes(it.file.size)}</div>
                </div>
                <select
                  className="input"
                  style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}
                  value={it.folder}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, folder: e.target.value } : x)))}
                >
                  {FOLDERS.map((f) => <option key={f}>{f}</option>)}
                </select>
                <button className="btn small ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass panel stack">
        <h2 style={{ margin: 0 }}>Pakket</h2>
        <Field label="Naam van het pakket">
          <input className="input" value={opts.name} onChange={set('name')} />
        </Field>
        <Field label="Notitie voor de ontvanger (komt in LEESMIJ)">
          <textarea className="input" rows={3} style={{ minHeight: 80 }} value={opts.note} onChange={set('note')} placeholder="Bijv. drukklare PDF voor drukkerij X, oplage 5.000" />
        </Field>
        <label className="check"><input type="checkbox" checked={opts.readme} onChange={set('readme')} /> LEESMIJ.txt met inhoudsopgave toevoegen</label>
        {project && (
          <label className="check"><input type="checkbox" checked={opts.checklists} onChange={set('checklists')} /> Correctierondes meesturen</label>
        )}
        {preset && (
          <label className="check"><input type="checkbox" checked={opts.usePattern} onChange={set('usePattern')} /> Hernoemen volgens preset ({preset.namingPattern})</label>
        )}
        {openPoints > 0 && <div className="notice warn">Er staan nog {openPoints} open correctiepunten in dit project.</div>}
        <div className="hr" style={{ margin: '4px 0' }} />
        <div className="mono dim" style={{ lineHeight: 1.8 }}>
          {safeName(opts.name) || 'Oplevering'}/
          <br />
          {[...new Set(items.map((i) => i.folder))].sort().map((f) => (
            <div key={f}>&nbsp;&nbsp;├ {f}/ <span>({items.filter((i) => i.folder === f).length})</span></div>
          ))}
          {opts.checklists && project?.checklists.length > 0 && <div>&nbsp;&nbsp;├ Correcties/</div>}
          {opts.readme && <div>&nbsp;&nbsp;└ LEESMIJ.txt</div>}
        </div>
        <div className="row spread">
          <span className="dim">{items.length} bestanden · {formatBytes(total)}</span>
          <button className="btn primary" disabled={!items.length || busy} onClick={build}>
            {busy ? <span className="spinner" /> : 'Download ZIP'}
          </button>
        </div>
      </div>
    </div>
  )
}
