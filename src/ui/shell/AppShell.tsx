// The shell (prompt 47 Part 3, target-state §2): one 48px header with a
// hairline, and the page. No sidebar, no stepper, no statuses, no "Needs" or
// "Next" framing. Signed out, the header is the wordmark and the theme control;
// signed in it adds the tenant name, the Today and Plan tabs (enabled once a
// scan exists), Re-scan with the scan's age, the Recovery card link and the
// Account menu.
import { useEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { signOut } from '../../graph/msal.ts'
import { SHELL } from '../../copy/pages.ts'
import { exitDemoUrl, isDemo } from '../demo.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { FeedbackPanel } from '../FeedbackPanel.tsx'
import { STALE_SCAN_DAYS, absoluteDate, scanAgeDays, whenAt } from '../../copy/dates.ts'
import { scanAge } from '../../derive/scanAge.ts'
import { Button, Callout, InfoTip, LinkButton } from '../components/index.ts'
import { RingMark } from '../components/Ring.tsx'

export const LINKEDIN_URL = 'https://www.linkedin.com/in/lachlanrobinette/'
export const GITHUB_URL = 'https://github.com/ZephyrPretendstoKnowTech'
export const REPO_URL = 'https://github.com/ZephyrPretendstoKnowTech/iamai'
/** The home page this tool sits under (prompt 35 §3). */
export const HOME_URL = 'https://getiamai.com/'

/**
 * Routes (target-state §2). `home` is the empty hash: App sends it to Plan when
 * a scan exists and to Connect otherwise. The old page names redirect. Plan,
 * Export and How arrive in prompts 48 and 49; until then #/plan opens the
 * Roadmap, and the reference pages keep their old names.
 */
export type Route =
  | 'home'
  | 'connect'
  | 'today'
  | 'inventory'
  | 'recovery'
  | 'mapping'
  | 'coverage'
  | 'roadmap'
  | 'roadmap/prompts'
  | 'licensing'
  | 'reads'
  | 'checks'
  | 'naming'
  | 'baseline/package'
  | 'components'

/** Where the shell is (target-state §2): it decides the tabs, Re-scan, and where an empty hash lands. */
export type ShellState = 'signedOut' | 'noScan' | 'scanning' | 'scanned'

/** The Plan tab's target until prompt 48 lands the Plan surface. */
export const PLAN_ROUTE: Route = 'roadmap'
export const PLAN_HREF = `#/${PLAN_ROUTE}`
/** Re-scan's target until prompt 47 Part 4 moves the scan to Connect. */
const RESCAN_HREF = '#/today'

const REDIRECT: Record<string, Route> = {
  start: 'connect',
  baseline: 'connect',
  scan: 'today',
  readiness: 'today',
  plan: PLAN_ROUTE,
}

const VALID = new Set<string>([
  'connect',
  'today',
  'inventory',
  'recovery',
  'mapping',
  'coverage',
  'roadmap',
  'roadmap/prompts',
  'licensing',
  'reads',
  'checks',
  'naming',
  'baseline/package',
  ...(import.meta.env.DEV ? ['components'] : []),
])

// Pages whose main content is a table read better with the wider cap.
const WIDE_ROUTES = new Set<Route>(['today', 'inventory', 'reads', 'licensing', 'checks'])

const STEP_LINK = /^roadmap\/step\/(.+)$/

/** The route a hash names, and the hash to show instead when the name is an old one. */
export function resolveHash(hash: string): { route: Route; redirect: string | null } {
  const h = hash.replace(/^#\/?/, '')
  if (h === '') return { route: 'home', redirect: null }
  if (STEP_LINK.test(h)) return { route: 'roadmap', redirect: null }
  const to = REDIRECT[h]
  if (to) return { route: to, redirect: `#/${to}` }
  if (VALID.has(h)) return { route: h as Route, redirect: null }
  return { route: 'connect', redirect: '#/connect' }
}

export function useHashRoute(): Route {
  const read = (): Route => {
    const { route, redirect } = resolveHash(window.location.hash)
    if (redirect) window.history.replaceState(null, '', redirect)
    return route
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

function systemTheme(): string {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('iamai-theme') ?? systemTheme()
    } catch {
      return systemTheme()
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

function Tab({ href, active, enabled, children }: { href: string; active: boolean; enabled: boolean; children: ReactNode }) {
  if (!enabled) {
    return (
      <a className="tab" href={href} aria-disabled="true" title={SHELL.tabsAfterScan} onClick={(e) => e.preventDefault()}>
        {children}
      </a>
    )
  }
  return (
    <a className={`tab ${active ? 'active' : ''}`} href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  )
}

function AccountMenu({ account }: { account: AccountInfo }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <Button variant="tertiary" aria-haspopup="menu" aria-expanded={open} title={SHELL.accountTooltip(account.username)} onClick={() => setOpen((o) => !o)}>
        {SHELL.account}
      </Button>
      {open && (
        <div className="menu-list" role="menu">
          <Button variant="tertiary" role="menuitem" onClick={() => void signOut()}>
            {SHELL.signOut}
          </Button>
          <Button
            variant="tertiary"
            role="menuitem"
            title={SHELL.forgetTooltip}
            onClick={() => {
              void forgetTenant(account.tenantId)
                .catch(() => {})
                .then(() => signOut())
            }}
          >
            {SHELL.forget}
          </Button>
        </div>
      )}
    </div>
  )
}

export function AppShell({
  account,
  tenantName,
  route,
  state,
  scannedAt = null,
  snapshot = null,
  children,
}: {
  account: AccountInfo | null
  tenantName: string | null
  route: Route
  state: ShellState
  /** When the scan the pages read was taken; the header shows its age. */
  scannedAt?: string | null
  /** Only for the feedback summary, which is counts and never names. */
  snapshot?: TenantSnapshot | null
  children: ReactNode
}) {
  const [theme, toggleTheme] = useTheme()
  const signedIn = account !== null && state !== 'signedOut'
  const tabsOn = state === 'scanned'
  const todayActive = route === 'today' || route === 'inventory'
  const planActive = route === 'roadmap' || route === 'roadmap/prompts' || route === 'mapping' || route === 'coverage'
  return (
    <div className="shell">
      <header className="app">
        <a className="wordmark" href={tabsOn ? PLAN_HREF : '#/connect'}>
          <RingMark size={18} />
          {SHELL.wordmark}
        </a>
        {signedIn && <span className="tenant">{tenantName ?? account.username}</span>}
        {signedIn && (
          <nav aria-label={SHELL.navLabel}>
            <Tab href="#/today" active={todayActive} enabled={tabsOn}>
              {SHELL.tabs.today}
            </Tab>
            <Tab href={PLAN_HREF} active={planActive} enabled={tabsOn}>
              {SHELL.tabs.plan}
            </Tab>
          </nav>
        )}
        <div className="right">
          {signedIn && tabsOn && scannedAt && (
            <Button
              variant="tertiary"
              onClick={() => {
                window.location.hash = RESCAN_HREF
              }}
            >
              {SHELL.rescanScanned(scanAge(scannedAt))}
            </Button>
          )}
          {signedIn && <a href="#/recovery">{SHELL.recovery}</a>}
          <Button variant="tertiary" onClick={toggleTheme} title={SHELL.themeTooltip}>
            {theme === 'dark' ? SHELL.lightTheme : SHELL.darkTheme}
          </Button>
          {signedIn && <AccountMenu account={account} />}
        </div>
      </header>
      {isDemo() && (
        <p className="demo-banner" role="status">
          {SHELL.demoBanner} <a href={exitDemoUrl()}>{SHELL.demoLeave}</a>
        </p>
      )}
      <main className={`page ${WIDE_ROUTES.has(route) ? 'page-wide' : ''}`} data-route={route}>
        {signedIn && (
          <div className="print-only muted">
            {SHELL.printHeader(tenantName ?? account.username, absoluteDate(new Date().toISOString()), account.username)}
          </div>
        )}
        {children}
      </main>
      <Footer snapshot={snapshot ?? null} />
    </div>
  )
}

/**
 * The commit and day this bundle was built (prompt 40 §24).
 *
 * Seven consecutive red CI runs went unnoticed across prompts 36 to 39, and a
 * reviewer looking at the live site had no way to tell whether they were seeing
 * the deploy they expected. A stale bundle and a fresh one look identical
 * without this.
 */
const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev'
const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''

export function Footer({ snapshot = null }: { snapshot?: TenantSnapshot | null } = {}) {
  const buildLabel = SHELL.footerBuild(BUILD_COMMIT, absoluteDate(`${BUILD_DATE}T12:00:00.000Z`))
  return (
    <footer className="app">
      <span>{SHELL.footerLeft}</span>
      <span className="footer-links">
        {/* Quiet, on every page (prompt 34 §2). */}
        <FeedbackPanel snapshot={snapshot} />
        <a href={HOME_URL}>{SHELL.footerHome}</a>
        <span>
          {SHELL.footerFollow}{' '}
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
            <strong>{SHELL.footerAuthor}</strong>
          </a>
        </span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          {SHELL.footerGithub}
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {SHELL.footerSource}
        </a>
        {BUILD_COMMIT === 'dev' ? (
          <span className="footer-build">{buildLabel}</span>
        ) : (
          <a
            className="footer-build"
            href={`${REPO_URL}/commit/${BUILD_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            title={SHELL.footerBuildTitle}
          >
            {buildLabel}
          </a>
        )}
      </span>
    </footer>
  )
}

// Step-page framing for the pages that wait for prompts 48 and 49: what the
// step does, what it needs, and the next step. New surfaces do not use it.
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
  next?: string
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
 * (prompt 20 §9). Every legacy page that reads the scan shows this.
 */
export function ScanAge({ at, baseline }: { at: string; baseline?: string | null }) {
  const days = scanAgeDays(at)
  return (
    <>
      <p className="reason">
        {SHELL.basedOn(whenAt(at))} <a className="no-print" href={RESCAN_HREF}>{SHELL.rescan}</a>
        {baseline && <> · {SHELL.baselineLoaded(baseline)}</>}
        <InfoTip title={SHELL.scanAgeTip} text={SHELL.evidenceAgeNote} />
      </p>
      {days >= STALE_SCAN_DAYS && (
        <Callout kind="warning" title={SHELL.scanStale(days)}>
          <a href={RESCAN_HREF}>{SHELL.scanStaleAction}</a>
        </Callout>
      )}
    </>
  )
}
