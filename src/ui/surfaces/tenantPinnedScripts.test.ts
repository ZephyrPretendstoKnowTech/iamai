// N-027: a PowerShell tab's script runs in the tenant IAMAI scanned and nowhere
// else. An MSP's Graph session left open to another client is closed first, and
// every Connect-MgGraph names the tenant, so a script that reuses the session it
// finds (5.2's Connect-IAMAIContext) or signs in again (6.1) cannot write to
// another tenant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates, tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { pinnedToTenant } from './stepPowerShell.ts'

const ID = '00000000-0000-4000-8000-000000000001'

test('pinnedToTenant names the tenant, closes a session open elsewhere, and pins every Connect-MgGraph', () => {
  const script = "function Go {\n  Connect-MgGraph -Scopes 'Policy.Read.All' -NoWelcome\n}\nWrite-Host 'Run Connect-MgGraph first'\nConnect-MgGraph -TenantId 'kept' -Scopes 'X'\nGo"
  const out = pinnedToTenant(script, ID, 'Contoso Pty Ltd')
  const lines = out.split('\n')
  assert.equal(lines[0], `# For Contoso Pty Ltd only (tenant ID ${ID}): a session open in another tenant is closed first.`)
  assert.equal(lines[1], `if ((Get-MgContext) -and (Get-MgContext).TenantId -ne '${ID}') { Disconnect-MgGraph | Out-Null }`)
  assert.match(out, new RegExp(`Connect-MgGraph -TenantId '${ID}' -Scopes 'Policy.Read.All' -NoWelcome`))
  assert.match(out, /Connect-MgGraph -TenantId 'kept' -Scopes 'X'/, 'a connect that names a tenant is left as it is')
  for (const line of lines.filter((l) => /\bConnect-MgGraph\b/.test(l))) assert.match(line, /Connect-MgGraph -TenantId '/, line)
  assert.equal(pinnedToTenant('', ID, 'x'), '', 'no script, nothing to pin')
  assert.equal(pinnedToTenant(script, '', 'x'), script, 'no tenant id, nothing to pin')
  assert.match(pinnedToTenant(script, "x'; Remove-Item C:\\ -Recurse; '", 'x').split('\n')[1], /-ne '[0-9A-Za-z.-]+'\) \{ Disconnect-MgGraph \| Out-Null \}$/, 'the id cannot carry a quote or a statement')
})

test('every PowerShell tab on the sample tenants is pinned to the tenant the scan read', () => {
  let scripts = 0
  for (const f of [fixture('demo'), withFoundationSettled(fixture('demo')), withFoundationSettled(fixture('getiamai'))]) {
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
    for (const step of r.steps) {
      const ps = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ps')
      if (!ps) continue
      const text = ps.text()
      scripts++
      assert.ok(text.startsWith(`# For ${tenantNameOf(f.snapshot) || 'the scanned tenant'} only (tenant ID ${f.snapshot.tenantId})`), `${f.name}/${step.id}: ${text.split('\n')[0]}`)
      for (const line of text.split('\n').filter((l) => /\bConnect-MgGraph\b/.test(l))) assert.match(line, /Connect-MgGraph -TenantId '/, `${f.name}/${step.id}: ${line}`)
    }
  }
  assert.ok(scripts > 0, 'the premise: the samples hand over PowerShell')
})
