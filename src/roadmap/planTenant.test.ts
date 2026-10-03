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
import { app } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { planTenantRefusal } from './plan.ts'

const PLAN_ID = '11111111-1111-4111-8111-111111111111'
const CURRENT_ID = '22222222-2222-4222-8222-222222222222'
const ROADMAP = {
  planFromAnotherTenant: (planTenant: string, current: string): string => planTenantRefusal({ name: planTenant, id: PLAN_ID }, { name: current, id: CURRENT_ID }),
  planTenantUnknown: (current: string): string => fillText(app.export.planTenantUnknown, { current: current || app.export.thisTenant }),
}

const PAGE = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')

test('the tenant check and the no-tenant refusal both run before anything is persisted, and both return without writing', () => {
  const check = PAGE.indexOf('planTenantId !== snapshot.tenantId')
  const write = PAGE.indexOf('await importPlanRecords(snapshot.tenantId, load.record')
  assert.ok(check > 0, 'the plan import no longer checks the tenant')
  assert.ok(write > 0, 'the plan import no longer writes a record')
  assert.ok(check < write, 'the tenant check runs after the write, which is the defect it was meant to fix')

  // A plan with no tenant is refused rather than assumed.
  {
    const guard = PAGE.indexOf('if (!planTenantId)')
    const write = PAGE.indexOf('await importPlanRecords(snapshot.tenantId, load.record')
    assert.ok(guard > 0 && guard < write, 'a plan file with no tenant id is not refused before the write')
  }

  // Both refusals return without writing.
  {
    // Each guard must `return`, not fall through with a warning. Scoped to
    // loadPlanInner, ending at `const record` (the decisions-only record the guards
    // protect), so the two returns counted are the two guards, not anything later.
    const fn = PAGE.slice(PAGE.indexOf('const loadPlanInner'))
    const region = fn.slice(fn.indexOf('const planTenantId'), fn.indexOf('const record'))
    assert.equal((region.match(/return/g) ?? []).length, 2, `expected two early returns, found: ${region}`)
  }
})

test('the refusal names both tenants, each with its ID beside its name, still reads with no tenant name, and says nothing was loaded', () => {
  const msg = ROADMAP.planFromAnotherTenant('Contoso Holdings', 'Fabrikam Ltd')
  assert.match(msg, /Nothing was loaded/)
  // F-164 (owner, 2026-10-03): two tenants that share a display name read apart by their IDs.
  assert.ok(msg.includes(`Contoso Holdings (tenant ID ${PLAN_ID})`), msg)
  assert.ok(msg.includes(`Fabrikam Ltd (tenant ID ${CURRENT_ID})`), msg)
  {
    const same = ROADMAP.planFromAnotherTenant('Contoso Pty Ltd', 'Contoso Pty Ltd')
    assert.equal(same, `This plan was made for Contoso Pty Ltd (tenant ID ${PLAN_ID}), and you are connected to Contoso Pty Ltd (tenant ID ${CURRENT_ID}). Nothing was loaded. Open it while connected to Contoso Pty Ltd.`)
  }
  // The import builds the refusal from the plan's tenant ID and the connected one.
  assert.match(PAGE, /planTenantRefusal\(\{ name: plan\.tenant\?\.name, id: planTenantId \}, \{ name: tenantName, id: snapshot\.tenantId \}\)/)

  // The message still reads when the plan carries no tenant name.
  {
    const msg = ROADMAP.planFromAnotherTenant('', 'Fabrikam Ltd')
    assert.ok(!msg.includes('  '), `double space from an empty name: ${msg}`)
    assert.match(msg, /another tenant/)
    assert.match(msg, /Fabrikam Ltd/)
  }

  // The unknown-tenant message says nothing was loaded.
  {
    assert.match(ROADMAP.planTenantUnknown('Fabrikam Ltd'), /Nothing was loaded/)
  }
})
