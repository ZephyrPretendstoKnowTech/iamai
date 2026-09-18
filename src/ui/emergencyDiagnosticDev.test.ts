import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMappingState } from '../mapping/types.ts'
import { downloadEmergencyDiagnosticPair, emergencyDiagnosticPairPayload, ENTRA_ADMIN_TARGET, runEmergencyDiagnosticEntry } from './emergencyDiagnosticDev.ts'

const AAGUID = 'a25342c0-3cdc-4414-8e46-f4807fca511c'
function response(url: string, withSignIn: boolean): unknown {
  if (/\/users\/[^/]+\?/.test(url)) return { id: 'account-a', userPrincipalName: 'private@example.com', userType: 'Member', accountEnabled: true, onPremisesSyncEnabled: false, createdDateTime: '2026-01-01T00:00:00Z' }
  if (url.includes('/authentication/fido2Methods')) return { value: [{ id: 'method-a', displayName: 'Private key', aaGuid: AAGUID, model: 'Private model', passkeyType: 'deviceBound', createdDateTime: '2026-01-01T00:00:00Z' }] }
  if (url.includes('/auditLogs/signIns')) return { value: withSignIn ? [{ id: 'event-a', createdDateTime: new Date().toISOString(), userId: 'account-a', homeTenantId: 'tenant-a', appId: ENTRA_ADMIN_TARGET.appId, resourceId: ENTRA_ADMIN_TARGET.resourceId, status: { errorCode: 0 }, isInteractive: true, authenticationRequirement: 'multiFactorAuthentication', authenticationDetails: [{ authenticationStepDateTime: new Date().toISOString(), authenticationMethod: 'FIDO2', authenticationMethodDetail: 'Passkey', succeeded: true }], authenticationProcessingDetails: [] }] : [] }
  if (url.includes('/transitiveMemberOf')) return { value: [] }
  if (url.includes('/authenticationMethodConfigurations/Fido2')) return { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'all_users', targetType: 'group' }], excludeTargets: [], passkeyProfiles: [] }
  if (url.includes('/conditionalAccess/policies')) return { value: [] }
  if (url.includes('/authenticationStrength/policies')) return { value: [] }
  if (url.includes('/roleAssignmentScheduleInstances')) return { value: [] }
  if (url.includes('/roleAssignments')) return { value: [] }
  if (url.includes('/directoryAudits')) return { value: [] }
  throw new Error(`Unhandled Graph URL: ${url}`)
}

test('the dev entry runs the real collector/evaluator through a URL-routed transport and exports no credential material', async () => {
  const before = globalThis.fetch; let withSignIn = false
  globalThis.fetch = async request => new Response(JSON.stringify(response(String(request), withSignIn)), { status: 200, headers: { 'content-type': 'application/json' } })
  const mapping = { ...emptyMappingState('tenant-a'), breakGlassUserIds: ['account-a'] }
  const deps = { load: async () => mapping, tokens: async () => ({ get: () => 'private-token', refresh: async () => 'private-token' }), kind: 'synthetic' as const }
  try {
    const baseline = await runEmergencyDiagnosticEntry('tenant-a', 'baseline', deps)
    withSignIn = true
    const confirming = await runEmergencyDiagnosticEntry('tenant-a', 'confirming', deps)
    const payload = emergencyDiagnosticPairPayload()
    assert.equal(baseline.artifact.schema, 3)
    assert.equal(baseline.artifact.kind, 'synthetic')
    assert.equal(confirming.artifact.kind, 'synthetic')
    assert.ok(confirming.evaluation)
    assert.equal(payload.baseline.context.accounts[0], payload.confirming?.context.accounts[0])
    const exported = JSON.stringify(payload)
    for (const privateValue of ['private-token', 'private@example.com', 'Private key', 'Private model', 'account-a']) assert.doesNotMatch(exported, new RegExp(privateValue, 'i'))
    assert.match(exported, /providerAssurance/)

    let downloadedBlob: Blob | null = null
    let clicked = false
    let downloadName = ''
    const beforeDocument = globalThis.document
    const beforeCreateObjectURL = URL.createObjectURL
    const beforeRevokeObjectURL = URL.revokeObjectURL
    ;(globalThis as any).document = { createElement: () => ({
      href: '',
      set download(value: string) { downloadName = value },
      click: () => { clicked = true },
    }) }
    URL.createObjectURL = value => { if (value instanceof Blob) downloadedBlob = value; return 'blob:diagnostic-test' }
    URL.revokeObjectURL = () => undefined
    try {
      await downloadEmergencyDiagnosticPair('tenant-a', async () => mapping, async () => null)
      assert.equal(clicked, true)
      assert.match(downloadName, /^iamai-emergency-diagnostic-.+\.json$/)
      const downloaded = await downloadedBlob!.text()
      assert.deepEqual(JSON.parse(downloaded), payload)
      for (const privateValue of ['private-token', 'private@example.com', 'Private key', 'Private model', 'account-a']) assert.doesNotMatch(downloaded, new RegExp(privateValue, 'i'))
    } finally {
      ;(globalThis as any).document = beforeDocument
      URL.createObjectURL = beforeCreateObjectURL
      URL.revokeObjectURL = beforeRevokeObjectURL
    }
  } finally { globalThis.fetch = before }
})

test('confirmation refuses a changed tenant/account binding', async () => {
  const before = globalThis.fetch
  globalThis.fetch = async request => new Response(JSON.stringify(response(String(request), false)), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    await runEmergencyDiagnosticEntry('tenant-a', 'baseline', { load: async () => ({ ...emptyMappingState('tenant-a'), breakGlassUserIds: ['account-a'] }), tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }) })
    await assert.rejects(() => runEmergencyDiagnosticEntry('tenant-b', 'confirming', { load: async () => ({ ...emptyMappingState('tenant-b'), breakGlassUserIds: ['account-a'] }), tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }) }), /changed/)
  } finally { globalThis.fetch = before }
})

test('a delayed old baseline cannot overwrite a newer completed baseline', async () => {
  const mapping = { ...emptyMappingState('tenant-race'), breakGlassUserIds: ['account-a'] }
  let release!: (value: any) => void
  const delayed = new Promise<any>(resolve => { release = resolve })
  const artifact = (captureId: string) => ({ schema: 3, captureId, context: { accounts: [] } }) as any
  const deps = { load: async () => mapping, tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }) }
  const old = runEmergencyDiagnosticEntry('tenant-race', 'baseline', { ...deps, capture: async () => delayed })
  await runEmergencyDiagnosticEntry('tenant-race', 'baseline', { ...deps, capture: async () => artifact('new') })
  release(artifact('old'))
  await assert.rejects(old, /stale|superseded/i)
  assert.equal(emergencyDiagnosticPairPayload().baseline.captureId, 'new')
})

test('a baseline delayed before its first mapping read cannot overwrite a newer baseline', async () => {
  const mapping = { ...emptyMappingState('tenant-load-race'), breakGlassUserIds: ['account-a'] }
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const artifact = (captureId: string) => ({ schema: 3, captureId, context: { accounts: [] } }) as any
  const common = { loadSnapshot: async () => null, tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }) }
  const old = runEmergencyDiagnosticEntry('tenant-load-race', 'baseline', { ...common, load: async () => { await wait; return mapping }, capture: async () => artifact('old-load') })
  await runEmergencyDiagnosticEntry('tenant-load-race', 'baseline', { ...common, load: async () => mapping, capture: async () => artifact('new-load') })
  release()
  await assert.rejects(old, /superseded/i)
  assert.equal(emergencyDiagnosticPairPayload().baseline.captureId, 'new-load')
})

test('a confirmation cannot attach after a new baseline supersedes its pair', async () => {
  const mapping = { ...emptyMappingState('tenant-overlap'), breakGlassUserIds: ['account-a'] }
  const artifact = (captureId: string) => ({ schema: 3, captureId, context: { accounts: [] } }) as any
  const deps = { load: async () => mapping, tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }) }
  await runEmergencyDiagnosticEntry('tenant-overlap', 'baseline', { ...deps, capture: async () => artifact('baseline-a') })
  let release!: (value: any) => void; const delayed = new Promise<any>(resolve => { release = resolve })
  const confirming = runEmergencyDiagnosticEntry('tenant-overlap', 'confirming', { ...deps, capture: async () => delayed })
  await runEmergencyDiagnosticEntry('tenant-overlap', 'baseline', { ...deps, capture: async () => artifact('baseline-b') })
  release(artifact('confirmation-a'))
  await assert.rejects(confirming, /superseded/i)
  assert.equal(emergencyDiagnosticPairPayload().baseline.captureId, 'baseline-b')
})

test('mapping drift while a capture runs rejects the result and stale export validation rejects the pair', async () => {
  const mappingA = { ...emptyMappingState('tenant-drift'), breakGlassUserIds: ['account-a'] }
  const mappingB = { ...mappingA, breakGlassUserIds: ['account-b'] }
  let reads = 0
  await assert.rejects(() => runEmergencyDiagnosticEntry('tenant-drift', 'baseline', { load: async () => ++reads === 1 ? mappingA : mappingB, tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }), capture: async () => ({ schema: 3, captureId: 'drift', context: { accounts: [] } }) as any }), /changed while.*running/i)
  await runEmergencyDiagnosticEntry('tenant-drift', 'baseline', { load: async () => mappingA, tokens: async () => ({ get: () => 'token', refresh: async () => 'token' }), capture: async () => ({ schema: 3, captureId: 'current', context: { accounts: [] } }) as any })
  assert.throws(() => emergencyDiagnosticPairPayload(undefined, 'different-binding'), /stale/i)
})
