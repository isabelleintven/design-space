import { checklistToText } from '../lib/feedback'
import { uid } from '../lib/db'
import { download, safeName } from '../lib/files'
import { useToast } from './ui'

export function ChecklistView({ checklist, onChange, onDelete }) {
  const toast = useToast()
  const { items } = checklist
  const done = items.filter((i) => i.done).length
  const setItems = (next) => onChange({ ...checklist, items: next })
  const patch = (id, change) => setItems(items.map((i) => (i.id === id ? { ...i, ...change } : i)))

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: 0 }}>{checklist.title}</h3>
          <div className="dim">
            {done} van {items.length} afgerond
          </div>
        </div>
        <div className="row">
          <button
            className="btn small"
            onClick={() => {
              navigator.clipboard.writeText(checklistToText(checklist.title, items))
              toast('Gekopieerd naar klembord')
            }}
          >
            Kopieer
          </button>
          <button className="btn small" onClick={() => download(new Blob([checklistToText(checklist.title, items)], { type: 'text/plain' }), `${safeName(checklist.title)}.txt`)}>
            Download .txt
          </button>
          {onDelete && <button className="btn small ghost danger" onClick={onDelete}>Verwijder</button>}
        </div>
      </div>
      <div className="progress"><div style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
      {items.map((it) => (
        <div key={it.id} className={`check-item ${it.done ? 'done' : ''}`}>
          <input type="checkbox" className="check" style={{ accentColor: '#d7f0c8', marginTop: 5 }} checked={it.done} onChange={(e) => patch(it.id, { done: e.target.checked })} />
          <div>
            {it.kind === 'vraag' && <span className="tag vraag">vraag</span>}
            <span
              className="tag"
              contentEditable
              suppressContentEditableWarning
              title="Pagina / onderdeel (klik om te wijzigen)"
              onBlur={(e) => e.currentTarget.textContent.trim() !== it.page && patch(it.id, { page: e.currentTarget.textContent.trim() })}
            >
              {it.page ? (/^\d/.test(it.page) ? `p. ${it.page}` : it.page) : '—'}
            </span>
            <span
              className="text"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => e.currentTarget.textContent !== it.text && patch(it.id, { text: e.currentTarget.textContent })}
            >
              {it.text}
            </span>
          </div>
          <button className="btn small ghost" title="Verwijderen" onClick={() => setItems(items.filter((i) => i.id !== it.id))}>×</button>
        </div>
      ))}
      <button
        className="btn small ghost"
        style={{ marginTop: 10 }}
        onClick={() => setItems([...items, { id: uid(), text: 'Nieuw punt', done: false, page: '', kind: 'actie' }])}
      >
        + Punt toevoegen
      </button>
    </div>
  )
}
