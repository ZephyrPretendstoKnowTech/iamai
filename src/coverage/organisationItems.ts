// The organisation report as items a person can act on
// (naming-and-consolidation.md §3, prompt 43 Part 3).
//
// This is the second-priority report the tool has always promised: how the
// tenant is organised, never mixed into security findings and never touching the
// coverage score. It cannot touch it structurally — the score is goalCounts()
// over report.results, and nothing here produces a GoalResult.
//
// Every item carries the same three parts as a security step: what it is, why it
// matters in THIS tenant, and the exact change. An item with no exact change is
// an observation, and observations belong somewhere else.
//
// Pure: no DOM, no network.
import { proposeName } from '../roadmap/convention.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { OrganisationReport } from './types.ts'

/** Report-only for longer than this is forgotten, not observed. */
export const STALE_REPORT_ONLY_DAYS = 30

export type OrganisationItem = {
  kind: 'consolidate' | 'rename' | 'unprefixed' | 'groupName' | 'staleReportOnly' | 'disabled'
  /** Stable enough to key a list on. */
  id: string
  what: string
  why: string
  change: string
  /** Policy or group names this is about, for the reader to find them. */
  names: string[]
}

type PolicyRow = { id?: string; displayName?: string; state?: string; modifiedDateTime?: string; createdDateTime?: string }

/**
 * Group names that do not say what the group is for. A group referenced by a
 * policy is part of the policy's meaning, and "Group1" tells the next person
 * nothing about why those people are outside a control.
 */
// A placeholder word, optionally with a number after it: Group1, temp, Test 2.
// A word boundary alone did not work, because \b does not fire between "Group"
// and "1" — both are word characters.
const OPAQUE_GROUP = /^(group|grp|test|temp|tmp|new|copy|untitled)[\s\d_-]*$|^[a-z]{1,3}[-_ ]?\d+$|^\W*$/i

export function organisationItems(
  organisation: OrganisationReport,
  snapshot: TenantSnapshot,
  referencedGroupNames: string[] = [],
): OrganisationItem[] {
  const out: OrganisationItem[] = []
  const rows = (snapshot.config.caPolicies?.rows ?? []) as PolicyRow[]
  const naming = organisation.naming
  const convention = naming.convention

  // 1. Policies that do one goal between them.
  for (const c of organisation.consolidation) {
    out.push({
      kind: 'consolidate',
      id: `consolidate-${c.goalId}`,
      what: `${c.policyNames.length} policies deliver ${c.goalName} between them.`,
      why: 'Two policies with the same population and the same controls are two places to make the next mistake, and a reader has to open both to learn they do one thing.',
      change: 'Create one consolidated policy in report-only alongside them, observe it, compare who it catches, enforce it, then disable the old ones one at a time. The step sets out all six stages.',
      names: c.policyNames,
    })
  }

  // 2. Names that do not match the tenant's own convention.
  if (naming.outliers.length > 0 && convention) {
    out.push({
      kind: 'rename',
      id: 'rename-outliers',
      what: `${naming.outliers.length === 1 ? 'One policy name does' : `${naming.outliers.length} policy names do`} not follow the convention the rest of this tenant uses.`,
      why: `${Math.round(naming.share * 100)}% of the names here follow one shape. A name that does not sorts somewhere else in a list of forty, and reads as someone else's.`,
      change: `Rename ${naming.outliers.length === 1 ? 'it' : 'them'} to match. Renaming a policy changes no evaluation: nobody is affected and nothing needs a report-only window.`,
      names: naming.outliers,
    })
  }

  // 3. Policies with no prefix at all.
  if (naming.unprefixed.length > 0) {
    out.push({
      kind: 'unprefixed',
      id: 'unprefixed',
      what: `${naming.unprefixed.length === 1 ? 'One policy carries' : `${naming.unprefixed.length} policies carry`} no prefix at all.`,
      why: 'A prefix is what makes a list of forty policies scannable, and what tells a stranger which ones are yours rather than Microsoft’s.',
      change: convention
        ? `Rename with the prefix this tenant already uses: ${proposeName(convention, naming.names, { prefix: 'CA', rest: ['Scope', 'Action', 'Target'], collapsed: 'what it does' }).name}.`
        : 'Pick a prefix and hold to it. The naming page sets out a pattern that works.',
      names: naming.unprefixed,
    })
  }

  // 4. Groups referenced by policies whose names do not say what they are for.
  const opaque = referencedGroupNames.filter((n) => OPAQUE_GROUP.test(n.trim()))
  if (opaque.length > 0) {
    out.push({
      kind: 'groupName',
      id: 'group-names',
      what: `${opaque.length === 1 ? 'One group' : `${opaque.length} groups`} referenced by a policy ${opaque.length === 1 ? 'has a name that does' : 'have names that do'} not say what it is for.`,
      why: 'A group referenced by a policy is part of that policy’s meaning. An exclusion group especially: anyone reading its name should be able to tell that its members sit outside the control.',
      change: 'Rename to say the purpose and the scope, so the risk is obvious from the name. Renaming a group changes no evaluation.',
      names: opaque,
    })
  }

  // 5. Report-only policies older than 30 days, and 6. disabled policies.
  const stale: string[] = []
  const disabled: string[] = []
  for (const p of rows) {
    const name = String(p.displayName ?? '').trim()
    if (!name) continue
    if (p.state === 'disabled') disabled.push(name)
    else if (p.state === 'enabledForReportingButNotEnforced') {
      const since = p.modifiedDateTime ?? p.createdDateTime
      const days = since ? Math.floor((Date.parse(snapshot.asOf) - Date.parse(since)) / 86_400_000) : 0
      if (days >= STALE_REPORT_ONLY_DAYS) stale.push(name)
    }
  }
  if (stale.length > 0) {
    out.push({
      kind: 'staleReportOnly',
      id: 'stale-report-only',
      what: `${stale.length === 1 ? 'One policy has' : `${stale.length} policies have`} sat in report-only for more than ${STALE_REPORT_ONLY_DAYS} days.`,
      why: 'A policy left in report-only that long is usually forgotten rather than observed. It protects nobody and it makes the list longer.',
      change: 'Read its report-only results, then enforce it or remove it. The readiness verdict on the matching step says which.',
      names: stale,
    })
  }
  if (disabled.length > 0) {
    out.push({
      kind: 'disabled',
      id: 'disabled',
      what: `${disabled.length === 1 ? 'One policy is' : `${disabled.length} policies are`} disabled.`,
      why: 'A disabled policy is usually abandoned. It does nothing, and the next person has to work out whether it was turned off on purpose.',
      change: 'Fold it into a live policy or delete it. IAMAI never proposes deleting a policy on your behalf; this one is your call.',
      names: disabled,
    })
  }

  return out
}
