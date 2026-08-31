// Inventory: the data as found (prompt 10 §B). Read-only DataTables, no
// analysis; every table exports CSV and says where its data comes from.
import { useEffect, useMemo, useState } from 'react'
import type { TenantSnapshot, UserRow } from '../../graph/collect/types.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { GroupMembersCacheEntry } from '../../graph/collect/cache.ts'
import { policyFacts } from '../../coverage/facts.ts'
import type { PolicyFacts } from '../../coverage/types.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import { CAPABILITIES, deriveTenantCapabilities, deriveUserCapabilities } from '../../licensing/capabilities.ts'
import { buildNameDirectory } from '../../names.ts'
import { ROLE_TEMPLATES, coversAdminSet, roleLabel, roleName, roleTemplate, heldOnlyByServices } from '../../roles.ts'
import { resolveObjects } from '../../graph/collect/onDemand.ts'
import type { ResolvedObject } from '../../graph/collect/onDemand.ts'
import productNames from '../../../data/product-names.json' with { type: 'json' }
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { INVENTORY as C, combinationName, methodName, migrationName, protocolName, trustTypeName } from '../../copy/inventory.ts'
import { LICENSING } from '../../copy/pages.ts'
import { SETUP_PAGE } from '../../copy/setup.ts'
import { ACTIVITY_STATE, METHOD_TIER, MFA_STATE, TILE } from '../../copy/definitions.ts'
import { absoluteDate, relative } from '../format.ts'
import { Button, Chip, DataTable, EmptyState, InfoTip, Tabs } from '../components/index.ts'
import type { ChipStatus, Column } from '../components/index.ts'

type Raw = Record<string, unknown>

function SourceTip({ k }: { k: keyof typeof C.source }) {
  const d = C.source[k]
  return <InfoTip title={d.title} text={d.text} />
}

function Heading({ text, source }: { text: string; source: keyof typeof C.source }) {
  return (
    <h4>
      {text}
      <SourceTip k={source} />
    </h4>
  )
}

export function InventoryPage({ snapshot }: { snapshot: TenantSnapshot }) {
  const [groups, setGroups] = useState<GroupMembersCacheEntry[] | null>(null)

  const policies = useMemo(() => (snapshot.config.caPolicies?.rows ?? []) as Raw[], [snapshot])
  const strengths = useMemo(() => buildStrengthLookup(snapshot.config.authStrengths?.rows ?? []), [snapshot])
  const facts = useMemo(
    () => policies.map((p) => ({ raw: p, facts: policyFacts(p, strengths, snapshot.microsoftManagedPolicyIds.includes(String(p.id ?? ''))) })),
    [policies, strengths, snapshot],
  )
  const referencedGroups = useMemo(() => {
    const map = new Map<string, { include: string[]; exclude: string[] }>()
    for (const { facts: f } of facts) {
      for (const g of f.who.groups) (map.get(g) ?? map.set(g, { include: [], exclude: [] }).get(g)!).include.push(f.name)
      for (const g of f.whoNot.groups) (map.get(g) ?? map.set(g, { include: [], exclude: [] }).get(g)!).exclude.push(f.name)
    }
    return map
  }, [facts])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const out: GroupMembersCacheEntry[] = []
      for (const id of referencedGroups.keys()) {
        try {
          out.push(await getGroupMembers(snapshot.tenantId, id))
        } catch {
          out.push({ tenantId: snapshot.tenantId, groupId: id, displayName: null, membershipRule: null, memberIds: [], memberCount: 0, sampled: false, asOf: '' })
        }
      }
      if (!cancelled) setGroups(out)
    })()
    return () => {
      cancelled = true
    }
  }, [referencedGroups, snapshot.tenantId])

  const names = useMemo(() => buildNameDirectory(snapshot, groups ?? []), [snapshot, groups])
  const viability = useMemo(() => buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability), [snapshot])
  const viabilityById = useMemo(() => new Map(viability.map((v) => [v.userId, v])), [viability])
  const userById = useMemo(() => new Map(snapshot.users.map((u) => [u.id, u])), [snapshot])

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'policies', label: C.tabs.policies, badge: policies.length, render: () => <PoliciesTab facts={facts} names={names} /> },
          { id: 'locations', label: C.tabs.locations, render: () => <LocationsTab snapshot={snapshot} facts={facts} /> },
          { id: 'authentication', label: C.tabs.authentication, render: () => <AuthenticationTab snapshot={snapshot} names={names} /> },
          { id: 'people', label: C.tabs.people, badge: snapshot.users.length, render: () => <PeopleTab snapshot={snapshot} viabilityById={viabilityById} names={names} referenced={referencedGroups} groups={groups} /> },
          { id: 'groups', label: C.tabs.groups, badge: referencedGroups.size, render: () => <PeopleTab snapshot={snapshot} viabilityById={viabilityById} names={names} referenced={referencedGroups} groups={groups} showGroups /> },
          { id: 'devices', label: C.tabs.devices, badge: snapshot.devices.length, render: () => <DevicesTab snapshot={snapshot} userById={userById} /> },
          { id: 'roles', label: C.tabs.roles, render: () => <RolesTab snapshot={snapshot} names={names} /> },
          { id: 'apps', label: C.tabs.apps, render: () => <AppsTab snapshot={snapshot} names={names} /> },
          { id: 'licensing', label: C.tabs.licensing, render: () => <LicensingTab snapshot={snapshot} /> },
          { id: 'signins', label: C.tabs.signIns, render: () => <SignInsTab snapshot={snapshot} names={names} /> },
        ]}
      />
    </div>
  )
}

// ---------- Policies ----------

const STATE_CHIP: Record<PolicyFacts['state'], ChipStatus> = {
  enabled: 'done',
  enabledForReportingButNotEnforced: 'in-progress',
  disabled: 'neutral',
  unknown: 'warning',
}

function usersSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.who.all) bits.push(P.allUsers)
  if (f.who.groups.size > 0) bits.push(P.groups(f.who.groups.size))
  if (f.who.roles.size > 0) bits.push(coversAdminSet(f.who.roles) ? P.allAdminRoles(f.who.roles.size) : P.roles(f.who.roles.size))
  if (f.who.users.size > 0) bits.push(P.users(f.who.users.size))
  if (f.who.guests !== null && !f.who.all) bits.push(P.guests)
  if (f.workload) bits.push(P.workload(f.workload.sps.size))
  return bits.join(', ') || P.none
}

// Tooltip for the Users column: the names behind the counts.
function usersDetail(f: PolicyFacts, label: (id: string) => string): string {
  const parts: string[] = []
  if (f.who.users.size > 0) parts.push([...f.who.users].map(label).join(', '))
  if (f.who.groups.size > 0) parts.push([...f.who.groups].map(label).join(', '))
  if (f.who.roles.size > 0 && !coversAdminSet(f.who.roles)) parts.push([...f.who.roles].map(roleLabel).join(', '))
  return parts.join('\n')
}

function appsSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.apps.all) bits.push(P.allApps)
  if (f.apps.office365) bits.push(P.office365)
  if (f.apps.adminPortals) bits.push(P.adminPortals)
  if (f.apps.ids.size > 0) bits.push(P.apps(f.apps.ids.size))
  for (const a of f.apps.userActions) bits.push(P.userActions(a))
  if (f.apps.authContexts.size > 0) bits.push(P.authContexts(f.apps.authContexts.size))
  return bits.join(', ') || P.none
}

function conditionsSummary(f: PolicyFacts, label: (id: string) => string): string {
  const P = C.policies
  const bits: string[] = []
  if (f.clientApps.size > 0 && !f.clientApps.has('all')) bits.push(P.clientApps([...f.clientApps].join(', ')))
  if (f.platforms) bits.push(P.platforms([...f.platforms.include].join(', ') || 'any'))
  const loc = (id: string) => (id.toLowerCase() === 'all' ? 'all' : id.toLowerCase() === 'alltrusted' ? 'all trusted' : label(id))
  if (f.locations)
    bits.push(
      P.locations(
        `${[...f.locations.include].map(loc).join(', ') || 'any'}${f.locations.exclude.size > 0 ? ` except ${[...f.locations.exclude].map(loc).join(', ')}` : ''}`,
      ),
    )
  if (f.signInRisk.size > 0) bits.push(P.signInRisk([...f.signInRisk].join(', ')))
  if (f.userRisk.size > 0) bits.push(P.userRisk([...f.userRisk].join(', ')))
  if (f.flows.size > 0) bits.push(P.flows([...f.flows].join(', ')))
  if (f.deviceFilter) bits.push(P.deviceFilter)
  return bits.join(' · ') || '—'
}

const CONTROL_WORDS: Record<string, string> = {
  mfa: 'MFA',
  compliantDevice: 'compliant device',
  domainJoinedDevice: 'hybrid-joined device',
  approvedApplication: 'approved app',
  compliantApplication: 'app protection policy',
  passwordChange: 'password change',
}

function grantSummary(f: PolicyFacts, label: (id: string) => string): string {
  const P = C.policies
  if (!f.grant) return '—'
  if (f.grant.controls.has('block')) return P.block
  const controls = [...f.grant.controls].filter((c) => c !== 'mfa' || !f.grant?.strengthId)
  const bits = controls.map((c) => CONTROL_WORDS[c] ?? c)
  if (f.grant.strengthId) bits.push(P.strength(label(f.grant.strengthId)))
  return bits.length > 0 ? P.require(bits.join(f.grant.operator === 'AND' ? ' and ' : ' or ')) : '—'
}

function sessionSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.session.signInFrequencyHours !== null) bits.push(P.signInFrequency(f.session.signInFrequencyHours))
  if (f.session.persistentBrowser) bits.push(P.persist(f.session.persistentBrowser))
  if (f.session.secureSignInSession) bits.push(P.tokenProtection)
  if (f.session.cloudAppSecurity) bits.push(P.cloudAppSecurity)
  if (f.session.appEnforced) bits.push(P.appEnforced)
  return bits.join(' · ') || '—'
}

function PoliciesTab({ facts, names }: { facts: { raw: Raw; facts: PolicyFacts }[]; names: ReturnType<typeof buildNameDirectory> }) {
  const P = C.policies
  const rows = facts.map((x) => x.facts)
  const columns: Column<PolicyFacts>[] = [
    {
      key: 'name',
      header: P.columns.name,
      sortValue: (r) => r.name.toLowerCase(),
      csv: (r) => r.name,
      render: (r) => (
        <>
          {r.name} {r.isMicrosoftManaged && <Chip status="neutral">{P.microsoftManaged}</Chip>}
        </>
      ),
    },
    {
      key: 'state',
      header: P.columns.state,
      sortValue: (r) => r.state,
      csv: (r) => P.state[r.state],
      render: (r) => <Chip status={STATE_CHIP[r.state]}>{P.state[r.state]}</Chip>,
    },
    { key: 'users', header: P.columns.users, csv: (r) => usersSummary(r), render: (r) => <span title={usersDetail(r, names.label) || undefined}>{usersSummary(r)}</span> },
    { key: 'apps', header: P.columns.apps, csv: (r) => appsSummary(r), render: (r) => appsSummary(r) },
    { key: 'conditions', header: P.columns.conditions, csv: (r) => conditionsSummary(r, names.label), render: (r) => conditionsSummary(r, names.label) },
    { key: 'grant', header: P.columns.grant, csv: (r) => grantSummary(r, names.label), render: (r) => grantSummary(r, names.label) },
    { key: 'session', header: P.columns.session, csv: (r) => sessionSummary(r), render: (r) => sessionSummary(r) },
  ]
  const list = (ids: Iterable<string>) => [...ids].map(names.label).join(', ')
  const roleList = (ids: Set<string>) => (coversAdminSet(ids) ? P.allAdminRoles(ids.size) : [...ids].map(roleLabel).join(', '))
  return (
    <div>
      <Heading text={C.tabs.policies} source="policies" />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id || r.name}
        csvName="iamai-policies.csv"
        empty={P.empty}
        expand={(r) => (
          <div className="sub">
            <div>
              <strong>{P.include}:</strong> {[r.who.all ? P.allUsers : '', list(r.who.users), list(r.who.groups), roleList(r.who.roles)].filter(Boolean).join('; ') || P.none}
            </div>
            <div>
              <strong>{P.exclude}:</strong> {[list(r.whoNot.users), list(r.whoNot.groups), roleList(r.whoNot.roles), r.whoNot.guests ? P.guests : ''].filter(Boolean).join('; ') || P.none}
            </div>
          </div>
        )}
      />
    </div>
  )
}

// ---------- Named locations ----------

function LocationsTab({ snapshot, facts }: { snapshot: TenantSnapshot; facts: { raw: Raw; facts: PolicyFacts }[] }) {
  const L = C.locations
  type Row = { id: string; name: string; type: string; trusted: boolean; ranges: string; usedBy: number }
  const rows: Row[] = ((snapshot.config.namedLocations?.rows ?? []) as Raw[]).map((l) => {
    const id = String(l.id ?? '')
    const isIp = String(l['@odata.type'] ?? '').includes('ipNamedLocation')
    const ranges = isIp
      ? (Array.isArray(l.ipRanges) ? l.ipRanges : []).map((r) => String((r as Raw).cidrAddress ?? '')).filter(Boolean).join(', ')
      : (Array.isArray(l.countriesAndRegions) ? l.countriesAndRegions : []).map(String).join(', ')
    const usedBy = facts.filter((f) => f.facts.locations && (f.facts.locations.include.has(id) || f.facts.locations.exclude.has(id))).length
    return { id, name: String(l.displayName ?? id), type: isIp ? L.ip : L.country, trusted: l.isTrusted === true, ranges, usedBy }
  })
  return (
    <div>
      <Heading text={C.tabs.locations} source="locations" />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        csvName="iamai-named-locations.csv"
        empty={L.empty}
        columns={[
          { key: 'name', header: L.columns.name, sortValue: (r) => r.name.toLowerCase(), csv: (r) => r.name, render: (r) => r.name },
          { key: 'type', header: L.columns.type, sortValue: (r) => r.type, csv: (r) => r.type, render: (r) => r.type },
          { key: 'trusted', header: L.columns.trusted, sortValue: (r) => (r.trusted ? 0 : 1), csv: (r) => (r.trusted ? L.trusted : L.notTrusted), render: (r) => <Chip status={r.trusted ? 'done' : 'neutral'}>{r.trusted ? L.trusted : L.notTrusted}</Chip> },
          { key: 'ranges', header: L.columns.ranges, csv: (r) => r.ranges, render: (r) => <span className="mono">{r.ranges}</span> },
          { key: 'usedBy', header: L.columns.usedBy, sortValue: (r) => r.usedBy, csv: (r) => r.usedBy, render: (r) => L.usedBy(r.usedBy) },
        ]}
      />
    </div>
  )
}

// ---------- Authentication ----------

function AuthenticationTab({ snapshot, names }: { snapshot: TenantSnapshot; names: ReturnType<typeof buildNameDirectory> }) {
  const A = C.authentication
  const policy = ((snapshot.config.authMethodsPolicy?.rows ?? [])[0] ?? null) as Raw | null
  const configs = (Array.isArray(policy?.authenticationMethodConfigurations) ? policy!.authenticationMethodConfigurations : []) as Raw[]
  type MethodRow = { id: string; state: string; targets: string }
  const methodRows: MethodRow[] = configs.map((m) => {
    const targets = (Array.isArray(m.includeTargets) ? m.includeTargets : []) as Raw[]
    const t = targets.map((x) => (String(x.id) === 'all_users' ? A.allUsers : names.label(String(x.id ?? '')))).join(', ')
    return { id: String(m.id ?? ''), state: String(m.state ?? ''), targets: t || A.targets(0) }
  })
  const campaign = ((policy?.registrationEnforcement as Raw | undefined)?.authenticationMethodsRegistrationCampaign ?? null) as Raw | null
  const migration = typeof policy?.policyMigrationState === 'string' ? policy.policyMigrationState : null

  type StrengthRow = { id: string; name: string; type: string; combos: string }
  const strengthRows: StrengthRow[] = ((snapshot.config.authStrengths?.rows ?? []) as Raw[]).map((s) => ({
    id: String(s.id ?? ''),
    name: String(s.displayName ?? s.id ?? ''),
    type: s.policyType === 'builtIn' ? A.builtIn : A.custom,
    combos: (Array.isArray(s.allowedCombinations) ? s.allowedCombinations : []).map((c) => combinationName(String(c))).join(', '),
  }))

  const reg = snapshot.registrationDetails
  const byMethod = new Map<string, number>()
  for (const r of reg) for (const m of r.methodsRegistered) byMethod.set(m, (byMethod.get(m) ?? 0) + 1)
  type RegRow = { measure: string; users: number }
  const regRows: RegRow[] = [
    { measure: A.capable, users: reg.filter((r) => r.isMfaCapable).length },
    { measure: A.registered, users: reg.filter((r) => r.isMfaRegistered).length },
    { measure: A.passwordless, users: reg.filter((r) => r.isPasswordlessCapable).length },
    ...[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => ({ measure: A.byMethod(methodName(m)), users: n })),
  ]
  const secDefaults = ((snapshot.config.securityDefaults?.rows ?? [])[0] ?? null) as Raw | null

  return (
    <div>
      <Heading text={C.tabs.authentication} source="authentication" />
      {policy ? (
        <>
          <DataTable
            caption={A.methods}
            rows={methodRows}
            rowKey={(r) => r.id}
            csvName="iamai-auth-methods.csv"
            columns={[
              { key: 'method', header: A.methodColumns.method, sortValue: (r) => methodName(r.id), csv: (r) => methodName(r.id), render: (r) => methodName(r.id) },
              { key: 'state', header: A.methodColumns.state, sortValue: (r) => r.state, csv: (r) => r.state, render: (r) => <Chip status={r.state === 'enabled' ? 'done' : 'neutral'}>{r.state === 'enabled' ? A.enabled : A.disabled}</Chip> },
              { key: 'targets', header: A.methodColumns.targets, csv: (r) => r.targets, render: (r) => r.targets },
            ]}
          />
          <p className="reason">
            {campaign && A.campaignState(String(campaign.state ?? 'unknown'))}
            {migration && ` · ${A.migration(migrationName(migration))}`}
          </p>
        </>
      ) : (
        <p className="reason">{A.empty}</p>
      )}

      <DataTable
        caption={A.strengths}
        rows={strengthRows}
        rowKey={(r) => r.id}
        csvName="iamai-auth-strengths.csv"
        columns={[
          { key: 'name', header: A.strengthColumns.name, sortValue: (r) => r.name.toLowerCase(), csv: (r) => r.name, render: (r) => r.name },
          { key: 'type', header: A.strengthColumns.type, sortValue: (r) => r.type, csv: (r) => r.type, render: (r) => <Chip status={r.type === A.builtIn ? 'neutral' : 'ready'}>{r.type}</Chip> },
          { key: 'combos', header: A.strengthColumns.combinations, csv: (r) => r.combos, render: (r) => <span className="sub">{r.combos}</span> },
        ]}
      />

      <DataTable
        caption={
          <>
            {A.registration}
            <InfoTip title={TILE.registration.title} text={TILE.registration.text} />
          </>
        }
        rows={regRows}
        rowKey={(r) => r.measure}
        csvName="iamai-registration.csv"
        columns={[
          { key: 'measure', header: A.regColumns.measure, csv: (r) => r.measure, render: (r) => r.measure },
          { key: 'users', header: A.regColumns.users, sortValue: (r) => r.users, csv: (r) => r.users, render: (r) => r.users },
        ]}
      />

      <p className="reason">
        {A.securityDefaults}: <Chip status={secDefaults?.isEnabled === true ? 'warning' : 'done'}>{secDefaults?.isEnabled === true ? A.on : A.off}</Chip>
      </p>
    </div>
  )
}

// ---------- People and groups ----------

function licenceTier(u: UserRow): string {
  const caps = deriveUserCapabilities(u.assignedPlans)
  if (caps.has('entraP2')) return C.people.p2
  if (caps.has('entraP1')) return C.people.p1
  return C.people.free
}

function PeopleTab({
  snapshot,
  viabilityById,
  names,
  referenced,
  groups,
  showGroups = false,
}: {
  snapshot: TenantSnapshot
  viabilityById: Map<string, MfaViability>
  names: ReturnType<typeof buildNameDirectory>
  referenced: Map<string, { include: string[]; exclude: string[] }>
  groups: GroupMembersCacheEntry[] | null
  /** L3: true when rendering as the Groups tab rather than the People tab. */
  showGroups?: boolean
}) {
  const P = C.people
  const G = C.groups
  type Row = UserRow & { v: MfaViability | undefined; roles: string }
  const rows: Row[] = snapshot.users.map((u) => ({
    ...u,
    v: viabilityById.get(u.id),
    roles: (snapshot.roles.active[u.id] ?? []).map(roleLabel).join(', '),
  }))
  const usersTable = () => (
    <div>
      <Heading text={C.tabs.people} source="people" />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        csvName="iamai-people.csv"
        empty={P.empty}
        columns={[
          { key: 'name', header: P.columns.name, sortValue: (r) => (r.displayName ?? '').toLowerCase(), csv: (r) => r.displayName ?? '', render: (r) => r.displayName ?? '—' },
          { key: 'upn', header: P.columns.upn, sortValue: (r) => (r.userPrincipalName ?? '').toLowerCase(), csv: (r) => r.userPrincipalName ?? '', render: (r) => <span className="sub">{r.userPrincipalName}</span> },
          { key: 'type', header: P.columns.type, sortValue: (r) => r.userType, csv: (r) => r.userType, render: (r) => (r.userType === 'guest' ? <Chip>{P.guest}</Chip> : P.member) },
          { key: 'activity', header: P.columns.activity, sortValue: (r) => r.v?.activity ?? '', csv: (r) => (r.v ? ACTIVITY_STATE[r.v.activity].title : ''), render: (r) => (r.v ? ACTIVITY_STATE[r.v.activity].title : '—') },
          { key: 'mfa', header: P.columns.mfa, sortValue: (r) => r.v?.mfa ?? '', csv: (r) => (r.v ? MFA_STATE[r.v.mfa].title : ''), render: (r) => (r.v ? MFA_STATE[r.v.mfa].title : '—') },
          { key: 'method', header: P.columns.method, sortValue: (r) => r.v?.strongestMethod ?? '', csv: (r) => (r.v ? METHOD_TIER[r.v.strongestMethod].title : ''), render: (r) => (r.v && r.v.strongestMethod !== 'none' ? METHOD_TIER[r.v.strongestMethod].title : '—') },
          { key: 'licence', header: P.columns.licence, sortValue: (r) => licenceTier(r), csv: (r) => licenceTier(r), render: (r) => licenceTier(r) },
          { key: 'roles', header: P.columns.roles, sortValue: (r) => r.roles, csv: (r) => r.roles, render: (r) => r.roles || P.noRoles },
        ]}
      />
    </div>
  )
  type GroupRow = { id: string; name: string; members: string; dynamic: string; policies: string }
  const groupRows: GroupRow[] = [...referenced.entries()].map(([id, refs]) => {
    const g = groups?.find((x) => x.groupId === id)
    return {
      id,
      name: g?.displayName ?? names.label(id),
      members: g ? (g.sampled ? G.sampled(g.memberCount) : String(g.memberCount)) : '…',
      dynamic: g && g.asOf ? (g.membershipRule ? G.dynamic : G.assigned) : G.unknown,
      policies: [...refs.include.map(G.include), ...refs.exclude.map(G.exclude)].join('; '),
    }
  })
  const groupsTable = () => (
    <div>
      <Heading text={C.tabs.groups} source="groups" />
      {groups === null && <p className="reason">{G.loading}</p>}
      <DataTable
        rows={groupRows}
        rowKey={(r) => r.id}
        csvName="iamai-groups.csv"
        empty={G.empty}
        columns={[
          { key: 'name', header: G.columns.name, sortValue: (r) => r.name.toLowerCase(), csv: (r) => r.name, render: (r) => r.name },
          { key: 'members', header: G.columns.members, csv: (r) => r.members, render: (r) => r.members },
          { key: 'dynamic', header: G.columns.dynamic, csv: (r) => r.dynamic, render: (r) => r.dynamic },
          { key: 'policies', header: G.columns.policies, csv: (r) => r.policies, render: (r) => <span className="sub">{r.policies}</span> },
        ]}
      />
    </div>
  )
  // L3: Groups used to be a sub-tab here, a tab strip inside a tab strip. It is
  // its own tab now; `showGroups` picks which half of this component renders.
  return showGroups ? groupsTable() : usersTable()
}

// ---------- Devices ----------

function DevicesTab({ snapshot, userById }: { snapshot: TenantSnapshot; userById: Map<string, UserRow> }) {
  const D = C.devices
  const yn = (v: boolean | null) => (v === null ? D.unknown : v ? D.yes : D.no)
  const owner = (ids: string[]) => ids.map((id) => userById.get(id)?.displayName ?? userById.get(id)?.userPrincipalName ?? '').filter(Boolean).join(', ')
  // Authenticator registrations by device name (ux-review-03 §A6): the name
  // is a model code, so every account with the same name is listed.
  const byDeviceName = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [userId, methods] of Object.entries(snapshot.authMethods)) {
      if (methods === 'unknown') continue
      for (const m of methods) {
        if (m.kind !== 'microsoftAuthenticator' || !m.displayName) continue
        const who = userById.get(userId)?.displayName ?? userById.get(userId)?.userPrincipalName ?? null
        if (!who) continue
        const list = map.get(m.displayName) ?? []
        if (!list.includes(who)) list.push(who)
        map.set(m.displayName, list)
      }
    }
    return map
  }, [snapshot, userById])
  const registrations = (name: string | null) => (name ? (byDeviceName.get(name) ?? []).join(', ') : '')
  return (
    <div>
      <Heading text={C.tabs.devices} source="devices" />
      <DataTable
        rows={snapshot.devices}
        rowKey={(r) => r.id}
        csvName="iamai-devices.csv"
        empty={D.empty}
        columns={[
          { key: 'name', header: D.columns.name, sortValue: (r) => (r.displayName ?? '').toLowerCase(), csv: (r) => r.displayName ?? '', render: (r) => r.displayName ?? '—' },
          { key: 'os', header: D.columns.os, sortValue: (r) => r.operatingSystem ?? '', csv: (r) => r.operatingSystem ?? '', render: (r) => r.operatingSystem ?? D.unknown },
          { key: 'trust', header: D.columns.trust, sortValue: (r) => r.trustType ?? '', csv: (r) => (r.trustType ? trustTypeName(r.trustType) : ''), render: (r) => (r.trustType ? trustTypeName(r.trustType) : D.unknown) },
          { key: 'compliant', header: D.columns.compliant, sortValue: (r) => (r.isCompliant ? 0 : 1), csv: (r) => yn(r.isCompliant), render: (r) => <Chip status={r.isCompliant ? 'done' : 'neutral'}>{yn(r.isCompliant)}</Chip> },
          { key: 'managed', header: D.columns.managed, sortValue: (r) => (r.isManaged ? 0 : 1), csv: (r) => yn(r.isManaged), render: (r) => yn(r.isManaged) },
          { key: 'last', header: D.columns.lastSignIn, sortValue: (r) => r.approximateLastSignIn ?? '', csv: (r) => (r.approximateLastSignIn ? absoluteDate(r.approximateLastSignIn) : ''), render: (r) => (r.approximateLastSignIn ? <span title={absoluteDate(r.approximateLastSignIn)}>{relative(r.approximateLastSignIn)}</span> : D.unknown) },
          { key: 'owner', header: D.columns.owner, csv: (r) => owner(r.ownerIds), render: (r) => owner(r.ownerIds) || D.unknown },
          {
            key: 'authenticator',
            header: D.columns.authenticator,
            minWidth: '18rem',
            csv: (r) => registrations(r.displayName),
            render: (r) =>
              registrations(r.displayName) ? (
                <>
                  {registrations(r.displayName)} <InfoTip title={D.sameDevice.title} text={D.sameDevice.text} />
                </>
              ) : (
                D.unknown
              ),
          },
        ]}
      />
    </div>
  )
}

// ---------- Roles ----------

function RolesTab({ snapshot, names }: { snapshot: TenantSnapshot; names: ReturnType<typeof buildNameDirectory> }) {
  const R = C.roles
  const [showAll, setShowAll] = useState(false)
  const [resolved, setResolved] = useState<Map<string, ResolvedObject> | null>(null)
  const byRole = useMemo(() => {
    const map = new Map<string, { active: Set<string>; eligible: Set<string> }>()
    const add = (src: Record<string, string[]>, key: 'active' | 'eligible') => {
      for (const [holderId, roles] of Object.entries(src)) {
        for (const role of roles) {
          const id = role.toLowerCase()
          const e = map.get(id) ?? { active: new Set<string>(), eligible: new Set<string>() }
          e[key].add(holderId)
          map.set(id, e)
        }
      }
    }
    add(snapshot.roles.active, 'active')
    add(snapshot.roles.eligible, 'eligible')
    return map
  }, [snapshot])

  // Holders that are not users (groups, service principals) get their name
  // and kind on demand.
  useEffect(() => {
    const holders = new Set<string>()
    for (const e of byRole.values()) for (const id of [...e.active, ...e.eligible]) holders.add(id)
    const unknown = names.unknown(holders)
    if (unknown.length === 0) {
      setResolved(new Map())
      return
    }
    let cancelled = false
    void resolveObjects(unknown).then((m) => {
      if (!cancelled) setResolved(m)
    })
    return () => {
      cancelled = true
    }
  }, [byRole, names])

  const holder = (id: string): string => {
    const o = resolved?.get(id)
    if (o) return o.kind === 'servicePrincipal' ? R.service(o.displayName) : o.displayName
    return names.label(id)
  }
  type Row = { id: string; name: string; privileged: boolean; active: string; eligible: string; activeN: number; held: boolean }
  // A built-in role held only by service principals is hidden by default (prompt 46 item 25).
  const kindOf = (id: string): string | null => resolved?.get(id)?.kind ?? null
  const serviceOnly = (id: string): boolean => {
    const e = byRole.get(id)
    return e !== undefined && roleTemplate(id) !== undefined && heldOnlyByServices([...e.active, ...e.eligible], kindOf)
  }
  const ids = showAll ? new Set([...ROLE_TEMPLATES.map((r) => r.templateId), ...byRole.keys()]) : new Set([...byRole.keys()].filter((id) => !serviceOnly(id)))
  const rows: Row[] = [...ids].map((id) => {
    const e = byRole.get(id) ?? { active: new Set<string>(), eligible: new Set<string>() }
    return {
      id,
      // A role the catalogue and the scan cannot name is labelled by who holds it, never by an id (ux-review-05 §7).
      name: roleName(id) ?? (e.active.size + e.eligible.size > 0 ? R.usedBy([...e.active, ...e.eligible].slice(0, 2).map(holder).join(', ')) : roleLabel(id)),
      privileged: roleTemplate(id)?.privileged ?? false,
      active: [...e.active].map(holder).join(', '),
      eligible: [...e.eligible].map(holder).join(', '),
      activeN: e.active.size,
      held: e.active.size + e.eligible.size > 0,
    }
  })
  const hidden = ROLE_TEMPLATES.filter((r) => !byRole.has(r.templateId)).length + [...byRole.keys()].filter(serviceOnly).length
  return (
    <div>
      <Heading text={C.tabs.roles} source="roles" />
      <p className="reason">
        {resolved === null && `${R.resolving} `}
        {!showAll && hidden > 0 && `${R.hiddenNote(hidden)} `}
        <Button size="sm" variant="tertiary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? R.showHeld : R.showAll}
        </Button>
      </p>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        csvName="iamai-roles.csv"
        empty={R.empty}
        initialSort={{ key: 'active', dir: -1 }}
        columns={[
          {
            key: 'role',
            header: R.columns.role,
            sortValue: (r) => r.name.toLowerCase(),
            csv: (r) => r.name,
            render: (r) => (
              <>
                {r.name} {r.privileged && <Chip status="warning">{R.privileged}</Chip>}
              </>
            ),
          },
          { key: 'active', header: R.columns.active, sortValue: (r) => r.activeN, csv: (r) => r.active, render: (r) => r.active || '—' },
          { key: 'eligible', header: R.columns.eligible, csv: (r) => r.eligible, render: (r) => r.eligible || '—' },
        ]}
      />
    </div>
  )
}

// ---------- Licensing ----------

function LicensingTab({ snapshot }: { snapshot: TenantSnapshot }) {
  const L = C.licensing
  const skus = (snapshot.config.subscribedSkus?.rows ?? []) as Raw[]
  const friendly = productNames.products as Record<string, string>
  type Row = { id: string; sku: string; name: string; seats: number; consumed: number; caps: string }
  const all: Row[] = skus.map((s) => {
    const caps = deriveTenantCapabilities([s])
    const unlocked = CAPABILITIES.filter((c) => caps[c].enabled).map((c) => LICENSING.caps[c] ?? c)
    const sku = String(s.skuPartNumber ?? s.skuId ?? '')
    return {
      id: String(s.skuId ?? s.skuPartNumber ?? ''),
      sku,
      name: friendly[sku.toUpperCase()] ?? sku,
      seats: Number((s.prepaidUnits as Raw | undefined)?.enabled ?? 0),
      consumed: Number(s.consumedUnits ?? 0),
      caps: unlocked.join(', ') || L.none,
    }
  })
  const rows = all
  return (
    <div>
      <Heading text={C.tabs.licensing} source="licensing" />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        csvName="iamai-licences.csv"
        empty={L.empty}
        columns={[
          {
            key: 'sku',
            header: L.columns.sku,
            sortValue: (r) => r.name.toLowerCase(),
            csv: (r) => (r.name === r.sku ? r.sku : `${r.name} (${r.sku})`),
            render: (r) => (
              <>
                {r.name}
                {r.name !== r.sku && (
                  <>
                    <br />
                    <span className="sub muted">{r.sku}</span>
                  </>
                )}
              </>
            ),
          },
          { key: 'seats', header: L.columns.seats, sortValue: (r) => r.seats, csv: (r) => r.seats, render: (r) => r.seats },
          { key: 'consumed', header: L.columns.consumed, sortValue: (r) => r.consumed, csv: (r) => r.consumed, render: (r) => r.consumed },
          { key: 'caps', header: L.columns.capabilities, csv: (r) => r.caps, render: (r) => r.caps },
        ]}
      />
      <DataTable
        caption={L.summary}
        rows={CAPABILITIES.map((c) => ({ id: c, name: LICENSING.caps[c] ?? c, enabled: snapshot.capabilities[c].enabled, seats: snapshot.capabilities[c].seats, consumed: snapshot.capabilities[c].consumed }))}
        rowKey={(r) => r.id}
        csvName="iamai-capabilities.csv"
        columns={[
          { key: 'capability', header: L.capColumns.capability, csv: (r) => r.name, render: (r) => r.name },
          { key: 'seats', header: L.capColumns.seats, csv: (r) => (r.enabled ? L.seats(r.seats, r.consumed) : L.notLicensed), render: (r) => (r.enabled ? L.seats(r.seats, r.consumed) : L.notLicensed) },
        ]}
      />
    </div>
  )
}

// ---------- Apps ----------

function AppsTab({ snapshot, names }: { snapshot: TenantSnapshot; names: ReturnType<typeof buildNameDirectory> }) {
  const A = C.apps
  const summary = snapshot.appSignInSummary as Raw[]
  const sp = snapshot.spActivity as Raw[]
  const lastSpByApp = new Map<string, string>()
  for (const s of sp) {
    const appId = String(s.appId ?? '')
    const last = (s.lastSignInActivity as Raw | undefined)?.lastSignInDateTime
    if (appId && typeof last === 'string') lastSpByApp.set(appId, last)
  }
  type Row = { id: string; app: string; signIns: number; lastSp: string | null }
  const byApp = new Map<string, Row>()
  for (const r of summary) {
    const appId = String(r.appId ?? '')
    const name = typeof r.appDisplayName === 'string' ? r.appDisplayName : names.label(appId)
    const n = Number(r.signInCount ?? 0)
    const row = byApp.get(appId) ?? { id: appId || name, app: name, signIns: 0, lastSp: lastSpByApp.get(appId) ?? null }
    row.signIns += n
    byApp.set(appId, row)
  }
  for (const [appId, last] of lastSpByApp) {
    if (!byApp.has(appId)) byApp.set(appId, { id: appId, app: names.label(appId), signIns: 0, lastSp: last })
  }
  const facets = detectFacets(snapshot)
  return (
    <div>
      <Heading text={C.tabs.apps} source="apps" />
      <DataTable
        rows={[...byApp.values()]}
        rowKey={(r) => r.id}
        csvName="iamai-apps.csv"
        empty={A.empty}
        initialSort={{ key: 'signIns', dir: -1 }}
        columns={[
          { key: 'app', header: A.columns.app, sortValue: (r) => r.app.toLowerCase(), csv: (r) => r.app, render: (r) => r.app },
          { key: 'signIns', header: A.columns.signIns, sortValue: (r) => r.signIns, csv: (r) => r.signIns, render: (r) => r.signIns },
          { key: 'lastSp', header: A.columns.lastSp, sortValue: (r) => r.lastSp ?? '', csv: (r) => (r.lastSp ? absoluteDate(r.lastSp) : ''), render: (r) => (r.lastSp ? <span title={absoluteDate(r.lastSp)}>{relative(r.lastSp)}</span> : '—') },
        ]}
      />
      <DataTable
        caption={A.facets}
        rows={Object.entries(facets).map(([facet, f]) => ({ facet, name: SETUP_PAGE.workloadNames[facet] ?? facet, on: f.on, reason: f.reason }))}
        rowKey={(r) => r.facet}
        csvName="iamai-workloads.csv"
        columns={[
          { key: 'workload', header: A.facetColumns.workload, csv: (r) => r.name, render: (r) => r.name },
          {
            key: 'detected',
            header: A.facetColumns.detected,
            csv: (r) => (r.on ? A.on : A.off),
            render: (r) => (
              <Chip status={r.on ? 'done' : 'neutral'} title={r.reason}>
                {r.on ? A.on : A.off}
              </Chip>
            ),
          },
        ]}
      />
    </div>
  )
}

// ---------- Sign-in records ----------

function SignInsTab({ snapshot, names }: { snapshot: TenantSnapshot; names: ReturnType<typeof buildNameDirectory> }) {
  const S = C.signIns
  const src = snapshot.sources.signInEvidence
  const agg = snapshot.evidenceAggregates ?? null
  type CountRow = { key: string; count: number }
  const table = (title: string, data: Record<string, number>, header: string, csv: string) => (
    <>
      <DataTable
        caption={title}
        rows={Object.entries(data).map(([key, count]) => ({ key, count }))}
        rowKey={(r) => r.key}
        csvName={csv}
        initialSort={{ key: 'count', dir: -1 }}
        columns={[
          { key: 'key', header: S.columns.key, sortValue: (r: CountRow) => r.key, csv: (r: CountRow) => r.key, render: (r: CountRow) => r.key },
          { key: 'count', header, sortValue: (r: CountRow) => r.count, csv: (r: CountRow) => r.count, render: (r: CountRow) => r.count },
        ]}
      />
    </>
  )
  const usage = snapshot.evidenceUsage
  // Three names at most per row: a long list is a count with the first three (row budget).
  const people = (ids: string[]) => (ids.length === 0 ? S.nobody : ids.length <= 3 ? ids.map(names.label).join(', ') : S.morePeople(ids.slice(0, 3).map(names.label), ids.length - 3))
  return (
    <div>
      <Heading text={C.tabs.signIns} source="signIns" />
      {src?.coveredWindow && agg ? (
        <>
          <p>
            {S.window(absoluteDate(src.coveredWindow.from), absoluteDate(src.coveredWindow.to), agg.total)} · {S.distinctUsers(agg.distinctUsers)}
            <InfoTip title={S.distinctUsersTip.title} text={S.distinctUsersTip.text} />
          </p>
          {table(S.byClientApp, agg.byClientApp, S.columns.count, 'iamai-signins-by-client-app.csv')}
          {table(S.byProtocol, Object.fromEntries(Object.entries(agg.byProtocol).map(([k, v]) => [protocolName(k), v])), S.columns.count, 'iamai-signins-by-protocol.csv')}
          {table(S.byCountry, agg.byCountry, S.columns.users, 'iamai-signins-by-country.csv')}
          {usage && (
            <DataTable
              caption={S.olderMethods}
              rows={[
                { method: S.legacy, ids: usage.legacyAuth.userIds },
                { method: S.deviceCode, ids: usage.deviceCode.userIds },
                { method: S.authTransfer, ids: usage.authTransfer.userIds },
              ]}
              rowKey={(r) => r.method}
              csvName="iamai-older-sign-in-methods.csv"
              columns={[
                { key: 'method', header: S.usageColumns.method, csv: (r) => r.method, render: (r) => r.method },
                { key: 'people', header: S.usageColumns.people, csv: (r) => r.ids.map(names.label).join('; '), render: (r) => people(r.ids) },
              ]}
            />
          )}
          <DataTable
            caption={S.blockedToday}
            rows={snapshot.blockedToday}
            rowKey={(r) => r.policyId}
            csvName="iamai-blocked-today.csv"
            columns={[
              { key: 'policy', header: S.blockedColumns.policy, csv: (r) => r.displayName ?? r.policyId, render: (r) => r.displayName ?? (r.policyId === 'unknown' ? S.noPolicy : names.label(r.policyId)) },
              { key: 'users', header: S.blockedColumns.users, csv: (r) => r.userIds.map(names.label).join('; '), render: (r) => people(r.userIds) },
            ]}
          />
        </>
      ) : (
        <EmptyState icon="chart" text={S.noWindow} />
      )}
    </div>
  )
}
