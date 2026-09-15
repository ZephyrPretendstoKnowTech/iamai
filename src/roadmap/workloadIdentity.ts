// Whether the identity that performs synchronization can be governed by workload
// Conditional Access (editorial batch B, owner-approved methodology 2026-09-14).
//
// Microsoft documents workload Conditional Access for single-tenant service
// principals the tenant owns; Microsoft applications, multitenant applications and
// managed identities are outside that scope, and assignment targets the service
// principal directly (learn.microsoft.com/entra/identity/conditional-access/workload-identity).
// A Directory Synchronization Accounts role holder, a Workload ID licence or a
// provisioning configuration establishes none of that: Microsoft's own Cloud Sync
// schema example is a multitenant application, and a provisioning object is not
// shown to be the identity that requests tokens.
//
// The scan holds no evidence about the identity that requests tokens for a sync
// workflow — its type, its owning organization, its sign-in audience — so the plan's
// reading is unknown, and the workload step holds on it (roadmap/generate.ts) and is
// never completed by a matching policy. `workloadIdentitySupport` is the rule that
// evidence is read against; it never turns a role or a licence into support. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** The baseline goal that restricts the sync workflow's identity to its network (content step workload-identity-block). */
export const SYNC_WORKLOAD_GOAL_ID = 'workload-identity-block'

/**
 * The label of the evidence blocker a workload step carries while its identity's
 * support is not established (roadmap/generate.ts). Tracking reads it too
 * (roadmap/tracking.ts): a policy that looks like the target never completes a step
 * that carries it.
 */
export const WORKLOAD_IDENTITY_BLOCKER = 'workload-identity-support'

/** What a read of the calling identity would carry (Graph servicePrincipal and application fields). */
export type SyncIdentityEvidence = { servicePrincipalType?: unknown; appOwnerOrganizationId?: unknown; signInAudience?: unknown }

export type WorkloadIdentitySupport =
  | { support: 'supported' }
  | { support: 'unsupported'; because: 'managedIdentity' | 'microsoftApplication' | 'multitenantApplication' }
  | { support: 'unknown' }

/** Microsoft's own organizations: an application one of them owns is a Microsoft application. */
const MICROSOFT_ORGANIZATIONS: ReadonlySet<string> = new Set(['f8cdef31-a31e-4b4a-93e4-5f571e91255a', '72f988bf-86f1-41af-91ab-2d7cd011db47'])

const lower = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim().toLowerCase() : null)

/**
 * The identity's standing for workload Conditional Access. Supported only for an
 * application service principal the tenant itself owns with a single-tenant sign-in
 * audience; unsupported for a managed identity, a Microsoft application, or an
 * application another organization owns or any organization can sign in to; unknown
 * for everything else, no evidence included.
 */
export function workloadIdentitySupport(identity: SyncIdentityEvidence | null, tenantId: string | null): WorkloadIdentitySupport {
  if (identity === null) return { support: 'unknown' }
  const type = lower(identity.servicePrincipalType)
  if (type === 'managedidentity') return { support: 'unsupported', because: 'managedIdentity' }
  const owner = lower(identity.appOwnerOrganizationId)
  if (owner !== null && MICROSOFT_ORGANIZATIONS.has(owner)) return { support: 'unsupported', because: 'microsoftApplication' }
  const audience = lower(identity.signInAudience)
  const tenant = lower(tenantId)
  if ((audience !== null && audience !== 'azureadmyorg') || (owner !== null && tenant !== null && owner !== tenant)) return { support: 'unsupported', because: 'multitenantApplication' }
  if (type === 'application' && audience === 'azureadmyorg' && owner !== null && owner === tenant) return { support: 'supported' }
  return { support: 'unknown' }
}

/**
 * This scan's reading of the sync workflow's calling identity. The scan reads no
 * such identity, so it is unknown on every tenant, whatever roles or licences it
 * holds: the one place the workload step's hold and its words come from.
 */
export function syncIdentitySupportOf(snapshot: Pick<TenantSnapshot, 'config'>): WorkloadIdentitySupport {
  const tenantId = (snapshot.config.organization?.rows?.[0] as { id?: unknown } | undefined)?.id
  return workloadIdentitySupport(null, typeof tenantId === 'string' ? tenantId : null)
}
