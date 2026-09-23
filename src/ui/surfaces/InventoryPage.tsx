// Inventory: the data as found (prompt 10 §B). Read-only DataTables, no
// analysis; every table exports CSV and says where its data comes from. Every
// table is a model from inventoryTables.ts, the same one the Export CSV card
// writes: this page adds chips, links and tooltips around the model's words and
// builds no cell of its own.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { getGroupMembers, resolveObjects } from '../../graph/collect/onDemand.ts'
import type { ResolvedObject } from '../../graph/collect/onDemand.ts'
import type { GroupMembersCacheEntry } from '../../graph/collect/cache.ts'
import type { PolicyFacts } from '../../coverage/types.ts'
import { buildNameDirectory } from '../../names.ts'
import type { NameDirectory } from '../../names.ts'
import { coversAdminSet, roleLabel } from '../../roles.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { INVENTORY as C, migrationName } from '../../copy/inventory.ts'
import { TILE } from '../../copy/definitions.ts'
import { absoluteDate, relative } from '../format.ts'
import { Button, Chip, DataTable, EmptyState, InfoTip, Tabs } from '../components/index.ts'
import type { ChipStatus, Column } from '../components/index.ts'
import {
  appsModel,
  authMethodsModel,
  authMethodsPolicyOf,
  authStrengthsModel,
  capabilitiesModel,
  devicesModel,
  groupsModel,
  licencesModel,
  locationsModel,
  peopleModel,
  policiesModel,
  policyFactsOf,
  referencedGroupsOf,
  registrationModel,
  roleHoldersOf,
  rolesModel,
  signInModels,
  usersDetail,
  viabilityOf,
  workloadsModel,
} from './inventoryTables.ts'
import type { GroupEntry, InventoryModel } from './inventoryTables.ts'

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

/**
 * A model drawn as a table: every column's header, sort and CSV cell are the
 * model's; `render` only dresses a cell's words (a chip, a tooltip, a date
 * shown relative to today).
 */
function ModelTable<R>({
  model,
  render = {},
  caption,
  expand,
  initialSort,
}: {
  model: InventoryModel<R>
  render?: Partial<Record<string, (r: R) => ReactNode>>
  caption?: ReactNode
  expand?: (r: R) => ReactNode
  initialSort?: { key: string; dir: 1 | -1 }
}) {
  const columns: Column<R>[] = model.columns.map((c) => ({ key: c.key, header: c.header, csv: c.cell, sortValue: c.sort, hidden: c.hidden, minWidth: c.minWidth, render: render[c.key] ?? c.cell }))
  return <DataTable panel rows={model.rows} columns={columns} rowKey={model.rowKey} csvName={model.csvName} empty={model.empty} caption={caption} expand={expand} initialSort={initialSort} />
}

/** A model's cell words for one column. */
const cellOf = <R,>(model: InventoryModel<R>, key: string) => model.columns.find((c) => c.key === key)!.cell

export function InventoryPage({ snapshot }: { snapshot: TenantSnapshot }) {
  const [groups, setGroups] = useState<GroupMembersCacheEntry[] | null>(null)

  const policies = useMemo(() => (snapshot.config.caPolicies?.rows ?? []) as Raw[], [snapshot])
  const facts = useMemo(() => policyFactsOf(snapshot, policies), [policies, snapshot])
  const referencedGroups = useMemo(() => referencedGroupsOf(facts), [facts])

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
  const viability = useMemo(() => viabilityOf(snapshot), [snapshot])
  // A read that did not come back carries no date (the catch above).
  const groupEntries = useMemo<GroupEntry[] | null>(
    () => groups?.map((g) => ({ groupId: g.groupId, displayName: g.displayName, memberCount: g.memberCount, sampled: g.sampled, membershipRule: g.membershipRule, read: g.asOf !== '' })) ?? null,
    [groups],
  )

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'policies', label: C.tabs.policies, badge: policies.length, render: () => <PoliciesTab facts={facts} names={names} /> },
          { id: 'locations', label: C.tabs.locations, render: () => <LocationsTab snapshot={snapshot} facts={facts} /> },
          { id: 'authentication', label: C.tabs.authentication, render: () => <AuthenticationTab snapshot={snapshot} names={names} /> },
          { id: 'people', label: C.tabs.people, badge: snapshot.users.length, render: () => <PeopleTab snapshot={snapshot} names={names} viability={viability} /> },
          { id: 'groups', label: C.tabs.groups, badge: referencedGroups.size, render: () => <GroupsTab referenced={referencedGroups} groups={groupEntries} names={names} /> },
          { id: 'devices', label: C.tabs.devices, badge: snapshot.devices.length, render: () => <DevicesTab snapshot={snapshot} names={names} /> },
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

function PoliciesTab({ facts, names }: { facts: PolicyFacts[]; names: NameDirectory }) {
  const P = C.policies
  const model = policiesModel(facts, names)
  const users = cellOf(model, 'users')
  const list = (ids: Iterable<string>) => [...ids].map(names.label).join(', ')
  const roleList = (ids: Set<string>) => (coversAdminSet(ids) ? P.allAdminRoles(ids.size) : [...ids].map(roleLabel).join(', '))
  return (
    <div>
      <Heading text={C.tabs.policies} source="policies" />
      <ModelTable
        model={model}
        render={{
          name: (r) => (
            <>
              {r.name} {r.isMicrosoftManaged && <Chip status="neutral">{P.microsoftManaged}</Chip>}
            </>
          ),
          state: (r) => <Chip status={STATE_CHIP[r.state]}>{P.state[r.state]}</Chip>,
          // Tooltip for the Users column: the names behind the counts.
          users: (r) => <span title={usersDetail(r, names.label) || undefined}>{users(r)}</span>,
        }}
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

function LocationsTab({ snapshot, facts }: { snapshot: TenantSnapshot; facts: PolicyFacts[] }) {
  const L = C.locations
  return (
    <div>
      <Heading text={C.tabs.locations} source="locations" />
      <ModelTable
        model={locationsModel(snapshot, facts)}
        render={{
          trusted: (r) => <Chip status={r.trusted ? 'done' : 'neutral'}>{r.trusted ? L.trusted : L.notTrusted}</Chip>,
          ranges: (r) => <span className="mono">{r.ranges}</span>,
        }}
      />
    </div>
  )
}

// ---------- Authentication ----------

function AuthenticationTab({ snapshot, names }: { snapshot: TenantSnapshot; names: NameDirectory }) {
  const A = C.authentication
  const policy = authMethodsPolicyOf(snapshot)
  const campaign = ((policy?.registrationEnforcement as Raw | undefined)?.authenticationMethodsRegistrationCampaign ?? null) as Raw | null
  const migration = typeof policy?.policyMigrationState === 'string' ? policy.policyMigrationState : null
  const secDefaults = ((snapshot.config.securityDefaults?.rows ?? [])[0] ?? null) as Raw | null

  return (
    <div>
      <Heading text={C.tabs.authentication} source="authentication" />
      {policy ? (
        <>
          <ModelTable model={authMethodsModel(snapshot, names)} caption={A.methods} render={{ state: (r) => <Chip status={r.enabled ? 'done' : 'neutral'}>{r.enabled ? A.enabled : A.disabled}</Chip> }} />
          <p className="reason">
            {campaign && A.campaignState(String(campaign.state ?? 'unknown'))}
            {migration && ` · ${A.migration(migrationName(migration))}`}
          </p>
        </>
      ) : (
        <p className="reason">{A.empty}</p>
      )}

      <ModelTable
        model={authStrengthsModel(snapshot)}
        caption={A.strengths}
        render={{
          type: (r) => <Chip status={r.builtIn ? 'neutral' : 'ready'}>{r.builtIn ? A.builtIn : A.custom}</Chip>,
          combos: (r) => <span className="sub">{r.combos}</span>,
        }}
      />

      <ModelTable
        model={registrationModel(snapshot)}
        caption={
          <>
            {A.registration}
            <InfoTip title={TILE.registration.title} text={TILE.registration.text} />
          </>
        }
      />

      <p className="reason">
        {A.securityDefaults}: <Chip status={secDefaults?.isEnabled === true ? 'warning' : 'done'}>{secDefaults?.isEnabled === true ? A.on : A.off}</Chip>
      </p>
    </div>
  )
}

// ---------- People ----------

function PeopleTab({ snapshot, names, viability }: { snapshot: TenantSnapshot; names: NameDirectory; viability: Map<string, MfaViability> }) {
  const P = C.people
  return (
    <div>
      <Heading text={C.tabs.people} source="people" />
      <ModelTable
        model={peopleModel(snapshot, names, viability)}
        render={{
          upn: (r) => <span className="sub">{r.user.userPrincipalName}</span>,
          // A sign-in-disabled account (a shared mailbox, a resource) is listed here with its tag, and counted as a person nowhere.
          type: (r) => (
            <>
              {r.user.userType === 'guest' ? <Chip>{P.guest}</Chip> : P.member}
              {r.user.accountEnabled === false && (
                <>
                  {' '}
                  <Chip status="neutral">{P.signInDisabled}</Chip>
                </>
              )}
            </>
          ),
        }}
      />
    </div>
  )
}

// ---------- Groups ----------

// L3: Groups used to be a sub-tab of People, a tab strip inside a tab strip. It is its own tab.
function GroupsTab({ referenced, groups, names }: { referenced: Map<string, { include: string[]; exclude: string[] }>; groups: GroupEntry[] | null; names: NameDirectory }) {
  const G = C.groups
  return (
    <div>
      <Heading text={C.tabs.groups} source="groups" />
      {groups === null && <p className="reason">{G.loading}</p>}
      <ModelTable model={groupsModel(referenced, groups, names)} render={{ policies: (r) => <span className="sub">{r.policies}</span> }} />
    </div>
  )
}

// ---------- Devices ----------

function DevicesTab({ snapshot, names }: { snapshot: TenantSnapshot; names: NameDirectory }) {
  const D = C.devices
  const model = useMemo(() => devicesModel(snapshot, names), [snapshot, names])
  const compliant = cellOf(model, 'compliant')
  return (
    <div>
      <Heading text={C.tabs.devices} source="devices" />
      <ModelTable
        model={model}
        render={{
          compliant: (r) => <Chip status={r.isCompliant ? 'done' : 'neutral'}>{compliant(r)}</Chip>,
          last: (r) => (r.approximateLastSignIn ? <span title={absoluteDate(r.approximateLastSignIn)}>{relative(r.approximateLastSignIn)}</span> : D.unknown),
          authenticator: (r) =>
            model.registrations(r) ? (
              <>
                {model.registrations(r)} <InfoTip title={D.sameDevice.title} text={D.sameDevice.text} />
              </>
            ) : (
              D.unknown
            ),
        }}
      />
    </div>
  )
}

// ---------- Roles ----------

function RolesTab({ snapshot, names }: { snapshot: TenantSnapshot; names: NameDirectory }) {
  const R = C.roles
  const [showAll, setShowAll] = useState(false)
  const [resolved, setResolved] = useState<Map<string, ResolvedObject> | null>(null)
  const holders = useMemo(() => roleHoldersOf(snapshot), [snapshot])

  // Holders that are not users (groups, service principals) get their name
  // and kind on demand.
  useEffect(() => {
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
  }, [holders, names])

  const model = rolesModel(snapshot, names, resolved, showAll)
  return (
    <div>
      <Heading text={C.tabs.roles} source="roles" />
      <p className="reason">
        {resolved === null && `${R.resolving} `}
        {!showAll && model.hidden > 0 && `${R.hiddenNote(model.hidden)} `}
        <Button size="sm" variant="tertiary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? R.showHeld : R.showAll}
        </Button>
      </p>
      <ModelTable
        model={model}
        initialSort={{ key: 'active', dir: -1 }}
        render={{
          role: (r) => (
            <>
              {r.name} {r.privileged && <Chip status="warning">{R.privileged}</Chip>}
            </>
          ),
        }}
      />
    </div>
  )
}

// ---------- Licensing ----------

function LicensingTab({ snapshot }: { snapshot: TenantSnapshot }) {
  const L = C.licensing
  return (
    <div>
      <Heading text={C.tabs.licensing} source="licensing" />
      <ModelTable
        model={licencesModel(snapshot)}
        render={{
          sku: (r) => (
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
        }}
      />
      <ModelTable model={capabilitiesModel(snapshot)} caption={L.summary} />
    </div>
  )
}

// ---------- Apps ----------

function AppsTab({ snapshot, names }: { snapshot: TenantSnapshot; names: NameDirectory }) {
  const A = C.apps
  const workloads = workloadsModel(snapshot)
  const detected = cellOf(workloads, 'detected')
  return (
    <div>
      <Heading text={C.tabs.apps} source="apps" />
      <ModelTable
        model={appsModel(snapshot, names)}
        initialSort={{ key: 'signIns', dir: -1 }}
        render={{ lastSp: (r) => (r.lastSp ? <span title={absoluteDate(r.lastSp)}>{relative(r.lastSp)}</span> : '—') }}
      />
      <ModelTable
        model={workloads}
        caption={A.facets}
        render={{
          detected: (r) => (
            <Chip status={r.on ? 'done' : 'neutral'} title={r.reason}>
              {detected(r)}
            </Chip>
          ),
        }}
      />
    </div>
  )
}

// ---------- Sign-in records ----------

function SignInsTab({ snapshot, names }: { snapshot: TenantSnapshot; names: NameDirectory }) {
  const S = C.signIns
  const src = snapshot.sources.signInEvidence
  const agg = snapshot.evidenceAggregates ?? null
  const m = signInModels(snapshot, names)
  // Three names at most per row: a long list is a count with the first three (row budget).
  const people = (ids: string[]) => (ids.length === 0 ? S.nobody : ids.length <= 3 ? ids.map(names.label).join(', ') : S.morePeople(ids.slice(0, 3).map(names.label), ids.length - 3))
  const count = { initialSort: { key: 'count', dir: -1 as const } }
  return (
    <div>
      <Heading text={C.tabs.signIns} source="signIns" />
      {src?.coveredWindow && agg ? (
        <>
          <p>
            {S.window(absoluteDate(src.coveredWindow.from), absoluteDate(src.coveredWindow.to), agg.total)} · {S.distinctUsers(agg.distinctUsers)}
            <InfoTip title={S.distinctUsersTip.title} text={S.distinctUsersTip.text} />
          </p>
          <ModelTable model={m.byClientApp} caption={S.byClientApp} {...count} />
          <ModelTable model={m.byProtocol} caption={S.byProtocol} {...count} />
          <ModelTable model={m.byCountry} caption={S.byCountry} {...count} />
          {m.olderMethods && <ModelTable model={m.olderMethods} caption={S.olderMethods} render={{ people: (r) => people(r.ids) }} />}
          <ModelTable model={m.blockedToday} caption={S.blockedToday} render={{ people: (r) => people(r.ids) }} />
        </>
      ) : (
        <EmptyState icon="chart" text={S.noWindow} />
      )}
    </div>
  )
}
