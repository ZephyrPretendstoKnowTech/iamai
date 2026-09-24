import { affectedPasskeysByProposedChange, REGISTERED_METHODS_UNREAD } from '../../roadmap/passkeyCompatibility.ts'
import { PASSKEY_TARGET, assignedPasskeyProfiles, passkeyReadingOf, requiredModels, samePasskeyValue } from '../../roadmap/passkeySettings.ts'
import { approvedPasskeyModels } from '../../roadmap/emergencyJourney.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection, EmergencyAccountTaskVariant } from './emergencyAccountTasks.ts'
import { emergencyRegistrationVariants, yubiKeySteps } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'
import { passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import type { PasskeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import { shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { count, list } from '../../copy/statements.ts'
import { methodName } from '../../copy/inventory.ts'
import { NAMES_INLINE } from './whoBlocks.ts'

const clean = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()
const upnOf = (ctx: StepVarContext, id: string): string => clean(ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())?.userPrincipalName || ctx.nameOf(id) || id)
const displayValue = (value: unknown): string => Array.isArray(value) ? value.map(String).join(', ') || 'None' : typeof value === 'boolean' ? value ? 'On' : 'Off' : String(value ?? 'Unavailable')
const yesNo = (value: unknown): string => value === true || value === 'registrationOnly' ? 'Yes' : value === false || value === 'disabled' ? 'No' : displayValue(value)
const modelList = (value: unknown, modelNames: ReadonlyMap<string, string>): string => Array.isArray(value) ? value.map(entry => {
  const aaguid = String(entry).toLowerCase()
  const model = modelNames.get(aaguid)
  return model ? `${model} (${aaguid})` : `AAGUID ${aaguid}`
}).join(', ') || 'None' : displayValue(value)
/** A setting's value as the Entra portal shows it, by the portal's field name. */
const fieldValue = (label: string, value: unknown, modelNames: ReadonlyMap<string, string>): string => {
  switch (label) {
    case 'Passkey types': {
      const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value]
      return entries.map(entry => String(entry ?? '').trim()).filter(Boolean).map(entry => entry.toLowerCase() === 'devicebound' ? 'Device-bound' : entry.toLowerCase() === 'synced' ? 'Synced' : entry).join(', ') || 'Unavailable'
    }
    case 'Enforce attestation': case 'Enforce key restrictions': case 'Target specific AAGUIDs': case 'Allow self-service set up': return yesNo(value)
    case 'Restrict specific keys': case 'Behavior': return value === 'allow' ? 'Allow' : value === 'block' ? 'Block' : displayValue(value)
    case 'Enable': return value === 'enabled' ? 'On' : value === 'disabled' ? 'Off' : displayValue(value)
    case 'Approved models': case 'Model/Provider AAGUIDs': return modelList(value, modelNames)
    default: return displayValue(value)
  }
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
  isSelfServiceRegistrationAllowed: 'Allow self-service set up',
  isAttestationEnforced: 'Enforce attestation',
  'keyRestrictions.isEnforced': 'Enforce key restrictions',
  'keyRestrictions.enforcementType': 'Restrict specific keys',
  'keyRestrictions.aaGuids': 'Approved models',
  passkeyProfiles: 'Applicable passkey profiles',
} as Record<string, string>)[field] ?? field

function changedProfileFacts(currentRaw: unknown, targetRaw: unknown, modelNames: ReadonlyMap<string, string>): { label: string; value: string }[] {
  if (!targetRaw || typeof targetRaw !== 'object' || Array.isArray(targetRaw)) return []
  const target = targetRaw as Record<string, any>
  const current = currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw) ? currentRaw as Record<string, any> : {}
  const name = clean(String(target.name || target.id || 'Passkey profile'))
  const rows: { label: string; key?: string; current: unknown; target: unknown }[] = [
    { label: 'Passkey types', key: 'passkeyTypes', current: current.passkeyTypes, target: target.passkeyTypes },
    { label: 'Enforce attestation', current: current.attestationEnforcement, target: target.attestationEnforcement },
    { label: 'Target specific AAGUIDs', current: current.keyRestrictions?.isEnforced, target: target.keyRestrictions?.isEnforced },
    { label: 'Behavior', current: current.keyRestrictions?.enforcementType, target: target.keyRestrictions?.enforcementType },
    { label: 'Model/Provider AAGUIDs', current: current.keyRestrictions?.aaGuids, target: target.keyRestrictions?.aaGuids },
  ]
  return rows.filter(row => !samePasskeyValue(row.current, row.target, row.key)).map(row => ({ label: `${name} · ${row.label}`, value: `${fieldValue(row.label, row.current, modelNames)} → ${fieldValue(row.label, row.target, modelNames)}` }))
}

const fieldAction = (field: string, value: unknown, modelNames: ReadonlyMap<string, string>): string => {
  if (field === 'passkeyProfiles') return 'Applicable passkey profiles → use the resolved values below'
  if (field === 'includeTargets') return Array.isArray(value) ? `Included targets → **${displayTargets(value)}**` : ''
  const label = fieldLabel(field)
  return value === undefined || value === null || label === field ? '' : `${label} → **${fieldValue(label, value, modelNames)}**`
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
 * The allow list as portal actions, each value given where it is typed: the
 * entries the target drops removed, then every model the target lists — a
 * provider entry where every one of its models is required (one save), then
 * each remaining model entered by AAGUID (one save each).
 */
function aaguidSteps(currentIds: string[], targetIds: string[], required: readonly string[], modelNames: ReadonlyMap<string, string>, profile: boolean): string[] {
  const named = (id: string): string => modelNames.has(id) ? ` (${modelNames.get(id)})` : ''
  const steps = currentIds.filter(id => !targetIds.includes(id)).map(id => `Remove **${id}**${named(id)} from the AAGUID list.`)
  let missing = [...targetIds]
  if (profile) for (const provider of AAGUID_PROVIDERS) {
    if (!provider.aaguids.every(id => required.includes(id)) || !provider.aaguids.some(id => missing.includes(id))) continue
    steps.push(`Select **+ Add AAGUID → ${provider.label}**, then **Save**.`)
    missing = missing.filter(id => !provider.aaguids.includes(id))
  }
  for (const id of missing) steps.push(profile ? `Select **+ Add AAGUID → Enter AAGUID**, enter **${id}**${named(id)}, then **Save**.` : `Select **Add AAGUID** and enter **${id}**${named(id)}.`)
  return steps
}

const saved = (steps: string[]): string[] => steps.length && !/then \*\*Save\*\*\.$/.test(steps.at(-1)!) ? [...steps, 'Select **Save**.'] : steps

/**
 * One profile's values, every one of them, in the order the profile page sets
 * them. With attestation enforced the page offers device-bound passkeys only,
 * however the types are stored.
 */
function profileSteps(currentRaw: unknown, targetRaw: unknown, required: readonly string[], modelNames: ReadonlyMap<string, string>, restrict = true): string[] {
  const current = (currentRaw && typeof currentRaw === 'object' ? currentRaw : {}) as Record<string, any>
  const target = (targetRaw && typeof targetRaw === 'object' ? targetRaw : {}) as Record<string, any>
  const kr = current.keyRestrictions ?? {}
  const tk = target.keyRestrictions ?? {}
  const attested = target.attestationEnforcement === 'registrationOnly'
  return saved([
    `Set **Passkey types** to **${attested ? 'Device-bound' : typeWords(target.passkeyTypes)}**.`,
    `Set **Enforce attestation** to **${attested ? 'Yes' : 'No'}**.`,
    // The allow list, only where it is IAMAI's to hand over (roadmap/passkeyRestrictions.ts).
    ...(!restrict ? [] : [tk.isEnforced === true ? `Select **Target specific AAGUIDs** and set **Behavior** to **${tk.enforcementType === 'block' ? 'Block' : 'Allow'}**.` : 'Clear **Target specific AAGUIDs**.']),
    ...(restrict ? aaguidSteps(lowerIds(kr.aaGuids), lowerIds(tk.aaGuids), required, modelNames, true) : []),
  ])
}

/** The legacy (profile-less) configuration's values, every one of them, on its Configure tab. */
const LEGACY_PROTECTION_FIELDS = ['isAttestationEnforced', 'keyRestrictions.isEnforced', 'keyRestrictions.enforcementType', 'keyRestrictions.aaGuids'] as const
function legacySteps(current: Record<string, any> | null, target: Record<string, any>, required: readonly string[], modelNames: ReadonlyMap<string, string>, restrict = true): string[] {
  const yes = (value: unknown): string => value === true ? 'Yes' : 'No'
  return saved(LEGACY_PROTECTION_FIELDS.filter(field => restrict || !field.startsWith('keyRestrictions.')).flatMap(field => {
    switch (field) {
      case 'isAttestationEnforced': return [`Set **Enforce attestation** to **${yes(target.isAttestationEnforced)}**.`]
      case 'keyRestrictions.isEnforced': return [`Set **Enforce key restrictions** to **${yes(target.keyRestrictions?.isEnforced)}**.`]
      case 'keyRestrictions.enforcementType': return [`Set **Restrict specific keys** to **${target.keyRestrictions?.enforcementType === 'block' ? 'Block' : 'Allow'}**.`]
      case 'keyRestrictions.aaGuids': return aaguidSteps(lowerIds(current?.keyRestrictions?.aaGuids), lowerIds(target.keyRestrictions?.aaGuids), required, modelNames, false)
    }
  }))
}

/** Three persistent, outcome-sized Entra procedures for Configure Passkey Authentication. */
export function emergencyPasskeyTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const reading = passkeyReadingOf(ctx.snapshot, ctx.mapping)
  const current = reading.current
  const profiles = current ? assignedPasskeyProfiles(current) : null
  const profileNames = profiles?.profiles.map(profile => clean(profile.name || profile.id)) ?? []
  const subject = profileNames.length === 1 ? profileNames[0] : profileNames.length > 1 ? 'Applicable passkey profiles' : 'Passkey (FIDO2) policy'
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
  const affected = affectedPasskeysByProposedChange(ctx.snapshot, ctx.mapping, ctx.groups)
  // Who the planned allow list would leave without a passkey it allows, and
  // whether any of them would keep no way to sign in (roadmap/passkeyRestrictions.ts).
  const restriction = passkeyRestrictionReading(ctx.snapshot, ctx.mapping, ctx.groups)
  const withheld = restriction.lockedOut.length > 0
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
  const targetValue = (field: string): unknown => field === 'state' ? resolution?.target.state : field === 'includeTargets' ? resolution?.target.includeTargets : field === 'isSelfServiceRegistrationAllowed' ? resolution?.target.isSelfServiceRegistrationAllowed : field === 'isAttestationEnforced' ? resolution?.target.isAttestationEnforced : field === 'keyRestrictions.isEnforced' ? resolution?.target.keyRestrictions?.isEnforced : field === 'keyRestrictions.enforcementType' ? resolution?.target.keyRestrictions?.enforcementType : field === 'keyRestrictions.aaGuids' ? resolution?.target.keyRestrictions?.aaGuids : field === 'passkeyProfiles' ? resolution?.target.passkeyProfiles : undefined
  // Every task states the values it sets, in every state, a change needed or
  // not (owner, 2026-09-23): they read "Review … No save is required." once the
  // settings matched. The values are the resolved target's. Where the scan
  // resolves none (the settings unread, or a policy the step holds for review)
  // they are the plan's own: the pinned settings, the tenant's included targets
  // or All users, and each allow list keeping the models it already allows and
  // adding the approved ones. The protections had named no value at all there.
  const restrictionsOf = (raw: unknown): unknown => raw && typeof raw === 'object' ? (raw as Record<string, unknown>).keyRestrictions : undefined
  const planKeys = (raw: unknown): Record<string, unknown> => {
    const kr = restrictionsOf(raw) as Record<string, unknown> | undefined
    const kept = kr?.isEnforced === true && kr.enforcementType === 'allow' ? lowerIds(kr.aaGuids) : []
    return { isEnforced: true, enforcementType: 'allow', aaGuids: [...kept, ...required.filter(id => !kept.includes(id))] }
  }
  const include = [resolution?.target.includeTargets, current?.includeTargets, PASSKEY_TARGET.includeTargets].map(displayTargets).find(words => words !== '' && words !== 'None')
  const registrationSteps = [
    `Set **Enable** to **${resolution?.target.state === 'disabled' ? 'Off' : 'On'}**.`,
    `Under **Include**, target **${include}**.`,
    `Set **Allow self-service set up** to **${resolution?.target.isSelfServiceRegistrationAllowed === false ? 'No' : 'Yes'}**.`,
  ]
  const assignedProfiles = profiles?.profiles ?? []
  const target = (resolution?.target ?? { ...PASSKEY_TARGET, keyRestrictions: planKeys(current) }) as Record<string, any>
  const targetProfiles = resolution
    ? new Map((Array.isArray(target.passkeyProfiles) ? target.passkeyProfiles as unknown[] : []).flatMap(raw => raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).id === 'string' ? [[String((raw as Record<string, unknown>).id).toLowerCase(), raw] as const] : []))
    : new Map(assignedProfiles.map(profile => [profile.id.toLowerCase(), { ...profile, passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: planKeys(profile) }] as const))
  // The allow list is stated unless it is withheld (roadmap/passkeyRestrictions.ts),
  // and always where the tenant already has it as planned.
  const restricts = (from: unknown, to: unknown): boolean => !withheld || samePasskeyValue(restrictionsOf(from), restrictionsOf(to))
  const protectionSteps = assignedProfiles.length && targetProfiles.size
    ? assignedProfiles.flatMap(profile => {
        const from = currentProfiles.get(profile.id)
        const to = targetProfiles.get(profile.id.toLowerCase())
        return [`Open **${clean(profile.name || profile.id)}**.`, ...profileSteps(from, to, required, modelNames, restricts(from, to))]
      })
    : ['Open **Configure**.', ...legacySteps(current as Record<string, any> | null, target, required, modelNames, restricts(current, target))]
  // Prepare affected passkeys opens on what the scan found in what it read: the
  // accounts the planned settings would stop or could not judge, the affected
  // accounts, or how many it could not judge.
  const namedFromRead = restriction.stranded.length > 0
    ? strandedSentence(restriction, ctx, protectionFields.length > 0)
    : affected.users.length
    ? `Keep the existing working method available while preparing each affected account: ${affected.users.map(user => `**${upnOf(ctx, user.accountId)}**`).join(', ')}.`
    // Could not judge is not the same as not affected, and saying the
    // second over the first is an unhedged all-clear before a change that
    // can cost people their sign-in method. The tile beside this already
    // reads "Existing passkeys affected · Could not verify"; the task said
    // the opposite four lines below it.
    : affected.unassessable.length
      ? `IAMAI could not tell whether the planned settings affect the passkeys on ${affected.unassessable.length} ${affected.unassessable.length === 1 ? 'account' : 'accounts'}, because it could not read their key model. Check those before applying restrictions, and keep the existing working method available.`
      : null
  // What was read is not everything where some account's registered methods were
  // not: the line said "Each keeps Microsoft Authenticator, so none is locked out"
  // over a tenant most of whose accounts it had not read, under a tile reading
  // "Could not verify". Every reading says so, in the tile's own sentence.
  const unreadAlso = affected.coverage.includes(REGISTERED_METHODS_UNREAD) ? ` ${fillText(PR().unreadAlso, { unread: REGISTERED_METHODS_UNREAD })}` : ''
  // With nobody named the procedure opens on what to keep, with no all-clear
  // and no qualifier about what the scan read (owner, 2026-09-23): the
  // Existing passkeys affected card says what it found.
  const prepareLead = namedFromRead !== null ? `${namedFromRead}${unreadAlso}` : 'Keep the existing working method available while preparing an account.'
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'make-passkey-registration-available', accountId: null, title: 'Configure passkey registration', targetUpn: null,
      required: availabilityFields.length > 0, readinessKey: 'registration', evidence: availabilityFields.length ? availabilityFields.join(', ') : null, actionLabel: 'Open registration instructions',
      issueKeys: availabilityFields.map(field => `passkey:${field === 'state' ? 'method' : field === 'isSelfServiceRegistrationAllowed' ? 'selfService' : 'targets'}`),
      steps: ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Policies → Passkey (FIDO2) → Enable and target**.', ...registrationSteps, 'Preserve unrelated inclusions and exclusions. Select **Save**.', 'Return to IAMAI and select **Scan to update the plan**.'],
    },
    {
      id: 'prepare-affected-passkeys', accountId: null, title: 'Prepare affected passkeys', targetUpn: null,
      required: affected.users.length > 0 || restriction.stranded.length > 0, readinessKey: 'affected-passkeys', evidence: affected.users.length ? `${affected.users.length} user${affected.users.length === 1 ? '' : 's'} confirmed affected.` : null, actionLabel: 'Open preparation instructions',
      issueKeys: affected.users.map(user => `passkey:affected:${user.accountId.toLowerCase()}`), facts: affectedFacts, variants, defaultVariantId: variants[0].id,
      steps: [prepareLead, '**Compatible alternative:** sign in with the registered compatible alternative in a separate session, confirm the account, then continue to the final scan action.', '**Replacement registration, only if needed:** where no compatible alternative is registered, continue with the steps below to register a replacement.', protectionFields.length > 0 ? 'Return to IAMAI and select **Scan to update the plan** before applying restrictions.' : 'Return to IAMAI and select **Scan to update the plan**.'],
    },
    {
      id: 'apply-passkey-settings', accountId: null, title: 'Configure passkey protections', subjectLabel: subject, targetUpn: null,
      required: protectionFields.length > 0, readinessKey: 'protection', readinessKeys: ['protection'], evidence: protectionFields.length ? protectionFields.join(', ') : null, actionLabel: 'Open protection instructions',
      issueKeys: (step.configurationFindings ?? []).filter(finding => finding.key === 'protection').flatMap(finding => finding.items?.flatMap(item => item.issueKeys ?? []) ?? []),
      // The changes are the tile's facts; the procedure applies each value at the point of action.
      readinessFacts: resolution ? (profileCorrections.length ? profileCorrections : protectionFields.flatMap(field => { const value = fieldAction(field, targetValue(field), modelNames).replace(/\*\*/g, ''); return value ? [{ label: fieldLabel(field), value }] : [] })) : [],
      steps: [...(withheld && protectionFields.some(field => field === 'passkeyProfiles' || field.startsWith('keyRestrictions.')) ? [fillText(PR().withheldTask, { count: count(restriction.lockedOut.length, 'account') })] : []), 'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...protectionSteps, 'Return to IAMAI and select **Scan to update the plan**.'],
    },
  ]
  // The step opens on Prepare while it is the thing to do first: somebody would be
  // locked out, or somebody loses a passkey the change has not been made to yet.
  const prepareFirst = withheld || (restriction.stranded.length > 0 && protectionFields.length > 0)
  return { tasks, printAll: true, approvedModels: intendedModels, ...(prepareFirst ? { recommendedTaskId: 'prepare-affected-passkeys' } : {}) }
}

type PasskeyRestrictionWords = { stranded: string; strandedAfter: string; strandedAfterLocked: string; withheld: string; withheldTask: string; keptMany: string; unreadAlso: string }
const PR = (): PasskeyRestrictionWords => (shared as unknown as { passkeyRestrictions: PasskeyRestrictionWords }).passkeyRestrictions

/** Accounts by sign-in name, the first NAMES_INLINE of them, the rest counted. */
function namedAccounts(ids: readonly string[], ctx: StepVarContext): string {
  const shown = ids.slice(0, NAMES_INLINE).map(id => `**${upnOf(ctx, id)}**`)
  return list(ids.length > NAMES_INLINE ? [...shown, `${ids.length - NAMES_INLINE} more`] : shown)
}

/**
 * The accounts the planned allow list would leave without a passkey it allows,
 * named, with what each keeps — or, where one would keep nothing, why the
 * restrictions are not handed over. The step said "IAMAI could not tell whether
 * the planned settings affect the passkeys on 11 accounts… Check those before
 * applying restrictions" over a Save that applied them, naming none (Jordan
 * D13), and said "before applying restrictions" still after they were applied
 * (Marcus D8).
 */
export function strandedSentence(r: PasskeyRestrictionReading, ctx: StepVarContext, beforeChange: boolean): string {
  // Before the change, an account the list would lock out withholds it. After it
  // — the tenant applied the restrictions — "stay off for now" is not true, and
  // "each keeps …" is not true of an account with no other confirmed way in: the
  // step says to check each one now.
  if (r.lockedOut.length > 0 && !beforeChange) return fillText(PR().strandedAfterLocked, { count: count(r.stranded.length, 'account'), names: namedAccounts(r.stranded, ctx) })
  if (r.lockedOut.length > 0) return fillText(PR().withheld, { count: count(r.lockedOut.length, 'account'), names: namedAccounts(r.lockedOut, ctx) })
  const methods = [...new Set(r.keeps.map(k => methodName(k.method === 'phone' ? 'mobilephone' : k.method)))]
  const kept = methods.length === 1 ? methods[0] : fillText(PR().keptMany, { methods: list(methods) })
  return fillText(beforeChange ? PR().stranded : PR().strandedAfter, { count: count(r.stranded.length, 'account'), names: namedAccounts(r.stranded, ctx), kept })
}
