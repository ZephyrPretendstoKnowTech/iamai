// Shared readings for the connected recovery steps. These project collected
// evidence and validation results; they never turn an unread fact into a pass.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { GroupMembers } from '../coverage/population.ts'
import type { SubjectReport } from '../validation/report.ts'
import { SET_LEVEL } from '../validation/report.ts'
import { ruleText } from '../validation/rules.ts'
import type { RuleResult } from '../validation/rules.ts'
import type { ConfigurationFinding } from './types.ts'
import { assignedPasskeyProfiles, passkeyFindingsOf, passkeyReadingOf, requiredModels } from './passkeySettings.ts'
import { emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility } from './passkeyCompatibility.ts'
import { latestRecoveryTest, recoveryAccountBasis, recoveryCandidateReadings, recoveryPreparation } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'

export const EMERGENCY_ACCOUNTS = 's-prereq-break-glass'
export const EMERGENCY_GROUP = 's-prereq-exclusion-group'
export const PASSKEY_SETTINGS = 's-prereq-passkey-settings'
export const RECOVERY_DRILL = 'cleanup-drill'
const link = (id: string, label: string) => ({ href: '#/plan/' + id, label })
const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
const accountLabel = (snapshot: TenantSnapshot, id: string): string => {
  const user = snapshot.users.find(u => u.id === id)
  const name = user?.displayName?.trim()
  const upn = user?.userPrincipalName?.trim()
  return name && upn && name.toLowerCase() !== upn.toLowerCase() ? `${name} — ${upn}` : name || upn || id
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
  newKey: 'No registered passkey was found. Register a security key from the approved recovery models.',
  modelRestricted: 'No readable registered key is allowed by the applicable passkey settings.',
  proposedModelRestricted: 'The registered key does not meet the intended device-bound model restrictions. Prepare an approved replacement before tightening restrictions.',
  membershipUnread: 'Group membership was not fully read; the applicable passkey settings are unknown.',
  methodsUnread: 'Registered authentication methods were not read.',
  modelsUnread: 'The key model, storage type or applicable restrictions were not fully read.',
  profileOrPartial: 'The assigned passkey profiles were not fully read.',
  policyUnread: 'Passkey configuration was not read.',
}

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
    const reasons = [...new Set(checks.filter(c => c.state !== 'eligible').map(c => METHOD_REASON[c.reason] || 'Check the applicable settings and registered recovery key.'))]
    return {
      label: accountLabel(snapshot, id),
      value: [ready ? 'Compatible with current and intended settings.' : failed ? 'Recovery method needs correction.' : 'Compatibility not established.', ...details, ...reasons].join(' '),
      outcome: ready ? 'pass' as const : failed ? 'fail' as const : 'unknown' as const,
    }
  })
  return {
    key: 'recovery-methods', label: 'Emergency Recovery Methods',
    value: !ids.length ? 'Select emergency accounts' : results.every(r => r.outcome === 'pass') ? 'Compatible keys registered' : results.some(r => r.outcome === 'fail') ? 'Replacement or settings correction needed' : 'Compatibility not established',
    outcome: !ids.length ? 'unknown' : results.some(r => r.outcome === 'fail') ? 'fail' : results.some(r => r.outcome === 'unknown') ? 'unknown' : 'pass',
    detail: !ids.length ? 'Select the emergency accounts so IAMAI can compare their registered keys with these settings. Review the approved recovery models before registering a key.' : 'Resolve the listed account findings before tightening restrictions. A registered compatible key still needs a recovery sign-in test.',
    items: results.map(({ label, value }) => ({ label, value })),
    link: link(EMERGENCY_ACCOUNTS, 'Open Emergency Access Accounts'),
  }
}

export function journeyPasskeyFindings(snapshot: TenantSnapshot, mapping: MappingState, groups?: GroupMembers): ConfigurationFinding[] {
  const raw = passkeyFindingsOf(snapshot, mapping)
  const reading = passkeyReadingOf(snapshot, mapping)
  if (reading.resolution?.kind === 'review' && reading.resolution.review === 'partialRead') {
    raw.push({ key: 'read', label: 'Required settings', outcome: 'unknown', value: 'Not fully read', detail: reading.resolution.subjects.join(', ') + '. Scan again before changing restrictions.' })
  }
  const grouped = (key: string, label: string, include: (f: typeof raw[number]) => boolean): ConfigurationFinding => {
    const rows = raw.filter(include)
    const problems = rows.filter(f => f.outcome !== 'pass')
    return { key, label, outcome: problems.some(f => f.outcome === 'fail') ? 'fail' : problems.length || !rows.length ? 'unknown' : 'pass',
      value: problems.length ? problems[0].value : rows.length ? 'Configured' : 'Not read', detail: '',
      items: rows.map(f => ({ label: f.label, value: f.value + '. ' + f.detail })),
    }
  }
  const models = grouped('models', 'Approved Authenticators', f => f.key.endsWith('.restrictions'))
  const modelProblems = raw.filter(f => (f.key.startsWith('authenticator.') || f.key.startsWith('target.')) && f.outcome !== 'pass')
  if (modelProblems.length && models.outcome === 'pass') { models.outcome = modelProblems.some(f => f.outcome === 'fail') ? 'fail' : 'unknown'; models.value = 'Required models need attention' }
  models.detail = 'Review the intended models before registering a passkey. Hardware keys listed for emergency recovery avoid dependence on an employee’s phone. Existing approved model IDs are retained; verify an unnamed model’s type before choosing it for recovery.'
  const modelStates = approvedPasskeyModels(snapshot, mapping).map(m => [...new Set(raw.filter(f => (f.key.startsWith('authenticator.') || f.key.startsWith('target.')) && f.detail.toLowerCase().includes(m.aaguid)).map(f => (f.key.startsWith('target.') ? f.detail.split(':')[0] + ': ' : '') + f.value))])
  const commonState = modelStates.length && modelStates.every(s => s.join('; ') === modelStates[0].join('; ')) ? modelStates[0].join('; ') : ''
  models.items = [
    ...(models.items ?? []),
    ...(commonState ? [{ label: 'All listed models', value: commonState }] : []),
    ...approvedPasskeyModels(snapshot, mapping).map((m, index) => {
      const states = commonState ? [] : modelStates[index]
      return { label: m.name, value: [m.aaguid, ...(m.source === 'existing' ? ['Existing tenant allowance retained during the transition'] : []), ...states].join(' · ') }
    }),
  ]
  return [
    grouped('availability', 'Passkey Availability', f => ['method', 'selfService', 'targets', 'exclusions', 'read'].includes(f.key) || f.key.startsWith('profiles.unread')),
    grouped('protection', 'Storage and Attestation', f => f.key.endsWith('.types') || f.key.endsWith('.attestation')),
    models,
    emergencyMethodFinding(snapshot, mapping, groups),
  ]
}

function reportFinding(report: SubjectReport, key: string, label: string, include: (r: RuleResult) => boolean, passed: string): ConfigurationFinding {
  const results = report.targets.flatMap(t => t.results.filter(include).map(r => ({ r, name: t.label })))
  const pending = results.filter(({ r }) => r.outcome !== 'pass')
  const shown = pending.length ? pending : results
  const byAccount = new Map<string, string[]>()
  for (const { r, name } of shown) {
    const label = SET_LEVEL.has(r.id) ? 'Selected accounts' : name || labelOfRule(r)
    const value = r.finding || (r.outcome === 'pass' ? '' : 'Not established: ') + ruleText(r.id).what
    const values = byAccount.get(label) ?? []
    const text = name && value.startsWith(name + ': ') ? value.slice(name.length + 2) : value
    const concise = /[.!?]$/.test(text) ? text : text + '.'
    if (!values.includes(concise)) values.push(concise)
    byAccount.set(label, values)
  }
  return {
    key, label, value: !results.length ? 'Not established' : pending.some(({ r }) => r.outcome === 'fail') ? 'Correction required' : pending.length ? 'Not fully verified' : passed,
    outcome: !results.length ? 'unknown' : pending.some(({ r }) => r.outcome === 'fail') ? 'fail' : pending.length ? 'unknown' : 'pass',
    detail: !results.length ? 'Select the intended accounts and scan to establish these checks.' : '',
    items: [...byAccount].map(([label, values]) => ({ label, value: values.join(' ') })),
  }
}

const labelOfRule = (r: RuleResult) => ruleText(r.id).what

const IDENTITY = new Set(['bg.count', 'bg.role.permanentGa', 'bg.cloudOnly', 'bg.initialDomain', 'bg.enabled', 'bg.notPersonal', 'bg.noLicenceNeeded', 'bg.nameIdentifiesPurpose'])
const EXCLUSIONS = new Set(['bg.excludedFromAllPolicies', 'bg.excludedFromReportOnly', 'bg.microsoftManaged', 'bg.notInDynamicScope'])
const AUTH = new Set(['bg.hasMfaMethod', 'bg.phishingResistant', 'bg.separateDevices', 'bg.methodDiversity', 'bg.perUserMfaOff'])

export function journeyAccountFindings(report: SubjectReport, snapshot: TenantSnapshot, mapping: MappingState, groups?: GroupMembers): ConfigurationFinding[] {
  const authentication = emergencyMethodFinding(snapshot, mapping, groups)
  authentication.link = link(PASSKEY_SETTINGS, 'Review approved passkey models and settings')
  const authChecks = reportFinding(report, 'auth-checks', '', r => AUTH.has(r.id), '')
  const authProblems = report.targets.flatMap(t => t.results).filter(r => AUTH.has(r.id) && r.outcome !== 'pass')
  if (authProblems.length) {
    authentication.items = [...(authentication.items ?? []), ...(authChecks.items ?? [])]
    if (authentication.outcome === 'pass') { authentication.outcome = authChecks.outcome; authentication.value = 'Recovery method correction required' }
  }
  const selection = reportFinding(report, 'account-selection', 'Account Selection', r => r.id === 'bg.count', 'Saved')
  const identity = reportFinding(report, 'account-setup', 'Identity and Roles', r => IDENTITY.has(r.id) && r.id !== 'bg.count', 'Verified')
  const custody = reportFinding(report, 'credential-custody', 'Credential Custody', r => r.id === 'bg.credentialStorage', 'Confirmed')
  return [selection, identity, authentication, custody]
}

export function journeyGroupFindings(report: SubjectReport | null | undefined, name: string | null, selected: boolean, snapshot?: TenantSnapshot, groupId?: string | null): ConfigurationFinding[] {
  const choice: ConfigurationFinding = { key: 'group-choice', label: 'Exclusions Group', value: name || 'Choose a group', detail: selected ? 'This is the saved group used in the plan’s policy exclusions.' : 'Confirm the intended group in the selector. A detected group is a suggestion until saved.', outcome: selected ? 'pass' : 'unknown' }
  if (!report) return [choice, { key: 'group-members', label: 'Emergency Account Membership', value: 'Not verified', detail: 'Save the group choice and select the emergency accounts so the scan can verify its membership.', outcome: 'unknown', link: link(EMERGENCY_ACCOUNTS, 'Open Emergency Access Accounts') }]
  const members = reportFinding(report, 'group-members', 'Emergency Account Membership', r => ['xg.containsEmergency', 'xg.membersApproved', 'xg.noExtraAdmins', 'xg.sizeReasonable'].includes(r.id), 'Selected accounts only')
  const settings = reportFinding(report, 'group-settings', 'Group Settings', r => ['xg.notDynamic', 'xg.notMailEnabled'].includes(r.id), 'Verified')
  const policies = reportFinding(report, 'group-policies', 'Policy Exclusions', r => r.id === 'xg.usedConsistently', 'Required references present')
  policies.detail = 'Correct missing exclusions on enabled policies now. Prepare Report-only references before enforcement; keep each policy’s current mode.'
  if (groupId && snapshot?.config.caPolicies.status === 'ok') {
    const rows = snapshot.config.caPolicies.rows as { displayName?: string; id?: string; state?: string; conditions?: { users?: { excludeGroups?: string[] } } }[]
    policies.items = rows.filter(p => p.state !== 'disabled').map(p => ({
      label: p.displayName || p.id || 'Unnamed policy',
      value: (p.state === 'enabled' ? 'On' : p.state === 'enabledForReportingButNotEnforced' ? 'Report-only' : 'Mode not read') + (p.conditions?.users?.excludeGroups?.some(id => id.toLowerCase() === groupId.toLowerCase()) ? ' · Group already excluded' : ''),
    }))
  }
  return [choice, settings, members, policies]
}

export function journeyRecoveryFindings(report: SubjectReport, snapshot: TenantSnapshot, mapping: MappingState, groups: GroupMembers | undefined, records: CleanupCheckpoint[], now: string): ConfigurationFinding[] {
  const accounts = reportFinding(report, 'recovery-accounts', 'Account Preparation', r => IDENTITY.has(r.id), 'Verified')
  accounts.link = link(EMERGENCY_ACCOUNTS, 'Review account preparation')
  const exclusions = reportFinding(report, 'recovery-exclusions', 'Policy Exclusions', r => EXCLUSIONS.has(r.id), 'Verified')
  exclusions.link = link(EMERGENCY_GROUP, 'Review emergency exclusions')
  const method = emergencyMethodFinding(snapshot, mapping, groups)
  method.link = link(PASSKEY_SETTINGS, 'Review intended passkey settings')
  const ids = mapping.breakGlassUserIds
  const basis = recoveryAccountBasis(snapshot, ids, mapping, groups)
  const signIns = ids.map(id => {
    const configuredAt = recoveryPreparation(id, records, now, basis[id], snapshot.tenantId)?.configurationObservedAt ?? null
    const readings = recoveryCandidateReadings(snapshot, id, now, configuredAt)
    const qualifying = readings.filter(reading => reading.qualifies)
    const source = snapshot.sources.signInEvidence
    const unavailable = source?.status !== 'ok'
    const coverage = source?.coveredWindow ? ` Coverage: ${source.coveredWindow.from.slice(0, 10)} to ${source.coveredWindow.to.slice(0, 10)}.` : ''
    return { label: accountLabel(snapshot, id), value: qualifying.length ? `${qualifying.length} qualifying event${qualifying.length === 1 ? '' : 's'} available. Choose the exact account, time and administrative resource below.` : unavailable ? `Sign-in logs could not be fully read: ${source?.reason ?? source?.status ?? 'unknown reason'}.${coverage}` : readings.length ? `${readings[0].reason}${coverage}` : `No qualifying interactive administrative passkey sign-in was found.${coverage} Sign in with the prepared credential, then scan again.`, observed: qualifying.length > 0 }
  })
  const tests = ids.map(id => {
    const configuredAt = recoveryPreparation(id, records, now, basis[id], snapshot.tenantId)?.configurationObservedAt ?? null
    const readings = recoveryCandidateReadings(snapshot, id, now, configuredAt)
    const date = basis[id] ? latestRecoveryTest(id, records, now, basis[id], { readings, tenantId: snapshot.tenantId, currentSnapshotObservedAt: snapshot.asOf }) : null
    const current = !!date && Date.parse(now) - Date.parse(date) <= BREAK_GLASS_DRILL_DAYS * 86400000
    const latest = records.filter(r => r.cleanup === 'drill' && r.accountIds?.includes(id)).sort((a,b) => b.at.localeCompare(a.at))[0]
    return { label: accountLabel(snapshot, id), value: current ? 'Passed · ' + date!.slice(0, 10) : !basis[id] ? 'Current configuration could not be verified; any saved result is retained.' : latest?.outcome === 'failed' ? 'Latest recorded test failed. Correct the cause and repeat the test.' : 'A current passing recovery result is required.', current }
  })
  const custody = report.targets.flatMap(t => t.results).find(r => r.id === 'bg.credentialStorage')
  const configurationParts = [accounts, exclusions, method]
  const configurationOutcome = configurationParts.some(f => f.outcome === 'fail') ? 'fail' : configurationParts.some(f => f.outcome === 'unknown') ? 'unknown' : 'pass'
  const confirmationPassed = ids.length > 0 && tests.every(r => r.current) && custody?.outcome === 'pass'
  const signInsPassed = ids.length > 0 && signIns.every(r => r.observed)
  const configuration: ConfigurationFinding = {
    key: 'recovery-configuration', label: 'Configuration',
    value: configurationOutcome === 'pass' ? 'Verified' : configurationOutcome === 'fail' ? 'Correction required' : 'Not fully verified',
    outcome: configurationOutcome,
    detail: 'Review account preparation, emergency exclusions and intended passkey settings in their owning steps before recording the final recovery result.',
    items: configurationParts.map(f => ({ label: f.label, value: `${f.value}${f.detail ? `. ${f.detail}` : ''}` })),
  }
  const signInFinding: ConfigurationFinding = { key: 'recovery-sign-ins', label: 'Successful Sign-ins', value: !ids.length ? 'Select emergency accounts' : signInsPassed ? 'Qualifying events available' : 'Evidence needed', outcome: signInsPassed ? 'pass' : 'unknown', detail: 'A qualifying event is successful, interactive, shows fresh passkey authentication and names a supported administrative resource. It does not identify an individual physical key or prove custody by itself.', items: signIns.map(({label, value}) => ({label, value})) }
  const confirmation: ConfigurationFinding = { key: 'recovery-confirmation', label: 'Recovery Confirmation', value: confirmationPassed ? 'Verified' : 'Verification needed', outcome: confirmationPassed ? 'pass' : 'unknown', detail: 'Use one result for the accounts tested on the same date with the same outcome. Passing means authorized credential retrieval, a fresh sign-in with the intended method and a successful non-destructive administrative check.', items: [...tests.map(({label, value}) => ({label, value})), { label: 'Credential custody', value: custody?.outcome === 'pass' ? 'Previously confirmed. Retrieve the credentials through that process for the drill.' : custody?.finding || 'Confirm the credentials and keys are held in the approved independent recovery locations.' }] }
  const verified = configurationOutcome === 'pass' && signInsPassed && confirmationPassed
  return [
    configuration,
    signInFinding,
    confirmation,
    { key: 'recovery-verification', label: 'Verification Status', value: verified ? 'Passed' : 'Not passed', outcome: verified ? 'pass' : configurationOutcome === 'fail' ? 'fail' : 'unknown', detail: verified ? 'Every current configuration check and account-specific recovery result is verified.' : 'Passed appears only after all configuration checks and every account-specific event-backed recovery result are current.' },
  ]
}
