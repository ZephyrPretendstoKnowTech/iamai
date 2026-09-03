// The readiness strip on the Plan: five tiles from the same population and
// campaign buckets the steps use, every number equal to the campaign step's and
// Today's for the same fact, the emergency and shared-device accounts never
// listed, the dots against the bar the plan needs. The Plan and step tips are
// gone; Today and Export keep theirs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { readinessStrip, meetsBar, STRIP_TILES } from './readinessStrip.ts'
import { contentLists } from './contentLists.ts'
import { campaignIdsFor } from './population.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { todayView } from './today.ts'
import { lockoutIds } from '../roadmap/lockout.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { pages } from '../content/content.ts'

test('every strip number is the campaign step\'s and Today\'s for the same fact, on the demo and GetIAMAI', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const nameOf = (id: string): string => r.input.names!.label(id)
    const strip = readinessStrip(f.snapshot, f.mapping, f.snapshot.asOf)
    const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf, operatorId: f.operatorId })
    // The campaign step: its population, its no-method and never-seen lists.
    const camp = r.steps.find((s) => s.id === 's-verify-mfa')!
    const ex = stepVars(camp, { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }) as Record<string, unknown>
    assert.equal(strip.active, ex.active, `${name}: the strip's active people are the campaign's`)
    assert.equal(strip.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length)
    assert.equal(strip.tiles.noMethod.length, cl.noMethod.length, `${name}: no method`)
    assert.equal(strip.tiles.unproven.length, cl.unproven.length, `${name}: registered, never used`)
    // Today, over the same people (its tiles count the emergency and shared-device accounts as people; the campaign does not).
    const tv = todayView(f.snapshot, f.snapshot.asOf, new Set([...f.mapping.serviceAccountUserIds, ...f.mapping.breakGlassUserIds, ...sharedDeviceIds(f.snapshot)]))
    assert.equal(strip.tiles.ready.length + strip.tiles.weak.length, tv.tiles.proven, `${name}: Ready and Method not strong enough are Today's proven`)
    assert.equal(strip.tiles.unproven.length, tv.tiles.unproven, `${name}: Today's unproven`)
    assert.equal(strip.tiles.noMethod.length, tv.tiles.noMethod, `${name}: Today's no method`)
    assert.equal(strip.active, tv.tiles.active, `${name}: Today's active`)
    // The four buckets partition the active people; the admins tile is the admin policy's lockout count.
    assert.equal(strip.tiles.ready.length + strip.tiles.weak.length + strip.tiles.unproven.length + strip.tiles.noMethod.length, strip.active, `${name}: a partition`)
    const without = lockoutIds('admins-phishing-resistant', r.viability, f.snapshot, new Set([...f.mapping.breakGlassUserIds, ...sharedDeviceIds(f.snapshot)]))
    assert.equal(strip.tiles.admins.length, without.length, `${name}: admins without a passkey or key`)
    const adminsStep = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')
    if (adminsStep && adminsStep.status !== 'done') assert.equal(strip.tiles.admins.length, adminsStep.lockout, `${name}: the admins step's own count`)
    // Never an emergency or shared-device account.
    const never = new Set([...f.mapping.breakGlassUserIds, ...sharedDeviceIds(f.snapshot)])
    for (const k of STRIP_TILES) for (const p of strip.tiles[k]) assert.ok(!never.has(p.id), `${name}: ${k} lists an emergency or shared-device account`)
    // The dots: phishing-resistant for an admin, a working method for everyone else.
    for (const p of strip.tiles.ready) assert.equal(p.meetsBar, true, `${name}: Ready meets the bar`)
    for (const p of strip.tiles.noMethod) assert.equal(p.meetsBar, false, `${name}: No method is below the bar`)
    for (const p of strip.tiles.admins) assert.ok(p.admin && !p.meetsBar, `${name}: the admins tile lists admins below the bar`)
    for (const p of strip.tiles.weak) assert.equal(p.meetsBar, !p.admin, `${name}: a working method meets the bar unless the person is an admin`)
    for (const k of STRIP_TILES) for (const p of strip.tiles[k]) assert.ok(typeof p.method === 'string' && (p.lastMfa === null || !Number.isNaN(Date.parse(p.lastMfa))), `${name}: ${k} rows carry a method and a last MFA sign-in`)
  }
  assert.equal(meetsBar({ methodTiers: ['push'], mfa: 'verified' } as never, true), false, 'an admin needs a passkey or key')
  assert.equal(meetsBar({ methodTiers: ['push'], mfa: 'verified' } as never, false), true, 'anyone else needs a working method')
  assert.equal(meetsBar({ methodTiers: ['phishingResistant'], mfa: 'notChallenged' } as never, true), true)
})

test('the Plan page tip and the step tip are gone; Today and Export keep theirs', () => {
  assert.ok(!('tip' in (pages.plan as Record<string, unknown>)), 'no pages.plan.tip')
  assert.ok(!('stepTip' in pages), 'no pages.stepTip')
  assert.ok(typeof (pages.today as Record<string, unknown>).tip === 'string')
  assert.ok(typeof (pages.export as Record<string, unknown>).tip === 'string')
  const R = (pages.plan as { readiness: { tiles: Record<string, string> } }).readiness
  assert.deepEqual(Object.values(R.tiles), ['Ready', 'Method not strong enough', 'Registered, never used', 'No method', 'Admins without a passkey or key'])
})
