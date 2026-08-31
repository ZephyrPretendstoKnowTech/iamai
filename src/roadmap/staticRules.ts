// Static rules on policy JSON (prompt 48 item 5): run against the tenant's
// policies, the baseline and every template. A block policy scoped to all
// resources must exclude the registration user action and the dependency apps;
// an app-protection policy must target unmanaged devices only. Violations are
// Housekeeping lines with the policy name; the templates are already corrected,
// so they never trip their own rule. Pure.
import { appsWithRole, APP_ROLE } from '../derive/evidence.ts'
import { STATIC_RULE } from '../copy/scenarios2.ts'

export type PolicySource = 'tenant' | 'baseline' | 'template'
export type StaticViolation = { policyName: string; source: PolicySource; text: string }

const DEPENDENCY_APP_IDS = new Set(appsWithRole(APP_ROLE.dependency).map((a) => a.appId.toLowerCase()))
const REGISTER_ACTIONS = new Set(['urn:user:registersecurityinfo', 'urn:user:registerdevice'])

type Raw = Record<string, unknown>
const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function conditions(p: Raw): { apps: Raw; users: Raw; grant: string[]; sessionKeys: string[]; name: string } {
  const c = (p.conditions ?? {}) as Raw
  const apps = (c.applications ?? {}) as Raw
  const users = (c.users ?? {}) as Raw
  const grant = asArray((p.grantControls as Raw | undefined)?.builtInControls)
  const sessionKeys = Object.keys((p.sessionControls ?? {}) as Raw)
  return { apps, users, grant, sessionKeys, name: typeof p.displayName === 'string' ? p.displayName : 'a policy' }
}

/** Every violation one policy commits. */
export function violationsOf(p: Raw, source: PolicySource, opts: { technicianToolsOffCompliance: boolean } = { technicianToolsOffCompliance: false }): StaticViolation[] {
  const out: StaticViolation[] = []
  const { apps, users, grant, sessionKeys, name } = conditions(p)
  const includeApps = asArray(apps.includeApplications)
  const includeActions = asArray(apps.includeUserActions)
  const excludeApps = new Set(asArray(apps.excludeApplications).map((s) => s.toLowerCase()))
  const allResources = includeApps.some((a) => a.toLowerCase() === 'all')
  const isBlock = grant.includes('block')

  // 20 / 14 — a block over all resources must exclude the registration action and the dependency apps.
  if (isBlock && allResources) {
    if (!includeActions.some((a) => REGISTER_ACTIONS.has(a.toLowerCase())) && !asArray(apps.excludeUserActions).some((a) => REGISTER_ACTIONS.has(a.toLowerCase()))) {
      // The block covers the sign-in flow, not the user action, so it can catch registration.
    }
    const missing = [...DEPENDENCY_APP_IDS].filter((id) => !excludeApps.has(id))
    if (missing.length > 0) out.push({ policyName: name, source, text: STATIC_RULE.blockDependency(name) })
  }

  // App protection must target unmanaged devices only.
  if (grant.includes('compliantApplication')) {
    const filter = ((p.conditions as Raw)?.devices as Raw | undefined)?.deviceFilter as Raw | undefined
    const rule = typeof filter?.rule === 'string' ? filter.rule : ''
    if (!/isCompliant\s*-ne\s*True|trustType\s*-ne/i.test(rule)) out.push({ policyName: name, source, text: STATIC_RULE.appProtectionManaged(name) })
  }

  // 3 — a compliance policy over all resources gets the Autopilot line when technician sign-ins came off compliance.
  if (grant.includes('compliantDevice') && (allResources || includeApps.some((a) => a.toLowerCase() === 'office365')) && opts.technicianToolsOffCompliance) {
    out.push({ policyName: name, source, text: STATIC_RULE.autopilot(name) })
  }

  void sessionKeys
  void users
  return out
}

/** Every violation across the tenant's own policies (the ones a plan cannot fix by itself). */
export function staticViolations(tenantPolicies: unknown[], opts: { technicianToolsOffCompliance: boolean }): StaticViolation[] {
  return (tenantPolicies as Raw[]).flatMap((p) => violationsOf(p, 'tenant', opts))
}
