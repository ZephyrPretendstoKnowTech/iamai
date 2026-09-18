// Shared readings for the connected recovery steps. These project collected
// evidence and validation results; they never turn an unread fact into a pass.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { SubjectReport } from '../validation/report.ts'
import { SET_LEVEL } from '../validation/report.ts'
import { ruleText } from '../validation/rules.ts'
import type { RuleResult } from '../validation/rules.ts'
import type { ConfigurationFinding, ConfigurationFindingItem } from './types.ts'
import { assignedPasskeyProfiles, passkeyFindingsOf, passkeyReadingOf, requiredModels } from './passkeySettings.ts'
import { affectedPasskeysByProposedChange, emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility, recoveryPasskeyCandidateSet } from './passkeyCompatibility.ts'
import { automaticRecoveryPreparationStates, latestRecoveryTest, recoveryAccountBasis, recoveryCandidateReadings, recoveryPreparation, recoveryEvidenceSource } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'
import { exclusionGroupPolicySafety } from '../validation/report.ts'

export const EMERGENCY_ACCOUNTS = 's-prereq-break-glass'
export const EMERGENCY_GROUP = 's-prereq-exclusion-group'
export const PASSKEY_SETTINGS = 's-prereq-passkey-settings'

function recoveryTime(iso: string, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
  try { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timeZone || 'UTC' }).format(new Date(iso)) }
  catch { return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(iso)) }
}
export const RECOVERY_DRILL = 'cleanup-drill'
const link = (id: string, label: string) => ({ href: '#/plan/' + id, label })
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
const accountLabel = (snapshot: TenantSnapshot, id: string): string => {
  const user = snapshot.users.find(u => u.id === id)
  const upn = user?.userPrincipalName?.trim()
  return upn || id
}
const MOBILE_MODELS = new Set(['90a3ccdf-635c-4729-a248-9b709135078f', 'de1e552d-db1d-4423-a619-566b625cdc84'])

export type ApprovedModel = { name: string; aaguid: string; source: 'plan' | 'existing'; recovery: boolean }
/** Existing explicit allow-list approvals are retained; registration is never approval. */
export function approvedPasskeyModels(snapshot: TenantSnapshot, mapping: MappingState): ApprovedModel[] {
  const models: ApprovedModel[] = requiredModels(mapping).map(m => ({ ...m, name: clean(m.name), source: 'plan', recovery: !MOBILE_MODELS.has(m.aaguid) }))
  const current = passkeyReadingOf(snapshot, mapping).current
  const restrictions = [current?.keyRestrictions, ...(current ? assignedPasskeyProfiles(current).profiles.map(p => p.keyRestrictions) : [])]
  for (const restriction of restrictions) {
    if (restriction?.isEnforced !== true || restriction.enforcementType !== 'allow' || !Array.isArray(restriction.aaGuids)) continue
    for (const raw of restriction.aaGuids) {
      if (typeof raw !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw)) continue
      const aaguid = raw.toLowerCase()
      if (!models.some(m => m.aaguid === aaguid)) models.push({ name: 'Existing approved model', aaguid, source: 'existing', recovery: false })
    }
  }
  return models
}

const METHOD_REASON: Record<string, string> = {
  disabled: 'Passkey authentication is disabled for this tenant.',
  excluded: 'The account is excluded from the Passkey (FIDO2) method. Conditional Access exclusions must not exclude it from the authentication method.',
  notTargeted: 'The account is not included in the Passkey (FIDO2) method.',
  newKey: 'No registered passkey was found. Register a passkey from the approved models.',
  modelRestricted: 'No readable registered key is allowed by the applicable passkey settings.',
  attestationRequired: 'The registered passkey does not have the attestation required by the applicable settings.',
  proposedModelRestricted: 'The registered key does not meet the intended device-bound model restrictions. Prepare an approved replacement before tightening restrictions.',
  membershipUnread: 'Group membership was not fully read; the applicable passkey settings are unknown.',
  methodsUnread: 'Registered authentication methods were not read.',
  modelsUnread: 'The key model, storage type or applicable restrictions were not fully read.',
  profileOrPartial: 'The assigned passkey profiles were not fully read.',
  policyUnread: 'Passkey configuration was not read.',
}

export const emergencyValidationIssueKey = (ruleId: string, target: string | null): string => `validation:${ruleId}:${target?.toLowerCase() ?? 'set'}`
export const emergencyMethodIssueKey = (accountId: string, phase: 'current' | 'planned', reason: string): string => `method:${accountId.toLowerCase()}:${phase}:${reason}`

export function emergencyMethodFinding(snapshot: TenantSnapshot, mapping: MappingState, groups: GroupMembers = new Map()): ConfigurationFinding {
  const ids = mapping.breakGlassUserIds
  const current = emergencyPasskeyCompatibility(snapshot, ids, groups)
  const intended = emergencyProposedPasskeyCompatibility(snapshot, ids, mapping, groups)
  const results = ids.map(id => {
    const now = current.find(c => c.accountId === id)!
    const next = intended.find(c => c.accountId === id)!
    const checks = [now, next]
    const failed = checks.some(c => c.state === 'excluded' || c.state === 'review')
    const ready = checks.every(c => c.state === 'eligible')
    const methods = snapshot.authMethods[id]
    const keys = Array.isArray(methods) ? methods.filter(m => m.kind === 'passkey' || m.kind === 'fido2') : []
    const details = keys.map(k => [clean(k.displayName || 'Registered passkey'), k.aaGuid || 'AAGUID not read', k.passkeyType || 'storage type not read'].join(' · ') + '.')
    const issueGroups = new Map<string, { value: string; issueKeys: string[] }>()
    for (const [phase, check] of [['current', now], ['planned', next]] as const) {
      if (check.state === 'eligible') continue
      const value = METHOD_REASON[check.reason] || 'Check the applicable settings and registered recovery key.'
      const group = issueGroups.get(check.reason) ?? { value, issueKeys: [] }
      group.issueKeys.push(emergencyMethodIssueKey(id, phase, check.reason))
      issueGroups.set(check.reason, group)
    }
    const reasons = [...issueGroups.values()].map(issue => issue.value)
    const label = accountLabel(snapshot, id)
    const items = [
      ...keys.flatMap((key, index) => [
        { label: 'Registered passkey', factLabel: 'Registered passkey', value: clean(key.displayName || `Passkey ${index + 1}`), accountId: id, subjectId: id, subjectLabel: label, outcome: 'pass' as const },
        { label: 'Authenticator model', factLabel: 'Authenticator model', value: key.aaGuid || 'Could not verify', accountId: id, subjectId: id, subjectLabel: label, outcome: key.aaGuid ? 'pass' as const : 'unknown' as const },
        { label: 'Storage type', factLabel: 'Storage type', value: key.passkeyType || 'Could not verify', accountId: id, subjectId: id, subjectLabel: label, outcome: key.passkeyType ? 'pass' as const : 'unknown' as const },
      ]),
      ...[...issueGroups.entries()].map(([reason, issue]) => ({
        label: reason === 'newKey' ? 'Registered passkey' : reason === 'methodsUnread' ? 'Registered methods' : reason === 'modelsUnread' ? 'Passkey evidence' : 'Applicable profile',
        factLabel: reason === 'newKey' ? 'Registered passkey' : reason === 'methodsUnread' ? 'Registered methods' : reason === 'modelsUnread' ? 'Passkey evidence' : 'Applicable profile',
        value: reason === 'newKey' ? 'Missing' : issue.value.replace(/[.]$/, ''),
        accountId: id, subjectId: id, subjectLabel: label,
        outcome: reason === 'newKey' || reason === 'modelRestricted' || reason === 'proposedModelRestricted' || reason === 'attestationRequired' ? 'fail' as const : 'unknown' as const,
        issueKeys: issue.issueKeys,
      })),
      ...(ready && keys.length === 0 ? [{ label: 'Compatibility', factLabel: 'Compatibility', value: 'Verified', accountId: id, subjectId: id, subjectLabel: label, outcome: 'pass' as const }] : []),
    ]
    return {
      label,
      value: [ready ? 'Compatible with current and intended settings.' : failed ? 'Recovery method needs correction.' : 'Compatibility not established.', ...details, ...reasons].join(' '),
      outcome: ready ? 'pass' as const : failed ? 'fail' as const : 'unknown' as const,
      items,
    }
  })
  return {
    key: 'recovery-methods', label: 'Emergency Recovery Methods',
    value: !ids.length ? 'Select emergency accounts' : results.every(r => r.outcome === 'pass') ? 'Verified' : results.some(r => r.outcome === 'fail') ? 'Needs attention' : 'Could not verify',
    outcome: !ids.length ? 'unknown' : results.some(r => r.outcome === 'fail') ? 'fail' : results.some(r => r.outcome === 'unknown') ? 'unknown' : 'pass',
    detail: !ids.length ? 'Select the emergency accounts so IAMAI can compare their registered keys with these settings. Review the approved recovery models before registering a key.' : 'Resolve the listed account findings before tightening restrictions. A registered compatible key still needs a recovery sign-in test.',
    items: results.flatMap(result => result.items),
    link: link(EMERGENCY_ACCOUNTS, 'Open Emergency Access Accounts'),
  }
}

export function journeyPasskeyFindings(snapshot: TenantSnapshot, mapping: MappingState, groups?: GroupMembers): ConfigurationFinding[] {
  const raw = passkeyFindingsOf(snapshot, mapping)
  const reading = passkeyReadingOf(snapshot, mapping)
  if (reading.resolution?.kind === 'review' && reading.resolution.review === 'partialRead') {
    raw.push({ key: 'read', label: 'Required settings', outcome: 'unknown', value: `Not fully read: ${reading.resolution.subjects.join(', ')}`, detail: reading.resolution.subjects.join(', ') + '. Scan again before changing restrictions.' })
  }
  const grouped = (key: string, label: string, include: (f: typeof raw[number]) => boolean): ConfigurationFinding => {
    const rows = raw.filter(include)
    const problems = rows.filter(f => f.outcome !== 'pass')
    return { key, label, outcome: problems.some(f => f.outcome === 'fail') ? 'fail' : problems.length || !rows.length ? 'unknown' : 'pass',
      value: problems.length ? problems[0].value : rows.length ? 'Configured' : 'Not read', detail: '',
      items: rows.map(f => ({ label: f.label, factLabel: f.label, value: f.value, subjectId: f.key, outcome: f.outcome, issueKeys: [`passkey:${f.key}`] })),
    }
  }
  const models = grouped('models', 'Approved Authenticators', f => f.key.endsWith('.restrictions'))
  models.items = (models.items ?? []).map(item => ({ ...item, factLabel: 'Current restriction' }))
  const modelProblems = raw.filter(f => (f.key.startsWith('authenticator.') || f.key.startsWith('target.')) && f.outcome !== 'pass')
  if (modelProblems.length && models.outcome === 'pass') { models.outcome = modelProblems.some(f => f.outcome === 'fail') ? 'fail' : 'unknown'; models.value = 'Required models need attention' }
  const modelIssueOutcomes = [...raw.filter(f => f.key.endsWith('.restrictions') && f.outcome !== 'pass'), ...modelProblems].map(f => f.outcome)
  models.value = !modelIssueOutcomes.length ? 'Configured'
    : modelIssueOutcomes.includes('fail') && modelIssueOutcomes.includes('unknown') ? 'Needs attention'
      : modelIssueOutcomes.includes('fail') ? 'Needs a change'
        : 'Could not verify'
  models.detail = ''
  const modelStates = approvedPasskeyModels(snapshot, mapping).map(m => [...new Set(raw.filter(f => (f.key.startsWith('authenticator.') || f.key.startsWith('target.')) && f.detail.toLowerCase().includes(m.aaguid)).map(f => (f.key.startsWith('target.') ? f.detail.split(':')[0] + ': ' : '') + f.value))])
  const commonState = modelStates.length && modelStates.every(s => s.join('; ') === modelStates[0].join('; ')) ? modelStates[0].join('; ') : ''
  const plannedRestriction = reading.resolution?.kind === 'target'
    ? reading.resolution.restriction === 'allow' ? 'Allow list' : reading.resolution.restriction === 'block' ? 'Block list' : 'Unrestricted'
    : null
  models.items = [
    ...(models.items ?? []),
    ...(commonState ? [{ label: 'Model coverage', factLabel: 'Model coverage', value: commonState, subjectId: 'passkey-restriction', outcome: models.outcome, issueKeys: ['passkey:restriction'] }] : []),
    ...(plannedRestriction ? [{ label: 'Planned restriction', factLabel: 'Planned restriction', value: plannedRestriction, subjectId: 'passkey-restriction', outcome: 'pass' as const }] : []),
    ...approvedPasskeyModels(snapshot, mapping).map((m, index) => {
      const states = commonState ? [] : modelStates[index]
      return { label: m.name, factLabel: 'AAGUID', subjectLabel: m.name, value: [m.aaguid, ...(m.source === 'existing' ? ['Existing tenant allowance retained'] : []), ...states].join(' · '), subjectId: `model:${m.aaguid}`, outcome: models.outcome, issueKeys: [`passkey:model:${m.aaguid}`] }
    }),
  ]
  const availabilityRows = raw.filter(f => ['method', 'selfService', 'targets', 'exclusions', 'read'].includes(f.key) || f.key.startsWith('profiles.unread'))
  const availability: ConfigurationFinding = {
    key: 'registration',
    label: 'Passkey Registration',
    value: availabilityRows.length && availabilityRows.every(f => f.outcome === 'pass') ? 'Configured' : availabilityRows.some(f => f.outcome === 'fail') ? 'Correction required' : 'Not fully verified',
    outcome: !availabilityRows.length ? 'unknown' : availabilityRows.some(f => f.outcome === 'fail') ? 'fail' : availabilityRows.some(f => f.outcome === 'unknown') ? 'unknown' : 'pass',
    detail: '',
    items: [
      ...availabilityRows.filter(f => !['targets', 'exclusions'].includes(f.key)).map(f => ({ label: f.label, factLabel: f.label, value: f.value, subjectId: f.key, outcome: f.outcome, issueKeys: [`passkey:${f.key}`] })),
      ...((reading.current && Array.isArray(reading.current.includeTargets) && reading.current.includeTargets.length) ? reading.current.includeTargets.map((target, index) => {
        const id = typeof target === 'object' && target !== null && typeof (target as { id?: unknown }).id === 'string' ? String((target as { id: string }).id) : ''
        return { label: 'Included target', factLabel: 'Included target', value: id ? id.toLowerCase() === 'all_users' ? 'All users' : id : 'Could not verify', subjectId: `include:${id || index}`, outcome: id ? 'pass' as const : 'unknown' as const, issueKeys: ['passkey:targets'] }
      }) : reading.current && Array.isArray(reading.current.includeTargets)
        ? [{ label: 'Included targets', factLabel: 'Included targets', value: 'None', subjectId: 'include:none', outcome: 'fail' as const, issueKeys: ['passkey:targets'] }]
        : [{ label: 'Included targets', factLabel: 'Included targets', value: 'Could not verify', subjectId: 'include:unknown', outcome: 'unknown' as const, issueKeys: ['passkey:targets'] }]),
      ...((reading.current && Array.isArray(reading.current.excludeTargets) && reading.current.excludeTargets.length) ? reading.current.excludeTargets.map((target, index) => {
        const id = typeof target === 'object' && target !== null && typeof (target as { id?: unknown }).id === 'string' ? String((target as { id: string }).id) : ''
        return { label: 'Excluded target', factLabel: 'Excluded target', value: id || 'Could not verify', subjectId: `exclude:${id || index}`, outcome: id ? 'pass' as const : 'unknown' as const, issueKeys: ['passkey:exclusions'] }
      }) : reading.current && Array.isArray(reading.current.excludeTargets)
        ? [{ label: 'Excluded targets', factLabel: 'Excluded targets', value: 'None', subjectId: 'exclude:none', outcome: 'pass' as const, issueKeys: ['passkey:exclusions'] }]
        : [{ label: 'Excluded targets', factLabel: 'Excluded targets', value: 'Could not verify', subjectId: 'exclude:unknown', outcome: 'unknown' as const, issueKeys: ['passkey:exclusions'] }]),
    ],
  }
  const protection = grouped('protection', 'Storage and Attestation', f => f.key.endsWith('.types') || f.key.endsWith('.attestation'))
  protection.items = (protection.items ?? []).map(item => ({ ...item, factLabel: item.factLabel === 'Passkey Attestation' ? 'Current attestation' : item.factLabel === 'Passkey Storage' ? 'Current storage' : item.factLabel }))
  const restrictionProblems = raw.filter(f => (f.key.endsWith('.restrictions') || f.key.startsWith('authenticator.') || f.key.startsWith('target.')) && f.outcome !== 'pass')
  protection.items.push(...restrictionProblems.map(f => ({ label: f.label, factLabel: f.label, value: f.value === 'AAGUID missing' ? 'Add the approved AAGUID to the allow list' : f.value, subjectId: f.key, outcome: f.outcome, issueKeys: [`passkey:${f.key}`] })))
  if (reading.resolution?.kind === 'target') {
    const profiles = Array.isArray(reading.resolution.target.passkeyProfiles) ? reading.resolution.target.passkeyProfiles as Record<string, unknown>[] : []
    const profileAttestationKnown = profiles.length > 0 && profiles.every(profile => profile?.attestationEnforcement === 'registrationOnly')
    const planned = typeof reading.resolution.target.isAttestationEnforced === 'boolean' ? reading.resolution.target.isAttestationEnforced : profileAttestationKnown ? true : null
    protection.items.push({ label: 'Planned attestation', factLabel: 'Planned attestation', value: planned === true ? 'Required' : planned === false ? 'Off' : 'Could not verify', subjectId: 'planned-attestation', outcome: typeof planned === 'boolean' ? 'pass' : 'unknown' })
  }
  const protectionProblems = (protection.items ?? []).filter(item => item.outcome !== 'pass')
  protection.value = protectionProblems.length === 0 ? 'Configured'
    : protectionProblems.every(item => item.factLabel === 'Current attestation' && item.value === 'Disabled') ? 'Attestation off'
      : protectionProblems.every(item => item.outcome === 'unknown') ? 'Could not verify'
        : 'Needs attention'
  protection.label = 'Passkey Protections'
  const protectionOutcomes = [protection.outcome, models.outcome, ...restrictionProblems.map(row => row.outcome)]
  protection.outcome = protectionOutcomes.includes('fail') ? 'fail' : protectionOutcomes.includes('unknown') ? 'unknown' : 'pass'
  protection.value = protection.outcome === 'pass' ? 'Configured' : protection.outcome === 'fail' ? 'Needs attention' : 'Could not verify'
  const affected = affectedPasskeysByProposedChange(snapshot, mapping, groups)
  const affectedFinding: ConfigurationFinding = {
    key: 'affected-passkeys',
    label: 'Existing passkeys affected',
    value: affected.users.length
      ? `${affected.users.length} ${affected.users.length === 1 ? 'user has' : 'users have'} a passkey that loses access`
      : affected.state === 'known'
        ? 'No existing passkeys were identified as losing sign-in access under this change.'
        : 'Could not verify',
    outcome: affected.users.length ? 'fail' : affected.state === 'known' ? 'pass' : 'unknown',
    detail: '',
    items: affected.users.length ? affected.users.flatMap(user => user.methods.map((method, index) => ({
      label: `Affected passkey ${index + 1}`, factLabel: `Affected passkey ${index + 1}`, accountId: user.accountId, subjectId: user.accountId, subjectLabel: accountLabel(snapshot, user.accountId),
      value: `${method.displayName} · ${method.aaguid ?? 'AAGUID could not be verified'} · ${method.passkeyType ?? 'Storage type could not be verified'}${user.hasCompatibleAlternative ? ' · Compatible alternative observed' : ''}`,
      outcome: 'fail' as const, issueKeys: [`passkey:affected:${user.accountId.toLowerCase()}`],
    }))) : affected.state === 'known' ? [] : [{ label: 'Impact', factLabel: 'Impact', value: affected.coverage.join(' ') || 'The applicable profile or registered-method evidence could not be read.', subjectId: 'affected-coverage', outcome: 'unknown' as const, issueKeys: ['passkey:affected:coverage'] }],
  }
  return [
    availability,
    affectedFinding,
    protection,
  ]
}

function reportFinding(report: SubjectReport, key: string, label: string, include: (r: RuleResult) => boolean, passed: string, preserveIssues = false): ConfigurationFinding {
  const results = report.targets.flatMap(t => t.results.filter(include).map(r => ({ r, name: t.label, target: typeof t.target === 'string' ? t.target : null })))
  const pending = results.filter(({ r }) => r.outcome !== 'pass')
  const shown = pending.length ? pending : results
  const byAccount = new Map<string, string[]>()
  for (const { r, name } of shown) {
    const itemLabel = SET_LEVEL.has(r.id) ? 'Selected accounts' : name || labelOfRule(r)
    const value = r.finding || (r.outcome === 'pass' ? '' : 'Not established: ') + ruleText(r.id).what
    const values = byAccount.get(itemLabel) ?? []
    const text = name && value.startsWith(name + ': ') ? value.slice(name.length + 2) : value
    const concise = /[.!?]$/.test(text) ? text : text + '.'
    if (!values.includes(concise)) values.push(concise)
    byAccount.set(itemLabel, values)
  }
  const issueItems = preserveIssues ? shown.flatMap(({ r, name, target }) => {
    const setLevel = SET_LEVEL.has(r.id)
    const value = r.finding || (r.outcome === 'pass' ? '' : 'Not established: ') + ruleText(r.id).what
    const text = name && value.startsWith(name + ': ') ? value.slice(name.length + 2) : value
    const concise = /[.!?]$/.test(text) ? text : text + '.'
    const issueKey = emergencyValidationIssueKey(r.id, setLevel ? null : target)
    return [{ label: setLevel ? 'Selected accounts' : name || labelOfRule(r), factLabel: labelOfRule(r), value: concise, ...(setLevel || !target ? {} : { accountId: target, subjectId: target, subjectLabel: name || target }), outcome: r.outcome, issueKeys: [issueKey] }]
  }).filter((item, index, rows) => rows.findIndex(other => other.issueKeys[0] === item.issueKeys[0] && other.value === item.value) === index) : null
  return {
    key, label, value: !results.length ? 'Not established' : pending.some(({ r }) => r.outcome === 'fail') ? 'Correction required' : pending.length ? 'Not fully verified' : passed,
    outcome: !results.length ? 'unknown' : pending.some(({ r }) => r.outcome === 'fail') ? 'fail' : pending.length ? 'unknown' : 'pass',
    detail: !results.length ? 'Select the intended accounts and scan to establish these checks.' : '',
    items: issueItems ?? [...byAccount].map(([label, values]) => ({ label, value: values.join(' ') })),
  }
}

const labelOfRule = (r: RuleResult) => ruleText(r.id).what

const IDENTITY = new Set(['bg.count', 'bg.role.permanentGa', 'bg.cloudOnly', 'bg.initialDomain', 'bg.enabled', 'bg.notPersonal', 'bg.noLicenceNeeded'])
const EXCLUSIONS = new Set(['bg.excludedFromAllPolicies', 'bg.excludedFromReportOnly', 'bg.microsoftManaged', 'bg.notInDynamicScope'])
const AUTH = new Set(['bg.hasMfaMethod', 'bg.phishingResistant', 'bg.separateDevices', 'bg.methodDiversity', 'bg.perUserMfaOff'])

export function journeyAccountFindings(report: SubjectReport, snapshot: TenantSnapshot, mapping: MappingState, groups?: GroupMembers): ConfigurationFinding[] {
  const authentication = emergencyMethodFinding(snapshot, mapping, groups)
  const authChecks = reportFinding(report, 'auth-checks', '', r => AUTH.has(r.id), '', true)
  const authProblems = report.targets.flatMap(t => t.results).filter(r => AUTH.has(r.id) && r.outcome !== 'pass')
  if (authProblems.length) {
    authentication.items = [...(authentication.items ?? []), ...(authChecks.items ?? [])]
    if (authentication.outcome === 'pass') { authentication.outcome = authChecks.outcome; authentication.value = 'Recovery method correction required' }
  }
  const identityResults = report.targets.flatMap(target => target.results.filter(result => IDENTITY.has(result.id)).map(result => ({ target, result })))
  const primaryLabels: Record<string, string> = { 'bg.role.permanentGa': 'Global Administrator', 'bg.cloudOnly': 'Identity', 'bg.initialDomain': 'Sign-in domain', 'bg.enabled': 'Account' }
  const identityItems = identityResults.flatMap(({ target, result }) => {
    if (SET_LEVEL.has(result.id)) return [{ label: 'Count', factLabel: 'Count', value: String(mapping.breakGlassUserIds.length), subjectId: 'selected-accounts', subjectLabel: 'Selected accounts', outcome: result.outcome, issueKeys: [emergencyValidationIssueKey(result.id, null)] }]
    const id = typeof target.target === 'string' ? target.target : null
    if (!id) return []
    const user = snapshot.users.find(row => row.id.toLowerCase() === id.toLowerCase())
    const factLabel = primaryLabels[result.id]
    if (!factLabel && result.outcome === 'pass') return []
    const value = result.outcome !== 'pass'
      ? result.finding || (result.outcome === 'unknown' ? 'Could not verify' : 'Needs a change')
      : result.id === 'bg.role.permanentGa' ? 'Permanent and active'
        : result.id === 'bg.cloudOnly' ? 'Cloud-only'
          : result.id === 'bg.initialDomain' ? user?.userPrincipalName?.split('@')[1] || 'Tenant initial domain'
            : result.id === 'bg.enabled' ? 'Enabled'
              : 'Verified'
    return [{ label: factLabel || labelOfRule(result), factLabel: factLabel || labelOfRule(result), value, accountId: id, subjectId: id, subjectLabel: accountLabel(snapshot, id), outcome: result.outcome, issueKeys: [emergencyValidationIssueKey(result.id, id)] }]
  })
  const identityPending = identityResults.filter(({ result }) => result.outcome !== 'pass')
  const identity: ConfigurationFinding = {
    key: 'account-setup', label: 'Accounts and Identity',
    value: identityPending.some(({ result }) => result.outcome === 'fail') ? 'Needs attention' : identityPending.length ? 'Could not verify' : 'Verified',
    outcome: identityPending.some(({ result }) => result.outcome === 'fail') ? 'fail' : identityPending.length ? 'unknown' : 'pass',
    detail: mapping.breakGlassUserIds.length ? '' : 'Select the intended accounts so IAMAI can evaluate their identity and role evidence.',
    items: identityItems,
  }
  for (const item of authChecks.items ?? []) if (item.accountId) item.label = accountLabel(snapshot, item.accountId)
  authentication.label = 'Prepared Passkeys'
  authentication.detail = 'Each selected account needs a registered approved passkey compatible with the current and planned settings.'
  return [identity, authentication]
}

export function journeyGroupFindings(report: SubjectReport | null | undefined, name: string | null, selected: boolean, snapshot?: TenantSnapshot, groupId?: string | null, groups?: GroupMembers): ConfigurationFinding[] {
  const choice: ConfigurationFinding = { key: 'group-choice', label: 'Exclusions group', value: selected ? 'Verified' : 'Choose an exclusions group', detail: selected ? '' : 'Select a group under Exclusions group, then Save. To create one, follow Create an emergency exclusions group in Implementation Tasks.', outcome: selected ? 'pass' : 'unknown', items: selected && name ? [{ label: 'Selection', factLabel: 'Selection', value: 'Saved', subjectId: groupId ?? 'group-choice', subjectLabel: name, outcome: 'pass', issueKeys: ['group:choice'] }] : [], taskSafe: false }
  if (!report) {
    if (selected) { choice.outcome = 'unknown'; choice.value = 'Could not verify'; choice.detail = 'IAMAI could not read the saved group for this scan. The saved selection has been kept.' }
    return [choice, { key: 'group-members', label: 'Emergency account membership', value: 'Not verified', detail: 'IAMAI could not read the selected group’s direct members. Membership has not been verified.', outcome: 'unknown' }, { key: 'group-policies', label: 'Policy exclusions', value: 'Not verified', detail: 'IAMAI could not verify the applicable policy exclusions for this scan.', outcome: 'unknown' }]
  }
  const results = report.targets.flatMap(target => target.results)
  const groupSubject = groupId ?? 'group-choice'
  const groupReading = groupId ? groups?.get(groupId) ?? [...(groups ?? [])].find(([id]) => id.toLowerCase() === groupId.toLowerCase())?.[1] : undefined
  const settingLabels: Record<string, string> = { 'xg.notDynamic': 'Dynamic membership', 'xg.notMailEnabled': 'Mail enabled' }
  const settings = reportFinding(report, 'group-settings', 'Group Settings', r => ['xg.notDynamic', 'xg.notMailEnabled'].includes(r.id), 'Verified')
  choice.items = [
    ...(choice.items ?? []),
    { label: 'Security group', factLabel: 'Security group', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: groupReading?.securityEnabled === true ? 'Verified' : groupReading?.securityEnabled === false ? 'Required' : 'Could not verify', outcome: groupReading?.securityEnabled === true ? 'pass' as const : groupReading?.securityEnabled === false ? 'fail' as const : 'unknown' as const, issueKeys: ['group:securityEnabled'] },
    { label: 'Assigned membership', factLabel: 'Assigned membership', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: !groupReading || !Array.isArray(groupReading.groupTypes) ? 'Could not verify' : groupReading.membershipRule || groupReading.groupTypes.some(type => type.toLowerCase() === 'dynamicmembership') ? 'Dynamic membership configured' : 'Verified', outcome: !groupReading || !Array.isArray(groupReading.groupTypes) ? 'unknown' as const : groupReading.membershipRule || groupReading.groupTypes.some(type => type.toLowerCase() === 'dynamicmembership') ? 'fail' as const : 'pass' as const, issueKeys: ['group:membershipRuleProcessingState'] },
    { label: 'Assigned licenses', factLabel: 'Assigned licenses', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: Array.isArray(groupReading?.assignedLicenseSkuIds) ? (groupReading!.assignedLicenseSkuIds!.length === 0 ? 'None' : String(groupReading!.assignedLicenseSkuIds!.length)) : 'Could not verify', outcome: Array.isArray(groupReading?.assignedLicenseSkuIds) ? (groupReading!.assignedLicenseSkuIds!.length === 0 ? 'pass' as const : 'fail' as const) : 'unknown' as const, issueKeys: ['group:assignedLicenses'] },
    ...results.filter(result => result.id === 'xg.notMailEnabled' && result.outcome !== 'pass').map(result => ({
      label: settingLabels[result.id], factLabel: settingLabels[result.id], subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group',
      value: result.outcome === 'pass' ? result.id === 'xg.notDynamic' ? 'Assigned security group · no licenses' : 'No' : result.outcome === 'unknown' ? 'Could not verify' : result.finding || 'Needs a change',
      outcome: result.outcome, issueKeys: [`group:${result.id}`],
    })),
  ]
  if (settings.outcome !== 'pass') { choice.outcome = settings.outcome; choice.value = settings.value; choice.detail = `${choice.detail} ${settings.detail}`.trim() }
  if (choice.items.some(item => item.outcome !== 'pass')) { choice.outcome = choice.items.some(item => item.outcome === 'fail') ? 'fail' : 'unknown'; choice.value = choice.outcome === 'fail' ? 'Needs attention' : 'Could not verify' }
  choice.taskSafe = exclusionGroupPolicySafety(report).safe
  const memberResults = results.filter(result => ['xg.containsEmergency', 'xg.membersApproved', 'xg.noExtraAdmins', 'xg.sizeReasonable'].includes(result.id))
  const memberLabels: Record<string, string> = { 'xg.containsEmergency': 'Selected emergency accounts', 'xg.membersApproved': 'Other members', 'xg.noExtraAdmins': 'Other active administrators', 'xg.sizeReasonable': 'Members' }
  const memberPending = memberResults.filter(result => result.outcome !== 'pass')
  const members: ConfigurationFinding = {
    key: 'group-members', label: 'Emergency account membership', value: memberPending.some(result => result.outcome === 'fail') ? 'Needs attention' : memberPending.length ? 'Could not verify' : 'Membership verified',
    outcome: memberPending.some(result => result.outcome === 'fail') ? 'fail' : memberPending.length ? 'unknown' : 'pass', detail: '',
    items: [
      { label: 'Direct member count', factLabel: 'Direct member count', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: groupReading?.directMembers === 'complete' ? String(groupReading.directMemberIds?.length ?? 0) : 'Could not verify', outcome: groupReading?.directMembers === 'complete' ? 'pass' as const : 'unknown' as const, issueKeys: ['group:memberCount'] },
      ...memberResults.map(result => ({ label: memberLabels[result.id], factLabel: memberLabels[result.id], subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: result.outcome === 'pass' ? result.id === 'xg.containsEmergency' ? 'All present' : result.id === 'xg.sizeReasonable' ? result.finding || 'Verified' : 'None' : result.outcome === 'unknown' ? 'Could not verify' : result.finding || 'Needs a change', outcome: result.outcome, issueKeys: [`group:${result.id}`] })),
    ],
  }
  const policies = reportFinding(report, 'group-policies', 'Policy exclusions', r => r.id === 'xg.usedConsistently', 'Required references present', true)
  policies.detail = ''
  if (groupId && snapshot?.config.caPolicies.status === 'ok') {
    const rows = snapshot.config.caPolicies.rows as { displayName?: string; id?: string; state?: string; conditions?: { users?: { excludeGroups?: string[] } } }[]
    policies.items = rows.filter(p => p.state !== 'disabled').flatMap(p => {
      const excluded = p.conditions?.users?.excludeGroups
      const exclusionKnown = Array.isArray(excluded)
      const present = exclusionKnown && excluded.some(id => id.toLowerCase() === groupId.toLowerCase())
      return [{
      label: 'Mode', factLabel: 'Mode', subjectId: p.id || p.displayName || 'unknown-policy', subjectLabel: p.displayName || p.id || 'Unnamed policy',
      value: p.state === 'enabled' ? 'On' : p.state === 'enabledForReportingButNotEnforced' ? 'Report-only' : 'Could not verify', outcome: p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced' ? 'pass' as const : 'unknown' as const,
      issueKeys: [`group-policy:${p.id || 'unknown'}:mode`],
    }, {
      label: 'Group exclusion', factLabel: 'Group exclusion', subjectId: p.id || p.displayName || 'unknown-policy', subjectLabel: p.displayName || p.id || 'Unnamed policy',
      value: !exclusionKnown ? 'Could not verify' : present ? 'Present' : 'Missing', outcome: !exclusionKnown ? 'unknown' as const : present ? 'pass' as const : 'fail' as const,
      issueKeys: [`group-policy:${p.id || 'unknown'}:exclusion`],
    }]
    })
    const pending = policies.items.filter(item => item.outcome !== 'pass')
    policies.outcome = pending.some(item => item.outcome === 'fail') ? 'fail' : pending.length ? 'unknown' : 'pass'
    policies.value = policies.outcome === 'fail' ? 'Needs attention' : policies.outcome === 'unknown' ? 'Could not verify' : 'Required references present'
  }
  return [choice, members, policies]
}

export function journeyRecoveryFindings(report: SubjectReport, snapshot: TenantSnapshot, mapping: MappingState, groups: GroupMembers | undefined, records: CleanupCheckpoint[], now: string): ConfigurationFinding[] {
  const accounts = journeyAccountFindings(report, snapshot, mapping, groups)[0]
  accounts.key = 'recovery-accounts'
  accounts.label = 'Account Preparation'
  accounts.link = link(EMERGENCY_ACCOUNTS, 'Review account preparation')
  const exclusions = reportFinding(report, 'recovery-exclusions', 'Policy Exclusions', r => EXCLUSIONS.has(r.id), 'Verified', true)
  exclusions.link = link(EMERGENCY_GROUP, 'Review emergency exclusions')
  const exclusionLabels: Record<string, string> = {
    'bg.excludedFromAllPolicies': 'Enabled policy exclusions',
    'bg.excludedFromReportOnly': 'Report-only policy exclusions',
    'bg.microsoftManaged': 'Microsoft-managed policy coverage',
    'bg.notInDynamicScope': 'Dynamic policy scope',
  }
  exclusions.items = (exclusions.items ?? []).map(item => {
    const issue = item.issueKeys?.[0]?.split(':')[1] ?? ''
    const value = item.value.replace(/^not excluded from /i, 'Missing from ').replace(/[.]$/, '')
    return { ...item, factLabel: exclusionLabels[issue] ?? item.factLabel, value }
  })
  const method = emergencyMethodFinding(snapshot, mapping, groups)
  const finalPolicy = journeyPasskeyFindings(snapshot, mapping, groups).filter(finding => finding.key === 'registration' || finding.key === 'protection')
  const ids = mapping.breakGlassUserIds
  const basis = recoveryAccountBasis(snapshot, ids, mapping, groups)
  const candidateSetBasis = Object.fromEntries(ids.flatMap(id => {
    const candidateSet = recoveryPasskeyCandidateSet(snapshot, id, mapping, groups)
    return candidateSet.state === 'complete' ? [[id, JSON.stringify([...candidateSet.ids].sort())]] : []
  }))
  const tests = ids.map(id => {
    const configuredAt = recoveryPreparation(id, records, now, basis[id], snapshot.tenantId)?.configurationObservedAt ?? null
    const readings = recoveryCandidateReadings(snapshot, id, now, configuredAt)
    const source = recoveryEvidenceSource(snapshot)
    const date = basis[id] ? latestRecoveryTest(id, records, now, basis[id], { readings, tenantId: snapshot.tenantId, currentSnapshotObservedAt: snapshot.asOf, signInSource: source, candidateSetBasis: candidateSetBasis[id] }) : null
    const current = !!date && Date.parse(now) - Date.parse(date) <= BREAK_GLASS_DRILL_DAYS * 86400000
    const verifiedAt = current ? recoveryTime(date!, mapping.displayTimeZone) : null
    const sourceFailure = source.status !== 'ok'
    const action = current ? 'Passkey sign-in verified'
      : sourceFailure ? 'IAMAI could not read the verification evidence'
        : 'Sign in with the prepared passkey'
    const value = current ? `Signed in after configuration: ${verifiedAt}`
      : sourceFailure ? source.reason ?? String(source.status)
        : 'Follow Verify emergency sign-in in Implementation Tasks. Then wait 5–10 minutes and scan to update the plan.'
    return { label: accountLabel(snapshot, id), action, value, current }
  })
  const configurationParts = [accounts, exclusions, method, ...finalPolicy]
  const preparationStates = automaticRecoveryPreparationStates(snapshot, mapping, groups ?? new Map())
  const stateValues = ids.map(id => preparationStates[id] ?? 'unread')
  const visibleConfigurationOutcome = configurationParts.some(f => f.outcome === 'fail') ? 'fail' : configurationParts.some(f => f.outcome === 'unknown') ? 'unknown' : 'pass'
  const configurationOutcome = visibleConfigurationOutcome === 'fail' || stateValues.includes('incorrect') ? 'fail' : visibleConfigurationOutcome === 'unknown' || stateValues.includes('unread') ? 'unknown' : 'pass'
  const confirmationPassed = ids.length > 0 && tests.every(r => r.current)
  const signInsPassed = ids.length > 0 && tests.every(r => r.current)
  const ownerRows = configurationParts.flatMap<ConfigurationFindingItem>(finding => {
    if (finding.outcome === 'pass') return []
    const rows = (finding.items ?? []).filter(item => item.outcome !== 'pass')
    return (rows.length ? rows : [{ label: finding.label, value: finding.value, outcome: finding.outcome }]).map(item => {
      const owner = finding === accounts ? link(EMERGENCY_ACCOUNTS, 'Review account preparation')
        : finding === exclusions ? link(EMERGENCY_GROUP, 'Review emergency exclusions')
          : finalPolicy.includes(finding) ? link(PASSKEY_SETTINGS, 'Review intended passkey settings')
          : item.factLabel === 'Applicable profile' ? link(PASSKEY_SETTINGS, 'Review intended passkey settings')
            : link(EMERGENCY_ACCOUNTS, 'Review prepared passkeys')
      return { ...item, ...(item.accountId ? { subjectLabel: accountLabel(snapshot, item.accountId) } : {}), link: owner }
    })
  })
  if (visibleConfigurationOutcome === 'pass' && configurationOutcome !== 'pass') ownerRows.push({
    label: 'Emergency exclusions group', factLabel: 'Emergency exclusions group',
    value: configurationOutcome === 'fail' ? 'The saved group or its membership is not suitable for emergency exclusions.' : 'The saved group or its membership could not be read completely.',
    outcome: configurationOutcome, link: link(EMERGENCY_GROUP, 'Review emergency exclusions'),
  })
  const seenOwnerLinks = new Set<string>()
  const pendingOwnerRows = ownerRows.map(item => {
    if (!item.link) return item
    const key = `${item.accountId ?? 'shared'}:${item.link.href}`
    if (seenOwnerLinks.has(key)) { const { link: _link, ...rest } = item; return rest }
    seenOwnerLinks.add(key)
    return item
  })
  const configuration: ConfigurationFinding = {
    key: 'recovery-configuration', label: 'Configuration',
    value: configurationOutcome === 'pass' ? 'Verified' : configurationOutcome === 'fail' ? 'Correction required' : 'Not fully verified',
    outcome: configurationOutcome,
    detail: '',
    items: pendingOwnerRows,
  }
  const showSignInRows = configurationOutcome === 'pass' || snapshot.sources.signInEvidence?.status !== 'ok'
  const signInFinding: ConfigurationFinding = { key: 'recovery-sign-ins', label: 'Sign-in evidence', value: !ids.length ? 'Select emergency accounts' : signInsPassed ? 'Verified' : 'Evidence needed', outcome: signInsPassed ? 'pass' : 'unknown', detail: '', items: showSignInRows ? tests.map(({ label, action, value, current }, index) => ({ label: action, factLabel: action, value, subjectId: ids[index], subjectLabel: label, accountId: ids[index], outcome: current ? 'pass' as const : 'unknown' as const, issueKeys: [`recovery-sign-in:${ids[index].toLowerCase()}`] })) : [] }
  const confirmation: ConfigurationFinding = { key: 'recovery-confirmation', label: 'Verification Results', value: confirmationPassed ? 'Passed' : 'Verification needed', outcome: confirmationPassed ? 'pass' : configurationOutcome === 'fail' ? 'fail' : 'unknown', detail: '', items: [] }
  const verified = configurationOutcome === 'pass' && signInsPassed && confirmationPassed
  confirmation.value = verified ? 'Passed' : confirmation.value
  return [
    configuration,
    signInFinding,
    confirmation,
  ]
}
