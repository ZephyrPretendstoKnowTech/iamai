import { writeFile } from 'node:fs/promises'
import { captureEmergencyAccessDiagnostic } from './emergency-access-diagnostic-core.ts'
export { captureEmergencyAccessDiagnostic, createDiagnosticPseudonymizer, evaluateDiagnosticPair } from './emergency-access-diagnostic-core.ts'

async function synthetic(): Promise<void> {
  const responses = [
    { id: 'account-1', userPrincipalName: 'synthetic@example.invalid', userType: 'Member', accountEnabled: true, onPremisesSyncEnabled: false, createdDateTime: '2026-01-01T00:00:00Z' },
    { value: [{ id: 'method-1', displayName: 'Security key', aaGuid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', passkeyType: 'deviceBound', model: 'YubiKey 5 NFC', createdDateTime: '2026-01-01T00:00:00Z' }] },
    { value: [] }, { value: [] },
    { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, includeTargets: [{ id: 'all_users', targetType: 'group' }], excludeTargets: [], passkeyProfiles: [] },
    { value: [] }, { value: [] }, { value: [] }, { value: [] },
    { id: 'group-1', membershipRule: null, membershipRuleProcessingState: null, mailEnabled: false, securityEnabled: true, groupTypes: [], isAssignableToRole: false, assignedLicenses: [] },
    { value: [] }, { value: [] }, { value: [] }, { value: [] }, { value: [] },
  ]
  let index = 0
  const before = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(responses[index++] ?? { value: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    const artifact = await captureEmergencyAccessDiagnostic({ get: () => 'synthetic-token', refresh: async () => 'synthetic-token' }, {
      accountIds: ['account-1'], groupId: 'group-1', tenantId: '00000000-0000-4000-8000-000000000001',
      expectedTarget: { appId: '74658136-14ec-4630-ad9b-26e160ff0fc6', resourceId: '00000003-0000-0000-c000-000000000000' },
      approvedAaguids: ['a25342c0-3cdc-4414-8e46-f4807fca511c'], configurationBasis: 'synthetic-v1',
      kind: 'synthetic', secret: 'synthetic-pair-secret',
    })
    const out = new URL('./emergency-access-readonly-diagnostic.synthetic.json', import.meta.url)
    await writeFile(out, JSON.stringify(artifact, null, 2) + '\n', 'utf8')
    process.stdout.write(`Synthetic diagnostic written to ${out.pathname}\n`)
  } finally { globalThis.fetch = before }
}

if (process.argv.includes('--synthetic')) await synthetic()
