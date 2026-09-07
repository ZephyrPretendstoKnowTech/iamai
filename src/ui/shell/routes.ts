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
  | 'readiness'
  | 'inventory'


export const PLAN_ROUTE: Route = 'plan'
export const PLAN_HREF = `#/${PLAN_ROUTE}`

/** MFA Readiness (task 012): the person-level surface that replaced Today. */
export const READINESS_ROUTE: Route = 'readiness'
export const READINESS_HREF = `#/${READINESS_ROUTE}`

export const REDIRECT: Record<string, Route> = {
  start: 'connect',
  baseline: 'connect',
  scan: 'readiness',
  // Today is what this surface was called before it became MFA Readiness (task
  // 012). The old hash still resolves, and it resolves to the one surface: a
  // bookmark or a link in somebody's runbook lands on the page that replaced it.
  today: 'readiness',
  mapping: 'plan',
  coverage: 'plan',
  roadmap: 'plan',
  'roadmap/prompts': 'export',
  checks: 'how',
  reads: 'how',
  licensing: 'how',
  naming: 'how',
  recovery: 'plan',
}

export const VALID = new Set<string>([
  'connect',
  'plan',
  'export',
  'how',
  'readiness',
  'inventory',
])

export const STEP_LINK = /^roadmap\/step\/(.+)$/
const PLAN_STEP = /^plan\/(.+)$/
/** MFA Readiness filtered: #/readiness/needsPasskey, #/readiness/rung-3 (derive/mfaReadiness.ts SHOW_KEYS); Connect's rung tiles link here. */
const READINESS_SHOW = /^readiness\/([A-Za-z0-9-]+)$/
/** MFA Readiness scoped to one Plan step: #/readiness/step/<stepId>. The hash carries the step's identity and nothing else; who it reaches is resolved from the same facts the Plan reads. */
const READINESS_STEP = /^readiness\/step\/(.+)$/
/** The old name for the same surface: #/today, #/today/rung-3. */
const TODAY_SHOW = /^today\/([A-Za-z0-9-]+)$/

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
  if (READINESS_STEP.test(h) || READINESS_SHOW.test(h)) return { route: 'readiness', redirect: null }
  // The old filtered Today hash keeps its filter and lands on MFA Readiness.
  const oldShow = TODAY_SHOW.exec(h)
  if (oldShow) return { route: 'readiness', redirect: `#/readiness/${oldShow[1]}` }
  // The baseline-package how-to is an anchor on How (prompt 49 item 11).
  if (h === 'package' || h === 'baseline/package') return { route: 'how', redirect: '#/how#package' }
  const to = REDIRECT[h]
  if (to) return { route: to, redirect: `#/${to}` }
  if (VALID.has(h)) return { route: h as Route, redirect: null }
  return { route: 'connect', redirect: '#/connect' }
}

/** The Plan hash that opens one step: where a Scan to update the plan pressed inside it returns. */
export function returnToStep(stepId: string): string {
  return `#/plan/${stepId}`
}

/** The step a Plan hash opens (#/plan/<stepId>), or null. */
export function stepFromPlanHash(hash: string): string | null {
  const m = PLAN_STEP.exec(hash.replace(/^#\/?/, ''))
  return m ? decodeURIComponent(m[1]) : null
}

/** The Show key an MFA Readiness hash carries (#/readiness/rung-3, and the old #/today/rung-3), or null for the whole table. */
export function showFromReadinessHash(hash: string): string | null {
  const h = hash.replace(/^#\/?/, '')
  if (READINESS_STEP.test(h)) return null
  const m = READINESS_SHOW.exec(h) ?? TODAY_SHOW.exec(h)
  return m ? m[1] : null
}

/** The MFA Readiness hash for a Show key; the whole table for `all`. */
export function readinessHref(show: string): string {
  return show === 'all' ? READINESS_HREF : `${READINESS_HREF}/${show}`
}

/**
 * The MFA Readiness hash scoped to one Plan step: the step's own id, so the
 * page can resolve who it reaches from the plan it already computes. Nothing
 * about the people travels in the URL.
 */
export function readinessStepHref(stepId: string): string {
  return `${READINESS_HREF}/step/${encodeURIComponent(stepId)}`
}

/** The Plan step an MFA Readiness hash is scoped to (#/readiness/step/<stepId>), or null. */
export function stepFromReadinessHash(hash: string): string | null {
  const m = READINESS_STEP.exec(hash.replace(/^#\/?/, ''))
  return m ? decodeURIComponent(m[1]) : null
}

/** Where a finished scan lands: the page that asked for it (a step's hash opens the step, MFA Readiness keeps its filter), otherwise the Plan. */
export function afterScanHref(returnTo: string | null | undefined): string {
  if (!returnTo) return PLAN_HREF
  const { route, redirect } = resolveHash(returnTo)
  return route !== 'home' && redirect === null ? returnTo : PLAN_HREF
}
