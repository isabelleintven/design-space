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
      <svg viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {/* koe in een ufo */}
        <defs>
        <mask id="ufo-snout"><rect width="64" height="40" fill="#fff"/><ellipse cx="32" cy="27.6" rx="6.4" ry="4.2" fill="#000"/></mask>
        </defs>
        <line x1="32" y1="9.6" x2="32" y2="5.4"/>
        <circle cx="32" cy="3.8" r="1.6"/>
        <path d="M16.6 25.2 A15.6 15.6 0 0 1 47.4 25.2"/>
        <g mask="url(#ufo-snout)">
        <ellipse cx="32" cy="29" rx="29" ry="5.2"/>
        <path d="M9 30.6 Q32 35.8 55 30.6" strokeOpacity="0.45"/>
        </g>
        <path d="M29.4 18.4 L28.2 15.6"/><circle cx="27.8" cy="14.6" r="1"/>
        <path d="M34.6 18.4 L35.8 15.6"/><circle cx="36.2" cy="14.6" r="1"/>
        <path d="M27.4 20.6 Q23.4 18.6 21.8 20.8 Q24 23.6 27.4 22.6"/>
        <path d="M36.6 20.6 Q40.6 18.6 42.2 20.8 Q40 23.6 36.6 22.6"/>
        <path d="M27.2 25.4 L27.2 21.6 Q27.2 18.4 32 18.4 Q36.8 18.4 36.8 21.6 L36.8 25.4"/>
        <ellipse cx="30.1" cy="22.2" rx="0.9" ry="1.2"/>
        <ellipse cx="33.9" cy="22.2" rx="0.9" ry="1.2"/>
        <path d="M27.2 25.4 Q26.4 30.6 32 30.6 Q37.6 30.6 36.8 25.4 Q32 24 27.2 25.4 Z"/>
        <circle cx="30.3" cy="27.6" r="0.6" fill="currentColor" stroke="none"/>
        <circle cx="33.7" cy="27.6" r="0.6" fill="currentColor" stroke="none"/>
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
