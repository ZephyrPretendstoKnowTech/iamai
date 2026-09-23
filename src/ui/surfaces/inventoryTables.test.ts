// The Inventory's tables (Phase 2 audit, inventory surface): what the surface
// draws and what the Export CSV card writes are one model per table, and the
// model says only what the scan read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { inventoryTables } from './inventoryTables.ts'
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
