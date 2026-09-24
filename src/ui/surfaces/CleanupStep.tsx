import type { CleanupCheckpoint } from '../../roadmap/cleanupDone.ts'
import { validCompletionDate } from '../../roadmap/cleanupDone.ts'
// A Cleanup row's body (target-state §5; prompt 52 Part 3): Why, What to do and
// Done when from content.cleanup, filled with the tenant's lists, shared by the
// Plan (opened in place) and the print (every step in full). A line with a hole
// is dropped (walk-51 item 2). The live controls (E3): Done records the row's
// date in the plan's checkpoints; the not-assessed row takes a per-policy
// "does not apply" note with its reason, stored in the plan file.
//
// It draws its sections with the step components and the one heading source
// (task 011), so a Cleanup row reads as the same kind of thing as a step rather
// than as a page that happens to sit under the same board.
import { useMemo, useState } from 'react'
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { app } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
// The scan time in the plan's format and display zone, as every other printed date (copy/dates.ts).
import { absolute } from '../../copy/dates.ts'
import { Button, Picker } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import { AuthoredText, DoneWhen, ReadinessSection, StepActionColumn, StepFooter, StepHead, StepSection } from './StepSections.tsx'
import type { ReadinessTile } from './stepContract.ts'
import { HEAD, TASK_HEAD } from './stepHeadings.ts'
import { CONTRACT, milestoneHeadlineOf } from './stepContract.ts'
import { groupOf } from '../../roadmap/stepGroups.ts'
import { cleanupEntry, cleanupVars, cleanupWhen, EMERGENCY_RECOVERY_PROCEDURE } from './cleanupExport.ts'
import { EmergencySubjectReadiness, Implementation, copyImplementationArtifact } from './ContentStep.tsx'
import type { Artifact, Channel } from './stepBody.ts'
import { emergencyVerificationAiInfo, emergencyVerificationJson, emergencyVerificationPowerShell, emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'
import { consolidateEmergencyReadiness, recoverySubjectsOf } from './emergencyReadiness.ts'

export { cleanupEntry, cleanupVars, cleanupWhen } from './cleanupExport.ts'
export type { CleanupEntry } from './cleanupExport.ts'

const A = app.plan

/** Verify Emergency Access's Next milestone while it is open: the words its action column has always carried. */
const DRILL_MILESTONE = 'Verify every selected account after the final configuration is observed.'

/** Today as the Done control's default, in the display zone's calendar day shape. */
function todayDate(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function CleanupBody({ phase, row, status, onScan, onDone }: {
  phase: CleanupPhase
  row: CleanupPhase['rows'][number]
  /**
   * The row's lane label and tone, and, where the caller draws no row above the
   * body (the printed plan), what the board says it waits for (LaneView.waitingFor).
   */
  status: { word: string; tone: StatusTone; waitingFor?: string | null }
  /** The live controls; absent when printing. */
  onScan?: () => void
  /** Done: record the date (YYYY-MM-DD) in the plan's checkpoints. */
  onDone?: (date: string, accountIds?: string[], evidence?: Pick<CleanupCheckpoint, 'outcome' | 'recipient' | 'workflow' | 'purpose' | 'tenantId' | 'configurationObservedAt' | 'signInAtByAccount' | 'recoveryEvidence' | 'replacementPolicyId' | 'retiredPolicyIds' | 'coverageVerified' | 'replacementBasis' | 'reference' | 'policyNames' | 'consolidationDecision' | 'retainedPolicyIds' | 'retainedPolicyBases' | 'rationale' | 'namingChanges' | 'toolingVerified'>) => void
}) {
  const entry = cleanupEntry(row.kind)
  const [outcome, setOutcome] = useState<'passed' | 'failed' | ''>('')
  const [recipient, setRecipient] = useState('')
  const [consolidationDecision, setConsolidationDecision] = useState<'retire' | 'retain-both'>('retire')
  const [rationale, setRationale] = useState('')
  const [toolingVerified, setToolingVerified] = useState(false)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const namingProposals = (phase.namingProposals ?? []).map(p => ({ ...p, to: nameDrafts[p.id] ?? p.to }))
  for (const p of namingProposals) p.collision = !p.to.trim() || (phase.policyOptions ?? []).some(other => other.id !== p.id && other.name.trim().toLowerCase() === p.to.trim().toLowerCase()) || namingProposals.some(other => other.id !== p.id && other.to.trim().toLowerCase() === p.to.trim().toLowerCase())
  const [replacementId, setReplacementId] = useState('')
  const [retiredIds, setRetiredIds] = useState<string[]>([])
  const [coverageVerified, setCoverageVerified] = useState(false)
  const [reference, setReference] = useState('')
  const [policyQuery, setPolicyQuery] = useState('')
  const policyOptions = phase.policyOptions ?? []
  const recordedAccounts = (row.record?.accountIds ?? []).map(id => {
    const index = phase.accountIds.indexOf(id)
    return index < 0 ? id : row.lists.emergencyAccounts?.[index] ?? row.lists.emergencyAccountUpns?.[index] ?? id
  })
  const replacement = policyOptions.find(policy => policy.id === replacementId)
  const allCandidatesCovered = (phase.consolidationCandidateIds ?? []).every(id => retiredIds.includes(id) || consolidationDecision === 'retire' && id === replacementId)
  const consolidationReady = allCandidatesCovered && (consolidationDecision === 'retain-both' ? retiredIds.length >= 2 && !!rationale.trim() && retiredIds.every(id => !!policyOptions.find(p => p.id === id)?.basis) : !!replacement?.basis && retiredIds.length > 0 && coverageVerified && !retiredIds.includes(replacementId))
  const [date, setDate] = useState(todayDate)
  const [implementationChannel, setImplementationChannel] = useState<Channel | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [implementationOpen, setImplementationOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const ex = cleanupVars(phase, row)
  const whole = (line: string): boolean => missingVars(line, ex).length === 0
  const verificationTasks = useMemo(() => emergencyVerificationTasksOf(phase), [phase])
  const recoveryTiles = (phase.recoveryFindings ?? []).flatMap(finding => {
    const passed = finding.items?.filter(item => item.outcome === 'pass') ?? []
    const pending = finding.items?.filter(item => item.outcome !== 'pass') ?? []
    const tiles: ReadinessTile[] = []
    if (finding.outcome !== 'pass' || pending.length > 0) tiles.push({ key: finding.key, label: finding.label, value: finding.value, note: finding.detail || null, items: finding.items?.length ? pending : finding.items, link: finding.link, tone: 'warn', structuredItems: true })
    if (finding.outcome === 'pass' || passed.length > 0) tiles.push({ key: `${finding.key}:satisfied`, label: finding.label, value: finding.outcome === 'pass' ? finding.value : `${passed.length} completed`, note: null, items: passed.length ? passed : finding.items, tone: 'good', structuredItems: true })
    return tiles
  })
  const recoveryReadiness = consolidateEmergencyReadiness({ tiles: recoveryTiles.filter(t => t.tone !== 'good'), satisfied: recoveryTiles.filter(t => t.tone === 'good'), bar: { key: 'recovery', main: row.done ? 'Current recovery verification recorded' : 'Complete the configuration findings, then verify recovery for each account.' } }, verificationTasks, new Map(Object.entries(phase.accountUpnsById ?? {})), !onDone)
  // Interactive Tasks Remaining (the Step 1 tile standard); print keeps the source findings split as above.
  const recoverySubjects = useMemo(() => recoverySubjectsOf(phase.recoveryFindings ?? [], verificationTasks, new Map(Object.entries(phase.accountUpnsById ?? {}))), [phase, verificationTasks])
  const verificationArtifacts = useMemo<Artifact[]>(() => [
    { id: 'portal', form: 'markdown', lines: [], text: () => '', note: null },
    { id: 'ps', form: 'code', lines: [], text: () => emergencyVerificationPowerShell(phase), note: 'Read-only Microsoft Graph sign-in inspection.' },
    { id: 'json', form: 'code', lines: [], text: () => emergencyVerificationJson(phase), note: 'Evidence and context only; not a Graph write payload.' },
    { id: 'ai', form: 'markdown', lines: [], text: () => emergencyVerificationAiInfo(phase), note: null },
  ], [phase])
  // Every hook above runs on every render (Rules of Hooks); a row with no content entry renders nothing.
  if (!entry) return null
  // The recovery drill is Establish Emergency Access's fourth step (1.4), and it
  // is drawn as the other three are (owner, 2026-09-23: "Uniformity is a BIG
  // deal"): the step-type eyebrow over its title, the task-step headings in the
  // same order, the action column with its Next milestone on the inset surface
  // down the whole body, and the one footer strip with the Scan. The other
  // Cleanup rows keep their default headings and one column — the owner left
  // the Cleanup rows out of the 2026-09-19 uniformity rule, and a Cleanup row is
  // a board row rather than a step — and close on the same footer.
  const drill = row.kind === 'drill'
  const taskHead = row.kind === 'drill' ? TASK_HEAD : null
  const doneWhen = entry.doneWhen.filter(whole)
  const copyArtifact = (id: string, value: string): void => { void copyImplementationArtifact(value).then(ok => { setCopied(ok ? id : 'copy-failed'); setTimeout(() => setCopied(null), ok ? 1500 : 6000) }) }
  const head = <StepHead eyebrow={drill ? CONTRACT.kind.check : null} title={entry.title} badge={status.word} tone={status.tone} sub={status.waitingFor ? <p className="reason">{status.waitingFor}</p> : null} />
  const why = (
    <StepSection heading={taskHead?.why ?? HEAD.why}>
      <p>
        {fillText(entry.why, ex)}{' '}
        {entry.learn?.url && (
          <a href={entry.learn.url} target="_blank" rel="noopener noreferrer">
            Learn →
          </a>
        )}
      </p>
    </StepSection>
  )
  const done = <DoneWhen heading={taskHead?.doneWhen ?? HEAD.doneWhen} lines={doneWhen.map((l) => fillText(l, ex))} />
  const recorded = row.record && (row.kind !== 'drill' || row.record.outcome) && <section className="step-section"><h4>{row.kind === 'naming' || row.kind === 'consolidation' ? 'Recorded Review' : 'Recorded Test'}</h4><p>{row.record.date.slice(0, 10)} · {row.record.consolidationDecision === 'retain-both' ? 'Retain Both' : row.record.outcome === 'passed' ? 'Passed' : row.record.outcome === 'failed' ? 'Failed' : 'Outcome not recorded'}</p>{recordedAccounts.length > 0 && <p>Tested accounts: {recordedAccounts.join(', ')}</p>}{row.record.recipient && <p>Recipient: {row.record.recipient}</p>}{row.record.replacementPolicyId && <p>Retained policy: {policyOptions.find(policy => policy.id === row.record?.replacementPolicyId)?.name ?? row.record.replacementPolicyId}</p>}{row.record.retiredPolicyIds?.length ? <p>Retired policies: {row.record.retiredPolicyIds.map(id => policyOptions.find(policy => policy.id === id)?.name ?? id).join(', ')}</p> : null}{row.record.retainedPolicyIds?.length ? <p>Policies retained: {row.record.retainedPolicyIds.map(id => policyOptions.find(p => p.id === id)?.name ?? row.record?.policyNames?.[id] ?? id).join(', ')}</p> : null}{row.record.rationale && <p>Reason: {row.record.rationale}</p>}{row.record.reference && <p>Change record: {row.record.reference}</p>}{row.verificationReason && <p>{row.verificationReason}</p>}</section>
  // The Scan in the one footer every step closes on (StepSections.tsx
  // StepFooter): the scan's status over it while one runs, and it waits. The
  // row above the body is what closes it; no step draws a Close.
  const footer = <StepFooter onScan={onScan ?? null} />
  if (drill) {
    return (
      // The frame ContentStep draws for a step: the head, the main column in two
      // parts with the action column between them in the DOM (U5) and beside
      // them on screen, and the footer under both. `data-task-anatomy` is the
      // group's, as on the other three steps of Establish Emergency Access.
      <article className="step panel panel-key" data-step-id="cleanup-drill" data-task-anatomy={groupOf('cleanup-drill')?.key}>
        {head}
        <div className="step-body has-rail">
          <div className="step-main step-main-lead">
            {why}
            {/* Tasks Remaining, on screen whatever the scan found, as on the
                other three: the accounts' cards, or No tasks remaining. */}
            {onDone ? <EmergencySubjectReadiness subjects={recoverySubjects} printing={false} barMain={recoveryReadiness.bar.main} onWhy={null} /> : recoveryTiles.length > 0 && <ReadinessSection heading={TASK_HEAD.remaining} readiness={recoveryReadiness} lead={null} showClosedCount={false} printing />}
          </div>
          <StepActionColumn rail={{ headline: milestoneHeadlineOf(row.done ? status.word : null, [DRILL_MILESTONE]), instruction: null }} />
          <div className="step-main step-main-rest">
            {/* The row's own instructions are its Implementation (U1; S-RN-2, S-RB-3): no step draws What to do. */}
            <Implementation heading={TASK_HEAD.implementation} artifacts={verificationArtifacts} drawnBy="translator" preview={null} notes={[]} title={entry.title} empty={{ key: 'none', tone: 'neutral', title: '', text: '' }} source={null} learn={entry.learn?.url ?? null} onTroubleshooting={null} open={implementationOpen} onOpen={() => setImplementationOpen(true)} onClose={() => setImplementationOpen(false)} copy={copyArtifact} copied={copied} printing={!onDone} tasks={verificationTasks} chosenChannel={implementationChannel} onChooseChannel={setImplementationChannel} chosenTaskId={taskId} onChooseTask={setTaskId} emptyTaskText={row.done ? 'Verification is current. No Entra action is required.' : 'Complete the highlighted configuration tasks before starting verification.'} />
            {done}
            <details className="step-section emergency-recovery-procedure" open={!onDone || undefined}><summary><strong>Emergency recovery procedure</strong></summary><p className="reason">Keep the exported plan available independently of this tenant. Scan-specific facts reflect the scan at {phase.snapshotObservedAt ? absolute(phase.snapshotObservedAt) : 'an unavailable time'} and may differ during an incident.</p><ol>{EMERGENCY_RECOVERY_PROCEDURE.map(line => <li key={line}><AuthoredText text={line} /></li>)}</ol><p className="reason">Conditional Access exclusions do not disable Security Defaults or authentication-method policy. Temporary Access Pass does not bypass Conditional Access, and no recovery route or timeframe is guaranteed.</p></details>
            {recorded}
          </div>
        </div>
        {footer}
      </article>
    )
  }
  return (
    // The same frame the Plan draws for a step (task 034): attached under the row
    // that opened it, its head above the body. A Cleanup row is not a policy and
    // has no lifecycle to be at, so it draws no track — the frame is the same,
    // the row activates less of it.
    <article className="step panel panel-key">
      {head}
      <div className="step-body">
        <div className="step-main">
          {/* The same sections, in the same order, under the same headings as a
              step (StepSections.tsx, stepHeadings.ts). */}
          {why}
          <StepSection heading={CONTRACT.implementation.heading}>
            <ol className="sections">{entry.whatToDo.filter(whole).map((l, i) => <li key={i}>{fillText(l, ex)}</li>)}</ol>
          </StepSection>
          {done}
          {recorded}
          {onDone && row.kind !== 'hardening' && row.kind !== 'namedExclusions' && (
            <div className="decision">
              {row.kind === 'alerting' && <div className="decision-field"><label><strong>Test Result</strong><select value={outcome} onChange={event => setOutcome(event.currentTarget.value as typeof outcome)}><option value="">Choose…</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label></div>}
              {row.kind === 'alerting' && <div className="decision-field"><label><strong>Alert Recipient</strong><input value={recipient} onChange={event => setRecipient(event.currentTarget.value)} /></label></div>}
              {row.kind === 'naming' && <div className="decision-fields"><ul>{namingProposals.map(p => <li key={p.id}><strong>{p.from}</strong><label><span className="sr-only">Approved name for {p.from}</span><input value={p.to} onChange={e => { const value = e.currentTarget.value; setNameDrafts(prev => ({ ...prev, [p.id]: value })) }} /></label><span className="reason">ID: {p.id}</span>{p.collision && <p>Name collision: resolve the duplicate name before saving this proposal.</p>}</li>)}</ul><label className="choice"><input type="checkbox" checked={toolingVerified} onChange={e => setToolingVerified(e.currentTarget.checked)} />Name-based scripts and reports have been checked.</label><p>Save the proposed names before renaming in Entra, then rescan. Confirm the tooling check after the names are updated.</p></div>}
              {row.kind === 'consolidation' && <div className="decision-fields">
                <div className="decision-field"><label><strong>Review Outcome</strong><select value={consolidationDecision} onChange={e => { setConsolidationDecision(e.currentTarget.value as typeof consolidationDecision); setRetiredIds([]) }}><option value="retire">Retire Replaced Policies</option><option value="retain-both">Retain Both</option></select></label></div>
                {consolidationDecision === 'retire' && <div className="decision-field"><label><strong>Retained Policy</strong><select value={replacementId} onChange={event => setReplacementId(event.currentTarget.value)}><option value="">Choose…</option>{policyOptions.filter(policy => policy.state === 'enabled').map(policy => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label></div>}
                <div className="decision-field"><h5 id="retired-policy-label">{consolidationDecision === 'retire' ? 'Retired Policies' : 'Policies to Retain'}</h5><Picker labelledBy="retired-policy-label" options={policyOptions.filter(policy => (consolidationDecision === 'retain-both' || policy.id !== replacementId) && `${policy.name} ${policy.id}`.toLowerCase().includes(policyQuery.toLowerCase()))} selected={retiredIds.map(id => policyOptions.find(policy => policy.id === id) ?? { id, name: id })} onSearch={setPolicyQuery} onChange={options => setRetiredIds(options.map(option => option.id))} /></div>
                {consolidationDecision === 'retire' && <label className="choice"><input type="checkbox" checked={coverageVerified} onChange={event => setCoverageVerified(event.currentTarget.checked)} />The retained policy covers the users, resources and controls of the retired policies.</label>}
                {consolidationDecision === 'retain-both' && <div className="decision-field"><label><strong>Reason to Retain Both</strong><input value={rationale} onChange={e => setRationale(e.currentTarget.value)} /></label></div>}
                <div className="decision-field"><label><strong>Change Record</strong><input value={reference} onChange={event => setReference(event.currentTarget.value)} /></label></div>
              </div>}
              <><div className="dlabel">{A.cleanupDoneOn}</div>
              <input type="date" max={todayDate()} aria-label={A.cleanupDoneOn} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
              <Button variant="secondary" disabled={!validCompletionDate(date, todayDate()) || (row.kind === 'consolidation' && !consolidationReady) || (row.kind === 'naming' && (!namingProposals.length || namingProposals.some(p => p.collision))) || (row.kind === 'alerting' && !outcome) || (row.kind === 'alerting' && !recipient.trim())} onClick={() => onDone(date, row.kind === 'alerting' ? phase.accountIds : [], { ...(row.kind === 'naming' ? { namingChanges: namingProposals.map(({id, from, to}) => ({id, from, to})), toolingVerified } : {}), ...(row.kind === 'consolidation' && consolidationDecision === 'retain-both' ? { outcome: 'passed' as const, consolidationDecision, retainedPolicyIds: retiredIds, retainedPolicyBases: Object.fromEntries(policyOptions.filter(p => retiredIds.includes(p.id)).map(p => [p.id, JSON.stringify([p.state, p.basis])])), rationale: rationale.trim(), policyNames: Object.fromEntries(policyOptions.filter(p => retiredIds.includes(p.id)).map(p => [p.id, p.name])) } : {}), ...(row.kind === 'consolidation' && consolidationDecision === 'retire' ? { consolidationDecision, outcome: 'passed' as const, replacementPolicyId: replacementId, retiredPolicyIds: retiredIds, coverageVerified, replacementBasis: replacement?.basis ?? undefined, reference: reference.trim(), policyNames: Object.fromEntries(policyOptions.filter(policy => policy.id === replacementId || retiredIds.includes(policy.id)).map(policy => [policy.id, policy.name])) } : {}), ...(outcome ? { outcome } : {}), ...(recipient.trim() ? { recipient: recipient.trim() } : {}) })}>{row.kind === 'alerting' ? 'Save Test Result' : row.kind === 'naming' ? 'Save Naming Review' : row.kind === 'consolidation' ? 'Save Review' : A.cleanupDone}</Button></>
              {row.done && <p className="reason">{cleanupWhen(row)}</p>}
            </div>
          )}
        </div>
      </div>
      {footer}
    </article>
  )
}
