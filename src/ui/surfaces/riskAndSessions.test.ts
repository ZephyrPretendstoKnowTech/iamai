// The "Respond to Risk and Limit Sessions" steps, taken to the V1 standard:
// docs/plans/risk-and-sessions-spec.md holds the outcome, the Microsoft Learn
// page behind every technical claim and the date it was checked. The tests kept
// here are the spec items that decide what a policy reaches and who it locks out,
// and the pinned baseline's own grants and exclusions.
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
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../../coverage/facts.ts'
import { portalLines } from '../../roadmap/portalLines.ts'
import { buildNameDirectory } from '../../names.ts'
import { stepExportView } from './stepExport.ts'
import { stepArtifactLines } from '../../roadmap/artifactLines.ts'
import type { ExportStep } from '../../roadmap/types.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The spec's six steps (docs/plans/risk-and-sessions-spec.md), in its order. The roadmap flow puts the risk steps in Extend MFA Coverage and the session steps in Limit Sessions and Require Healthy Devices (roadmap/stepGroups.ts). */
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

/** Every step's export view on a fixture: the one reading the print, the calendar and the prompt pack are built from. */
function viewsOf(name: FixtureName): Map<string, ExportStep> {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const out = new Map<string, ExportStep>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      if (!reading) continue
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      out.set(step.id, stepExportView(step, ctx, laneViewOf(reading, titleOf)))
    }
    return out
  } finally {
    setDisplayTimeZone(null)
  }
}

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

const USER_RISK_MEDIUM = 's-goal-user-risk-medium'
const SESSIONS = 's-goal-all-users-no-persistence'
/** The session step's package is keyed by the merged content entry's id, not the step's. */
const SESSIONS_PKG = 's-goal-session-lifetime'

test('S1: every member reads the same About sentence on screen, in the export and in the prompt pack', () => {
  // The screen's sentence, the export view's `why` and the prompt pack's lead
  // line are one string (roadmap/artifactLines.ts leads with v.why), so this
  // asserts they are still that one string for each member the fixture carries,
  // on both the fixture with P2 and the one without.
  for (const name of ['mid', 'demo'] as const) {
    const bodies = bodiesOf(name)
    const views = viewsOf(name)
    for (const id of RISK_AND_SESSIONS) {
      const b = bodies.get(id)
      if (!b) continue
      const onScreen = aboutOf(b)
      assert.ok(onScreen.length > 0, `${name}/${id}: About this Step is empty`)
      const view = views.get(id)!
      assert.equal(view.why, onScreen, `${name}/${id}: the export view's About sentence is not the screen's`)
      assert.equal(stepArtifactLines(view)[0], onScreen, `${name}/${id}: the prompt pack's lead line is not the screen's`)
      assert.ok(!/\{[a-zA-Z]/.test(onScreen), `${name}/${id}: an unfilled variable reached the reader: ${onScreen}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Section 2: the Configure trap, fixed in the translator
// ---------------------------------------------------------------------------

test("T1: a target that narrows sign-in risk, user risk, device platforms or client apps says Configure: Yes, in the translator's lines and in the session step's own procedures", () => {
  {
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
  }
  {
    // concept-conditional-access-conditions (ms.date 2026-06-02), checked
    // 2026-09-20. Left at No the interval would reach desktop and mobile apps,
    // which is where sign-in frequency's documented known issues live.
    assert.ok(linesForPinned('ea9459a9-91b6-4d2b-b929-03781ac81d54').includes('Conditions → Client apps → Configure: Yes, then Browser. Left at No it reaches every client app.'), linesForPinned('ea9459a9-91b6-4d2b-b929-03781ac81d54').join('\n'))
    assert.ok(referenceOf('session-lifetime').includes('Conditions → Client apps → Configure: Yes, then Browser. Left at No it reaches every client app.'), referenceOf('session-lifetime'))
    assert.match(blockText(SESSIONS_PKG, 'entra.create-set'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*Browser\*\* only/)
    assert.match(blockText(SESSIONS_PKG, 'entra.correct.browser.conditions'), /Configure: Yes, then Browser only, because at No the condition reaches every client app/)
  }
})

// ---------------------------------------------------------------------------
// Sections 3 to 6: the four risk steps
// ---------------------------------------------------------------------------

test('a person the risk policies reach who cannot answer them is said to be blocked, not prompted: nobody registers a method during a risky sign-in, and a risky guest cannot remediate here', () => {
  {
    // policy-risk-based-sign-in, checked 2026-09-20: "The sign-in risk-based policy
    // prevents users from registering MFA during risky sessions. If users aren't
    // registered for MFA, their risky sign-ins are blocked, and they receive an
    // AADSTS53004 error."
    assert.ok(risksOf('sign-in-risk').some((r) => /blocked, not prompted/.test(r) && /stops them registering one during the risky sign-in/.test(r)), risksOf('sign-in-risk').join('\n'))
    assert.ok(helpDeskOf('sign-in-risk').some((l) => l.includes('AADSTS53004')), helpDeskOf('sign-in-risk').join('\n'))
  }
  {
    // howto-identity-protection-configure-risk-policies, checked 2026-09-20: "Users
    // must register for Microsoft Entra multifactor authentication before they face
    // a situation requiring remediation… Users not registered are blocked and
    // require administrator intervention." howto-identity-protection-remediate-unblock:
    // "This flow doesn't use self-service password reset (SSPR)."
    const text = allText('user-risk')
    assert.match(text, /registered for multifactor authentication before this policy reaches them/)
    assert.match(text, /this is not the self-service password reset flow/)
    assert.ok(risksOf('user-risk').some((r) => /no registered multifactor authentication method cannot complete remediation at all/.test(r)), risksOf('user-risk').join('\n'))
  }
  {
    // concept-identity-protection-b2b, checked 2026-09-20: a guest forced to reset
    // "will be blocked"; "Administrators cannot dismiss or remediate a risky B2B
    // collaboration user in their resource directory."
    const text = allText('user-risk')
    assert.match(text, /guests rated high risk: they cannot remediate in this tenant/)
    assert.ok(risksOf('user-risk').some((r) => /blocked rather than remediated/.test(r)), risksOf('user-risk').join('\n'))
    assert.ok(helpDeskOf('user-risk').some((l) => /home directory/.test(l)), helpDeskOf('user-risk').join('\n'))
  }
  {
    assert.ok(risksOf('sign-in-risk-medium').some((r) => /blocked rather than prompted/.test(r)), risksOf('sign-in-risk-medium').join('\n'))
    const hd = helpDeskOf('sign-in-risk-medium').join('\n')
    assert.match(hd, /clears the sign-in risk by itself/)
    assert.match(hd, /AADSTS53004/)
    assert.ok(!/dismiss the risk in Identity Protection/.test(hd), hd)
  }
})

test('every risk and session step describes what the pinned baseline holds: its grant, its session control, its guest exclusion and its interval (owner, 2026-09-20)', () => {
  {
    // The pinned member carries builtInControls ["riskRemediation"] with the custom
    // authentication strength, not "Require multifactor authentication and Require
    // password change". policy-risk-based-user (ms.date 2026-03-24), checked
    // 2026-09-20: "Select Require risk remediation. The Require authentication
    // strength grant control is automatically selected."
    const text = allText('user-risk')
    assert.match(text, /risk remediation with \{strengthName\}/)
    assert.ok(!/Require multifactor authentication and Require password change/.test(text), text)
    assert.ok(referenceOf('user-risk').includes('Grant → Require risk remediation with Require authentication strength: {strengthName}'), referenceOf('user-risk'))
    // And it is what the pinned policy holds.
    const p = (pinned.policies as unknown as { id: string; grantControls: { builtInControls?: string[] } }[]).find((x) => x.id === '544cd9ef-5e37-4568-9ad8-b8e151be1814')!
    assert.deepEqual(p.grantControls.builtInControls, ['riskRemediation'])
  }
  {
    // The pinned member carries builtInControls ["mfa"] and sessionControls null:
    // not an authentication strength, and not Every time.
    const p = (pinned.policies as unknown as { id: string; grantControls: { builtInControls?: string[] }; sessionControls: unknown }[]).find((x) => x.id === '180ab5a3-d3ae-4457-9ef1-e3c06f5dfbfc')!
    assert.deepEqual(p.grantControls.builtInControls, ['mfa'])
    assert.equal(p.sessionControls, null)
    const ref = referenceOf('sign-in-risk-medium')
    assert.ok(ref.includes('Grant → Require multifactor authentication. No session control: the baseline sets none here'), ref)
    assert.ok(!/Require authentication strength: Multifactor authentication/.test(ref), ref)
    assert.ok(!/Sign-in frequency → Every time/.test(ref), ref)
    assert.match(allText('sign-in-risk-medium'), /not the authentication strength the High-risk policy uses, and it adds no session control/)
  }
  {
    // The pinned member carries builtInControls ["passwordChange"] with the custom
    // authentication strength and no session control. conditionalAccessGrantControls
    // v1.0 (ms.date 2026-04-06), checked 2026-09-20: "passwordChange must be
    // accompanied by mfa using an AND operator" — a pair that reference does not
    // describe. The pinned baseline wins (CLAUDE.md, owner 2026-09-20), so the JSON
    // and PowerShell moved to the pin's pair and the caveat that explained the
    // divergence is gone. Cross-channel agreement is asserted in
    // src/content/implementation/channelParity.test.ts.
    const p = (pinned.policies as unknown as { id: string; grantControls: { builtInControls?: string[]; authenticationStrength?: unknown }; sessionControls: unknown }[]).find((x) => x.id === '7475b373-0544-4ee8-8827-cff35009136d')!
    assert.deepEqual(p.grantControls.builtInControls, ['passwordChange'])
    assert.ok(p.grantControls.authenticationStrength, 'the pinned member carries an authentication strength')
    assert.equal(p.sessionControls, null)
    const ref = referenceOf('user-risk-medium')
    assert.ok(ref.includes('Grant → Require authentication strength: {strengthName} and Require password change'), ref)
    assert.ok(!/Sign-in frequency → Every time/.test(ref), ref)
    assert.match(blockText(USER_RISK_MEDIUM, 'entra.create'), /Require authentication strength/)
    assert.doesNotMatch(blockText(USER_RISK_MEDIUM, 'entra.create'), /the JSON and PowerShell outputs on this step write/)
    assert.match(blockText(USER_RISK_MEDIUM, 'json.create'), /"builtInControls": \["passwordChange"\]/)
    assert.match(blockText(USER_RISK_MEDIUM, 'powershell.run'), /builtInControls=@\('passwordChange'\)/)
  }
  {
    const text = allText('user-risk-medium')
    assert.match(text, /Guests and external accounts are excluded from this policy/)
    assert.match(text, /held in their home directory/)
    assert.match(text, /\{list:mediumRiskUsers\}/)
    // The exclusion is the pin's, not an invention.
    const p = (pinned.policies as unknown as { id: string; conditions: { users: { excludeGuestsOrExternalUsers?: unknown } } }[]).find((x) => x.id === '7475b373-0544-4ee8-8827-cff35009136d')!
    assert.ok(p.conditions.users.excludeGuestsOrExternalUsers, 'the pinned member excludes guests')
  }
  {
    assert.ok(!/12[- ]hour/.test(allText('session-lifetime')), allText('session-lifetime'))
    assert.ok(!/12[- ]hour/.test(packageText(SESSIONS_PKG)), 'the package names no interval of its own')
    assert.match(allText('session-lifetime'), /re-authenticate every \{wanted\}/)
    // The demo fills it from the target, so the sentence still reads as a number.
    assert.match(aboutOf(bodiesOf('demo').get(SESSIONS)!), /persistent browser/i)
  }
})

// ---------------------------------------------------------------------------
// Section 7: s-goal-all-users-no-persistence — Limit How Long Sessions Last
// ---------------------------------------------------------------------------

test('E5: the two session steps each say whose sessions, and neither repeats the other', () => {
  // The owner's rule: "Shorten Admin Sessions" and "Limit How Long Sessions
  // Last" are two policies, and each Completion Criteria says whose sessions it
  // is about. Group 4 wrote the admin one; this one agrees with it from the
  // other side rather than restating it.
  const mine = doneWhenOf('session-lifetime')
  const admin = doneWhenOf('admin-session')
  assert.ok(mine.some((l) => /On for all users in the browser/.test(l)), mine.join('\n'))
  assert.ok(admin.some((l) => /On for the administrator roles it names/.test(l)), admin.join('\n'))
  assert.ok(mine.some((l) => /Shorten Admin Sessions asks the administrator roles it names to sign in more often than this/.test(l)), mine.join('\n'))
  assert.ok(admin.some((l) => /Limit How Long Sessions Last covers these administrators too, as part of everyone/.test(l)), admin.join('\n'))
  // Neither line is the other's.
  assert.equal(mine.filter((l) => admin.includes(l)).length, 0, 'no Completion Criteria line is shared between the two session steps')
})
