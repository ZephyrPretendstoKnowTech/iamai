// Jon Hope's two AGENT blocks as plan steps (owner, 2026-10-04), in Close the
// Doors Nobody Should Use:
//
//   * Block High-Risk AI Agents (`agents-block-high-risk`, Entra ID P2; agent
//     risk is Preview): created in Report-only through 3.8, then turned on like
//     any block. It reaches agent identities rated high risk, never a person.
//   * Block AI Agents You Have Not Approved (`agents-block-untrusted`, P1):
//     created in Report-only, and IAMAI does not offer the turn-on. Which agents
//     a tenant approves is its own, and IAMAI cannot read its agent identities
//     (that needs a permission IAMAI does not ask for), so the step completes
//     once the policy exists, exact, in Report-only, and its Implementation
//     Tasks keep a "Before you turn it on" reference (ui/surfaces/policyTasks.ts):
//     exclude the approved agents, review the report-only results, turn it on.
//
// Their bodies are Jon's, with the agent targeting his export lost read back in
// (baseline/policyReadings.ts). Conditional Access reads policies from Graph
// v1.0, which returns no agent field; the scan reads them from beta beside it
// (graph/collect/collectors.ts agent fields), and a scan whose beta read failed
// leaves them unread: a step whose own policy is there then neither completes
// nor corrects it (`AGENT_TARGETING_UNREAD`).
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { shared } from '../content/content.ts'

/**
 * Where Microsoft stands the agent risk condition (content shared.agentRiskStage,
 * "Preview"): filled into its portal label, Microsoft's own "Agent risk
 * (Preview)", and into the high-risk agents step's words (ui/surfaces/stepVars.ts
 * `stage`). A variable, so the claim is one value that moves when Microsoft's does.
 */
export const AGENT_RISK_STAGE: string = (shared as unknown as { agentRiskStage: string }).agentRiskStage

export const HIGH_RISK_AGENTS_GOAL = 'agents-block-high-risk'
export const UNTRUSTED_AGENTS_GOAL = 'agents-block-untrusted'
export const AGENT_GOALS: ReadonlySet<string> = new Set([HIGH_RISK_AGENTS_GOAL, UNTRUSTED_AGENTS_GOAL])

/**
 * The goals IAMAI creates in Report-only and never turns on: the untrusted-agents
 * block, whose approvals only the tenant can make. Done once its policy exists,
 * exact, in Report-only (or On, once the operator turned it on themselves).
 */
export const REPORT_ONLY_GOALS: ReadonlySet<string> = new Set([UNTRUSTED_AGENTS_GOAL])

/** Whether the step's policy is created in Report-only and left there for the operator to turn on. */
export const leftInReportOnly = (step: { goalId: string }): boolean => REPORT_ONLY_GOALS.has(step.goalId)

/** The blocker a step carries while this scan did not read its own policy's agent targeting. */
export const AGENT_TARGETING_UNREAD = 'agent-targeting-unread'

/**
 * Whether this scan read the tenant's agent fields: the beta read beside the
 * v1.0 policies succeeded (ConfigSection.agentFields). A scan from before the
 * read existed carries none, and reads as unread.
 */
export function agentFieldsRead(snapshot: Pick<TenantSnapshot, 'config'>): boolean {
  return snapshot.config.caPolicies?.agentFields?.status === 'ok'
}

type Raw = Record<string, unknown>

/**
 * The plan's body with the agents the tenant approved kept excluded: the
 * tenant's own policy's agent excludes and attribute filter
 * (`excludeAgentIdServicePrincipals`, `agentIdServicePrincipalFilter`). They are
 * the approvals the untrusted-agents block is designed around (Microsoft's own
 * shape for it), never a difference to correct away. Unchanged where the tenant
 * policy carries none.
 */
export function withApprovedAgents(body: Raw, tenant: Raw | null | undefined): Raw {
  const ca = (((tenant?.conditions ?? {}) as Raw).clientApplications ?? null) as Raw | null
  const exclude = Array.isArray(ca?.excludeAgentIdServicePrincipals) ? (ca!.excludeAgentIdServicePrincipals as unknown[]) : []
  const filter = ca?.agentIdServicePrincipalFilter ?? null
  if (exclude.length === 0 && filter === null) return body
  const conditions = (body.conditions ?? {}) as Raw
  const own = (conditions.clientApplications ?? {}) as Raw
  return { ...body, conditions: { ...conditions, clientApplications: { ...own, excludeAgentIdServicePrincipals: [...exclude], agentIdServicePrincipalFilter: filter } } }
}

/**
 * Whether a policy body targets agent identities (Graph beta, preview): its
 * agent include is set, or it names agent risk. Such a body is created through
 * the beta endpoint, which alone carries those fields.
 */
export function targetsAgents(body: Raw | null | undefined): boolean {
  const c = (body?.conditions ?? {}) as Raw
  const include = ((c.clientApplications ?? {}) as Raw).includeAgentIdServicePrincipals
  const risk = c.agentIdRiskLevels
  return (Array.isArray(include) && include.length > 0) || (Array.isArray(risk) && risk.length > 0)
}

/** Microsoft Graph's beta Conditional Access policies collection: the only one that carries the agent fields. */
export const BETA_CA_POLICIES = 'https://graph.microsoft.com/beta/identity/conditionalAccess/policies'
