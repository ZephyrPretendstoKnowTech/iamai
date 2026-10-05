// What turning on Require a Security Key for One Emergency Account waits on
// (owner, 2026-10-05; roadmap/emergencyStrongAccount.ts). The policy is created
// in Report-only like any other; its turn-on is held until all three hold:
//
//   method        the scan reads that the chosen account holds a method the
//                 policy's strength accepts, and that it is a phishing-resistant
//                 method of its own (a device-bound passkey, a FIDO2 key, Windows
//                 Hello for Business or a certificate) — a Temporary Access Pass
//                 the strength also takes is no standing way in;
//   drilled       Verify Emergency Access holds a recorded successful sign-in for
//                 it, current for its present configuration — the reading the
//                 drill row and bg.drilled use (cleanupDone.ts latestRecoveryTest);
//   otherExcluded every other emergency account is in the exclusions group, and
//                 every other policy excludes that group.
//
// Each is true, false, or null where the scan could not read it. Null holds the
// turn-on exactly as false does: unknown is conservative.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { isPhishingResistantKind, isPhishingResistantRegistered } from '../scoring/phishingResistant.ts'
import { exclusionsGroupPolicies, groupLookup } from '../validation/exclusionsGroupPolicies.ts'
import { effectOf } from './operations.ts'
import type { ScopeEvidence } from './operations.ts'
import { methodPreparation } from './methodReadiness.ts'
import { latestRecoveryTest, recoveryEvidenceOf } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { acceptedEmergencyStrongPolicy } from './emergencyStrongAccount.ts'
import type { EmergencyStrongGates } from './emergencyStrongAccount.ts'

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const all = (xs: readonly (boolean | null)[]): boolean | null => (xs.includes(false) ? false : xs.every((x) => x === true) ? true : null)

export type EmergencyStrongGateInput = {
  snapshot: TenantSnapshot
  mapping: MappingState
  groups: GroupMembers
  records: readonly CleanupCheckpoint[]
  now: string
  /** The chosen account (mapping/emergencyChoice.ts emergencyStrongAccountOf). */
  accountId: string
  /** The bodies the step leaves in the tenant: a create's body, an update's target. */
  bodies: readonly Record<string, unknown>[]
  /** The exclusions group the plan may use (the operator's, read by this scan); null where there is none. */
  exclusionsGroupId: string | null
  evidence?: ScopeEvidence
}

/** The chosen account holds a phishing-resistant method of its own that the policy's strength accepts. */
function methodGate(i: EmergencyStrongGateInput): boolean | null {
  const methods = i.snapshot.authMethods[i.accountId]
  const registered = i.snapshot.registrationDetails.find((r) => same(r.id, i.accountId))?.methodsRegistered ?? []
  const own = methods === undefined || methods === 'unknown'
    ? null
    : methods.some((m) => isPhishingResistantKind(m.kind)) || registered.some(isPhishingResistantRegistered)
  if (i.bodies.length === 0) return own === false ? false : null
  const p = methodPreparation(i.bodies.map((b) => effectOf(b)), [i.accountId], i.snapshot, i.evidence ?? {})
  const accepted = p.readyIds.some((id) => same(id, i.accountId)) ? true : p.unknownIds.some((id) => same(id, i.accountId)) || !p.ids.some((id) => same(id, i.accountId)) ? null : false
  return all([own, accepted])
}

/** Verify Emergency Access has a recorded successful sign-in for the chosen account, current for its configuration. */
function drillGate(i: EmergencyStrongGateInput): boolean {
  const { basis, context } = recoveryEvidenceOf(i.snapshot, i.mapping, i.groups, i.records, i.now, i.accountId)
  return latestRecoveryTest(i.accountId, i.records, i.now, basis, context) !== null
}

/** Every other emergency account is in the exclusions group, and every other policy excludes the group. */
function otherExcludedGate(i: EmergencyStrongGateInput): boolean | null {
  const others = i.mapping.breakGlassUserIds.filter((id) => !same(id, i.accountId))
  if (others.length === 0 || i.exclusionsGroupId === null) return null
  const groupId = i.exclusionsGroupId
  const group = groupLookup(i.groups)(groupId)
  const inGroup = others.map((id): boolean | null => group === undefined ? null : group.memberIds.some((m) => same(m, id)) ? true : group.sampled === true ? null : false)
  if (i.snapshot.config.caPolicies?.status !== 'ok') return all([...inGroup, null])
  const needing = exclusionsGroupPolicies({ policies: i.snapshot.config.caPolicies.rows, groupId, accountIds: others, activeRoles: i.snapshot.roles.active, membersOf: groupLookup(i.groups), accepted: acceptedEmergencyStrongPolicy(i.snapshot.tenantId, i.mapping) })
  const excluded = needing.map((p): boolean | null => (p.outcome === 'pass' ? true : p.outcome === 'fail' ? false : null))
  return all([...inGroup, ...excluded])
}

export function emergencyStrongGatesOf(i: EmergencyStrongGateInput): EmergencyStrongGates {
  return { accountId: i.accountId, method: methodGate(i), drilled: drillGate(i), otherExcluded: otherExcludedGate(i) }
}
