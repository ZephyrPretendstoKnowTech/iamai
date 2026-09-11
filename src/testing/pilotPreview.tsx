// The implementation-content pilot, rendered through the production Plan step
// (dev-pilot.html; the Vite dev server only — it is not a build input and never
// ships). A real fixture step, moved to a reviewable runtime state, goes through
// ContentStep, the Step Contract, stepPackage and the package projection
// exactly as a scanned tenant's step would.
//
// ?state=readyToEnforce (default) | reportOnly | missing | fixture   [&print=1]
import { StrictMode, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import '../ui/tokens.css'
import '../ui/app.css'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { ContentStep } from '../ui/surfaces/ContentStep.tsx'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { PILOT_STEP_ID, pilotStepAt } from './pilotFixture.ts'

const STATES = ['readyToEnforce', 'reportOnly', 'missing', 'fixture'] as const
type PreviewState = (typeof STATES)[number]

function Preview() {
  const params = new URLSearchParams(window.location.search)
  const asked = params.get('state')
  // ?print=1: the step as PrintPlan renders it (ContentStep printing).
  const printing = params.get('print') === '1'
  useEffect(() => {
    if (!printing) return
    document.body.classList.add('has-print-plan')
    return () => document.body.classList.remove('has-print-plan')
  }, [printing])
  const state: PreviewState = (STATES as readonly string[]).includes(asked ?? '') ? (asked as PreviewState) : 'readyToEnforce'
  const { step, ctx } = useMemo(() => {
    const f = fixture('small')
    const r = runFixture(f)
    const base = r.steps.find((s) => s.id === PILOT_STEP_ID)
    if (!base) throw new Error(`${PILOT_STEP_ID} is not in the fixture`)
    const context: StepVarContext = {
      snapshot: f.snapshot,
      mapping: f.mapping,
      nameOf: (id: string) => r.input.names?.label(id) ?? id,
      signature: 'IT',
      operatorId: f.operatorId,
      now: f.snapshot.asOf,
      groups: f.groups,
      reportOnlyAt: r.schedule.reportOnlyAt[base.id] ?? null,
    }
    return { step: state === 'fixture' ? base : pilotStepAt(base, state), ctx: context }
  }, [state])
  return (
    <div className="shell" data-route="plan">
      <main className="page" data-route="plan">
        <section className="surface plan">
          <p className="devtools">
            Implementation-content pilot (dev only) · state: {state} ·{' '}
            {STATES.map((s) => (
              <a key={s} href={`?state=${s}`}>
                {s}{' '}
              </a>
            ))}
          </p>
          {printing ? (
            // Mounted as PrintPlan mounts (Export.tsx, PrintPlan.tsx): a portal on
            // body, shown only under print media while body has has-print-plan.
            createPortal(
              <div className="print-plan">
                <ContentStep step={step} ctx={ctx} onSkip={() => undefined} onUnskip={() => undefined} printing />
              </div>,
              document.body,
            )
          ) : (
            <ContentStep step={step} ctx={ctx} onSkip={() => undefined} onUnskip={() => undefined} onScan={() => undefined} />
          )}
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
