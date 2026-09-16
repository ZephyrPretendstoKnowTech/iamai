import { useId, useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { ManualReviewInput } from '../../roadmap/decisions.ts'
import { MANUAL_REVIEW_ID } from '../../roadmap/manualWork.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { Button, Picker } from '../components/index.ts'
import type { StepVarContext } from './stepVars.ts'

/** The engine supplies only the evidence fields needed by this workflow. */
export function ManualReviewForm({ review, ctx, printing, onConfirm, onUnconfirm }: {
  review: NonNullable<Step['manualReview']>
  ctx: StepVarContext
  printing: boolean
  onConfirm?: (records: Record<string, ManualReviewInput>) => void
  onUnconfirm?: (keys: string[]) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<ManualReviewInput>(() => ({ ...review.record, basis: review.basis }))
  const [queries, setQueries] = useState<Record<string, string>>({})
  const fields = (review.fields ?? []).filter(field => !field.whenOutcome || field.whenOutcome.includes((printing ? review.record?.outcome : draft.outcome) as NonNullable<ManualReviewInput['outcome']>))
  const recordedAt = review.record?.at ?? review.confirmedAt
  const today = new Date().toISOString().slice(0, 10)
  const missing = fields.filter(field => {
    const value = draft[field.key]
    if (!field.required || (field.type === 'checkbox' && (draft.outcome === 'failed' || draft.outcome === 'investigate'))) return false
    return !(Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' ? value : typeof value === 'string' && value.trim().length > 0)
  })
  const complete = missing.length === 0 && (!draft.testedAt || draft.testedAt.slice(0, 10) <= today)
  const canSave = complete && Boolean(onConfirm)
  const set = (key: string, value: unknown) => setDraft(old => ({ ...old, [key]: value }))
  return <section className="step-section manual-review">
    <h4>Workflow Check</h4>
    {recordedAt && <p>Recorded {absoluteDate(recordedAt)}{review.confirmedAt ? '' : ' · Recheck needed'}</p>}
    {review.staleReason && <p>{review.staleReason}</p>}
    {printing ? <dl>{fields.map(field => {
      const value = review.record?.[field.key]
      const label = Array.isArray(value) ? value.map(id => field.options?.find(option => option.value === id)?.label ?? ctx.nameOf(id)).join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : field.options?.find(option => option.value === value)?.label ?? String(value ?? 'Not recorded')
      return <div key={field.key}><dt>{field.label}</dt><dd>{label}</dd></div>
    })}</dl> : <form className="decision-fields" onSubmit={event => { event.preventDefault(); if (canSave) onConfirm?.({ [MANUAL_REVIEW_ID]: { ...draft, basis: review.basis } }) }}>
      {fields.map(field => {
        const fieldId = `${id}-${field.key}`
        const value = draft[field.key]
        if (field.type === 'accounts') {
          const options = field.options?.map(option => ({ id: option.value, name: option.label })) ?? ctx.snapshot.users.map(user => ({ id: user.id, name: user.displayName ?? user.userPrincipalName ?? user.id, secondary: user.userPrincipalName ?? undefined }))
          const selected = (Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []).map(accountId => options.find(option => option.id === accountId) ?? { id: accountId, name: ctx.nameOf(accountId) })
          const filtered = options.filter(option => `${option.name} ${option.id}`.toLowerCase().includes((queries[field.key] ?? '').toLowerCase()))
          return <div key={field.key} className="decision-field"><h5 id={fieldId}>{field.label}</h5><Picker labelledBy={fieldId} options={filtered} suggestions={options.slice(0, 3)} selected={selected} single={field.key !== 'accountIds' && field.key !== 'roleIds'} onSearch={query => setQueries(old => ({ ...old, [field.key]: query }))} onChange={next => set(field.key, field.key !== 'accountIds' && field.key !== 'roleIds' ? next[0]?.id ?? '' : next.map(option => option.id))} /></div>
        }
        return <div key={field.key} className="decision-field">
          {field.type === 'checkbox' ? <label className="choice"><input type="checkbox" checked={value === true} onChange={event => set(field.key, event.currentTarget.checked)} />{field.label}</label> : <>
            <label htmlFor={fieldId}><strong>{field.label}</strong></label>
            {field.type === 'select' ? <select id={fieldId} required={field.required} value={String(value ?? '')} onChange={event => set(field.key, event.currentTarget.value)}><option value="">Choose…</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input id={fieldId} type={field.type === 'date' ? 'date' : 'text'} required={field.required} max={field.type === 'date' ? today : undefined} value={Array.isArray(value) ? value.join(', ') : String(value ?? '')} onChange={event => set(field.key, field.key === 'roleIds' ? event.currentTarget.value.split(',').map(v => v.trim()).filter(Boolean) : event.currentTarget.value)} />}
          </>}
        </div>
      })}
      {missing.length > 0 && Object.keys(draft).some(key => key !== 'basis' && key !== 'at') && <p className="reason">Still needed: {missing.map(field => field.label).join(', ')}.</p>}
      <div className="actions"><Button type="submit" variant="secondary" disabled={!canSave}>Save Check</Button>{recordedAt && onUnconfirm && <Button type="button" variant="tertiary" onClick={() => onUnconfirm([MANUAL_REVIEW_ID])}>Remove Record</Button>}</div>
    </form>}
  </section>
}
