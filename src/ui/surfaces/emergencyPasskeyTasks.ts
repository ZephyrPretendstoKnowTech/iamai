import { affectedPasskeysByProposedChange } from '../../roadmap/passkeyCompatibility.ts'
import { assignedPasskeyProfiles, passkeyReadingOf, requiredModels } from '../../roadmap/passkeySettings.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import { emergencyRegistrationVariants } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'
import { tenantNameOf } from './stepVars.ts'

const clean = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()
const upnOf = (ctx: StepVarContext, id: string): string => clean(ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())?.userPrincipalName || ctx.nameOf(id) || id)

const fieldAction = (field: string, value: unknown): string => {
  switch (field) {
    case 'state': return 'Set **Enable** to **On**.'
    case 'isSelfServiceRegistrationAllowed': return 'Set **Allow self-service set up** to **Yes**.'
    case 'isAttestationEnforced': return 'Set **Enforce attestation** to **Yes**.'
    case 'keyRestrictions.isEnforced': return `Set authenticator restrictions to **${value === true ? 'On' : 'Off'}**.`
    case 'keyRestrictions.enforcementType': return `Set restriction mode to **${String(value)}**.`
    case 'includeTargets': return 'Apply the resolved target groups shown in Readiness while preserving the existing exclusions.'
    default: return ''
  }
}

export function emergencyPasskeyTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const reading = passkeyReadingOf(ctx.snapshot, ctx.mapping)
  const tasks: EmergencyAccountTask[] = []
  const current = reading.current
  const profiles = current ? assignedPasskeyProfiles(current) : null
  const profileNames = profiles?.profiles.map(profile => clean(profile.name || profile.id)) ?? []
  const subject = profileNames.length === 1 ? profileNames[0] : profileNames.length > 1 ? 'Applicable passkey profiles' : 'Passkey (FIDO2) policy'
  const profileInstruction = profileNames.length === 1 ? `Open **${profileNames[0]}**.` : profileNames.length > 1 ? `Review each applicable profile separately: ${profileNames.map(name => `**${name}**`).join(', ')}.` : null

  if (reading.state === 'unread' || reading.resolution?.kind === 'review') {
    const unresolved = (step.configurationFindings ?? []).filter(finding => finding.outcome !== 'pass')
    const keys = unresolved.map(finding => finding.key)
    const issueKeys = unresolved.flatMap(finding => finding.items?.flatMap(item => item.issueKeys ?? []) ?? [])
    const tenant = clean(tenantNameOf(ctx.snapshot))
    tasks.push({
    id: 'inspect-passkey-settings', accountId: null, title: `Inspect passkey settings — ${subject}`, targetUpn: null, required: true,
    readinessKey: keys[0] ?? 'availability', readinessKeys: keys,
    evidence: reading.resolution?.kind === 'review' ? reading.resolution.subjects.join(' ') : 'The Passkey (FIDO2) configuration was not read.', actionLabel: 'Open inspection instructions', issueKeys,
    facts: unresolved.flatMap(finding => finding.items?.filter(item => item.outcome !== 'pass').slice(0, 2).map(item => ({ label: item.factLabel ?? item.label, value: item.value })) ?? []),
    steps: [`Open **Microsoft Entra admin center** and select **${tenant || 'the tenant shown in IAMAI'}**.`, 'Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...(profileInstruction ? [profileInstruction] : []), 'Inspect its target groups, passkey type, attestation setting and authenticator restrictions.', 'Return to IAMAI and select **Scan to update the plan**. If the source remains unread, keep the limitation unresolved; this inspection is not a manual override.'],
  })
  }

  const resolution = reading.resolution?.kind === 'target' ? reading.resolution : null
  if (resolution) {
    const availability = reading.differs.filter(field => ['state', 'includeTargets', 'isSelfServiceRegistrationAllowed'].includes(field))
    if (availability.length) tasks.push({
      id: 'make-passkey-registration-available', accountId: null, title: 'Make approved passkey registration available', targetUpn: null, required: true,
      readinessKey: 'availability', evidence: availability.join(', '), actionLabel: 'Open availability instructions',
      issueKeys: availability.map(field => `passkey:${field === 'state' ? 'method' : field === 'isSelfServiceRegistrationAllowed' ? 'selfService' : 'targets'}`),
      steps: ['Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...availability.map(field => fieldAction(field, field === 'state' ? resolution.target.state : field === 'includeTargets' ? resolution.target.includeTargets : resolution.target.isSelfServiceRegistrationAllowed)).filter(Boolean), 'Preserve existing unrelated included and excluded groups and working model allowances.', 'Select **Save**.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
  }

  const affected = affectedPasskeysByProposedChange(ctx.snapshot, ctx.mapping, ctx.groups)
  for (const user of affected.users) {
    const upn = upnOf(ctx, user.accountId)
    const method = user.methods.map(item => `${item.displayName}${item.aaguid ? ` (${item.aaguid})` : ''}`).join(', ')
    if (user.hasCompatibleAlternative) tasks.push({
      id: `check-compatible-passkey:${user.accountId}`, accountId: user.accountId, title: 'Check the compatible passkey', targetUpn: upn, required: true,
      readinessKey: 'affected-passkeys', evidence: `${method} loses access; another compatible passkey is registered.`, actionLabel: 'Open sign-in check',
      issueKeys: [`passkey:affected:${user.accountId.toLowerCase()}`], facts: [{ label: 'Affected passkey', value: method }, { label: 'Compatible alternative', value: 'Observed' }],
      steps: ['Keep your working administrator session open.', `Have **${upn}** open their normal work resource in a separate fresh browser session.`, 'Have the user sign in using the identified compatible passkey.', 'Confirm the sign-in completes for that user without changing administrative settings.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
    else {
      const variants = emergencyRegistrationVariants(upn).map(variant => ({ ...variant, steps: variant.id === 'yubikey'
        ? [...variant.steps.slice(0, -1), 'Have the user sign in with the new passkey in a fresh session.', 'Return to IAMAI and select **Scan to update the plan**.']
        : ['Keep your working administrator session open.', `Have **${upn}** open **Security info** in a separate browser session.`, ...variant.steps.slice(0, -1), 'Have the user sign in with the new passkey in a fresh session.', 'Return to IAMAI and select **Scan to update the plan**.'] }))
      tasks.push({
        id: `prepare-replacement-passkey:${user.accountId}`, accountId: user.accountId, title: 'Prepare a replacement passkey', targetUpn: upn, required: true,
        readinessKey: 'affected-passkeys', evidence: `${method} loses access under the intended settings.`, actionLabel: 'Open replacement instructions', variants, defaultVariantId: variants[0].id,
        issueKeys: [`passkey:affected:${user.accountId.toLowerCase()}`], facts: [{ label: 'Affected passkey', value: method }, { label: 'Compatible alternative', value: 'Not observed' }],
        steps: variants[0].steps,
      })
    }
  }

  if (resolution && reading.differs.some(field => !['state', 'includeTargets', 'isSelfServiceRegistrationAllowed'].includes(field))) {
    const target = resolution.target
    const settingActions = reading.differs.map(field => fieldAction(field, field === 'isAttestationEnforced' ? target.isAttestationEnforced : field === 'keyRestrictions.isEnforced' ? target.keyRestrictions?.isEnforced : field === 'keyRestrictions.enforcementType' ? target.keyRestrictions?.enforcementType : undefined)).filter(Boolean)
    tasks.push({
      id: 'apply-passkey-settings', accountId: null, title: `Apply passkey settings — ${subject}`, targetUpn: null, required: true,
      readinessKey: reading.differs.includes('isAttestationEnforced') ? 'protection' : 'models', evidence: reading.differs.join(', '), actionLabel: 'Open settings instructions',
      readinessKeys: ['protection', 'models'], issueKeys: (step.configurationFindings ?? []).filter(finding => ['protection', 'models'].includes(finding.key)).flatMap(finding => finding.items?.flatMap(item => item.issueKeys ?? []) ?? []),
      steps: ['Keep your working administrator session open.', 'Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...(profileInstruction ? [profileInstruction] : []), ...settingActions, `Enter these exact AAGUID additions while retaining existing explicit allowances: ${resolution.added.length ? resolution.added.map(value => `**${value}**`).join(', ') : 'no new AAGUIDs are required'}.`, 'Preserve unrelated assignments and settings, then select **Save**.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
  }
  return { tasks, approvedModels: requiredModels(ctx.mapping).map(model => ({ ...model, source: 'plan' as const, recovery: true })) }
}
