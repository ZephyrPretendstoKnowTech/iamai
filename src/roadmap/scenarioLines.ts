// The scenario lines a step earns from this tenant's evidence (prompt 48 item
// 6). Each is built only from a derivation that returned people; the mapping of
// scenario → step → derivation is docs/design/lockout-scenarios.md and the
// table in the prompt. Pure: the snapshot's scenarioEvidence in, ordered lines
// out. The generic catalogue text stays behind More (content.ts, unchanged).
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { ScenarioEvidence } from '../derive/evidence.ts'
import type { Step } from './types.ts'
import { SCENARIO, CANT_SEE } from '../copy/scenarios.ts'

export type ScenarioLine = { kind: string; text: string; people: string[]; count: number }

const TRUSTED_MATCH_FLOOR = 0.5

type Ctx = {
  snapshot: TenantSnapshot
  evidence: ScenarioEvidence
  nameOf: (id: string) => string
  /** The step's own enforcement date, spelled out; null before it is scheduled. */
  enforceDate: string | null
  /** The cross-tenant default inbound trust: true when partner MFA is accepted. */
  guestMfaTrust: boolean
  /** onPremisesSyncEnabled users are present. */
  hybridPresent: boolean
  /** A user who holds the Directory Synchronization Accounts role, if any. */
  syncRoleHolder: string | null
  /** People with no MFA-capable method who are active (for the registration lines). */
  noMethodActive: string[]
}

const nm = (ctx: Ctx, ids: string[]): string[] => ids.map(ctx.nameOf)

/** The lines for one step, in the order the step shows them. */
export function scenarioLinesFor(step: Step, ctx: Ctx): ScenarioLine[] {
  const e = ctx.evidence
  const out: ScenarioLine[] = []
  const add = (kind: string, text: string, people: string[], count: number): void => {
    out.push({ kind, text, people, count })
  }
  const goal = step.goalId
  // Who this step's own policy reaches is the policy's answer, from the accounts
  // it names (roadmap/rings.ts rolloutCohort). The goal's family answers only for
  // a step with no policy of its own (roadmap/strand.ts familyReading).
  const cohort = rolloutCohort(step)
  const reaches = (ids: readonly string[]): boolean =>
    effectsOf(step) === null ? familyReading(step) === 'guest' : cohort !== null && ids.some((id) => cohort.includes(id))

  // 1 / 7 / 21 — legacy mail clients on the block-legacy-auth step.
  if (goal === 'block-legacy-auth') {
    const lc = e.legacyClients
    const byClient = new Map<string, string[]>()
    for (const [uid, clients] of Object.entries(lc.byPerson)) for (const c of clients) (byClient.get(c) ?? byClient.set(c, []).get(c)!).push(uid)
    for (const [client, ids] of byClient) {
      if (client === 'Exchange ActiveSync') add('legacyClient', SCENARIO.eas(nm(ctx, ids), ctx.enforceDate), ids, ids.length)
      else if (/SMTP/i.test(client)) add('legacyClient', SCENARIO.smtpRelay(nm(ctx, ids)), ids, ids.length)
      else add('legacyClient', SCENARIO.legacyClient(client, nm(ctx, ids), ctx.enforceDate), ids, ids.length)
    }
  }

  // 3 / 16 / 18 — device compliance.
  if (goal === 'require-managed-device') {
    const t = e.technicianToolsOffCompliance
    if (t.count > 0) for (const tool of Object.keys(t.detail)) add('autopilot', SCENARIO.technicianOffCompliance(t.detail[tool], tool), t.people, t.detail[tool])
    const s = e.serverSignIns
    if (s.people.length > 0) add('servers', SCENARIO.serverSignIns(nm(ctx, s.people), ctx.enforceDate), s.people, s.people.length)
    const b = e.browserWithoutClaims
    if (b.people.length > 0) for (const browser of Object.keys(b.detail)) add('browserClaims', SCENARIO.browserWithoutClaims(nm(ctx, b.people), browser), b.people, b.detail[browser])
  }

  // 4 — session/frequency steps.
  if (SESSION_GOALS.has(goal)) {
    const apps = Object.keys(e.nonMicrosoftApps.detail)
    if (apps.length > 0) add('sessionApps', SCENARIO.nonMicrosoftApps(apps.map((a) => `${a} (${e.nonMicrosoftApps.detail[a]})`)), e.nonMicrosoftApps.people, apps.length)
  }

  // 5 / 11 — location steps.
  if (goal === 'geo-restriction') {
    const tl = e.trustedLocationMatches
    for (const [loc, matched] of Object.entries(tl.byLocation)) {
      if (tl.total > 0 && matched / tl.total < TRUSTED_MATCH_FLOOR) add('trustedStale', SCENARIO.trustedLocationStale(loc, matched, tl.total), [], matched)
    }
    const sp = e.serviceProviderSignIns
    if (sp.people.length > 0) add('gdap', SCENARIO.serviceProvider(sp.people.length, sp.homeTenants, ctx.enforceDate), sp.people, sp.people.length)
  }
  // 11 — GDAP also on the strength step.
  if (goal === 'admins-phishing-resistant') {
    const sp = e.serviceProviderSignIns
    if (sp.people.length > 0) add('gdap', SCENARIO.serviceProvider(sp.people.length, sp.homeTenants, ctx.enforceDate), sp.people, sp.people.length)
  }

  // 6 — guests, when trust is off. The line is shown where this step's own policy
  // actually reaches one of the guests the records saw — a policy naming all
  // users reaches them, and a policy filed under guests that the plan cannot read
  // reaches nobody knowably. The goal used to decide it, which showed the line
  // for a policy that names no guest and hid it for one that names them all.
  {
    const g = e.guestsSeen
    if (g.people.length > 0 && !ctx.guestMfaTrust && reaches(g.people)) add('guests', SCENARIO.guestsNoTrust(g.people.length, ctx.enforceDate), g.people, g.people.length)
  }

  // 9 — token protection.
  if (goal === 'token-protection') {
    const u = e.unregisteredWindows
    if (u.people.length > 0) add('tokenProtection', SCENARIO.unregisteredWindows(nm(ctx, u.people), ctx.enforceDate), u.people, u.people.length)
  }

  // 12 — verification campaign.
  if (step.kind === 'verify') {
    const p = e.passwordNotTyped
    if (p.people.length > 0) add('passwordNotTyped', SCENARIO.passwordNotTyped(nm(ctx, p.people)), p.people, p.people.length)
  }

  // 13 — the sync account, on MFA-for-all.
  if (goal === 'mfa-all-users' && ctx.syncRoleHolder) add('syncAccount', SCENARIO.syncAccount(ctx.nameOf(ctx.syncRoleHolder)), [ctx.syncRoleHolder], 1)

  // 14 — remote registration, on the registration step.
  if (goal === 'register-info-protected' && ctx.noMethodActive.length > 0) add('noMethodRemote', SCENARIO.noMethodRemote(nm(ctx, ctx.noMethodActive), ctx.enforceDate), ctx.noMethodActive, ctx.noMethodActive.length)

  // 15 — user risk.
  if (goal === 'user-risk' || goal === 'user-risk-medium') {
    const r = e.highUserRisk
    if (r.people.length > 0) add('highRisk', SCENARIO.highUserRisk(nm(ctx, r.people), ctx.enforceDate), r.people, r.people.length)
  }

  // 17 — empty platform.
  if (goal === 'block-unsupported-platforms') {
    const p = e.emptyPlatform
    if (p.count > 0) for (const app of Object.keys(p.detail)) add('emptyPlatform', SCENARIO.emptyPlatform(p.detail[app], app), p.people, p.detail[app])
  }

  // 19 — ROPC automation, on MFA-for-all and Azure management.
  if (goal === 'mfa-all-users' || goal === 'azure-management-mfa') {
    for (const [uid, tools] of Object.entries(e.ropcAutomation.byPerson)) {
      for (const tool of tools) add('ropc', SCENARIO.ropcAutomation(ctx.nameOf(uid), tool, e.ropcAutomation.detail[tool] ?? 0, ctx.enforceDate), [uid], 1)
    }
  }

  return out
}

const SESSION_GOALS = new Set(['admin-session', 'all-users-no-persistence', 'byod-session-controls', 'block-downloads-unmanaged', 'pim-activation-reauth', 'intune-enrollment-reauth', 'sign-in-risk', 'user-risk', 'sign-in-risk-medium', 'user-risk-medium'])

/** The cant-see lines a step carries under More (prompt 48 item 6), never a question. */
export function cantSeeFor(step: Step, ctx: Ctx): string[] {
  const out: string[] = []
  if (step.goalId === 'block-legacy-auth') {
    out.push(CANT_SEE.mailDevices)
    out.push(CANT_SEE.smtpPerMailbox)
  }
  if ((step.goalId === 'user-risk' || step.goalId === 'user-risk-medium') && ctx.hybridPresent) out.push(CANT_SEE.passwordWriteback)
  return out
}

export function scenarioContext(args: {
  snapshot: TenantSnapshot
  nameOf: (id: string) => string
  noMethodActive: string[]
}): Omit<Ctx, 'enforceDate'> {
  const { snapshot } = args
  const evidence = snapshot.scenarioEvidence ?? EMPTY
  const guestMfaTrust = (snapshot.config.crossTenantAccess?.rows ?? []).some((r) => {
    const row = r as { inboundTrust?: { isMfaAccepted?: boolean }; b2bCollaborationInbound?: { inboundTrust?: { isMfaAccepted?: boolean } } }
    return row.inboundTrust?.isMfaAccepted === true || row.b2bCollaborationInbound?.inboundTrust?.isMfaAccepted === true
  })
  const hybridPresent = snapshot.users.some((u) => u.onPremisesSyncEnabled === true)
  const syncRoleHolder =
    Object.entries(snapshot.roles.active).find(([, roles]) => roles.some((r) => r.toLowerCase() === DIR_SYNC_ROLE))?.[0] ?? null
  return { snapshot, evidence, nameOf: args.nameOf, guestMfaTrust, hybridPresent, syncRoleHolder, noMethodActive: args.noMethodActive }
}

/** Directory Synchronization Accounts (data/role-templates.json). */
export const DIR_SYNC_ROLE = 'd29b2b05-8046-44ba-8758-1e26182fcf32'

import { emptyScenarioEvidence } from '../derive/evidence.ts'
import { rolloutCohort } from './rings.ts'
import { effectsOf, familyReading } from './strand.ts'
const EMPTY = emptyScenarioEvidence()
