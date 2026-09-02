// ICS export (roadmap-v2.md §8): one calendar entry per scheduled step, from
// its first ring to its last. Pure; the file is built in the browser.
import type { Step, StepView } from './types.ts'

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

export function buildIcs(steps: Step[], tenantName: string, planId: string, view: StepView): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IAMAI//Conditional Access rollout plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(`${tenantName} Conditional Access rollout`)}`]
  for (const s of steps) {
    if (s.status === 'done' || s.status === 'skipped') continue
    const start = s.rings[0]?.plannedStart ?? null
    const end = s.rings.at(-1)?.plannedEnd ?? start
    if (!start || !end) continue
    const endExclusive = new Date(Date.parse(end) + 86_400_000).toISOString()
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${planId}-${s.id}@iamai`)
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`)
    lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`)
    lines.push(`DTEND;VALUE=DATE:${icsDate(endExclusive)}`)
    const v = view(s)
    lines.push(fold(`SUMMARY:${escape(v.title)}`))
    // The calendar entry is the runbook: what the step says on screen, its why,
    // its dates, its portal path, its done-when lines and what to do if it goes
    // wrong (prompt 53 queue item 7).
    const description = [v.why, v.dates ?? '', v.whatToDo.length > 0 ? `What to do: ${v.whatToDo.join(' | ')}` : '', v.doneWhen.length > 0 ? `Done when: ${v.doneWhen.join(' | ')}` : '', v.ifWrong ?? ''].filter(Boolean).join('\n')
    lines.push(fold(`DESCRIPTION:${escape(description)}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
