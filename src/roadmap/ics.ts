// ICS export (roadmap-v2.md §8): one calendar entry per step the plan dates, on
// the step's one scheduling result (roadmap/stepSchedule.ts scheduledEventOf), and
// one per Cleanup row on its day (E4). Pure; the file is built in the browser.
import { app } from '../content/content.ts'
import { calendarDay } from '../copy/dates.ts'
import { planFinish } from '../derive/finish.ts'
import { cleanupArtifactLines, stepArtifactLines } from './artifactLines.ts'
import { estimatedDay, scheduledEventOf, shownDay } from './stepSchedule.ts'
import type { ScheduledTransition } from './stepSchedule.ts'
import type { CleanupExport, Step, StepView } from './types.ts'

/** What a scheduled day is for, in the Plan rail's own words (pages.app.plan.stepContract.railTransition). */
const TRANSITION = (app.plan as unknown as { stepContract: { railTransition: Partial<Record<ScheduledTransition, string>> } }).stepContract.railTransition

/** A calendar day ("2026-09-22") as an all-day DATE value. */
function icsDate(day: string): string {
  return day.replace(/-/g, '')
}

/** The calendar day after `day`: an all-day entry's end is exclusive. */
function dayAfter(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

const utf8 = new TextEncoder()

/**
 * Fold lines at 75 octets as RFC 5545 asks. The limit is octets, not
 * characters: a title with " · " or an accented name is longer in UTF-8 than in
 * code units, and a fold counted in code units could exceed the limit or split a
 * multi-byte character across the CRLF. Each line holds at most 73 octets of
 * content (a continuation line's leading space is the 74th), and a character is
 * never split.
 */
export function foldIcsLine(line: string): string {
  const out: string[] = []
  let current = ''
  let octets = 0
  for (const ch of line) {
    const n = utf8.encode(ch).length
    if (octets + n > 73) {
      out.push(current)
      current = ' ' + ch
      octets = 1 + n
    } else {
      current += ch
      octets += n
    }
  }
  out.push(current)
  return out.join('\r\n')
}

const fold = foldIcsLine

export function buildIcs(steps: Step[], tenantName: string, planId: string, view: StepView, cleanup: CleanupExport[] = []): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IAMAI//Conditional Access rollout plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', fold(`X-WR-CALNAME:${escape(`${tenantName} Conditional Access rollout`)}`)]
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
    const v = view(s)
    // A step the board holds books nothing, whatever day the schedule still
    // carries for it (owner decision 2, 2026-09-22): Turn Off Security Defaults
    // was booked for Aug 31, its cutover instructions as the entry, under a row
    // that read "After prerequisites" (R4-21).
    if (v.undated) continue
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-${s.id}@iamai`)
    lines.push(stamp())
    // The days the board, the rail and the Dates line state: the event's
    // instants in the plan's display zone (copy/dates.ts calendarDay), never
    // their UTC dates (Phase 2 export finding 1).
    lines.push(`DTSTART;VALUE=DATE:${icsDate(calendarDay(event.start))}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(dayAfter(calendarDay(event.end)))}`)
    // What the day is for, as the Plan rail says it: its transition's words where
    // the board's row hands that operation over today (the export view's
    // `operation`, read off the board), or the step's lane label otherwise (A1c):
    // the same state the row and the badge show, never a sentence of the
    // artifact's own. The schedule alone knows nothing of the board's
    // prerequisites, so a create the board held Up Next was booked "Create in
    // report-only" beside an entry whose What to do said to finish the steps it
    // waits on first (Phase 2 export finding 0).
    const action = v.operation === event.transition ? TRANSITION[event.transition] ?? v.state : v.state
    // A day that is an estimate is booked as one, in the words the board's row
    // reads it in (stepSchedule.ts shownDay): the calendar booked Protect Sign-in
    // Method Registration's report-only create on Aug 31 as a fixed day under a
    // row reading "Est. Aug 31, 2026" (R4-34).
    const estimate = estimatedDay(s) ? shownDay(event.start, true, 'label') : null
    lines.push(fold(`SUMMARY:${escape([v.title, action, estimate].filter((x): x is string => typeof x === 'string' && x.length > 0).join(' · '))}`))
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
    // The row's day as its When column states it (cleanupExport.ts cleanupWhen reads the date part).
    lines.push(`DTSTART;VALUE=DATE:${icsDate(c.day.slice(0, 10))}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(dayAfter(c.day.slice(0, 10)))}`)
    lines.push(fold(`SUMMARY:${escape(c.title)}`))
    lines.push(fold(`DESCRIPTION:${escape(cleanupArtifactLines(c).join('\n'))}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
