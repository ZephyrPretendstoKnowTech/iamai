// The "Ongoing Checks and Cleanup" group (`ongoing`, the catch-all), taken to
// the V1 standard: docs/plans/ongoing-spec.md holds the outcome, the Microsoft
// Learn page behind every technical claim and the date it was checked. The step's
// words are pinned by the rendered step snapshots (src/testing/stepSnapshots.test.ts);
// what is asserted here is where the group sits, the report-only and exclusions
// instructions, the Cleanup rows' shape, and what the free-tier path keeps.
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
import { fixture, withReviewRow } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { groupOf, membersOf } from '../../roadmap/stepGroups.ts'
import { cleanupEntry, cleanupExportViews } from './cleanupExport.ts'
import { stepExportView } from './stepExport.ts'
import { promptPack } from '../../roadmap/prompts.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { Step } from '../../roadmap/types.ts'
import { readFileSync } from 'node:fs'

// The no-P1 renderings below are dormant, not deleted. Since 2026-09-20 a tenant
// without Entra ID P1 gets no plan at all, so no step is composed for it and the
// two licence who-lines cannot be reached on screen. The owner asked for the
// free-tier path to stay in the tree for a later comparison, so these two tests
// stay with it and come back the moment the flag does.
const FREE_TIER = /const FREE_TIER_LADDER = true/.test(readFileSync('src/roadmap/generate.ts', 'utf8'))
const dormant = { skip: FREE_TIER ? false : 'dormant with FREE_TIER_LADDER (src/roadmap/generate.ts)' }

/** The spec's eight steps (docs/plans/ongoing-spec.md), in its order. The roadmap flow keeps the Cleanup rows here and moves the other four up (roadmap/stepGroups.ts). */
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
function bodiesOf(name: FixtureName, mapping?: MappingState, shape: (f: Fixture) => Fixture = (f) => f): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = shape(mapping ? { ...fixture(name), mapping } : fixture(name))
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

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the spec’s eight steps sit where the roadmap flow places them, and Ongoing takes every unclaimed step', () => {
  // Alert on Emergency Account Sign-ins closes Establish Emergency Access (owner, 2026-09-25).
  assert.deepEqual(ONGOING.map((id) => groupOf(id)?.key), ['remaining-doors', 'extend-mfa', 'prepare', 'prepare', 'emergency-access', 'ongoing', 'ongoing', 'ongoing'])
  assert.deepEqual([...membersOf('ongoing')], ['cleanup-hardening', 'cleanup-namedExclusions', 'cleanup-consolidation', 'cleanup-naming'])
  assert.equal(groupOf('s-something-nobody-placed')?.key, 'ongoing')
})

// ---------------------------------------------------------------------------
// Disable or Confirm Dormant Accounts (spec section 2)
// ---------------------------------------------------------------------------

const DORMANT = 's-check-dormant-accounts'

// V1 audit S4-21. Without Entra ID P1 Graph withholds signInActivity from every
// person, and the step used to read those blanks as dormancy: 10 of 10 accounts
// listed under "Disable it … Account enabled: No". Absence of a date the licence
// withheld is not absence of sign-in, so the step now lists nobody and the note
// beside it says why.
test('A1–A7 on a free tenant: nobody is called dormant, and the licence note says why', dormant, () => {
  const b = bodiesOf('micro').get(DORMANT)
  assert.ok(b, 'the micro plan has no dormant-accounts step')
  const who = (b.whoFull ?? []).map((w) => w.lead).join('\n')
  assert.match(who, /Last sign-in dates need Entra ID P1/)
  assert.match(who, /cannot tell a dormant account from one in daily use, so it lists none/)
  assert.match(b.lead ?? '', /0 enabled accounts with no successful sign-in for 90 days, or none on record/)
})

// ---------------------------------------------------------------------------
// Use Separate Accounts for Admin Work (spec section 3)
// ---------------------------------------------------------------------------

const SEPARATE = 's-check-separate-admin-accounts'

test('B8: on a free tenant the step says it cannot see everyday use, and still asks for the review', dormant, () => {
  const b = bodiesOf('micro').get(SEPARATE)
  assert.ok(b, 'the micro plan has no separate-admin-accounts step')
  const who = (b.whoFull ?? []).map((w) => w.lead).join('\n')
  // micro has no sign-in evidence at all, so the licence note is the only who-line there is.
  assert.match(who, /Mail and Teams activity needs Entra ID P1/)
  assert.doesNotMatch(who, /Recent mail or Teams activity/)
  assert.match(b.lead ?? '', /Review the 1 administrator account for dedicated administration\./)
  // The demo has the evidence, and no licence caveat: the note has no
  // placeholder, so `whole()` could never gate it and it was drawn on all eight
  // fixtures — seven of which hold P1, which made the one honest sentence about
  // the licence carry no information at all (V1 audit S4-21). It is now drawn
  // only where the licence actually withheld the records.
  const demoWho = (bodiesOf('demo').get(SEPARATE)?.whoFull ?? []).map((w) => w.lead)
  assert.ok(demoWho.some((l) => /Recent mail or Teams activity/.test(l)), demoWho.join('\n'))
  assert.ok(!demoWho.some((l) => /needs Entra ID P1/.test(l)), demoWho.join('\n'))
})

// ---------------------------------------------------------------------------
// Block the Admin Portals for Non-Admins (spec section 4)
// ---------------------------------------------------------------------------

const PORTALS = 's-goal-admin-portals-protected'

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

// ---------------------------------------------------------------------------
// The baseline review family (spec section 6)
// ---------------------------------------------------------------------------

/** One generated row's instruction lines, as the opened step draws them. */
function reviewSteps(name: FixtureName): string[] {
  // A baseline with a policy no goal holds (Jon's pin has none drawn since Phase 2b).
  const bodies = bodiesOf(name, undefined, withReviewRow)
  for (const [id, b] of bodies) {
    if (!id.startsWith('s-review-baseline-')) continue
    const steps = (b.emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps ?? [])
    if (steps.length > 0) return steps
  }
  assert.fail(`${name}: no generated review row with instructions`)
}

test('E2: report-only is an instruction, not a hedge', () => {
  const lines = reviewSteps('demo')
  assert.ok(lines.some((l) => /Create it in report-only, leave it there for a week, and read the sign-in logs/.test(l)), lines.join('\n'))
  assert.ok(!lines.some((l) => /Where the policy supports report-only/.test(l)), lines.join('\n'))
})

test('E3: the template says to test the exclusions, not only to preserve them', () => {
  const lines = reviewSteps('demo')
  assert.ok(lines.some((l) => /Test the exclusions as well as the rule/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /exclude the emergency access accounts/.test(l) && /report-only policy blocks nobody/.test(l)), lines.join('\n'))
})

test('E4: the template says to set the policy back to Report-only, never Off and never deleted, when rolling back', () => {
  // Owner, 2026-09-23: a revert goes to Report-only, and the policy is switched
  // on from there when the data supports it.
  const lines = reviewSteps('demo')
  assert.ok(lines.some((l) => /set the policy back to Report-only rather than delete it/.test(l) && /30 days/.test(l)), lines.join('\n'))
  assert.ok(!lines.some((l) => /disable the policy/i.test(l)), lines.join('\n'))
})

// ---------------------------------------------------------------------------
// The four Cleanup rows (spec sections 7 and 8)
//
// A Cleanup row is not a content step: its words are keyed by kind under
// content.cleanup and the CleanupBody draws them. The owner left these rows out
// of the 2026-09-19 anatomy change, so these tests check the words and check
// that the shape did not move.
// ---------------------------------------------------------------------------

const cleanupOf = (kind: string): { why: string; whatToDo: string[]; doneWhen: string[]; learn?: { url: string } | null } => {
  const entry = cleanupEntry(kind)
  assert.ok(entry, `content.cleanup has no ${kind} row`)
  return entry as { why: string; whatToDo: string[]; doneWhen: string[]; learn?: { url: string } | null }
}

test('F1: the alert rule matches the accounts’ object IDs, not their sign-in names', () => {
  // The query IAMAI fills from the saved accounts (ui/surfaces/alertingTasks.ts): object IDs, as Microsoft's own.
  const steps = cleanupOf('alerting').whatToDo.join('\n')
  assert.match(steps, /\{alertQuery\}/)
  assert.doesNotMatch(steps, /UserPrincipalName ==|where UserPrincipalName is one of/)
})

test('F5: the Cleanup rows keep their shape — Why, the instructions, Done when', () => {
  // Alert on Emergency Account Sign-ins is drawn on the step template (alertingTasks.ts) and carries its own words for it.
  for (const kind of ['hardening', 'naming', 'consolidation']) {
    const entry = cleanupOf(kind)
    assert.ok(typeof entry.why === 'string' && entry.why.length > 0, `${kind}: no Why`)
    assert.ok(entry.whatToDo.length > 0, `${kind}: no instructions`)
    assert.ok(entry.doneWhen.length > 0, `${kind}: no Done when`)
    assert.ok(entry.learn?.url, `${kind}: no Learn link`)
    // No row grew an anatomy of its own: these are the only four keys a row draws.
    assert.deepEqual(Object.keys(entry).sort(), ['doneWhen', 'learn', 'title', 'whatToDo', 'why'])
  }
})

test('K1: every Cleanup row reaches the prompt pack whole, not clipped at the block cap', () => {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture('demo')
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const rows = cleanupExportViews(r.schedule.cleanup)
    assert.ok(rows.length >= 3, 'the demo draws fewer Cleanup rows than this checks')
    const ctx = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[s.id] ?? null, naming: r.coverage.organisation.naming })
    const pack = promptPack({ view: (s: Step) => stepExportView(s, ctx(s)), tenant: 'Contoso', steps: r.steps, schedule: r.schedule, changeRecord: '', announcement: null, cleanup: rows })
    const summarise = pack.find((p) => /Summarise/i.test(p.title))
    assert.ok(summarise, 'the pack has no summarise prompt')
    for (const row of rows) {
      assert.ok(summarise.prompt.includes(row.title), `the pack drops ${row.kind}`)
      for (const line of [row.why, ...row.whatToDo, ...row.doneWhen]) {
        assert.ok(summarise.prompt.includes(line), `the pack clips ${row.kind}: ${line.slice(0, 60)}`)
      }
    }
  } finally {
    setDisplayTimeZone(null)
  }
})
