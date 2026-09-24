import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText, emergencyTaskSteps, emergencyTaskText } from './emergencyAccountTasks.ts'
import { stepBodyOf } from './stepBody.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { stepExportView } from './stepExport.ts'
import { app } from '../../content/content.ts'

/** The opened step as the board hands it over: the lane reading included, because that is what decides whether a step's procedures are reference. */
function bodyOf(name: Parameters<typeof fixture>[0], id: string) {
  const f = structuredClone(fixture(name))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === id)!
  const readings = laneReadings(run.steps)
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const reading = readings.get(step.id)!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (x: string) => x, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  return stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf) })
}


const STEP = 's-prereq-break-glass'

function project(edit: (value: Fixture) => void = () => {}) {
  const value = structuredClone(fixture('small'))
  value.snapshot.config.authMethodsPolicy = structuredClone(fixture('demo-week2').snapshot.config.authMethodsPolicy)
  edit(value)
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { value, projected: emergencyAccountTasksOf(step, ctx) }
}

test('empty and partial selections keep two plain account positions', () => {
  const empty = project(value => { value.mapping.breakGlassUserIds = [] }).projected.accounts
  assert.deepEqual(empty.map(account => account.heading), ['Emergency access account 1', 'Emergency access account 2'])
  assert.equal(empty.every(account => account.title === 'No account selected' && account.completed.length === 0), true)
  const one = project(value => { value.mapping.breakGlassUserIds = value.mapping.breakGlassUserIds.slice(0, 1) }).projected.accounts
  assert.equal(one.length, 2)
  assert.ok(one[0].accountId)
  assert.equal(one[1].accountId, null)
})

test('each account shows only its highest-priority unresolved action', () => {
  const { value, projected } = project(value => {
    const [first, second] = value.mapping.breakGlassUserIds
    value.snapshot.users.find(user => user.id === first)!.onPremisesSyncEnabled = true
    value.snapshot.users.find(user => user.id === first)!.accountEnabled = false
    value.snapshot.roles.active[second] = []
  })
  const [first, second] = value.mapping.breakGlassUserIds
  assert.equal(projected.accounts.find(account => account.accountId === first)?.title, 'Use a cloud-only account')
  assert.equal(projected.accounts.find(account => account.accountId === second)?.title, 'Global Administrator not assigned')
})

test('a cloud-only wrong UPN routes to the existing-account procedure', () => {
  const { value, projected } = project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.users.find(user => user.id === id)!.userPrincipalName = 'emergency@example.com'
  })
  const row = projected.accounts.find(account => account.accountId === value.mapping.breakGlassUserIds[0])!
  assert.equal(row.title, 'Change the sign-in address')
  assert.match(row.instruction, /Configure an existing account/)
  assert.doesNotMatch(row.instruction, /create|replacement/i)
})

test('documented explicit null sync state is treated as never synchronized, while omission stays unknown', () => {
  const explicit = project(value => {
    const user = value.snapshot.users.find(row => row.id === value.mapping.breakGlassUserIds[0])!
    user.onPremisesSyncEnabled = null
    user.onPremisesSyncEnabledRead = true
  })
  assert.ok(explicit.projected.accounts[0].completed.includes('Cloud-only account'))
  const omitted = project(value => {
    const user = value.snapshot.users.find(row => row.id === value.mapping.breakGlassUserIds[0])!
    user.onPremisesSyncEnabled = null
    user.onPremisesSyncEnabledRead = false
  })
  assert.equal(omitted.projected.accounts[0].completed.includes('Cloud-only account'), false)
  assert.equal(omitted.projected.accounts[0].remainingCount, null)
})

test('a confirmed missing passkey remains the next action when policy evidence is unread', () => {
  const { value, projected } = project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.authMethods[id] = []
    value.snapshot.config.authMethodsPolicy = { status: 'error', reason: 'denied', rows: [] }
  })
  const row = projected.accounts.find(account => account.accountId === value.mapping.breakGlassUserIds[0])!
  assert.equal(row.title, 'Approved passkey needed')
  assert.match(row.instruction, /Set up an approved passkey/)
})

test('an IAMAI passkey evidence gap is not presented as another account correction', () => {
  const { value, projected } = project(value => {
    value.snapshot.config.authMethodsPolicy = { status: 'error', reason: 'denied', rows: [] }
  })
  const row = projected.accounts.find(account => account.accountId === value.mapping.breakGlassUserIds[0])!
  assert.equal(row.title, 'Passkey check incomplete')
  // The one instruction on the frozen steps that sent the admin somewhere
  // without saying where (owner, 2026-09-20). It names the place now.
  assert.match(row.instruction, /MFA Readiness/)
  assert.match(row.instruction, /Emergency access/)
  assert.doesNotMatch(row.instruction, /Scan to update|Set up an approved passkey/)
})

test('approved passkey setup keeps the three understandable methods in one task', () => {
  const setup = project().projected.tasks.find(task => task.id === 'set-up-passkey')!
  assert.deepEqual(setup.variants?.map(variant => variant.label), [
    'YubiKey security key',
    'Microsoft Authenticator on iPhone/iPad',
    'Microsoft Authenticator on Android',
  ])
  const ios = emergencyTaskText(setup, 'authenticator-ios')
  const yubikey = emergencyTaskText(setup, 'yubikey')
  assert.match(ios, /Microsoft Authenticator.*iPhone\/iPad|recovery iPhone\/iPad/)
  assert.doesNotMatch(ios, /YubiKey|Android/)
  assert.match(ios, /Temporary Access Pass/)
  assert.match(ios, /separate private browser window/)
  assert.match(ios, /confirm the account and tenant/i)
  assert.match(ios, /Troubleshooting → Temporary Access Pass/)
  assert.doesNotMatch(ios, /FEITIAN|TOKEN2/i)
  // The AAGUIDs are Step 3's and the approved-models disclosure's; the setup procedure does not repeat them.
  for (const text of [ios, yubikey]) assert.doesNotMatch(text, /AAGUID/i)
  assert.equal(setup.variants?.every(variant => !variant.facts?.length), true)
})

test('Step 1 preparation does not depend on sign-in-log evidence', () => {
  const { value, projected } = project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.signInEvidence[id] = { signInCount: 1, lastSignIn: value.snapshot.asOf, lastMfaSuccess: { at: value.snapshot.asOf, method: 'Passkey (FIDO2)' }, recoveryCandidates: [{ schema: 1, eventId: 'event', userId: id, at: value.snapshot.asOf, success: true, isInteractive: true, appId: null, resourceId: null, app: null, resource: null, method: 'Passkey (FIDO2)', freshMethod: true }] }
  })
  const row = projected.accounts.find(account => account.accountId === value.mapping.breakGlassUserIds[0])!
  assert.doesNotMatch(row.title, /sign in/i)
  assert.equal(row.completed.some(item => /used successfully/i.test(item)), false)
})

test('the standalone Entra text includes the whole persistent catalog', () => {
  const text = emergencyAccountTasksText(project().projected)
  for (const title of ['Create an emergency account', 'Configure an existing account', 'Set up an approved passkey']) assert.match(text, new RegExp(title))
  assert.doesNotMatch(text, /\*\*Sign in with the prepared passkey\*\*/)
})

test('initial task recommendation follows the highest-priority confirmed account action', () => {
  assert.equal(project(value => { value.mapping.breakGlassUserIds = [] }).projected.recommendedTaskId, 'create-account')
  assert.equal(project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.authMethods[id] = []
  }).projected.recommendedTaskId, 'set-up-passkey')
  assert.equal(project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.users.find(user => user.id === id)!.accountEnabled = false
  }).projected.recommendedTaskId, 'configure-account')
  assert.equal(project(value => {
    const [unknown, confirmed] = value.mapping.breakGlassUserIds
    value.snapshot.config.authMethodsPolicy = { status: 'error', reason: 'denied', rows: [] }
    value.snapshot.authMethods[confirmed] = []
    value.snapshot.authMethods[unknown] = [{ kind: 'fido2' }]
  }).projected.recommendedTaskId, 'set-up-passkey')
  assert.equal(project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.users.find(user => user.id === id)!.onPremisesSyncEnabled = true
  }).projected.recommendedTaskId, 'create-account')
})

/** The passkey procedure of a fixture as it is, with the accounts it names. */
function passkeyTaskOf(name: 'demo' | 'demo-week2') {
  const value = structuredClone(fixture(name))
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const projected = emergencyAccountTasksOf(step, ctx)
  return { projected, text: emergencyTaskText(projected.tasks.find(item => item.id === 'set-up-passkey')!) }
}

test('the passkey procedure names only the selected accounts whose passkey check fails', () => {
  const { projected, text } = passkeyTaskOf('demo')
  const failing = projected.accounts.filter(account => /Approved passkey needed|Passkey does not meet planned settings/.test(account.title))
  const others = projected.accounts.filter(account => account.upn && !failing.includes(account))
  assert.ok(failing.length === 1 && others.length === 1, 'the demo has one account needing a passkey and one not')
  assert.ok(text.includes(failing[0].upn!))
  assert.ok(!text.includes(others[0].upn!), `${others[0].upn} is not named`)
  // One account: no "for each" line. (It was "Repeat this procedure separately
  // for each account listed above."; the several-account line now reads
  // "... need an approved passkey. Follow these steps separately for each one.")
  assert.doesNotMatch(text, /separately for each/)
})

// Two accounts needing a passkey, a new tenant's usual case. The procedure
// opened "Keep your working administrator session open. Accounts: **a**, **b**."
// and "Repeat this procedure separately for each account listed above.". The
// session reminder is gone from every emergency task (owner, 2026-09-23), and
// the first line names both accounts.
test('two accounts needing a passkey are named on the first line of the procedure', () => {
  const value = structuredClone(fixture('demo-week2'))
  const [a, b] = value.mapping.breakGlassUserIds
  for (const id of [a, b]) value.snapshot.authMethods[id] = []
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const task = emergencyAccountTasksOf(step, ctx).tasks.find(item => item.id === 'set-up-passkey')!
  const upn = (id: string) => value.snapshot.users.find(user => user.id === id)!.userPrincipalName!
  for (const variant of task.variants ?? []) {
    const steps = emergencyTaskSteps(task, variant.id)
    assert.equal(steps[0], `**${upn(a)}** and **${upn(b)}** need an approved passkey. Follow these steps separately for each one.`, variant.id)
    assert.doesNotMatch(steps.join('\n'), /listed above/, variant.id)
  }
})

/** Step 1's account tiles, Step 1's status and Step 4's findings for demo-week2, with an edit. */
function dedicatedCase(edit: (value: Fixture, id: string) => void) {
  const value = structuredClone(fixture('demo-week2'))
  const id = value.mapping.breakGlassUserIds[0]
  edit(value, id)
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: x => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { id, step, accounts: emergencyAccountTasksOf(step, ctx).accounts }
}

test('Step 1 notes the dedicated-account signal where the selection is made, as a note that gates nothing', () => {
  const plain = dedicatedCase(() => {})
  const personal = dedicatedCase((value, id) => { value.snapshot.users.find(user => user.id === id)!.department = 'Finance' })
  const account = personal.accounts.find(row => row.accountId === personal.id)!
  assert.equal(account.notes?.length, 1)
  assert.match(account.notes![0].label, /These signals do not prove daily use\./)
  assert.match(account.notes![0].value, /department Finance\. Profile fields alone do not establish daily use/)
  // Not a check: the tile, its counts and the step read as they do without it.
  const strip = (rows: typeof plain.accounts) => rows.map(({ notes: _notes, ...row }) => row)
  assert.deepEqual(strip(personal.accounts), strip(plain.accounts))
  assert.equal(personal.step.status, plain.step.status)
  assert.deepEqual(personal.step.state, plain.step.state)
  assert.equal(plain.accounts.some(row => row.notes), false)
})

test('Step 1 notes an emergency account that is signed in to IAMAI now', () => {
  // The signed-in operator is the scan's /me.
  const signedIn = dedicatedCase((value, id) => { value.snapshot.config.me = { status: 'ok', reason: null, rows: [{ id }] } })
  const account = signedIn.accounts.find(row => row.accountId === signedIn.id)!
  // One heads-up line in the owner's words, in place of the check's note (2026-09-23).
  assert.match(account.headsUp ?? '', /^You're signed in to IAMAI with this account\./)
  assert.equal(account.notes, undefined)
})

// Every procedure stands open, on a finished step as on an open one: no
// "Reference" fold and no qualifier lines such as "No new emergency account is
// needed … The steps below stay here as a reference." (owner, 2026-09-23,
// reversing the 2026-09-22 fold).
test('the procedures on a finished step stand open and in full, with no fold and no qualifier', () => {
  const done = bodyOf('demo-week2', 's-prereq-break-glass')
  assert.equal(done.laneView.lane, 'Completed', 'the premise: the board reads this step finished')
  assert.ok(done.emergencyAccountTasks, 'the premise: it still draws its procedures')
  assert.equal('implementationReference' in done, false, 'a finished step folds its procedures away as reference')
  const lines = (done.emergencyAccountTasks.tasks ?? []).flatMap((t) => t.steps)
  assert.ok(lines.length > 15, `the procedures were dropped: ${lines.length} lines`)
  assert.deepEqual(lines.filter((line) => /stay here as a reference|No new emergency account is needed|No selected account needs|could not confirm/.test(line)), [], 'a qualifier line leads a procedure')
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.doesNotMatch(step, /impl-reference|<summary>\{W\.reference\}/, 'the Reference fold is still drawn')
})

// Configure an existing account: the changes a chosen account needs, named;
// and where none needs one (or none is chosen), the whole procedure, as every
// procedure stands in full (owner, 2026-09-23). Never an all-clear line.
test('the configuration procedure names the changes an account needs, and otherwise stands in full', () => {
  const configure = (edit: (value: Fixture) => void) => project(edit).projected.tasks.find(task => task.id === 'configure-account')?.steps ?? []
  const full = (steps: string[]) => ['User principal name', 'Account enabled', 'Global Administrator'].every((word) => steps.some((line) => line.includes(word)))
  const empty = configure(value => { value.mapping.breakGlassUserIds = [] })
  assert.ok(full(empty), `with nobody chosen the procedure is not whole: ${empty.join(' | ')}`)
  const read = configure(() => {})
  assert.ok(full(read), `with nothing to change the procedure is not whole: ${read.join(' | ')}`)
  for (const steps of [empty, read]) assert.deepEqual(steps.filter((line) => /^No selected account/.test(line)), [])
})
