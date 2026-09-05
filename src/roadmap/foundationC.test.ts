// Foundation C's boundary. A safety-sensitive decision has four facts, and this
// file exists because any one of them standing in for another writes a carve-out
// for the wrong people into a policy an operator then deploys:
//
//   detected    — what the tenant's evidence shows.
//   recommended — what IAMAI would put forward, where the evidence is complete
//                 enough to put anything forward.
//   confirmed   — what the operator chose. Storage keeps it, whatever a scan
//                 can or cannot see today.
//   actionable  — the operator's choice AND an object this scan read for
//                 itself. The only id that may go into a policy operation.
//
// Three things the previous shape got wrong and these tests hold shut:
//
//  1. a stored confirmation is not current actionability. It survives a scan
//     that cannot verify it — it is the operator's decision, not IAMAI's
//     reading — and it stops being usable until a scan reads the object again,
//     and starts again by itself when one does;
//  2. a Conditional Access policy naming a group id does not prove the group
//     exists. Policies go on holding ids after the object is deleted, so
//     presence comes from the directory read and from nothing else, and only
//     Graph's own "no such object" is absence;
//  3. an empty candidate list is not proof that nothing qualifies. It is that
//     only where the detection had the evidence it needs; otherwise IAMAI says
//     it cannot tell, and above all does not conclude the tenant should create
//     a second group.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { allFixtures, fixture, noExclusionsAnswer } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { defaultDecisions, pickerVars } from '../ui/surfaces/pickerRows.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { stepLines } from '../ui/surfaces/stepExport.ts'
import { planFinish } from '../derive/finish.ts'
import { headerLine1 } from '../derive/planHeader.ts'
import { FINISH } from '../copy/statements.ts'
import { stepById } from '../content/content.ts'
import { implementationOffered, isOpenPolicy, unavailableReason } from './operations.ts'
import { GraphRequestError, SectionDisabledError, graphRequest } from '../graph/collect/http.ts'
import { presenceOfError } from '../graph/collect/presence.ts'
import type { GroupRead } from '../graph/collect/presence.ts'
import { answersComplete, applyDetectedDefaults } from '../mapping/wizard.ts'
import { toCoverageMapping } from '../mapping/store.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { accountApplicability, stepEffects } from './operations.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import { directoryEvidenceOf as directoryReadsOf } from '../mapping/safetyChoice.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { Fixture } from './fixtures/index.ts'
import type { MappingRecord } from '../mapping/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import {
  EXCLUSIONS_RECORD_KEY,
  actionableExclusionsGroupId,
  directoryEvidenceFromGroups,
  directoryEvidenceOf,
  exclusionsDetectionEvidence,
  exclusionsGroupCandidates,
  exclusionsGroupIdToVerify,
  exclusionsGroupChoice,
  exclusionsGroupRecord,
  resolveSafetyChoice,
  operatorExclusionsDecision,
} from '../mapping/safetyChoice.ts'
import type { DirectoryEvidence, ObjectEvidence, SafetyCandidate } from '../mapping/safetyChoice.ts'

const X = '00000000-0000-4000-8000-00000000000x'.replace('x', '1')
const Y = '00000000-0000-4000-8000-000000000002'

// ---- Small builders, so each test states only what it is about ----

const evidenceOf = (entries: Record<string, Partial<ObjectEvidence>>, universe: 'complete' | 'partial' = 'complete'): DirectoryEvidence => ({
  universe,
  groups: new Map(
    Object.entries(entries).map(([id, e]) => [
      id.toLowerCase(),
      { presence: 'present', members: 'complete', displayName: null, memberIds: [], memberCount: 0, ...e } as ObjectEvidence,
    ]),
  ),
})

/** A tenant whose Conditional Access policies exclude `excluded` from `n` of `n + 1` user-targeting policies. */
function policiesExcluding(excluded: string[], n = 3): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < n + 1; i += 1) {
    out.push({
      displayName: `P${i}`,
      state: 'enabled',
      conditions: { users: { includeUsers: ['All'], excludeGroups: i < n ? excluded : [] }, applications: { includeApplications: ['All'] } },
      grantControls: { builtInControls: ['mfa'] },
    })
  }
  return out
}

const snapshotOf = (rows: unknown[], status: 'ok' | 'error' = 'ok'): Pick<TenantSnapshot, 'config'> =>
  ({ config: { caPolicies: { status, reason: null, rows } } }) as unknown as Pick<TenantSnapshot, 'config'>

const mappingOf = (storedId: string | null, breakGlassUserIds: string[] = []): Pick<MappingState, 'records' | 'breakGlassUserIds'> => ({
  records: storedId === null ? {} : { [EXCLUSIONS_RECORD_KEY]: exclusionsGroupRecord(undefined, storedId) },
  breakGlassUserIds,
})

// ---- 1-4, 18: a stored confirmation against what this scan can see ----

test('1. confirmed and present: the operator\'s answer stands and is the id anything downstream may use', () => {
  const c = exclusionsGroupChoice({ snapshot: snapshotOf(policiesExcluding([X])), mapping: mappingOf(X), directory: evidenceOf({ [X]: { displayName: 'Core - Exclusions' } }) })
  assert.equal(c.storedId, X, 'the stored confirmation is preserved')
  assert.equal(c.status, 'confirmed')
  assert.equal(c.presence, 'present')
  assert.equal(c.actionableId, X)
  assert.equal(c.unresolved, false)
})

test('2. confirmed and unverifiable: the answer is kept, nothing may use it, and no recommendation replaces it', () => {
  // Two other groups qualify; neither is put forward in place of the answer.
  const ctx = { snapshot: snapshotOf(policiesExcluding([X, Y])), mapping: mappingOf(X), directory: evidenceOf({ [Y]: { displayName: 'Some other group' } }) }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(c.storedId, X, 'the stored confirmation remains X')
  assert.equal(c.status, 'unverified')
  assert.equal(c.presence, 'unknown', 'not established, and never called absent')
  assert.equal(c.actionableId, null)
  assert.equal(c.unresolved, true)
  assert.equal(c.recommended, null, 'a recommendation does not answer a question the operator already answered')
  assert.equal(actionableExclusionsGroupId(ctx), null, 'no policy operation may use X')
})

test('3. unknown then present: the same stored answer becomes usable again with no new decision', () => {
  const snapshot = snapshotOf(policiesExcluding([X]))
  const mapping = mappingOf(X)
  const scanN = exclusionsGroupChoice({ snapshot, mapping, directory: evidenceOf({}) })
  assert.equal(scanN.status, 'unverified')
  assert.equal(scanN.actionableId, null)
  const scanN1 = exclusionsGroupChoice({ snapshot, mapping, directory: evidenceOf({ [X]: {} }) })
  assert.equal(scanN1.status, 'confirmed')
  assert.equal(scanN1.actionableId, X, 'the object came back, so the answer is actionable again')
  assert.equal(operatorExclusionsDecision(mapping)?.id ?? null, X, 'and the stored choice never changed')
  assert.deepEqual(mapping.records[EXCLUSIONS_RECORD_KEY], exclusionsGroupRecord(undefined, X), 'nothing was rewritten in between')
})

test('4. confirmed and proved gone: invalidated, unresolved, and not replaced', () => {
  const c = exclusionsGroupChoice({
    snapshot: snapshotOf(policiesExcluding([X, Y])),
    mapping: mappingOf(X),
    directory: evidenceOf({ [X]: { presence: 'absent', members: 'unknown', memberCount: null }, [Y]: {} }),
  })
  assert.equal(c.storedId, X, 'the operator\'s decision remains X')
  assert.equal(c.status, 'invalidated')
  assert.equal(c.presence, 'absent')
  assert.equal(c.actionableId, null)
  assert.equal(c.unresolved, true)
  assert.equal(c.recommended, null, 'no automatic replacement')
})

test('18. a previous scan\'s reading is not this scan\'s: present does not survive into a scan that cannot verify', () => {
  const snapshot = snapshotOf(policiesExcluding([X]))
  const mapping = mappingOf(X)
  const scan1 = exclusionsGroupChoice({ snapshot, mapping, directory: evidenceOf({ [X]: {} }) })
  assert.equal(scan1.status, 'confirmed')
  // The same stored confirmation, a scan that could not read the object.
  const scan2 = exclusionsGroupChoice({ snapshot, mapping, directory: evidenceOf({}) })
  assert.equal(scan2.presence, 'unknown', 'verification is recomputed, never carried')
  assert.equal(scan2.actionableId, null)
})

// ---- 5-8: what the directory read boundary proves ----

test('5. a policy naming a group is not the group existing', () => {
  // Three policies exclude X. Nothing read the object.
  const ctx = { snapshot: snapshotOf(policiesExcluding([X])), mapping: mappingOf(null), directory: evidenceOf({}) }
  const c = exclusionsGroupChoice(ctx)
  assert.deepEqual(c.candidates, [], 'the reference is evidence that somebody excluded something, not a verified candidate')
  assert.equal(c.recommended, null, 'a recommendation cannot rest on the policy naming it')
  assert.equal(c.actionableId, null)
  assert.equal(c.evidence, 'incomplete', 'a group the scan could not read might be the one, so nothing can be concluded')
  // And the same id, once the directory answers, is a candidate.
  const read = exclusionsGroupChoice({ ...ctx, directory: evidenceOf({ [X]: { displayName: 'Core - Exclusions' } }) })
  assert.deepEqual(read.candidates.map((k) => k.id), [X])
  assert.equal(read.status, 'recommended')
  assert.equal(read.actionableId, null, 'a recommendation is still not a confirmation')
})

test('6. a generic Graph failure is unknown, never absent', () => {
  assert.equal(presenceOfError(new GraphRequestError(500, 'InternalServerError', 'oops')), 'unknown')
  assert.equal(presenceOfError(new GraphRequestError(429, 'TooManyRequests', 'slow down')), 'unknown')
  assert.equal(presenceOfError(new GraphRequestError(400, 'Request_BadRequest', 'malformed id')), 'unknown')
  assert.equal(presenceOfError(new SectionDisabledError('Insufficient privileges', 403)), 'unknown')
  assert.equal(presenceOfError(new Error('request failed after retries (timeout): https://graph.microsoft.com/v1.0/groups/x')), 'unknown')
  assert.equal(presenceOfError(undefined), 'unknown', 'a request nobody made establishes nothing')
})

test('7. Graph\'s own not-found, end to end through the request layer, is absence', async () => {
  const tokens = { get: () => 't', refresh: async () => 't' }
  const withFetch = async (res: Response): Promise<unknown> => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => res) as typeof fetch
    try {
      // The retry policy is injected so a 5xx does not sleep through its backoff here.
      return await graphRequest(tokens, `https://graph.microsoft.com/v1.0/groups/${X}?$select=id`, { wait: async () => {} })
    } catch (e) {
      return e
    } finally {
      globalThis.fetch = original
    }
  }
  const gone = await withFetch(new Response(JSON.stringify({ error: { code: 'Request_ResourceNotFound', message: `Resource '${X}' does not exist.` } }), { status: 404 }))
  assert.ok(gone instanceof GraphRequestError && gone.status === 404 && gone.code === 'Request_ResourceNotFound', 'the narrow shape, not a generic catch')
  assert.equal(presenceOfError(gone), 'absent')
  const failed = await withFetch(new Response(JSON.stringify({ error: { code: 'UnknownError', message: 'service unavailable' } }), { status: 503 }))
  assert.ok(failed instanceof GraphRequestError && failed.status === 503)
  assert.equal(presenceOfError(failed), 'unknown', 'the same code path, and this one proves nothing')
})

test('8. a group that exists whose members would not enumerate is present with no member count invented', () => {
  const read: GroupRead = { groupId: X, presence: 'present', reason: null, object: { displayName: 'Core - Exclusions', membershipRule: null, mailEnabled: false }, members: 'unknown', memberIds: [], memberCount: null, asOf: '2026-09-05T00:00:00.000Z' }
  const directory = directoryEvidenceOf([read])
  const e = directory.groups.get(X.toLowerCase())!
  assert.equal(e.presence, 'present', 'a second request failing does not un-exist the object')
  assert.equal(e.members, 'unknown')
  assert.equal(e.memberCount, null, 'a count nobody read is not zero')
  assert.deepEqual([...e.memberIds], [])
  // Membership qualifies one of the two candidate rules, so the detection over
  // this tenant cannot conclude.
  const ctx = { snapshot: snapshotOf(policiesExcluding([X])), mapping: mappingOf(null), directory }
  assert.equal(exclusionsDetectionEvidence(ctx), 'incomplete')
  // The object being readable is still enough to make it a candidate by the
  // rule that reads the policies rather than the members.
  assert.deepEqual(exclusionsGroupCandidates(ctx).map((c) => c.id), [X])
  assert.equal(exclusionsGroupChoice(ctx).status, 'undetermined', 'one candidate, but not provably the only one')
})

// ---- 9-12: detection completeness, and recommendation as a separate thing ----

test('9. nothing found on evidence IAMAI could not complete: no none-found, no create, no recommendation', () => {
  // Two groups the policies name, neither read.
  const ctx = { snapshot: snapshotOf(policiesExcluding([X, Y], 1)), mapping: mappingOf(null), directory: evidenceOf({}) }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(c.evidence, 'incomplete')
  assert.deepEqual(c.candidates, [])
  assert.notEqual(c.status, 'none-found', 'IAMAI did not prove nothing qualifies')
  assert.equal(c.status, 'undetermined')
  assert.equal(c.recommended, null)
  assert.equal(c.actionableId, null)
  assert.equal(c.unresolved, true)
  // The policies section itself failing is the same answer.
  const noPolicies = exclusionsGroupChoice({ ...ctx, snapshot: snapshotOf([], 'error') })
  assert.equal(noPolicies.evidence, 'incomplete')
  assert.equal(noPolicies.status, 'undetermined')
})

test('10. nothing found on complete evidence: none-found is allowed, and no id is fabricated', () => {
  // One policy, one group, read, and excluded from too little to qualify.
  const ctx = { snapshot: snapshotOf(policiesExcluding([X], 1)), mapping: mappingOf(null), directory: evidenceOf({ [X]: { displayName: 'Sales' } }) }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(c.evidence, 'complete')
  assert.deepEqual(c.candidates, [])
  assert.equal(c.status, 'none-found')
  assert.equal(c.actionableId, null)
  assert.equal(c.storedId, null)
  assert.equal(c.recommended, null)
})

test('11. one verified candidate on complete evidence: recommended, and nothing more', () => {
  const mapping = mappingOf(null)
  const before = JSON.stringify(mapping)
  const ctx = { snapshot: snapshotOf(policiesExcluding([X])), mapping, directory: evidenceOf({ [X]: { displayName: 'Core - Exclusions', memberCount: 2 } }) }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(c.evidence, 'complete')
  assert.equal(c.status, 'recommended')
  assert.deepEqual(c.recommended && { id: c.recommended.id, name: c.recommended.name, memberCount: c.recommended.memberCount }, { id: X, name: 'Core - Exclusions', memberCount: 2 })
  assert.equal(c.actionableId, null, 'a recommendation is not an answer')
  assert.equal(c.storedId, null)
  assert.equal(c.unresolved, true)
  assert.equal(JSON.stringify(mapping), before, 'resolving the choice wrote nothing')
})

test('12. two verified candidates: ambiguous, and IAMAI picks neither', () => {
  const c = exclusionsGroupChoice({
    snapshot: snapshotOf(policiesExcluding([X, Y])),
    mapping: mappingOf(null),
    directory: evidenceOf({ [X]: { displayName: 'Break glass' }, [Y]: { displayName: 'Exclusions' } }),
  })
  assert.equal(c.status, 'ambiguous')
  assert.equal(c.candidates.length, 2)
  assert.equal(c.recommended, null, 'a sort order does not settle a safety question')
  assert.equal(c.actionableId, null)
  assert.equal(c.unresolved, true)
})

test('the primitive itself: only confirmed-and-present carries an id', () => {
  const cands: SafetyCandidate[] = [{ id: Y, name: 'Y', memberCount: 1, excludedFrom: 3 }]
  const at = (over: Parameters<typeof resolveSafetyChoice>[0]): ReturnType<typeof resolveSafetyChoice> => resolveSafetyChoice(over)
  for (const presence of ['present', 'absent', 'unknown'] as const) {
    const c = at({ role: 'exclusionsGroup', stored: { id: X, name: 'X' }, presence, candidates: cands, evidence: 'complete' })
    assert.equal(c.storedId, X, `${presence}: the operator's answer is kept`)
    assert.equal(c.actionableId, presence === 'present' ? X : null)
    assert.equal(c.unresolved, presence !== 'present')
    if (presence !== 'present') assert.equal(c.recommended, null, `${presence}: no recommendation stands in`)
  }
  assert.equal(at({ role: 'exclusionsGroup', stored: null, presence: 'unknown', candidates: [], evidence: 'complete' }).status, 'none-found')
  assert.equal(at({ role: 'exclusionsGroup', stored: null, presence: 'unknown', candidates: [], evidence: 'incomplete' }).status, 'undetermined')
  assert.equal(at({ role: 'exclusionsGroup', stored: null, presence: 'unknown', candidates: cands, evidence: 'incomplete' }).status, 'undetermined', 'one candidate under incomplete evidence cannot be called the only one')
  assert.equal(at({ role: 'exclusionsGroup', stored: null, presence: 'unknown', candidates: [...cands, { id: X, name: 'X', memberCount: 1, excludedFrom: 2 }], evidence: 'incomplete' }).status, 'ambiguous', 'two is two however incomplete the rest was')
  for (const ev of ['complete', 'incomplete'] as const) {
    assert.equal(at({ role: 'exclusionsGroup', stored: null, presence: 'unknown', candidates: cands, evidence: ev }).actionableId, null)
  }
})

// ---- 13-15, 17, 19: real plans ----

const EXCLUSIONS_STEP = PREREQ_STEP_ID.exclusionsGroup

/** Every string a plan's steps carry, so an id that reached any channel is found. */
const planText = (r: FixtureRun): string => JSON.stringify(r.steps)

function planWith(name: 'small', directory: DirectoryEvidence): FixtureRun {
  const f = fixture(name)
  return runFixture(f, { directory })
}

test('13. a real plan: a stored confirmation this scan cannot verify reaches no policy, and is not called deleted', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  // Every group the scan loaded, except the confirmed one: the request for it failed.
  const partial = new Map(f.groups)
  partial.delete(stored)
  const r = planWith('small', directoryEvidenceFromGroups(partial))
  const c = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: partial, directory: directoryEvidenceFromGroups(partial) })
  assert.equal(c.status, 'unverified', 'unverified, not invalidated: nothing said the group is gone')
  assert.equal(operatorExclusionsDecision(f.mapping)?.id ?? null, stored, 'the operator\'s mapping still holds their answer')
  assert.ok(!planText(r).includes(stored), 'no step in the plan names the unverified group')
  const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.notEqual(step.status, 'done', 'the exclusions-group step is not in place')
  // Every policy step that would carve the group out waits rather than shipping without it.
  const policySteps = r.steps.filter((s) => isOpenPolicy(s))
  assert.ok(policySteps.length > 0)
  assert.ok(policySteps.every((s) => s.status === 'blocked' || !implementationOffered(s)), 'dependent work is held')
})

test('14. a real plan: a confirmed group Graph proves gone is distinguished from one it could not check', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  const partial = new Map(f.groups)
  partial.delete(stored)
  const base = directoryEvidenceFromGroups(partial)
  const absent: DirectoryEvidence = { universe: base.universe, groups: new Map([...base.groups, [stored.toLowerCase(), { presence: 'absent', members: 'unknown', displayName: null, memberIds: [], memberCount: null } as ObjectEvidence]]) }
  const c = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: partial, directory: absent })
  assert.equal(c.status, 'invalidated')
  assert.equal(c.presence, 'absent')
  assert.notEqual(c.status, exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: partial, directory: base }).status, 'gone and could-not-check are different states')
  assert.equal(c.storedId, stored, 'the stored choice is preserved')
  assert.equal(c.recommended, null, 'no automatic replacement')
  const r = runFixture(f, { directory: absent })
  assert.ok(!planText(r).includes(stored), 'no policy the plan writes names it')
})

test('15. a real plan: a confirmed group this scan read is the one the policies carve out, and the only one', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  const r = runFixture(f)
  assert.equal(actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups }), stored)
  const offered = r.steps.filter((s) => isOpenPolicy(s) && s.action.json)
  assert.ok(offered.length > 0, 'policies resolve')
  for (const s of offered) {
    const body = JSON.parse(s.action.json as string) as { conditions?: { users?: { excludeGroups?: string[] } } }
    const ex = body.conditions?.users?.excludeGroups ?? []
    assert.ok(ex.includes(stored), `${s.id} carves out the confirmed group`)
    assert.equal(unavailableReason(s), null, `${s.id} needs no other safety fallback`)
  }
})

test('17. a real plan: a recommended-only group appears in zero policy operations', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  // Nobody has answered; the same tenant, the same groups, the same reads.
  const mapping: MappingState = { ...f.mapping, records: {} }
  const g = { ...f, mapping }
  const c = exclusionsGroupChoice({ snapshot: f.snapshot, mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups) })
  assert.ok(c.candidates.length >= 1, 'the detection still sees candidates')
  assert.equal(c.actionableId, null)
  const r = runFixture(g, { mapping })
  const text = planText(r)
  for (const cand of c.candidates) assert.ok(!text.includes(cand.id), `${cand.name} is detected and used by nothing`)
  assert.ok(!text.includes(stored), 'not even the group the tenant\'s own policies already exclude')
})

test('19. Foundation A: an unresolved safety input leaves the operation unresolved, with no fallback filling it', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  const partial = new Map(f.groups)
  partial.delete(stored)
  const r = runFixture(f, { directory: directoryEvidenceFromGroups(partial) })
  const policySteps = r.steps.filter((s) => isOpenPolicy(s))
  for (const s of policySteps) {
    if (implementationOffered(s)) continue
    assert.match(unavailableReason(s) ?? '', /missing-object|no-operation|unmatched-pair|baseline-conflict/, `${s.id} says why rather than shipping`)
  }
  // No goal, family, population or default supplied a group id in its place.
  const text = planText(r)
  for (const [id] of f.groups) assert.ok(!text.includes(id), `no group id (${id}) was substituted for the missing safety input`)
})

// ---- 16 and the authority sweeps ----

test('16. detection writes nothing: scan, detect, recommend, plan, scan again, and the record does not move', () => {
  for (const f of allFixtures()) {
    const before = JSON.stringify(f.mapping.records[EXCLUSIONS_RECORD_KEY] ?? null)
    const nameOf = (id: string): string => id
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }
    // Every detection path the product runs without an operator acting.
    exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
    exclusionsGroupCandidates({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
    const defaults = defaultDecisions(ctx)
    const applied = applyStepDecisions(f.mapping, defaults, 'detected')
    runFixture(f)
    runFixture(f, { directory: directoryEvidenceFromGroups(f.groups) })
    const detected = applyDetectedDefaults(f.mapping, f.snapshot, { knownGroups: [] })
    assert.equal(JSON.stringify(applied.records[EXCLUSIONS_RECORD_KEY] ?? null), before, `${f.name}: a picker default wrote the exclusions record`)
    assert.equal(JSON.stringify(detected.records[EXCLUSIONS_RECORD_KEY] ?? null), before, `${f.name}: the scan's detected defaults wrote the exclusions record`)
    assert.equal(JSON.stringify(f.mapping.records[EXCLUSIONS_RECORD_KEY] ?? null), before, `${f.name}: the stored record was mutated`)
  }
})

test('no picker default and no detected pass can tick the exclusions group, on any fixture', () => {
  for (const f of allFixtures()) {
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, groups: f.groups, now: f.snapshot.asOf }
    for (const stepId of [PREREQ_STEP_ID.exclusionsGroup, 's-blocker-exclusion-group']) {
      assert.equal(defaultDecisions(ctx)[stepId], undefined, `${f.name}: ${stepId} has a pre-ticked default`)
    }
    const ticked = pickerVars(PREREQ_STEP_ID.exclusionsGroup, '{name}', ctx)?.groupsTicked
    const stored = operatorExclusionsDecision(f.mapping)?.id ?? null
    assert.deepEqual(ticked, stored === null ? [] : [stored], `${f.name}: the picker ticks something nobody chose`)
    // And a detected pass with a decision in hand still refuses to write it.
    const forced = applyStepDecisions(f.mapping, { [PREREQ_STEP_ID.exclusionsGroup]: { picked: [X], at: f.snapshot.asOf } }, 'detected')
    assert.equal(operatorExclusionsDecision(forced)?.id ?? null, stored, `${f.name}: a detected pass wrote the exclusions record`)
    // An operator's own confirmation, through the same door, does write it.
    const chosen = applyStepDecisions(f.mapping, { [PREREQ_STEP_ID.exclusionsGroup]: { picked: [X], at: f.snapshot.asOf } })
    assert.equal(operatorExclusionsDecision(chosen)?.id ?? null, X, `${f.name}: an operator's confirmation is refused`)
  }
})

test('the exclusions record has one reader: every consumer asks the choice, not the field', () => {
  const ALLOWED = new Set(['src/mapping/safetyChoice.ts'])
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.')) continue
      if (ALLOWED.has(full)) continue
      if (readFileSync(full, 'utf8').includes("'__globalExclusion'") || readFileSync(full, 'utf8').includes('"__globalExclusion"')) offenders.push(full)
    }
  }
  walk('src')
  assert.deepEqual(offenders, [], 'a module names the exclusions record key directly; use mapping/safetyChoice.ts')
})

// ---- Presence is not membership: neither surface invents the members ----

test('a group in use whose members would not enumerate: no count on screen, and no reach computed from an assumed one', () => {
  const f = fixture('small')
  const stored = operatorExclusionsDecision(f.mapping)!.id
  const partial = new Map(f.groups)
  partial.delete(stored)
  const base = directoryEvidenceFromGroups(partial)
  // The object read; the membership request failed.
  const directory: DirectoryEvidence = {
    universe: base.universe,
    groups: new Map([...base.groups, [stored.toLowerCase(), { presence: 'present', members: 'unknown', displayName: 'Core - Exclusions', memberIds: [], memberCount: null } as ObjectEvidence]]),
  }
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: partial, directory })
  assert.equal(choice.status, 'confirmed', 'the object exists and the operator chose it: it is in use')
  assert.equal(choice.actionableId, stored)

  const r = runFixture({ ...f, groups: partial }, { groupMembers: partial, directory })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: partial, directory, naming: r.coverage.organisation.naming }
  const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(ex.memberCount, undefined, 'a count nobody read is not zero')
  assert.equal(ex.members, undefined, 'and the emergency accounts are not listed as its members')
  assert.deepEqual(ex.exclusionsGroupNoMembers, ['Core - Exclusions'], 'the group is named with what is known about it')
  assert.ok(!stepLines(step, ctx).some((l) => /\b0 members\b/.test(l)), 'nothing on the step says 0 members')

  // And the engine measures no policy's reach from an assumed membership: with
  // the members unknown the cohort is unknown, as Foundation A requires.
  const openStep = (run: FixtureRun): Record<string, unknown> => run.steps.filter((s) => isOpenPolicy(s))[0] as unknown as Record<string, unknown>
  assert.ok(openStep(runFixture(f)).cohort, 'with the members read, the cohort is known')
  assert.equal(openStep(r).cohort, undefined, 'with them unread, it is not invented')
})

// ---- The header a plan gets while the choice is open ----

test('a plan whose policies wait on an unchosen safety object says what holds it', () => {
  // The demo: two groups qualify, nobody has chosen, so no policy can be
  // written and the calendar dates nothing. The header's held branch has to
  // name what holds it rather than ending at "cannot finish until".
  const f = noExclusionsAnswer(fixture('demo'))
  const r = runFixture(f, { mapping: f.mapping })
  const fin = planFinish(r.steps, r.schedule.cleanup?.end ?? null)
  assert.equal(fin.finish, null, 'nothing is dated while the policies cannot be written')
  assert.deepEqual(fin.waiting, [], 'and no readiness number holds them')
  assert.ok(fin.unwritable.count > 0, 'the steps that cannot be written are counted')
  assert.ok(fin.unwritable.waitsOn.includes(EXCLUSIONS_STEP), 'and the exclusions-group step is among what they wait on')
  const clause = FINISH.unwritable(fin.unwritable.count, fin.unwritable.waitsOn.map((id) => stepById[id]?.title ?? id))
  assert.match(clause, /^\d+ steps wait on .*Exclusions Group/)
  assert.match(headerLine1({ steps: 30, inPlace: 5, finish: fin.finish, weeks: '4 weeks', constraint: clause, startedFrom: null }), /cannot finish until \S/, 'the line does not trail off')
})

// ---- A record is not a decision -------------------------------------------
//
// Versions of IAMAI before this module let the detection write the exclusions
// record itself, with provenance `auto`. An upgraded tenant therefore holds an
// id nobody chose, and the two questions the old code asked of it were one: "is
// there an id here?" answered "the operator confirmed this group". Reading it
// that way turns last year's machine reading into this year's human
// confirmation of who a policy still lets in.
//
// The record stays — it is history, and it names the object the next scan
// should go and read. What it stops being is an answer.

/** The upgraded tenant: the same group id, written by a detection rather than a person. */
const legacyAuto = (id: string, name = 'Core - Exclusions'): MappingRecord => ({
  placeholder: EXCLUSIONS_RECORD_KEY,
  kind: 'group',
  group: 'globalExclusion',
  resolvedId: id,
  resolvedName: name,
  provenance: 'auto',
  doesNotExist: false,
  validation: null,
})

test('L1. a legacy detected record, its group present: read it, show it, and never call it the operator’s answer', () => {
  const mapping = { records: { [EXCLUSIONS_RECORD_KEY]: legacyAuto(X) }, breakGlassUserIds: [] }
  const ctx = { snapshot: snapshotOf(policiesExcluding([X])), mapping, directory: evidenceOf({ [X]: { displayName: 'Core - Exclusions' } }) }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(operatorExclusionsDecision(mapping), null, 'a detection did not decide')
  assert.equal(c.storedId, null, 'so there is no stored answer')
  assert.equal(c.actionableId, null, 'and nothing may act on it')
  assert.equal(actionableExclusionsGroupId(ctx), null, 'no policy operation gets the id')
  assert.equal(c.unresolved, true)
  // What it is still good for.
  assert.equal(c.recordedId, X, 'the record is kept, as history and as an object worth reading')
  assert.equal(c.recordedProvenance, 'auto', 'and it says what wrote it')
  assert.equal(exclusionsGroupIdToVerify(mapping), X, 'the next scan goes and reads it')
  assert.deepEqual(c.candidates.map((k) => k.id), [X], 'and it is a candidate, on the evidence, like any other group')
})

test('L2. the wizard’s own detected answer does not make coverage call the exclusions confirmed', () => {
  const snapshot = fixtureSnapshot()
  const base = { ...emptyMappingState(snapshot.tenantId), records: { [EXCLUSIONS_RECORD_KEY]: legacyAuto(X) } }
  for (const assumed of ['detected', 'noneFound'] as const) {
    const state: MappingState = {
      ...base,
      wizardAnswered: { breakGlass: true, globalExclusion: true, countries: true, trustedLocations: true, serviceAccounts: true, timeZone: true, applicability: true },
      assumed: { globalExclusion: assumed },
    }
    assert.equal(answersComplete(snapshot, state), false, `${assumed}: a detection is not the operator’s answer`)
    assert.equal(toCoverageMapping(state, snapshot, null).confirmed, false, `${assumed}: and coverage is not told it is`)
  }
  // The operator's own confirmation, through the one writer of that record.
  const confirmed: MappingState = {
    ...base,
    records: { [EXCLUSIONS_RECORD_KEY]: exclusionsGroupRecord(legacyAuto(X), X) },
    wizardAnswered: { breakGlass: true, globalExclusion: true, countries: true, trustedLocations: true, serviceAccounts: true, timeZone: true, applicability: true },
    assumed: { globalExclusion: 'confirmed' },
  }
  assert.equal(answersComplete(snapshot, confirmed), true)
  assert.equal(toCoverageMapping(confirmed, snapshot, X).confirmed, true)
  // Including the answer "there is no such group yet", which is an answer.
  const none: MappingState = { ...confirmed, records: { [EXCLUSIONS_RECORD_KEY]: exclusionsGroupRecord(undefined, null) } }
  assert.equal(answersComplete(snapshot, none), true, 'an operator saying there is none is an operator answering')
})

test('L3. a scan does not migrate a detected record into a confirmation', () => {
  const snapshot = fixtureSnapshot()
  const before: MappingState = {
    ...emptyMappingState(snapshot.tenantId),
    records: { [EXCLUSIONS_RECORD_KEY]: legacyAuto(X) },
    wizardAnswered: { globalExclusion: true },
    assumed: { globalExclusion: 'detected' },
  }
  const after = applyDetectedDefaults(before, snapshot, { knownGroups: [] })
  assert.equal(after.records[EXCLUSIONS_RECORD_KEY].provenance, 'auto', 'the provenance is not rewritten')
  assert.equal(after.records[EXCLUSIONS_RECORD_KEY].resolvedId, X, 'and the id is not thrown away either')
  assert.equal(operatorExclusionsDecision(after), null)
  // Round trip: the merge a load does keeps both facts as they are.
  const loaded: MappingState = { ...emptyMappingState(snapshot.tenantId), ...JSON.parse(JSON.stringify(after)) }
  assert.deepEqual(loaded.records[EXCLUSIONS_RECORD_KEY], after.records[EXCLUSIONS_RECORD_KEY])
  assert.equal(operatorExclusionsDecision(loaded), null, 'a save and a load is not a confirmation')
})

test('L4. the upgraded tenant, end to end: nothing the legacy record touches reaches a policy, until a person says so', () => {
  const base = fixture('small')
  const chosen = base.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string
  // The same tenant as ever, with the record as an older version left it: the
  // right group, the wizard marked answered, the assumption marked detected, and
  // nobody having chosen anything.
  const f: Fixture = {
    ...base,
    mapping: {
      ...base.mapping,
      records: { ...base.mapping.records, [EXCLUSIONS_RECORD_KEY]: legacyAuto(chosen) },
      assumed: { ...(base.mapping.assumed ?? {}), globalExclusion: 'detected' },
    },
  }
  const r = runFixture(f, { mapping: f.mapping })
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, groups: f.groups, directory: r.input.directory, now: f.snapshot.asOf }

  // IAMAI may show the group; it may not tick it, use it, or call it confirmed.
  assert.equal(defaultDecisions(ctx)[PREREQ_STEP_ID.exclusionsGroup], undefined, 'no pre-ticked default')
  const vars = pickerVars(PREREQ_STEP_ID.exclusionsGroup, '{name}', ctx)
  assert.deepEqual(vars?.groupsTicked, [], 'the picker ticks nothing')
  const offeredIds = (vars?.groupsIds ?? []) as string[]
  assert.ok(offeredIds.some((id) => id.toLowerCase() === chosen.toLowerCase()), 'the group is still offered to choose')
  assert.equal(toCoverageMapping(f.mapping, f.snapshot, null).confirmed, false, 'coverage is not told the safety answer is confirmed')
  assert.ok(!planText(r).includes(chosen), 'no step in the plan names the group')
  // The exact claim: the plan is the plan of a tenant with no answer at all.
  const unanswered = runFixture(noExclusionsAnswer(base), { mapping: noExclusionsAnswer(base).mapping })
  const offeredIn = (run: FixtureRun): string[] => run.steps.filter((x) => isOpenPolicy(x) && implementationOffered(x)).map((x) => x.id).sort()
  assert.deepEqual(offeredIn(r), offeredIn(unanswered), 'no implementation became available because of the detection')
  assert.ok(r.steps.filter((s) => isOpenPolicy(s)).some((s) => (s.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}')), 'the policies that need the carve-out wait for it')

  // The operator confirms the same group, through the decision path.
  const decided = applyStepDecisions(f.mapping, { [PREREQ_STEP_ID.exclusionsGroup]: { picked: [chosen], at: f.snapshot.asOf } })
  assert.equal(decided.records[EXCLUSIONS_RECORD_KEY].provenance, 'confirmed')
  assert.equal(operatorExclusionsDecision(decided)?.id, chosen)
  const after = runFixture({ ...f, mapping: decided }, { mapping: decided })
  const step = after.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.ok((step.checks?.total ?? 0) > 0, 'the group’s checks now run against it')
  const offered = after.steps.filter((s) => isOpenPolicy(s) && implementationOffered(s))
  assert.ok(offered.length > 0, 'and policy generation receives the group')
  const evidence = { groupMembers: Object.fromEntries([...f.groups].map(([id, g]) => [id.toLowerCase(), g.memberIds])) }
  for (const s of offered) {
    assert.ok(stepEffects(s).some((e) => (e.scope.groups.exclude ?? []).some((g) => g.toLowerCase() === chosen.toLowerCase())), `${s.id}: the policy excludes the confirmed group`)
    for (const id of f.mapping.breakGlassUserIds) {
      assert.ok(stepEffects(s).every((e) => accountApplicability(e.scope, id, f.snapshot as never, evidence) === 'out'), `${s.id}: and every emergency account is structurally out of it`)
    }
  }
})

// ---- The report is the authority; the step's word is its projection --------
//
// One check used to decide whether the exclusions-group step was In place — the
// group being excluded from every policy — and the other blockers did not. So a
// group holding an unapproved member, a group holding an administrator, a
// dynamic group and a group whose membership nothing read all reached In place;
// and a second line then cleared the gate for any step whose status read done,
// which let the projection overrule the report that produced it. Between them,
// every deny-capable step in the plan was released by a group nobody had checked.

/** The healthy tenant: a group in use, every check passing, the step In place. */
const healthy = (): Fixture => fixture('getiamai')

/** That tenant with one thing wrong with the group, and nothing else changed. */
type GroupEntry = NonNullable<ReturnType<GroupMembers['get']>>
function withGroup(f: Fixture, change: (g: GroupEntry) => Partial<GroupEntry>): Fixture {
  const id = f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string
  const groups: GroupMembers = new Map([...f.groups])
  const before = groups.get(id) as GroupEntry
  groups.set(id, { ...before, ...change(before) })
  return { ...f, groups }
}

test('G1-G3. a blocking exclusion-group check that has not passed holds the step, the gate and the policies', () => {
  const good = runFixture(healthy())
  const goodStep = good.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.equal(goodStep.status, 'done', 'the healthy tenant’s group is In place')
  assert.ok(good.steps.filter((s) => isOpenPolicy(s)).some((s) => implementationOffered(s)), 'and its policies are offered')

  const f = healthy()
  const bg = f.mapping.breakGlassUserIds
  const outsider = (f.snapshot.users.find((u) => !bg.includes(u.id)) as { id: string }).id
  const cases: [string, Fixture][] = [
    // Somebody in the group who does not belong there: every policy the group is
    // excluded from does not apply to them.
    ['an unapproved member', withGroup(f, (g) => ({ memberIds: [...g.memberIds, outsider], memberCount: g.memberCount + 1 }))],
    // A rule that adds members adds exclusions, without anybody deciding to.
    ['a dynamic membership rule', withGroup(f, () => ({ membershipRule: 'user.department -eq "IT"' }))],
    // An emergency account that is not in the group the policies exclude.
    ['a missing emergency account', withGroup(f, (g) => ({ memberIds: g.memberIds.filter((m) => m !== bg[0]), memberCount: g.memberCount - 1 }))],
  ]
  for (const [why, broken] of cases) {
    const r = runFixture(broken)
    const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
    assert.notEqual(step.status, 'done', `${why}: the step is not In place`)
    assert.ok((step.checks?.failing ?? 0) > 0, `${why}: and it says which check`)
    const deny = r.steps.filter((s) => isOpenPolicy(s) && s.blockedBy.includes(EXCLUSIONS_STEP))
    assert.ok(deny.length > 0, `${why}: the gate still holds every step that can deny access`)
    const id = (f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string).toLowerCase()
    const bodies = JSON.stringify(r.steps.flatMap((s) => (s.action.resolution?.policies ?? []).map((o) => [o.body, o.target]))).toLowerCase()
    assert.ok(!bodies.includes(id), `${why}: no policy in the plan is written with the group`)
    assert.ok(r.steps.filter((s) => isOpenPolicy(s)).some((s) => (s.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}')), `${why}: the policies that need the carve-out wait for it`)
  }

  // A membership nothing read: unknown on a blocker blocks, and is not a pass.
  const id = f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId as string
  const partial: GroupMembers = new Map([...f.groups])
  partial.delete(id)
  const base = directoryEvidenceFromGroups(partial, 'complete')
  const unread = runFixture({ ...f, groups: partial }, {
    groupMembers: partial,
    directory: { universe: 'complete', groups: new Map([...base.groups, [id.toLowerCase(), { presence: 'present', members: 'unknown', displayName: 'Core - Exclusions', memberIds: [], memberCount: null } as ObjectEvidence]]) },
  })
  const unreadStep = unread.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.notEqual(unreadStep.status, 'done', 'an unknown blocker is not a pass')
  assert.ok(unread.steps.filter((s) => isOpenPolicy(s)).some((s) => (s.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}')), 'and the group reaches no policy')
})

test('G4. a warning does not hold the step, and a failing warning does not hold a policy', () => {
  // The group is bigger than the emergency accounts warrant and is mail-enabled:
  // both are recommendations, neither is a blocker, and neither is the way in.
  const f = withGroup(healthy(), () => ({ mailEnabled: true }))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.equal(step.status, 'done', 'the step is In place with a warning outstanding')
  assert.ok(r.steps.filter((s) => isOpenPolicy(s)).some((s) => implementationOffered(s)), 'and the policies are written')
})

test('G5. the gate is the report’s, and no status can answer back to it', () => {
  // The gate takes the reports and nothing else: there is no status to read, so
  // a saved done, a mistakenly satisfied step and a stale projection have no way
  // in. The line that used to clear a gate whenever the gating step's status read
  // done is what this holds shut, and it is a line, so the source says so too.
  const f = withGroup(healthy(), (g) => ({ memberIds: g.memberIds.slice(0, 1), memberCount: 1 }))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  assert.notEqual(step.status, 'done', 'the step cannot be In place while a blocker stands')
  assert.ok(r.steps.some((s) => isOpenPolicy(s) && s.blockedBy.includes(EXCLUSIONS_STEP)), 'and the gate holds')
  const source = readFileSync('src/roadmap/generate.ts', 'utf8')
  const clearing = source.split('\n').filter((l) => /gate\s*=\s*null/.test(l) && !l.trim().startsWith('//'))
  assert.deepEqual(clearing, [], 'a line clears the gate after the reports decided it')
})

// ---- The candidate universe ------------------------------------------------
//
// Both candidate rules ask a question about the tenant — "does a group here
// already do this?" — and the app reads the groups its policies name plus the
// two the mapping names, and searches the rest only while somebody types. An
// empty answer from that reading is not "no". Concluding one told an operator
// with a perfectly good exclusions group, referenced by no policy yet, to go and
// build a second one.

test('U1. every policy-referenced group read, nothing qualifies, universe partial: undetermined, not none-found', () => {
  const ctx = { snapshot: snapshotOf(policiesExcluding([X], 1)), mapping: mappingOf(null), directory: evidenceOf({ [X]: { displayName: 'Sales' } }, 'partial') }
  const c = exclusionsGroupChoice(ctx)
  assert.equal(c.evidence, 'incomplete', 'a complete record of what was asked for is not a complete universe')
  assert.deepEqual(c.candidates, [])
  assert.notEqual(c.status, 'none-found')
  assert.equal(c.status, 'undetermined')
})

test('U2. a suitable group outside the read universe: IAMAI does not conclude there is none', () => {
  // The tenant has "Emergency Exclusions", holding exactly the emergency
  // accounts, referenced by no Conditional Access policy. The app never reads it.
  const read = evidenceOf({ [X]: { displayName: 'Sales' } }, 'partial')
  const ctx = { snapshot: snapshotOf(policiesExcluding([X], 1)), mapping: mappingOf(null, ['u1', 'u2']), directory: read }
  assert.equal(exclusionsGroupChoice(ctx).status, 'undetermined', 'nothing found, and nothing concluded')
  // The same tenant read whole: the group is there, and it is the candidate.
  const whole = evidenceOf({ [X]: { displayName: 'Sales' }, [Y]: { displayName: 'Emergency Exclusions', memberIds: ['u1', 'u2'], memberCount: 2 } })
  const seen = exclusionsGroupChoice({ ...ctx, directory: whole })
  assert.deepEqual(seen.candidates.map((k) => k.id), [Y])
  assert.equal(seen.status, 'recommended', 'and now it can be put forward')
  assert.equal(seen.actionableId, null, 'as a suggestion, which is not a confirmation')
})

test('U3. reading one more group does not complete a partial universe', () => {
  // What a search does: it adds an object to the reading. It says nothing at all
  // about the groups nobody searched for.
  const one = evidenceOf({ [X]: { displayName: 'CA-Exclusions' } }, 'partial')
  const ctx = { snapshot: snapshotOf(policiesExcluding([X])), mapping: mappingOf(null), directory: one }
  const c = exclusionsGroupChoice(ctx)
  assert.deepEqual(c.candidates.map((k) => k.id), [X], 'the group read is offered')
  assert.equal(c.evidence, 'incomplete')
  assert.equal(c.status, 'undetermined', 'one candidate under a partial universe is not the only one')
  assert.equal(c.recommended, null)
})

test('U4. the app’s own reading is partial, and the step offers to create rather than proving nothing exists', () => {
  // The product path: on-demand reads of the groups the policies name and the
  // ones the mapping names (ui/surfaces/planData.ts).
  const reads: GroupRead[] = [{ groupId: X, presence: 'present', reason: null, object: { displayName: 'Sales', membershipRule: null, mailEnabled: false }, members: 'complete', memberIds: [], memberCount: 0, asOf: '2026-09-05T00:00:00.000Z' }]
  assert.equal(directoryReadsOf(reads).universe, 'partial', 'reads of what somebody asked for are not the tenant')
  const f = noExclusionsAnswer(fixture('demo'))
  const r = runFixture(f, { mapping: f.mapping })
  const step = r.steps.find((s) => s.id === EXCLUSIONS_STEP)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(ex.needsCreate, false, 'nothing was proved not to exist')
  const partial: StepVarContext = { ...ctx, directory: directoryReadsOf([]) }
  const exPartial = stepVars(step, partial) as Record<string, unknown>
  assert.equal(exPartial.needsCreate, false, 'still no proof')
  assert.equal(exPartial.createIfNeeded, true, 'and the instructions are offered as an offer')
  const lines = stepLines(step, partial)
  assert.ok(lines.some((l) => /Create one if .* does not already have an exclusions group/.test(l)), `the words say which it is: ${JSON.stringify(lines)}`)
  assert.ok(!lines.some((l) => /No exclusions group recognised/.test(l)), 'and never that IAMAI proved there is none')
})
