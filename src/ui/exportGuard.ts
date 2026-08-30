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
import { isDemo } from './demo.ts'
import { SHELL } from '../copy/pages.ts'

/**
 * The surfaces allowed to export without redaction. Each value names a place in
 * the UI that shows the user what the export contains before they can trigger
 * it; adding a value here without adding that warning is the thing the test
 * below is watching for.
 *
 * - `grounding-bundle` — the Export tab's bundle card, whose warning Callout
 *   (`GROUNDING.warning`) renders above the checkbox that clears redaction.
 * - `recovery-card` — the recovery card. It names the emergency access accounts
 *   and their sign-in addresses because a redacted one would be useless at the
 *   moment somebody needs it; the page carries a Callout saying so above the
 *   print button.
 * - `print-document` — the print layout. Printing exists to put the plan in
 *   front of the person doing the work, and a redacted printout would be
 *   useless for that; the print card states what the document contains.
 */
export type UnredactedSurface = 'grounding-bundle' | 'print-document' | 'recovery-card'

export type Disposition = { redact: true } | { redact: false; surface: UnredactedSurface }

/** Redacted, which is what almost every caller wants. */
export const REDACTED: Disposition = { redact: true }

/** Names in full, only from a surface that warns first. */
export const unredactedFrom = (surface: UnredactedSurface): Disposition => ({ redact: false, surface })

function apply(content: string, d: Disposition): string {
  return d.redact ? redactIdentifiers(content) : content
}

/** Save a file. The only place in the app that creates a download. */
export function exportDownload(name: string, content: string, type: string, d: Disposition): void {
  // Every file leaving demo mode says so, in the file (prompt 45 item 5). A
  // sample plan that looks like a real one is the one way demo mode could do
  // harm: somebody forwards it, and the next person acts on a tenant that does
  // not exist. The line goes at the top, where it is read first.
  const body = isDemo() ? `${SHELL.demoWatermark}

${apply(content, d)}` : apply(content, d)
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
