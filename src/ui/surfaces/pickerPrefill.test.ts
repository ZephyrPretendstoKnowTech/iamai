// U24: a picker opens on the one object the scan matched, and only Save makes it
// the plan's decision. U27: why a policy that already excludes the tenant's
// exclusions group still waits on Create or Correct Exclusions Group.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { directoryEvidenceFromGroups, exclusionsGroupChoice, operatorExclusionsDecision } from '../../mapping/safetyChoice.ts'
import { laneReadings } from './planLanes.ts'
import { initialPicked, pickerVars } from './pickerRows.ts'

const STEP = PREREQ_STEP_ID.exclusionsGroup
const LEGACY = 's-goal-block-legacy-auth'
const lc = (s: string): string => s.toLowerCase()

const candidatesOf = (f: Fixture) => exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') }).candidates
const pickerOf = (f: Fixture) => pickerVars(STEP, '{name}', { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, groups: f.groups })
const renamed = (f: Fixture, name: string, over: Partial<Fixture> = {}): Fixture => ({ ...f, ...over, name } as Fixture)
const saveGroup = (f: Fixture, id: string, name: string): Fixture => renamed(f, name, { mapping: applyStepDecisions(f.mapping, { [STEP]: { picked: [id], at: f.snapshot.asOf } }) })

/** Nobody has answered the exclusions question on mid, where two groups qualify. */
const unanswered = (): Fixture => renamed(noExclusionsAnswer(fixture('mid')), 'mid-b6-unanswered')

/** The same tenant without its break-glass group: one group qualifies, and nobody has chosen it. */
function oneGroup(): { f: Fixture; id: string } {
  const base = unanswered()
  const drop = candidatesOf(base).find((c) => /break/i.test(c.name))
  assert.ok(drop, 'mid has a second qualifying group to take away')
  const strip = (ids: unknown): string[] => (Array.isArray(ids) ? (ids as string[]) : []).filter((g) => lc(g) !== lc(drop.id))
  const rows = (base.snapshot.config.caPolicies?.rows ?? []).map((p) => {
    const raw = p as { conditions?: { users?: Record<string, unknown> } & Record<string, unknown> }
    const users = raw.conditions?.users
    return users ? { ...raw, conditions: { ...raw.conditions, users: { ...users, includeGroups: strip(users.includeGroups), excludeGroups: strip(users.excludeGroups) } } } : p
  })
  const f = renamed(base, 'mid-b6-one-group', {
    groups: new Map([...base.groups].filter(([id]) => lc(id) !== lc(drop.id))),
    snapshot: { ...base.snapshot, config: { ...base.snapshot.config, caPolicies: { ...base.snapshot.config.caPolicies!, rows } } },
  })
  const [only, ...rest] = candidatesOf(f)
  assert.ok(only && rest.length === 0, 'exactly one group qualifies')
  return { f, id: only.id }
}

test('the exclusions picker keeps a detected group unselected until the operator chooses it', () => {
  const { f, id } = oneGroup()
  const ex = pickerOf(f)
  assert.ok(ex, 'the exclusions step has a picker')
  assert.deepEqual(ex.groupsTicked, [], 'nothing is ticked that nobody ticked')
  assert.equal(ex.groupsMatched, undefined, 'the scan suggestion is not a selected chip')
  assert.deepEqual(initialPicked(ex, 'groups', null, ex.groupsIds as string[], true), { picked: [], matched: [] })
  assert.ok((ex.groupsIds as string[]).includes(id), 'the candidate remains available after focus or search')
  assert.equal(operatorExclusionsDecision(f.mapping), null)
  const lane = laneReadings(runFixture(f).steps).get(STEP)
  assert.deepEqual([lane?.lane, lane?.substatus], ['Ready', 'Decision'])
})

test('U24: where two groups qualify nothing opens pre-filled, and a saved decision always wins', () => {
  const ex = pickerOf(unanswered())!
  assert.equal(ex.groupsMatched, undefined, 'two candidates are a question, not a match')
  assert.deepEqual(initialPicked(ex, 'groups', null, ex.groupsIds as string[], true), { picked: [], matched: [] })
  const one = pickerOf(oneGroup().f)!
  assert.deepEqual(initialPicked(one, 'groups', { picked: ['a-saved-group'] }, one.groupsIds as string[], true), { picked: ['a-saved-group'], matched: [] })
})

test('U27: a policy that already excludes a qualifying group waits on the unanswered exclusions question, not on a mismatched id', () => {
  const f = unanswered()
  const policy = (f.snapshot.config.caPolicies?.rows ?? []).find((p) => /legacy/i.test(String((p as { displayName?: string }).displayName ?? ''))) as { conditions?: { users?: { excludeGroups?: string[] } } } | undefined
  const excluded = policy?.conditions?.users?.excludeGroups ?? []
  const candidates = candidatesOf(f)
  assert.ok(candidates.length > 1, 'two groups qualify, so IAMAI infers nobody’s answer')
  const inPolicy = candidates.find((c) => excluded.some((g) => lc(g) === lc(c.id)))
  assert.ok(inPolicy, 'the policy excludes one of the candidates, by the very id the scan read')
  const before = runFixture(f).steps.find((s) => s.id === LEGACY)
  assert.deepEqual((before?.action.missing ?? []).map((m) => m.token), ['{exclusionsGroup}'], 'unanswered, the policy waits on the exclusions group')
  const after = runFixture(saveGroup(f, inPolicy.id, 'mid-b6-answered')).steps.find((s) => s.id === LEGACY)
  assert.equal((after?.action.missing ?? []).some((m) => m.token === '{exclusionsGroup}'), false, 'answered, the exclusion the policy already carries counts')
})
