import { createRoot } from 'react-dom/client'
import { ContentStep } from '../src/ui/surfaces/ContentStep.tsx'
import { fixture } from '../src/roadmap/fixtures/index.ts'
import { runFixture } from '../src/roadmap/fixtures/run.ts'
import { exclusionsGroupIdToVerify } from '../src/mapping/safetyChoice.ts'
import { PASSKEY_TARGET_AAGUIDS } from '../src/roadmap/passkeySettings.ts'
import type { StepVarContext } from '../src/ui/surfaces/stepVars.ts'
import '../src/ui/tokens.css'
import '../src/ui/app.css'

function productionCase(value: ReturnType<typeof fixture>, stepId: string) {
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === stepId)!
  const ctx: StepVarContext = {
    snapshot: value.snapshot,
    mapping: value.mapping,
    nameOf: id => run.input.names!.label(id),
    signature: 'acceptance',
    operatorId: value.operatorId,
    now: value.snapshot.asOf,
    groups: value.groups,
    directory: value.reviewDirectory ?? run.input.directory,
    naming: run.coverage.organisation.naming,
  }
  return { step, ctx }
}

const unsuitable = structuredClone(fixture('small'))
const unsuitableId = exclusionsGroupIdToVerify(unsuitable.mapping)!
unsuitable.groups.set(unsuitableId, {
  ...unsuitable.groups.get(unsuitableId)!,
  groupTypes: ['DynamicMembership'],
  membershipRule: 'user.department -eq "test"',
  assignedLicenseSkuIds: ['license-one'],
})

const legacy = structuredClone(fixture('demo'))
legacy.mapping.passkeyApprovedModels = [{ name: 'Contoso recovery key', aaguid: '11111111-1111-4111-8111-111111111111' }]
const legacyConfig = {
  id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, isAttestationEnforced: true,
  includeTargets: [{ id: 'all_users', targetType: 'group', isRegistrationRequired: false, allowedPasskeyProfiles: [] }],
  excludeTargets: [],
  keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [PASSKEY_TARGET_AAGUIDS[0]] },
}
legacy.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [legacyConfig], fido2Configuration: legacyConfig }] }

const longMembership = structuredClone(fixture('small'))
const longMembershipId = exclusionsGroupIdToVerify(longMembership.mapping)!
const longMembershipGroup = longMembership.groups.get(longMembershipId)!
const unexpectedIds = ['unexpected-user-1', 'unexpected-user-2', 'unexpected-service-principal', 'unexpected-group']
longMembership.groups.set(longMembershipId, {
  ...longMembershipGroup,
  memberIds: [...longMembershipGroup.memberIds, ...unexpectedIds],
  memberCount: longMembershipGroup.memberCount + unexpectedIds.length,
  directMembers: 'complete',
  directMemberIds: [...(longMembershipGroup.directMemberIds ?? longMembershipGroup.memberIds), ...unexpectedIds],
  directMemberObjects: [
    ...(longMembershipGroup.directMemberObjects ?? []),
    { id: 'unexpected-user-1', kind: 'user', displayName: 'Unexpected User One', userPrincipalName: 'unexpected.one@example.com' },
    { id: 'unexpected-user-2', kind: 'user', displayName: 'Unexpected User Two', userPrincipalName: 'unexpected.two@example.com' },
    { id: 'unexpected-service-principal', kind: 'servicePrincipal', displayName: 'Unexpected Automation' },
    { id: 'unexpected-group', kind: 'group', displayName: 'Unexpected Nested Group' },
  ],
})

const allCases = [
  { id: 'step2', name: 'Real Step 2 projection — unsuitable saved group', ...productionCase(unsuitable, 's-prereq-exclusion-group') },
  { id: 'step3', name: 'Real Step 3 projection — legacy allow-list change', ...productionCase(legacy, 's-prereq-passkey-settings') },
  { id: 'long-membership', name: 'Real Step 2 projection — long unexpected-member list', ...productionCase(longMembership, 's-prereq-exclusion-group') },
]
const requestedCase = new URLSearchParams(window.location.search).get('case')
const cases = requestedCase ? allCases.filter(item => item.id === requestedCase) : allCases
const noop = () => undefined

function App() {
  return <main style={{ maxWidth: 1440, margin: '0 auto', padding: 16 }}>
    <h1>Emergency access production-derived acceptance</h1>
    <p>Every step below is generated from a tenant fixture through the real roadmap, task, artifact and ContentStep paths.</p>
    {cases.map(item => <section key={item.name} data-acceptance-case={item.name} style={{ marginBlock: 32 }}>
      <h2>{item.name}</h2>
      <ContentStep step={item.step} ctx={item.ctx} onSkip={noop} onUnskip={noop} onScan={noop} onDecide={noop} onConfirm={noop} onUnconfirm={noop} saveStatus="idle" />
    </section>)}
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
