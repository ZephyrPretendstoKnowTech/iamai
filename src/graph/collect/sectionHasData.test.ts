// sectionHasData is the one test a surface asks before drawing a count, an
// empty list or "off" from a section: only a read that returned data counts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { sectionHasData } from './coreSections.ts'

test('a section read whole or in part has data; a refused, failed or missing one does not', () => {
  const f = structuredClone(fixture('small'))
  const s = f.snapshot
  assert.equal(sectionHasData(s, 'devices'), s.sources.devices?.status === 'ok' || s.sources.devices?.status === 'partial')
  s.sources.devices = { ...s.sources.devices!, status: 'error', reason: 'Forbidden' } as typeof s.sources.devices
  assert.equal(sectionHasData(s, 'devices'), false)
  s.sources.devices = { ...s.sources.devices!, status: 'partial', reason: null } as typeof s.sources.devices
  assert.equal(sectionHasData(s, 'devices'), true)
  s.config.securityDefaults = { ...s.config.securityDefaults!, status: 'error', reason: 'HTTP 500' } as typeof s.config.securityDefaults
  assert.equal(sectionHasData(s, 'securityDefaults'), false)
  delete (s.config as Record<string, unknown>).namedLocations
  assert.equal(sectionHasData(s, 'namedLocations'), false)
})

test('a section read in part is decided once: what the unread list marks partial, and nothing a licence withheld', async () => {
  const core = await import('./coreSections.ts')
  const s = structuredClone(fixture('mid').snapshot)
  s.sources.spActivity = { ...s.sources.spActivity, status: 'partial', reason: 'stopped at the page limit' }
  s.sources.users = { ...s.sources.users, status: 'partial', reason: 'needs Entra ID P1 or P2' }
  s.config.roleAssignments = { ...s.config.roleAssignments, status: 'partial', reason: 'Request failed (500) on page 3' }
  const listed = new Set(core.unreadSources(s).filter((u) => u.partial).map((u) => u.source))
  for (const key of [...core.CONFIG_KEYS, ...core.SOURCE_KEYS]) {
    const source = (core.CONFIG_KEYS as string[]).includes(key) ? `config:${key}` : key
    assert.equal(core.partlyRead(s, key), listed.has(source), key)
  }
  assert.equal(core.partlyRead(s, 'users'), false, 'a licence gate is not a shortfall')
  assert.deepEqual(core.sectionState(s, 'spActivity'), s.sources.spActivity)
  // The Inventory asks these, and keeps no lookup or licence test of its own.
  const inventory = (await import('node:fs')).readFileSync('src/ui/surfaces/inventoryTables.ts', 'utf8')
  assert.doesNotMatch(inventory, /function stateOf|isLicenceGate\(s\.reason\)/)
})
