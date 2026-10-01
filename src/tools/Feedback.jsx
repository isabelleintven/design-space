import { useState } from 'react'
import { parseFeedback } from '../lib/feedback'
import { saveProject, uid } from '../lib/db'
import { isPdf } from '../lib/files'
import { Dropzone, SaveToProject, useToast } from '../components/ui'
import { ChecklistView } from '../components/Checklist'
import { navigate } from '../lib/router'

export default function Feedback({ project, updateProject }) {
  const round = (project?.checklists.length || 0) + 1
  const [text, setText] = useState('')
  const [checklist, setChecklist] = useState(null)
  const [title, setTitle] = useState(project ? `Correctieronde ${round}` : 'Correcties')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const loadFile = async ([file]) => {
    setLoading(true)
    try {
      if (isPdf(file)) {
        const { pdfText } = await import('../lib/pdf')
        const pages = await pdfText(file)
        setText(pages.map((t, i) => `Pagina ${i + 1}:\n${t}`).join('\n\n'))
      } else {
        setText(await file.text())
      }
    } finally {
      setLoading(false)
    }
  }

  const make = () => {
    const items = parseFeedback(text)
    setChecklist({ id: uid(), title, source: text, createdAt: new Date().toISOString(), items })
    if (!items.length) toast('Geen actiepunten herkend. Probeer elk punt op een eigen regel.')
  }

  const addTo = (p) => ({ ...p, checklists: [...p.checklists, { ...checklist, title }] })

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="glass panel stack">
        <h2>Feedback</h2>
        <textarea
          className="input"
          rows={16}
          placeholder={'Plak hier de mail of het appje van de klant, bijvoorbeeld:\n\nHoi! Ziet er mooi uit.\n- Logo op de voorkant mag groter\n- Pagina 3: prijs rundergehakt moet €8,99 zijn\nKunnen we de foto op p. 5 vervangen door een warmere?\n\nGroet, Sanne'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Dropzone compact multiple={false} accept=".txt,.eml,.md,.pdf,text/plain,application/pdf" onFiles={loadFile} title={loading ? 'Bezig met lezen…' : 'Of sleep een .txt, .eml of PDF met opmerkingen'} hint=" " />
        <div className="row spread">
          <input className="input" style={{ maxWidth: 260 }} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn primary" disabled={!text.trim()} onClick={make}>
            Maak checklist <span className="arrow" style={{ width: 22 }} />
          </button>
        </div>
      </div>

      <div className="glass panel">
        {!checklist ? (
          <div className="empty">
            <span className="big">Checklist</span>
            Groeten, afsluitingen en handtekeningen worden weggefilterd. Paginanummers ("p. 3", "pagina 4") en vragen worden herkend.
          </div>
        ) : (
          <>
            <ChecklistView checklist={{ ...checklist, title }} onChange={(c) => setChecklist(c)} />
            <div className="hr" />
            <div className="row">
              {project ? (
                <button
                  className="btn primary"
                  onClick={async () => {
                    await updateProject(addTo)
                    toast('Checklist opgeslagen in het project')
                    navigate(`/project/${project.id}/checklists`)
                  }}
                >
                  Opslaan in project
                </button>
              ) : (
                <SaveToProject onSave={(p) => saveProject(addTo(p))} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
