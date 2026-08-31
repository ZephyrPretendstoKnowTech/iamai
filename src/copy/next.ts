// "Do this next" and the automatic log (prompt 30): the front door for one
// person with two hours, and a history nobody has to write.
import { count } from './statements.ts'

export const NEXT = {
  title: 'Do this next',
  open: 'Open the step',
  why: {
    blocker: (held: number): string =>
      held === 0
        ? 'Must fix before the rest of the plan is safe to run.'
        : `Must fix first: ${held === 1 ? '1 step that can deny access is' : `${held} steps that can deny access are`} held until it passes.`,
    prerequisite: (waiting: number) => `nothing blocks it, and ${count(waiting, 'later step')} wait${waiting === 1 ? 's' : ''} for it`,
    safeToday: 'nothing blocks it and nobody is affected',
    readiness: (people: number, unblocks: number) => `setting up ${count(people, 'person', 'people')} unblocks ${count(unblocks, 'step')}`,
    ready: 'the best value for the least disruption among what is ready',
  },
  touches: {
    nobody: 'nobody',
    people: (n: number) => `${count(n, 'person', 'people')}`,
    named: (names: string) => names,
  },
  nothingUntil: (date: string, why: string) => `Nothing to do until ${date}, when ${why}.`,
  nothing: 'Nothing to do right now: every step is waiting on evidence or a date.',
  completed: (title: string) => `${title} is now enforced.`,
  completedMany: (n: number) => `${count(n, 'step')} are now enforced.`,
  next: 'Next:',
  observationEnds: 'the observation window ends',
  noticeEnds: 'the notice period ends',
  campaignEnds: 'the registration campaign ends',
  soakEnds: 'the current ring finishes its soak',
}

export const LOG = {
  title: 'History',
  hint: 'Everything the scans noticed, newest first. Nothing here is typed in; nothing can be edited.',
  filterAll: 'Everything the scan noticed',
  filterMine: 'Changes the plan made',
  empty: 'Nothing recorded yet: the first scan after the first change fills this in.',
  exportCsv: 'Download as CSV',
  exportMd: 'Download as Markdown',
  planned: 'planned',
  unplanned: 'unplanned',
  detected: { tag: 'plan tag', fingerprint: 'matched by what it does', scan: 'scan', checkpoint: 'compared with the last checkpoint' },
  rolledUp: (n: number, from: string, to: string) => `${count(n, 'older entry', 'older entries')} from ${from} to ${to}, rolled up.`,
  entry: {
    scan: (users: number, policies: number) => `Scan run: ${count(users, 'user')}, ${count(policies, 'policy', 'policies')}`,
    created: (name: string) => `Policy created: ${name}`,
    reportOnly: (name: string) => `Policy moved to report-only: ${name}`,
    enforced: (name: string) => `Policy enforced: ${name}`,
    modified: (name: string) => `Policy modified: ${name}`,
    disabled: (name: string) => `Policy disabled: ${name}`,
    deleted: (name: string) => `Policy deleted: ${name}`,
    objectCreated: (title: string) => `Created: ${title}`,
    readinessMethod: (n: number) => `${count(n, 'person', 'people')} gained an MFA method`,
    readinessDevices: (percent: number) => `Device coverage reached ${percent}%`,
    drill: (name: string, at: string) => `Break-glass drill observed: ${name} signed in on ${at}`,
    baseline: (commit: string) => `Baseline updated to ${commit}`,
    stepDone: (title: string) => `${title}: enforced`,
    stepReportOnly: (title: string) => `${title}: in report-only`,
    stepReopened: (title: string, note: string) => `${title}: reopened (${note})`,
  },
  columns: { when: 'When', what: 'What', step: 'Step', detected: 'Detected by', planned: 'Planned' },
}
