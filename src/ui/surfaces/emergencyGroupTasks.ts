import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'

const clean = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const upnOf = (ctx: StepVarContext, id: string): string => clean(ctx.snapshot.users.find(user => same(user.id, id))?.userPrincipalName || ctx.nameOf(id) || id)

export function emergencyGroupTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const choice = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory })
  const selected = ctx.mapping.breakGlassUserIds
  const tasks: EmergencyAccountTask[] = []

  if (!choice.actionableId) {
    if (choice.suggested) tasks.push({
      id: `choose-group:${choice.suggested.id}`,
      accountId: null,
      title: 'Choose the emergency exclusions group',
      targetUpn: null,
      required: true,
      readinessKey: 'group-choice',
      evidence: `Suggested: ${choice.suggested.name}. A suggestion is not saved intent.`,
      actionLabel: 'Open group-selection instructions',
      steps: [
        'Open **Entra ID → Groups → All groups**.',
        `Open **${clean(choice.suggested.name)}** and verify its object ID is **${choice.suggested.id}**.`,
        'Confirm it is the dedicated assigned security group intended for emergency-account exclusions.',
        'In IAMAI, choose that exact group under **Exclusions group** and select **Save**.',
        'Return to IAMAI and select **Scan to update the plan**.',
      ],
    })
    if (!choice.suggested && choice.status === 'none-found' && selected.length > 0) tasks.push({
      id: 'create-group', accountId: null, title: 'Create the emergency exclusions group', targetUpn: null, required: true,
      readinessKey: 'group-choice', evidence: choice.status === 'none-found' ? 'The complete reading found no suitable group.' : 'No group is saved and the current reading cannot establish a suitable existing group.',
      actionLabel: 'Open group-creation instructions',
      steps: [
        'Open **Entra ID → Groups → All groups → New group**.',
        'Set **Group type** to **Security** and **Membership type** to **Assigned**.',
        'Enter the approved tenant name for the emergency exclusions group.',
        `Add only the selected emergency accounts: ${selected.map(id => `**${upnOf(ctx, id)}**`).join(', ')}.`,
        'Create the group. Do not make it mail-enabled or dynamic.',
        'Return to IAMAI, select the created group under **Exclusions group**, select **Save**, and scan again.',
      ],
    })
    if (choice.storedId && choice.status === 'unverified') tasks.unshift({
      id: `inspect-group:${choice.storedId}`, accountId: null, title: 'Inspect the saved exclusions group', targetUpn: null, required: true,
      readinessKey: 'group-choice', evidence: `The saved choice ${choice.storedName || choice.storedId} remains saved, but the current scan did not verify it.`, actionLabel: 'Open inspection instructions',
      steps: ['Open **Entra ID → Groups → All groups**.', `Search for the saved object ID **${choice.storedId}**.`, 'Open the group and confirm its name, type, membership mode and current members.', 'Return to IAMAI and select **Scan to update the plan**. Do not save a different group merely because this read was unavailable.', 'If the object is absent, choose the verified replacement in IAMAI and select **Save**.'],
    })
    return { tasks }
  }

  const groupId = choice.actionableId
  const groupName = clean(choice.actionableName || ctx.nameOf(groupId) || groupId)
  const groupFinding = step.configurationFindings?.find(finding => finding.key === 'group-choice')
  if (groupFinding?.outcome !== 'pass') tasks.push({
    id: `inspect-group:${groupId}`, accountId: null, title: 'Inspect group', targetUpn: null, targetLabel: groupName, required: true,
    readinessKey: 'group-choice', evidence: 'One or more required group properties could not be verified.', actionLabel: 'Open inspection instructions',
    issueKeys: groupFinding?.items?.flatMap(item => item.issueKeys ?? []) ?? [],
    facts: groupFinding?.items?.filter(item => item.outcome !== 'pass').map(item => ({ label: item.factLabel ?? item.label, value: item.value })) ?? [],
    steps: ['Keep your working administrator session open.', 'Open **Entra ID → Groups → All groups**.', `Open **${groupName}** and verify object ID **${groupId}**.`, 'Inspect **Group type**, **Membership type**, **Security enabled** and **Mail enabled**. Do not replace or delete the saved group in this inspection task.', 'Return to IAMAI and select **Scan to update the plan**.'],
  })
  const members = ctx.groups?.get(groupId) ?? [...(ctx.groups ?? [])].find(([id]) => same(id, groupId))?.[1]
  if (!members || members.sampled || members.memberIds.length < members.memberCount) tasks.push({
    id: `inspect-members:${groupId}`, accountId: null, title: 'Inspect exclusions group membership', targetUpn: null, required: true,
    readinessKey: 'group-members', evidence: 'The current scan did not establish the complete assigned membership.', actionLabel: 'Inspect membership', issueKeys: ['group:xg.containsEmergency', 'group:xg.membersApproved', 'group:xg.noExtraAdmins'],
    steps: ['Open **Entra ID → Groups → All groups**.', `Open **${groupName}** and verify object ID **${groupId}**.`, 'Open **Members** and review the complete direct membership.', 'Confirm the group uses **Assigned** membership and is a security group that is not mail-enabled.', 'Return to IAMAI and select **Scan to update the plan**. Do not infer missing or extra members from a partial list.'],
  })
  if (members && !members.sampled && members.memberIds.length >= members.memberCount) {
    const missing = selected.filter(id => !members.memberIds.some(member => same(member, id)))
    const extra = members.memberIds.filter(id => !selected.some(selectedId => same(selectedId, id)))
    if (missing.length) tasks.push({
      id: `add-members:${groupId}`, accountId: null, title: 'Add missing emergency accounts', targetUpn: null, required: true,
      readinessKey: 'group-members', evidence: missing.map(id => upnOf(ctx, id)).join(', '), actionLabel: 'Add missing accounts', issueKeys: ['group:xg.containsEmergency'],
      facts: [{ label: 'Selected emergency accounts', value: `Missing: ${missing.map(id => upnOf(ctx, id)).join(', ')}` }], targetLabel: groupName,
      steps: [`Open **Entra ID → Groups → ${groupName} → Members**.`, 'Select **Add members**.', `Add only: ${missing.map(id => `**${upnOf(ctx, id)}**`).join(', ')}.`, 'Select **Add**, confirm the direct membership, then return to IAMAI and select **Scan to update the plan**.'],
    })
    if (extra.length && step.configurationFindings?.find(finding => finding.key === 'group-members')?.outcome !== 'pass') tasks.push({
      id: `inspect-unexpected-members:${groupId}`, accountId: null, title: 'Review additional members', targetUpn: null, targetLabel: groupName, required: true,
      readinessKey: 'group-members', evidence: 'Additional direct members require review against the existing approval rules.', actionLabel: 'Review members', issueKeys: ['group:xg.membersApproved', 'group:xg.noExtraAdmins'],
      facts: [{ label: 'Additional direct members', value: extra.map(id => upnOf(ctx, id)).join(', ') }],
      steps: ['Keep your working administrator session open.', `Open **Entra ID → Groups → ${groupName} → Members**.`, 'Review the additional direct members against the approved exclusions and emergency-account rules shown in Readiness.', 'Remove only a member that the existing rules identify as unexpected. Do not remove nested or unread membership.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
  }

  const policies = ctx.snapshot.config.caPolicies
  if (policies?.status === 'ok') for (const [index, raw] of (policies.rows as Record<string, any>[]).entries()) {
    if (raw.state === 'disabled') continue
    const excluded = raw.conditions?.users?.excludeGroups
    if (Array.isArray(excluded) && excluded.some((id: unknown) => typeof id === 'string' && same(id, groupId))) continue
    const id = typeof raw.id === 'string' && raw.id.trim() ? clean(raw.id) : ''
    const name = clean(String(raw.displayName || raw.id || 'Unnamed policy'))
    const mode = raw.state === 'enabled' ? 'On' : raw.state === 'enabledForReportingButNotEnforced' ? 'Report-only' : 'Mode not read'
    if (!id || mode === 'Mode not read' || !Array.isArray(excluded) || groupFinding?.taskSafe !== true) {
      tasks.push({
        id: `inspect-policy:${id || index}`, accountId: null, title: 'Review policy exclusion', targetUpn: null, targetLabel: name, required: true,
        readinessKey: 'group-policies', evidence: 'The policy target, mode, group safety or current exclusions could not be established safely.', actionLabel: 'Open inspection instructions',
        issueKeys: [`group-policy:${id || 'unknown'}:mode`, `group-policy:${id || 'unknown'}:exclusion`],
        facts: [{ label: 'Mode', value: mode === 'Mode not read' ? 'Could not verify' : mode }, { label: 'Group exclusion', value: Array.isArray(excluded) ? 'Missing' : 'Could not verify' }],
        steps: ['Keep your working administrator session open.', 'Open **Entra ID → Conditional Access → Policies**.', `Open **${name}** and verify its object ID, current mode and existing user/group inclusions and exclusions.`, 'Do not edit the policy until Readiness confirms the saved exclusions group is safe and the exact missing reference is known.', 'Return to IAMAI and select **Scan to update the plan**.'],
      })
      continue
    }
    tasks.push({
      id: `exclude-policy:${id}`, accountId: null, title: 'Review policy exclusion', targetUpn: null, targetLabel: name, required: true,
      readinessKey: 'group-policies', evidence: `${name} — ${mode}`, actionLabel: 'Open exclusion instructions', issueKeys: [`group-policy:${id}:exclusion`],
      facts: [{ label: 'Mode', value: mode }, { label: 'Group exclusion', value: 'Missing' }],
      steps: ['Keep your working administrator session open.', `Open **Entra ID → Conditional Access → Policies → ${name}** and verify policy ID **${id}**.`, 'Open **Users → Exclude → Users and groups**.', `Add **${groupName}** (${groupId}).`, 'Preserve all existing included users, groups, roles, guests and exclusions.', `Keep the policy mode **${mode}**; do not enable or disable it as part of this correction.`, 'Select **Save**.', 'Reopen the policy and verify the group exclusion.', 'Return to IAMAI and select **Scan to update the plan**.'],
    })
  }
  return { tasks }
}
