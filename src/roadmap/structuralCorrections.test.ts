import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { addWorkflowSteps } from './workflows.ts'
import { directionSteps } from './direction.ts'
import { DIRECTION_STEP } from './directionAnswers.ts'
import { applyManualReviews, manualBasis, scopeManualBasis, MANUAL_REVIEW_ID } from './manualWork.ts'
import { cleanupRecord, withCleanupDone, isRecordedDrill, validCompletionDate, cleanupBasis, recoveryAccountBasis } from './cleanupDone.ts'
import type { VerifiedRecoveryEvidence } from './cleanupDone.ts'
import { observedContext, observedRecoveryRecords, recoveryCandidate } from './fixtures/recoveryRecords.ts'
import { cleanupPhaseFor } from './cleanupPhase.ts'
import { buildPlanFile, parsePlanFile, sameBaselineSource, trimCheckpoints } from './plan.ts'
import { absoluteDate, setDisplayTimeZone } from '../copy/dates.ts'
import { savePlanRecord, loadPlanRecord, saveMappingRecord, loadMappingRecord } from '../graph/collect/cache.ts'
import { hasStorageIssue } from '../graph/collect/storageIssues.ts'
import { watermarkDemoFile } from '../ui/exportGuard.ts'
import { setState } from './lifecycle.ts'
import type { Step } from './types.ts'

const at = '2026-09-14T12:00:00Z'

test('workloads: unknown stays open; no is reversible; each unassessed policy has an individual review', () => {
  const f = fixture('demo')
  const original = runFixture(f)
  const policies = original.coverage.organisation.notAssessed
  assert.ok(policies.length > 1)
  const render = () => { const steps: Step[] = []; addWorkflowSteps(steps, policies, f.mapping); return steps }
  f.mapping.facetOverrides = {}
  const first = render()
  const chooser = directionSteps({ snapshot: f.snapshot, mapping: f.mapping, notAssessed: policies, availableGoalIds: [] }).find((s) => s.id === DIRECTION_STEP.use)!
  const services = chooser.directionQuestions!.filter((c) => c.key.startsWith('service:'))
  assert.ok(services.some((c) => c.suggested.value === 'yes'), 'observed services are proposed in use')
  assert.ok(services.every((c) => c.saved === null), 'a suggestion is not an answer')
  assert.equal(chooser.state.satisfied, false, 'defaults need confirmation')
  assert.ok(first.filter((s) => s.manualReview).every((s) => !s.manualReview!.readyToConfirm))
  assert.equal(new Set(first.map((s) => s.id)).size, first.length)
  f.mapping.workflowAnswers = Object.fromEntries([...services.map((c) => [c.key.slice('service:'.length), 'no' as const]), ['agents', 'no' as const]])
  assert.ok(render().filter((s) => s.manualReview).every((s) => s.doesntApply))
  f.mapping.workflowAnswers = Object.fromEntries([...services.map((c) => [c.key.slice('service:'.length), 'yes' as const]), ['agents', 'yes' as const]])
  const enabled = render()
  assert.equal(enabled.filter((s) => s.manualReview?.readyToConfirm).length, policies.filter(p => !/IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i.test(p.name) && !/AVD.*Exclude.*AllowedAVDUsers/i.test(p.name)).length)
  assert.ok(enabled.filter((s) => s.manualReview).every((s) => Array.isArray(s.guidance?.whatToDo?.steps)))
  assert.equal(original.schedule.cleanup?.rows.some((r) => r.kind === 'notAssessed'), false)
})

test('manual policy review survives unrelated scan changes and reopens if its baseline source changes', () => {
  const f = fixture('demo')
  const policies = runFixture(f).coverage.organisation.notAssessed
  f.mapping.workflowAnswers = { sharepoint: 'yes', avd: 'yes', inforcer: 'yes', agents: 'yes', azureManagement: 'yes' }
  const first: Step[] = []
  addWorkflowSteps(first, policies, f.mapping)
  const target = first.find((s) => s.manualReview?.readyToConfirm)!
  const confirmations = { [target.id]: { [MANUAL_REVIEW_ID]: { at, basis: target.manualReview!.basis } } }
  f.snapshot.asOf = '2026-09-15T12:00:00Z'
  f.snapshot.config.caPolicies.rows.push({ id: 'unrelated', displayName: 'Unrelated policy', state: 'disabled' })
  const next: Step[] = []
  addWorkflowSteps(next, policies, f.mapping, confirmations)
  assert.equal(next.find((s) => s.id === target.id)!.status, 'done')
  const changed = structuredClone(policies)
  changed.find((p) => target.manualReview!.basis.includes(p.name))!.json = { changed: true } as never
  const last: Step[] = []
  addWorkflowSteps(last, changed, f.mapping, confirmations)
  assert.notEqual(last.find((s) => s.id === target.id)!.status, 'done')
})

test('guest review can finish while keeping guests; a changed guest population reopens it', () => {
  const f = fixture('micro')
  const step = runFixture(f).steps.find((s) => s.id === 's-ladder-guest-review')!
  assert.ok(step)
  assert.ok(f.snapshot.users.some((u) => u.userType === 'guest'))
  const record = { at, testedAt: at.slice(0, 10), outcome: 'retained' as const, accountIds: f.snapshot.users.filter(u => u.userType === 'guest').map(u => u.id), basis: '' }
  record.basis = scopeManualBasis(manualBasis(step, f.snapshot), record)
  const confirmation = { [step.id]: { [MANUAL_REVIEW_ID]: record } }
  applyManualReviews([step], f.snapshot, confirmation)
  assert.equal(step.status, 'done')
  f.snapshot.asOf = '2026-09-15T12:00:00Z'
  applyManualReviews([step], f.snapshot, confirmation)
  assert.equal(step.status, 'done', 'scan time alone is not a material change')
  f.snapshot.users.push({ ...f.snapshot.users.find((u) => u.userType === 'guest')!, id: 'new-guest' })
  applyManualReviews([step], f.snapshot, confirmation)
  assert.notEqual(step.status, 'done')
})

test('manual confirmation cannot override an unsatisfied scan requirement', () => {
  const f = fixture('micro')
  const step = runFixture(f).steps.find((s) => s.id === 's-ladder-authenticator-over-sms')!
  assert.ok(step)
  setState(step, { satisfied: false, inPlace: false })
  applyManualReviews([step], f.snapshot, { [step.id]: { [MANUAL_REVIEW_ID]: { at, basis: manualBasis(step, f.snapshot) } } })
  assert.equal(step.manualReview?.readyToConfirm, false)
  assert.notEqual(step.status, 'done')
})

test('recovery records match only the explicitly linked account and event', () => {
  const candidate = recoveryCandidate('account-a', '2026-09-14T03:00:00Z', 'tenant', 'event-account-a')
  const records = cleanupRecord(observedRecoveryRecords({ tenantId: 'tenant', events: { 'account-a': candidate }, configurationObservedAt: '2026-09-14T02:00:00.000Z', at, candidateSetBasis: { 'account-a': '["key-a"]' }, timeZone: 'America/Denver' })).records!
  const context = observedContext(candidate, 'tenant', at, '["key-a"]')
  assert.equal(isRecordedDrill('2026-09-14T03:00:00Z', [], 'ACCOUNT-A', records, context), true)
  assert.equal(isRecordedDrill('2026-09-14T03:00:00Z', [], 'account-b', records, context), false)
  assert.equal(isRecordedDrill('2026-09-14T15:00:00Z', [], 'account-a', records, context), false)
  assert.equal(isRecordedDrill('2026-09-13T15:00:00Z', ['2026-09-13T12:00:00Z'], 'account-a'), false)
  assert.equal(validCompletionDate('2026-02-30', at), false)
  assert.equal(validCompletionDate('2026-09-15', at), false)
  assert.equal(validCompletionDate('2026-09-15', '2026-09-14T12:30:00Z', 'Pacific/Kiritimati'), true)
})

test('recovery tests can be recorded separately, expire, and never cover a newly chosen account', () => {
  const f = fixture('demo')
  const organisation = runFixture(f).coverage.organisation
  const ids = ['a','b']
  const eventAt = '2026-09-14T03:00:00Z'
  const configurationObservedAt = '2026-09-14T02:00:00.000Z'
  const accountBasis = { a: 'basis-a', b: 'basis-b' }
  const candidateSetBasis = { a: '["key-a"]', b: '["key-b"]' }
  const events = Object.fromEntries(ids.map(id => [id, recoveryCandidate(id, eventAt, 'tenant')]))
  const recoveryCandidates = Object.fromEntries(ids.map(id => [id, [{ candidate: events[id], qualifies: true, reason: null }]]))
  const input = { after: at, rhythm: null, emergencyAccountIds: ids, emergencyAccounts: ['A','B'], emergencyAccountUpns: ['a@example.test','b@example.test'], organisation, now: at, accountBasis, recoveryCandidates, recoveryCandidateSetBasis: candidateSetBasis, signInEvidenceSource: { status: 'ok' as const, coveredWindow: null, reason: null, asOf: at }, tenantId: 'tenant', configurationObservedAtByAccount: { a: configurationObservedAt, b: configurationObservedAt }, snapshotObservedAt: at }
  // The scan observes a's sign-in first and b's on a later scan: one account's proof never completes the row.
  const [preparation, observedA, observedB] = observedRecoveryRecords({ tenantId: 'tenant', events, configurationObservedAt, at, accountBasis, candidateSetBasis })
  let checkpoints: unknown[] = [preparation, observedA]
  assert.equal(cleanupPhaseFor({ ...input, records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
  checkpoints = [...checkpoints, observedB]
  assert.ok(cleanupPhaseFor({ ...input, records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done)
  assert.equal(cleanupPhaseFor({ ...input, now: '2027-03-14T12:00:00Z', records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
  assert.equal(cleanupPhaseFor({ ...input, emergencyAccountIds: ['a','c'], records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
})

test('cleanup completion reopens when the work changes; scan checkpoint trimming retains all decisions', () => {
  const f = fixture('messy')
  const r = runFixture(f)
  const phase = r.schedule.cleanup!
  const row = phase.rows.find((r) => r.kind === 'naming')!
  const namingChanges = phase.namingProposals!.map((p, i) => ({ id: p.id, from: p.from, to: `CA - Reviewed ${i + 1}` }))
  assert.ok(namingChanges.length)
  const policies = structuredClone(f.snapshot.config.caPolicies.rows) as Record<string, unknown>[]
  for (const change of namingChanges) policies.find(p => p.id === change.id)!.displayName = change.to
  const records = cleanupRecord(withCleanupDone([], 'naming', '2026-09-13', at, { namingChanges, toolingVerified: true, basis: cleanupBasis('naming', row.lists) })).records!
  const organisation = structuredClone(r.coverage.organisation)
  organisation.naming.outliers = []
  const input = { after: at, rhythm: null, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [], organisation, policies, now: at, records }
  assert.ok(cleanupPhaseFor(input)!.rows.find((r) => r.kind === 'naming')!.done)
  input.organisation.naming.outliers.push('Another policy')
  input.policies.push({ id: 'new-policy', displayName: 'Another policy', state: 'enabled' })
  assert.equal(cleanupPhaseFor(input)!.rows.find((r) => r.kind === 'naming')!.done, null)
  const saved = trimCheckpoints([...records, ...Array.from({length: 45}, (_, n) => ({at: String(n), coverage: []}))])
  assert.ok(saved.includes(records[0]))
  assert.equal(saved.length, 22)
})

test('calendar days do not move when the display time zone changes', () => {
  try {
    for (const zone of ['America/Denver', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'UTC']) {
      setDisplayTimeZone(zone)
      assert.equal(absoluteDate('2026-09-15'), 'Sep 15, 2026', zone)
    }
    setDisplayTimeZone('America/Denver')
    assert.equal(absoluteDate('2026-09-15T01:00:00Z'), 'Sep 14, 2026', 'a real timestamp remains local')
  } finally { setDisplayTimeZone(null) }
})

test('plan file preserves decisions and rejects malformed or cross-tenant mappings', () => {
  const f = fixture('demo')
  const decisions = { planId: f.planId, skips: {}, checkpoints: [], planCreatedAt: at, firstDeployment: '2026-09-16', observations: {}, confirmations: {} }
  const file = buildPlanFile({ planId: f.planId, snapshot: f.snapshot, operator: { userId: f.operatorId, userPrincipalName: '' }, baselineSource: { kind: 'github', owner: 'Owner', repo: 'Repo', commit: 'ABC' }, mapping: f.mapping, steps: runFixture(f).steps, checkpoints: [], decisions })
  const parsed = parsePlanFile(JSON.stringify(file))
  assert.equal(parsed.error, null)
  assert.equal(parsed.plan!.decisions!.planCreatedAt, at)
  assert.equal(parsed.plan!.decisions!.firstDeployment, '2026-09-16')
  assert.equal(sameBaselineSource(file.baseline.source, { repo: 'repo', owner: 'owner', commit: 'abc', kind: 'github' }), true)
  assert.equal(sameBaselineSource(file.baseline.source, { repo: 'repo', owner: 'owner', commit: 'def', kind: 'github' }), false)
  assert.ok(parsePlanFile(JSON.stringify({ ...file, mappings: { ...file.mappings, tenantId: 'another' } })).error)
  assert.ok(parsePlanFile(JSON.stringify({ ...file, mappings: { ...file.mappings, breakGlassUserIds: 'not an array' } })).error)
})

test('failed durable saves remain available for backup and raise a tenant-specific warning', async () => {
  // Node has no IndexedDB: this exercises a real storage failure, not a successful mock.
  assert.equal(typeof globalThis.indexedDB, 'undefined')
  await savePlanRecord('test-unsaved', { planId: 'new-work', checkpoints: [at] })
  await saveMappingRecord('test-unsaved', { allowedCountries: ['NZ'] })
  assert.equal(hasStorageIssue('test-unsaved'), true)
  assert.equal(hasStorageIssue('another-tenant'), false)
  assert.deepEqual(await loadPlanRecord('test-unsaved'), { planId: 'new-work', checkpoints: [at] })
  assert.deepEqual(await loadMappingRecord('test-unsaved'), { allowedCountries: ['NZ'] })
})

test('sample JSON, calendar, and CSV keep valid file structure and a demo label', () => {
  const json = JSON.parse(watermarkDemoFile('plan.json', '{"steps":[]}'))
  assert.ok(json._demo)
  assert.deepEqual(json.steps, [])
  const ics = watermarkDemoFile('plan.ics', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Review\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n')
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.match(ics, /SUMMARY:\[DEMO\] Review/)
  const csv = watermarkDemoFile('people.csv', 'Name,Note\r\nAlex,"First line\nsecond line"\r\nSam,Okay\r\n')
  assert.ok(csv.startsWith('"IAMAI data",Name,Note'))
  assert.equal(csv.match(/second line/g)!.length, 1)
  assert.match(csv, /First line\nsecond line/)
  assert.equal(csv.split('Demo').length > 1 || csv.split('DEMO').length > 1 || csv.toLowerCase().includes('sample'), true)
})


test('uploaded baselines are identified by content, never the display name', async () => {
  const { baselineContentHash } = await import('../baseline/contentHash.ts')
  const files = [{ path: 'one.json', text: '{"a":1}' }, { path: 'two.json', text: '{"b":2}' }]
  const contentHash = await baselineContentHash(files)
  assert.equal(contentHash, await baselineContentHash([...files].reverse()))
  const source = { kind: 'upload' as const, fileName: 'Uploaded baseline', contentHash }
  assert.equal(sameBaselineSource(source, { ...source, fileName: 'A different filename' }), true)
  assert.equal(sameBaselineSource(source, { ...source, contentHash: await baselineContentHash([{ ...files[0], text: '{"a":2}' }, files[1]]) }), false)
  assert.equal(sameBaselineSource(source, { kind: 'upload', fileName: source.fileName }), false)
})

/** A hand-recorded result in the retired schema-1 format: history, never proof on its own. */
const legacyRecoveryEvidence = (accountIds: string[], tenantId: string, eventAt: string): Record<string, VerifiedRecoveryEvidence> => Object.fromEntries(accountIds.map(accountId => [accountId, {
  schema: 1, tenantId, accountId, eventId: `event-${accountId}`, eventAt, appId: null,
  resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', method: 'Passkey (FIDO2)', provenance: 'observed-sign-in',
  recoveryConfirmed: true, credentialConfirmed: true, configurationObservedAt: new Date(Date.parse(eventAt) - 3_600_000).toISOString(),
}]))

test('a recovery result recorded after the last scan remains incomplete until a post-event scan observes it', () => {
  const f = fixture('demo-week2')
  const before = runFixture(f)
  const phase = before.schedule.cleanup!
  const row = phase.rows.find(r => r.kind === 'drill')!
  const recordedAt = new Date(Date.parse(f.snapshot.asOf) + 86400000).toISOString()
  const date = recordedAt.slice(0, 10)
  const checkpoints = withCleanupDone([], 'drill', date, recordedAt, { accountIds: phase.accountIds, outcome: 'passed', accountBasis: recoveryAccountBasis(f.snapshot, phase.accountIds), recoveryEvidence: legacyRecoveryEvidence(phase.accountIds, f.snapshot.tenantId, f.snapshot.asOf), basis: cleanupBasis('drill', row.lists, phase.accountIds), timeZone: 'UTC' })
  const after = runFixture(f, { cleanupRecord: cleanupRecord(checkpoints), reviewNow: recordedAt })
  assert.equal(after.schedule.cleanup!.rows.find(r => r.kind === 'drill')!.done, null)
})
