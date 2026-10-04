// Two tabs of one tenant's plan (F-161): the tab another tab has saved over
// stops saving, instead of putting its older copy back in silence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { announceSaved, isBehind, leavesBehind, letGo, LOADED, noteOwn, subscribeBehind } from './planSync.ts'
import { DEMO_TENANT_ID } from './demoMode.ts'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

test('another tab\'s save leaves this tab behind only when it saved something this tab does not hold', () => {
  const own = { plan: 'plan-A', mapping: 'map-A' }
  assert.equal(leavesBehind({ store: 'plan', key: 'plan-B' }, own), true, 'a newer plan record')
  assert.equal(leavesBehind({ store: 'mapping', key: 'map-B' }, own), true, 'a newer answer')
  assert.equal(leavesBehind({ store: 'plan', key: 'plan-A' }, own), false, 'a second tab saving what it loaded')
  assert.equal(leavesBehind({ store: 'replaced', key: '' }, own), true, 'a plan file loaded, or the tenant forgotten')
  // No copy of that store yet (still loading), and no copy of the tenant at all: nothing to be behind.
  assert.equal(leavesBehind({ store: 'plan', key: 'plan-B' }, { plan: null, mapping: 'map-A' }), false)
  assert.equal(leavesBehind({ store: 'plan', key: 'plan-B' }, undefined), false)
})

test('a save announced in another tab stops this tab saving that tenant, and the shell hears of it', async () => {
  noteOwn('tenant-1', 'plan', 'plan-A')
  noteOwn('tenant-2', 'plan', 'plan-X')
  let heard = 0
  const stop = subscribeBehind(() => { heard += 1 })
  const other = new BroadcastChannel('iamai-plan')
  try {
    other.postMessage({ tab: 'other-tab', tenantId: 'tenant-1', store: 'plan', key: 'plan-A' })
    await tick()
    assert.equal(isBehind('tenant-1'), false, 'the same content is not a change')
    other.postMessage({ tab: 'other-tab', tenantId: 'tenant-1', store: 'plan', key: 'plan-B' })
    await tick()
    assert.equal(isBehind('tenant-1'), true)
    assert.equal(isBehind('tenant-2'), false, 'another tenant is untouched')
    assert.equal(heard, 1)
    // This tab loading a plan file replaces the stored record: it holds the latest again.
    announceSaved('tenant-1', 'replaced')
    assert.equal(isBehind('tenant-1'), false)
  } finally {
    other.close()
    stop()
  }
})

test('both of the plan\'s writers check first and announce after, and the shell says to reload', () => {
  const data = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(data, /if \(isBehind\(next\.tenantId\)\) return\n\s+await saveMappingState\(next\)\n\s+announceSaved\(next\.tenantId, 'mapping', JSON\.stringify\(next\)\)/)
  // Every save is announced, a scan's first save included (Round 3 review); a tab holding the same words is not behind.
  assert.match(data, /if \(isBehind\(snapshot\.tenantId\)\) return\n\s+await savePlanRecord\(snapshot\.tenantId, decisions\)\n[^\n]*\n\s+announceSaved\(snapshot\.tenantId, 'plan', key\)/)
  assert.equal(data.includes('loadedOnly'), false)
  assert.match(data, /noteOwn\(snapshot\.tenantId, 'mapping', JSON\.stringify\(m\)\)/)
  // A tab that has loaded the plan and not yet saved it holds LOADED: a save announced meanwhile leaves it behind (Round 3 review).
  assert.match(data, /noteOwn\(snapshot\.tenantId, 'plan', LOADED\)/)
  assert.match(readFileSync('src/ui/surfaces/Export.tsx', 'utf8'), /announceSaved\(snapshot\.tenantId, 'replaced'\)/)
  assert.match(readFileSync('src/ui/actions.ts', 'utf8'), /await storeLib\.forgetTenant\(account\.tenantId\)\n[^\n]*\n\s+announceSaved\(account\.tenantId, 'replaced'\)/)
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(shell, /\{behind && <p role="alert" className="callout plan-behind">\{SHELL\.planChangedElsewhere\} <Button variant="secondary" onClick=\{\(\) => window\.location\.reload\(\)\}>\{app\.error\.reload\}<\/Button><\/p>\}/)
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
  assert.equal(content.pages.app.shell.planChangedElsewhere, 'This plan changed in another tab. Reload before changing anything here.')
})

test('a tab that has loaded but not yet saved is behind any save announced meanwhile, and the sample tenant is never guarded (Round 3 review)', async () => {
  noteOwn('tenant-3', 'plan', LOADED)
  noteOwn(DEMO_TENANT_ID, 'plan', 'sample-A')
  const other = new BroadcastChannel('iamai-plan')
  try {
    other.postMessage({ tab: 'other-tab', tenantId: 'tenant-3', store: 'plan', key: 'plan-new' })
    other.postMessage({ tab: 'other-tab', tenantId: DEMO_TENANT_ID, store: 'plan', key: 'sample-B' })
    await tick()
    assert.equal(isBehind('tenant-3'), true, 'the save landed while this tab was still loading')
    assert.equal(isBehind(DEMO_TENANT_ID), false, 'the sample re-dates itself on every load; two sample tabs never agree')
  } finally {
    other.close()
  }
})

// T3-A: a tab that switched to another tenant no longer holds the one it left.
// Another tab's save of it leaves nothing behind here, and a tenant this tab was
// behind on is not still behind when it is opened again from the store.
test('a tenant this tab let go of is never behind: another tab saving it changes nothing here', async () => {
  noteOwn('tenant-4', 'plan', 'plan-A')
  const other = new BroadcastChannel('iamai-plan')
  try {
    other.postMessage({ tab: 'other-tab', tenantId: 'tenant-4', store: 'plan', key: 'plan-B' })
    await tick()
    assert.equal(isBehind('tenant-4'), true)
    letGo('tenant-4')
    assert.equal(isBehind('tenant-4'), false, 'a tenant opened again is read afresh from the store, so it is not behind')
    other.postMessage({ tab: 'other-tab', tenantId: 'tenant-4', store: 'plan', key: 'plan-C' })
    await tick()
    assert.equal(isBehind('tenant-4'), false, 'a tab holding no copy was left behind')
  } finally {
    other.close()
  }
})
