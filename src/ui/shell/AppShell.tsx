import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { ReactNode } from 'react'
import { forgetTenant } from '../../graph/collect/cache.ts'
import { signOut } from '../../graph/msal.ts'

// Footer links. LINKEDIN_URL is still the prompt's placeholder — replace when
// provided; the GitHub profile is derived from the repo owner.
const LINKEDIN_URL: string | null = null // TODO: set to Lachlan's LinkedIn profile URL
const GITHUB_URL = 'https://github.com/ZephyrPretendstoKnowTech'
const REPO_URL = 'https://github.com/ZephyrPretendstoKnowTech/iamai'

export type Route =
  | 'baseline'
  | 'connect'
  | 'mapping'
  | 'coverage'
  | 'readiness'
  | 'roadmap'
  | 'licensing'
  | 'reads'

// Left navigation in flow order; placeholders are pages that exist but only
// describe what they will show.
const NAV: { route: Route; label: string; live: boolean }[] = [
  { route: 'baseline', label: 'Baseline', live: true },
  { route: 'connect', label: 'Connect', live: true },
  { route: 'mapping', label: 'Mapping', live: false },
  { route: 'coverage', label: 'Coverage', live: false },
  { route: 'readiness', label: 'Readiness', live: true },
  { route: 'roadmap', label: 'Roadmap', live: false },
  { route: 'licensing', label: 'Licensing guide', live: false },
  { route: 'reads', label: 'What IAMAI reads', live: true },
]

const VALID = new Set(NAV.map((n) => n.route))

export function useHashRoute(): Route {
  const read = (): Route => {
    const h = window.location.hash.replace(/^#\//, '')
    return VALID.has(h as Route) ? (h as Route) : 'baseline'
  }
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function AppShell({
  account,
  route,
  children,
}: {
  account: AccountInfo | null
  route: Route
  children: ReactNode
}) {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">IAMAI</span>
        <span className="tagline">Conditional Access rollout planner</span>
        {account && (
          <span className="topbar-tenant">
            {account.name ?? account.username}
            <br />
            tenant {account.tenantId}{' '}
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
          </span>
        )}
      </header>
      <div className="body-grid">
        <nav className="sidenav">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={`#/${n.route}`}
              className={`${route === n.route ? 'active' : ''} ${n.live ? '' : 'placeholder'}`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <main className="page">{children}</main>
      </div>
      <footer className="footer">
        <span>
          Built by Lachlan Robinette
          {LINKEDIN_URL !== null && (
            <>
              {' · '}
              <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </>
          )}
          {' · '}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source code
        </a>
        <span>Read-only. Review the code, then connect.</span>
      </footer>
    </div>
  )
}
