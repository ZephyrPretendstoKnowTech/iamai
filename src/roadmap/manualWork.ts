import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { OwnerConfirmation } from './decisions.ts'
import { setState } from './lifecycle.ts'
import type { Step } from './types.ts'
import type { MappingState } from '../mapping/types.ts'
import { CARVE_OUT_STEP_ID, QUESTION_STEP, answerOf, mailDevicesOf } from './answers.ts'

export const MANUAL_REVIEW_ID = 'manual-review'
const REVIEWS = new Set(['break-glass-accounts', 'legacy-auth-inventory', 'app-passwords', 'guest-review', 'stale-accounts', 'admin-accounts-separate', 'global-admin-count', 'authenticator-over-sms', 'per-user-mfa-cleanup', 'phone-access-restriction'])
const SCAN_REQUIRED = new Set(['break-glass-accounts', 'admin-accounts-separate', 'global-admin-count', 'authenticator-over-sms', 'per-user-mfa-cleanup'])
const FOLLOW_UPS = new Set<string>(Object.values(CARVE_OUT_STEP_ID))

/** Review only facts material to this task, not every scan timestamp. */
export function manualBasis(step: Step, snapshot: TenantSnapshot, mapping?: MappingState): string {
  if (FOLLOW_UPS.has(step.id)) {
    const question = step.id === CARVE_OUT_STEP_ID.travel ? QUESTION_STEP.travel : step.id === CARVE_OUT_STEP_ID.partner ? QUESTION_STEP.partner : QUESTION_STEP.mailDevices
    const answer = mapping ? answerOf(mapping, question, step.id === CARVE_OUT_STEP_ID.mailDevices ? 'decision' : 'question') : null
    // A new answer or changed policy reopens the follow-up. Scan timestamps alone do not.
    const policies = snapshot.config.caPolicies.rows.map(raw => {
      const p = raw as Record<string, unknown>
      return [p.id, p.state, p.conditions, p.grantControls]
    }).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    return JSON.stringify([step.id, answer, mapping ? mailDevicesOf(mapping).slice().sort() : [], policies,
      step.id === CARVE_OUT_STEP_ID.travel ? snapshot.config.namedLocations.rows : null])
  }
  if (step.id === 's-shared-devices') {
    const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a.id).localeCompare(String(b.id))
    const policies = snapshot.config.caPolicies.rows.map(raw => { const p = raw as Record<string, unknown>; return { id:p.id, state:p.state, conditions:p.conditions, grantControls:p.grantControls, sessionControls:p.sessionControls } }).sort(byId)
    const locations = snapshot.config.namedLocations.rows.map(raw => { const l = raw as Record<string, unknown>; return { id:l.id, type:l['@odata.type'], isTrusted:l.isTrusted, ipRanges:l.ipRanges, countriesAndRegions:l.countriesAndRegions, includeUnknownCountriesAndRegions:l.includeUnknownCountriesAndRegions } }).sort(byId)
    return JSON.stringify([step.id, [...step.population.ids].sort(), policies, locations])
  }
  const item = step.id.replace('s-ladder-', '')
  const people = snapshot.users.filter((u) => item === 'break-glass-accounts' ? step.population.ids.includes(u.id) : item !== 'guest-review' || u.userType === 'guest')
  const users = people.map((u) => [u.id, u.accountEnabled, u.userType, item === 'break-glass-accounts' ? u.onPremisesSyncEnabled : null, item === 'admin-accounts-separate' ? u.assignedPlans.map((p) => [p.servicePlanId, p.capabilityStatus]).sort() : null, item === 'stale-accounts' ? (!u.lastSuccessfulSignIn || Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) >= 90 * 86_400_000) : null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const basis: unknown[] = [step.id, users, SCAN_REQUIRED.has(item) ? [snapshot.config.authMethodsPolicy.rows, snapshot.roles.active] : null]
  // Preserve the persisted basis of existing manual reviews. Only this new
  // review depends on the policies that can restrict phone access.
  if (item === 'phone-access-restriction') basis.push(snapshot.config.caPolicies.rows)
  return JSON.stringify(basis)
}

export function applyManualReviews(steps: Step[], snapshot: TenantSnapshot, confirmations: Record<string, Record<string, OwnerConfirmation>> = {}, mapping?: MappingState): void {
  for (const step of steps) {
    const item = step.id.replace('s-ladder-', '')
    if (!FOLLOW_UPS.has(step.id) && step.id !== 's-shared-devices' && (!step.id.startsWith('s-ladder-') || !REVIEWS.has(item))) continue
    const basis = manualBasis(step, snapshot, mapping)
    const confirmation = confirmations[step.id]?.[MANUAL_REVIEW_ID]
    const readyToConfirm = !SCAN_REQUIRED.has(item) || step.state.satisfied
    const confirmedAt = readyToConfirm && confirmation?.basis === basis && Date.parse(confirmation.at) <= Date.now() ? confirmation.at : null
    step.manualReview = { basis, confirmedAt, readyToConfirm }
    setState(step, { satisfied: confirmedAt !== null, inPlace: confirmedAt !== null })
  }
}
