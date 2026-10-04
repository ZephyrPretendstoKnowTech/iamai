// The blocked countries location (v1.1 D4): where countries are listed to block
// outright, Block Sign-ins From Countries Not Allowed makes a second countries
// location, which Jon's NoExclusions block includes, before the policies that
// name it, as it makes the allowed countries location. One reading for the
// step's Implementation Tasks (policyTasks.ts policyProcedureOf) and its action
// line (stepContract.ts ownObjectTaskOf). Pure.
import type { MappingState } from '../../mapping/types.ts'
import { PROCEDURE } from '../../roadmap/policyProcedure.ts'
import { BLOCKED_COUNTRIES_SLOT } from '../../roadmap/resolvePolicy.ts'
import { fillText } from '../../content/render.ts'
import type { EmergencyAccountTask } from './emergencyAccountTasks.ts'
import type { ProposedObjectNames } from './proposedNames.ts'

type Input = { proposed: Pick<ProposedObjectNames, 'blockedCountries'>; mapping?: Partial<Pick<MappingState, 'countriesBlockedOutright'>> }
type Words = { tasks: Record<string, string>; blockedLocation: string[]; blockedLocationAction: string }
const W = (): Words => PROCEDURE as unknown as Words

/**
 * The task, where a policy waits on the location (resolvePolicy.ts
 * BLOCKED_COUNTRIES_SLOT): its procedure in the allowed countries location's
 * shape, named as the plan proposes it, with the countries by code. Null where
 * no policy waits on it.
 */
export function blockedLocationTaskOf(missing: readonly { token: string }[], input: Input): EmergencyAccountTask | null {
  const countries = input.mapping?.countriesBlockedOutright ?? []
  if (countries.length === 0 || !missing.some((m) => m.token === BLOCKED_COUNTRIES_SLOT)) return null
  const vars = { name: input.proposed.blockedCountries, countries: countries.join(', ') }
  const title = W().tasks.blockedLocation
  return { id: 'blocked-location', accountId: null, title, targetUpn: null, required: true, readinessKey: '', evidence: null, actionLabel: title, steps: W().blockedLocation.map((l) => fillText(l, vars)) }
}

/** The step's next action while the policy waits on the location alone. */
export function blockedLocationActionOf(input: Input): string {
  return fillText(W().blockedLocationAction, { name: input.proposed.blockedCountries, countries: (input.mapping?.countriesBlockedOutright ?? []).join(', ') })
}
