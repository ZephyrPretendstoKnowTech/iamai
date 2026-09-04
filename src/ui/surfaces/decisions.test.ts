// Prune B (3): a saved decision changes the plan, on the demo tenant. Saving
// two emergency accounts removes the create instructions; saving a group makes
// every policy step's exclusions line name it; and before any group exists the
// line names the group the exclusions step proposes, never an unnamed thing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { FixtureRun } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { Step } from '../../roadmap/types.ts'
import { applyStepDecisions, DECISION_STEPS, validStepDecisions } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { shared } from '../../content/content.ts'
import { UNNAMED } from '../../names.ts'
import { stepVars } from './stepVars.ts'
import { appliedMapping, defaultDecisions, filterPickerObjects, pickerUniverse, pickerVars } from './pickerRows.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/generate.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'

const AT = '2026-09-02T00:00:00.000Z'

/** The demo derived with a mapping of the test's choosing, as the plan does after a decision (no memo). */
function run(f: Fixture, mapping: MappingState): FixtureRun {
  return runFixture({ ...f, mapping }, { mapping })
}

function ctxFor(f: Fixture, r: FixtureRun, mapping: MappingState): StepVarContext {
  return { snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: null, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
}

/** Every policy step's portal lines, as the step and the exports render them. */
function policyPortals(f: Fixture, r: FixtureRun, mapping: MappingState): { step: Step; lines: string[] }[] {
  const ctx = ctxFor(f, r, mapping)
  const out: { step: Step; lines: string[] }[] = []
  for (const step of r.steps) {
    const cs = contentStepFor(step) as { kind?: string; title?: string } | undefined
    if (!cs || cs.kind !== 'policy') continue
    const ex = stepVars(step, ctx)
    const names = portalNamesFor(ctx, ex, String(cs.title))
    const lines = stepPortalLines(step.goalId, names) ?? (step.floor && step.action.json ? stepPortalLinesFromBody(step.action.json, names) : null)
    if (lines && lines.length > 0) out.push({ step, lines })
  }
  return out
}

/** The exclusions line's opening, up to the group's name (shared.exclusionsLine). */
const EXCLUSIONS_PREFIX = String(shared.exclusionsLine).split('{exclusionsGroup}')[0]

test('saving two emergency accounts removes the create instructions', () => {
  const f = fixture('demo')
  // One account held: the checks engine asks for a second, and the step shows
  // the create instructions with a picker of the accounts the signals nominate.
  const one: MappingState = { ...f.mapping, breakGlassUserIds: f.mapping.breakGlassUserIds.slice(0, 1) }
  const before = run(f, one)
  const step = before.steps.find((s) => DECISION_STEPS.emergency.has(s.id))
  assert.ok(step, 'one account: the emergency-access step is in the plan')
  const ex = stepVars(step, ctxFor(f, before, one))
  assert.equal(ex.needsCreate, true, 'one account: the create instructions show')
  const rows = ex.emergencyCandidates as string[]
  const ids = ex.emergencyCandidatesIds as string[]
  assert.equal(rows.length, ids.length)
  assert.ok(f.mapping.breakGlassUserIds.every((id) => ids.includes(id)), 'the picker nominates both accounts')
  assert.deepEqual(ex.emergencyCandidatesTicked, one.breakGlassUserIds, 'the one the plan holds starts ticked')
  for (const row of rows) assert.doesNotMatch(row, /[0-9a-f]{8}-[0-9a-f]{4}/i, 'a row is names, never an id')

  // Save both: the decision is the plan's, and the next derivation has no
  // second-account check and no create instructions.
  const decided = applyStepDecisions(one, { [step.id]: { picked: f.mapping.breakGlassUserIds, at: AT } })
  assert.deepEqual(decided.breakGlassUserIds, f.mapping.breakGlassUserIds)
  assert.equal(decided.wizardAnswered.breakGlass, true)
  assert.equal(one.breakGlassUserIds.length, 1, 'the mapping passed in is not mutated')
  const after = run(f, decided)
  const stepAfter = after.steps.find((s) => DECISION_STEPS.emergency.has(s.id))
  assert.ok(!stepAfter || stepVars(stepAfter, ctxFor(f, after, decided)).needsCreate !== true, 'two accounts: the create instructions are gone')
  assert.ok(!stepAfter || !stepAfter.checks?.items.some((it) => it.fix === 'second-account'), 'two accounts: no second-account check')
})

test('saving a group names it on every policy step; before that, the proposed group is named, never an unnamed thing', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  // The demo starts without an exclusions group: the line names the group the
  // exclusions step proposes, in the tenant's convention.
  const exclusionsStep = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))
  assert.ok(exclusionsStep?.naming?.proposed, 'the exclusions step carries the proposed name')
  const proposed = exclusionsStep.naming!.proposed
  const before = policyPortals(f, r, f.mapping)
  assert.ok(before.length >= 10, 'the demo has policy steps with portal lines')
  for (const { step, lines } of before) {
    const exclusions = lines.filter((l) => l.includes(EXCLUSIONS_PREFIX))
    assert.ok(exclusions.length > 0, `${step.id}: has an exclusions line`)
    for (const l of exclusions) assert.ok(l.includes(`${EXCLUSIONS_PREFIX}${proposed}.`), `${step.id}: names the proposed group: ${l}`)
    for (const l of lines) assert.ok(!l.includes(UNNAMED), `${step.id}: no unnamed thing: ${l}`)
  }
  // The exclusions step's picker lists the tenant's groups, with member counts and how many policies exclude each.
  const ex = stepVars(exclusionsStep, ctxFor(f, r, f.mapping))
  const rows = ex.groups as string[]
  assert.ok(rows.some((row) => row.startsWith('Core - Exclusions')), 'the tenant group is a row')
  assert.ok(rows.every((row) => /\d+ members? .* \d+ of \d+ polic/.test(row)), `rows carry counts: ${rows.join(' | ')}`)

  // Save the tenant's group: every exclusions line names it, on the next derivation.
  const gid = [...f.groups.entries()].find(([, g]) => g.displayName === 'Core - Exclusions')![0]
  const decided = applyStepDecisions(f.mapping, { [exclusionsStep.id]: { picked: [gid], at: AT } })
  assert.equal(decided.records['__globalExclusion'].resolvedId, gid)
  assert.equal(decided.records['__globalExclusion'].doesNotExist, false)
  const r2 = run(f, decided)
  const after = policyPortals(f, r2, decided)
  assert.equal(after.length, before.length, 'the same policy steps')
  for (const { step, lines } of after) {
    const exclusions = lines.filter((l) => l.includes(EXCLUSIONS_PREFIX))
    assert.ok(exclusions.length > 0, `${step.id}: has an exclusions line`)
    for (const l of exclusions) assert.ok(l.includes(`${EXCLUSIONS_PREFIX}Core - Exclusions.`), `${step.id}: names the saved group: ${l}`)
    for (const l of lines) assert.ok(!l.includes(UNNAMED), `${step.id}: no unnamed thing: ${l}`)
  }
  // The picker on whichever exclusions step remains (correct the group) starts on the saved group.
  const remaining = r2.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))
  if (remaining) assert.deepEqual(stepVars(remaining, ctxFor(f, r2, decided)).groupsTicked, [gid])
})

// The plan's decision is the picker's pre-ticked default until the person
// changes it: the first render, with every detected default applied, equals
// the render after a Save on every picker that changed nothing.
test('GetIAMAI: the first render equals the render after a no-change Save on every picker', () => {
  const f = fixture('getiamai')
  const r0 = runFixture(f)
  const nameOf = (id: string): string => r0.input.names!.label(id)
  const defaults = defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf })
  assert.ok(Object.keys(defaults).length >= 3, `the fixture detects defaults (${Object.keys(defaults).join(', ')})`)
  const first = applyStepDecisions(f.mapping, defaults, 'detected')
  const r1 = run(f, first)
  const ctxOf = (r: FixtureRun, mapping: MappingState): StepVarContext => ({ ...ctxFor(f, r, mapping), operatorId: f.operatorId })
  const render = (r: FixtureRun, mapping: MappingState) => {
    const ctx = ctxOf(r, mapping)
    return r.steps.map((step) => {
      const ex = stepVars(step, ctx) as Record<string, unknown>
      const cs = contentStepFor(step) as { kind?: string; title?: string } | undefined
      const lines = cs?.kind === 'policy' ? stepPortalLines(step.goalId, portalNamesFor(ctx, ex, String(cs.title))) : null
      return { id: step.id, status: step.status, checks: step.checks ? `${step.checks.failing}/${step.checks.total}` : null, blockedBy: step.blockedBy, ex, lines }
    })
  }
  const before = render(r1, first)
  // A no-change Save on every picker: what the first render ticks, saved as is.
  const saved: Record<string, StepDecision> = {}
  const ctx1 = ctxOf(r1, first)
  for (const step of r1.steps) {
    const cs = contentStepFor(step) as { decision?: { pickerRow?: string; pickerSource?: string } } | undefined
    if (typeof cs?.decision?.pickerRow !== 'string') continue
    const ex = stepVars(step, ctx1) as Record<string, unknown>
    const key = cs.decision.pickerSource ?? (typeof ex.pickerKey === 'string' ? ex.pickerKey : null)
    if (!key) continue
    const ticked = ex[`${key}Ticked`] ?? ex[`${key}Ids`]
    if (Array.isArray(ticked) && ticked.length > 0) saved[step.id] = { picked: ticked as string[], at: AT }
  }
  assert.ok(Object.keys(saved).length >= 3, `the pickers had something to save (${Object.keys(saved).join(', ')})`)
  const second = applyStepDecisions(first, saved)
  const r2 = run(f, second)
  assert.deepEqual(render(r2, second), before)
})

// The typeahead: typing filters every account in the tenant by name and UPN, and
// a chosen chip saves through applyStepDecisions and comes back ticked.
test('GetIAMAI: typing sv on the emergency picker lists every account whose name or UPN contains it, and a saved chip round-trips', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups }
  const universe = pickerUniverse(BREAK_GLASS_STEP_ID, null, ctx)
  assert.equal(universe.length, f.snapshot.users.length, 'every account in the tenant is there to type against')
  // Every account whose name or UPN contains the query, and nothing else. The
  // fixture's accounts (Kai Brown, user0@…, Break-glass 1) hold no 'sv', so the
  // same rule is asserted on a query they do match.
  const expectedFor = (q: string): string[] => f.snapshot.users.filter((u) => nameOf(u.id).toLowerCase().includes(q) || (u.userPrincipalName ?? '').toLowerCase().includes(q)).map((u) => u.id).sort()
  for (const q of ['sv', 'an', 'BREAK']) assert.deepEqual(filterPickerObjects(universe, q).map((o) => o.id).sort(), expectedFor(q.toLowerCase()), 'typing ' + q)
  const typed = filterPickerObjects(universe, 'an').map((o) => o.id).sort()
  assert.ok(typed.length >= 2, 'the fixture has accounts matching an')
  assert.deepEqual(filterPickerObjects(universe, ''), [], 'an empty query shows the nominations, not the tenant')
  // A chip chosen from the typed results, saved as the picker saves it.
  const chip = typed[0]
  const saved = applyStepDecisions(f.mapping, { [BREAK_GLASS_STEP_ID]: { picked: [chip], at: AT } })
  assert.deepEqual(saved.breakGlassUserIds, [chip], 'Save writes the chip through applyStepDecisions')
  const again = pickerVars(BREAK_GLASS_STEP_ID, '{name}', { ...ctx, mapping: saved })
  assert.ok(Array.isArray(again?.emergencyCandidatesTicked) && (again!.emergencyCandidatesTicked as string[]).includes(chip), 'the chip comes back ticked on the next open')
  // The exclusions group is never a candidate for the admins group.
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  assert.ok(exclusions, 'the fixture recognises an exclusions group')
  assert.ok(!pickerUniverse(DECISION_STEPS.adminsGroup, 'adminGroups', ctx).some((o) => o.id.toLowerCase() === String(exclusions).toLowerCase()))
  assert.ok(pickerUniverse(DECISION_STEPS.exclusions.values().next().value as string, 'groups', ctx).some((o) => o.id.toLowerCase() === String(exclusions).toLowerCase()))
})

// ---- Run 1B: a persisted admins group that is the exclusions group ----
// One group can never be both. A decision saved before that rule existed must
// not keep driving the plan: it applies as no decision at all, and every other
// saved decision is untouched.

/** The demo of the invalid record: the exclusions group saved as the admins group, beside two decisions that are perfectly valid. */
function staleAdminsGroup(f: Fixture): { exclusions: string; valid: string; stale: Record<string, StepDecision>; clean: Record<string, StepDecision> } {
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId as string
  assert.ok(exclusions, 'the fixture recognises an exclusions group')
  const valid = [...f.groups.keys()].find((id) => id !== exclusions) as string
  assert.ok(valid, 'the fixture holds another group')
  const clean: Record<string, StepDecision> = {
    [BREAK_GLASS_STEP_ID]: { picked: [...f.mapping.breakGlassUserIds], at: AT },
    [DECISION_STEPS.countries]: { picked: ['AU'], at: AT },
  }
  return { exclusions, valid, stale: { ...clean, [DECISION_STEPS.adminsGroup]: { picked: [exclusions], at: AT } }, clean }
}

test('GetIAMAI: the exclusions group is never a candidate for the admins group, though its members hold admin roles', () => {
  const f = fixture('getiamai')
  const { exclusions } = staleAdminsGroup(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, groups: f.groups }
  // Without the rule the group would qualify: it holds the emergency accounts,
  // and they hold a directory role.
  const admins = new Set(Object.keys(f.snapshot.roles.active))
  assert.ok((f.groups.get(exclusions)?.memberIds ?? []).some((m) => admins.has(m)), 'the exclusions group holds an admin')
  const ex = pickerVars(DECISION_STEPS.adminsGroup, '{name} · {memberCount} members · {rolesHeld}', ctx) as Record<string, string[]>
  assert.ok(ex.adminGroupsIds.length > 0, 'the picker still nominates a group')
  assert.ok(!ex.adminGroupsIds.includes(exclusions), 'the exclusions group is not nominated')
  assert.ok(!ex.adminGroupsTicked.includes(exclusions), 'and is never pre-ticked')
  assert.ok(!pickerUniverse(DECISION_STEPS.adminsGroup, 'adminGroups', ctx).some((o) => o.id === exclusions), 'nor typeable')
  // The same group is still the exclusions group's own answer.
  assert.ok(pickerUniverse([...DECISION_STEPS.exclusions][0], 'groups', ctx).some((o) => o.id === exclusions))
})

test('GetIAMAI: a stored admins group that is the exclusions group applies as no decision, and nothing else changes', () => {
  const f = fixture('getiamai')
  const { exclusions, stale, clean } = staleAdminsGroup(f)
  // 1. The applied value is unset: the decision is dropped whole, and no other
  //    group is put in its place.
  const valid = validStepDecisions(f.mapping, stale)
  assert.equal(valid[DECISION_STEPS.adminsGroup], undefined, 'the invalid decision is not applied')
  assert.deepEqual(valid, clean, 'every unrelated decision survives unchanged')
  assert.deepEqual(stale[DECISION_STEPS.adminsGroup]?.picked, [exclusions], 'the record handed in is not mutated')

  // 2. Nothing the plan derives can see it: the applied mapping, and every
  //    step's variables and portal lines (plan scope, policy generation,
  //    derived facts and the implementation guidance) are the ones the plan
  //    has with no admins-group decision at all.
  const nameOf = (id: string): string => id
  const dctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }
  assert.deepEqual(appliedMapping(dctx, stale), appliedMapping(dctx, clean), 'the applied mapping is the undecided one')
  const withStale = applyStepDecisions(f.mapping, stale)
  const withClean = applyStepDecisions(f.mapping, clean)
  assert.deepEqual(withStale, withClean, 'the mapping every consumer reads is identical')
  const render = (mapping: MappingState) => {
    const r = run(f, mapping)
    const ctx = ctxFor(f, r, mapping)
    return r.steps.map((step) => {
      const ex = stepVars(step, ctx) as Record<string, unknown>
      const cs = contentStepFor(step) as { kind?: string; title?: string } | undefined
      return { id: step.id, status: step.status, blockedBy: step.blockedBy, ex, lines: cs?.kind === 'policy' ? stepPortalLines(step.goalId, portalNamesFor(ctx, ex, String(cs.title))) : null }
    })
  }
  assert.deepEqual(render(withStale), render(withClean), 'every step renders as it does undecided')
  const name = f.groups.get(exclusions)?.displayName as string
  for (const step of render(withStale)) for (const line of step.lines ?? []) assert.ok(!/admins group/i.test(line) || !line.includes(name), `${step.id}: no guidance names it as the admins group: ${line}`)

  // 3. The step opens on no chip naming it (ContentStep: the saved pick, else
  //    the picker's ticked ids).
  const ticked = (pickerVars(DECISION_STEPS.adminsGroup, '{name} · {memberCount} members · {rolesHeld}', { snapshot: f.snapshot, mapping: withStale, nameOf, groups: f.groups }) as Record<string, string[]>).adminGroupsTicked
  const opensOn = valid[DECISION_STEPS.adminsGroup]?.picked ?? ticked
  assert.ok(!opensOn.includes(exclusions), 'the admins-group picker opens on no chip naming the exclusions group')

  // 4. The exports carry the same decisions the surfaces do (Export.tsx passes
  //    the sanitised map to buildPlanFile), so the invalid id is in no file.
  assert.ok(!JSON.stringify({ stepDecisions: valid }).includes(exclusions), 'no exported decision names it')

  // 5. Emergency accounts and the exclusions group itself are untouched.
  assert.deepEqual(withStale.breakGlassUserIds, [...f.mapping.breakGlassUserIds])
  assert.equal(withStale.records['__globalExclusion'].resolvedId, exclusions, 'it is still the exclusions group')

  // 6. Reload: re-deriving from the same persisted record never restores it.
  const again = validStepDecisions(applyStepDecisions(f.mapping, stale), stale)
  assert.equal(again[DECISION_STEPS.adminsGroup], undefined, 'a second derivation drops it too')
})

test('GetIAMAI: a valid saved admins group stays the plan decision', () => {
  const f = fixture('getiamai')
  const { valid, clean } = staleAdminsGroup(f)
  const saved = { ...clean, [DECISION_STEPS.adminsGroup]: { picked: [valid], at: AT } }
  assert.deepEqual(validStepDecisions(f.mapping, saved), saved, 'a group that is not the exclusions group is authoritative')
  // And the exclusions group's own decision is never the one dropped: saving it
  // there leaves the admins group's valid answer alone.
  const both = { ...saved, [[...DECISION_STEPS.exclusions][0]]: { picked: [f.mapping.records['__globalExclusion']?.resolvedId as string], at: AT } }
  assert.deepEqual(validStepDecisions(f.mapping, both), both)
})
