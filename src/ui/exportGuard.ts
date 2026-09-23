// The one way tenant data leaves this app.
//
// Every download, every clipboard write and the print document route through
// here, and redaction is what happens unless the caller says otherwise in as
// many words. Before this, `downloadFile` applied nothing and redaction was
// remembered at each call site: three of fourteen export paths remembered
// (audit redact-06). A rule that has to be remembered fourteen times is not a
// rule, and the paths that forgot were the two the product most encourages —
// the plan file and copy-as-prompt.
//
// The type is the enforcement. `Disposition` has no default and no optional
// field, so adding an export without deciding is a compile error rather than an
// omission nobody notices; and the unredacted branch demands a `surface` naming
// where the warning lives, so an unredacted export cannot be added without
// pointing at the copy that warns about it. `exportGuard.test.ts` then walks the
// source and fails if any new call site reaches a browser export API directly.
import { redactIdentifiers } from '../redact.ts'
import { isDemo } from './demoMode.ts'
import { app } from '../content/content.ts'
import { foldIcsLine } from '../roadmap/ics.ts'
import { requiredModels } from '../roadmap/passkeySettings.ts'
import { AUTHENTICATOR_AAGUIDS, WINDOWS_HELLO_AAGUIDS } from '../scoring/phishingResistant.ts'
import type { MappingState } from '../mapping/types.ts'

/**
 * The surfaces allowed to export without redaction. Each value names a place in
 * the UI that shows the user what the export contains before they can trigger
 * it; adding a value here without adding that warning is the thing the test
 * below is watching for.
 *
 * - `grounding-bundle` — the Export tab's bundle card, whose warning Callout
 *   (`GROUNDING.warning`) renders above the checkbox that clears redaction.
 * - `print-document` — the print layout. Printing exists to put the plan in
 *   front of the person doing the work, and a redacted printout would be
 *   useless for that; the print card states what the document contains.
 * - `plan-file` — the Export tab's plan-file card. The file is the person's own
 *   working state, saved to load back on the same tenant (the loader's tenant
 *   check needs the real id); the card says what it holds and that names are in full.
 * - `implementation-artifact` — Copy on a Plan step's Implementation viewer. The
 *   viewer shows the whole artifact, identifiers and all, before Copy can be
 *   pressed, and Copy copies exactly what it shows: a JSON body, a script or a
 *   portal procedure deploys only with the tenant's own object ids and
 *   Microsoft's own constants in it, so a redacted copy is a different and
 *   invalid artifact. AI Info carries its tenant-context warning above the same
 *   preview (ui/surfaces/ContentStep.tsx `Implementation`).
 */
export type UnredactedSurface = 'grounding-bundle' | 'print-document' | 'plan-file' | 'implementation-artifact' | 'inventory-csv'

/** `keep`: GUIDs a redacted export leaves as they are, because they are vendor constants and not tenant data (`runbookRedaction`). */
export type Disposition = { redact: true; keep?: ReadonlySet<string> } | { redact: false; surface: UnredactedSurface }

/** Redacted, which is what almost every caller wants. */
export const REDACTED: Disposition = { redact: true }

/** Names in full, only from a surface that warns first. */
export const unredactedFrom = (surface: UnredactedSurface): Disposition => ({ redact: false, surface })

/**
 * The redaction the Export page's runbooks take (the calendar and the prompt
 * pack): sign-in addresses and object IDs masked, as REDACTED masks them, and
 * the passkey model AAGUIDs left as they are. Those are vendor constants the
 * approved-model list names (Emergency Access Step 3, Microsoft Authenticator,
 * Windows Hello), not tenant data, and the runbook's allow-list step read
 * "YubiKey 5 Series (guid-0002)" with them masked (Phase 2 export finding 10).
 */
export function runbookRedaction(mapping: MappingState | null | undefined): Disposition {
  const keep = new Set([...AUTHENTICATOR_AAGUIDS, ...WINDOWS_HELLO_AAGUIDS, ...requiredModels(mapping ?? undefined).map((m) => m.aaguid)].map((id) => id.toLowerCase()))
  return { redact: true, keep }
}

function apply(content: string, d: Disposition): string {
  return d.redact ? redactIdentifiers(content, d.keep) : content
}

/**
 * The text a file carries, by its grammar. A calendar is unfolded before it is
 * masked and folded again after: masked as folded, an address split across a
 * fold kept its halves ("bg1@messy-fixture.onmicrosoft.com" whole in a masked
 * file, "upn-1@redactedsoft.com" half masked; Phase 2 export finding 10). The
 * whole file is masked in one pass, so a placeholder names one account across
 * it (redact.ts): masked line by line, "upn-1@redacted" was one emergency
 * account in one entry, the other in the next and an ordinary account in a
 * third. Pure.
 */
export function exportText(name: string, content: string, d: Disposition): string {
  if (!d.redact || !/\.ics$/i.test(name)) return apply(content, d)
  const unfolded = content.replace(/\r?\n[ \t]/g, '')
  return apply(unfolded, d).split(/\r?\n/).map(foldIcsLine).join('\r\n')
}

/** Preserve the file grammar so sample downloads still open in their intended tools. */
export function watermarkDemoFile(name: string, content: string): string {
  const notice = app.shell.demoWatermark
  if (/\.json$/i.test(name)) {
    const value: unknown = JSON.parse(content)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return JSON.stringify({ _demo: notice, ...value }, null, 2)
    // JSON arrays cannot carry a comment without changing their schema.
    return JSON.stringify(value, null, 2)
  }
  if (/\.ics$/i.test(name)) {
    // Labels change line lengths. Unfold first, then fold complete logical lines in UTF-8 octets.
    const labelled = content.replace(/\r?\n[ \t]/g, '').replace(/BEGIN:VCALENDAR\r?\n/, `BEGIN:VCALENDAR\r\nX-IAMAI-DEMO:${notice}\r\n`).replace(/^SUMMARY:/gm, 'SUMMARY:[DEMO] ')
    return labelled.split(/\r?\n/).map(foldIcsLine).join('\r\n')
  }
  if (/\.csv$/i.test(name)) {
    let quoted = false
    let out = '"IAMAI data",'
    for (let i = 0; i < content.length; i++) {
      const c = content[i]
      out += c
      if (c === '"') { if (quoted && content[i + 1] === '"') out += content[++i]; else quoted = !quoted }
      if (c === '\n' && !quoted && i < content.length - 1) { out += `"${notice.replace(/"/g, '""')}",` }
    }
    return out
  }
  return `${notice}\n\n${content}`
}

/** Save a file. The only place in the app that creates a download. */
export function exportDownload(name: string, content: string, type: string, d: Disposition): void {
  const text = exportText(name, content, d)
  const body = isDemo() ? watermarkDemoFile(name, text) : text
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Put text on the clipboard. The only place in the app that writes to it.
 *
 * Returns whether it worked, because the clipboard is unavailable in more
 * situations than callers expect (an insecure origin, a denied permission) and
 * the callers all want to show "Copied" only when it is true.
 */
export async function exportClipboard(text: string, d: Disposition): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(apply(text, d))
    return true
  } catch {
    // Unavailable: the text is on screen anyway, so this is not an error path.
    return false
  }
}

/**
 * Print. The one export whose content is the rendered DOM rather than a string,
 * so redaction cannot be applied here as a transform — which is exactly why it
 * has to state a surface rather than being allowed to slip past unremarked.
 */
export function exportPrint(d: Disposition): void {
  void d
  window.print()
}
