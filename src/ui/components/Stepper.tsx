import { useEffect, useState } from 'react'
import { Button } from './Button.tsx'
import { Chip } from './Chip.tsx'
import type { ChipStatus } from './Chip.tsx'
import { COMPONENTS } from '../../copy/components.ts'

const T = COMPONENTS.stepper
const COLLAPSE_KEY = 'iamai.nav.collapsed'

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
  // L1: the collapse survives a reload, because a nav that reopens every visit
  // is a nav nobody bothers collapsing. Storage can throw (private windows,
  // blocked site data), so a failure just means the default.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      // A preference that cannot be saved is still a preference for this visit.
    }
  }, [collapsed])

  return (
    <nav className={`stepper ${collapsed ? 'is-collapsed' : ''}`} aria-label={T.nav}>
      <Button
        size="sm"
        variant="tertiary"
        className="stepper-collapse"
        icon="chevron"
        aria-label={collapsed ? T.expand : T.collapse}
        title={collapsed ? T.expand : T.collapse}
        onClick={() => setCollapsed((c) => !c)}
      />
      <div className="stepper-group-title">{T.steps}</div>
      {steps.map((s, i) => {
        const chip = CHIP[s.status ?? 'notStarted']
        return (
          <a
            key={s.route}
            href={`#/${s.route}`}
            className={`stepper-item ${active === s.route ? 'active' : ''}`}
            aria-current={active === s.route ? 'step' : undefined}
            aria-label={`${i + 1}. ${s.label}${chip ? `, ${chip.text}` : ''}${active === s.route ? `, ${T.currentStep}` : ''}`}
          >
            <span className="stepper-num">{i + 1}</span>
            <span className="stepper-label">{s.label}</span>
            {chip && !collapsed && <Chip status={chip.status}>{chip.text}</Chip>}
          </a>
        )
      })}
      <div className="stepper-group-title">{T.reference}</div>
      {reference.map((s) => (
        <a key={s.route} href={`#/${s.route}`} className={`stepper-item ${active === s.route ? 'active' : ''}`} aria-label={s.label}>
          <span className="stepper-label">{s.label}</span>
        </a>
      ))}
    </nav>
  )
}
