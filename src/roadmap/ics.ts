// ICS export (roadmap-v2.md §8): one calendar entry per step the plan dates, on
// the step's one scheduling result (roadmap/stepSchedule.ts scheduledEventOf), and
// one per Cleanup row on its day (E4). Pure; the file is built in the browser.
import { app } from '../content/content.ts'
import { planFinish } from '../derive/finish.ts'
import { cleanupArtifactLines, stepArtifactLines } from './artifactLines.ts'
import { scheduledEventOf } from './stepSchedule.ts'
import type { ScheduledTransition } from './stepSchedule.ts'
import type { CleanupExport, Step, StepView } from './types.ts'

/** What a scheduled day is for, in the Plan rail's own words (pages.app.plan.stepContract.railTransition). */
const TRANSITION = (app.plan as unknown as { stepContract: { railTransition: Partial<Record<ScheduledTransition, string>> } }).stepContract.railTransition

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
  for (const s of steps) {
    // The step's one dated event (roadmap/stepSchedule.ts): the day its next
    // milestone is placed on and what that day is for — report-only creation (a
    // readiness-gated create included; its enforcement stays undated), a change, an
    // enforcement, a review, a preparation. A step that is finished, set aside or
    // waiting has none, whatever dates a step loaded from an older plan file still
    // carries, and no export dates a step any other way.
    const event = scheduledEventOf(s)
    if (event === null) continue
    const endExclusive = new Date(Date.parse(event.end) + 86_400_000).toISOString()
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-${s.id}@iamai`)
    lines.push(stamp())
    lines.push(`DTSTART;VALUE=DATE:${icsDate(event.start)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(endExclusive)}`)
    const v = view(s)
    // What the day is for, as the Plan rail says it: its transition's words, or the
    // milestone's own where the rail reads those (preparation, verification, review).
    const action = TRANSITION[event.transition] ?? v.next?.replace(/\.$/, '') ?? null
    lines.push(fold(`SUMMARY:${escape(action ? `${v.title} · ${action}` : v.title)}`))
    // The calendar entry is the runbook: what the step says on screen, in the
    // order the screen states it (roadmap/artifactLines.ts). Where it is, what
    // comes next, who it reaches, its portal path, what is holding it, its
    // dates, its done-when lines and the way back. Nothing here chooses which
    // of those the entry gets: the export view is the one reading and that
    // module only labels it. The entry used to carry four of the eight, so a
    // step booked into a person's calendar read as work for that day with the
    // prerequisite it waits on named nowhere in the file.
    lines.push(fold(`DESCRIPTION:${escape(stepArtifactLines(v).join('\n'))}`))
    lines.push('END:VEVENT')
  }
  // Cleanup rows are calendar entries on their day (E4); a row marked done is finished, like a done step.
  // Cleanup follows the last enforcement, so while work the plan requires is held
  // its days are dated after a rollout that cannot finish, and it books nothing.
  const cleanupUndated = planFinish(steps).held
  for (const c of cleanup) {
    if (c.done || cleanupUndated) continue
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-cleanup-${c.kind}@iamai`)
    lines.push(stamp())
    lines.push(`DTSTART;VALUE=DATE:${icsDate(c.day)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(new Date(Date.parse(c.day) + 86_400_000).toISOString())}`)
    lines.push(fold(`SUMMARY:${escape(c.title)}`))
    lines.push(fold(`DESCRIPTION:${escape(cleanupArtifactLines(c).join('\n'))}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
