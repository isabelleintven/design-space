import { useState } from 'react'
import { summarizeBriefing, summaryToText } from '../lib/briefing'
import { saveProject, uid } from '../lib/db'
import { download, formatDate, isPdf, safeName } from '../lib/files'
import { Dropzone, ProjectFilePicker, SaveToProject, useToast } from '../components/ui'

function Section({ title, items, render = (x) => x, empty = 'Niets gevonden', children }) {
  return (
    <div className="glass panel">
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {children}
      </div>
      {!items.length ? (
        <p className="dim" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <ul className="sum-list">
          {items.map((it, i) => (
            <li key={i}>{render(it)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Briefing({ project, updateProject }) {
  const [text, setText] = useState(project?.briefing || '')
  const [sum, setSum] = useState(null)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const loadFile = async ([file]) => {
    if (!file) return
    setLoading(true)
    try {
      if (isPdf(file)) {
        const { pdfText } = await import('../lib/pdf')
        setText((await pdfText(file)).join('\n\n'))
      } else setText(await file.text())
      setSum(null)
    } finally {
      setLoading(false)
    }
  }

  const title = project ? `Samenvatting briefing — ${project.name}` : 'Samenvatting briefing'

  const tasksChecklist = () => ({
    id: uid(),
    title: 'Takenlijst uit briefing',
    source: 'briefing',
    createdAt: new Date().toISOString(),
    items: [
      ...sum.deliverables.map((t) => ({ id: uid(), text: t, done: false, page: '', kind: 'actie' })),
      ...sum.questions.map((t) => ({ id: uid(), text: t, done: false, page: '', kind: 'vraag' })),
    ],
  })
  const addTasks = (p) => ({ ...p, checklists: [...p.checklists, tasksChecklist()] })

  return (
    <>
      <div className="glass panel stack">
        <div className="row spread">
          <h2 style={{ margin: 0 }}>Briefing</h2>
          <div className="row">
            <ProjectFilePicker project={project} filter={(n) => /\.(pdf|txt|md|eml)$/i.test(n)} onPick={loadFile} />
            {project?.briefing && text !== project.briefing && (
              <button className="btn small" onClick={() => setText(project.briefing)}>Briefing van project</button>
            )}
          </div>
        </div>
        <textarea
          className="input"
          rows={10}
          placeholder="Plak hier de briefing, of sleep een PDF, .txt of .eml hieronder…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setSum(null)
          }}
        />
        <div className="row spread">
          <div className="grow" style={{ maxWidth: 520 }}>
            <Dropzone compact multiple={false} accept=".pdf,.txt,.md,.eml,text/plain,application/pdf" onFiles={loadFile} title={loading ? 'Bezig met lezen…' : 'Of sleep een bestand'} hint=" " />
          </div>
          <button className="btn primary" disabled={!text.trim()} onClick={() => setSum(summarizeBriefing(text))}>
            Vat samen <span className="arrow" style={{ width: 22 }} />
          </button>
        </div>
        <p className="dim" style={{ margin: 0 }}>
          De samenvatting wordt lokaal gemaakt: Design Space kiest de belangrijkste zinnen en haalt data, specificaties, budget en contactgegevens eruit. Er gaat geen tekst naar internet.
        </p>
      </div>

      {sum && (
        <>
          <div className="row spread" style={{ margin: '28px 0 16px' }}>
            <div>
              <div className="eyebrow">{sum.stats.words} woorden · {sum.stats.sentences} zinnen</div>
              <span className="summary-big">In het kort</span>
            </div>
            <div className="row">
              <button className="btn small" onClick={() => { navigator.clipboard.writeText(summaryToText(sum, title)); toast('Samenvatting gekopieerd') }}>Kopieer</button>
              <button className="btn small" onClick={() => download(new Blob([summaryToText(sum, title)], { type: 'text/plain' }), `${safeName(title)}.txt`)}>Download .txt</button>
              {project ? (
                <button
                  className="btn small primary"
                  disabled={!sum.deliverables.length && !sum.questions.length}
                  onClick={async () => { await updateProject(addTasks); toast('Takenlijst toegevoegd aan Correcties') }}
                >
                  Takenlijst → project
                </button>
              ) : (
                <SaveToProject label="Takenlijst → project" disabled={!sum.deliverables.length && !sum.questions.length} onSave={(p) => saveProject(addTasks(p))} />
              )}
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div>
              <Section title="Kern" items={sum.key} />
              <Section title="Op te leveren" items={sum.deliverables} />
              <Section title="Doel, doelgroep & toon" items={sum.tone} />
              <Section title="Open vragen" items={sum.questions} empty="Geen open vragen gevonden" />
            </div>
            <div>
              <div className="glass panel">
                <h3>Deadline</h3>
                {sum.deadline ? (
                  <>
                    <div className="summary-big" style={{ fontSize: 38 }}>{formatDate(sum.deadline.date)}</div>
                    <p className="muted" style={{ margin: '8px 0 12px', fontSize: 13 }}>{sum.deadline.context}</p>
                    {project && project.deadline !== sum.deadline.date && (
                      <button className="btn small" onClick={async () => { await updateProject({ deadline: sum.deadline.date }); toast('Deadline overgenomen') }}>
                        Neem over als projectdeadline
                      </button>
                    )}
                  </>
                ) : (
                  <p className="dim" style={{ margin: 0 }}>Geen deadline herkend</p>
                )}
              </div>
              <Section
                title="Planning"
                items={sum.dates}
                empty="Geen data gevonden"
                render={(d) => (
                  <>
                    <span className="tag" style={d.isDeadline ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>{formatDate(d.date)}</span>
                    {d.context}
                  </>
                )}
              />
              <Section
                title="Specificaties"
                items={sum.specs}
                empty="Geen specificaties gevonden"
                render={(s) => (
                  <>
                    {s.kinds.map((k) => <span key={k} className="tag">{k}</span>)}
                    {s.text}
                  </>
                )}
              >
                {sum.quantity && <span className="badge">oplage {sum.quantity}</span>}
              </Section>
              <Section title="Budget" items={sum.budget} />
              <Section
                title="Contact"
                items={[...sum.contact.people, ...sum.contact.emails, ...sum.contact.phones]}
                render={(c) => (/@/.test(c) ? <a href={`mailto:${c}`}>{c}</a> : c)}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}
