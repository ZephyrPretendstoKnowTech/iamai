// Define Your Rollout Scope, drawn (docs/plans/direction-spec.md): the
// Questions section of a decision-anatomy step.
//
// One tile per question: the pre-filled or saved answer as its control, the
// evidence (what the scan saw, and nothing where it saw nothing: walk list 14),
// what the answer does to the plan, and whether it is approved.
// One Approve answers button, in the step's action column, saves every answer
// in the step at once, through the step's own decision
// (roadmap/directionAnswers.ts writes them where they have always been stored).
// The opened step holds the draft both read (useDirectionDraft). Any answer can
// be changed afterwards and approved again, and a change stays on its card until
// it is approved or changed back, across closing the step and moving between
// pages (directionDrafts.ts, F-042).
//
// The controls are the ones the Plan's decisions already use: the dropdown the
// decision options draw (`decision-select`) and the shared Picker over the
// pickers' own universes (pickerRows.ts). Every word is content.json's.
import { useEffect, useId, useMemo, useState } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { DirectionQuestion } from '../../roadmap/types.ts'
import type { StepDecisionInput } from '../../roadmap/decisions.ts'
import { AVD_USERS_STORAGE, directionAnswerComplete, directionAsked, directionDecisionOf, directionDraftOf, savedAnswerOf, trustedIpLocations } from '../../roadmap/directionAnswers.ts'
import { searchGroups } from '../../graph/collect/onDemand.ts'
import type { DirectionAnswer } from '../../roadmap/directionAnswers.ts'
import { answerTextOf } from '../../roadmap/direction.ts'
import { directionWords, stepById } from '../../content/content.ts'
import { Button, Picker } from '../components/index.ts'
import type { PickerOption } from '../components/index.ts'
import { accountBadges, filterPickerObjects, pickerUniverse } from './pickerRows.ts'
import { adminPickedLine, adminsOf, withAccountMark } from './accountMarks.ts'
import type { PickerObject } from './pickerRows.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { QUESTION_STEP } from '../../roadmap/answers.ts'
import type { StepVarContext } from './stepVars.ts'
import { draftSlot, heldAnswers, holdAnswer, questionBasis, releaseStep } from './directionDrafts.ts'

const W = directionWords

/** The universe a question picks from: accounts or the tenant's IP locations (pickerRows.ts). */
function universeOf(q: DirectionQuestion, ctx: StepVarContext): PickerObject[] {
  const pickerCtx = { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }
  if (q.control === 'accounts') {
    // Each chip says why its account was picked, where the detection picked it (pickerRows.ts accountBadges).
    const why = accountBadges(q.key, pickerCtx)
    // The mail-sending card picks from its own list: no emergency access account or guest, and a sender says why (pickerRows.ts pickerUniverse).
    const stepId = q.key === 'mailDevices' ? QUESTION_STEP.mailDevices : PREREQ_STEP_ID.serviceAccountsGroup
    // An administrator, or the account signed in now, says so in the list and on its chip: picked here it becomes a service account (F-056).
    const admins = adminsOf(ctx.snapshot)
    return pickerUniverse(stepId, 'accounts', pickerCtx).map((o) => withAccountMark(why.has(o.id) ? { ...o, badge: why.get(o.id) } : o, admins, ctx.operatorId))
  }
  if (q.control === 'locations') return pickerUniverse(PREREQ_STEP_ID.trustedLocation, 'locations', pickerCtx)
  // The groups the plan knows (pickerRows.ts), for the Azure Virtual Desktop groups (T2-AVD).
  if (q.control === 'groups') return pickerUniverse(AVD_USERS_STORAGE, 'groups', pickerCtx)
  return []
}

/**
 * The tenant's groups whose name starts with what is typed, read on demand
 * (graph/collect/onDemand.ts searchGroups, the registry's Group search lane):
 * the group Azure Virtual Desktop is assigned to is often named by no policy,
 * so the groups the plan already read may not hold it. Nothing typed, or a read
 * that fails, offers nothing more.
 */
function useGroupSearch(enabled: boolean, query: string, tenantId: string): PickerObject[] {
  const [found, setFound] = useState<PickerObject[]>([])
  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 2) {
      setFound([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchGroups(q, tenantId).then((rows) => { if (!cancelled) setFound(rows.map((g) => ({ id: g.id, name: g.displayName }))) }).catch(() => { if (!cancelled) setFound([]) })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, query, tenantId])
  return found
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
type CardTag = 'suggested' | 'approved' | 'notApproved' | 'optional'
function cardTagOf(q: DirectionQuestion, a: DirectionAnswer): CardTag {
  if (optionalEmpty(q, a)) return 'optional'
  if ((q.saved === null || q.needsReview) && sameAnswer(q, a, q.suggested)) return 'suggested'
  if (q.saved !== null && !q.needsReview && sameAnswer(q, a, q.saved)) return 'approved'
  return 'notApproved'
}
const TAG_WORDS: Readonly<Record<CardTag, string>> = { suggested: W.suggested, approved: W.approved, notApproved: W.notApproved, optional: W.optional }
/** An optional question left empty (owner, 2026-10-04): nothing to approve, and nothing it blocks but its own step. */
const optionalEmpty = (q: DirectionQuestion, a: DirectionAnswer): boolean => q.optional === true && !directionAnswerComplete(q, a)

function QuestionTile({ q, tag, answer, onAnswer, ctx, printing }: { q: DirectionQuestion; tag: CardTag; answer: DirectionAnswer; onAnswer: (a: DirectionAnswer) => void; ctx: StepVarContext; printing: boolean }) {
  const known = useMemo(() => universeOf(q, ctx), [q, ctx])
  const [query, setQuery] = useState('')
  // A group picker also offers the tenant's groups that match what is typed, read on demand.
  const searched = useGroupSearch(q.control === 'groups' && !printing, query, ctx.snapshot.tenantId)
  const universe = useMemo(() => [...known, ...searched.filter((g) => !known.some((o) => o.id.toLowerCase() === g.id.toLowerCase()))], [known, searched])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const nameOf = (id: string): string => byId.get(id)?.name ?? ctx.nameOf(id)
  const chips: PickerOption[] = answer.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const suggestions: PickerOption[] = q.suggested.picked.map((id) => byId.get(id) ?? { id, name: nameOf(id) })
  const labelId = `direction-${q.key.replace(/[^a-z0-9]+/gi, '-')}`
  const picks = q.pickedWith !== null && answer.value === q.pickedWith
  // What the answer on screen does, in one line, and it changes with the answer (owner, 2026-09-24).
  const chosen = q.chosen?.[answer.value] ?? null
  // An Emergency Access subject card (ContentStep.tsx EmergencyAccountStatusTile),
  // filled with a question: the state where that card carries its subject label,
  // the question where it carries its title, then the control on a row of its
  // own, the evidence under it, what the answer does, and the list picker last.
  return (
    <article className="emergency-account-status direction-question" data-question={q.key}>
      <p className="emergency-account-label direction-question-state">{TAG_WORDS[tag]}</p>
      <h5 id={labelId}>{q.label}</h5>
      {printing ? <p>{answerTextOf(q, answer, nameOf)}</p> : q.options.length > 0 && (
        <select className="decision-select" aria-labelledby={labelId} value={answer.value} onChange={(e) => onAnswer({ value: e.currentTarget.value, picked: answer.picked })}>
          {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {q.evidence && <p>{q.evidence}</p>}
      {q.today && <p>{q.today}</p>}
      {chosen && <p>{chosen}</p>}
      {q.note && <p>{q.note}</p>}
      {!printing && picks && (
        <div className="direction-question-picker">
          <Picker labelledBy={labelId} selected={chips} options={results} suggestions={suggestions} onChange={(next) => onAnswer({ value: answer.value, picked: next.map((c) => c.id) })} onSearch={setQuery} />
        </div>
      )}
    </article>
  )
}

/** A Direction step's draft: each card's answer as it stands on screen, which the cards change and Approve answers saves. */
export type DirectionDraft = {
  questions: readonly DirectionQuestion[]
  answerOf: (q: DirectionQuestion) => DirectionAnswer
  setAnswer: (key: string, a: DirectionAnswer) => void
  /** Let the step's changes go once they are approved. */
  release: () => void
}

/**
 * The draft, held by the opened step (ContentStep.tsx) so the cards in its main
 * column and Approve answers in its action column read one draft. Only the
 * person's changes are kept, each under its own question's saved answer: once
 * that answer is saved or a scan reopens it, that card starts again from
 * directionDraftOf, and Approve lets the step's changes go. The changes are held
 * for the session (directionDrafts.ts), so the step opens on them again (F-042).
 */
export function useDirectionDraft(step: Step, tenantId: string): DirectionDraft {
  const questions = step.directionQuestions ?? []
  const slot = draftSlot(tenantId, step.id)
  // The held changes are the draft's own record, written on every change; this only redraws the cards.
  const [, redraw] = useState(0)
  const own = heldAnswers(slot, questions)
  return {
    questions,
    answerOf: (q) => own[q.key] ?? directionDraftOf(q),
    setAnswer: (k, a) => {
      const q = questions.find((x) => x.key === k)
      if (!q) return
      holdAnswer(slot, k, questionBasis(q), a)
      redraw((n) => n + 1)
    },
    release: () => {
      releaseStep(slot)
      redraw((n) => n + 1)
    },
  }
}

/** The draft's questions that are asked, each read against the draft on screen (directionAnswers.ts directionAsked). */
function askedOf(draft: DirectionDraft): DirectionQuestion[] {
  return draft.questions.filter((q) => directionAsked(q, draft.questions, draft.answerOf))
}

/**
 * The Questions section: the Not sure line, only while a card reads Suggested
 * and never on paper, and one tile per question.
 */
export function DirectionQuestions({ draft, ctx, heading, printing = false }: { draft: DirectionDraft; ctx: StepVarContext; heading: string; printing?: boolean }) {
  const { answerOf, setAnswer } = draft
  // A question that follows another's answer shows only while the card it follows reads that answer (T2-AVD).
  const questions = askedOf(draft)
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
export function ApproveAnswers({ draft, onDecide, saving = false, ctx }: { draft: DirectionDraft; onDecide?: (decision: StepDecisionInput) => void; saving?: boolean; ctx?: StepVarContext }) {
  const { answerOf } = draft
  // Only the questions asked are required and saved: the Azure Virtual Desktop groups only while it reads Yes (T2-AVD).
  const questions = askedOf(draft)
  const empty = questions.filter((q) => !q.optional && !directionAnswerComplete(q, answerOf(q)))
  // An optional question left empty is nothing to approve, unless it clears a saved answer.
  const pending = questions.some((q) => { const tag = cardTagOf(q, answerOf(q)); return tag === 'optional' ? q.saved !== null : tag !== 'approved' })
  const approve = (): void => {
    if (empty.length > 0 || !pending) return
    const answers = Object.fromEntries(questions.map((q) => [q.key, answerOf(q)]))
    const basis = Object.fromEntries(questions.filter((q) => q.basis !== null).map((q) => [q.key, q.basis as string]))
    onDecide?.(directionDecisionOf(answers, basis))
    // Approved: the cards read the saved answers from here, as the save normalised them.
    draft.release()
  }
  const why = [...new Set(empty.map((q) => q.control === 'locations' ? W.pickLocation : q.control === 'groups' ? W.pickGroup : W.pickAccount))]
  // An administrator or the signed-in account picked as a service or shared-device account says so before it is approved (F-056).
  const picked = questions.flatMap((q) => { const a = answerOf(q); return q.control === 'accounts' && q.pickedWith !== null && a.value === q.pickedWith ? a.picked : [] })
  const adminLine = ctx ? adminPickedLine(picked, adminsOf(ctx.snapshot), ctx.operatorId, ctx.nameOf, savedAnswerOf('officeNetwork', ctx.mapping)?.value === 'remote') : null
  return (
    <div className="direction-approve">
      <Button variant="primary" disabled={empty.length > 0 || !pending || saving || !onDecide} onClick={approve}>{W.approve}</Button>
      {why.map((line) => <p key={line} className="reason">{line}</p>)}
      {adminLine && <p className="reason">{adminLine}</p>}
    </div>
  )
}

/**
 * Define the Trusted Network's own controls (owner, 2026-09-24): which of the
 * locations Entra already trusts are the office, where the scan read any, and
 * Everyone works remotely. Each saves Decide How and Where People Sign In's own
 * Office network answer (directionAnswers.ts directionDecisionWith), so the
 * answer is stored once and reads the same on both steps.
 */
export function OfficeNetworkRail({ ctx, picked, onAnswer }: { ctx: StepVarContext; picked: readonly string[]; onAnswer: (a: DirectionAnswer) => void }) {
  const O = W.questions.officeNetwork
  const labelId = useId()
  const universe = useMemo(() => pickerUniverse(PREREQ_STEP_ID.trustedLocation, 'locations', { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups, directory: ctx.directory }), [ctx.snapshot, ctx.mapping, ctx.nameOf, ctx.groups, ctx.directory])
  const byId = useMemo(() => new Map(universe.map((o) => [o.id, o])), [universe])
  const trusted = trustedIpLocations(ctx.snapshot) ?? []
  // Nothing picked yet: the locations Entra trusts, pre-filled as the suggestion,
  // and a Save beside them, since nothing is the office until it is saved.
  const [chips, setChips] = useState<PickerOption[]>(() => (picked.length > 0 ? picked : trusted.map((l) => l.id)).map((id) => byId.get(id) ?? { id, name: trusted.find((l) => l.id === id)?.name ?? id }))
  const prefilled = picked.length === 0 && chips.length > 0
  const [query, setQuery] = useState('')
  const results = useMemo(() => filterPickerObjects(universe, query), [universe, query])
  const suggestions: PickerOption[] = trusted.filter((l) => !chips.some((c) => c.id === l.id)).map((l) => byId.get(l.id) ?? { id: l.id, name: l.name })
  const save = String((stepById[PREREQ_STEP_ID.trustedLocation] as { decision?: { save?: string } } | undefined)?.decision?.save ?? '')
  return (
    <div className="decision">
      <h5 className="dlabel action-heading" id={labelId}>{O.label}</h5>
      {trusted.length > 0 && (
        <Picker labelledBy={labelId} selected={chips} options={results} suggestions={suggestions} onChange={setChips} onSearch={setQuery} onCommit={(next) => { if (next.length > 0) onAnswer({ value: 'office', picked: next.map((c) => c.id) }) }} />
      )}
      {trusted.length > 0 && prefilled && <Button variant="secondary" onClick={() => onAnswer({ value: 'office', picked: chips.map((c) => c.id) })}>{save}</Button>}
      <Button variant="secondary" onClick={() => onAnswer({ value: 'remote', picked: [] })}>{O.options.remote}</Button>
    </div>
  )
}
