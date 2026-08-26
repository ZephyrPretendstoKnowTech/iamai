import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth, signIn, signOut } from '../graph/msal.ts'
import { autoCheckAuthMethods } from '../graph/spikes/authMethods.ts'
import { autoCheckReports } from '../graph/spikes/reportsCheck.ts'
import { runSpike1, runSpike1Followup, runSpike1Paging, runSpike1Retest } from '../graph/spikes/spike1.ts'
import { runSpike1Extended } from '../graph/spikes/spike1Extended.ts'
import type { Spike1Results, Spike1RetestResults } from '../graph/spikes/spike1.ts'

export function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    initAuth()
      .then(setAccount)
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return <main className="page">Loading…</main>

  return (
    <main className="page">
      <h1>IAMAI</h1>
      <p className="tagline">
        Read-only Conditional Access rollout planner. Predicted impact, confirmed in report-only.
      </p>
      {authError && <p className="error">Sign-in error: {authError}</p>}
      {account ? <SignedIn account={account} /> : <SignInPage />}
    </main>
  )
}

function SignInPage() {
  return (
    <section>
      <h2>Connect your tenant</h2>
      <ul>
        <li>
          IAMAI is read-only. It never creates, edits, or deletes anything in your tenant — not
          even report-only policies.
        </li>
        <li>
          Everything runs in your browser. No server, no telemetry: review the code, then connect.
        </li>
        <li>
          Admin consent creates an enterprise app named <strong>IAMAI</strong> in your tenant. To
          remove all access later, delete that enterprise app — nothing else is left behind.
        </li>
      </ul>
      <button onClick={() => void signIn()}>Sign in with Microsoft</button>
    </section>
  )
}

function SignedIn({ account }: { account: AccountInfo }) {
  const [spike, setSpike] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    autoCheckAuthMethods()
    autoCheckReports()
  }, [])

  const run = async (which: 'original' | 'retest' | 'followup' | 'paging' | 'extended') => {
    setSpike('running')
    try {
      if (which === 'extended') {
        const x = await runSpike1Extended()
        setSummary(
          `extended: ${x.cases.length} cases — ${x.cases
            .map((c) => `${c.label.split(':')[0]}=${String(c.status)}`)
            .join(', ')}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      if (which === 'paging') {
        const p = await runSpike1Paging()
        setSummary(
          `paging: ${p.runs
            .map((r) => `${r.name}: ${r.totalItems} items / ${r.pages.length} pages / ${r.totalMs} ms`)
            .join('; ')}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      const r: Spike1Results | Spike1RetestResults =
        which === 'followup' ? await runSpike1Followup() : which === 'retest' ? await runSpike1Retest() : await runSpike1()
      const paged = r.paging
        ? `${r.paging.totalItems} sign-ins over ${r.paging.pages.length} pages in ${r.paging.totalMs} ms`
        : 'paging skipped'
      setSummary(
        `${which}: ${r.probes.length} probes; ${paged}. Saved to docs/spikes/raw/ and logged to console.`,
      )
      setSpike('done')
    } catch (e) {
      setSummary(e instanceof Error ? e.message : String(e))
      setSpike('failed')
    }
  }

  return (
    <section>
      <h2>Connected</h2>
      <p>
        Signed in as <strong>{account.username}</strong> (tenant {account.tenantId})
      </p>
      <p>
        <button onClick={() => void signOut()}>Sign out</button>
      </p>
      {import.meta.env.DEV && (
        <div className="devtools">
          <h3>Dev spikes</h3>
          <p>
            <button onClick={() => void run('extended')} disabled={spike === 'running'}>
              {spike === 'running' ? 'Running…' : 'Run spike 1 extended (cases a–g)'}
            </button>{' '}
            <button onClick={() => void run('paging')} disabled={spike === 'running'}>
              Run spike 1 paging test (no date filter)
            </button>{' '}
            <button onClick={() => void run('followup')} disabled={spike === 'running'}>
              Run spike 1 follow-up (v1-valid $select + beta)
            </button>{' '}
            <button onClick={() => void run('retest')} disabled={spike === 'running'}>
              Run spike 1 retest (interactive filter + $select)
            </button>{' '}
            <button onClick={() => void run('original')} disabled={spike === 'running'}>
              Run spike 1 (original probe set)
            </button>
          </p>
          {summary && <p className={spike === 'failed' ? 'error' : undefined}>{summary}</p>}
        </div>
      )}
    </section>
  )
}
