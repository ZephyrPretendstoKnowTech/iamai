// Reading the naming convention a tenant already uses
// (naming-and-consolidation.md §2, prompt 43 Part 2).
//
// The tool already inferred a prefix. This reads the rest of the shape —
// separator, how many segments, and the casing of each — so a proposed name
// looks like it belongs in the list it is going to sit in, rather than like the
// tool's own house style dropped into someone else's tenant.
//
// Below AGREEMENT_FLOOR the answer is "no convention", not a guess. A tenant
// with four policies named four different ways has no convention, and saying it
// has one is worse than proposing the documented pattern and labelling it.
//
// Pure: no DOM, no network.

/** Below this share of names agreeing, there is no convention to follow. */
export const AGREEMENT_FLOOR = 0.6

/** Separators are tried longest first, so " - " wins over "-". */
const SEPARATORS = [' - ', ' | ', ' :: ', ' / ', ' – ', ': ', '_', '-'] as const

export type Casing = 'upper' | 'lower' | 'title' | 'sentence' | 'mixed'

export type Convention = {
  separator: string
  /** How many segments a name usually has. */
  segments: number
  /** Casing of the first segment, which is the prefix, and of the rest. */
  prefixCasing: Casing
  bodyCasing: Casing
  /** The literal first segment where every name shares one, else null. */
  prefix: string | null
  /**
   * True where the first segment is a serial like CA001 rather than a word.
   * A proposal then continues the series instead of repeating the last number.
   */
  numbered: boolean
  /** Share of the sampled names that fit, 0 to 1. */
  agreement: number
  /** How many names were read. */
  sampled: number
}

export function casingOf(s: string): Casing {
  const letters = s.replace(/[^A-Za-z]/g, '')
  if (letters.length === 0) return 'mixed'
  if (letters === letters.toUpperCase()) return 'upper'
  if (letters === letters.toLowerCase()) return 'lower'
  const words = s.trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w))
  if (words.length === 0) return 'mixed'
  const capitalised = words.filter((w) => /^[A-Z]/.test(w)).length
  if (capitalised === words.length) return 'title'
  if (capitalised === 1 && /^[A-Z]/.test(words[0])) return 'sentence'
  return 'mixed'
}

function dominant<T>(values: T[]): { value: T; share: number } | null {
  if (values.length === 0) return null
  const tally = new Map<T, number>()
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1)
  const [value, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  return { value, share: n / values.length }
}

/**
 * Read the convention from the tenant's own policy names.
 *
 * Returns null where there is nothing to read or nothing agrees; the caller then
 * proposes the documented pattern and says it is a proposal.
 */
export function detectConvention(names: string[]): Convention | null {
  const usable = names.map((n) => n.trim()).filter((n) => n.length > 0)
  if (usable.length === 0) return null

  // The separator that splits the most names into more than one segment.
  let separator = ''
  let bestShare = 0
  for (const sep of SEPARATORS) {
    const share = usable.filter((n) => n.includes(sep)).length / usable.length
    if (share > bestShare) {
      bestShare = share
      separator = sep
    }
  }
  if (separator === '' || bestShare < AGREEMENT_FLOOR) {
    return { separator: ' - ', segments: 0, prefixCasing: 'mixed', bodyCasing: 'mixed', prefix: null, numbered: false, agreement: bestShare, sampled: usable.length }
  }

  const split = usable.filter((n) => n.includes(separator)).map((n) => n.split(separator).map((p) => p.trim()))
  const segmentCount = dominant(split.map((p) => p.length))
  const firsts = split.map((p) => p[0])
  const bodies = split.map((p) => p.slice(1).join(separator)).filter((b) => b.length > 0)

  const prefixLiteral = dominant(firsts)
  // A serial prefix is the same letters with a different number each time:
  // CA001, CA002. The literal differs every time, so dominance would miss it.
  const serialStems = firsts.map((f) => f.replace(/\d+\s*$/, '').trim()).filter((f) => f.length > 0)
  const serialStem = dominant(serialStems)
  const numbered = firsts.filter((f) => /\d\s*$/.test(f)).length / firsts.length >= AGREEMENT_FLOOR && serialStem !== null && serialStem.share >= AGREEMENT_FLOOR

  const prefixCasing = dominant(firsts.map(casingOf))
  const bodyCasing = dominant(bodies.map(casingOf))

  // Agreement is the weakest link: a tenant that agrees on the separator but not
  // on anything else has not got a convention worth copying.
  const agreement = Math.min(
    bestShare,
    segmentCount?.share ?? 0,
    numbered ? (serialStem?.share ?? 0) : Math.max(prefixLiteral?.share ?? 0, serialStem?.share ?? 0),
  )

  return {
    separator,
    segments: segmentCount?.value ?? 0,
    prefixCasing: prefixCasing?.value ?? 'mixed',
    bodyCasing: bodyCasing?.value ?? 'mixed',
    prefix: numbered ? (serialStem?.value ?? null) : prefixLiteral && prefixLiteral.share >= AGREEMENT_FLOOR ? prefixLiteral.value : null,
    numbered,
    agreement,
    sampled: usable.length,
  }
}

/** True where the convention is strong enough to express proposals in. */
export function usable(c: Convention | null): c is Convention {
  return c !== null && c.agreement >= AGREEMENT_FLOOR && c.segments >= 2
}

export function applyCasing(s: string, casing: Casing): string {
  switch (casing) {
    case 'upper':
      return s.toUpperCase()
    case 'lower':
      return s.toLowerCase()
    case 'title':
      // Word starts only. Capitalising after a hyphen turns "Phishing-resistant"
      // into "Phishing-Resistant", which is not what the tenant writes.
      return s.replace(/(^|\s)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
    case 'sentence':
      // The first letter, and nothing else. Lowercasing the remainder destroys
      // the acronyms these names are mostly made of: MFA, BYOD, SSPR.
      return s.charAt(0).toUpperCase() + s.slice(1)
    default:
      return s
  }
}

/**
 * The next serial in the tenant's series: CA001, CA002 → CA003.
 *
 * Padded to the width the tenant already uses, so CA003 does not become CA3.
 */
export function nextSerial(stem: string, existing: string[], separator: string): string {
  let highest = 0
  let width = 1
  for (const name of existing) {
    const first = name.split(separator)[0]?.trim() ?? ''
    const m = first.match(/^(.*?)(\d+)\s*$/)
    if (!m || m[1].trim() !== stem) continue
    highest = Math.max(highest, Number(m[2]))
    width = Math.max(width, m[2].length)
  }
  return `${stem}${String(highest + 1).padStart(width, '0')}`
}

/**
 * A name in the tenant's own convention, or the documented pattern where there
 * is none.
 *
 * `parts` is the documented shape: scope, action, target for a policy. A tenant
 * whose names carry fewer segments than that gets the parts joined into the
 * segments it does use, rather than a name in a shape it has never seen.
 */
export function proposeName(
  c: Convention | null,
  existing: string[],
  parts: { prefix: string; rest: string[]; collapsed?: string },
): { name: string; matchesTenant: boolean } {
  if (!usable(c)) {
    return { name: [parts.prefix, ...parts.rest].join(' - '), matchesTenant: false }
  }
  const prefix = c.numbered && c.prefix ? nextSerial(c.prefix, existing, c.separator) : (c.prefix ?? parts.prefix)
  // Fit the documented parts into however many segments this tenant uses. A
  // two-segment tenant gets one descriptive segment, not three empty ones.
  //
  // Jamming three segments into one produces "Global Require Phishing-resistant
  // MFA", which is not a name anybody would write, so a caller can supply the
  // phrase it would have written instead.
  const bodySegments = Math.max(1, c.segments - 1)
  const rest =
    bodySegments === 1 && parts.collapsed
      ? [parts.collapsed]
      : parts.rest.length <= bodySegments
        ? parts.rest
        : [...parts.rest.slice(0, bodySegments - 1), parts.rest.slice(bodySegments - 1).join(' ')]
  const cased = rest.map((r) => applyCasing(r, c.bodyCasing))
  return { name: [applyCasing(prefix, c.prefixCasing), ...cased].join(c.separator), matchesTenant: true }
}
