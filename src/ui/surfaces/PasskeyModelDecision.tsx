import { useEffect, useId, useState } from 'react'
import type { MappingState, PasskeyApprovedModel } from '../../mapping/types.ts'
import { PASSKEY_MODELS_ANSWER, PASSKEY_MODELS_ACCEPT, parsePasskeyApprovedModels, passkeyApprovedModelsOf } from '../../mapping/passkeyModels.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { app } from '../../content/content.ts'
import { fillTextVerbatim } from '../../content/render.ts'
import { Button } from '../components/index.ts'
import { addModel, modelsDecision, removeModel } from './passkeyModelEdits.ts'

type ModelWords = { name: string; aaguid: string; add: string; remove: string; removeLabel: string; invalid: string; duplicate: string; none: string }
const W = (app.plan as unknown as { passkeyModels: ModelWords }).passkeyModels

// Configure Passkey Authentication's extra key models. Add and Remove save the
// list at once (passkeyModelEdits.ts, F-104): an added model lived only on
// screen until a second button saved it, and leaving the step lost it.
export function PasskeyModelDecision({ mapping, saved, onDecide, printing = false }: {
  mapping: MappingState
  saved: StepDecision | null
  onDecide?: (decision: StepDecisionInput) => void
  printing?: boolean
}) {
  const id = useId()
  const accepted = saved?.option === PASSKEY_MODELS_ACCEPT ? parsePasskeyApprovedModels(saved.answers?.[PASSKEY_MODELS_ANSWER]) ?? passkeyApprovedModelsOf(mapping) : passkeyApprovedModelsOf(mapping)
  const acceptedKey = JSON.stringify(accepted)
  const [models, setModels] = useState<PasskeyApprovedModel[]>(accepted)
  const [name, setName] = useState('')
  const [aaguid, setAaguid] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setModels(JSON.parse(acceptedKey)); setError(null) }, [acceptedKey])
  const save = (next: PasskeyApprovedModel[]): void => {
    setModels(next)
    setError(null)
    onDecide?.(modelsDecision(saved, next))
  }
  const add = () => {
    const result = addModel(models, name, aaguid)
    if ('error' in result) { setError(result.error === 'invalid' ? W.invalid : W.duplicate); return }
    save(result.models)
    setName(''); setAaguid('')
  }
  const displayed = printing ? accepted : models
  return <section className="step-section passkey-model-decision">
    {displayed.length > 0 && <ul>{displayed.map(model => <li key={model.aaguid}>
      <strong>{model.name}</strong><div className="reason" style={{ overflowWrap: 'anywhere' }}>{model.aaguid}</div>
      {!printing && <Button type="button" variant="tertiary" disabled={!onDecide} aria-label={fillTextVerbatim(W.removeLabel, {}, { name: model.name })} onClick={() => save(removeModel(models, model.aaguid))}>{W.remove}</Button>}
    </li>)}</ul>}
    {printing ? displayed.length === 0 && <p>{W.none}</p> : <div className="decision-fields">
      <div className="decision-field"><label htmlFor={`${id}-name`}><strong>{W.name}</strong></label><input type="text" id={`${id}-name`} value={name} disabled={!onDecide} onChange={event => setName(event.currentTarget.value)} /></div>
      <div className="decision-field"><label htmlFor={`${id}-aaguid`}><strong>{W.aaguid}</strong></label><input type="text" id={`${id}-aaguid`} value={aaguid} disabled={!onDecide} autoCapitalize="none" spellCheck={false} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setAaguid(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></div>
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      <div className="actions"><Button type="button" disabled={!onDecide || !name.trim() || !aaguid.trim()} onClick={add}>{W.add}</Button></div>
    </div>}
  </section>
}
