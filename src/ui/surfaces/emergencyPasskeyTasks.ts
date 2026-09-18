import { affectedPasskeysByProposedChange } from '../../roadmap/passkeyCompatibility.ts'
import { assignedPasskeyProfiles, passkeyReadingOf, requiredModels, samePasskeyValue } from '../../roadmap/passkeySettings.ts'
import { approvedPasskeyModels } from '../../roadmap/emergencyJourney.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection, EmergencyAccountTaskVariant } from './emergencyAccountTasks.ts'
import { emergencyRegistrationVariants, yubiKeySteps } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'
import { tenantNameOf } from './stepVars.ts'

const clean = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()
const upnOf = (ctx: StepVarContext, id: string): string => clean(ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())?.userPrincipalName || ctx.nameOf(id) || id)
const displayValue = (value: unknown): string => Array.isArray(value) ? value.map(String).join(', ') || 'None' : typeof value === 'boolean' ? value ? 'On' : 'Off' : String(value ?? 'Unavailable')
const fieldValue = (label: string, value: unknown, modelNames: ReadonlyMap<string, string>): string => {
  if (label === 'Storage') {
    const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value]
    const words = entries.map(entry => String(entry ?? '').trim()).filter(Boolean).map(entry => entry.toLowerCase() === 'devicebound' ? 'Device-bound passkeys' : entry.toLowerCase() === 'synced' ? 'Synced passkeys' : entry)
    return words.join(', ') || 'Unavailable'
  }
  if (label === 'Attestation' && typeof value === 'string') return value === 'registrationOnly' ? 'Required' : value === 'disabled' ? 'Off' : value
  if (label === 'Approved models' && Array.isArray(value)) return value.map(entry => {
    const aaguid = String(entry).toLowerCase()
    const model = modelNames.get(aaguid)
    return model ? `${model} (${aaguid})` : `AAGUID ${aaguid}`
  }).join(', ') || 'None'
  return displayValue(value)
}
const displayTargets = (value: unknown): string => {
  if (!Array.isArray(value)) return ''
  return value.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id.trim()) return []
    const name = row.id.toLowerCase() === 'all_users' ? 'All users' : row.id
    const profiles = Array.isArray(row.allowedPasskeyProfiles) ? row.allowedPasskeyProfiles.filter((id): id is string => typeof id === 'string' && !!id.trim()) : []
    return [`${name}${profiles.length ? ` (profiles: ${profiles.join(', ')})` : ''}`]
  }).join(', ') || 'None'
}
const fieldLabel = (field: string): string => ({
  state: 'Enable',
  includeTargets: 'Included targets',
  isSelfServiceRegistrationAllowed: 'Self-service set up',
  isAttestationEnforced: 'Attestation',
  'keyRestrictions.isEnforced': 'Authenticator restrictions',
  'keyRestrictions.enforcementType': 'Restriction mode',
  'keyRestrictions.aaGuids': 'Approved models',
  passkeyProfiles: 'Applicable passkey profiles',
} as Record<string, string>)[field] ?? field

function changedProfileFacts(currentRaw: unknown, targetRaw: unknown, modelNames: ReadonlyMap<string, string>): { label: string; value: string }[] {
  if (!targetRaw || typeof targetRaw !== 'object' || Array.isArray(targetRaw)) return []
  const target = targetRaw as Record<string, any>
  const current = currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw) ? currentRaw as Record<string, any> : {}
  const name = clean(String(target.name || target.id || 'Passkey profile'))
  const rows: { label: string; key?: string; current: unknown; target: unknown }[] = [
    { label: 'Storage', key: 'passkeyTypes', current: current.passkeyTypes, target: target.passkeyTypes },
    { label: 'Attestation', current: current.attestationEnforcement, target: target.attestationEnforcement },
    { label: 'Restrictions', current: current.keyRestrictions?.isEnforced, target: target.keyRestrictions?.isEnforced },
    { label: 'Restriction mode', current: current.keyRestrictions?.enforcementType, target: target.keyRestrictions?.enforcementType },
    { label: 'Approved models', current: current.keyRestrictions?.aaGuids, target: target.keyRestrictions?.aaGuids },
  ]
  return rows.filter(row => !samePasskeyValue(row.current, row.target, row.key)).map(row => ({ label: `${name} · ${row.label}`, value: `${fieldValue(row.label, row.current, modelNames)} → ${fieldValue(row.label, row.target, modelNames)}` }))
}

const fieldAction = (field: string, value: unknown, modelNames: ReadonlyMap<string, string>): string => {
  switch (field) {
    case 'state': return value === 'enabled' || value === 'disabled' ? `Enable → **${value === 'enabled' ? 'On' : 'Off'}**` : ''
    case 'isSelfServiceRegistrationAllowed': return typeof value === 'boolean' ? `Allow self-service set up → **${value ? 'Yes' : 'No'}**` : ''
    case 'isAttestationEnforced': return typeof value === 'boolean' ? `Attestation → **${value ? 'Required' : 'Off'}**` : ''
    case 'keyRestrictions.isEnforced': return typeof value === 'boolean' ? `Authenticator restrictions → **${value ? 'On' : 'Off'}**` : ''
    case 'keyRestrictions.enforcementType': return typeof value === 'string' ? `Restriction mode → **${value}**` : ''
    case 'includeTargets': return Array.isArray(value) ? `Included targets → **${displayTargets(value)}**` : ''
    case 'keyRestrictions.aaGuids': return Array.isArray(value) ? `Approved models → **${value.map(entry => {
      const aaguid = String(entry).toLowerCase()
      const model = modelNames.get(aaguid)
      return model ? `${model} (${aaguid})` : `AAGUID ${aaguid}`
    }).join(', ') || 'None'}**` : ''
    case 'passkeyProfiles': return 'Applicable passkey profiles → use the resolved values below'
    default: return ''
  }
}

function normalRegistrationVariants(): EmergencyAccountTaskVariant[] {
  return emergencyRegistrationVariants('the affected account').map(variant => ({
    ...variant,
    steps: variant.steps.filter(line => !/Store the|Secure the recovery device/.test(line)).map(line => line.replace('Microsoft Entra admin center', 'a normal work resource')),
  }))
}

/** The portal's Add AAGUID provider entries: selecting one adds every model of that provider. */
const AAGUID_PROVIDERS: readonly { label: string; aaguids: readonly string[] }[] = [
  { label: 'Microsoft Authenticator', aaguids: ['90a3ccdf-635c-4729-a248-9b709135078f', 'de1e552d-db1d-4423-a619-566b625cdc84'] },
]
const lowerIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string').map(id => id.trim().toLowerCase()))] : []
const typeWords = (value: unknown): string => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(entry => String(entry).trim().toLowerCase()).filter(Boolean).map(entry => entry === 'devicebound' ? 'Device-bound' : entry === 'synced' ? 'Synced' : entry).join(', ')

/**
 * The allow-list changes as portal actions, each value given where it is typed:
 * removals, then a provider entry where every one of its models is required
 * (one save), then each remaining model entered by AAGUID (one save each).
 */
function aaguidSteps(currentIds: string[], targetIds: string[], required: readonly string[], modelNames: ReadonlyMap<string, string>, profile: boolean): string[] {
  const named = (id: string): string => modelNames.has(id) ? ` (${modelNames.get(id)})` : ''
  const steps = currentIds.filter(id => !targetIds.includes(id)).map(id => `Remove **${id}**${named(id)} from the AAGUID list.`)
  let missing = targetIds.filter(id => !currentIds.includes(id))
  if (profile) for (const provider of AAGUID_PROVIDERS) {
    if (!provider.aaguids.every(id => required.includes(id)) || !provider.aaguids.some(id => missing.includes(id))) continue
    steps.push(`Select **+ Add AAGUID → ${provider.label}**, then **Save**.`)
    missing = missing.filter(id => !provider.aaguids.includes(id))
  }
  for (const id of missing) steps.push(profile ? `Select **+ Add AAGUID → Enter AAGUID**, enter **${id}**${named(id)}, then **Save**.` : `Select **Add AAGUID** and enter **${id}**${named(id)}.`)
  return steps
}

const saved = (steps: string[]): string[] => steps.length && !/then \*\*Save\*\*\.$/.test(steps.at(-1)!) ? [...steps, 'Select **Save**.'] : steps

/** One profile's differing values, in the order the profile page sets them. */
function profileSteps(currentRaw: unknown, targetRaw: unknown, required: readonly string[], modelNames: ReadonlyMap<string, string>): string[] {
  const current = (currentRaw && typeof currentRaw === 'object' ? currentRaw : {}) as Record<string, any>
  const target = (targetRaw && typeof targetRaw === 'object' ? targetRaw : {}) as Record<string, any>
  const kr = current.keyRestrictions ?? {}
  const tk = target.keyRestrictions ?? {}
  return saved([
    ...(samePasskeyValue(current.passkeyTypes, target.passkeyTypes, 'passkeyTypes') ? [] : [`Set **Passkey types** to **${typeWords(target.passkeyTypes)}**.`]),
    ...(samePasskeyValue(current.attestationEnforcement, target.attestationEnforcement) ? [] : [`Set **Enforce attestation** to **${target.attestationEnforcement === 'registrationOnly' ? 'Yes' : 'No'}**.`]),
    ...(kr.isEnforced === tk.isEnforced && kr.enforcementType === tk.enforcementType ? [] : [tk.isEnforced === true ? `Select **Target specific AAGUIDs** and set **Behavior** to **${tk.enforcementType === 'block' ? 'Block' : 'Allow'}**.` : 'Clear **Target specific AAGUIDs**.']),
    ...aaguidSteps(lowerIds(kr.aaGuids), lowerIds(tk.aaGuids), required, modelNames, true),
  ])
}

/** A legacy (profile-less) configuration's differing values, on its Configure tab. */
function legacySteps(fields: readonly string[], current: Record<string, any> | null, target: Record<string, any>, required: readonly string[], modelNames: ReadonlyMap<string, string>): string[] {
  const yes = (value: unknown): string => value === true ? 'Yes' : 'No'
  return saved(fields.flatMap(field => {
    switch (field) {
      case 'isAttestationEnforced': return [`Set **Enforce attestation** to **${yes(target.isAttestationEnforced)}**.`]
      case 'keyRestrictions.isEnforced': return [`Set **Enforce key restrictions** to **${yes(target.keyRestrictions?.isEnforced)}**.`]
      case 'keyRestrictions.enforcementType': return [`Set **Restrict specific keys** to **${target.keyRestrictions?.enforcementType === 'block' ? 'Block' : 'Allow'}**.`]
      case 'keyRestrictions.aaGuids': return aaguidSteps(lowerIds(current?.keyRestrictions?.aaGuids), lowerIds(target.keyRestrictions?.aaGuids), required, modelNames, false)
      default: return []
    }
  }))
}

/** Four persistent, outcome-sized Entra procedures for Configure Passkey Authentication. */
export function emergencyPasskeyTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const reading = passkeyReadingOf(ctx.snapshot, ctx.mapping)
  const current = reading.current
  const profiles = current ? assignedPasskeyProfiles(current) : null
  const profileNames = profiles?.profiles.map(profile => clean(profile.name || profile.id)) ?? []
  const subject = profileNames.length === 1 ? profileNames[0] : profileNames.length > 1 ? 'Applicable passkey profiles' : 'Passkey (FIDO2) policy'
  const profileInstruction = profileNames.length === 1 ? `Open **${profileNames[0]}**.` : profileNames.length > 1 ? `Review each applicable profile separately: ${profileNames.map(name => `**${name}**`).join(', ')}.` : 'For a legacy configuration, open **Configure**.'
  const unresolved = (step.configurationFindings ?? []).filter(finding => finding.outcome !== 'pass')
  const resolution = reading.resolution?.kind === 'target' ? reading.resolution : null
  const intendedModels = approvedPasskeyModels(ctx.snapshot, ctx.mapping)
  const modelNames = new Map(intendedModels.map(model => [model.aaguid.toLowerCase(), model.name]))
  const availabilityFields = resolution ? reading.differs.filter(field => ['state', 'includeTargets', 'isSelfServiceRegistrationAllowed'].includes(field)) : []
  const protectionFields = resolution ? reading.differs.filter(field => !['state', 'includeTargets', 'isSelfServiceRegistrationAllowed'].includes(field)) : []
  const currentProfiles = new Map((Array.isArray(current?.passkeyProfiles) ? current.passkeyProfiles : []).flatMap(raw => raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).id === 'string' ? [[String((raw as Record<string, unknown>).id), raw]] : []))
  const changedProfiles = protectionFields.includes('passkeyProfiles') && Array.isArray(resolution?.target.passkeyProfiles)
    ? resolution.target.passkeyProfiles.filter(raw => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
        const id = String((raw as Record<string, unknown>).id ?? '')
        return !samePasskeyValue(raw, currentProfiles.get(id))
      })
    : []
  const profileCorrections = changedProfiles.flatMap(raw => {
    const id = String((raw as Record<string, unknown>).id ?? '')
    return changedProfileFacts(currentProfiles.get(id), raw, modelNames)
  })
  const changedProfileNames = changedProfiles.map(raw => clean(String((raw as Record<string, unknown>).name || (raw as Record<string, unknown>).id || 'Passkey profile')))
  const correctionProfileInstruction = changedProfileNames.length === 1 ? `Open **${changedProfileNames[0]}**.` : changedProfileNames.length > 1 ? `Open only these profiles: ${changedProfileNames.map(name => `**${name}**`).join(', ')}.` : profileInstruction
  const affected = affectedPasskeysByProposedChange(ctx.snapshot, ctx.mapping, ctx.groups)
  const affectedFacts = affected.users.flatMap(user => user.methods.map(method => ({
    label: upnOf(ctx, user.accountId),
    value: `${method.displayName}${method.aaguid ? ` · ${method.aaguid}` : ''}${method.passkeyType ? ` · ${method.passkeyType}` : ''}${user.hasCompatibleAlternative ? ' · Compatible alternative registered' : ' · Replacement needed'}`,
  })))
  const variants = normalRegistrationVariants()
  const customHardware = intendedModels.filter(model => model.source === 'plan' && model.recovery && !/yubikey/i.test(model.name))
  if (customHardware.length) variants.push({
    id: 'approved-hardware',
    label: 'Additional approved hardware key',
    facts: [...affectedFacts, ...customHardware.map(model => ({ label: model.name, value: `Replacement AAGUID: ${model.aaguid}` }))],
    steps: yubiKeySteps('the affected account', `approved hardware security key (${customHardware.map(model => `${model.name}, AAGUID ${model.aaguid}`).join('; ')})`).filter(line => !/Store the|Return to IAMAI/i.test(line)).map(line => line.replace('Microsoft Entra admin center', 'a normal work resource')),
  })
  const required = requiredModels(ctx.mapping).map(model => model.aaguid.toLowerCase())
  const protectionChanges = !resolution || !protectionFields.length ? []
    : changedProfiles.length ? changedProfiles.flatMap(raw => {
        const id = String((raw as Record<string, unknown>).id ?? '')
        const changes = profileSteps(currentProfiles.get(id), raw, required, modelNames)
        return changes.length ? [`Open **${clean(String((raw as Record<string, unknown>).name || id || 'Passkey profile'))}**.`, ...changes] : []
      })
    : (() => { const changes = legacySteps(protectionFields, current as Record<string, any> | null, resolution.target as Record<string, any>, required, modelNames); return changes.length ? ['Open **Configure**.', ...changes] : [] })()
  const tenant = clean(tenantNameOf(ctx.snapshot))
  const targetValue = (field: string): unknown => field === 'state' ? resolution?.target.state : field === 'includeTargets' ? resolution?.target.includeTargets : field === 'isSelfServiceRegistrationAllowed' ? resolution?.target.isSelfServiceRegistrationAllowed : field === 'isAttestationEnforced' ? resolution?.target.isAttestationEnforced : field === 'keyRestrictions.isEnforced' ? resolution?.target.keyRestrictions?.isEnforced : field === 'keyRestrictions.enforcementType' ? resolution?.target.keyRestrictions?.enforcementType : field === 'keyRestrictions.aaGuids' ? resolution?.target.keyRestrictions?.aaGuids : field === 'passkeyProfiles' ? resolution?.target.passkeyProfiles : undefined
  const currentValue = (field: string): unknown => field === 'state' ? current?.state : field === 'includeTargets' ? current?.includeTargets : field === 'isSelfServiceRegistrationAllowed' ? current?.isSelfServiceRegistrationAllowed : field === 'isAttestationEnforced' ? current?.isAttestationEnforced : field === 'keyRestrictions.isEnforced' ? current?.keyRestrictions?.isEnforced : field === 'keyRestrictions.enforcementType' ? current?.keyRestrictions?.enforcementType : field === 'keyRestrictions.aaGuids' ? current?.keyRestrictions?.aaGuids : field === 'passkeyProfiles' ? current?.passkeyProfiles : undefined
  const comparisonFields = [...new Set([...availabilityFields, ...protectionFields])]
  const inspectionFacts = resolution ? [
    ...comparisonFields.filter(field => field !== 'passkeyProfiles').map(field => ({ label: fieldLabel(field), value: `${fieldValue(fieldLabel(field), currentValue(field), modelNames)} → ${fieldValue(fieldLabel(field), targetValue(field), modelNames)}` })),
    ...profileCorrections,
  ] : unresolved.flatMap(finding => finding.items?.filter(item => item.outcome !== 'pass').slice(0, 2).map(item => ({ label: item.factLabel ?? item.label, value: item.value })) ?? [])
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'inspect-passkey-settings', accountId: null, title: `Review passkey settings — ${subject}`, targetUpn: null, required: false,
      readinessKey: unresolved[0]?.key ?? 'registration', readinessKeys: unresolved.map(finding => finding.key), evidence: null, actionLabel: 'Open review instructions', issueKeys: [],
      facts: inspectionFacts,
      steps: [`Open Microsoft Entra admin center and select **${tenant || 'the tenant shown in IAMAI'}**, then open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.`, ...(resolution && inspectionFacts.length ? ['Compare each current → intended value listed above.'] : ['Inspect **Enable and target** and the applicable profiles. Do not change a value in this inspection task.']), profileInstruction, 'Do not guess or save a value IAMAI did not establish.'],
    },
    {
      id: 'make-passkey-registration-available', accountId: null, title: 'Configure passkey registration', targetUpn: null,
      required: availabilityFields.length > 0, readinessKey: 'registration', evidence: availabilityFields.length ? availabilityFields.join(', ') : null, actionLabel: 'Open registration instructions',
      issueKeys: availabilityFields.map(field => `passkey:${field === 'state' ? 'method' : field === 'isSelfServiceRegistrationAllowed' ? 'selfService' : 'targets'}`),
      facts: resolution ? availabilityFields.flatMap(field => { const value = fieldAction(field, targetValue(field), modelNames).replace(/\*\*/g, ''); return value ? [{ label: fieldLabel(field), value }] : [] }) : [],
      steps: ['Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2) → Enable and target**.', ...(resolution && availabilityFields.length ? ['Apply only the values above. Preserve unrelated inclusions and exclusions.', 'Save the changes. Return to IAMAI and select **Scan to update the plan**.'] : resolution ? ['Review the current availability, targeting, exclusions, and self-service registration settings. No save is required.', 'Return to IAMAI and select **Scan to update the plan**.'] : ['Review the current availability and targeting. IAMAI has not established the change values for this scan; do not save guessed values.'])],
    },
    {
      id: 'prepare-affected-passkeys', accountId: null, title: 'Prepare affected passkeys', targetUpn: null,
      required: affected.users.length > 0, readinessKey: 'affected-passkeys', evidence: affected.users.length ? `${affected.users.length} user${affected.users.length === 1 ? '' : 's'} confirmed affected.` : null, actionLabel: 'Open preparation instructions',
      issueKeys: affected.users.map(user => `passkey:affected:${user.accountId.toLowerCase()}`), facts: affectedFacts, variants, defaultVariantId: variants[0].id,
      steps: ['Keep the existing working method available while preparing each affected account.', '**Compatible alternative**', 'Sign in with the registered compatible alternative in a separate session, confirm the account, then continue to the final scan action.', '**Replacement registration — only if needed**', 'Return to IAMAI and select **Scan to update the plan** before applying restrictions.'],
    },
    {
      id: 'apply-passkey-settings', accountId: null, title: `Configure passkey protections — ${subject}`, targetUpn: null,
      required: protectionFields.length > 0, readinessKey: 'protection', readinessKeys: ['protection'], evidence: protectionFields.length ? protectionFields.join(', ') : null, actionLabel: 'Open protection instructions',
      issueKeys: (step.configurationFindings ?? []).filter(finding => finding.key === 'protection').flatMap(finding => finding.items?.flatMap(item => item.issueKeys ?? []) ?? []),
      // The changes are the tile's facts; the procedure applies each value at the point of action.
      readinessFacts: resolution ? (profileCorrections.length ? profileCorrections : protectionFields.flatMap(field => { const value = fieldAction(field, targetValue(field), modelNames).replace(/\*\*/g, ''); return value ? [{ label: fieldLabel(field), value }] : [] })) : [],
      steps: ['Keep your working administrator session open. Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...(resolution && protectionChanges.length ? protectionChanges : [protectionFields.length ? correctionProfileInstruction : profileInstruction, ...(resolution && protectionFields.length ? ['Apply only the changed values shown in Tasks Remaining. Preserve unrelated targeting and settings.', 'Save the change.'] : resolution ? ['Review storage type, attestation, authenticator restrictions, restriction mode, and approved models. No save is required.'] : ['Review the applicable profile. IAMAI has not established the change values for this scan; do not save guessed values.'])]), ...(resolution ? ['Return to IAMAI and select **Scan to update the plan**.'] : [])],
    },
  ]
  return { tasks, printAll: true, approvedModels: intendedModels }
}
