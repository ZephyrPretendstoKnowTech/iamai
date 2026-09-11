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
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button, Callout, Status } from '../components/index.ts'
import type { StatusTone } from '../components/index.ts'
import type { ContractFix, ContractFound, ContractMember, ContractReadiness, ContractStage, ImplementationEmpty, ReadinessTone, StepContract } from './stepContract.ts'
import { CONTRACT, FOOTER, badgeLabel, nextCaption, railOf, stageClass } from './stepContract.ts'

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
export { badgeLabel, nextCaption, FOOTER }

export function StepState({ contract }: { contract: StepContract }) {
  // The two axes moved into the head's badge (`badgeLabel`), which is where the
  // approved step reference puts them: "Report-only · Review required", once.
  // What is left here is the one thing the badge does not say — what happens
  // next — as the caption directly above the track it captions.
  //
  // It reads `nextCaption`, which is the dated milestone sentence where there is
  // one and the gate the rail used to hold alone where there is not. A step with
  // neither gets no caption rather than a manufactured one.
  const next = nextCaption(contract)
  if (next === null) return null
  return <p className="step-next">{next}</p>
}

export function StepHead({ eyebrow = null, title, sub = null, badge, tone, track = [], children }: {
  /** What kind of step this is (pages.app.plan.stepContract.kind); null where the kind has no label. */
  eyebrow?: string | null
  title: string
  /** The one supporting line under the title; null where the step has none. */
  sub?: ReactNode
  /** The composed lifecycle · condition label (`badgeLabel`), or the one status word. */
  badge: string
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
          {badge}
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
 * The opened step's right rail (`.step-side` in the pack). In the approved
 * design it is one block, the Next milestone
 * (docs/design/approved/anatomy/plan-step-v1.html: "The right rail is Next
 * milestone only"). The metric is Foundation B's date where it holds one and the
 * one word for where the step stands where it does not, over the milestone's own
 * words (stepContract.ts `railOf`). Every step has a next milestone, so every
 * step has the rail, and nothing else is put in it.
 */
export function StepRail({ contract }: { contract: StepContract }) {
  const r = railOf(contract)
  return (
    <aside className="step-side surface-inset">
      <div className="side-block">
        <div className="key-label">{CONTRACT.railMilestone}</div>
        <p className="metric">{r.metric}</p>
        <p className="metric-sub">{r.sub}</p>
      </div>
    </aside>
  )
}

/**
 * The step's own footer, under both columns (the approved `.step-footer`): the
 * rollout exception on the left where the step offers one, and the existing
 * scan on the right. It offers only what production already does — the
 * exception is the existing skip and Doesn't apply here, the scan is the existing
 * action on the existing routing — and it renders nothing where it has nothing
 * to offer. The row above the step is what closes it.
 */
export function StepFooter({ controls = null, onScan }: { controls?: ReactNode; onScan?: (() => void) | null }) {
  if (!controls && !onScan) return null
  return (
    <footer className="step-footer no-print">
      {controls}
      {onScan && (
        <Button variant="primary" className="step-footer-scan" onClick={onScan}>
          {FOOTER.scan}
        </Button>
      )}
    </footer>
  )
}

/** A tile's mark beside its words: never the state on its own (design lint 5). */
const MARK: Record<ReadinessTone, string | null> = { good: '✓', warn: '!', wait: '…', info: null }

/**
 * The Readiness region (the approved `.readiness-strip` over `.readiness-bar`):
 * the contract's facts as one to three tiles, then the bar that says where the
 * step stands with the one action under it, and the link to the evidence where
 * there is evidence to open. The grid takes its track count from the tiles it
 * is handed, so nothing is padded to three.
 */
export function ReadinessSection({ readiness, lead, onWhy = null, children = null }: { readiness: ContractReadiness; lead: ReactNode; onWhy?: (() => void) | null; children?: ReactNode }) {
  const W = CONTRACT.readiness
  return (
    <section className="step-section readiness-section">
      <h4>{W.heading}</h4>
      <ul className={`readiness-strip tiles-${readiness.tiles.length}`}>
        {readiness.tiles.map((t) => (
          <li key={t.key} className={`readiness-tile readiness-tile-${t.tone}`}>
            <span className="readiness-tile-head">
              <span className="key-label">{t.label}</span>
              {MARK[t.tone] && (
                <span className={`readiness-status readiness-status-${t.tone}`} aria-hidden="true">
                  {MARK[t.tone]}
                </span>
              )}
            </span>
            <strong>{t.value}</strong>
            {t.note && <p>{t.note}</p>}
          </li>
        ))}
      </ul>
      <div className="readiness-bar">
        <div className="readiness-bar-main">
          <span className="readiness-bar-head">{readiness.bar.main}</span>
          {lead}
        </div>
        {onWhy && (
          <button type="button" className="inline-link" onClick={onWhy}>
            {W.why}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

/** The truthful no-action box, at the weight of its reason (the approved `.implementation-empty`). */
export function ImplementationEmptyBox({ empty }: { empty: ImplementationEmpty }) {
  return (
    <div className={`implementation-empty implementation-empty-${empty.tone}`}>
      <strong>{empty.title}</strong>
      <p>{empty.text}</p>
    </div>
  )
}

/**
 * One of the step's dialogs (the approved implementation, readiness and rollout
 * dialogs): a native modal, so the platform traps focus, Escape closes it and
 * focus returns to the control that opened it. A click on the backdrop closes it
 * too. Its content is mounted only while it is open.
 */
export function StepDialog({ open, onClose, eyebrow, title, sub = null, closeLabel, wide = false, children }: {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  sub?: ReactNode
  closeLabel: string
  wide?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    // A click on the backdrop lands on the dialog element itself, outside its
    // box. Escape is the keyboard's way out, and the platform already gives it.
    const onBackdrop = (e: MouseEvent): void => {
      if (e.target !== d) return
      const r = d.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose()
    }
    d.addEventListener('click', onBackdrop)
    return () => d.removeEventListener('click', onBackdrop)
  }, [onClose])
  return (
    <dialog
      ref={ref}
      className={`step-dialog panel${wide ? ' step-dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {open && (
        <div className="dialog-shell">
          <header className="dialog-head">
            <div>
              <div className="eyebrow">{eyebrow}</div>
              <h3 id={titleId}>{title}</h3>
              {sub && <p>{sub}</p>}
            </div>
            <Button variant="secondary" onClick={onClose}>
              {closeLabel}
            </Button>
          </header>
          <div className="dialog-content">{children}</div>
        </div>
      )}
    </dialog>
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

/**
 * How the operator will know the step is finished. Always at least one concrete
 * line, drawn as the approved Done when draws it: prose under its heading, one
 * paragraph per line.
 */
export function DoneWhen({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <StepSection heading={heading}>
      {lines.map((l, i) => (
        <p key={i} className="done-line">
          {l}
        </p>
      ))}
    </StepSection>
  )
}
