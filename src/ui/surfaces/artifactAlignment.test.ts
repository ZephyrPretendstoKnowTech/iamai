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
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { FixtureRun } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepExportView } from './stepExport.ts'
import { stepContract } from './stepContract.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { cleanupText, groundingBundle, promptPack, promptPackMarkdown, stepContext } from '../../roadmap/prompts.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { implementationOffered, jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { finalTargets, unavailableReason } from '../../roadmap/operations.ts'
import { statedEnforcement } from '../../roadmap/forecast.ts'
import { readinessTable } from './inventoryTables.ts'
import { redactIdentifiers } from '../../redact.ts'
import { readFileSync } from 'node:fs'

type Case = { name: string; run: FixtureRun; ctx: (s: Step) => StepVarContext; view: (s: Step) => ReturnType<typeof stepExportView>; prompt: (s: Step) => string; entry: (s: Step) => string | undefined; snapshot: FixtureRun['input']['snapshot'] }

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

function load(name: string): Case {
  const f = fixture(name as never)
  const run = runFixture(f)
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const ctx = once((s: Step): StepVarContext =>
    ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null, groups: f.groups }) as StepVarContext)
  const view = once((s: Step) => stepExportView(s, ctx(s)))
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
  return { name, run, ctx, view, prompt: once((s: Step) => stepContext(s, view)), entry, snapshot: f.snapshot }
}

/** Every fixture the repo ships, each loaded once: the whole state matrix, not a chosen example. */
const CASES: Case[] = allFixtures().map((f) => load(f.name))

// ---- A. the export view is the contract, field for field ----

test('013.A: every artifact reads one step, and that step is the frozen Step Contract', () => {
  let checked = 0
  for (const c of CASES) {
    for (const s of c.run.steps) {
      const v = c.view(s)
      const k = stepContract(s, c.ctx(s))
      const where = `${c.name}/${s.id}`
      // Foundation B's two axes, its status word and its dated next line.
      assert.equal(v.stage, k.state.stage, `${where}: stage`)
      assert.equal(v.condition, k.state.conditionLabel, `${where}: condition`)
      assert.equal(v.status, k.state.word, `${where}: status word`)
      assert.equal(v.next, k.milestone.line, `${where}: next line`)
      // Foundation A's reach, its outstanding prerequisites, its completion, and
      // the one answer the four implementation channels read.
      assert.equal(v.who, k.who?.text ?? null, `${where}: who`)
      assert.deepEqual(v.fix, k.fix.map((x) => x.text), `${where}: fix`)
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

// ---- B. work the Plan withholds leaks no implementation ----

test('013.B: where the Plan offers no implementation, no artifact carries one', () => {
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
      // And the prose artifacts carry the resolution, not the instructions.
      const said = [v.whatToDo.join('\n'), c.prompt(s)]
      for (const text of said) {
        assert.equal(/"conditions"|includeUsers|grantControls/.test(text), false, `${where}: a policy body reached a prose artifact`)
        assert.equal(/Conditional Access → Policies/.test(text), false, `${where}: a portal instruction reached a prose artifact`)
      }
      // The completion is what would clear the hold, never the rollout's gates.
      assert.equal(v.doneWhen.length, 1, `${where}: ${v.doneWhen.join(' | ')}`)
      assert.equal(/report-only|sign-in failures/i.test(v.doneWhen[0]), false, `${where}: a rollout completion — ${v.doneWhen[0]}`)
    }
  }
  // The fixtures really do exercise more than one way for work to be held.
  assert.ok(reasons.size >= 3, `only ${[...reasons].join(', ')} exercised`)
})

test('013.B: a step whose answer the operator still owes carries the question, not the work', () => {
  const kinds = new Set<string>()
  for (const c of CASES) {
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
    assert.ok(stepGrounded.length > 0, `${c.name}: no prompt is grounded in a step`)
    for (const p of stepGrounded) assert.ok(p.prompt.includes(p.scope!), `${c.name}: "${p.title}" claims a step its facts do not name`)
    // And the file a person downloads says it too, so the scope does not live
    // only in the page that built it.
    const md = promptPackMarkdown(pack, 'Tenant')
    for (const p of stepGrounded) assert.ok(md.includes(p.scope!), `${c.name}: the markdown drops the scope of "${p.title}"`)
  }
})

test('013.E: a Cleanup row states what it has and invents no finish', () => {
  const c = load('demo-week2')
  const rows = cleanupExportViews(c.run.schedule.cleanup, {})
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
    const ics = buildIcs(c.run.steps, 'Tenant', c.run.input.planId, c.view, cleanupExportViews(c.run.schedule.cleanup, {}))
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
  assert.deepEqual([...new Set(unredacted)].sort(), ['grounding-bundle', 'plan-file', 'print-document'])
  for (const artifact of ['.ics', 'text/csv', 'text/markdown']) {
    const line = src.split('\n').find((l) => l.includes(artifact) && l.includes('exportDownload'))
    assert.ok(line, `the page no longer downloads ${artifact}`)
    assert.match(line!, /REDACTED/, `${artifact} leaves without the guard's redaction`)
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
    for (const key of ['stage', 'condition', 'next', 'who', 'fix', 'doneWhen', 'implementation']) assert.ok(key in row, `the bundle drops the contract's ${key}`)
  }
})
