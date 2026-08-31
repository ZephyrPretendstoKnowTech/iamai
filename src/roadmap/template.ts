// A goal's policy template, resolved into a Graph conditionalAccessPolicy body
// (prompt 46 Part 3, target-state §6). Every implementation in data/goals.json
// carries a `template`: the goal floor written as a policy, with the tenant's
// own objects left as placeholders. This is the body the Do-it renderer gets
// when no baseline policy matches the goal, so every step is executable.
//
// Pure: no DOM, no network, no snapshot. The caller decides what each
// placeholder is worth in this tenant; this only substitutes.
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'

export type TemplateBody = Record<string, unknown>

/** The only placeholders a template may use; anything else is a bug in goals.json. */
export const TEMPLATE_PLACEHOLDERS = [
  '{namePrefix}',
  '{exclusionsGroup}',
  '{breakGlass}',
  '{trustedLocations}',
  '{allowedCountriesLocation}',
  '{serviceAccountsGroup}',
  '{coreAdminRoles}',
] as const
export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number]

/**
 * What a placeholder is worth here. A string is one value; an array is spliced
 * into the array the placeholder sits in (an empty array removes it, for an
 * exclusion this tenant has no use for); null or absent leaves the placeholder
 * in place and reports it as unresolved.
 */
export type TemplateValues = Partial<Record<TemplatePlaceholder, string | string[] | null>>

const PLACEHOLDER_SET: ReadonlySet<string> = new Set(TEMPLATE_PLACEHOLDERS)

const isPlaceholder = (s: string): s is TemplatePlaceholder => PLACEHOLDER_SET.has(s)

/** Every placeholder a template mentions, in first-seen order. */
export function placeholdersIn(template: unknown): TemplatePlaceholder[] {
  const out: TemplatePlaceholder[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const p of TEMPLATE_PLACEHOLDERS) if (v.includes(p) && !out.includes(p)) out.push(p)
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x)
    } else if (v !== null && typeof v === 'object') {
      for (const x of Object.values(v as TemplateBody)) walk(x)
    }
  }
  walk(template)
  return out
}

/** Strings shaped like a placeholder that are not one of the seven: a typo in goals.json. */
export function unknownPlaceholdersIn(template: unknown): string[] {
  const out = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\{[A-Za-z]+\}/g)) if (!PLACEHOLDER_SET.has(m[0])) out.add(m[0])
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x)
    } else if (v !== null && typeof v === 'object') {
      for (const x of Object.values(v as TemplateBody)) walk(x)
    }
  }
  walk(template)
  return [...out]
}

export type ResolvedTemplate = {
  body: TemplateBody
  /** Placeholders the tenant has no value for yet; left in the body as written. */
  unresolved: TemplatePlaceholder[]
  /** Placeholders removed because the tenant has nothing to put there (an empty array value). */
  removed: TemplatePlaceholder[]
}

export function resolveTemplate(template: TemplateBody, values: TemplateValues): ResolvedTemplate {
  const unresolved = new Set<TemplatePlaceholder>()
  const removed = new Set<TemplatePlaceholder>()
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const out: unknown[] = []
      for (const x of v) {
        if (typeof x === 'string' && isPlaceholder(x)) {
          const value = values[x]
          if (value === null || value === undefined) {
            unresolved.add(x)
            out.push(x)
          } else if (Array.isArray(value)) {
            if (value.length === 0) removed.add(x)
            out.push(...value)
          } else {
            out.push(value)
          }
        } else {
          out.push(walk(x))
        }
      }
      return out
    }
    if (typeof v === 'string') {
      // Inside a longer string (the display name) a placeholder is text, so only
      // a string value can stand in for it.
      let s = v
      for (const p of TEMPLATE_PLACEHOLDERS) {
        if (!s.includes(p)) continue
        const value = values[p]
        if (typeof value === 'string') s = s.split(p).join(value)
        else unresolved.add(p)
      }
      return s
    }
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as TemplateBody).map(([k, x]) => [k, walk(x)]))
    }
    return v
  }
  const body = walk(structuredClone(template)) as TemplateBody
  return { body, unresolved: [...unresolved], removed: [...removed] }
}

/**
 * Stand-in values that resolve every placeholder, for tests and for the
 * template check: GUID-shaped so the facts parser treats them as objects, and
 * obviously fake so they never pass for a tenant's.
 */
export const SAMPLE_VALUES: TemplateValues = {
  '{namePrefix}': 'CA',
  '{exclusionsGroup}': '11111111-1111-4111-8111-111111111111',
  '{breakGlass}': ['22222222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222'],
  '{trustedLocations}': ['33333333-3333-4333-8333-333333333333'],
  '{allowedCountriesLocation}': '44444444-4444-4444-8444-444444444444',
  '{serviceAccountsGroup}': '55555555-5555-4555-8555-555555555555',
  '{coreAdminRoles}': [...CORE_ADMIN_ROLE_IDS],
}
