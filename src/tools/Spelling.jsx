import { useState } from 'react'
import { localChecks, languageToolCheck, mergeIssues } from '../lib/textcheck'
import { isPdf } from '../lib/files'
import { Dropzone, ProjectFilePicker, useToast } from '../components/ui'

const LT_KEY = 'ds-use-languagetool'
const readPref = () => {
  try {
    return localStorage.getItem(LT_KEY) === '1'
  } catch {
    return false
  }
}

const TYPE_LABEL = { spelling: 'Spelling', typografie: 'Typografie', hoofdletter: 'Hoofdletter', stijl: 'Stijl', grammatica: 'Grammatica' }

export default function Spelling({ project }) {
  const [text, setText] = useState('')
  const [issues, setIssues] = useState(null)
  const [active, setActive] = useState(null)
  const [useLT, setUseLT] = useState(readPref)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(true)
  const toast = useToast()

  const loadFile = async ([file]) => {
    if (!file) return
    setBusy(true)
    try {
      if (isPdf(file)) {
        const { pdfText } = await import('../lib/pdf')
        const pages = await pdfText(file)
        setText(pages.map((t, i) => (pages.length > 1 ? `— pagina ${i + 1} —\n${t}` : t)).join('\n\n'))
      } else setText(await file.text())
      setIssues(null)
      setEditing(true)
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    setError('')
    let lt = []
    if (useLT) {
      try {
        lt = await languageToolCheck(text)
      } catch (e) {
        setError(`${e.message} Alleen de lokale controle is uitgevoerd.`)
      }
    }
    setIssues(mergeIssues(lt, localChecks(text)))
    setEditing(false)
    setActive(null)
    setBusy(false)
  }

  const apply = (issue, replacement) => {
    const delta = replacement.length - issue.length
    setText(text.slice(0, issue.offset) + replacement + text.slice(issue.offset + issue.length))
    setIssues(
      issues
        .filter((i) => i !== issue)
        .map((i) => (i.offset > issue.offset ? { ...i, offset: i.offset + delta } : i)),
    )
    setActive(null)
  }

  const ignore = (issue) => setIssues(issues.filter((i) => i !== issue))

  // Tekst opdelen in stukken met markeringen
  const segments = []
  if (issues) {
    let pos = 0
    issues.forEach((issue, idx) => {
      if (issue.offset < pos) return
      segments.push(text.slice(pos, issue.offset))
      segments.push(
        <mark key={idx} className={`${issue.type} ${active === issue ? 'active' : ''}`} onClick={() => setActive(issue)} title={issue.message}>
          {text.slice(issue.offset, issue.offset + issue.length)}
        </mark>,
      )
      pos = issue.offset + issue.length
    })
    segments.push(text.slice(pos))
  }

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <div className="glass panel">
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Tekst</h2>
          <div className="row">
            <ProjectFilePicker project={project} filter={(n) => /\.(pdf|txt|md)$/i.test(n)} onPick={loadFile} />
            {issues && (
              <button className="btn small" onClick={() => setEditing(!editing)}>{editing ? 'Toon markeringen' : 'Bewerken'}</button>
            )}
            <button
              className="btn small"
              disabled={!text}
              onClick={() => {
                navigator.clipboard.writeText(text)
                toast('Tekst gekopieerd')
              }}
            >
              Kopieer tekst
            </button>
          </div>
        </div>
        {editing || !issues ? (
          <textarea
            className="input"
            rows={18}
            lang="nl"
            spellCheck
            placeholder="Plak hier de tekst (bijv. uit InDesign of Word), of sleep hieronder een PDF of .txt…"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setIssues(null)
            }}
          />
        ) : (
          <div className="spell-text">{segments}</div>
        )}
        <div style={{ marginTop: 14 }}>
          <Dropzone compact multiple={false} accept=".pdf,.txt,.md,text/plain,application/pdf" onFiles={loadFile} title="Of sleep een PDF of .txt" hint="De tekst wordt lokaal uit de PDF gehaald" />
        </div>
        <div className="row spread" style={{ marginTop: 14 }}>
          <label className="check" title="LanguageTool is een gratis dienst; de tekst wordt dan naar languagetool.org gestuurd.">
            <input
              type="checkbox"
              checked={useLT}
              onChange={(e) => {
                setUseLT(e.target.checked)
                try {
                  localStorage.setItem(LT_KEY, e.target.checked ? '1' : '0')
                } catch {
                  /* geen opslag beschikbaar */
                }
              }}
            />
            Uitgebreide spelling & grammatica (LanguageTool, online)
          </label>
          <button className="btn primary" disabled={!text.trim() || busy} onClick={check}>
            {busy ? <span className="spinner" /> : 'Controleer'}
          </button>
        </div>
        {useLT && <p className="dim" style={{ marginBottom: 0 }}>Let op: met deze optie wordt de tekst naar languagetool.org gestuurd. Gebruik dit niet voor vertrouwelijke teksten.</p>}
        {!useLT && <p className="dim" style={{ marginBottom: 0 }}>Zonder LanguageTool controleert Design Space lokaal op typografie, dubbele woorden en hoofdletters. Spelfouten onderstreept je browser in het tekstvak.</p>}
      </div>

      <div className="glass panel">
        {error && <div className="notice warn" style={{ marginBottom: 12 }}>{error}</div>}
        {!issues ? (
          <div className="empty">
            <span className="big">Meldingen</span>
            Plak een tekst en klik op Controleer.
          </div>
        ) : !issues.length ? (
          <div className="empty">
            <span className="big" style={{ color: 'var(--ok)' }}>Geen meldingen</span>
            Er zijn geen fouten gevonden.
          </div>
        ) : (
          <>
            <div className="row spread" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{issues.length} melding{issues.length === 1 ? '' : 'en'}</h3>
              <span className="dim">
                {Object.entries(issues.reduce((a, i) => ({ ...a, [i.type]: (a[i.type] || 0) + 1 }), {}))
                  .map(([k, v]) => `${v} ${(TYPE_LABEL[k] || k).toLowerCase()}`)
                  .join(' · ')}
              </span>
            </div>
            <div style={{ maxHeight: 620, overflow: 'auto' }}>
              {issues.map((issue, i) => (
                <div key={i} className={`issue ${active === issue ? 'active' : ''}`} onClick={() => { setActive(issue); setEditing(false) }}>
                  <div className="row spread">
                    <span className="eyebrow">{TYPE_LABEL[issue.type] || issue.type}</span>
                    <span className="dim">{issue.source}</span>
                  </div>
                  <div style={{ margin: '4px 0' }}>
                    <span className="mono" style={{ color: 'var(--fail)' }}>{text.slice(issue.offset, issue.offset + issue.length).replace(/ /g, '·') || '∅'}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{issue.message}</div>
                  <div>
                    {issue.replacements.map((r) => (
                      <button key={r} className="suggestion" onClick={(e) => { e.stopPropagation(); apply(issue, r) }}>
                        {r.replace(/ /g, '·') || '(verwijderen)'}
                      </button>
                    ))}
                    <button className="btn small ghost" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); ignore(issue) }}>Negeer</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
