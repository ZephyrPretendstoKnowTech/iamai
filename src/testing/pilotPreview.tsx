// The implementation-content pilot, rendered through the production Plan step
// (dev/pilot.html; the Vite dev server only — it is not a build input and never
// ships). A real fixture step, moved to a reviewable runtime state, goes through
// ContentStep, the Step Contract, stepPackage and the package projection
// exactly as a scanned tenant's step would.
//
// One input differs from the product, and the page says so: the baseline
// commit. The pilot was authored against baseline 8461e0f2 and this build pins
// another, so the Plan does not activate it (stepPackage.ts packageApplies).
// This preview renders it as a build pinned to the pilot's own baseline would,
// for review; confirmations it records live only in this page.
//
// ?state=readyToEnforce (default) | reportOnly | missing | fixture   [&print=1]
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import '../ui/tokens.css'
import '../ui/app.css'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { ContentStep } from '../ui/surfaces/ContentStep.tsx'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { OwnerConfirmation } from '../roadmap/decisions.ts'
import { PILOT_PIN, PILOT_STEP_ID, pilotStepAt } from './pilotFixture.ts'

const STATES = ['readyToEnforce', 'reportOnly', 'missing', 'fixture'] as const
type PreviewState = (typeof STATES)[number]

function Preview() {
  const params = new URLSearchParams(window.location.search)
  const asked = params.get('state')
  // ?print=1: the step as PrintPlan renders it (ContentStep printing).
  const printing = params.get('print') === '1'
  const [confirmations, setConfirmations] = useState<Record<string, OwnerConfirmation>>({})
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
  const common = {
    step,
    ctx,
    onSkip: () => undefined,
    onUnskip: () => undefined,
    baselineCommit: PILOT_PIN,
    confirmations,
    onConfirm: (c: Record<string, Pick<OwnerConfirmation, 'basis'>>) => {
      const at = new Date().toISOString()
      setConfirmations((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(c).map(([id, x]) => [id, { at, basis: x.basis }])) }))
    },
    onUnconfirm: (ids: string[]) => setConfirmations((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.includes(id)))),
  }
  return (
    <div className="shell" data-route="plan">
      <main className="page" data-route="plan">
        <section className="surface plan">
          <p className="devtools">
            Implementation-content pilot (dev only; rendered against the pilot's own baseline {PILOT_PIN.slice(0, 8)}, which this build does not pin) · state: {state} ·{' '}
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
                <ContentStep {...common} printing />
              </div>,
              document.body,
            )
          ) : (
            <ContentStep {...common} onScan={() => undefined} />
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
