// Configure Passkey Authentication's extra key models (PasskeyModelDecision.tsx),
// as the pure edits the list makes (F-104). Add and Remove each save the list
// they leave: a model added used to live only on screen until a second button,
// Save Additional Authenticators, was pressed, and leaving the step lost it.
import type { PasskeyApprovedModel } from '../../mapping/types.ts'
import { PASSKEY_MODELS_ACCEPT, PASSKEY_MODELS_ANSWER, normalizePasskeyApprovedModels } from '../../mapping/passkeyModels.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'

export type ModelAdded = { models: PasskeyApprovedModel[] } | { error: 'invalid' | 'duplicate' }

/** The list with one model added, or why it cannot be. */
export function addModel(models: readonly PasskeyApprovedModel[], name: string, aaguid: string): ModelAdded {
  const valid = normalizePasskeyApprovedModels([{ name, aaguid }])
  if (!valid) return { error: 'invalid' }
  if (models.some((m) => m.aaguid === valid[0].aaguid)) return { error: 'duplicate' }
  return { models: [...models, valid[0]] }
}

/** The list without one model. */
export function removeModel(models: readonly PasskeyApprovedModel[], aaguid: string): PasskeyApprovedModel[] {
  return models.filter((m) => m.aaguid !== aaguid)
}

/** The decision that saves a list, keeping the step's other answers. */
export function modelsDecision(saved: StepDecision | null, models: readonly PasskeyApprovedModel[]): StepDecisionInput {
  return { option: PASSKEY_MODELS_ACCEPT, answers: { ...saved?.answers, [PASSKEY_MODELS_ANSWER]: JSON.stringify(models) } }
}
