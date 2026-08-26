import { COLLECTOR_REGISTRY } from '../graph/collect/registry.ts'
import type { CollectorSpec } from '../graph/collect/registry.ts'

const LANE_TITLE: Record<CollectorSpec['lane'], string> = {
  '0': 'On every load — configuration',
  A: 'On every scan — aggregate tables',
  B: 'On every scan — sign-in evidence',
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
        Everything IAMAI ever requests from Microsoft Graph, generated from the same registry the
        code runs from. All access is read-only; nothing in the tenant is ever created, changed, or
        deleted.
      </p>
      {lanes.map((lane) => (
        <div key={lane}>
          <h3>{LANE_TITLE[lane]}</h3>
          <table className="viability">
            <thead>
              <tr>
                <th>Data</th>
                <th>Endpoint</th>
                <th>API</th>
                <th>Scopes</th>
                <th>Gate</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {COLLECTOR_REGISTRY.filter((s) => s.lane === lane).map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>
                    <code>{s.endpoint}</code>
                  </td>
                  <td>{s.version}</td>
                  <td>{s.scopes.join(', ')}</td>
                  <td>{s.gate}</td>
                  <td>{s.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}
