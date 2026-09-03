// The walk's invariants over the content file itself (docs/design/step-audit.md).
//
//   node scripts/walkContent.mjs [path/to/content.json] [--links]
//
// The walk (walk.mjs) calls contentFindings over docs/design/content.json on
// every run; this CLI runs the same checks over any content file, so an
// invariant can be shown failing on the content before a fix and passing after
// it. Each audit item's acceptance is one entry in ACCEPTANCE: the step (or
// cleanup row), the key, what its text must say and must no longer say. The
// structural checks cover every step at once.
//
// Pure: no DOM; the network only behind --links.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Every string under a node, with its path; `example` blocks and comments are skipped. */
export function strings(node, path = '', out = []) {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (k !== 'example' && k !== '$comment') strings(v, path ? `${path}.${k}` : k, out)
  return out
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
const textAt = (obj, path) => strings(get(obj, path)).map(([, s]) => s).join('\n')
const test = (re, text) => (re instanceof RegExp ? re.test(text) : text.includes(re))

// One entry per audit item. `path` is a key inside the step (dotted); the check
// reads every string under it. `must` is the acceptance; `mustNot` the wording
// it replaced, so the entry fails on the content before the fix.
export const ACCEPTANCE = []

/** Every Learn URL the content carries (steps and cleanup rows), for the link check. */
export function contentLearnUrls(content) {
  const urls = new Set()
  for (const s of content.steps ?? []) if (s.learn?.url) urls.add(s.learn.url)
  for (const c of Object.values(content.cleanup ?? {})) if (c.learn?.url) urls.add(c.learn.url)
  return [...urls]
}

/**
 * The findings over one content file: [{ level, text }]. `pinned` is the pinned
 * baseline (its goalMap and policies) for the transcription checks.
 */
export function contentFindings(content, pinned = null) {
  const out = []
  const add = (level, text) => out.push({ level, text })
  const steps = content.steps ?? []
  const cleanup = content.cleanup ?? {}
  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]))
  void pinned

  // C1: frameworks return as a feature, not a chip; no step carries a CIS value.
  for (const s of steps) if (s.learn && 'cis' in s.learn) add('P0', `content ${s.id}: learn.cis is still present (C1: no CIS chip)`)

  // The per-item acceptance table.
  for (const a of ACCEPTANCE) {
    const subject = a.step ? stepById[a.step] : cleanup[a.cleanup]
    const label = a.step ? a.step : `cleanup.${a.cleanup}`
    if (!subject) {
      add('P0', `content ${label}: missing (${a.item})`)
      continue
    }
    const text = textAt(subject, a.path)
    if (a.must !== undefined && !test(a.must, text)) add('P0', `content ${label} ${a.path}: does not say ${String(a.must).slice(0, 80)} (${a.item})`)
    if (a.mustNot !== undefined && test(a.mustNot, text)) add('P0', `content ${label} ${a.path}: still says ${String(a.mustNot).slice(0, 80)} (${a.item})`)
  }
  return out
}

/** HEAD then GET; { status } or { error }. */
export async function probe(href) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 12000)
  try {
    let r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (!r.ok) r = await fetch(href, { method: 'GET', redirect: 'follow', signal: ctl.signal })
    return { status: r.status }
  } catch (e) {
    return { error: String(e.message ?? e).slice(0, 60) }
  } finally {
    clearTimeout(t)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const links = args.includes('--links')
  const file = args.find((a) => !a.startsWith('--')) ?? 'docs/design/content.json'
  const content = JSON.parse(readFileSync(file, 'utf8'))
  const pinned = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8'))
  const findings = contentFindings(content, pinned)
  if (links) {
    for (const href of contentLearnUrls(content)) {
      const r = await probe(href)
      if (r.error) findings.push({ level: 'P2', text: `Learn link ${href} could not be checked from here (${r.error})` })
      else if (r.status === 404) findings.push({ level: 'P0', text: `Learn link ${href} answers 404` })
      else if (r.status >= 400) findings.push({ level: 'P1', text: `Learn link ${href} answers ${r.status}` })
    }
  }
  for (const f of findings) console.log(`${f.level} ${f.text}`)
  const p0 = findings.filter((f) => f.level === 'P0').length
  console.log(`${file}: ${p0} P0, ${findings.length - p0} other`)
  process.exit(p0 > 0 ? 1 : 0)
}
