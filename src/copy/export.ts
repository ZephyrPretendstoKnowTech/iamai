// The Export surface (prompt 49 Part 2, target-state §7): six cards, each a
// title, one line, one button. The exporters themselves are unchanged; this is
// only the surface copy, matched to the contract's exact button strings.
export const EXPORT = {
  title: 'Export',
  pdf: { title: 'Print or save as PDF', line: 'The whole plan as a document: cover, waves, every step. Save as PDF from the print dialog.', button: 'Print or save as PDF' },
  calendar: { title: 'Calendar', line: 'Every scheduled step as a calendar entry, with its portal path, done-when and rollback.', button: 'Download calendar (ICS)' },
  planFile: {
    title: 'Plan file',
    line: 'Everything, to load back on any machine: steps, evidence, the recorded facts and checkpoints.',
    save: 'Save plan file',
    load: 'Load a plan file',
  },
  csv: { title: 'CSV', line: 'Today and each inventory table as a spreadsheet.', today: 'Today as CSV', tab: (label: string) => `${label} as CSV` },
  prompts: {
    title: 'Prompts for your own assistant',
    line: 'One file of prompts, grounded in this plan, for your own assistant.',
    download: 'Download every prompt',
    see: 'See the prompts',
    copy: 'Copy prompt',
  },
  grounding: {
    title: 'Grounding bundle',
    line: 'The scan and plan as JSON, to feed another tool.',
    download: 'Download the bundle',
    warning: 'Unredacted, this carries names and sign-in addresses. Keep it where only the right people can reach it.',
    redactedLabel: 'Include names and addresses (unredacted)',
  },
  loadError: 'That file could not be read as a plan.',
} as const
