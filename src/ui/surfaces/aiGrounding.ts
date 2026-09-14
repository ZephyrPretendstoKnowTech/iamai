// AI Info's shared grounding (consolidated batch; release review R03).
//
// AI Info is a briefing a customer hands to their own assistant, and that
// assistant cannot see the IAMAI screen. A package's AI Info says what to help
// with; this adds IAMAI's own facts for the step, from the authorities the screen
// already reads, so "the accounts IAMAI lists" or "the corrections" are written
// out rather than pointed at:
//
// - the step's context, the same labelled run the prompt pack and calendar carry
//   (roadmap/prompts.ts stepContext): why it matters, where it stands, who it
//   reaches, what to do, what holds it, the dates, Done when and the rollback;
// - what the scan observed (the contract's findings), the policies the step
//   tracks, and the tenant policies already delivering the goal;
// - on a policy step, the tenant policy a correction changes, with its state, the
//   fields that differ and the exclusions it removes, and the intended target, from
//   the package bindings IAMAI actually holds;
// - the people and accounts the step names, under the step's own words for them,
//   each with its id where the step holds the ids beside the names.
//
// Nothing is invented to fill a section: a fact IAMAI does not hold is absent,
// and a line the package's own words already carry is not repeated. Names and ids
// stay: this briefing is identifiable by design, and the redacted exports are a
// separate, explicit choice. Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import { fillText } from '../../content/render.ts'
import { stepExportView } from './stepExport.ts'
import { CONTRACT } from './stepContract.ts'
import type { LaneView, StepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { whoBlocks } from './whoBlocks.ts'

export type GroundingInput = {
  step: Step
  ctx: StepVarContext
  contract: StepContract
  lane: LaneView
  /** The step's content entry (content/stepTitle.ts contentStepFor), or {}. */
  cs: Record<string, unknown>
  /** The step's resolved content variables (stepVars.ts). */
  ex: Record<string, unknown>
  /** The package bindings IAMAI holds for the step (stepPackage.ts packageBindings), or null without a package. */
  bindings: Record<string, unknown> | null
}

/** The most names one list in a briefing carries; the rest are counted. */
export const NAMES_IN_BRIEFING = 50

const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])
const normal = (s: string): string => s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()

/** A Conditional Access state as the step's own track words it; any other value as Graph returned it. */
function stateWord(state: string): string {
  const L = CONTRACT.lifecycle as Record<string, string>
  if (state === 'enabled') return L.enforced ?? state
  if (state === 'enabledForReportingButNotEnforced') return L['report-only'] ?? state
  return state
}

/**
 * IAMAI's facts for one step, as the AI Info briefing carries them after the
 * package's own words (`own`). Empty where IAMAI holds nothing to add.
 */
export function aiGroundingText(i: GroundingInput, own = ''): string {
  const W = CONTRACT.implementation.aiFacts
  const already = normal(own)
  const b = i.bindings ?? {}
  const text = (k: string): string | null => (typeof b[k] === 'string' && (b[k] as string).trim() !== '' ? (b[k] as string) : null)
  // An object IAMAI holds by id, by the name the scan read and the id; a literal ("All") as it is.
  const named = (id: string): string => {
    const name = i.ctx.nameOf?.(id)
    return name && name !== id ? `${name} (${id})` : id
  }
  const sections: string[][] = []
  /** One section: its lines, each dropped where the package's own words already say it. */
  const section = (lines: (string | null | undefined)[]): void => {
    const kept = lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '' && !already.includes(normal(l.replace(/^- /, ''))))
    if (kept.length > 0) sections.push(kept)
  }
  const labelled = (label: string, items: readonly string[]): string[] => (items.length === 0 ? [] : items.length === 1 ? [`${label}: ${items[0]}`] : [`${label}:`, ...items.map((x) => `- ${x}`)])

  // Where the step stands, the way every artifact states it.
  section(stepContext(i.step, (s) => stepExportView(s, i.ctx, i.lane)).split('\n'))

  // What the scan observed, and the policies in play.
  const c = i.contract
  section(labelled(W.observed, c.found.map((f) => `${f.label}: ${f.text}`)))
  section(labelled(W.members, c.members.map((m) => m.line)))
  if (c.existing !== null) section(labelled(W.existing, c.existing.names))

  // A policy step's tenant policy, what a correction changes on it, and the intended
  // target. A check or a preparation step has no policy target, whatever bindings its
  // package shares with the policies.
  if (c.policy) {
    const currentName = text('policy.current.displayName')
    const currentId = text('policy.current.id')
    const currentState = text('policy.current.state')
    section([
      currentName || currentId ? `${W.current}: ${currentName && currentId ? `${currentName} (${currentId})` : (currentName ?? currentId)}` : null,
      currentState ? `${W.currentState}: ${stateWord(currentState)}` : null,
      ...labelled(W.changedFields, asList(b[CHANGED_FIELDS_BINDING])),
      ...labelled(W.removedExclusions, asList(b['policy.current.removedExclusions'])),
    ])

    const excludeGroups = Array.isArray(b['policy.target.excludeGroups']) ? asList(b['policy.target.excludeGroups']) : null
    const excludeUsers = text('policy.target.excludeUsersSummary') ?? (Array.isArray(b['policy.target.excludeUsers']) ? (asList(b['policy.target.excludeUsers']).map(named).join(', ') || W.none) : null)
    const target: (string | null)[] = [
      text('policy.target.displayName') ? `${W.targetName}: ${text('policy.target.displayName')}` : null,
      ...labelled(W.includeUsers, asList(b['policy.target.includeUsers']).map(named)),
      ...labelled(W.includeRoles, asList(b['policy.target.includeRoles']).map(named)),
      excludeGroups === null ? null : `${W.excludeGroups}: ${excludeGroups.length === 0 ? W.none : excludeGroups.map(named).join(', ')}`,
      excludeUsers === null ? null : `${W.excludeUsers}: ${excludeUsers}`,
      text('policy.target.locationWords') ? `${W.locations}: ${text('policy.target.locationWords')}` : null,
      text('policy.target.grantWords') ? `${W.grant}: ${text('policy.target.grantWords')}` : null,
      text('authStrength.target.displayName') ? `${W.strength}: ${text('authStrength.target.displayName')}` : null,
    ]
    // A multi-policy step's members, each by its role: its target name, the tenant policy it tracks, and its state.
    const roles = new Map<string, string[]>()
    for (const key of Object.keys(b)) {
      const m = /^policies\.[^.]+\.([^.]+)\.(target\.displayName|current\.displayName|current\.id|current\.state)$/.exec(key)
      if (!m || typeof b[key] !== 'string') continue
      const parts = roles.get(m[1]) ?? []
      parts.push(m[2] === 'current.state' ? `${W.currentState}: ${stateWord(b[key] as string)}` : m[2] === 'current.id' ? `id ${b[key]}` : String(b[key]))
      roles.set(m[1], parts)
    }
    for (const [role, parts] of roles) target.push(`${role}: ${parts.join('; ')}`)
    const facts = target.filter((l): l is string => l !== null)
    if (facts.length > 0) section([`${W.target}:`, ...facts.map((l) => `- ${l}`)])
  }

  // The people and accounts the step names, under the step's own words for them
  // (whoBlocks.ts), each with its id where the step holds the ids beside the names.
  const who = (i.cs.who ?? {}) as Record<string, unknown>
  const { inline, held } = whoBlocks(who, i.ex as never)
  const blocks = [...inline.map((x) => held.find((h) => h.key === x.key) ?? x), ...held.filter((h) => !inline.some((x) => x.key === h.key))]
  const tokens = [...new Set([...JSON.stringify(who).matchAll(/\{list:([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))]
  for (const block of blocks) {
    // The block's own list variable: a rung's by its key, an evidence line's by the list its names are.
    const group = block.key.startsWith('group:') ? block.key.slice('group:'.length) : null
    const token = group ?? tokens.find((t) => {
      const words = asList(i.ex[t])
      return words.length > 0 && words.length === block.names.length && words.every((w, n) => w === block.names[n])
    })
    const ids = token ? asList(i.ex[`${token}Ids`]) : []
    const lead = block.lead.replace(/:\s*$/, '').trim()
    // A briefing names a readable number of people; past that it says how many more there are, never a thousand-name list.
    const shown = block.names.slice(0, NAMES_IN_BRIEFING)
    const items = shown.map((name, n) => (ids.length === block.names.length ? `${name} (id ${ids[n]})` : name))
    if (block.names.length > shown.length) items.push(fillText(W.more, { n: block.names.length - shown.length }))
    section(labelled(lead || W.accounts, items))
  }

  if (sections.length === 0) return ''
  return [W.heading, W.boundary, ...sections.map((s) => s.join('\n'))].join('\n\n')
}
