// The persona harness. NOT part of the product: nothing here ships. This file
// is tracked with the rest of the harness core, which .gitignore lists and
// says why; everything else in the directory is ignored. Its self-check,
// src/testing/personaHarness.test.ts, imports it: after a change, run
// `npm run verify -- src/testing/personaHarness.test.ts`, which typechecks it
// and checks it still says what the screen says. CI runs both with the suite.
// It exists so five simulated administrators can each use IAMAI end to end —
// read a tenant, answer its questions, follow its instructions, come back and
// scan again — and so what they saw can be quoted exactly rather than
// remembered.
//
// Everything here drives the SAME producers the screen drives. No text is
// invented: `render()` returns what `ContentStep.tsx` would draw, because it
// reads the same `stepBodyOf`.
//
//   import { plan, render, lanes, decide, deploy, tenant } from './harness.ts'
import { fixture } from '../../../../src/roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../../../src/roadmap/fixtures/index.ts'
import { runFixture, withRecoveryTested } from '../../../../src/roadmap/fixtures/run.ts'
import { recoveryCandidate } from '../../../../src/roadmap/fixtures/recoveryRecords.ts'
import type { FixtureRun } from '../../../../src/roadmap/fixtures/run.ts'
import { stepBodyOf } from '../../../../src/ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../../../../src/ui/surfaces/stepVars.ts'
import { appliedMapping } from '../../../../src/ui/surfaces/pickerRows.ts'
import { customerPlanSteps } from '../../../../src/ui/surfaces/customerPlanSteps.ts'
import { BREAK_GLASS_STEP_ID } from '../../../../src/roadmap/stepIds.ts'
import type { StepDecisionInput } from '../../../../src/roadmap/decisions.ts'
import { directionAnswerComplete, directionDecisionOf, directionDraftOf } from '../../../../src/roadmap/directionAnswers.ts'
import type { DirectionAnswer } from '../../../../src/roadmap/directionAnswers.ts'
import { allWorkGroups, BOARD, boardOf, TAB_OF } from '../../../../src/ui/surfaces/planBoard.ts'
import type { Board } from '../../../../src/ui/surfaces/planBoard.ts'
import { badgeLabel } from '../../../../src/ui/surfaces/stepContract.ts'
import { stepOperations } from '../../../../src/ui/surfaces/stepJson.ts'
import { contentTitle } from '../../../../src/content/stepTitle.ts'
import { passkeyReadingOf, requiredModels } from '../../../../src/roadmap/passkeySettings.ts'
import { passkeyRestrictionReading } from '../../../../src/roadmap/passkeyRestrictions.ts'
import { methodAvailability } from '../../../../src/roadmap/methodAvailability.ts'
import { observationsOf } from '../../../../src/roadmap/tracking.ts'
import { activePeopleIds } from '../../../../src/derive/population.ts'
import { notPeopleIds } from '../../../../src/derive/sets.ts'
import { setDisplayTimeZone } from '../../../../src/copy/dates.ts'
import { pinnedPackage } from '../../../../src/baseline/pinned.ts'
import { PINNED_GOAL_MAP, policyKey } from '../../../../src/roadmap/goalMap.ts'
import type { StepObservationRecord } from '../../../../src/roadmap/observation.ts'
import type { Step } from '../../../../src/roadmap/types.ts'

export type Tenant = Fixture

/**
 * The people the product counts as active at this scan: `activePeopleIds` at
 * the scan's own clock, without the accounts the plan says are not people
 * (service and emergency accounts), exactly as planData.ts and runFixture call
 * it. `days()` and `enrolMfa()` called it with the snapshot alone, so with no
 * clock and no exclusions it counted dormant accounts, service accounts and
 * emergency accounts as active, all of whom then signed in on every day of
 * every report-only window, and were enrolled with the team wherever they held
 * no method.
 */
export const activePeople = (t: Tenant): string[] => activePeopleIds(t.snapshot, t.snapshot.asOf, notPeopleIds(mappingOf(t)))

/**
 * A persona's tenant: a shipped fixture as the starting shape, on the baseline
 * the product ships, then whatever this persona's situation changes.
 *
 * The product loads one baseline, the pinned package (src/ui/baseline.ts). The
 * fixtures do not: every one but the demo builds on an eight-policy synthetic
 * stand-in (fixtures/index.ts `syntheticBaseline`), which the unit tests are
 * written against and which no administrator ever sees. A tenant built on it
 * describes policies that never ship — their apps, their filters, their names,
 * their JSON. So a persona's tenant is re-based on the pin unless
 * the persona asks otherwise: `{ baseline: 'fixture' }` keeps the fixture's
 * own, for a run that means to reproduce what a unit test sees.
 *
 * The stand-in is not only a different set of policies. The product hands the
 * engine the goal map pinned with its baseline, and the map names none of the
 * stand-in's policies, so on the stand-in the engine falls back to matching
 * policies to goals by their signature (generate.ts `sourcesFor`), a path no
 * production baseline takes; on the stand-in it picked the all-users MFA
 * policy for guests. So a tenant whose baseline the map does not describe says so:
 * on the pin that is a mistake and stops the run; on the stand-in, which asked
 * for it, the run is told what it is reading.
 */
export function tenant(base: FixtureName, mutate: (t: Tenant) => void = () => {}, opts: { baseline?: 'pinned' | 'fixture' } = {}): Tenant {
  const t = structuredClone(fixture(base)) as Tenant
  const pinned = (opts.baseline ?? 'pinned') === 'pinned'
  if (pinned) t.baseline = pinnedPackage()
  mutate(t)
  if (!goalMapDescribes(t)) {
    if (pinned) throw new Error(`tenant('${base}'): the pinned goal map describes none of this tenant's baseline policies, so the engine would match them by signature, which the product never does. Something replaced the pinned baseline.`)
    console.warn(`tenant('${base}', …, { baseline: 'fixture' }): the fixture's stand-in baseline. The goal map describes none of its policies, so the engine matches them to goals by signature, a path no production baseline takes. Which policy a step creates, its reach and its gate on this run are not what the product would show.`)
  }
  return t
}

/**
 * Whether the goal map the product hands the engine (the pinned baseline's own,
 * `PINNED_GOAL_MAP`, which runFixture defaults to) names any of this tenant's
 * baseline policies — the test generate.ts makes before it falls back to
 * signature matching (`mapDescribesPackage`).
 */
export function goalMapDescribes(t: Tenant): boolean {
  const keys = new Set(t.baseline.policies.map((p) => policyKey(p)))
  return Object.values(PINNED_GOAL_MAP).flat().some((k) => keys.has(k))
}

/**
 * The mapping every surface reads: the tenant's STORED mapping record, with
 * every picker's detected default applied as the plan's decision and then every
 * decision the person saved over it (pickerRows.ts `appliedMapping`, which
 * planData.ts runs before it derives anything). `t.mapping` is the stored
 * record and `t.decisions` the saved step decisions, as the app keeps them in
 * two places; neither alone is what the plan is derived from.
 *
 * `plan()` and `rescan()` used to hand `runFixture` the stored record as it
 * stood, so the detected defaults (the service accounts the signals nominate,
 * the special-care people) were never applied and a question the product shows
 * as a suggestion read to a persona as saved.
 */
export function mappingOf(t: Tenant): Tenant['mapping'] {
  const nameOf = (id: string): string => t.groups.get(id)?.displayName ?? id
  return appliedMapping({ snapshot: t.snapshot, mapping: t.mapping, nameOf, groups: t.groups, now: t.snapshot.asOf }, t.decisions ?? null)
}

/**
 * Every date the product formats is in the plan's display time zone, which
 * planData.ts sets from the stored mapping (`setDisplayTimeZone`) before the
 * plan is derived or a page drawn. The harness never set it, so every date a
 * persona read — the engine's own "created in report-only by …" lines as much
 * as the rail and the tiles — was formatted in whatever zone the machine
 * running the script was in: Aug 28 3:00 AM on a Denver machine for a Sydney
 * tenant's 7:00 PM scan. Every entry point that derives or draws calls this
 * first, with the tenant it is about.
 */
const zoned = (t: Tenant): void => setDisplayTimeZone(t.mapping.displayTimeZone ?? null)

/** The tenant as planData.ts derives it: the same scan, over the applied mapping, in its display zone. */
const derived = (t: Tenant): Tenant => {
  zoned(t)
  return { ...t, mapping: mappingOf(t) }
}

/**
 * The steps the plan surfaces show: planData.ts takes the steps the engine
 * withholds from every customer surface out (customerPlanSteps.ts) before
 * anything reads them. The harness showed them, so a script could read and
 * render a step the product never draws (the admin-portals policy). The product
 * removes them before tracking and this after; no other step refers to them, so
 * no reading differs.
 */
const shown = (r: FixtureRun): FixtureRun => ({ ...r, steps: customerPlanSteps(r.steps) })

/**
 * The person's FIRST scan of this tenant. Nothing was watched before it, so it
 * carries no prior record: everything it sees, it sees for the first time.
 */
export const plan = (t: Tenant): FixtureRun => shown(runFixture(derived(t)))

/**
 * What the plan recorded about the tenant's policies, to hand to the next scan.
 * Without it every scan is a first scan, and IAMAI cannot tell a policy it
 * watched appear from one it found already there — which is the difference
 * between "you enforced this without a window" and "this was here before I was".
 */
export const observations = (r: FixtureRun, prior: Record<string, StepObservationRecord> | null = null): Record<string, StepObservationRecord> =>
  observationsOf(r.steps, prior)

/**
 * The context the opened step is rendered with — the same one Plan.tsx builds.
 * Its mapping is the one the run was derived from (planData.ts hands the page
 * `applied`), never the stored record.
 */
export function ctxOf(t: Tenant, r: FixtureRun, step: Step): StepVarContext {
  // A script that renders with this context draws dates too.
  zoned(t)
  return {
    snapshot: t.snapshot, mapping: r.input.mapping,
    nameOf: (id: string) => r.input.names?.label(id) ?? id,
    signature: 'IT', operatorId: t.operatorId, now: t.snapshot.asOf, groups: t.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
}

/**
 * The board the Plan draws: planBoard.ts `boardOf`, the one producer Plan.tsx,
 * the printed plan, Export and Connect read, over the run's steps, its Cleanup
 * rows and the emergency-access answers the plan holds.
 *
 * This kept its own copy of Plan.tsx's board construction. The copy was wrong
 * more than once: it left the Cleanup rows out, so the drill that holds every
 * policy's enforcement was never a row; it titled rows with the engine's goal
 * statement where the board draws the content title; it named a prerequisite
 * by that statement too, grouped by the engine's kind, and read every Cleanup
 * row as incomplete. A second copy of the board drifts whenever the first one
 * changes, so there is none.
 */
const boardFor = (r: FixtureRun): Board => boardOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)

/**
 * One row of the board. `title` is the text the row draws — `contentTitle(step)`
 * for a step, the Cleanup entry's title for a Cleanup row — and `step` is null
 * on a Cleanup row, which is a row and not a step: read `id`, `title` and
 * `cleanup` (its kind) there.
 */
export type BoardRow = {
  id: string
  title: string
  step: Step | null
  cleanup: string | null
  lane: string
  substatus: string | null
  tab: string
  group: string
}

/**
 * Every row in the order the board shows it, with the title and the lane word a
 * person reads.
 *
 * The Plan opens on All work (owner, roadmap flow V2): every section in its
 * registry place, whole, finished ones collapsed there (planBoard.ts
 * allWorkGroups). So this walks All work section by section, exactly as the
 * page does, and names the section each row is under (`group`) and the lane tab
 * that would also show it (`tab`: ready, upNext or onHold, or completed and
 * deferred for finished work, which no lane tab draws inside its panel).
 */
export function lanes(t: Tenant, r: FixtureRun): BoardRow[] {
  zoned(t)
  const board = boardFor(r)
  const rows = new Map(board.rows.map((row) => [row.item.id, row]))
  const items = board.rows.map((row) => row.item)
  const out: BoardRow[] = []
  for (const group of allWorkGroups(items, items)) {
    for (const item of group.items) {
      const row = rows.get(item.id)
      if (!row) continue
      const tab = TAB_OF[row.reading.lane] ?? (row.reading.lane === 'Completed' ? 'completed' : 'deferred')
      out.push({ id: item.id, title: item.title, step: row.step, cleanup: row.cleanup ? row.cleanup.row.kind : null, lane: row.reading.lane, substatus: row.lane.substatus, tab, group: group.label })
    }
  }
  // Anything the tabs did not draw is still reported, after the rows, so a
  // reading of this is never quietly short of a step.
  //
  // A step the person ruled out is one of these and is NOT missing: the lane
  // engine gives it no reading on purpose and the Plan draws it in the footer,
  // under "Doesn't apply here". Calling that "not on the board" invited exactly
  // the kind of finding that costs a round — a persona reporting a step the
  // product had lost, when the product had put it where the person asked.
  const drawn = new Set(out.map((row) => row.id))
  for (const step of r.steps) {
    if (drawn.has(step.id)) continue
    const view = board.readings.has(step.id) ? board.laneOf(step.id) : null
    const ruledOut = step.doesntApply != null
    out.push({
      id: step.id,
      title: contentTitle(step),
      step,
      cleanup: null,
      lane: ruledOut ? BOARD.lanes.doesntApply : view?.lane ?? 'Unknown',
      substatus: view?.substatus ?? null,
      tab: ruledOut ? 'doesntApply' : 'none',
      group: ruledOut ? `${BOARD.lanes.doesntApply} (in the footer, not a lane)` : 'drawn in no tab — check the board',
    })
  }
  return out
}

/**
 * The opened step's body exactly as ContentStep.tsx receives it: `stepBodyOf`
 * with the board's lane, blockers, prerequisite labels and enforce waits. A
 * script that needs a section `render()` does not flatten reads it here rather
 * than copying the board's readings: a copy carries whatever the board said
 * when it was made.
 *
 * The badge the page draws is `badgeLabel(view.contract)`, never
 * `contract.state.badge` or `contract.state.word`: those are inputs to it, and
 * with a lane present (always, on the board) no surface draws them.
 */
export function stepView(t: Tenant, r: FixtureRun, step: Step): ReturnType<typeof stepBodyOf> {
  zoned(t)
  // WITH the lane, the readiness blockers, the prerequisite labels and the
  // enforce waits, because Plan.tsx passes all four (Plan.tsx -> ContentStep.tsx).
  // Without them stepBody falls back to `laneViewFor(step)` — the lane engine
  // run over a plan of ONE step — and the contract, the Done-when, the rail and
  // the badge all follow that instead of the board. On a messy tenant that
  // disagreed with the real board for 18 of 38 steps.
  const board = boardFor(r)
  const onBoard = board.readings.has(step.id)
  return stepBodyOf(step, ctxOf(t, r, step), {
    lane: onBoard ? board.laneOf(step.id) : undefined,
    blockers: onBoard ? board.blockersOf(step.id) : undefined,
    prerequisiteLabel: board.prerequisiteLabel,
    enforceWaits: board.enforceWaits,
  })
}

/**
 * What a person actually sees on the opened step: every section, in order, and
 * every implementation channel. This is the text the persona reads, so it is
 * the text a comprehension finding must quote.
 *
 * `badge` is the state badge the step's head draws (`badgeLabel`, as
 * ContentStep.tsx draws it) and `fact` the tenant-fact chip beside it. There is
 * no `state`: it was `contract.state.word / stage`, which the head never draws,
 * and it read as the step's state — "Ready" on a step whose badge and board
 * row both read On Hold. Reading it now throws, so a
 * script written against the old shape stops instead of printing the wrong
 * word.
 */
export function render(t: Tenant, r: FixtureRun, step: Step): {
  title: string; eyebrow: string | null; lane: string; badge: string; fact: string | null
  why: string; cards: string[]; found: string[]; milestone: string; tasks: { title: string; steps: string[]; variants: { label: string; steps: string[] }[] }[]
  channels: { id: string; text: string }[]; doneWhen: string[]; decision: string | null
} {
  const b = stepView(t, r, step)
  const card = (c: { heading: string; upn?: string | null; title: string; detail?: string; instruction?: string }): string =>
    [c.heading, c.upn ?? '', c.title, c.detail ?? '', c.instruction ?? ''].filter((x) => String(x).trim()).join(' · ')
  const tiles = [...(b.readiness?.tiles ?? []), ...(b.readiness?.satisfied ?? [])]
  const out = {
    title: b.title,
    eyebrow: b.eyebrow ?? null,
    lane: b.laneView?.lane ?? 'Unknown',
    badge: badgeLabel(b.contract),
    fact: b.contract.state.fact ?? null,
    why: String((b.cs as { why?: unknown })?.why ?? ''),
    cards: tiles.map((tile) => card({ heading: tile.label, title: tile.value, detail: tile.note ?? '' })),
    // "What IAMAI found" — the step's findings section. `cards` above is the
    // READINESS tiles only, so for three rounds this harness showed every
    // persona half of each step and the whole findings section was invisible to
    // them: the coverage lines, the shortfall, the "not as asked" comparison and
    // the wider-than-its-name disclosure were all unread. A persona cannot
    // report a sentence it was never shown, which made every round's reading of
    // comprehension softer than it looked.
    found: b.contract.found.map((f: { label: string; text: string }) => `${f.label} · ${f.text}`),
    milestone: b.rail.headline,
    // A task's VARIANTS are part of it. A task can end 'continue with the
    // steps below to register a replacement' and carry those steps in three
    // variant procedures, which the page draws and this used to drop - so a
    // reader of this harness saw an instruction pointing at nothing and filed
    // it as a defect. Read the whole task.
    tasks: (b.emergencyAccountTasks?.tasks ?? []).map((task) => ({
      title: task.title,
      steps: [...task.steps],
      variants: ((task as { variants?: { label: string; steps: string[] }[] }).variants ?? []).map((v) => ({ label: v.label, steps: [...v.steps] })),
    })),
    channels: b.artifacts.map((a) => { let text = ''; try { text = a.text() } catch (e) { text = `RENDER ERROR: ${String(e)}` } return { id: a.id, text } }),
    doneWhen: [...b.contract.doneWhen],
    decision: b.decides ? 'this step asks the person to decide' : null,
  }
  Object.defineProperty(out, 'state', {
    enumerable: false,
    get: () => { throw new Error('render().state is gone: it was contract.state.word / stage, which no surface draws as the step\'s state. Read render().badge (the badge the head draws) and render().fact (the chip beside it).') },
  })
  return out
}

/** The person saves an answer on a step. Direction steps expand into the decisions their answers have always been saved as. */
export function decide(t: Tenant, stepId: string, input: StepDecisionInput, at = '2026-09-01T09:00:00.000Z'): Tenant {
  const next = structuredClone(t) as Tenant
  // A custody answer about the previous emergency accounts cannot vouch for a
  // new set, so saving a different set clears it in the stored record — the one
  // write a decision makes to the mapping (planData.ts onDecide).
  if (stepId === BREAK_GLASS_STEP_ID && input.picked) {
    const same = [...input.picked].sort().join('|') === [...mappingOf(t).breakGlassUserIds].sort().join('|')
    if (!same) next.mapping = { ...next.mapping, breakGlassAnswers: { ...(next.mapping.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }), credentialStorage: null }, breakGlassCustodyBasis: {} }
  }
  // Save it the way the product saves it: the decision is stored under the step
  // the person was on, and `expandDirectionDecisions` is the ONE door that turns
  // a Direction approval into the decisions its answers have always been stored
  // as. An earlier version of this harness expanded first and stored the
  // expansion too, so applying re-expanded it and picked ids were lost — which
  // looked exactly like a product defect. It was not.
  //
  // It is NOT applied to `t.mapping`. The product keeps the stored record and
  // the saved decisions apart and applies them, over the detected defaults, on
  // every derivation (`mappingOf`). This used to write
  // `applyStepDecisions(t.mapping, decisions)` back into `t.mapping`, so each
  // save re-applied every earlier decision over a record that already held
  // them — and `applyStepDecisions` reads the record it is given (a device
  // restriction is kept only while the stored answer matches), so the result
  // was not what the product derives.
  next.decisions = { ...(next.decisions ?? {}), [stepId]: { ...input, at } }
  return next
}

/**
 * A Direction step's answers, in the shape Approve saves them — with the basis
 * each answer was given against, which Approve saves beside it
 * (DirectionQuestions.tsx approve()).
 */
export const answers = (values: Record<string, DirectionAnswer>, basis: Record<string, string> = {}): StepDecisionInput => directionDecisionOf(values, basis)

/**
 * The person goes to Entra and builds what the step told them to, then comes
 * back and scans again.
 *
 * `fidelity` is how well they did it, because that is the thing worth testing:
 *  - 'exact'      they followed it precisely.
 *  - 'enforced'   they created it ON instead of in report-only (the impatient admin).
 *  - 'unconfigured' they left a narrowing condition's Configure toggle at No,
 *                 so the policy reaches everything that condition was to narrow.
 *
 * The policy body is the step's own intended operation, so this is IAMAI's
 * output fed back as the next scan's input — with the mistake applied on top.
 *
 * `held` is the person who also runs what the step declares and withholds
 * today — the switch a readiness threshold or an unverified escape hatch holds.
 * Without it only what the step offers is applied, which is what following the
 * plan means; but a journey that turns "everything on" with the offered
 * operations alone never applies a held switch, and never reaches the states
 * that follow it. The 2026-09-22 review of fix/patch found a step the earlier
 * sweep called unreachable exactly there.
 */
export function deploy(t: Tenant, step: Step, fidelity: 'exact' | 'enforced' | 'unconfigured' = 'exact', opts: { held?: boolean } = {}): Tenant {
  const next = structuredClone(t) as Tenant
  const ops = opts.held ? (step.action.resolution?.policies ?? []) : stepOperations(step)
  const rows = (next.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]
  for (const op of ops) {
    const body = structuredClone(op.body) as Record<string, unknown>
    // An UPDATE patches the policy it names — turning it on is the commonest
    // one — so it is applied to that row. Treating it as a create (its body is a
    // patch, with no displayName) pushed a second, nameless policy and the step
    // read as though nothing had happened.
    //
    // The row is the operation's own `policyId`, and the patch merges the way
    // Graph merges it: a `conditions` section the patch carries replaces that
    // section, and one it leaves out stays (generate.ts withPatch). This used to
    // apply every update of a pair to the step's first tracked row, and to
    // replace `conditions` whole, so an applications-only correction dropped the
    // policy's users — and the exclusions group with them, which then failed the
    // consistency check for every other step.
    if ((op as { mode?: string }).mode === 'update') {
      const at2 = rows.findIndex((row) => String(row.id) === String((op as { policyId?: unknown }).policyId))
      if (at2 < 0) continue
      const current = rows[at2]
      const conditions = body.conditions && current.conditions ? { ...(current.conditions as object), ...(body.conditions as object) } : (body.conditions ?? current.conditions)
      rows[at2] = { ...current, ...body, ...(conditions !== undefined ? { conditions } : {}), ...(fidelity === 'enforced' ? { state: 'enabled' } : {}), modifiedDateTime: t.snapshot.asOf }
      continue
    }
    if (fidelity === 'enforced') body.state = 'enabled'
    if (fidelity === 'unconfigured') {
      const c = (body.conditions ?? {}) as Record<string, unknown>
      delete c.locations
      delete c.platforms
      delete c.devices
      body.conditions = c
    }
    // A policy Entra created: a GUID and the two timestamps every real row has.
    // Without them the row is not the shape the readers expect and the goal
    // never recognises the policy the person just built.
    const seed = `${step.id}:${String(body.displayName ?? '')}`
    let h = 2166136261
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0')
    const id = String(body.id ?? `${hex(h)}-${hex(h * 3).slice(0, 4)}-4${hex(h * 5).slice(0, 3)}-a${hex(h * 7).slice(0, 3)}-${hex(h * 11)}${hex(h * 13).slice(0, 4)}`)
    const now = t.snapshot.asOf
    const at = rows.findIndex((row) => String(row.id) === id || String(row.displayName) === String(body.displayName))
    const row = { ...body, id, createdDateTime: now, modifiedDateTime: now }
    if (at >= 0) rows[at] = row
    else rows.push(row)
  }
  next.snapshot.config.caPolicies = { ...(next.snapshot.config.caPolicies ?? { status: 'ok', reason: null }), rows } as never
  return next
}

/**
 * The next scan: the same tenant, read again, CARRYING what the last scan saw.
 *
 * `prior` is the record the previous run produced (`observations(run)`). Pass it,
 * always, except on the first scan of a tenant: a rescan without it is another
 * first scan, and the product then cannot tell a policy it watched go live from
 * one that was live before it ever looked. The five persona runs of 2026-09-20
 * were all made without it, which is why nothing they reported about drift,
 * continuity or an unobserved window can be trusted.
 *
 * `now` moves the clock: a scan a week later is how a report-only window passes.
 */
export const rescan = (t: Tenant, prior: Record<string, StepObservationRecord> | null = null, now: string | null = null): FixtureRun =>
  shown(runFixture(derived(t), {}, prior, now))

/**
 * The person goes and prepares emergency access: registers an approved recovery
 * key on each selected emergency account, in a storage type and with the
 * attestation the current and planned settings accept.
 *
 * This is one action a person takes in Entra, and it is the action Establish
 * Emergency Access asks for. It matters more than any other in this harness:
 * emergency access is the plan's one large gate, and on nine of the ten shipped
 * fixtures it is unfinished, so NOTHING downstream of it can ever complete.
 * Every persona run made before 2026-09-20 stopped somewhere behind this gate
 * without being able to clear it, which is not the product refusing them — it is
 * the harness having no way to do the thing the product asked for.
 *
 * The evidence written here is the shape `demo-week2` ships, which is the one
 * fixture whose emergency access is complete: a registered key with an approved
 * model, a device-bound credential, and an attestation the scan read.
 */
export function prepareEmergencyAccess(t: Tenant): Tenant {
  const next = structuredClone(t) as Tenant
  // A HARDWARE key, deliberately. `requiredModels` is ordered Authenticator
  // first, and the first entry is a phone credential: a break-glass account must
  // not depend on one person's phone, which is the owner's own rule (R7) and the
  // reason Establish Emergency Access keeps the security key. Taking
  // requiredModels[0] here registered a Microsoft Authenticator passkey and
  // called it device-bound, and the product correctly refused it.
  // The emergency accounts and approved models the plan reads: the applied
  // mapping, where a saved emergency-access decision lands.
  const mapping = mappingOf(next)
  const models = requiredModels(mapping)
  const model = models.find((m) => /yubikey|security key/i.test(m.name)) ?? models[models.length - 1]
  for (const [i, id] of mapping.breakGlassUserIds.entries()) {
    const existing = Array.isArray(next.snapshot.authMethods[id]) ? next.snapshot.authMethods[id] : []
    const others = (existing as { kind: string }[]).filter((m) => m.kind !== 'fido2' && m.kind !== 'passkey')
    next.snapshot.authMethods[id] = [
      ...others,
      { kind: 'fido2', id: `emergency-passkey-${i + 1}`, aaGuid: model.aaguid, passkeyType: 'deviceBound', attestationLevel: 'attested' },
    ] as never
    const at = next.snapshot.registrationDetails.find((r) => r.id === id)
    if (at) {
      at.isPasswordlessCapable = true
      at.isMfaCapable = true
      at.isMfaRegistered = true
      if (!at.methodsRegistered.includes('fido2SecurityKey')) at.methodsRegistered = [...at.methodsRegistered, 'fido2SecurityKey']
    }
  }
  return next
}

/**
 * The person runs the emergency-access recovery test, which is the Cleanup row
 * "Verify Emergency Access": each emergency account signs in with the key
 * `prepareEmergencyAccess` registered, and the next scan records that sign-in as
 * the test passing. The record written is the one the fixtures build for the
 * demo's week two (fixtures/run.ts `withRecoveryTested`): the observed passkey
 * sign-in on each account, after the configuration it covers was read.
 *
 * Without it the harness could not finish the drill, and the dependency graph
 * puts the drill before every Conditional Access policy's ENFORCEMENT. So on
 * every tenant but the demo's week two, every policy that reached "ready to
 * enforce" stayed there: its turn-on is withheld while the drill is undone
 * (`Action.enforceWaitsOn`), `deploy(…, 'enforced')` had nothing to submit, and
 * nothing in a persona run could ever be enforced.
 *
 * Run it after `settleFoundations` (the key and the passkey settings are what the
 * test covers; without them the product correctly refuses the sign-in as a
 * test). A change to what the test covers afterwards — the accounts, their
 * keys, a policy that reaches them — makes the record stale, and the product
 * asks for the test again; run this again after such a change.
 */
export function recordDrill(t: Tenant): Tenant {
  const next = structuredClone(t) as Tenant
  const mapping = mappingOf(next)
  const at = next.snapshot.asOf
  for (const [i, id] of mapping.breakGlassUserIds.entries()) {
    const held = next.snapshot.signInEvidence[id] ?? { signInCount: 1, lastSignIn: at, lastMfaSuccess: { at, method: 'Passkey (FIDO2)' } }
    // The key prepareEmergencyAccess registered on this account.
    next.snapshot.signInEvidence[id] = { ...held, recoveryCandidates: [{ ...recoveryCandidate(id, at, next.snapshot.tenantId, `harness-recovery-${i + 1}`), credentialId: `emergency-passkey-${i + 1}` }] }
  }
  // The record is taken against the applied mapping, which is where the
  // emergency accounts the plan reads are.
  return { ...next, checkpoints: withRecoveryTested({ ...next, mapping }).checkpoints }
}

/**
 * The person configures passkey authentication as Configure Passkey
 * Authentication asks: the tenant's Fido2 method configuration becomes the
 * target IAMAI resolved for it. This is the step's own intended object, read
 * from the product's own resolver, so nothing here invents a configuration.
 *
 * Without it the third foundation step never finishes, and the foundation gate
 * holds every policy in the plan forever. That, and not a product defect, is
 * where the 2026-09-20 persona runs stopped.
 */
export function configurePasskeys(t: Tenant): Tenant {
  const next = structuredClone(t) as Tenant
  const reading = passkeyReadingOf(next.snapshot, mappingOf(next))
  if (reading.resolution?.kind !== 'target') return next
  // The step withholds the key restrictions while they would lock anyone out,
  // and Prepare affected passkeys asks for an approved passkey on each such
  // account first; the person does that before applying them (net-new 4: the
  // step is never Completed while an account the allow list locks out remains).
  const models = requiredModels(mappingOf(next))
  for (const [i, id] of passkeyRestrictionReading(next.snapshot, mappingOf(next), next.groups).lockedOut.entries()) {
    const existing = Array.isArray(next.snapshot.authMethods[id]) ? next.snapshot.authMethods[id] : []
    next.snapshot.authMethods[id] = [...existing, { kind: 'fido2', id: `approved-passkey-${i + 1}`, aaGuid: models[0].aaguid, passkeyType: 'deviceBound', attestationLevel: 'attested' }] as never
  }
  const section = next.snapshot.config.authMethodsPolicy
  const rows = (section?.rows ?? []) as Record<string, unknown>[]
  const row = (rows[0] ?? {}) as Record<string, unknown>
  const configs = Array.isArray(row.authenticationMethodConfigurations) ? [...(row.authenticationMethodConfigurations as Record<string, unknown>[])] : []
  const at = configs.findIndex((c) => String(c.id ?? '').toLowerCase() === 'fido2')
  const target = { ...structuredClone(reading.resolution.target), id: 'Fido2' } as Record<string, unknown>
  if (at >= 0) configs[at] = target
  else configs.push(target)
  next.snapshot.config.authMethodsPolicy = { ...(section ?? { status: 'ok', reason: null }), rows: [{ ...row, authenticationMethodConfigurations: configs }, ...rows.slice(1)] } as never
  return next
}

/**
 * Everything the plan's foundation asks for, done: emergency accounts prepared
 * and passkey authentication configured. The exclusions group is a decision the
 * operator saves, so a fixture that has not answered it still needs `decide()`.
 */
export const settleFoundations = (t: Tenant): Tenant => configurePasskeys(prepareEmergencyAccess(t))

/**
 * The person works through Define Your Rollout Scope and presses Approve
 * answers on each of the three steps without changing a tile.
 *
 * What that saves is what the screen's draft starts from: every question's
 * SAVED answer where it has one, else its suggestion (DirectionQuestions.tsx,
 * `q.saved ?? q.suggested`), with the basis each answer was given against. This
 * used to save `q.suggested` for every question, whatever was saved — which the
 * screen never does: a saved "everyone works remotely, one country" became the
 * suggested office network and two countries.
 *
 * A persona who would answer differently calls `decide()` for that question
 * instead — this is the baseline everyone else starts from.
 *
 * A step whose draft is not complete is left unanswered, as the screen leaves
 * it: Approve is disabled while a question that takes a list has none
 * (`directionAnswerComplete`). This saved it anyway, so a countries question
 * with no suggested country was approved as "no countries" here, where on
 * the screen nobody could press the button.
 */
export function acceptDirection(t: Tenant, r: FixtureRun): Tenant {
  let next = t
  for (const step of r.steps) {
    const questions = step.directionQuestions ?? []
    if (questions.length === 0) continue
    const values: Record<string, DirectionAnswer> = {}
    for (const q of questions) {
      const draft = directionDraftOf(q)
      values[q.key] = { value: draft.value, picked: [...draft.picked] }
    }
    if (!questions.every((q) => directionAnswerComplete(q, values[q.key]))) continue
    const basis = Object.fromEntries(questions.filter((q) => q.basis !== null).map((q) => [q.key, q.basis as string]))
    next = decide(next, step.id, answers(values, basis))
  }
  return next
}

/** The foundation and the three Direction steps' answers: everything the plan waits on before any policy may be written. */
export function settleAll(t: Tenant): Tenant {
  const settled = settleFoundations(t)
  return acceptDirection(settled, plan(settled))
}

/**
 * Days pass, and the tenant goes on being used.
 *
 * Moving `asOf` alone is not time passing: the scan's own collected window stays
 * where it was, so IAMAI correctly reports that it has not read across the days
 * being claimed. This moves the clock AND the collection, and lets the people a
 * report-only policy covers sign in while it watches — which is the whole of the
 * observation window, and the thing a policy cannot become ready to enforce
 * without.
 *
 * `failures` seeds sign-ins the policy WOULD have stopped, which is the answer
 * the window exists to find: a window with failures in it must not open the gate.
 */
export function days(t: Tenant, n: number, opts: { signIns?: boolean; failures?: number } = {}): Tenant {
  const next = structuredClone(t) as Tenant
  const from = Date.parse(next.snapshot.asOf)
  const at = new Date(from + n * 864e5).toISOString()
  next.snapshot.asOf = at
  // The scan read up to now. Without this the collection still ends where it did
  // and `windowCollected` says so, which is correct and is not what we are testing.
  const src = next.snapshot.sources.signInEvidence
  if (src && src.coveredWindow) src.coveredWindow = { from: src.coveredWindow.from, to: at }
  if (src) src.asOf = at
  if (opts.signIns === false) return next
  // Everyone a report-only policy covers signs in at least once during the days
  // it watches. The records are the policy's own, in report-only, dated inside
  // the window — the shape roadmap/tracking.ts reads them in.
  const rows = (next.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]
  const reportOnly = rows.filter((p) => String(p.state) === 'enabledForReportingButNotEnforced')
  // The engine's own definition of an active person, not a guess: the readiness
  // gate asks that EVERY active person a policy reaches signs in during the
  // window, so a narrower list here leaves the gate correctly unopened and looks
  // like a product defect. Guests are active people too.
  const everyone = activePeople(next)
  const dayOf = (k: number): string => new Date(from + k * 864e5).toISOString().slice(0, 10)
  const results = [...(next.snapshot.evidencePolicyResults ?? [])]
  for (const p of reportOnly) {
    const id = String(p.id)
    const failures = opts.failures ?? 0
    const ok = everyone.slice(failures)
    const bad = everyone.slice(0, failures)
    const at2 = results.findIndex((x) => x.policyId === id)
    const row = {
      policyId: id,
      displayName: typeof p.displayName === 'string' ? p.displayName : null,
      counts: { reportOnlySuccess: ok.length * n, reportOnlyFailure: bad.length * n, reportOnlyInterrupted: 0, enforcedSuccess: 0, enforcedFailure: 0 },
      affectedUserIds: { reportOnlySuccess: ok, reportOnlyFailure: bad, reportOnlyInterrupted: [], enforcedSuccess: [], enforcedFailure: [] },
      reportOnlyDated: {
        signInsByDay: Array.from({ length: n }, (_, k) => ({ day: dayOf(k + 1), signIns: everyone.length })),
        lastSeenByUser: Object.fromEntries(everyone.map((uid) => [uid, dayOf(n)])),
      },
      firstReportOnlyAt: typeof p.createdDateTime === 'string' ? p.createdDateTime : t.snapshot.asOf,
    } as never
    if (at2 >= 0) results[at2] = row
    else results.push(row)
  }
  next.snapshot.evidencePolicyResults = results
  return next
}

/**
 * The team registers a method: what Prepare Your Team for MFA asks for, and the
 * ONE action that moves the MFA readiness gate every policy with a method
 * requirement waits on.
 *
 * Everybody active who holds no method this tenant allows registers the one a
 * person it already reads as ready holds — copied from that person, so nothing
 * here invents a method the product would not accept. "Allows" is the product's
 * own reading (roadmap/methodAvailability.ts, the one methodReadiness.ts uses):
 *  - a person the scan could not read, or with nothing registered, gets the
 *    donor's methods;
 *  - a person whose every registered method the tenant has turned off (a phone
 *    number where text and voice are disabled) ADDS the donor's methods beside
 *    their own, which is what the campaign's "Text or call only: register the
 *    new method and test it first" asks.
 * A person holding a method whose availability the product cannot read is left
 * alone: the harness does not know more than the scan does.
 *
 * It used to skip anyone with any method at all, so on a tenant with text and
 * voice disabled the people holding only a phone number never enrolled, and
 * the readiness gate stopped short of its threshold however often it ran.
 * Before that it set the flags and left `methodsRegistered` empty, which the
 * product reads as 'no'.
 *
 * The donor is never an emergency account: its hardware key is not what the
 * team registers.
 */
export function enrolMfa(t: Tenant): Tenant {
  const next = structuredClone(t) as Tenant
  const s = next.snapshot
  const mapping = mappingOf(next)
  const available = methodAvailability(s)
  const registration = new Map(s.registrationDetails.map((r) => [r.id, r]))
  const verdicts = (id: string): ('yes' | 'no' | 'unknown')[] => (registration.get(id)?.methodsRegistered ?? []).map((m) => available.usable(id, m))
  const active = new Set(activePeople(next))
  const emergency = new Set(mapping.breakGlassUserIds.map((id) => id.toLowerCase()))
  const donor = [...active].find((id) => {
    if (emergency.has(id.toLowerCase())) return false
    const m = s.authMethods[id]
    const v = verdicts(id)
    return Array.isArray(m) && m.length > 0 && v.length > 0 && v.every((x) => x === 'yes')
  })
  if (donor === undefined) return next
  const donorMethods = s.authMethods[donor] as unknown[]
  const donorRow = registration.get(donor)!
  for (const id of active) {
    const m = s.authMethods[id]
    const v = verdicts(id)
    const nothing = !Array.isArray(m) || m.length === 0
    const turnedOff = !nothing && v.length > 0 && v.every((x) => x === 'no')
    if (!nothing && !turnedOff) continue
    s.authMethods[id] = (turnedOff ? [...(m as unknown[]), ...structuredClone(donorMethods)] : structuredClone(donorMethods)) as never
    const at = registration.get(id)
    if (at) {
      at.isMfaCapable = true
      at.isMfaRegistered = true
      at.methodsRegistered = turnedOff ? [...new Set([...at.methodsRegistered, ...donorRow.methodsRegistered])] : [...donorRow.methodsRegistered]
      at.isPasswordlessCapable = donorRow.isPasswordlessCapable
      at.defaultMfaMethod = donorRow.defaultMfaMethod
      at.userPreferredMethodForSecondaryAuthentication = donorRow.userPreferredMethodForSecondaryAuthentication
    }
  }
  return next
}
