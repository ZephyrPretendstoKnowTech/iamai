// The Inventory's tables (Phase 2 audit, inventory surface): what the surface
// draws and what the Export CSV card writes are one model per table, and the
// model says only what the scan read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { appsModel, authMethodsModel, authStrengthsModel, capabilitiesModel, devicesModel, groupsModel, inventoryTables, licencesModel, locationsModel, methodTargetGroupsOf, peopleModel, policiesModel, policyFactsOf, referencedGroupsOf, registrationModel, rolesModel, securityDefaultsOf, shownCell, signInModels, workloadsModel } from './inventoryTables.ts'
import { serviceReading } from '../../roadmap/workflows.ts'
import { portalName } from '../../roadmap/portalLines.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { methodsCell, methodsLine } from './readinessCells.ts'
import { buildNameDirectory } from '../../names.ts'
import { app, directionWords, engine, pages, workflowWords } from '../../content/content.ts'
import { INVENTORY as C } from '../../copy/inventory.ts'
import { MFA_STATE } from '../../copy/definitions.ts'
import { fillText } from '../../content/render.ts'
import { emptyMappingState } from '../../mapping/types.ts'

const column = (t: { header: string[]; rows: (string | number)[][] }, header: string): (string | number)[] => {
  const i = t.header.indexOf(header)
  assert.ok(i >= 0, `a ${header} column in ${t.header.join(', ')}`)
  return t.rows.map((r) => r[i])
}

test('the Export CSV writes the table the Inventory draws: words, never raw keys, and an unknown stays unknown', () => {
  const f = fixture('demo-week2')
  const s = structuredClone(f.snapshot)
  s.devices[0] = { ...s.devices[0], isCompliant: null, isManaged: null, trustType: 'ServerAd' }
  const tables = inventoryTables(s, f.groups)
  const devices = tables.find((t) => t.id === 'devices')!
  // Graph did not report compliance: the file says it is not known, never "no".
  assert.equal(column(devices, C.devices.columns.compliant)[0], C.devices.unknown)
  assert.equal(column(devices, C.devices.columns.managed)[0], C.devices.unknown)
  assert.equal(column(devices, C.devices.columns.trust)[0], 'Hybrid joined')
  const policies = tables.find((t) => t.id === 'policies')!
  for (const v of column(policies, C.policies.columns.state)) assert.ok((Object.values(C.policies.state) as string[]).includes(String(v)), `a state word, not ${v}`)
  const methods = tables.find((t) => t.id === 'authentication')!
  for (const v of column(methods, C.authentication.methodColumns.method)) assert.ok(!/^(Fido2|MicrosoftAuthenticator|Sms|Voice)$/i.test(String(v)), `a method name, not the key ${v}`)
  for (const v of column(methods, C.authentication.methodColumns.state)) assert.ok([C.authentication.enabled, C.authentication.disabled].includes(String(v)))
  const people = tables.find((t) => t.id === 'people')!
  // An MFA state word, or MFA Readiness's word for methods the scan did not read.
  const words = [...Object.values(MFA_STATE).map((d) => d.title), (pages.readiness as unknown as { methods: { unread: string } }).methods.unread] as string[]
  for (const v of column(people, C.people.columns.mfa)) assert.ok(v === '—' || words.includes(String(v)), `an MFA state word, not ${v}`)
  // The surface draws these models and builds no CSV of its own.
  const page = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
  assert.match(page, /from '\.\/inventoryTables\.ts'/)
  assert.doesNotMatch(page, /\bcsv: \(/, 'the page writes a CSV cell of its own')
})

// ---- A section the scan did not read is drawn as not read, never as a finding ----

const failed = <S extends { config: Record<string, unknown> }>(s: S, key: string, status: 'error' | 'disabled' = 'error', reason = 'Request failed (500)'): S => {
  const c = structuredClone(s)
  c.config[key] = { status, reason, rows: [] }
  return c
}
const refused = <S extends { sources: Record<string, unknown> }>(s: S, key: string, reason = 'access denied (403)'): S => {
  const c = structuredClone(s)
  c.sources[key] = { ...(c.sources[key] as object), status: 'disabled', reason }
  return c
}
const notReadWord = (pages.connect as unknown as { scan: { gaps: { notRead: string } } }).scan.gaps.notRead

test('security defaults the scan could not read are not read, never "off"', () => {
  const s = failed(fixture('mid').snapshot, 'securityDefaults')
  const d = securityDefaultsOf(s)
  assert.equal(d.word, notReadWord)
  assert.equal(d.reason, 'Request failed (500)')
  const off = structuredClone(fixture('mid').snapshot)
  off.config.securityDefaults = { status: 'ok', reason: null, rows: [{ isEnabled: false }] }
  assert.equal(securityDefaultsOf(off).word, C.authentication.off, 'a read that says off is off')
})

test('a licence read that failed states no licence verdict', () => {
  const s = failed(fixture('mid').snapshot, 'subscribedSkus')
  s.capabilities = Object.fromEntries(Object.keys(s.capabilities).map((k) => [k, { enabled: false, seats: 0, consumed: 0 }])) as typeof s.capabilities
  for (const m of [licencesModel(s), capabilitiesModel(s)]) {
    assert.equal(m.notRead, 'Not read in this scan: Request failed (500).')
    assert.deepEqual(m.rows, [], `${m.id} draws no rows`)
  }
  assert.ok(!inventoryTables(s).some((t) => t.id === 'licensing'), 'no licences CSV of a read that failed')
})

test('registration counts the scan did not take are not drawn as zero', () => {
  // micro: no Entra ID P1, so the registration report is licence-gated.
  const micro = fixture('micro').snapshot
  const m = registrationModel(micro)
  assert.equal(m.notRead, `Not read in this scan: ${micro.sources.registrationDetails.reason}.`)
  assert.deepEqual(m.rows, [])
  const mid = refused(fixture('mid').snapshot, 'registrationDetails')
  assert.equal(registrationModel(mid).notRead, 'Not read in this scan: access denied (403).')
})

test('devices the scan could not read are not "no devices", and no empty devices CSV is offered', () => {
  const s = refused(fixture('mid').snapshot, 'devices')
  s.devices = []
  assert.equal(devicesModel(s, buildNameDirectory(s)).notRead, 'Not read in this scan: access denied (403).')
  // hostile: devices refused and too few sign-in records (Export finding 17).
  const hostile = inventoryTables(fixture('hostile').snapshot)
  assert.ok(!hostile.some((t) => t.id === 'devices'), 'no header-only devices file')
  assert.ok(!hostile.some((t) => t.id === 'signins'), 'no header-only sign-ins file')
  assert.ok(inventoryTables(fixture('demo').snapshot).some((t) => t.id === 'devices' && t.rows.length > 0), 'a read that returned devices is offered')
})

test('named locations and authentication strengths that were not read are not absent', () => {
  const base = fixture('mid').snapshot
  assert.equal(locationsModel(failed(base, 'namedLocations', 'disabled', 'access denied (403)'), []).notRead, 'Not read in this scan: access denied (403).')
  assert.equal(authStrengthsModel(failed(base, 'authStrengths')).notRead, 'Not read in this scan: Request failed (500).')
  assert.equal(locationsModel(base, []).notRead, null, 'a read section is drawn')
})

test('roles: unread assignments hide nothing as "no holder", and unread eligibility is not "—"', () => {
  const base = fixture('mid').snapshot
  const noAssignments = failed(base, 'roleAssignments')
  noAssignments.roles = { active: {}, eligible: {} }
  const m = rolesModel(noAssignments, buildNameDirectory(noAssignments))
  assert.equal(m.notRead, 'Not read in this scan: Request failed (500).')
  assert.equal(m.hiddenNote, null, 'no count of roles with "no holder"')
  const pim = failed(base, 'pimEligibility', 'disabled', 'access denied (403)')
  pim.capabilities = { ...pim.capabilities, pim: { enabled: true, seats: 10, consumed: 10 } }
  const r = rolesModel(pim, buildNameDirectory(pim))
  const eligible = r.columns.find((c) => c.key === 'eligible')!
  for (const row of r.rows) assert.equal(eligible.cell(row), notReadWord)
  assert.ok(r.hiddenNote && !/no holder/.test(r.hiddenNote), r.hiddenNote ?? '')
  // A licence gate is not a failed read: no eligible assignment can exist there.
  const gated = rolesModel(base, buildNameDirectory(base))
  assert.ok(gated.rows.some((row) => gated.columns.find((c) => c.key === 'eligible')!.cell(row) === '—'))
})

test('the Apps table blames no licence for a summary that failed to read', () => {
  const s = structuredClone(fixture('mid').snapshot)
  s.sources.appSignInSummary = { ...s.sources.appSignInSummary, status: 'error', reason: 'Request failed (500)' }
  s.appSignInSummary = []
  s.spActivity = []
  // The service principals were read and hold nothing: the line names the column whose own source failed.
  assert.equal(appsModel(s, buildNameDirectory(s)).empty, 'The Sign-ins column was not read in this scan: Request failed (500).')
  const read = structuredClone(fixture('mid').snapshot)
  read.appSignInSummary = []
  read.spActivity = []
  assert.equal(appsModel(read, buildNameDirectory(read)).empty, app.inventory.appsNone)
})

test('sign-in records: a licence gate says so, a partial read says so, and "nobody" is never said over records not read', () => {
  const micro = fixture('micro').snapshot
  assert.equal(signInModels(micro, buildNameDirectory(micro)).notRead, `Not read in this scan: ${micro.sources.signInEvidence.reason}.`)
  const s = structuredClone(fixture('demo').snapshot)
  s.sources.signInEvidence = { ...s.sources.signInEvidence, status: 'partial', reason: 'stopped at the page limit; covers the most recent 52 h of the requested 30 days' }
  const m = signInModels(s, buildNameDirectory(s))
  assert.equal(m.notRead, null)
  assert.equal(m.note, 'Partly read in this scan: stopped at the page limit; covers the most recent 52 h of the requested 30 days.')
  assert.equal(m.people([]), app.inventory.noneSeen)
  const full = fixture('demo').snapshot
  assert.equal(signInModels(full, buildNameDirectory(full)).people([]), C.signIns.nobody, 'a full read that saw no one says nobody')
  assert.doesNotMatch(C.signIns.distinctUsersTip.text, /30 days/, 'the window is the one the line above names')
})

test('a group whose read failed is not read, never 0 members', () => {
  const f = fixture('messy')
  const facts = policyFactsOf(f.snapshot)
  const referenced = referencedGroupsOf(facts)
  const [id] = [...referenced.keys()]
  const names = buildNameDirectory(f.snapshot)
  // The page's own read failed (a deleted, refused or unreadable group): what its catch records.
  const m = groupsModel(referenced, [{ groupId: id, displayName: null, memberCount: 0, sampled: false, membershipRule: null, read: false }], names)
  const row = m.rows.find((r) => r.id === id)!
  assert.equal(m.columns.find((c) => c.key === 'members')!.cell(row), notReadWord)
  // The Export's groups are the plan's: a group the plan did not read is not read there either.
  const csv = inventoryTables(f.snapshot, new Map()).find((t) => t.id === 'groups')!
  assert.ok(column(csv, C.groups.columns.members).every((v) => v === notReadWord), 'no measured-looking count of a group nobody read')
  const read = inventoryTables(f.snapshot, f.groups).find((t) => t.id === 'groups')!
  assert.ok(column(read, C.groups.columns.members).some((v) => /^\d/.test(String(v))), 'a group the plan read has its count')
})

test('a group, a named location or a strength without a name is named by its kind, never as an account', () => {
  const f = fixture('demo-week2')
  const group = [...f.groups.keys()].find((id) => /break/i.test(f.groups.get(id)!.displayName ?? ''))!
  const loc = 'aa0e7c6a-1111-4222-8333-444455556666'
  const strength = 'bb0e7c6a-1111-4222-8333-444455556666'
  const policy = {
    id: 'p-country-block',
    displayName: 'Country block',
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'], excludeGroups: [group] }, applications: { includeApplications: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: [loc] }, clientAppTypes: ['all'] },
    grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: strength } },
  }
  const s = failed(failed(f.snapshot, 'namedLocations', 'disabled', 'access denied (403)'), 'authStrengths', 'disabled', 'access denied (403)')
  // No group read has come back: the directory has no name for the group.
  const names = buildNameDirectory(s)
  const m = policiesModel(s, policyFactsOf(s, [policy]), names)
  const cell = (key: string) => m.columns.find((c) => c.key === key)!.cell(m.rows[0])
  assert.equal(cell('exclusions'), app.inventory.unnamedGroup)
  assert.equal(cell('conditions'), C.policies.locations(`all except ${app.inventory.locationNotRead}`))
  assert.equal(cell('grant'), C.policies.require(C.policies.strength(app.inventory.strengthNotRead)))
  for (const key of ['exclusions', 'conditions', 'grant']) assert.doesNotMatch(String(cell(key)), /account/)
  // A method scoped to a group: the page reads that group's name too, and never calls it an account.
  const scoped = structuredClone(f.snapshot)
  const fido = (scoped.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: { id: string; includeTargets: unknown[] }[] }).authenticationMethodConfigurations.find((c) => c.id.toLowerCase() === 'fido2')!
  fido.includeTargets = [{ id: group, targetType: 'group' }]
  assert.ok(methodTargetGroupsOf(scoped).includes(group), 'the page reads the method target group')
  const methods = authMethodsModel(scoped, buildNameDirectory(scoped))
  const targets = methods.columns.find((c) => c.key === 'targets')!
  assert.equal(targets.cell(methods.rows.find((r) => r.id.toLowerCase() === 'fido2')!), app.inventory.unnamedGroup)
  assert.equal(targets.cell(authMethodsModel(scoped, buildNameDirectory(scoped, f.groups)).rows.find((r) => r.id.toLowerCase() === 'fido2')!), f.groups.get(group)!.displayName)
  assert.match(readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8'), /methodTargetGroupsOf\(snapshot\)/)
})

test('a method that excludes a group says so, as Emergency Access reads the same policy', () => {
  const f = fixture('demo-week2')
  const group = [...f.groups.keys()].find((id) => /break/i.test(f.groups.get(id)!.displayName ?? ''))!
  const s = structuredClone(f.snapshot)
  const fido = (s.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: { id: string; excludeTargets?: unknown[] }[] }).authenticationMethodConfigurations.find((c) => c.id.toLowerCase() === 'fido2')!
  fido.excludeTargets = [{ id: group, targetType: 'group' }]
  const m = authMethodsModel(s, buildNameDirectory(s, f.groups))
  const cell = m.columns.find((c) => c.key === 'targets')!.cell(m.rows.find((r) => r.id.toLowerCase() === 'fido2')!)
  assert.equal(cell, `${C.authentication.allUsers} except ${f.groups.get(group)!.displayName}`)
  assert.ok(methodTargetGroupsOf(s).includes(group), 'the page reads the excluded group name too')
})

test('a role holder IAMAI could not look up is named without a kind it never read', () => {
  const f = fixture('demo-week2')
  const s = structuredClone(f.snapshot)
  // A role-assignable group holds Global Administrator; the v1.0 read carries no principal type, and the lookup came back empty.
  const holder = 'cc0e7c6a-1111-4222-8333-444455556666'
  s.roles.active[holder] = ['62e90394-69f5-4237-9190-012177145e10']
  const m = rolesModel(s, buildNameDirectory(s), new Map())
  const ga = m.rows.find((r) => r.id === '62e90394-69f5-4237-9190-012177145e10')!
  const active = String(m.columns.find((c) => c.key === 'active')!.cell(ga))
  assert.ok(active.includes(engine.names.unnamedHolder), active)
  assert.doesNotMatch(active, /service principal/)
  // Where the assignment row says the holder is a service principal, it is named as one.
  const sp = structuredClone(s)
  sp.config.roleAssignments.rows = [...sp.config.roleAssignments.rows, { principalId: holder, principalType: 'ServicePrincipal', roleDefinitionId: '62e90394-69f5-4237-9190-012177145e10' }]
  assert.equal(buildNameDirectory(sp).label(holder), 'a service principal')
})

test('a Policies row states what the policy excludes and every control it carries', () => {
  const s = fixture('demo-week2').snapshot
  const names = buildNameDirectory(s)
  const syncRole = 'd29b2b05-8046-44ba-8758-1e26182fcf32'
  const intuneEnrollment = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
  const raw = (id: string, conditions: Record<string, unknown>, grantControls: Record<string, unknown> | null, sessionControls: Record<string, unknown> | null = null) => ({
    id,
    displayName: id,
    state: 'enabled',
    conditions: { applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], ...conditions, users: { includeUsers: ['All'], ...((conditions.users as object) ?? {}) } },
    grantControls,
    sessionControls,
  })
  const policies = [
    raw('sync-role', { users: { excludeRoles: [syncRole] } }, { operator: 'OR', builtInControls: ['mfa'] }),
    raw('providers', { users: { excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'serviceProvider', externalTenants: { membershipKind: 'all' } } } }, { operator: 'OR', builtInControls: ['block'] }),
    raw('platforms', { platforms: { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS'] }, devices: { deviceFilter: { mode: 'exclude', rule: 'device.isCompliant -eq True' } } }, { operator: 'OR', builtInControls: ['block'] }),
    raw('apps', { applications: { includeApplications: ['All'], excludeApplications: [intuneEnrollment] } }, { operator: 'OR', builtInControls: ['mfa'], termsOfUse: ['tou-1'] }, { signInFrequency: { isEnabled: true, frequencyInterval: 'everyTime', authenticationType: 'primaryAndSecondaryAuthentication' } }),
  ]
  const m = policiesModel(s, policyFactsOf(s, policies), names)
  const cell = (id: string, key: string) => String(m.columns.find((c) => c.key === key)!.cell(m.rows.find((r) => r.id === id)!))
  assert.match(cell('sync-role', 'exclusions'), /Directory Synchronization Accounts/)
  assert.equal(cell('providers', 'exclusions'), portalName('guestType', 'serviceProvider'))
  assert.match(cell('platforms', 'conditions'), / except /)
  assert.ok(cell('platforms', 'conditions').includes(app.inventory.deviceFilterExclude), cell('platforms', 'conditions'))
  assert.equal(cell('apps', 'apps'), `${C.policies.allApps} except ${names.label(intuneEnrollment)}`)
  assert.ok(cell('apps', 'grant').includes(app.inventory.termsOfUse), cell('apps', 'grant'))
  assert.equal(cell('apps', 'session'), app.inventory.signInEveryTime)
})

test('Detected workloads says what the scan saw of each service, as Direction reads it', () => {
  const demo = fixture('demo').snapshot
  const word = (s: typeof demo, facet: string) => {
    const m = workloadsModel(s)
    const row = m.rows.find((r) => r.facet === facet)!
    return { name: m.columns.find((c) => c.key === 'workload')!.cell(row), word: m.columns.find((c) => c.key === 'detected')!.cell(row) }
  }
  // Direction's Confirm What You Use: absent for these three, present for directory synchronization.
  const reading = serviceReading(demo, [], [])
  for (const facet of ['avd', 'azureManagement', 'inforcer']) {
    assert.equal(reading.signal(facet).used, false)
    assert.equal(word(demo, facet).word, app.inventory.workloadNotSeen, facet)
  }
  assert.equal(word(demo, 'inforcer').name, 'Inforcer', 'a name, not the key')
  assert.equal(reading.signal('workload').used, true)
  assert.equal(word(demo, 'workload').word, app.inventory.workloadSeen)
  // Sources not read: the scan cannot say a service is not used.
  const unread = structuredClone(demo)
  unread.sources.appSignInSummary = { ...unread.sources.appSignInSummary, status: 'error', reason: 'Request failed (500)' }
  assert.equal(word(unread, 'avd').word, notReadWord)
  assert.equal(word(demo, 'intune').word, demo.capabilities.intune.enabled ? app.inventory.licensed : C.licensing.notLicensed)
})

test('People: a person whose methods were not read is not "Possibly broken", and read methods are named as MFA Readiness names them', () => {
  const unreadWord = (pages.readiness as unknown as { methods: { unread: string } }).methods.unread
  // micro: no Entra ID P1, so no registration report, but every person's methods were read one by one.
  const micro = fixture('micro').snapshot
  const m = peopleModel(micro, buildNameDirectory(micro))
  const cell = (model: typeof m, key: string, id: string) => String(model.columns.find((c) => c.key === key)!.cell(model.rows.find((r) => r.user.id === id)!))
  const rows = new Map(readinessView(micro, micro.asOf).rows.map((r) => [r.user.id, r]))
  for (const u of micro.users) assert.equal(cell(m, 'method', u.id), methodsLine(rows.get(u.id)!), u.displayName ?? u.id)
  assert.ok(micro.users.some((u) => cell(m, 'method', u.id) !== '—' && !/not read/.test(cell(m, 'method', u.id))), 'read methods are named')
  // mid: a method batch failed for one person, who has no registration row.
  const mid = structuredClone(fixture('mid').snapshot)
  const person = mid.users.find((u) => !mid.registrationDetails.some((r) => r.id === u.id)) ?? mid.users[0]
  mid.registrationDetails = mid.registrationDetails.filter((r) => r.id !== person.id)
  mid.authMethods[person.id] = 'unknown'
  const p = peopleModel(mid, buildNameDirectory(mid))
  assert.equal(cell(p, 'mfa', person.id), unreadWord)
  assert.equal(cell(p, 'method', person.id), unreadWord)
})

test('People: a held passkey that today\'s passkey settings do not allow is named in the Methods cell, as MFA Readiness names it', () => {
  // demo-week2: Jamie Brown holds a passkey and Authenticator, and today's passkey settings do not allow the passkey.
  const s = fixture('demo-week2').snapshot
  const jamie = s.users.find((u) => u.displayName === 'Jamie Brown')!
  const row = readinessView(s, s.asOf).rows.find((r) => r.user.id === jamie.id)!
  const shown = methodsCell(row)
  assert.ok(shown.note !== '', 'MFA Readiness notes the passkey under the cell')
  const m = peopleModel(s, buildNameDirectory(s))
  const methods = String(m.columns.find((c) => c.key === 'method')!.cell(m.rows.find((r) => r.user.id === jamie.id)!))
  assert.equal(methods, `${shown.main} · ${shown.note}`)
  assert.match(methods, /Passkey held/)
  const csv = inventoryTables(s, fixture('demo-week2').groups).find((t) => t.id === 'people')!
  assert.equal(csv.rows[csv.rows.findIndex((r) => r.includes(jamie.userPrincipalName ?? ''))][csv.header.indexOf(C.people.columns.method)], methods, 'the CSV writes the same words')
})

test('Policies and sign-in rows name Graph values as the portal does, never by their keys', () => {
  const s = fixture('demo').snapshot
  const names = buildNameDirectory(s)
  const raw = (id: string, conditions: Record<string, unknown>, applications: Record<string, unknown> = { includeApplications: ['All'] }) => ({
    id,
    displayName: id,
    state: 'enabled',
    conditions: { users: { includeUsers: ['All'] }, applications, clientAppTypes: ['all'], ...conditions },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  })
  const policies = [
    raw('legacy', { clientAppTypes: ['exchangeActiveSync', 'other'] }),
    raw('flows', { authenticationFlows: { transferMethods: 'deviceCodeFlow,authenticationTransfer' } }),
    raw('platforms', { platforms: { includePlatforms: ['android', 'iOS'] } }),
    raw('register', {}, { includeApplications: [], includeUserActions: ['urn:user:registersecurityinfo'] }),
  ]
  const m = policiesModel(s, policyFactsOf(s, policies), names)
  const all = m.rows.map((r) => m.columns.map((c) => String(c.cell(r))).join(' | ')).join('\n')
  for (const key of ['exchangeactivesync', 'deviceCodeFlow', 'authenticationTransfer', 'urn:user:', 'android']) assert.ok(!all.includes(key), `no ${key} in\n${all}`)
  for (const word of ['Exchange ActiveSync clients', 'Other clients', 'Device code flow', 'Authentication transfer', 'Android', 'iOS', 'Register security information']) assert.ok(all.includes(word), `${word} in\n${all}`)
  // Countries by name, not by ISO code.
  const byCountry = signInModels(s, names).byCountry
  assert.ok(byCountry.rows.length > 0)
  for (const r of byCountry.rows) assert.doesNotMatch(String(byCountry.columns[0].cell(r)), /^[A-Z]{2}$/)
})

test('the tab that lists every account is named for accounts, as its count is', () => {
  const s = fixture('demo').snapshot
  const m = peopleModel(s, buildNameDirectory(s))
  // demo: 38 accounts, of which 30 are active people; the tab lists every one, and its badge counts them.
  assert.equal(m.rows.length, s.users.length)
  assert.doesNotMatch(m.label, /people/i, 'the person word over a count of every account')
})

test('a read that returned nothing says so, not "yet" and not as a read that failed', () => {
  // micro: the policies and the licences were read, and the tenant has none of either.
  const micro = fixture('micro').snapshot
  assert.equal(micro.config.caPolicies.status, 'ok')
  assert.equal(policiesModel(micro, [], buildNameDirectory(micro)).empty, app.inventory.policiesNone)
  assert.equal(licencesModel(micro).empty, app.inventory.licencesNone)
  // demo: the records show no one blocked.
  const demo = fixture('demo').snapshot
  assert.equal(signInModels(demo, buildNameDirectory(demo)).blockedToday.empty, app.inventory.blockedNone)
  for (const line of [app.inventory.policiesNone, app.inventory.licencesNone, app.inventory.blockedNone]) assert.doesNotMatch(line, /\byet\b|were read/)
})

test('large tenants: counts carry separators on screen, and a holder cell names three and counts the rest', () => {
  const s = fixture('large').snapshot
  const names = buildNameDirectory(s)
  assert.equal(shownCell(58800), '58,800')
  const caps = capabilitiesModel(s)
  const p1 = caps.rows.find((r) => r.id === 'entraP1')!
  assert.match(String(caps.columns.find((c) => c.key === 'seats')!.cell(p1)), /^\d{1,3}(,\d{3})+ \(\d{1,3}(,\d{3})* assigned\)$/)
  const roles = rolesModel(s, names)
  const ga = roles.rows.find((r) => r.id === '62e90394-69f5-4237-9190-012177145e10')!
  const holders = String(roles.columns.find((c) => c.key === 'active')!.cell(ga))
  assert.ok(holders.split(', ').length > 3, 'the CSV lists every holder')
  assert.match(ga.activeShown, /and \d[\d,]* others$/)
  assert.equal(ga.activeShown.split(', ').length, 3, ga.activeShown)
})

test('groups referenced by policies the scan did not read are not "no policy references a group"', () => {
  const s = failed(fixture('demo').snapshot, 'caPolicies', 'disabled', 'access denied (403)')
  const m = groupsModel(referencedGroupsOf(policyFactsOf(s)), [], buildNameDirectory(s), s)
  assert.equal(m.notRead, 'Not read in this scan: access denied (403).')
  assert.ok(!inventoryTables(s).some((t) => t.id === 'groups'), 'no groups file over policies not read')
  assert.match(readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8'), /badge: badge\('caPolicies', referencedGroups\.size\)/)
})

test('an Apps column whose own source was not read says not read on screen as in the CSV, and the line over the table names that column', () => {
  const W = app.inventory as unknown as Record<string, string>
  const s = structuredClone(fixture('demo').snapshot)
  s.sources.spActivity = { ...s.sources.spActivity, status: 'error', reason: 'Request failed (500)' }
  const m = appsModel(s, buildNameDirectory(s))
  assert.equal(m.notRead, null, 'the summary was read: the table is drawn')
  assert.ok(m.rows.length > 0)
  const last = m.columns.find((c) => c.key === 'lastSp')!
  for (const r of m.rows) {
    assert.equal(last.cell(r), notReadWord)
    // No row carries a date, so the screen draws the model's cell for every row.
    assert.equal(r.lastSp, null)
  }
  assert.ok(column(inventoryTables(s).find((t) => t.id === 'apps')!, C.apps.columns.lastSp).every((v) => v === notReadWord), 'the CSV says not read')
  const page = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
  assert.match(page, /const lastSp = cellOf\(apps, 'lastSp'\)/)
  assert.match(page, /lastSp: \(r\) => \(r\.lastSp \? .+ : lastSp\(r\)\)/, 'the screen falls back to the model cell')
  assert.doesNotMatch(page, /'—'/, 'the page draws no word of its own for a cell')
  // The line over the table says which column was not read, not the whole table.
  assert.equal(m.note, fillText(W.columnNotRead, { column: C.apps.columns.lastSp, reason: 'Request failed (500)' }))
  const summary = structuredClone(fixture('demo').snapshot)
  summary.sources.appSignInSummary = { ...summary.sources.appSignInSummary, status: 'error', reason: 'Request failed (500)' }
  summary.spActivity = [{ appId: '00000003-0000-0ff1-ce00-000000000000', lastSignInActivity: { lastSignInDateTime: '2026-09-01T00:00:00Z' } }]
  const n = appsModel(summary, buildNameDirectory(summary))
  assert.equal(n.notRead, null, 'the service principals were read: the table is drawn')
  assert.equal(n.rows.length, 1)
  assert.equal(n.columns.find((c) => c.key === 'signIns')!.cell(n.rows[0]), notReadWord)
  assert.equal(n.note, fillText(W.columnNotRead, { column: C.apps.columns.signIns, reason: 'Request failed (500)' }))
  const partial = structuredClone(fixture('demo').snapshot)
  partial.sources.appSignInSummary = { ...partial.sources.appSignInSummary, status: 'partial', reason: 'stopped at the page limit' }
  assert.equal(appsModel(partial, buildNameDirectory(partial)).note, fillText(W.columnPartlyRead, { column: C.apps.columns.signIns, reason: 'stopped at the page limit' }))
})

test('each Detected workloads row is named as Direction names the service its word reads', () => {
  const demo = fixture('demo').snapshot
  const m = workloadsModel(demo)
  const name = m.columns.find((c) => c.key === 'workload')!
  const direction = workflowWords.names as Record<string, string>
  for (const r of m.rows) assert.equal(name.cell(r), direction[r.facet], r.facet)
  // The word on this row is whether an account holds the Directory Synchronization Accounts role: it is not workload identities.
  assert.equal(name.cell(m.rows.find((r) => r.facet === 'workload')!), 'Directory synchronization')
  assert.equal((app.inventory as unknown as Record<string, unknown>).workloadNames, undefined, 'one map of service names')
})

test('a Detected workloads tooltip says what its word says: what Direction shows the scan saw, or why it was not read', () => {
  const E = (directionWords.questions as unknown as { serviceEvidence: Record<string, string> }).serviceEvidence
  const demo = fixture('demo').snapshot
  const failedSources = structuredClone(demo)
  failedSources.sources.appSignInSummary = { ...failedSources.sources.appSignInSummary, status: 'error', reason: 'Request failed (500)' }
  const noSkus = failed(failedSources, 'subscribedSkus')
  const noRoles = failed(demo, 'roleAssignments', 'disabled', 'access denied (403)')
  for (const s of [demo, failedSources, noSkus, noRoles]) {
    const m = workloadsModel(s)
    const word = m.columns.find((c) => c.key === 'detected')!
    for (const r of m.rows) {
      const w = word.cell(r)
      // The engine's own reasons ("no sign-in activity for …", "no Intune licence") contradicted the word beside them.
      assert.doesNotMatch(r.reason ?? '', /^no |licence present|sign-in activity observed/i, `${r.facet}: ${w} | ${r.reason}`)
      if (w === notReadWord) assert.match(r.reason ?? '', /^(Not read|Partly read|Too little)/, `${r.facet}: ${r.reason}`)
    }
  }
  const row = (s: typeof demo, facet: string) => workloadsModel(s).rows.find((r) => r.facet === facet)!
  // Direction's sentences, word for word (roadmap/direction.ts serviceQuestion).
  assert.equal(row(demo, 'workload').reason, E.syncSeen)
  assert.equal(row(demo, 'avd').reason, fillText(E.notSeen, { service: 'Azure Virtual Desktop' }))
  assert.equal(row(failedSources, 'avd').reason, 'Not read in this scan: Request failed (500).')
  assert.equal(row(noRoles, 'workload').reason, 'Not read in this scan: access denied (403).')
  assert.equal(row(noSkus, 'intune').reason, 'Not read in this scan: Request failed (500).')
  assert.equal(row(demo, 'intune').reason, null, 'the licence word says it all')
  assert.match(readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8'), /title=\{r\.reason \?\? undefined\}/)
})

test("Detected workloads shows the answer saved in Direction beside the scan's reading", () => {
  const demo = fixture('demo').snapshot
  const mapping = { ...emptyMappingState(demo.tenantId), workflowAnswers: { avd: 'no' as const, sharepoint: 'yes' as const, azureManagement: 'unsure' as const }, facetOverrides: { inforcer: { on: false, reason: 'confirmed not in use' } } }
  const m = workloadsModel(demo, mapping)
  const answer = m.columns.find((c) => c.key === 'answer')
  assert.ok(answer, 'a column for the saved answer')
  const D = directionWords as unknown as { answeredIn: string; steps: { use: { title: string } }; questions: { serviceOptions: Record<string, string> } }
  assert.equal(answer.header, fillText(D.answeredIn, { step: D.steps.use.title }))
  const cell = (facet: string) => answer.cell(m.rows.find((r) => r.facet === facet)!)
  assert.equal(cell('avd'), D.questions.serviceOptions.no)
  assert.equal(cell('sharepoint'), D.questions.serviceOptions.yes)
  assert.equal(cell('inforcer'), D.questions.serviceOptions.no, 'an answer saved before workflowAnswers existed')
  assert.equal(cell('azureManagement'), '—', 'not sure is no answer')
  assert.equal(cell('copilot'), '—')
  // The answers read the Plan's own mapping, the one MFA Readiness reads; while it loads the column says so.
  const pending = workloadsModel(demo)
  assert.equal(pending.columns.find((c) => c.key === 'answer')!.cell(pending.rows[0]), '…')
  const page = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
  assert.match(page, /useAppliedMapping\(snapshot\)/)
  assert.match(page, /workloadsModel\(snapshot, mapping\)/)
})

test('a list of names never spends its room on "and 1 other": a fourth name is shown instead', async () => {
  const { firstThree } = await import('./inventoryTables.ts')
  assert.equal(firstThree(['Sam Patel', 'Morgan Brown', 'Break-glass 1', 'Break-glass 2']), 'Sam Patel, Morgan Brown, Break-glass 1, Break-glass 2')
  assert.equal(firstThree(['A', 'B', 'C', 'D', 'E']), 'A, B, C and 2 others')
  assert.equal(firstThree(['A', 'B', 'C']), 'A, B, C')
})

test('People: the Name cell does not repeat the sign-in address the next column prints', () => {
  const s = fixture('hostile').snapshot
  assert.ok(s.users.some((a) => a.displayName && s.users.some((b) => b.id !== a.id && b.displayName === a.displayName)), 'hostile shares a display name')
  const m = peopleModel(s, buildNameDirectory(s))
  const name = m.columns.find((c) => c.key === 'name')!
  const upn = m.columns.find((c) => c.key === 'upn')!
  for (const r of m.rows) {
    const u = String(upn.cell(r))
    if (u) assert.ok(!String(name.cell(r)).includes(u), `${name.cell(r)} | ${u}`)
    if (r.user.displayName) assert.equal(name.cell(r), r.user.displayName)
  }
})

test('a Policies row names the guest or external types a policy includes, as it names the ones it excludes', () => {
  const s = fixture('demo').snapshot
  const policy = (id: string, users: Record<string, unknown>) => ({ id, displayName: id, state: 'enabled', conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
  const m = policiesModel(s, policyFactsOf(s, [
    policy('providers', { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'serviceProvider,b2bDirectConnectUser', externalTenants: { membershipKind: 'all' } } }),
    policy('every-guest', { includeUsers: ['GuestsOrExternalUsers'] }),
  ]), buildNameDirectory(s))
  const users = (id: string) => String(m.columns.find((c) => c.key === 'users')!.cell(m.rows.find((r) => r.id === id)!))
  assert.equal(users('providers'), `${portalName('guestType', 'serviceProvider')}, ${portalName('guestType', 'b2bDirectConnectUser')}`)
  assert.equal(users('every-guest'), C.policies.guests)
  assert.match(readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8'), /includedGuestsWords\(r\)/, 'the Include line names them too')
})

test('a Policies row names risk levels as the portal does, not by their keys', () => {
  const s = fixture('demo').snapshot
  const m = policiesModel(s, policyFactsOf(s, [{ id: 'risk', displayName: 'risk', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], signInRiskLevels: ['high', 'medium'], userRiskLevels: ['high'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }]), buildNameDirectory(s))
  const conditions = String(m.columns.find((c) => c.key === 'conditions')!.cell(m.rows[0]))
  assert.ok(conditions.includes(C.policies.signInRisk(`${portalName('risk', 'high')}, ${portalName('risk', 'medium')}`)), conditions)
  assert.ok(conditions.includes(C.policies.userRisk(portalName('risk', 'high')!)), conditions)
  assert.doesNotMatch(conditions, /: (high|medium)\b/)
})

test('the Microsoft Authenticator targets say the authentication mode each carries, by the portal name', () => {
  const W = app.inventory as unknown as Record<string, string>
  const s = structuredClone(fixture('demo').snapshot)
  const configs = (s.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: { id: string; includeTargets: unknown[] }[] }).authenticationMethodConfigurations
  const authenticator = configs.find((c) => c.id.toLowerCase() === 'microsoftauthenticator')!
  const cell = () => {
    const m = authMethodsModel(s, buildNameDirectory(s))
    return m.columns.find((c) => c.key === 'targets')!.cell(m.rows.find((r) => r.id.toLowerCase() === 'microsoftauthenticator')!)
  }
  authenticator.includeTargets = [{ id: 'all_users', authenticationMode: 'push' }]
  assert.equal(cell(), fillText(W.authenticatorMode, { target: C.authentication.allUsers, mode: 'Push' }))
  authenticator.includeTargets = [{ id: 'all_users', authenticationMode: 'deviceBasedPush' }]
  assert.equal(cell(), fillText(W.authenticatorMode, { target: C.authentication.allUsers, mode: 'Passwordless' }))
  authenticator.includeTargets = [{ id: 'all_users', authenticationMode: 'any' }]
  assert.equal(cell(), fillText(W.authenticatorMode, { target: C.authentication.allUsers, mode: 'Any' }))
  // A method with no mode is drawn as before.
  const fido = authMethodsModel(s, buildNameDirectory(s))
  assert.equal(fido.columns.find((c) => c.key === 'targets')!.cell(fido.rows.find((r) => r.id.toLowerCase() === 'fido2')!), C.authentication.allUsers)
})

test('the Apps heading tip says what its tables show, and claims no window and no say over which goals apply', () => {
  const W = app.inventory as unknown as Record<string, string>
  const D = directionWords as unknown as { steps: { use: { title: string } } }
  // Detected workloads is the scan's view of each service; an app service's facet is on whatever the scan saw (coverage/applicability.ts), so the view drives no goal.
  assert.equal(C.source.apps.text, fillText(W.appsSource, { step: D.steps.use.title }))
  assert.doesNotMatch(C.source.apps.text, /goal|30 days|drive/i)
  assert.ok(C.source.apps.text.includes(D.steps.use.title), C.source.apps.text)
})

test('every pinned-baseline policy drawn as a Policies row names its values in words: no Graph key in any cell', () => {
  const W = app.inventory as unknown as Record<string, string>
  const pinned = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8')) as { policies: unknown[] }
  const s = fixture('demo').snapshot
  const m = policiesModel(s, policyFactsOf(s, pinned.policies), buildNameDirectory(s))
  assert.equal(m.rows.length, pinned.policies.length)
  // A camelCase word is a Graph key ("riskRemediation"); the portal's own names that look like one are allowed.
  const portalWords = new Set(['iOS', 'macOS'])
  for (const r of m.rows) {
    const cells = m.columns.filter((c) => c.key !== 'name').map((c) => String(c.cell(r))).join(' | ')
    const keys = (cells.match(/\b[a-z]+[A-Z][A-Za-z]*\b/g) ?? []).filter((k) => !portalWords.has(k))
    assert.deepEqual(keys, [], `${r.name}: ${cells}`)
  }
  // The risk remediation grant, by name (the high-risk users policy asks for it with a strength).
  const grant = m.columns.find((c) => c.key === 'grant')!
  assert.ok(m.rows.some((r) => String(grant.cell(r)).includes(W.riskRemediation)), 'a grant names risk remediation')
})
