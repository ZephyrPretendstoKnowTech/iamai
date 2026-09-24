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
import { isGroupMember } from '../../roadmap/stepGroups.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle, promptPack, promptPackMarkdown, stepContext } from '../../roadmap/prompts.ts'
import { cleanupExportViews } from './cleanupExport.ts'
import { implementationOffered, jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { finalTargets, unavailableReason } from '../../roadmap/operations.ts'
import { statedEnforcement } from '../../roadmap/forecast.ts'
import { readinessTable } from './inventoryTables.ts'
import { floorRows, phaseRows, planPhases, scheduledIds, undatedRows } from './planRows.ts'
import { laneReadings } from './planLanes.ts'
import { boardReadingsOf, laneViewFor, laneViewOf } from './planBoard.ts'
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
  const view = once(exportViewsOf(board, ctx))
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

test('013.A: every artifact reads one step, and that step is the frozen Step Contract; an unknown reach is never written down as a number', () => {
  {
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
        // The next action is in the artifact, always, and it is the screen's. A
        // finished supporting step's procedure stands as its What to do, with no
        // no-op line in front of it (walk list item 19, stepExport.ts procedureStands).
        const procedureStands = k.state.lane?.lane === 'Completed' && (contentStepFor(s) as { kind?: string } | undefined)?.kind !== 'policy' && v.whatToDo.length > 0
        assert.ok(procedureStands || v.whatToDo.includes(k.whatToDo.text), `${where}: the artifact drops the screen's action — ${v.whatToDo.join(' | ')}`)
        checked += 1
      }
    }
    assert.ok(checked > 100, `only ${checked} steps swept`)
  }
  {
    for (const c of CASES) {
      for (const s of c.run.steps) {
        const v = c.view(s)
        const k = stepContract(s, c.ctx(s))
        if (k.who?.known === false) assert.equal(v.population, null, `${c.name}/${s.id}: a scope Foundation A could not settle carries a count`)
      }
    }
  }
})

// ---- the one rendering the flat artifacts share (D, E) ----

test("013.A/D/E: the calendar entry and the prompt block are one run of the view's lines, dated the same way, each fact said once", () => {
  {
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
  }
  {
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
  }
  {
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
        // A turn-on the step does not hand over yet is carried by what it waits
        // on alone (stepExport.ts; 005.11): the screen keeps it as the step's
        // task in every state, the export never offers it early.
        const next = body.emergencyAccountTasks?.tasks.find((t) => t.required)
        if (next?.title !== 'Turn the policy on') assert.ok(v.whatToDo.length > 1, `${where}: useful displayed guidance missing from export`)
      }
      assert.equal(v.whatToDo[0], stepContract(s, c.ctx(s), undefined, c.lane(s)).whatToDo.text, `${where}: readiness action no longer first`)
      // The completion is one line: the resolution where there is no policy to
      // state an end of, and otherwise the policy's end state — what clears the
      // hold is Fix before continuing's (owner, 2026-09-11); never the rollout's gates.
      // A step that makes an object itself (Stage 3, Step.objectTask) finishes
      // on that object's completion first, as its first task, then on the
      // answer it still asks for, where it asks one, then on its own end state,
      // whatever else holds it.
      // A policy in Turn On MFA for Everyone finishes on the same two lines in every state, held
      // included (walk list 4.x item 26, owner 2026-09-24): what IAMAI will see, and its report-only period.
      if (isGroupMember(s.id, 'core')) continue
      const taskDone = s.objectTask !== undefined ? stepContract(s.objectTask, c.ctx(s)).doneWhen : []
      const decided = s.objectTask !== undefined && s.state.condition === 'needs-decision' ? [CONTRACT.doneDecision] : []
      const lead = [...taskDone, ...decided]
      assert.deepEqual(v.doneWhen.slice(0, lead.length), lead, `${where}: the task's completion and the answer do not lead: ${v.doneWhen.join(' | ')}`)
      assert.equal(v.doneWhen.length, lead.length + 1, `${where}: ${v.doneWhen.join(' | ')}`)
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
        assert.match(v.doneWhen[lead.length], shape, `${where}: ${v.doneWhen.join(' | ')}`)
      }
      assert.equal(/report-only|sign-in failures|%/i.test(v.doneWhen.join(' ')), false, `${where}: a rollout completion — ${v.doneWhen.join(' | ')}`)
    }
  }
  // The fixtures really do exercise more than one way for work to be held.
  assert.ok(reasons.size >= 3, `only ${[...reasons].join(', ')} exercised`)
})

// ---- C. create stays create, update names the target it will write ----

test('013.C: the machine artifacts name the resolved objects they write, and a goal already delivered proposes nothing', () => {
  {
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
    // Every shipped fixture's corrections wait on Configure Emergency Exclusions,
    // the one step that asks for the exclusions edit (walk list 4.x item 7), so
    // the sweep reaches creates only; an update it does reach is checked above.
    assert.ok(creates > 0, `creates ${creates}, updates ${updates}: the sweep reached no operation`)
  }
  {
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
  }
})

// ---- D. what a date is worth travels with it ----

test("013.D: the bundle carries the screen's reading of a step, and a projected enforcement is never stated as one the policy has earned", () => {
  {
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
  }
  {
    const c = load('demo-week2')
    const bundle = groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 7, 2026' }) as unknown as { plan: { steps: Record<string, unknown>[] } }
    for (const row of bundle.plan.steps) {
      for (const key of ['rings', 'events', 'plainTitle', 'forManager']) assert.equal(key in row, false, `the bundle carries the engine's ${key}`)
      for (const key of ['state', 'next', 'who', 'fix', 'doneWhen', 'implementation']) assert.ok(key in row, `the bundle drops the contract's ${key}`)
    }
  }
})

// ---- F/G. Export is not a second MFA Readiness, and carries no identity ----

test('013.F/G: no plan artifact leaks identity: the MFA ledger stays in its CSV, the calendar and the redacted bundle carry no tenant id or sign-in name, and every export goes through the guard', () => {
  {
    const c = load('demo-week2')
    // The ledger really exists, and it is the CSV's — one deliberate download,
    // built from the readiness page's own view, not scattered through the plan.
    const ledger = readinessTable(c.snapshot, { breakGlassUserIds: [], serviceAccountUserIds: [] })
    assert.ok(ledger.rows.length > 5, 'the fixture has no readiness ledger to leak')
    const people = c.snapshot.users.map((u) => u.displayName ?? '').filter((n) => n.length > 3)
    const bundle = JSON.stringify(groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: false, generated: 'Sep 7, 2026' }))
    const ics = buildIcs(c.run.steps, 'Tenant', c.run.input.planId, c.view)
    const prompts = promptPackMarkdown(promptPack({ view: c.view, tenant: 'Tenant', steps: c.run.steps, schedule: c.run.schedule, changeRecord: '', announcement: null }), 'Tenant')
    for (const [where, text] of [['bundle', bundle], ['calendar', ics], ['prompt pack', prompts]] as const) {
      // A plan artifact may name a handful of people a step actually turns on. It
      // may not be the ledger: a majority of the directory is the ledger.
      const named = people.filter((n) => text.includes(n)).length
      assert.ok(named * 2 < people.length, `the ${where} names ${named} of ${people.length} people`)
      // And none of them carries the readiness columns themselves.
      for (const column of ledger.header) assert.equal(text.includes(`"${column}"`), false, `the ${where} carries the readiness column ${column}`)
    }
  }
  {
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
  }
  {
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
      // The calendar and the pack are runbooks: redacted, with the passkey model AAGUIDs kept (exportGuard.ts runbookRedaction).
      assert.match(line!, artifact === 'text/csv' ? /unredactedFrom\('inventory-csv'\)/ : /REDACTED|runbookRedaction\(data\.mapping\)/, `${artifact} leaves without its declared export policy`)
    }
  }
  {
    for (const c of CASES) {
      const bundle = JSON.stringify(groundingBundle({ view: c.view, tenant: 'Tenant', snapshot: c.snapshot, coverage: c.run.coverage, steps: c.run.steps, schedule: c.run.schedule, redacted: true, generated: 'Sep 7, 2026' }))
      assert.equal(bundle.includes(c.snapshot.tenantId), false, `${c.name}: the tenant id survived redaction`)
      for (const u of c.snapshot.users.slice(0, 12)) {
        if (u.userPrincipalName) assert.equal(bundle.includes(u.userPrincipalName), false, `${c.name}: ${u.userPrincipalName} survived redaction`)
        if (u.displayName && u.displayName.length > 4) assert.equal(bundle.includes(u.displayName), false, `${c.name}: ${u.displayName} survived redaction`)
      }
    }
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

test('013.H: the printed plan carries every step the Plan draws exactly once, the undated held rows included, and never dates finished work', () => {
  {
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
  }
  {
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

test('013.H/R4-22: the print, the Export page, Connect and the Plan read the one board construction and write no row rule of their own', () => {
  {
    const src = readFileSync(new URL('./PrintPlan.tsx', import.meta.url), 'utf8')
    // The document prints the board's rows in the board's sections (printPlan.ts
    // printSectionsOf, roadmap flow V1 decision 8), and decides no grouping of its
    // own. Its timeline dates each phase by the Plan's own phase rule, reading the
    // board's hold (planBoard.ts boardHolds, owner decision 2): a step the board
    // holds is dated under no phase, and the print decides no hold of its own.
    assert.match(src, /const sections = printSectionsOf\(board\)/, 'the print groups its rows itself')
    assert.match(src, /planPhases\(schedule\)/, 'the print does not read the Plan’s phases')
    assert.match(src, /phaseRows\(steps, w, boardHeld\)/, 'the print decides a numbered phase’s rows itself')
    assert.match(src, /const boardHeld = \(s: Step\): boolean => boardHolds\(s, laneOf\(s\.id\)\)/, 'the print decides for itself which steps are held')
    // Every printed step uses the screen's own step body, which is what withholds
    // the implementation, the dates, the announcement and the rollback: there is
    // one place the document draws a step in full (task 025).
    assert.equal(src.match(/<ContentStep step=\{s\}/g)?.length, 1, 'a printed step builds a body of its own')
    // And the Plan draws the same steps, in lanes (S3, planLanes.ts): every step
    // the print's timeline dates has a lane reading, and the Plan derives no
    // phase, undated or floor grouping of its own.
    const plan = readFileSync(new URL('./Plan.tsx', import.meta.url), 'utf8')
    // The Plan reads the engine through the one board construction (R4-22), which
    // the print, the Export page and Connect read too.
    // Through boardOf, the rows built once on that construction (planBoard.ts).
    assert.match(plan, /const board = boardOf\(c\.steps, cleanupPhase, answers\)\n\s*const \{ readings, titleOf, cleanupRows, prerequisiteLabel, enforceWaits \} = board/, 'the Plan no longer reads the engine for its rows')
    assert.match(plan, /const rowSteps = c\.steps\.filter\(\(s\) => readings\.has\(s\.id\)\)/, 'the Plan decides its rows somewhere else')
    for (const own of ['phaseRows(', 'undatedRows(', 'floorRows(']) assert.equal(plan.includes(own), false, `the Plan still groups by ${own}`)
    for (const c of CASES) {
      const readings = laneReadings(c.run.steps)
      const printed = [...planPhases(c.run.schedule).flatMap((w) => phaseRows(c.run.steps, w)), ...undatedRows(c.run.steps, planPhases(c.run.schedule)), ...floorRows(c.run.steps)]
      for (const s of printed) assert.ok(readings.has(s.id), `${c.name}/${s.id}: printed, but the Plan draws it in no lane`)
    }
  }
  // The Export page built its lane readings with no Cleanup rows, while the Plan,
  // the print and Connect passed them. The drill — the prerequisite every
  // policy's enforcement waits on — did not exist on the Export page, so the
  // calendar, the bundle and the prompt pack stated a lane the board did not: a
  // policy the board held Up Next behind the drill exported "Ready · Ready to
  // enforce", and a step the board held On Hold exported "Up Next". Each surface
  // now reads planBoard.ts boardReadingsOf, the one construction.
  {
    const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
    for (const [file, call] of [
      ['./Plan.tsx', 'boardOf(c.steps, cleanupPhase, answers)'],
      ['./PrintPlan.tsx', 'boardOf(steps, schedule.cleanup, answers)'],
      ['./Export.tsx', 'boardOf(steps, schedule.cleanup, data.mapping?.breakGlassAnswers ?? null)'],
      // Connect's counts are derive/facts.ts stepFacts, which counts the board's rows.
      ['./Connect.tsx', 'stepFacts(computed.steps, computed.schedule.cleanup ?? null, cleanupAnswers)'],
      ['../../derive/facts.ts', 'boardReadingsOf(steps, cleanup, answers)'],
    ] as const) {
      const src = read(file)
      assert.ok(src.includes(call), `${file} does not read the board's one construction`)
      assert.equal(src.includes('laneReadings('), false, `${file} builds lane readings of its own beside the board's`)
      assert.equal(src.includes('cleanupComplete('), false, `${file} decides a Cleanup row's completion itself`)
    }
    // The Export page reads a step under no lane but the one exportViewsOf hands it.
    assert.equal(read('./Export.tsx').includes('stepExportView('), false, 'the Export page builds an export view of its own beside exportViewsOf')
  }
})

// ---- R4-22: the Export page states the lane the board states ----

test("R4-22: a step the board holds behind the drill is exported in the board's lane, never Ready to enforce, and booked on no day (owner decision 2, 2026-09-22)", () => {
  {
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
    // The calendar used to carry it under the board's lane. A step the board
    // holds reads "After prerequisites" and carries no date anywhere (owner
    // decision 2, 2026-09-22), so the calendar books nothing for it at all.
    assert.equal(buildIcs(c.run.steps, 'Tenant', c.run.input.planId, c.view).includes(`-${step.id}@iamai`), false, 'a step the board holds is booked into the calendar')
  }
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
  {
    const f = withFoundationSettled(fixture('demo-week2'))
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === 's-goal-token-protection')!
    assert.ok(step, 'the premise: demo-week2 carries Token Protection')
    const answers = f.mapping.breakGlassAnswers ?? null
    const board = boardReadingsOf(run.steps, run.schedule.cleanup, answers)
    assert.equal(step.status, 'ready-to-enforce', 'the premise: the policy is ready to enforce on its own evidence')
    assert.equal(board.readings.get(step.id)?.reason?.id, 'cleanup-drill', 'the premise: the board holds it behind the drill')
    assert.equal(laneViewOf(laneReadings(run.steps).get(step.id)!, board.titleOf).label, 'Ready · Turn on', 'the premise: without the Cleanup rows it reads Ready · Turn on')
    const nameOf = (id: string): string => run.input.names?.label(id) ?? id
    const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[s.id] ?? null, groups: f.groups }) as StepVarContext
    // The Export page's own construction, as Export.tsx calls it.
    const view = exportViewsOf(board, ctx)
    assert.equal(view(step).state, laneViewFor(step, board).label, 'the export states a lane the board does not')
    assert.equal(view(step).state, 'Up Next')
    // The runbook every flat artifact carries (the calendar entry's description,
    // the prompt pack's step block) states the board's lane, never Ready to enforce.
    const runbook = stepArtifactLines(view(step))
    assert.ok(runbook.includes('Up Next'), 'the runbook does not state the board\'s lane')
    assert.equal(runbook.join('\n').includes('Ready · Turn on'), false, 'the runbook calls a policy the board holds behind the drill Ready · Turn on')
    // Its day is the turn-on, which the drill holds (owner decision 6), so the
    // board reads "After prerequisites" and the calendar books nothing for it
    // (owner decision 2, R4-55): the entry it used to get was dated on the turn-on.
    assert.equal(buildIcs(run.steps, 'Tenant', run.input.planId, view).includes(`-${step.id}@iamai`), false, 'a policy whose turn-on the drill holds is booked into the calendar')
  }
})
