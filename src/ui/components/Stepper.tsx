import { Chip } from './Chip.tsx'
import type { ChipStatus } from './Chip.tsx'
import { COMPONENTS } from '../../copy/components.ts'

const T = COMPONENTS.stepper

export type StepperStatus = 'notStarted' | 'inProgress' | 'done' | 'attention' | 'provisional'

const CHIP: Record<StepperStatus, { status: ChipStatus; text: string } | null> = {
  notStarted: null,
  inProgress: { status: 'in-progress', text: T.inProgress },
  done: { status: 'done', text: T.done },
  attention: { status: 'warning', text: T.attention },
  provisional: { status: 'neutral', text: T.provisional },
}

export type StepperItem = { route: string; label: string; status?: StepperStatus }

// The left nav as a proper stepper (number, label, status chip). Under 900px
// it collapses to a horizontal strip (styles.css).
export function Stepper({
  steps,
  reference,
  active,
}: {
  steps: StepperItem[]
  reference: StepperItem[]
  active: string
}) {
  return (
    <nav className="stepper" aria-label={T.nav}>
      <div className="stepper-group-title">{T.steps}</div>
      {steps.map((s, i) => {
        const chip = CHIP[s.status ?? 'notStarted']
        return (
          <a key={s.route} href={`#/${s.route}`} className={`stepper-item ${active === s.route ? 'active' : ''}`} aria-current={active === s.route ? 'step' : undefined}>
            <span className="stepper-num">{i + 1}</span>
            <span>{s.label}</span>
            {chip && <Chip status={chip.status}>{chip.text}</Chip>}
          </a>
        )
      })}
      <div className="stepper-group-title">{T.reference}</div>
      {reference.map((s) => (
        <a key={s.route} href={`#/${s.route}`} className={`stepper-item ${active === s.route ? 'active' : ''}`}>
          <span>{s.label}</span>
        </a>
      ))}
    </nav>
  )
}
