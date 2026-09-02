// Defaults for the Step fields that later passes fill in (populations, rings,
// safe-today, events). Shared so every builder of a Step starts from the same
// shape: the roadmap engine and the free-tier ladder.
import type { Step } from './types.ts'

export type StepExtras = Pick<
  Step,
  | 'comms' | 'learn' | 'includesOperator' | 'operatorSafe' | 'rings' | 'currentRing' 
  | 'owner' | 'tracking' 
  | 'events' | 'plainTitle' | 'forManager' | 'gap' | 'gapShort' | 'blockedReason'
  | 'scenarioLines' | 'cantSee' | 'dateNotes'
>

export const STEP_EXTRAS: StepExtras = {
  comms: null,
  learn: null,
  includesOperator: false,
  operatorSafe: null,
  rings: [],
  currentRing: 0,
  owner: null,
  tracking: null,
  gap: null,
  gapShort: null,
  blockedReason: null,
  events: null,
  plainTitle: '',
  forManager: '',
  scenarioLines: [],
  cantSee: [],
  dateNotes: [],
}
