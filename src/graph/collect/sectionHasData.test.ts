// sectionHasData is the one test a surface asks before drawing a count, an
// empty list or "off" from a section: only a read that returned data counts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { CONFIG_KEYS, SOURCE_KEYS, notReadDespiteLicence, partlyRead, readInFull, sectionHasData, sectionState, unreadSources } from './coreSections.ts'

test('a section has data when read whole or in part; partly read, read in full and not read despite the licence are decided here once', () => {
  // A section read whole or in part has data; a refused, failed or missing one does not.
  {
    const s = structuredClone(fixture('small')).snapshot
    assert.equal(sectionHasData(s, 'devices'), s.sources.devices?.status === 'ok' || s.sources.devices?.status === 'partial')
    s.sources.devices = { ...s.sources.devices!, status: 'error', reason: 'Forbidden' } as typeof s.sources.devices
    assert.equal(sectionHasData(s, 'devices'), false)
    s.sources.devices = { ...s.sources.devices!, status: 'partial', reason: null } as typeof s.sources.devices
    assert.equal(sectionHasData(s, 'devices'), true)
    s.config.securityDefaults = { ...s.config.securityDefaults!, status: 'error', reason: 'HTTP 500' } as typeof s.config.securityDefaults
    assert.equal(sectionHasData(s, 'securityDefaults'), false)
    delete (s.config as Record<string, unknown>).namedLocations
    assert.equal(sectionHasData(s, 'namedLocations'), false)
  }

  // Read in part is decided once: what the unread list marks partial, and nothing a licence withheld.
  {
    const s = structuredClone(fixture('mid').snapshot)
    s.sources.spActivity = { ...s.sources.spActivity, status: 'partial', reason: 'stopped at the page limit' }
    s.sources.users = { ...s.sources.users, status: 'partial', reason: 'needs Entra ID P1 or P2' }
    s.config.roleAssignments = { ...s.config.roleAssignments, status: 'partial', reason: 'Request failed (500) on page 3' }
    const listed = new Set(unreadSources(s).filter((u) => u.partial).map((u) => u.source))
    for (const key of [...CONFIG_KEYS, ...SOURCE_KEYS]) {
      const source = (CONFIG_KEYS as string[]).includes(key) ? `config:${key}` : key
      assert.equal(partlyRead(s, key), listed.has(source), key)
    }
    assert.equal(partlyRead(s, 'users'), false, 'a licence gate is not a shortfall')
    assert.deepEqual(sectionState(s, 'spActivity'), s.sources.spActivity)
  }

  // Read in full, and not read for a reason other than a licence.
  {
    const s = structuredClone(fixture('mid').snapshot)
    s.config.pimEligibility = { status: 'error', reason: 'Request failed (500)', rows: [] }
    s.config.roleAssignments = { ...s.config.roleAssignments, status: 'disabled', reason: 'needs Entra ID P2' }
    s.config.namedLocations = { ...s.config.namedLocations, status: 'partial', reason: 'Request failed (500) on page 2' }
    s.sources.users = { ...s.sources.users, status: 'partial', reason: 'needs Entra ID P1 or P2' }
    s.sources.devices = { ...s.sources.devices, status: 'ok', reason: null }
    delete (s.config as Record<string, unknown>).authStrengths
    // Not read, and not for a licence: a failure, a refusal, a section the scan lacks.
    assert.equal(notReadDespiteLicence(s, 'pimEligibility'), true)
    assert.equal(notReadDespiteLicence(s, 'authStrengths'), true)
    assert.equal(notReadDespiteLicence(s, 'roleAssignments'), false, 'a licence gate')
    assert.equal(notReadDespiteLicence(s, 'namedLocations'), false, 'read in part is read')
    // Read in full: ok, and nothing else.
    assert.equal(readInFull(s, 'devices'), true)
    for (const key of ['namedLocations', 'users', 'pimEligibility', 'roleAssignments', 'authStrengths'] as const) assert.equal(readInFull(s, key), false, key)
  }
})
