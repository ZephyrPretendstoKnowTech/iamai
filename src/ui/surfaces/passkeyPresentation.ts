import type { Step } from '../../roadmap/types.ts'
import type { ContractReadiness } from './stepContract.ts'

// Why the settings matter and how the checks differ. The model list, the current
// values and the intended values are the tiles' and the tasks', not repeated here.
export const PASSKEY_METHODOLOGY = [
  'Device-bound passkeys stay in the authenticator that created them, such as a hardware security key or Microsoft Authenticator, rather than syncing between devices.',
  'Attestation verifies the authenticator model at registration. It does not prove that the phone or computer is joined or registered in Entra.',
  'AAGUIDs identify specific authenticator models, so an allow list limits which models can register.',
  'Passkey storage type, model approval, attestation and Conditional Access authentication strength are separate checks; passing one does not satisfy the others.',
]

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
