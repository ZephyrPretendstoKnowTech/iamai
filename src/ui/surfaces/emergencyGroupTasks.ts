import { exclusionsGroupChoice, operatorExclusionsDecision } from '../../mapping/safetyChoice.ts'
import { exclusionsGroupPolicies, groupLookup } from '../../validation/exclusionsGroupPolicies.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Step } from '../../roadmap/types.ts'

const clean = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const upnOf = (ctx: StepVarContext, id: string): string => clean(ctx.snapshot.users.find(user => same(user.id, id))?.userPrincipalName || ctx.nameOf(id) || id)

/** Four persistent, outcome-sized Entra procedures for Configure Emergency Exclusions. */
export function emergencyGroupTasksOf(step: Step, ctx: StepVarContext): EmergencyTaskProjection {
  const choice = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory })
  const saved = operatorExclusionsDecision(ctx.mapping)
  const selected = ctx.mapping.breakGlassUserIds
  // Preserve the operator's saved identity through a failed read. Only the
  // actionable identity may drive an asserted tenant correction.
  const groupId = saved?.id ?? choice.actionableId
  const actionableGroupId = choice.actionableId
  const groupName = clean(saved?.name || choice.actionableName || (groupId ? ctx.nameOf(groupId) : '') || 'the saved emergency exclusions group')
  const accounts = selected.length ? selected.map(id => `**${upnOf(ctx, id)}**`).join(', ') : 'the emergency accounts selected in the previous step'
  const groupFinding = step.configurationFindings?.find(finding => finding.key === 'group-choice')
  const policyFinding = step.configurationFindings?.find(finding => finding.key === 'group-policies')
  const groupMismatchFacts = (groupFinding?.items ?? []).filter(item => item.outcome === 'fail').flatMap(item => {
    const issues = item.issueKeys ?? []
    if (issues.includes('group:membershipRuleProcessingState')) return [{ label: 'Mismatch', value: 'This group uses dynamic membership.' }]
    if (issues.includes('group:assignedLicenses')) return [{ label: 'Mismatch', value: 'This group has assigned licenses.' }]
    if (issues.includes('group:securityEnabled')) return [{ label: 'Mismatch', value: 'This group is not a security group.' }]
    return item.value ? [{ label: 'Mismatch', value: `${item.label}: ${item.value}.` }] : []
  })
  const unsuitableGroup = choice.status === 'confirmed' && groupMismatchFacts.length > 0
  const members = groupId ? (ctx.groups?.get(groupId) ?? [...(ctx.groups ?? [])].find(([id]) => same(id, groupId))?.[1]) : undefined
  const completeMembers = members?.directMembers === 'complete'
  const directIds = members?.directMemberIds ?? []
  const missing = completeMembers ? selected.filter(id => !directIds.some(member => same(member, id))) : []
  // A member is "extra" only by comparison with the saved emergency selection.
  // With no selection saved there is nothing to compare against, and the
  // comparison names EVERY member — which on an inherited tenant is the
  // break-glass accounts themselves. Removing those from the exclusions group
  // puts them back inside every policy it is excluded from, which is the one
  // way this product can lock somebody out of their own tenant.
  //
  // A reader met exactly that: two accounts in bold, "Remove" in bold, on the
  // first screen after the first scan, and nearly did it. The warning was
  // already in the sentence; it was not enough, because the bold words are
  // what a fast reader takes. So the list is not computed at all until the
  // selection exists to compute it against, and the task says what to do first.
  const extra = completeMembers && selected.length > 0 ? directIds.filter(id => !selected.some(selectedId => same(selectedId, id))) : []
  /** True where members were read but nobody has said which accounts are the emergency ones. */
  const unselected = completeMembers && selected.length === 0 && directIds.length > 0
  const directObject = (id: string): string => {
    const object = members?.directMemberObjects?.find(row => same(row.id, id))
    if (!object) return upnOf(ctx, id)
    if (object.kind === 'user') return [object.displayName, object.userPrincipalName].filter(Boolean).join(' — ') || object.id
    return `${object.displayName || 'Unnamed object'} · ${object.kind} · ${object.id}`
  }
  // The one rule (validation/exclusionsGroupPolicies.ts): the applicable policies,
  // On or Report-only, that confirmedly lack the group. Unread evidence is never a task.
  const missingPolicies: { id: string; name: string; mode: string }[] = groupId && actionableGroupId && groupFinding?.taskSafe === true && ctx.snapshot.config.caPolicies?.status === 'ok'
    ? exclusionsGroupPolicies({ policies: ctx.snapshot.config.caPolicies.rows, groupId, accountIds: selected, activeRoles: ctx.snapshot.roles.active, membersOf: groupLookup(ctx.groups) })
      .flatMap(policy => policy.outcome === 'fail' && policy.id && policy.mode ? [{ id: clean(policy.id), name: clean(policy.name), mode: policy.mode }] : [])
    : []
  const tasks: EmergencyAccountTask[] = [
    {
      id: 'create-exclusions-group', accountId: null, title: 'Create an emergency exclusions group', targetUpn: null, required: choice.status === 'none-found' && selected.length > 0, readinessKey: 'group-choice', evidence: null, actionLabel: 'Open creation instructions',
      readinessTitle: 'Choose an exclusions group', readinessDirection: 'Select a group under Exclusions group. To create one, follow Create an emergency exclusions group in Implementation Tasks.',
      steps: ['Keep your working administrator session open.', 'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Groups → All groups → New group**.', 'Choose **Security**, enter the group name, and choose **Assigned** membership.', ...(selected.length ? [`Under **Members**, add ${accounts}.`] : []), 'Select **Create**. Return to IAMAI and select **Scan to update the plan**.', 'Select the new group under **Exclusions group**, then **Save**. Scan again to verify its membership and settings.'],
    },
    {
      id: 'choose-exclusions-group', accountId: null, title: 'Choose an existing exclusions group', targetUpn: null, required: (!saved && choice.status !== 'none-found') || choice.status === 'invalidated' || unsuitableGroup, readinessKey: 'group-choice', evidence: null, actionLabel: 'Open selection instructions',
      readinessTitle: unsuitableGroup ? 'Use a suitable exclusions group' : 'Choose an exclusions group', readinessDirection: unsuitableGroup ? 'Choose a dedicated assigned security group, or follow Create an emergency exclusions group in Implementation Tasks.' : 'Select a group under Exclusions group. To create one, follow Create an emergency exclusions group in Implementation Tasks.',
      issueKeys: groupFinding?.items?.flatMap(item => item.issueKeys ?? []) ?? [],
      facts: unsuitableGroup ? groupMismatchFacts : [],
      steps: ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Groups → All groups** and open the intended exclusions group.', 'Check its name and object ID. Confirm **Security** group type and **Assigned** membership.', 'In IAMAI, select that group under **Exclusions group**, then **Save**.', 'Select **Scan to update the plan**.'],
    },
    {
      id: 'manage-emergency-membership', accountId: null, title: 'Manage emergency account membership', targetUpn: null, required: !!groupId && completeMembers && (missing.length > 0 || extra.length > 0), readinessKey: 'group-members', evidence: !groupId || !completeMembers ? null : missing.length ? `${missing.length} selected account${missing.length === 1 ? ' is' : 's are'} missing.` : extra.length ? `${extra.length} additional direct member${extra.length === 1 ? '' : 's'} require review.` : null, actionLabel: 'Open membership instructions',
      readinessTitle: missing.length && extra.length ? 'Correct emergency account membership' : extra.length ? 'Remove unexpected members' : 'Add the missing emergency accounts', readinessDirection: 'Follow Manage emergency account membership in Implementation Tasks.',
      issueKeys: ['group:xg.containsEmergency', 'group:xg.membersApproved', 'group:xg.noExtraAdmins'],
      facts: [
        ...extra.map(id => ({ label: 'Remove', value: directObject(id) })),
        ...missing.map(id => ({ label: 'Add', value: upnOf(ctx, id) })),
      ],
      steps: [
        'Keep your working administrator session open.',
        ...(groupId ? [`Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Groups → All groups → ${groupName} → Members**. Check object ID **${groupId}**.`] : ['Select and save an exclusions group in IAMAI first.']),
        ...(missing.length ? [`Select **Add members**, choose ${missing.map(id => `**${upnOf(ctx, id)}**`).join(', ')}, then select **Select** to confirm.`] : []),
        // The consequence goes WITH the instruction, not four paragraphs away.
        //
        // These accounts are "extra" only because they are not in the saved
        // emergency selection — so on a tenant nobody has made that selection
        // in, the accounts named here for removal are the break-glass accounts
        // themselves. One reader got lucky: they were called "Break-glass 1"
        // and "Break-glass 2", so he ticked them instead of removing them.
        // Named `svc-admin-01`, he follows the task list and locks himself out.
        // The portal channel does explain it, in its fourth paragraph, which is
        // not where somebody working down a numbered list is looking.
        ...(extra.length ? [`First confirm any of these that is a genuinely dedicated emergency account, in the emergency accounts step: removing one puts it back inside every policy this group is excluded from. Then, for the rest only: select ${extra.map(id => `**${directObject(id)}**`).join(', ')}, choose **Remove**, and confirm. Remove a few at a time and check their next sign-in before the next few.`] : []),
        // Nothing can be said about this group's membership until the emergency
        // accounts are chosen, so the step asks for that instead of guessing.
        ...(unselected ? [`This group has ${directIds.length} direct member${directIds.length === 1 ? '' : 's'}. Which of them belong here cannot be worked out until the emergency accounts are selected: do that in Prepare Emergency Access Accounts, then scan again and this list will mean something. Remove nobody before then — a member taken out of this group goes back inside every policy the group is excluded from.`] : []),
        ...(groupId && completeMembers && !unselected && !missing.length && !extra.length ? ['No membership change is needed.'] : []),
        `Confirm ${accounts} appear as direct members.`,
        'Reopen **Members** and verify the intended list. Return to IAMAI and select **Scan to update the plan**.',
      ],
    },
    {
      id: 'configure-policy-exclusions', accountId: null, title: 'Configure Conditional Access exclusions', targetUpn: null, required: !!actionableGroupId && missingPolicies.length > 0, readinessKey: 'group-policies', evidence: missingPolicies.length ? `${missingPolicies.length} policy exclusion${missingPolicies.length === 1 ? '' : 's'} need attention.` : null, actionLabel: 'Open exclusion instructions',
      readinessTitle: 'Add the group to the listed policy exclusions', readinessDirection: 'Follow Configure Conditional Access exclusions in Implementation Tasks.',
      issueKeys: policyFinding?.items?.flatMap(item => item.issueKeys ?? []) ?? [],
      facts: missingPolicies.map(policy => ({ label: policy.name, value: `${policy.mode} · ${policy.id}` })),
      steps: ['Keep your working administrator session open.', 'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Conditional Access → Policies**.', ...(missingPolicies.length ? missingPolicies.flatMap(policy => [`Open **${policy.name}** and verify policy ID **${policy.id}**.`, `Open **Assignments → Users → Exclude → Users and groups**, add **${groupName}**, then select **Select**.`, `Retain the policy’s current mode **${policy.mode}**, other exclusions and other settings. Select **Save**, then reopen the policy and confirm the group remains excluded.`]) : [
        ...(!actionableGroupId || groupFinding?.taskSafe !== true ? ['IAMAI has not established the policy or group change values for this scan. Use the remaining steps as a reference; do not save guessed changes.'] : [`Every policy that must exclude **${groupName}** already does. To add it to another policy:`]),
        'Open the policy, then open **Assignments → Users → Exclude → Users and groups**.',
        `Add **${groupName}**, then select **Select**. Preserve the policy mode, other exclusions and all unrelated settings.`,
        'Select **Save**, then reopen the policy and confirm the group remains excluded.',
      ]), 'Return to IAMAI and select **Scan to update the plan**.'],
    },
  ]
  return { tasks, printAll: true }
}
