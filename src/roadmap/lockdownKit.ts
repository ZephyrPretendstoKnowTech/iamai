// The lockdown kit (T2-LK; owner, 2026-10-03; docs/plans/v1.1/plan.md D3): Jon
// Hope's three ZTCA incident switches, prepared ahead and never turned on by the
// plan. One step in Ongoing Checks and Cleanup creates each policy Off (state
// `disabled`): Off, a policy evaluates nobody, so it changes nothing until
// somebody flips it in an incident. They are not in Create the Policies in
// Report-only and have no turn-on: report-only would mark every sign-in in the
// tenant, and the plan never turns a switch on.
//
// Who stays online when a switch is flipped is the emergency access exclusions
// group only (owner: "anyone in the breakglass group"). Jon's other excluded
// groups are his own environment and are dropped, as the interpretation already
// reads them (`authorEnvironment`); the policies otherwise match his export
// (exact controls). The Admin Portal block is read as the third switch (owner,
// 2026-10-03), so it is no longer a baseline conflict (baselineConflict.ts).
//
// The kit is a property of the pinned baseline, by the policies' stable ids, the
// way baselineConflict.ts names a reviewed source: the goal map hands the three
// to `lockdown-kit` and to no other goal (`withLockdownKit`), so the Not in this
// plan footer drops them because the step claims them (derive/notInPlan.ts).
//
// The step's work is read from the scan alone: each switch exists (by its plan
// tag, else the baseline's name), has every setting the create writes, and is
// Off. A switch found On is not done: the step says it is on and how to stand
// down. A switch in Report-only is set Off.
//
// Pure: no DOM, no network.
import { nameKey } from '../baseline/discover.ts'
import { unwrittenDifferences } from './observation.ts'
import type { PolicyOperation, Step } from './types.ts'

/** The goal-map key the three switches sit under, and the step's goal id. */
export const LOCKDOWN_KIT_GOAL = 'lockdown-kit'

/** What each switch shuts, which is what its runbook line says it is for. */
export type LockdownSwitch = 'adminPortals' | 'unmanagedDevices' | 'everything'

/**
 * The switches, in the order an incident escalates through them: the admin
 * portals, then unmanaged devices outside the trusted network, then everything.
 * `key` is the pinned policy's stable id; `reviewedName` is provenance only.
 */
export const LOCKDOWN_SWITCHES: readonly { key: string; reviewedName: string; switch: LockdownSwitch }[] = [
  { key: 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e', reviewedName: 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal', switch: 'adminPortals' },
  { key: '2dd84b12-7900-40f0-b192-027c20aaa83f', reviewedName: 'IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation', switch: 'unmanagedDevices' },
  { key: '8417ec17-17f5-44c1-b937-85b1917f5d9e', reviewedName: 'IAC- ZTCA - GLOBAL - BLOCK - AllApps -Exclude CA-Global', switch: 'everything' },
]

/** The switch a goal-map key is, or null. */
export function switchOf(key: string): LockdownSwitch | null {
  return LOCKDOWN_SWITCHES.find((s) => s.key === key.toLowerCase())?.switch ?? null
}

/**
 * The goal map with the switches the package carries under `lockdown-kit` and
 * under no other goal: a goal left with no policy leaves the map (the pinned
 * map handed the Admin Portal block to admin-portals-protected).
 */
export function withLockdownKit<P>(map: Record<string, string[]>, policies: readonly P[], keyOf: (p: P) => string): Record<string, string[]> {
  const present = new Set(policies.map((p) => keyOf(p).toLowerCase()))
  const kit = LOCKDOWN_SWITCHES.map((s) => s.key).filter((k) => present.has(k))
  if (kit.length === 0) return map
  const out: Record<string, string[]> = {}
  for (const [goal, keys] of Object.entries(map)) {
    const rest = keys.filter((k) => !kit.includes(k.toLowerCase()))
    if (rest.length > 0) out[goal] = rest
  }
  out[LOCKDOWN_KIT_GOAL] = kit
  return out
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})

/**
 * A switch's source policy as the kit builds it. Jon's Admin Portal block
 * excludes service providers from an enumerated list of partner tenants that
 * names none: his own partners, which are not this tenant's. No form of that
 * clause can be built (Graph and the Entra form both need the tenants named),
 * and the portal's default, every service provider, would keep people online
 * the owner did not name. So the clause goes, and only the exclusions group
 * stays online, as the owner decided (2026-10-03). The Unmanaged devices
 * switch's clause names every service provider and is kept, as Jon wrote it.
 */
export function switchSource<P extends Json>(policy: P): P {
  const conditions = obj(policy.conditions)
  const users = obj(conditions.users)
  const clause = obj(users.excludeGuestsOrExternalUsers)
  const tenants = obj(clause.externalTenants)
  const named = Array.isArray(tenants.members) && tenants.members.length > 0
  if (String(tenants.membershipKind ?? '').toLowerCase() !== 'enumerated' || named) return policy
  const { excludeGuestsOrExternalUsers: _dropped, ...rest } = users
  return { ...policy, conditions: { ...conditions, users: rest } }
}

/**
 * An operation without the applications its policy includes that the tenant
 * does not have and no step makes (`tokens`; resolvePolicy.ts missing with no
 * step): Jon's Admin Portal block names his Inforcer app, and a tenant without
 * Inforcer has no Inforcer to block. The described body (`pending`) leaves them
 * out as the written one already does.
 */
export function withoutUnmadeApps(op: PolicyOperation, tokens: ReadonlySet<string>): PolicyOperation {
  if (!op.pending || tokens.size === 0) return op
  const conditions = obj(op.pending.conditions)
  const applications = obj(conditions.applications)
  const include = Array.isArray(applications.includeApplications) ? applications.includeApplications.filter((a) => !tokens.has(String(a).toLowerCase())) : applications.includeApplications
  return { ...op, pending: { ...op.pending, conditions: { ...conditions, applications: { ...applications, includeApplications: include } } } }
}

/** Where a switch stands in the tenant. */
export type SwitchState = 'absent' | 'off' | 'report-only' | 'on'

/** One switch as the scan read it against the create the plan writes for it. */
export type LockdownKitMember = {
  /** The member identity (observation.ts memberKeyOf), as its plan tag carries it. */
  key: string
  switch: LockdownSwitch
  /** The baseline's name for the policy, the one its create gives it. */
  name: string
  /** The tenant's policy that is this switch, or null where it has none. */
  policyId: string | null
  /** The tenant's name for it, where it has one. */
  policyName: string | null
  state: SwitchState
  /** The settings (observation.ts dimensions) the tenant's policy holds unlike the create, less any a person accepted. */
  differences: string[]
}

type Row = Json

const stateOf = (row: Row | null): SwitchState =>
  row === null ? 'absent' : row.state === 'disabled' ? 'off' : row.state === 'enabledForReportingButNotEnforced' ? 'report-only' : 'on'

/**
 * Each switch against the tenant (`switches[i]` is what `ops[i]` creates): the policy carrying its member tag, else the
 * one carrying the baseline's name (dashes, spacing and capitals aside:
 * baseline/discover.ts nameKey), as the guest pair finds its halves. A policy
 * is one switch at most.
 */
export function kitMembersOf(ops: readonly PolicyOperation[], switches: readonly LockdownSwitch[], rows: readonly unknown[], tagged: readonly { policyId: string; memberKey: string | null }[], accepted: Readonly<Record<string, unknown>> = {}): LockdownKitMember[] {
  const all = rows.filter((r): r is Row => r !== null && typeof r === 'object' && typeof (r as Row).id === 'string')
  const claimed = new Set<string>()
  const out: LockdownKitMember[] = []
  for (const [i, op] of ops.entries()) {
    const sw = switches[i]
    if (sw === undefined) continue
    // The policy the plan writes, or with the exclusions group still to be made, the policy with it.
    const intent = (op.pending ?? op.body) as Row
    const name = String(op.body.displayName ?? op.sourceName ?? '')
    const byTag = tagged.filter((t) => t.memberKey === op.memberKey).map((t) => all.find((p) => p.id === t.policyId)).find((p): p is Row => p !== undefined && !claimed.has(String(p.id)))
    const byName = all.find((p) => !claimed.has(String(p.id)) && nameKey(String(p.displayName ?? '')) === nameKey(name))
    const row = byTag ?? byName ?? null
    if (row) claimed.add(String(row.id))
    out.push({
      key: op.memberKey,
      switch: sw,
      name,
      policyId: row ? String(row.id) : null,
      policyName: row ? String(row.displayName ?? '') : null,
      state: stateOf(row),
      differences: row ? unwrittenDifferences(intent, null, row).filter((d) => accepted[d] === undefined) : [],
    })
  }
  return out
}

/** A switch as the plan leaves it: there, Off, every setting as the create writes it. */
export const switchReady = (m: Pick<LockdownKitMember, 'state' | 'differences'>): boolean => m.state === 'off' && m.differences.length === 0

/**
 * The step's reading of its switches: done when every one is there, Off and
 * exact; otherwise its row counts the switches still to create, correct or set
 * Off (rowWho.ts). A switch found On keeps the step open, whatever else holds.
 * Returns whether the kit is done; the caller writes the state (lifecycle.ts
 * setState, kept out of this module so goalMap.ts can import it without a cycle).
 */
export function settleLockdownKit(step: Step, members: readonly LockdownKitMember[], satisfiedHeading: string, satisfiedDetail: string): boolean {
  step.lockdownKit = { members: [...members] }
  const open = members.filter((m) => !switchReady(m))
  const done = members.length > 0 && open.length === 0
  step.impactCount = open.length > 0 ? open.length : members.length
  if (done) step.satisfiedFacts = members.map((m) => ({ heading: satisfiedHeading, title: m.policyName ?? m.name, detail: satisfiedDetail }))
  return done
}
