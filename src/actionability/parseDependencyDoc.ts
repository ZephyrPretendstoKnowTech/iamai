// Parses the dependency playbook (docs/product/actionability/IAMAI-Actionability-
// Dependency-Playbook.md) into the data the lane engine reads. The document is the
// only source of truth: scripts/build-dependency-data.mjs writes dependency-data.json
// from it and dependencyData.test.ts fails when the two diverge.
//
// Read: §8 (condition names and owners), §10.0 (step index), every edge table under
// a §10.N heading, and the §11 group headings only to expand the one placeholder row
// `<every CA policy step in §11 E–H>:enforce` mechanically. Nothing is hand-listed.

export type Action = 'create' | 'correct' | 'observe' | 'enforce' | 'start' | 'complete' | 'decide'
export type Milestone =
  | 'created' | 'complete' | 'ready-to-enforce' | 'enforced' | 'resolved'
  | 'minimum-satisfied' | 'hardening-complete'
export type PrerequisiteKind =
  | 'step' | 'fact' | 'decision' | 'evidence' | 'license/platform' | 'time/evidence-window'
  | 'sourceConflict' | 'baselineSafetyConflict' | 'sourceMapping' | 'suspendedPrerequisite'

export type StepIndexEntry = {
  id: string
  title: string
  workType: string
  scopeClass: string
  effortKind: string
  iamaiOrder: number | null
}

export type Edge = {
  step: string
  action: Action
  prerequisite: string
  prerequisiteKind: PrerequisiteKind
  milestone: Milestone
  condition: string | null
  edgeKind: 'hard' | 'conditional'
  source: string
  status: string
  table: string
  expandedFrom?: string
}

export type Condition = { name: string; ownedBy: string; meaning: string }

export type DependencyData = {
  source: string
  steps: StepIndexEntry[]
  edges: Edge[]
  conditions: Condition[]
}

export const PLAYBOOK_PATH = 'docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md'

const ACTIONS: readonly Action[] = ['create', 'correct', 'observe', 'enforce', 'start', 'complete', 'decide']
const MILESTONES: readonly Milestone[] = [
  'created', 'complete', 'ready-to-enforce', 'enforced', 'resolved', 'minimum-satisfied', 'hardening-complete',
]
const KINDS: readonly PrerequisiteKind[] = [
  'step', 'fact', 'decision', 'evidence', 'license/platform', 'time/evidence-window',
  'sourceConflict', 'baselineSafetyConflict', 'sourceMapping', 'suspendedPrerequisite',
]

function fail(message: string): never { throw new Error(`parseDependencyDoc: ${message}`) }

function cell(raw: string): string {
  return raw.trim().replace(/^`|`$/g, '').replace(/\*\*/g, '').trim()
}

function rows(lines: string[]): string[][] {
  const out: string[][] = []
  for (const line of lines) {
    if (!line.startsWith('|')) continue
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|')
    if (cells.every((c) => /^\s*-*\s*$/.test(c))) continue
    out.push(cells)
  }
  return out
}

/** Lines of the section whose heading matches, up to the next heading of the same or a higher level. */
function section(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((l) => heading.test(l))
  if (start < 0) fail(`heading not found: ${heading}`)
  const level = /^#+/.exec(lines[start]!)![0].length
  const body: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+)\s/.exec(lines[i]!)
    if (m && m[1]!.length <= level) break
    body.push(lines[i]!)
  }
  return body
}

function subsections(lines: string[], level: number): { heading: string; body: string[] }[] {
  const marks = '#'.repeat(level)
  const out: { heading: string; body: string[] }[] = []
  for (const line of lines) {
    if (line.startsWith(`${marks} `)) out.push({ heading: line.slice(level + 1).trim(), body: [] })
    else if (out.length) out[out.length - 1]!.body.push(line)
  }
  return out
}

function oneOf<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if (!(allowed as readonly string[]).includes(value)) fail(`${what}: unexpected value "${value}"`)
  return value as T
}

function parseConditions(lines: string[]): Condition[] {
  const body = section(lines, /^## 8\. Conditional dependency rules/)
  const table = rows(body.slice(0, body.findIndex((l) => l.startsWith('### '))))
  const [header, ...data] = table
  if (!header || cell(header[0]!) !== 'condition' || cell(header[1]!) !== 'owned by') fail('§8 condition table header')
  return data.map((r) => ({ name: cell(r[0]!), ownedBy: cell(r[1]!), meaning: cell(r[2]!) }))
}

function parseStepIndex(lines: string[]): StepIndexEntry[] {
  const body = section(lines, /^### 10\.0 Step index/)
  const [header, ...data] = rows(body)
  const expected = ['step_id', 'title', 'work_type', 'scope_class', 'effort_kind', 'iamai_order']
  if (!header || header.map(cell).join(',') !== expected.join(',')) fail('§10.0 header changed')
  return data.map((r) => {
    if (r.length !== expected.length) fail(`§10.0 row has ${r.length} cells: ${r[0]}`)
    const order = cell(r[5]!)
    return {
      id: cell(r[0]!),
      title: cell(r[1]!),
      workType: cell(r[2]!),
      scopeClass: cell(r[3]!),
      effortKind: cell(r[4]!),
      iamaiOrder: order === '' ? null : Number(order),
    }
  })
}

/** §11 group letter → step ids under it, read from the `### X.` and `#### \`id\`` headings. */
function parseGroups(lines: string[]): Map<string, string[]> {
  const body = section(lines, /^## 11\. Per-control dependency details/)
  const groups = new Map<string, string[]>()
  for (const sub of subsections(body, 3)) {
    const m = /^([A-Z])\.\s/.exec(sub.heading)
    if (!m) continue
    const ids: string[] = []
    for (const line of sub.body) {
      const h = /^#### `([^`]+)`/.exec(line)
      if (h) ids.push(h[1]!)
    }
    groups.set(m[1]!, ids)
  }
  return groups
}

const PLACEHOLDER = /^<every CA policy step in §11 ([A-Z])–([A-Z])>:([a-z]+)$/

function expandGated(raw: string, groups: Map<string, string[]>): { step: string; action: Action; expandedFrom?: string }[] {
  const m = PLACEHOLDER.exec(raw)
  if (m) {
    const [from, to] = [m[1]!.charCodeAt(0), m[2]!.charCodeAt(0)]
    const action = oneOf(m[3]!, ACTIONS, 'placeholder action')
    const steps: string[] = []
    for (let c = from; c <= to; c++) {
      const ids = groups.get(String.fromCharCode(c))
      if (!ids) fail(`§11 group ${String.fromCharCode(c)} not found`)
      steps.push(...ids)
    }
    return steps.map((step) => ({ step, action, expandedFrom: raw.slice(0, raw.lastIndexOf(':')) }))
  }
  const at = raw.lastIndexOf(':')
  if (at < 0) fail(`gated_action without action: ${raw}`)
  return [{ step: raw.slice(0, at), action: oneOf(raw.slice(at + 1), ACTIONS, `action of ${raw}`) }]
}

function parseEdges(lines: string[], groups: Map<string, string[]>): Edge[] {
  const body = section(lines, /^## 10\. Canonical dependency edge table/)
  const expected = ['gated_action', 'prerequisite', 'prerequisite_kind', 'milestone', 'condition', 'edge_kind', 'source', 'status']
  const edges: Edge[] = []
  for (const sub of subsections(body, 3)) {
    const label = /^(10\.\d+)/.exec(sub.heading)?.[1]
    if (!label) fail(`§10 subsection without a number: ${sub.heading}`)
    const table = rows(sub.body)
    if (!table.length) continue
    const [header, ...data] = table
    if (header!.map(cell).join(',') !== expected.join(',')) continue
    for (const r of data) {
      if (r.length !== expected.length) fail(`§${label} row has ${r.length} cells: ${r[0]}`)
      const condition = cell(r[4]!)
      const edgeKind = oneOf(cell(r[5]!), ['hard', 'conditional'] as const, `edge_kind of ${r[0]}`)
      if ((condition === '—') !== (edgeKind === 'hard')) fail(`§${label} ${cell(r[0]!)}: condition and edge_kind disagree`)
      for (const gated of expandGated(cell(r[0]!), groups)) {
        edges.push({
          ...gated,
          prerequisite: cell(r[1]!),
          prerequisiteKind: oneOf(cell(r[2]!), KINDS, `prerequisite_kind of ${r[0]}`),
          milestone: oneOf(cell(r[3]!), MILESTONES, `milestone of ${r[0]}`),
          condition: condition === '—' ? null : condition,
          edgeKind,
          source: cell(r[6]!),
          status: cell(r[7]!),
          table: label,
        })
      }
    }
  }
  return edges
}

export function parseDependencyDoc(markdown: string): DependencyData {
  const lines = markdown.split(/\r?\n/)
  const conditions = parseConditions(lines)
  const steps = parseStepIndex(lines)
  const edges = parseEdges(lines, parseGroups(lines))
  const ids = new Set(steps.map((s) => s.id))
  const names = new Set(conditions.map((c) => c.name))
  for (const e of edges) {
    if (!ids.has(e.step)) fail(`edge gates unknown step ${e.step}`)
    if (e.prerequisiteKind === 'step' && !ids.has(e.prerequisite)) fail(`edge names unknown prerequisite ${e.prerequisite}`)
    if (e.prerequisiteKind !== 'step' && !e.prerequisite.startsWith(`${e.prerequisiteKind}:`)) fail(`non-step prerequisite id must carry its kind: ${e.prerequisite}`)
    if (e.condition && !names.has(e.condition)) fail(`edge uses unlisted condition ${e.condition}`)
  }
  for (const c of conditions) if (!ids.has(c.ownedBy)) fail(`condition ${c.name} owned by unknown step ${c.ownedBy}`)
  return { source: PLAYBOOK_PATH, steps, edges, conditions }
}
