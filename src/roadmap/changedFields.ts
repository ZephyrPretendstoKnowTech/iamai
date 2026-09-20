// The policy fields an update actually changes on the tenant's policy, named as
// Graph names them: the engine's semantic truth about a correction, in a
// vocabulary nothing downstream has to translate from words.
//
// Foundation A builds an update as the difference between what the tenant has
// and what the plan asks for (roadmap/generate.ts changesFor), so the patch body
// already carries only the sections that change. Within a section it carries the
// whole object, though, and a section is not a fact: "users" does not say
// whether it is the included population or the exclusions that differ. So this
// reads the patch leaf by leaf against the tenant's own policy and keeps only
// the leaves whose values differ — `conditions.users.excludeGroups`,
// `grantControls.authenticationStrength.id`.
//
// Only material fields count, the same ones a policy's semantics are
// fingerprinted on (roadmap/observation.ts semanticFieldsOf): conditions, grant
// and session controls. `state` is the lifecycle, the other axis, and a display
// name is not a meaning. An implementation-content package selects its
// correction modules from these (content/implementation/project.ts); it never
// reads a reason sentence, a heading or a policy name to decide.
//
// Pure: no DOM, no network.

const MATERIAL_ROOTS = ['conditions', 'grantControls', 'sessionControls'] as const

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isAnnotation = (key: string): boolean => key.startsWith('@') || key.includes('@odata')

/** A value in the form two readings of one policy are compared in: empty is empty, and a list of ids has no order. */
function canonical(v: unknown): unknown {
  if (v === undefined || v === null) return null
  if (Array.isArray(v)) {
    if (v.length === 0) return null
    const items = v.map(canonical)
    return items.every((x) => typeof x === 'string' || typeof x === 'number') ? [...items].sort() : items
  }
  if (isObject(v)) {
    const keys = Object.keys(v).filter((k) => !isAnnotation(k)).sort()
    const out: Record<string, unknown> = {}
    for (const k of keys) {
      const c = canonical(v[k])
      if (c !== null) out[k] = c
    }
    return Object.keys(out).length === 0 ? null : out
  }
  return v
}

function leaves(value: unknown, path: string, out: Map<string, unknown>): void {
  if (isObject(value)) {
    const keys = Object.keys(value).filter((k) => !isAnnotation(k))
    // An object the patch writes as empty (or null) clears the field: that is a leaf.
    if (keys.length === 0) out.set(path, value)
    for (const k of keys) leaves(value[k], `${path}.${k}`, out)
    return
  }
  out.set(path, value)
}

function at(policy: Record<string, unknown> | null, path: string): unknown {
  let cur: unknown = policy
  for (const part of path.split('.')) {
    if (!isObject(cur)) return undefined
    cur = cur[part]
  }
  return cur
}

/**
 * The material leaves a patch sets to something other than what the tenant's
 * policy holds, sorted. `current` null (a policy this scan did not read) makes
 * every leaf the patch submits a change, which is the conservative reading.
 */
export function changedFieldsOf(patch: Record<string, unknown>, current: Record<string, unknown> | null): string[] {
  const out = new Set<string>()
  for (const root of MATERIAL_ROOTS) {
    if (!(root in patch)) continue
    const submitted = new Map<string, unknown>()
    leaves(patch[root], root, submitted)
    for (const [path, value] of submitted) {
      if (JSON.stringify(canonical(value)) !== JSON.stringify(canonical(at(current, path)))) out.add(path)
    }
  }
  return [...out].sort()
}

/**
 * True when every material field the patch changes is a list of what the policy
 * excludes, and each list keeps everything the tenant's list holds: the change
 * only adds exclusions. Nobody the policy does not reach today is reached by it
 * afterwards, and nobody is asked for anything new. A patch that changes nothing
 * material is not one (there is no correction to speak of), and neither is one
 * whose `current` this scan did not read.
 *
 * Read by the readiness gate, which has nothing to hold on such a change to a
 * policy already on (roadmap/operations.ts enforcementHeld; owner, 2026-09-19).
 */
export function addsExclusionsOnly(patch: Record<string, unknown>, current: Record<string, unknown> | null): boolean {
  if (current === null) return false
  const ids = (v: unknown): string[] | null => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : null)
  const exclusion = (path: string): boolean => (path.split('.').at(-1) ?? '').startsWith('exclude')
  const keeps = (path: string): boolean => {
    const was = ids(at(current, path))
    const next = ids(at(patch, path))
    return was !== null && next !== null && was.every((id) => next.includes(id))
  }
  const fields = changedFieldsOf(patch, current)
  if (fields.length === 0 || !fields.every((path) => exclusion(path) && keeps(path))) return false
  // A section the patch writes replaces the tenant's whole section, so an
  // exclusion the tenant has there and the patch leaves out is taken away.
  for (const root of MATERIAL_ROOTS) {
    if (!(root in patch)) continue
    const held = new Map<string, unknown>()
    leaves(current[root], root, held)
    for (const path of held.keys()) {
      const section = path.split('.').slice(0, -1).join('.')
      if (exclusion(path) && isObject(at(patch, section)) && !keeps(path)) return false
    }
  }
  return true
}
