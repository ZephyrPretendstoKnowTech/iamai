// Routes (target-state §2), pure: no DOM, no React, so Node tests can read
// them. `home` is the empty hash: App sends it to Plan when a scan exists and
// to Connect otherwise. The old page names redirect. Plan, Export and How
// arrive in prompts 48 and 49; until then #/plan opens the Roadmap, and the
// reference pages keep their old names.
//
// An MSAL auth response also arrives in the fragment (#code=…&client_info=…&
// state=…). It is not a route and it is never rewritten: handleRedirectPromise
// reads it after first render, and a replaceState before that signs nobody in
// (prompt 47.1 Part 1).
export type Route =
  | 'home'
  | 'connect'
  | 'plan'
  | 'export'
  | 'how'
  | 'today'
  | 'inventory'
  | 'recovery'

export const PLAN_ROUTE: Route = 'plan'
export const PLAN_HREF = `#/${PLAN_ROUTE}`

export const REDIRECT: Record<string, Route> = {
  start: 'connect',
  baseline: 'connect',
  scan: 'today',
  readiness: 'today',
  mapping: 'plan',
  coverage: 'plan',
  roadmap: 'plan',
  'roadmap/prompts': 'export',
  checks: 'how',
  reads: 'how',
  licensing: 'how',
  naming: 'how',
}

const DEV = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

export const VALID = new Set<string>([
  'connect',
  'plan',
  'export',
  'how',
  'today',
  'inventory',
  'recovery',
])

export const STEP_LINK = /^roadmap\/step\/(.+)$/
const PLAN_STEP = /^plan\/(.+)$/

/**
 * The fragment MSAL uses to hand back a sign-in: a code or token response, or
 * an error, or anything carrying both `state` and `client_info`.
 */
export function isAuthResponseHash(hash: string): boolean {
  const h = hash.replace(/^#\/?/, '')
  if (/^(code|error|access_token|id_token)=/.test(h)) return true
  return /(^|&)state=/.test(h) && /(^|&)client_info=/.test(h)
}

/** The route a hash names, and the hash to show instead when the name is an old one. */
export function resolveHash(hash: string): { route: Route; redirect: string | null } {
  if (isAuthResponseHash(hash)) return { route: 'home', redirect: null }
  const h = hash.replace(/^#\/?/, '')
  if (h === '') return { route: 'home', redirect: null }
  // #/roadmap/step/<id> is the old deep link; it now opens the step on the Plan (prompt 48 item 14).
  const step = STEP_LINK.exec(h)
  if (step) return { route: 'plan', redirect: `#/plan/${step[1]}` }
  if (PLAN_STEP.test(h)) return { route: 'plan', redirect: null }
  // The baseline-package how-to is an anchor on How (prompt 49 item 11).
  if (h === 'package' || h === 'baseline/package') return { route: 'how', redirect: '#/how#package' }
  const to = REDIRECT[h]
  if (to) return { route: to, redirect: `#/${to}` }
  if (VALID.has(h)) return { route: h as Route, redirect: null }
  return { route: 'connect', redirect: '#/connect' }
}
