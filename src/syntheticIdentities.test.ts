// Shipped static content and fixtures carry synthetic identities only (S7,
// Plan Actionability + Trust Correction): no tenant-derived sign-in name,
// domain, person or device name from a real tenant, in content.json's example
// values, in the fixture generators, or in the snapshots they produce. The
// owner's attribution on the Home page is the one place the owner's own name
// belongs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { content } from './content/content.ts'
import { allFixtures } from './roadmap/fixtures/index.ts'

const OWNER = /Lachlan/
const OWN_TENANT = /getiamai\.onmicrosoft\.com|"GetIAMAI"/

/** Every `example` object in the content file, wherever it sits. */
function examples(node: unknown, path: string, out: [string, unknown][]): void {
  if (Array.isArray(node)) node.forEach((x, i) => examples(x, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) (k === 'example' ? out.push([`${path}.${k}`, v]) : examples(v, `${path}.${k}`, out))
}

test('content.json example values name a synthetic tenant, operator and accounts', () => {
  const found: [string, unknown][] = []
  examples(content, 'content', found)
  assert.ok(found.length > 20, 'the content file carries example values to check')
  for (const [path, ex] of found) {
    const text = JSON.stringify(ex)
    assert.doesNotMatch(text, OWNER, `${path} names the owner`)
    assert.doesNotMatch(text, OWN_TENANT, `${path} names the product's own tenant`)
  }
  const whole = JSON.stringify(content)
  const home = JSON.stringify(content.pages.home)
  assert.equal(whole.split('Lachlan').length - 1, home.split('Lachlan').length - 1, "the owner's name appears only in the Home attribution")
  assert.doesNotMatch(whole, /getiamai\.onmicrosoft\.com/, 'no sign-in address on the product tenant')
})

test('the fixture generators and the design renderer carry no tenant-derived identities', () => {
  const dirs = ['src/roadmap/fixtures', 'src/testing']
  const files = [...dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => join(d, f))), 'src/ui/demo.ts', 'src/ui/demoFacts.ts', 'src/content/render.ts']
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /getiamai\.onmicrosoft\.com/, `${file} names the product tenant's domain`)
    assert.doesNotMatch(text, OWNER, `${file} names the owner`)
  }
})

test('no fixture snapshot names the owner or the product tenant', () => {
  for (const f of allFixtures()) {
    const raw = JSON.stringify(f.snapshot)
    assert.doesNotMatch(raw, OWNER, `${f.name} names the owner`)
    assert.doesNotMatch(raw, /getiamai\.onmicrosoft\.com/, `${f.name} carries a sign-in address on the product tenant`)
  }
})
