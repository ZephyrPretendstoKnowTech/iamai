// The Not licensed footer group (target-state §5; prompt 52 Part 3): one row per
// goal the baseline holds that this tenant cannot hold, from the content file —
// the step's title and the licence it needs — plus the one sentence under the
// group and the count the print page carries. The licence ladder: the goals a
// tenant's tier puts out of reach are listed here, never in the plan, and
// nothing in the plan waits on them.
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

export type NotLicensedRow = { goalId: string; title: string; licence: string; text: string }

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
    out.push({ goalId: r.goal.id, title, licence, text: fillText(P.notLicensedRow, { stepTitle: title, licence }) })
  }
  // No Intune licence (E2): the compliant-device, app-protection and
  // Intune-enrolment steps are one shared line, never three, and nothing asks
  // how devices are managed (the device decision is not generated).
  const devices = out.filter((r) => DEVICE_GOALS.has(r.goalId))
  if (devices.length >= 2) {
    const steps = list(devices.map((r) => r.title))
    const first = out.indexOf(devices[0])
    const rest = out.filter((r) => !DEVICE_GOALS.has(r.goalId))
    rest.splice(first, 0, { goalId: 'devices', title: steps, licence: devices[0].licence, text: fillText(P.notLicensedDevices, { steps }) })
    return rest
  }
  return out
}

/** "Not licensed (n)" — the collapsed group's one line. */
export function notLicensedSummary(n: number): string {
  return fillText(footer().notLicensed, { n })
}

/** The one sentence under the group. */
export function notLicensedNote(): string {
  return footer().notLicensedNote
}

/** The print page's count and sentence (pages.export.printPage1.notLicensed). */
export function notLicensedPrintLine(n: number): string {
  const line = (pages.export as { printPage1: { notLicensed: string } }).printPage1.notLicensed
  return fillText(line, { n })
}
