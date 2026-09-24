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
import { PINNED_GOAL_MAP } from '../roadmap/goalMap.ts'
import { comparePolicies, samePolicySemantics } from '../baseline/semantics.ts'
import { normalizePolicy } from '../baseline/normalize.ts'
import { memberIdentity, policyChanges, sourceSet, stepsForChange } from './baselineDiff.ts'
import type { SourceArtifact } from './baselineDiff.ts'
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

test('A–C. four file events for one renamed, modified policy are one change on the stable policy id, with its material deltas, and it keeps its step', () => {
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

  // B. The authentication-strength change and the extra excluded group are material, not formatting noise.
  assert.deepEqual(c.deltas.find((d) => d.field === 'authenticationStrength'), { field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' })
  assert.deepEqual(c.deltas.find((d) => d.field === 'excludeGroups'), { field: 'excludeGroups', kind: 'added', n: 1 }, 'one more excluded group')
  // The allowed combinations moved with the strength; nothing else moved.
  assert.deepEqual(c.deltas.map((d) => d.field).sort(), ['authenticationStrength', 'excludeGroups'])

  // C. The renamed policy keeps its goal and its step, because the goal map keys by the same stable id.
  assert.deepEqual(PINNED_GOAL_MAP['device-registration-mfa'], [REG_ID], 'the pinned map holds this policy by id')
  assert.deepEqual(stepsForChange(c, PINNED_GOAL_MAP), ['Require MFA to Register a Device'])
  // As a person reads it on the Baseline tile: one row, counted as policies, not files.
  const tile = baselineTile({ name: 'x', policyCount: 38, loading: null, update: { date: '2026-09-03T10:00:00Z', changes }, stepsFor: (ch) => stepsForChange(ch, PINNED_GOAL_MAP) })
  assert.ok(tile.update)
  assert.equal(tile.update.rows.length, 1)
  assert.equal(tile.update.rows[0].policy, NEW_NAME)
  assert.deepEqual(tile.update.rows[0].steps, ['changes Require MFA to Register a Device'])
})

// ------------------------------------ D/E/K. duplicate copies: collapse or refuse

test('D/E/K. source copies at one commit: equivalent copies are one member, copies that disagree are refused, and an unreadable file makes the review incomplete', () => {
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

  // E. Two copies with the same id that say different things are not silently deduplicated.
  const weaker = { ...registrationBefore, grantControls: { operator: 'OR', builtInControls: ['mfa'], authenticationStrength: null } }
  const refused = sourceSet([at('Policies', OLD_NAME, registrationBefore), doc(OLD_NAME, weaker)])
  assert.equal(refused.members.length, 0, 'neither copy is taken as the answer')
  assert.equal(refused.conflicts.length, 1)
  assert.equal(refused.conflicts[0].key, REG_ID)
  const changes = policyChanges(sourceSet(baseFiles), refused)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].kind, 'unknown')
  assert.equal(changes[0].reason, 'conflictingCopies')
  const tile = baselineTile({ name: 'x', policyCount: 38, loading: null, update: { date: '2026-09-03T10:00:00Z', changes }, stepsFor: () => [] })
  assert.ok(tile.update)
  assert.equal(tile.update.rows[0].tag, 'not reviewed')

  // K. A source file that will not parse makes the review incomplete, never shorter.
  const broken: SourceArtifact = { path: 'Updated/Policies/broken.json', text: '{ "displayName": "half a policy"' }
  const partial = sourceSet([...headFiles, broken])
  assert.equal(partial.unreadable.length, 1)
  assert.equal(partial.members.length, 1, 'what parsed is still read')
  // A file that holds no policy at all is not a policy artifact and is not an error.
  assert.deepEqual(sourceSet([{ path: 'Updated/Documentation/readme.json', text: '{"note":"docs"}' }]), { members: [], conflicts: [], unreadable: [] })
})

// ------------------------------------------- F. different ids are never paired

test('F/G. different ids are never paired, and an id-less policy is matched only by its name: renaming one is never called a rename', () => {
  const other = { ...registrationBefore, id: 'd7c2c2c9-4f7c-49a2-9e2f-1c4a5b6d7e8f', displayName: `${OLD_NAME} (copy)` }
  const changes = reviewOf([at('Policies', OLD_NAME, registrationBefore)], [at('Policies', 'other', other)])
  assert.deepEqual(changes.map((c) => c.kind).sort(), ['added', 'removed'])
  assert.equal(new Set(changes.map((c) => c.key)).size, 2)

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

test('H/I3. representation-only differences are not changes; a real grant, scope or session change still is; a control the model does not name is unreviewed', () => {
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

  // I3. A session control IAMAI has never heard of still changes what the policy
  // does, so it is reported as a change nobody has established.
  const sessionBefore = { ...registrationAfter, sessionControls: { signInFrequency: { isEnabled: true, value: 12, type: 'hours' } } }
  const sessionAfter = { ...registrationAfter, sessionControls: { signInFrequency: { isEnabled: true, value: 12, type: 'hours' }, someFutureSessionControl: { isEnabled: true } } }
  const future = comparePolicies(normalizePolicy(sessionBefore), normalizePolicy(sessionAfter))
  assert.deepEqual(future.changed, [], 'the block is not reported as a field the model read')
  assert.deepEqual(future.unreviewed, ['sessionControls.someFutureSessionControl.isEnabled'])
  const [row] = reviewOf([at('Policies', NEW_NAME, sessionBefore)], [at('Policies', NEW_NAME, sessionAfter)])
  assert.equal(row.kind, 'unknown')
  assert.equal(row.reason, 'unmodelledField')
  // A session control the model does name is material.
  const shorter = { ...registrationAfter, sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours' } } }
  const session = comparePolicies(normalizePolicy(sessionBefore), normalizePolicy(shorter))
  assert.deepEqual(session.changed.map((c) => c.field), ['sessionControls'])
  assert.deepEqual(session.unreviewed, [])
})

// ------------------------- I. an expanded Graph object is not a policy change

/**
 * The strength as the author's own repository holds it: the pinned package
 * carries `authenticationStrength` fully expanded, so the referenced tenant
 * object's own record — its timestamps, its policyType, its OData annotations —
 * travels inside the policy. None of that is something the author wrote.
 */
const expandedStrength = (id: string, modified: string, combinations: string[]) => ({
  id,
  createdDateTime: '2026-05-04T23:40:40.6249015Z',
  modifiedDateTime: modified,
  displayName: 'Modern MFA + TAP',
  description: '',
  policyType: 'custom',
  requirementsSatisfied: 'mfa',
  allowedCombinations: combinations,
  'combinationConfigurations@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#x',
  combinationConfigurations: [],
})

const TAP_COMBINATIONS = ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor', 'temporaryAccessPassOneTime']

const withStrength = (strength: unknown) => ({
  ...registrationAfter,
  grantControls: { operator: 'OR', builtInControls: [], 'authenticationStrength@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#strength', authenticationStrength: strength },
})

test('I/I2. a re-export that only moved the referenced strength object’s own record is not a policy change; the strength’s id and combinations still are', () => {
  const before = withStrength(expandedStrength(MODERN_MFA_TAP, '2026-08-12T13:23:05.2711028Z', TAP_COMBINATIONS))
  const after = withStrength(expandedStrength(MODERN_MFA_TAP, '2026-09-06T09:41:11.5000000Z', TAP_COMBINATIONS))

  // 1. Two copies at one commit that differ only in that record are one member.
  const set = sourceSet([at('Policies', NEW_NAME, before), doc(NEW_NAME, after)])
  assert.equal(set.conflicts.length, 0, `a moved timestamp is not two copies that disagree: ${JSON.stringify(set.conflicts)}`)
  assert.equal(set.members.length, 1)

  // 2. And a commit that only refreshed the export draws no review row at all.
  const cmp = comparePolicies(normalizePolicy(before), normalizePolicy(after))
  assert.deepEqual(cmp.changed, [], `nothing the author wrote moved: ${JSON.stringify(cmp.changed)}`)
  assert.deepEqual(cmp.unreviewed, [], 'a timestamp is not an unreviewable change either')
  assert.deepEqual(reviewOf([at('Policies', NEW_NAME, before)], [at('Policies', NEW_NAME, after)]), [])

  // The depth of the export is the exporter's choice: the same strength written
  // as a bare id means the same thing as the expanded projection of it.
  const bare = withStrength({ id: MODERN_MFA_TAP, displayName: 'Modern MFA + TAP', allowedCombinations: TAP_COMBINATIONS })
  assert.deepEqual(reviewOf([at('Policies', NEW_NAME, before)], [at('Policies', NEW_NAME, bare)]), [])

  // I2. The strength the policy points at is still material: its id and the combinations it allows.
  const builtIn = withStrength(expandedStrength(BUILT_IN_MFA, '2026-08-12T13:23:05.2711028Z', ['password,microsoftAuthenticatorPush']))
  const strength = comparePolicies(normalizePolicy(builtIn), normalizePolicy(after))
  assert.deepEqual(strength.changed.map((c) => c.field), ['authenticationStrength'], 'a different strength is a change')
  assert.deepEqual(strength.unreviewed, [])
  const widened = withStrength(expandedStrength(MODERN_MFA_TAP, '2026-08-12T13:23:05.2711028Z', [...TAP_COMBINATIONS, 'deviceBasedPush']))
  assert.deepEqual(comparePolicies(normalizePolicy(after), normalizePolicy(widened)).changed.map((c) => c.field), ['authenticationStrength'])
  const [row] = reviewOf([at('Policies', NEW_NAME, builtIn)], [at('Policies', NEW_NAME, after)])
  assert.deepEqual(row.deltas, [{ field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' }])
  assert.equal(row.kind, 'changed')
})

test('I4/I5. a strength’s combination configuration and a nested object’s type are never lost inside the reference; an OData context is nothing', () => {
  // What a combination configuration does: the strength still allows fido2, but
  // only these authenticators satisfy it. Narrowing or widening that list
  // materially changes who can sign in, and the id does not move when it does.
  const fido2Only = (aaGuids: string[]) => [{ '@odata.type': '#microsoft.graph.fido2CombinationConfiguration', id: 'a6b2f5e0-1f7c-4a3a-9c1a-2b3c4d5e6f70', appliesToCombinations: ['fido2'], allowedAAGUIDs: aaGuids }]
  const plain = expandedStrength(MODERN_MFA_TAP, '2026-08-12T13:23:05.2711028Z', TAP_COMBINATIONS)
  const restricted = { ...plain, combinationConfigurations: fido2Only(['de1e552d-db1d-4423-a619-566b625cdc84']) }
  const widened = { ...plain, combinationConfigurations: fido2Only(['de1e552d-db1d-4423-a619-566b625cdc84', '7d2a3b1c-0000-4c1d-9f00-11223344aabb']) }

  // 1. Adding a configuration to the strength the policy points at cannot read
  //    as no change, even though the id and the allowed combinations are equal.
  const added = comparePolicies(normalizePolicy(withStrength(plain)), normalizePolicy(withStrength(restricted)))
  assert.deepEqual(added.changed, [], 'the model does not claim to have read the configuration')
  assert.deepEqual(added.unreviewed, ['grantControls.authenticationStrength.combinationConfigurations'], `a configured strength must be reported: ${JSON.stringify(added)}`)
  const [row] = reviewOf([at('Policies', NEW_NAME, withStrength(plain))], [at('Policies', NEW_NAME, withStrength(restricted))])
  assert.equal(row.kind, 'unknown', 'the review says it has not established the change')
  assert.equal(row.reason, 'unmodelledField')

  // 2. And so does a configuration whose own contents moved.
  const moved = comparePolicies(normalizePolicy(withStrength(restricted)), normalizePolicy(withStrength(widened)))
  assert.deepEqual(moved.changed, [])
  assert.deepEqual(moved.unreviewed, ['grantControls.authenticationStrength.combinationConfigurations'])

  // 3. Two copies at one commit that disagree about the configuration fail
  //    closed: neither is taken as the answer.
  assert.equal(samePolicySemantics(normalizePolicy(withStrength(restricted)), normalizePolicy(withStrength(widened))), false)
  const set = sourceSet([at('Policies', NEW_NAME, withStrength(restricted)), doc(NEW_NAME, withStrength(widened))])
  assert.equal(set.members.length, 0, 'a same-id copy that disagrees is not collapsed away')
  assert.equal(set.conflicts.length, 1)

  // 4. The referenced object's own record is still representation: an export
  //    that only re-wrote its wording is not a change and not unreviewed.
  const reworded = { ...plain, description: 'Modern MFA plus a temporary access pass', policyType: 'custom', requirementsSatisfied: 'mfa' }
  const record = comparePolicies(normalizePolicy(withStrength(plain)), normalizePolicy(withStrength(reworded)))
  assert.deepEqual(record.changed, [])
  assert.deepEqual(record.unreviewed, [], `the strength object's own record is the exporter's, not the author's: ${JSON.stringify(record)}`)

  // I5. A nested object's type is what it is, not how it was fetched.
  // `@odata.type` names the derived type of the object it sits on: a FIDO2
  // combination configuration restricts which authenticators satisfy the
  // combination, an X.509 one restricts which issuers do. Two strengths sharing
  // an id, an allowed-combinations list and a configuration id can still mean
  // different things, and the discriminator is the only field that says so.
  const config = (type: string) => [{ '@odata.type': type, id: 'a6b2f5e0-1f7c-4a3a-9c1a-2b3c4d5e6f70', appliesToCombinations: ['fido2'] }]
  const asFido2 = { ...plain, combinationConfigurations: config('#microsoft.graph.fido2CombinationConfiguration') }
  const asX509 = { ...plain, combinationConfigurations: config('#microsoft.graph.x509CertificateCombinationConfiguration') }

  // 1. The change is reported, as one the model has not read.
  const retyped = comparePolicies(normalizePolicy(withStrength(asFido2)), normalizePolicy(withStrength(asX509)))
  assert.deepEqual(retyped.changed, [], 'the model does not claim to have read the configuration')
  assert.deepEqual(retyped.unreviewed, ['grantControls.authenticationStrength.combinationConfigurations'], `a changed type discriminator must be reported: ${JSON.stringify(retyped)}`)
  const [retypedRow] = reviewOf([at('Policies', NEW_NAME, withStrength(asFido2))], [at('Policies', NEW_NAME, withStrength(asX509))])
  assert.equal(retypedRow.kind, 'unknown')
  assert.equal(retypedRow.reason, 'unmodelledField')

  // 2. Two copies at one commit that disagree only about that type fail closed.
  assert.equal(samePolicySemantics(normalizePolicy(withStrength(asFido2)), normalizePolicy(withStrength(asX509))), false)
  const typeSet = sourceSet([at('Policies', NEW_NAME, withStrength(asFido2)), doc(NEW_NAME, withStrength(asX509))])
  assert.equal(typeSet.members.length, 0, 'a same-id copy that disagrees about a nested type is not collapsed away')
  assert.equal(typeSet.conflicts.length, 1)

  // 3. The fetch's own bookkeeping still normalizes away at every depth: a
  //    re-export that only moved an OData context is not a policy change.
  const refetched = { ...asFido2, 'combinationConfigurations@odata.context': 'https://graph.microsoft.com/beta/$metadata#refetched' }
  const refetchedCmp = comparePolicies(normalizePolicy(withStrength(asFido2)), normalizePolicy(withStrength(refetched)))
  assert.deepEqual(refetchedCmp.changed, [])
  assert.deepEqual(refetchedCmp.unreviewed, [], `an OData context is the fetch's, not the author's: ${JSON.stringify(refetchedCmp)}`)
  assert.equal(sourceSet([at('Policies', NEW_NAME, withStrength(asFido2)), doc(NEW_NAME, withStrength(refetched))]).members.length, 1)

  // 4. And the referenced object's own class is part of its record: how deeply
  //    an export expanded the strength is still the exporter's choice.
  const typed = { ...plain, '@odata.type': '#microsoft.graph.authenticationStrengthPolicy' }
  const depth = comparePolicies(normalizePolicy(withStrength(plain)), normalizePolicy(withStrength(typed)))
  assert.deepEqual(depth.changed, [])
  assert.deepEqual(depth.unreviewed, [], `the strength's own class is its record: ${JSON.stringify(depth)}`)
})
