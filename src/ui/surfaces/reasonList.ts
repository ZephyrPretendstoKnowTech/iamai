// A reason whose template names a list ("These policies of your own …:
// {list:retiring}. Conditional Access applies …"), split so the screen draws the
// list one line each (audit, 2026-10-05: Retire Replaced Policies read as one
// 140-word sentence). The words are the template's own: the lead up to the list,
// the list, then the rest. Export and print keep the sentence as it is.
//
// Pure: no DOM.
import { fillText } from '../../content/render.ts'

export type ListedReason = { lead: string; items: string[]; rest: string }

/** The reason as lead, items and rest, or null where it names no list of two or more. */
export function listedReason(template: string, vars: Record<string, unknown>): ListedReason | null {
  const m = /^(.*?)\{list:([a-zA-Z0-9_]+)\}\.?\s*(.*)$/s.exec(template)
  if (!m) return null
  const items = vars[m[2]]
  if (!Array.isArray(items) || items.length < 2 || !items.every((x): x is string => typeof x === 'string')) return null
  return { lead: fillText(m[1], vars as never).trim(), items, rest: fillText(m[3], vars as never).trim() }
}
