import { affectedPasskeysByProposedChange } from '../../roadmap/passkeyCompatibility.ts'
import { PASSKEY_TARGET, assignedPasskeyProfiles, passkeyReadingOf, samePasskeyValue } from '../../roadmap/passkeySettings.ts'
import { approvedPasskeyModels } from '../../roadmap/emergencyJourney.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection, EmergencyAccountTaskVariant } from './emergencyAccountTasks.ts'
import { emergencyRegistrationVariants, yubiKeySteps } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'
import { affectedByHandover, passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import type { PasskeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import { shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { count, list } from '../../copy/statements.ts'
import { methodName } from '../../copy/inventory.ts'
import { NAMES_INLINE } from './whoBlocks.ts'
import { EMERGENCY_TASK } from '../../roadmap/emergencyTaskTitles.ts'

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
    return [name]
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

const typeWords = (value: unknown): string => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(entry => String(entry).trim().toLowerCase()).filter(Boolean).map(entry => entry === 'devicebound' ? 'Device-bound' : entry === 'synced' ? 'Synced' : entry).join(', ')


const saved = (steps: string[]): string[] => steps.length && !/then \*\*Save\*\*\.$/.test(steps.at(-1)!) ? [...steps, 'Select **Save**.'] : steps

/**
 * One profile's values, in the order the profile page sets them: device-bound
 * passkeys with attestation enforced, for every user (owner, 2026-10-03). Its key
 * restrictions are the tenant's and are left as they are, so no line touches them.
 */
function profileSteps(targetRaw: unknown): string[] {
  const target = (targetRaw && typeof targetRaw === 'object' ? targetRaw : {}) as Record<string, any>
  const attested = target.attestationEnforcement === 'registrationOnly'
  return saved([
    `Set **Passkey types** to **${attested ? 'Device-bound' : typeWords(target.passkeyTypes)}**.`,
    `Set **Enforce attestation** to **${attested ? 'Yes' : 'No'}**.`,
    'Leave **Target specific AAGUIDs** as it is.',
  ])
}

/** The legacy (profile-less) configuration's value on its Configure tab: attestation; the key restrictions stay as they are. */
function legacySteps(target: Record<string, any>): string[] {
  return saved([`Set **Enforce attestation** to **${target.isAttestationEnforced === true ? 'Yes' : 'No'}**.`, 'Leave **Enforce key restrictions** as it is.'])
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
  // Who the change stops (a synced passkey under device-bound), and whether each
  // keeps another way to sign in (roadmap/passkeyRestrictions.ts): one reading
  // with the Existing passkeys affected card (affectedByHandover, F-036). The
  // active people and the emergency accounts, those with no other way in first.
  const restriction = passkeyRestrictionReading(ctx.snapshot, ctx.mapping, ctx.groups)
  const users = affectedByHandover(ctx.snapshot, ctx.mapping, affected, restriction)
  const locked = new Set(restriction.lockedOut.map(id => id.toLowerCase()))
  const kept = new Map(restriction.keeps.map(k => [k.accountId.toLowerCase(), k.method]))
  const affectedFacts = users.flatMap(user => user.methods.map(method => {
    const keeps = kept.get(user.accountId.toLowerCase())
    const after = locked.has(user.accountId.toLowerCase()) ? PR().factNoOtherWay
      : user.hasCompatibleAlternative ? PR().factOtherPasskey
        : keeps ? fillText(PR().factKeeps, { method: methodName(keeps === 'phone' ? 'mobilephone' : keeps) })
          : PR().factReplacement
    return {
      label: upnOf(ctx, user.accountId),
      value: `${method.displayName}${method.passkeyType ? ` · ${typeWords(method.passkeyType)}` : ''}${method.aaguid ? ` · ${method.aaguid}` : ''} · ${after}`,
    }
  }))
  const variants = normalRegistrationVariants()
  const customHardware = intendedModels.filter(model => model.source === 'plan' && model.recovery && !/yubikey/i.test(model.name))
  if (customHardware.length) variants.push({
    id: 'approved-hardware',
    label: 'Additional approved hardware key',
    facts: [...affectedFacts, ...customHardware.map(model => ({ label: model.name, value: `Replacement AAGUID: ${model.aaguid}` }))],
    steps: yubiKeySteps('the affected account', `approved hardware security key (${customHardware.map(model => `${model.name}, AAGUID ${model.aaguid}`).join('; ')})`).filter(line => !/Store the|Return to IAMAI/i.test(line)).map(line => line.replace('Microsoft Entra admin center', 'a normal work resource')),
  })
  const targetValue = (field: string): unknown => field === 'state' ? resolution?.target.state : field === 'includeTargets' ? resolution?.target.includeTargets : field === 'isSelfServiceRegistrationAllowed' ? resolution?.target.isSelfServiceRegistrationAllowed : field === 'isAttestationEnforced' ? resolution?.target.isAttestationEnforced : field === 'keyRestrictions.isEnforced' ? resolution?.target.keyRestrictions?.isEnforced : field === 'keyRestrictions.enforcementType' ? resolution?.target.keyRestrictions?.enforcementType : field === 'keyRestrictions.aaGuids' ? resolution?.target.keyRestrictions?.aaGuids : field === 'passkeyProfiles' ? resolution?.target.passkeyProfiles : undefined
  // Every task states the values it sets, in every state, a change needed or
  // not (owner, 2026-09-23): they read "Review … No save is required." once the
  // settings matched. The values are the resolved target's. Where the scan
  // resolves none (the settings unread, or a policy the step holds for review)
  // they are the plan's own: the pinned settings and the tenant's included
  // targets or All users. Key restrictions are the tenant's either way.
  const include = [resolution?.target.includeTargets, current?.includeTargets, PASSKEY_TARGET.includeTargets].map(displayTargets).find(words => words !== '' && words !== 'None')
  const registrationSteps = [
    `Set **Enable** to **${resolution?.target.state === 'disabled' ? 'Off' : 'On'}**.`,
    `Under **Include**, target **${include}**.`,
    `Set **Allow self-service set up** to **${resolution?.target.isSelfServiceRegistrationAllowed === false ? 'No' : 'Yes'}**.`,
  ]
  const assignedProfiles = profiles?.profiles ?? []
  const target = (resolution?.target ?? { ...PASSKEY_TARGET, keyRestrictions: current?.keyRestrictions ?? PASSKEY_TARGET.keyRestrictions }) as Record<string, any>
  const targetProfiles = resolution
    ? new Map((Array.isArray(target.passkeyProfiles) ? target.passkeyProfiles as unknown[] : []).flatMap(raw => raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).id === 'string' ? [[String((raw as Record<string, unknown>).id).toLowerCase(), raw] as const] : []))
    : new Map(assignedProfiles.map(profile => [profile.id.toLowerCase(), { ...profile, passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly' }] as const))
  const protectionSteps = assignedProfiles.length && targetProfiles.size
    ? assignedProfiles.flatMap(profile => [`Open **${clean(profile.name || profile.id)}**.`, ...profileSteps(targetProfiles.get(profile.id.toLowerCase()))])
    : ['Open **Configure**.', ...legacySteps(target)]
  // Prepare affected passkeys opens on what the scan found: the accounts the
  // planned settings would stop, or the affected accounts. The lines that said
  // IAMAI could not tell which passkeys the settings affect, or had not read
  // some accounts' methods, are gone (owner, 2026-09-23).
  const namedFromRead = restriction.stranded.length > 0
    ? strandedSentence(restriction, ctx, protectionFields.length > 0)
    : users.length
    ? `Keep the existing working method available while preparing each affected account: ${users.map(user => `**${upnOf(ctx, user.accountId)}**`).join(', ')}.`
      : null
  // With nobody named the procedure opens on what to keep, with no all-clear
  // and no qualifier about what the scan read (owner, 2026-09-23): the
  // Existing passkeys affected card says what it found.
  const prepareLead = namedFromRead ?? 'Keep the existing working method available while preparing an account.'
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'make-passkey-registration-available', accountId: null, title: EMERGENCY_TASK.passkeyRegistration, targetUpn: null,
      required: availabilityFields.length > 0, readinessKey: 'registration', evidence: availabilityFields.length ? availabilityFields.join(', ') : null, actionLabel: 'Open registration instructions',
      issueKeys: availabilityFields.map(field => `passkey:${field === 'state' ? 'method' : field === 'isSelfServiceRegistrationAllowed' ? 'selfService' : 'targets'}`),
      steps: ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Policies → Passkey (FIDO2) → Enable and target**.', ...registrationSteps, 'Select **Save**.', 'Return to IAMAI and select **Scan to update the plan**.'],
    },
    {
      id: 'prepare-affected-passkeys', accountId: null, title: EMERGENCY_TASK.affectedPasskeys, targetUpn: null,
      // Required while an account would be, or is, locked out; before the change also while
      // anyone's passkey would stop (they are told first). Once applied, an account that keeps
      // another way in is the card's to say, not work that holds the step (net-new 4).
      required: users.length > 0 || restriction.lockedOut.length > 0 || (protectionFields.length > 0 && restriction.stranded.length > 0), readinessKey: 'affected-passkeys', evidence: users.length ? `${users.length} user${users.length === 1 ? '' : 's'} confirmed affected.` : null, actionLabel: 'Open preparation instructions',
      issueKeys: users.map(user => `passkey:affected:${user.accountId.toLowerCase()}`), facts: affectedFacts, variants, defaultVariantId: variants[0].id,
      steps: [prepareLead, '**Someone who keeps another way in:** have them sign in with it once, in a separate browser session, so you know it works. Nothing else is needed before you save.', '**Someone with no other way in:** register a replacement device-bound passkey with the steps below before you save the change.', protectionFields.length > 0 ? 'Return to IAMAI and select **Scan to update the plan** before applying restrictions.' : 'Return to IAMAI and select **Scan to update the plan**.'],
    },
    {
      id: 'apply-passkey-settings', accountId: null, title: EMERGENCY_TASK.passkeyProtections, subjectLabel: subject, targetUpn: null,
      required: protectionFields.length > 0, readinessKey: 'protection', readinessKeys: ['protection'], evidence: protectionFields.length ? protectionFields.join(', ') : null, actionLabel: 'Open protection instructions',
      issueKeys: (step.configurationFindings ?? []).filter(finding => finding.key === 'protection').flatMap(finding => finding.items?.flatMap(item => item.issueKeys ?? []) ?? []),
      // The changes are the tile's facts; the procedure applies each value at the point of action.
      readinessFacts: resolution ? (profileCorrections.length ? profileCorrections : protectionFields.flatMap(field => { const value = fieldAction(field, targetValue(field), modelNames).replace(/\*\*/g, ''); return value ? [{ label: fieldLabel(field), value }] : [] })) : [],
      steps: [...(restriction.lockedOut.length > 0 && protectionFields.length > 0 ? [fillText(PR().lockedOutTask, { count: count(restriction.lockedOut.length, 'account') })] : []), 'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.', ...protectionSteps, 'Return to IAMAI and select **Scan to update the plan**.'],
    },
  ]
  // The step opens on Prepare while it is the thing to do first: somebody would be
  // locked out, or somebody loses a passkey the change has not been made to yet.
  const prepareFirst = restriction.lockedOut.length > 0 || (restriction.stranded.length > 0 && protectionFields.length > 0)
  return { tasks, printAll: true, approvedModels: intendedModels, ...(prepareFirst ? { recommendedTaskId: 'prepare-affected-passkeys' } : {}) }
}

type PasskeyRestrictionWords = { stranded: string; strandedAfter: string; strandedAfterLocked: string; lockedOut: string; lockedOutOne: string; lockedOutTask: string; keptMany: string; factNoOtherWay: string; factOtherPasskey: string; factKeeps: string; factReplacement: string }
const PR = (): PasskeyRestrictionWords => (shared as unknown as { passkeyRestrictions: PasskeyRestrictionWords }).passkeyRestrictions

/** Accounts by sign-in name, the first NAMES_INLINE of them, the rest counted. */
function namedAccounts(ids: readonly string[], ctx: StepVarContext): string {
  const shown = ids.slice(0, NAMES_INLINE).map(id => `**${upnOf(ctx, id)}**`)
  return list(ids.length > NAMES_INLINE ? [...shown, `${ids.length - NAMES_INLINE} more`] : shown)
}

/**
 * The accounts the change would leave without a passkey it allows (a synced
 * passkey under device-bound), named, with what each keeps — or, where one would
 * keep nothing, that the change locks it out unless it gets another way in first. The step said "IAMAI could not tell whether
 * the planned settings affect the passkeys on 11 accounts… Check those before
 * applying restrictions" over a Save that applied them, naming none (Jordan
 * D13), and said "before applying restrictions" still after they were applied
 * (Marcus D8).
 */
export function strandedSentence(r: PasskeyRestrictionReading, ctx: StepVarContext, beforeChange: boolean): string {
  // Before the change, an account it would lock out is named first, with what to
  // do. After it, "each keeps …" is not true of an account with no other
  // confirmed way in: the step says to check each one now.
  if (r.lockedOut.length > 0 && !beforeChange) return fillText(PR().strandedAfterLocked, { count: count(r.stranded.length, 'account'), names: namedAccounts(r.stranded, ctx) })
  if (r.lockedOut.length > 0) return fillText(r.lockedOut.length === 1 ? PR().lockedOutOne : PR().lockedOut, { count: count(r.lockedOut.length, 'account'), names: namedAccounts(r.lockedOut, ctx) })
  const methods = [...new Set(r.keeps.map(k => methodName(k.method === 'phone' ? 'mobilephone' : k.method)))]
  const kept = methods.length === 1 ? methods[0] : fillText(PR().keptMany, { methods: list(methods) })
  return fillText(beforeChange ? PR().stranded : PR().strandedAfter, { count: count(r.stranded.length, 'account'), names: namedAccounts(r.stranded, ctx), kept })
}
