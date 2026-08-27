import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import type { CollectorSpec } from '../graph/collect/registry.ts'
import { READS } from '../copy/pages.ts'
import { DataTable, LinkButton } from './components/index.ts'

// Generated view over the collector registry — the same source of truth that
// drives the collectors and SPEC §4.
export function WhatIamaiReads() {
  const lanes: CollectorSpec['lane'][] = ['0', 'A', 'B', 'on-demand']
  return (
    <section>
      <h2>{READS.title}</h2>
      <p>{READS.intro}</p>
      {lanes.map((lane) => (
        <div key={lane}>
          <h3>{READS.lanes[lane]}</h3>
          <DataTable
            rows={COLLECTOR_REGISTRY.filter((s) => s.lane === lane)}
            rowKey={(s) => s.name}
            columns={[
              { key: 'name', header: READS.columns.data, render: (s) => s.name },
              { key: 'endpoint', header: READS.columns.endpoint, render: (s) => <code>{s.endpoint}</code> },
              { key: 'version', header: READS.columns.api, render: (s) => s.version },
              { key: 'scopes', header: READS.columns.permissions, render: (s) => s.scopes.join(', ') },
              { key: 'gate', header: READS.columns.gate, render: (s) => s.gate },
              { key: 'purpose', header: READS.columns.why, render: (s) => s.purpose },
            ]}
          />
        </div>
      ))}
      <p className="step-next">
        <LinkButton href="#/connect">{READS.next}</LinkButton>
      </p>
    </section>
  )
}
