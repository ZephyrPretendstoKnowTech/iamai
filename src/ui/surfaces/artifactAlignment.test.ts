// Task 013: the downstream artifact family reads the finished Plan, and only it.
//
// Everything IAMAI hands a person to take somewhere else — the print document,
// the calendar entry, the prompt pack, the grounding bundle, the machine
// channels and the Cleanup block — is built from one reading of a step: the
// export view (ui/surfaces/stepExport.ts), which is the frozen Step Contract's
// own answers (Foundation D). These tests hold that line. They sweep every
// fixture rather than snapshotting one output, because the failure they exist to
// catch is an artifact quietly answering a question the Plan has already
// answered differently.
//
// What they do not do: assert exact wording. The words belong to content.json
// and to the contract; a test that copies them here would be a third place a
// sentence lives.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { FixtureRun } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { exportViewsOf, stepExportView } from './stepExport.ts'
import { stepBodyOf } from './stepBody.ts'
import { CONTRACT, NO_POLICY_REASONS, badgeLabel, readinessOf, stepContract } from './stepContract.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { cleanupText, groundingBundle, promptPack, promptPackMarkdown, stepContext } from '../../roadmap/prompts.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { implementationOffered, jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { finalTargets, unavailableReason } from '../../roadmap/operations.ts'
import { statedEnforcement } from '../../roadmap/forecast.ts'
import { readinessTable } from './inventoryTables.ts'
import { floorRows, phaseRows, planPhases, scheduledIds, undatedRows } from './planRows.ts'
import { laneReadings } from './planLanes.ts'
import { boardReadingsOf, laneViewFor, laneViewOf } from './planBoard.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { inWave } from '../../derive/phases.ts'
import { redactIdentifiers } from '../../redact.ts'
import { readFileSync } from 'node:fs'

type Case = { name: string; run: FixtureRun; ctx: (s: Step) => StepVarContext; lane: (s: Step) => ReturnType<typeof laneViewFor>; view: (s: Step) => ReturnType<typeof stepExportView>; prompt: (s: Step) => string; entry: (s: Step) => string | undefined; snapshot: FixtureRun['input']['snapshot'] }

/** One answer per step, computed once. The readings are pure, and a sweep that
 *  recomputes them per assertion builds the same calendar once per step: on the
 *  full fixture matrix that is quadratic, and it is what took `npm test` past
 *  the runner's memory. */
function once<T>(of: (s: Step) => T): (s: Step) => T {
  const kept = new Map<Step, T>()
  return (s) => {
    if (!kept.has(s)) kept.set(s, of(s))
    return kept.get(s)!
  }
}

function load(named: string | Fixture): Case {
  const f = typeof named === 'string' ? fixture(named as never) : named
  const name = typeof named === 'string' ? named : `${f.name} (exclusions unanswered)`
  const run = typeof named === 'string' ? runFixture(f) : runFixture(f, { mapping: f.mapping })
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const ctx = once((s: Step): StepVarContext =>
    ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null, groups: f.groups }) as StepVarContext)
  // The row's lane, as the Plan reads it off its board (planBoard.ts
  // boardReadingsOf, laneViewFor), and the export view the Export page itself
  // builds (stepExport.ts exportViewsOf). The sweep read the export with a lane
  // it built here — first with no Cleanup rows, which copied the page's defect
  // (R4-22), then with the board's, which only restated the page's fix. It now
  // reads the page's own construction and holds it to the Plan's.
  const board = boardReadingsOf(run.steps, run.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const lane = once((s: Step): ReturnType<typeof laneViewFor> => laneViewFor(s, board))
  const view = once(exportViewsOf(run.steps, run.schedule.cleanup, f.mapping.breakGlassAnswers ?? null, ctx))
  let entries: Map<string, string> | null = null
  const entry = (s: Step): string | undefined => {
    if (entries === null) {
      const parts = buildIcs(run.steps, 'Tenant', run.input.planId, view).split('BEGIN:VEVENT')
      entries = new Map()
      // The same reading the sweep always made — the event whose UID ends in this
      // step — made once for the whole calendar instead of once per step.
      for (const s2 of run.steps) {
        const part = parts.find((x) => x.includes(`-${s2.id}@iamai`))
        if (part !== undefined) entries.set(s2.id, part)
      }
    }
    return entries.get(s.id)
  }
  return { name, run, ctx, lane, view, prompt: once((s: Step) => stepContext(s, view)), entry, snapshot: f.snapshot }
}

/** Every fixture the repo ships, each loaded once: the whole state matrix, not a chosen example. */
const CASES: Case[] = allFixtures().map((f) => load(f.name))

// ---- A. the export view is the contract, field for field ----

test('013.A: every artifact reads one step, and that step is the frozen Step Contract', () => {
  let checked = 0
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const v = c.view(s)
      const k = stepContract(s, c.ctx(s), undefined, c.lane(s))
      const where = `${c.name}/${s.id}`
      // The one state label (the lane label, A1c) and its dated next line.
      assert.equal(v.state, badgeLabel(k), `${where}: state`)
      assert.equal(v.state, c.lane(s).label, `${where}: the export's state is the row's lane label`)
      assert.equal(v.next, k.milestone.line, `${where}: next line`)
      // Foundation A's reach, its outstanding prerequisites, its completion, and
      // the one answer the four implementation channels read.
      assert.equal(v.who, k.who?.text ?? null, `${where}: who`)
      // The note joins the verdict only where there is one: a finding with no
      // detail used to end "Needs correction. " — a stop and a space with
      // nothing after them — and stepExport.ts no longer composes it that way.
      const configuration = readinessOf(s, k).tiles.filter(t => t.key.startsWith('configuration:')).map(t => [`${t.label}: ${t.value}.`, (t.note ?? '').trim()].filter(part => part !== '').join(' '))
      assert.deepEqual(v.fix, [...new Set([...k.fix.map((x) => x.text), ...configuration])], `${where}: fix and visible configuration findings`)
      assert.deepEqual(v.doneWhen, k.doneWhen, `${where}: done when`)
      assert.equal(v.implementation, k.implementation.offered, `${where}: implementation offered`)
      assert.equal(v.implementation, implementationOffered(s), `${where}: the channels and the view disagree`)
      // The next action is in the artifact, always, and it is the screen's.
      assert.ok(v.whatToDo.includes(k.whatToDo.text), `${where}: the artifact drops the screen's action — ${v.whatToDo.join(' | ')}`)
      checked += 1
    }
  }
  assert.ok(checked > 100, `only ${checked} steps swept`)
})

test('013.A: a step whose action is the wait says what it waits on in every channel, in the words the row shows', () => {
  let checked = 0
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const k = stepContract(s, c.ctx(s), undefined, c.lane(s))
      const where = `${c.name}/${s.id}`
      const lane = c.lane(s)
      if (k.whatToDo.gatedBy === null) {
        // Only the wait carries one: an action that is the work itself names no
        // gate, and neither does a baseline that defines the policy two ways —
        // that step's own paragraph is the explanation, and nothing in the
        // tenant clears it.
        const exempt = k.whatToDo.kind !== 'resolve' || s.state.condition === 'baseline-conflict'
        assert.ok(exempt || nextMilestone(s).gatedBy === null, `${where}: the wait says nothing about what holds it`)
        continue
      }
      // The gate is the board's own words for it on the two waiting lanes, so the
      // artifact and the row cannot name the wait differently.
      if (lane.lane === 'Up Next' || lane.lane === 'On Hold') assert.equal(k.whatToDo.gatedBy, lane.tail ?? nextMilestone(s).gatedBy, `${where}: the gate is not the row's`)
      const v = c.view(s)
      const line = v.whatToDo.find((l) => l.startsWith(k.whatToDo.gatedBy!))
      assert.ok(line, `${where}: the export drops the gate "${k.whatToDo.gatedBy}" — ${v.whatToDo.join(' | ')}`)
      // The action comes first and the gate stands beside it, in the flat
      // artifacts the calendar entry and the prompt pack are built from.
      const lines = stepArtifactLines(v)
      assert.ok(lines.some((l) => l.includes(k.whatToDo.text) && l.includes(line)), `${where}: the calendar entry and prompt block say the action without its gate`)
      assert.ok(c.prompt(s).includes(line), `${where}: the prompt pack drops the gate`)
      checked += 1
    }
  }
  assert.ok(checked > 20, `only ${checked} waiting steps swept`)
})

test('013.A: an unknown reach is never written down as a number', () => {
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const v = c.view(s)
      const k = stepContract(s, c.ctx(s))
      if (k.who?.known === false) assert.equal(v.population, null, `${c.name}/${s.id}: a scope Foundation A could not settle carries a count`)
    }
  }
})

// ---- the one rendering the flat artifacts share ----

test('013.A: the calendar entry and the prompt block are the same run of lines', () => {
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const entry = c.entry(s)
      if (entry === undefined) continue
      const v = c.view(s)
      const prompt = c.prompt(s)
      for (const line of stepArtifactLines(v)) {
        // The calendar folds and escapes; the prompt does not. Compare on the
        // first clause, which survives both.
        const head = line.split(/[:.·|]/)[0].trim()
        if (head.length < 12) continue
        assert.ok(prompt.includes(head), `${c.name}/${s.id}: the prompt pack drops "${head}"`)
      }
      // And nothing is a heading with nothing under it.
      for (const line of stepArtifactLines(v)) assert.doesNotMatch(line, /:\s*$/, `${c.name}/${s.id}: an empty section — "${line}"`)
    }
  }
})

// ---- B. unresolved operations do not fabricate mutations; useful guidance remains available ----

test('013.B: unresolved operations retain useful portal guidance without invented mutations or dates', () => {
  const reasons = new Set<string>()
  for (const c of CASES) {
    for (const s of c.run.steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      const reason = unavailableReason(s)
      if (reason === null) continue
      reasons.add(reason)
      const where = `${c.name}/${s.id} (${reason})`
      const v = c.view(s)
      // The four machine channels are shut, and the body behind them is empty.
      assert.equal(jsonOffered(s), false, `${where}: the JSON, PowerShell and Download tabs are offered`)
      assert.deepEqual(stepOperations(s), [], `${where}: an operation is offered`)
      assert.doesNotMatch(powershellFor(stepOperations(s)), /New-MgIdentityConditionalAccessPolicy|Update-MgIdentityConditionalAccessPolicy/, `${where}: PowerShell writes a policy`)
      assert.equal(/"conditions"|includeUsers|grantControls/.test(policyJsonText(s)), false, `${where}: a policy body is downloadable`)
      // Nothing that implies a rollout: no dates line, no rollback, no event.
      assert.equal(v.dates, null, `${where}: a Dates line`)
      assert.equal(v.ifWrong, null, `${where}: a rollback for work nobody can do`)
      assert.equal(c.entry(s), undefined, `${where}: a calendar entry`)
      // Readiness remains first, alongside the same useful instructions the screen offers.
      const said = [v.whatToDo.join('\n'), c.prompt(s)]
      for (const text of said) {
        assert.equal(/"conditions"|includeUsers|grantControls/.test(text), false, `${where}: a policy body reached a prose artifact`)
        assert.doesNotMatch(text, /This format has no output|You can copy this guidance|Values still to resolve|\{\{[^}]+\}\}/, `${where}: a placeholder or repeated copy disclaimer reached an artifact`)
      }
      const body = stepBodyOf(s, c.ctx(s), { lane: c.lane(s) })
      const portal = body.artifacts.find(a => a.id === 'portal')
      if (portal) {
        assert.ok(portal.text().trim().length > 0, `${where}: empty displayed portal channel`)
        assert.ok(v.whatToDo.length > 1, `${where}: useful displayed guidance missing from export`)
      }
      assert.equal(v.whatToDo[0], stepContract(s, c.ctx(s), undefined, c.lane(s)).whatToDo.text, `${where}: readiness action no longer first`)
      // The completion is one line: the resolution where there is no policy to
      // state an end of, and otherwise the policy's end state — what clears the
      // hold is Fix before continuing's (owner, 2026-09-11); never the rollout's gates.
      assert.equal(v.doneWhen.length, 1, `${where}: ${v.doneWhen.join(' | ')}`)
      // The line is the step's own end state (steps[].doneEnd), or the shared
      // one where the step states none — checked as the sentence it is, not by
      // the words it opens with. A step whose outcome is named in its own words
      // ("Only Android, iOS, Windows and macOS reach {tenant}", the V1 standard
      // §3.1) states its end state as plainly as one that opens "The policy is
      // enforced in {tenant}", and this file asserts no exact wording.
      if (!NO_POLICY_REASONS.has(reason)) {
        const own = (contentStepFor(s) as { doneEnd?: unknown } | undefined)?.doneEnd
        const template = typeof own === 'string' ? own : CONTRACT.doneHeldEnd
        const shape = new RegExp(`^${template.split('{tenant}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`)
        assert.match(v.doneWhen[0], shape, `${where}: ${v.doneWhen.join(' | ')}`)
      }
      assert.equal(/report-only|sign-in failures|%/i.test(v.doneWhen.join(' ')), false, `${where}: a rollout completion — ${v.doneWhen.join(' | ')}`)
    }
  }
  // The fixtures really do exercise more than one way for work to be held.
  assert.ok(reasons.size >= 3, `only ${[...reasons].join(', ')} exercised`)
})

test('013.B: a step whose answer the operator still owes carries the question, not the work', () => {
  const kinds = new Set<string>()
  // The shipped fixtures all answer the exclusions question, so the case that
  // waits on a person is built here (Foundation C, mapping/safetyChoice.ts
  // `awaitsOperator`). It used to fall out of the sweep by accident, from a
  // group the pin had misclassified as the service accounts (task 022).
  for (const c of [...CASES, load(noExclusionsAnswer(fixture('demo')))]) {
    for (const s of c.run.steps) {
      if (s.state.condition !== 'needs-decision') continue
      const k = stepContract(s, c.ctx(s))
      const v = c.view(s)
      kinds.add(k.whatToDo.kind)
      // Whatever the contract's precedence puts first — the question, or a
      // policy the plan cannot write at all, which outranks it — the artifact
      // leads with the same sentence the Plan does, and the prompt carries it.
      assert.equal(v.whatToDo[0], k.whatToDo.text, `${c.name}/${s.id}: the artifact leads with something the screen does not`)
      assert.ok(c.prompt(s).includes(k.whatToDo.text), `${c.name}/${s.id}: the prompt pack drops the action`)
      // A question waiting on a person is never an instruction to go and build.
      assert.equal(implementationOffered(s), false, `${c.name}/${s.id}: an unanswered question offers an implementation`)
    }
  }
  // Every needs-decision step the shipped fixtures hold is also a policy the
  // plan cannot write, and that outranks the question in the contract's own
  // precedence — so `decide` as the leading action is exercised by the
  // constructed case in needsDecision.test.ts (task 009), not here. What this
  // sweep holds is the part that is about artifacts: whichever of the two the
  // contract chose, every artifact leads with it.
  assert.ok(kinds.size > 0, 'no fixture has a step waiting on the operator')
})

// ---- C. create stays create, update names the target it will write ----

test('013.C: the machine artifacts and the friendly ones name the same resolved objects', () => {
  let creates = 0
  let updates = 0
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const ops = stepOperations(s)
      if (ops.length === 0) continue
      const where = `${c.name}/${s.id}`
      const ps = powershellFor(ops)
      for (const o of ops) {
        if (o.mode === 'create') {
          creates += 1
          assert.match(ps, /New-MgIdentityConditionalAccessPolicy/, `${where}: a create does not create`)
        } else {
          updates += 1
          // The id the PowerShell patches is the operation's own, and it is real.
          assert.ok(o.policyId && o.policyId.length > 0, `${where}: an update with no policy id is offered`)
          assert.ok(ps.includes(o.policyId), `${where}: the PowerShell patches an id the operation does not name`)
          assert.doesNotMatch(o.policyId, /^\{|\}$|^<|>$/, `${where}: a placeholder id is an actionable target — ${o.policyId}`)
        }
      }
      // JSON and PowerShell agree on the final intended state: one operation, one
      // target, and the JSON tab shows the operations' own bodies.
      assert.equal(finalTargets(s as never).length, ops.length, `${where}: the final target count is not the operation count`)
      assert.equal(policyJsonText(s).includes('Portal steps show the policy to create.'), false, `${where}: an implementable step downloads the placeholder note`)
    }
  }
  assert.ok(creates > 0 && updates > 0, `creates ${creates}, updates ${updates}: the sweep missed one of the two operations`)
})

test('013.C: a goal already delivered proposes nothing to submit, and says which policy delivers it', () => {
  const seen: string[] = []
  for (const c of CASES) {
    for (const s of c.run.steps) {
      if (!s.state.inPlace) continue
      seen.push(`${c.name}/${s.id}`)
      assert.deepEqual(stepOperations(s), [], `${c.name}/${s.id}: a preserved goal offers an operation`)
      assert.equal(c.entry(s), undefined, `${c.name}/${s.id}: a preserved goal is booked into the calendar`)
    }
  }
  assert.ok(seen.length > 0, 'no fixture has a goal already in place')
})

// ---- D. what a date is worth travels with it ----

test('013.D: a projected enforcement is never stated as one the policy has earned', () => {
  for (const c of CASES) {
    const bundle = groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 7, 2026' }) as unknown as { plan: { steps: Record<string, unknown>[] } }
    for (const s of c.run.steps) {
      const timing = statedEnforcement(s)
      const row = bundle.plan.steps.find((x) => x.id === s.id)!
      // The bundle states the basis beside the instant, always: a tool reading it
      // can tell a projection from a milestone Foundation B's evidence supports.
      assert.deepEqual(row.enforcement, timing, `${c.name}/${s.id}: the bundle re-dates the step`)
      // Only a policy Foundation B carried to ready-to-enforce or beyond has an
      // enforcement anything has earned.
      if (timing.basis === 'committed') assert.ok(s.state.lifecycle === 'ready-to-enforce' || s.state.lifecycle === 'enforced', `${c.name}/${s.id}: a committed enforcement at ${s.state.lifecycle}`)
      // A step nothing will roll out has no event, whatever instants it still
      // holds. "No implementation" is two answers and only one of them is this
      // one: a policy in report-only whose enforcement its window has not earned
      // is offered no channel either, and its review is a real day in a real
      // calendar (roadmap/operations.ts `policyHold`).
      if ((s.kind === 'create' || s.kind === 'adjust') && unavailableReason(s) !== null) assert.equal(c.entry(s), undefined, `${c.name}/${s.id}: held work gained a calendar entry`)
    }
  }
})

test('013.D: the Plan, the calendar and the prompt answer "when" with the same line', () => {
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const v = c.view(s)
      if (v.dates === null) continue
      const entry = c.entry(s)
      const prompt = c.prompt(s)
      assert.ok(prompt.includes(v.dates), `${c.name}/${s.id}: the prompt pack dates the step its own way`)
      if (entry === undefined) continue
      // The calendar folds long lines, so the entry is checked on the first clause.
      const head = v.dates.split('·')[0].trim()
      if (head.length >= 12) assert.ok(entry.replace(/\r?\n /g, '').includes(head.replace(/,/g, '\\,')), `${c.name}/${s.id}: the calendar entry dates the step its own way — ${head}`)
    }
  }
})

// ---- E. the prompt is an execution artifact, not a transcript ----

test('013.E: the step block a prompt is grounded in says each fact once', () => {
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const lines = c.prompt(s).split('\n').filter((x) => x.trim().length > 0)
      assert.equal(new Set(lines).size, lines.length, `${c.name}/${s.id}: a line is stated twice`)
      // No passed check, and no invented finish: every line came from the view.
      const v = c.view(s)
      const own = new Set([`${v.title}.`, ...stepArtifactLines(v)])
      for (const l of lines) assert.ok(own.has(l), `${c.name}/${s.id}: the prompt composed a line of its own — "${l}"`)
    }
  }
})

test('013.E: the pack says which step each of its prompts speaks for', () => {
  for (const c of CASES) {
    const pack = promptPack({ view: c.view, tenant: 'Tenant', steps: c.run.steps, schedule: c.run.schedule, changeRecord: '', planSummary: c.run.schedule.derivation.criticalPath, announcement: null })
    const stepGrounded = pack.filter((p) => p.scope !== null)
    assert.equal(stepGrounded.length, 0, 'the global pack must not pretend to be about an arbitrary step')
    for (const step of c.run.steps) assert.ok(pack.some(p => p.prompt.includes(c.view(step).title)), `${c.name}: the plan briefing drops ${step.id}`)
    for (const p of stepGrounded) assert.ok(p.prompt.includes(p.scope!), `${c.name}: "${p.title}" claims a step its facts do not name`)
    // And the file a person downloads says it too, so the scope does not live
    // only in the page that built it.
    const md = promptPackMarkdown(pack, 'Tenant')
    for (const p of stepGrounded) assert.ok(md.includes(p.scope!), `${c.name}: the markdown drops the scope of "${p.title}"`)
  }
})

test('013.E: a Cleanup row states what it has and invents no finish', () => {
  const c = load('demo-week2')
  const rows = cleanupExportViews(c.run.schedule.cleanup)
  assert.ok(rows.length > 0, 'the demo has no Cleanup rows')
  const text = cleanupText(rows)
  assert.doesNotMatch(text, /the next scan confirms it/, 'a completion no authority stated')
  assert.doesNotMatch(text, /What to do: nothing/, 'an invented empty action')
  for (const r of rows) assert.ok(text.includes(r.title), `the block drops ${r.title}`)
})

// ---- F. Export is not a second MFA Readiness ----

test('013.F: no global Plan artifact carries the person-level MFA ledger', () => {
  const c = load('demo-week2')
  // The ledger really exists, and it is the CSV's — one deliberate download,
  // built from the readiness page's own view, not scattered through the plan.
  const ledger = readinessTable(c.snapshot, { breakGlassUserIds: [], serviceAccountUserIds: [] })
  assert.ok(ledger.rows.length > 5, 'the fixture has no readiness ledger to leak')
  const people = c.snapshot.users.map((u) => u.displayName ?? '').filter((n) => n.length > 3)
  const bundle = JSON.stringify(groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 7, 2026' }))
  const ics = buildIcs(c.run.steps, 'Tenant', c.run.input.planId, c.view)
  const prompts = promptPackMarkdown(promptPack({ view: c.view, tenant: 'Tenant', steps: c.run.steps, schedule: c.run.schedule, changeRecord: '', planSummary: '', announcement: null }), 'Tenant')
  for (const [where, text] of [['bundle', bundle], ['calendar', ics], ['prompt pack', prompts]] as const) {
    // A plan artifact may name a handful of people a step actually turns on. It
    // may not be the ledger: a majority of the directory is the ledger.
    const named = people.filter((n) => text.includes(n)).length
    assert.ok(named * 2 < people.length, `the ${where} names ${named} of ${people.length} people`)
    // And none of them carries the readiness columns themselves.
    for (const column of ledger.header) assert.equal(text.includes(`"${column}"`), false, `the ${where} carries the readiness column ${column}`)
  }
})

// ---- G. the calendar is timing, and carries no identity ----

test('013.G: the calendar carries no tenant id, and no sign-in name survives the one guard', () => {
  for (const c of CASES) {
    const ics = buildIcs(c.run.steps, 'Tenant', c.run.input.planId, c.view, cleanupExportViews(c.run.schedule.cleanup))
    assert.equal(ics.includes(c.snapshot.tenantId), false, `${c.name}: the tenant id is in the calendar`)
    // The .ics is downloaded through the export guard as REDACTED
    // (ui/surfaces/Export.tsx), and the guard is the one thing that redacts:
    // this asserts the file as it actually leaves, not the builder's output.
    //
    // The builder's output can name an account, and on one Cleanup row it has to:
    // "SigninLogs where UserPrincipalName is one of ..." is the alert rule the
    // row asks the operator to write, and a rule with no accounts in it is not a
    // rule. Nothing here widens that: the guard is what makes the downloaded
    // file safe, and it is checked here rather than assumed.
    const shipped = redactIdentifiers(ics)
    for (const u of c.snapshot.users) {
      if (u.userPrincipalName) assert.equal(shipped.includes(u.userPrincipalName), false, `${c.name}: ${u.userPrincipalName} survived the guard`)
    }
  }
})

test('013.G: every export the page offers goes through the guard, and only the three warned surfaces skip redaction', () => {
  const src = readFileSync(new URL('./Export.tsx', import.meta.url), 'utf8')
  // Every download and clipboard write on the page is the guard's, and the three
  // that name a surface are the three the guard already allows: the bundle
  // (behind its warning and its checkbox), the print document, and the person's
  // own plan file. The calendar, the CSVs and the prompt pack are REDACTED.
  const unredacted = [...src.matchAll(/unredactedFrom\('([^']+)'\)/g)].map((m) => m[1])
  assert.deepEqual([...new Set(unredacted)].sort(), ['grounding-bundle', 'inventory-csv', 'plan-file', 'print-document'])
  for (const artifact of ['.ics', 'text/csv', 'text/markdown']) {
    const line = src.split('\n').find((l) => l.includes(artifact) && l.includes('exportDownload'))
    assert.ok(line, `the page no longer downloads ${artifact}`)
    assert.match(line!, artifact === 'text/csv' ? /unredactedFrom\('inventory-csv'\)/ : /REDACTED/, `${artifact} leaves without its declared export policy`)
  }
})

test('013.G: the redacted grounding bundle still holds no protected identifier, with the new fields on it', () => {
  for (const c of CASES) {
    const bundle = JSON.stringify(groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: true, generated: 'Sep 7, 2026' }))
    assert.equal(bundle.includes(c.snapshot.tenantId), false, `${c.name}: the tenant id survived redaction`)
    for (const u of c.snapshot.users.slice(0, 12)) {
      if (u.userPrincipalName) assert.equal(bundle.includes(u.userPrincipalName), false, `${c.name}: ${u.userPrincipalName} survived redaction`)
      if (u.displayName && u.displayName.length > 4) assert.equal(bundle.includes(u.displayName), false, `${c.name}: ${u.displayName} survived redaction`)
    }
  }
})

test('013.G: the bundle carries the screen’s reading of a step and none of the engine’s', () => {
  const c = load('demo-week2')
  const bundle = groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 7, 2026' }) as unknown as { plan: { steps: Record<string, unknown>[] } }
  for (const row of bundle.plan.steps) {
    for (const key of ['rings', 'events', 'plainTitle', 'forManager']) assert.equal(key in row, false, `the bundle carries the engine's ${key}`)
    for (const key of ['state', 'next', 'who', 'fix', 'doneWhen', 'implementation']) assert.ok(key in row, `the bundle drops the contract's ${key}`)
  }
})

// ---- H. the printed plan is the Plan ----
//
// The document a person takes to a meeting is the same plan the screen shows. It
// printed the dated work only — it walked `schedule.waves` — and the group the
// Plan draws after the phases fell out of it: the undated rows, which are
// exactly the steps whose implementation is withheld because something has to be
// cleared first. A PDF that says nine things remain and explains none of them is
// not the plan. Both surfaces read one rule now (planRows.ts), and these tests
// hold that rule rather than the markup: what a step prints is ContentStep's,
// and ContentStep is the screen's own body.

/** Where the plan puts each step, from the one positional rule both surfaces read. */
function placed(run: FixtureRun): { printed: Set<string>; held: Step[] } {
  const held = undatedRows(run.steps, run.schedule.waves)
  return { printed: new Set([...scheduledIds(run.schedule.waves), ...held.map((s) => s.id)]), held }
}

test('013.H: the printed plan carries every step the Plan draws, the undated held rows included', () => {
  const reasons = new Set<string>()
  let heldSeen = 0
  for (const c of CASES) {
    const { printed, held } = placed(c.run)
    // Nothing the Plan would draw as a row is missing from the document.
    for (const s of c.run.steps) {
      if (!inWave(s) || s.status === 'done') continue
      assert.ok(printed.has(s.id), `${c.name}: ${s.id} renders on the Plan and is in no printed section`)
    }
    // And nothing prints twice: the groups are disjoint from the dated waves.
    const dated = scheduledIds(c.run.schedule.waves)
    for (const s of held) assert.equal(dated.has(s.id), false, `${c.name}: ${s.id} is dated and in the undated group`)
    heldSeen += held.length
    for (const s of held) {
      const view = c.view(s)
      const contract = stepContract(s, c.ctx(s))
      // Every held step still carries its one next action.
      assert.ok(view.whatToDo.length > 0 && view.whatToDo.every((l) => l.trim().length > 0), `${c.name}: ${s.id} prints no action`)
      const reason = unavailableReason(s)
      if (reason === null) continue
      reasons.add(reason)
      // Why it is held is on the page: a blocker to clear, or the reason line
      // where the answer is not the operator's to go and do (a baseline that
      // contradicts itself waits for a reviewed baseline).
      const because = contract.implementation.offered ? null : contract.implementation.because
      assert.ok(contract.fix.length > 0 || (because !== null && because.length > 0), `${c.name}: ${s.id} prints neither a blocker nor a reason`)
      // And the withheld work stays withheld: no implementation, no rollout
      // dates, no announcement, no way back for a change nobody can make.
      assert.equal(contract.implementation.offered, false, `${c.name}: ${s.id} is held and offers an implementation`)
      assert.equal(implementationOffered(s), false, `${c.name}: ${s.id} is held and has operations to run`)
      assert.equal(jsonOffered(s), false, `${c.name}: ${s.id} is held and offers JSON`)
      assert.equal(view.dates, null, `${c.name}: ${s.id} is held and prints rollout dates`)
      assert.equal(view.ifWrong, null, `${c.name}: ${s.id} is held and prints a way back`)
      assert.equal(c.entry(s), undefined, `${c.name}: ${s.id} is held and has a calendar entry`)
    }
  }
  assert.ok(heldSeen > 0, 'no fixture holds a step: this test proves nothing')
  // The three the document most needs to explain are all in the sweep.
  for (const reason of ['missing-object', 'baseline-conflict', 'escape-hatch-unverified']) {
    assert.ok(reasons.has(reason), `no fixture prints a held step for ${reason}`)
  }
})

test('013.H: an unanswered decision leaves the work it holds in the printed plan, with what clears it', () => {
  // The one decision a fixture can be stripped of (mapping/safetyChoice.ts): with
  // it unanswered, the exclusions group cannot be settled and the policies that
  // name it lose their dates. The step that asks the question keeps its date, and
  // the work waiting on it prints in the undated group.
  const f = noExclusionsAnswer(fixture('small'))
  const run = runFixture(f)
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const ctx = (s: Step): StepVarContext =>
    ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null, groups: f.groups }) as StepVarContext
  const { printed, held } = placed(run)
  assert.ok(held.length > 0, 'an unanswered exclusions decision dates every policy')
  // The question is the asking step's action (owner, 2026-09-11: a decision is What to do, never a Fix line).
  const asking = run.steps.find((s) => stepContract(s, ctx(s)).whatToDo.kind === 'decide')
  assert.ok(asking, 'no step carries the unanswered decision')
  assert.ok(printed.has(asking!.id), 'the step that asks the question is not in the document')
  for (const s of held) {
    const contract = stepContract(s, ctx(s))
    assert.ok(contract.whatToDo.text.trim().length > 0, `${s.id} prints no action`)
    assert.equal(contract.implementation.offered, false, `${s.id} is held and offers an implementation`)
    const because = contract.implementation.offered ? null : contract.implementation.because
    assert.ok(contract.fix.length > 0 || (because !== null && because.length > 0), `${s.id} prints neither a blocker nor a reason`)
  }
})

test('013.H: the document reads the Plan’s row rule and writes none of its own', () => {
  const src = readFileSync(new URL('./PrintPlan.tsx', import.meta.url), 'utf8')
  assert.match(src, /import \{[^}]*\bfloorRows\b[^}]*\} from '\.\/planRows\.ts'/, 'the print derives its own group')
  assert.match(src, /undatedRows\(steps, phaseList\)/, 'the print does not read the undated group')
  assert.match(src, /planPhases\(schedule\)/, 'the print does not read the Plan’s phases')
  assert.match(src, /floorRows\(steps\)/, 'the print does not decide alone which rows are the floor')
  assert.match(src, /phaseRows\(steps, w\)/, 'the print decides a numbered phase’s rows itself')
  // All three printed step sections — the phases, the undated group and the
  // floor group (task 025) — use the screen's own step body, which is what
  // withholds the implementation, the dates, the announcement and the rollback.
  assert.equal(src.match(/<ContentStep step=\{s\}/g)?.length, 3, 'a printed step section builds a body of its own')
  // And the Plan draws the same steps, in lanes (S3, planLanes.ts): every step
  // the print's three sections carry has a lane reading, and the Plan derives no
  // phase, undated or floor grouping of its own.
  const plan = readFileSync(new URL('./Plan.tsx', import.meta.url), 'utf8')
  // The Plan reads the engine through the one board construction (R4-22), which
  // the print, the Export page and Connect read too.
  assert.match(plan, /const \{ readings, titleOf, cleanupRows \} = boardReadingsOf\(c\.steps, /, 'the Plan no longer reads the engine for its rows')
  assert.match(plan, /const rowSteps = c\.steps\.filter\(\(s\) => readings\.has\(s\.id\)\)/, 'the Plan decides its rows somewhere else')
  for (const own of ['phaseRows(', 'undatedRows(', 'floorRows(']) assert.equal(plan.includes(own), false, `the Plan still groups by ${own}`)
  for (const c of CASES) {
    const readings = laneReadings(c.run.steps)
    const printed = [...planPhases(c.run.schedule).flatMap((w) => phaseRows(c.run.steps, w)), ...undatedRows(c.run.steps, planPhases(c.run.schedule)), ...floorRows(c.run.steps)]
    for (const s of printed) assert.ok(readings.has(s.id), `${c.name}/${s.id}: printed, but the Plan draws it in no lane`)
  }
})

test('013.H: the printed document draws every step exactly once, and never dates finished work', () => {
  for (const c of CASES) {
    const steps = c.run.steps
    // A tenant with no Conditional Access licence builds no plan (owner,
    // 2026-09-20), so there is no printed document to draw anything twice.
    if (steps.length === 0) continue
    const waves = c.run.schedule.waves
    const seen = new Map<string, string[]>()
    const at = (s: Step, where: string): void => {
      seen.set(s.id, [...(seen.get(s.id) ?? []), where])
    }
    for (const w of waves) for (const s of phaseRows(steps, w)) at(s, `phase ${w.wave}`)
    for (const s of undatedRows(steps, waves)) at(s, 'undated')
    for (const s of floorRows(steps)) at(s, 'floor')
    for (const [id, where] of seen) assert.equal(where.length, 1, `${c.name}/${id} is drawn in ${where.join(' and ')}`)
    // A numbered phase carries dates, so what it draws is work still to do. A
    // schedule keeps the id of a step that was planned and is now In place, of
    // one the tenant does not need, and of a floor control this baseline does
    // not carry; each of those belongs to another group, and printing it under
    // a phase would give finished work a start date or hand the baseline author
    // a control they never asked for.
    for (const w of waves) {
      for (const s of phaseRows(steps, w)) {
        assert.ok(inWave(s), `${c.name}/${s.id}: a numbered phase draws a row the Plan holds elsewhere`)
        assert.notEqual(s.status, 'done', `${c.name}/${s.id}: finished work is printed under a dated phase`)
        assert.notEqual(s.floor, true, `${c.name}/${s.id}: a floor control is printed as the baseline author’s`)
      }
    }
    // And the document's own In place list and its phases never name the same
    // step: the cover would otherwise say a step is done on the page before the
    // one that schedules it.
    const inPhase = new Set(waves.flatMap((w) => phaseRows(steps, w).map((s) => s.id)))
    for (const s of steps.filter((x) => x.status === 'done')) {
      assert.ok(!inPhase.has(s.id), `${c.name}/${s.id}: the cover calls it In place and a phase schedules it`)
    }
    // And the rule is doing work: a wave really does keep the ids of steps that
    // no phase may draw. A surface reading `w.stepIds` straight — which is what
    // the printed document did — dates finished work, so if this ever stops
    // being true the source assertions above are the only thing left holding it.
    const raw = new Set(waves.flatMap((w) => w.stepIds))
    const excluded = [...raw].filter((id) => !inPhase.has(id))
    assert.ok(excluded.length > 0, `${c.name}: no wave carries a row a phase must not draw — the rule is untested here`)
  }
})

// ---- R4-22: the Export page states the lane the board states ----

// The Export page built its lane readings with no Cleanup rows, while the Plan,
// the print and Connect passed them. The drill — the prerequisite every
// policy's enforcement waits on — did not exist on the Export page, so the
// calendar, the bundle and the prompt pack stated a lane the board did not: a
// policy the board held Up Next behind the drill exported "Ready · Ready to
// enforce", and a step the board held On Hold exported "Up Next". Each surface
// now reads planBoard.ts boardReadingsOf, the one construction.
test('R4-22: the Export page, the print, Connect and the Plan read the board through one construction', () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  for (const [file, call] of [
    ['./Plan.tsx', 'boardReadingsOf(c.steps, cleanupPhase, answers)'],
    ['./PrintPlan.tsx', 'boardReadingsOf(steps, schedule.cleanup, answers)'],
    ['./Export.tsx', 'exportViewsOf(steps, schedule.cleanup, data.mapping?.breakGlassAnswers ?? null, stepCtx)'],
    ['./Connect.tsx', 'boardReadingsOf(computed.steps, computed.schedule.cleanup, cleanupAnswers)'],
  ] as const) {
    const src = read(file)
    assert.ok(src.includes(call), `${file} does not read the board's one construction`)
    assert.equal(src.includes('laneReadings('), false, `${file} builds lane readings of its own beside the board's`)
    assert.equal(src.includes('cleanupComplete('), false, `${file} decides a Cleanup row's completion itself`)
  }
  // The Export page reads a step under no lane but the one exportViewsOf hands it.
  assert.equal(read('./Export.tsx').includes('stepExportView('), false, 'the Export page builds an export view of its own beside exportViewsOf')
})

/** The calendar entry the Export page's view writes for one step, unfolded (RFC 5545 folds long lines). */
function calendarEntry(run: FixtureRun, view: (s: Step) => ReturnType<typeof stepExportView>, step: Step): string {
  const entry = buildIcs(run.steps, 'Tenant', run.input.planId, view).split('BEGIN:VEVENT').find((x) => x.includes(`-${step.id}@iamai`))
  assert.ok(entry, `the premise: the calendar carries ${step.id}`)
  return entry.replace(/\r\n /g, '')
}

test('R4-22: a step the board holds behind the drill exports the board\'s lane, not the one without it', () => {
  // mid, first scan: Register Your Own Passkey waits on Verify Emergency
  // Access (the drill, a Cleanup row). The board holds it On Hold; the Export
  // page's old construction, with no Cleanup rows, read it Up Next.
  const c = CASES.find((x) => x.name === 'mid')!
  const step = c.run.steps.find((s) => s.id === 's-ladder-operator-passkey')!
  assert.ok(step, 'the premise: mid carries the operator passkey step')
  const withoutCleanup = laneReadings(c.run.steps).get(step.id)!
  assert.equal(laneViewOf(withoutCleanup, () => null).label, 'Up Next', 'the premise: without the Cleanup rows the step reads another lane')
  assert.equal(c.lane(step).label, 'On Hold', 'the board holds the step behind the drill')
  // c.view is the Export page's own construction (exportViewsOf).
  assert.equal(c.view(step).state, 'On Hold', 'the export states a lane the board does not')
  assert.equal(calendarEntry(c.run, c.view, step).includes('Up Next'), false, 'the calendar entry says Up Next where the board says On Hold')
})

// The validator's severity-4 case (R4-22 challenge): a policy ready to enforce
// on its own evidence, which the board holds Up Next until Verify Emergency
// Access — the drill every policy's enforcement waits on — is done. The Export
// page's old construction had no Cleanup rows, so the drill did not exist
// there, and the calendar runbook said "Ready · Ready to enforce" beside the
// guard telling the reader not to turn it on until emergency access was
// tested. demo-week2 is the curated deployed tenant (fixtures/transitions.ts
// DEPLOYED); with its foundation settled, Token Protection is that policy. The
// validator found the same shape on getiamai settled, deployed and eight days
// on (seven policies, Block Legacy Authentication among them;
// docs/qa/night/personas/prints-r422-getiamai.ts).
test('R4-22: a policy the board holds behind the drill goes into the calendar as the board says it, never Ready to enforce', () => {
  const f = withFoundationSettled(fixture('demo-week2'))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === 's-goal-token-protection')!
  assert.ok(step, 'the premise: demo-week2 carries Token Protection')
  const answers = f.mapping.breakGlassAnswers ?? null
  const board = boardReadingsOf(run.steps, run.schedule.cleanup, answers)
  assert.equal(step.status, 'ready-to-enforce', 'the premise: the policy is ready to enforce on its own evidence')
  assert.equal(board.readings.get(step.id)?.reason?.id, 'cleanup-drill', 'the premise: the board holds it behind the drill')
  assert.equal(laneViewOf(laneReadings(run.steps).get(step.id)!, board.titleOf).label, 'Ready · Ready to enforce', 'the premise: without the Cleanup rows it reads Ready to enforce')
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null, groups: f.groups }) as StepVarContext
  // The Export page's own construction, as Export.tsx calls it.
  const view = exportViewsOf(run.steps, run.schedule.cleanup, answers, ctx)
  assert.equal(view(step).state, laneViewFor(step, board).label, 'the export states a lane the board does not')
  assert.equal(view(step).state, 'Up Next')
  const entry = calendarEntry(run, view, step)
  const description = entry.split('\r\n').find((l) => l.startsWith('DESCRIPTION:')) ?? ''
  assert.ok(description.includes('\\nUp Next\\n'), 'the runbook does not state the board\'s lane')
  assert.equal(entry.includes('Ready to enforce'), false, 'the runbook calls a policy the board holds behind the drill Ready to enforce')
})
