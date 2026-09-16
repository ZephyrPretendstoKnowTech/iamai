import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { tenantCountryLocation } from './countries.ts'

test('country equality includes lookup semantics and retains a selected duplicate identity', () => {
  const snapshot = fixtureSnapshot()
  const a = { '@odata.type': '#microsoft.graph.countryNamedLocation', id: 'a', countriesAndRegions: ['GB'], countryLookupMethod: 'clientIpAddress', includeUnknownCountriesAndRegions: false }
  const b = { ...a, id: 'b' }
  snapshot.config.namedLocations.rows = [b, a]
  assert.equal(tenantCountryLocation(snapshot, ['GB'])?.id, 'a', 'scan row ordering cannot remap')
  assert.equal(tenantCountryLocation(snapshot, ['GB'], ['b'])?.id, 'b')
  b.includeUnknownCountriesAndRegions = true
  assert.equal(tenantCountryLocation(snapshot, ['GB'], ['b']), null, 'selected drift cannot switch object')
  a.countryLookupMethod = 'authenticatorAppGps'
  assert.equal(tenantCountryLocation(snapshot, ['GB']), null)
  a.countryLookupMethod = 'clientIpAddress'
  delete (a as { includeUnknownCountriesAndRegions?: boolean }).includeUnknownCountriesAndRegions
  assert.equal(tenantCountryLocation(snapshot, ['GB']), null, 'missing fields are not proven exact')
})
