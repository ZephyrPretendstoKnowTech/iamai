// The Plan footer (prompt 48 item 13, target-state §5). Three collapsed
// details, one line each when collapsed: what is already in place, what does
// not apply here, and housekeeping (policies off the baseline or the naming
// convention, policies not assessed, static-rule violations, and checks that
// could not run). This is what Findings becomes.
import type { Step } from '../../roadmap/types.ts'
import { PLAN as C } from '../../copy/plan.ts'
import { REDACTED, exportDownload } from '../exportGuard.ts'
import { Button, Status } from '../components/index.ts'
import { statusOf } from './statusWord.ts'
import type { PlanComputed } from './planData.ts'

export function PlanFooter({ computed, nameOf }: { computed: PlanComputed; nameOf: (id: string) => string }) {
  void nameOf
  const inPlace = computed.steps.filter((s) => s.status === 'done')
  // Doesn't apply here and Not licensed are separate footer groups (§5).
  const notApply = computed.coverage.results.filter((r) => r.status === 'not-applicable')
  const notLicensed = computed.coverage.results.filter((r) => r.status === 'licence-limited')
  const clean = (s: string): string => s.replace(/\*\*/g, '').replace(/\*/g, '')
  const org = computed.coverage.organisation
  const housekeeping: { text: string; json?: string | null }[] = []
  for (const p of org.notInBaseline) housekeeping.push({ text: C.footer.notInBaseline(p.name, p.state) })
  for (const n of org.notAssessed) housekeeping.push({ text: C.footer.notAssessed(n.name), json: n.json })
  for (const v of computed.staticViolations) housekeeping.push({ text: v.text })
  if (computed.coverage.couldNotEvaluate.length > 0) for (const c of computed.coverage.couldNotEvaluate) housekeeping.push({ text: `${c.name}: ${c.reason}` })

  return (
    <div className="plan-footer">
      {inPlace.length > 0 && (
        <details>
          <summary>{C.footer.inPlace(inPlace.length)}</summary>
          {inPlace.map((s) => (
            <FooterRow key={s.id} step={s} />
          ))}
        </details>
      )}
      {notApply.length > 0 && (
        <details>
          <summary>{C.footer.doesNotApply(notApply.length)}</summary>
          <ul className="sections">
            {notApply.map((r) => (
              <li key={r.goal.id}>{clean(r.statement)}</li>
            ))}
          </ul>
        </details>
      )}
      {notLicensed.length > 0 && (
        <details>
          <summary>{`Not licensed (${notLicensed.length})`}</summary>
          <ul className="sections">
            {notLicensed.map((r) => (
              <li key={r.goal.id}>{clean(r.statement)}</li>
            ))}
          </ul>
          <p className="reason">Nothing in the plan waits on these.</p>
        </details>
      )}
      {housekeeping.length > 0 && (
        <details>
          <summary>{C.footer.housekeeping(housekeeping.length)}</summary>
          <ul className="sections">
            {housekeeping.map((h, i) => (
              <li key={i}>
                {clean(h.text)}
                {h.json && (
                <>
                  {' '}
                  <Button variant="tertiary" onClick={() => exportDownload('policy.json', h.json!, 'application/json', REDACTED)}>
                    {C.footer.json}
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
