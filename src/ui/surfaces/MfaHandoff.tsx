// The Plan step's handoff to MFA Readiness (task 012; prompt 62).
//
// It renders on one kind of step only: one whose own enforcement is already held
// because the people it reaches cannot meet *its* sign-in requirement
// (derive/stepMfaReadiness.ts). It decides nothing — the hold is Foundation A's,
// made before this is called — and it adds no requirement of its own.
//
// The preview speaks the step's own requirement, never MFA Readiness's higher
// bar (prompt 62): the people it names are the ones the step's own gate names
// (`stepMfaHold`, from `methodPreparation`), what they have is their registered
// methods, and what they need is a method this step accepts — or, where the scan
// could not settle it, a compatibility check. The Plan never shows somebody as
// needing a phishing-resistant method while the step counts them as prepared.
// One line under the preview says MFA Readiness holds the higher bar.
//
// The link carries the step's id and nothing about the people. MFA Readiness
// resolves who from the same scoring the number came from, so the URL never
// becomes a second source of truth about who is affected.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { LadderMapping } from '../../derive/ladder.ts'
import { methodClassesOf } from '../../derive/ladder.ts'
import { scoredPeople } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import type { MfaHoldFamily } from '../../derive/stepMfaReadiness.ts'
import { adminUserIds } from '../../roles.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { readinessStepHref } from '../shell/routes.ts'
import { classWord, listWords } from './readinessCells.ts'
import { useMemo } from 'react'

const P = app.plan

/**
 * The words for an unknown reach, by the hold's family (content review S3): the
 * line, the link, and anything the line says after the link.
 */
const UNKNOWN = {
  hold: P.mfaReadinessHoldUnknown as unknown as Record<MfaHoldFamily, string>,
  link: P.mfaReadinessLinkUnknown as unknown as Record<MfaHoldFamily, string>,
  after: (P as unknown as { mfaReadinessAfterUnknown: Partial<Record<MfaHoldFamily, string>> }).mfaReadinessAfterUnknown,
}
const W = (P as unknown as { mfaPreview: { has: string; needs: string; noMethods: string; needsMethod: string; checkCompat: string; higherBar: string } }).mfaPreview

/**
 * How many people the Plan previews before handing off. Three is enough to make
 * the hold concrete without the step quietly becoming a second readiness table.
 * The TOTAL is never this number: it is `hold.ids.length`, and the line under
 * the preview carries it.
 */
const PREVIEW = 3

export function MfaHandoff({ step, snapshot, mapping }: { step: Step; snapshot: TenantSnapshot; mapping: LadderMapping }) {
  const scored = useMemo(() => scoredPeople(snapshot, mapping, snapshot.asOf), [snapshot, mapping])
  const hold = stepMfaHold(step, scored)
  if (!hold) return null
  const n = hold.ids === null ? null : hold.ids.length
  // Nobody to hand off: the hold is on a number, and this line is about people.
  if (n === 0) return null
  const unknown = new Set(step.methodPreparation?.unknownIds ?? [])
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const preview = (hold.ids ?? []).map((id) => byId.get(id)).filter((u) => u !== undefined).slice(0, PREVIEW)
  // What each person has is the one readiness reading MFA Readiness shows (a certificate from the registration report included).
  const scoredBy = new Map(scored.map((v) => [v.userId, v]))
  return (
    <div className="mfa-handoff-block">
      {preview.length > 0 && (
        <ul className="mfa-preview">
          {preview.map((u) => {
            const methods = scoredBy.get(u.id)?.readiness.methods ?? methodClassesOf(snapshot, u.id) ?? []
            return (
              <li key={u.id}>
                <span className="who">
                  <span className="name">{u.displayName ?? u.userPrincipalName}</span>
                  {admins.has(u.id) && <span className="role">{(pages.readiness as unknown as { admin: string }).admin}</span>}
                </span>
                {/* What they have, and what this step needs. Two facts, labelled. */}
                <span className="state">
                  <span className="k">{W.has}</span> {methods.length > 0 ? listWords(methods.map(classWord)) : W.noMethods}
                </span>
                <span className="next">
                  <span className="k">{W.needs}</span> {unknown.has(u.id) ? W.checkCompat : W.needsMethod}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="line mfa-handoff">
        {n === null ? UNKNOWN.hold[hold.family] : fillText(P.mfaReadinessHold, { n })}{' '}
        <a className="no-print" href={readinessStepHref(step.id)}>
          {n === null ? UNKNOWN.link[hold.family] : P.mfaReadinessLink}
        </a>
        {n === null && UNKNOWN.after[hold.family] ? ` ${UNKNOWN.after[hold.family]}` : null}
      </p>
      <p className="line mfa-handoff quiet">{W.higherBar}</p>
    </div>
  )
}
