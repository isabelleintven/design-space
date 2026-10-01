import { Suspense } from 'react'
import { useRoute } from './lib/router'
import { ToastProvider } from './components/ui'
import Home from './pages/Home'
import Projects from './pages/Projects'
import NewProject from './pages/NewProject'
import Workspace from './pages/Workspace'
import Presets from './pages/Presets'
import QuickTool from './pages/QuickTool'

function Logo() {
  return (
    <a href="#/" className="logo" aria-label="Design Space home">
      <svg viewBox="0 0 46 20" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M2 18 L15 4 L22 11 L27 6 L44 18" />
        <path d="M12 7.5 L15 4 L18 7.5 L16 7 L15 8 L14 7 Z" fill="currentColor" stroke="none" />
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
      <div className="bg" />
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
