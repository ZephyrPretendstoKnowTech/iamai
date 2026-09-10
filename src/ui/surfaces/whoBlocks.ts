// Who a step touches, split at the point a list stops being a fact and starts
// being an inventory (task 011).
//
// A Plan step's Who section is the step's own who-lines and, on the registration
// campaign, one line per readiness rung. Each of them can end in the people it
// counts, and until now every one of those people was printed on the default
// step: on a large tenant the campaign step put 3,784 names on the page, the
// all-users MFA step 1,672, and the dormant-accounts check 731. That is not a
// rollout decision. It is a directory export sitting on top of one, and the
// count and the consequence — the part that decides what to do next — are lost
// somewhere inside it.
//
// So the split. Under `NAMES_INLINE` the names are a fact an operator reads at a
// glance and acts on: which two accounts are the emergency ones, which one
// device is shared. Over it they are audit depth, and the default step keeps the
// sentence, the count and the instruction while More carries the names.
//
// Nothing is dropped and nothing is re-decided. These are the same lines the
// export view reads (stepExport.ts whoEvidenceLines), filled the same way; this
// only chooses which of the two places on the step each one is drawn in. The
// print opens More, so a printed step is unchanged.
//
// Pure: no DOM, no network.
import { fillText, listCountVars, whole } from '../../content/render.ts'
import { whoEvidenceLines, whoLeadTemplate } from './stepExport.ts'

type Ex = Record<string, unknown>

/**
 * Above this many names the default step states the count and the names move to
 * More. It is the number the engine already counts to before it stops listing
 * and starts summarising (roadmap/ladder.ts NAME_LIMIT).
 */
export const NAMES_INLINE = 5

/** One who-line or campaign rung: the sentence, and the names it ends in — none, for a line that lists nobody. */
export type WhoBlock = { key: string; lead: string; names: string[] }

const truthy = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : typeof v === 'number' ? v !== 0 : Boolean(v))

/**
 * A line's trailing name list, where it has one: `{list:accounts}` alone, or
 * prose ending in `: {list:accounts}` (§6.3, §6.5). A line that counts and lists
 * counts its own list (render.ts listCountVars).
 */
export function nameListOf(line: string, stepEx: Ex): { lead: string; names: string[] } | null {
  const ex = listCountVars(line, stepEx) as Ex
  const m = /^(.*?)\s*\{list:([a-zA-Z0-9_]+)\}\s*$/.exec(line)
  const items = m ? ex[m[2]] : undefined
  if (!m || !Array.isArray(items) || items.length === 0) return null
  return { lead: fillText(m[1].trim(), ex), names: (items as unknown[]).map((x) => String(x)) }
}

/**
 * A lead ending in a colon promises the list under it. On the default step that
 * list may be in More, so the promise is closed rather than left hanging over
 * nothing; the copy in More keeps the colon and the names it introduces.
 */
export function closed(lead: string): string {
  return lead.replace(/\s*:\s*$/, '.')
}

/**
 * The step's Who section in two parts: `inline` is what the default step shows,
 * `held` is what More carries.
 *
 * The split is only ever the names. Every line the step has to say stays on the
 * default step, with its count and its instruction intact — "537 people at
 * Nothing set up; issue a Temporary Access Pass…" is the consequence the Plan
 * decision is made on, and it is the same sentence either way. What moves is the
 * 537 names under it, which decide nothing here.
 *
 * One line moves whole: the admins note writes its people into the middle of its
 * own sentence rather than after it, so once there are more of them than can be
 * read at a glance the sentence is the list.
 */
export function whoBlocks(who: Record<string, unknown>, ex: Ex): { inline: WhoBlock[]; held: WhoBlock[] } {
  const all: WhoBlock[] = []
  whoEvidenceLines(who, ex)
    .filter((line) => whole(line, ex))
    .forEach((line, i) => {
      const nl = nameListOf(line, ex)
      all.push(nl ? { key: `who:${i}`, lead: nl.lead, names: nl.names } : { key: `who:${i}`, lead: fillText(line, listCountVars(line, ex) as Ex), names: [] })
    })
  // The campaign's rungs: each one with its people, only where the rung has any
  // (walk-51 item 3). The rung's own sentence carries the count and what to do
  // about it, which is the whole of what a Plan decision needs from it; who is
  // on which rung is the MFA readiness surface's question.
  const groups = who.groups as Record<string, unknown> | undefined
  if (groups) {
    for (const [gk, gl] of Object.entries(groups)) {
      const items = (ex[gk] as string[]) || []
      if (items.length === 0) continue
      all.push({ key: `group:${gk}`, lead: fillText(gl, { ...ex, n: items.length }), names: items })
    }
  }
  const long = (b: WhoBlock): boolean => b.names.length > NAMES_INLINE
  // The sentence always; the names with it while they are short enough to read,
  // and its promise of a list closed where they are not.
  const inline: WhoBlock[] = all.map((b) => (long(b) ? { ...b, lead: closed(b.lead), names: [] } : b))
  const held: WhoBlock[] = all.filter(long)
  // The note about how the rungs divide people belongs beside the rungs' names.
  if (groups && who.overlap && whole(who.overlap, ex)) (held.length > 0 ? held : inline).push({ key: 'overlap', lead: fillText(who.overlap, ex), names: [] })
  // The admins line names them inside its sentence rather than after it, so the
  // whole line moves once there are more of them than can be read at a glance.
  if (who.adminsNote && truthy(ex.adminNames) && whole(who.adminsNote, ex)) {
    const many = Array.isArray(ex.adminNames) && (ex.adminNames as unknown[]).length > NAMES_INLINE
    ;(many ? held : inline).push({ key: 'admins', lead: fillText(who.adminsNote, ex), names: [] })
  }
  return { inline, held }
}

/**
 * The step's Who lead, closed, where it renders at all.
 *
 * A lead that ends in a colon promises what follows it, and renders only when
 * something does: an inline block, or a list the lead itself carries (the walk
 * found "…with who signs in from each:" over nothing on the countries step).
 * Where the blocks under it have moved to More the lead still stands — it is the
 * step's summary of who — with its promise closed.
 */
export function whoLeadLine(who: Record<string, unknown>, ex: Ex, blocks: WhoBlock[]): string | null {
  const lead = whoLeadTemplate(who, ex)
  if (lead === null) return null
  if (!/:\s*$/.test(lead)) return fillText(lead, ex)
  if (blocks.length === 0) return null
  return closed(fillText(lead, ex))
}
