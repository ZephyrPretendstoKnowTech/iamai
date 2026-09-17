import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText, emergencyTaskText } from './emergencyAccountTasks.ts'
import { consolidateEmergencyReadiness } from './emergencyReadiness.ts'
import { stepExportView } from './stepExport.ts'
import { readinessOf, stepContract } from './stepContract.ts'

const STEP = 's-prereq-break-glass'
const YUBIKEY = 'a25342c0-3cdc-4414-8e46-f4807fca511c'
const AUTHENTICATOR_ANDROID = 'de1e552d-db1d-4423-a619-566b625cdc84'

function project(edit: (value: Fixture) => void = () => {}) {
  const value = structuredClone(fixture('small'))
  value.snapshot.config.authMethodsPolicy = structuredClone(fixture('demo-week2').snapshot.config.authMethodsPolicy)
  for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'fido2', aaGuid: YUBIKEY, passkeyType: 'deviceBound' }] as never
  edit(value)
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = {
    snapshot: value.snapshot,
    mapping: value.mapping,
    nameOf: id => run.input.names!.label(id),
    signature: 'IT',
    operatorId: value.operatorId,
    now: value.snapshot.asOf,
    groups: value.groups,
    directory: run.input.directory,
    naming: run.coverage.organisation.naming,
  }
  return { value, step, ctx, projected: emergencyAccountTasksOf(step, ctx) }
}

function presented(step: ReturnType<typeof project>['step'], ctx: StepVarContext, projected: ReturnType<typeof emergencyAccountTasksOf>) {
  const readiness = readinessOf(step, stepContract(step, ctx))
  const upns = new Map(ctx.mapping.breakGlassUserIds.flatMap(id => {
    const upn = ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())?.userPrincipalName
    return upn ? [[id, upn] as const] : []
  }))
  return { readiness, displayed: consolidateEmergencyReadiness(readiness, projected, upns, true), upns }
}

test('no saved account offers creation without claiming it is required', () => {
  const { projected } = project(value => { value.mapping.breakGlassUserIds = [] })
  const create = projected.tasks.find(task => task.id === 'create-account')
  assert.ok(create)
  assert.equal(create.required, false)
  assert.equal(projected.tasks.some(task => task.required), false)
  assert.doesNotMatch(emergencyAccountTasksText(projected), /\{[^}]+\}|\*\.onmicrosoft\.com/)
})

test('a compatible approved YubiKey or Authenticator does not create replacement work', () => {
  for (const aaguid of [YUBIKEY, AUTHENTICATOR_ANDROID]) {
    const { projected } = project(value => {
      for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'fido2', aaGuid: aaguid, passkeyType: 'deviceBound' }] as never
    })
    assert.equal(projected.tasks.some(task => task.id.startsWith('register-passkey:')), false, aaguid)
  }
})

test('a compatible saved custom passkey model does not force a YubiKey replacement', () => {
  const custom = '11111111-2222-4333-8444-555555555555'
  const { projected } = project(value => {
    value.mapping.passkeyApprovedModels = [{ name: 'Custom recovery key', aaguid: custom }]
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'fido2', aaGuid: custom, passkeyType: 'deviceBound' }] as never
    const row = value.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, any>[] }
    const fido = row.authenticationMethodConfigurations.find(method => String(method.id).toLowerCase() === 'fido2')!
    fido.keyRestrictions = { isEnforced: false, enforcementType: 'allow', aaGuids: [] }
    fido.passkeyProfiles = []
    delete fido.defaultPasskeyProfile
    for (const target of fido.includeTargets ?? []) target.allowedPasskeyProfiles = []
  })
  assert.equal(projected.tasks.some(task => task.id.startsWith('register-passkey:')), false)
  assert.ok(projected.approvedModels.some(model => model.name === 'Custom recovery key' && model.aaguid === custom))
})

test('a missing passkey creates one registration task with exactly three understandable methods and no preparation test', () => {
  const { value, projected } = project(value => {
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'phone', phoneType: 'mobile' }] as never
  })
  for (const id of value.mapping.breakGlassUserIds) {
    const registration = projected.tasks.find(task => task.id === `register-passkey:${id}`)
    assert.ok(registration)
    assert.deepEqual(registration.variants?.map(variant => variant.label), [
      'YubiKey security key',
      'Microsoft Authenticator on iPhone/iPad',
      'Microsoft Authenticator on Android',
    ])
    assert.equal(projected.tasks.some(task => task.id === `test-sign-in:${id}`), false)
    for (const variant of registration.variants ?? []) assert.match(variant.steps.join(' '), /Store|approved process/)
  }
  assert.doesNotMatch(emergencyAccountTasksText(projected), /Google Password Manager|iCloud Keychain|pre-change|recovery test|\{[^}]+\}/i)
  assert.match(emergencyAccountTasksText(projected), /\[Security info\]\(https:\/\/mysignins\.microsoft\.com\/security-info\)/)
  assert.doesNotMatch(emergencyAccountTasksText(projected), /Register a security key from the approved recovery models/)
})

test('Temporary Access Pass instructions contain one concrete registration completion action', () => {
  const source = readFileSync(new URL('./emergencyAccountTasks.ts', import.meta.url), 'utf8')
  assert.equal((source.match(/Complete the selected passkey-registration task/g) ?? []).length, 1)
  assert.match(source, /Complete the selected passkey-registration task and confirm the passkey appears for the intended account\./)
})

test('copy text contains only the selected account task and method', () => {
  const { projected } = project(value => {
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'phone', phoneType: 'mobile' }] as never
  })
  const registration = projected.tasks.find(task => task.id.startsWith('register-passkey:'))!
  const text = emergencyTaskText(registration, 'authenticator-ios')
  assert.match(text, /Register an approved passkey/)
  assert.match(text, /Microsoft Authenticator.*iPhone\/iPad|recovery iPhone\/iPad/)
  assert.match(text, new RegExp(registration.targetUpn!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(text, /YubiKey|Android|Create an emergency account|Issue a Temporary Access Pass/)
})

test('a directly observed missing passkey remains actionable when the intended profile assignment is unread', () => {
  const value = structuredClone(fixture('demo'))
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = {
    snapshot: value.snapshot,
    mapping: value.mapping,
    nameOf: id => run.input.names!.label(id),
    signature: 'IT',
    operatorId: value.operatorId,
    now: value.snapshot.asOf,
    groups: value.groups,
    directory: run.input.directory,
    naming: run.coverage.organisation.naming,
  }
  const projected = emergencyAccountTasksOf(step, ctx)
  const missing = value.mapping.breakGlassUserIds.find(id => Array.isArray(value.snapshot.authMethods[id]) && !value.snapshot.authMethods[id].some(method => method.kind === 'fido2' || method.kind === 'passkey'))
  assert.ok(missing)
  const registration = projected.tasks.find(task => task.id === `register-passkey:${missing}`)
  const inspection = projected.tasks.find(task => task.id === `inspect-passkey:${missing}`)
  assert.equal(registration?.evidence, 'No registered passkey was found.')
  assert.match(inspection?.evidence ?? '', /assigned passkey profile could not be read/i)
  assert.match(inspection?.steps.join(' ') ?? '', /Authentication methods.*display name, AAGUID and passkey type.*Passkey \(FIDO2\).*Do not change the policy or profile.*Scan to update the plan/i)
  assert.match(inspection?.steps.join(' ') ?? '', /Do not add or delete a method/i)
  assert.doesNotMatch(inspection?.steps.join(' ') ?? '', /Select \*\*Add sign-in method|finish registration/i)
  assert.equal(projected.tasks.some(task => task.id === `test-sign-in:${missing}`), false)
})

test('unread method evidence does not infer a registration mutation', () => {
  const { value, projected } = project(value => {
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = 'unknown'
  })
  assert.equal(projected.tasks.some(task => task.id.startsWith('register-passkey:')), false)
  for (const id of value.mapping.breakGlassUserIds) {
    const inspection = projected.tasks.find(task => task.id === `inspect-passkey:${id}`)
    assert.match(inspection?.evidence ?? '', /registered authentication methods could not be read/i)
    assert.match(inspection?.steps.join(' ') ?? '', /Authentication methods.*Scan to update the plan/i)
  }
})

test('exact issue consolidation keeps a shared-device finding beside a profile inspection action', () => {
  const { value, step, ctx, projected } = project(value => {
    const [id] = value.mapping.breakGlassUserIds
    const other = value.snapshot.users.find(user => !value.mapping.breakGlassUserIds.includes(user.id))!
    value.snapshot.authMethods[id] = [
      { kind: 'fido2', aaGuid: YUBIKEY, passkeyType: 'deviceBound' },
      { kind: 'microsoftAuthenticator', displayName: 'Shared recovery phone' },
    ] as never
    value.snapshot.authMethods[other.id] = [{ kind: 'microsoftAuthenticator', displayName: 'Shared recovery phone' }] as never
    const row = value.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, any>[] }
    const fido = row.authenticationMethodConfigurations.find(method => String(method.id).toLowerCase() === 'fido2')!
    for (const target of fido.includeTargets ?? []) delete target.allowedPasskeyProfiles
  })
  const id = value.mapping.breakGlassUserIds[0]
  const before = structuredClone(step.configurationFindings)
  const status = step.status
  const { displayed } = presented(step, ctx, projected)
  const tile = displayed.tiles.find(item => item.key === 'configuration:recovery-methods')!
  assert.ok(projected.tasks.some(task => task.id === `inspect-passkey:${id}`))
  assert.ok(tile.items?.some(item => item.accountId === id && item.issueKeys?.some(key => key.includes('bg.separateDevices')) && /shared/i.test(item.value)))
  assert.ok(tile.items?.some(item => item.issueKeys?.some(key => key.includes('profileOrPartial')) && item.actionCovered === true))
  assert.deepEqual(step.configurationFindings, before)
  assert.equal(step.status, status)
})

test('one matching identity action replaces only its exact issue', () => {
  const { value, step, ctx, projected } = project(value => {
    const id = value.mapping.breakGlassUserIds[0]
    value.snapshot.users.find(user => user.id === id)!.accountEnabled = false
    value.snapshot.roles.active[id] = []
  })
  const id = value.mapping.breakGlassUserIds[0]
  const source = readinessOf(step, stepContract(step, ctx)).tiles.find(item => item.key === 'configuration:account-setup')!
  const enableIssue = source.items?.find(item => item.issueKeys?.some(key => key.includes('bg.enabled')))!.issueKeys!
  const onlyEnable = { ...projected, tasks: [{ ...projected.tasks[0]!, id: `enable-account:${id}`, accountId: id, readinessKey: 'account-setup', required: true, issueKeys: enableIssue }] }
  const { displayed } = presented(step, ctx, onlyEnable)
  const tile = displayed.tiles.find(item => item.key === 'configuration:account-setup')!
  assert.ok(tile.items?.some(item => item.accountId === id && item.issueKeys?.some(key => key.includes('bg.enabled')) && item.actionCovered === true))
  assert.ok(tile.items?.some(item => item.accountId === id && item.issueKeys?.some(key => key.includes('bg.role.permanentGa'))))
})

test('duplicate display names cannot move or suppress another account issue', () => {
  const { value, step, ctx, projected } = project(value => {
    const [first, second] = value.mapping.breakGlassUserIds
    value.snapshot.users.find(user => user.id === first)!.displayName = 'Emergency Account'
    value.snapshot.users.find(user => user.id === second)!.displayName = 'Emergency Account'
    value.snapshot.users.find(user => user.id === first)!.accountEnabled = false
    value.snapshot.roles.active[second] = []
  })
  const [first, second] = value.mapping.breakGlassUserIds
  const onlyFirst = { ...projected, tasks: projected.tasks.filter(task => task.id === `enable-account:${first}`) }
  const { displayed, upns } = presented(step, ctx, onlyFirst)
  const tile = displayed.tiles.find(item => item.key === 'configuration:account-setup')!
  assert.ok(tile.items?.some(item => item.accountId === first && item.issueKeys?.some(key => key.includes('bg.enabled')) && item.actionCovered === true))
  const secondRole = tile.items?.find(item => item.accountId === second && item.issueKeys?.some(key => key.includes('bg.role.permanentGa')))
  assert.equal(secondRole?.subjectLabel, upns.get(second))
})

test('known absence and unread profile remain distinct actions while unmatched and set-wide evidence stays visible', () => {
  const value = structuredClone(fixture('demo'))
  const run = runFixture(value)
  const step = run.steps.find(item => item.id === STEP)!
  const ctx: StepVarContext = {
    snapshot: value.snapshot,
    mapping: value.mapping,
    nameOf: id => run.input.names!.label(id),
    signature: 'IT',
    operatorId: value.operatorId,
    now: value.snapshot.asOf,
    groups: value.groups,
    directory: run.input.directory,
    naming: run.coverage.organisation.naming,
  }
  const projected = emergencyAccountTasksOf(step, ctx)
  const missing = value.mapping.breakGlassUserIds.find(id => projected.tasks.some(task => task.id === `register-passkey:${id}`))!
  const registration = projected.tasks.find(task => task.id === `register-passkey:${missing}`)!
  const inspection = projected.tasks.find(task => task.id === `inspect-passkey:${missing}`)!
  assert.ok(registration.issueKeys?.length)
  assert.ok(inspection.issueKeys?.length)
  assert.equal(registration.issueKeys?.some(key => inspection.issueKeys?.includes(key)), false)
  const { readiness, upns } = presented(step, ctx, projected)
  const sourceTile = readiness.tiles.find(item => item.key === 'configuration:recovery-methods')!
  const supporting = sourceTile.items?.find(item => item.accountId && !item.issueKeys?.length)
  assert.ok(supporting, 'registered passkey details remain a separate source item')
  sourceTile.items = [...(sourceTile.items ?? []), { label: 'Selected accounts', value: 'Set-wide evidence remains.', issueKeys: ['validation:bg.count:set'] }, { label: 'Unstructured evidence', value: 'No metadata is available.' }]
  const displayed = consolidateEmergencyReadiness(readiness, projected, upns, true)
  const tile = displayed.tiles.find(item => item.key === 'configuration:recovery-methods')!
  assert.ok(tile.items?.some(item => item.value === 'Set-wide evidence remains.'))
  assert.ok(tile.items?.some(item => item.value === 'No metadata is available.'))
  assert.ok(tile.items?.some(item => item.value === supporting.value))
  assert.ok(tile.items?.some(item => item.issueKeys?.some(key => registration.issueKeys?.includes(key) || inspection.issueKeys?.includes(key)) && item.actionCovered === true))
  assert.deepEqual(consolidateEmergencyReadiness(readiness, projected, upns, false), readiness)
})

test('a required replacement suppresses role and credential work against the unsuitable account', () => {
  const { value, step, ctx } = project()
  const id = value.mapping.breakGlassUserIds[0]
  step.checks = { failing: 2, total: 2, items: [
    { fix: 'cloud-only', subject: 'breakGlass', target: id, values: {} },
    { fix: 'permanent-global-admin', subject: 'breakGlass', target: id, values: {} },
  ] }
  const projected = emergencyAccountTasksOf(step, ctx)
  assert.ok(projected.tasks.some(task => task.id === `create-replacement:${id}`))
  assert.equal(projected.tasks.some(task => task.id === `assign-role:${id}`), false)
  assert.equal(projected.tasks.some(task => task.id === `register-passkey:${id}`), false)
})

test('an unsuitable identity with an unread initial domain offers inspection and no mutation against that identity', () => {
  const { value, step, ctx } = project(value => {
    value.snapshot.config.organization.rows = [{ verifiedDomains: [] }]
  })
  const id = value.mapping.breakGlassUserIds[0]
  step.checks = { failing: 2, total: 2, items: [
    { fix: 'cloud-only', subject: 'breakGlass', target: id, values: {} },
    { fix: 'permanent-global-admin', subject: 'breakGlass', target: id, values: {} },
  ] }
  const projected = emergencyAccountTasksOf(step, ctx)
  assert.ok(projected.tasks.some(task => task.id === `inspect-initial-domain:${id}`))
  assert.equal(projected.tasks.some(task => task.id === `assign-role:${id}` || task.id === `register-passkey:${id}`), false)
  assert.doesNotMatch(emergencyAccountTasksText(projected), /\*\.onmicrosoft\.com|Select \*\*/)
})

test('unread permanent-role schedule evidence routes to inspection instead of assignment', () => {
  const { value, projected } = project(value => {
    value.snapshot.config.roleAssignmentSchedules = { status: 'error', reason: 'Denied', rows: [] }
  })
  for (const id of value.mapping.breakGlassUserIds) {
    assert.ok(projected.tasks.some(task => task.id === `inspect-account:${id}`))
    assert.equal(projected.tasks.some(task => task.id === `assign-role:${id}`), false)
  }
})

test('role assignment distinguishes direct and PIM controls', () => {
  const { value, step, ctx } = project()
  const id = value.mapping.breakGlassUserIds[0]
  step.checks = { failing: 1, total: 1, items: [{ fix: 'permanent-global-admin', subject: 'breakGlass', target: id, values: {} }] }
  const assignment = emergencyAccountTasksOf(step, ctx).tasks.find(task => task.id === `assign-role:${id}`)!
  const direct = assignment.steps.find(line => line.startsWith('For a direct assignment'))!
  const pim = assignment.steps.find(line => line.startsWith('If your organization uses PIM'))!
  assert.match(direct, /Roles & admins.*Global Administrator.*Add assignments/)
  assert.doesNotMatch(direct, /Assignment type|no expiry|Permanently assigned/)
  assert.match(pim, /Assignment type: Active.*Permanently assigned/)
})

test('TAP enabled only for an unrelated group does not create account-specific execution', () => {
  const { projected } = project(value => {
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'phone', phoneType: 'mobile' }] as never
    value.groups.set('tap-other', { memberIds: [], memberCount: 0, sampled: false })
    const row = value.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }
    row.authenticationMethodConfigurations.push({ id: 'TemporaryAccessPass', state: 'enabled', includeTargets: [{ id: 'tap-other', targetType: 'group' }], excludeTargets: [] })
  })
  assert.equal(projected.tasks.some(task => task.id.startsWith('issue-tap:')), false)
  assert.equal(projected.tapAvailable, false)
})

test('creation remains optional and example names appear only inside its SOP', () => {
  const { projected } = project(value => { value.mapping.breakGlassUserIds = [] })
  const create = projected.tasks.find(task => task.id === 'create-account')!
  assert.equal(create.required, false)
  assert.match(create.steps.join(' '), /emergency-access-primary.*emergency-access-secondary/)
  assert.doesNotMatch(emergencyAccountTasksText(projected), /Create an emergency account|emergency-access-primary/)
  assert.equal(projected.tasks.filter(task => task.id !== 'create-account').some(task => task.steps.some(step => /emergency-access-primary|emergency-access-secondary/.test(step))), false)
})

test('account preparation completes without exclusions, custody or a pre-change record while the exclusions step remains open', () => {
  const value = structuredClone(fixture('demo-week2'))
  value.checkpoints = []
  value.mapping.breakGlassAnswers = { credentialStorage: null, signInMonitoring: null }
  for (const policy of value.snapshot.config.caPolicies.rows as { conditions?: { users?: { excludeGroups?: string[] } } }[]) if (policy.conditions?.users) policy.conditions.users.excludeGroups = []
  const run = runFixture(value)
  const accounts = run.steps.find(item => item.id === STEP)!
  const exclusions = run.steps.find(item => item.id === 's-prereq-exclusion-group')!
  assert.equal(accounts.status, 'done')
  assert.deepEqual(accounts.configurationFindings?.map(finding => finding.key), ['account-setup', 'recovery-methods'])
  assert.notEqual(exclusions.status, 'done')
  assert.equal(exclusions.configurationFindings?.find(finding => finding.key === 'group-policies')?.outcome, 'fail')
  assert.equal(exclusions.configurationFindings?.some(finding => finding.key === 'pre-change-recovery'), false)
})

test('approved models come from the shared source and exclude removed vendors', () => {
  const { projected } = project()
  assert.ok(projected.approvedModels.some(model => model.name === 'Microsoft Authenticator — iOS'))
  assert.ok(projected.approvedModels.some(model => /YubiKey/i.test(model.name)))
  assert.equal(projected.approvedModels.some(model => /FEITIAN|TOKEN2/i.test(model.name)), false)
})

test('the standalone export uses the projected SOP instead of the obsolete procedure', () => {
  const { step, ctx } = project(value => {
    for (const id of value.mapping.breakGlassUserIds) value.snapshot.authMethods[id] = [{ kind: 'phone', phoneType: 'mobile' }] as never
  })
  const text = stepExportView(step, ctx).whatToDo.join('\n')
  assert.match(text, /Register an approved passkey/)
  assert.doesNotMatch(text, /Review the suggested identities|\*\.onmicrosoft\.com|not a passkey in Authenticator/i)
})

test('the obsolete pre-change recovery form is absent and task controls are Entra-only', () => {
  const source = readFileSync(new URL('./ContentStep.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /<RecoveryTestControl/)
  assert.match(source, /tasks && tab === 'portal'/)
  assert.doesNotMatch(source, /implementation-copy-menu|Copy all tasks|onConfirmCustody|preChangeTestRequired/)
  assert.match(source, /tab !== 'portal'.*emergency-channel-actions/)
})

test('Method selection captures primitive values before the functional state merge', () => {
  const source = readFileSync(new URL('./ContentStep.tsx', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf('onChange={event => {'), source.indexOf('onChange={event => {') + 360)
  assert.match(handler, /const taskId = activeTask\.id/)
  assert.match(handler, /const variantId = event\.currentTarget\.value/)
  assert.match(handler, /setVariants\(value => \(\{ \.\.\.value, \[taskId\]: variantId \}\)\)/)
  assert.doesNotMatch(handler.slice(handler.indexOf('setVariants')), /event\.currentTarget/)
})
