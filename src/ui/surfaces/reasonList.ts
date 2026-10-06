// A reason whose template names a list ("These policies of your own …:
// {list:retiring}. Conditional Access applies …"), split so the screen draws the
// list one line each (audit, 2026-10-05: Retire Replaced Policies read as one
// 140-word sentence). The words are the template's own: the lead up to the list,
// the list, then the rest. Export and print keep the sentence as it is.
//
// Pure: no DOM.
import { fillText } from '../../content/render.ts'

export type ListedReason = { lead: string; items: string[]; rest: string }

/** The reason as lead, items and rest, or null where it names no list, or an empty one. One entry is a list too: the screen draws it on its own line, the ID at its end (live check, 2026-10-05). */
export function listedReason(template: string, vars: Record<string, unknown>): ListedReason | null {
  const m = /^(.*?)\{list:([a-zA-Z0-9_]+)\}\.?\s*(.*)$/s.exec(template)
  if (!m) return null
  const items = vars[m[2]]
  if (!Array.isArray(items) || items.length < 1 || !items.every((x): x is string => typeof x === 'string')) return null
  return { lead: fillText(m[1], vars as never).trim(), items, rest: fillText(m[3], vars as never).trim() }
}

/**
 * A cleanup row's reason: its `whyOne` where the list it names holds one entry (live
 * check, 2026-10-05: "These policies of your own …" over one policy), else its `why`.
 * Screen and export read the same one.
 */
export function whyFor(entry: { why: string; whyOne?: string }, vars: Record<string, unknown>): string {
  const m = /\{list:([a-zA-Z0-9_]+)\}/.exec(entry.why)
  const items = m ? vars[m[1]] : undefined
  return entry.whyOne && Array.isArray(items) && items.length === 1 ? entry.whyOne : entry.why
}
