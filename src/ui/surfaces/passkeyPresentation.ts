import type { Step } from '../../roadmap/types.ts'
import type { ContractReadiness } from './stepContract.ts'

/** Configuration findings replace the same step’s generic review prerequisite. */
export function passkeyReadiness(step: Step, readiness: ContractReadiness): ContractReadiness {
  if (step.id !== 's-prereq-passkey-settings' || !step.configurationFindings?.length) return readiness
  const tiles = readiness.tiles.filter(tile => !tile.key.startsWith('evidence:passkey-settings-'))
  const corrections = step.configurationFindings.filter(finding => finding.outcome === 'fail').length
  const incomplete = step.configurationFindings.some(finding => finding.outcome === 'unknown')
  const main = corrections
    ? `${corrections} ${corrections === 1 ? 'setting needs' : 'settings need'} attention${incomplete ? '; other checks incomplete' : ''}`
    : incomplete ? 'Checks incomplete' : 'Configuration checks passed'
  return { ...readiness, tiles, bar: { ...readiness.bar, main } }
}
