import { useEffect, useState } from 'react'
import { TOOLS } from '../tools'
import { listProjects } from '../lib/db'
import { daysUntil } from '../lib/files'

export function ToolCard({ tool, href }) {
  if (tool.soon)
    return (
      <div className="card glass soon">
        <div className="eyebrow">{tool.category}</div>
        <div className="title">{tool.name}</div>
        <div className="rule" />
        <div className="desc">{tool.desc}</div>
        <div className="foot"><span className="badge">Binnenkort</span></div>
      </div>
    )
  return (
    <a className="card glass" href={href}>
      <div className="eyebrow">{tool.category}</div>
      <div className="title">{tool.name}</div>
      <div className="rule" />
      <div className="desc">{tool.desc}</div>
      <div className="foot">
        <span>{tool.accepts}</span>
        <span>→</span>
      </div>
    </a>
  )
}

export function ProjectCard({ project }) {
  const days = daysUntil(project.deadline)
  const open = project.checklists.flatMap((c) => c.items).filter((i) => !i.done).length
  return (
    <a className="card glass" href={`#/project/${project.id}`}>
      <div className="eyebrow">{project.client || 'Geen klant'}</div>
      <div className="title">{project.name}</div>
      <div className="rule" />
      <div className="desc">
        {project.files.length} bestand{project.files.length === 1 ? '' : 'en'} · {open} open punt{open === 1 ? '' : 'en'}
      </div>
      <div className="foot">
        <span style={{ color: days != null && days <= 3 ? 'var(--warn)' : undefined }}>
          {days == null ? 'Geen deadline' : days < 0 ? `Deadline ${-days} dag(en) geleden` : days === 0 ? 'Deadline vandaag' : `Nog ${days} dag${days === 1 ? '' : 'en'}`}
        </span>
        <span>→</span>
      </div>
    </a>
  )
}

export default function Home() {
  const [projects, setProjects] = useState([])
  useEffect(() => {
    listProjects().then(setProjects)
  }, [])

  return (
    <>
      <section className="hero">
        <div className="eyebrow" style={{ marginBottom: 18 }}>Toolbox voor grafisch vormgevers</div>
        <h1>Design Space</h1>
        <p>
          Kies een Quick Tool en ga direct aan de slag. Werk je aan een grotere opdracht? Start een project en Design Space
          onthoudt de briefing, bestanden, versies en correcties voor je.
        </p>
        <div className="hero-actions">
          <a className="btn-oval" href="#/new">
            Nieuw project <span className="arrow" />
          </a>
          <a className="btn-oval" href="#/projects">
            Project openen
          </a>
        </div>
      </section>

      <section id="tools">
        <div className="section-title">
          <h2>Quick Tools</h2>
          <span className="dim">Geen project nodig · er wordt niets opgeslagen</span>
        </div>
        <div className="cards">
          {TOOLS.map((t) => (
            <ToolCard key={t.id} tool={t} href={`#/tool/${t.id}`} />
          ))}
        </div>
      </section>

      {projects.length > 0 && (
        <section style={{ marginTop: 56 }}>
          <div className="section-title">
            <h2>Recente projecten</h2>
            <a className="btn small" href="#/projects">Alle projecten</a>
          </div>
          <div className="cards">
            {projects.slice(0, 4).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
