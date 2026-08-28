// Policy-count awareness (roadmap-v2.md §2): how many Conditional Access
// policies exist, how many the plan adds, and consolidation candidates from
// the housekeeping report when the total is high. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { OrganisationReport } from '../coverage/types.ts'
import { POLICY_COUNT } from '../copy/schedule.ts'
import type { PolicyCount } from './schedule.ts'
import type { Step } from './types.ts'

/** Entra's limit on Conditional Access policies per tenant. */
export const POLICY_CAP = 195
/** Above this many policies the plan names what to consolidate. */
export const POLICY_HIGH = 40
/** Within this many of the cap the warning names the cap itself. */
export const NEAR_CAP = 45
const STALE_REPORT_ONLY_DAYS = 30
const MAX_CANDIDATES = 8

type PolicyRow = { id?: string; displayName?: string; state?: string; modifiedDateTime?: string; createdDateTime?: string }

export function policyCountFor(snapshot: TenantSnapshot, steps: Step[], organisation: OrganisationReport): PolicyCount {
  const rows = (snapshot.config.caPolicies?.rows ?? []) as PolicyRow[]
  const existing = rows.length
  const added = steps.filter((s) => s.kind === 'create' && s.status !== 'done' && s.status !== 'skipped' && s.action.json !== null).length
  const after = existing + added
  const consolidation: string[] = []
  for (const c of organisation.consolidation) consolidation.push(POLICY_COUNT.duplicate(c.goalName, c.policyNames))
  for (const p of rows) {
    if (consolidation.length >= MAX_CANDIDATES) break
    const name = String(p.displayName ?? '').trim()
    if (!name) continue
    if (p.state === 'disabled') consolidation.push(POLICY_COUNT.disabledPolicy(name))
    else if (p.state === 'enabledForReportingButNotEnforced') {
      const since = p.modifiedDateTime ?? p.createdDateTime
      const days = since ? Math.floor((Date.parse(snapshot.asOf) - Date.parse(since)) / 86_400_000) : 0
      if (days >= STALE_REPORT_ONLY_DAYS) consolidation.push(POLICY_COUNT.reportOnlyStale(name, days))
    }
  }
  const warning = after >= POLICY_CAP - NEAR_CAP ? POLICY_COUNT.nearCap(after, POLICY_CAP) : after > POLICY_HIGH ? POLICY_COUNT.high(after) : null
  return {
    existing,
    added,
    cap: POLICY_CAP,
    statement: POLICY_COUNT.statement(existing, added, after, POLICY_CAP),
    warning,
    consolidation: warning ? consolidation.slice(0, MAX_CANDIDATES) : [],
  }
}
