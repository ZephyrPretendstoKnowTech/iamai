import { useEffect, useState } from 'react'
import { Button } from './components/index.ts'
import { autoCheckAuthMethods } from '../graph/spikes/authMethods.ts'
import { autoCheckReports } from '../graph/spikes/reportsCheck.ts'
import { runPlatformCheck } from '../graph/spikes/platformCheck.ts'
import { runSpike1, runSpike1Followup, runSpike1Paging, runSpike1Retest } from '../graph/spikes/spike1.ts'
import type { Spike1Results, Spike1RetestResults } from '../graph/spikes/spike1.ts'
import { runAuthRequirementsSpike, runDevicesSpike, runSpike1Extended } from '../graph/spikes/spike1Extended.ts'
import { downloadSavedScanDiagnostics } from './diagnosticsDownload.ts'

// Dev-only spike harness. Rendered only in DEV builds with ?dev=1.
export function DevSpikes({ tenantId }: { tenantId: string }) {
  const [spike, setSpike] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    autoCheckAuthMethods()
    autoCheckReports()
  }, [])

  const run = async (
    which: 'original' | 'retest' | 'followup' | 'paging' | 'extended' | 'devices' | 'platform' | 'authreq',
  ) => {
    setSpike('running')
    try {
      if (which === 'authreq') {
        const a = await runAuthRequirementsSpike()
        setSummary(
          `authreq: batch=${String(a.batch.status)} in ${a.batch.ms} ms, inner=${JSON.stringify(a.innerStatuses)}, perUserMfaState=${String(a.perUserMfaStateReturned)}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      if (which === 'platform') {
        const p = await runPlatformCheck()
        setSummary(
          `platform: ${p.authenticatorMethods.length} Authenticator methods of ${Object.values(p.methodKinds).reduce((a, b) => a + b, 0)} total, allDerived=${String(p.allDerived)}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      if (which === 'devices') {
        const d = await runDevicesSpike()
        setSummary(
          `devices: ${d.totalItems} devices (${d.devicesWithOwner} with owner) over ${d.pages.length} pages in ${d.totalMs} ms — ${d.stoppedBecause}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      if (which === 'extended') {
        const x = await runSpike1Extended()
        setSummary(
          `extended: ${x.cases.length} cases — ${x.cases.map((c) => `${c.label.split(':')[0]}=${String(c.status)}`).join(', ')}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      if (which === 'paging') {
        const p = await runSpike1Paging()
        setSummary(
          `paging: ${p.runs.map((r) => `${r.name}: ${r.totalItems} items / ${r.pages.length} pages / ${r.totalMs} ms`).join('; ')}. Saved to docs/spikes/raw/.`,
        )
        setSpike('done')
        return
      }
      const r: Spike1Results | Spike1RetestResults =
        which === 'followup' ? await runSpike1Followup() : which === 'retest' ? await runSpike1Retest() : await runSpike1()
      const paged = r.paging
        ? `${r.paging.totalItems} sign-ins over ${r.paging.pages.length} pages in ${r.paging.totalMs} ms`
        : 'paging skipped'
      setSummary(`${which}: ${r.probes.length} probes; ${paged}. Saved to docs/spikes/raw/ and logged to console.`)
      setSpike('done')
    } catch (e) {
      setSummary(e instanceof Error ? e.message : String(e))
      setSpike('failed')
    }
  }

  const buttons: { key: Parameters<typeof run>[0]; label: string }[] = [
    { key: 'authreq', label: 'Run auth-requirements spike (beta $batch)' },
    { key: 'platform', label: 'Run §10.5 platform derivation check' },
    { key: 'devices', label: 'Run devices spike ($expand registeredOwners)' },
    { key: 'extended', label: 'Run spike 1 extended (cases a–g)' },
    { key: 'paging', label: 'Run spike 1 paging test (no date filter)' },
    { key: 'followup', label: 'Run spike 1 follow-up (v1-valid $select + beta)' },
    { key: 'retest', label: 'Run spike 1 retest (interactive filter + $select)' },
    { key: 'original', label: 'Run spike 1 (original probe set)' },
  ]

  return (
    <div className="devtools">
      <h3>Dev spikes</h3>
      <p>
        {/* The scan diagnostics bundle (prompt 46 item 24): per-read status and body length, no values. */}
        <Button size="sm" onClick={() => void downloadSavedScanDiagnostics(tenantId)}>
          Download scan diagnostics (last saved scan)
        </Button>
        {buttons.map((b) => (
          <span key={b.key}>
            <Button size="sm" onClick={() => void run(b.key)} disabled={spike === 'running'}>
              {b.label}
            </Button>{' '}
          </span>
        ))}
      </p>
      {summary && <p className={spike === 'failed' ? 'error' : undefined}>{summary}</p>}
    </div>
  )
}
