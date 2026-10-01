import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { extOf, formatBytes, formatDate } from '../lib/files'
import { listProjects, versionToFile } from '../lib/db'

// ---------- Toast ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const timer = useRef()
  const show = useCallback((text) => {
    setMsg(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast glass">{msg}</div>}
    </ToastCtx.Provider>
  )
}

// ---------- Dropzone ----------
export function Dropzone({ onFiles, accept, multiple = true, title = 'Sleep bestanden hierheen', hint, compact, children, className = '' }) {
  const [over, setOver] = useState(false)
  const input = useRef()
  const handle = (list) => {
    const files = [...list]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <div
      className={`dropzone ${compact ? 'compact' : ''} ${over ? 'over' : ''} ${className}`}
      onClick={() => input.current.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handle(e.dataTransfer.files)
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
      {children || (
        <>
          <span className="big">{title}</span>
          <span className="dim">{hint || 'of klik om te kiezen'}</span>
        </>
      )}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, width }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal glass" style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function FileIcon({ name }) {
  return <div className="file-icon">{extOf(name).slice(0, 4) || 'file'}</div>
}

export function Progress({ value }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

export function StatusDot({ status }) {
  return <span className={`dot ${status}`} />
}

/**
 * Kies een bestand(sversie) uit het project. Geeft File-objecten terug,
 * zodat tools geen verschil hoeven te maken tussen "gesleept" en "uit project".
 */
export function ProjectFilePicker({ project, onPick, multiple = false, filter = () => true, label = 'Kies uit project' }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState([])
  if (!project) return null
  const options = project.files.flatMap((f) =>
    f.versions.map((v, i) => ({ file: f, version: v, label: `${f.name} — v${i + 1}`, latest: i === f.versions.length - 1 })),
  ).filter((o) => filter(o.version.originalName))

  const confirm = async (list) => {
    const files = []
    for (const o of list) {
      const file = await versionToFile(o.version)
      if (file) {
        file.versionLabel = o.label
        files.push(file)
      }
    }
    setOpen(false)
    setSelected([])
    onPick(files)
  }

  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)} disabled={!options.length} title={!options.length ? 'Nog geen geschikte bestanden in dit project' : ''}>
        {label}
      </button>
      {open && (
        <Modal title="Uit project kiezen" onClose={() => setOpen(false)} width={640}>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {options.map((o) => {
              const isSel = selected.includes(o)
              return (
                <div
                  key={o.version.id}
                  className="file-row"
                  style={{ cursor: 'pointer', opacity: !multiple || isSel || !selected.length ? 1 : 0.75 }}
                  onClick={() => (multiple ? setSelected(isSel ? selected.filter((s) => s !== o) : [...selected, o]) : confirm([o]))}
                >
                  {multiple && <input type="checkbox" readOnly checked={isSel} />}
                  <FileIcon name={o.version.originalName} />
                  <div className="grow">
                    <div className="ellipsis">{o.label} {o.latest && <span className="badge">laatste</span>}</div>
                    <div className="dim">
                      {o.version.originalName} · {formatBytes(o.version.size)} · {formatDate(o.version.addedAt, true)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {multiple && (
            <div className="row spread" style={{ marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setSelected(options.filter((o) => o.latest))}>
                Alle laatste versies
              </button>
              <button className="btn primary" disabled={!selected.length} onClick={() => confirm(selected)}>
                {selected.length} toevoegen
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

/** In Quick-modus: resultaat optioneel bewaren in een bestaand project. */
export function SaveToProject({ onSave, label = 'Bewaar in project', disabled }) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState(null)
  const toast = useToast()
  useEffect(() => {
    if (open) listProjects().then(setProjects)
  }, [open])
  return (
    <>
      <button className="btn small" disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <Modal title="Bewaar in project" onClose={() => setOpen(false)}>
          {!projects ? (
            <span className="spinner" />
          ) : !projects.length ? (
            <p className="muted">
              Er zijn nog geen projecten. <a href="#/new">Maak een project aan</a>.
            </p>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="file-row"
                style={{ cursor: 'pointer' }}
                onClick={async () => {
                  await onSave(p)
                  setOpen(false)
                  toast(`Opgeslagen in "${p.name}"`)
                }}
              >
                <div className="grow">
                  <div>{p.name}</div>
                  <div className="dim">{p.client}</div>
                </div>
                <span className="dim">→</span>
              </div>
            ))
          )}
        </Modal>
      )}
    </>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="dim">{hint}</span>}
    </label>
  )
}
