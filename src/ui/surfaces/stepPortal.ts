// The What-to-do portal lines for a policy step (prompt 51 §3.2, owner: the
// baseline wins). The runtime renders the portal-line translator over the goal's
// mapped baseline policy — never the content file's reference lines — so the
// instruction shown is the baseline's actual policy. A merged goal renders
// Policy A and Policy B. A step whose goal the baseline does not hold has no
// policy and renders no portal block (its content is exempt).
//
// The baseline's policies carry the author's own objects (its exclusions group,
// its service-accounts group, its countries location, its trusted network) as
// placeholder ids with a token each. They become this tenant's objects once, at
// the roadmap boundary (roadmap/generate.ts over roadmap/resolvePolicy.ts),
// which is also where the person's answers are applied and where the policy
// becomes the artifact the step will create or change. The step carries the
// result (`step.action.resolution`), and these lines render exactly that: the
// same bodies the JSON, the PowerShell and the download carry, in the same
// order. Nothing here resolves a reference, applies an answer or reads the
// mapping — pair a step with any other mapping context and its instructions do
// not move, because they are the step's.
//
// While the step names an object this tenant does not have yet, or has no
// artifact at all, no implementation is offered: no portal lines, no JSON, no
// PowerShell, no download (stepJson.ts implementationOffered). The step says
// what is missing and which Preparation step creates it instead.
//
// Pure: no DOM, no network.
import pinned from '../../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../../coverage/facts.ts'
import type { CaPolicy } from '../../baseline/types.ts'
import { policiesForGoal, PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { analysisUnknown, effectsOf } from '../../roadmap/strand.ts'
import { strengthLookupOf } from '../../roadmap/operations.ts'
import { labelledBlocks, portalLines } from '../../roadmap/portalLines.ts'
import type { PortalSection } from '../../roadmap/portalLines.ts'
import { implementationOffered } from './stepJson.ts'
import type { PortalContext } from '../../roadmap/portalLines.ts'
import type { Step, StepResolution } from '../../roadmap/types.ts'
import { shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { StepVarContext } from './stepVars.ts'
import builtinStrengths from '../../../data/builtin-strengths.json' with { type: 'json' }

type PinnedPolicy = { id: string | null; displayName: string; conditions: unknown; grantControls: unknown; sessionControls: unknown; placeholders: Record<string, string> }
const POLICIES = pinned.policies as unknown as PinnedPolicy[]

/**
 * What the lines need that is not in the policy itself: how to turn an id into
 * the name this tenant knows it by, and the strength's name. Nothing here
 * decides what the policy is — that is the step's.
 */
export type PortalNames = {
  nameOf: (id: string) => string
  /** The fallback name for a body that carries none (the step's title). */
  policyName: string
  strengthName?: string | null
  /**
   * The name this tenant knows an authentication strength by, from its own
   * metadata. The request carries a reference and nothing that describes the
   * object it points at (roadmap/operations.ts), so the instruction's name comes
   * from here rather than from the body.
   */
  strengthNameFor?: (id: string) => string | null
}

/**
 * What this tenant calls an authentication strength: its own row for it, then
 * the name the person who confirmed the mapping picked it under, then
 * Microsoft's own name for a built-in one. Null where nothing in the tenant
 * describes it — better a generic instruction than one naming a different
 * object.
 */
export function strengthNameOf(id: string, ctx: Pick<StepVarContext, 'snapshot' | 'mapping'>): string | null {
  const key = id.toLowerCase()
  for (const raw of (ctx.snapshot.config.authStrengths?.rows ?? []) as Record<string, unknown>[]) {
    if (typeof raw.id === 'string' && raw.id.toLowerCase() === key && typeof raw.displayName === 'string' && raw.displayName.length > 0) return raw.displayName
  }
  for (const rec of Object.values(ctx.mapping.records ?? {})) {
    if (typeof rec.resolvedId === 'string' && rec.resolvedId.toLowerCase() === key && typeof rec.resolvedName === 'string' && rec.resolvedName.length > 0) return rec.resolvedName
  }
  return BUILT_IN_STRENGTH_NAMES.get(key) ?? null
}

const BUILT_IN_STRENGTH_NAMES = new Map<string, string>(builtinStrengths.strengths.map((s) => [s.id.toLowerCase(), s.displayName]))

/** The names a step's lines need, from its variable context. */
export function portalNamesFor(ctx: StepVarContext, ex: Record<string, unknown>, fallbackTitle: string): PortalNames {
  return {
    nameOf: ctx.nameOf,
    policyName: String(ex.policyName ?? fallbackTitle),
    strengthName: typeof ex.strengthName === 'string' ? ex.strengthName : null,
    strengthNameFor: (id) => strengthNameOf(id, ctx),
  }
}

/**
 * The context for one body the step carries. Every id in it is this tenant's,
 * resolved at the roadmap boundary; the two group ids are the ones that
 * resolution used, read off the step, so a line labels the object the body
 * actually holds. The name on the block is the body's own.
 */
function contextFor(p: PinnedPolicy, names: PortalNames, used: StepResolution['tenant'], openName?: string): PortalContext {
  const exclusionsGroupId: string | null = used.exclusionsGroupId?.toLowerCase() ?? null
  const serviceAccountsGroupId: string | null = used.serviceAccountsGroupId?.toLowerCase() ?? null
  const nameOf = names.nameOf
  const policyName = typeof p.displayName === 'string' && p.displayName.length > 0 ? p.displayName : names.policyName
  // The strength the operation's own body names. A body that names one and
  // carries no friendly name for it — a confirmed mapping to a tenant object the
  // scan has no row for — falls back to the generic phrase, never to the
  // baseline author's name for a different object and never to a raw id. The
  // goal's own name stands in only where the body names no strength at all.
  const strength = (p.grantControls as { authenticationStrength?: { id?: unknown } } | null | undefined)?.authenticationStrength
  const strengthId = typeof strength?.id === 'string' ? strength.id : null
  const strengthName = strength ? (strengthId ? (names.strengthNameFor?.(strengthId) ?? null) : null) : (names.strengthName ?? null)
  const exclusionsGroup = exclusionsGroupId ? nameOf(exclusionsGroupId) : 'the exclusions group'
  return {
    policyName,
    nameOf,
    strengthName,
    portalRoot: shared.portalRoot as string,
    // An update opens the tenant's own policy, by the name the tenant knows it by.
    portalOpen: (shared.portalOpen as string).replace('{policy}', openName ?? policyName),
    reportOnlyLine: shared.reportOnlyLine as string,
    changeUntouched: shared.changeUntouched as string,
    enableLine: shared.enableLine as string,
    exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', exclusionsGroup),
    exclusionsGroupId,
    serviceAccountsGroupId,
    emergencyIds: used.emergencyIds ?? [],
  }
}

/** The sections an update's body carries, so the instruction lists those and no others. */
function sectionsOf(body: Record<string, unknown>): Set<PortalSection> {
  const only = new Set<PortalSection>()
  const conditions = (body.conditions ?? {}) as Record<string, unknown>
  if (conditions.users !== undefined) only.add('users')
  if (conditions.applications !== undefined) only.add('applications')
  if (body.grantControls !== undefined) only.add('grant')
  if (body.sessionControls !== undefined) only.add('session')
  if (body.state !== undefined) only.add('state')
  return only
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
  return hours === null ? null : hoursAsDuration(hours)
}

/** A number of hours as a duration an email can say "expire after". */
export function hoursAsDuration(hours: number): string {
  if (hours === 1) return 'an hour'
  if (hours < 24) return `${hours} hours`
  if (hours === 24) return 'a day'
  if (hours === 168) return 'a week'
  return hours % 24 === 0 ? `${hours / 24} days` : `${hours} hours`
}

// The combinations a phishing-resistant strength allows: a passkey or key,
// Windows Hello, a certificate, and the Temporary Access Pass that bootstraps one.
const PASSKEY_COMBINATIONS = new Set(['fido2', 'windowshelloforbusiness', 'x509certificatemultifactor', 'x509certificatesinglefactor', 'temporaryaccesspassonetime', 'temporaryaccesspassmultiuse'])

/**
 * True when a step's own policy will require a strength only a passkey (or key)
 * satisfies. The operation answers for an open policy, against what this tenant
 * says the strength allows — never the combinations the baseline's author wrote
 * beside the id. Where the analysis cannot settle it, nothing is claimed; the
 * baseline speaks only for a step with no policy of its own.
 */
export function needsPasskey(step: Step, ctx: Pick<StepVarContext, 'snapshot'>): boolean {
  const effects = effectsOf(step)
  if (effects === null) return needsPasskeyForGoal(step.goalId)
  if (analysisUnknown(step)) return false
  const lookup = strengthLookupOf(ctx.snapshot as never)
  for (const e of effects) {
    const id = e.strength?.id
    if (id === undefined) continue
    const combos = lookup.get(id.toLowerCase()) ?? []
    if (combos.length > 0 && combos.every((c) => PASSKEY_COMBINATIONS.has(String(c).toLowerCase()))) return true
  }
  return false
}

/** True when the goal's mapped baseline policy requires a strength only a passkey (or key) satisfies: the policy needs a passkey. */
export function needsPasskeyForGoal(goalId: string): boolean {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped as PinnedPolicy[]) {
    const combos = (p.grantControls as { authenticationStrength?: { allowedCombinations?: string[] } } | null)?.authenticationStrength?.allowedCombinations
    if (Array.isArray(combos) && combos.length > 0 && combos.every((c) => PASSKEY_COMBINATIONS.has(String(c).toLowerCase()))) return true
  }
  return false
}

/** The baseline's own names for a goal it implements with two policies (Policy A and Policy B), in the map's order; empty otherwise. */
export function pairBaselineNames(goalId: string): string[] {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  return mapped.length >= 2 ? mapped.map((p) => p.displayName) : []
}

/**
 * True when the goal's mapped baseline policy prompts a person: it requires MFA
 * or an authentication strength, or sets a sign-in frequency. The shared-device
 * accounts are excluded from every such policy (the shared-devices step's last line).
 */
export function promptsPersonForGoal(goalId: string): boolean {
  const mapped = policiesForGoal(PINNED_GOAL_MAP, POLICIES, goalId)
  for (const p of mapped as PinnedPolicy[]) {
    const g = p.grantControls as { builtInControls?: string[]; authenticationStrength?: unknown } | null
    if ((g?.builtInControls ?? []).some((c) => String(c).toLowerCase() === 'mfa') || (g?.authenticationStrength ?? null) !== null) return true
    const f = (p.sessionControls as { signInFrequency?: { isEnabled?: boolean } } | null)?.signInFrequency
    if (f && f.isEnabled !== false) return true
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
 * The portal instructions for a step, rendered from the resolved policies the
 * roadmap already produced for it (`step.action.resolution`). Returns null and
 * offers nothing when:
 *
 * - the baseline's definition of the goal contradicts itself
 *   (roadmap/baselineConflict.ts);
 * - the step names an object this tenant does not have yet — the same condition
 *   that withholds the JSON, the PowerShell and the download, so the four never
 *   disagree about whether the policy can be implemented;
 * - the baseline holds no policy for the goal, so there is nothing to render.
 *
 * The one place the lines are made, so the screen, the print and the exports all
 * get the same answer.
 */
export function stepPortalLines(step: Step, names: PortalNames): string[] | null {
  if (!implementationOffered(step)) return null
  const resolution = step.action.resolution
  const mapped = resolution?.policies ?? []
  if (mapped.length === 0) return null
  const asPolicy = (body: Record<string, unknown>): PinnedPolicy => body as unknown as PinnedPolicy
  // The operation's own name for the policy it opens: an update names the
  // tenant's policy, a create names the one the plan proposes.
  const openNameOf = (one: (typeof mapped)[number]): string => {
    const whole = (one.target ?? one.body) as Record<string, unknown>
    return typeof whole.displayName === 'string' && whole.displayName ? whole.displayName : names.policyName
  }
  const linesOf = (one: (typeof mapped)[number], body: Record<string, unknown>): string[] => {
    const p = asPolicy(body)
    const ctx = contextFor(p, names, resolution!.tenant, openNameOf(one))
    // An update lists the fields its own body carries and says the rest is left
    // alone; a create describes the whole policy it writes.
    return one.mode === 'update'
      ? portalLines(policyFacts(p as unknown as CaPolicy, new Map()), ctx, { mode: 'change', only: sectionsOf(body) })
      : portalLines(policyFacts(p as unknown as CaPolicy, new Map()), ctx)
  }
  // A policy an answer changed carries the baseline's own version with it
  // (roadmap/generate.ts), so every line the answer moved is shown beside what
  // the baseline said. The answer is not applied here; it is already in the body.
  const annotated = (one: (typeof mapped)[number]): string[] => (one.baseline ? besideBaseline(linesOf(one, one.body), linesOf(one, one.baseline)) : linesOf(one, one.body))
  const nameOfBlock = (one: (typeof mapped)[number]): string => openNameOf(one)
  if (mapped.length >= 2) {
    // Two policies, two blocks, in the baseline's order, each named by its own body.
    return labelledBlocks({ lines: annotated(mapped[0]), name: nameOfBlock(mapped[0]) }, { lines: annotated(mapped[1]), name: nameOfBlock(mapped[1]) }, { a: 'A', b: 'B' })
  }
  const lines = annotated(mapped[0])
  return lines.length > 0 ? lines : null
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
