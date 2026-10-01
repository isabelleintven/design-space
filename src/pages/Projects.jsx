import { useEffect, useRef, useState } from 'react'
import { listProjects, importProjectFile } from '../lib/db'
import { navigate } from '../lib/router'
import { useToast } from '../components/ui'
import { ProjectCard } from './Home'

export default function Projects() {
  const [projects, setProjects] = useState(null)
  const [q, setQ] = useState('')
  const input = useRef()
  const toast = useToast()

  useEffect(() => {
    listProjects().then(setProjects)
  }, [])

  const filtered = (projects || []).filter((p) => `${p.name} ${p.client}`.toLowerCase().includes(q.toLowerCase()))

  const onImport = async (file) => {
    try {
      const p = await importProjectFile(file)
      toast(`"${p.name}" geïmporteerd`)
      navigate(`/project/${p.id}`)
    } catch (e) {
      toast(e.message || 'Importeren mislukt')
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Project workspace</div>
        <h1>Projecten</h1>
        <p>Projecten worden in deze browser bewaard. Deel een project met een collega via Instellingen → Exporteer project.</p>
      </div>
      <div className="row spread" style={{ marginBottom: 22 }}>
        <input className="input" style={{ maxWidth: 360 }} placeholder="Zoek op project of klant…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <input ref={input} type="file" accept=".dspace,.zip" hidden onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
          <button className="btn" onClick={() => input.current.click()}>Project importeren</button>
          <a className="btn primary" href="#/new">+ Nieuw project</a>
        </div>
      </div>
      {projects === null ? (
        <span className="spinner" />
      ) : !projects.length ? (
        <div className="glass empty">
          <span className="big">Nog geen projecten</span>
          <p>Start een project voor een grotere opdracht, bijvoorbeeld "Keurslager – Kerstfolder 2027".</p>
          <a className="btn primary" href="#/new">Nieuw project</a>
        </div>
      ) : (
        <div className="cards">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </>
  )
}
