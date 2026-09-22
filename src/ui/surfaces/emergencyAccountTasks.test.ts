import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText, emergencyTaskText } from './emergencyAccountTasks.ts'
import { stepBodyOf } from './stepBody.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'

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

test('Step 1 exposes the three preparation procedures', () => {
  for (const edit of [() => {}, (value: Fixture) => { value.mapping.breakGlassUserIds = [] }]) {
    const { projected } = project(edit)
    assert.deepEqual(projected.tasks.map(task => task.title), [
      'Create an emergency account',
      'Configure an existing account',
      'Set up an approved passkey',
    ])
    assert.equal(projected.tasks.every(task => task.required === false), true)
    assert.equal(projected.printAll, true)
  }
})

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
  assert.match(row.instruction, /Evidence read/)
  assert.match(row.instruction, /no account change is established/i)
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

test('the three preparation procedures remain complete when no account is selected', () => {
  const { projected } = project(value => { value.mapping.breakGlassUserIds = [] })
  const create = emergencyTaskText(projected.tasks.find(item => item.id === 'create-account')!)
  const configure = emergencyTaskText(projected.tasks.find(item => item.id === 'configure-account')!)
  const passkey = emergencyTaskText(projected.tasks.find(item => item.id === 'set-up-passkey')!)
  assert.match(create, /emergency-access-primary/)
  assert.match(create, /onmicrosoft\.com/)
  assert.match(configure, /Roles & admins → Global Administrator → Add assignments/)
  assert.match(configure, /Privileged Identity Management/)
  assert.match(passkey, /Troubleshooting → Temporary Access Pass/)
  assert.match(passkey, /separate private browser window/)
  assert.doesNotMatch([create, configure, passkey].join('\n'), /enter.*the emergency account you are preparing/i)
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
  assert.doesNotMatch(text, /Repeat this procedure separately for each account/)
})

test('with every selected account passing, the passkey procedure stays available and says no account needs it', () => {
  const { projected, text } = passkeyTaskOf('demo-week2')
  assert.ok(projected.accounts.every(account => account.satisfied))
  assert.ok(projected.tasks.some(item => item.id === 'set-up-passkey'))
  assert.match(text, /No selected account currently needs an approved passkey\./)
  for (const account of projected.accounts) assert.ok(!text.includes(account.upn!), `${account.upn} is not named`)
})

/** Step 1's account tiles, Step 1's status and Step 4's findings for demo-week2, with an edit. */
function dedicatedCase(edit: (value: Fixture, id: string) => void) {
  const value = structuredClone(fixture('demo-week2'))
  const id = value.mapping.breakGlassUserIds[0]
  edit(value, id)
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: x => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const recovery = (run.schedule.cleanup?.recoveryFindings ?? []).flatMap(finding => finding.items ?? []).filter(item => item.issueKeys?.some(key => key.startsWith('validation:bg.notPersonal:')))
  return { id, step, accounts: emergencyAccountTasksOf(step, ctx).accounts, recovery }
}

test('Step 1 notes the dedicated-account signal where the selection is made, as a note that gates nothing', () => {
  const plain = dedicatedCase(() => {})
  const personal = dedicatedCase((value, id) => { value.snapshot.users.find(user => user.id === id)!.department = 'Finance' })
  const account = personal.accounts.find(row => row.accountId === personal.id)!
  assert.equal(account.notes?.length, 1)
  // Today's wording, the same item Verify Emergency Access shows.
  assert.match(account.notes![0].label, /These signals do not prove daily use\./)
  assert.match(account.notes![0].value, /department Finance\. Profile fields alone do not establish daily use/)
  assert.deepEqual(personal.recovery.map(item => [item.factLabel, item.value]), [[account.notes![0].label, account.notes![0].value]], 'Step 4 still shows it')
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
  assert.match(account.notes?.[0]?.value ?? '', /signed in to IAMAI now/)
})

// A finished step's procedures are reference, not instructions.
//
// They stay on purpose — emergencyAccountTasks.ts keeps them so that "with
// none needing any, every change stays available as a reference" — and they
// are typeset as commands. On a step reading Completed a reader met three
// task blocks of eight, nine and ten imperative lines, two of them led by a
// line saying nothing needed doing, and took the lot for work that remained.
// Owner decision 2026-09-22, option A: keep every word, change the default
// from "do this" to "look this up".
test('the procedures on a finished step are reference, and on an open one they are not', () => {
  const done = bodyOf('demo-week2', 's-prereq-break-glass')
  assert.equal(done.laneView.lane, 'Completed', 'the premise: the board reads this step finished')
  assert.ok(done.emergencyAccountTasks, 'the premise: it still draws its procedures')
  assert.equal(done.implementationReference, true, 'a finished step still presents its procedures as instructions')
  // Every word is still there: this is what is open, not what exists.
  const lines = (done.emergencyAccountTasks.tasks ?? []).flatMap((t) => t.steps)
  assert.ok(lines.length > 15, `the procedures were dropped rather than folded: ${lines.length} lines`)

  // The same step before it is finished asks for the work, and says so.
  const open = bodyOf('demo', 's-prereq-break-glass')
  assert.notEqual(open.laneView.lane, 'Completed', 'the premise: this one is not finished')
  assert.equal(open.implementationReference, false, 'an open step folded away its own instructions')
})
