// The "Respond to Risk and Limit Sessions" group, taken to the V1 standard:
// docs/plans/risk-and-sessions-spec.md holds the outcome, the Microsoft Learn
// page behind every technical claim and the date it was checked. One test per
// acceptance item in that spec.
//
// A test reads the OPENED STEP wherever the claim is about what an admin sees,
// and the compiled package block where the claim is about a lifecycle state no
// fixture reaches — the rule closeDoors.test.ts and protectAdmins.test.ts
// follow. The group's four risk steps need Entra ID P2, so the demo and its
// follow-up carry them as Not licensed rows and never as steps (spec section
// 8.1); their states are read on `mid`, which holds P2.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shared, stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../../coverage/facts.ts'
import { portalLines } from '../../roadmap/portalLines.ts'
import { buildNameDirectory } from '../../names.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The group's six members, in registry order (roadmap/stepGroups.ts). */
const RISK_AND_SESSIONS = [
  's-goal-sign-in-risk',
  's-goal-user-risk',
  's-goal-sign-in-risk-medium',
  's-goal-user-risk-medium',
  's-goal-all-users-no-persistence',
  's-goal-token-protection',
]

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
function bodiesOf(name: FixtureName, mapping?: MappingState): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = mapping ? { ...fixture(name), mapping } : fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const out = new Map<string, StepBody>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      if (!reading) continue
      const lane = laneViewOf(reading, titleOf)
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
    }
    return out
  } finally {
    setDisplayTimeZone(null)
  }
}

/** A content step's own `why`, unfilled: the words About this Step draws. */
const whyOf = (id: string): string => String((stepById[id] as unknown as { why?: string }).why ?? '')

/** The step's About sentence as the OPENED step fills it, which is what a person reads. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  ((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

/** A step's Completion Criteria lines from the content file. */
const doneWhenOf = (id: string): string[] => ((stepById[id] as unknown as { doneWhen?: unknown }).doneWhen ?? []) as string[]

/** A step's reviewer reference lines, both shapes. */
const referenceOf = (id: string): string => {
  const r = (stepById[id] as unknown as { whatToDoReference?: { steps?: string[]; new?: string[] } }).whatToDoReference ?? {}
  return [...(r.steps ?? []), ...(r.new ?? [])].join('\n')
}

/** Every string a step's content entry carries, joined: the whole of what it can say. */
function allText(id: string): string {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(walk)
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) if (k !== 'example') walk(v)
  }
  walk(stepById[id])
  return out.join('\n')
}

/** A compiled package block's authored text, for a lifecycle state no fixture reaches. */
function blockText(stepId: string, blockId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  return String(pkg?.blocks?.[blockId]?.text ?? '')
}

/** Every block a package carries, joined. */
function packageText(stepId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  return Object.values(pkg?.blocks ?? {}).map((b) => String(b.text ?? '')).join('\n')
}

/** The date the package's Microsoft sources were last checked (project.ts sourceUpdatedOn). */
function sourceCheckedOn(stepId: string): string {
  const pkg = (registry.packages as Record<string, { meta?: { verifiedSources?: { checkedOn?: string }[] } }>)[stepId]
  return (pkg?.meta?.verifiedSources ?? [])
    .map((s) => String(s.checkedOn ?? ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .slice(-1)[0] ?? ''
}

/** The Implementation Tasks a step body draws, as one string. */
function tasksTextOf(b: StepBody): string {
  return JSON.stringify((b as unknown as Record<string, unknown>).tasks ?? (b as unknown as Record<string, unknown>).implementation ?? {})
}

/** The translator's portal lines for one pinned policy, as a policy step renders them. */
function linesForPinned(policyId: string): string[] {
  const p = (pinned.policies as unknown as { id: string; displayName: string }[]).find((x) => x.id === policyId)!
  const dir = buildNameDirectory(null, [], new Map())
  return portalLines(policyFacts(p as never, new Map()), {
    policyName: p.displayName,
    nameOf: (id: string) => dir.label(id),
    portalRoot: shared.portalRoot as string,
    reportOnlyLine: shared.reportOnlyLine as string,
    exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', 'the exclusions group'),
  })
}

const SIGN_IN_RISK = 's-goal-sign-in-risk'
const USER_RISK = 's-goal-user-risk'
const SIGN_IN_RISK_MEDIUM = 's-goal-sign-in-risk-medium'
const USER_RISK_MEDIUM = 's-goal-user-risk-medium'
const SESSIONS = 's-goal-all-users-no-persistence'
const TOKEN_PROTECTION = 's-goal-token-protection'

test('the group is the six members the spec takes', () => {
  assert.deepEqual([...membersOf('risk-and-sessions')], RISK_AND_SESSIONS)
})

// ---------------------------------------------------------------------------
// Section 2: the Configure trap, fixed in the translator
// ---------------------------------------------------------------------------

test('T1: a target that narrows sign-in risk, user risk or device platforms says Configure: Yes', () => {
  // Microsoft Learn policy-risk-based-sign-in (ms.date 2026-03-24), checked
  // 2026-09-20: "Under Conditions > Sign-in risk, set Configure to Yes".
  assert.ok(
    linesForPinned('53a8df0b-4658-4835-ace2-100b5d287aac').includes('Conditions → Sign-in risk → Configure: Yes, then High'),
    linesForPinned('53a8df0b-4658-4835-ace2-100b5d287aac').join('\n'),
  )
  assert.ok(
    linesForPinned('544cd9ef-5e37-4568-9ad8-b8e151be1814').includes('Conditions → User risk → Configure: Yes, then High'),
    linesForPinned('544cd9ef-5e37-4568-9ad8-b8e151be1814').join('\n'),
  )
  assert.ok(
    linesForPinned('180ab5a3-d3ae-4457-9ef1-e3c06f5dfbfc').includes('Conditions → Sign-in risk → Configure: Yes, then Medium'),
    linesForPinned('180ab5a3-d3ae-4457-9ef1-e3c06f5dfbfc').join('\n'),
  )
  assert.ok(
    linesForPinned('7475b373-0544-4ee8-8827-cff35009136d').includes('Conditions → User risk → Configure: Yes, then Medium'),
    linesForPinned('7475b373-0544-4ee8-8827-cff35009136d').join('\n'),
  )
  // Device platforms, and the one consequence concept-conditional-access-conditions
  // (ms.date 2026-06-02) documents: "By default, it applies to all device platforms."
  assert.ok(
    linesForPinned('8bb25c6a-ed35-4556-bed4-b3aaa14e192b').includes('Conditions → Device platforms → Configure: Yes, then Include: Windows. Left at No it applies to all device platforms.'),
    linesForPinned('8bb25c6a-ed35-4556-bed4-b3aaa14e192b').join('\n'),
  )
})

