// A plan file belongs to one tenant, and loading it into another must change
// nothing.
//
// The plan carries `tenant.id`, the verified domains, the operator's sign-in
// address, per-step population names and checkpoints holding the tenant's
// Conditional Access policy ids, exclusion group ids and break-glass user ids.
// The import wrote all of that under the *connected* tenant's key and then
// checked one field — `plan.mappings.tenantId` — after the write (audit
// token-01). The consequence was not abstract: `changesSince` diffs the live
// tenant against the imported checkpoint and reports every policy the other
// tenant had as "deleted", into the change record the operator hands a client.
//
// This asserts the guard is in the import path and that it runs before the
// write, by reading the source — the write is a React callback with an
// IndexedDB dependency, so the ordering is what is checkable here, and the
// ordering is the whole defect.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ROADMAP } from '../copy/pages.ts'

const PAGE = readFileSync('src/ui/pages/RoadmapPage.tsx', 'utf8')

test('the tenant check runs before anything is persisted', () => {
  const check = PAGE.indexOf('planTenantId !== snapshot.tenantId')
  const write = PAGE.indexOf('await savePlanRecord(snapshot.tenantId, record)')
  assert.ok(check > 0, 'the plan import no longer checks the tenant')
  assert.ok(write > 0, 'the plan import no longer writes a record')
  assert.ok(check < write, 'the tenant check runs after the write, which is the defect it was meant to fix')
})

test('a plan with no tenant is refused rather than assumed', () => {
  const guard = PAGE.indexOf('if (!planTenantId)')
  const write = PAGE.indexOf('await savePlanRecord(snapshot.tenantId, record)')
  assert.ok(guard > 0 && guard < write, 'a plan file with no tenant id is not refused before the write')
})

test('both refusals return without writing', () => {
  // Each guard must `return`, not fall through with a warning.
  // Scoped to loadPlanInner: `const stepsRecord` also appears in the
  // persistence effect earlier in the file, and indexOf found that one.
  const fn = PAGE.slice(PAGE.indexOf('const loadPlanInner'))
  const region = fn.slice(fn.indexOf('const planTenantId'), fn.indexOf('const stepsRecord'))
  assert.equal((region.match(/return/g) ?? []).length, 2, `expected two early returns, found: ${region}`)
})

test('the message names both tenants and neither id', () => {
  const msg = ROADMAP.planFromAnotherTenant('Contoso Holdings', 'Fabrikam Ltd')
  assert.match(msg, /Contoso Holdings/)
  assert.match(msg, /Fabrikam Ltd/)
  assert.match(msg, /Nothing was loaded/)
  assert.doesNotMatch(msg, /[0-9a-f]{8}-[0-9a-f]{4}/, 'the message shows a tenant id')
})

test('the message still reads when the plan carries no tenant name', () => {
  const msg = ROADMAP.planFromAnotherTenant('', 'Fabrikam Ltd')
  assert.ok(!msg.includes('  '), `double space from an empty name: ${msg}`)
  assert.match(msg, /another tenant/)
  assert.match(msg, /Fabrikam Ltd/)
})

test('the unknown-tenant message says nothing was loaded', () => {
  assert.match(ROADMAP.planTenantUnknown('Fabrikam Ltd'), /Nothing was loaded/)
})
