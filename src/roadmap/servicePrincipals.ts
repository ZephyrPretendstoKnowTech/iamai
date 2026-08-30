// First-party applications a baseline policy targets, and whether this tenant
// has a service principal for them (naming-and-consolidation.md §5,
// prompt 43 Part 5).
//
// WHAT THIS CANNOT DO, said here rather than implied by the copy.
//
// Proving a service principal is absent needs GET /servicePrincipals, which the
// scan does not call. docs/design/application-read-decision.md (prompt 39)
// recommends dropping Application.Read.All precisely because nothing consumed
// it, and adding a collector is not something to do quietly inside a naming
// prompt. So this reports what the evidence already collected can support:
//
//   - An app with sign-in activity in this tenant HAS a service principal.
//     Activity is proof of presence.
//   - An app with none MIGHT not. Absence of activity is not absence of the
//     object; a service principal nobody has used this month looks identical to
//     one that does not exist.
//
// The second case is reported as "IAMAI cannot confirm", never as "missing", and
// carries the one command that creates it and the portal path to check first.
// Targeting a service principal that is not there silently matches nothing, so
// the user needs to know to look even when the tool cannot look for them.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'

export type AppReference = { appId: string; displayName: string }

export type ServicePrincipalCheck = {
  app: AppReference
  /** 'present' where activity proves it; 'unconfirmed' where nothing does. */
  state: 'present' | 'unconfirmed'
  /** What the policy would do with it, in the user's words. */
  usedFor: string
}

/** Graph module cmdlets this tool is allowed to put in front of a user. */
export const ALLOWED_CMDLETS = ['Connect-MgGraph', 'New-MgServicePrincipal', 'Get-MgServicePrincipal'] as const

/**
 * App ids seen signing in to this tenant, from the two activity reports the scan
 * already collects. Presence in either is proof the service principal exists.
 */
export function appIdsWithActivity(snapshot: TenantSnapshot): Set<string> {
  const out = new Set<string>()
  const rows = [...((snapshot.spActivity ?? []) as unknown[]), ...((snapshot.appSignInSummary ?? []) as unknown[])]
  for (const r of rows) {
    const o = r as { appId?: unknown; applicationId?: unknown }
    for (const v of [o.appId, o.applicationId]) {
      if (typeof v === 'string' && v.length > 0) out.add(v.toLowerCase())
    }
  }
  return out
}

export function checkServicePrincipals(apps: AppReference[], snapshot: TenantSnapshot, usedFor: (app: AppReference) => string): ServicePrincipalCheck[] {
  const active = appIdsWithActivity(snapshot)
  return apps.map((app) => ({
    app,
    state: active.has(app.appId.toLowerCase()) ? ('present' as const) : ('unconfirmed' as const),
    usedFor: usedFor(app),
  }))
}

/**
 * The two commands from §5, each one line and separately copyable.
 *
 * One line is the rule, not a preference: a user pasting a loop into a
 * production tenant at 6pm on a Friday is how the tool would do harm without
 * ever making a call itself. Anything that needs more than one line gets the
 * portal path instead.
 */
export function createCommands(app: AppReference): { connect: string; create: string; check: string } {
  return {
    connect: `Connect-MgGraph -Scopes "Application.ReadWrite.All"`,
    create: `New-MgServicePrincipal -AppId ${app.appId}`,
    check: `Get-MgServicePrincipal -Filter "appId eq '${app.appId}'"`,
  }
}

export const SP_TEXT = {
  title: 'Applications this policy targets',
  unconfirmed: (name: string) =>
    `IAMAI cannot confirm that ${name} has a service principal in this tenant. Nothing has signed in as it during the evidence window, and the scan does not read the application list. A policy that targets an application with no service principal silently matches nothing.`,
  present: (name: string) => `${name} has signed in to this tenant, so its service principal exists.`,
  checkFirst: 'Check before creating anything:',
  portal: 'In the portal: Entra admin center → Identity → Applications → Enterprise applications → filter Application ID.',
  connectExplains: 'Signs in to Microsoft Graph with the least permission the next line needs.',
  createExplains: 'Creates the enterprise application entry for that application id, and nothing else. It grants no permissions and changes no policy.',
  youRunIt: 'You run this, not IAMAI. IAMAI holds read-only permissions and never writes to a tenant.',
} as const
