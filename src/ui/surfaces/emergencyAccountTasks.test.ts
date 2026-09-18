import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText, emergencyTaskText } from './emergencyAccountTasks.ts'

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
  assert.match(row.instruction, /scan coverage details/i)
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
  assert.match(yubikey, /YubiKey 5 Series/i)
  assert.match(yubikey, /AAGUID:/i)
  assert.match(ios, /Microsoft Authenticator.*iOS/i)
  assert.match(ios, /AAGUID:/i)
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
