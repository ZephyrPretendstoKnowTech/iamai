import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { signOut } from '../../graph/msal.ts'
import { Button, LinkButton, Stepper } from '../components/index.ts'
import type { StepperStatus } from '../components/index.ts'

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
  | 'components'

export type StepStatus = StepperStatus

const STEPS: { route: Route; label: string }[] = [
  { route: 'start', label: 'Start' },
  { route: 'connect', label: 'Connect' },
  { route: 'baseline', label: 'Baseline' },
  { route: 'scan', label: 'Scan' },
  { route: 'mapping', label: 'Setup' },
  { route: 'coverage', label: 'Findings' },
  { route: 'roadmap', label: 'Roadmap' },
]

const REFERENCE: { route: Route; label: string }[] = [
  { route: 'licensing', label: 'Licensing guide' },
  { route: 'reads', label: 'What IAMAI reads' },
]

const VALID = new Set<string>([...STEPS, ...REFERENCE].map((n) => n.route).concat('components'))

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
        <div className="topbar-right">
          {account && (
            <span className="tenant-name" title={`Tenant ID ${account.tenantId} · signed in as ${account.username}`}>
              {tenantName ?? account.username}
            </span>
          )}
          <Button size="sm" onClick={toggleTheme} title="Switch between dark and light themes">
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </Button>
          {account && (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                void forgetTenant(account.tenantId)
                  .catch(() => {})
                  .then(() => signOut())
              }}
              title="Deletes everything IAMAI stored for this tenant on this device, then signs out"
            >
              Forget this tenant
            </Button>
          )}
        </div>
      </header>
      <div className="body-grid">
        <Stepper
          steps={STEPS.map((s) => ({ ...s, status: stepStatus[s.route] ?? 'notStarted' }))}
          reference={REFERENCE}
          active={route}
        />
        <main className="page">
          {account && (
            <div className="print-only muted">
              IAMAI plan for {tenantName ?? account.username} · prepared {new Date().toLocaleDateString()} by{' '}
              {account.username}
            </div>
          )}
          {children}
        </main>
      </div>
      <Footer />
    </div>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <span>Read-only · nothing leaves your browser</span>
      <span className="footer-links">
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
      </span>
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
          <LinkButton href={`#/${next}`}>Next: {nextLabel}</LinkButton>
        </p>
      )}
    </section>
  )
}
