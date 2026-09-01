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

/** Shift every ISO date in a value by `offsetMs`, so the fixture reads as of now. */
function shiftDates<T>(value: T, offsetMs: number): T {
  if (typeof value === 'string') {
    return (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? new Date(Date.parse(value) + offsetMs).toISOString() : value) as unknown as T
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, offsetMs)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDates(v, offsetMs)
    return out as unknown as T
  }
  return value
}

/**
 * The sample tenant, with its ids rewritten so nothing it writes can land on a
 * real tenant's keys, and every date shifted so it reads as of the day it is
 * viewed (prompt 50 item 9): the `demo` fixture is built at a fixed instant for
 * the property tests, and shifted here. `week2` advances to the tracking view.
 */
export function demoTenant(week2 = false): DemoTenant {
  const f = fixture(week2 ? 'demo-week2' : 'demo')
  const offset = Date.now() - Date.parse(f.snapshot.asOf)
  const snapshot = shiftDates({ ...f.snapshot, tenantId: DEMO_TENANT_ID }, offset)
  const mapping = { ...f.mapping, tenantId: DEMO_TENANT_ID }
  return { snapshot, mapping, baseline: f.baseline, operatorId: f.operatorId }
}
