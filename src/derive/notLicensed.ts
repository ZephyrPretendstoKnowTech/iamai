// The Not licensed footer group (target-state §5; prompt 52 Part 3): one row per
// goal the baseline holds that this tenant cannot hold, from the content file —
// the step's title and the licence it needs — plus the one sentence under the
// group and the count the print page carries. The licence ladder: the goals a
// tenant's tier puts out of reach are listed here, never in the plan, and
// nothing in the plan waits on them. The Plan lists the steps under the licence
// each needs (notLicensedLines); the print line says a finished plan is the
// baseline only as far as the licences reach.
//
// Pure: no DOM, no network.
import { pages, stepById } from '../content/content.ts'
import { CONTENT_ALIAS } from '../content/stepTitle.ts'
import { fillText } from '../content/render.ts'
import { goalInMap } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import type { CoverageReport } from '../coverage/types.ts'
import { CATALOGUE, tierName } from '../coverage/coverage.ts'
import { DEVICE_GOALS } from '../roadmap/deviations.ts'
import { count, list } from '../copy/statements.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from '../roadmap/types.ts'
import { activePeopleIds, impactReachOf } from './population.ts'
import { affectedIds } from './whoLine.ts'

/** One line of the group. `goalIds` are the baseline goals it names: one, or each device goal on the shared device line. */
export type NotLicensedRow = { goalId: string; goalIds: string[]; title: string; licence: string }

type FooterCopy = { notLicensed: string; notLicensedGroup: string; notLicensedNote: string; notLicensedDevices: string; partialSeats: string }
const footer = (): FooterCopy => (pages.plan as { footer: FooterCopy }).footer

/**
 * The rows: goals the baseline holds whose control needs a licence the tenant
 * does not hold. The title is the content step's; the licence is the content
 * step's where it names one, else the tier the catalogue implementation needs.
 */
export function notLicensedRows(coverage: CoverageReport, goalMap: GoalMap): NotLicensedRow[] {
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
    out.push({ goalId: r.goal.id, goalIds: [r.goal.id], title, licence })
  }
  // No Intune licence (E2): the compliant-device, app-protection and
  // Intune-enrolment steps are one shared line, never three, and nothing asks
  // how devices are managed (the device decision is not generated).
  const devices = out.filter((r) => DEVICE_GOALS.has(r.goalId))
  if (devices.length >= 2) {
    const steps = list(devices.map((r) => r.title))
    const first = out.indexOf(devices[0])
    const rest = out.filter((r) => !DEVICE_GOALS.has(r.goalId))
    rest.splice(first, 0, { goalId: 'devices', goalIds: devices.map((r) => r.goalId), title: steps, licence: devices[0].licence })
    return rest
  }
  return out
}

/** One line of the Plan's group: a licence and the steps it would bring, or the shared device line on its own. */
export type NotLicensedLine = { key: string; text: string; steps: string[] }

/**
 * The Plan footer's lines (owner, 2026-10-04): the rows under the licence each
 * needs, one line per licence in the order the rows first name it, so a tenant
 * without P2 reads P2 once and not once per step. The shared device line keeps
 * its own words. The rows themselves, and every count, are unchanged.
 */
export function notLicensedLines(rows: readonly NotLicensedRow[]): NotLicensedLine[] {
  const P = footer()
  const out: NotLicensedLine[] = []
  for (const r of rows) {
    if (r.goalId === 'devices') { out.push({ key: r.goalId, text: fillText(P.notLicensedDevices, { steps: r.title }), steps: [] }); continue }
    const line = out.find((l) => l.key === `licence:${r.licence}`)
    if (line) line.steps.push(r.title)
    else out.push({ key: `licence:${r.licence}`, text: fillText(P.notLicensedGroup, { licence: r.licence }), steps: [r.title] })
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

/**
 * The one sentence under the group (owner, 2026-10-04): nothing waits on it. The
 * group's heading, and In the baseline, not in this plan beside it, already say
 * the plan stops at the licences; the print page keeps its longer line (N-008).
 */
export function notLicensedNote(): string {
  return footer().notLicensedNote
}

/** The print page's count and sentence (pages.export.printPage1.notLicensed). */
export function notLicensedPrintLine(rows: readonly NotLicensedRow[], others = 0): string {
  const page = (pages.export as { printPage1: { notLicensed: string; notLicensedOthers: string } }).printPage1
  return others > 0 ? fillText(page.notLicensedOthers, { n: notLicensedCount(rows), others }) : fillText(page.notLicensed, { n: notLicensedCount(rows) })
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

/**
 * Partial seats (v1.1 T1-4): a step whose goal needs Entra ID P2 — the risk
 * policies, the user-risk step's EAM companion with it — is planned for
 * everyone it covers, and Microsoft licenses risk-based Conditional Access per
 * user. Where the tenant's P2 seats (snapshot.capabilities.entraP2, the scan's
 * one licence reading: every SKU whose service plans carry P2) are fewer than
 * the tenant's active people, the step says how many seats against how many
 * people, and that the people without one are not covered by the licence.
 *
 * The people are the tenant's active people (derive/population.ts
 * activePeopleIds), guests aside: a guest is licensed by monthly active users,
 * not by a seat. Not the step's own population: an open policy's words never
 * move with who its population names (foundationA.test.ts). Null wherever the seats cover them, the tenant
 * holds no P2 at all (the goal is then Not licensed, never in the plan), or the
 * goal needs no P2. Words only: which steps the plan holds does not change.
 */
export function partialSeatsLine(step: Step, snapshot: TenantSnapshot): string | null {
  const goal = CATALOGUE.find((g) => g.id === step.goalId)
  if (!goal || !goal.implementations.some((i) => i.tier === 'p2')) return null
  // A policy on AI agent identities covers no person (Jon's HighRiskAgent block):
  // people's seats say nothing about it.
  if (goal.implementations.every((i) => i.expectedWho.kind === 'agents')) return null
  const p2 = snapshot.capabilities?.entraP2
  if (!p2?.enabled) return null
  const guests = new Set(snapshot.users.filter((u) => /^guest$/i.test(u.userType ?? '')).map((u) => u.id))
  // The tenant's active people, not the step's own population: the risk policies cover
  // everyone, and an open policy's words never move with who its population names
  // (foundationA.test.ts). Guests are licensed by monthly active users, not seats.
  const people = activePeopleIds(snapshot, snapshot.asOf).filter((id) => !guests.has(id)).length
  if (p2.seats >= people) return null
  return fillText(footer().partialSeats, {
    licence: tierName('p2'),
    seats: count(p2.seats, 'seat'),
    people: count(people, 'person', 'people'),
    gap: count(people - p2.seats, 'person', 'people'),
  })
}
