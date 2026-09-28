// The sample tenant agrees with itself where an expert looks (F-140, F-064):
// one list of legacy-authentication accounts, phones that register rather than
// join, a printer that owns no computer, app
// sign-ins within the total, and "None registered now." beside a removed method.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './index.ts'
import { legacySignInIds } from '../blockSignIns.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { panelNoMethods } from '../../ui/surfaces/readinessCells.ts'

for (const name of ['demo', 'demo-week2'] as const) {
  test(`${name}: Inventory, Identify Service and Shared Accounts and Block Legacy Authentication read one legacy list (F-064)`, () => {
    const s = fixture(name).snapshot
    const rows = legacySignInIds(s)
    assert.ok(rows && rows.length > 0, 'the premise: the sample has legacy sign-ins')
    assert.deepEqual([...(s.evidenceUsage?.legacyAuth.userIds ?? [])].sort(), [...rows].sort())
    // The client-app breakdown carries those clients, out of the same total.
    const byClient = s.evidenceAggregates?.byClientApp ?? {}
    assert.ok(['IMAP4', 'Authenticated SMTP', 'Exchange ActiveSync'].every((c) => (byClient[c] ?? 0) > 0), JSON.stringify(byClient))
    assert.equal(Object.values(byClient).reduce((a, b) => a + b, 0), s.evidenceAggregates?.total)
  })

  test(`${name}: phones register, the printer owns no computer, app sign-ins fit the total (F-140)`, () => {
    const s = fixture(name).snapshot
    const phones = s.devices.filter((d) => d.operatingSystem === 'iOS')
    assert.ok(phones.length > 0, 'the premise: the sample has phones')
    for (const d of phones) assert.equal(d.trustType, 'Workplace', `${d.displayName} is an iOS device typed ${d.trustType}`)
    const printer = s.users.find((u) => u.displayName === 'MFP Reception')
    assert.ok(printer, 'the premise: the sample has its printer')
    assert.equal(s.devices.some((d) => d.ownerIds.includes(printer.id)), false, 'the printer owns a device')
    for (const a of (s.appSignInSummary ?? []) as { appDisplayName: string; signInCount: number }[]) assert.ok(a.signInCount <= (s.evidenceAggregates?.total ?? 0), `${a.appDisplayName}: ${a.signInCount} sign-ins against ${s.evidenceAggregates?.total}`)
  })
}

test('a person whose method was removed reads "None registered now.", never "yet" (F-140)', () => {
  const f = fixture('demo')
  const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  // The panel lists the person's phishing-resistant credentials; where there is none, it says so.
  const restore = view.rows.find((r) => r.readiness?.next.kind === 'restore' && (r.readiness?.credentials ?? []).length === 0)
  assert.ok(restore, 'the premise: the demo has a person whose method was removed')
  assert.equal(panelNoMethods(restore), 'None registered now.')
  const never = view.rows.find((r) => r.readiness != null && r.readiness.next.kind !== 'restore' && r.methods !== null && (r.readiness.credentials ?? []).length === 0)
  if (never) assert.equal(panelNoMethods(never), 'None registered yet.')
})
