// The "Ongoing Checks and Cleanup" group (`ongoing`, the catch-all), taken to
// the V1 standard: docs/plans/ongoing-spec.md holds the outcome, the Microsoft
// Learn page behind every technical claim and the date it was checked. One test
// per acceptance item in that spec.
//
// A test here reads the OPENED STEP wherever the claim is about what an admin
// sees, and the compiled package block where the claim is about a lifecycle
// state no fixture reaches — the same rule closeDoors.test.ts and
// whereSignIn.test.ts follow. Two members are read differently again: the
// `s-review-baseline-*` rows are generated per tenant, so their words are read
// off the template in `pages.app.plan.workflows` and off a generated row on the
// demo; and the four `cleanup-*` rows are not content steps, so they are read
// off `content.cleanup` and through `cleanupEntry`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepById } from '../../content/content.ts'
import contentJson from '../../../docs/design/content.json' with { type: 'json' }
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
import { rowWho } from './rowWho.ts'
import { cleanupEntry } from './cleanupExport.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { Step } from '../../roadmap/types.ts'

/** The group's eight listed members, in registry order (roadmap/stepGroups.ts). */
const ONGOING = [
  's-goal-admin-portals-protected',
  's-goal-inforcer-mfa',
  's-check-dormant-accounts',
  's-check-separate-admin-accounts',
  'cleanup-alerting',
  'cleanup-hardening',
  'cleanup-consolidation',
  'cleanup-naming',
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

/** The steps of a fixture's plan, for the rows a body cannot answer for. */
function stepsOf(name: FixtureName): Step[] {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture(name)
    return runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf).steps
  } finally {
    setDisplayTimeZone(null)
  }
}

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

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

/** A compiled package block's authored text. */
function blockText(stepId: string, blockId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  const text = pkg?.blocks?.[blockId]?.text
  assert.ok(typeof text === 'string' && text !== '', `${stepId}: the package has no ${blockId} block`)
  return text as string
}

/** Every authored block of a package, joined. */
function packageText(stepId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  return Object.values(pkg?.blocks ?? {}).map((b) => b.text ?? '').join('\n')
}

/** The package's own last-checked date (project.ts sourceUpdatedOn reads the max). */
function checkedOn(stepId: string): string {
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { checkedOn: string }[] } }>)[stepId]?.meta
  const dates = (meta?.verifiedSources ?? []).map((s) => s.checkedOn).sort()
  return dates[dates.length - 1] ?? ''
}

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the group lists its eight members in the spec order, and takes every unclaimed step', () => {
  assert.deepEqual([...membersOf('ongoing')], ONGOING)
})

// ---------------------------------------------------------------------------
// Disable or Confirm Dormant Accounts (spec section 2)
// ---------------------------------------------------------------------------

const DORMANT = 's-check-dormant-accounts'

test('A1: About says 90 days is IAMAI’s window, and names Microsoft’s range around it', () => {
  const why = String((stepById[DORMANT] as unknown as { why: string }).why)
  assert.match(why, /no successful sign-in for 90 days/)
  assert.match(why, /90 to 180/)
})

test('A2: About says a blank record is not proof, and why the directory has none', () => {
  const why = String((stepById[DORMANT] as unknown as { why: string }).why)
  assert.match(why, /blank record is not proof/)
  assert.match(why, /keeps sign-ins only so far back, and never fills the gap in later/)
  // The on-screen procedure carries the same reason, so the step and its package agree.
  assert.match(blockText(DORMANT, 'entra.dormant'), /keeps sign-ins only so far back, and never fills the gap in later/)
})

test('A3: nothing promises the row clears on the next scan; the record can take a day', () => {
  assert.doesNotMatch(allText(DORMANT), /leaves this list on the next scan/)
  assert.doesNotMatch(packageText(DORMANT), /leaves this list on the next scan/)
  assert.match(allText(DORMANT), /the directory's record can take a day to catch up/)
  assert.match(blockText(DORMANT, 'entra.dormant'), /can take a day to catch up, so scan again after that/)
  const doneWhen = (stepById[DORMANT] as unknown as { doneWhen: string[] }).doneWhen
  assert.ok(doneWhen.some((l) => /shows a successful sign-in on a later scan/.test(l)), doneWhen.join('\n'))
})

test('A4: help desk says the reading is a successful sign-in, and a failed attempt is not use', () => {
  const lines = helpDeskOf(DORMANT)
  assert.ok(lines.some((l) => /A failed sign-in is not use/.test(l)), lines.join('\n'))
  assert.match(blockText(DORMANT, 'ai.dormant'), /a failed attempt is not use/)
})

test('A5: help desk sends a stale guest to Microsoft’s own guest review', () => {
  assert.ok(helpDeskOf(DORMANT).some((l) => /stale-guest review/.test(l)), helpDeskOf(DORMANT).join('\n'))
})

test('A6: the disable procedure names the least-privileged role, on screen and in the package', () => {
  assert.match(blockText(DORMANT, 'entra.dormant'), /as at least a User Administrator/)
  assert.match(blockText(DORMANT, 'entra.disable'), /as at least a User Administrator/)
})

test('A7: the package carries the checked date, so the step can show it', () => {
  assert.equal(checkedOn(DORMANT), '2026-09-20')
})

test('A1–A7 on screen: the demo draws the corrected About and the corrected procedure', () => {
  const b = bodiesOf('demo').get(DORMANT)
  assert.ok(b, 'the demo plan has no dormant-accounts step')
  assert.match(b.contract.why, /no successful sign-in for 90 days/)
  assert.match(b.lead ?? '', /enabled accounts with no successful sign-in for 90 days, or none on record/)
  const steps = (b.emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps ?? [])
  assert.ok(steps.some((s) => /as at least a User Administrator/.test(s)), steps.join('\n'))
  assert.ok(steps.some((s) => /can take a day to catch up/.test(s)), steps.join('\n'))
})

test('A1–A7 on a free tenant: the licence note still stands beside the list', () => {
  const b = bodiesOf('micro').get(DORMANT)
  assert.ok(b, 'the micro plan has no dormant-accounts step')
  const who = (b.whoFull ?? []).map((w) => w.lead).join('\n')
  assert.match(who, /Last sign-in dates need Entra ID P1/)
  assert.match(b.lead ?? '', /1 enabled account with no successful sign-in for 90 days, or none on record/)
})

// ---------------------------------------------------------------------------
// Use Separate Accounts for Admin Work (spec section 3)
// ---------------------------------------------------------------------------

const SEPARATE = 's-check-separate-admin-accounts'

test('B1: the admin account gets a working address, and nothing says to leave it without one', () => {
  assert.doesNotMatch(allText(SEPARATE), /no licence, no mailbox/)
  assert.doesNotMatch(packageText(SEPARATE), /assign no licence, so it has no mailbox/)
  assert.match(allText(SEPARATE), /no mailbox to read, but an email address that reaches the person/)
  assert.match(blockText(SEPARATE, 'entra.separate'), /no mailbox to read, but an email address that reaches the person/)
})

test('B2: About names phishing as the reason, not "exposure"', () => {
  const why = String((stepById[SEPARATE] as unknown as { why: string }).why)
  assert.match(why, /Personal email is phished constantly/)
  assert.doesNotMatch(why, /reduces the exposure/)
})

test('B3: the procedure says why the admin account is cloud-only', () => {
  assert.match(blockText(SEPARATE, 'entra.separate'), /Cloud-only keeps the role clear of a compromised on-premises directory/)
})

test('B4: Microsoft’s two counts are on the step and in the procedure', () => {
  const risks = risksOf(SEPARATE)
  assert.ok(risks.some((t) => /fewer than five Global Administrators/.test(t) && /fewer than ten privileged role assignments/.test(t)), risks.join('\n'))
  assert.match(blockText(SEPARATE, 'entra.separate'), /fewer than five Global Administrators/)
})

test('B5: registration goes to the page Microsoft names, and no aka.ms alias is left', () => {
  assert.match(blockText(SEPARATE, 'entra.separate'), /https:\/\/mysignins\.microsoft\.com\/security-info/)
  assert.doesNotMatch(packageText(SEPARATE), /aka\.ms/)
  assert.doesNotMatch(allText(SEPARATE), /aka\.ms/)
})

test('B6: the Learn link is the page that carries this instruction', () => {
  const url = String((stepById[SEPARATE] as unknown as { learn: { url: string } }).learn.url)
  assert.equal(url, 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-planning')
})

test('B7: the package carries the checked date, and the step shows it', () => {
  assert.equal(checkedOn(SEPARATE), '2026-09-20')
  const b = bodiesOf('demo').get(SEPARATE)
  assert.ok(b, 'the demo plan has no separate-admin-accounts step')
  assert.equal(b.sourceLine, 'Source checked Sep 20, 2026')
})

test('B8: on a free tenant the step says it cannot see everyday use, and still asks for the review', () => {
  const b = bodiesOf('micro').get(SEPARATE)
  assert.ok(b, 'the micro plan has no separate-admin-accounts step')
  const who = (b.whoFull ?? []).map((w) => w.lead).join('\n')
  // micro has no sign-in evidence at all, so the licence note is the only who-line there is.
  assert.match(who, /Mail and Teams activity needs Entra ID P1/)
  assert.doesNotMatch(who, /Recent mail or Teams activity/)
  assert.match(b.lead ?? '', /Review the 1 administrator account for dedicated administration\./)
  // The demo has the evidence, and the note sits under it rather than replacing it.
  const demoWho = (bodiesOf('demo').get(SEPARATE)?.whoFull ?? []).map((w) => w.lead)
  assert.ok(demoWho.some((l) => /Recent mail or Teams activity/.test(l)), demoWho.join('\n'))
  assert.ok(demoWho.some((l) => /needs Entra ID P1/.test(l)), demoWho.join('\n'))
})

// ---------------------------------------------------------------------------
// Block the Admin Portals for Non-Admins (spec section 4)
// ---------------------------------------------------------------------------

const PORTALS = 's-goal-admin-portals-protected'
/** The goal step's words live under the goal id, which is what the plan resolves. */
const PORTALS_CONTENT = 'admin-portals-protected'

test('C1: About names the unsettled scope, not a benefit the step does not deliver', () => {
  const why = String((stepById[PORTALS_CONTENT] as unknown as { why: string }).why)
  assert.match(why, /spares no administrator/)
  assert.match(why, /settled before anyone deploys it/)
  assert.doesNotMatch(why, /can reduce unnecessary access/)
})

test('C2: a risk says the admin-portals resource stops at the portals', () => {
  const risks = risksOf(PORTALS_CONTENT)
  assert.ok(risks.some((t) => /covers the portals, not the services behind them/.test(t) && /Microsoft Graph/.test(t)), risks.join('\n'))
})

test('C3: a risk says a block here stops the Microsoft 365 install page for everyone', () => {
  const risks = risksOf(PORTALS_CONTENT)
  assert.ok(risks.some((t) => /Microsoft 365 install page/.test(t)), risks.join('\n'))
})

test('C4: the Azure management risk names what that resource really reaches', () => {
  const risks = risksOf(PORTALS_CONTENT)
  assert.ok(risks.some((t) => /Azure PowerShell, the Azure CLI and the Microsoft 365 admin center/.test(t) && /no longer reaches Azure DevOps/.test(t)), risks.join('\n'))
})

test('C5: the step reaches no create on the demo, and its Completion Criteria is the author’s', () => {
  const b = bodiesOf('demo').get(PORTALS)
  assert.ok(b, 'the demo plan has no admin-portals step')
  assert.equal(b.empty?.key, 'conflict')
  assert.ok(b.conflictWords, 'the conflicted step draws no explanation')
  assert.deepEqual(b.contract.doneWhen, ['The baseline author publishes a version that resolves the contradiction between the policy’s documentation and its definition.'.replace('’', "'")])
  // Nothing in the body offers a policy to write.
  const steps = (b.emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps ?? [])
  assert.equal(steps.length, 0, steps.join('\n'))
})

test('C6: the row’s Impact names the subject instead of the placeholder', () => {
  for (const name of ['demo', 'messy'] as const) {
    const step = stepsOf(name).find((s) => s.id === PORTALS)
    assert.ok(step, `${name}: no admin-portals step`)
    assert.equal(rowWho(step), 'Administrator portals')
  }
})
