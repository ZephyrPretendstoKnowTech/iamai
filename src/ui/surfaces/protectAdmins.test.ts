// The "Protect Your Administrators" steps, taken to the V1 standard:
// docs/plans/protect-admins-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. The tests kept
// here are the spec items that protect a person or a policy's scope.
//
// A test here reads the OPENED STEP, not the content file, wherever the claim is
// about what an admin sees: the acceptance is what is on screen (CLAUDE.md).
// Where a claim is about a lifecycle state no fixture reaches, the compiled
// package block is read instead, because that is the text the state would draw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { shared, stepById } from '../../content/content.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildNameDirectory } from '../../names.ts'
import { portalLines } from '../../roadmap/portalLines.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { cleanupEntry } from './cleanupExport.ts'

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
function bodiesOf(name: FixtureName): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const out = new Map<string, StepBody>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      const lane = laneViewFor(step, { readings, titleOf })
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
    }
    return out
  } finally {
    setDisplayTimeZone(null)
  }
}

/** A compiled package block's authored text, for a lifecycle state no fixture reaches. */
function blockText(stepId: string, blockId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  const text = pkg?.blocks?.[blockId]?.text
  assert.ok(typeof text === 'string' && text !== '', `${stepId}: the package has no ${blockId} block`)
  return text as string
}

/** The package's own last-checked date (project.ts sourceUpdatedOn reads the max). */
function checkedOn(stepId: string): string {
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { checkedOn: string }[] } }>)[stepId]?.meta
  const dates = (meta?.verifiedSources ?? []).map((s) => s.checkedOn).sort()
  return dates[dates.length - 1] ?? ''
}

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

/** Every Implementation Task line the opened step lists, as one block of text. */
const tasksTextOf = (b: StepBody): string =>
  (b.emergencyAccountTasks?.tasks ?? []).map((t) => [t.title, ...t.steps, ...(t.facts ?? []).map((f) => `${f.label}: ${f.value}`)].join('\n')).join('\n')

// ---------------------------------------------------------------------------
// Register Your Own Passkey (spec section 2)
// ---------------------------------------------------------------------------

const PASSKEY = 's-ladder-operator-passkey'

test('A7: the step says its own outcome in every state, because {operator} resolves', () => {
  // stepVars set `operator` only inside the block for steps that carry checks,
  // and this step carries none, so its Who line and its Completion Criteria
  // were both dropped for a hole and the step fell back to sentences about
  // accounts and assessed configuration.
  // `messy` has two Priya Taylors, which is why the operator carries their
  // sign-in address here and the demo operator does not (names.ts
  // personLabels): a step that names one person names which one.
  for (const [name, want] of [['demo', 'Casey Kim'], ['messy', 'Priya Taylor (user0@messy.example.com)']] as const) {
    const b = bodiesOf(name).get(PASSKEY)!
    assert.deepEqual(b.contract.doneWhen, [`${want} completed a phishing-resistant sign-in in the records.`], name)
    assert.doesNotMatch(b.contract.doneWhen.join('\n'), /accounts this step names|assessed configuration in place/, name)
  }
})

test('A8: the Cleanup row this step waits on is named, not printed as its id', () => {
  // Read from the recorded renderings, which stepSnapshots.test.ts holds equal
  // to the live plan: this step is the only prerequisite tile in the repository
  // that points at a Cleanup row, and it printed the row's id.
  const raw: string[] = []
  const named: string[] = []
  const titled: string[] = []
  for (const fx of readdirSync('docs/qa/step-snapshots')) {
    for (const f of readdirSync(join('docs/qa/step-snapshots', fx))) {
      const snap = JSON.parse(readFileSync(join('docs/qa/step-snapshots', fx, f), 'utf8')) as { tiles: { label: string; state: string }[] }
      for (const t of snap.tiles) {
        // The step a prerequisite card names is its heading now, and the
        // prerequisite word is its check (owner, 2026-09-20; quality audit 2.4).
        if (/^(cleanup|s)-[a-z0-9-]+$/.test(t.label)) raw.push(`${fx}/${f}: ${t.label}`)
        if (t.label === 'Verify Emergency Access') named.push(`${fx}/${f}`)
        if (/Prerequisite/.test(t.state) && t.label.length > 0) titled.push(t.label)
      }
    }
  }
  assert.deepEqual(raw, [], 'a step tile shows a raw step id instead of a title')
  // Non-vacuity: prerequisite tiles are drawn and carry titles. The anchor used
  // to be the Cleanup row itself, on the passkey step. It is not drawn there any
  // more and should not be: Verify Emergency Access waits on Configure Passkey
  // Authentication, so the tile now names the step that can be done first
  // (stepContract.ts directOnly). The rule above — never a raw id — is what this
  // test is for, and the cleanup path it was written for is covered directly
  // below rather than through whichever step happens to list it.
  assert.ok(named.length + titled.length > 20, `prerequisite tiles found: ${titled.length}`)
  assert.equal(cleanupEntry('drill')?.title, 'Verify Emergency Access', 'a Cleanup row still resolves to its title')
})

// ---------------------------------------------------------------------------
// Create the Baseline's Authentication Strength (spec section 3)
// ---------------------------------------------------------------------------

const STRENGTH = 's-prereq-auth-strength'

// ---------------------------------------------------------------------------
// Require Phishing-Resistant MFA for Admins (spec section 4)
// ---------------------------------------------------------------------------

const ADMINS = 's-goal-admins-phishing-resistant'

test('C2: no line still enumerates the accepted methods against the strength', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(!lines.some((l) => /Only a registered passkey, security key or Windows Hello gets through/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /Anything the strength does not list is refused/.test(l)), lines.join('\n'))
  // And the lockout risk beside it reads the same way, so no two cards disagree
  // about whether a Temporary Access Pass gets an admin in.
  const risks = risksOf('admins-phishing-resistant')
  assert.ok(risks.some((t) => /An admin holding no method the strength accepts is locked out of admin work\./.test(t)), risks.join('\n'))
  assert.ok(!risks.some((t) => /without a passkey, security key or Windows Hello for Business/.test(t)), risks.join('\n'))
})

// ---------------------------------------------------------------------------
// Shorten Admin Sessions (spec section 5)
// ---------------------------------------------------------------------------

const SESSION = 's-goal-admin-session'

test("D1: the client-apps condition is Configure: Yes, then Browser, in the translator's line and in the step's own procedures", () => {
  {
    // The one place the product composes this line (roadmap/portalLines.ts): the
    // close-doors packages carried the toggle in their authored words, the
    // translator did not, and the translator is what a policy step renders.
    const p = (pinned.policies as unknown as { id: string; displayName: string }[]).find((x) => x.id === '04b969aa-3e98-4e0f-8b32-2319b199b56a')!
    const dir = buildNameDirectory(null, [], new Map())
    const lines = portalLines(policyFacts(p as never, new Map()), {
      policyName: p.displayName,
      nameOf: (id: string) => dir.label(id),
      portalRoot: shared.portalRoot as string,
      reportOnlyLine: shared.reportOnlyLine as string,
      exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', 'the exclusions group'),
    })
    assert.ok(
      lines.includes('Conditions → Client apps → Configure: Yes, then Browser. Left at No it reaches every client app.'),
      lines.join('\n'),
    )
    // The step's reviewer reference says the same, so the two cannot drift.
    const ref = ((stepById['admin-session'] as unknown as { whatToDoReference?: { new?: string[] } }).whatToDoReference?.new ?? []).join('\n')
    assert.ok(ref.includes('Conditions → Client apps → Configure: Yes, then Browser. Left at No it reaches every client app.'), ref)
  }
  {
    // The demo has no such policy, so the create procedure is the one on screen.
    const tasks = tasksTextOf(bodiesOf('demo').get(SESSION)!)
    assert.match(tasks, /set \*\*Configure\*\* to \*\*Yes\*\*, then select \*\*Browser\*\* only/)
    assert.match(tasks, /Left at \*\*No\*\*, the condition reaches every client app/)
    // And the correction, for the state no fixture is in.
    assert.match(blockText(SESSION, 'entra.correct-conditions'), /Conditions → Client apps → Configure: Yes, then Browser only, because at No the condition reaches every client app/)
  }
})

test('D4: only the resolved target names the interval; the package no longer repeats it', () => {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[SESSION]
  const all = Object.values(pkg?.blocks ?? {}).map((b) => b.text ?? '').join('\n')
  assert.doesNotMatch(all, /\b4 hours\b|four-hour|four hours/)
  assert.match(blockText(SESSION, 'entra.create'), /set to the interval in the intended target shown on this step/)
  // The step's own words read it from the target already.
  assert.match(((stepById['admin-session'] as unknown as { whatToDoReference?: { new?: string[] } }).whatToDoReference?.new ?? []).join('\n'), /\{wantedValue\}/)
})

// ---------------------------------------------------------------------------
// Require MFA at Every Role Activation (spec section 6)
// ---------------------------------------------------------------------------

const PIM = 's-goal-pim-activation-reauth'

/** The step's reviewer reference procedure, joined. */
const referenceOf = (id: string): string =>
  ((stepById[id] as unknown as { whatToDoReference?: { steps?: string[] } }).whatToDoReference?.steps ?? []).join('\n')

test('E1: the PIM role setting comes after the policy is On, and the policy targets all users, never the roles', () => {
  {
    const ref = referenceOf('pim-activation-reauth')
    assert.match(ref, /After the policy is On, and not before/)
    assert.ok(
      risksOf('pim-activation-reauth').some((t) => /requires nothing at all on activation/.test(t) && /fall back to MFA on activation is not triggered in that state/.test(t)),
      risksOf('pim-activation-reauth').join('\n'),
    )
    // The package said this already; the reference used to contradict it.
    assert.match(blockText(PIM, 'entra.observe'), /Do not configure the PIM role authentication-context rule yet/)
  }
  {
    const ref = referenceOf('pim-activation-reauth')
    assert.match(ref, /never directory roles: at activation the person does not hold the role yet, so a role-scoped policy would not apply/)
    assert.match(blockText(PIM, 'entra.policy.create'), /Never scope this policy to directory roles/)
  }
})

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

test('each step links a page its package cites, and shows the date its Microsoft sources were checked', () => {
  const demo = bodiesOf('demo')
  const passkey = demo.get(PASSKEY)!
  assert.equal(passkey.learnUrl, 'https://learn.microsoft.com/entra/identity/authentication/how-to-register-passkey-with-security-key')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)[PASSKEY]?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === passkey.learnUrl), 'the package cites a different page from the step')
  for (const id of [PASSKEY, STRENGTH, ADMINS, SESSION]) {
    assert.equal(checkedOn(id), '2026-09-20', id)
    assert.equal(demo.get(id)!.sourceLine, 'Source checked Sep 20, 2026', id)
  }
  assert.equal(checkedOn(PIM), '2026-09-20')
})
