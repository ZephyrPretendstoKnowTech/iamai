import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import type { CollectorSpec } from '../graph/collect/registry.ts'
import { DataTable } from './components/index.ts'

const LANE_TITLE: Record<CollectorSpec['lane'], string> = {
  '0': 'On every load — configuration',
  A: 'On every scan — inventory',
  B: 'On every scan — sign-in records',
  'on-demand': 'Only after you pick a baseline',
}

// Generated view over the collector registry — the same source of truth that
// drives the collectors and SPEC §4.
export function WhatIamaiReads() {
  const lanes: CollectorSpec['lane'][] = ['0', 'A', 'B', 'on-demand']
  return (
    <section>
      <h2>What IAMAI reads</h2>
      <p>
        Everything IAMAI ever requests from Microsoft Graph, generated from the same registry the code
        runs from. All access is read-only; nothing in the tenant is ever created, changed, or deleted.
      </p>
      {lanes.map((lane) => (
        <div key={lane}>
          <h3>{LANE_TITLE[lane]}</h3>
          <DataTable
            rows={COLLECTOR_REGISTRY.filter((s) => s.lane === lane)}
            rowKey={(s) => s.name}
            columns={[
              { key: 'name', header: 'Data', render: (s) => s.name },
              { key: 'endpoint', header: 'Endpoint', render: (s) => <code>{s.endpoint}</code> },
              { key: 'version', header: 'API', render: (s) => s.version },
              { key: 'scopes', header: 'Permissions', render: (s) => s.scopes.join(', ') },
              { key: 'gate', header: 'When it can fail', render: (s) => s.gate },
              { key: 'purpose', header: 'Why', render: (s) => s.purpose },
            ]}
          />
        </div>
      ))}
    </section>
  )
}
