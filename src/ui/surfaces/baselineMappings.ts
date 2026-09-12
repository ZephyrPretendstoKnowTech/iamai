// Plan settings → Baseline mappings, as rows (S4, playbook §18.1): one per
// reference of the baseline's that only a person can answer, read across the
// plan's open policies (roadmap/sourceMappings.ts), in the words the answer is
// asked with. Each row states the reference, the policies that name it, the part
// it plays (include / exclude / both) and where its answer stands. No row is a
// "Group N": a reference is named by its kind and its own short identifier.
//
// Pure: no DOM.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { SourceReference, Step } from '../../roadmap/types.ts'
import { sourceMappingsOf } from '../../roadmap/sourceMappings.ts'
import { answerTextFor, referenceOptions } from '../../roadmap/answers.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

export type MappingWords = {
  h4: string
  intro: string
  empty: string
  groupLabel: string
  locationLabel: string
  status: Record<SourceReference['answer'], string>
  role: Record<NonNullable<SourceReference['role']>, string>
  usedBy: string
  roleExclude: string
  roleInclude: string
  roleBoth: string
  omitExclude: string
  omitInclude: string
  omitBoth: string
  answered: string
  unanswered: string
  clear: string
  sourceId: string
  options: string[]
  save: string
}

/** The words, from content.json pages.plan.settings.mappings and nowhere else. */
export const MAPPING_WORDS = (pages.plan as { settings: { mappings: MappingWords } }).settings.mappings

/** One Baseline mapping row, in the words its answer is asked with. */
export type SourceMappingRow = {
  id: string
  kind: SourceReference['kind']
  answer: SourceReference['answer']
  /** `Group 62d67e66` / `Named location 1267ac22`: the kind and the reference's own short id (§18.1), never a running number. */
  label: string
  /** Unmapped / Mapped / Left out. */
  status: string
  /** The titles of the plan's policies that name it. */
  policies: string[]
  role: NonNullable<SourceReference['role']> | null
  /** The part it plays, as a word: include / exclude / both. */
  roleWord: string | null
  /** The part it plays in the baseline, and how widely. */
  roleLine: string | null
  /** What leaving it out does, for the part it plays. */
  omitLine: string | null
  /** The answer saved for it, in the option's own words, or that it has none. */
  answerLine: string
}

/** The reference's short id, the way the playbook names it (§18.1). */
export const shortId = (id: string): string => id.slice(0, 8)

export function mappingRowOf(r: SourceReference, ctx: { snapshot: TenantSnapshot; mapping: MappingState; nameOf: (id: string) => string }): SourceMappingRow {
  const w = MAPPING_WORDS
  const options = referenceOptions()
  const role = r.role ?? null
  const suffix = role === 'include' ? 'Include' : role === 'both' ? 'Both' : 'Exclude'
  const mapped = ctx.mapping.records?.[r.id.toLowerCase()]?.resolvedId ?? null
  const answer = r.answer === 'omitted' ? (options[0] ?? null) : r.answer === 'mapped' && mapped ? answerTextFor(options[1] ?? '', [ctx.nameOf(mapped)]) : null
  return {
    id: r.id,
    kind: r.kind,
    answer: r.answer,
    label: fillText(r.kind === 'group' ? w.groupLabel : w.locationLabel, { id: shortId(r.id) }),
    status: w.status[r.answer],
    policies: (r.stepIds ?? []).map((id) => contentStepFor({ id, goalId: id.replace(/^s-goal-/, '') })?.title ?? id),
    role,
    roleWord: role !== null ? w.role[role] : null,
    roleLine: role !== null && r.baselinePolicies !== undefined && r.baselineTotal !== undefined ? fillText(w[`role${suffix}`], { n: r.baselinePolicies, total: r.baselineTotal }) : null,
    omitLine: role !== null ? w[`omit${suffix}`] : null,
    answerLine: answer !== null ? fillText(w.answered, { answer }) : w.unanswered,
  }
}

/** Every reference the plan's open policies name, one row each, the most-named first (sourceMappingsOf). */
export function mappingRowsOf(steps: readonly Step[], ctx: { snapshot: TenantSnapshot; mapping: MappingState; nameOf: (id: string) => string }): SourceMappingRow[] {
  return sourceMappingsOf(steps).map((r) => mappingRowOf(r, ctx))
}
