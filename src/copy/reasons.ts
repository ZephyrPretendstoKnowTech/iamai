// Why a goal is not fully in place (prompt 19 audit D2): the sentences the
// Findings page shows under "Why not fully". Built here, not in the engine, so
// every branch (0, 1, all, none) is explicit and lint-checked.
import { count, list } from './statements.ts'

export const REASON = {
  /** People the goal expects that no enabled policy includes. */
  notTargeted: (n: number, expected: number): string =>
    n > 0 && n === expected
      ? 'No enabled policy includes anyone this goal should cover'
      : n === 1
        ? 'No enabled policy includes this user'
        : `No enabled policy includes these ${count(n, 'user')}`,
  reportOnly: 'Covered only by a report-only policy, so nothing is enforced yet',
  appsNarrower: (policy: string): string => `${policy} covers fewer apps than the goal expects`,
  weakerControl: (policy: string, floor: string): string => `${policy} applies but is weaker than the goal needs (${floor})`,
  belowBaseline: (policy: string, floor: string): string => `${policy} meets the goal but not the baseline's stricter version (${floor})`,
  disabledCandidates: (names: string[]): string =>
    names.length === 1 ? `A matching policy is switched off: ${names[0]}` : `${count(names.length, 'matching policy', 'matching policies')} are switched off: ${list(names)}`,
  excludedByRole: (roles: number): string => `Excluded by role (${roles === 1 ? 'one role' : count(roles, 'role')})`,
  guestsExcluded: 'Guests are excluded',
  excludedDirectly: (breakGlass: boolean, assumedNote: string): string => `Excluded directly${breakGlass ? ` (break-glass${assumedNote})` : ''}`,
}
