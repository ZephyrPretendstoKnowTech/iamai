// Connect (prompt 47 Part 4, target-state §3): one page, four states. Where
// target-state gives the exact line, it is used verbatim.
import { count, lowerFirst } from './statements.ts'
import { PRODUCT } from './product.ts'

export const CONNECT = {
  title: 'Connect a tenant',
  /** One line under the heading, signed out (target-state §3). */
  lede: `${PRODUCT.tagline} Read-only.`,
  /** Three lines, as a list: what is needed, what IAMAI reads, what it never does. */
  need: [
    'Needs a Global Administrator or Global Reader account; Entra ID P1 adds sign-in evidence, and the plan works without it.',
    'IAMAI reads the Conditional Access configuration, the user, device and licence inventory, and 30 days of sign-in records.',
    'Read-only, with nothing sent anywhere on its own: no server, no telemetry.',
  ],
  signIn: 'Sign in with Microsoft',
  permissionsSummary: 'What IAMAI asks for, and how to remove it',
  signInScopes: 'Plus the standard sign-in permissions.',
  removalTitle: 'Removing it',
  how: 'How IAMAI works →',
  sampleData: 'See it with sample data →',
  signedInTo: 'Signed in to',
  as: 'as',
  signOut: 'Sign out',
  // The baseline line and its picker.
  baseline: (source: string, policies: number) => `Baseline: ${source} (${count(policies, 'policy', 'policies')})`,
  baselineLoading: (source: string) => `Baseline: loading ${source}…`,
  baselineNone: 'Baseline: none loaded',
  baselineFailed: (why: string) => `The baseline could not be loaded: ${why}`,
  restoreFailed: 'The baseline saved with the scan could not be restored; choose one again.',
  change: 'change',
  pickerLabel: 'Baseline',
  uploadChoice: 'Upload a package',
  uploadLabel: 'Upload baseline policy files',
  howToMakeOne: 'how to make one →',
  uploadedSource: 'Uploaded package',
  readingFiles: (n: number) => `Reading ${count(n, 'file')}…`,
  // The scan, run from this page.
  scan: 'Scan tenant',
  scanNote: 'About ten minutes. Reads the tenant into this browser; nothing is sent anywhere.',
  stop: 'Stop',
  /** "Reading sign-in records, 3 pages · 1,240 records": the lane in plain words. */
  readingSignIns: (pages: number, rows: number) => `Reading sign-in records, ${count(pages, 'page')} · ${count(rows, 'record')}`,
  waitingSignIns: 'Reading sign-in records, waiting for the first page from Microsoft',
  reading: (labels: string[]) => (labels.length === 0 ? 'Finishing up' : `Reading ${laneWords(labels[0])}${labels.length > 1 ? ` and ${count(labels.length - 1, 'other section')}` : ''}`),
  elapsed: (t: string) => `${t} elapsed`,
  slow: "Microsoft's sign-in record service is slow right now: this can take several minutes on larger tenants.",
  paused: 'The Microsoft session expired. Sign in again to continue; nothing collected so far is lost.',
  signInAgain: 'Sign in again',
  failed: (why: string) => `The scan stopped before it finished: ${why}`,
  complete: (people: number, policies: number, window: string | null) =>
    `Scan complete · ${count(people, 'person', 'people')} · ${count(policies, 'policy', 'policies')} · ${window ? `sign-ins ${window}` : 'no sign-in records'}`,
  openPlan: 'Open the plan →',
  // Developer-only (under ?dev=1): the section list and the diagnostics bundle.
  details: 'Scan details',
  diagnostics: 'Download diagnostics (redacted)',
}

/** A section label mid-sentence: "Conditional Access policies" keeps its capitals, "People" becomes "people". */
export function laneWords(label: string): string {
  return /^[A-Z][a-z]+ [A-Z]/.test(label) ? label : lowerFirst(label)
}
