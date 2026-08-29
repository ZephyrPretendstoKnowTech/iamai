import { RingMark } from '../components/Ring.tsx'
import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { signOut } from '../../graph/msal.ts'
import { SHELL } from '../../copy/pages.ts'
import { STALE_SCAN_DAYS, absoluteDate, scanAgeDays, whenAt } from '../../copy/dates.ts'
import { Button, Callout, InfoTip, LinkButton, Stepper } from '../components/index.ts'
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
  | 'inventory'
  | 'baseline/package'
  | 'components'

export type StepStatus = StepperStatus

const STEPS: { route: Route; label: string }[] = [
  { route: 'start', label: SHELL.steps.start },
  { route: 'connect', label: SHELL.steps.connect },
  { route: 'baseline', label: SHELL.steps.baseline },
  { route: 'scan', label: SHELL.steps.scan },
  { route: 'mapping', label: SHELL.steps.mapping },
  { route: 'coverage', label: SHELL.steps.coverage },
  { route: 'roadmap', label: SHELL.steps.roadmap },
]

// Inventory is a tab under Scan, not a second entry point (ux-review-04 §6).
const REFERENCE: { route: Route; label: string }[] = [
  { route: 'licensing', label: SHELL.steps.licensing },
  { route: 'reads', label: SHELL.steps.reads },
]

// Pages whose main content is a table read better with the wider cap (ux-review-06 §28).
const WIDE_ROUTES = new Set<string>(['scan', 'inventory', 'reads', 'licensing'])

const VALID = new Set<string>([
  ...[...STEPS, ...REFERENCE].map((n) => n.route as string),
  'baseline/package',
  'inventory',
  ...(import.meta.env.DEV ? ['components'] : []),
])

const STEP_LINK = /^roadmap\/step\/(.+)$/

export function useHashRoute(): Route {
  const read = (): Route => {
    const h = window.location.hash.replace(/^#\//, '')
    if (h === 'readiness') return 'scan'
    if (STEP_LINK.test(h)) return 'roadmap'
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

/** Deep link to a Roadmap step: #/roadmap/step/<id> (prompt 14 §8). */
export function stepHref(stepId: string): string {
  return `#/roadmap/step/${stepId}`
}

export function useHashStepId(): string | null {
  const read = (): string | null => {
    const m = STEP_LINK.exec(window.location.hash.replace(/^#\//, ''))
    return m ? decodeURIComponent(m[1]) : null
  }
  const [id, setId] = useState<string | null>(read)
  useEffect(() => {
    const onChange = () => setId(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return id
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
      // storage unavailable: theme just won't persist
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
        <span className="wordmark">
          <RingMark size={22} />
          {SHELL.wordmark}
        </span>
        <span className="tagline">{SHELL.tagline}</span>
        <div className="topbar-right">
          {account && (
            <span className="tenant-name" title={SHELL.tenantTooltip(account.tenantId, account.username)}>
              {tenantName ?? account.username}
            </span>
          )}
          <Button size="sm" onClick={toggleTheme} title={SHELL.themeTooltip} aria-pressed={theme === 'dark'} aria-label={SHELL.themeState(theme)}>
            {theme === 'dark' ? SHELL.lightTheme : SHELL.darkTheme}
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
              title={SHELL.forgetTooltip}
            >
              {SHELL.forget}
            </Button>
          )}
        </div>
      </header>
      <div className="body-grid">
        <Stepper
          steps={STEPS.map((s) => ({ ...s, status: stepStatus[s.route] ?? 'notStarted' }))}
          reference={REFERENCE}
          active={route === 'baseline/package' ? 'baseline' : route}
        />
        <main className={`page ${WIDE_ROUTES.has(route) ? 'page-wide' : ''}`} data-route={route}>
          {account && (
            <div className="print-only muted">
              {SHELL.printHeader(tenantName ?? account.username, absoluteDate(new Date().toISOString()), account.username)}
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
      <span>{SHELL.footerLeft}</span>
      <span className="footer-links">
        <span>
          {SHELL.footerFollow}{' '}
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
            <strong>{SHELL.footerAuthor}</strong>
          </a>
        </span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          {SHELL.footerGithub}
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {SHELL.footerSource}
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
          {SHELL.needs}{' '}
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
          <span className="no-print">
            <LinkButton href={`#/${next}`}>{SHELL.next(nextLabel ?? next)}</LinkButton>
          </span>
        </p>
      )}
    </section>
  )
}

/**
 * The scan a page is based on, with a warning past STALE_SCAN_DAYS
 * (prompt 20 §9). Every page that reads the scan shows this.
 */
export function ScanAge({ at, baseline }: { at: string; baseline?: string | null }) {
  const days = scanAgeDays(at)
  return (
    <>
      <p className="reason">
        {SHELL.basedOn(whenAt(at))} <a className="no-print" href="#/scan">{SHELL.rescan}</a>
        {baseline && <> · {SHELL.baselineLoaded(baseline)}</>}
        <InfoTip title={SHELL.scanAgeTip} text={SHELL.evidenceAgeNote} />
      </p>
      {days >= STALE_SCAN_DAYS && (
        <Callout kind="warning" title={SHELL.scanStale(days)}>
          <a href="#/scan">{SHELL.scanStaleAction}</a>
        </Callout>
      )}
    </>
  )
}
