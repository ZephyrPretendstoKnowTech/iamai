// The persona harness. NOT part of the product: this directory is gitignored
// and nothing here ships. It exists so five simulated administrators can each
// use IAMAI end to end — read a tenant, answer its questions, follow its
// instructions, come back and scan again — and so what they saw can be quoted
// exactly rather than remembered.
//
// Everything here drives the SAME producers the screen drives. No text is
// invented: `render()` returns what `ContentStep.tsx` would draw, because it
// reads the same `stepBodyOf`.
//
//   import { plan, render, lanes, decide, deploy, tenant } from './harness.ts'
import { fixture } from '../../../../src/roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../../src/roadmap/fixtures/run.ts'
import type { FixtureRun } from '../../../../src/roadmap/fixtures/run.ts'
import { stepBodyOf } from '../../../../src/ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../../../../src/ui/surfaces/stepVars.ts'
import { applyStepDecisions } from '../../../../src/roadmap/decisions.ts'
import type { StepDecisionInput } from '../../../../src/roadmap/decisions.ts'
import { directionDecisionOf } from '../../../../src/roadmap/directionAnswers.ts'
import type { DirectionAnswer } from '../../../../src/roadmap/directionAnswers.ts'
import { laneReadings } from '../../../../src/ui/surfaces/planLanes.ts'
import { asideGroupsFor, groupsFor, laneViewOf, LANES, prerequisiteLabelFor, readinessBlockersOf, workTypeOf } from '../../../../src/ui/surfaces/planBoard.ts'
import type { BoardItem } from '../../../../src/ui/surfaces/planBoard.ts'
import { stepOperations } from '../../../../src/ui/surfaces/stepJson.ts'
import { passkeyReadingOf, requiredModels } from '../../../../src/roadmap/passkeySettings.ts'
import { observationsOf } from '../../../../src/roadmap/tracking.ts'
import { activePeopleIds } from '../../../../src/derive/population.ts'
import type { StepObservationRecord } from '../../../../src/roadmap/observation.ts'
import type { Step } from '../../../../src/roadmap/types.ts'

export type Tenant = Fixture

/** A persona's tenant: a shipped fixture as the starting shape, then whatever this persona's situation changes. */
export function tenant(base: FixtureName, mutate: (t: Tenant) => void = () => {}): Tenant {
  const t = structuredClone(fixture(base)) as Tenant
  mutate(t)
  return t
}

/**
 * The person's FIRST scan of this tenant. Nothing was watched before it, so it
 * carries no prior record: everything it sees, it sees for the first time.
 */
export const plan = (t: Tenant): FixtureRun => runFixture(t)

/**
 * What the plan recorded about the tenant's policies, to hand to the next scan.
 * Without it every scan is a first scan, and IAMAI cannot tell a policy it
 * watched appear from one it found already there — which is the difference
 * between "you enforced this without a window" and "this was here before I was".
 */
export const observations = (r: FixtureRun, prior: Record<string, StepObservationRecord> | null = null): Record<string, StepObservationRecord> =>
  observationsOf(r.steps, prior)

/** The context the opened step is rendered with — the same one Plan.tsx builds. */
export function ctxOf(t: Tenant, r: FixtureRun, step: Step): StepVarContext {
  return {
    snapshot: t.snapshot, mapping: t.mapping,
    nameOf: (id: string) => r.input.names?.label(id) ?? id,
    signature: 'IT', operatorId: t.operatorId, now: t.snapshot.asOf, groups: t.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
}

/**
 * Every step in the order the board shows it, with the lane word a person reads.
 *
 * It used to say that and return `r.steps` in plan order, which is not the
 * order anything renders: the board draws three tabs, and inside each the rows
 * come out in their group's registry order (planBoard.ts groupsFor). A persona
 * reading this saw a step above its own prerequisite and filed it, and on the
 * board the two are in different tabs with the prerequisite first. So this
 * builds the board's rows and walks them tab by tab, group by group, exactly as
 * the page does, and names the tab and the group it found each row under.
 */
export function lanes(t: Tenant, r: FixtureRun): { step: Step; lane: string; substatus: string | null; tab: string; group: string }[] {
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const byId = new Map(r.steps.map((s) => [s.id, s]))
  const items: BoardItem[] = r.steps.flatMap((step) => {
    const reading = readings.get(step.id)
    if (!reading) return []
    const view = laneViewOf(reading, titleOf)
    return [{ id: step.id, title: step.title, lane: reading.lane, laneLabel: view.label, workType: workTypeOf(step.id, step.kind ?? null), order: reading.order }]
  })
  const out: { step: Step; lane: string; substatus: string | null; tab: string; group: string }[] = []
  const push = (tab: string, groups: ReturnType<typeof groupsFor>): void => {
    for (const group of groups) {
      for (const item of group.items) {
        const step = byId.get(item.id)
        if (!step) continue
        const reading = readings.get(step.id)!
        out.push({ step, lane: reading.lane, substatus: laneViewOf(reading, titleOf).substatus, tab, group: group.label })
      }
    }
  }
  for (const tab of LANES) push(tab, groupsFor(tab, items))
  push('completed', asideGroupsFor(items))
  // Anything the board drew nowhere is still reported, after the rows, so a
  // reading of this is never quietly short of a step.
  const drawn = new Set(out.map((row) => row.step.id))
  for (const step of r.steps) {
    if (drawn.has(step.id)) continue
    const reading = readings.get(step.id)
    const view = reading ? laneViewOf(reading, titleOf) : null
    out.push({ step, lane: view?.lane ?? 'Unknown', substatus: view?.substatus ?? null, tab: 'none', group: 'not on the board' })
  }
  return out
}

/**
 * What a person actually sees on the opened step: every section, in order, and
 * every implementation channel. This is the text the persona reads, so it is
 * the text a comprehension finding must quote.
 */
export function render(t: Tenant, r: FixtureRun, step: Step): {
  title: string; eyebrow: string | null; lane: string; state: string
  why: string; cards: string[]; found: string[]; milestone: string; tasks: { title: string; steps: string[]; variants: { label: string; steps: string[] }[] }[]
  channels: { id: string; text: string }[]; doneWhen: string[]; decision: string | null
} {
  // WITH the lane, the readiness blockers and the prerequisite labels, because
  // Plan.tsx passes all three (Plan.tsx -> ContentStep.tsx). Without them
  // stepBody falls back to `laneViewFor(step)` — the lane engine run over a plan
  // of ONE step — and the contract, the Done-when, the rail and the badge all
  // follow that instead of the board. On a messy tenant that disagreed with the
  // real board for 18 of 38 steps, so this harness was manufacturing exactly the
  // phantom states it exists to catch. Found by the cautious-engineer run.
  const titleOf = (id: string): string | null => r.steps.find((x) => x.id === id)?.title ?? null
  const readings = laneReadings(r.steps)
  const reading = readings.get(step.id)
  const laneView = reading ? laneViewOf(reading, titleOf) : undefined
  const b = stepBodyOf(step, ctxOf(t, r, step), {
    lane: laneView,
    blockers: reading ? readinessBlockersOf(reading, titleOf) : undefined,
    prerequisiteLabel: prerequisiteLabelFor(readings),
  } as never)
  const card = (c: { heading: string; upn?: string | null; title: string; detail?: string; instruction?: string }): string =>
    [c.heading, c.upn ?? '', c.title, c.detail ?? '', c.instruction ?? ''].filter((x) => String(x).trim()).join(' · ')
  const tiles = [...(b.readiness?.tiles ?? []), ...(b.readiness?.satisfied ?? [])]
  return {
    title: b.title,
    eyebrow: b.eyebrow ?? null,
    lane: b.laneView?.lane ?? 'Unknown',
    state: `${b.contract.state.word}${b.contract.state.stage ? ` / ${b.contract.state.stage}` : ''}`,
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
    milestone: `${b.rail.metric}${b.rail.sub ? ` — ${b.rail.sub}` : ''}`,
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
}

/** The person saves an answer on a step. Direction steps expand into the decisions their answers have always been saved as. */
export function decide(t: Tenant, stepId: string, input: StepDecisionInput, at = '2026-09-01T09:00:00.000Z'): Tenant {
  const next = structuredClone(t) as Tenant
  // Save it the way the product saves it: the decision is stored under the step
  // the person was on, and `expandDirectionDecisions` is the ONE door that turns
  // a Direction approval into the decisions its answers have always been stored
  // as. An earlier version of this harness expanded first and stored the
  // expansion too, so applying re-expanded it and picked ids were lost — which
  // looked exactly like a product defect. It was not.
  next.decisions = { ...(next.decisions ?? {}), [stepId]: { ...input, at } }
  // Hand over the RAW saved decisions. `applyStepDecisions` expands Direction
  // approvals itself (decisions.ts:195); expanding here as well applied the
  // step's own record a second time, and that record carries the answer without
  // its picked ids — so the ids were clobbered and a trusted location vanished.
  // That looked like a product defect and was not.
  next.mapping = applyStepDecisions(t.mapping, next.decisions as never)
  return next
}

/** A Direction step's answers, in the shape Approve saves them. */
export const answers = (values: Record<string, DirectionAnswer>): StepDecisionInput => directionDecisionOf(values)

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
 */
export function deploy(t: Tenant, step: Step, fidelity: 'exact' | 'enforced' | 'unconfigured' = 'exact'): Tenant {
  const next = structuredClone(t) as Tenant
  const ops = stepOperations(step)
  const rows = (next.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]
  for (const op of ops) {
    const body = structuredClone(op.body) as Record<string, unknown>
    // An UPDATE patches the policy this member already owns — turning it on is
    // the commonest one — so it is applied to that row. Treating it as a create
    // (its body is a patch, with no displayName) pushed a second, nameless
    // policy and the step read as though nothing had happened.
    if ((op as { mode?: string }).mode === 'update') {
      const owned = (step.tracking?.members ?? []).map((m) => m.policyId).filter((id): id is string => typeof id === 'string')
      const at2 = rows.findIndex((row) => owned.includes(String(row.id)))
      if (at2 >= 0) {
        rows[at2] = { ...rows[at2], ...body, modifiedDateTime: t.snapshot.asOf }
        continue
      }
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
  runFixture(t, {}, prior, now)

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
  const models = requiredModels(next.mapping)
  const model = models.find((m) => /yubikey|security key/i.test(m.name)) ?? models[models.length - 1]
  for (const [i, id] of next.mapping.breakGlassUserIds.entries()) {
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
  const reading = passkeyReadingOf(next.snapshot, next.mapping)
  if (reading.resolution?.kind !== 'target') return next
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
 * The person works through Decide Your Tenant's Direction and takes IAMAI's own
 * recommendation on every question. `suggested` is the product's, read off the
 * step, so nothing is invented here: this is the careful administrator who reads
 * the evidence line, agrees with it, and saves.
 *
 * A persona who would answer differently calls `decide()` for that question
 * instead — this is the baseline everyone else starts from.
 */
export function acceptDirection(t: Tenant, r: FixtureRun): Tenant {
  let next = t
  for (const step of r.steps) {
    const questions = step.directionQuestions ?? []
    if (questions.length === 0) continue
    const values: Record<string, DirectionAnswer> = {}
    for (const q of questions) values[q.key] = { value: q.suggested.value, picked: [...q.suggested.picked] }
    next = decide(next, step.id, answers(values))
  }
  return next
}

/** The foundation and the four Direction answers: everything the plan waits on before any policy may be written. */
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
  const everyone = [...activePeopleIds(next.snapshot)]
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
 * The team registers a method: everyone whose authentication methods the scan
 * could not read gets the same shape as the people it could. This is what
 * Prepare Your Team for MFA asks for, and it is the ONE action that moves the
 * MFA readiness gate every policy with a method requirement waits on.
 *
 * The shape is copied from a person this tenant already reads as ready, so
 * nothing here invents a method the product would not accept.
 */
/**
 * Everybody active registers the method somebody else already has.
 *
 * This set `isMfaCapable` and `isMfaRegistered` and left `methodsRegistered`
 * empty, and the product reads `methodsRegistered` to decide whether a person
 * holds a method a policy would accept (roadmap/methodReadiness.ts: an empty
 * list is answered 'no', whatever the flags say). So the readiness number could
 * not move, however many times this ran — and a persona enrolled everybody,
 * scanned nine times over three weeks, read the identical sentence every time
 * and filed a severity-5 product defect that was this function. The copy now
 * carries the registration row the methods imply.
 */
export function enrolMfa(t: Tenant): Tenant {
  const next = structuredClone(t) as Tenant
  const active = new Set(activePeopleIds(next.snapshot))
  const donor = [...active].map((id) => id).find((id) => {
    const m = next.snapshot.authMethods[id]
    const row = next.snapshot.registrationDetails.find((r) => r.id === id)
    return Array.isArray(m) && m.length > 0 && row !== undefined && row.methodsRegistered.length > 0
  })
  if (donor === undefined) return next
  const readable = next.snapshot.authMethods[donor]
  const donorRow = next.snapshot.registrationDetails.find((r) => r.id === donor)!
  for (const id of active) {
    const m = next.snapshot.authMethods[id]
    if (Array.isArray(m) && m.length > 0) continue
    next.snapshot.authMethods[id] = structuredClone(readable) as never
    const at = next.snapshot.registrationDetails.find((r) => r.id === id)
    if (at) {
      at.isMfaCapable = true
      at.isMfaRegistered = true
      at.methodsRegistered = [...donorRow.methodsRegistered]
      at.isPasswordlessCapable = donorRow.isPasswordlessCapable
      at.defaultMfaMethod = donorRow.defaultMfaMethod
      at.userPreferredMethodForSecondaryAuthentication = donorRow.userPreferredMethodForSecondaryAuthentication
    }
  }
  return next
}
