// The names the plan proposes for the objects the tenant lacks (the exclusions
// group, the service-accounts group, the trusted network, the countries
// location): one rule for the prerequisite step that creates each and for every
// portal line that names it before it exists. The plan's own prerequisite steps
// carry the name (generate.ts, in the tenant's convention); a context without
// the plan's steps proposes the same way the engine did. Pure.
import type { Step } from '../../roadmap/types.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { proposedObjectNames } from '../../coverage/naming.ts'
import type { NamingConvention } from '../../coverage/naming.ts'

export type ProposedObjectNames = { exclusionsGroup: string; serviceAccountsGroup: string; trustedLocation: string; allowedCountries: string }

const STEP_OF: Record<keyof ProposedObjectNames, string> = {
  exclusionsGroup: PREREQ_STEP_ID.exclusionsGroup,
  serviceAccountsGroup: PREREQ_STEP_ID.serviceAccountsGroup,
  trustedLocation: PREREQ_STEP_ID.trustedLocation,
  allowedCountries: PREREQ_STEP_ID.allowedCountries,
}

/** The plan's proposed names: each prerequisite step's own, else the engine's proposal for the convention. */
export function planProposedNames(steps: readonly Pick<Step, 'id' | 'naming'>[], naming: NamingConvention | undefined): ProposedObjectNames {
  const fallback = proposedObjectNames(naming ?? null)
  const of = (key: keyof ProposedObjectNames): string => steps.find((s) => s.id === STEP_OF[key])?.naming?.proposed ?? fallback[key].name
  return { exclusionsGroup: of('exclusionsGroup'), serviceAccountsGroup: of('serviceAccountsGroup'), trustedLocation: of('trustedLocation'), allowedCountries: of('allowedCountries') }
}

/** The proposed names a step context carries (planDates), else the engine's proposal for its convention. */
export function proposedNamesFor(ctx: { proposed?: ProposedObjectNames; naming?: NamingConvention }): ProposedObjectNames {
  return ctx.proposed ?? planProposedNames([], ctx.naming)
}
