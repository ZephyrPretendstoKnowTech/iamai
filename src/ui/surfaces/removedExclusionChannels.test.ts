import { readyEvidence } from '../../roadmap/fixtures/readyEvidence.ts'
// Review 5 queue 1: a correction that takes a tenant exclusion off named it only in the
// step's portal and export lines (review 3 queue 3). The viewer's package tabs, the
// Entra procedure, AI Info and the called script, drew the same correction without
// it, so an operator copying the script removed an exclusion nobody named. Each
// correction package now names it from `policy.current.removedExclusions` (a set, from
// each member's own), on a line that disappears when nothing is removed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../content/implementation/protocol.ts'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../mapping/safetyChoice.ts'
import { personReadiness } from '../../scoring/phishingResistant.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const B = 'c0100000-0000-4000-8000-000000000002'
const MFA = { operator: 'OR', builtInControls: ['mfa'] }
const EXO = '00000002-0000-0ff1-ce00-000000000000'
const INTUNE_ENROLLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
const GUESTS = { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } }
const said = (names: string) => `This change removes ${names} from the policy's exclusions. If the policy is On, it applies to them as soon as you save.`

type Groups = { staffGroup: string; excl: string }
const pol = (users: Record<string, unknown>, applications: Record<string, unknown> = { includeApplications: ['All'] }) => ({
  id: B, displayName: 'Policy B', state: 'enabled', conditions: { users, applications, clientAppTypes: ['all'] }, grantControls: MFA,
})

/** The staff policy the all-users goal corrects (roadmap/removedExclusions.test.ts), opened in the viewer. */
function opened(rowOf: (g: Groups) => ReturnType<typeof pol>) {
  const base = curatedFixture('demo-week2')
  const f = { ...base, groups: new Map(base.groups) }
  const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
  const staffGroup = [...f.groups.keys()].find((id) => id !== excl)!
  const ca = f.snapshot.config.caPolicies!
  const keep = (ca.rows as { displayName?: string }[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [rowOf({ staffGroup, excl }), ...keep] } } }
  readyEvidence(f, snapshot)
  const scored = runFixture({ ...f, snapshot } as never, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot } as never, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx = { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const body = stepBodyOf(step, ctx)
  assert.deepEqual((step.action.resolution?.policies ?? []).map((o) => [o.mode, o.policyId]), [['update', B]], 'the premise: the staff policy is corrected')
  const tab = (id: string): string => {
    const a = body.artifacts.find((x) => x.id === id)
    assert.ok(a && !a.unavailable, `the ${id} tab is not drawn`)
    return a.text()
  }
  return { tab, nameOf, exported: stepExportView(step, ctx).whatToDo, preview: body.previewNote }
}

test('a correction dropping the guest exclusion names it in the Entra procedure, AI Info and the script it hands over', () => {
  const { tab, exported, preview } = opened(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl], excludeGuestsOrExternalUsers: GUESTS }))
  assert.equal(preview, null, 'the premise: the correction is handed over, not previewed')
  const line = said('guest or external users')
  assert.ok(exported.includes(line), 'the export line these tabs now match')
  const entra = tab('portal')
  assert.ok(entra.includes(line), entra)
  // The consequence appears before the operator starts changing the policy.
  assert.ok(entra.indexOf(line) < entra.search(/^\d+\. Go to\b/m), entra)
  assert.ok(tab('ai').includes(line), tab('ai'))
  const ps = tab('ps')
  assert.ok(ps.includes(`# This change removes guest or external users from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved.`), ps.slice(0, 400))
  assert.match(ps, /^Invoke-IAMAIStep -Mode 'CorrectConditions'/m, 'the script the line sits in is the called correction')
  for (const text of [entra, tab('ai'), ps]) assert.doesNotMatch(text, /\{\{|\[omit /)
})

test('a correction replacing the excluded application names the application, never its id, in every tab', () => {
  const { tab, nameOf } = opened(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl] }, { includeApplications: ['All'], excludeApplications: [EXO] }))
  const line = said(nameOf(EXO))
  for (const id of ['portal', 'ai']) assert.ok(tab(id).includes(line), `${id}: ${tab(id)}`)
  assert.ok(tab('ps').includes(`# This change removes ${nameOf(EXO)} from the policy's exclusions.`))
  for (const id of ['portal', 'ai', 'ps']) assert.ok(!tab(id).split('\n').some((l) => l.includes('This change removes') && l.includes(EXO)), `${id} names the id`)
})

test('control: a correction that keeps every exclusion draws no removal line in any tab', () => {
  const { tab } = opened(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl] }, { includeApplications: ['All'], excludeApplications: [INTUNE_ENROLLMENT] }))
  for (const id of ['portal', 'ai', 'ps']) {
    assert.doesNotMatch(tab(id), /This change removes/, id)
    assert.doesNotMatch(tab(id), /\{\{|\[omit /, id)
  }
})

test('every package that corrects a Conditional Access policy carries the removal line in its correction save, AI Info and script', () => {
  const MEMBERS: Record<string, string[]> = { 's-goal-session-lifetime': ['policies.session.browser', 'policies.session.unmanaged'], 's-goal-guests-mfa': ['policies.guests.strong', 'policies.guests.mixed'] }
  const corrects = Object.entries(PACKAGES).filter(([, pkg]) => /\/identity\/conditionalAccess\/policies\/\{(policy|policies\.[a-zA-Z]+\.[a-z]+)\.current\.id\}/.test(Object.values(pkg.blocks).map((b) => JSON.stringify(b.meta)).join('\n')) || pkg.blocks['powershell.run']?.meta.invocation?.parameters?.StrongPolicyId)
  const ids = corrects.map(([id]) => id).sort()
  assert.ok(ids.length >= 24, ids.join(', '))
  for (const [id, pkg] of corrects) {
    const keys = (MEMBERS[id] ?? ['policy']).map((p) => `{{${p}.current.removedExclusions}}`)
    const partial = JSON.stringify((pkg.meta.projection as Record<string, unknown>).partial)
    const drawn = Object.entries(pkg.blocks).filter(([bid, b]) => partial.includes(`"${bid}"`) && (b.meta.channel === 'entra' || b.meta.channel === 'aiInfo' || b.meta.channel === 'powershell'))
    for (const channel of ['entra', 'aiInfo', 'powershell']) {
      for (const key of keys) assert.ok(drawn.some(([, b]) => b.meta.channel === channel && b.text.includes(key)), `${id}: no ${channel} block of its correction names ${key}`)
    }
    const declared = [...(pkg.meta.requiredBindings ?? []), ...((pkg.meta as { optionalBindings?: string[] }).optionalBindings ?? [])]
    for (const key of keys) assert.ok(declared.includes(key.slice(2, -2)), `${id}: ${key} is not declared`)
  }
})
