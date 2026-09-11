// The machine conditions an implementation-content package may attach to its
// structured fields: a readiness rule's `if`, a prerequisite's `evidence`, a
// correction module's `select`. The prose beside them (`when`, `appliesWhen`)
// stays the author's words and is never read as logic; these are what the
// runtime evaluates.
//
// The grammar is small and closed on purpose. Every operator is deterministic
// over three inputs IAMAI owns — the package state, the bindings it holds, and
// the prerequisites a person or a tenant fact has satisfied — plus the pinned
// baseline the build carries. An operator the validator does not know is a
// package error, not something to guess at (src/content/implementation/README.md
// "Machine conditions").
//
// Pure: no DOM, no network, no clock.

export type Bindings = Readonly<Record<string, unknown>>

export type Condition =
  | { state: string[] }
  | { present: string }
  | { absent: string }
  | { equals: [string, unknown] }
  | { in: [string, unknown[]] }
  | { confirmed: string }
  | { baselineCommit: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

export type ConditionContext = {
  state: string
  bindings: Bindings
  /** Prerequisite ids satisfied now: by a tenant fact the package names, or by a person's valid confirmation. */
  satisfied: ReadonlySet<string>
  /** The pinned baseline commit this build carries. */
  baselineCommit: string | null
}

/** A binding IAMAI actually has: not absent, not blank, not an empty list. */
export function present(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (Array.isArray(v)) return v.length > 0
  return true
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Whether a condition holds. A shape the grammar does not have never holds (the validator refuses it first). */
export function holds(c: Condition, ctx: ConditionContext): boolean {
  const o = c as Record<string, unknown>
  if (Array.isArray(o.state)) return (o.state as string[]).includes(ctx.state)
  if (typeof o.present === 'string') return present(ctx.bindings[o.present])
  if (typeof o.absent === 'string') return !present(ctx.bindings[o.absent])
  if (Array.isArray(o.equals)) {
    const [key, value] = o.equals as [string, unknown]
    return present(ctx.bindings[key]) && same(ctx.bindings[key], value)
  }
  if (Array.isArray(o.in)) {
    const [key, values] = o.in as [string, unknown[]]
    return present(ctx.bindings[key]) && Array.isArray(values) && values.some((v) => same(ctx.bindings[key], v))
  }
  if (typeof o.confirmed === 'string') return ctx.satisfied.has(o.confirmed)
  if (typeof o.baselineCommit === 'string') return ctx.baselineCommit !== null && ctx.baselineCommit === o.baselineCommit
  if (Array.isArray(o.all)) return (o.all as Condition[]).every((x) => holds(x, ctx))
  if (Array.isArray(o.any)) return (o.any as Condition[]).some((x) => holds(x, ctx))
  if (o.not && typeof o.not === 'object') return !holds(o.not as Condition, ctx)
  return false
}

export type ConditionVocabulary = { bindings: ReadonlySet<string>; prerequisites: ReadonlySet<string>; states: ReadonlySet<string> }

const OPERATORS = ['state', 'present', 'absent', 'equals', 'in', 'confirmed', 'baselineCommit', 'all', 'any', 'not']

/** Everything wrong with a condition, as sentences naming where it sits; empty when it is sound. */
export function conditionErrors(c: unknown, vocab: ConditionVocabulary, at: string): string[] {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${at}: a condition is an object with one operator`]
  const keys = Object.keys(c)
  if (keys.length !== 1 || !OPERATORS.includes(keys[0])) return [`${at}: unknown condition ${JSON.stringify(keys)} (operators: ${OPERATORS.join(', ')})`]
  const op = keys[0]
  const v = (c as Record<string, unknown>)[op]
  const binding = (name: unknown): string[] => (typeof name === 'string' && vocab.bindings.has(name) ? [] : [`${at}.${op}: ${JSON.stringify(name)} is not a declared binding`])
  switch (op) {
    case 'state':
      return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && vocab.states.has(s)) ? [] : [`${at}.state: every entry must be a projected state`]
    case 'present':
    case 'absent':
      return binding(v)
    case 'equals':
      return Array.isArray(v) && v.length === 2 ? binding(v[0]) : [`${at}.equals: [binding, value]`]
    case 'in':
      return Array.isArray(v) && v.length === 2 && Array.isArray(v[1]) ? binding(v[0]) : [`${at}.in: [binding, [values]]`]
    case 'confirmed':
      return typeof v === 'string' && vocab.prerequisites.has(v) ? [] : [`${at}.confirmed: ${JSON.stringify(v)} is not a declared prerequisite`]
    case 'baselineCommit':
      return typeof v === 'string' && /^[0-9a-f]{40}$/.test(v) ? [] : [`${at}.baselineCommit: a full 40-character commit`]
    case 'all':
    case 'any':
      return Array.isArray(v) && v.length > 0 ? v.flatMap((x, i) => conditionErrors(x, vocab, `${at}.${op}[${i}]`)) : [`${at}.${op}: a non-empty list`]
    case 'not':
      return conditionErrors(v, vocab, `${at}.not`)
  }
  return []
}
