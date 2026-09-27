// Who an account is, where a picker would make a service account of it (F-056).
//
// Display only, and kept out of pickerRows.ts on purpose: the pickers' rows,
// nominations and decisions never read who is signed in (mapping/
// emergencyAccess.test.ts, "the signed-in identity changes nothing"). These
// marks change no row, no nomination and no decision; they only say, on an
// option, a chip and under Approve answers, that an account is an
// administrator or the one signed in now.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { directionWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { adminUserIdsWithEligible } from '../../roles.ts'
import type { PickerObject } from './pickerRows.ts'

/** The administrators an account picker marks: an active or eligible admin role (roles.ts, the one admin population). */
export function adminsOf(snapshot: Pick<TenantSnapshot, 'roles'>): Set<string> {
  return adminUserIdsWithEligible(snapshot.roles ?? { active: {} })
}

/**
 * Who an account is, where a service or shared-device answer would treat it as
 * a script (F-056): an administrator, the account signed in now, or both. You
 * could pick your own admin account as a printer, first in the results, and
 * nothing said so. Null for anyone else.
 */
export function accountMarkOf(id: string, admins: ReadonlySet<string>, operatorId: string | null): string | null {
  const marks = [...(admins.has(id) ? [directionWords.adminMark] : []), ...(operatorId !== null && id === operatorId ? [directionWords.operatorMark] : [])]
  return marks.length > 0 ? marks.join(' · ') : null
}

/** An account option marked as accountMarkOf reads it: the mark leads its line in the list and its chip. */
export function withAccountMark(o: PickerObject, admins: ReadonlySet<string>, operatorId: string | null): PickerObject {
  const mark = accountMarkOf(o.id, admins, operatorId)
  if (mark === null) return o
  return { ...o, badge: [mark, o.badge].filter(Boolean).join(' · '), why: [mark, o.why ?? o.secondary].filter(Boolean).join(' · ') }
}

/** The line under Approve answers when an account answer picks an administrator or the signed-in account (F-056); null when it picks neither. */
export function adminPickedLine(picked: readonly string[], admins: ReadonlySet<string>, operatorId: string | null, nameOf: (id: string) => string): string | null {
  const marked = [...new Set(picked)].flatMap((id) => {
    const mark = accountMarkOf(id, admins, operatorId)
    return mark === null ? [] : [`${nameOf(id)} (${mark.replaceAll(' · ', ', ').toLowerCase()})`]
  })
  return marked.length === 0 ? null : fillText(directionWords.adminPicked, { names: marked })
}
