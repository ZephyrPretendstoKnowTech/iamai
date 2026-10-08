// A policy step whose policy names an application this tenant has no service
// principal for says so, with the one line that creates it (owner, 2026-10-07:
// "how do I hydrate a missing service principal?"). The scan reads the service
// principals (registry 'Service principals', Directory.Read.All); where that read
// did not succeed, nothing claims an application is absent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { COLLECTOR_REGISTRY } from '../../graph/collect/registry.ts'
import { missingApplicationIds, servicePrincipalAppIds } from '../../roadmap/servicePrincipals.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

const INFORCER = '708861da-226e-4d65-a57a-24128df64524'
const STEP = 's-goal-inforcer-mfa'

/** The sample with Inforcer in use, so Require MFA for Inforcer Access is on the plan. */
function withInforcer(): Fixture {
  const f = fixture('demo')
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
  f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
  f.mapping.workflowConfirmedAt = f.snapshot.asOf
  return f
}

function tilesOf(f: Fixture): { key: string; label: string; value: string; note: string | null }[] {
  const run = runFixture(f, {}, null, f.snapshot.asOf)
  const step = run.steps.find((s) => s.id === STEP)!
  assert.ok(step && !step.state.setAside, 'the premise: the Inforcer step is on the plan')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  return stepBodyOf(step, ctx).readiness.tiles.filter((t) => t.key.startsWith('pitfall:app:'))
}

test('the scan reads the service principals under Directory.Read.All, one paged read, and the sample holds every first-party application and not Inforcer', () => {
  const spec = COLLECTOR_REGISTRY.find((s) => s.configKey === 'servicePrincipals')
  assert.ok(spec, 'the read is in the registry')
  assert.equal(spec.lane, '0')
  assert.equal(spec.paged, true)
  assert.deepEqual(spec.scopes, ['Directory.Read.All'], 'no new permission')
  const present = servicePrincipalAppIds(fixture('demo').snapshot)
  assert.ok(present && present.size > 10)
  assert.ok(present.has('00000002-0000-0ff1-ce00-000000000000'), 'Office 365 Exchange Online')
  assert.equal(present.has(INFORCER), false)
})

test('Require MFA for Inforcer Access names Inforcer as not in the tenant, with New-MgServicePrincipal and its application id; present, or unread, it says nothing', () => {
  const f = withInforcer()
  const tiles = tilesOf(f)
  assert.equal(tiles.length, 1, JSON.stringify(tiles))
  assert.equal(tiles[0].key, `pitfall:app:${INFORCER}`)
  assert.equal(tiles[0].label, 'Application not in your tenant')
  assert.equal(tiles[0].value, 'Inforcer')
  assert.match(tiles[0].note ?? '', /matches nothing for Inforcer/)
  assert.ok((tiles[0].note ?? '').includes(`New-MgServicePrincipal -AppId ${INFORCER}`), tiles[0].note ?? '')
  assert.match(tiles[0].note ?? '', /scan again/)

  // The service principal exists: no card.
  const present = withInforcer()
  present.snapshot.config.servicePrincipals.rows.push({ id: '00000000-0000-4000-8000-00000000f0f0', appId: INFORCER, displayName: 'Inforcer', accountEnabled: true })
  assert.deepEqual(tilesOf(present), [])

  // The read failed, or a snapshot from before the read existed: nothing claims the application is absent.
  const failed = withInforcer()
  failed.snapshot.config.servicePrincipals = { status: 'error', reason: 'access denied (403)', rows: [] }
  assert.deepEqual(tilesOf(failed), [])
  const old = withInforcer()
  delete (old.snapshot.config as Partial<typeof old.snapshot.config>).servicePrincipals
  assert.deepEqual(tilesOf(old), [])
})

test('only a GUID application the policy includes or excludes counts, once, and never a keyword like All', () => {
  const f = fixture('demo')
  const bodies = [
    { conditions: { applications: { includeApplications: ['All'], excludeApplications: [INFORCER, INFORCER.toUpperCase()] } } },
    { conditions: { applications: { includeApplications: ['00000002-0000-0ff1-ce00-000000000000', 'Office365'] } } },
  ]
  assert.deepEqual(missingApplicationIds(f.snapshot, bodies), [INFORCER])
})
