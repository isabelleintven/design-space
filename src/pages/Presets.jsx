import { useEffect, useState } from 'react'
import { listPresets, savePreset, deletePreset, emptyPreset } from '../lib/db'
import { Field, Modal, useToast } from '../components/ui'
import { renderPattern } from '../lib/naming'

export function PresetForm({ preset, onSave, onCancel }) {
  const [p, setP] = useState(preset)
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setPdf = (k) => (e) =>
    setP({ ...p, pdf: { ...p.pdf, [k]: e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value) } })
  const example = renderPattern(p.namingPattern, {
    klant: p.client || 'Klant',
    project: 'Kerstfolder',
    naam: 'Voorkant',
    nr: 1,
    versie: 2,
    ext: 'pdf',
    datum: new Date(),
    origineel: 'IMG_2041',
  }, p)

  return (
    <div className="stack">
      <Field label="Klant *">
        <input className="input" autoFocus value={p.client} onChange={set('client')} placeholder="Keurslager" />
      </Field>
      <Field
        label="Naamgevingspatroon"
        hint="Tokens: {klant} {project} {naam} {nr} {versie} {datum} {origineel}"
      >
        <input className="input mono" value={p.namingPattern} onChange={set('namingPattern')} />
      </Field>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={p.lowercase} onChange={set('lowercase')} /> kleine letters
        </label>
        <label className="check">
          spaties →
          <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={p.separator} onChange={set('separator')}>
            <option value="_">_</option>
            <option value="-">-</option>
            <option value=" ">spatie</option>
            <option value="">weg</option>
          </select>
        </label>
      </div>
      <div className="notice mono">{example}</div>

      <div className="eyebrow" style={{ marginTop: 8 }}>PDF-eisen drukwerk</div>
      <div className="grid-4">
        <Field label="Breedte (mm)">
          <input className="input" type="number" value={p.pdf.width} onChange={setPdf('width')} />
        </Field>
        <Field label="Hoogte (mm)">
          <input className="input" type="number" value={p.pdf.height} onChange={setPdf('height')} />
        </Field>
        <Field label="Afloop (mm)">
          <input className="input" type="number" value={p.pdf.bleed} onChange={setPdf('bleed')} />
        </Field>
        <Field label="Min. resolutie (ppi)">
          <input className="input" type="number" value={p.pdf.minDpi} onChange={setPdf('minDpi')} />
        </Field>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={p.pdf.requireEmbeddedFonts} onChange={setPdf('requireEmbeddedFonts')} /> Fonts moeten ingesloten zijn
        </label>
        <label className="check">
          <input type="checkbox" checked={p.pdf.requireCmyk} onChange={setPdf('requireCmyk')} /> Waarschuw bij RGB
        </label>
      </div>
      {p.colors?.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Huisstijlkleuren</div>
          <div className="row" style={{ gap: 8 }}>
            {p.colors.map((c) => (
              <span key={c.hex} className="preset-color">
                <span style={{ background: c.hex }} />
                <span className="mono">{c.hex}<br />C{c.cmyk[0]} M{c.cmyk[1]} Y{c.cmyk[2]} K{c.cmyk[3]}</span>
                <button className="btn small ghost" onClick={() => setP({ ...p, colors: p.colors.filter((x) => x.hex !== c.hex) })}>×</button>
              </span>
            ))}
          </div>
          <p className="dim">Kleuren toevoegen via de tool Kleuren uit PDF of logo.</p>
        </div>
      )}
      <Field label="Notities (huisstijl, contactpersoon, drukker…)">
        <textarea className="input" rows={3} value={p.notes} onChange={set('notes')} />
      </Field>
      <div className="row spread">
        <button className="btn ghost" onClick={onCancel}>Annuleren</button>
        <button className="btn primary" disabled={!p.client.trim()} onClick={() => onSave(p)}>Opslaan</button>
      </div>
    </div>
  )
}

export default function Presets() {
  const [presets, setPresets] = useState([])
  const [editing, setEditing] = useState(null)
  const toast = useToast()
  const reload = () => listPresets().then(setPresets)
  useEffect(() => {
    reload()
  }, [])

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Instellingen per klant</div>
        <h1>Klantpresets</h1>
        <p>Leg per klant de naamgeving en drukwerkeisen vast. Projecten en tools (hernoemen, PDF-check, exportpakket) gebruiken ze automatisch.</p>
      </div>
      <div className="row" style={{ marginBottom: 22 }}>
        <button className="btn primary" onClick={() => setEditing(emptyPreset())}>+ Nieuwe preset</button>
      </div>
      {!presets.length ? (
        <div className="glass empty">
          <span className="big">Nog geen presets</span>
          <p>Bijvoorbeeld: Keurslager · A4 · 3 mm afloop · KEURSLAGER_project_naam_v01</p>
        </div>
      ) : (
        <div className="cards">
          {presets.map((p) => (
            <div key={p.id} className="card glass" onClick={() => setEditing(p)}>
              <div className="eyebrow">Klant</div>
              <div className="title">{p.client}</div>
              <div className="rule" />
              <div className="desc">
                {p.pdf.width} × {p.pdf.height} mm · {p.pdf.bleed} mm afloop · {p.pdf.minDpi} ppi
              </div>
              {p.colors?.length > 0 && (
                <div className="row" style={{ gap: 4, marginTop: 12 }}>
                  {p.colors.slice(0, 10).map((c) => <span key={c.hex} title={c.hex} style={{ width: 18, height: 18, borderRadius: 4, background: c.hex, border: '1px solid var(--line)' }} />)}
                </div>
              )}
              <div className="foot">
                <span className="mono">{p.namingPattern}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={presets.some((p) => p.id === editing.id) ? 'Preset bewerken' : 'Nieuwe preset'} onClose={() => setEditing(null)} width={680}>
          <PresetForm
            preset={editing}
            onCancel={() => setEditing(null)}
            onSave={async (p) => {
              await savePreset(p)
              setEditing(null)
              reload()
              toast('Preset opgeslagen')
            }}
          />
          {presets.some((p) => p.id === editing.id) && (
            <button
              className="btn ghost danger small"
              style={{ marginTop: 12 }}
              onClick={async () => {
                if (!confirm(`Preset "${editing.client}" verwijderen?`)) return
                await deletePreset(editing.id)
                setEditing(null)
                reload()
              }}
            >
              Preset verwijderen
            </button>
          )}
        </Modal>
      )}
    </>
  )
}
