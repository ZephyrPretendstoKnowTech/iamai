// Connect's one status block, never two. In priority: Role missing (the token
// lacks the core roles: the warning naming the account, the sections and the
// ask, with Sign in with another account, and nothing else below the baseline
// block), Scan finished with gaps (the section rows with their roles, Open the
// last full plan (date) when a full plan exists, Scan tenant; no Scan complete
// line), Scan complete (the line, Open the plan, Scan tenant). A gapped scan's
// summary is discarded, never stored, so it cannot render beside a later state.
// Pure, so each state renders in a test; Connect.tsx draws from it.
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { list, lowerFirst } from '../../copy/statements.ts'
import { READ_EVERYTHING_ROLE } from '../../graph/collect/roles.ts'
import type { CoreGap } from '../../graph/collect/coreSections.ts'
import type { RoleGap } from '../../graph/collect/tokenRoles.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { scanLineVars } from './scanLine.ts'

export type ConnectStatus =
  | { kind: 'roleMissing'; text: string; signInAnother: string }
  | { kind: 'gaps'; line: string; rows: string[]; openLastFull: string | null; scan: string }
  | { kind: 'complete'; line: string; open: string; scan: string }
  | { kind: 'none'; scan: string; note: string }

const C = app.connect
const SCAN = app.scan
const T = pages.tenant as { scanLine: string; open: string }
const CN = pages.connectNoScan as { scanButton: string; scanNote: string }

const sectionLabel = (source: string): string => SCAN.sections[source] ?? source
/** A section label mid-sentence: "Conditional Access policies" keeps its capitals, "People" becomes "people". */
const midSentence = (label: string): string => (/^[A-Z][a-z]+ [A-Z]/.test(label) ? label : lowerFirst(label))

export function connectStatus(input: { roleGap: RoleGap | null; gaps: CoreGap[]; lastScan: { snapshot: TenantSnapshot; at: string } | null; upn: string }): ConnectStatus {
  const { roleGap, gaps, lastScan, upn } = input
  if (roleGap) {
    return {
      kind: 'roleMissing',
      text: fillText(C.roleGap, {
        upn,
        sections: list(roleGap.sources.map((s) => midSentence(sectionLabel(s)))),
        roles: list(roleGap.ask.length > 0 ? roleGap.ask : [roleGap.covering]),
        covering: roleGap.covering,
      }),
      signInAnother: C.signInAnother,
    }
  }
  if (gaps.length > 0) {
    return {
      kind: 'gaps',
      line: fillText(C.gapsLine, { covering: READ_EVERYTHING_ROLE }),
      rows: gaps.map((g) => fillText(C.gapsRow, { section: sectionLabel(g.source), reason: (g.reason ?? C.gapsNotRead).replace(/\.$/, ''), roles: list(g.roles.length > 0 ? g.roles : [READ_EVERYTHING_ROLE]) })),
      openLastFull: lastScan ? fillText(C.openLastFull, { date: absoluteDate(lastScan.at) }) : null,
      scan: CN.scanButton,
    }
  }
  if (lastScan) return { kind: 'complete', line: fillText(T.scanLine, scanLineVars(lastScan.snapshot)), open: T.open, scan: CN.scanButton }
  return { kind: 'none', scan: CN.scanButton, note: CN.scanNote }
}

/** Every string the block renders, in order. */
export function statusStrings(s: ConnectStatus): string[] {
  switch (s.kind) {
    case 'roleMissing':
      return [s.text, s.signInAnother]
    case 'gaps':
      return [s.line, ...s.rows, ...(s.openLastFull ? [s.openLastFull] : []), s.scan]
    case 'complete':
      return [s.line, s.open, s.scan]
    case 'none':
      return [s.scan, s.note]
  }
}
