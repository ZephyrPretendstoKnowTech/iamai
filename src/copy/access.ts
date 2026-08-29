// What to say when Microsoft Graph refuses the signed-in account.
//
// Graph's own words ("Insufficient privileges to complete the operation") say
// that something was denied and nothing about what to ask for. These sentences
// name the role, so a visitor with too little access leaves knowing what to
// request from whoever administers the tenant.
import { READ_EVERYTHING_ROLE } from '../graph/collect/roles.ts'
import { count, list } from './statements.ts'

export const ACCESS = {
  /** Appended to a denied section: the role that would have read it. */
  needsRole: (least: string[]): string =>
    least.length === 0
      ? `The signed-in account holds no role that can read this. The ${READ_EVERYTHING_ROLE} role grants everything IAMAI reads.`
      : `The signed-in account holds no role that can read this. ${list(least)} grants it; the ${READ_EVERYTHING_ROLE} role grants everything IAMAI reads.`,
  /** Replaces the licence wording when the cause is a refused role, never a licence. */
  refusedStatus: 'not readable by the signed-in account',
  deniedTitle: 'Some sections need a higher role',
  denied: (n: number): string =>
    `${count(n, 'section')} could not be read: Microsoft Graph refused the signed-in account, which is a role that is missing rather than a licence.`,
  askFor: `Ask whoever administers the tenant for the ${READ_EVERYTHING_ROLE} role, or the roles named against each section below. ${READ_EVERYTHING_ROLE} is read-only: it grants every section IAMAI reads and can change nothing in the tenant.`,
  /** Every section refused: the account has no directory role at all. */
  deniedAll: `Microsoft Graph refused every section. The signed-in account has consented, and holds no directory role that can read the tenant.`,
  partial: 'The rest of the scan continues; each section below says what it needs.',
  learnLabel: 'Microsoft: built-in role permissions',
  learnUrl: 'https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference',
  /** Column on the "What IAMAI reads" page. */
  roleColumn: 'Least role',
  roleFor: (least: string[]): string => (least.length === 0 ? READ_EVERYTHING_ROLE : list(least)),
  readsNote: `Delegated reads succeed only where the consent and the signed-in account's role agree, so the role below is needed as well as the permission. The ${READ_EVERYTHING_ROLE} role covers every row, and writes nothing.`,
}
