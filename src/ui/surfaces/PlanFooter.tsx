// The Plan footer (prompt 48 item 13, target-state §5). Three collapsed
// details, one line each when collapsed: what is already in place, what does
// not apply here, and housekeeping (policies off the baseline or the naming
// convention, policies not assessed, static-rule violations, and checks that
// could not run). This is what Findings becomes.
import type { Step } from '../../roadmap/types.ts'
import { app, pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { REDACTED, exportDownload } from '../exportGuard.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'
import type { PlanComputed } from './planData.ts'
import { goalInMap } from '../../roadmap/goalMap.ts'
import { notLicensedNote, notLicensedRows, notLicensedSummary } from '../../derive/notLicensed.ts'

type FooterWords = { inPlace: string; doesntApply: string; housekeeping: string; notInBaseline: string; notInBaselineKeep: string }
const F = (pages.plan as { footer: FooterWords }).footer

export function PlanFooter({ computed, nameOf }: { computed: PlanComputed; nameOf: (id: string) => string }) {
  void nameOf
  const inPlace = computed.steps.filter((s) => s.status === 'done')
  // Doesn't apply here and Not licensed are separate footer groups (§5), over
  // the goals this baseline holds: an absent goal never renders (walk-51 item 9).
  const held = computed.coverage.results.filter((r) => goalInMap(computed.goalMap, r.goal.id))
  const notApply = held.filter((r) => r.status === 'not-applicable')
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
          {inPlace.map((s) => (
            <FooterRow key={s.id} step={s} />
          ))}
        </details>
      )}
      {notApply.length > 0 && (
        <details>
          <summary>{fillText(F.doesntApply, { n: notApply.length })}</summary>
          <ul className="sections">
            {notApply.map((r) => (
              <li key={r.goal.id}>{clean(r.statement)}</li>
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
