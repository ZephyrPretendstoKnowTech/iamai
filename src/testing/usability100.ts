import { buildFixture } from '../roadmap/fixtures/index.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { applyStepDecisions } from '../roadmap/decisions.ts'
import { questionOptions, QUESTION_STEP } from '../roadmap/answers.ts'

export type Usability100Stage = 'initial' | 'deployment' | 'configured' | 'drift' | 'specialist'

/** Deterministic synthetic review tenant. The pinned baseline is deliberately
 * left unchanged: its unresolved references must be handled by real product flows. */
export function usability100(stage: Usability100Stage): Fixture {
  // The builder adds two emergency accounts and four service accounts to these 94 identities.
  const f = buildFixture({ name: 'demo', users: 94, admins: 6, licence: 'p2', policies: 7,
    serviceAccounts: 4, hybrid: true, intuneShare: .55, multiGeo: true,
    neverSignedIn: 5, disabledPolicies: 1, reportOnlyPolicies: 1,
    demo: true, week2: stage !== 'initial',
    expect: { rings: 1, weeksAtMost: 8, namesListed: false, policyCapWarning: false } })
  if (f.snapshot.users.length !== 100) throw new Error('The review tenant must contain exactly 100 identities')
  const initialTime = f.snapshot.asOf
  const offset = (stage === 'initial' ? 0 : stage === 'drift' ? 21 : 14) * 86_400_000
  const shift = (value: unknown): unknown => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return new Date(Date.parse(value) + offset).toISOString()
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Date.parse(value) + offset).toISOString().slice(0, 10)
    if (Array.isArray(value)) return value.map(shift)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,shift(v)]))
    return value
  }
  f.snapshot = shift(f.snapshot) as Fixture['snapshot']
  f.mapping = shift(f.mapping) as Fixture['mapping']
  if (f.decisions) f.decisions = shift(f.decisions) as Fixture['decisions']
  if (f.checkpoints) f.checkpoints = shift(f.checkpoints) as unknown[]
  f.planCreatedAt = initialTime
  const org = f.snapshot.config.organization.rows[0] as { displayName?: string }
  org.displayName = 'Northstar 100 — synthetic review tenant'
  if (stage !== 'initial') {
    f.decisions = { ...f.decisions,
      's-confirm-workloads': { at: f.snapshot.asOf, answers: {
        sharepoint: 'yes', intune: 'yes', workload: 'yes', azureManagement: 'yes',
        avd: stage === 'specialist' ? 'yes' : 'no', agents: stage === 'specialist' ? 'yes' : 'no',
        inforcer: stage === 'specialist' ? 'yes' : 'no', copilot: 'no', azureDevOps: 'no',
      } },
      // Direction's one question the older steps never asked (roadmap/direction.ts).
      's-direction-use': { at: f.snapshot.asOf, answers: { externalMethods: 'no' } },
      [QUESTION_STEP.devices]: { at: f.snapshot.asOf,
        option: questionOptions(QUESTION_STEP.devices, 'decision')[1],
        answers: { Computers: questionOptions(QUESTION_STEP.devices, 'question')[0] },
      },
    }
  }
  f.mapping = applyStepDecisions(f.mapping, f.decisions ?? {})
  if (stage === 'configured' || stage === 'drift' || stage === 'specialist') {
    // These are explicit synthetic owner decisions, not inferred approval. Map
    // each source group to a distinct tenant group; never change the baseline.
    const refs = f.baseline.references.filter(r => r.kind === 'group' && r.portability !== 'stable')
    refs.forEach((ref, i) => {
      const id = `10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`
      const isService = ref.uses.some(u => u.side === 'include' && /Service Accounts/i.test(u.policyName))
      const members = isService ? f.mapping.serviceAccountUserIds : ref.uses.some(u=>u.side==='include') ? f.snapshot.users.filter(u=>u.userType==='member').slice(6,16).map(u=>u.id) : []
      const name = isService ? 'Northstar - Service accounts' : `Northstar - Reviewed baseline group ${i+1}`
      f.groups.set(id,{memberIds:members,memberCount:members.length,sampled:false,displayName:name})
      f.mapping.records[ref.id]={placeholder:ref.id,kind:'group',group:'personaGroups',resolvedId:id,resolvedName:name,provenance:'confirmed',doesNotExist:false,validation:null}
      if(isService) f.mapping.serviceAccountsGroupId=id
    })
    const trusted = f.snapshot.config.namedLocations.rows[0] as {id:string}
    f.mapping.trustedLocationIds=[trusted.id]
    const countryId='10000000-0000-4000-8000-000000000099'
    f.snapshot.config.namedLocations.rows.push({'@odata.type':'#microsoft.graph.countryNamedLocation',id:countryId,displayName:'Northstar - Allowed countries',countriesAndRegions:f.mapping.allowedCountries,includeUnknownCountriesAndRegions:false,countryLookupMethod:'clientIpAddress'})
    for(const ref of f.baseline.references.filter(r=>r.kind==='namedLocation' && r.portability!=='stable' && r.id!=='alltrusted')) {
      const id=ref.uses.some(u=>/Countries not Allowed/i.test(u.policyName))?countryId:trusted.id
      f.mapping.records[ref.id]={placeholder:ref.id,kind:'namedLocation',group:'namedLocations',resolvedId:id,resolvedName:id===countryId?'Northstar - Allowed countries':'Head office',provenance:'confirmed',doesNotExist:false,validation:null}
    }
  }
  if (stage === 'drift') {
    // Simulate an external edit to an enforced policy, not an operation by IAMAI.
    const policy = f.snapshot.config.caPolicies.rows.find(raw => /phishing-resistant.*admins|admins.*phishing-resistant/i.test(String((raw as {displayName?:string}).displayName))) as { grantControls?: unknown; conditions?: {users?: {excludeUsers?: string[]}} } | undefined
    if (!policy) throw new Error('Missing enforced admin policy for the drift scenario')
    policy.grantControls = { operator: 'OR', builtInControls: ['mfa'] }
    const person = f.snapshot.users.find(u => u.userType === 'member' && u.mail && !f.snapshot.roles.active[u.id]?.length)
    if (person && policy.conditions?.users) policy.conditions.users.excludeUsers = [...(policy.conditions.users.excludeUsers ?? []), person.id]
    if (person) f.snapshot.authMethods[person.id] = 'unknown'
  }
  return f
}
