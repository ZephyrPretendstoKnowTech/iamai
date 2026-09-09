// The Step Contract's components (Foundation D). Every Plan step — and every
// Plan row — is drawn with these, so a step answers the same questions in the
// same order whatever it is: where it is now, why it matters, what IAMAI found,
// who it touches, what to do, what to fix first, and how you will know it is
// done.
//
// They render a StepContract (stepContract.ts) and nothing else. There is no
// engine reading here: no `implementationOffered`, no `unavailableReason`, no
// blocker evaluation, no lifecycle arithmetic. Those questions were answered
// below the UI, and asking them again in a component is how two answers to one
// question got onto one screen.
import type { ReactNode } from 'react'
import { Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import type { ContractFix, ContractFound, ContractMember, StepContract } from './stepContract.ts'
import { CONTRACT } from './stepContract.ts'

/**
 * One row of the Plan: the state word, the title, who it touches and when.
 *
 * The one row shape, for a step and for a Cleanup item alike — before this, each
 * surface built its own and they drifted apart a column at a time. It stays
 * deliberately thin: at ~38 baseline policies the collapsed rows are what makes
 * the Plan readable, so a row says only enough to decide whether to open it.
 *
 * Task 033 restored the four zones the approved Plan pack draws
 * (`docs/design/approved/plan-step-v1.html`, `.roadmap-row`):
 *
 *     status | title over its quiet reason | who | when
 *
 * The zones carry production's facts and nothing else — `statusOf`,
 * `contentTitle`, `rowReason`, `rowWho`, `rowWhen`, each already the one
 * authority for what it says. What changed is where the row puts them: the
 * reason was a full-width line under the whole row, so a blocked step's cause
 * sat under the state column rather than under the title it belongs to, and the
 * who and when floated at the end of a wrapping flex line instead of holding
 * columns that align down the page. Nothing here recomputes a state, a date or
 * a count.
 */
export function PlanRow({ word, tone, title, who, when, whenReason = false, reason = null, nextLabel = null, open, onToggle }: {
  word: string
  tone: StatusTone
  title: string
  who: string
  when: string
  /** The date column carries a reason rather than a date, so it wraps instead of pushing the row wide. */
  whenReason?: boolean
  /** The one binding reason, under the row; null where the row has none. */
  reason?: string | null
  /** "Next" beside the title on the first step that is ready to be worked on. */
  nextLabel?: string | null
  open: boolean
  onToggle: () => void
}) {
  // A row is a disclosure: it opens the step under it and closes it again. It
  // says both — that it is a control, and whether the step it controls is open
  // — or a screen reader meets a focusable line of text that promises nothing
  // (task 017). The keyboard behaviour it already had is what the role claims.
  return (
    <div
      className="plan-row"
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <span className="plan-row-status">
        <Status tone={tone}>{word}</Status>
      </span>
      {/* The pack's `.row-title`: the title, and under it the one quiet line
          that says why the row is in the state the first zone names. */}
      <span className="plan-row-title">
        <span className="step-title">{title}</span>
        {nextLabel && (
          <span className="next-mark" aria-label={nextLabel}>
            {nextLabel}
          </span>
        )}
        {reason && <span className="plan-row-reason">{reason}</span>}
      </span>
      <span className="who">{who}</span>
      <span className={`when${whenReason ? ' when-reason' : ''}`}>{when}</span>
    </div>
  )
}

/**
 * Where the step is, on both axes, and when the next thing happens.
 *
 * The lifecycle stage and the condition are two facts and are printed as two
 * (Foundation B): "Report-only · Blocked", "Enforced · Review required". The
 * condition is stated beside a stage always, and on its own only when it has
 * something to say — a prerequisite that is simply fine says nothing here rather
 * than "Healthy", which beside a list of failing checks would read as a
 * contradiction.
 *
 * The Next line renders only where Foundation B has a date for it. Undated, the
 * next milestone and What to do are the same fact, and What to do is the more
 * specific of the two.
 */
export function StepState({ contract }: { contract: StepContract }) {
  const s = contract.state
  const showCondition = s.stage !== '' || s.condition !== 'healthy'
  if (s.stage === '' && !showCondition && contract.milestone.line === null) return null
  return (
    <>
      {(s.stage !== '' || showCondition) && (
        <p className="step-state">
          {s.stage !== '' && <span className="stage">{s.stage}</span>}
          {s.stage !== '' && showCondition && <span aria-hidden="true"> · </span>}
          {showCondition && <span className={`condition condition-${s.condition}`}>{s.conditionLabel}</span>}
        </p>
      )}
      {contract.milestone.line && <p className="step-next">{contract.milestone.line}</p>}
    </>
  )
}

/**
 * The step's required policy members, where there is more than one.
 *
 * A goal the baseline implements with two policies is one step delivering two
 * objects, each with its own name, its own stage and its own history
 * (Foundation B). Neither of them is shown as the step, and neither stands for
 * the other. A step with one policy renders nothing here, so the ordinary row
 * stays as light as it was.
 */
export function PolicyMembers({ members }: { members: ContractMember[] }) {
  if (members.length < 2) return null
  return (
    <ul className="step-members">
      {members.map((m) => (
        <li key={m.key}>
          {m.label && <span className="member-label">{m.label}</span>} {m.line}
        </li>
      ))}
    </ul>
  )
}

/** A contract section: its heading and its content, or nothing at all. §8.7: a heading with nothing under it is not rendered. */
export function StepSection({ heading, when = true, children }: { heading: string; when?: boolean; children: ReactNode }) {
  if (!when) return null
  return (
    <>
      <h3>{heading}</h3>
      {children}
    </>
  )
}

/** What this scan observed that bears on the decision. Conditional: nothing is invented to fill it. */
export function WhatIamaiFound({ found }: { found: ContractFound[] }) {
  if (found.length === 0) return null
  return (
    <StepSection heading={CONTRACT.foundHeading}>
      <ul className="sections">
        {found.map((f) => (
          <li key={f.key}>{f.text}</li>
        ))}
      </ul>
    </StepSection>
  )
}

/**
 * What must be fixed before the step can move.
 *
 * Only what is outstanding: a check that passes is not in the list the
 * validation authority hands over, so it disappears from here the moment it
 * passes rather than sitting as cleared clutter. It is a section of its own and
 * not advice inside another one, because a blocker that reads as optional is a
 * blocker somebody skips.
 */
export function FixBeforeContinuing({ fix }: { fix: ContractFix[] }) {
  if (fix.length === 0) return null
  return (
    <StepSection heading={CONTRACT.fixHeading}>
      <ol className="sections blocking">
        {fix.map((f) => (
          <li key={f.key}>{f.text}</li>
        ))}
      </ol>
    </StepSection>
  )
}

/** The one next operator action. Every step has one, so this never renders nothing. */
export function WhatToDoLead({ contract }: { contract: StepContract }) {
  return <p className={`do-lead do-${contract.whatToDo.kind}`}>{contract.whatToDo.text}</p>
}

/** How the operator will know the step is finished. Always at least one concrete line. */
export function DoneWhen({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <StepSection heading={heading}>
      <ul className="sections">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </StepSection>
  )
}
