// Task 036 — every Plan variant, on the one restored grammar.
//
// Tasks 033, 034 and 035 restored the approved Plan pack's row, its attached
// expanded frame and the content anatomy inside it, and proved each against
// `docs/design/approved/anatomy/plan-step-v1.html` (src/ui/surfaces/planAnatomy.test.ts).
// What none of them proved is the sentence this pack exists to make true:
//
//   EVERY step the product can render goes through that grammar, and what
//   differs between two steps is what production MEANS by them, never a second
//   presentation built for one of them.
//
// A test that names five historical cases cannot make that claim. So this file
// starts from a sweep of every fixture — each on its own baseline and on the
// curated one, with the exclusions question unanswered, with a step set aside,
// with a deployed policy edited between two scans, and with none of the
// tenant's own Conditional Access, which is the one reading that brings a goal
// the baseline implements with two policies to the Plan as two members — takes
// the Step Contract for every step of every plan, and reduces each to the shape
// it renders at:
//
//   kind · lifecycle · condition · outcome · action · track · implementation ·
//   found · fix · members · who
//
// That set is the product's real variant inventory, and §1 pins it: a shape
// that disappears is a variant that stopped being reachable, and a shape that
// appears is a variant nothing has proved yet. Both are worth failing on.
//
// Everything after §1 is asserted over every variant in the sweep at once,
// never over a named case. The invariants are the ones a VISUAL migration is
// able to break — an action mode reinterpreted to fit a layout, a lifecycle
// track driven off the condition badge, an implementation offered because the
// template has an action area, a rail block invented to fill a column — and
// each is checked against the authority that owns it (roadmap/operations.ts,
// roadmap/lifecycle.ts) rather than against a second copy of its rules.
//
// What this file does not re-prove, because one authority already owns it: the
// pack's bytes (src/ui/design-authority.test.ts); the row, frame and section
// anatomy against the pack (planAnatomy.test.ts); each canonical case in depth
// (notDeployedImplement, reportOnlyObserve, reportOnlyReview, readyToEnforce,
// inPlacePreserve, needsDecision, baselineConflict via holes/foundations);
// Foundation A/B/C themselves (roadmap/foundation*.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { laneReadings } from './planLanes.ts'
import { BOARD, doesntApplyView, laneViewOf } from './planBoard.ts'
import {
  allCuratedFixtures,
  allFixtures,
  noExclusionsAnswer,
} from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { observationsOf, requiredMembers } from '../../roadmap/tracking.ts'
import { scannedAt } from '../../roadmap/fixtures/records.ts'
import { heldForReview } from '../../roadmap/lifecycle.ts'
import type { Condition, Lifecycle } from '../../roadmap/lifecycle.ts'
import { implementationOffered, isPreserved, operationsOf, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { CONTRACT, railOf, readinessOf, stepContract, stepTrack } from './stepContract.ts'
import { isHeld } from '../../roadmap/holds.ts'
import type { StepContract } from './stepContract.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** One step of one plan, with the contract the Plan renders it from. */
type Variant = { where: string; step: Step; ctx: StepVarContext; c: StepContract; shape: string; kind: string }

/**
 * What KIND of step this is in the presentation's own taxonomy — the
 * `steps[].kind` the content file carries, which is what the opened step's
 * eyebrow names (`pages.app.plan.stepContract.kind`) and what decides whether a
 * step is a policy at all. It is not `Step.kind`, which is the engine's
 * operation (create / adjust / enforce / verify / check / prerequisite); the
 * two answer different questions and this file asserts over both.
 */
const kindOf = (step: Step): string => String((contentStepFor(step) as { kind?: unknown } | undefined)?.kind ?? 'none')

/**
 * The shape a step renders at: every field the opened step branches on, and
 * nothing that varies with the tenant's names or dates. Two steps with the same
 * shape activate the same regions of the same grammar; two with different
 * shapes are the variants this pack had to migrate.
 */
function shapeOf(step: Step, c: StepContract): string {
  return [
    kindOf(step),
    step.kind,
    c.state.lifecycle ?? 'no-lifecycle',
    c.state.condition,
    c.state.setAside ? 'set-aside' : c.state.inPlace ? 'in-place' : c.state.satisfied ? 'satisfied' : 'open',
    `do:${c.whatToDo.kind}`,
    c.track.length > 0 ? 'track' : 'no-track',
    c.implementation.offered ? 'implementation' : 'no-implementation',
    c.found.length > 0 ? 'found' : 'no-found',
    c.fix.length > 0 ? 'fix' : 'no-fix',
    c.multiPolicy ? 'members' : 'one-policy',
    c.who === null ? 'who-none' : c.who.known ? 'who-known' : 'who-unknown',
  ].join(' · ')
}

/** Every step of one plan, with the contract the Plan builds for it. */
function planOf(label: string, f: Fixture, over: { snapshot?: TenantSnapshot; record?: ReturnType<typeof observationsOf> } = {}): Variant[] {
  const r = over.record ? runFixture(f, over.snapshot ? { snapshot: over.snapshot } : {}, over.record) : runFixture(f)
  const snapshot = over.snapshot ?? f.snapshot
  const ctx = (step: Step): StepVarContext => ({
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  })
  // The board's one state reading of every step (A1b), read over the whole plan as the Plan reads it.
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.plainTitle ?? null
  return r.steps.map((step) => {
    const one = ctx(step)
    const reading = readings.get(step.id)
    const c = stepContract(step, one, undefined, reading ? laneViewOf(reading, titleOf) : doesntApplyView())
    return { where: `${label}/${step.id}`, step, ctx: one, c, shape: shapeOf(step, c), kind: kindOf(step) }
  })
}

const DAY = 86_400_000

/**
 * The same tenant three days later with one deployed policy edited by hand,
 * read against what the first scan recorded — the one way a step reaches
 * `review-required`, which no single scan of a fixture can produce.
 *
 * The edit is an exclusion nobody planned, which is what
 * src/ui/surfaces/reportOnlyReview.test.ts proves is a material change. Nothing
 * here writes an observation: the record is the first run's own.
 */
function rescanned(f: Fixture): Variant[] {
  const first = runFixture(f)
  // The first watched policy by step id, not by plan order: the order moves whenever a dependency does.
  const watched = first.steps.filter((s) => s.state.lifecycle === 'report-only' && s.tracking?.policyId).sort((a, b) => a.id.localeCompare(b.id))[0]
  if (!watched) return []
  const target = watched.tracking!.policyId!
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]).map((row) => {
    if (row.id !== target) return row
    const copy = structuredClone(row)
    const users = (copy.conditions as Record<string, Record<string, unknown>>).users
    ;(copy.conditions as Record<string, unknown>).users = { ...users, excludeUsers: [...((users.excludeUsers as string[]) ?? []), f.operatorId] }
    return copy
  })
  const snapshot = scannedAt(
    { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } } } as TenantSnapshot,
    new Date(Date.parse(f.snapshot.asOf) + 3 * DAY).toISOString(),
  )
  return planOf(`${f.name}+rescan`, { ...f, snapshot }, { snapshot, record: observationsOf(first.steps) })
}

/** The fixture's tenant with the Conditional Access policies its scan read replaced by `rows`, `after` ms later. */
function withRows(f: Fixture, rows: Record<string, unknown>[], after = 0): TenantSnapshot | null {
  const ca = f.snapshot.config.caPolicies
  if (!ca) return null
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } } as TenantSnapshot
  return after === 0 ? snapshot : scannedAt(snapshot, new Date(Date.parse(f.snapshot.asOf) + after).toISOString())
}

/** The id the planted half of a pair is read back under, so the second scan sees the same object. */
const PAIRED_POLICY_ID = '0a11a11a-0000-4000-8000-00000000000a'

/**
 * A goal the pinned baseline implements with TWO policies, in the three states
 * the pair can be read in.
 *
 * Every fixture as it stands already delivers `guests-mfa` with a policy of its
 * own, so on all of them that goal is preserved and its pair is never rendered
 * apart — which is why nothing in the sweep reached `multiPolicy` and the
 * members path went unproved by this file. A tenant with no Conditional Access
 * at all is the ordinary greenfield shape, and on it the goal arrives as what
 * the baseline says it is: two required members, each with its own name, stage
 * and history (Foundation B, `roadmap/tracking.ts` `requiredMembers`).
 *
 * The three plans are the three readings of one pair:
 *
 *  - neither half deployed, so both members are at the same stage;
 *  - one half deployed in report-only and the other not built at all, so the
 *    members carry two different stages and two different histories and the
 *    step is neither of them;
 *  - the deployed half edited by hand between two scans, so ONE member is held
 *    for review while the other is not.
 *
 * Nothing here writes an observation: the third run's record is the second
 * run's own, exactly as `rescanned` does it for a single-member step.
 */
function paired(f: Fixture): Variant[] {
  const none = withRows(f, [])
  if (!none) return []
  const empty: Fixture = { ...f, snapshot: none }
  const first = runFixture(empty)
  const pair = first.steps.find((s) => (s.action.resolution?.policies ?? []).length > 1)
  if (!pair) return []
  const out = planOf(`${f.name}+no-ca`, empty)
  const at = (days: number): string => new Date(Date.parse(f.snapshot.asOf) + days * DAY).toISOString()
  const body = structuredClone(pair.action.resolution!.policies[0].body) as Record<string, unknown>
  const half: Record<string, unknown> = { ...body, id: PAIRED_POLICY_ID, state: 'enabledForReportingButNotEnforced', createdDateTime: at(-30), modifiedDateTime: at(-30) }
  const halfSnapshot = withRows(f, [half])
  if (!halfSnapshot) return out
  const halfF: Fixture = { ...f, snapshot: halfSnapshot }
  out.push(...planOf(`${f.name}+half-pair`, halfF))
  // The same hand edit `rescanned` makes, on the planted half: an exclusion
  // nobody planned is a material change, and here it lands on one member of a
  // pair rather than on a step that is only ever one policy.
  const users = ((half.conditions as Record<string, Record<string, unknown>>).users ?? {}) as Record<string, unknown>
  const edited = {
    ...half,
    conditions: { ...(half.conditions as Record<string, unknown>), users: { ...users, excludeUsers: [...((users.excludeUsers as string[]) ?? []), f.operatorId] } },
    modifiedDateTime: at(3),
  }
  const snapshot = withRows(f, [edited], 3 * DAY)
  if (!snapshot) return out
  out.push(...planOf(`${f.name}+half-pair+rescan`, { ...f, snapshot }, { snapshot, record: observationsOf(runFixture(halfF).steps) }))
  return out
}

/** The first step of a plan put aside by the operator, which is how a step leaves the lifecycle. */
function setAside(f: Fixture): Variant[] {
  const first = runFixture(f)
  const target = first.steps.find((s) => s.status !== 'done' && s.status !== 'skipped')
  if (!target) return []
  return planOf(`${f.name}+set-aside`, { ...f, mapping: { ...f.mapping, notApplicable: { [target.id]: 'This tenant does not do this.' } } })
}

/**
 * Every plan the product can build, over every fixture.
 *
 * Each fixture appears on its own baseline and on the curated one, because an
 * unsettled source group holds a whole policy — so the two runs are two
 * different halves of the inventory, not the same one twice. The exclusions
 * question is asked unanswered on every fixture, because that is the state a
 * tenant is in before anybody answers it, and it is the only route to
 * `needs-decision`. A step is put aside on every fixture, and one deployed
 * policy is edited between two scans, because neither state exists in a single
 * scan of anything. And every fixture is read once with no Conditional Access
 * of its own, because that is the only way a goal the baseline implements with
 * two policies reaches the Plan as two members rather than as a goal the tenant
 * already delivers.
 */
let SWEEP: Variant[] | null = null
function sweep(): Variant[] {
  if (SWEEP) return SWEEP
  const out: Variant[] = []
  // `huge` is the 25,000-user fixture, built only under HUGE=1 (prune A). It is
  // excluded either way so the shape inventory below is the same set on every
  // machine rather than one that grows with an environment variable.
  const named = (fs: Fixture[]): Fixture[] => fs.filter((f) => f.name !== 'huge')
  for (const f of named(allFixtures())) {
    out.push(...planOf(f.name, f))
    out.push(...planOf(`${f.name}+unanswered`, noExclusionsAnswer(f)))
    out.push(...setAside(f))
    out.push(...rescanned(f))
    out.push(...paired(f))
  }
  for (const f of named(allCuratedFixtures())) {
    out.push(...planOf(`${f.name}+curated`, f))
    out.push(...planOf(`${f.name}+curated+unanswered`, noExclusionsAnswer(f)))
  }
  SWEEP = out
  return out
}

const shapes = (): Map<string, string> => {
  const out = new Map<string, string>()
  for (const v of sweep()) if (!out.has(v.shape)) out.set(v.shape, v.where)
  return out
}

/** Every variant matching a predicate, with its `where` for the failure message. */
const every = (name: string, ok: (v: Variant) => boolean, why: string): void => {
  const bad = sweep().filter((v) => !ok(v))
  assert.equal(bad.length, 0, `${name}: ${why}\n  ${bad.slice(0, 6).map((v) => `${v.where} — ${v.shape}`).join('\n  ')}`)
}

// ---------------------------------------------------------------- §1 inventory

/**
 * The canonical cases the approved pack draws, named by what production means
 * rather than by the pack's labels: the pack's five variants are one reading of
 * this set, and production has more of them than five.
 */
const CASES: Record<string, (v: Variant) => boolean> = {
  // The pack's V1. A policy the tenant does not have, that IAMAI will hand over.
  'implement': (v) => v.kind === 'policy' && v.c.implementation.offered && v.c.state.lifecycle === 'not-deployed',
  // The pack's V2. Deployed in report-only, watching.
  'observe': (v) => v.c.state.lifecycle === 'report-only',
  // The pack's V3, and the one state a second scan creates.
  'review-required': (v) => v.c.state.condition === 'review-required',
  // The pack's V4. The tenant already delivers the goal with its own policy.
  'preserve-named': (v) => v.c.existing !== null,
  'preserve-unnamed': (v) => v.c.whatToDo.kind === 'preserve' && v.c.existing === null,
  // The pack's V5. The baseline says two things and IAMAI will not choose.
  'baseline-conflict': (v) => v.c.state.condition === 'baseline-conflict',
  // Not in the pack, and real: the question only a person can answer.
  'needs-decision': (v) => v.c.state.condition === 'needs-decision',
  // A prerequisite the tenant has not met, which blocks the policy behind it.
  'blocked': (v) => v.c.state.condition === 'blocked',
  'ready-to-enforce': (v) => v.c.state.lifecycle === 'ready-to-enforce',
  'enforced': (v) => v.c.state.lifecycle === 'enforced',
  // The step the operator took out of the plan.
  'set-aside': (v) => v.c.state.setAside,
  // The supporting kinds, which have no policy lifecycle at all and must not be
  // given one: an object to make, a prerequisite, a check to run, a campaign to
  // run, a hardening rung.
  'supporting-object': (v) => v.kind === 'object',
  'supporting-blocker': (v) => v.kind === 'blocker',
  'supporting-check': (v) => v.kind === 'check',
  'supporting-campaign': (v) => v.kind === 'campaign',
  'supporting-ladder': (v) => v.kind === 'ladder',
  // A goal the pinned baseline implements with TWO policies, which is one step
  // delivering two objects: the pair together, the pair at two different
  // stages, and the pair with one half held for review.
  'multi-policy': (v) => v.c.multiPolicy,
  'multi-policy-split': (v) => v.c.multiPolicy && new Set(v.c.members.map((m) => m.lifecycle)).size > 1,
  'multi-policy-review': (v) => v.c.multiPolicy && v.c.members.some((m) => m.reviewRequired),
  // The sparse end of the grammar. The dense end — findings, a fix list and a
  // rail at once — was a held report-only policy whose rail held the day its
  // window closed. A held step has no next date (roadmap/holds.ts, Step 4), a
  // step with a fix list is waiting on something, and a step waiting on
  // something is not healthy enough for the implementation block: the shape is
  // no longer one the product can render, and its rail was the defect.
  'sparse': (v) => v.c.found.length === 0 && v.c.fix.length === 0 && v.c.milestone.at === null,
}

/**
 * The 34 shapes the product actually renders today, each with one plan and step
 * it was read from. This is the pre-edit variant inventory task 036 migrated,
 * written down rather than described: the sweep above recomputes it from every
 * fixture on every run, and this is what it must still come to.
 *
 * It fails DOWNWARD as a regression — a shape that disappears is a variant that
 * stopped being reachable, so whatever proves it below has quietly stopped
 * proving anything. And it fails UPWARD as a gate — a new shape is a new Plan
 * variant, and it should arrive with a named test for what it means rather than
 * silently inherit a grammar nobody checked it against.
 *
 * The comment after each line is one example, not the only one: most of these
 * are reached by several fixtures.
 */
// The rail dimension left the shape when the approved design (owner update, Sep 10,
// 2026) made the rail the Next milestone on every step: there is no step left that
// draws one and no step that does not, so it no longer tells two shapes apart.
const INVENTORY: string[] = [
  'ladder · prerequisite · no-lifecycle · healthy · in-place · do:preserve · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // micro/s-ladder-security-defaults
  'ladder · prerequisite · no-lifecycle · healthy · open · do:deploy · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // micro/s-ladder-legacy-auth-inventory
  'check · check · no-lifecycle · healthy · open · do:verify · no-track · no-implementation · no-found · no-fix · one-policy · who-known', // micro/s-check-dormant-accounts
  'campaign · verify · no-lifecycle · healthy · open · do:verify · no-track · no-implementation · no-found · no-fix · one-policy · who-known', // micro/s-verify-mfa
  'ladder · prerequisite · no-lifecycle · healthy · set-aside · do:restore · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // micro+set-aside/s-ladder-legacy-auth-inventory
  'blocker · prerequisite · no-lifecycle · healthy · open · do:deploy · no-track · no-implementation · no-found · fix · one-policy · who-none', // small/s-prereq-break-glass
  'blocker · prerequisite · no-lifecycle · healthy · in-place · do:preserve · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // small/s-prereq-exclusion-group
  'object · prerequisite · no-lifecycle · healthy · open · do:deploy · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // small/s-prereq-allowed-countries
  'object · prerequisite · no-lifecycle · healthy · in-place · do:preserve · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // small/s-prereq-trusted-location
  'policy · create · not-deployed · blocked · open · do:deploy · track · implementation · found · fix · one-policy · who-known', // small/s-goal-register-info-protected
  'policy · create · not-deployed · blocked · open · do:resolve · track · implementation · no-found · fix · one-policy · who-known', // small/s-goal-block-auth-transfer
  'policy · create · enforced · healthy · in-place · do:preserve · track · no-implementation · found · no-fix · one-policy · who-known', // small/s-goal-block-legacy-auth
  'policy · create · enforced · healthy · in-place · do:preserve · track · no-implementation · found · no-fix · one-policy · who-none', // small/s-goal-guests-mfa
  'policy · create · not-deployed · blocked · open · do:resolve · track · no-implementation · no-found · fix · one-policy · who-unknown', // small/s-goal-geo-restriction
  'blocker · prerequisite · no-lifecycle · needs-decision · open · do:decide · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // small+unanswered/s-prereq-exclusion-group
  'policy · create · not-deployed · blocked · open · do:resolve · track · no-implementation · found · fix · one-policy · who-unknown', // small+unanswered/s-goal-register-info-protected
  'policy · adjust · enforced · blocked · open · do:resolve · track · no-implementation · no-found · fix · one-policy · who-unknown', // small+unanswered/s-goal-block-legacy-auth
  'policy · adjust · enforced · blocked · open · do:resolve · track · no-implementation · found · fix · one-policy · who-unknown', // small+unanswered/s-goal-mfa-all-users
  'policy · prerequisite · no-lifecycle · healthy · open · do:deploy · no-track · no-implementation · no-found · no-fix · one-policy · who-known', // mid/s-shared-devices
  'blocker · prerequisite · no-lifecycle · healthy · open · do:deploy · no-track · no-implementation · no-found · no-fix · one-policy · who-none', // large/s-blocker-allowed-countries
  'check · check · no-lifecycle · needs-decision · open · do:decide · no-track · no-implementation · no-found · no-fix · one-policy · who-known', // large/s-prereq-device-plan
  'policy · adjust · report-only · blocked · open · do:observe · track · implementation · found · fix · one-policy · who-known', // large/s-goal-require-managed-device (A4: held on a readiness gate, still observing)
  'policy · adjust · report-only · blocked · open · do:observe · track · no-implementation · no-found · fix · one-policy · who-known', // demo-week2/s-goal-intune-enrollment-reauth (A4: the demo's Ready · Observing row)
  'policy · adjust · report-only · blocked · open · do:resolve · track · no-implementation · found · fix · one-policy · who-unknown', // messy/s-goal-admins-phishing-resistant
  'policy · create · enforced · healthy · satisfied · do:preserve · track · no-implementation · found · no-fix · one-policy · who-known', // midflight/s-goal-block-legacy-auth
  'policy · create · no-lifecycle · baseline-conflict · open · do:resolve · no-track · no-implementation · no-found · no-fix · one-policy · who-unknown', // demo/s-goal-admin-portals-protected
  'policy · adjust · not-deployed · blocked · open · do:resolve · track · no-implementation · found · fix · one-policy · who-unknown', // demo/s-goal-guests-mfa
  'policy · create · not-deployed · blocked · open · do:deploy · track · implementation · no-found · fix · one-policy · who-known', // demo/s-goal-intune-enrollment-reauth
  'policy · create · not-deployed · blocked · open · do:deploy · track · implementation · found · fix · members · who-unknown', // demo+no-ca/s-goal-guests-mfa
  'policy · adjust · not-deployed · blocked · open · do:resolve · track · no-implementation · found · fix · members · who-unknown', // demo+half-pair/s-goal-guests-mfa
  'policy · adjust · report-only · blocked · open · do:resolve · track · no-implementation · no-found · fix · one-policy · who-unknown', // demo-week2+unanswered/s-goal-block-auth-transfer
  'check · check · no-lifecycle · healthy · set-aside · do:restore · no-track · no-implementation · no-found · no-fix · one-policy · who-known', // demo-week2+set-aside/s-check-dormant-accounts
  'policy · adjust · report-only · review-required · open · do:resolve · track · no-implementation · found · fix · one-policy · who-unknown', // demo-week2+rescan/s-goal-block-auth-transfer
  'policy · create · not-deployed · blocked · open · do:deploy · track · implementation · found · no-fix · members · who-unknown', // demo-week2+no-ca/s-goal-guests-mfa
  'policy · adjust · not-deployed · blocked · open · do:resolve · track · no-implementation · found · no-fix · members · who-unknown', // demo-week2+half-pair/s-goal-guests-mfa
  'policy · adjust · enforced · blocked · open · do:resolve · track · implementation · no-found · fix · one-policy · who-known', // demo+curated/s-goal-block-legacy-auth
  'policy · adjust · enforced · blocked · open · do:resolve · track · no-implementation · found · fix · one-policy · who-known', // demo+curated/s-goal-mfa-all-users
  'policy · adjust · report-only · healthy · open · do:observe · track · no-implementation · no-found · no-fix · one-policy · who-known', // demo-week2+curated/s-goal-block-auth-transfer
  'policy · create · not-deployed · healthy · open · do:deploy · track · implementation · no-found · no-fix · one-policy · who-known', // demo-week2+curated/s-goal-admin-session
  'policy · create · not-deployed · blocked · open · do:deploy · track · implementation · found · no-fix · one-policy · who-known', // demo-week2+curated/s-goal-device-registration-mfa
  'policy · adjust · ready-to-enforce · healthy · open · do:enforce · track · implementation · no-found · no-fix · one-policy · who-known', // demo-week2+curated/s-goal-token-protection
  'policy · adjust · report-only · healthy · open · do:resolve · track · no-implementation · no-found · fix · one-policy · who-unknown', // demo-week2/s-goal-block-auth-transfer (waits on the source-references answer, named under Fix)
  'policy · create · not-deployed · healthy · open · do:resolve · track · no-implementation · no-found · fix · one-policy · who-unknown', // demo-week2/s-goal-admin-session
]

test('§1 the sweep reaches every canonical Plan case, and renders the inventory that was migrated', () => {
  const all = sweep()
  assert.ok(all.length > 500, `the sweep collapsed to ${all.length} steps`)
  const missing = Object.entries(CASES)
    .filter(([, ok]) => !all.some(ok))
    .map(([name]) => name)
  assert.deepEqual(missing, [], 'a canonical Plan case is no longer reachable, so nothing below proves it')
  const found = shapes()
  assert.deepEqual(
    [...found.keys()].sort(),
    [...INVENTORY].sort(),
    ['the renderable Plan variant inventory changed. What it renders now:', ...[...found].map(([sh, w]) => `  '${sh}', // ${w}`)].join('\n'),
  )
})

// ------------------------------------------------- §2 lifecycle vs condition

test('§2 the lifecycle track is a projection of the lifecycle alone, and the condition never moves it', () => {
  const CONDITIONS: Condition[] = ['healthy', 'review-required', 'blocked', 'needs-decision', 'baseline-conflict']
  for (const v of sweep()) {
    // Where the track is drawn is where Foundation B says the step is, and the
    // stages behind it are reached because the ORDER is past them.
    const current = v.c.track.filter((s) => s.current)
    if (v.c.track.length > 0) {
      assert.equal(current.length, 1, `${v.where}: the track marks ${current.length} current stages`)
      assert.equal(current[0].key, v.c.state.lifecycle, `${v.where}: the marked stage is not the step's lifecycle`)
    }
    // And it is drawn wherever a lifecycle is recorded, except where there is no
    // rollout to draw: a set-aside step has left the lifecycle, and a step whose
    // source contradicts itself is a resolution step with no policy to roll out
    // (the approved pack's V5 draws no track).
    const expected = v.c.state.lifecycle !== null && !v.c.state.setAside && v.c.state.condition !== 'baseline-conflict'
    assert.equal(v.c.track.length > 0, expected, `${v.where}: the track is drawn where there is no rollout to draw, or missing where there is`)
    // The orthogonality, proved by construction rather than by inspection: the
    // same step at each of the four ordinary conditions draws the same track, and
    // the resolution condition draws none rather than a different one.
    const drawn = JSON.stringify(v.c.track)
    for (const condition of CONDITIONS) {
      const swapped = { ...v.step, state: { ...v.step.state, condition } } as Step
      if (condition === 'baseline-conflict') {
        assert.deepEqual(stepTrack(swapped), [], `${v.where}: a resolution step draws a lifecycle`)
        continue
      }
      if (v.c.state.condition === 'baseline-conflict') continue
      assert.equal(JSON.stringify(stepTrack(swapped)), drawn, `${v.where}: the track changes with the condition badge (${condition})`)
    }
  }
})

test('§2b the condition is the step’s own and is never read off the lifecycle segment', () => {
  const LIFECYCLES: (Lifecycle | null)[] = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced', null]
  for (const v of sweep().slice(0, 400)) {
    for (const lifecycle of LIFECYCLES) {
      const swapped = { ...v.step, state: { ...v.step.state, lifecycle } } as Step
      assert.equal(
        stepContract(swapped, v.ctx).state.condition,
        v.c.state.condition,
        `${v.where}: the condition moved when only the lifecycle was changed (${lifecycle})`,
      )
    }
  }
})

// ------------------------------------------------------------ §3 action modes

test('§3 every step’s action mode is the authorities’ own answer, never the layout’s', () => {
  for (const v of sweep()) {
    const step = v.step
    // The precedence roadmap/operations.ts and Foundation B settle, restated
    // here as the one thing a visual migration must not reorder. A step whose
    // policy cannot be written is `resolve` even when its status has run ahead;
    // a goal already delivered is `preserve` and never `deploy`; a question
    // waiting on a person is `decide` and never an instruction.
    const expected =
      step.state.setAside ? 'restore'
        : unavailableReason(step) !== null ? 'resolve'
          : isPreserved(step) ? 'preserve'
            : step.state.satisfied ? 'preserve'
              : step.state.condition === 'needs-decision' ? 'decide'
                : null
    if (expected !== null) assert.equal(v.c.whatToDo.kind, expected, `${v.where}: the action mode was reinterpreted`)
    // And every step has exactly one action with words in it. A step that opens
    // to a frame with no next action is the defect Foundation D exists to stop.
    assert.ok(v.c.whatToDo.text.trim().length > 0, `${v.where}: the step has no next action`)
    assert.ok(v.c.doneWhen.length > 0, `${v.where}: the step has no completion`)
    assert.ok(v.c.why.trim().length > 0, `${v.where}: the step has no Why`)
  }
})

test('§3b an implementation is offered only where Foundation A offers one, on every variant', () => {
  every(
    'implementation',
    (v) => v.c.implementation.offered === implementationOffered(v.step),
    'the contract offers an implementation Foundation A does not, or withholds one it does',
  )
  every(
    'operations',
    (v) => !v.c.implementation.offered || operationsOf(v.step).length > 0,
    'an implementation is offered with nothing to submit',
  )
  // The two "no" stay two: a policy that cannot be written at all carries the
  // reason, and a sound operation whose day has not come carries the hold.
  // Neither is flattened into the other by the frame that draws them.
  every(
    'withheld',
    (v) => v.c.implementation.offered || v.c.implementation.reason === unavailableReason(v.step),
    'the withheld reason on the step is not the one Foundation A gave',
  )
  every(
    'hold',
    (v) => v.c.implementation.offered || v.c.implementation.hold === policyHold(v.step),
    'a policy held for its day was drawn as a policy that cannot be written',
  )
  // A step waiting on a person, or built on a baseline that contradicts itself,
  // is never handed a policy to submit — whatever the template has room for.
  // Those two are Foundation C's and the baseline's answers about whether the
  // desired end state is settled at all.
  //
  // `blocked` is deliberately not on this list, and the distinction is
  // load-bearing: a step blocked on a prerequisite has a writable policy and an
  // ordering that says not yet, and flattening the two would either hide a
  // usable artifact or claim the step may proceed. Its blocker stays a blocker
  // through `fix` and `whatToDo.kind === 'resolve'`, asserted in §4.
  every(
    'unsettled',
    (v) => !v.c.implementation.offered || (v.c.state.condition !== 'needs-decision' && v.c.state.condition !== 'baseline-conflict'),
    'an implementation is offered on a step whose desired end state is not settled',
  )
})

test('§3c a preserved goal is never asked to be created, and a set-aside step never advances', () => {
  every(
    'preserve',
    (v) => !isPreserved(v.step) || !v.c.implementation.offered,
    'a goal already delivered is offered as a policy to create',
  )
  // A goal the TENANT already delivered draws the lifecycle its policy recorded,
  // as the approved In-place variant does: complete, never mid-rollout. Who put
  // it there stays in the words — its badge reads In place, never Enforced,
  // which is the one claim that IAMAI ran the rollout (statusWord.ts).
  every(
    'in-place-track',
    (v) => !v.c.state.inPlace || v.c.track.every((t) => t.reached),
    'a policy the tenant already had is drawn part-way through a rollout',
  )
  every(
    'in-place-word',
    (v) => !(v.c.state.inPlace && v.c.state.satisfied) || v.c.state.stage === CONTRACT.lifecycle['in-place'],
    'a policy the tenant already had is named as a rollout this plan enforced',
  )
  every(
    'set-aside',
    (v) => !v.c.state.setAside || (!v.c.implementation.offered && v.c.track.length === 0 && v.c.whatToDo.kind === 'restore'),
    'a step the operator put aside is still being rolled out',
  )
})

// --------------------------------------------------- §4 blockers and evidence

test('§4 a blocker stays a blocker and a passed prerequisite leaves nothing behind', () => {
  every(
    'fix-is-outstanding',
    (v) => v.c.fix.every((f) => f.text.trim().length > 0),
    'an empty line is being drawn as something to fix',
  )
  // A blocked step has something to say about why. Either it lists what is
  // outstanding, or its one action is the authority's own reason — never
  // neither, which is the step that reads as blocked and explains nothing.
  every(
    'blocked-says-why',
    // A held step still handing over its report-only create says so in its action,
    // with what turning it on waits for, and its row carries the hold's own reason
    // (roadmap/lifecycle.ts nextMilestone, roadmap/stateReason.ts holdReasonFor).
    (v) => v.c.state.condition !== 'blocked' || v.c.fix.length > 0 || v.c.whatToDo.kind === 'resolve' || v.c.whatToDo.kind === 'decide' || (v.c.whatToDo.kind === 'deploy' && isHeld(v.step) && (v.step.blockedReason ?? '').length > 0),
    'a blocked step neither lists a blocker nor states the authority’s reason',
  )
  // And a step held for review keeps that as its condition rather than having it
  // softened into ordinary supporting text.
  every(
    'review',
    (v) => !heldForReview(v.step) || v.c.state.condition === 'review-required',
    'a step held for review lost the condition that holds it',
  )
})

test('§4b what IAMAI found is what this scan observed, never a padded card', () => {
  every('found', (v) => v.c.found.every((f) => f.text.trim().length > 0 && f.label.trim().length > 0), 'a finding card has no finding in it')
  // The reach is a real answer or a real unknown; it is never a count of nobody
  // standing in for a scope the scan could not settle.
  every('who', (v) => v.c.who === null || v.c.who.text.trim().length > 0, 'the who line renders empty')
})

// -------------------------------------------------------------------- §5 rail

test('§5 the rail and Readiness say only what the contract holds, on every variant', () => {
  // The approved rail is the Next milestone only, and every step has one.
  every('rail', (v) => railOf(v.c).metric.trim().length > 0 && railOf(v.c).sub.trim().length > 0, 'a step draws an empty Next milestone rail')
  // Readiness is one tile per unresolved prerequisite and the satisfied evidence
  // apart, each a label over a value, and a bar with a headline: never padded.
  every(
    'readiness',
    (v) => {
      const r = readinessOf(v.step, v.c)
      return [...r.tiles, ...r.satisfied].every((t) => t.label.trim() !== '' && t.value.trim() !== '') && r.tiles.every((t) => t.tone === 'warn' || t.tone === 'wait') && r.bar.main.trim() !== ''
    },
    'a step draws a padded Readiness region',
  )
  // Task 036's own addition: the pack's In-place variant is defined by a rail
  // block naming the tenant's own policy. It is `Step.satisfiedBy` and nothing
  // else — never a baseline name, never a guess, and never on a step the
  // coverage authority did not call preserved.
  every(
    'existing',
    (v) => v.c.existing === null || (isPreserved(v.step) && v.c.existing.names.length > 0 && v.c.existing.names.every((n) => n.trim().length > 0)),
    'a policy name appears on a step that is not preserved, or an empty name appears',
  )
  every(
    'existing-provenance',
    (v) => v.c.existing === null || v.c.existing.names.every((n) => (v.step.satisfiedBy?.policies ?? []).includes(n) || v.step.satisfiedBy?.sufficient === n),
    'the rail names a policy the classifier did not record as satisfying the goal',
  )
  // Two policies covering a goal between them are both named and said to do it
  // together; one that covers it alone is named alone. Neither may stand for
  // the other.
  every(
    'existing-together',
    (v) => v.c.existing === null || v.c.existing.together === (v.c.existing.names.length > 1),
    'the rail presents a partial policy as the one that delivers the goal',
  )
})

test('§5b a preserved goal draws the pack’s In-place variant: no change needed, and no implementation', () => {
  const pack = read('docs/design/approved/anatomy/plan-step-v1.html')
  const v4 = pack.slice(pack.indexOf('id="v4"'), pack.indexOf('id="v5"'))
  assert.ok(v4.includes('<div class="metric">No change needed</div>'), 'the pack’s In-place rail no longer says no change is needed')
  assert.ok(v4.includes('implementation-empty good'), 'the pack’s In-place variant now offers an implementation')
  assert.equal(v4.split('<div class="stage done"></div>').length - 1, 4, 'the pack no longer draws the In-place lifecycle as reached')
  // Production: every preserved goal nothing holds says the same, from the contract.
  const preserved = sweep().filter((v) => v.c.whatToDo.kind === 'preserve' && !v.c.state.setAside && v.c.state.condition === 'healthy')
  assert.ok(preserved.length > 0, 'no preserved goal in the sweep')
  for (const v of preserved) {
    assert.equal(railOf(v.c).metric, BOARD.lanes.completed, `${v.where}: a preserved goal’s rail does not say Completed (A1b: the lane label)`)
    assert.ok(v.c.track.every((t) => t.reached), `${v.where}: a preserved goal is drawn mid-rollout`)
    assert.equal(v.c.implementation.offered, false, `${v.where}: a preserved goal offers an implementation`)
  }
})

// ------------------------------------------------------- §6 one presentation

test('§6 the Plan has one row, two bodies, and no step-specific presentation fork', () => {
  const plan = read('src/ui/surfaces/Plan.tsx')
  const step = read('src/ui/surfaces/ContentStep.tsx')
  const cleanup = read('src/ui/surfaces/CleanupStep.tsx')
  // One row shape for every group the Plan draws: the phases, the undated held
  // group, the floor group, the Cleanup rows and the footer's In place rows.
  assert.equal(plan.split('<PlanRow').length - 1, 2, 'the Plan draws a row shape other than PlanRow')
  assert.equal(plan.split('<ContentStep').length - 1, 1, 'the Plan opens a step body other than ContentStep')
  assert.equal(plan.split('<CleanupBody').length - 1, 1, 'the Plan opens a Cleanup body other than CleanupBody')
  // Both bodies are the same frame: the pack's `.step` article, its head, its
  // main column. A Cleanup row activates less of it; it does not get its own.
  for (const [name, src] of [['the step', step], ['a Cleanup row', cleanup]] as const) {
    assert.match(src, /<article className="step panel panel-key">/, `${name} no longer draws the approved frame`)
    assert.match(src, /<StepHead/, `${name} no longer draws the approved head`)
    assert.match(src, /<div className="step-main">/, `${name} no longer draws the approved main column`)
  }
  // And nothing downstream of the contract branches on WHICH step it is. A step
  // id or a goal id in the presentation is the bespoke fork this pack retired.
  const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [name, src] of [['Plan.tsx', plan], ['ContentStep.tsx', step], ['StepSections.tsx', read('src/ui/surfaces/StepSections.tsx')]] as const) {
    assert.doesNotMatch(code(src), /step\.id === ['"]s-/, `${name} branches its presentation on one step's id`)
    assert.doesNotMatch(code(src), /step\.goalId === ['"]/, `${name} branches its presentation on one goal`)
    assert.doesNotMatch(code(src), /step\.kind === ['"]/, `${name} branches its presentation on the step's kind`)
  }
})

test('§6a Portal, JSON and PowerShell are one authority chain the presentation only reads', () => {
  // The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
  const step = read('src/ui/surfaces/ContentStep.tsx') + read('src/ui/surfaces/stepBody.ts')
  const sections = read('src/ui/surfaces/StepSections.tsx')
  // Every channel — the panel that shows it, the download that saves it, and
  // the rail that lists it — is gated on the ONE answer the contract carries
  // (`implementation.offered`, which is roadmap/operations.ts's
  // `implementationOffered`). A surface that decided a channel for itself is
  // how the screen came to instruct a change the artifacts refused to describe.
  assert.ok(step.includes('const channels = deployNow ? channelsFor(hasPortal, contract.implementation.offered) : []'), "the step no longer gates its channels on the contract's one answer")
  assert.ok(step.includes("if (machineOffered) out.push('ps', 'json')"), 'the machine channels are offered without Foundation A')
  assert.equal(/implementationOffered|jsonOffered/.test(sections.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), false, 'the frame components ask Foundation A themselves')
  // And the bodies themselves are never composed here: the JSON is stepJson's
  // over the step's own resolved operations, and the commands are
  // stepPowerShell's over the same operations.
  assert.match(step, /policyJsonText\(step\)/, 'the step no longer takes its JSON from stepJson')
  assert.match(step, /powershellFor\(stepOperations\(step\)\)/, 'the step no longer takes its commands from the same operations')
  const code = step.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /JSON\.stringify\(\s*\{/, 'the step builds a policy body in JSX')
})

test('§6b the collapsed row and the opened head say the same state, on every variant', () => {
  for (const v of sweep()) {
    const row = statusOf(v.step)
    assert.equal(v.c.state.word, row.word, `${v.where}: the row and the opened step disagree about the state`)
    assert.equal(v.c.state.tone, row.tone, `${v.where}: the row and the opened step disagree about the tone`)
  }
})

test('§6c the demo renders through the same Plan, with no variant renderer of its own', () => {
  const app = read('src/ui/App.tsx')
  assert.match(app, /<Plan\b/, 'the app no longer mounts the Plan')
  assert.equal(app.split('<Plan').length - 1, 1, 'the demo mounts a second Plan')
  const demo = read('src/ui/demo.ts')
  assert.doesNotMatch(demo, /ContentStep|StepHead|PlanRow|StepRail/, 'the demo builds Plan presentation of its own')
  // The demo's own plans are in the sweep above under the `demo` fixtures, so
  // every invariant in this file is asserted over them too.
  assert.ok(sweep().some((v) => v.where.startsWith('demo/')), 'the demo tenant left the variant sweep')
  assert.ok(sweep().some((v) => v.where.startsWith('demo-week2/')), 'the demo follow-up snapshot left the variant sweep')
})

// ---------------------------------------------------------- §7 policy members

/**
 * A goal the pinned baseline implements with TWO policies is one step
 * delivering two objects, each with its own name, its own stage and its own
 * history (Foundation B members, `roadmap/tracking.ts` `requiredMembers`).
 *
 * The pack draws ONE grammar for every step, so the members list is the only
 * place a pair's two identities survive the row — and the failure a visual
 * migration makes here is to let the step's own aggregate stand for both
 * halves, or to let the deployed half stand for the pair. Both would still
 * render a perfectly ordinary step.
 */
const pairs = (): Variant[] => sweep().filter((v) => v.c.multiPolicy)

test('§7 a step the baseline implements with two policies keeps both, and neither stands for the pair', () => {
  const all = pairs()
  assert.ok(all.length > 0, 'no step in the sweep renders more than one policy member, so nothing here proves the members path')
  for (const v of all) {
    const required = requiredMembers(v.step)
    const tracked = new Map((v.step.tracking?.members ?? []).map((m) => [m.key, m]))
    const observed = new Map(v.step.state.members.map((m) => [m.key, m]))
    // Identity: one member per required member, in the baseline's own order,
    // each with its own key and its own label.
    assert.deepEqual(v.c.members.map((m) => m.key), required.map((m) => m.key), `${v.where}: the members are not the step's required members`)
    assert.equal(new Set(v.c.members.map((m) => m.key)).size, v.c.members.length, `${v.where}: two members share one identity`)
    assert.equal(v.c.members.every((m) => m.label !== null), true, `${v.where}: a member of a pair is drawn with no label`)
    assert.equal(new Set(v.c.members.map((m) => m.label)).size, v.c.members.length, `${v.where}: two members carry the same label`)
    for (const m of v.c.members) {
      assert.ok(m.name.trim().length > 0, `${v.where}/${m.key}: a member renders with no name`)
      // Stage, review state and provenance are each the authority's own answer
      // FOR THAT MEMBER: the tracking record for its key, and the observation
      // record for its key. Never the step's aggregate lifecycle, and never the
      // other half's.
      assert.equal(m.lifecycle, tracked.get(m.key)?.lifecycle ?? null, `${v.where}/${m.key}: the member's stage is not the one Foundation B tracked for it`)
      assert.equal(m.reviewRequired, tracked.get(m.key)?.reviewRequired === true, `${v.where}/${m.key}: the member's review state is not its own`)
      assert.equal(m.since, observed.get(m.key)?.change.latest.firstSeenAt ?? null, `${v.where}/${m.key}: the member's history is not the observation recorded for it`)
      assert.ok(m.line.includes(m.name), `${v.where}/${m.key}: the member's line does not name the member`)
    }
    // And the two lines are two: a pair whose halves read identically has let
    // one of them stand for the step.
    assert.equal(new Set(v.c.members.map((m) => m.name)).size, v.c.members.length, `${v.where}: one member's name stands for the other`)
    assert.equal(new Set(v.c.members.map((m) => m.line)).size, v.c.members.length, `${v.where}: one member's line stands for the other`)
  }
  // The two readings that make the aggregate visible as an aggregate, both
  // reached by the sweep rather than asserted about in the abstract: a pair with
  // its halves at two different stages, and a pair with ONE half held for
  // review while the other is not.
  assert.ok(
    all.some((v) => new Set(v.c.members.map((m) => m.lifecycle)).size > 1),
    'no pair in the sweep has its two halves at different stages, so nothing proves the step is not one of them',
  )
  assert.ok(
    all.some((v) => v.c.members.some((m) => m.reviewRequired) && v.c.members.some((m) => !m.reviewRequired)),
    'no pair in the sweep has exactly one half held for review, so nothing proves the review stays on the member that moved',
  )
  // A member that needs a look never leaves its step reading all-clear. Which
  // badge the step ends up wearing is the condition precedence's answer and not
  // this file's — a blocked step outranks a held one and says `blocked` — but
  // `healthy` is the one answer that would have swallowed what one half did.
  every(
    'member-review',
    (v) => !v.c.members.some((m) => m.reviewRequired) || v.c.state.condition !== 'healthy',
    'a member needs a look and the step it belongs to reads healthy',
  )
  // And the members block is a PAIR's block. A step with one policy renders no
  // member list and labels nothing "Policy A", on every variant in the sweep.
  every(
    'one-policy',
    (v) => v.c.multiPolicy || (v.c.members.length <= 1 && (v.c.members[0]?.label ?? null) === null),
    'a step with one policy is drawn as a pair',
  )
})

test('§7b the members list is the renderer’s one source for a pair, composed nowhere else', () => {
  const sections = read('src/ui/surfaces/StepSections.tsx')
  const step = read('src/ui/surfaces/ContentStep.tsx')
  // One list, over the contract's members, drawing each member's own line and
  // its own label — and nothing at all below two, so a one-policy step keeps
  // the light row it has.
  assert.match(sections, /members\.length < 2/, 'the members block no longer stops at a single policy')
  assert.match(sections, /members\.map\(/, 'the members block no longer draws one row per member')
  assert.match(sections, /\{m\.line\}/, 'the members block composes a member’s line somewhere other than the contract')
  assert.match(step, /<PolicyMembers members=\{contract\.members\} \/>/, 'the step no longer draws the members from the contract')
  assert.equal(step.split('<PolicyMembers').length - 1, 1, 'the step draws a second members block')
})
