// The one confirm affordance in the app (prompt 36 item 13).
//
// Four questions ask the operator to agree with something IAMAI worked out — a
// list of countries, a time zone, a set of detected service accounts, a grid of
// toggles. Before this component each drew its own button with its own wording,
// so the same act read three different ways. There is one act, so there is one
// button and one label; a caller may say what it is confirming through `title`
// but may not rename the act.
import { Button } from './Button.tsx'
import { SETUP_PAGE } from '../../copy/setup.ts'

export function Confirm({ onConfirm, title }: { onConfirm: () => void; title?: string }) {
  return (
    <p>
      <Button variant="primary" onClick={onConfirm} title={title}>
        {SETUP_PAGE.confirmLooksRight}
      </Button>
    </p>
  )
}
