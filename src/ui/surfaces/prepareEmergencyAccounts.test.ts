// Step 1.1 Prepare Emergency Access Accounts, as the owner walked it on a real
// tenant (2026-09-23), and the shared step layout every step draws with it.
// One test per item the owner approved; each names the item it holds.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { badgeLabel } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'
import { pickerSavesAlone } from './pickerRows.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const STEP = 's-prereq-break-glass'

/** The opened step as the board hands it over, on a fixture edited first. */
function opened(name: Parameters<typeof fixture>[0], edit: (value: Fixture) => void = () => {}, id = STEP) {
  const value = structuredClone(fixture(name))
  edit(value)
  const run = runFixture(value)
  const step = run.steps.find((s) => s.id === id)!
  const reading = laneReadings(run.steps).get(id)!
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const lane = laneViewOf(reading, titleOf)
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { value, run, step, lane, ctx, body: stepBodyOf(step, ctx, { lane }) }
}

const noAccounts = (value: Fixture): void => { value.mapping.breakGlassUserIds = [] }

test('#11 with no account chosen, the row and the badge say the person decides', () => {
  const { lane, body } = opened('small', noAccounts)
  assert.equal(lane.lane, 'Ready')
  assert.equal(lane.substatus, 'Decision', 'choosing the accounts is the next action, not creating one')
  assert.equal(lane.label, 'Ready · Decision')
  assert.equal(badgeLabel(body.contract), 'Ready · Decision')
  // Chosen accounts keep the reading they had.
  assert.notEqual(opened('demo').lane.substatus, 'Decision')
})

test('#11 with no account chosen, AI Info says none is chosen yet, not that one needs correction', () => {
  const { body, step } = opened('small', noAccounts)
  const identity = (step.configurationFindings ?? []).find((f) => f.key === 'account-setup')!
  assert.equal(identity.value, 'No accounts chosen yet')
  const ai = body.artifacts.find((a) => a.id === 'ai')!.text()
  assert.match(ai, /Accounts and identity: No accounts chosen yet/)
  assert.doesNotMatch(ai, /Needs correction/)
})

test('#24 the account cards are numbered by the account display name, not by the order they were picked', () => {
  // Breakglass2 picked first read as "Emergency access account 1".
  const { body, value } = opened('demo', (f) => { f.mapping.breakGlassUserIds = [...f.mapping.breakGlassUserIds].reverse() })
  const nameOf = (id: string | null) => value.snapshot.users.find((u) => u.id === id)?.displayName
  const cards = body.emergencyAccountTasks!.accounts!
  assert.deepEqual(cards.map((c) => [c.heading, nameOf(c.accountId)]), [['Emergency access account 1', 'Break-glass 1'], ['Emergency access account 2', 'Break-glass 2']])
})

test('#12 an emergency account that is the one signed in to IAMAI carries one heads-up line', () => {
  const HEADS_UP = "You're signed in to IAMAI with this account. Emergency accounts should be ones nobody uses day to day."
  const cardsWith = (me: (f: Fixture, id: string, upn: string) => Record<string, unknown>) => {
    const { body, value } = opened('demo-week2', (f) => {
      const id = f.mapping.breakGlassUserIds[0]
      const upn = f.snapshot.users.find((u) => u.id === id)!.userPrincipalName!
      f.snapshot.config.me = { status: 'ok', reason: null, rows: [me(f, id, upn)] }
    })
    return { cards: body.emergencyAccountTasks!.accounts!, id: value.mapping.breakGlassUserIds[0] }
  }
  // By object id, and by sign-in name.
  for (const { cards, id } of [cardsWith((_f, id) => ({ id })), cardsWith((_f, _id, upn) => ({ id: '00000000-0000-0000-0000-00000000abcd', userPrincipalName: upn.toUpperCase() }))]) {
    const signedIn = cards.find((c) => c.accountId === id)!
    assert.equal(signedIn.headsUp, HEADS_UP)
    assert.equal(signedIn.notes, undefined, 'one line, not the heads-up and the check note both')
    assert.ok(cards.filter((c) => c.accountId !== id).every((c) => c.headsUp === undefined))
  }
  // Nobody else's account is flagged.
  const plain = opened('demo-week2').body.emergencyAccountTasks!.accounts!
  assert.ok(plain.every((c) => c.headsUp === undefined))
})

/** A step's decision block in content.json, wherever the step entry sits. */
function decisionOf(stepId: string): Record<string, unknown> {
  const content = JSON.parse(read('docs/design/content.json')) as unknown
  let found: Record<string, unknown> | null = null
  const walk = (o: unknown): void => {
    if (found || o === null || typeof o !== 'object') return
    const row = o as Record<string, unknown>
    if (row.id === stepId && row.decision && typeof row.decision === 'object') { found = row.decision as Record<string, unknown>; return }
    for (const v of Object.values(row)) walk(v)
  }
  walk(content)
  assert.ok(found, `${stepId} has a decision`)
  return found
}

test('#15 every picker saves from the list: Done saves and closes, taking a chip off saves, and no Save stands beside a picker alone', () => {
  const picker = read('src/ui/components/Picker.tsx')
  // Done saves the selection as it stands and closes the list.
  assert.match(picker, /const done = \(\): void => \{\n\s+setOpen\(false\)\n\s+save\(latest\.current\)\n\s+\}/)
  assert.match(picker, /<Button size="sm" variant="tertiary" onClick=\{done\}>\n\s+\{T\.done\}/)
  // Taking a chip off saves what is left; a single-choice pick saves the pick.
  assert.match(picker, /const next = selected\.filter\(\(s\) => s\.id !== id\)\n\s+onChange\(next\)\n\s+save\(next\)/)
  assert.match(picker, /if \(single\) \{\n\s+setOpen\(false\)\n\s+save\(\[o\]\)/)
  // Closing the list another way after a change saves it too: a pick is never left on screen unsaved.
  assert.match(picker, /if \(ref\.current && !ref\.current\.contains\(e\.target as Node\)\) close\(\)/)
  assert.match(picker, /if \(idsOf\(latest\.current\) !== openedWith\.current\) save\(latest\.current\)/)

  // The decisions whose picker is their only input draw no Save; the rest keep theirs for their other inputs.
  for (const id of [STEP, 's-prereq-exclusion-group', 's-prereq-service-accounts-group', 's-shared-devices']) assert.equal(pickerSavesAlone(decisionOf(id), id), true, id)
  for (const id of ['s-prereq-trusted-location', 's-prereq-allowed-countries', 's-verify-mfa']) assert.equal(pickerSavesAlone(decisionOf(id), id), false, id)
  const step = read('src/ui/surfaces/ContentStep.tsx')
  const single = step.slice(step.indexOf('function SingleDecision('), step.indexOf('export function Options('))
  assert.match(single, /\{!savesAlone && <Button variant="secondary" disabled=\{!canSave\} onClick=\{\(\) => save\(\)\}>/)
  assert.match(single, /onCommit=\{stepId === SPECIAL_CARE_STEP_ID \? undefined : \(picked\) => save\(picked\)\}/)
  // The campaign's follow-up list is a picker alone: no Save beside it.
  const followUp = step.slice(step.indexOf('function FollowUpDecision('), step.indexOf('function DormantDecision('))
  assert.doesNotMatch(followUp, /<Button/)
  assert.match(followUp, /onCommit=\{\(next\) => onDecide\?\.\(\{ picked: next\.map\(\(o\) => o\.id\) \}\)\}/)
  const dormant = step.slice(step.indexOf('function DormantDecision('))
  assert.match(dormant, /onCommit=\{\(next\) => \{ if \(next\.length === 0 \|\| reason\.trim\(\)\) save\(next\) \}\}/)
})

test('#15 the emergency accounts the picker saves are the operator-saved decision, the one thing that writes them', () => {
  const value = structuredClone(fixture('small'))
  const ids = [...value.mapping.breakGlassUserIds].reverse()
  const saved = applyStepDecisions({ ...value.mapping, breakGlassUserIds: [] }, { [STEP]: { picked: ids, at: value.snapshot.asOf } })
  assert.deepEqual(saved.breakGlassUserIds, ids)
})

test('#13 the instruction is said once: the rail says it, the empty cards do not repeat it, and the milestone names the choice', () => {
  const { body, ctx } = opened('small', noAccounts)
  // The rail's line, reworded for the picker that saves on Done.
  assert.equal(decisionOf(STEP).help, 'Select the accounts dedicated to emergency access, then select Done.')
  // Each empty card says only that nothing is chosen, and the first one where to create an account.
  const cards = body.emergencyAccountTasks!.accounts!
  assert.deepEqual(cards.map((c) => [c.title, c.instruction]), [
    ['No account selected', 'To create one, follow Create an emergency account in Implementation Tasks.'],
    ['No account selected', ''],
  ])
  const one = opened('small', (f) => { f.mapping.breakGlassUserIds = f.mapping.breakGlassUserIds.slice(0, 1) }).body.emergencyAccountTasks!.accounts!
  assert.equal(one[1].instruction, 'To create one, follow Create an emergency account in Implementation Tasks.', 'the first empty card carries the pointer')
  // The bar says nothing on Step 1 while work remains: the cards and the rail already say it.
  const step = read('src/ui/surfaces/ContentStep.tsx')
  assert.doesNotMatch(step, /Complete the next task shown for each account\./)
  // The milestone names the choice while none is made, and the checks after.
  assert.equal(body.rail.sub, 'Choose your two emergency access accounts.')
  assert.equal(ctx.mapping.breakGlassUserIds.length, 0)
  assert.equal(opened('demo').body.rail.sub, 'Complete the remaining emergency access checks.')
})

test('#19 the emergency tasks carry no filler, and configuring an existing account lists only the fixes it needs', () => {
  const KEEP = 'Keep your working administrator session open.'
  const GA = '62e90394-69f5-4237-9190-012177145e10'
  const tasksOf = (name: Parameters<typeof fixture>[0], edit: (f: Fixture) => void = () => {}, id = STEP) => opened(name, edit, id).body.emergencyAccountTasks!.tasks
  const linesOf = (tasks: ReturnType<typeof tasksOf>): string[] => tasks.flatMap((t) => [t.steps, ...(t.variants ?? []).map((v) => v.steps)]).flat()
  for (const name of ['demo', 'demo-week2', 'small'] as const) {
    const lines = linesOf(tasksOf(name))
    assert.equal(lines.includes(KEEP), false, `${name}: the session reminder`)
    for (const filler of [/Do not use this to convert a synchronized identity/, /Save the changes, reopen the account/, /Confirm it appears in .*Security info/]) assert.equal(lines.some((l) => filler.test(l)), false, `${name}: ${filler}`)
    // The same reminder is gone from the exclusions group and passkey settings tasks.
    for (const id of ['s-prereq-exclusion-group', 's-prereq-passkey-settings']) assert.equal(linesOf(tasksOf(name, () => {}, id)).includes(KEEP), false, `${name} ${id}`)
  }
  const configure = (edit: (f: Fixture) => void = () => {}) => tasksOf('demo-week2', edit).find((t) => t.id === 'configure-account')!.steps
  const RETURN = 'Return to IAMAI and select **Scan to update the plan**.'
  // Nothing needed: no fix is listed.
  const clear = configure()
  assert.deepEqual(clear, ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users**.', 'No selected account needs a change to its sign-in address, enabled state or role.', RETURN])
  const has = (steps: string[], re: RegExp): boolean => steps.some((l) => re.test(l))
  const ADDRESS = /User principal name/, ENABLE = /Account enabled/, DIRECT = /Roles & admins → Global Administrator → Add assignments/, PIM = /Privileged Identity Management/
  // A custom-domain sign-in address: that fix alone.
  const address = configure((f) => { f.snapshot.users.find((u) => u.id === f.mapping.breakGlassUserIds[0])!.userPrincipalName = 'emergency@example.com' })
  assert.deepEqual([ADDRESS, ENABLE, DIRECT, PIM].map((re) => has(address, re)), [true, false, false, false])
  // Global Administrator eligible only: the PIM fix, naming the account.
  const eligible = configure((f) => { const id = f.mapping.breakGlassUserIds[0]; f.snapshot.roles.active[id] = []; f.snapshot.roles.eligible[id] = [GA] })
  assert.deepEqual([ADDRESS, ENABLE, DIRECT, PIM].map((re) => has(eligible, re)), [false, false, false, true])
  // No Global Administrator assignment at all: the direct assignment.
  const none = configure((f) => { f.snapshot.roles.active[f.mapping.breakGlassUserIds[0]] = [] })
  assert.deepEqual([ADDRESS, ENABLE, DIRECT, PIM].map((re) => has(none, re)), [false, false, true, false])
  for (const steps of [address, eligible, none]) assert.equal(steps.at(-1), RETURN)
})
