// Inventory (prompt 47 Part 5, target-state §4): everything the scan read, as
// found, in the ten tables. No intro sentence, no per-tab footer; each table
// exports to CSV.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { INVENTORY as C } from '../../copy/inventory.ts'
import { InventoryPage } from '../pages/InventoryPage.tsx'

export function Inventory({ snapshot }: { snapshot: TenantSnapshot }) {
  return (
    <section className="surface inventory">
      <p className="back-link">
        <a href="#/today">{C.backToToday}</a>
      </p>
      <h1>{C.heading}</h1>
      <InventoryPage snapshot={snapshot} />
    </section>
  )
}
