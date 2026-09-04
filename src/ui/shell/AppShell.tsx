// The shell (prompt 47 Part 3, target-state §2): one 48px header with a
// hairline, and the page. No sidebar, no stepper, no statuses, no "Needs" or
// "Next" framing. Signed out, the header is the wordmark and the theme control;
// signed in it adds the Today, Plan and Export tabs (enabled once a scan
// exists) and the Account menu. No scan control and no scan age: the scan runs
// from Connect, which alone shows the tenant and when it was scanned
// (docs/design/connect-mockup.html). The brand links to Connect.
import { useEffect, useRef, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { clearAuthCache, signOut } from '../../graph/auth.ts'
import { fillText } from '../../content/render.ts'
import { app, pages, planner } from '../../content/content.ts'
import { exitDemoUrl, isDemo } from '../demoMode.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { Button, LinkButton } from '../components/index.ts'
import { RingMark } from '../components/Ring.tsx'
import { PLAN_HREF, STEP_LINK, resolveHash } from './routes.ts'
import type { Route } from './routes.ts'

export { PLAN_HREF, PLAN_ROUTE, resolveHash } from './routes.ts'
export type { Route } from './routes.ts'

// Pages whose main content is a table read better with the wider cap.
const WIDE_ROUTES = new Set<Route>(['today', 'inventory', 'how'])

export const REPO_URL = 'https://github.com/ZephyrPretendstoKnowTech/iamai'

/** Where the shell is (target-state §2): it decides the tabs and where an empty hash lands. */
export type ShellState = 'signedOut' | 'noScan' | 'scanning' | 'scanned'

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

// The demo keeps its own theme key, so it never reads or writes the real theme
// choice, and leaving the demo restores whatever was there before (prompt 50 item 13).
// One theme preference across the home page, the demo and the signed-in app
// (walk-51 item 19): the theme is a per-viewer UI choice, not tenant data, so it
// shares the home page's key rather than the demo keeping its own.
const THEME_KEY = 'iamai-theme'

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem(THEME_KEY) ?? systemTheme()
    } catch {
      return systemTheme()
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // storage unavailable: theme just won't persist
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

const SHELL = app.shell

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
      {/* Text, not a button face (docs/design/connect-mockup.html's header): the menu it opens keeps its buttons. */}
      <button type="button" className="text-control" aria-haspopup="menu" aria-expanded={open} title={fillText(SHELL.accountTooltip, { username: account.username })} onClick={() => setOpen((o) => !o)}>
        {SHELL.account}
      </button>
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
                .then(() => {
                  // Clear MSAL's own local cache too, so forgetting leaves no trace
                  // even after the sign-in button warmed MSAL up (prompt 50.1 item 7).
                  return clearAuthCache().then(() => signOut())
                })
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
  snapshot = null,
  demoWeek2 = false,
  children,
}: {
  account: AccountInfo | null
  tenantName: string | null
  route: Route
  state: ShellState
  /** The demo is showing its week-two snapshot: the banner says so (prompt 50 item 14). */
  demoWeek2?: boolean
  /** Only for the feedback summary, which is counts and never names. */
  snapshot?: TenantSnapshot | null
  children: ReactNode
}) {
  const [theme, toggleTheme] = useTheme()
  const signedIn = account !== null && state !== 'signedOut'
  const tabsOn = state === 'scanned'
  const todayActive = route === 'today' || route === 'inventory'
  const exportActive = route === 'export'
  const planActive = route === 'plan'
  return (
    <div className="shell">
      <header className="app">
        <a className="wordmark" href="#/connect">
          <RingMark size={18} />
          {planner.name}
        </a>
        {signedIn && (
          <nav aria-label={SHELL.navLabel}>
            <Tab href="#/today" active={todayActive} enabled={tabsOn}>
              {SHELL.tabs.today}
            </Tab>
            <Tab href={PLAN_HREF} active={planActive} enabled={tabsOn}>
              {SHELL.tabs.plan}
            </Tab>
            <Tab href="#/export" active={exportActive} enabled={tabsOn}>
              {SHELL.tabs.export}
            </Tab>
          </nav>
        )}
        <div className="right">
          {/* The theme and Account controls are text, not button faces (docs/design/connect-mockup.html's header). */}
          <button type="button" className="text-control" onClick={toggleTheme} title={SHELL.themeTooltip}>
            {theme === 'dark' ? SHELL.lightTheme : SHELL.darkTheme}
          </button>
          {signedIn && <AccountMenu account={account} />}
        </div>
      </header>
      {isDemo() && (
        <p className="demo-banner" role="status">
          {demoWeek2 ? SHELL.demoBannerWeek2 : SHELL.demoBanner} · <a href={exitDemoUrl()}>{SHELL.demoLeave}</a>
        </p>
      )}
      <main className={`page ${WIDE_ROUTES.has(route) ? 'page-wide' : ''}`} data-route={route}>
        {signedIn && (
          <div className="print-only muted">
            {fillText(SHELL.printHeader, { tenant: tenantName ?? account.username, date: absoluteDate(new Date().toISOString()), by: account.username })}
          </div>
        )}
        {children}
      </main>
      <Footer />
    </div>
  )
}

/** The four links, separated by |, on every page (docs/design/mockups/today-v2.html): the home page, the author, the source, the feedback address. A web link opens in a new tab; the mail link opens the mail client. */
export function Footer() {
  const footer = pages.footer as { links: { text: string; href: string }[] }
  return (
    <footer className="app">
      <span className="footer-links">
        {footer.links.map((l, i) => (
          <span key={l.href}>
            {i > 0 && ' | '}
            {l.href.startsWith('mailto:') ? (
              <a href={l.href}>{l.text}</a>
            ) : (
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.text}
              </a>
            )}
          </span>
        ))}
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
            <LinkButton href={`#/${next}`}>{fillText(SHELL.next, { label: nextLabel ?? next })}</LinkButton>
          </span>
        </p>
      )}
    </section>
  )
}
