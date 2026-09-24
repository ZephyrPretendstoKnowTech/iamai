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
import { channelTabsOf, stepBodyOf } from './stepBody.ts'
import { pickerSaves, pickerSavesAlone } from './pickerRows.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { stepLines } from './stepExport.ts'

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
  // The Plan's own operator, as Connect resolves the account signed in, with no /me read.
  const byPlan = opened('demo-week2', (f) => { f.operatorId = f.mapping.breakGlassUserIds[1]; f.snapshot.config.me = { status: 'error', reason: 'denied', rows: [] } })
  assert.equal(byPlan.body.emergencyAccountTasks!.accounts!.find((c) => c.accountId === byPlan.value.mapping.breakGlassUserIds[1])!.headsUp, HEADS_UP)
  // Nobody else's account is flagged.
  const plain = opened('demo-week2').body.emergencyAccountTasks!.accounts!
  assert.ok(plain.every((c) => c.headsUp === undefined))
})

/** A step's entry in content.json (the one with a decision), wherever it sits. */
function entryOf(stepId: string): Record<string, unknown> {
  const content = JSON.parse(read('docs/design/content.json')) as unknown
  let found: Record<string, unknown> | null = null
  const walk = (o: unknown): void => {
    if (found || o === null || typeof o !== 'object') return
    const row = o as Record<string, unknown>
    if (row.id === stepId && row.decision && typeof row.decision === 'object') { found = row; return }
    for (const v of Object.values(row)) walk(v)
  }
  walk(content)
  assert.ok(found, `${stepId} has a decision`)
  return found
}

/** A step's decision block in content.json. */
const decisionOf = (stepId: string): Record<string, unknown> => entryOf(stepId).decision as Record<string, unknown>

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
  // The office network's picker saves from its list too; its Save stays for the typed network.
  assert.equal(pickerSaves(decisionOf('s-prereq-trusted-location'), 's-prereq-trusted-location'), true)
  // Not where the decision also asks a question, or the list is read-only: their Save is what saves.
  for (const id of ['s-prereq-allowed-countries', 's-verify-mfa']) assert.equal(pickerSaves(decisionOf(id), id), false, id)
  const step = read('src/ui/surfaces/ContentStep.tsx')
  const single = step.slice(step.indexOf('function SingleDecision('), step.indexOf('export function Options('))
  assert.match(single, /\{!savesAlone && <Button variant="secondary" disabled=\{!canSave\} onClick=\{\(\) => save\(\)\}>/)
  assert.match(single, /onCommit=\{saves \? \(picked\) => save\(picked\) : undefined\}/)
  // The campaign's follow-up list is a picker alone: no Save beside it.
  const followUp = step.slice(step.indexOf('function FollowUpDecision('), step.indexOf('function DormantDecision('))
  assert.doesNotMatch(followUp, /<Button/)
  assert.match(followUp, /onCommit=\{\(next\) => onDecide\?\.\(\{ picked: next\.map\(\(o\) => o\.id\) \}\)\}/)
})

test('#15 no instruction sends the person to a Save beside the picker: 1.1 ends on Done, 1.2 on the choice that saves', () => {
  // 1.1's export and print, where a second account is needed: its list saves on Done.
  const one = opened('small', (f) => { f.mapping.breakGlassUserIds = f.mapping.breakGlassUserIds.slice(0, 1) })
  const lines = stepLines(one.step, one.ctx)
  assert.ok(lines.includes('Entra admin center → Entra ID → Users → New user → Create new user.'), 'the premise: the create steps are exported')
  assert.ok(lines.includes('Register an approved passkey, scan again, select the new account, then select Done.'), JSON.stringify(lines))
  assert.equal(lines.some((l) => /\bSave\b/.test(l)), false, 'no exported 1.1 line says Save')
  // 1.2's exclusions group is a single-choice list: choosing the group saves it
  // and closes the list (Picker.tsx pick), so its lines end on the choice.
  const group = opened('small', () => {}, 's-prereq-exclusion-group').body.emergencyAccountTasks!.tasks.flatMap((t) => t.steps)
  assert.deepEqual(group.filter((l) => /under \*\*Exclusions group\*\*/.test(l)), [
    'Select the new group under **Exclusions group**. Scan again to verify its membership and settings.',
    'In IAMAI, select that group under **Exclusions group**.',
  ])
  const who = entryOf('s-prereq-exclusion-group').who as Record<string, string>
  assert.equal(who.suggested.endsWith('This is not saved intent; nothing uses it until you choose it.'), true, who.suggested)
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
})

test('#19 Global Administrator is assigned Active and Permanently assigned: through PIM wherever the tenant has it, even to an account holding none', () => {
  const configure = (edit: (f: Fixture) => void) => opened('demo-week2', edit).body.emergencyAccountTasks!.tasks.find((t) => t.id === 'configure-account')!.steps
  const noGa = (f: Fixture): void => { f.snapshot.roles.active[f.mapping.breakGlassUserIds[0]] = [] }
  const DIRECT = /Roles & admins → Global Administrator → Add assignments/
  const PIM_LINE = /^Open \*\*ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → Global Administrator → Add assignments\*\*, select \*\*[^*]+\*\*\. Choose \*\*Assignment type: Active\*\* and \*\*Permanently assigned\*\*\.$/
  // Licensed for PIM: Roles & admins opens the PIM wizard, which defaults to
  // Eligible, so the account goes through PIM, Active and Permanently assigned.
  const licensed = configure((f) => { noGa(f); f.snapshot.capabilities.pim = { enabled: true, seats: 5, consumed: 1 } })
  assert.equal(licensed.some((l) => PIM_LINE.test(l)), true, JSON.stringify(licensed))
  assert.equal(licensed.some((l) => DIRECT.test(l)), false)
  // Any eligible assignment in the tenant is PIM at work, licence read or not.
  const eligibleElsewhere = configure((f) => {
    noGa(f)
    const other = f.snapshot.users.find((u) => !f.mapping.breakGlassUserIds.includes(u.id))!.id
    f.snapshot.roles.eligible[other] = ['fe930be7-5e62-47db-91af-98c3a49a38b1']
  })
  assert.equal(eligibleElsewhere.some((l) => PIM_LINE.test(l)), true, JSON.stringify(eligibleElsewhere))
  assert.equal(eligibleElsewhere.some((l) => DIRECT.test(l)), false)
  // No PIM signal: the direct line, which keeps Active and Permanently assigned for an assignment that asks.
  const plain = configure(noGa)
  assert.equal(plain.find((l) => DIRECT.test(l)), 'Open **Entra ID → Roles & admins → Global Administrator → Add assignments**, select **bg1@demo-fixture.onmicrosoft.com**, and complete the assignment. If it asks for an assignment type, choose **Active** and **Permanently assigned**.')
})

test('#19 Configure an existing account is always there, whole where no account needs a change (owner, 2026-09-23)', () => {
  const idsOf = (name: Parameters<typeof fixture>[0], edit: (f: Fixture) => void = () => {}) => opened(name, edit).body.emergencyAccountTasks!.tasks.map((t) => t.id)
  const all = ['create-account', 'configure-account', 'set-up-passkey']
  assert.deepEqual(idsOf('small', noAccounts), all)
  assert.deepEqual(idsOf('demo-week2'), all)
  assert.deepEqual(idsOf('demo-week2', (f) => { f.snapshot.users.find((u) => u.id === f.mapping.breakGlassUserIds[0])!.accountEnabled = false }), all)
  // The export and print carry what the screen offers.
  const { step, ctx } = opened('small', noAccounts)
  assert.equal(stepLines(step, ctx).includes('Configure an existing account'), true)
})

test('#20 Completion Criteria is the one line the owner approved', () => {
  const LINE = 'Each account you chose is cloud-only, enabled, signs in with the onmicrosoft.com address, holds Global Administrator permanently, and has an approved passkey.'
  for (const [name, edit] of [['demo', () => {}], ['demo-week2', () => {}], ['small', noAccounts]] as const) {
    assert.deepEqual(opened(name, edit).body.contract.doneWhen, [LINE], name)
  }
})

test('#16 #17 the step hands over Entra and AI Info only: its PowerShell and JSON repeated what the scan already read', () => {
  for (const [name, edit] of [['demo', () => {}], ['demo-week2', () => {}], ['small', noAccounts]] as const) {
    const { body } = opened(name, edit)
    assert.deepEqual(channelTabsOf(body.artifacts).map((t) => t.label), ['Entra', 'AI Info'], name)
  }
})

test('#14 the picker list fits the rail and wraps its text', () => {
  const css = read('src/ui/app.css')
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`)
    assert.ok(at >= 0, `no rule for ${selector}`)
    return css.slice(at, css.indexOf('}', at))
  }
  // The rail is 260px, and a decision lays its inputs on a grid whose track grew
  // to the list's longest name (about 316px): the picker may shrink to its column.
  assert.match(css, /grid-template-columns: 1fr 260px;/)
  assert.match(css, /\.decision-form \.decision \{ display: grid;/)
  assert.match(rule('.picker'), /min-width: 0;/)
  assert.match(rule('.picker'), /max-width: 100%;/)
  // No horizontal scroll inside the list, and names and reasons wrap.
  assert.match(rule('.picker-list'), /overflow-x: hidden;/)
  assert.match(rule('.picker-option-name,\n.picker-option-secondary'), /overflow-wrap: anywhere;/)
})
