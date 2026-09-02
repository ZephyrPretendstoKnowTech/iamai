// The inventory tables as CSV (prompt 49 Part 2): one pure builder per tab, so
// the Export CSV card and the Inventory surface offer the same data from one
// place. Faithful key columns, computed from the snapshot; the rich display
// stays in the Inventory tab components. Pure: no DOM, no network.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { buildNameDirectory } from '../../names.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import { deriveTenantCapabilities } from '../../licensing/capabilities.ts'
import { roleLabel } from '../../roles.ts'
import { INVENTORY as C } from '../../copy/inventory.ts'
import { absoluteDate } from '../format.ts'

export type InventoryTable = { id: string; label: string; csvName: string; header: string[]; rows: (string | number)[][] }

type Raw = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

export function inventoryTables(snapshot: TenantSnapshot): InventoryTable[] {
  const names = buildNameDirectory(snapshot, new Map())
  const label = (id: string): string => names.label(id)
  const out: InventoryTable[] = []

  // Policies
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  out.push({
    id: 'policies',
    label: C.tabs.policies,
    csvName: 'iamai-policies.csv',
    header: ['Name', 'State', 'Microsoft-managed'],
    rows: (snapshot.config.caPolicies?.rows ?? []).map((raw) => {
      const f = policyFacts(raw, strengths, (snapshot.microsoftManagedPolicyIds ?? []).includes(str((raw as Raw).id)))
      return [f.name, f.state, f.isMicrosoftManaged ? 'yes' : 'no']
    }),
  })

  // Named locations
  out.push({
    id: 'locations',
    label: C.tabs.locations,
    csvName: 'iamai-named-locations.csv',
    header: ['Name', 'Type', 'Trusted', 'Ranges'],
    rows: ((snapshot.config.namedLocations?.rows ?? []) as Raw[]).map((l) => {
      const isIp = str(l['@odata.type']).includes('ipNamedLocation')
      const ranges = isIp
        ? (Array.isArray(l.ipRanges) ? l.ipRanges : []).map((r) => str((r as Raw).cidrAddress)).filter(Boolean).join(' ')
        : (Array.isArray(l.countriesAndRegions) ? l.countriesAndRegions : []).map(str).join(' ')
      return [str(l.displayName ?? l.id), isIp ? 'IP ranges' : 'Countries', l.isTrusted === true ? 'yes' : 'no', ranges]
    }),
  })

  // Authentication (method configurations)
  const authPolicy = ((snapshot.config.authMethodsPolicy?.rows ?? [])[0] ?? null) as Raw | null
  const configs = (Array.isArray(authPolicy?.authenticationMethodConfigurations) ? authPolicy!.authenticationMethodConfigurations : []) as Raw[]
  out.push({
    id: 'authentication',
    label: C.tabs.authentication,
    csvName: 'iamai-authentication.csv',
    header: ['Method', 'State'],
    rows: configs.map((m) => [str(m.id), str(m.state)]),
  })

  // People
  const viability = new Map(buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability).map((v) => [v.userId, v]))
  out.push({
    id: 'people',
    label: C.tabs.people,
    csvName: 'iamai-people.csv',
    header: ['Name', 'Sign-in name', 'Type', 'Enabled', 'Last sign-in', 'MFA state'],
    rows: snapshot.users.map((u) => [
      label(u.id),
      u.userPrincipalName ?? '',
      u.userType,
      u.accountEnabled === false ? 'no' : 'yes',
      u.lastSuccessfulSignIn ? absoluteDate(u.lastSuccessfulSignIn) : '',
      viability.get(u.id)?.mfa ?? '',
    ]),
  })

  // Groups (referenced by policies)
  const groupIds = new Set<string>()
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
    for (const g of users?.includeGroups ?? []) groupIds.add(g)
    for (const g of users?.excludeGroups ?? []) groupIds.add(g)
  }
  out.push({
    id: 'groups',
    label: C.tabs.groups,
    csvName: 'iamai-groups.csv',
    header: ['Group', 'Id'],
    rows: [...groupIds].map((id) => [label(id), id]),
  })

  // Devices
  out.push({
    id: 'devices',
    label: C.tabs.devices,
    csvName: 'iamai-devices.csv',
    header: ['Name', 'Operating system', 'Compliant', 'Managed', 'Trust type', 'Owners'],
    rows: snapshot.devices.map((d) => [
      d.displayName ?? '',
      d.operatingSystem ?? '',
      d.isCompliant ? 'yes' : 'no',
      d.isManaged ? 'yes' : 'no',
      d.trustType ?? '',
      d.ownerIds.map(label).join(' '),
    ]),
  })

  // Roles
  out.push({
    id: 'roles',
    label: C.tabs.roles,
    csvName: 'iamai-roles.csv',
    header: ['Holder', 'Roles'],
    rows: Object.entries(snapshot.roles.active).map(([id, roles]) => [label(id), roles.map(roleLabel).join(' ')]),
  })

  // Apps (from the sign-in summary)
  out.push({
    id: 'apps',
    label: C.tabs.apps,
    csvName: 'iamai-apps.csv',
    header: ['App', 'Sign-ins'],
    rows: (snapshot.appSignInSummary ?? []).map((a) => {
      const r = a as Raw
      return [str(r.appDisplayName ?? r.appId), Number(r.signInCount ?? 0)]
    }),
  })

  // Licensing
  const skus = (snapshot.config.subscribedSkus?.rows ?? []) as Raw[]
  void deriveTenantCapabilities
  out.push({
    id: 'licensing',
    label: C.tabs.licensing,
    csvName: 'iamai-licences.csv',
    header: ['SKU', 'Seats', 'Consumed'],
    rows: skus.map((s) => [str(s.skuPartNumber), Number((s.prepaidUnits as Raw | undefined)?.enabled ?? 0), Number(s.consumedUnits ?? 0)]),
  })

  // Sign-in records (per-country aggregate)
  const byCountry = snapshot.evidenceAggregates?.byCountry ?? {}
  out.push({
    id: 'signins',
    label: C.tabs.signIns,
    csvName: 'iamai-sign-ins.csv',
    header: ['Country', 'People'],
    rows: Object.entries(byCountry).map(([c, n]) => [c, n]),
  })

  return out
}

// Today, as CSV (the same four columns the Today table shows).
import { todayView } from '../../derive/today.ts'
import { METHOD_TIER } from '../../copy/definitions.ts'
import { todayEvidenceText, todayStateWord } from './todayCells.ts'
export function todayTable(snapshot: TenantSnapshot, serviceAccountIds: ReadonlySet<string> = new Set()): InventoryTable {
  // The same cells the Today table renders (todayCells.ts): a row's CSV equals its screen.
  const view = todayView(snapshot, snapshot.asOf, serviceAccountIds)
  return {
    id: 'today',
    label: 'Today',
    csvName: 'iamai-today.csv',
    header: ['Person', 'State', 'Strongest method', 'Evidence'],
    rows: view.rows.map((r) => [r.user.displayName ?? r.user.userPrincipalName ?? r.user.id, todayStateWord(r.state), METHOD_TIER[r.strongest]?.title ?? r.strongest, todayEvidenceText(r)]),
  }
}
