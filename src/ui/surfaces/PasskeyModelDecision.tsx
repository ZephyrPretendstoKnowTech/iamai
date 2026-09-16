import { useEffect, useId, useState } from 'react'
import type { MappingState, PasskeyApprovedModel } from '../../mapping/types.ts'
import { PASSKEY_MODELS_ANSWER, PASSKEY_MODELS_ACCEPT, normalizePasskeyApprovedModels, parsePasskeyApprovedModels, passkeyApprovedModelsOf } from '../../mapping/passkeyModels.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { Button } from '../components/index.ts'

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
  const add = () => {
    const valid = normalizePasskeyApprovedModels([{ name, aaguid }])
    if (!valid) { setError('Enter an authenticator name and a valid AAGUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).'); return }
    if (models.some(model => model.aaguid === valid[0].aaguid)) { setError('This AAGUID is already listed.'); return }
    setModels([...models, valid[0]])
    setName(''); setAaguid(''); setError(null)
  }
  const changed = JSON.stringify(models) !== acceptedKey
  const displayed = printing ? accepted : models
  return <section className="step-section passkey-model-decision">
    <h4>Additional Authenticators</h4>
    <p>Add hardware models you approve in addition to the default authenticators.</p>
    {displayed.length > 0 && <ul>{displayed.map(model => <li key={model.aaguid}>
      <strong>{model.name}</strong><div className="reason" style={{ overflowWrap: 'anywhere' }}>{model.aaguid}</div>
      {!printing && <Button type="button" variant="tertiary" disabled={!onDecide} aria-label={`Remove ${model.name}`} onClick={() => { setModels(models.filter(item => item.aaguid !== model.aaguid)); setError(null) }}>Remove</Button>}
    </li>)}</ul>}
    {printing ? displayed.length === 0 && <p>No additional authenticators accepted.</p> : <div className="decision-fields">
      <div className="decision-field"><label htmlFor={`${id}-name`}><strong>Authenticator Name</strong></label><input type="text" id={`${id}-name`} value={name} disabled={!onDecide} onChange={event => setName(event.currentTarget.value)} /></div>
      <div className="decision-field"><label htmlFor={`${id}-aaguid`}><strong>AAGUID</strong></label><input type="text" id={`${id}-aaguid`} value={aaguid} disabled={!onDecide} autoCapitalize="none" spellCheck={false} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setAaguid(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></div>
      {error && <p id={`${id}-error`} role="alert">{error}</p>}
      <div className="actions"><Button type="button" disabled={!onDecide || !name.trim() || !aaguid.trim()} onClick={add}>Add</Button><Button type="button" variant="primary" disabled={!onDecide || !changed || Boolean(name.trim() || aaguid.trim())} onClick={() => onDecide?.({ option: PASSKEY_MODELS_ACCEPT, answers: { ...saved?.answers, [PASSKEY_MODELS_ANSWER]: JSON.stringify(models) } })}>Accept Deviation</Button></div>
    </div>}
  </section>
}
