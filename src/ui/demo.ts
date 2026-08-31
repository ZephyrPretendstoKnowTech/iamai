// Demo mode (prompt 45 Part 1).
//
// The tool asks a stranger to connect a production tenant before it has shown
// them anything, which is the largest single obstacle to somebody trying it or
// sharing it. Demo mode removes that: the whole flow, with no sign-in and no
// Graph call.
//
// It runs the real code paths over the `mid` fixture already used in the tests,
// so what a visitor sees is what the tool actually does, not a screenshot that
// drifts. The one thing it changes is the tenant id.
import { fixture } from '../roadmap/fixtures/index.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'

/**
 * The tenant id demo mode uses.
 *
 * Not a GUID, and not the fixture's own generated one, because every store in
 * this app keys on the tenant id: IndexedDB scans, plans, mapping state and the
 * baseline. A demo that reused a GUID-shaped id could collide with a real
 * tenant's saved data, and "Forget this tenant" would then be ambiguous about
 * which one it forgot. Nothing real is ever named `demo-sample-tenant`.
 */
export const DEMO_TENANT_ID = 'demo-sample-tenant'

export const DEMO_PARAM = 'demo'

/** True when this page load is a demo. Read from the URL, never from storage. */
export function isDemo(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get(DEMO_PARAM) === '1'
}

export function demoUrl(): string {
  const u = new URL(window.location.href)
  u.searchParams.set(DEMO_PARAM, '1')
  // The demo enters at Plan (target-state §2).
  u.hash = '#/plan'
  return u.toString()
}

export function exitDemoUrl(): string {
  const u = new URL(window.location.href)
  u.searchParams.delete(DEMO_PARAM)
  u.hash = '#/connect'
  return u.toString()
}

export type DemoTenant = { snapshot: TenantSnapshot; mapping: MappingState; baseline: ReturnType<typeof fixture>['baseline']; operatorId: string }

/**
 * The sample tenant, with its ids rewritten so nothing it writes can land on a
 * real tenant's keys.
 */
export function demoTenant(): DemoTenant {
  const f = fixture('mid')
  const snapshot = { ...f.snapshot, tenantId: DEMO_TENANT_ID }
  const mapping = { ...f.mapping, tenantId: DEMO_TENANT_ID }
  return { snapshot, mapping, baseline: f.baseline, operatorId: f.operatorId }
}
