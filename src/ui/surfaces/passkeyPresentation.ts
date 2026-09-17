import type { Step } from '../../roadmap/types.ts'
import type { ContractReadiness } from './stepContract.ts'

export const PASSKEY_METHODOLOGY = [
  'The default recommendation keeps Microsoft Authenticator for iOS and Android and the two default approved YubiKey 5 models available; saved additional models extend that intent.',
  'Device-bound passkeys stay in the authenticator that created them, such as a hardware security key or Microsoft Authenticator, rather than syncing between devices.',
  'Attestation verifies the authenticator model at registration. It does not prove that the phone or computer is joined or registered in Entra.',
  'AAGUIDs identify specific authenticator models. IAMAI defaults and any saved additional models define the allowed list.',
  'Passkey storage type, model approval, attestation and Conditional Access authentication strength are separate checks; passing one does not satisfy the others.',
]

/** Configuration findings replace the same step’s generic review prerequisite. */
export function passkeyReadiness(step: Step, readiness: ContractReadiness): ContractReadiness {
  if (step.id !== 's-prereq-passkey-settings' || !step.configurationFindings?.length) return readiness
  if (step.configurationFindings.some(f => f.key === 'recovery-ready')) return readiness
  const tiles = readiness.tiles.filter(tile => !tile.key.startsWith('evidence:passkey-settings-'))
  const outstanding = tiles.filter(tile => tile.key.startsWith('configuration:')).length
  return { ...readiness, tiles, bar: { ...readiness.bar, main: outstanding ? `${outstanding} ${outstanding === 1 ? 'setting needs' : 'settings need'} attention` : 'Configuration checks passed' } }
}
