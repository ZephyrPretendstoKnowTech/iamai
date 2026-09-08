// Task 021: the baseline-update review reads the author's *policies*, not the
// files GitHub says moved.
//
// The regression these fixtures encode is the audited Aug-29-to-Sep-3 comparison
// (8461e0f2…→90d9b890…). The author renamed one Conditional Access policy and
// strengthened it; because his repository keeps every policy in both
// Updated/Policies/ and Updated/Documentation/, and because a rename arrives as
// an added file plus a removed file, the compare reported four JSON file events
// and the old review drew four changed-policy rows — one of them "removed" with
// the step attached and one "added" with no step changes at all.
//
// The policy id never moved. Everything below is one policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PINNED } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP } from '../roadmap/goalMap.ts'
import { comparePolicies } from '../baseline/semantics.ts'
import { normalizePolicy } from '../baseline/normalize.ts'
import { memberIdentity, policyChanges, sourceSet, stepsForChange } from './baselineDiff.ts'
import type { SourceArtifact } from './baselineDiff.ts'
import { mockAuthorUpdate } from '../testing/authorUpdate.ts'
import { baselineTile } from '../ui/scan/connectView.ts'

// ---------------------------------------------------------------- the fixture

const REG_ID = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const OLD_NAME = 'IAC - INTUNE – GRANT – Device Registration from trusted location'
const NEW_NAME = 'IAC - INTUNE – GRANT - Device Registration - MFA Strength'
const BUILT_IN_MFA = '00000000-0000-0000-0000-000000000002'
const MODERN_MFA_TAP = '42de22a7-5339-4a58-b560-28565d53b14d'
const NEW_EXCLUDED_GROUP = '5628ad67-f9d1-4495-abe3-99dc8f9074f1'
const EXISTING_EXCLUDED_GROUP = '1f0f8ad1-9d3d-4a1e-9a12-2b6f0c2b7a55'
const TRUSTED_LOCATION = 'c8f1b0e4-2a77-4c9f-9d4a-1f7a2f0b6d31'

/** The author's export, before: the built-in Multifactor authentication strength. */
const registrationBefore = {
  id: REG_ID,
  displayName: OLD_NAME,
  state: 'enabled',
  conditions: {
    users: { includeUsers: ['All'], excludeGroups: [EXISTING_EXCLUDED_GROUP] },
    applications: { includeUserActions: ['urn:user:registerdevice'] },
    clientAppTypes: ['all'],
    locations: { includeLocations: ['All'], excludeLocations: [TRUSTED_LOCATION] },
  },
  grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: BUILT_IN_MFA, displayName: 'Multifactor authentication' } },
  sessionControls: null,
}

/** The author's export, after: renamed, a custom strength, and one more excluded group. */
const registrationAfter = {
  id: REG_ID,
  displayName: NEW_NAME,
  state: 'enabled',
  conditions: {
    users: { includeUsers: ['All'], excludeGroups: [EXISTING_EXCLUDED_GROUP, NEW_EXCLUDED_GROUP] },
    applications: { includeUserActions: ['urn:user:registerdevice'] },
    clientAppTypes: ['all'],
    locations: { includeLocations: ['All'], excludeLocations: [TRUSTED_LOCATION] },
  },
  grantControls: {
    operator: 'OR',
    builtInControls: [],
    authenticationStrength: {
      id: MODERN_MFA_TAP,
      displayName: 'Modern MFA + TAP',
      allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor', 'temporaryAccessPassOneTime'],
    },
  },
  sessionControls: null,
}

const at = (dir: string, name: string, body: unknown): SourceArtifact => ({ path: `Updated/${dir}/${name.replace(/[^\w-]+/g, '-')}.json`, text: JSON.stringify(body) })
const doc = (name: string, body: unknown): SourceArtifact => ({ path: `Updated/Documentation/${name.replace(/[^\w-]+/g, '-')}/policy.json`, text: JSON.stringify(body) })

/** Both source copies, at each commit: four JSON file events for one evolving policy. */
const baseFiles: SourceArtifact[] = [at('Policies', OLD_NAME, registrationBefore), doc(OLD_NAME, registrationBefore)]
const headFiles: SourceArtifact[] = [at('Policies', NEW_NAME, registrationAfter), doc(NEW_NAME, registrationAfter)]

const reviewOf = (base: SourceArtifact[], head: SourceArtifact[]) => policyChanges(sourceSet(base), sourceSet(head))

// ------------------------------------------------------- A. one evolving policy

test('A. four file events for one renamed, modified policy collapse to one change on the stable policy id', () => {
  assert.equal(baseFiles.length + headFiles.length, 4, 'the compare saw four JSON file events')
  const changes = reviewOf(baseFiles, headFiles)
  assert.equal(changes.length, 1, `one evolving policy, not ${changes.length} files: ${JSON.stringify(changes.map((c) => c.newName ?? c.oldName))}`)
  const [c] = changes
  assert.equal(c.key, REG_ID, 'the stable policy id is what proves continuity')
  assert.equal(c.identity, 'id')
  assert.equal(c.kind, 'renamedChanged')
  assert.equal(c.renamed, true)
  assert.equal(c.oldName, OLD_NAME)
  assert.equal(c.newName, NEW_NAME)
  assert.deepEqual(c.unreviewed, [], 'every changed field is one the baseline model represents')
})

// -------------------------------------------------- B. the material delta shows

test('B. the review exposes the authentication-strength change and the extra excluded group as material, not as formatting noise', () => {
  const [c] = reviewOf(baseFiles, headFiles)
  const strength = c.deltas.find((d) => d.field === 'authenticationStrength')
  assert.ok(strength, `no authentication-strength delta in ${JSON.stringify(c.deltas)}`)
  assert.deepEqual(strength, { field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' })
  const groups = c.deltas.find((d) => d.field === 'excludeGroups')
  assert.deepEqual(groups, { field: 'excludeGroups', kind: 'added', n: 1 }, 'one more excluded group')
  // The allowed combinations moved with the strength; they are inside the same field, not a second claim.
  assert.equal(c.deltas.filter((d) => d.field === 'authenticationStrength').length, 1)
  // Nothing else moved: the locations and the user action are the same policy.
  assert.deepEqual(c.deltas.map((d) => d.field).sort(), ['authenticationStrength', 'excludeGroups'])

  // As a person reads it on the Baseline tile.
  const tile = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, loading: null, update: { date: '2026-09-03T10:00:00Z', changes: reviewOf(baseFiles, headFiles) }, stepsFor: (ch) => stepsForChange(ch, PINNED_GOAL_MAP) })
  assert.ok(tile.update)
  assert.match(tile.update.summary, /· 1 policy changed · review$/, `the count is policies, not files: "${tile.update.summary}"`)
  assert.equal(tile.update.rows.length, 1)
  const [row] = tile.update.rows
  assert.equal(row.tag, 'renamed and changed')
  assert.equal(row.policy, NEW_NAME)
  assert.equal(row.was, `was ${OLD_NAME}`)
  // In the model's own order: who it applies to, then what it demands.
  assert.deepEqual(row.deltas, ['Excluded groups: 1 added', 'Authentication strength: now Modern MFA + TAP'])
})

// -------------------------------------------------- C. step attribution survives

test('C. the renamed policy keeps its goal and its step, because the goal map keys by the same stable id', () => {
  assert.deepEqual(PINNED_GOAL_MAP['device-registration-mfa'], [REG_ID], 'the pinned map holds this policy by id')
  const [c] = reviewOf(baseFiles, headFiles)
  const steps = stepsForChange(c, PINNED_GOAL_MAP)
  assert.deepEqual(steps, ['Require MFA to Register a Device'])
  // The old review showed the removed file with the step and the added file with none.
  const tile = baselineTile({ name: 'x', policyCount: 38, loading: null, update: { date: '2026-09-03T10:00:00Z', changes: [c] }, stepsFor: (ch) => stepsForChange(ch, PINNED_GOAL_MAP) })
  assert.ok(tile.update)
  assert.deepEqual(tile.update.rows[0].steps, ['changes Require MFA to Register a Device'])
})

// ------------------------------------ D/E. duplicate copies: collapse or refuse

test('D. two equivalent source copies of one policy at a commit are one member, however they are spelled', () => {
  // The documentation copy is a PowerShell-cased export with the same meaning:
  // reordered lists, an empty container where the other has none, a null block.
  const documentationCopy = {
    Id: REG_ID,
    DisplayName: OLD_NAME,
    State: 'enabled',
    Conditions: {
      Users: { IncludeUsers: ['All'], ExcludeGroups: [EXISTING_EXCLUDED_GROUP], ExcludeUsers: [] },
      Applications: { IncludeUserActions: ['urn:user:registerdevice'], ExcludeApplications: [] },
      ClientAppTypes: ['all'],
      Locations: { IncludeLocations: ['All'], ExcludeLocations: [TRUSTED_LOCATION] },
      Platforms: null,
    },
    GrantControls: { Operator: 'OR', BuiltInControls: [], AuthenticationStrength: { Id: BUILT_IN_MFA, DisplayName: 'Multifactor authentication' } },
    SessionControls: null,
  }
  const set = sourceSet([at('Policies', OLD_NAME, registrationBefore), doc(OLD_NAME, documentationCopy)])
  assert.equal(set.members.length, 1, 'one policy, two representations')
  assert.equal(set.conflicts.length, 0)
  assert.deepEqual(set.members[0].paths.length, 2)
  // And nothing about that pair reads as a change.
  assert.deepEqual(policyChanges(sourceSet([at('Policies', OLD_NAME, registrationBefore)]), set), [])
})

test('E. two source copies with the same id that say different things are not silently deduplicated', () => {
  const weaker = { ...registrationBefore, grantControls: { operator: 'OR', builtInControls: ['mfa'], authenticationStrength: null } }
  const set = sourceSet([at('Policies', OLD_NAME, registrationBefore), doc(OLD_NAME, weaker)])
  assert.equal(set.members.length, 0, 'neither copy is taken as the answer')
  assert.equal(set.conflicts.length, 1)
  assert.equal(set.conflicts[0].key, REG_ID)
  const changes = policyChanges(sourceSet(baseFiles), set)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].kind, 'unknown')
  assert.equal(changes[0].reason, 'conflictingCopies')
  const tile = baselineTile({ name: 'x', policyCount: 38, loading: null, update: { date: '2026-09-03T10:00:00Z', changes }, stepsFor: () => [] })
  assert.ok(tile.update)
  assert.equal(tile.update.rows[0].tag, 'not reviewed')
  assert.match(tile.update.rows[0].deltas.join(' '), /two copies of this that say different things/)
})

// ------------------------------------------- F. different ids are never paired

test('F. two policies with different ids are an addition and a removal, however alike their names are', () => {
  const other = { ...registrationBefore, id: 'd7c2c2c9-4f7c-49a2-9e2f-1c4a5b6d7e8f', displayName: `${OLD_NAME} (copy)` }
  const changes = reviewOf([at('Policies', OLD_NAME, registrationBefore)], [at('Policies', 'other', other)])
  assert.deepEqual(changes.map((c) => c.kind).sort(), ['added', 'removed'])
  assert.equal(new Set(changes.map((c) => c.key)).size, 2)
})

// ------------------------------------------------ G. an id-less policy stays put

test('G. an id-less policy is matched only by the stable fallback name; renaming one is never called a rename', () => {
  const { placeholders: _p, ...noId } = { ...registrationBefore, id: undefined, placeholders: {} } as Record<string, unknown>
  delete noId.id
  const renamed = { ...noId, displayName: 'IAC - INTUNE - GRANT - Registration' }
  assert.equal(memberIdentity(noId as { displayName: string }).identity, 'name')

  // Same name, changed body: the fallback identity proves continuity, so it is one change.
  const strengthened = { ...noId, state: 'disabled' }
  const same = reviewOf([at('Policies', 'a', noId)], [at('Policies', 'a', strengthened)])
  assert.equal(same.length, 1)
  assert.equal(same[0].kind, 'changed')
  assert.equal(same[0].identity, 'name')

  // Renamed with no id: nothing proves they are the same policy, so nothing claims it.
  const moved = reviewOf([at('Policies', 'a', noId)], [at('Policies', 'b', renamed)])
  assert.deepEqual(moved.map((c) => c.kind).sort(), ['added', 'removed'])
  for (const c of moved) assert.equal(c.renamed, false, 'no row claims a rename it cannot prove')
})

// ------------------------- H. normalisation collapses representation, not meaning

test('H. representation-only differences are not changes, and a real grant or scope change still is', () => {
  const reordered = {
    ...registrationBefore,
    conditions: {
      ...registrationBefore.conditions,
      // Reordered sets, an empty container, an absent one and a null one.
      users: { excludeGroups: [EXISTING_EXCLUDED_GROUP], includeUsers: ['All'], excludeUsers: [] },
      locations: { excludeLocations: [TRUSTED_LOCATION], includeLocations: ['All'] },
      platforms: null,
      devices: { deviceFilter: null },
    },
    sessionControls: {},
    description: 'wording the author changed',
    modifiedDateTime: '2026-09-03T00:00:00Z',
  }
  const cmp = comparePolicies(normalizePolicy(registrationBefore), normalizePolicy(reordered))
  assert.deepEqual(cmp.changed, [], `representation is not meaning: ${JSON.stringify(cmp.changed)}`)
  assert.deepEqual(cmp.unreviewed, [])

  // The casing of a whole export is the parser's job, and it stays equivalent here too.
  const pascal = { Id: REG_ID, DisplayName: OLD_NAME, State: 'Enabled', Conditions: { Users: { IncludeUsers: ['all'], ExcludeGroups: [EXISTING_EXCLUDED_GROUP.toUpperCase()] }, Applications: { IncludeUserActions: ['urn:user:registerdevice'] }, ClientAppTypes: ['All'], Locations: { IncludeLocations: ['All'], ExcludeLocations: [TRUSTED_LOCATION] } }, GrantControls: { Operator: 'or', BuiltInControls: [], AuthenticationStrength: { Id: BUILT_IN_MFA.toUpperCase(), DisplayName: 'Multifactor authentication' } } }
  assert.deepEqual(comparePolicies(normalizePolicy(registrationBefore), normalizePolicy(pascal)).changed, [])

  // A real change is still a change: a grant control, a scope, and a state.
  const stronger = { ...registrationBefore, state: 'disabled', grantControls: { ...registrationBefore.grantControls, builtInControls: ['compliantDevice'] }, conditions: { ...registrationBefore.conditions, users: { includeUsers: ['All'], excludeGroups: [] } } }
  const real = comparePolicies(normalizePolicy(registrationBefore), normalizePolicy(stronger))
  assert.deepEqual(real.changed.map((c) => c.field).sort(), ['builtInControls', 'excludeGroups', 'state'])

  // A field the baseline model does not represent is reported, never dropped.
  const unmodelled = { ...registrationBefore, conditions: { ...registrationBefore.conditions, someFutureCondition: { includeThings: ['x'] } } }
  const unknown = comparePolicies(normalizePolicy(registrationBefore), normalizePolicy(unmodelled))
  assert.deepEqual(unknown.changed, [])
  assert.deepEqual(unknown.unreviewed, ['conditions.someFutureCondition.includeThings'])
  const changes = reviewOf([at('Policies', OLD_NAME, registrationBefore)], [at('Policies', OLD_NAME, unmodelled)])
  assert.equal(changes[0].kind, 'unknown', 'a change IAMAI cannot read is never "nothing material changed"')
  assert.equal(changes[0].reason, 'unmodelledField')
})

// ------------------------------------------------ K. unreadable source is unknown

test('K. a source file that will not parse makes the review incomplete, never shorter', () => {
  const broken: SourceArtifact = { path: 'Updated/Policies/broken.json', text: '{ "displayName": "half a policy"' }
  const set = sourceSet([...headFiles, broken])
  assert.equal(set.unreadable.length, 1)
  assert.equal(set.members.length, 1, 'what parsed is still read')
  // A file that holds no policy at all is not a policy artifact and is not an error.
  assert.deepEqual(sourceSet([{ path: 'Updated/Documentation/readme.json', text: '{"note":"docs"}' }]), { members: [], conflicts: [], unreadable: [] })
})

// ------------------------------------------------- the ?author=1 review is real

test('the mock author update runs the real review: one renamed-and-changed row, one added, one changed, one removed', () => {
  const update = mockAuthorUpdate(new Date('2026-09-03T10:00:00.000Z'))
  assert.equal(update.changes.length, 4, JSON.stringify(update.changes.map((c) => [c.kind, c.newName ?? c.oldName])))
  const byKind = new Map(update.changes.map((c) => [c.kind, c]))
  assert.deepEqual([...byKind.keys()].sort(), ['added', 'changed', 'removed', 'renamedChanged'])
  const evolving = byKind.get('renamedChanged')!
  assert.ok(evolving.deltas.some((d) => d.field === 'authenticationStrength'), JSON.stringify(evolving.deltas))
  assert.ok(evolving.deltas.some((d) => d.field === 'excludeGroups'))
  assert.ok(stepsForChange(evolving, PINNED_GOAL_MAP).length >= 1, 'the renamed policy still stands behind its step')

  const tile = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: PINNED.policies.length, loading: null, update, stepsFor: (c) => stepsForChange(c, PINNED_GOAL_MAP) })
  assert.ok(tile.update)
  assert.match(tile.update.summary, /^Updated by its author on .+ · 4 policies changed · review$/)
  assert.equal(tile.update.rows.length, 4)
  assert.ok(tile.update.rows.some((r) => r.steps.some((s) => /^changes /.test(s))), 'a mapped policy names the step it changes')
  assert.ok(tile.update.rows.some((r) => r.steps[0] === 'no step changes'), 'a policy no goal maps to changes no step')
  for (const r of tile.update.rows) {
    assert.ok(r.policy.length > 3 && !/\bpolicy\b/.test(r.policy), `a row names its policy: "${r.policy}"`)
    assert.ok(!/\bpolicy\b/.test(r.steps.join(' ')))
  }
})
