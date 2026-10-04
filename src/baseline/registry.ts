// The curated baselines IAMAI ships (v2.0 prep, Phase A item 1;
// docs/plans/v2.0/prep.md): one definition per baseline, and the one module in
// src/ that imports a baseline's files. Every other module reads a baseline
// through here, so a second curated baseline is one more entry, never another
// set of direct imports.
//
// Today there is one: Jon Hope's Defense in Depth, pinned. The files stay where
// the pin script writes them (baselines/<id>-conditionalaccesspolicies.*.json).
//
// Pure: no DOM, no network.
import jhopePinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import jhopeIndex from '../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import jhopeInterpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }

/** A curated baseline's id: the key its files are named by. */
export type BaselineId = 'jhope188'

/** One curated baseline: its pinned policies, its index (author, repository, commit), its interpretation, and the name the product shows. */
export type BaselineDefinition = {
  id: BaselineId
  /** The name the product shows for it (Connect, the plan file, the export). */
  label: string
  pinned: typeof jhopePinned
  index: typeof jhopeIndex
  interpretation: typeof jhopeInterpretation
}

export const BASELINES: Readonly<Record<BaselineId, BaselineDefinition>> = {
  jhope188: { id: 'jhope188', label: 'Defense in Depth — Maintained by Jon Hope', pinned: jhopePinned, index: jhopeIndex, interpretation: jhopeInterpretation },
}

/** The baseline a plan uses when none is chosen: Jon Hope's. */
export const DEFAULT_BASELINE_ID: BaselineId = 'jhope188'
export const DEFAULT_BASELINE: BaselineDefinition = BASELINES[DEFAULT_BASELINE_ID]

/** A curated baseline by its id; null for an id IAMAI does not ship. */
export function baselineById(id: string): BaselineDefinition | null {
  return Object.prototype.hasOwnProperty.call(BASELINES, id) ? BASELINES[id as BaselineId] : null
}
