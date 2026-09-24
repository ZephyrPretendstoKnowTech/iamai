// Review queue (register-info-protected step 4): the package's Entra create told the
// operator to "Use {{policy.target.mode}}", a mode IAMAI never binds because the
// resolved target (MFA outside All trusted locations) is neither of the package's two
// modes. So every executable render withheld the Entra tab while PowerShell and JSON
// applied the target. Step 3 and step 4 now read the target's own location scope and
// grant, in the words the step's portal lines (and so the export) already say them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { NO_RUNTIME, projectSafely } from '../../content/implementation/project.ts'
import { planDates } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { implementationPackageFor, packageBindings } from './stepPackage.ts'
import { stepContract } from './stepContract.ts'

const LOCATIONS = 'Conditions → Locations → '
const GRANT = 'Grant → '

function opened(f: ReturnType<typeof fixture>) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === 's-goal-register-info-protected')!
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as never
  return { step, ctx }
}

// On one representative tenant: the demo-week2 and mid tenants resolve the same target.
test("register-info-protected: the Entra create names the target's location scope and grant", () => {
  const { step, ctx } = opened(fixture('small'))
  const op = step.action.resolution?.policies?.[0]
  const target = (op?.target ?? op?.body) as { conditions: { locations: unknown }; grantControls: unknown }
  // Premise: the resolved target is MFA outside All trusted locations, neither of the package's two modes.
  assert.deepEqual(target.conditions.locations, { includeLocations: ['All'], excludeLocations: ['AllTrusted'] })
  assert.deepEqual(target.grantControls, { operator: 'OR', builtInControls: ['mfa'] })
  const body = stepBodyOf(step, ctx)
  assert.equal(body.previewNote, null)
  const entra = body.artifacts.find((a) => a.id === 'portal')
  assert.ok(entra && !entra.unavailable, 'the Entra tab is withheld')
  // The step's create (roadmap/policyProcedure.ts). mfa-everyone-spec.md §2 A1
  // (ms-security-info step 7, ms-network): the Include and Exclude are named
  // only after Configure is set to Yes, because "Conditional Access policies
  // apply to all locations by default".
  const create = body.emergencyAccountTasks?.tasks.find((t) => t.id === 'create')
  assert.ok(create, 'the step draws no create')
  const text = create.steps.join('\n')
  assert.ok(text.includes('Under **Conditions → Locations**, set **Configure** to **Yes**, include **Any location** and exclude **All trusted locations**.'), text)
  assert.ok(text.includes('Under **Grant**, select **Require multifactor authentication**.'), text)
  assert.ok(entra.text().includes(create.steps[0]), 'the Entra tab carries the same words')
  assert.doesNotMatch(text, /\{\{|mode|blockOutsideTrusted/)
  for (const id of ['ps', 'json', 'ai']) {
    const a = body.artifacts.find((x) => x.id === id)
    assert.ok(a && !a.unavailable, `${id} is withheld`)
  }
  // Nothing is degraded: the words are bound, and a mode is no longer asked for.
  const c = stepContract(step, ctx)
  const projection = projectSafely(implementationPackageFor(step)!, 'missing', packageBindings(step, ctx, c), NO_RUNTIME)
  assert.equal(projection.hold, null)
  assert.equal(projection.degraded ?? null, null)
})

test('register-info-protected: without the grant words the Entra steps are withheld alone, and a target with no location condition drops only the location line', () => {
  const { step, ctx } = opened(fixture('small'))
  const pkg = implementationPackageFor(step)!
  const bindings = packageBindings(step, ctx, stepContract(step, ctx)) as Record<string, unknown>
  const { ['policy.target.grantWords']: _grant, ...noGrant } = bindings
  const held = projectSafely(pkg, 'missing', noGrant, NO_RUNTIME)
  assert.deepEqual(held.degraded?.map((d) => [d.channel, d.missingBindings]), [['entra', ['policy.target.grantWords']]])
  assert.ok(held.channels.some((c) => c.channel === 'powershell') && held.channels.some((c) => c.channel === 'json'))
  const { ['policy.target.locationWords']: _location, ...noLocation } = bindings
  const entra = projectSafely(pkg, 'missing', noLocation, NO_RUNTIME).channels.find((c) => c.channel === 'entra')
  assert.ok(entra, 'the Entra create was withheld for want of an optional location line')
  assert.doesNotMatch(entra.text, /Locations|\[omit/)
  assert.match(entra.text, /\n4\. Grant: \*\*Require multifactor authentication\*\*/)
})
