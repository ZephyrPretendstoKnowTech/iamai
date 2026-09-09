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
import { Callout, Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { ContractFix, ContractFound, ContractMember, ContractStage, StepContract } from './stepContract.ts'
import { CONTRACT, railBlocks, stageClass } from './stepContract.ts'

/**
 * One row of the Plan: the state word, the title, who it touches and when.
 *
 * The one row shape, for a step and for a Cleanup item alike — before this, each
 * surface built its own and they drifted apart a column at a time. It stays
 * deliberately thin: at ~38 baseline policies the collapsed rows are what makes
 * the Plan readable, so a row says only enough to decide whether to open it.
 *
 * Task 033 restored the four zones the approved Plan pack draws
 * (`docs/design/approved/anatomy/plan-step-v1.html`, `.roadmap-row`):
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
 * The opened step's head, as the approved Plan pack draws it
 * (`docs/design/approved/anatomy/plan-step-v1.html` `.step-head`): an eyebrow naming
 * what kind of step this is, the title, the supporting line under it, and the
 * state badge held to the right of all three. Below them the lifecycle track.
 *
 * The head is the first thing under the row it attaches to, and it repeats the
 * row's title on purpose: the row is the board and the head is the step, and the
 * pack draws the title in both.
 *
 * Everything here is handed to it. Nothing in the head reads a step, a lifecycle
 * or a date.
 */
export function StepHead({ eyebrow = null, title, sub = null, word, tone, track = [], children }: {
  /** What kind of step this is (pages.app.plan.stepContract.kind); null where the kind has no label. */
  eyebrow?: string | null
  title: string
  /** The one supporting line under the title; null where the step has none. */
  sub?: ReactNode
  word: string
  tone: StatusTone
  track?: ContractStage[]
  /** Where the step is and what happens next — the pack's track caption, above the track it captions. */
  children?: ReactNode
}) {
  return (
    <header className="step-head">
      <div className="step-head-top">
        <div className="step-head-lead">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3 className="step-title">{title}</h3>
          {sub}
        </div>
        <Status tone={tone} pill>
          {word}
        </Status>
      </div>
      {children}
      <LifecycleTrack track={track} />
    </header>
  )
}

/**
 * The four rollout stages, drawn as the pack draws them: a bar per stage with
 * the stage it is at marked and its label under it, captioned by where the step
 * is and what happens next (`StepState`, immediately above it in the head).
 *
 * It renders `contract.track` and decides nothing. The stages are a list, not
 * four decorative bars: each label is real text a screen reader reads in order,
 * and the one the step is at carries `aria-current="step"`, so where the step is
 * never depends on telling two colours apart. The bar itself is the picture of
 * that same fact and is hidden from assistive technology.
 */
export function LifecycleTrack({ track }: { track: ContractStage[] }) {
  if (track.length === 0) return null
  return (
    <div className="track-wrap">
      <ol className="track" aria-label={CONTRACT.trackLabel}>
        {track.map((s) => (
          <li key={s.key} className={stageClass(s)} aria-current={s.current ? 'step' : undefined}>
            <span className="stage-bar" aria-hidden="true">
              <span className="stage-fill" />
            </span>
            <span className="stage-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * The opened step's right rail (`.step-side` in the pack): the supporting facts
 * that summarise the step, beside the main column rather than in it.
 *
 * Every block is a fact the contract already holds, shown only where it has one.
 * Nothing is filled in to make the rail look populated — a step with no dated
 * milestone shows no milestone block, and where the whole rail is empty there is
 * no rail and the body is one column.
 *
 * Task 036 completed it with the pack's In-place block, which was the one side
 * block production had a truthful source for and was not drawing. The pack's
 * remaining sample blocks — a Readiness list of PASSED prerequisites, a
 * strength comparison against the baseline — stay unbuilt: production surfaces
 * only what is outstanding, and it holds no structured "how much stronger"
 * fact. Inventing either to fill the column is what §5 forbids.
 */
/** The three implementation channels, in the order What to do offers them. */
const CHANNELS = ['portal', 'json', 'powershell']

export function StepRail({ contract }: { contract: StepContract }) {
  const m = contract.milestone
  const existing = contract.existing
  const { milestone: showMilestone, implementation: showImplementation } = railBlocks(contract)
  if (!showMilestone && !showImplementation && existing === null) return null
  return (
    <aside className="step-side surface-inset">
      {/* A goal the tenant already delivers has no milestone and no
          implementation to summarise, so before task 036 its rail was empty and
          the In-place step drew none at all — while the approved pack's own
          In-place variant is defined by this block
          (`docs/design/approved/anatomy/plan-step-v1.html` V4: "Existing
          implementation" over the policy's name).

          The name is the classifier's (`contract.existing`, which is
          `Step.satisfiedBy` read once and shared with the finding in the main
          column): the tenant's own policy under the tenant's own name, never
          the baseline's, and never one this scan did not classify. Where two
          policies cover the goal between them both are named and the sub says
          so, because the rail must not present a policy that does not cover the
          goal as the one that delivers it. */}
      {existing !== null && (
        <div className="side-block">
          <div className="key-label">{CONTRACT.railExisting}</div>
          <p className="metric metric-name">{existing.names.join(' · ')}</p>
          <p className="metric-sub">{existing.together ? CONTRACT.railExistingTogether : CONTRACT.railExistingKeep}</p>
        </div>
      )}
      {showMilestone && (
        <div className="side-block">
          <div className="key-label">{CONTRACT.railMilestone}</div>
          {m.at !== null && <p className="metric">{absoluteDate(m.at)}</p>}
          <p className="metric-sub">{m.gatedBy ?? m.label}</p>
        </div>
      )}
      {showImplementation && (
        <div className="side-block">
          <div className="key-label">{CONTRACT.railImplementation}</div>
          {/* Foundation A's one answer, said as availability rather than as a
              second reason: why an implementation is withheld is the step's
              What to do and is stated once, in the main column.

              Task 035 put it in the pack's side-list grammar
              (`docs/design/approved/anatomy/plan-step-v1.html` `.side-list`): one item
              per channel where the step offers them. That is the same one
              answer, listed rather than said in a sentence — the three channels
              stand or fall together on `implementationOffered`
              (roadmap/operations.ts, which is also `stepJson.jsonOffered`), so
              the rail cannot name a channel the main column withholds. A step
              that offers none shows the one line saying so and no list. */}
          {contract.implementation.offered ? (
            <ul className="side-list">
              {CHANNELS.map((c) => (
                <li key={c}>
                  <span className="tiny" aria-hidden="true" />
                  <span>{CONTRACT.railChannels[c]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="metric-sub">{CONTRACT.implementationNone}</p>
          )}
        </div>
      )}
    </aside>
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

/**
 * A contract section: its heading and its content, or nothing at all. §8.7: a
 * heading with nothing under it is not rendered.
 *
 * Task 035 gave it the frame the approved pack draws around every section of an
 * opened step (`docs/design/approved/anatomy/plan-step-v1.html` `.step-section`): a
 * `<section>` of its own, divided from the next by the frame's hairline. The
 * division is what makes the canonical order legible as an order rather than as
 * a column of headings — and it is a real element, so the sections a step
 * renders are also the sections a screen reader walks.
 *
 * `frame` is false where a section is nested inside another disclosure (More's
 * own blocks), which the pack draws as cards and not as ruled sections.
 */
export function StepSection({ heading, when = true, frame = true, children }: { heading: string; when?: boolean; frame?: boolean; children: ReactNode }) {
  if (!when) return null
  if (!frame)
    return (
      <>
        <h4>{heading}</h4>
        {children}
      </>
    )
  return (
    <section className="step-section">
      <h4>{heading}</h4>
      {children}
    </section>
  )
}

/**
 * What this scan observed that bears on the decision, in the approved pack's
 * finding-card grammar (`docs/design/approved/anatomy/plan-step-v1.html` `.findings`):
 * a key naming what kind of finding this is, over the finding itself.
 *
 * Conditional, and never padded. The pack's sample draws three cards because
 * its sample step had three things to say; production renders exactly the
 * findings `stepContract.foundOf` built and no placeholder card stands in for
 * one it did not. The grid takes its column count from that number, so one
 * finding is one full-width card rather than a third of a row with two gaps
 * beside it.
 *
 * The card carries no bold headline over its sentence. The pack's sample splits
 * a finding into a value and an explanation because its samples were written
 * that way; production writes one sentence per finding, and cutting it in two
 * here would be this component deciding which half matters.
 */
export function WhatIamaiFound({ found }: { found: ContractFound[] }) {
  if (found.length === 0) return null
  return (
    <StepSection heading={CONTRACT.foundHeading}>
      <ul className="findings">
        {found.map((f) => (
          <li key={f.key} className="finding">
            <span className="key-label">{f.label}</span>
            <span className="finding-text">{f.text}</span>
          </li>
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
export function FixBeforeContinuing({ fix, tone = 'warning' }: { fix: ContractFix[]; tone?: 'warning' | 'danger' }) {
  if (fix.length === 0) return null
  return (
    <section className="step-section">
      {/* The pack's attention panel (`.attention` / `.attention.danger`), which
          is the shared `.callout` role task 031 built: one object, drawn once,
          used by the Plan and by MFA Readiness. A blocker rendered as ordinary
          body text is a blocker that reads as background, which is what this
          section looked like before.

          The severity is production's, never the panel's: `tone` is handed down
          from the step's own condition (Foundation B), and the heading and the
          list stay full-contrast text inside it so the meaning is in the words
          and not in the tint. */}
      <Callout kind={tone}>
        <h4>{CONTRACT.fixHeading}</h4>
        <ol className="sections blocking">
          {fix.map((f) => (
            <li key={f.key}>{f.text}</li>
          ))}
        </ol>
      </Callout>
    </section>
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
