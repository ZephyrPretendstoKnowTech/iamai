// The tenant-data guard (scripts/tenant-guard.mjs), proven on constructed text
// and on the tracked tree CI runs it over. The blocked addresses are built by
// concatenation so this file does not itself carry one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALLOWED_ADDRESSES, PRODUCT_DOMAIN, TENANT_DOMAIN, findingsIn, fingerprint, loadFingerprints, pathFindings, scanTracked } from '../../scripts/tenant-guard.mjs'

const NONE: ReadonlySet<string> = new Set()

test('the guard hits tenant and product addresses and fingerprinted values, and misses placeholders, ordinary ids and the public feedback address', () => {
  const text = `ok line\nsigned in as someone@${TENANT_DOMAIN} today`
  assert.deepEqual(findingsIn(text, NONE), [{ line: 2, rule: 'tenant-domain' }])
  assert.deepEqual(findingsIn(`SOMEONE@${TENANT_DOMAIN.toUpperCase()}`, NONE), [{ line: 1, rule: 'tenant-domain' }], 'case does not hide an address')
  // An address at the product domain is a hit, the public feedback address is not.
  assert.deepEqual(findingsIn(`contact owner@${PRODUCT_DOMAIN}.`, NONE), [{ line: 1, rule: 'product-domain' }])
  assert.deepEqual(ALLOWED_ADDRESSES, [`feedback@${PRODUCT_DOMAIN}`])
  assert.deepEqual(findingsIn(`Write to feedback@${PRODUCT_DOMAIN}. Or FEEDBACK@${PRODUCT_DOMAIN}`, NONE), [])
  // The website domain is not an address.
  assert.deepEqual(findingsIn(`https://${PRODUCT_DOMAIN}/planner/`, NONE), [])
  // Placeholders and ordinary ids are a miss.
  const placeholders = [
    'admin@contoso.com and breakglass@contoso.onmicrosoft.com',
    'tenant 00000000-0000-0000-0000-000000000001, app 00000003-0000-0000-c000-000000000000',
  ].join('\n')
  assert.deepEqual(findingsIn(placeholders, NONE), [])
  // A GUID or address on the fingerprint list is a hit without being named in the list.
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

// The owner's accounts sit at another onmicrosoft domain than TENANT_DOMAIN, and on
// 2026-09-27 a committed doc named that tenant bare, with no address at all (security
// audit S8). A fingerprinted domain or tenant name is a hit wherever it appears: an
// address's domain, a bare domain, or the name alone as a word.
test('a fingerprinted domain or tenant name is a hit as an address\'s domain, a bare domain or a word (S8)', () => {
  const label = 'examplelabtenant'
  const domain = `${label}.onmicrosoft.com`
  const list = new Set([fingerprint(domain), fingerprint(label)])
  assert.deepEqual(findingsIn(`sign in as breakglass@${domain.toUpperCase()}`, list), [{ line: 1, rule: 'fingerprint' }], 'an address at a fingerprinted domain passed')
  assert.deepEqual(findingsIn(`Tenant: ${domain}`, list), [{ line: 1, rule: 'fingerprint' }], 'a bare fingerprinted domain passed')
  assert.deepEqual(findingsIn(`**Tenant:** ${label.toUpperCase()} (redacted admin)`, list), [{ line: 1, rule: 'fingerprint' }], 'the tenant name alone passed')
  // One hit per token, and neighbours that merely contain the name are not it.
  assert.deepEqual(findingsIn(`${label}x and x${label} and contoso.onmicrosoft.com`, list), [])
})

// Review, 2026-09-28: the forms the first S8 rules let through. Each is one finding.
test('the tenant name or domain is caught before a full stop, inside another host, after @ or %40, and in a file name', () => {
  const label = 'examplelabtenant'
  const domain = `${label}.onmicrosoft.com`
  const list = new Set([fingerprint(domain), fingerprint(label)])
  for (const text of [
    `Tenant is ${label}.`,
    `${label}...`,
    `https://portal.azure.com/#@${domain}/resource`,
    `login_hint=admin%40${domain}`,
    `https://${label}.sharepoint.com/sites/it`,
    `https://${label}-my.sharepoint.com`,
    `route to user@${label}.mail.onmicrosoft.com`,
    `mail.${domain}`,
    `saved ${label}.json`,
    `ask @${label}`,
    `${label}-lab`,
    `${label}-scan.json`,
  ]) assert.deepEqual(findingsIn(text, list), [{ line: 1, rule: 'fingerprint' }], text.replace(label, 'NAME'))
})

// Review, 2026-09-28: the cases above are all caught by the bare name, so each rule is
// also proved alone: a listed domain whose name is too short to be a word, a listed
// hyphenated name, and a path, reported without the value.
test('each rule catches on its own: a parent domain, a hyphenated name, a path', () => {
  const short = 'abc.onmicrosoft.com'
  const onlyDomain = new Set([fingerprint(short)])
  for (const text of [`mail.${short}`, `#@${short}/x`, `hint=a%40${short}`, `Tenant: ${short}.`]) {
    assert.deepEqual(findingsIn(text, onlyDomain), [{ line: 1, rule: 'fingerprint' }], text)
  }
  assert.deepEqual(findingsIn('abc.sharepoint.com and abc', onlyDomain), [], 'a name under six characters is caught only as its listed domain')
  const hyphenated = new Set([fingerprint('ab-cd')])
  assert.deepEqual(findingsIn('owner of ab-cd, not ab-cde', hyphenated), [{ line: 1, rule: 'fingerprint' }], 'a listed hyphenated name passed')
  assert.deepEqual(findingsIn('ab-cde only', hyphenated), [])
  const label = 'examplelabtenant'
  const byName = new Set([fingerprint(label)])
  assert.deepEqual(pathFindings(`docs/qa/${label}-scan.json`, byName), [{ file: 'docs/qa/<fingerprinted>', line: 0, rule: 'fingerprint (path)' }], 'a path finding is missing or names the value')
  assert.deepEqual(pathFindings('docs/qa/contoso-scan.json', byName), [])
})

test('the committed list holds hashes only, and the tracked tree is clean', () => {
  const list = loadFingerprints()
  assert.ok(list.size > 0)
  for (const h of list) assert.match(h, /^[0-9a-f]{64}$/)
  assert.deepEqual(scanTracked(), [])
})
