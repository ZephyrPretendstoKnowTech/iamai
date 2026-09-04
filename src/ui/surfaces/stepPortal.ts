// The What-to-do portal lines for a policy step (prompt 51 §3.2, owner: the
// baseline wins). The runtime renders the portal-line translator over the goal's
// mapped baseline policy — never the content file's reference lines — so the
// instruction shown is the baseline's actual policy. A merged goal renders
// Policy A and Policy B. A step whose goal the baseline does not hold has no
// policy and renders no portal block (its content is exempt).
//
// The baseline's policies carry the author's own objects (its exclusions group,
// its service-accounts group, its countries location, its trusted network) as
// placeholder ids with a token each. Every token resolves to the tenant's own
// object where the mapping names one (a saved decision included), and to the
// name the plan proposes for it where the tenant has none yet — never to an
// unnamed thing.
//
// Pure: no DOM, no network.
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../../coverage/facts.ts'
import type { CaPolicy } from '../../baseline/types.ts'
import { policiesForGoal, PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { labelledBlocks, portalLines } from '../../roadmap/portalLines.ts'
import type { PortalContext } from '../../roadmap/portalLines.ts'
import { shared } from '../../content/content.ts'
import { proposedNamesFor } from './proposedNames.ts'
import { tenantCountryLocation } from '../../mapping/countries.ts'
import type { MappingState } from '../../mapping/types.ts'
import { applyDeviations } from '../../roadmap/deviations.ts'
import { fillText } from '../../content/render.ts'
import type { StepVarContext } from './stepVars.ts'

type PinnedPolicy = { id: string | null; displayName: string; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
const POLICIES = pinned.policies as unknown as PinnedPolicy[]

/** The token → resolved-name map used to fill a policy's ids with the tenant's names. */
export type PortalNames = {
  nameOf: (id: string) => string
  policyName: string
  strengthName?: string | null
  /** The tenant's own objects behind the baseline's tokens, where the mapping names them. */
  exclusionsGroupId?: string | null
  serviceAccountsGroupId?: string | null
  allowedCountriesLocationId?: string | null
  trustedLocationIds?: string[]
  /** The names the plan proposes for the objects the tenant lacks, so a token never renders unnamed. */
  proposed?: { exclusionsGroup?: string | null; serviceAccountsGroup?: string | null; allowedCountries?: string | null; trustedLocation?: string | null } | null
  /** The stored answers (the applied mapping): the recorded deviations from the baseline are read from them (deviations.ts). */
  answers?: Pick<MappingState, 'questionAnswers'> | null
}

/**
 * The portal names for a step, from its variable context: the mapping's
 * objects (a saved decision applied), the tenant's countries location when one
 * matches the allowed list, and the plan's proposed names for the rest.
 */
export function portalNamesFor(ctx: StepVarContext, ex: Record<string, unknown>, fallbackTitle: string): PortalNames {
  const m = ctx.mapping
  const proposed = proposedNamesFor(ctx)
  return {
    nameOf: ctx.nameOf,
    policyName: String(ex.policyName ?? fallbackTitle),
    strengthName: typeof ex.strengthName === 'string' ? ex.strengthName : null,
    exclusionsGroupId: m.records?.['__globalExclusion']?.resolvedId ?? null,
    serviceAccountsGroupId: m.serviceAccountsGroupId ?? null,
    allowedCountriesLocationId: tenantCountryLocation(ctx.snapshot, m.allowedCountries ?? [])?.id ?? null,
    trustedLocationIds: m.trustedLocationIds ?? [],
    proposed,
    answers: m,
  }
}

/** What each placeholder token resolves to: the tenant's object, else the proposed name, else nothing. */
function tokenNames(names: PortalNames): Record<string, string | null> {
  const p = names.proposed ?? {}
  const one = (id: string | null | undefined, fallback: string | null | undefined): string | null => (id ? names.nameOf(id) : (fallback ?? null))
  const trusted = names.trustedLocationIds ?? []
  return {
    exclusionsGroup: one(names.exclusionsGroupId, p.exclusionsGroup),
    serviceAccountsGroup: one(names.serviceAccountsGroupId, p.serviceAccountsGroup),
    allowedCountries: one(names.allowedCountriesLocationId, p.allowedCountries),
    trustedLocation: trusted.length > 0 ? trusted.map((id) => names.nameOf(id)).join(', ') : (p.trustedLocation ?? null),
  }
}

function contextFor(p: PinnedPolicy, names: PortalNames): PortalContext {
  const ph = p.placeholders ?? {}
  const tokens = tokenNames(names)
  // The author's ids (lowercased, as the facts carry them), each with the name
  // its token resolves to; the exclusions and service-accounts ids are the
  // author's where the policy carries them, else the tenant's own (a body the
  // engine built already holds the tenant's objects).
  const byId = new Map<string, string>()
  let exclusionsGroupId: string | null = names.exclusionsGroupId?.toLowerCase() ?? null
  let serviceAccountsGroupId: string | null = names.serviceAccountsGroupId?.toLowerCase() ?? null
  for (const [id, token] of Object.entries(ph)) {
    const name = tokens[token]
    if (name) byId.set(id.toLowerCase(), name)
    if (token === 'exclusionsGroup') exclusionsGroupId = id.toLowerCase()
    if (token === 'serviceAccountsGroup') serviceAccountsGroupId = id.toLowerCase()
  }
  const nameOf = (id: string): string => byId.get(id.toLowerCase()) ?? names.nameOf(id)
  const strengthName = names.strengthName ?? (p.grantControls as { authenticationStrength?: { displayName?: string } } | null)?.authenticationStrength?.displayName ?? null
  const exclusionsGroup = tokens.exclusionsGroup ?? (exclusionsGroupId ? nameOf(exclusionsGroupId) : 'the exclusions group')
  return {
    policyName: names.policyName,
    nameOf,
    strengthName,
    portalRoot: shared.portalRoot as string,
    portalOpen: (shared.portalOpen as string).replace('{policy}', names.policyName),
    reportOnlyLine: shared.reportOnlyLine as string,
    exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', exclusionsGroup),
    exclusionsGroupId,
    serviceAccountsGroupId,
  }
}

/**
 * The sign-in frequency the goal's baseline policy wants, in words ("4 hours",
 * "weekly"), for the content lines that name {wanted}; null when the mapped
 * policy sets none (walk of f3d140b: the manager note read "expire after and").
 */
export function sessionWantedForGoal(goalId: string): string | null {
  const hours = sessionWantedHoursForGoal(goalId)
  return hours === null ? null : hoursInWords(hours)
}

/** The sign-in frequency the goal's baseline policy wants, in hours; null when the mapped policy sets none. */
function sessionWantedHoursForGoal(goalId: string): number | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped) {
    const sc = (p.sessionControls ?? null) as { signInFrequency?: { isEnabled?: boolean; value?: number; type?: string } } | null
    const f = sc?.signInFrequency
    if (!f || f.isEnabled === false || typeof f.value !== 'number') continue
    return /^day/i.test(String(f.type ?? '')) ? f.value * 24 : f.value
  }
  return null
}

/**
 * The same frequency as a duration an email can say "expire after": "4 hours",
 * "a day", "a week" ({wantedLong} on the admin-sessions email; "expire after
 * weekly" is not a sentence). Null when the mapped policy sets none.
 */
export function sessionWantedLongForGoal(goalId: string): string | null {
  const hours = sessionWantedHoursForGoal(goalId)
  if (hours === null) return null
  if (hours === 1) return 'an hour'
  if (hours < 24) return `${hours} hours`
  if (hours === 24) return 'a day'
  if (hours === 168) return 'a week'
  return hours % 24 === 0 ? `${hours / 24} days` : `${hours} hours`
}

// The combinations a phishing-resistant strength allows: a passkey or key,
// Windows Hello, a certificate, and the Temporary Access Pass that bootstraps one.
const PASSKEY_COMBINATIONS = new Set(['fido2', 'windowshelloforbusiness', 'x509certificatemultifactor', 'x509certificatesinglefactor', 'temporaryaccesspassonetime', 'temporaryaccesspassmultiuse'])

/** True when the goal's mapped baseline policy requires a strength only a passkey (or key) satisfies: the policy needs a passkey. */
export function needsPasskeyForGoal(goalId: string): boolean {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped as PinnedPolicy[]) {
    const combos = (p.grantControls as { authenticationStrength?: { allowedCombinations?: string[] } } | null)?.authenticationStrength?.allowedCombinations
    if (Array.isArray(combos) && combos.length > 0 && combos.every((c) => PASSKEY_COMBINATIONS.has(String(c).toLowerCase()))) return true
  }
  return false
}

/** The authentication-strength name the goal's mapped baseline policy requires, for the who and decision lines (walk-51 item 18). */
export function strengthForGoal(goalId: string): string | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped as PinnedPolicy[]) {
    const s = (p.grantControls as { authenticationStrength?: { displayName?: string } } | null)?.authenticationStrength?.displayName
    if (typeof s === 'string' && s.length > 0) return s
  }
  return null
}

/**
 * The portal lines for a policy body the engine built — the floor's step, whose
 * goal the baseline does not hold, renders Microsoft's template (resolved with
 * the tenant's objects) through the same translator as a baseline policy. The
 * exclusions read as the exclusions group, never the emergency accounts by name.
 */
export function stepPortalLinesFromBody(json: string, names: PortalNames): string[] | null {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  const p: PinnedPolicy = { id: null, displayName: String(body.displayName ?? names.policyName), conditions: body.conditions ?? null, grantControls: body.grantControls ?? null, sessionControls: body.sessionControls ?? null, placeholders: {} }
  const lines = portalLines(policyFacts(p as unknown as CaPolicy, new Map()), contextFor(p, names))
  return lines.length > 0 ? lines : null
}

/**
 * The portal lines for a goal's step, from its mapped baseline policy. Returns
 * null when the baseline does not hold the goal (no policy to render).
 */
export function stepPortalLines(goalId: string, names: PortalNames): string[] | null {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  if (mapped.length === 0) return null
  // The person's answers as recorded deviations (deviations.ts): the same rule
  // the engine's JSON passes through. Every line the deviation changes is shown
  // beside the baseline's version, so the choice and the baseline both stay on screen.
  const deviated = (p: PinnedPolicy): PinnedPolicy => (names.answers ? (applyDeviations(p as unknown as Record<string, unknown>, goalId, names.answers) as unknown as PinnedPolicy) : p)
  const linesOf = (p: PinnedPolicy): string[] => portalLines(policyFacts(p as unknown as CaPolicy, new Map()), contextFor(p, names))
  const annotated = (p: PinnedPolicy): string[] => {
    const d = deviated(p)
    return d === p ? linesOf(p) : besideBaseline(linesOf(d), linesOf(p))
  }
  if (mapped.length >= 2) {
    const a = mapped[0] as PinnedPolicy
    const b = mapped[1] as PinnedPolicy
    return labelledBlocks({ lines: annotated(a), name: names.policyName }, { lines: annotated(b), name: names.policyName }, { a: 'A', b: 'B' })
  }
  return annotated(mapped[0] as PinnedPolicy)
}

/**
 * The head of a portal line (its section), so a changed line finds the
 * baseline's line for the same section: a condition by its kind (Conditions →
 * Device platforms), a grant or session control by its heading alone (Grant →
 * Require multifactor authentication stands in for Grant → Require
 * authentication strength: …).
 */
const sectionOf = (line: string): string => {
  const parts = line.split(' → ')
  return /^(Grant|Session)$/.test(parts[0]) ? parts[0] : parts.slice(0, 2).join(' → ')
}

/**
 * The deviated lines, each one the deviation changed carrying the baseline's
 * version beside it (shared.deviation.line); a line the deviation adds names
 * the baseline's absence (shared.deviation.none).
 */
export function besideBaseline(lines: string[], baseline: string[]): string[] {
  const words = shared.deviation as { line: string; none: string }
  return lines.map((line) => {
    if (baseline.includes(line)) return line
    const was = baseline.find((b) => sectionOf(b) === sectionOf(line))
    return fillText(words.line, { line, baseline: was ?? words.none })
  })
}
