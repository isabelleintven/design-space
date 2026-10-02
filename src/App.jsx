import { Suspense } from 'react'
import { useRoute } from './lib/router'
import { ToastProvider } from './components/ui'
import Home from './pages/Home'
import Projects from './pages/Projects'
import NewProject from './pages/NewProject'
import Workspace from './pages/Workspace'
import Presets from './pages/Presets'
import QuickTool from './pages/QuickTool'
import Background from './components/Background'
import { IS_DEV_BUILD } from './lib/db'

function Logo() {
  return (
    <a href="#/" className="logo" aria-label="Design Space home">
      <svg viewBox="0 0 52 26" fill="none" stroke="currentColor" strokeWidth="1.1">
        {/* planeet met ring, maantje en ster */}
        <circle cx="24" cy="13" r="7.5" />
        <path d="M17.2 10.6 C 22 12.4, 26.5 12.6, 30.8 11.2" strokeOpacity="0.55" />
        <mask id="ds-ring">
          <rect width="52" height="26" fill="#fff" />
          <circle cx="24" cy="13" r="8.8" fill="#000" />
          <rect x="0" y="13" width="52" height="13" fill="#fff" transform="rotate(-14 24 13)" />
        </mask>
        <ellipse cx="24" cy="13" rx="17" ry="4.6" transform="rotate(-14 24 13)" mask="url(#ds-ring)" />
        <circle cx="44.5" cy="6" r="1.6" fill="currentColor" stroke="none" />
        <path d="M6 3.2 L6.7 5.3 L8.8 6 L6.7 6.7 L6 8.8 L5.3 6.7 L3.2 6 L5.3 5.3 Z" fill="currentColor" stroke="none" />
      </svg>
      <span>DESIGN SPACE</span>
    </a>
  )
}

function Header({ route }) {
  const first = route.parts[0] || ''
  const is = (...names) => (names.includes(first) ? 'active' : '')
  return (
    <header className="header">
      <nav className="nav">
        <a href="#/" className={is('', 'tool')}>Quick Tools</a>
        <a href="#/projects" className={is('projects', 'project', 'new')}>Projecten</a>
        <a href="#/presets" className={is('presets')}>Klantpresets</a>
      </nav>
      <Logo />
      <div className="header-right">
        {IS_DEV_BUILD && <span className="dev-badge" title="Developer-preview met eigen opslag">DEV</span>}
        <a className="btn small" href="#/new">+ Nieuw project</a>
      </div>
    </header>
  )
}

function Page({ route }) {
  const [a, b, c, d] = route.parts
  if (a === 'tool' && b) return <QuickTool toolId={b} query={route.query} />
  if (a === 'projects') return <Projects />
  if (a === 'new') return <NewProject />
  if (a === 'presets') return <Presets />
  if (a === 'project' && b) return <Workspace key={b} projectId={b} section={c} toolId={c === 'tool' ? d : null} query={route.query} />
  return <Home />
}

export default function App() {
  const route = useRoute()
  return (
    <ToastProvider>
      <Background />
      <div className="frame-lines" />
      <span className="sparkle" style={{ left: 'calc(var(--frame) - 7px)', top: 120 }}>✦</span>
      <span className="sparkle" style={{ right: 'calc(var(--frame) - 7px)', bottom: 90 }}>✦</span>
      <Header route={route} />
      <main className="main">
        <Suspense fallback={<div className="empty"><span className="spinner" /></div>}>
          <Page route={route} />
        </Suspense>
      </main>
      <footer className="footer">Design Space · alles wordt lokaal in je browser verwerkt, er wordt niets geüpload</footer>
    </ToastProvider>
  )
}
