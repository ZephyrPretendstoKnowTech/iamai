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
