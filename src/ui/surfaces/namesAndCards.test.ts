// The 2026-09-26 fix round after the admin-view review (owner-approved plan):
// each item's observable acceptance, one test each.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { nameKey } from '../../baseline/discover.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { stepOperations } from './stepJson.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import { foldLineOf } from './authoredText.ts'
import { learnRoleNames, roleNamesOf } from '../../roles.ts'
import { planDates } from './stepVars.ts'
import { eventsFor } from '../../roadmap/timing.ts'
import { policySubjectsOf } from './policyTasks.ts'
import { boardReadingsOf, boardWhenOf, laneViewFor } from './planBoard.ts'
import type { StepVarContext } from './stepVars.ts'

const run = (name: 'demo' | 'demo-week2') => {
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  return { f, r, ctx }
}

test('Completion Criteria describe the plan’s target, never the setting the step asks to correct', () => {
  // Week two's admins policy names Global Administrator alone; the plan's covers
  // the baseline's admin roles, and its card asks for that correction.
  const { r, ctx } = run('demo-week2')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  assert.ok(step.state.observation?.unwritten.includes('conditions.users'), 'the premise: who it applies to is to correct')
  assert.equal((step.action.resolution?.policies ?? []).length, 0, 'the premise: a person corrects it in Entra')
  const first = stepBodyOf(step, ctx).contract.doneWhen[0]
  assert.ok(first.includes('requiring Modern MFA + TAP for admin roles except'), first)
  assert.doesNotMatch(first, /Global Administrator/)
})

test('an announcement is never dated before today: a change nearer than its notice is announced on the first working day from today', () => {
  // Owner, 2026-09-26: 5.2 read "Announce it Sep 24 (estimated); create it On Oct 1" on Sep 26.
  const { r } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-admin-session')!
  const near = { ...step, rings: [{ ...step.rings[0], plannedStart: '2026-09-29T12:00:00.000Z' }] } as typeof step
  const ctx = { rhythm: r.schedule.rhythm!, timeZone: 'UTC' }
  assert.ok(eventsFor(near, ctx)!.announce!.at < '2026-09-26', 'the premise: five working days before Sep 29 is gone by Saturday Sep 26')
  const e = eventsFor(near, { ...ctx, today: '2026-09-26T12:00:00.000Z' })!
  assert.equal(e.announce!.at.slice(0, 10), '2026-09-28', 'Monday, the first working day from Saturday')
  assert.match(e.announce!.reason, /less than 5 working days away/)
  assert.equal(e.remind, null, 'no reminder before or on the day it is announced')
  // A change far enough off keeps its full notice.
  const far = { ...step, rings: [{ ...step.rings[0], plannedStart: '2026-10-12T12:00:00.000Z' }] } as typeof step
  assert.equal(eventsFor(far, { ...ctx, today: '2026-09-26T12:00:00.000Z' })!.announce!.at.slice(0, 10), '2026-10-05')
})

test('a policy to correct is one card: the policy, "Correct {fields}", and the changes themselves', () => {
  // Owner, 2026-09-26: "Users differ from the plan · Set Users as Implementation Tasks shows." named no change.
  const { r, ctx } = run('demo-week2')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  const body = stepBodyOf(step, ctx)
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  const open = cards.filter((c) => !c.satisfied)
  assert.equal(open.length, 1, JSON.stringify(open.map((c) => c.key)))
  assert.equal(open[0].heading, 'Conditional Access policy')
  assert.equal(open[0].upn, 'Core - Grant - Admins phishing-resistant')
  // Every difference is corrected or accepted (owner, 2026-09-26): the stronger grant too.
  assert.equal(open[0].title, 'Correct users and grant')
  // The card counts a role list; the task holds the names (owner, 2026-09-26).
  assert.ok((open[0].detail ?? '').startsWith('Under Users → Include, Directory roles: Select (45).'), open[0].detail ?? '')
  assert.doesNotMatch(open[0].detail ?? '', /\*\*/)
  // The demo's 4.4 corrects its resources alone: adding Core - Exclusions to it is
  // Configure Emergency Exclusions' edit, which lists it since F-002 (it said so twice).
  const demo = run('demo')
  const mfa = demo.r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const b = stepBodyOf(mfa, demo.ctx)
  assert.deepEqual(policySubjectsOf(b.contract, b.readiness, b.emergencyAccountTasks).filter((c) => c.key.startsWith('correct:')).map((c) => c.title), ['Correct target resources'])
})

test('a roles correction says to change only the roles listed, so the ones already ticked stay (F-062)', () => {
  // Owner, 2026-09-28: the sample's 4.3 listed 45 roles to select without Global
  // Administrator, which the tenant's policy already holds, under "change the selection
  // as listed below": an admin matching the list would have unticked it.
  const { r, ctx } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!
  const lines = (stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []).flatMap((t) => t.steps)
  const lead = lines.find((l) => l.includes('**Directory roles**') && l.includes('Users → Include'))
  assert.ok(lead, `the premise: the correction has a roles lead: ${lines.join(' | ')}`)
  assert.match(lead, /change only the \*\*Directory roles\*\* listed below; leave every other role as it is/)
  const select = lines.find((l) => /Select \(45\)/.test(l))
  assert.ok(select && !select.includes('Global Administrator'), 'the premise: Global Administrator is already ticked, so it is not in the list')
})

test('7.1 to 7.3 set only how long a sign-in lasts, so Completion Criteria claim no report-only period that stopped nobody', () => {
  const { r, ctx } = run('demo')
  const says = (id: string): boolean => stepBodyOf(r.steps.find((s) => s.id === id)!, ctx).contract.doneWhen.some((l) => /report-only period showed no sign-in/.test(l))
  for (const id of ['s-goal-admin-session', 's-goal-all-users-no-persistence', 's-goal-intune-enrollment-reauth']) assert.equal(says(id), false, id)
  // Token Protection does stop sign-ins, and a block does: they keep the line.
  assert.equal(says('s-goal-token-protection'), true)
  assert.equal(says('s-goal-block-auth-transfer'), true)
})

test('6.3: the countries decision comes first, About is two sentences, and a Ready decision reads a date, never "Decide now"', () => {
  const { f, r, ctx } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-geo-restriction')!
  const body = stepBodyOf(step, ctx)
  assert.equal(policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)[0].key, 'decision')
  assert.equal(body.contract.why.match(/[.!?](\s|$)/g)?.length, 2, body.contract.why)
  assert.doesNotMatch(body.contract.why, /travel, VPN and partner/)
  // Ready on a decision, in no phase: the day the plan was read.
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const view = laneViewFor(step, board)
  const { alone: _alone, ...rest } = view
  const ready = { ...rest, lane: 'Ready' as const, substatus: 'Decision' as const }
  const when = boardWhenOf(step, null, ready)
  assert.notEqual(when, 'Decide now')
  assert.equal(when, 'Aug 28, 2026')
})

test('an untagged policy switched off under the name IAMAI proposed before is still the step’s own: set it to Report-only, never a second policy', () => {
  // Review, 2026-09-26: the create now carries the baseline's name, and the Off
  // policy built from the old instructions read as nobody's.
  const f = withFoundationSettled({ ...structuredClone(fixture('getiamai')), baseline: pinnedPackage() })
  const step0 = runFixture(f).steps.find((s) => s.id === 's-goal-block-device-code')!
  const create = stepOperations(step0).find((o) => o.mode === 'create')!
  const earlier = step0.earlierNames?.[0] ?? ''
  assert.notEqual(earlier, (create.body as { displayName: string }).displayName, 'the premise: the old name is not the baseline’s')
  const body: Record<string, unknown> = { ...(structuredClone(create.body) as Record<string, unknown>), displayName: earlier, state: 'disabled', id: 'p-built-before' }
  delete body.description
  ;(f.snapshot.config.caPolicies.rows as unknown[]).push(body)
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-block-device-code')!
  assert.deepEqual(step.tracking?.members?.map((m) => [m.policyId, m.matchedBy]), [['p-built-before', 'member-name']])
  assert.equal(unavailableReason(step as never), 'switched-off')
})

test('a policy typed by hand with hyphens for the baseline’s en dashes (or the other way) is the step’s own, and nothing asks to rename it (owner, 2026-09-28)', () => {
  // Entra keeps the character typed: the baseline's names mix – and -, and a
  // person typing the name gets hyphens. The plan read that as another policy
  // and asked for the baseline's name.
  const f = withFoundationSettled({ ...structuredClone(fixture('getiamai')), baseline: pinnedPackage() })
  const step0 = runFixture(f).steps.find((s) => s.id === 's-goal-block-device-code')!
  const create = stepOperations(step0).find((o) => o.mode === 'create')!
  const planned = (create.body as { displayName: string }).displayName
  const typed = planned.replace(/[-–]/g, (c) => (c === '-' ? '–' : '-'))
  assert.notEqual(typed, planned, 'the premise: the typed name differs only in its dashes')
  const body: Record<string, unknown> = { ...(structuredClone(create.body) as Record<string, unknown>), displayName: typed, state: 'disabled', id: 'p-typed-dashes' }
  delete body.description
  ;(f.snapshot.config.caPolicies.rows as unknown[]).push(body)
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-block-device-code')!
  assert.deepEqual(step.tracking?.members?.map((m) => [m.policyId, m.matchedBy, m.plannedName ?? null]), [['p-typed-dashes', 'member-name', null]])
  assert.equal(nameKey(typed), nameKey(planned))
})

test('a held create’s Threshold card says why the create waits, and an export says it once, before its procedure', () => {
  // Review, 2026-09-26: the export read the card's sentence under What to do and again under Before turn-on.
  const f = curatedFixture('demo')
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  const step = r.steps.find((s) => s.id === 's-goal-require-managed-device')!
  const card = stepBodyOf(step, ctx).readiness.tiles.find((t) => t.key === 'gate')?.note ?? ''
  assert.match(card, /pick a certificate/)
  const view = stepExportView(step, ctx)
  assert.equal(view.whatToDo.filter((l) => /pick a certificate/.test(l)).length, 1, 'What to do says it once')
  assert.equal(view.beforeTurnOn.some((l) => /pick a certificate/.test(l)), false, 'Before turn-on does not say it again')
})

test('a late announcement that would fall at or after the change is no announcement', () => {
  const { r } = run('demo')
  const on = (id: string) => {
    const step = r.steps.find((s) => s.id === id)!
    return eventsFor({ ...step, rings: [{ ...step.rings[0], plannedStart: '2026-09-28T12:00:00.000Z' }] } as typeof step, { rhythm: r.schedule.rhythm!, timeZone: 'UTC', today: '2026-09-28T12:00:00.000Z' })!
  }
  // Changed at 09:00 today: an announcement at 09:30 would come after it.
  const early = on('s-goal-block-auth-transfer')
  assert.equal(early.enforce.at, '2026-09-28T09:00:00.000Z', 'the premise')
  assert.equal(early.announce, null)
  // Changed at 15:00 today: announced that morning.
  const later = on('s-goal-admin-session')
  assert.equal(later.announce?.at, '2026-09-28T09:30:00.000Z')
  assert.ok(Date.parse(later.announce!.at) < Date.parse(later.enforce.at))
})

test('a Ready decision read on a weekend is dated the Monday after, as every day the plan gives', () => {
  const { f, r } = run('demo')
  const step = r.steps.find((s) => s.id === 's-goal-geo-restriction')!
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const { alone: _alone, ...rest } = laneViewFor(step, board)
  const saturday = { ...step, scheduled: { ...step.scheduled!, basis: { ...step.scheduled!.basis!, today: '2026-09-26T12:00:00.000Z' } } } as typeof step
  assert.equal(boardWhenOf(saturday, null, { ...rest, lane: 'Ready', substatus: 'Decision' }), 'Sep 28, 2026')
})

test('a role list is alphabetical, one role per line to tick through: Select for the create, Select and Clear for a correction', () => {
  const { r, ctx } = run('demo')
  const create = stepBodyOf(r.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!, ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'create')?.steps ?? []
  const fold = create.flatMap((l) => l.split('\n')).map(foldLineOf).find((f) => f !== null && 'items' in f) as { title: string; items: string[] } | undefined
  assert.equal(fold?.title, 'Select (46)')
  assert.deepEqual(fold?.items, [...(fold?.items ?? [])].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), 'alphabetical, as Entra lists them')
  assert.equal(fold?.items[0], 'Agent ID Administrator')
})

test('a role IAMAI has no name for reads as a role with its ID, and the tenant\u2019s role definitions name it', () => {
  const unknown = '0f0f0f0f-1111-4111-8111-000000000001'
  assert.deepEqual(roleNamesOf(['62e90394-69f5-4237-9190-012177145e10', unknown]), ['Global Administrator', `Unknown role (ID ${unknown})`])
  learnRoleNames([], [{ id: unknown, templateId: unknown, displayName: 'Contoso Helpdesk Tier 3' }])
  assert.deepEqual(roleNamesOf([unknown, '62e90394-69f5-4237-9190-012177145e10']), ['Contoso Helpdesk Tier 3', 'Global Administrator'])
})
