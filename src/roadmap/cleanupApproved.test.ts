import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consolidationVerified, replacementPolicyBasis, namingVerified, isLegacyManualDrillRecord, RECOVERY_AUTOMATIC_WORKFLOW, RECOVERY_INVALIDATION_WORKFLOW, RECOVERY_PREPARATION_WORKFLOW } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { cleanupPhaseFor } from './cleanupPhase.ts'
import { cleanupExportView } from '../ui/surfaces/cleanupExport.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

const now = '2026-09-15T18:00:00Z'
const policies = [
  { id: 'a', displayName: 'Staff MFA', state: 'enabled', conditions: { users: { includeUsers: ['All'] } }, grantControls: { builtInControls: ['mfa'] } },
  { id: 'b', displayName: 'Admin MFA', state: 'enabled', conditions: { users: { includeRoles: ['admin'] } }, grantControls: { builtInControls: ['mfa'] } },
]
const retained: CleanupCheckpoint = { at: now, date: now, cleanup: 'consolidation', outcome: 'passed', consolidationDecision: 'retain-both', retainedPolicyIds: ['a', 'b'], retainedPolicyBases: Object.fromEntries(policies.map(p => [p.id, JSON.stringify([p.state, replacementPolicyBasis(p)])])), rationale: 'Different account scopes', policyNames: { a: 'Staff MFA', b: 'Admin MFA' } }
const organisation = { notInBaseline: [], notAssessed: [], consolidation: [], naming: { pattern: null, share: 0, outliers: [], prefix: null, separator: null, convention: null, unprefixed: [], names: [] }, microsoftManaged: [] }
const input = { after: '2026-10-01T12:00:00Z', now, rhythm: null, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [], organisation, policies }

test('Retain Both needs a rationale and the exact current configurations, and completes only the pair it reviewed', () => {
  // Retain Both requires rationale and exact current configurations, preserves renames and ignores unrelated policy changes
  {
    assert.equal(consolidationVerified(retained, policies), true)
    assert.equal(consolidationVerified({ ...retained, rationale: '' }, policies), false)
    assert.equal(consolidationVerified(retained, null), false)
    assert.equal(consolidationVerified(retained, [{ ...policies[0], displayName: 'Renamed' }, policies[1], { id: 'other', state: 'disabled' }]), true)
    assert.equal(consolidationVerified(retained, [{ ...policies[0], state: 'disabled' }, policies[1]]), false)
    assert.equal(consolidationVerified(retained, [policies[0], { ...policies[1], grantControls: { builtInControls: ['block'] } }]), false)
    const phase = cleanupPhaseFor({ ...input, records: [retained] })!
    const row = phase.rows.find(r => r.kind === 'consolidation')!
    assert.equal(row.done, now)
    const exported = cleanupExportView(phase, row)!
    assert.ok(exported.manualEvidence?.some(line => line.includes('Retain Both')))
    assert.ok(exported.manualEvidence?.some(line => line.includes('Different account scopes')))
    assert.ok(exported.manualEvidence?.some(line => line.includes('Staff MFA (a)')))
  }

  // a review of one pair cannot complete another outstanding overlap
  {
    const c = { ...policies[0], id: 'c', displayName: 'Other MFA' }
    const phase = cleanupPhaseFor({ ...input, policies: [...policies, c], records: [retained], organisation: { ...organisation, consolidation: [{ goalId: 'mfa', goalName: 'MFA', policyNames: ['Staff MFA', 'Other MFA'] }] } })!
    assert.equal(phase.rows.find(r => r.kind === 'consolidation')!.done, null)
    assert.ok(phase.rows.find(r => r.kind === 'consolidation')!.lists.overlaps.some(line => line.includes('collected settings match')))
    const different = cleanupPhaseFor({ ...input, records: [retained], organisation: { ...organisation, consolidation: [{ goalId: 'mfa', goalName: 'MFA', policyNames: ['Staff MFA', 'Admin MFA'] }] } })!
    assert.ok(different.rows.find(r => r.kind === 'consolidation')!.lists.overlaps.some(line => line.includes('different user scope and exclusions')))
  }
})

test('a saved naming review is verified on the same ids with tooling confirmed, and cleanupPhaseFor draws no naming row', () => {
  // naming completion requires approved names on the same IDs, no collision, and separate tooling confirmation
  {
    const record: CleanupCheckpoint = { at: now, date: now, cleanup: 'naming', namingChanges: [{ id: 'a', from: 'Staff MFA', to: 'CA - Staff MFA' }], toolingVerified: true }
    assert.equal(namingVerified(record, policies), false)
    const changed = [{ ...policies[0], displayName: 'CA - Staff MFA' }, policies[1]]
    assert.equal(namingVerified(record, changed), true)
    assert.equal(namingVerified({ ...record, toolingVerified: false }, changed), false)
    assert.equal(namingVerified(record, [...changed, { id: 'collision', displayName: 'ca - staff mfa' }]), false)
    // Align Policy Names is added once tracking has read each policy's name
    // (cleanupPhase.ts settleRenames, owner 2026-09-26): a saved review draws no row.
    const phase = cleanupPhaseFor({ ...input, policies: changed, records: [record] })
    assert.equal(phase?.rows.some(r => r.kind === 'naming') ?? false, false)
  }
})

test('a manual date cannot hide a current hardening finding, and Step 4 shows a Recorded Test only for a legacy manual record', () => {
  // resolved deferred hardening remains completed and a manual date cannot hide a current finding
  {
    const passed = cleanupPhaseFor({ ...input, hardeningTracked: true, hardeningVerified: true })!
    assert.equal(passed.rows.find(r => r.kind === 'hardening')!.done, now)
    const failed = cleanupPhaseFor({ ...input, hardeningTracked: true, hardeningVerified: false, hardening: ['Alert delivery needs verification'], records: [{ at: now, date: now, cleanup: 'hardening' }] })!
    assert.equal(failed.rows.find(r => r.kind === 'hardening')!.done, null)
  }

  // Step 4 shows a Recorded Test only for a legacy manual record, never for the automatic sign-in records
  // Overnight review B1: Step 4's Recorded Test is a legacy manual record only. The
  // automatic per-account records (baseline, invalidation, observed sign-in) are
  // already stated by the Sign-in evidence tile, and one of them read as a test of
  // one account that "does not cover the current accounts".
  {
    const accounts = { emergencyAccountIds: ['bg-a', 'bg-b'], emergencyAccounts: ['Breakglass A', 'Breakglass B'], emergencyAccountUpns: ['a@contoso.onmicrosoft.com', 'b@contoso.onmicrosoft.com'] }
    const automatic: CleanupCheckpoint[] = [
      { at: now, date: now, cleanup: 'drill', workflow: RECOVERY_PREPARATION_WORKFLOW, purpose: 'final', tenantId: 't', accountIds: ['bg-a'], configurationObservedAt: now },
      { at: now, date: now, cleanup: 'drill', workflow: RECOVERY_AUTOMATIC_WORKFLOW, outcome: 'passed', purpose: 'final', tenantId: 't', accountIds: ['bg-a'], signInAtByAccount: { 'bg-a': now } },
      { at: now, date: now, cleanup: 'drill', workflow: RECOVERY_INVALIDATION_WORKFLOW, purpose: 'final', tenantId: 't', accountIds: ['bg-b'] },
    ]
    const phase = cleanupPhaseFor({ ...input, ...accounts, records: automatic })!
    const drill = phase.rows.find(r => r.kind === 'drill')!
    assert.equal(drill.record, undefined, 'no Recorded Test section')
    assert.equal(drill.verificationReason, undefined, 'and no "does not cover the current accounts"')
    assert.deepEqual(cleanupExportView(phase, drill)!.manualEvidence, [], 'the export says the same')
    const legacy: CleanupCheckpoint = { at: now, date: now, cleanup: 'drill', outcome: 'passed', accountIds: ['bg-a', 'bg-b'] }
    const withLegacy = cleanupPhaseFor({ ...input, ...accounts, records: [legacy, ...automatic] })!
    const legacyRow = withLegacy.rows.find(r => r.kind === 'drill')!
    assert.equal(legacyRow.record, legacy, 'a legacy manual record is still shown as history')
    assert.equal(isLegacyManualDrillRecord(legacy), true)
    assert.equal(automatic.some(isLegacyManualDrillRecord), false)
  }
})
