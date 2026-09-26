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
