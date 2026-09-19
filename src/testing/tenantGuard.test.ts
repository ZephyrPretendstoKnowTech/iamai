// The tenant-data guard (scripts/tenant-guard.mjs), proven on constructed text
// and on the tracked tree CI runs it over. The blocked addresses are built by
// concatenation so this file does not itself carry one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALLOWED_ADDRESSES, PRODUCT_DOMAIN, TENANT_DOMAIN, findingsIn, fingerprint, loadFingerprints, scanTracked } from '../../scripts/tenant-guard.mjs'

const NONE: ReadonlySet<string> = new Set()

test('an address at the tenant domain is a hit', () => {
  const text = `ok line\nsigned in as someone@${TENANT_DOMAIN} today`
  assert.deepEqual(findingsIn(text, NONE), [{ line: 2, rule: 'tenant-domain' }])
  assert.deepEqual(findingsIn(`SOMEONE@${TENANT_DOMAIN.toUpperCase()}`, NONE), [{ line: 1, rule: 'tenant-domain' }], 'case does not hide an address')
})

test('an address at the product domain is a hit, the public feedback address is not', () => {
  assert.deepEqual(findingsIn(`contact owner@${PRODUCT_DOMAIN}.`, NONE), [{ line: 1, rule: 'product-domain' }])
  assert.deepEqual(ALLOWED_ADDRESSES, [`feedback@${PRODUCT_DOMAIN}`])
  assert.deepEqual(findingsIn(`Write to feedback@${PRODUCT_DOMAIN}. Or FEEDBACK@${PRODUCT_DOMAIN}`, NONE), [])
  // The website domain is not an address.
  assert.deepEqual(findingsIn(`https://${PRODUCT_DOMAIN}/planner/`, NONE), [])
})

test('placeholders and ordinary ids are a miss', () => {
  const text = [
    'admin@contoso.com and breakglass@contoso.onmicrosoft.com',
    'tenant 00000000-0000-0000-0000-000000000001, app 00000003-0000-0000-c000-000000000000',
  ].join('\n')
  assert.deepEqual(findingsIn(text, NONE), [])
})

test('a GUID or address on the fingerprint list is a hit without being named in the list', () => {
  const guid = '12345678-9abc-4def-8123-456789abcdef'
  const address = 'someone@example.org'
  const list = new Set([fingerprint(guid), fingerprint(` ${address.toUpperCase()} `)])
  assert.equal(fingerprint(' ABC '), fingerprint('abc'), 'a fingerprint is of the value trimmed and lower-cased')
  assert.deepEqual(findingsIn(`policy ${guid.toUpperCase()}\nowner ${address}`, list), [
    { line: 1, rule: 'fingerprint' },
    { line: 2, rule: 'fingerprint' },
  ])
  assert.deepEqual(findingsIn('policy 12345678-9abc-4def-8123-456789abcdee', list), [], 'one character off is a different value')
})

test('the committed list holds hashes only, and the tracked tree is clean', () => {
  const list = loadFingerprints()
  assert.ok(list.size > 0)
  for (const h of list) assert.match(h, /^[0-9a-f]{64}$/)
  assert.deepEqual(scanTracked(), [])
})
