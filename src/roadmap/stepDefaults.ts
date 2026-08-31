// Defaults for the Step fields that later passes fill in (populations, rings,
// safe-today, events). Shared so every builder of a Step starts from the same
// shape: the roadmap engine and the free-tier ladder.
import type { Step } from './types.ts'

export type StepExtras = Pick<
  Step,
  | 'impact' | 'safeToday' | 'highCare' | 'comms' | 'learn' | 'includesOperator' | 'operatorSafe' | 'rings' | 'currentRing' | 'populationBasis' | 'populationNames' | 'populationView'
  | 'whatChanges' | 'failureModes' | 'verify' | 'helpDesk' | 'ringComms' | 'rollbackBody' | 'owner' | 'scheduledDate' | 'tracking' | 'alreadyInPlace'
  | 'events' | 'safeVerdict' | 'plainTitle' | 'forManager' | 'gap'
>

export const STEP_EXTRAS: StepExtras = {
  impact: '',
  safeToday: false,
  highCare: { userIds: [], ready: true, notes: [] },
  comms: null,
  learn: null,
  includesOperator: false,
  operatorSafe: null,
  rings: [],
  currentRing: 0,
  populationBasis: '',
  populationNames: [],
  populationView: null,
  whatChanges: '',
  failureModes: [],
  verify: null,
  helpDesk: null,
  ringComms: [],
  rollbackBody: null,
  owner: null,
  scheduledDate: null,
  tracking: null,
  alreadyInPlace: false,
  gap: null,
  events: null,
  safeVerdict: { safe: false, reason: '', sentence: '' },
  plainTitle: '',
  forManager: '',
}
