// Jon Hope's baseline: what it says about its own policies beyond their JSON
// (v2.0 prep, Phase A item 5). Each fact was decided with the owner and is
// recorded where it was decided; it moved here from the generic module that
// used to hold it, unchanged.
//
// Pure: data and one correction.
import type { BaselineAnnotations, CorrectablePolicy } from '../annotations.ts'

type Conditions = { users?: Record<string, unknown>; applications?: Record<string, unknown>; platforms?: unknown; [key: string]: unknown }

export const JHOPE188_ANNOTATIONS: BaselineAnnotations = {
  // Jon's three ZTCA incident switches (T2-LK; owner, 2026-10-03), escalating:
  // the admin portals, then unmanaged devices outside the trusted network, then everything.
  lockdownSwitches: [
    { key: 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e', reviewedName: 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal', switch: 'adminPortals' },
    { key: '2dd84b12-7900-40f0-b192-027c20aaa83f', reviewedName: 'IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation', switch: 'unmanagedDevices' },
    { key: '8417ec17-17f5-44c1-b937-85b1917f5d9e', reviewedName: 'IAC- ZTCA - GLOBAL - BLOCK - AllApps -Exclude CA-Global', switch: 'everything' },
  ],
  corrections: [
    {
      policy: 'IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration',
      goal: 'register-info-protected',
      evidence: "Jon confirmed his export targets device registration on iPhones only by mistake: it protects security-information registration (docs/plans/roadmap-flow/v1-plan.md, Phase 2a: \"5.1 stays: it is what Jon said his export meant\"). Its include is his own registration pilot group, which no tenant holds (interpretation.json: decisionRequired), so the plan reads it as the people the plan rolls out to, All users, as his other policies include them.",
      apply: (p: CorrectablePolicy): CorrectablePolicy => {
        const c = (p.conditions ?? {}) as Conditions
        const users = { ...(c.users ?? {}), includeUsers: ['All'], includeGroups: [] }
        const applications = { ...(c.applications ?? {}), includeUserActions: ['urn:user:registersecurityinfo'] }
        return { ...p, conditions: { ...c, users, applications, platforms: null } }
      },
    },
  ],
  // T2-FTR: a specific footer reason for each pinned policy no step holds.
  footerReasons: [
    { ids: ['0ab1380f-3863-40a5-ab97-24250e1cf44e', '1d8beea4-2ea1-4758-8e22-d6310a60220a'], match: /IAC\s*-\s*AGENT\s*-\s*BLOCK/i, reason: 'agentBlock' },
    { ids: ['bb6a814e-808a-467c-9475-06f89140ce99'], match: /\bEAM\b.*High-Risk/i, reason: 'externalMfaRisk', step: 'user-risk' },
    { ids: ['a53c4c2b-b577-4d88-b64d-36b92f8f3ca0'], match: /MFA-Passkeys\s*-\s*ADM-Users/i, reason: 'adminGroupPasskeys', step: 'admins-phishing-resistant' },
    { ids: ['1588fdc7-f34a-468e-8023-4d788ef5d226'], match: /BreakGlass/i, reason: 'emergencyAccount', step: 'emergency-access' },
    // Jon's countries block with no travel exception: optional, on the plan once countries are listed to block outright (coverage/companions.ts; v1.1 D4).
    { ids: ['1eaf943a-abad-4c77-b101-0c5342fc1044'], match: /Countries.*no[-_ ]?exclusions?/i, reason: 'blockedCountries', step: 'geo-restriction' },
  ],
  // Jon's two AGENT blocks: incomplete pinned definitions, hidden for the V1 journey.
  hiddenPolicies: /IAC\s*-\s*AGENT\s*-\s*BLOCK\s*-\s*(HighRiskAgent|NonTrustedAgents)/i,
  // The high-risk users goal's second policy is Jon's EAM companion.
  companionGoals: ['user-risk'],
  // The countries goal's second policy is Jon's NoExclusions block (v1.1 D4).
  blockedCountriesGoal: 'geo-restriction',
}
