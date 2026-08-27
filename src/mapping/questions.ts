// Builds the Mapping questionnaire from the baseline package (prompt 06 item
// 1): unresolved references grouped by the adapter's inferred roles. Pure.
import { unresolvedReferences } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import type { MappingQuestion, QuestionGroup } from './types.ts'

const PERSONA_ROLES = new Set(['adminPersona', 'passkeyPilot', 'appPersona', 'includedPersona'])
const EXCLUSION_ROLES = new Set(['broadExclusion', 'serviceAccounts', 'deviceExclusion', 'locationException'])

export function buildQuestions(pkg: BaselinePackage): MappingQuestion[] {
  const roleByGroup = new Map(pkg.groupSignatures.map((s) => [s.id, s]))
  const questions: MappingQuestion[] = []

  for (const ref of unresolvedReferences(pkg.references)) {
    const usage = ref.uses.map((u) => ({ policyName: u.policyName, side: u.side }))
    const push = (group: QuestionGroup, evidence: string | null = null): void => {
      questions.push({ key: ref.id, group, reference: ref, usage, evidence })
    }

    if (ref.placeholder) {
      push('placeholders')
      continue
    }
    switch (ref.kind) {
      case 'user':
        push('breakGlass')
        break
      case 'group': {
        const sig = roleByGroup.get(ref.id)
        const role = sig?.inferredRole ?? 'unknown'
        const evidence = sig?.evidence ?? null
        if (role === 'globalExclusion') push('globalExclusion', evidence)
        else if (EXCLUSION_ROLES.has(role)) push('exclusionGroups', evidence)
        else if (PERSONA_ROLES.has(role)) push('personaGroups', evidence)
        else push('exclusionGroups', evidence)
        break
      }
      case 'namedLocation':
        push('namedLocations')
        break
      case 'authenticationStrength':
        push('customStrengths')
        break
      case 'servicePrincipal':
      case 'application':
        push('servicePrincipals')
        break
      case 'termsOfUse':
        push('placeholders')
        break
      default:
        push('placeholders')
    }
  }

  const order: QuestionGroup[] = [
    'breakGlass',
    'globalExclusion',
    'exclusionGroups',
    'personaGroups',
    'namedLocations',
    'customStrengths',
    'servicePrincipals',
    'placeholders',
  ]
  return questions.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.key.localeCompare(b.key))
}

export const GROUP_TITLE: Record<QuestionGroup, string> = {
  breakGlass: 'Break-glass accounts',
  globalExclusion: 'Global exclusion group',
  exclusionGroups: 'Other exclusion groups',
  personaGroups: 'Persona and pilot groups',
  namedLocations: 'Named locations',
  customStrengths: 'Custom authentication strengths',
  servicePrincipals: 'Service principals and apps',
  placeholders: 'Placeholders',
}
