// An implementation-content block authored as Markdown (an Entra procedure, AI
// Info, an Email), read into the parts a person reads (StepSections.tsx
// AuthoredText): a heading line, numbered and bulleted lists, and every other
// line as its own line so an authored line break survives. Pure, so the reading
// is tested without a DOM.

import { shared } from '../../content/content.ts'

/** The procedure's words for a role list's label (policyProcedure.ts roleList): "Select (46)", "Clear (80)". */
const PROC = (shared as unknown as { procedure: { rolesSelect: string; rolesClear: string } }).procedure
/** Whether a sub-line label is a role list's: the template with its count filled in. */
const isListLabel = (title: string): boolean => [PROC.rolesSelect, PROC.rolesClear].some((l) => { const [pre, post] = l.split('{n}'); return title.startsWith(pre) && title.endsWith(post ?? '') && /^\d+$/.test(title.slice(pre.length, title.length - (post ?? '').length)) })

/**
 * A "+ Label: text" sub-line (policyProcedure.ts): a list to tick through when
 * its label is a role list's ("Select (46): A; B"), else a fold with its text;
 * null for any other line.
 */
export function foldLineOf(line: string): { title: string; items: string[] } | { title: string; text: string } | null {
  const t = line.trim()
  if (!t.startsWith('+ ') || !t.includes(': ')) return null
  const title = t.slice(2, t.indexOf(': '))
  const body = t.slice(t.indexOf(': ') + 2)
  return isListLabel(title) ? { title, items: body.split('; ').filter((x) => x !== '') } : { title, text: body }
}

/**
 * The hosts IAMAI's own authored text links to (content.json, the
 * implementation content, and the procedures the code writes). A tenant's names
 * are bound into the same text, and nothing tells a bound name from IAMAI's
 * words: a group or person named as a Markdown link to another site would draw
 * as a link styled like IAMAI's own (security audit, 2026-09-29). So an external
 * link is drawn only to one of these hosts, and anything else as the plain text
 * it is. authoredLinks.test.ts walks every authored link against this list, so
 * content that links to a new host fails there until the host is added here.
 * No host that serves anyone's content (github.com, linkedin.com) is listed.
 */
export const AUTHORED_LINK_HOSTS: ReadonlySet<string> = new Set([
  'entra.microsoft.com',
  'portal.azure.com',
  'mysignins.microsoft.com',
  'support.microsoft.com',
  'learn.microsoft.com',
  'aka.ms',
  'getiamai.com',
])

/** A route or fixed HTTPS source link in authored text: `[words](destination)`. */
const AUTHORED_LINK = /^\[([^\]]+)\]\(((?:#\/|https:\/\/)[^)\s]*)\)$/

/** Whether an authored link may be drawn as one: a route of the app, or plain https to a listed host on its default port. */
export function authoredLinkAllowed(href: string): boolean {
  if (href.startsWith('#/')) return true
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.port === '' && AUTHORED_LINK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

/** One piece of an authored line, in order. */
export type InlinePart =
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string; external: boolean }
  | { kind: 'text'; text: string }

/** `**bold**`, `` `code` `` and a safe authored link inside one line. Nothing else is interpreted, and no HTML ever is. */
export function inlineParts(line: string): InlinePart[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:#\/|https:\/\/)[^)\s]*\))/g).map((part): InlinePart => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { kind: 'bold', text: part.slice(2, -2) }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return { kind: 'code', text: part.slice(1, -1) }
    const link = AUTHORED_LINK.exec(part)
    if (link && authoredLinkAllowed(link[2])) return { kind: 'link', text: link[1], href: link[2], external: link[2].startsWith('https://') }
    return { kind: 'text', text: part }
  })
}

/** One part of an authored block, in order. */
export type AuthoredPart =
  | { kind: 'list'; ordered: boolean; start: number; items: string[][] }
  | { kind: 'break' }
  | { kind: 'heading'; text: string }
  | { kind: 'line'; text: string }

type AuthoredList = Extract<AuthoredPart, { kind: 'list' }>

/**
 * An authored block's parts. A numbered list starts at the number it is written
 * with, so a procedure a sentence interrupts goes on counting; an indented line
 * under an item is that item's next line, so a step's sub-list stays inside the
 * step (content review S2).
 */
export function authoredParts(text: string): AuthoredPart[] {
  const out: AuthoredPart[] = []
  let list: AuthoredList | null = null
  for (const raw of text.replace(/\s+$/, '').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (list !== null && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1].push(line.trim())
      continue
    }
    const ordered = /^(\d+)\.\s+(.*)$/.exec(line)
    const bullet = /^-\s+(.*)$/.exec(line)
    if (ordered || bullet) {
      const isOrdered = ordered !== null
      if (list === null || list.ordered !== isOrdered) {
        list = { kind: 'list', ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] }
        out.push(list)
      }
      list.items.push([ordered ? ordered[2] : bullet![1]])
      continue
    }
    list = null
    if (line === '') {
      out.push({ kind: 'break' })
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    out.push(heading ? { kind: 'heading', text: heading[1] } : { kind: 'line', text: line })
  }
  return out
}
