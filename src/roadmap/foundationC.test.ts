// Foundation C's boundary: detected, recommended and operator-confirmed are
// three different things, and only the third may reach a policy.
//
// The bug this replaces was not a wrong guess. It was that there was nowhere to
// put a right one: the exclusions picker ticked whichever group the most
// policies excluded, `defaultDecisions` applied that tick as the plan's
// decision, and from there the group was in `{exclusionsGroup}` — the portal
// lines, the JSON, the PowerShell, the population every step leaves alone and
// the exclusions coverage reads as expected. A tenant with two carve-out groups
// got the one that sorted first, written into the policies its operator was
// about to deploy, with nothing on screen that had ever asked.
//
// So the tests here are mostly about what does *not* happen. The sweeps are the
// ones that matter: a new consumer that reads the stored record instead of the
// choice, or a new detection that writes the record, fails them without
// anybody having to notice the line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Fixture } from './fixtures/index.ts'
import { applyStepDecisions, DECISION_STEPS } from './decisions.ts'
import { EXCLUSIONS_RECORD_KEY, exclusionsGroupChoice, resolveSafetyChoice, withoutExclusionsGroupAnswer } from '../mapping/safetyChoice.ts'
import type { SafetyCandidate } from '../mapping/safetyChoice.ts'
import { defaultDecisions, pickerVars } from '../ui/surfaces/pickerRows.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import { implementationOffered, missingObjects } from '../ui/surfaces/stepJson.ts'
import type { MappingState } from '../mapping/types.ts'

const AT = '2026-01-01T00:00:00.000Z'
const candidate = (id: string, excludedFrom = 1): SafetyCandidate => ({ id, name: id, memberCount: 1, excludedFrom })

// ---- 1: the primitive ----

test('the primitive: nothing but an operator confirms, and one candidate is the only length that earns a recommendation', () => {
  const none = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed: null, presence: 'unknown', candidates: [] })
  assert.equal(none.status, 'none-found')
  assert.equal(none.confirmedId, null)
  assert.equal(none.recommended, null)

  const one = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed: null, presence: 'unknown', candidates: [candidate('g-1')] })
  assert.equal(one.status, 'recommended')
  assert.equal(one.recommended?.id, 'g-1')
  assert.equal(one.confirmedId, null, 'a recommendation is not an answer')
  assert.equal(one.unresolved, true)

  // Two plausible groups is a question, not a sort order to break the tie with.
  const two = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed: null, presence: 'unknown', candidates: [candidate('g-1', 9), candidate('g-2', 2)] })
  assert.equal(two.status, 'ambiguous')
  assert.equal(two.recommended, null, 'IAMAI does not put one of two forward')
  assert.equal(two.confirmedId, null)
  assert.deepEqual(two.candidates.map((c) => c.id), ['g-1', 'g-2'], 'both are still offered')
})

test('the primitive: a confirmed object that has gone becomes unresolved, and is never replaced', () => {
  const confirmed = { id: 'g-chosen', name: 'Core - Exclusions' }
  const candidates = [candidate('g-other', 9)]

  const live = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed, presence: 'present', candidates })
  assert.equal(live.status, 'confirmed')
  assert.equal(live.confirmedId, 'g-chosen')

  const gone = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed, presence: 'absent', candidates })
  assert.equal(gone.status, 'invalidated')
  assert.equal(gone.confirmedId, null, 'nothing acts on a choice whose object has gone')
  assert.equal(gone.invalidatedId, 'g-chosen', 'and the step can say which one')
  assert.equal(gone.recommended, null, 'the group IAMAI would recommend does not quietly take its place')

  // Having looked nowhere is not evidence that something is missing.
  const blind = resolveSafetyChoice({ role: 'exclusionsGroup', confirmed, presence: 'unknown', candidates })
  assert.equal(blind.status, 'confirmed')
  assert.equal(blind.confirmedId, 'g-chosen')
})

// ---- 2: the exclusions group, on a real plan ----

/** The fixture with the operator's answer taken out: a tenant that has scanned and decided nothing. */
function undecided(f: Fixture): MappingState {
  return { ...f.mapping, records: withoutExclusionsGroupAnswer(f.mapping.records) }
}

/** The offered steps whose policy body carries one of these ids: what a recommendation would have leaked into. */
function offeredNaming(r: ReturnType<typeof runFixture>, ids: string[]): string[] {
  const wanted = ids.map((id) => id.toLowerCase())
  return r.steps
    .filter((s) => implementationOffered(s))
    .filter((s) => {
      const body = JSON.stringify(s.action.resolution?.policies ?? s.action.json ?? null).toLowerCase()
      return wanted.some((id) => body.includes(id))
    })
    .map((s) => s.id)
}

/** How many policy steps are held back by the exclusions-group step. */
function waitsOnExclusions(r: ReturnType<typeof runFixture>): number {
  return r.steps.filter((s) => (s.action.resolution?.policies.length ?? 0) > 0 && !implementationOffered(s) && missingObjects(s).some((m) => m.stepId !== null && DECISION_STEPS.exclusions.has(m.stepId))).length
}

const ctxFor = (f: Fixture, r: ReturnType<typeof runFixture>, mapping: MappingState): StepVarContext => ({
  snapshot: f.snapshot,
  mapping,
  nameOf: (id) => r.input.names!.label(id),
  signature: 'IT',
  operatorId: f.operatorId,
  now: f.snapshot.asOf,
  groups: f.groups,
  naming: r.coverage.organisation.naming,
  ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming),
})

test('a tenant that has confirmed nothing: the group IAMAI can see reaches no policy the operator would deploy', () => {
  const f = fixture('small')
  const mapping = undecided(f)
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping, groups: f.groups })
  assert.ok(choice.candidates.length > 0, 'the fixture has a group that plausibly is the exclusions group')
  assert.equal(choice.confirmedId, null, 'and nothing in the plan may act on it')
  assert.notEqual(choice.status, 'confirmed')

  const r = runFixture({ ...f, mapping })
  const step = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))!
  // Every step whose policy carves the group out waits, and no step that is
  // offered carries the id of a group nobody chose: a policy body naming a
  // recommendation is exactly the accident this foundation exists to prevent.
  assert.deepEqual(offeredNaming(r, choice.candidates.map((c) => c.id)), [], 'no offered policy names a group nobody chose')
  assert.ok(waitsOnExclusions(r) > 0, 'and the policies that carve it out wait')

  // And the picker ticks nothing, so a Save cannot be a tick nobody made.
  const ex = stepVars(step, ctxFor(f, r, mapping)) as Record<string, unknown>
  assert.deepEqual(ex.groupsTicked, [], 'nothing is pre-ticked')
  assert.ok(Array.isArray(ex.groups) && (ex.groups as string[]).length > 0, 'the groups are still offered')
})

test('the same tenant, once the operator confirms: the choice resolves and the policies name the group', () => {
  const f = fixture('small')
  const before = undecided(f)
  const r0 = runFixture({ ...f, mapping: before })
  const stepId = r0.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))!.id
  const chosen = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: before, groups: f.groups }).candidates[0]

  const after = applyStepDecisions(before, { [stepId]: { picked: [chosen.id], at: AT } })
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: after, groups: f.groups })
  assert.equal(choice.status, 'confirmed')
  assert.equal(choice.confirmedId, chosen.id)

  const r = runFixture({ ...f, mapping: after })
  const step = r.steps.find((s) => s.id === stepId)!
  const offered = r.steps.filter((s) => (s.action.resolution?.policies.length ?? 0) > 0).filter((s) => implementationOffered(s))
  assert.ok(offered.length > 0, 'with the group confirmed, the policy steps offer their instructions')
  const ex = stepVars(step, ctxFor(f, r, after)) as Record<string, unknown>
  assert.deepEqual(ex.groupsTicked, [chosen.id], 'and the chip comes back')
})

test('a confirmed group the scan can no longer read: unresolved, said so, and the answer left where it was', () => {
  const f = fixture('small')
  const stepId = [...DECISION_STEPS.exclusions][0]
  // The operator confirmed a group; by the next scan it is not in the directory
  // and no policy names it.
  const mapping = applyStepDecisions(undecided(f), { [stepId]: { picked: ['g-deleted-since'], at: AT } })
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping, groups: f.groups })
  assert.equal(choice.status, 'invalidated')
  assert.equal(choice.confirmedId, null)
  assert.equal(choice.invalidatedId, 'g-deleted-since')
  assert.equal(mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId, 'g-deleted-since', 'the operator’s answer is not rewritten')

  const r = runFixture({ ...f, mapping })
  const step = r.steps.find((s) => s.id === stepId)!
  assert.deepEqual(offeredNaming(r, ['g-deleted-since', ...choice.candidates.map((c) => c.id)]), [], 'no offered policy names the group that went, or one nobody chose')
  assert.ok(waitsOnExclusions(r) > 0, 'the policies that carve a group out wait while the choice is unresolved')
  const ex = stepVars(step, ctxFor(f, r, mapping)) as Record<string, unknown>
  assert.equal(ex.exclusionsGroup, undefined, 'no line names a group that is gone')
  assert.equal(ex.invalidatedGroup, 'g-deleted-since', 'the step can say which one went')
  assert.equal(ex.needsCreate, false, 'and does not tell the operator to make a second one')
})

test('two groups could be it: no recommendation, and the step names both', () => {
  const f = fixture('small')
  const mapping = undecided(f)
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping, groups: f.groups })
  assert.equal(choice.status, 'ambiguous', `two candidates expected, got ${choice.candidates.map((c) => c.id).join(', ')}`)
  assert.equal(choice.recommended, null, 'the group excluded from the most policies does not win by default')
  assert.equal(choice.confirmedId, null)

  const r = runFixture({ ...f, mapping })
  const step = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))!
  const ex = stepVars(step, ctxFor(f, r, mapping)) as Record<string, unknown>
  assert.deepEqual(ex.groupsTicked, [])
  assert.equal(ex.recommendedGroup, undefined, 'nothing is put forward')
  assert.deepEqual(ex.ambiguousGroups, choice.candidates.map((c) => c.name), 'both are named')
  assert.equal(ex.needsCreate, false, 'and nobody is told to make a third')
})

test('one group could be it: it is recommended, and the recommendation is all it is', () => {
  const f = fixture('messy')
  const mapping = undecided(f)
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping, groups: f.groups })
  assert.equal(choice.status, 'recommended', `one candidate expected, got ${choice.candidates.map((c) => c.id).join(', ')}`)
  assert.equal(choice.confirmedId, null, 'a recommendation still resolves nothing')

  const r = runFixture({ ...f, mapping })
  const step = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))!
  const ex = stepVars(step, ctxFor(f, r, mapping)) as Record<string, unknown>
  assert.equal(ex.recommendedGroup, choice.recommended!.name, 'the step puts it forward by name')
  assert.equal(ex.recommendedGroupId, choice.recommended!.id)
  assert.deepEqual(ex.groupsTicked, [], 'and does not tick it')
  assert.equal(ex.exclusionsGroup, undefined, 'no line reads as though the plan were using it')
  assert.deepEqual(offeredNaming(r, [choice.recommended!.id]), [], 'and no policy body carries it')
})

// ---- 3: the boundary, swept ----

test('no detection writes the exclusions group, on any fixture', () => {
  for (const f of allFixtures()) {
    const mapping = undecided(f)
    const r = runFixture({ ...f, mapping })
    const ctx = { snapshot: f.snapshot, mapping, nameOf: (id: string) => r.input.names!.label(id), groups: f.groups, now: f.snapshot.asOf }
    const defaults = defaultDecisions(ctx)
    for (const stepId of DECISION_STEPS.exclusions) {
      assert.equal(defaults[stepId], undefined, `${f.name}: the exclusions picker offers no pre-ticked decision`)
    }
    // Even handed one, the detected pass refuses to write it: a decision the
    // operator did not make cannot become one by being applied twice.
    const forced = applyStepDecisions(mapping, { [[...DECISION_STEPS.exclusions][0]]: { picked: ['g-anything'], at: AT } }, 'detected')
    assert.equal(forced.records[EXCLUSIONS_RECORD_KEY], undefined, `${f.name}: a detected default cannot write the record`)
    // And the picker's own ticks are the confirmed group or nothing.
    const ticked = pickerVars([...DECISION_STEPS.exclusions][0], '{name}', ctx)?.groupsTicked
    assert.deepEqual(ticked, [], `${f.name}: nothing is ticked before somebody decides`)
  }
})

test('every fixture that has confirmed a group still resolves it', () => {
  const confirmed = allFixtures().filter((f) => f.mapping.records[EXCLUSIONS_RECORD_KEY]?.resolvedId)
  assert.ok(confirmed.length > 0, 'the fixtures include confirmed tenants')
  for (const f of confirmed) {
    const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups })
    assert.equal(choice.status, 'confirmed', `${f.name}: a confirmed answer stays confirmed`)
    assert.equal(choice.confirmedId, f.mapping.records[EXCLUSIONS_RECORD_KEY].resolvedId)
  }
})

test('the exclusions record has one reader, and it is the choice', () => {
  // A grep, pinned. The stored answer is reachable only through
  // safetyChoice.ts: everything else asks the choice, which is the only thing
  // that knows whether an operator made the answer and whether the object is
  // still there. A new line anywhere else is a second authority — and it will be
  // the authority that does not check either.
  const allowed = new Set(['src/mapping/safetyChoice.ts'])
  const hits: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.') || full.includes('/fixtures/')) continue
      if (allowed.has(full)) continue
      for (const line of readFileSync(full, 'utf8').split('\n')) {
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) continue
        if (code.includes('__globalExclusion')) hits.push(`${full}: ${code}`)
      }
    }
  }
  walk('src')
  assert.deepEqual(hits, [], 'the exclusions record is read through safetyChoice.ts and nowhere else')
})
