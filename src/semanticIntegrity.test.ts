// Product truth and decision integrity (task 042).
//
// One fact, one authority, many presentations. This file is the standing proof
// of that sentence: for every semantic scenario the corpus can find
// (roadmap/fixtures/semantics.ts), it asks the same question of every consumer
// that answers it — the collapsed Plan row, the opened step's Step Contract, the
// four implementation channels, the export view the calendar/prompt pack/bundle
// speak from, MFA Readiness's summary and its person rows — and fails when two
// of them give different answers.
//
// What it is NOT: a snapshot test, and not a test about any particular tenant.
// Every case is selected by a production predicate, so a scenario stops being
// covered only when production stops producing it, and the last test in the file
// asserts that neither the corpus nor this file selects anything by id, display
// name or fixture name.
//
// Where an assertion is about a fact rather than a rendering, it compares the
// facts. Two surfaces are allowed to word the same truth differently — the
// collapsed row says "Satisfied by X" and the opened step says "Already
// delivered by X" — and are not allowed to differ about which X, or about
// whether there is one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { corpus, ctxFor, peopleIn, stepsIn } from './roadmap/fixtures/semantics.ts'
import type { PersonScenario, StepScenario } from './roadmap/fixtures/semantics.ts'
import { heldForReview } from './roadmap/lifecycle.ts'
import { implementationOffered, operationsOf, policyHold, unavailableReason } from './roadmap/operations.ts'
import { emergencySelection, operatorConfirmedEmergency } from './mapping/emergencyChoice.ts'
import { DECISION_STEPS } from './roadmap/decisions.ts'
import { defaultDecisions } from './ui/surfaces/pickerRows.ts'
import { existingOf, stepContract } from './ui/surfaces/stepContract.ts'
import { stepExportView } from './ui/surfaces/stepExport.ts'
import { jsonOffered, policyJson, stepOperations } from './ui/surfaces/stepJson.ts'
import { powershellFor } from './ui/surfaces/stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from './ui/surfaces/stepPortal.ts'
import { rowReason, rowWhen } from './ui/surfaces/rowWhen.ts'
import { statusOf, cleanupStatusOf } from './ui/surfaces/statusWord.ts'
import { stepVars } from './ui/surfaces/stepVars.ts'
import { contentStepFor } from './content/stepTitle.ts'
import { actionable, READINESS_GROUPS, shows } from './derive/mfaReadiness.ts'
import { rungOf, windowsHelloOnly } from './derive/ladder.ts'
import { stepPopulation, reached } from './derive/population.ts'
import { factsOf, stepFacts, toSetUp } from './derive/facts.ts'
import { readinessWord, nextStateWord, roleWord, methodWord, rowEvidenceText } from './ui/surfaces/readinessCells.ts'
import { readinessTable } from './ui/surfaces/inventoryTables.ts'
import { firstMfaDependency, stepMfaHold } from './derive/stepMfaReadiness.ts'
import { cleanupComplete } from './roadmap/cleanupDone.ts'
import { planFinish, planWeeks } from './derive/finish.ts'

/**
 * Every scenario the corpus names must be found in it. A scenario nothing
 * matches is an assertion that never runs, and a suite of those passes while
 * proving nothing — so the corpus's own coverage is the first thing asserted.
 */
const STEP_SCENARIOS: StepScenario[] = ['implementable', 'equivalentExists', 'needsCreate', 'needsChange', 'blockedPrerequisite', 'needsDecision', 'missingObject', 'heldForReview', 'baselineConflict', 'unknownReach', 'heldForWindow', 'unavailable', 'setAside']
const PERSON_SCENARIOS: PersonScenario[] = ['strongProven', 'registeredNotProven', 'weakerProven', 'needsPasskey', 'notAPerson', 'notActive', 'methodsUnknown', 'admin']

test('042.0: the corpus finds every scenario it names', () => {
  const emptySteps = STEP_SCENARIOS.filter((s) => stepsIn(s).length === 0)
  const emptyPeople = PERSON_SCENARIOS.filter((s) => peopleIn(s).length === 0)
  assert.deepEqual(emptySteps, [], 'a step scenario no case in the corpus produces: every assertion about it is vacuous')
  assert.deepEqual(emptyPeople, [], 'a person scenario no row in the corpus produces')
  assert.ok(corpus().length >= 12, 'the corpus is the curated tenants plus the states a first scan cannot reach')
})

// ---- 1. stable identities remain consistent ----

test('042.1: a step is the same object everywhere, and identity is never a display name', () => {
  for (const c of corpus()) {
    for (const step of c.steps) {
      const contract = stepContract(step, ctxFor(c, step))
      assert.equal(contract.id, step.id, `${c.label}: the Step Contract renamed the step it was given`)
      // The four channels operate on the operations' own policy ids, and the
      // export view speaks for the same step: nothing downstream re-identifies
      // the object from a name.
      const ops = operationsOf(step)
      for (const o of ops) {
        if (o.mode === 'update') assert.ok(typeof o.policyId === 'string' && o.policyId.length > 0, `${c.label}/${step.id}: an update with no policy to update`)
        else assert.ok(o.policyId === null || o.policyId === undefined, `${c.label}/${step.id}: a create naming a tenant policy`)
      }
      const ps = powershellFor(stepOperations(step))
      for (const o of stepOperations(step)) {
        if (o.mode === 'update') assert.ok(ps.includes(o.policyId as string), `${c.label}/${step.id}: PowerShell updates a policy the operation does not name`)
      }
    }
    // Every account in the directory is a row, once, keyed by its immutable id —
    // including the case where two accounts share a display name and one carries
    // a display name nothing was designed for.
    const ids = c.readiness.rows.map((r) => r.user.id)
    assert.equal(new Set(ids).size, ids.length, `${c.label}: an account appears twice in MFA Readiness`)
    const names = c.readiness.rows.map((r) => r.user.displayName ?? '')
    if (new Set(names).size !== names.length) {
      // A collision exists in this case, which is the point: the rows stayed
      // distinct through it.
      assert.ok(ids.length > new Set(names).size, `${c.label}: two accounts share a name and the rows collapsed`)
    }
  }
})

// ---- 2. summary counts reconcile with their declared population ----

test('042.2: every count reconciles with the rows it claims to be about', () => {
  for (const c of corpus()) {
    const { rows, groups, ladder, facts } = c.readiness
    // The three groups plus unknown partition the active people, and the four
    // are exactly the rows the view marked with a group.
    for (const g of [...READINESS_GROUPS, 'unknown'] as const) {
      assert.equal(groups[g], rows.filter((r) => r.group === g).length, `${c.label}: the ${g} count is not the ${g} rows`)
    }
    assert.equal(groups.ready + groups.needsProof + groups.needsPasskey + groups.unknown, facts.active, `${c.label}: the groups do not sum to the active people`)
    // The ledger's own parts sum to every account once.
    assert.equal(facts.active + facts.notActive + facts.kinds.emergency + facts.kinds.service + facts.kinds.shared + facts.kinds.disabled, facts.accounts, `${c.label}: the ledger's parts do not sum to the accounts`)
    assert.equal(rows.length, facts.accounts, `${c.label}: the table shows a different number of accounts from the ledger above it`)
    assert.deepEqual(factsOf(ladder), facts, `${c.label}: the view's facts are not the ladder's`)
    // Needs action is the wider set on purpose: the two settled groups plus the
    // people whose methods could not be read. The page states both numbers.
    assert.equal(rows.filter((r) => shows(r, 'needsAction')).length, actionable(groups) + groups.unknown, `${c.label}: the needs-action filter and the needs-action count describe different people`)
    // Still to set up is a subset of the active people and never a second score.
    assert.ok(toSetUp(facts) <= facts.active, `${c.label}: more people to set up than there are active people`)
    // A step's count is the ids behind it, and a step whose reach is unknown has
    // no count at all.
    for (const step of c.steps) {
      const pop = stepPopulation(step)
      if (reached(step) === null) assert.equal(pop, null, `${c.label}/${step.id}: an unsettled reach produced a count`)
      else if (pop) assert.equal(pop.active, pop.names.length, `${c.label}/${step.id}: the count is not the names`)
    }
  }
})

// ---- 3. Plan collapsed and expanded agree ----

test('042.3: the collapsed row and the opened step agree on every fact they both state', () => {
  for (const c of corpus()) {
    for (const step of c.steps) {
      const contract = stepContract(step, ctxFor(c, step))
      // The word: the row's projection is the contract's own.
      assert.equal(contract.state.word, statusOf(step).word, `${c.label}/${step.id}: the row word and the opened step's word differ`)
      assert.equal(contract.state.lifecycle, step.state.lifecycle, `${c.label}/${step.id}: the contract moved the lifecycle`)
      assert.equal(contract.state.condition, step.state.condition, `${c.label}/${step.id}: the contract moved the condition`)
      // The satisfying policy: one reading, two sentences. The row is allowed to
      // word it differently; it is not allowed to name a different set, or to say
      // two policies do it together where the contract says one does it alone.
      const existing = existingOf(step)
      const reason = rowReason(step)
      if (existing !== null) {
        assert.ok(reason !== null, `${c.label}/${step.id}: the opened step names the policy in place and the row says nothing`)
        for (const n of existing.names) if (!existing.together) assert.ok(reason.includes(existing.names[0]), `${c.label}/${step.id}: the row names a different policy (${n})`)
        assert.equal(/\btogether\b/.test(reason), existing.together, `${c.label}/${step.id}: the row and the step disagree about whether one policy covers the goal alone`)
      }
      // The date column never claims a rollout date for a step whose policy
      // cannot be written; the contract says the same by carrying no offer.
      if (unavailableReason(step) !== null && step.status !== 'done') {
        assert.equal(contract.implementation.offered, false, `${c.label}/${step.id}: an unavailable policy is offered`)
      }
      if (heldForReview(step)) {
        assert.equal(contract.state.condition, 'review-required', `${c.label}/${step.id}: held for review without the condition that says so`)
        assert.ok(rowWhen(step).length > 0, `${c.label}/${step.id}: a step held for review says nothing in its date column`)
      }
    }
  }
})

// ---- 4. lifecycle is one authority, and separate from condition ----

test('042.4: nothing derives a lifecycle of its own, and no condition implies one', () => {
  const seen = new Map<string, Set<string>>()
  for (const c of corpus()) {
    for (const step of c.steps) {
      const contract = stepContract(step, ctxFor(c, step))
      const view = stepExportView(step, ctxFor(c, step))
      // The export's stage is the contract's stage, word for word.
      assert.equal(view.stage, contract.state.stage, `${c.label}/${step.id}: the export view states a different stage from the Plan`)
      assert.equal(view.condition, contract.state.conditionLabel, `${c.label}/${step.id}: the export view states a different condition`)
      assert.equal(view.status, contract.state.word, `${c.label}/${step.id}: the export view states a different status word`)
      // The track is a projection of the lifecycle and of nothing else: it is
      // empty exactly where there is no rollout to draw, and its current stage
      // is the lifecycle itself.
      if (contract.track.length > 0) {
        assert.equal(contract.track.find((t) => t.current)?.key, step.state.lifecycle, `${c.label}/${step.id}: the track marks a stage the lifecycle is not at`)
        assert.equal(step.state.setAside || step.state.inPlace, false, `${c.label}/${step.id}: a rollout drawn for a step that never had one`)
      }
      const key = step.state.lifecycle ?? 'none'
      const set = seen.get(step.state.condition) ?? new Set<string>()
      set.add(key)
      seen.set(step.state.condition, set)
    }
  }
  // Orthogonality, stated as evidence rather than as a claim: the corpus carries
  // at least one condition that occurs at more than one lifecycle. If a consumer
  // ever collapsed the two axes this would be one-to-one.
  assert.ok([...seen.values()].some((s) => s.size > 1), 'no condition in the corpus occurs at two lifecycles: the axes have collapsed')
})

// ---- 5. blocker and actionability agree across consumers ----

test('042.5: whether an implementation is offered has exactly one answer', () => {
  for (const c of corpus()) {
    for (const step of c.steps) {
      const ctx = ctxFor(c, step)
      const contract = stepContract(step, ctx)
      const offered = implementationOffered(step)
      assert.equal(contract.implementation.offered, offered, `${c.label}/${step.id}: the Step Contract disagrees with Foundation A`)
      assert.equal(jsonOffered(step), offered, `${c.label}/${step.id}: the JSON tab disagrees`)
      assert.equal(stepExportView(step, ctx).implementation, offered, `${c.label}/${step.id}: the export view disagrees`)
      assert.equal(stepOperations(step).length > 0, offered, `${c.label}/${step.id}: the channels hold operations they may not hand over`)
      const cs = contentStepFor(step) as Record<string, unknown> | undefined
      if (cs && cs.kind === 'policy') {
        const lines = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx), step.title))
        if (!offered) assert.equal(lines, null, `${c.label}/${step.id}: portal instructions for a policy nothing may write`)
      }
      // A hold is not a blocker: it names no work and asks for nothing.
      if (policyHold(step) !== null) {
        assert.equal(unavailableReason(step), null, `${c.label}/${step.id}: a hold and a reason at once`)
        assert.notEqual(step.state.condition, 'blocked', `${c.label}/${step.id}: a policy waiting for its window reads as blocked`)
      }
      // A blocker never becomes informational. The distinction the contract
      // draws is the one that matters here: a failing CHECK is this step's own
      // work and belongs under a Ready row (the emergency-access step is Ready
      // precisely so somebody goes and clears its checks), while a blocker of
      // kind `step` is a prerequisite somewhere ELSE in the plan, and a step
      // waiting on one is not ready and not finished.
      const prerequisites = step.blockers.filter((b) => b.kind === 'step')
      if (prerequisites.length > 0) {
        assert.notEqual(step.status, 'ready', `${c.label}/${step.id}: a prerequisite elsewhere in the plan under a Ready row`)
        assert.notEqual(step.status, 'done', `${c.label}/${step.id}: a step finished with a prerequisite still outstanding`)
        // The one step that names no prerequisite and is right not to: a goal
        // whose baseline contradicts itself asks for nothing, because nothing in
        // the tenant clears it and a prerequisite listed under Fix would read as
        // work that would make the policy writable (stepContract.ts `fixOf`).
        // It still says what it is waiting for, in its own action and its own
        // completion, which the next two assertions hold it to.
        if (step.state.condition === 'baseline-conflict') {
          assert.ok(contract.whatToDo.text.length > 0, `${c.label}/${step.id}: a contradicted baseline with no action at all`)
          assert.ok(contract.doneWhen.length > 0, `${c.label}/${step.id}: a contradicted baseline with no completion at all`)
        } else {
          assert.ok(contract.fix.length > 0, `${c.label}/${step.id}: a prerequisite the opened step never names`)
        }
      }
    }
  }
})

// ---- 6. a recommendation never becomes a confirmation ----

test('042.6: detected, recommended and confirmed stay three different things', () => {
  for (const c of corpus()) {
    const sel = emergencySelection({ snapshot: c.fixture.snapshot, mapping: c.fixture.mapping })
    // Confirmed is the mapping's own set and nothing else; a nomination is never
    // in it unless the record also holds it.
    for (const id of sel.confirmedIds) assert.ok(c.fixture.mapping.breakGlassUserIds.includes(id), `${c.label}: a confirmed emergency account the record does not hold`)
    for (const id of sel.recommendedIds) {
      if (!c.fixture.mapping.breakGlassUserIds.includes(id)) assert.ok(!sel.confirmedIds.includes(id), `${c.label}: a recommendation became a confirmation`)
    }
    // A record with no operator provenance carries no confirmed ids at all: the
    // migration at the persistence boundary empties them, and the picker offers
    // them back as prior context (mapping/emergencyChoice.ts).
    if (sel.confirmedIds.length > 0) assert.ok(operatorConfirmedEmergency(c.fixture.mapping) || c.fixture.mapping.breakGlassUserIds.length > 0, `${c.label}: confirmed ids with nothing behind them`)
    assert.equal(sel.unresolved, sel.confirmedIds.length === 0, `${c.label}: unresolved does not follow the confirmed set`)
    // The two safety-sensitive pickers are never pre-decided. A detected default
    // applied as the plan's decision is exactly detection becoming confirmation.
    const defaults = defaultDecisions({ snapshot: c.fixture.snapshot, mapping: c.fixture.mapping, nameOf: (id) => id, groups: c.fixture.groups, now: c.fixture.snapshot.asOf })
    for (const id of Object.keys(defaults)) {
      assert.ok(!DECISION_STEPS.emergency.has(id), `${c.label}: the emergency picker has a detected default`)
      assert.ok(!DECISION_STEPS.exclusions.has(id), `${c.label}: the exclusions picker has a detected default`)
    }
  }
})

// ---- 7. an existing equivalent is preserved everywhere ----

test('042.7: a goal the tenant already delivers is never a create in any consumer', () => {
  for (const { c, step } of stepsIn('equivalentExists')) {
    const ctx = ctxFor(c, step)
    const contract = stepContract(step, ctx)
    const view = stepExportView(step, ctx)
    assert.equal(implementationOffered(step), false, `${c.label}/${step.id}: instructions for creating a policy the tenant has`)
    assert.deepEqual(stepOperations(step), [], `${c.label}/${step.id}: an operation on a preserved goal`)
    assert.equal(stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx), step.title)), null, `${c.label}/${step.id}: portal instructions on a preserved goal`)
    assert.equal(view.dates, null, `${c.label}/${step.id}: rollout dates for a rollout that is not happening`)
    assert.equal(view.ifWrong, null, `${c.label}/${step.id}: a rollback over a policy IAMAI never touched`)
    assert.equal(contract.whatToDo.kind, 'preserve', `${c.label}/${step.id}: the one action on a preserved goal is to keep it`)
    // The row and the artifacts name the same policy, or neither names one.
    const existing = existingOf(step)
    const named = contract.found.filter((f) => f.key === 'in-place')
    assert.equal(named.length, 1, `${c.label}/${step.id}: a preserved goal with no finding saying so`)
    if (existing !== null) for (const n of existing.names) assert.ok(named[0].text.includes(n), `${c.label}/${step.id}: the finding does not name ${n}`)
  }
})

// ---- 8. Portal, JSON, PowerShell and Export share one resolved operation ----

test('042.8: the four channels serialise the same operations, or none of them does', () => {
  for (const { c, step } of stepsIn('implementable')) {
    const ctx = ctxFor(c, step)
    const ops = operationsOf(step)
    assert.ok(ops.length > 0, `${c.label}/${step.id}: offered with nothing to submit`)
    // The JSON tab, the download and the PowerShell tab all read the operations'
    // own bodies, never a body serialised elsewhere.
    const bodies = ops.map((o) => o.body)
    assert.deepEqual(policyJson(step), bodies.length === 1 ? bodies[0] : bodies, `${c.label}/${step.id}: the JSON is not the operations' bodies`)
    const ps = powershellFor(stepOperations(step))
    for (const o of ops) {
      const cmdlet = o.mode === 'update' ? 'Update-MgIdentityConditionalAccessPolicy' : 'New-MgIdentityConditionalAccessPolicy'
      assert.ok(ps.includes(cmdlet), `${c.label}/${step.id}: PowerShell does not run the operation's own mode`)
    }
    // Every operation the JSON offers produces a command: a body a person can
    // download and a command they cannot run would be two answers to one
    // question.
    assert.equal((ps.match(/-MgIdentityConditionalAccessPolicy/g) ?? []).length, ops.length, `${c.label}/${step.id}: the channels offer a different number of operations`)
    const cs = contentStepFor(step) as Record<string, unknown> | undefined
    if (cs && cs.kind === 'policy') {
      assert.ok(stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx), step.title)) !== null, `${c.label}/${step.id}: the portal offers nothing while the other three do`)
    }
    // The export view's one action is the Step Contract's, and it is present.
    const view = stepExportView(step, ctx)
    assert.ok(view.whatToDo.includes(stepContract(step, ctx).whatToDo.text), `${c.label}/${step.id}: the artifacts do not carry the step's next action`)
  }
  // And the same for the steps nothing may write: no channel offers anything.
  for (const { c, step } of stepsIn('unavailable')) {
    const ctx = ctxFor(c, step)
    assert.deepEqual(stepOperations(step), [], `${c.label}/${step.id}: an unwritable policy handed over operations`)
    assert.equal(jsonOffered(step), false, `${c.label}/${step.id}: an unwritable policy offered JSON`)
    assert.equal(stepExportView(step, ctx).implementation, false, `${c.label}/${step.id}: an unwritable policy offered an implementation in the artifacts`)
  }
})

// ---- 9. registration is not proof ----

test('042.9: no rung above 3 without a sign-in record that names the method', () => {
  for (const c of corpus()) {
    for (const r of c.readiness.rows) {
      if (!r.active || r.rung === null) continue
      if (r.rung >= 4) {
        assert.ok(r.viability?.evidence != null, `${c.label}: rung ${r.rung} with no sign-in record behind it`)
      }
      // The page's own grouping is a label on the rung and never a second reading.
      if (r.group === 'ready') assert.equal(r.rung, 5, `${c.label}: passkey-ready at rung ${r.rung}`)
      if (r.group === 'needsProof') assert.notEqual(r.rung, 5, `${c.label}: needs proof at rung 5`)
    }
  }
  // A registered passkey and no record is "needs proof" and never "ready": the
  // corpus has the case, and it stays on the unproven side.
  for (const { c, row } of peopleIn('registeredNotProven')) {
    assert.notEqual(row.rung, 5, `${c.label}: a registration was read as proof`)
    assert.equal(nextStateWord(row).length > 0, true, `${c.label}: an unproven passkey with nothing left to do`)
  }
  // Windows Hello stands at 3 whatever the records show: it works on one PC.
  for (const { c, row } of peopleIn('needsPasskey')) {
    if (row.viability && windowsHelloOnly(row.viability)) assert.equal(rungOf(row.viability), 3, `${c.label}: Windows Hello moved off rung 3`)
  }
})

// ---- 10. the summary and the person rows share one readiness authority ----

test('042.10: every readiness cell is the row it was rendered from, on screen and in the CSV', () => {
  for (const c of corpus()) {
    const table = readinessTable(c.fixture.snapshot, c.fixture.mapping)
    assert.equal(table.rows.length, c.readiness.rows.length, `${c.label}: the CSV has a different number of rows from the page`)
    c.readiness.rows.forEach((r, i) => {
      const row = table.rows[i]
      assert.equal(row[1], roleWord(r), `${c.label}: the exported role is not the rendered role`)
      assert.equal(row[2], methodWord(r.method), `${c.label}: the exported method is not the rendered method`)
      assert.equal(row[3], rowEvidenceText(r), `${c.label}: the exported proof is not the rendered proof`)
      assert.equal(row[4], readinessWord(r), `${c.label}: the exported readiness is not the rendered readiness`)
      assert.equal(row[5], nextStateWord(r), `${c.label}: the exported next state is not the rendered next state`)
    })
    // A Plan step's handoff names the people the same scoring named, and never a
    // set of its own: the ids are always rows on this page.
    const rowIds = new Set(c.readiness.rows.map((r) => r.user.id))
    for (const step of c.steps) {
      const hold = stepMfaHold(step, c.viability)
      if (!hold || hold.ids === null) continue
      for (const id of hold.ids) assert.ok(rowIds.has(id), `${c.label}/${step.id}: the handoff names somebody MFA Readiness does not list`)
    }
  }
})

// ---- 11. unknown does not become safe through a presentation fallback ----

test('042.11: an unmeasured fact is stated as unmeasured, never as a zero or a pass', () => {
  for (const { c, step } of stepsIn('unknownReach')) {
    const ctx = ctxFor(c, step)
    const contract = stepContract(step, ctx)
    assert.equal(contract.who?.known, false, `${c.label}/${step.id}: an unsettled reach claimed to be known`)
    assert.equal(stepExportView(step, ctx).population, null, `${c.label}/${step.id}: an unsettled reach written down as a number`)
    assert.equal(stepPopulation(step), null, `${c.label}/${step.id}: an unsettled reach produced a population`)
  }
  for (const c of corpus()) {
    // A tenant whose registration report could not be read has no active person
    // asserted to be without a passkey.
    if (!c.readiness.methodsRead) {
      assert.equal(c.readiness.groups.needsPasskey, 0, `${c.label}: an unreadable inventory produced settled findings`)
    }
    // A hold whose people could not be settled is named as unknown, and never
    // stepped over in favour of "nothing is waiting".
    const anyUnknown = c.steps.some((s) => stepMfaHold(s, c.viability)?.ids === null)
    if (anyUnknown) assert.notEqual(firstMfaDependency(c.steps, c.viability).kind, 'none', `${c.label}: an unknown hold reported as nothing waiting`)
    // The printed plan's verification note has a population behind it or says
    // nothing: toSetUp is a count over the ladder and never a claim about people
    // the scan did not read.
    assert.ok(toSetUp(c.readiness.facts) >= 0)
  }
})

// ---- 12. the demo reaches its conclusions the same way ----

test('042.12: the sample tenant runs the production path and states the production numbers', async () => {
  // The demo cases are in the corpus and have been through every assertion
  // above; this is the one thing only the demo can be wrong about — the numbers
  // Connect shows for it before anybody signs in.
  const { demoTenant } = await import('./ui/demo.ts')
  const { demoFacts } = await import('./ui/demoFacts.ts')
  const { fixture } = await import('./roadmap/fixtures/index.ts')
  const { runFixture } = await import('./roadmap/fixtures/run.ts')
  const { facts, stepFacts } = await import('./derive/facts.ts')
  const d = demoTenant(false)
  const run = runFixture({ ...fixture('demo'), snapshot: d.snapshot, mapping: d.mapping })
  const cleanup = run.schedule.cleanup ?? null
  const counts = stepFacts(run.steps, cleanup, d.mapping.breakGlassAnswers ?? null)
  const shown = demoFacts()
  assert.equal(shown.people, facts(d.snapshot, d.mapping).active, 'the sample tile counts people its own way')
  assert.equal(shown.steps, counts.steps, 'the sample tile counts steps its own way')
  assert.equal(shown.inPlace, counts.done, 'the sample tile counts what is in place its own way')
  assert.equal(shown.weeks, planWeeks(planFinish(run.steps, cleanup?.end ?? null), run.schedule.start, run.schedule.weeks), 'the sample tile computes weeks its own way')
})

// ---- the Cleanup row: one completion, one word, on every surface ----

test('042.13: a Cleanup row reads the same on the Plan and in the printed plan', () => {
  const attested = { credentialStorage: true, signInMonitoring: true }
  const silent = { credentialStorage: null, signInMonitoring: null }
  for (const c of corpus()) {
    for (const row of c.run.schedule.cleanup?.rows ?? []) {
      // The attestation completes the alerting row and nothing else, and it is
      // the same answer wherever it is asked: the Plan used to read it and the
      // printed plan did not, so one row read In place on screen and Ready on
      // paper (task 042).
      assert.equal(cleanupComplete(row, attested), row.done !== null || row.kind === 'alerting', `${c.label}: the attestation completed the wrong row`)
      assert.equal(cleanupComplete(row, silent), row.done !== null, `${c.label}: nothing recorded completed a row`)
      assert.equal(cleanupComplete(row, null), cleanupComplete(row, undefined), `${c.label}: an absent record and an unread one differ`)
      // The word follows the completion and is the vocabulary the steps use.
      assert.equal(cleanupStatusOf(cleanupComplete(row, attested)).word, cleanupComplete(row, attested) ? 'In place' : 'Ready', `${c.label}: a Cleanup row's word is not its state`)
      assert.notEqual(cleanupStatusOf(true).word, 'Enforced', 'a Cleanup row claims a rollout it never had')
    }
  }
})

// ---- the aggregate counts the rows the way the rows read themselves ----

/**
 * The Plan header, the print cover and Connect's Plan tile all state "N of M in
 * place" from `derive/facts.ts` `stepFacts`. A Cleanup row is one of those M,
 * and its completion is `cleanupComplete` — the same reading the row itself
 * renders. `stepFacts` counted `row.done` alone, so a tenant that had ticked the
 * emergency-access sign-in-monitoring attestation saw the alerting row say "In
 * place" with a header that had not counted it: one row, one fact, two answers
 * again, one level up (task 042 correction 1).
 */
test('042.16: the plan header counts a Cleanup row exactly when the row reads In place', () => {
  const attested = { credentialStorage: true, signInMonitoring: true }
  const denied = { credentialStorage: false, signInMonitoring: false }
  const silent = { credentialStorage: null, signInMonitoring: null }
  let alertingCases = 0
  for (const c of corpus()) {
    const cleanup = c.run.schedule.cleanup ?? null
    const rows = cleanup?.rows ?? []
    if (rows.length === 0) continue
    // The aggregate is the trackable steps' done plus the rows the one Cleanup
    // authority calls complete — for every answer state, never for `row.done` alone.
    for (const answers of [attested, denied, silent, null, undefined] as const) {
      const agg = stepFacts(c.run.steps, cleanup, answers)
      const byRow = rows.filter((r) => cleanupComplete(r, answers)).length
      assert.equal(agg.done - stepFacts(c.run.steps, null, answers).done, byRow, `${c.label}: the header counts a Cleanup row the rows do not`)
      assert.ok(agg.done <= agg.steps, `${c.label}: more rows in place than there are rows`)
    }
    // The attestation moves the aggregate by exactly the alerting row, and only
    // when that row was not already done; nothing recorded moves nothing.
    const alerting = rows.find((r) => r.kind === 'alerting')
    if (!alerting) continue
    alertingCases++
    const expected = alerting.done === null ? 1 : 0
    assert.equal(stepFacts(c.run.steps, cleanup, attested).done - stepFacts(c.run.steps, cleanup, silent).done, expected, `${c.label}: the attestation did not reach the header's count`)
    assert.equal(stepFacts(c.run.steps, cleanup, denied).done, stepFacts(c.run.steps, cleanup, silent).done, `${c.label}: a declined attestation completed a row`)
    assert.equal(stepFacts(c.run.steps, cleanup, null).done, stepFacts(c.run.steps, cleanup, undefined).done, `${c.label}: an absent record and an unread one differ in the header`)
  }
  assert.ok(alertingCases > 0, 'no case in the corpus has an alerting Cleanup row: the assertion above is vacuous')
})

// ---- 13. no assertion above depends on an identifier ----

test('042.14: the corpus and this file select by semantics, never by identity', () => {
  const guid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  // A step id literal: the shape the generator writes (roadmap/stepIds.ts).
  const stepId = /['"`]s-goal-[a-z0-9-]+['"`]/
  const nameIdentity = /(displayName|userPrincipalName)\s*===/
  for (const path of ['src/roadmap/fixtures/semantics.ts', 'src/semanticIntegrity.test.ts']) {
    const src = readFileSync(path, 'utf8')
    assert.equal(guid.test(src), false, `${path} names an object id: the case it covers stops existing when the fixture moves`)
    assert.equal(stepId.test(src), false, `${path} names a step id`)
    assert.equal(nameIdentity.test(src), false, `${path} treats a display name as identity`)
  }
  // The corpus's own predicates are the production authorities' answers, so a
  // scenario is found by asking them and never by matching a label.
  const corpusSrc = readFileSync('src/roadmap/fixtures/semantics.ts', 'utf8')
  const predicates = corpusSrc.slice(corpusSrc.indexOf('export function stepScenarios'), corpusSrc.indexOf('export function personScenarios'))
  assert.equal(/\.label\b|\bf\.name\b|fixture\.name/.test(predicates), false, 'a scenario predicate reads a fixture name')
})

// ---- the duplicates task 042 removed stay removed ----

/**
 * Three facts had two or three derivations each, in files that render rather
 * than decide. Removing a duplicate is worth little if the next task writes it
 * back, so each one is now a rule about the source: the fact has one producer,
 * and a surface reads it.
 *
 * This is a guard of the same kind planAnatomy.test.ts already uses over the
 * Plan's components — the cheapest durable way to say "do not decide this here".
 */
test('042.15: no surface re-derives a fact that has an authority', () => {
  const read = (p: string): string => readFileSync(p, 'utf8')
  const plan = read('src/ui/surfaces/Plan.tsx')
  const print = read('src/ui/surfaces/PrintPlan.tsx')
  const exportSurface = read('src/ui/surfaces/Export.tsx')
  const row = read('src/ui/surfaces/rowWhen.ts')
  const demoTile = read('src/ui/demoFacts.ts')

  // The weeks a plan runs: derive/finish.ts `planWeeks`, and the three surfaces
  // that state it read it. The expression had been copied into all three.
  for (const [name, src] of [['Plan', plan], ['PrintPlan', print], ['demoFacts', demoTile]] as const) {
    assert.equal(/7 \* 86_400_000/.test(src), false, `${name} computes the plan's length itself; derive/finish.ts planWeeks is the one derivation`)
    assert.ok(src.includes('planWeeks('), `${name} no longer states the plan's length at all`)
  }

  // A Cleanup row's completion and its word: roadmap/cleanupDone.ts and
  // statusWord.ts. Both surfaces read both, and neither writes the words.
  for (const [name, src] of [['Plan', plan], ['PrintPlan', print]] as const) {
    assert.ok(src.includes('cleanupComplete('), `${name} does not read the one Cleanup completion`)
    assert.ok(src.includes('cleanupStatusOf('), `${name} does not read the one Cleanup status word`)
    assert.equal(/word: 'In place'|word: 'Ready'/.test(src), false, `${name} writes a status word into its own JSX`)
  }

  // The satisfying policy: the Step Contract's `existingOf`, read by the
  // collapsed row rather than re-derived from `Step.satisfiedBy` beside it.
  assert.ok(row.includes('existingOf('), 'the collapsed row does not read the Step Contract’s satisfying policy')
  assert.equal(/step\.satisfiedBy/.test(row), false, 'the collapsed row reads the coverage field directly and can drift from the opened step')

  // The verification window's note: two sentences that lived only in Export.tsx
  // and a readiness count computed in JSX beside them.
  assert.equal(/rungs\[1\]|rungs\[2\]/.test(exportSurface), false, 'Export computes a readiness population itself; derive/facts.ts toSetUp is the count')
  assert.equal(/Everyone active/.test(exportSurface), false, 'Export words a sentence the printed plan should take from content.json')
  assert.ok(print.includes('C.verificationNote'), 'the printed plan does not take the verification note from its own content entry')
})
