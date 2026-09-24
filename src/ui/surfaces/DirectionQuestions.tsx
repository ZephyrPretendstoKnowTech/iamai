// Define Your Rollout Scope, drawn (docs/plans/direction-spec.md): the
// Questions section of a decision-anatomy step, and the "Answered in" block a
// step shows where its question used to be asked.
//
// One tile per question: the pre-filled or saved answer as its control, one line
// of evidence (why it was suggested, or that it is a default the scan did not
// see), today beside a how-it-should-work answer, and whether it is approved.
// One Approve answers button saves every answer in the step at once, through
// the step's own decision (roadmap/directionAnswers.ts writes them where they
// have always been stored). Any answer can be changed afterwards and approved
// again.
//
// The controls are the ones the Plan's decisions already use: the dropdown the
// decision options draw (`decision-select`) and the shared Picker over the
// pickers' own universes (pickerRows.ts). Every word is content.json's.
import { useMemo, useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { DirectionQuestion } from '../../roadmap/types.ts'
import type { StepDecisionInput } from '../../roadmap/decisions.ts'
import { directionAnswerComplete, directionDecisionOf } from '../../roadmap/directionAnswers.ts'
import type { DirectionAnswer } from '../../roadmap/directionAnswers.ts'
import { answerTextOf, answeredInOf } from '../../roadmap/direction.ts'
import { directionWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { Button, Picker } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { accountBadges, filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import type { StepVarContext } from './stepVars.ts'
import { CONTRACT } from './stepContract.ts'
import { returnToStep } from '../shell/routes.ts'

const W = directionWords

/** The universe a question picks from: accounts or the tenant's IP locations (pickerRows.ts). */
function universeOf(q: DirectionQuestion, ctx: StepVarContext): PickerObject[] {
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
  if (q.control === 'accounts') {
    // Each chip says why its account was picked, where the detection picked it (pickerRows.ts accountBadges).
    const why = accountBadges(q.key, pickerCtx)
    return pickerUniverse(PREREQ_STEP_ID.serviceAccountsGroup, 'accounts', pickerCtx).map((o) => (why.has(o.id) ? { ...o, badge: why.get(o.id) } : o))
  }
  if (q.control === 'locations') return pickerUniverse(PREREQ_STEP_ID.trustedLocation, 'locations', pickerCtx)
  return []
}


function QuestionTile({ q, answer, onAnswer, ctx, printing }: { q: DirectionQuestion; answer: DirectionAnswer; onAnswer: (a: DirectionAnswer) => void; ctx: StepVarContext; printing: boolean }) {
  const universe = useMemo(() => universeOf(q, ctx), [q, ctx])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const nameOf = (id: string): string => byId.get(id)?.name ?? ctx.nameOf(id)
  const chips: PickerOption[] = answer.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const suggestions: PickerOption[] = q.suggested.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const labelId = `direction-${q.key.replace(/[^a-z0-9]+/gi, '-')}`
  const approved = q.saved !== null && !q.needsReview
  const picks = q.pickedWith !== null && answer.value === q.pickedWith
  // An Emergency Access subject card (ContentStep.tsx EmergencyAccountStatusTile),
  // filled with a question: the state where that card carries its subject label,
  // the question where it carries its title, then the control on a row of its
  // own, the evidence under it, and the list picker last.
  return (
    <article className="emergency-account-status direction-question" data-question={q.key}>
      <p className="emergency-account-label direction-question-state">{approved ? W.approved : W.suggested}</p>
      <h5 id={labelId}>{q.label}</h5>
      {printing ? <p>{answerTextOf(q, answer, nameOf)}</p> : q.options.length > 0 && (
        <select className="decision-select" aria-labelledby={labelId} value={answer.value} onChange={(e) => onAnswer({ value: e.currentTarget.value, picked: answer.picked })}>
          {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {q.evidence && <p>{q.evidence}</p>}
      {q.today && <p>{q.today}</p>}
      {q.note && <p>{q.note}</p>}
      {!printing && picks && (
        <div className="direction-question-picker">
          <Picker labelledBy={labelId} selected={chips} options={results} suggestions={suggestions} onChange={(next) => onAnswer({ value: answer.value, picked: next.map((c) => c.id) })} onSearch={setQuery} />
        </div>
      )}
    </article>
  )
}

/** The saved answers, as the Questions section's key: a save starts its draft again from them. */
export const directionDraftKey = (step: Step): string => JSON.stringify((step.directionQuestions ?? []).map((q) => q.saved))

/**
 * The Questions section: one tile per question, the Not sure line, and the one
 * Approve answers button. `saveStatus` disables the button while a save runs.
 */
export function DirectionQuestions({ step, ctx, heading, onDecide, printing = false, saving = false }: { step: Step; ctx: StepVarContext; heading: string; onDecide?: (decision: StepDecisionInput) => void; printing?: boolean; saving?: boolean }) {
  const questions = step.directionQuestions ?? []
  const [draft, setDraft] = useState<Record<string, DirectionAnswer>>(() => Object.fromEntries(questions.map((q) => [q.key, q.saved ?? q.suggested])))
  const answerOf = (q: DirectionQuestion): DirectionAnswer => draft[q.key] ?? q.saved ?? q.suggested
  const ready = questions.every((q) => directionAnswerComplete(q, answerOf(q)))
  const approve = (): void => {
    if (!ready) return
    const answers = Object.fromEntries(questions.map((q) => [q.key, answerOf(q)]))
    const basis = Object.fromEntries(questions.filter((q) => q.basis !== null).map((q) => [q.key, q.basis as string]))
    onDecide?.(directionDecisionOf(answers, basis))
  }
  return (
    <section className="step-section direction-section">
      <h4>{heading}</h4>
      <p className="reason">{W.notSure}</p>
      {/* The Emergency Access subject grid (ContentStep.tsx EmergencySubjectReadiness):
          two columns of cards that size to their own content, so a question that
          opens a picker never stretches the one beside it. */}
      <div className="emergency-account-status-grid">
        {questions.map((q) => <QuestionTile key={q.key} q={q} answer={answerOf(q)} onAnswer={(a) => setDraft((d) => ({ ...d, [q.key]: a }))} ctx={ctx} printing={printing} />)}
      </div>
      {!printing && <Button variant="primary" disabled={!ready || saving || !onDecide} onClick={approve}>{W.approve}</Button>}
    </section>
  )
}

/**
 * Where a step's question used to be asked (the object and policy steps whose
 * questions moved to Direction): "Answered in <step>", the answer, and a link.
 */
export function AnsweredInDirection({ stepId, ctx }: { stepId: string; ctx: StepVarContext }) {
  const answered = useMemo(() => answeredInOf(stepId, ctx), [stepId, ctx])
  if (!answered) return null
  return (
    <div className="decision-form answered-in-direction">
      <div className="decision">
        <h5 className="dlabel action-heading">{fillText(W.answeredIn, { step: answered.title })}</h5>
        {answered.lines.map((l) => <p key={l.key} className="reason"><strong>{l.label}</strong>: {l.value}</p>)}
        <p><a className="inline-link" href={returnToStep(answered.step)}>{fillText((CONTRACT.readiness.tiles as { openStep: string }).openStep, { step: answered.title })}</a></p>
      </div>
    </div>
  )
}
