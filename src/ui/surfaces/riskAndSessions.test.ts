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

// ---------------------------------------------------------------------------
// Section 3: s-goal-sign-in-risk — Challenge High-Risk Sign-ins
// ---------------------------------------------------------------------------

test('A1: About this Step says what sign-in risk measures, about one request', () => {
  // policy-risk-based-sign-in (ms.date 2026-03-24), checked 2026-09-20: "Sign-in
  // risk represents the likelihood that an authentication request isn't from the
  // identity owner."
  const why = whyOf('sign-in-risk')
  assert.match(why, /one authentication request/)
  assert.match(why, /did not come from the person who owns the account/)
  assert.ok(!/flags a sign-in as suspicious/.test(why), why)
  // And it is the sentence the opened step draws on the fixture that carries P2.
  assert.match(aboutOf(bodiesOf('mid').get(SIGN_IN_RISK)!), /one authentication request/)
})

test('A2: the risk condition is set through Configure: Yes, in create and in correct', () => {
  assert.match(blockText(SIGN_IN_RISK, 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*, then check High only/)
  assert.match(blockText(SIGN_IN_RISK, 'entra.create'), /Left at \*\*No\*\* the policy carries no risk condition/)
  assert.match(blockText(SIGN_IN_RISK, 'entra.correct.risk'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*High\*\* only/)
  assert.ok(referenceOf('sign-in-risk').includes('Conditions → Sign-in risk → Configure: Yes, then High'), referenceOf('sign-in-risk'))
})

test('A3: the Client apps condition is left unconfigured, and the words say why', () => {
  // The pinned target is clientAppTypes ["all"], which is the unconfigured
  // value: ticking every box writes the four named types instead.
  assert.match(blockText(SIGN_IN_RISK, 'entra.create'), /leave \*\*Configure\*\* at \*\*No\*\*/)
  assert.match(blockText(SIGN_IN_RISK, 'entra.correct.conditions'), /Leave \*\*Client apps\*\* unconfigured/)
  assert.ok(!/Client apps remains All/.test(packageText(SIGN_IN_RISK)), 'no line calls the unconfigured condition a selection')
})

test('A4: the step names only the risk reading it has, and not Identity Protection detail', () => {
  const text = allText('sign-in-risk')
  assert.match(text, /read from the sign-in records/)
  assert.match(text, /Identity Protection's own risk reports are a separate surface this plan does not read/)
  assert.match(text, /counts as unknown, never as no risk/)
  // The people named are the ones the reach counts (derive/contentLists.ts riskyUsers).
  assert.match(text, /\{list:riskyUsers\}/)
})

test('A5: a person with no accepted method is blocked, not prompted, and cannot register during the sign-in', () => {
  // policy-risk-based-sign-in, checked 2026-09-20: "The sign-in risk-based policy
  // prevents users from registering MFA during risky sessions. If users aren't
  // registered for MFA, their risky sign-ins are blocked, and they receive an
  // AADSTS53004 error."
  assert.ok(risksOf('sign-in-risk').some((r) => /blocked, not prompted/.test(r) && /stops them registering one during the risky sign-in/.test(r)), risksOf('sign-in-risk').join('\n'))
  assert.ok(helpDeskOf('sign-in-risk').some((l) => l.includes('AADSTS53004')), helpDeskOf('sign-in-risk').join('\n'))
})

test('A6: help desk says answering the prompt clears the risk, and where it no longer does', () => {
  // howto-identity-protection-remediate-unblock, checked 2026-09-20: a completed
  // MFA challenge remediates the sign-in risk; token-theft-related detections are
  // no longer auto-remediated and need a secure password change.
  const hd = helpDeskOf('sign-in-risk').join('\n')
  assert.match(hd, /clears itself/)
  assert.match(hd, /secure password change/)
  assert.ok(!/then dismiss the risk in Identity Protection\./.test(hd), hd)
})

test('A7: Completion Criteria is this step’s own outcome', () => {
  const done = doneWhenOf('sign-in-risk').join('\n')
  assert.match(done, /Available risky sign-ins were reviewed/)
  assert.match(String((stepById['sign-in-risk'] as unknown as { doneEnd?: string }).doneEnd ?? ''), /cannot continue until it is answered with a method the selected grant accepts/)
})

test('A8: the package cites the page the step links, and its checked date is 2026-09-20', () => {
  assert.equal(sourceCheckedOn(SIGN_IN_RISK), '2026-09-20')
  assert.match(JSON.stringify((registry.packages as Record<string, unknown>)[SIGN_IN_RISK]), /policy-risk-based-sign-in/)
  assert.equal(String((stepById['sign-in-risk'] as unknown as { learn: { url: string } }).learn.url), 'https://learn.microsoft.com/entra/identity/conditional-access/policy-risk-based-sign-in')
})

// ---------------------------------------------------------------------------
// Section 4: s-goal-user-risk — Remediate High-Risk Users
// ---------------------------------------------------------------------------

test('B1: About this Step says user risk is about the account, and mostly read after a sign-in', () => {
  // concept-risk-detection-types (ms.date 2026-06-10), checked 2026-09-20: every
  // user-risk detection but three is "Calculated offline"; "User is deemed risky
  // after sign-in."
  const why = whyOf('user-risk')
  assert.match(why, /the account itself is compromised/)
  assert.match(why, /worked out after a sign-in/)
  assert.ok(!/outside a single suspicious sign-in/.test(why), why)
  assert.match(aboutOf(bodiesOf('mid').get(USER_RISK)!), /the account itself is compromised/)
})

test('B2: the step and its reference describe the grant the pin actually carries', () => {
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
})

test('B3: remediation needs a registered method, and is not the self-service reset flow', () => {
  // howto-identity-protection-configure-risk-policies, checked 2026-09-20: "Users
  // must register for Microsoft Entra multifactor authentication before they face
  // a situation requiring remediation… Users not registered are blocked and
  // require administrator intervention." howto-identity-protection-remediate-unblock:
  // "This flow doesn't use self-service password reset (SSPR)."
  const text = allText('user-risk')
  assert.match(text, /registered for multifactor authentication before this policy reaches them/)
  assert.match(text, /this is not the self-service password reset flow/)
  assert.ok(risksOf('user-risk').some((r) => /no registered multifactor authentication method cannot complete remediation at all/.test(r)), risksOf('user-risk').join('\n'))
})

test('B4: both hybrid password routes are named, not only writeback', () => {
  // The two Learn pages disagree on the prerequisite word, so both routes are
  // stated: howto-identity-protection-configure-risk-policies says "password
  // writeback must be enabled"; howto-identity-protection-remediate-unblock says
  // hybrid users remediate on-premises "when password hash synchronization and
  // the Allow on-premises password change to reset user risk setting is enabled".
  const before = ((stepById['user-risk'] as unknown as { whatToDo?: { before?: string[] } }).whatToDo?.before ?? []).join('\n')
  assert.match(before, /need password writeback in Entra Connect/)
  assert.match(before, /password hash synchronization and the on-premises password-change setting that clears user risk/)
})

test('B5: a guest this policy reaches is blocked, and nobody here can clear it', () => {
  // concept-identity-protection-b2b, checked 2026-09-20: a guest forced to reset
  // "will be blocked"; "Administrators cannot dismiss or remediate a risky B2B
  // collaboration user in their resource directory."
  const text = allText('user-risk')
  assert.match(text, /guests rated high risk: they cannot remediate in this tenant/)
  assert.ok(risksOf('user-risk').some((r) => /blocked rather than remediated/.test(r)), risksOf('user-risk').join('\n'))
  assert.ok(helpDeskOf('user-risk').some((l) => /home directory/.test(l)), helpDeskOf('user-risk').join('\n'))
})

test('B6: the risk condition is set through Configure: Yes, and Client apps is left alone', () => {
  assert.match(blockText(USER_RISK, 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*High\*\* only/)
  assert.match(blockText(USER_RISK, 'entra.correct.risk'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*High\*\* only/)
  assert.match(blockText(USER_RISK, 'entra.correct.conditions'), /Leave \*\*Client apps\*\* unconfigured/)
  assert.ok(referenceOf('user-risk').includes('Conditions → User risk → Configure: Yes, then High'), referenceOf('user-risk'))
})

// ---------------------------------------------------------------------------
// Section 5: s-goal-sign-in-risk-medium — Challenge Medium-Risk Sign-ins
// ---------------------------------------------------------------------------

test('C1: About this Step says what a medium rating means', () => {
  // concept-risk-detection-types (ms.date 2026-06-10), checked 2026-09-20:
  // "Medium indicates that one or more moderate-severity anomalies were
  // detected, but there's less confidence that the account is compromised."
  const why = whyOf('sign-in-risk-medium')
  assert.match(why, /one or more moderate anomalies/)
  assert.match(why, /less confident than it is at high/)
  assert.match(aboutOf(bodiesOf('mid').get(SIGN_IN_RISK_MEDIUM)!), /one or more moderate anomalies/)
})

test('C2: the step describes the grant and the absent session control the pin holds', () => {
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
})

test('C3: the risk condition is set through Configure: Yes, and Client apps is left alone', () => {
  assert.match(blockText(SIGN_IN_RISK_MEDIUM, 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*, then check Medium only/)
  assert.match(blockText(SIGN_IN_RISK_MEDIUM, 'entra.correct.risk'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*Medium\*\* only/)
  assert.match(blockText(SIGN_IN_RISK_MEDIUM, 'entra.correct.conditions'), /Leave \*\*Client apps\*\* unconfigured/)
  assert.ok(referenceOf('sign-in-risk-medium').includes('Conditions → Sign-in risk → Configure: Yes, then Medium'), referenceOf('sign-in-risk-medium'))
})

test('C4: this step names its own people, and its Completion Criteria is its own outcome', () => {
  // The medium step's reach is medium and high together (roadmap/evidence.ts),
  // so its list is mediumRiskUsers, never the high step's.
  assert.match(allText('sign-in-risk-medium'), /\{list:mediumRiskUsers\}/)
  assert.match(String((stepById['sign-in-risk-medium'] as unknown as { doneEnd?: string }).doneEnd ?? ''), /rates medium risk cannot continue until it is answered with multifactor authentication/)
  assert.notEqual(String((stepById['sign-in-risk-medium'] as unknown as { doneEnd?: string }).doneEnd ?? ''), doneWhenOf('sign-in-risk-medium')[0])
  assert.equal(sourceCheckedOn(SIGN_IN_RISK_MEDIUM), '2026-09-20')
})

test('C5: an unregistered person is blocked here too, and answering clears the risk', () => {
  assert.ok(risksOf('sign-in-risk-medium').some((r) => /blocked rather than prompted/.test(r)), risksOf('sign-in-risk-medium').join('\n'))
  const hd = helpDeskOf('sign-in-risk-medium').join('\n')
  assert.match(hd, /clears the sign-in risk by itself/)
  assert.match(hd, /AADSTS53004/)
  assert.ok(!/dismiss the risk in Identity Protection/.test(hd), hd)
})

// ---------------------------------------------------------------------------
// Section 6: s-goal-user-risk-medium — Reset Passwords for Medium-Risk Users
// ---------------------------------------------------------------------------

test('D1: the step names the grant pair the pin holds, and says which one the machine channels write', () => {
  // The pinned member carries builtInControls ["passwordChange"] with the custom
  // authentication strength and no session control. conditionalAccessGrantControls
  // v1.0 (ms.date 2026-04-06), checked 2026-09-20: "passwordChange must be
  // accompanied by mfa using an AND operator" — a pair that reference does not
  // describe, so the difference is stated instead of hidden.
  const p = (pinned.policies as unknown as { id: string; grantControls: { builtInControls?: string[]; authenticationStrength?: unknown }; sessionControls: unknown }[]).find((x) => x.id === '7475b373-0544-4ee8-8827-cff35009136d')!
  assert.deepEqual(p.grantControls.builtInControls, ['passwordChange'])
  assert.ok(p.grantControls.authenticationStrength, 'the pinned member carries an authentication strength')
  assert.equal(p.sessionControls, null)
  const ref = referenceOf('user-risk-medium')
  assert.ok(ref.includes('Grant → Require authentication strength: {strengthName} and Require password change'), ref)
  assert.ok(!/Sign-in frequency → Every time/.test(ref), ref)
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.create'), /Require authentication strength/)
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.create'), /the JSON and PowerShell outputs on this step write/)
})

test('D2: password change is never paired with risk remediation', () => {
  // conditionalAccessGrantControls v1.0, checked 2026-09-20: "passwordChange and
  // riskRemediation must be used separately, not in combination."
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.correct.grant'), /password change and risk remediation are used separately, never together/)
})

test('D3: the risk condition is set through Configure: Yes, and Client apps is left alone', () => {
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*, then \*\*Medium\*\* only/)
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.correct.risk'), /\*\*Configure: Yes\*\*, then Medium only/)
  assert.match(blockText(USER_RISK_MEDIUM, 'entra.correct.target'), /Leave \*\*Client apps\*\* unconfigured/)
  assert.ok(referenceOf('user-risk-medium').includes('Conditions → User risk → Configure: Yes, then Medium'), referenceOf('user-risk-medium'))
})

test('D4: the step says why guests are excluded here, and names its own people', () => {
  const text = allText('user-risk-medium')
  assert.match(text, /Guests and external accounts are excluded from this policy/)
  assert.match(text, /held in their home directory/)
  assert.match(text, /\{list:mediumRiskUsers\}/)
  // The exclusion is the pin's, not an invention.
  const p = (pinned.policies as unknown as { id: string; conditions: { users: { excludeGuestsOrExternalUsers?: unknown } } }[]).find((x) => x.id === '7475b373-0544-4ee8-8827-cff35009136d')!
  assert.ok(p.conditions.users.excludeGuestsOrExternalUsers, 'the pinned member excludes guests')
})

test('D5: Completion Criteria is this step’s outcome, and the package date is 2026-09-20', () => {
  assert.match(String((stepById['user-risk-medium'] as unknown as { doneEnd?: string }).doneEnd ?? ''), /rates medium risk cannot be used again until its owner has answered \{strengthName\} and changed the password/)
  assert.match(doneWhenOf('user-risk-medium').join('\n'), /the High user-risk policy remains in place/)
  assert.equal(sourceCheckedOn(USER_RISK_MEDIUM), '2026-09-20')
})

test('B7: Completion Criteria is this step’s outcome, and the package date is 2026-09-20', () => {
  assert.match(String((stepById['user-risk'] as unknown as { doneEnd?: string }).doneEnd ?? ''), /cannot be used again until its owner has completed the remediation \{strengthName\} accepts/)
  assert.match(doneWhenOf('user-risk').join('\n'), /People rated at risk were reviewed/)
  assert.equal(sourceCheckedOn(USER_RISK), '2026-09-20')
})

