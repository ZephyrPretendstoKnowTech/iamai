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
import { cleanupDoneDates, cleanupRecord, drillDates, isRecordedDrill, withCleanupDone, recoveryAccountBasis, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import { renameLine } from './cleanupPhase.ts'
import { supersededPolicies } from './generate.ts'
import { cleanupWhen } from '../ui/surfaces/cleanupExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { absoluteDate } from '../copy/dates.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'

test('a Done records the row and its date in the checkpoints; the latest record per row wins', () => {
  let cps: unknown[] = [{ at: '2026-09-01T00:00:00.000Z', coverage: [] }]
  cps = withCleanupDone(cps, 'drill', '2026-09-03', '2026-09-03T10:00:00.000Z')
  cps = withCleanupDone(cps, 'naming', '2026-09-04', '2026-09-04T10:00:00.000Z')
  cps = withCleanupDone(cps, 'drill', '2026-12-01', '2026-12-01T10:00:00.000Z')
  assert.equal(cps.length, 4, 'the scan checkpoint stays beside the Cleanup records')
  assert.deepEqual(cleanupDoneDates(cps), { drill: '2026-12-01T12:00:00.000Z', naming: '2026-09-04T12:00:00.000Z' })
  assert.deepEqual(drillDates(cps), ['2026-09-03T12:00:00.000Z', '2026-12-01T12:00:00.000Z'], 'every drill date is kept: an older sign-in matches an older drill')
  assert.equal(isRecordedDrill('2026-09-03T02:15:00.000Z', drillDates(cps)), false, 'a legacy date does not identify the tested account')
  assert.ok(!isRecordedDrill('2026-09-05T02:15:00.000Z', drillDates(cps)))
  assert.ok(!isRecordedDrill('2026-09-03T02:15:00.000Z', []))
})

test('an exact drill association exempts the matching emergency sign-in from the recent-sign-in check', () => {
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
  assert.ok(recent.length > 0, 'an emergency account signed in inside the drill window with no recorded drill: the step asks who and why')
  assert.match(String(recent[0].values.ago), /\d+ days ago/, 'the line says how long ago')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => before.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  // The recent sign-in is resilience hardening, so its line is under the step's hardening, not its minimum (validation/emergencyTiers.ts).
  const ex = stepVars(bg, ctx) as { failingChecks: [string, Record<string, unknown>][]; hardeningChecks: [string, Record<string, unknown>][] }
  assert.ok([...ex.failingChecks, ...ex.hardeningChecks].some(([fix, vals]) => fix === 'recent-sign-in' && typeof vals.name === 'string' && /days ago/.test(String(vals.ago))), 'the check fix line fills {name} and {ago}')

  const accountBasis = recoveryAccountBasis(f.snapshot, f.mapping.breakGlassUserIds, f.mapping, f.groups)
  const configurationObservedAt = new Date(Math.min(...f.mapping.breakGlassUserIds.map(id => Date.parse(f.snapshot.signInEvidence[id]!.recoveryCandidates![0].at))) - 3_600_000).toISOString()
  const recoveryEvidence = Object.fromEntries(f.mapping.breakGlassUserIds.map((id) => { const event = f.snapshot.signInEvidence[id]!.recoveryCandidates![0]; return [id, { schema: 1 as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: event.eventId, eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt } ] }))
  let checkpoints = withCleanupDone([], 'drill', configurationObservedAt.slice(0, 10), configurationObservedAt, { accountIds: f.mapping.breakGlassUserIds, workflow: RECOVERY_PREPARATION_WORKFLOW, tenantId: f.snapshot.tenantId, configurationObservedAt, accountBasis, timeZone: 'UTC' })
  checkpoints = withCleanupDone(checkpoints, 'drill', signIn.slice(0, 10), f.snapshot.asOf, { accountIds: f.mapping.breakGlassUserIds, outcome: 'passed', accountBasis, recoveryEvidence, signInAtByAccount: Object.fromEntries(f.mapping.breakGlassUserIds.map(id => [id, f.snapshot.users.find(u => u.id === id)!.lastSuccessfulSignIn!])), timeZone: 'UTC' })
  const drilled = runFixture(f, { cleanupRecord: cleanupRecord(checkpoints) })
  const bgAfter = drilled.steps.find((s) => s.id === 's-prereq-break-glass')!
  assert.equal(bgAfter.checks!.items.filter((it) => it.fix === 'recent-sign-in').length, 0, 'a sign-in on a recorded drill day is the drill')
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
  const evidence = { [id]: { schema: 1 as const, tenantId: f.snapshot.tenantId, accountId: id, eventId: 'fabricated-event-id', eventAt: event.at, appId: event.appId, resourceId: event.resourceId, method: 'Passkey (FIDO2)' as const, provenance: 'observed-sign-in' as const, recoveryConfirmed: true as const, credentialConfirmed: true as const, configurationObservedAt: configuredAt } }
  const basis = recoveryAccountBasis(f.snapshot, [id], f.mapping, f.groups)
  let checkpoints = withCleanupDone([], 'drill', configuredAt.slice(0, 10), configuredAt, { accountIds: [id], workflow: RECOVERY_PREPARATION_WORKFLOW, tenantId: f.snapshot.tenantId, configurationObservedAt: configuredAt, accountBasis: basis })
  checkpoints = withCleanupDone(checkpoints, 'drill', event.at.slice(0, 10), f.snapshot.asOf, { accountIds: [id], outcome: 'passed', accountBasis: basis, recoveryEvidence: evidence })
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
