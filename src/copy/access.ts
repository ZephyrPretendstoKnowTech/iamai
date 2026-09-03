// What the developer tools say when Microsoft Graph refuses the signed-in
// account (ScanProgress.tsx, ?dev=1 only). On screen, Global Reader is the only
// role IAMAI names (pages.connect); the per-scope role map (roles.ts) stays in
// code for diagnostics, and these are its words.
import { READ_EVERYTHING_ROLE } from '../graph/collect/roles.ts'
import { list } from './statements.ts'

export const ACCESS = {
  /** Appended to a denied section in the diagnostics: the role that would have read it. */
  needsRole: (least: string[]): string =>
    least.length === 0
      ? `The signed-in account holds no role that can read this. The ${READ_EVERYTHING_ROLE} role grants everything IAMAI reads.`
      : `The signed-in account holds no role that can read this. ${list(least)} grants it; the ${READ_EVERYTHING_ROLE} role grants everything IAMAI reads.`,
  /** Replaces the licence wording when the cause is a refused role, never a licence. */
  refusedStatus: 'not readable by the signed-in account',
}
