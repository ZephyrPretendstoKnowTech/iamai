import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { addWorkflowSteps, WORKFLOW_STEP } from './workflows.ts'
import { applyManualReviews, manualBasis, MANUAL_REVIEW_ID } from './manualWork.ts'
import { cleanupRecord, withCleanupDone, isRecordedDrill, validCompletionDate, cleanupBasis } from './cleanupDone.ts'
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
  const render = () => { const steps: Step[] = []; addWorkflowSteps(steps, policies, f.snapshot, f.mapping); return steps }
  f.mapping.facetOverrides = {}
  const first = render()
  const chooser = first.find((s) => s.id === WORKFLOW_STEP)!
  assert.ok(chooser.workflowChoices!.every((c) => c.answer === 'unsure'))
  assert.ok(first.filter((s) => s.manualReview).every((s) => !s.manualReview!.readyToConfirm))
  assert.equal(new Set(first.map((s) => s.id)).size, first.length)
  f.mapping.workflowAnswers = Object.fromEntries(chooser.workflowChoices!.map((c) => [c.key, 'no' as const]))
  assert.ok(render().filter((s) => s.manualReview).every((s) => s.doesntApply))
  f.mapping.workflowAnswers = Object.fromEntries(chooser.workflowChoices!.map((c) => [c.key, 'yes' as const]))
  const enabled = render()
  assert.equal(enabled.filter((s) => s.manualReview?.readyToConfirm).length, policies.length)
  assert.ok(enabled.filter((s) => s.manualReview).every((s) => Array.isArray(s.guidance?.whatToDo?.steps)))
  assert.equal(original.schedule.cleanup?.rows.some((r) => r.kind === 'notAssessed'), false)
})

test('manual policy review survives unrelated scan changes and reopens if its baseline source changes', () => {
  const f = fixture('demo')
  const policies = runFixture(f).coverage.organisation.notAssessed
  f.mapping.workflowAnswers = { sharepoint: 'yes', avd: 'yes', inforcer: 'yes', agents: 'yes', azureManagement: 'yes' }
  const first: Step[] = []
  addWorkflowSteps(first, policies, f.snapshot, f.mapping)
  const target = first.find((s) => s.manualReview?.readyToConfirm)!
  const confirmations = { [target.id]: { [MANUAL_REVIEW_ID]: { at, basis: target.manualReview!.basis } } }
  f.snapshot.asOf = '2026-09-15T12:00:00Z'
  f.snapshot.config.caPolicies.rows.push({ id: 'unrelated', displayName: 'Unrelated policy', state: 'disabled' })
  const next: Step[] = []
  addWorkflowSteps(next, policies, f.snapshot, f.mapping, confirmations)
  assert.equal(next.find((s) => s.id === target.id)!.status, 'done')
  const changed = structuredClone(policies)
  changed.find((p) => target.manualReview!.basis.includes(p.name))!.json = { changed: true } as never
  const last: Step[] = []
  addWorkflowSteps(last, changed, f.snapshot, f.mapping, confirmations)
  assert.notEqual(last.find((s) => s.id === target.id)!.status, 'done')
})

test('guest review can finish while keeping guests; a changed guest population reopens it', () => {
  const f = fixture('micro')
  const step = runFixture(f).steps.find((s) => s.id === 's-ladder-guest-review')!
  assert.ok(step)
  assert.ok(f.snapshot.users.some((u) => u.userType === 'guest'))
  const confirmation = { [step.id]: { [MANUAL_REVIEW_ID]: { at, basis: manualBasis(step, f.snapshot) } } }
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

test('recovery records match only the tested account and its local calendar day', () => {
  const records = cleanupRecord(withCleanupDone([], 'drill', '2026-09-13', at, { accountIds: ['account-a'], timeZone: 'America/Denver' })).records!
  assert.equal(isRecordedDrill('2026-09-14T03:00:00Z', [], 'ACCOUNT-A', records), true)
  assert.equal(isRecordedDrill('2026-09-14T03:00:00Z', [], 'account-b', records), false)
  assert.equal(isRecordedDrill('2026-09-14T15:00:00Z', [], 'account-a', records), false)
  assert.equal(isRecordedDrill('2026-09-13T15:00:00Z', ['2026-09-13T12:00:00Z'], 'account-a'), false)
  assert.equal(validCompletionDate('2026-02-30', at), false)
  assert.equal(validCompletionDate('2026-09-15', at), false)
  assert.equal(validCompletionDate('2026-09-15', '2026-09-14T12:30:00Z', 'Pacific/Kiritimati'), true)
})

test('recovery tests can be recorded separately, expire, and never cover a newly chosen account', () => {
  const f = fixture('demo')
  const organisation = runFixture(f).coverage.organisation
  const input = { after: at, rhythm: null, emergencyAccountIds: ['a','b'], emergencyAccounts: ['A','B'], emergencyAccountUpns: ['a@example.test','b@example.test'], organisation, now: at }
  let checkpoints = withCleanupDone([], 'drill', '2026-09-12', at, { accountIds: ['a'] })
  assert.equal(cleanupPhaseFor({ ...input, records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
  checkpoints = withCleanupDone(checkpoints, 'drill', '2026-09-13', at, { accountIds: ['b'] })
  assert.ok(cleanupPhaseFor({ ...input, records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done)
  assert.equal(cleanupPhaseFor({ ...input, now: '2027-03-14T12:00:00Z', records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
  assert.equal(cleanupPhaseFor({ ...input, emergencyAccountIds: ['a','c'], records: cleanupRecord(checkpoints).records })!.rows.find((r) => r.kind === 'drill')!.done, null)
})

test('cleanup completion reopens when the work changes; scan checkpoint trimming retains all decisions', () => {
  const f = fixture('messy')
  const r = runFixture(f)
  const phase = r.schedule.cleanup!
  const row = phase.rows.find((r) => r.kind === 'naming')!
  const records = cleanupRecord(withCleanupDone([], 'naming', '2026-09-13', at, { basis: cleanupBasis('naming', row.lists) })).records!
  const input = { after: at, rhythm: null, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [], organisation: r.coverage.organisation, now: at, records }
  assert.ok(cleanupPhaseFor(input)!.rows.find((r) => r.kind === 'naming')!.done)
  input.organisation.naming.outliers.push('Another policy')
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

test('free-licence emergency accounts need an explicit selection and a recorded review', async () => {
  const { applyStepDecisions } = await import('./decisions.ts')
  const { ladderSteps, GLOBAL_ADMIN_ROLE_ID } = await import('./ladder.ts')
  const { contentStepFor } = await import('../content/stepTitle.ts')
  const f = fixture('micro')
  const users = f.snapshot.users.slice(0, 2)
  for (const u of users) { u.accountEnabled = true; u.onPremisesSyncEnabled = false; f.snapshot.roles.active[u.id] = [GLOBAL_ADMIN_ROLE_ID] }
  const id = 's-ladder-break-glass-accounts'
  const mapping = applyStepDecisions(f.mapping, { [id]: { picked: users.map((u) => u.id), at } })
  assert.deepEqual(mapping.breakGlassUserIds, users.map((u) => u.id))
  const generate = () => ladderSteps(f.snapshot, mapping, []).steps.find((s) => s.id === id)!
  const first = generate()
  assert.ok(contentStepFor(first)?.decision)
  applyManualReviews([first], f.snapshot)
  assert.notEqual(first.status, 'done', 'account selection alone cannot certify a recovery test')
  assert.equal(first.manualReview!.readyToConfirm, true)
  const confirmed = generate()
  const confirmations = { [id]: { [MANUAL_REVIEW_ID]: { at, basis: first.manualReview!.basis } } }
  applyManualReviews([confirmed], f.snapshot, confirmations)
  assert.equal(confirmed.status, 'done')
  users[0].accountEnabled = false
  const disabled = generate()
  applyManualReviews([disabled], f.snapshot, confirmations)
  assert.notEqual(disabled.status, 'done')
  assert.equal(disabled.manualReview!.readyToConfirm, false)
})


test('a recovery test recorded after the last scan completes without rescanning', () => {
  const f = fixture('demo-week2')
  const before = runFixture(f)
  const phase = before.schedule.cleanup!
  const row = phase.rows.find(r => r.kind === 'drill')!
  const recordedAt = new Date(Date.parse(f.snapshot.asOf) + 86400000).toISOString()
  const date = recordedAt.slice(0, 10)
  const checkpoints = withCleanupDone([], 'drill', date, recordedAt, { accountIds: phase.accountIds, basis: cleanupBasis('drill', row.lists, phase.accountIds), timeZone: 'UTC' })
  const after = runFixture(f, { cleanupRecord: cleanupRecord(checkpoints), reviewNow: recordedAt })
  assert.equal(after.schedule.cleanup!.rows.find(r => r.kind === 'drill')!.done?.slice(0, 10), date)
})
