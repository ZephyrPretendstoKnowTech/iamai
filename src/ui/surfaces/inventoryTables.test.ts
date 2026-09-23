// The Inventory's tables (Phase 2 audit, inventory surface): what the surface
// draws and what the Export CSV card writes are one model per table, and the
// model says only what the scan read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { appsModel, authStrengthsModel, capabilitiesModel, devicesModel, inventoryTables, licencesModel, locationsModel, registrationModel, rolesModel, securityDefaultsOf, signInModels } from './inventoryTables.ts'
import { buildNameDirectory } from '../../names.ts'
import { app, pages } from '../../content/content.ts'
import { INVENTORY as C } from '../../copy/inventory.ts'
import { MFA_STATE } from '../../copy/definitions.ts'

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
  const words = Object.values(MFA_STATE).map((d) => d.title) as string[]
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
  assert.equal(appsModel(s, buildNameDirectory(s)).empty, 'Not read in this scan: Request failed (500).')
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
