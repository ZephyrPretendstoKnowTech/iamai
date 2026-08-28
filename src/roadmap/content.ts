// Step content (roadmap-v2.md §4): what could go wrong with this tenant's
// evidence, how to verify with the exact portal location and filter, and
// the help-desk notes. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { FAILURE, HELP_DESK, VERIFY } from '../copy/stepContent.ts'
import { countryName } from '../mapping/countries.ts'
import { READINESS_THRESHOLD_MFA_PERCENT } from './constants.ts'
import type { FailureMode, HelpDesk, Step, Verify } from './types.ts'

export type ContentContext = {
  snapshot: TenantSnapshot
  viability: Map<string, MfaViability>
  adminIds: Set<string>
  breakGlassIds: Set<string>
  serviceAccountIds: Set<string>
  deviceReady: Set<string>
  allowedCountries: string[]
  policyName: (step: Step) => string
  /** Guests, indexed once: 25,000 users are never rescanned per step. */
  guestIds: Set<string>
}

const evidenceUsable = (snapshot: TenantSnapshot): boolean => {
  const st = snapshot.sources.signInEvidence?.status
  return st === 'ok' || st === 'partial'
}

function activeIn(step: Step, ctx: ContentContext): string[] {
  return step.population.ids.filter((id) => ctx.viability.get(id)?.activity === 'active')
}

/** The real-world failure modes for this control, each annotated with this tenant's evidence. */
export function failureModesFor(step: Step, ctx: ContentContext): FailureMode[] {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'recurring' || step.status === 'done') return []
  const { snapshot } = ctx
  const usable = evidenceUsable(snapshot)
  const usage = snapshot.evidenceUsage
  const family = step.readiness.family
  const active = activeIn(step, ctx)
  const modes: FailureMode[] = []
  const mode = (title: string, applies: FailureMode['applies'], evidence: string): void => {
    modes.push({ title, applies, evidence })
  }

  if (family === 'block') {
    const F = FAILURE.legacy
    const isDeviceCode = step.goalId === 'block-device-code'
    const isTransfer = step.goalId === 'block-auth-transfer'
    if (isDeviceCode) {
      const seen = usage?.deviceCode.userIds.length ?? 0
      const ev = !usable || !usage ? FAILURE.deviceCode.evidence.unknown : seen > 0 ? FAILURE.deviceCode.evidence.seen(seen) : FAILURE.deviceCode.evidence.none
      const applies = !usable || !usage ? 'unknown' : seen > 0 ? 'yes' : 'no'
      mode(FAILURE.deviceCode.tools, applies, ev)
      mode(FAILURE.deviceCode.tvs, applies, ev)
    } else if (isTransfer) {
      const seen = usage?.authTransfer.userIds.length ?? 0
      const ev = !usable || !usage ? FAILURE.authTransfer.evidence.unknown : seen > 0 ? FAILURE.authTransfer.evidence.seen(seen) : FAILURE.authTransfer.evidence.none
      mode(FAILURE.authTransfer.handoff, !usable || !usage ? 'unknown' : seen > 0 ? 'yes' : 'no', ev)
    } else {
      const seenIds = usage?.legacyAuth.userIds ?? []
      const protocols = Object.entries(usage?.legacyAuth.byDetail ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, n]) => `${k} ${n}`)
        .join(', ')
      const ev = !usable || !usage ? F.evidence.unknown : seenIds.length > 0 ? F.evidence.seen(seenIds.length, protocols || 'protocol not recorded') : F.evidence.none
      const applies = !usable || !usage ? 'unknown' : seenIds.length > 0 ? 'yes' : 'no'
      mode(F.devices, applies, ev)
      mode(F.lob, applies, ev)
      const svc = seenIds.filter((id) => ctx.serviceAccountIds.has(id)).length
      mode(F.mailboxes, svc > 0 ? 'yes' : applies === 'unknown' ? 'unknown' : 'no', svc > 0 ? F.evidence.serviceAccounts(svc) : ev)
    }
  } else if (family === 'device') {
    const F = FAILURE.device
    const known = snapshot.sources.devices?.status === 'ok'
    const members = active.filter((id) => !ctx.guestIds.has(id))
    const noDevice = members.filter((id) => !ctx.deviceReady.has(id)).length
    const ev = !known ? F.evidence.unknown : noDevice > 0 ? F.evidence.noDevice(noDevice, members.length) : F.evidence.allCovered
    const applies = !known ? 'unknown' : noDevice > 0 ? 'yes' : 'no'
    mode(F.personal, applies, ev)
    mode(F.kiosks, applies === 'no' ? 'no' : 'unknown', ev)
    const guests = step.population.ids.filter((id) => ctx.guestIds.has(id)).length
    mode(F.contractors, guests > 0 ? 'yes' : 'no', guests > 0 ? F.evidence.guests(guests) : F.evidence.allCovered)
    const os = new Map<string, number>()
    for (const d of snapshot.devices) os.set(d.operatingSystem ?? 'unknown', (os.get(d.operatingSystem ?? 'unknown') ?? 0) + 1)
    const summary = [...os.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')
    const nonWindows = [...os.entries()].filter(([k]) => !/windows/i.test(k)).reduce((n, [, c]) => n + c, 0)
    mode(F.platforms, !known ? 'unknown' : nonWindows > 0 ? 'yes' : 'no', known && summary ? F.evidence.platforms(summary) : F.evidence.unknown)
  } else if (family === 'location') {
    const F = FAILURE.geo
    const byCountry = snapshot.evidenceAggregates?.byCountry ?? {}
    const allowed = new Set(ctx.allowedCountries)
    const outside = Object.entries(byCountry).filter(([c]) => c && !allowed.has(c))
    const users = outside.reduce((n, [, c]) => n + c, 0)
    const names = outside.map(([c]) => countryName(c)).slice(0, 6).join(', ')
    const ev = !usable ? F.evidence.unknown : outside.length > 0 ? F.evidence.seen(names, users) : F.evidence.none
    const applies = !usable ? 'unknown' : outside.length > 0 ? 'yes' : 'no'
    mode(F.travel, applies, ev)
    mode(F.vpn, applies === 'no' ? 'no' : 'unknown', ev)
    mode(F.roaming, applies === 'no' ? 'no' : 'unknown', ev)
  } else if (family === 'mfa' || family === 'guest') {
    const F = FAILURE.mfa
    const regKnown = snapshot.sources.registrationDetails?.status === 'ok'
    const noMethod = active.filter((id) => ctx.viability.get(id)?.mfa === 'none').length
    const smsOnly = active.filter((id) => ctx.viability.get(id)?.signals.smsVoiceOnly === true).length
    const dormant = step.population.ids.filter((id) => ctx.viability.get(id)?.activity !== 'active').length
    mode(F.noMethod, !regKnown ? 'unknown' : noMethod > 0 ? 'yes' : 'no', !regKnown ? F.evidence.unknown : noMethod > 0 ? F.evidence.noMethod(noMethod) : F.evidence.allSet)
    mode(F.smsOnly, !regKnown ? 'unknown' : smsOnly > 0 ? 'yes' : 'no', !regKnown ? F.evidence.unknown : smsOnly > 0 ? F.evidence.smsOnly(smsOnly) : F.evidence.allSet)
    mode(F.dormant, dormant > 0 ? 'yes' : 'no', dormant > 0 ? F.evidence.dormant(dormant) : F.evidence.allSet)
    mode(F.shared, ctx.serviceAccountIds.size > 0 ? 'unknown' : 'no', !regKnown ? F.evidence.unknown : F.evidence.allSet)
    if (family === 'guest') {
      const G = FAILURE.guest
      const guests = active.length
      const trust = (snapshot.config.crossTenantAccess?.rows ?? []).some((r) => {
        const row = r as { inboundTrust?: { isMfaAccepted?: boolean } }
        return row.inboundTrust?.isMfaAccepted === true
      })
      mode(G.home, guests === 0 ? 'no' : trust ? 'no' : 'yes', guests === 0 ? G.evidence.none : trust ? G.evidence.trusted(guests) : G.evidence.guests(guests))
    }
  } else if (family === 'admin') {
    const F = FAILURE.admin
    const regKnown = snapshot.sources.registrationDetails?.status === 'ok'
    const admins = step.population.ids
    const without = admins.filter((id) => !(ctx.viability.get(id)?.methodTiers ?? []).includes('phishingResistant')).length
    mode(F.noKey, !regKnown ? 'unknown' : without > 0 ? 'yes' : 'no', !regKnown ? F.evidence.unknown : without > 0 ? F.evidence.without(without, admins.length) : F.evidence.all)
    const eligible = Object.keys(snapshot.roles.eligible).filter((id) => !(id in snapshot.roles.active)).length
    mode(F.eligible, eligible > 0 ? 'yes' : 'no', eligible > 0 ? F.evidence.eligible(eligible) : F.evidence.all)
    const bgIn = admins.some((id) => ctx.breakGlassIds.has(id))
    mode(F.breakGlass, bgIn ? 'yes' : 'no', bgIn ? F.evidence.breakGlassIn : F.evidence.breakGlassOut)
  } else {
    // Session controls and anything else that only changes the prompt cadence.
    mode(FAILURE.session.unsaved, active.length > 0 ? 'yes' : 'no', FAILURE.session.evidence(active.length))
    mode(FAILURE.session.kiosks, 'unknown', FAILURE.session.evidence(active.length))
  }
  mode(FAILURE.generic.misconfig, 'unknown', FAILURE.generic.evidence)
  return modes
}

/** Where to look, the exact sign-in log filter, and what good looks like. */
export function verifyFor(step: Step, ctx: ContentContext, ringName: string | null): Verify {
  const name = ctx.policyName(step)
  const allowed = ctx.allowedCountries.map(countryName).join(', ')
  if (step.kind === 'prerequisite') return { where: [VERIFY.objects], filter: null, good: VERIFY.goodPrerequisite }
  if (step.kind === 'verify') return { where: [VERIFY.registration], filter: null, good: VERIFY.goodVerify(READINESS_THRESHOLD_MFA_PERCENT) }
  if (step.kind === 'recurring') return { where: [VERIFY.signInLogs], filter: VERIFY.filterPolicy(name), good: VERIFY.goodPrerequisite }
  const family = step.readiness.family
  const filter =
    family === 'block'
      ? step.goalId === 'block-device-code'
        ? VERIFY.filterDeviceCode
        : step.goalId === 'block-auth-transfer'
          ? VERIFY.filterAuthTransfer
          : VERIFY.filterLegacy
      : family === 'location'
        ? VERIFY.filterCountry(allowed || '—')
        : family === 'device'
          ? VERIFY.filterDevice
          : family === 'mfa' || family === 'guest' || family === 'admin'
            ? VERIFY.filterMfa
            : VERIFY.filterSession
  const good =
    family === 'block' || family === 'location'
      ? VERIFY.goodBlock
      : family === 'other'
        ? VERIFY.goodSession
        : VERIFY.goodGrant(95, ringName ?? 'ring')
  return { where: [VERIFY.reportOnly(name), VERIFY.signInLogs], filter: `${VERIFY.filterPolicy(name)}; ${filter}`, good }
}

export function helpDeskFor(step: Step): HelpDesk | null {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'recurring' || step.status === 'done') return null
  const family = step.readiness.family
  const H = family === 'mfa' || family === 'guest' ? HELP_DESK.mfa : family === 'admin' ? HELP_DESK.admin : family === 'device' ? HELP_DESK.device : family === 'block' ? HELP_DESK.block : family === 'location' ? HELP_DESK.location : HELP_DESK.session
  const extra = family === 'guest' ? HELP_DESK.guest : null
  return { callsAbout: [...H.calls, ...(extra?.calls ?? [])], whatToSay: [...H.say, ...(extra?.say ?? [])] }
}
