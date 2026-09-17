import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

export function emergencyVerificationTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const tasks: EmergencyAccountTask[] = []
  const configurationReady = phase.recoveryFindings?.find(finding => finding.key === 'recovery-configuration')?.outcome === 'pass'
  if (configurationReady && phase.accountIds.some(id => !phase.configurationObservedAtByAccount?.[id])) tasks.push({
    id: 'start-verification', accountId: null, title: 'Start verification', targetUpn: null, required: true,
    readinessKey: 'recovery-configuration', evidence: 'The current readable configuration is ready, but no matching preparation checkpoint exists.', actionLabel: 'Open start instructions',
    issueKeys: ['recovery-configuration'], facts: [{ label: 'Configuration checkpoint', value: 'Not recorded' }],
    steps: ['Keep your working administrator session open.', 'In IAMAI, select **Start verification** under **Final verification**.', 'Open a separate private browser window for the emergency account.'],
  })
  for (const id of phase.accountIds) {
    if (!configurationReady) continue
    const upn = upnOf(phase, id)
    const prepared = phase.configurationObservedAtByAccount?.[id]
    const readings = phase.recoveryCandidates?.[id] ?? []
    const qualifying = prepared ? readings.filter(reading => reading.qualifies) : []
    if (prepared && !qualifying.length) tasks.push({
      id: `test-emergency-access:${id}`, accountId: id, title: 'Test emergency access', targetUpn: upn, required: true,
      readinessKey: 'recovery-sign-ins', evidence: readings[0]?.reason ?? 'No qualifying event is available after the current checkpoint.', actionLabel: 'Open test instructions',
      issueKeys: [`recovery-sign-in:${id.toLowerCase()}`], facts: [{ label: 'Matching event', value: readings[0]?.reason ?? 'No qualifying event observed' }],
      steps: ["Retrieve the account's approved recovery credential from its storage location.", 'In a separate private window, open **Microsoft Entra admin center**.', `Sign in as **${upn}** with the prepared passkey.`, 'Confirm the tenant and signed-in account.', 'Open **Entra ID → Conditional Access → Policies** and open a policy without editing it.', 'Sign out of the emergency account.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
    if (qualifying.length) tasks.push({
      id: `record-verification:${id}`, accountId: id, title: 'Record verification', targetUpn: upn, required: true,
      readinessKey: 'recovery-confirmation', evidence: `${qualifying.length} current qualifying event${qualifying.length === 1 ? '' : 's'} available.`, actionLabel: 'Open recording instructions',
      issueKeys: [`recovery-result:${id.toLowerCase()}`], facts: [{ label: 'Matching event', value: `${qualifying.length} available` }],
      steps: ['Under **Final verification**, select only this account.', "Select the sign-in event matching the test's account, time and administrative resource.", 'Confirm the recovery credential used and the administrative check completed.', 'Choose **Passed** and select **Save verification**.'],
    })
    if (prepared && !qualifying.length) tasks.push({
      id: `inspect-sign-in:${id}`, accountId: id, title: 'Inspect a failed or missing sign-in', targetUpn: upn, required: false,
      readinessKey: 'recovery-sign-ins', evidence: readings[0]?.reason ?? 'No current matching success was found.', actionLabel: 'Open log-inspection instructions',
      steps: ['In your working administrator session, open **Entra ID → Monitoring & health → Sign-in logs**.', `Filter to **${upn}** and the test time.`, 'Open the event and inspect **Status**, **Authentication details** and **Conditional Access**.', 'Record the event time, error code and correlation ID for troubleshooting.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
    if (prepared) tasks.push({
      id: `record-failed-attempt:${id}`, accountId: id, title: 'Record a failed attempt', targetUpn: upn, required: false,
      readinessKey: 'recovery-confirmation', evidence: 'Use this when the attempted recovery did not succeed.', actionLabel: 'Open failed-attempt instructions',
      steps: ['Under **Final verification**, select only this account.', 'Choose **Failed** and enter the attempt date.', 'Select **Record failed attempt**.'],
    })
  }
  return { tasks }
}

export function emergencyVerificationPowerShell(phase: CleanupPhase): string {
  const ids = phase.accountIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ')
  const from = Object.values(phase.configurationObservedAtByAccount ?? {}).filter((value): value is string => !!value).sort()[0] ?? phase.snapshotObservedAt ?? ''
  return [
    '# Read-only evidence inspection. This script does not record or complete verification.',
    `$AccountIds = @(${ids})`,
    `$From = [DateTimeOffset]'${from.replace(/'/g, "''")}'`,
    "$Graph = 'https://graph.microsoft.com/v1.0'",
    '$rows = @()',
    "$next = \"$Graph/auditLogs/signIns?`$filter=createdDateTime ge $($From.UtcDateTime.ToString('o'))&`$select=id,createdDateTime,userId,userPrincipalName,status,isInteractive,appId,resourceId,resourceDisplayName,authenticationDetails,conditionalAccessStatus\"",
    'while ($next) {',
    '  try { $page = Invoke-MgGraphRequest -Method GET -Uri $next -OutputType PSObject } catch { throw "Sign-in evidence could not be read: $($_.Exception.Message)" }',
    "  if ($null -eq $page -or -not ($page.PSObject.Properties.Name -contains 'value') -or $page.value -is [string] -or $page.value -is [System.Collections.IDictionary] -or -not ($page.value -is [System.Collections.IEnumerable])) { throw 'Sign-in evidence returned an unreadable response.' }",
    '  $rows += @($page.value)',
    "  $next = if ($page.PSObject.Properties.Name -contains '@odata.nextLink') { $page.'@odata.nextLink' } else { $null }",
    '}',
    '$rows | Where-Object { $AccountIds -contains $_.userId } | Select-Object id,createdDateTime,userId,userPrincipalName,status,isInteractive,appId,resourceId,resourceDisplayName,authenticationDetails,conditionalAccessStatus',
  ].join('\n')
}

export function emergencyVerificationJson(phase: CleanupPhase): string {
  const result = phase.recoveryFindings?.find(finding => finding.key === 'recovery-confirmation')
  return JSON.stringify({
    purpose: 'Read-only emergency-access verification evidence and context; not a Graph write payload.',
    tenantId: phase.tenantId ?? null,
    scanTimestamp: phase.snapshotObservedAt ?? null,
    accounts: phase.accountIds.map(id => ({
      id,
      upn: upnOf(phase, id),
      configurationBasisAvailable: Boolean(phase.accountBasis?.[id]),
      checkpointObservedAt: phase.configurationObservedAtByAccount?.[id] ?? null,
      candidates: (phase.recoveryCandidates?.[id] ?? []).map(reading => ({ eventId: reading.candidate.eventId, at: reading.candidate.at, method: reading.candidate.method, resource: reading.candidate.resource ?? reading.candidate.resourceId ?? null, qualifies: reading.qualifies, reason: reading.reason })),
      recordedResult: result?.items?.find(item => item.subjectLabel === upnOf(phase, id))?.value ?? null,
    })),
    unresolvedFindings: (phase.recoveryFindings ?? []).filter(finding => finding.outcome !== 'pass').map(finding => ({ key: finding.key, label: finding.label, value: finding.value, detail: finding.detail, items: finding.items ?? [] })),
  }, null, 2)
}

export function emergencyVerificationAiInfo(phase: CleanupPhase): string {
  return [
    'Help with the current Verify Emergency Access task using only the observed context below. Keep configuration, sign-in evidence, operator confirmations and saved results distinct. Do not claim an unknown fact is verified and do not propose bypassing missing evidence.',
    emergencyVerificationJson(phase),
  ].join('\n\n')
}
