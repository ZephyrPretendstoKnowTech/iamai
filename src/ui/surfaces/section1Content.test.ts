// Section 1, Establish Emergency Access (1.2–1.4), as the owner walked it on a
// real tenant (2026-09-23). One test per item the owner approved; each names it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import { consolidateEmergencyReadiness, emergencySubjectsOf, recoverySubjectsOf } from './emergencyReadiness.ts'
import { passkeyReadiness } from './passkeyPresentation.ts'
import { emergencyVerificationArtifacts, emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'
import { cleanupEntry, cleanupSourceLine, drillMilestone } from './cleanupExport.ts'
import { cleanupRowWho, rowWho } from './rowWho.ts'
import { readGroup } from '../../graph/collect/onDemand.ts'
import { campaignIds } from '../../derive/population.ts'
import { count } from '../../copy/statements.ts'
import { stepVars } from './stepVars.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyReadingOf } from '../../roadmap/passkeySettings.ts'

const GROUP = 's-prereq-exclusion-group'
const PASSKEY = 's-prereq-passkey-settings'

/** The opened step as the board hands it over, with the Tasks Remaining cards ContentStep draws. */
function opened(value: Fixture, id: string) {
  const run = runFixture(value)
  const step = run.steps.find((s) => s.id === id)!
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const lane = laneViewOf(laneReadings(run.steps).get(id)!, titleOf)
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const body = stepBodyOf(step, ctx, { lane })
  const tasks = body.emergencyAccountTasks!
  const cards = emergencySubjectsOf(consolidateEmergencyReadiness(passkeyReadiness(step, body.readiness), tasks, new Map(), true), tasks)
  const task = (taskId: string) => tasks.tasks.find((t) => t.id === taskId)!
  return { run, step, ctx, body, tasks, cards, task, text: tasks.tasks.flatMap((t) => [...t.steps, ...(t.variants ?? []).flatMap((v) => v.steps)]).join('\n') }
}
const copy = (name: Parameters<typeof fixture>[0]): Fixture => structuredClone(fixture(name))
const drillOf = (value: Fixture) => {
  const phase = runFixture(value).schedule.cleanup!
  return { phase, row: phase.rows.find((r) => r.kind === 'drill')! }
}
const upns = (value: Fixture): string => value.mapping.breakGlassUserIds.map((id) => `**${value.snapshot.users.find((u) => u.id === id)!.userPrincipalName}**`).join(', ')

// ---- 1.2 Configure Emergency Exclusions ----

test('1.2 #6 the reading every listed group gets holds its direct members, so the group chosen from the picker has them', async () => {
  // The picker's "2 members" and the membership card read one reading. The
  // direct members used to be read only for the group already saved when the
  // groups were read, so the card said "Direct member count · Could not verify"
  // right after a choice.
  const V1 = 'https://graph.microsoft.com/v1.0/groups/g1'
  const answers: Record<string, unknown> = {
    [`${V1}?$select=id,displayName,membershipRule,membershipRuleProcessingState,mailEnabled,securityEnabled,groupTypes,isAssignableToRole,assignedLicenses`]: { id: 'g1', displayName: 'Breakglass Exclusion', membershipRule: null, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenses: [] },
    [`${V1}/transitiveMembers/$count`]: 2,
    [`${V1}/transitiveMembers?$select=id&$top=999`]: { value: [{ id: 'u1' }, { id: 'u2' }] },
    'https://graph.microsoft.com/beta/groups/g1/members?$select=id,displayName,userPrincipalName&$top=999': { value: [{ '@odata.type': '#microsoft.graph.user', id: 'u1', displayName: 'Breakglass', userPrincipalName: 'bg1@x' }, { '@odata.type': '#microsoft.graph.user', id: 'u2', displayName: 'Breakglass2', userPrincipalName: 'bg2@x' }] },
  }
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string) => url in answers ? new Response(JSON.stringify(answers[url]), { status: 200 }) : new Response('{"error":{"code":"NotFound"}}', { status: 404 })) as typeof fetch
  try {
    const read = await readGroup('tenant', 'g1', { tokens: { get: () => 't', refresh: async () => 't' } })
    assert.equal(read.memberCount, 2, 'the picker reads "2 members"')
    assert.equal(read.directMembers, 'complete', 'and the same reading holds who is directly in the group')
    assert.deepEqual(read.directMemberIds, ['u1', 'u2'])
  } finally {
    globalThis.fetch = original
  }
})

test('1.2 #7 with no group chosen, Configure Conditional Access exclusions is the plain procedure; with one, it names each policy', () => {
  const none = opened(noExclusionsAnswer(copy('small')), GROUP).task('configure-policy-exclusions').steps.join('\n')
  assert.doesNotMatch(none, /has not established|do not save guessed/)
  assert.match(none, /Assignments → Users → Exclude → Users and groups/)
  assert.match(none, /Select \*\*Save\*\*\./)
  const chosen = opened(copy('demo'), GROUP).task('configure-policy-exclusions').steps
  assert.ok(chosen.includes('Open **Core - Block - Legacy authentication**.'), chosen.join('\n'))
})

test('1.2 #8 Configure Emergency Exclusions hands over Entra and AI Info only', () => {
  assert.deepEqual(opened(copy('demo'), GROUP).body.artifacts.map((a) => a.id), ['portal', 'ai'])
})

test('1.2 #9 the deleted lines are gone, and adding the accounts stands whole in every state', () => {
  const unread = copy('small')
  const cases: [string, Fixture][] = [['nothing to change', copy('demo-week2')], ['a policy missing', copy('demo')], ['no group chosen', noExclusionsAnswer(copy('small'))], ['members unread', Object.assign(unread, { groups: new Map() })]]
  for (const [label, value] of cases) {
    const { text, task } = opened(value, GROUP)
    assert.doesNotMatch(text, /Check its name and object ID|Select and save an exclusions group in IAMAI first|No membership change is needed|Check object ID|verify policy ID|reopen the policy and confirm the group remains excluded|appear as direct members|verify the intended list/, `${label}:\n${text}`)
    const membership = task('manage-emergency-membership').steps
    assert.ok(membership.includes(`Select **Add members**, add ${upns(value)}, then select **Select**.`), `${label}:\n${membership.join('\n')}`)
    assert.match(membership[0], /→ Members\*\*\.$/, `${label}: opens the group's Members`)
  }
})

test('1.2 #10 the empty group card reads No group selected and says once where to create one', () => {
  const { cards } = opened(noExclusionsAnswer(copy('small')), GROUP)
  const card = cards.find((c) => c.key === 'configuration:group-choice')!
  assert.equal(card.title, 'No group selected')
  assert.equal(card.instruction, 'To create one, follow Create an emergency exclusions group in Implementation Tasks.')
  assert.doesNotMatch(JSON.stringify(cards), /Choose an exclusions group|Select a group under Exclusions group/)
})

// ---- 1.3 Configure Passkey Authentication ----

test('1.3 #11 with the settings matching, every task is the procedure with its values, and no review task', () => {
  const { tasks, task, text, run } = opened(copy('demo-week2'), PASSKEY)
  assert.equal(run.steps.find((s) => s.id === PASSKEY)!.state.satisfied, true, 'the premise: the settings match')
  assert.deepEqual(tasks.tasks.map((t) => t.id), ['make-passkey-registration-available', 'prepare-affected-passkeys', 'apply-passkey-settings'])
  assert.doesNotMatch(text, /Do not change a value|No save is required|No existing passkey is affected|has not established|^Review /m)
  const registration = task('make-passkey-registration-available').steps
  for (const line of ['Set **Enable** to **On**.', 'Set **Allow self-service set up** to **Yes**.']) assert.ok(registration.includes(line), registration.join('\n'))
  const protection = task('apply-passkey-settings').steps.join('\n')
  assert.match(protection, /Set \*\*Enforce attestation\*\* to \*\*Yes\*\*\./)
  assert.match(protection, /Add AAGUID/)
})

test('1.3 #11 where the scan resolves no target, the tasks state the plan\'s own values', () => {
  const blocklist = copy('demo-week2')
  const fido = (blocklist.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }).authenticationMethodConfigurations.find((c) => c.id === 'Fido2')!
  fido.keyRestrictions = { isEnforced: true, enforcementType: 'block', aaGuids: ['00000000-0000-4000-8000-000000000001'] }
  const unread = copy('demo-week2')
  unread.snapshot.config.authMethodsPolicy = { ...unread.snapshot.config.authMethodsPolicy, status: 'error', rows: [] }
  for (const [label, value, state] of [['a block list', blocklist, 'review'], ['the policy unread', unread, 'unread']] as const) {
    assert.equal(passkeyReadingOf(value.snapshot, value.mapping).state, state, `${label}: the premise`)
    const { task } = opened(value, PASSKEY)
    const registration = task('make-passkey-registration-available').steps
    assert.ok(registration.includes('Under **Include**, target **All users**.'), `${label}:\n${registration.join('\n')}`)
    const protection = task('apply-passkey-settings').steps
    for (const line of ['Set **Enforce attestation** to **Yes**.', 'Set **Enforce key restrictions** to **Yes**.', 'Set **Restrict specific keys** to **Allow**.']) assert.ok(protection.includes(line), `${label}: ${line}\n${protection.join('\n')}`)
    for (const aaguid of PASSKEY_TARGET_AAGUIDS) assert.ok(protection.some((l) => l.includes(`**${aaguid}**`)), `${label}: ${aaguid}`)
  }
})

test('1.3 #12 the Methodology block is gone', async () => {
  assert.equal('PASSKEY_METHODOLOGY' in (await import('./passkeyPresentation.ts')), false)
})

test('1.3 #13 Configure Passkey Authentication hands over Entra and AI Info only', () => {
  assert.deepEqual(opened(copy('demo-week2'), PASSKEY).body.artifacts.map((a) => a.id), ['portal', 'ai'])
})

// ---- 1.4 Verify Emergency Access ----

test('1.4 #17 the drill says when its source was checked, as every step does', () => {
  assert.equal(cleanupSourceLine(cleanupEntry('drill')!), 'Source checked Sep 25, 2026')
})

test('1.4 #18 Tasks Remaining carries no Configuration card: the drill already waits on the steps it repeated', () => {
  const { phase } = drillOf(copy('demo'))
  assert.deepEqual((phase.recoveryFindings ?? []).map((f) => f.key), ['recovery-sign-ins'])
  const cards = recoverySubjectsOf(phase.recoveryFindings ?? [], emergencyVerificationTasksOf(phase), new Map())
  assert.deepEqual(cards.map((c) => c.heading), ['Sign-in evidence'])
})

test('1.4 #19 Verify emergency sign-in keeps no session reminder and no optional check', () => {
  const { phase } = drillOf(copy('demo'))
  const text = emergencyVerificationTasksOf(phase).tasks.flatMap((t) => t.steps).join('\n')
  assert.doesNotMatch(text, /Keep your working administrator session open|Optional:|confirm the account can manage policies/)
  assert.match(text, /^Confirm the account and tenant\.$/m)
})

test('1.4 #20 Verify Emergency Access hands over Entra and AI Info only', () => {
  const { phase } = drillOf(copy('demo'))
  assert.deepEqual(emergencyVerificationArtifacts(phase).map((a) => a.id), ['portal', 'ai'])
})

// ---- #4 Impact: each row counts what it changes ----

test('#4 Impact counts what each step changes: policies to exclude the group from, people who can register, the accounts to sign in with', () => {
  for (const name of ['small', 'demo-week2'] as const) {
    const value = copy(name)
    const run = runFixture(value)
    // 1.2: every policy On or in Report-only excludes the group (validation/exclusionsGroupPolicies.ts).
    const policies = (value.snapshot.config.caPolicies.rows as { state?: string }[]).filter((p) => p.state !== 'disabled').length
    assert.equal(rowWho(run.steps.find((s) => s.id === GROUP)!), count(policies, 'policy', 'policies'), `${name}: 1.2`)
    // 1.3: the target is all users, so everyone registers: the plan's active people, guests registering at home.
    const people = campaignIds(run.viability, value.snapshot, value.mapping).filter((id) => value.snapshot.users.find((u) => u.id === id)?.userType !== 'guest').length
    assert.equal(rowWho(run.steps.find((s) => s.id === PASSKEY)!), count(people, 'person', 'people'), `${name}: 1.3`)
    // 1.4: the emergency access accounts, as 1.1 counts them, never people.
    const { phase, row } = drillOf(value)
    assert.equal(cleanupRowWho(phase, row), '2 accounts', `${name}: 1.4`)
  }
  // 1.2's count is the picker's denominator: one number, where a policy is Off too.
  const messy = copy('messy')
  const { step, ctx } = opened(messy, GROUP)
  assert.ok((messy.snapshot.config.caPolicies.rows as { state?: string }[]).some((p) => p.state === 'disabled'), 'the premise: an Off policy')
  const impact = rowWho(step)
  const v = stepVars(step, ctx)
  assert.equal(count(v.policyCount as number, 'policy', 'policies'), impact, 'the chosen group line')
  const rows = v.groups as string[]
  assert.ok(rows.length > 0)
  for (const r of rows) assert.ok(r.endsWith(` of ${impact}`), `${r} against Impact ${impact}`)
})

// ---- The owner's rewrites, word for word ----

test('rewrites: About, Completion Criteria and the 1.4 milestone read as the owner wrote them', () => {
  const group = opened(copy('demo'), GROUP).body.contract
  assert.equal(group.why, 'Put your emergency access accounts in one group, and exclude that group from every Conditional Access policy, so no policy can lock them out.')
  assert.deepEqual(group.doneWhen, ['Both emergency access accounts are direct members of the group you chose, and every policy excludes it.'])
  const passkey = opened(copy('demo'), PASSKEY).body.contract
  assert.equal(passkey.why, 'Turn on passkeys (FIDO2) for everyone and allow only the approved passkey models, so emergency and admin accounts can register one.')
  assert.deepEqual(passkey.doneWhen, ['Passkeys (FIDO2) are on for everyone, attestation is enforced, and only the approved models can register.'])
  const drill = cleanupEntry('drill')!
  assert.equal(drill.why, "Sign in once with each emergency access account's passkey, so you know the way back in works before any policy is turned on.")
  assert.deepEqual(drill.doneWhen, ['Each emergency access account has signed in with its passkey since its last change, within the last 90 days.'])
  const { row } = drillOf(copy('demo'))
  assert.equal(drillMilestone(row), 'Sign in with each emergency access account.')
})
