// Demo mode's switches, and nothing heavy: whether this page load is the demo,
// and the URLs in and out of it. demo.ts (the sample tenant, its fixture and
// the plan engine behind it) imports this and is itself imported only on
// demand, so the demo chunk loads in demo mode and nowhere else
// (demoChunk.test.ts keeps it that way).
export const DEMO_PARAM = 'demo'

/**
 * The demo tenant's id: every store row the demo writes carries it, so the
 * smoke can prove the demo touched no real tenant's rows. Nothing real is
 * ever named `demo-sample-tenant`.
 */
export const DEMO_TENANT_ID = 'demo-sample-tenant'

/**
 * Where the demo keeps its two snapshots' plan records (task 026 correction).
 *
 * The sample is one tenant read twice, and the app stores one plan record per
 * tenant, so the record on screen belongs to whichever snapshot is selected.
 * The other snapshot's record is held here until it is selected again, which is
 * what keeps the follow-up scan's decisions and its observations out of the
 * initial scan's plan. It is the demo's own row and it is not a tenant: every
 * store id the demo writes begins with `DEMO_TENANT_ID`, which is how the smoke
 * tells a demo row from a real tenant's.
 */
export const DEMO_SNAPSHOT_STATE_ID = `${DEMO_TENANT_ID}#snapshots`

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
