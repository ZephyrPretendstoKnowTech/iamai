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
import { consolidateEmergencyReadiness, emergencySubjectsOf } from './emergencyReadiness.ts'
import { passkeyReadiness } from './passkeyPresentation.ts'
import { readGroup } from '../../graph/collect/onDemand.ts'

const GROUP = 's-prereq-exclusion-group'

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
  return { run, step, body, tasks, cards, task, text: tasks.tasks.flatMap((t) => [...t.steps, ...(t.variants ?? []).flatMap((v) => v.steps)]).join('\n') }
}
const copy = (name: Parameters<typeof fixture>[0]): Fixture => structuredClone(fixture(name))
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
