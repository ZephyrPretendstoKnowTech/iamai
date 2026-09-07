// ICS export (roadmap-v2.md §8): one calendar entry per scheduled step, from
// its first ring to its last, and one per Cleanup row on its day (E4). Pure; the
// file is built in the browser.
import { awaitingDeployment, enforcementUnearned } from './forecast.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { unavailableReason } from './operations.ts'
import { heldForReview } from './lifecycle.ts'
import type { CleanupExport, Step, StepView } from './types.ts'

function icsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold lines at 75 octets as RFC 5545 asks. */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 73) {
    out.push(rest.slice(0, 73))
    rest = ' ' + rest.slice(73)
  }
  out.push(rest)
  return out.join('\r\n')
}

export function buildIcs(steps: Step[], tenantName: string, planId: string, view: StepView, cleanup: CleanupExport[] = []): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IAMAI//Conditional Access rollout plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(`${tenantName} Conditional Access rollout`)}`]
  const stamp = (): string => `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  const describe = (why: string, dates: string | null, whatToDo: string[], doneWhen: string[], ifWrong: string | null): string =>
    [why, dates ?? '', whatToDo.length > 0 ? `What to do: ${whatToDo.join(' | ')}` : '', doneWhen.length > 0 ? `Done when: ${doneWhen.join(' | ')}` : '', ifWrong ?? ''].filter(Boolean).join('\n')
  for (const s of steps) {
    if (s.status === 'done' || s.status === 'skipped') continue
    // A policy the plan cannot write has no entry, whatever dates a step loaded
    // from an older plan file still carries (roadmap/operations.ts).
    if (unavailableReason(s) !== null) continue
    // A change to an existing policy has no ring: its enforcement instant is its day.
    const planned = s.rings[0]?.plannedStart ?? s.events?.enforce.at ?? null
    // A policy that is not deployed has one day in the calendar and it is not an
    // enforcement: the day it is created in report-only (roadmap/forecast.ts,
    // over Foundation B). Its rings are the roadmap's forecast of an enforcement
    // no window has been watched for, so booking the entry on them puts a
    // projection in a person's calendar as a commitment. The rings are the entry
    // again once a scan finds the policy in report-only. Which steps the
    // calendar carries does not change; the day one of them sits on does.
    const deploying = awaitingDeployment(s)
    // A policy already in report-only with nothing left to submit but its
    // enforcement has one day too, and it is not an enforcement either: the day
    // its observation is reviewed, from Foundation B's own two gates
    // (derive/readyWhen.ts, roadmap/forecast.ts). Booking the rings would put the
    // enforcement wave of a window that has not closed — and whose evidence has
    // not been collected — in a person's calendar as the day the change lands.
    const reviewing = !deploying && enforcementUnearned(s) ? readyWhen(s) : null
    // A policy held for review is due a look now, not on the day its window
    // would have closed: that window was counted on a policy that is not the one
    // deployed today, and booking the entry on it would tell a person there is
    // nothing to do until then. Its day is the day IAMAI saw the change
    // (Foundation B, roadmap/lifecycle.ts heldForReview).
    const held = heldForReview(s) ? (s.state.observation?.latest.firstSeenAt ?? null) : null
    // A review whose day has already passed is due now, not on the day it was
    // due: the window closed and the records did not clear it, so the entry goes
    // on the scan rather than into last week (derive/readyWhen.ts, kind `since`).
    const review = reviewing === null ? null : reviewing.kind === 'since' ? (s.tracking?.noticedAt ?? reviewing.date) : reviewing.date
    const start = planned === null ? null : held ? held : deploying ? (s.reportOnlyAt ?? null) : review ? review : planned
    const single = deploying || reviewing !== null || held !== null
    const end = start === null ? null : single ? start : (s.rings.at(-1)?.plannedEnd ?? start)
    if (!start || !end) continue
    const endExclusive = new Date(Date.parse(end) + 86_400_000).toISOString()
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-${s.id}@iamai`)
    lines.push(stamp())
    lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(endExclusive)}`)
    const v = view(s)
    lines.push(fold(`SUMMARY:${escape(v.title)}`))
    // The calendar entry is the runbook: what the step says on screen, its why,
    // its dates, its portal path, its done-when lines and what to do if it goes
    // wrong (prompt 53 queue item 7).
    lines.push(fold(`DESCRIPTION:${escape(describe(v.why, v.dates, v.whatToDo, v.doneWhen, v.ifWrong))}`))
    lines.push('END:VEVENT')
  }
  // Cleanup rows are calendar entries on their day (E4); a row marked done is finished, like a done step.
  for (const c of cleanup) {
    if (c.done) continue
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-cleanup-${c.kind}@iamai`)
    lines.push(stamp())
    lines.push(`DTSTART;VALUE=DATE:${icsDate(c.day)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(new Date(Date.parse(c.day) + 86_400_000).toISOString())}`)
    lines.push(fold(`SUMMARY:${escape(c.title)}`))
    lines.push(fold(`DESCRIPTION:${escape(describe(c.why, null, c.whatToDo, c.doneWhen, null))}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
