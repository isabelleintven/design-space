import { daysUntil, formatDate } from '../lib/files'

const RANGE = 56 // dagen vooruit op de tijdlijn

/** Alle projecten met een deadline op één tijdlijn (komende 8 weken). */
export default function Planning({ projects }) {
  const dated = projects
    .filter((p) => p.deadline)
    .map((p) => ({ p, days: daysUntil(p.deadline), open: p.checklists.flatMap((c) => c.items).filter((i) => !i.done).length }))
    .filter((x) => x.days >= -7)
    .sort((a, b) => a.days - b.days)
  if (!dated.length) return null
  const pos = (d) => `${Math.min(100, Math.max(0, (d / RANGE) * 100))}%`
  const weeks = Array.from({ length: RANGE / 7 + 1 }, (_, i) => i * 7)
  const today = new Date()

  return (
    <section style={{ marginTop: 56 }}>
      <div className="section-title">
        <h2>Planning</h2>
        <span className="dim">Deadlines van de komende 8 weken</span>
      </div>
      <div className="glass panel planning">
        <div className="planning-row planning-axis">
          <div />
          <div className="planning-track">
            {weeks.map((d) => {
              const date = new Date(today)
              date.setDate(today.getDate() + d)
              return (
                <span key={d} className="tick" style={{ left: pos(d) }}>
                  {d === 0 ? 'vandaag' : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              )
            })}
          </div>
        </div>
        {dated.map(({ p, days, open }) => {
          const status = days < 0 ? 'fail' : days <= 3 ? 'warn' : 'ok'
          return (
            <a key={p.id} className="planning-row" href={`#/project/${p.id}`}>
              <div className="ellipsis">
                <div className="ellipsis">{p.name}</div>
                <div className="dim ellipsis">{p.client || 'Geen klant'} · {open} open</div>
              </div>
              <div className="planning-track">
                {weeks.map((d) => <span key={d} className="grid-line" style={{ left: pos(d) }} />)}
                <span className={`planning-bar ${status}`} style={{ width: pos(Math.max(0, days)) }} />
                <span className={`planning-dot ${status}`} style={{ left: pos(Math.max(0, days)) }} title={formatDate(p.deadline)} />
                <span className="planning-label" style={{ left: pos(Math.max(0, days)) }}>
                  {days < 0 ? `${-days}d te laat` : days === 0 ? 'vandaag' : days > RANGE ? `${formatDate(p.deadline)} →` : formatDate(p.deadline)}
                </span>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
