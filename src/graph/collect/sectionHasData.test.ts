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
