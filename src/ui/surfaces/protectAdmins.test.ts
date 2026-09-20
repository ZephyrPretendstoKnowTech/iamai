// The "Protect Your Administrators" group, taken to the V1 standard:
// docs/plans/protect-admins-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. One test per
// acceptance item in that spec.
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
import { fillText } from '../../content/render.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildNameDirectory } from '../../names.ts'
import { portalLines } from '../../roadmap/portalLines.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'

/** The group's five members, in registry order (roadmap/stepGroups.ts). */
const PROTECT_ADMINS = [
  's-ladder-operator-passkey',
  's-prereq-auth-strength',
  's-goal-admins-phishing-resistant',
  's-goal-admin-session',
  's-goal-pim-activation-reauth',
]

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
      const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
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

/** A content step's own instruction lines, unfilled. */
const stepsOf = (id: string): string[] =>
  ((stepById[id] as unknown as { whatToDo?: { steps?: string[] } }).whatToDo?.steps ?? []) as string[]

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

/** The step's About sentence as the opened step fills it. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

/** Every Implementation Task line the opened step lists, as one block of text. */
const tasksTextOf = (b: StepBody): string =>
  (b.emergencyAccountTasks?.tasks ?? []).map((t) => [t.title, ...t.steps, ...(t.facts ?? []).map((f) => `${f.label}: ${f.value}`)].join('\n')).join('\n')

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the group draws its five members in the spec order', () => {
  assert.deepEqual([...membersOf('protect-admins')], PROTECT_ADMINS)
})

// ---------------------------------------------------------------------------
// Register Your Own Passkey (spec section 2)
// ---------------------------------------------------------------------------

const PASSKEY = 's-ladder-operator-passkey'

test('A1: registration starts where Microsoft documents it, not at the old shortcut', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /https:\/\/mysignins\.microsoft\.com\/security-info/)
  assert.doesNotMatch(steps, /aka\.ms\/mfasetup/)
  assert.match(blockText(PASSKEY, 'entra.register'), /https:\/\/mysignins\.microsoft\.com\/security-info/)
})

test('A2: the five-minute window before a passkey can be registered is stated', () => {
  assert.match(stepsOf(PASSKEY).join('\n'), /only be registered within five minutes of a completed prompt/)
  assert.match(blockText(PASSKEY, 'entra.register'), /an MFA completed in the last five minutes/)
})

test('A3: the two methods are named by their own menu entries, and either is enough', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /Add sign-in method → Passkey registers a security key/)
  assert.match(steps, /Add sign-in method → Passkey in Microsoft Authenticator registers one in the app/)
  assert.match(steps, /Either one is enough, and Microsoft recommends a security key for elevated privileges/)
})

test('A4: a refused passkey names the three settings that refuse it', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /Allow self-service set up, which stops registration here when it is No/)
  assert.match(steps, /enforced attestation/)
  assert.match(steps, /key restriction that excludes the key you used/)
})

test('A5: the step links the page that carries the registration procedure', () => {
  const b = bodiesOf('demo').get(PASSKEY)!
  assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/identity/authentication/how-to-register-passkey-with-security-key')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)[PASSKEY]?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === b.learnUrl), 'the package cites a different page from the step')
})

test('A6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(PASSKEY), '2026-09-20')
  assert.equal(bodiesOf('demo').get(PASSKEY)!.sourceLine, 'Source checked Sep 20, 2026')
})

test('A7: the step says its own outcome in every state, because {operator} resolves', () => {
  // stepVars set `operator` only inside the block for steps that carry checks,
  // and this step carries none, so its Who line and its Completion Criteria
  // were both dropped for a hole and the step fell back to sentences about
  // accounts and assessed configuration.
  for (const [name, want] of [['demo', 'Casey Kim'], ['messy', 'Priya Taylor']] as const) {
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
  for (const fx of readdirSync('docs/qa/step-snapshots')) {
    for (const f of readdirSync(join('docs/qa/step-snapshots', fx))) {
      const snap = JSON.parse(readFileSync(join('docs/qa/step-snapshots', fx, f), 'utf8')) as { tiles: { label: string; state: string }[] }
      for (const t of snap.tiles) {
        // The step a prerequisite card names is its heading now, and the
        // prerequisite word is its check (owner, 2026-09-20; quality audit 2.4).
        if (/^(cleanup|s)-[a-z0-9-]+$/.test(t.label)) raw.push(`${fx}/${f}: ${t.label}`)
        if (t.label === 'Verify Emergency Access') named.push(`${fx}/${f}`)
      }
    }
  }
  assert.deepEqual(raw, [], 'a step tile shows a raw step id instead of a title')
  assert.ok(named.some((n) => n.endsWith(`${PASSKEY}.json`)), named.join(' | '))
})

// ---------------------------------------------------------------------------
// Create the Baseline's Authentication Strength (spec section 3)
// ---------------------------------------------------------------------------

const STRENGTH = 's-prereq-auth-strength'

test('B1: the strength is made under Authentication methods, the one place Microsoft puts it', () => {
  const steps = stepsOf(STRENGTH).join('\n')
  assert.match(steps, /Authentication methods → Authentication strengths → New authentication strength/)
  assert.match(steps, /It takes the Security Administrator role, and it is not under Conditional Access\./)
  assert.doesNotMatch(steps, /Conditional Access → Authentication strengths/)
  // The step and its package give the same path, so the fact has one source.
  assert.match(blockText(STRENGTH, 'entra.create'), /Entra admin center → Entra ID → Authentication methods → Authentication strengths/)
})

test('B2: the baseline strength carries both Temporary Access Pass forms, said once in the evidence', () => {
  // `who.none` is drawn when no strength in the tenant matches; the demo has
  // none to match, so the sentence is read from the step it belongs to.
  const none = String(((stepById[STRENGTH] as unknown as { who?: { none?: string } }).who ?? {}).none ?? '')
  assert.match(none, /a Temporary Access Pass in both its one-time and its multi-use form/)
  // And the procedure that creates it still lists the two options separately.
  assert.match(stepsOf(STRENGTH).join('\n'), /Temporary Access Pass \(one-time\) · Temporary Access Pass \(multi-use\)/)
})

test('B3: If it goes wrong says when the strength can no longer be deleted', () => {
  const ifWrong = String((stepById[STRENGTH] as unknown as { ifWrong?: string }).ifWrong ?? '')
  assert.match(ifWrong, /^Delete the strength; no policy references it yet\./)
  assert.match(ifWrong, /Once one does, Entra refuses the delete and asks you to confirm every edit\./)
})

test('B4: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(STRENGTH), '2026-09-20')
  assert.equal(bodiesOf('demo').get(STRENGTH)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Require Phishing-Resistant MFA for Admins (spec section 4)
// ---------------------------------------------------------------------------

const ADMINS = 's-goal-admins-phishing-resistant'

test('C1: help desk says what a Temporary Access Pass does here, in both its forms', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(lines.some((l) => /satisfies this policy's strength in both its forms/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /Microsoft's own phishing-resistant strength accepts neither/.test(l)), lines.join('\n'))
})

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

test('C3: help desk names the Windows Hello prompt that never arrives after a password', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(
    lines.some((l) => /signed in with a password first is never prompted for Windows Hello/.test(l) && /Sign-in options/.test(l)),
    lines.join('\n'),
  )
})

test('C4: Completion Criteria is this step’s outcome, and never over-claims phishing resistance', () => {
  const end = String((stepById['admins-phishing-resistant'] as unknown as { doneEnd?: string }).doneEnd ?? '')
  assert.match(end, /^Admins in the baseline's built-in directory roles can only sign in to \{tenant\} with a method its authentication strength accepts/)
  assert.doesNotMatch(end, /phishing-resistant method/)
})

test('C5: the client-apps condition is left unconfigured, because that is what reaches them all', () => {
  const create = blockText(ADMINS, 'entra.create')
  assert.match(create, /Leave \*\*Conditions > Client apps\*\* unconfigured, with \*\*Configure\*\* at \*\*No\*\*/)
  assert.match(create, /Ticking every box instead sets a narrower list than the target/)
  // No fixture puts this policy in Partial — the demo has it in Report-only —
  // so the correction is read from the block that state would draw.
  assert.match(blockText(ADMINS, 'entra.correct-conditions'), /Leave Conditions → Client apps unconfigured, with Configure at No/)
})

test('C6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(ADMINS), '2026-09-20')
  assert.equal(bodiesOf('demo').get(ADMINS)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Shorten Admin Sessions (spec section 5)
// ---------------------------------------------------------------------------

const SESSION = 's-goal-admin-session'

test('D1: the generated portal line sets Configure to Yes, for every policy that narrows client apps', () => {
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
})

test('D1b: the step’s own procedures set Configure to Yes, on screen and in the correction', () => {
  // The demo has no such policy, so the create procedure is the one on screen.
  const tasks = tasksTextOf(bodiesOf('demo').get(SESSION)!)
  assert.match(tasks, /set \*\*Configure\*\* to \*\*Yes\*\*, then select \*\*Browser\*\* only/)
  assert.match(tasks, /Left at \*\*No\*\*, the condition reaches every client app/)
  // And the correction, for the state no fixture is in.
  assert.match(blockText(SESSION, 'entra.correct-conditions'), /Conditions → Client apps → Configure: Yes, then Browser only, because at No the condition reaches every client app/)
})

test('D2: turning off Remember MFA on trusted devices is a risk and a first step', () => {
  assert.ok(
    risksOf('admin-session').some((t) => /Remember multifactor authentication on trusted devices, left on, prompts these admins at times neither setting intends/.test(t)),
    risksOf('admin-session').join('\n'),
  )
  assert.match(blockText(SESSION, 'entra.create'), /turn \*\*Remember multifactor authentication on trusted devices\*\* off/)
})

test('D3: help desk says the Stay signed in? prompt stops working for these admins', () => {
  const lines = helpDeskOf('admin-session')
  assert.ok(lines.some((l) => /Stay signed in\? stops working for these admins/.test(l)), lines.join('\n'))
})

test('D4: only the resolved target names the interval; the package no longer repeats it', () => {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[SESSION]
  const all = Object.values(pkg?.blocks ?? {}).map((b) => b.text ?? '').join('\n')
  assert.doesNotMatch(all, /\b4 hours\b|four-hour|four hours/)
  assert.match(blockText(SESSION, 'entra.create'), /set to the interval in the intended target shown on this step/)
  // The step's own words read it from the target already.
  assert.match(((stepById['admin-session'] as unknown as { whatToDoReference?: { new?: string[] } }).whatToDoReference?.new ?? []).join('\n'), /\{wantedValue\}/)
})

test('D5: Completion Criteria still says the shorter of two sign-in frequencies wins', () => {
  const b = bodiesOf('demo').get(SESSION)!
  assert.ok(
    b.contract.doneWhen.some((l: string) => /where both apply, the shorter sign-in frequency is the one that takes effect/.test(l)),
    b.contract.doneWhen.join('\n'),
  )
})

test('D6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(SESSION), '2026-09-20')
  assert.equal(bodiesOf('demo').get(SESSION)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Require MFA at Every Role Activation (spec section 6)
// ---------------------------------------------------------------------------

const PIM = 's-goal-pim-activation-reauth'

/** The step's reviewer reference procedure, joined. */
const referenceOf = (id: string): string =>
  ((stepById[id] as unknown as { whatToDoReference?: { steps?: string[] } }).whatToDoReference?.steps ?? []).join('\n')

test('E1: the PIM role setting comes after the policy is On, and the step says what report-only costs', () => {
  const ref = referenceOf('pim-activation-reauth')
  assert.match(ref, /After the policy is On, and not before/)
  assert.ok(
    risksOf('pim-activation-reauth').some((t) => /requires nothing at all on activation/.test(t) && /fall back to MFA on activation is not triggered in that state/.test(t)),
    risksOf('pim-activation-reauth').join('\n'),
  )
  // The package said this already; the reference used to contradict it.
  assert.match(blockText(PIM, 'entra.observe'), /Do not configure the PIM role authentication-context rule yet/)
})

test('E2: the PIM role settings path is the one Microsoft documents', () => {
  const want = /ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles/
  assert.match(referenceOf('pim-activation-reauth'), want)
  assert.match(blockText(PIM, 'entra.pim.configure'), want)
  assert.match(blockText(PIM, 'entra.pim.configure'), /\*\*Role settings\*\* → \*\*Edit\*\*/)
  assert.doesNotMatch(referenceOf('pim-activation-reauth'), /Entra roles → Settings/)
})

test('E3: the policy targets all users, and says why it must not target the roles', () => {
  const ref = referenceOf('pim-activation-reauth')
  assert.match(ref, /never directory roles: at activation the person does not hold the role yet, so a role-scoped policy would not apply/)
  assert.match(blockText(PIM, 'entra.policy.create'), /Never scope this policy to directory roles/)
})

test('E4: the old activation option is called weaker, not redundant', () => {
  const risks = risksOf('pim-activation-reauth')
  assert.ok(risks.some((t) => /accepts a check from earlier in the session, so it is weaker than this rather than the same/.test(t)), risks.join('\n'))
  assert.ok(!risks.some((t) => /is redundant with this/.test(t)), risks.join('\n'))
})

test('E5: help desk says where the context stops and which step carries on', () => {
  const lines = helpDeskOf('pim-activation-reauth')
  assert.ok(
    lines.some((l) => /checked at activation only/.test(l) && /Require Phishing-Resistant MFA for Admins is what covers the role once it is active/.test(l)),
    lines.join('\n'),
  )
})

test('E6: the reuse window is named, with the roles it spans', () => {
  const manager = String(((stepById['pim-activation-reauth'] as unknown as { more?: { manager?: string } }).more ?? {}).manager ?? '')
  assert.match(manager, /reused for another activation within ten minutes, across Entra roles, Azure resource roles and groups/)
})

test('E7: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(PIM), '2026-09-20')
})

void aboutOf
