import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { devScanOverrides } from './devOverrides.ts'

test('a published build ignores the scan overrides in the query string', () => {
  assert.deepEqual(devScanOverrides('?dev=1&licence=free&fail=1', false), { devFail: false })
})

test('a dev build honours them only under ?dev=1', () => {
  assert.deepEqual(devScanOverrides('?dev=1&licence=p2&fail=1', true), { licenceOverride: 'p2', devFail: true })
  assert.deepEqual(devScanOverrides('?licence=free&fail=1', true), { devFail: false })
  assert.deepEqual(devScanOverrides('?dev=1&licence=enterprise', true), { devFail: false })
})

test('the scan reads its overrides through the dev-build gate', () => {
  const src = readFileSync(new URL('./runScan.ts', import.meta.url), 'utf8')
  assert.match(src, /devScanOverrides\(window\.location\.search, import\.meta\.env\.DEV\)/)
  assert.doesNotMatch(src, /params\.get\('licence'\)|params\.get\('fail'\)/)
})
