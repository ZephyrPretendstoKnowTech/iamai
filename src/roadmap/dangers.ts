// Danger areas (2026-08-27 redesign): the explicit callouts — named people,
// what they need, the exact Entra path, and a link to help them. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { DANGER } from '../copy/dangers.ts'
import { METHOD_TIER } from '../copy/definitions.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'

export type DangerArea = {
  severity: 'high' | 'medium'
  title: string
  detail: string
  people: { name: string; need: string }[]
  entraPath: string | null
  link: { label: string; url: string } | null
}

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
    const c = DANGER.blockedToday
    out.push({
      severity: 'high',
      title: c.title(blockedIds.length),
      detail: c.detail,
      people: blockedIds.map((id) => ({ name: nameOf(id), need: c.need })),
      entraPath: c.path,
      link: c.link,
    })
  }

  // 2. High-care users who cannot complete MFA today.
  const careAtRisk = highCareUserIds
    .map((id) => ({ id, v: byId.get(id) }))
    .filter(({ v }) => v !== undefined && v.mfa !== 'verified' && v.mfa !== 'likelyViable')
  if (careAtRisk.length > 0) {
    const c = DANGER.careAtRisk
    out.push({
      severity: 'high',
      title: c.title(careAtRisk.length),
      detail: c.detail,
      people: careAtRisk.map(({ id, v }) => ({
        name: nameOf(id),
        need: v!.mfa === 'none' ? c.noMethod : v!.strongestMethod === 'smsVoice' ? c.smsOnly : c.unproven,
      })),
      entraPath: c.path(DANGER.authMethodsPath),
      link: DANGER.methodSetupLink,
    })
  }

  // 3. Admins on weak methods.
  const weakAdmins = viability.filter(
    (v) => v.isAdmin && v.activity === 'active' && !v.methodTiers.includes('phishingResistant'),
  )
  if (weakAdmins.length > 0) {
    const c = DANGER.weakAdmins
    out.push({
      severity: 'medium',
      title: c.title(weakAdmins.length),
      detail: c.detail,
      people: weakAdmins.map((v) => ({
        name: nameOf(v.userId),
        need: c.need(v.strongestMethod === 'none' ? c.nothing : METHOD_TIER[v.strongestMethod].title.toLowerCase()),
      })),
      entraPath: c.path(DANGER.authMethodsPath),
      link: c.link,
    })
  }

  // 4. The operator's own escape route.
  if (operatorUserId !== null) {
    const op = byId.get(operatorUserId)
    if (op && !op.methodTiers.includes('phishingResistant') && op.mfa !== 'verified') {
      const c = DANGER.operator
      out.push({
        severity: 'high',
        title: c.title,
        detail: c.detail,
        people: [{ name: nameOf(operatorUserId), need: c.need }],
        entraPath: c.path,
        link: DANGER.methodSetupLink,
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
    const c = DANGER.staleBreakGlass
    out.push({
      severity: 'medium',
      title: c.title(staleBg.length, BREAK_GLASS_DRILL_DAYS),
      detail: c.detail,
      people: staleBg.map((id) => ({ name: nameOf(id), need: c.need })),
      entraPath: null,
      link: c.link,
    })
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
}
