import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { Artifact } from './stepBody.ts'

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

export function emergencyVerificationTasksOf(phase: CleanupPhase): EmergencyTaskProjection {
  const accounts = phase.accountIds.map(id => `**${upnOf(phase, id)}**`).join(', ') || 'each selected emergency account'
  const signIns = phase.recoveryFindings?.find(finding => finding.key === 'recovery-sign-ins')
  const verified = new Set((signIns?.items ?? []).filter(item => item.outcome === 'pass').map(item => item.accountId ?? item.subjectId).filter((id): id is string => !!id))
  const pending = phase.accountIds.filter(id => !verified.has(id))
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'verify-emergency-sign-in', accountId: null, title: 'Verify emergency sign-in', targetUpn: null,
      required: pending.length > 0, readinessKey: 'recovery-sign-ins', evidence: pending.length ? `${pending.length} account${pending.length === 1 ? '' : 's'} still need a qualifying sign-in.` : 'Every selected emergency account is verified.', actionLabel: 'Open sign-in instructions',
      issueKeys: pending.map(id => `recovery-sign-in:${id.toLowerCase()}`),
      // The per-account list is the Sign-in Evidence tile's; the procedure names no list of its own.
      readinessFacts: phase.accountIds.map(id => ({ label: upnOf(phase, id), value: verified.has(id) ? 'Verified' : 'Sign-in required' })),
      steps: ['Retrieve the prepared passkey for each emergency account.', 'Open a new private browser window and go to [Microsoft Entra admin center](https://entra.microsoft.com/). Any Microsoft sign-in counts.', 'Sign in as that emergency account using its prepared passkey.', 'Confirm the account and tenant.', 'Sign out and close the private window. Repeat for each remaining account.', 'Wait 5–10 minutes, then select **Scan to update the plan**. If the event has not appeared, wait and scan again.'],
    },
    {
      id: 'troubleshoot-emergency-sign-in', accountId: null, title: 'Troubleshoot emergency sign-in', targetUpn: null,
      required: false, readinessKey: 'recovery-sign-ins', evidence: null, actionLabel: 'Open troubleshooting instructions',
      steps: ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Monitoring & health → Sign-in logs**.', `Filter by the affected emergency account (${accounts}) and attempt time.`, 'Open the event. Check **Status**, **Authentication details**, and **Conditional Access**.', 'Correct the issue in the relevant account, exclusions, or passkey task.', 'Follow **Verify emergency sign-in** again, then scan to update the plan.', 'If no administrator can sign in, follow **Emergency recovery procedure** below.'],
    },
  ]
  return { tasks, printAll: true }
}

/**
 * The drill's channels: the Entra tab, whose procedure is its tasks, and AI
 * Info. No PowerShell or JSON tab (owner, 2026-09-23): both were read-only
 * sign-in log queries the scan already runs.
 */
export function emergencyVerificationArtifacts(phase: CleanupPhase): Artifact[] {
  return [
    { id: 'portal', form: 'markdown', lines: [], text: () => '', note: null },
    { id: 'ai', form: 'markdown', lines: [], text: () => emergencyVerificationAiInfo(phase), note: null },
  ]
}

/**
 * AI Info: a briefing like every other step's (owner audit, 2026-09-24), each
 * account with the sign-in evidence the latest scan read. It had been a JSON
 * dump carrying the tenant id and sign-in event ids, which an assistant needs
 * none of.
 */
export function emergencyVerificationAiInfo(phase: CleanupPhase): string {
  const signIns = phase.recoveryFindings?.find(finding => finding.key === 'recovery-sign-ins')
  const accounts = phase.accountIds.map(id => {
    const item = signIns?.items?.find(row => row.accountId === id || row.subjectId === id)
    const reading = item ? [item.label, item.value].filter(Boolean).join(': ').replace(/\s*\n\s*/g, '; ') : 'no qualifying sign-in in the latest scan'
    return `- ${upnOf(phase, id)} — ${reading}`
  })
  const verified = (signIns?.items ?? []).filter(item => item.outcome === 'pass').length
  const open = (phase.recoveryFindings ?? []).filter(finding => finding.outcome !== 'pass').map(finding => `- ${finding.label}: ${finding.value}${finding.detail?.trim() ? `. ${finding.detail.trim()}` : ''}`)
  return [
    'Help me understand and carry out Verify Emergency Access. Use only the observed sign-in evidence below. Distinguish observations from proposed changes, do not treat an account as verified unless its evidence says so, and explain the next account-specific action first.',
    'Sign-in evidence from the latest scan:',
    accounts.length ? accounts.join('\n') : '- No emergency account is saved.',
    ...(open.length ? [`Still open:\n${open.join('\n')}`] : []),
    `Current step state: ${phase.accountIds.length > 0 && verified >= phase.accountIds.length ? 'every emergency account has a qualifying sign-in in the latest scan' : 'one or more emergency accounts still need a qualifying sign-in'}.`,
    'Use the Entra channel for the complete procedure and return to IAMAI to scan after each sign-in.',
  ].join('\n\n')
}
