// Danger areas (2026-08-27 redesign): the explicit callouts — named people,
// what they need, the exact Entra path, and a link to help them. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'

export type DangerArea = {
  severity: 'high' | 'medium'
  title: string
  detail: string
  people: { name: string; need: string }[]
  entraPath: string | null
  link: { label: string; url: string } | null
}

const METHOD_SETUP_LINK = { label: 'Set up sign-in methods (for the user)', url: 'https://aka.ms/mfasetup' }
const AUTH_METHODS_PATH =
  'Entra admin center → Protection → Authentication methods → Policies'

export function findDangerAreas(args: {
  snapshot: TenantSnapshot
  viability: MfaViability[]
  highCareUserIds: string[]
  operatorUserId: string | null
  breakGlassUserIds: string[]
}): DangerArea[] {
  const { snapshot, viability, highCareUserIds, operatorUserId } = args
  const out: DangerArea[] = []
  const byId = new Map(viability.map((v) => [v.userId, v]))
  const nameOf = (id: string): string => {
    const u = snapshot.users.find((x) => x.id === id)
    return u?.displayName ?? u?.userPrincipalName ?? id
  }

  // 1. Users blocked today — before any change is made.
  const blockedIds = [...new Set(snapshot.blockedToday.flatMap((b) => b.userIds))]
  if (blockedIds.length > 0) {
    out.push({
      severity: 'high',
      title: `${blockedIds.length} user(s) are blocked today, before this plan changes anything`,
      detail:
        'Their most recent sign-in failed an existing Conditional Access policy. Fix this first — it will otherwise be blamed on the rollout.',
      people: blockedIds.map((id) => ({ name: nameOf(id), need: 'investigate the failing sign-in' })),
      entraPath: 'Entra admin center → Identity → Monitoring & health → Sign-in logs (filter: Failure)',
      link: {
        label: 'Troubleshoot sign-in problems with Conditional Access',
        url: 'https://learn.microsoft.com/entra/identity/conditional-access/troubleshoot-conditional-access',
      },
    })
  }

  // 2. High-care users who cannot complete MFA today.
  const careAtRisk = highCareUserIds
    .map((id) => ({ id, v: byId.get(id) }))
    .filter(({ v }) => v !== undefined && v.mfa !== 'verified' && v.mfa !== 'likelyViable')
  if (careAtRisk.length > 0) {
    out.push({
      severity: 'high',
      title: `${careAtRisk.length} handle-with-care user(s) would struggle with MFA today`,
      detail:
        'Set these people up personally before their step goes live — a call or desk visit, not an email blast. Enforcement stays gated until each is ready.',
      people: careAtRisk.map(({ id, v }) => ({
        name: nameOf(id),
        need:
          v!.mfa === 'none'
            ? 'has no MFA method — issue a Temporary Access Pass and walk them through Authenticator'
            : v!.strongestMethod === 'smsVoice'
              ? 'has only SMS/voice — upgrade them to Microsoft Authenticator'
              : 'method registered but unproven — have them complete one MFA sign-in',
      })),
      entraPath: `${AUTH_METHODS_PATH} (enable Temporary Access Pass, then Users → user → Authentication methods → Add)`,
      link: METHOD_SETUP_LINK,
    })
  }

  // 3. Admins on weak methods.
  const weakAdmins = viability.filter(
    (v) => v.isAdmin && v.activity === 'active' && !v.methodTiers.includes('phishingResistant'),
  )
  if (weakAdmins.length > 0) {
    out.push({
      severity: 'medium',
      title: `${weakAdmins.length} admin(s) have no phishing-resistant method`,
      detail: 'The admin-hardening phase requires passkeys/FIDO2. Get keys into their hands early.',
      people: weakAdmins.map((v) => ({
        name: nameOf(v.userId),
        need: `strongest today: ${v.strongestMethod === 'none' ? 'nothing' : v.strongestMethod} — register a passkey or FIDO2 key`,
      })),
      entraPath: `${AUTH_METHODS_PATH} → Passkey (FIDO2) → Enable and target these admins`,
      link: {
        label: 'Enable passkeys (FIDO2) for your organization',
        url: 'https://learn.microsoft.com/entra/identity/authentication/how-to-enable-passkey-fido2',
      },
    })
  }

  // 4. The operator's own escape route.
  if (operatorUserId !== null) {
    const op = byId.get(operatorUserId)
    if (op && !op.methodTiers.includes('phishingResistant') && op.mfa !== 'verified') {
      out.push({
        severity: 'high',
        title: 'Your own account is not provably safe yet',
        detail:
          "You are the person making these changes. Before enforcing anything that includes your account, register a strong method and complete one MFA sign-in — the industry's most embarrassing lockout is the operator's own.",
        people: [{ name: nameOf(operatorUserId), need: 'register a passkey/FIDO2 key and complete one MFA sign-in' }],
        entraPath: 'My sign-ins → Security info → Add method',
        link: METHOD_SETUP_LINK,
      })
    }
  }

  // 5. Break-glass accounts overdue for a drill.
  const staleBg = args.breakGlassUserIds.filter((id) => {
    const u = snapshot.users.find((x) => x.id === id)
    return (
      !u?.lastSuccessfulSignIn ||
      Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) > BREAK_GLASS_DRILL_DAYS * 86_400_000
    )
  })
  if (staleBg.length > 0) {
    out.push({
      severity: 'medium',
      title: `${staleBg.length} break-glass account(s) unproven in ${BREAK_GLASS_DRILL_DAYS}+ days`,
      detail: 'An emergency account that has not signed in recently is unproven exactly when it matters. Run the drill.',
      people: staleBg.map((id) => ({ name: nameOf(id), need: 'complete a test sign-in with its strong method' })),
      entraPath: null,
      link: {
        label: 'Manage emergency access accounts',
        url: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access',
      },
    })
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
}
