// Define Your Rollout Scope, drawn (docs/plans/direction-spec.md): the
// Questions section of a decision-anatomy step, and the "Answered in" block a
// step shows where its question used to be asked.
//
// One tile per question: the pre-filled or saved answer as its control, one line
// of evidence (why it was suggested, or that it is a default the scan did not
// see), today beside a how-it-should-work answer, and whether it is approved.
// One Approve answers button, in the step's action column, saves every answer
// in the step at once, through the step's own decision
// (roadmap/directionAnswers.ts writes them where they have always been stored).
// The opened step holds the draft both read (useDirectionDraft). Any answer can
// be changed afterwards and approved again.
//
// The controls are the ones the Plan's decisions already use: the dropdown the
// decision options draw (`decision-select`) and the shared Picker over the
// pickers' own universes (pickerRows.ts). Every word is content.json's.
import { useMemo, useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { DirectionQuestion } from '../../roadmap/types.ts'
import type { StepDecisionInput } from '../../roadmap/decisions.ts'
import { directionAnswerComplete, directionDecisionOf, directionDraftOf } from '../../roadmap/directionAnswers.ts'
import type { DirectionAnswer } from '../../roadmap/directionAnswers.ts'
import { answerTextOf, answeredInOf } from '../../roadmap/direction.ts'
import { directionWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { Button, Picker } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import type { PickerObject } from './pickerRows.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import type { StepVarContext } from './stepVars.ts'
import { CONTRACT } from './stepContract.ts'
import { returnToStep } from '../shell/routes.ts'

const W = directionWords

/** The universe a question picks from: accounts or the tenant's IP locations (pickerRows.ts). */
function universeOf(q: DirectionQuestion, ctx: StepVarContext): PickerObject[] {
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
  if (q.control === 'accounts') return pickerUniverse(PREREQ_STEP_ID.serviceAccountsGroup, 'accounts', pickerCtx)
  if (q.control === 'locations') return pickerUniverse(PREREQ_STEP_ID.trustedLocation, 'locations', pickerCtx)
  return []
}


/** Two answers to one question alike: the same option and, where that option takes a list, the same list in any order. */
function sameAnswer(q: DirectionQuestion, a: DirectionAnswer, b: DirectionAnswer): boolean {
  if (a.value !== b.value) return false
  if (q.pickedWith === null || a.value !== q.pickedWith) return true
  return a.picked.length === b.picked.length && a.picked.every((id) => b.picked.includes(id))
}

/**
 * A card's tag, which follows its draft (owner, 2026-09-23): Suggested only
 * while the answer is the suggestion nobody has saved (nothing is saved, or a
 * scan reopened the saved answer), Approved only while it is the saved answer,
 * otherwise Not approved yet.
 */
type CardTag = 'suggested' | 'approved' | 'notApproved'
function cardTagOf(q: DirectionQuestion, a: DirectionAnswer): CardTag {
  if ((q.saved === null || q.needsReview) && sameAnswer(q, a, q.suggested)) return 'suggested'
  if (q.saved !== null && !q.needsReview && sameAnswer(q, a, q.saved)) return 'approved'
  return 'notApproved'
}
const TAG_WORDS: Readonly<Record<CardTag, string>> = { suggested: W.suggested, approved: W.approved, notApproved: W.notApproved }

function QuestionTile({ q, tag, answer, onAnswer, ctx, printing }: { q: DirectionQuestion; tag: CardTag; answer: DirectionAnswer; onAnswer: (a: DirectionAnswer) => void; ctx: StepVarContext; printing: boolean }) {
  const universe = useMemo(() => universeOf(q, ctx), [q, ctx])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const nameOf = (id: string): string => byId.get(id)?.name ?? ctx.nameOf(id)
  const chips: PickerOption[] = answer.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const suggestions: PickerOption[] = q.suggested.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const labelId = `direction-${q.key.replace(/[^a-z0-9]+/gi, '-')}`
  const picks = q.pickedWith !== null && answer.value === q.pickedWith
  // An Emergency Access subject card (ContentStep.tsx EmergencyAccountStatusTile),
  // filled with a question: the state where that card carries its subject label,
  // the question where it carries its title, then the control on a row of its
  // own, the evidence under it, and the list picker last.
  return (
    <article className="emergency-account-status direction-question" data-question={q.key}>
      <p className="emergency-account-label direction-question-state">{TAG_WORDS[tag]}</p>
      <h5 id={labelId}>{q.label}</h5>
      {printing ? <p>{answerTextOf(q, answer, nameOf)}</p> : q.options.length > 0 && (
        <select className="decision-select" aria-labelledby={labelId} value={answer.value} onChange={(e) => onAnswer({ value: e.currentTarget.value, picked: answer.picked })}>
          {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <p>{q.evidence}</p>
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

/** The saved answers and which of them a scan reopened: a save or a reopening starts the draft again (directionDraftOf). */
const directionDraftKey = (step: Step): string => JSON.stringify((step.directionQuestions ?? []).map((q) => [q.saved, q.needsReview]))

/** A Direction step's draft: each card's answer as it stands on screen, which the cards change and Approve answers saves. */
export type DirectionDraft = {
  questions: readonly DirectionQuestion[]
  answerOf: (q: DirectionQuestion) => DirectionAnswer
  setAnswer: (key: string, a: DirectionAnswer) => void
}

/**
 * The draft, held by the opened step (ContentStep.tsx) so the cards in its main
 * column and Approve answers in its action column read one draft. Only the
 * person's changes are kept, under the key they were made against: once the
 * saved answers or a reopening change (directionDraftKey), every card starts
 * again from directionDraftOf.
 */
export function useDirectionDraft(step: Step): DirectionDraft {
  const questions = step.directionQuestions ?? []
  const key = directionDraftKey(step)
  const [edits, setEdits] = useState<{ key: string; answers: Readonly<Record<string, DirectionAnswer>> }>({ key, answers: {} })
  const own = edits.key === key ? edits.answers : {}
  return {
    questions,
    answerOf: (q) => own[q.key] ?? directionDraftOf(q),
    setAnswer: (k, a) => setEdits((e) => ({ key, answers: { ...(e.key === key ? e.answers : {}), [k]: a } })),
  }
}

/**
 * The Questions section: the Not sure line, only while a card reads Suggested
 * and never on paper, and one tile per question.
 */
export function DirectionQuestions({ draft, ctx, heading, printing = false }: { draft: DirectionDraft; ctx: StepVarContext; heading: string; printing?: boolean }) {
  const { questions, answerOf, setAnswer } = draft
  const tags = new Map(questions.map((q) => [q.key, cardTagOf(q, answerOf(q))]))
  return (
    <section className="step-section direction-section">
      <h4>{heading}</h4>
      {!printing && [...tags.values()].includes('suggested') && <p className="reason">{W.notSure}</p>}
      {/* The Emergency Access subject grid (ContentStep.tsx EmergencySubjectReadiness):
          two columns of cards that size to their own content, so a question that
          opens a picker never stretches the one beside it. */}
      <div className="emergency-account-status-grid">
        {questions.map((q) => <QuestionTile key={q.key} q={q} tag={tags.get(q.key) ?? 'notApproved'} answer={answerOf(q)} onAnswer={(a) => setAnswer(q.key, a)} ctx={ctx} printing={printing} />)}
      </div>
    </section>
  )
}

/**
 * Approve answers, in the step's action column under its instruction, as every
 * other step's controls are (owner, 2026-09-23). It saves every answer in the
 * step at once. It is enabled only while there is something to approve: a card
 * whose answer differs from what is saved, or that still holds a suggestion
 * nobody has saved — every card not reading Approved. A list nobody has picked
 * from disables it and says why under it; `saving` disables it while a save runs.
 */
export function ApproveAnswers({ draft, onDecide, saving = false }: { draft: DirectionDraft; onDecide?: (decision: StepDecisionInput) => void; saving?: boolean }) {
  const { questions, answerOf } = draft
  const empty = questions.filter((q) => !directionAnswerComplete(q, answerOf(q)))
  const pending = questions.some((q) => cardTagOf(q, answerOf(q)) !== 'approved')
  const approve = (): void => {
    if (empty.length > 0 || !pending) return
    const answers = Object.fromEntries(questions.map((q) => [q.key, answerOf(q)]))
    const basis = Object.fromEntries(questions.filter((q) => q.basis !== null).map((q) => [q.key, q.basis as string]))
    onDecide?.(directionDecisionOf(answers, basis))
  }
  const why = [...new Set(empty.map((q) => q.control === 'locations' ? W.pickLocation : W.pickAccount))]
  return (
    <div className="direction-approve">
      <Button variant="primary" disabled={empty.length > 0 || !pending || saving || !onDecide} onClick={approve}>{W.approve}</Button>
      {why.map((line) => <p key={line} className="reason">{line}</p>)}
    </div>
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
