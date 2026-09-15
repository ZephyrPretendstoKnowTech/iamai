// Plan settings → Baseline mappings (S4, playbook §18.1): the baseline's own
// references only a person can answer, each mapped to a tenant group or named
// location, or left out. One Save writes every answer under the mappings key
// (roadmap/sourceMappings.ts BASELINE_MAPPINGS_KEY); Clear takes one back. The
// plan regenerates from the answers: a policy naming an unanswered reference is
// On Hold with a `sourceMapping` blocker, and returns to its lane once mapped.
// Nothing here guesses a meaning.
import { useEffect, useId, useState } from 'react'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepDecision, StepDecisionInput } from '../../roadmap/decisions.ts'
import { BASELINE_MAPPINGS_KEY } from '../../roadmap/sourceMappings.ts'
import { answerKey } from '../../roadmap/decisions.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { Button } from '../components/index.ts'
import { pickerUniverse } from './pickerRows.ts'
import { optionsOf } from './stepQuestion.ts'
import { Options } from './ContentStep.tsx'
import { MAPPING_WORDS, mappingRowsOf } from './baselineMappings.ts'

export function BaselineMappings({ steps, snapshot, mapping, nameOf, groups, saved, onDecide, openRequest = 0 }: {
  openRequest?: number
  steps: readonly Step[]
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  groups: GroupMembers
  saved: StepDecision | null
  onDecide: (decision: StepDecisionInput) => void
}) {
  const [expanded, setExpanded] = useState(openRequest > 0)
  useEffect(() => { if (openRequest > 0) setExpanded(true) }, [openRequest])
  const w = MAPPING_WORDS
  const ex = {}
  const rows = mappingRowsOf(steps, { snapshot, mapping, nameOf })
  const options = optionsOf(w.options, ex)
  const pickerCtx = { snapshot, mapping, nameOf, groups }
  const universeOf = (kind: 'group' | 'namedLocation') => pickerUniverse(BASELINE_MAPPINGS_KEY, kind === 'group' ? 'groups' : 'locations', pickerCtx)
  const [answers, setAnswers] = useState<Record<string, string | null>>(() => ({ ...(saved?.answers ?? {}) }))
  const base = useId()
  const given = (): Record<string, string> => Object.fromEntries(Object.entries(answers).filter((e): e is [string, string] => typeof e[1] === 'string'))
  // One saved answer taken back, and only that one: the others stay, and the
  // plan regenerates with that reference's policies on hold again.
  const clear = (id: string): void => {
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)))
    onDecide({ answers: Object.fromEntries(Object.entries(saved?.answers ?? {}).filter((e): e is [string, string] => e[0] !== id && typeof e[1] === 'string')) })
  }
  return (
    <section className="baseline-mappings" aria-labelledby={`${base}-h`}>
      <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary id={`${base}-h`}>{w.h4} · {fillText(w.pendingCount, { n: rows.filter(r => r.answer === 'pending').length })}</summary>
      <p className="reason">{w.intro}</p>
      {rows.length === 0 && <p className="reason">{w.empty}</p>}
      {rows.map((r) => {
        const labelId = `${base}-${r.id}`
        return (
          <div key={r.id} className="baseline-mapping" data-status={r.answer} data-role={r.role ?? ''}>
            <div className="dlabel" id={labelId}>{r.label}</div>
            <p className="reason mapping-status">{r.roleWord ? `${r.status} · ${r.roleWord}` : r.status}</p>
            {r.roleLine && <p className="reason">{r.roleLine}</p>}
            <details><summary>{fillText(w.usedBy, { n: r.policies.length })}</summary><ul>{r.policies.map((policy) => <li key={policy}>{policy}</li>)}</ul></details>
            <Options key={`${r.id}:${saved?.answers?.[r.id] ?? ''}`} name={answerKey(BASELINE_MAPPINGS_KEY, r.id)} labelledBy={labelId} options={options} answer={answers[r.id] ?? null} onAnswer={(a) => setAnswers((prev) => ({ ...prev, [r.id]: a }))} ex={ex} universe={universeOf(r.kind)} nameOf={nameOf} single />
            {r.omitLine && <p className="reason">{r.omitLine}</p>}
            <p className="reason">{r.answerLine}</p>
            {typeof saved?.answers?.[r.id] === 'string' && (
              <Button variant="secondary" onClick={() => clear(r.id)}>
                {w.clear}
              </Button>
            )}
            <details>
              <summary>{w.sourceId}</summary>
              <code>{r.id}</code>
            </details>
          </div>
        )
      })}
      {rows.length > 0 && (
        <p className="actions">
          <Button variant="secondary" onClick={() => onDecide({ answers: given() })}>
            {w.save}
          </Button>
        </p>
      )}
      </details>
    </section>
  )
}
