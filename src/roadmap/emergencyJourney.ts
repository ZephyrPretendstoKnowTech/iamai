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
import { affectedPasskeysByProposedChange, emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility } from './passkeyCompatibility.ts'
import { latestRecoveryTest, recoveryAccountBasis, recoveryCandidateReadings, recoveryPreparation } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'
import { exclusionGroupPolicySafety } from '../validation/report.ts'

export const EMERGENCY_ACCOUNTS = 's-prereq-break-glass'
export const EMERGENCY_GROUP = 's-prereq-exclusion-group'
export const PASSKEY_SETTINGS = 's-prereq-passkey-settings'
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
        outcome: reason === 'newKey' || reason === 'modelRestricted' || reason === 'proposedModelRestricted' ? 'fail' as const : 'unknown' as const,
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
    key: 'availability',
    label: 'Method Availability',
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
  if (reading.resolution?.kind === 'target') protection.items.push({ label: 'Planned attestation', factLabel: 'Planned attestation', value: reading.resolution.target.isAttestationEnforced === true ? 'Required' : reading.resolution.target.isAttestationEnforced === false ? 'Off' : 'Could not verify', subjectId: 'planned-attestation', outcome: typeof reading.resolution.target.isAttestationEnforced === 'boolean' ? 'pass' : 'unknown' })
  const protectionProblems = (protection.items ?? []).filter(item => item.outcome !== 'pass')
  protection.value = protectionProblems.length === 0 ? 'Configured'
    : protectionProblems.every(item => item.factLabel === 'Current attestation' && item.value === 'Disabled') ? 'Attestation off'
      : protectionProblems.every(item => item.outcome === 'unknown') ? 'Could not verify'
        : 'Needs attention'
  const affected = affectedPasskeysByProposedChange(snapshot, mapping, groups)
  const affectedFinding: ConfigurationFinding = {
    key: 'affected-passkeys',
    label: 'Existing Passkeys Affected',
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
    protection,
    models,
    affectedFinding,
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
  const choice: ConfigurationFinding = { key: 'group-choice', label: 'Group Configuration', value: selected ? 'Verified' : 'Choose a group', detail: selected ? '' : 'A detected group is a suggestion until it is selected and saved.', outcome: selected ? 'pass' : 'unknown', items: name ? [{ label: 'Selection', factLabel: 'Selection', value: selected ? 'Saved' : 'Suggested', subjectId: groupId ?? 'group-choice', subjectLabel: name, outcome: selected ? 'pass' : 'unknown', issueKeys: ['group:choice'] }] : [], taskSafe: false }
  if (!report) return [choice, { key: 'group-members', label: 'Emergency Account Membership', value: 'Not verified', detail: 'Save the group choice and select the emergency accounts so the scan can verify its membership.', outcome: 'unknown', link: link(EMERGENCY_ACCOUNTS, 'Open Emergency Access Accounts') }, { key: 'group-policies', label: 'Policy Exclusions', value: 'Not verified', detail: 'Scan the tenant to verify every applicable policy excludes the selected group.', outcome: 'unknown' }]
  const results = report.targets.flatMap(target => target.results)
  const groupSubject = groupId ?? 'group-choice'
  const groupReading = groupId ? groups?.get(groupId) ?? [...(groups ?? [])].find(([id]) => id.toLowerCase() === groupId.toLowerCase())?.[1] : undefined
  const settingLabels: Record<string, string> = { 'xg.notDynamic': 'Membership type', 'xg.notMailEnabled': 'Mail enabled' }
  const settings = reportFinding(report, 'group-settings', 'Group Settings', r => ['xg.notDynamic', 'xg.notMailEnabled'].includes(r.id), 'Verified')
  choice.items = [
    ...(choice.items ?? []),
    { label: 'Group type', factLabel: 'Group type', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: groupReading?.securityEnabled === true ? 'Security' : groupReading?.securityEnabled === false ? 'Microsoft 365' : 'Could not verify', outcome: groupReading?.securityEnabled === true ? 'pass' as const : groupReading?.securityEnabled === false ? 'fail' as const : 'unknown' as const, issueKeys: ['group:securityEnabled'] },
    { label: 'Security enabled', factLabel: 'Security enabled', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: groupReading?.securityEnabled === true ? 'Yes' : groupReading?.securityEnabled === false ? 'No' : 'Could not verify', outcome: groupReading?.securityEnabled === true ? 'pass' as const : groupReading?.securityEnabled === false ? 'fail' as const : 'unknown' as const, issueKeys: ['group:securityEnabled'] },
    ...results.filter(result => ['xg.notDynamic', 'xg.notMailEnabled'].includes(result.id)).map(result => ({
      label: settingLabels[result.id], factLabel: settingLabels[result.id], subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group',
      value: result.outcome === 'pass' ? result.id === 'xg.notDynamic' ? 'Assigned security group' : 'No' : result.outcome === 'unknown' ? 'Could not verify' : result.finding || 'Needs a change',
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
    key: 'group-members', label: 'Emergency Account Membership', value: memberPending.some(result => result.outcome === 'fail') ? 'Needs attention' : memberPending.length ? 'Could not verify' : 'Membership verified',
    outcome: memberPending.some(result => result.outcome === 'fail') ? 'fail' : memberPending.length ? 'unknown' : 'pass', detail: '',
    items: [
      { label: 'Member count', factLabel: 'Member count', subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: groupReading && Number.isFinite(groupReading.memberCount) ? String(groupReading.memberCount) : 'Could not verify', outcome: groupReading && Number.isFinite(groupReading.memberCount) ? 'pass' as const : 'unknown' as const, issueKeys: ['group:memberCount'] },
      ...memberResults.map(result => ({ label: memberLabels[result.id], factLabel: memberLabels[result.id], subjectId: groupSubject, subjectLabel: name || groupId || 'Selected group', value: result.outcome === 'pass' ? result.id === 'xg.containsEmergency' ? 'All present' : result.id === 'xg.sizeReasonable' ? result.finding || 'Verified' : 'None' : result.outcome === 'unknown' ? 'Could not verify' : result.finding || 'Needs a change', outcome: result.outcome, issueKeys: [`group:${result.id}`] })),
    ],
  }
  const policies = reportFinding(report, 'group-policies', 'Policy Exclusions', r => r.id === 'xg.usedConsistently', 'Required references present', true)
  policies.detail = ''
  if (groupId && snapshot?.config.caPolicies.status === 'ok') {
    const rows = snapshot.config.caPolicies.rows as { displayName?: string; id?: string; state?: string; conditions?: { users?: { excludeGroups?: string[] } } }[]
    policies.items = rows.filter(p => p.state !== 'disabled').flatMap(p => [{
      label: 'Mode', factLabel: 'Mode', subjectId: p.id || p.displayName || 'unknown-policy', subjectLabel: p.displayName || p.id || 'Unnamed policy',
      value: p.state === 'enabled' ? 'On' : p.state === 'enabledForReportingButNotEnforced' ? 'Report-only' : 'Could not verify', outcome: p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced' ? 'pass' as const : 'unknown' as const,
      issueKeys: [`group-policy:${p.id || 'unknown'}:mode`],
    }, {
      label: 'Group exclusion', factLabel: 'Group exclusion', subjectId: p.id || p.displayName || 'unknown-policy', subjectLabel: p.displayName || p.id || 'Unnamed policy',
      value: p.conditions?.users?.excludeGroups?.some(id => id.toLowerCase() === groupId.toLowerCase()) ? 'Present' : 'Missing', outcome: p.conditions?.users?.excludeGroups?.some(id => id.toLowerCase() === groupId.toLowerCase()) ? 'pass' as const : 'fail' as const,
      issueKeys: [`group-policy:${p.id || 'unknown'}:exclusion`],
    }])
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
  const ids = mapping.breakGlassUserIds
  const basis = recoveryAccountBasis(snapshot, ids, mapping, groups)
  const signIns = ids.map(id => {
    const configuredAt = recoveryPreparation(id, records, now, basis[id], snapshot.tenantId)?.configurationObservedAt ?? null
    const readings = recoveryCandidateReadings(snapshot, id, now, configuredAt)
    const qualifying = readings.filter(reading => reading.qualifies)
    const source = snapshot.sources.signInEvidence
    const unavailable = source?.status !== 'ok'
    const coveredWindow = source?.coveredWindow
    const candidateReason = (readings[0]?.reason ?? '').replace(/[.]$/, '') || 'No qualifying event observed'
    return { label: accountLabel(snapshot, id), value: qualifying.length ? `${qualifying.length} qualifying event${qualifying.length === 1 ? '' : 's'} available` : unavailable ? `Could not verify: ${source?.reason ?? source?.status ?? 'sign-in logs unread'}` : candidateReason, coverage: coveredWindow?.from && coveredWindow.to ? `${coveredWindow.from.slice(0, 10)} to ${coveredWindow.to.slice(0, 10)}` : 'Could not verify', observed: qualifying.length > 0 }
  })
  const tests = ids.map(id => {
    const configuredAt = recoveryPreparation(id, records, now, basis[id], snapshot.tenantId)?.configurationObservedAt ?? null
    const readings = recoveryCandidateReadings(snapshot, id, now, configuredAt)
    const date = basis[id] ? latestRecoveryTest(id, records, now, basis[id], { readings, tenantId: snapshot.tenantId, currentSnapshotObservedAt: snapshot.asOf }) : null
    const current = !!date && Date.parse(now) - Date.parse(date) <= BREAK_GLASS_DRILL_DAYS * 86400000
    const latest = records.filter(r => r.cleanup === 'drill' && r.accountIds?.includes(id)).sort((a,b) => b.at.localeCompare(a.at))[0]
    const value = current ? `Passed · ${date!.slice(0, 10)}`
      : !basis[id] ? 'Unavailable: current configuration could not be verified'
        : latest?.outcome === 'failed' ? `Failed${latest.date ? ` · ${latest.date.slice(0, 10)}` : ''}`
          : latest?.outcome === 'passed' ? (latest.date && Date.parse(now) - Date.parse(latest.date) > BREAK_GLASS_DRILL_DAYS * 86400000 ? `Expired · ${latest.date.slice(0, 10)}` : 'No longer current: evidence or configuration changed')
            : 'Not recorded'
    return { label: accountLabel(snapshot, id), value, current }
  })
  const custody = report.targets.flatMap(t => t.results).find(r => r.id === 'bg.credentialStorage')
  const configurationParts = [accounts, exclusions, method]
  const configurationOutcome = configurationParts.some(f => f.outcome === 'fail') ? 'fail' : configurationParts.some(f => f.outcome === 'unknown') ? 'unknown' : 'pass'
  const confirmationPassed = ids.length > 0 && tests.every(r => r.current) && custody?.outcome === 'pass'
  const signInsPassed = ids.length > 0 && signIns.every(r => r.observed)
  const ownerRows = configurationParts.flatMap<ConfigurationFindingItem>(finding => {
    if (finding.outcome === 'pass') return finding === accounts ? [{ label: 'Account identity', factLabel: 'Account identity', value: 'Verified', outcome: 'pass' as const }] : []
    const rows = (finding.items ?? []).filter(item => item.outcome !== 'pass')
    return (rows.length ? rows : [{ label: finding.label, value: finding.value, outcome: finding.outcome }]).map(item => {
      const owner = finding === accounts ? link(EMERGENCY_ACCOUNTS, 'Review account preparation')
        : finding === exclusions ? link(EMERGENCY_GROUP, 'Review emergency exclusions')
          : item.factLabel === 'Applicable profile' ? link(PASSKEY_SETTINGS, 'Review intended passkey settings')
            : link(EMERGENCY_ACCOUNTS, 'Review prepared passkeys')
      return { ...item, ...(item.accountId ? { subjectLabel: accountLabel(snapshot, item.accountId) } : {}), link: owner }
    })
  })
  const configuration: ConfigurationFinding = {
    key: 'recovery-configuration', label: 'Configuration',
    value: configurationOutcome === 'pass' ? 'Verified' : configurationOutcome === 'fail' ? 'Correction required' : 'Not fully verified',
    outcome: configurationOutcome,
    detail: '',
    items: ownerRows,
  }
  const signInFinding: ConfigurationFinding = { key: 'recovery-sign-ins', label: 'Sign-in evidence', value: !ids.length ? 'Select emergency accounts' : signInsPassed ? 'Qualifying events available' : 'Evidence needed', outcome: signInsPassed ? 'pass' : 'unknown', detail: '', items: signIns.flatMap(({label, value, coverage, observed}, index) => [
    { label: 'Matching event', factLabel: 'Matching event', value, subjectId: ids[index], subjectLabel: label, accountId: ids[index], outcome: observed ? 'pass' as const : 'unknown' as const, issueKeys: [`recovery-sign-in:${ids[index].toLowerCase()}`] },
    { label: 'Logs checked', factLabel: 'Logs checked', value: coverage, subjectId: ids[index], subjectLabel: label, accountId: ids[index], outcome: coverage === 'Could not verify' ? 'unknown' as const : 'pass' as const },
  ]) }
  const confirmation: ConfigurationFinding = { key: 'recovery-confirmation', label: 'Verification Results', value: confirmationPassed ? 'Passed' : 'Verification needed', outcome: confirmationPassed ? 'pass' : configurationOutcome === 'fail' ? 'fail' : 'unknown', detail: '', items: [...tests.map(({label, value, current}, index) => ({ label: 'Result', factLabel: 'Result', value, subjectId: ids[index], subjectLabel: label, accountId: ids[index], outcome: current ? 'pass' as const : 'unknown' as const, issueKeys: [`recovery-result:${ids[index].toLowerCase()}`] })), { label: 'Credential storage', factLabel: 'Credential storage', value: custody?.outcome === 'pass' ? 'Recorded' : 'Not recorded', outcome: custody?.outcome === 'pass' ? 'pass' as const : 'unknown' as const }] }
  const verified = configurationOutcome === 'pass' && signInsPassed && confirmationPassed
  confirmation.value = verified ? 'Passed' : confirmation.value
  return [
    configuration,
    signInFinding,
    confirmation,
  ]
}
