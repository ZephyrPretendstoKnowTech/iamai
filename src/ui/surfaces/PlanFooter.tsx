// The Plan footer (prompt 48 item 13, target-state §5). Three collapsed
// details, one line each when collapsed: what is already in place, what does
// not apply here, and housekeeping (policies off the baseline or the naming
// convention, policies not assessed, static-rule violations, and checks that
// could not run). This is what Findings becomes.
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Step } from '../../roadmap/types.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { REDACTED, exportDownload } from '../exportGuard.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'
import type { PlanComputed } from './planData.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { notLicensedNote, notLicensedRows, notLicensedSummary } from '../../derive/notLicensed.ts'

type FooterWords = { inPlace: string; doesntApply: string; doesntApplyRow: string; housekeeping: string; notInBaseline: string; notInBaselineKeep: string }
const F = (pages.plan as { footer: FooterWords }).footer

export function PlanFooter({ computed, nameOf, onPutBack, renderRow }: { computed: PlanComputed; nameOf: (id: string) => string; onPutBack: (stepId: string) => void; /** An In place row as the plan's own row, so it opens in place: a done step still carries its decisions (a policy in place keeps its partner question; a made device decision keeps its effect lines). */ renderRow?: (step: Step) => ReactNode }) {
  void nameOf
  // The steps the person said do not apply here (mapping.notApplicable), with
  // the reason as given and a way back; the engine's own not-applicable goals follow.
  const said = computed.steps.filter((s) => typeof s.doesntApply === 'string' && s.doesntApply.length > 0)
  const inPlace = computed.steps.filter((s) => s.status === 'done')
  // Doesn't apply here holds the person's answers only; a goal a licence switched
  // off is a Not licensed row (derive/notLicensed.ts).
  // The licence ladder as rows (prompt 52 Part 3): the content step's title and
  // the licence it needs, one sentence under the group, never a tier's benefits.
  const notLicensed = notLicensedRows(computed.coverage, computed.goalMap)
  const clean = (s: string): string => s.replace(/\*\*/g, '').replace(/\*/g, '')
  const org = computed.coverage.organisation
  // Housekeeping (§5): a policy not in the baseline, a name off the convention,
  // a static-rule violation on the tenant's own policies. Baseline policies not
  // assessed are Cleanup rows, and problems with the baseline package are
  // reported on How IAMAI works, never in a plan.
  const housekeeping: { text: string; json?: string | null }[] = []
  for (const p of org.notInBaseline) housekeeping.push({ text: fillText(F.notInBaseline, { policy: `${p.name} (${p.state})`, verdict: F.notInBaselineKeep }) })
  for (const v of computed.staticViolations) housekeeping.push({ text: v.text })

  return (
    <div className="plan-footer">
      {inPlace.length > 0 && (
        <details>
          <summary>{fillText(F.inPlace, { n: inPlace.length })}</summary>
          {inPlace.map((s) => (renderRow ? <Fragment key={s.id}>{renderRow(s)}</Fragment> : <FooterRow key={s.id} step={s} />))}
        </details>
      )}
      {said.length > 0 && (
        <details>
          <summary>{fillText(F.doesntApply, { n: said.length })}</summary>
          <ul className="sections">
            {said.map((s) => (
              <li key={s.id}>
                {fillText(F.doesntApplyRow, { stepTitle: contentTitle(s), reason: s.doesntApply })}{' '}
                <Button variant="tertiary" onClick={() => onPutBack(s.id)}>
                  {app.plan.putBack}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {notLicensed.length > 0 && (
        <details>
          <summary>{notLicensedSummary(notLicensed.length)}</summary>
          <ul className="sections">
            {notLicensed.map((r) => (
              <li key={r.goalId}>{r.text}</li>
            ))}
          </ul>
          <p className="reason">{notLicensedNote()}</p>
        </details>
      )}
      {housekeeping.length > 0 && (
        <details>
          <summary>{fillText(F.housekeeping, { n: housekeeping.length })}</summary>
          <ul className="sections">
            {housekeeping.map((h, i) => (
              <li key={i}>
                {clean(h.text)}
                {h.json && (
                <>
                  {' '}
                  <Button variant="tertiary" onClick={() => exportDownload('policy.json', h.json!, 'application/json', REDACTED)}>
                    {app.plan.footerJson}
                  </Button>
                </>
              )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function FooterRow({ step }: { step: Step }) {
  const status = statusOf(step)
  return (
    <div className="plan-row">
      <Status tone={status.tone}>{status.word}</Status>
      <span className="step-title">{step.plainTitle || step.title}</span>
    </div>
  )
}
