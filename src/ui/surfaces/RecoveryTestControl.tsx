import { useState } from 'react'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { CleanupCheckpoint, RecoveryPurpose, VerifiedRecoveryEvidence } from '../../roadmap/cleanupDone.ts'
import { RECOVERY_PREPARATION_WORKFLOW } from '../../roadmap/cleanupDone.ts'
import { Button } from '../components/index.ts'

const today = (): string => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export type RecoveryDone = (date: string, accountIds?: string[], evidence?: Pick<CleanupCheckpoint, 'outcome' | 'workflow' | 'purpose' | 'tenantId' | 'configurationObservedAt' | 'signInAtByAccount' | 'recoveryEvidence'>) => void

/** One evidence flow reused by preparation and final verification. */
export function RecoveryTestControl({ phase, purpose, onDone }: { phase: CleanupPhase; purpose: RecoveryPurpose; onDone: RecoveryDone }) {
  const [tested, setTested] = useState<string[]>([])
  const [outcome, setOutcome] = useState<'passed' | 'failed' | ''>('')
  const [selectedEvents, setSelectedEvents] = useState<Record<string, string>>({})
  const [recoveryConfirmed, setRecoveryConfirmed] = useState<Record<string, boolean>>({})
  const [credentialConfirmed, setCredentialConfirmed] = useState<Record<string, boolean>>({})
  const [failedOn, setFailedOn] = useState(today)
  const preparedAt = purpose === 'final' ? phase.configurationObservedAtByAccount : phase.preChangeConfigurationObservedAtByAccount
  const candidates = purpose === 'final' ? phase.recoveryCandidates : phase.preChangeRecoveryCandidates
  const preparationCurrent = phase.accountIds.length > 0 && phase.accountIds.every(id => !!preparedAt?.[id])
  const configurationReady = phase.accountIds.length > 0 && phase.accountIds.every(id => !!phase.accountBasis?.[id]) && (purpose === 'pre-change' || phase.recoveryFindings?.find(finding => finding.key === 'recovery-configuration')?.outcome === 'pass')
  const evidence = (): Record<string, VerifiedRecoveryEvidence> => Object.fromEntries(tested.flatMap(id => {
    const reading = (candidates?.[id] ?? []).find(item => item.qualifies && item.candidate.eventId === selectedEvents[id])
    const configurationObservedAt = preparedAt?.[id] ?? null
    if (!reading || !phase.tenantId || !configurationObservedAt || recoveryConfirmed[id] !== true || credentialConfirmed[id] !== true) return []
    const candidate = reading.candidate
    if (Date.parse(candidate.at) < Date.parse(configurationObservedAt) || !phase.snapshotObservedAt || Date.parse(phase.snapshotObservedAt) < Date.parse(candidate.at)) return []
    return [[id, { schema: 1, purpose, tenantId: phase.tenantId, accountId: id, eventId: candidate.eventId, eventAt: candidate.at, appId: candidate.appId, resourceId: candidate.resourceId, method: 'Passkey (FIDO2)', provenance: 'observed-sign-in', recoveryConfirmed: true, credentialConfirmed: true, configurationObservedAt } satisfies VerifiedRecoveryEvidence]]
  }))
  const passReady = tested.length > 0 && tested.every(id => !!evidence()[id])
  const save = (): void => {
    if (!outcome || !tested.length) return
    if (outcome === 'failed') { onDone(failedOn, tested, { outcome, purpose }); return }
    const recoveryEvidence = evidence()
    if (Object.keys(recoveryEvidence).length !== tested.length) return
    const eventDate = Object.values(recoveryEvidence).map(item => item.eventAt).sort().at(-1)!.slice(0, 10)
    onDone(eventDate, tested, { outcome, purpose, recoveryEvidence, signInAtByAccount: Object.fromEntries(Object.entries(recoveryEvidence).map(([id, item]) => [id, item.eventAt])) })
  }
  return <div className="recovery-test-control">
    <h4>{purpose === 'final' ? 'Final verification' : 'Pre-change recovery test'}</h4>
    <Button variant="secondary" disabled={!configurationReady || preparationCurrent || !phase.tenantId || !phase.snapshotObservedAt} onClick={() => onDone(today(), phase.accountIds, { workflow: RECOVERY_PREPARATION_WORKFLOW, purpose, tenantId: phase.tenantId, configurationObservedAt: phase.snapshotObservedAt })}>Record configuration and begin test</Button>
    <p className="reason">{preparationCurrent ? 'Configuration recorded. Perform a fresh separate-session sign-in, then scan again.' : 'Record the current configuration before the sign-in. An older event cannot certify a later checkpoint.'}</p>
    <fieldset><legend>Accounts tested</legend>{phase.accountIds.length === 0 ? <p>Select and save an emergency account first.</p> : phase.accountIds.map((id, index) => {
      const readings = candidates?.[id] ?? []
      const qualifying = preparedAt?.[id] ? readings.filter(reading => reading.qualifies) : []
      const label = phase.rows.find(row => row.kind === 'drill')?.lists.emergencyAccounts?.[index] ?? id
      return <div key={id} className="decision-fields"><label className="option-value"><input type="checkbox" checked={tested.includes(id)} onChange={event => { const checked = event.currentTarget.checked; setTested(ids => checked ? [...new Set([...ids, id])] : ids.filter(item => item !== id)); if (!checked) { setSelectedEvents(values => { const next = { ...values }; delete next[id]; return next }); setCredentialConfirmed(values => ({ ...values, [id]: false })); setRecoveryConfirmed(values => ({ ...values, [id]: false })) } }} />{label}</label>{tested.includes(id) && <>
        <label><strong>Observed recovery sign-in</strong><select value={selectedEvents[id] ?? ''} onChange={event => { const value = event.currentTarget.value; setSelectedEvents(values => ({ ...values, [id]: value })) }}><option value="">Choose the exact event…</option>{qualifying.map(({ candidate }) => <option key={candidate.eventId} value={candidate.eventId}>{new Date(candidate.at).toLocaleString()} · {candidate.resource ?? candidate.resourceId ?? 'Administrative resource'} · {candidate.method}</option>)}</select></label>
        {qualifying.length === 0 && <p className="reason">{!preparedAt?.[id] ? 'Record configuration and begin the test first.' : readings[0]?.reason ?? 'No qualifying fresh administrative passkey sign-in was found. Sign in, then scan again.'}</p>}
        <label className="choice"><input type="checkbox" checked={credentialConfirmed[id] ?? false} onChange={event => { const checked = event.currentTarget.checked; setCredentialConfirmed(values => ({ ...values, [id]: checked })) }} />I used the prepared credential for this account.</label>
        <label className="choice"><input type="checkbox" checked={recoveryConfirmed[id] ?? false} onChange={event => { const checked = event.currentTarget.checked; setRecoveryConfirmed(values => ({ ...values, [id]: checked })) }} />I retrieved it through the approved process and confirmed non-destructive administrative access in the correct tenant.</label>
      </>}</div>
    })}</fieldset>
    <label><strong>Test result</strong><select value={outcome} onChange={event => { const value = event.currentTarget.value as typeof outcome; setOutcome(value) }}><option value="">Choose…</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
    {outcome === 'failed' && <label><strong>Attempt date</strong><input type="date" max={today()} value={failedOn} onChange={event => { const value = event.currentTarget.value; setFailedOn(value) }} /></label>}
    <Button variant="secondary" disabled={!outcome || !tested.length || outcome === 'passed' && !passReady} onClick={save}>{outcome === 'failed' ? 'Record Failed Attempt' : 'Save Verified Recovery'}</Button>
  </div>
}
