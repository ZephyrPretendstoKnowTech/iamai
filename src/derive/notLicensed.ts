// The Not licensed footer group (target-state §5; prompt 52 Part 3): one row per
// goal the baseline holds that this tenant cannot hold, from the content file —
// the step's title and the licence it needs — plus the one sentence under the
// group and the count the print page carries. The licence ladder: the goals a
// tenant's tier puts out of reach are listed here, never in the plan, and
// nothing in the plan waits on them; both sentences say a finished plan is the
// baseline only as far as the licences reach.
//
// Pure: no DOM, no network.
import { pages, stepById } from '../content/content.ts'
import { CONTENT_ALIAS } from '../content/stepTitle.ts'
import { fillText } from '../content/render.ts'
import { goalInMap } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import type { CoverageReport } from '../coverage/types.ts'
import { tierName } from '../coverage/coverage.ts'
import { DEVICE_GOALS } from '../roadmap/deviations.ts'
import { list } from '../copy/statements.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** One line of the group. `goalIds` are the baseline goals it names: one, or each device goal on the shared device line. */
export type NotLicensedRow = { goalId: string; goalIds: string[]; title: string; licence: string; text: string }

type FooterCopy = { notLicensed: string; notLicensedRow: string; notLicensedNote: string; notLicensedDevices: string }
const footer = (): FooterCopy => (pages.plan as { footer: FooterCopy }).footer

/**
 * The rows: goals the baseline holds whose control needs a licence the tenant
 * does not hold. The title is the content step's; the licence is the content
 * step's where it names one, else the tier the catalogue implementation needs.
 */
export function notLicensedRows(coverage: CoverageReport, goalMap: GoalMap): NotLicensedRow[] {
  const P = footer()
  const out: NotLicensedRow[] = []
  for (const r of coverage.results) {
    if (!goalInMap(goalMap, r.goal.id)) continue
    // A goal a licence facet switched off (no Intune licence, no Workload
    // Identities Premium licence) is a licence row too: the licence is the one
    // the facet's own reason names.
    const facetLicence = r.status === 'not-applicable' && r.applicability && / licence$/.test(r.applicability.reason) ? r.applicability.reason.replace(/^no /, '').replace(/ licence$/, '') : null
    if (r.status !== 'licence-limited' && facetLicence === null) continue
    const cs = stepById[r.goal.id] ?? stepById[CONTENT_ALIAS[r.goal.id]]
    const title = cs?.title ?? r.goal.name
    const licence = cs?.licence ?? facetLicence ?? tierName(r.goal.implementations[0]?.tier ?? '')
    out.push({ goalId: r.goal.id, goalIds: [r.goal.id], title, licence, text: fillText(P.notLicensedRow, { stepTitle: title, licence }) })
  }
  // No Intune licence (E2): the compliant-device, app-protection and
  // Intune-enrolment steps are one shared line, never three, and nothing asks
  // how devices are managed (the device decision is not generated).
  const devices = out.filter((r) => DEVICE_GOALS.has(r.goalId))
  if (devices.length >= 2) {
    const steps = list(devices.map((r) => r.title))
    const first = out.indexOf(devices[0])
    const rest = out.filter((r) => !DEVICE_GOALS.has(r.goalId))
    rest.splice(first, 0, { goalId: 'devices', goalIds: devices.map((r) => r.goalId), title: steps, licence: devices[0].licence, text: fillText(P.notLicensedDevices, { steps }) })
    return rest
  }
  return out
}

/**
 * How many baseline controls the tenant's licences leave out: goals, not lines.
 * The shared device line names two or three goals, and counting lines said
 * "Not licensed (6)" over seven (v2-research/licensing.md). The one count the
 * group's heading and the print page both read.
 */
export function notLicensedCount(rows: readonly NotLicensedRow[]): number {
  return rows.reduce((n, r) => n + r.goalIds.length, 0)
}

/** "Not licensed (n)" — the collapsed group's one line. */
export function notLicensedSummary(rows: readonly NotLicensedRow[]): string {
  return fillText(footer().notLicensed, { n: notLicensedCount(rows) })
}

/** The one sentence under the group. */
export function notLicensedNote(): string {
  return footer().notLicensedNote
}

/** The print page's count and sentence (pages.export.printPage1.notLicensed). */
export function notLicensedPrintLine(rows: readonly NotLicensedRow[]): string {
  const line = (pages.export as { printPage1: { notLicensed: string } }).printPage1.notLicensed
  return fillText(line, { n: notLicensedCount(rows) })
}

/**
 * The Plan's first sentence for a tenant without Entra ID P1 (owner decision,
 * 2026-09-19): Conditional Access needs P1, so no policy can exist and the plan
 * is the free-tier ladder. Null for a tenant that holds P1.
 */
export function conditionalAccessLicenceLine(snapshot: Pick<TenantSnapshot, 'capabilities'>): string | null {
  if (snapshot.capabilities.entraP1.enabled) return null
  return (pages.plan as { conditionalAccessNeedsP1: string }).conditionalAccessNeedsP1
}
