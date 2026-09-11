// The Plan step's handoff to MFA Readiness (task 012).
//
// It renders on one kind of step only: one whose own enforcement is already held
// because the people it reaches cannot meet *its* sign-in requirement
// (derive/stepMfaReadiness.ts). It decides nothing — the hold is Foundation A's,
// made before this is called — and it adds no requirement of its own. A step
// asking for ordinary MFA is not held here because somebody has not reached the
// page's passkey target; the measure is the step's own goal family's.
//
// The link carries the step's id and nothing about the people. MFA Readiness
// resolves who from the same scoring the number came from, so the URL never
// becomes a second source of truth about who is affected.
//
// Where the scan could not measure the family's readiness the line says so and
// the link still carries the step: MFA Readiness names the step it came from,
// says the reach is unknown, leaves the table unfiltered and offers the way
// back. An unknown reach is never a list of nobody, and never a tenant-wide
// filter standing in for one.
// Task 014 owns the setup guidance, so there is nothing here about how to
// register a passkey.
import { useMemo } from 'react'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { LadderMapping } from '../../derive/ladder.ts'
import { readinessView, scoredPeople } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { readinessStepHref } from '../shell/routes.ts'
import { actionOf, methodsCell, readinessWord, roleWord } from './readinessCells.ts'

const P = app.plan

/**
 * How many people the Plan previews before handing off.
 *
 * The Plan's job is to say who is holding this step up and hand over; MFA
 * Readiness owns the person-by-person diagnostic and the remediation for every
 * one of them. Three is enough to make the hold concrete — a name, a role, what
 * they have and what they need — without the step quietly becoming a second
 * readiness table that would then have to be kept in step with the real one.
 *
 * The TOTAL is never this number: it is `hold.ids.length`, and the line under
 * the preview carries it.
 */
const PREVIEW = 3

/**
 * The words for the preview's own two labels.
 *
 * Everything a preview ROW says already has a content-backed projection —
 * `roleWord`, `methodsCell`, `readinessWord`, `actionOf` are the same four
 * MFA Readiness's own table and CSV read, so the Plan and the page cannot
 * describe one person differently. These two are the frame around them, and
 * they live here for the same reason the board's control vocabulary lives in
 * planBoard.ts: the task that specified them holds content.json out of scope.
 */
const PREVIEW_WORDS = { has: 'Has', needs: 'Needs' } as const

export function MfaHandoff({ step, snapshot, mapping }: { step: Step; snapshot: TenantSnapshot; mapping: LadderMapping }) {
  const scored = useMemo(() => scoredPeople(snapshot, mapping, snapshot.asOf), [snapshot, mapping])
  const view = useMemo(() => readinessView(snapshot, snapshot.asOf, mapping), [snapshot, mapping])
  const hold = stepMfaHold(step, scored)
  if (!hold) return null
  const n = hold.ids === null ? null : hold.ids.length
  // Nobody to hand off: the hold is on a number, and this line is about people.
  if (n === 0) return null
  // The first few of the people the hold already named, described with the same
  // four projections MFA Readiness's own table uses. Nothing is recomputed: the
  // ids are `stepMfaHold`'s, the rows are `readinessView`'s, and the words are
  // `readinessCells.ts`'s. A row the view does not hold is simply not previewed
  // rather than filled in from somewhere else.
  const held = new Set(hold.ids ?? [])
  const preview = held.size === 0 ? [] : view.rows.filter((r) => held.has(r.user.id)).slice(0, PREVIEW)
  // Inside the step's Readiness region, under its bar: the approved Plan design
  // puts affected-person impact in Readiness
  // (docs/design/approved/anatomy/plan-step-v1.html), and who cannot meet this
  // step's sign-in requirement is exactly that.
  return (
    <div className="mfa-handoff-block">
      {preview.length > 0 && (
        <ul className="mfa-preview">
          {preview.map((r) => (
            <li key={r.user.id}>
              <span className="who">
                <span className="name">{r.user.displayName}</span>
                <span className="role">{roleWord(r)}</span>
              </span>
              {/* What they have, and what they need. Two facts, labelled, so
                  neither is mistaken for the other at a glance. */}
              <span className="state">
                <span className="k">{PREVIEW_WORDS.has}</span> {methodsCell(r).main} · {readinessWord(r)}
              </span>
              <span className="next">
                <span className="k">{PREVIEW_WORDS.needs}</span> {actionOf(r)?.text ?? ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="line mfa-handoff">
        {n === null ? P.mfaReadinessHoldUnknown : fillText(P.mfaReadinessHold, { n })}{' '}
        <a className="no-print" href={readinessStepHref(step.id)}>
          {n === null ? P.mfaReadinessLinkUnknown : P.mfaReadinessLink}
        </a>
      </p>
    </div>
  )
}
