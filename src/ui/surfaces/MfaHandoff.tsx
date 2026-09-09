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
import { scoredPeople } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { readinessStepHref } from '../shell/routes.ts'

const P = app.plan

export function MfaHandoff({ step, snapshot, mapping }: { step: Step; snapshot: TenantSnapshot; mapping: LadderMapping }) {
  const scored = useMemo(() => scoredPeople(snapshot, mapping, snapshot.asOf), [snapshot, mapping])
  const hold = stepMfaHold(step, scored)
  if (!hold) return null
  const n = hold.ids === null ? null : hold.ids.length
  // Nobody to hand off: the hold is on a number, and this line is about people.
  if (n === 0) return null
  // Its own ruled section of the opened step (task 035): the pack divides an
  // opened step into sections, and a line that renders on some steps and not
  // others has to carry its own division or it reads as a loose sentence
  // trailing the section above it.
  return (
    <section className="step-section">
      <p className="line mfa-handoff">
        {n === null ? P.mfaReadinessHoldUnknown : fillText(P.mfaReadinessHold, { n })}{' '}
        <a className="no-print" href={readinessStepHref(step.id)}>
          {n === null ? P.mfaReadinessLinkUnknown : P.mfaReadinessLink}
        </a>
      </p>
    </section>
  )
}
