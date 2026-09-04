// ICS export (roadmap-v2.md §8): one calendar entry per scheduled step, from
// its first ring to its last, and one per Cleanup row on its day (E4). Pure; the
// file is built in the browser.
import { unavailableReason } from './operations.ts'
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
    const start = s.rings[0]?.plannedStart ?? s.events?.enforce.at ?? null
    const end = s.rings.at(-1)?.plannedEnd ?? start
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
