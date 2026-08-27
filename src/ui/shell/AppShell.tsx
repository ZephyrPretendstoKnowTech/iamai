import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { signOut } from '../../graph/msal.ts'

export const LINKEDIN_URL = 'https://www.linkedin.com/in/lachlanrobinette/'
export const GITHUB_URL = 'https://github.com/ZephyrPretendstoKnowTech'
export const REPO_URL = 'https://github.com/ZephyrPretendstoKnowTech/iamai'

export type Route =
  | 'start'
  | 'connect'
  | 'baseline'
  | 'scan'
  | 'mapping'
  | 'coverage'
  | 'roadmap'
  | 'licensing'
  | 'reads'

export type StepStatus = 'notStarted' | 'inProgress' | 'done' | 'attention'

const STEPS: { route: Route; label: string }[] = [
  { route: 'start', label: 'Start' },
  { route: 'connect', label: 'Connect' },
  { route: 'baseline', label: 'Baseline' },
  { route: 'scan', label: 'Scan' },
  { route: 'mapping', label: 'Mapping' },
  { route: 'coverage', label: 'Coverage' },
  { route: 'roadmap', label: 'Roadmap' },
]

const REFERENCE: { route: Route; label: string }[] = [
  { route: 'licensing', label: 'Licensing guide' },
  { route: 'reads', label: 'What IAMAI reads' },
]

const VALID = new Set<string>([...STEPS, ...REFERENCE].map((n) => n.route))

export function useHashRoute(): Route {
  const read = (): Route => {
    const h = window.location.hash.replace(/^#\//, '')
    if (h === 'readiness') return 'scan'
    return VALID.has(h) ? (h as Route) : 'start'
  }
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const BADGE: Record<StepStatus, { className: string; text: string } | null> = {
  notStarted: null,
  inProgress: { className: 'badge progress', text: 'in progress' },
  done: { className: 'badge done', text: 'done' },
  attention: { className: 'badge attention', text: 'needs attention' },
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('iamai-theme') ?? 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('iamai-theme', theme)
    } catch {
      // storage unavailable — theme just won't persist
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function AppShell({
  account,
  tenantName,
  route,
  stepStatus,
  children,
}: {
  account: AccountInfo | null
  tenantName: string | null
  route: Route
  stepStatus: Partial<Record<Route, StepStatus>>
  children: ReactNode
}) {
  const [theme, toggleTheme] = useTheme()
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">IAMAI</span>
        <span className="tagline">Conditional Access rollout planner</span>
        <span className="topbar-tenant">
          <button onClick={toggleTheme} title="Switch between dark and light themes">
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>{' '}
          {account && (
            <>
              <strong>{tenantName ?? account.username}</strong>{' '}
              <button
                onClick={() => {
                  void forgetTenant(account.tenantId)
                    .catch(() => {})
                    .then(() => signOut())
                }}
                title="Deletes everything cached for this tenant on this device, then signs out"
              >
                Forget this tenant
              </button>
              <div className="sub">tenant {account.tenantId}</div>
            </>
          )}
        </span>
      </header>
      <div className="body-grid">
        <nav className="sidenav">
          <div className="nav-group">
            <div className="nav-group-title">Steps</div>
            {STEPS.map((n, i) => {
              const status = stepStatus[n.route] ?? 'notStarted'
              const badge = BADGE[status]
              return (
                <a key={n.route} href={`#/${n.route}`} className={route === n.route ? 'active' : ''}>
                  <span>
                    {i + 1}. {n.label}
                  </span>
                  {badge && <span className={badge.className}>{badge.text}</span>}
                </a>
              )
            })}
          </div>
          <div className="nav-group">
            <div className="nav-group-title">Reference</div>
            {REFERENCE.map((n) => (
              <a key={n.route} href={`#/${n.route}`} className={route === n.route ? 'active' : ''}>
                {n.label}
              </a>
            ))}
          </div>
        </nav>
        <main className="page">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span>
        Follow me here:{' '}
        <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
          <strong>Lachlan Robinette</strong>
        </a>
      </span>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">
        GitHub
      </a>
      <a href={REPO_URL} target="_blank" rel="noreferrer">
        Source
      </a>
    </footer>
  )
}

// Step-page framing: what the step does, what it needs, and the next step.
export function StepFrame({
  title,
  does,
  needs,
  next,
  nextLabel,
  children,
}: {
  title: string
  does: string
  needs?: { met: boolean; text: string; href?: string }[]
  next?: Route
  nextLabel?: string
  children: ReactNode
}) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="step-does">{does}</p>
      {needs && needs.length > 0 && (
        <p className="step-needs">
          Needs:{' '}
          {needs.map((n, i) => (
            <span key={i} className={n.met ? '' : 'unmet'}>
              {i > 0 && ' · '}
              {n.met ? '✓ ' : ''}
              {n.href && !n.met ? <a href={n.href}>{n.text}</a> : n.text}
            </span>
          ))}
        </p>
      )}
      {children}
      {next && (
        <p className="step-next">
          <a href={`#/${next}`}>
            <button className="primary">Next: {nextLabel}</button>
          </a>
        </p>
      )}
    </section>
  )
}
