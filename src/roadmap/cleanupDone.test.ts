// Cleanup completion (E3): a Done records the row's date in the checkpoints and
// the row reads done <date>; the drill's date exempts the matching emergency
// sign-in from the emergency-access step's recent-sign-in check; the naming row
// renders renames as from → to; the consolidation row exists whenever a step's
// existingCoverage line rendered; the not-assessed row's note names the policy
// and the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanupDoneDates, cleanupRecord, drillDates, isRecordedDrill, latestRecoveryTest, recoveryCandidateReadings, withCleanupDone, recoveryAccountBasis, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import { renameLine } from './cleanupPhase.ts'
import { supersededPolicies } from './generate.ts'
import { cleanupWhen } from '../ui/surfaces/cleanupExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { absoluteDate } from '../copy/dates.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'

test('legacy drill dates remain history while ordinary cleanup completion still records the latest date', () => {
  let cps: unknown[] = [{ at: '2026-09-01T00:00:00.000Z', coverage: [] }]
  cps = withCleanupDone(cps, 'drill', '2026-09-03', '2026-09-03T10:00:00.000Z')
  cps = withCleanupDone(cps, 'naming', '2026-09-04', '2026-09-04T10:00:00.000Z')
  cps = withCleanupDone(cps, 'drill', '2026-12-01', '2026-12-01T10:00:00.000Z')
  assert.equal(cps.length, 4, 'the scan checkpoint stays beside the Cleanup records')
  assert.deepEqual(cleanupDoneDates(cps), { drill: '2026-12-01T12:00:00.000Z', naming: '2026-09-04T12:00:00.000Z' }, 'legacy completion dates remain visible as history')
  assert.deepEqual(drillDates(cps), [], 'untyped drill dates cannot become current recovery proof')
  assert.equal(isRecordedDrill('2026-09-03T02:15:00.000Z', drillDates(cps)), false, 'a legacy date does not identify the tested account')
  assert.ok(!isRecordedDrill('2026-09-05T02:15:00.000Z', drillDates(cps)))
  assert.ok(!isRecordedDrill('2026-09-03T02:15:00.000Z', []))
})

test('an exact drill association validates final recovery without reopening account preparation', () => {
  const f = fixture('demo')
  for (const [index, id] of f.mapping.breakGlassUserIds.entries()) {
    const eventAt = f.snapshot.users.find(user => user.id === id)!.lastSuccessfulSignIn!
    f.snapshot.signInEvidence[id] = { ...(f.snapshot.signInEvidence[id] ?? { signInCount: 1, lastSignIn: eventAt, lastMfaSuccess: null }), recoveryCandidates: [{ schema: 1, eventId: `observed-${index}`, userId: id, at: eventAt, success: true, isInteractive: true, appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', resourceId: '797f4846-ba00-4fd7-ba43-dac1f8f63013', app: 'Microsoft Azure portal', resource: 'Microsoft Azure management', method: 'Passkey (FIDO2)', freshMethod: true }] }
  }
  const bgId = f.mapping.breakGlassUserIds[0]
  const signIn = f.snapshot.users.find((u) => u.id === bgId)!.lastSuccessfulSignIn!
  const before = runFixture(f)
  const bg = before.steps.find((s) => s.id === 's-prereq-break-glass')!
  const recent = bg.checks!.items.filter((it) => it.fix === 'recent-sign-in')
  assert.equal(recent.length, 0, 'final recovery evidence does not appear as account-preparation work')

  const accountBasis = recoveryAccountBasis(f.snapshot, f.mapping.breakGlassUserIds, f.mapping, f.groups)
  const configurationObservedAt = new Date(Math.min(...f.mapping.breakGlassUserIds.map(id => Date.parse(f.snapshot.signInEvidence[id]!.recoveryCandidates![0].at))) - 3_600_000).toISOString()
  const recoveryEvidence = Object.fromEntries(f.mapping.breakGlassUserIds.map((id) => { const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]; return [id, { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: event.eventId, eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt } ] }))
  let checkpoints = withCleanupDone([], 'drill', configurationObservedAt.slice(0, 10), configurationObservedAt, { accountIds: f.mapping.breakGlassUserIds, workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: f.snapshot.tenantId, configurationObservedAt, accountBasis, timeZone: 'UTC' })
  checkpoints = withCleanupDone(checkpoints, 'drill', signIn.slice(0, 10), f.snapshot.asOf, { accountIds: f.mapping.breakGlassUserIds, outcome: 'passed', purpose: 'final', accountBasis, recoveryEvidence, signInAtByAccount: Object.fromEntries(f.mapping.breakGlassUserIds.map(id => [id, f.snapshot.users.find(u => u.id === id)!.lastSuccessfulSignIn!])), timeZone: 'UTC' })
  const readings = recoveryCandidateReadings(f.snapshot, bgId, f.snapshot.asOf, configurationObservedAt)
  const evidenceContext = { readings, tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }
  assert.ok(latestRecoveryTest(bgId, checkpoints as never[], f.snapshot.asOf, accountBasis[bgId], evidenceContext, 'final'))
  assert.equal(latestRecoveryTest(bgId, checkpoints as never[], f.snapshot.asOf, accountBasis[bgId], evidenceContext, 'pre-change'), null, 'final proof cannot satisfy the separate pre-change purpose')
  const drilled = runFixture(f, { cleanupRecord: cleanupRecord(checkpoints) })
  const bgAfter = drilled.steps.find((s) => s.id === 's-prereq-break-glass')!
  assert.equal(bgAfter.checks!.items.filter((it) => it.fix === 'recent-sign-in').length, 0, 'final verification does not leak into account preparation after it is recorded')
  const row = drilled.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!
  assert.equal(row.done, `${signIn.slice(0, 10)}T12:00:00.000Z`, 'the drill row carries its recorded date')
  assert.equal(cleanupWhen(row), `done ${absoluteDate(row.done!)}`, 'the row reads done <date>')
  assert.equal(cleanupWhen(before.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!), absoluteDate(before.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!.day.slice(0, 10)), 'undone, the row reads its planned day')
})

test('fabricated or imported recovery event ids never complete the drill', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const configuredAt = new Date(Date.parse(event.at) - 3_600_000).toISOString()
  const evidence = { [id]: { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: 'fabricated-event-id', eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt: configuredAt } }
  const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)
  let checkpoints = withCleanupDone([], 'drill', configuredAt.slice(0, 10), configuredAt, { accountIds: [id], workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: f.snapshot.tenantId, configurationObservedAt: configuredAt, accountBasis: basis })
  checkpoints = withCleanupDone(checkpoints, 'drill', event.at.slice(0, 10), f.snapshot.asOf, { accountIds: [id], outcome: 'passed', purpose: 'final', accountBasis: basis, recoveryEvidence: evidence })
  const record = cleanupRecord(checkpoints).records!
  const result = runFixture(f, { cleanupRecord: { done: {}, drills: [], records: record } })
  assert.notEqual(result.schedule.cleanup!.rows.find(row => row.kind === 'drill')!.done, event.at.slice(0, 10))
})

test('recovery basis changes with effective exclusions membership and saved approved-model intent', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const original = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]?.resolvedId
  assert.ok(original && groupId)
  f.groups.get(groupId!)!.memberIds.push('unexpected-member')
  assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], original)
  f.groups.get(groupId!)!.memberIds.pop()
  f.mapping.passkeyApprovedModels = [{ name: 'Approved recovery model', aaguid: '11111111-2222-4333-8444-555555555555' }]
  assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], original)
})

test('the naming row renders renames as from → to, in the tenant\'s convention', () => {
  const f = fixture('messy')
  const r = runFixture(f)
  const naming = r.coverage.organisation.naming
  assert.ok(naming.outliers.length > 0, 'messy has names off its convention')
  const row = r.schedule.cleanup!.rows.find((x) => x.kind === 'naming')!
  assert.ok(row, 'the naming row is present')
  for (const line of row.lists.renames) assert.match(line, /^.+ → .+$/, line)
  assert.ok(row.lists.renames[0].startsWith(renameLine(naming.outliers[0], naming)))
  assert.match(row.lists.renames[0], /\(ID: [^)]+\)/)
  assert.ok(!row.lists.renames[0].endsWith(`→ ${naming.outliers[0]}`), 'the proposed name is not the old one')
})

test('the consolidation row exists whenever a step\'s existingCoverage line rendered, and names those policies', () => {
  let seen = false
  // The large fixture holds a compliant-device policy that partly covers its goal: the one step with existing coverage still to do.
  for (const name of ['demo', 'mid', 'large'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const superseded = supersededPolicies(r.steps)
    const row = r.schedule.cleanup?.rows.find((x) => x.kind === 'consolidation') ?? null
    if (superseded.length === 0) continue
    seen = true
    assert.ok(row, `${name}: a step found existing coverage, so the consolidation row exists`)
    for (const s of superseded) assert.ok(row!.lists.overlaps.some(line => line.startsWith(s)), `${name}: the row names ${s}`)
    // The line renders on those steps and on no done step (its policies are what makes it In place).
    for (const s of r.steps) {
      const ex = stepVars(s, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }) as { existingPolicies: string[] }
      if (s.status === 'done') assert.equal(ex.existingPolicies.length, 0, `${name}: ${s.id} is In place; nothing to consolidate`)
      else if (ex.existingPolicies.length > 0 && (s.kind === 'create' || s.kind === 'adjust')) assert.ok(superseded.includes(ex.existingPolicies.join(', ')), `${name}: ${s.id}'s coverage is on the row`)
    }
  }
  assert.ok(seen, 'a fixture has a step with existing coverage')
})

test('unassessed baseline policies become individual reviews, with no catch-all completion', () => {
  const r = runFixture(fixture('demo'))
  assert.equal(r.schedule.cleanup!.rows.some((x) => x.kind === 'notAssessed'), false)
  const reviews = r.steps.filter((s) => s.id.startsWith('s-review-baseline-'))
  assert.equal(reviews.length, r.coverage.organisation.notAssessed.filter(p => !/IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i.test(p.name)).length)
  assert.ok(reviews.every((s) => s.guidance?.doneWhen && (s.manualReview || s.configurationFindings?.some(f => f.key === 'avd-allowed-population' && f.outcome === 'unknown'))))
  const avd = reviews.find(s => s.configurationFindings?.some(f => f.key === 'avd-allowed-population'))!
  assert.equal(avd.state.satisfied, false, 'an unresolved allowed-user definition is not verified protection')
  assert.equal(avd.manualReview, undefined, 'generic acknowledgement cannot clear the source gate')
  assert.ok(r.steps.some(s => s.id === 's-goal-inforcer-mfa'), 'Inforcer uses its ordinary application-scoped goal')
  assert.ok(!reviews.some(s => /inforcer/i.test(s.id)), 'the old Inforcer review is not duplicated')
})


test('recovery rejects wrong resource tenant, pre-baseline authentication, reused claims and client-only target matches', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const original = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const baseline = new Date(Date.parse(original.at) - 60_000).toISOString()
  for (const change of [
    { resourceTenantId: 'another-tenant' },
    { authenticationAt: baseline },
    { authenticationAt: 'invalid' },
    { at: baseline },
    { freshMethod: false },
    { resourceId: 'wrong-resource', appId: '00000003-0000-0000-c000-000000000000' },
  ]) {
    f.snapshot.signInEvidence[id]!.recoveryCandidates = [{ ...original, ...change }]
    assert.equal(recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, baseline)[0].qualifies, false, JSON.stringify(change))
  }
  f.snapshot.signInEvidence[id]!.recoveryCandidates = [{ ...original, resourceTenantId: f.snapshot.tenantId, authenticationAt: original.at }]
  assert.equal(recoveryCandidateReadings(f.snapshot, id, f.snapshot.asOf, baseline)[0].qualifies, true)
})

test('recovery basis invalidates identity and direct group shape changes without treating a display rename as drift', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const before = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
  const user = f.snapshot.users.find(user => user.id === id)!
  user.displayName = 'Display-only rename'
  assert.equal(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
  user.userPrincipalName = 'changed@demo-fixture.onmicrosoft.com'
  assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], before)
  const next = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
  const groupId = f.mapping.records[EXCLUSIONS_RECORD_KEY]!.resolvedId!
  f.groups.get(groupId)!.directMemberIds = ['unexpected-nested-group']
  assert.notEqual(recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id], next)
})

test('an imported automatic assurance marker cannot replace observed event evidence', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const baseline = new Date(Date.parse(event.at) - 60_000).toISOString()
  const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)
  const evidence = { schema: 1 as const, purpose: 'final' as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: 'forged', eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, assurance: 'automatic-complete-candidates', configurationObservedAt: baseline }
  let checkpoints = withCleanupDone([], 'drill', baseline.slice(0,10), baseline, { accountIds: [id], purpose: 'final', tenantId: f.snapshot.tenantId, workflow: RECOVERY_PREPARATION_WORKFLOW, configurationObservedAt: baseline, accountBasis: basis })
  checkpoints = withCleanupDone(checkpoints, 'drill', event.at.slice(0,10), f.snapshot.asOf, { accountIds: [id], purpose: 'final', outcome: 'passed', accountBasis: basis, recoveryEvidence: { [id]: evidence } })
  assert.equal(latestRecoveryTest(id, cleanupRecord(checkpoints).records!, f.snapshot.asOf, basis[id], { readings: [], tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }), null)
})


test('a confirmed failure cannot be cleared by recording an older successful event again', () => {
  const f = fixture('demo-week2')
  const id = f.mapping.breakGlassUserIds[0]
  const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]
  const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)[id]
  const failureAt = new Date(Date.parse(event.at) + 60_000).toISOString()
  let checkpoints = withCleanupDone(f.checkpoints ?? [], 'drill', failureAt.slice(0,10), failureAt, { purpose: 'final', outcome: 'failed', accountIds: [id] })
  const oldPass = cleanupRecord(f.checkpoints ?? []).records!.find(r => r.outcome === 'passed')!
  checkpoints = [...checkpoints, { ...oldPass, at: f.snapshot.asOf }]
  const context = { readings: recoveryCandidateReadings(f.snapshot, id), tenantId: f.snapshot.tenantId, currentSnapshotObservedAt: f.snapshot.asOf }
  assert.equal(latestRecoveryTest(id, cleanupRecord(checkpoints).records!, f.snapshot.asOf, basis, context), null)
})
