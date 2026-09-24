import { passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import { strandedSentence } from './emergencyPasskeyTasks.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { approvedPasskeyModels, EMERGENCY_ACCOUNTS, EMERGENCY_GROUP, PASSKEY_SETTINGS } from '../../roadmap/emergencyJourney.ts'
import { assignedPasskeyProfiles, passkeyReadingOf } from '../../roadmap/passkeySettings.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { emergencyAccountTasksOf, emergencyAccountTasksText } from './emergencyAccountTasks.ts'
import type { EmergencyAccountTasks } from './emergencyAccountTasks.ts'

const numbered = (lines: string[], offset = 0) => lines.map((line, index) => `${index + offset + 1}. ${line}`).join('\n')
const bullets = (lines: string[]) => lines.map(line => '- ' + line).join('\n')
const accountLink = '[Emergency Access Accounts](#/plan/s-prereq-break-glass)'
const groupLink = '[Exclusions Group](#/plan/s-prereq-exclusion-group)'
const passkeyLink = '[Configure Passkey Authentication](#/plan/s-prereq-passkey-settings)'
const drillLink = '[Verify Emergency Access](#/plan/cleanup-drill)'

/** AI Info mirrors Step 1's owned work and current projected tasks without
 * importing final-verification or next-step requirements. */
export function emergencyAccountAiInfo(step: Step, ctx: StepVarContext, projected: EmergencyAccountTasks): string {
  const accounts = ctx.mapping.breakGlassUserIds.map(id => oneLine(ctx.nameOf(id))).filter(Boolean)
  // The step's own readiness, not the task list.
  //
  // "No account preparation action is currently projected." was read on a card
  // whose tile beside it said "Prepared passkeys · Needs correction · ... no
  // phishing-resistant method registered". No emergency account task is ever
  // built `required`, so this was not a reading of anything: the branch was
  // unreachable and the sentence unconditional. The findings are what the
  // tiles draw, so taking the work from them is what makes the two agree.
  const outstanding = (step.configurationFindings ?? []).filter(f => f.outcome !== 'pass')
  const required = projected.tasks.filter(task => task.required)
  const work = required.length || outstanding.length
    ? [
        ...required.map(task => `- ${task.title}${task.targetUpn ? ` — ${task.targetUpn}` : ''}${task.evidence ? `: ${task.evidence}` : ''}`),
        ...outstanding.map(f => `- ${f.label}: ${f.value}${f.detail.trim() ? `. ${f.detail.trim()}` : ''}`),
      ].join('\n')
    : '- No account preparation action is currently projected. Rescan after any tenant change.'
  const models = projected.approvedModels.map(model => `- ${model.name} — ${model.aaguid}`).join('\n')
  return [
    'Help me understand and carry out Prepare Emergency Access Accounts. Use only the observed account identity, role and registered-method evidence below. Distinguish observations from proposed changes, do not invent tenant values or completed work, and explain the next account-specific action first.',
    `Selected emergency accounts: ${accounts.length ? accounts.join(', ') : 'none saved'}.`,
    'Current preparation work:',
    work,
    projected.approvedModels.length ? `Approved passkey models:\n${models}` : 'No approved passkey model is currently saved.',
    `Current step state: ${step.state.satisfied ? 'account preparation is satisfied by the latest scan' : 'one or more account preparation requirements remain'}.`,
    'Use the Entra channel for the complete procedure and return to IAMAI to scan after the change.',
  ].join('\n\n')
}

/** The Entra channel shares the existing findings and saved choices. Machine
 * artifacts still use their validated package bindings and operations. */
export function emergencyImplementation(step: Step, ctx: StepVarContext, projectedAccountTasks?: EmergencyAccountTasks | null): string | null {
  if (![EMERGENCY_ACCOUNTS, EMERGENCY_GROUP, PASSKEY_SETTINGS].includes(step.id)) return null
  const { snapshot, mapping } = ctx
  const name = (id: string) => oneLine(ctx.nameOf(id))
  const accountNames = mapping.breakGlassUserIds.map(name)
  const models = approvedPasskeyModels(snapshot, mapping)
  const modelList = bullets(models.map(m => `${m.name} — ${m.aaguid}${m.source === 'existing' ? ' — Existing tenant allowance retained during the transition' : ''}`))
  const choice = exclusionsGroupChoice({ snapshot, mapping, groups: ctx.groups, directory: ctx.directory })
  const groupName = choice.actionableName ? oneLine(choice.actionableName) : null
  const accounts = accountNames.length ? accountNames.join(', ') : 'the emergency accounts you select'

  if (step.id === PASSKEY_SETTINGS) {
    const reading = passkeyReadingOf(snapshot, mapping)
    const current = reading.current
    const assigned = current ? assignedPasskeyProfiles(current) : null
    const profiles = assigned?.profiles ?? []
    const profileMode = !!current && (!!current.defaultPasskeyProfile || profiles.length > 0 || Array.isArray(current.passkeyProfiles) && current.passkeyProfiles.length > 0)
    // The allow list is not handed over while somebody would be locked out by it
    // (roadmap/passkeyRestrictions.ts): this channel said "apply the listed
    // attestation and device-bound Allow restrictions" beside the same Tasks that
    // hedged about the passkeys nobody could judge (Jordan D13).
    const restriction = passkeyRestrictionReading(snapshot, mapping, ctx.groups)
    const configurationAction = !current || reading.state === 'unread'
      ? 'Resolve the named read failure and scan again before changing restrictions; use the intended list only to prepare account choices.'
      : restriction.lockedOut.length > 0
      ? `${profileMode ? 'In the applicable profiles named in Readiness, use device-bound passkeys and attestation as listed.' : 'In the existing legacy configuration, apply the listed attestation setting.'} ${strandedSentence(restriction, ctx, true)}`
      : profileMode
        ? `Open only the applicable profiles named in Readiness${profiles.length ? ` (${profiles.map(p => oneLine(p.name || p.id)).join(', ')})` : ''}. Use device-bound passkeys, attestation and Allow restrictions as listed. Add missing intended AAGUIDs to their applicable profiles while preserving each profile’s existing allowances and targeting.${assigned?.unknown.length ? ' Resolve the unread profile assignments before tightening them.' : ''}`
        : 'In the existing legacy configuration, apply the listed attestation and device-bound Allow restrictions. Retain approved existing entries; do not opt the tenant into profiles as part of this step.'
    return [
      numbered([
        'Review Approved Authenticators below. To approve another model, verify its exact AAGUID from trustworthy model metadata, add its name and AAGUID under Additional Authenticators, and save. Saving changes the IAMAI plan only; registration alone is not approval.',
        accountNames.length ? `Check Recovery Compatibility for ${accounts}. Keep a compatible working method. Where replacement is required, open ${accountLink} and prepare the approved physical security key before tightening settings.` : `Open ${accountLink} and save the intended recovery accounts so IAMAI can check their registered methods against current and intended settings.`,
      ]),
      '**Approved authenticator models**\n\n' + modelList,
      numbered([
        'Open Entra admin center → Entra ID → Authentication methods → Policies → Passkey (FIDO2). Compare the current and intended values in Readiness and preserve unrelated targets and exclusions.',
        'Make approved registration possible now: enable only the required availability, targeting and self-service settings. If an allow list lacks the replacement model, add it while retaining the working model.',
        `${configurationAction} Keep an existing administrator session open, prepare and test any indicated replacement through ${accountLink}, then apply the remaining intended protections.`,
        `Save, reopen the setting, and scan again. Confirm the final differences are clear, complete ${groupLink}, and use ${drillLink} for the final event-backed recovery test.`,
      ], 2),
    ].join('\n\n')
  }

  if (step.id === EMERGENCY_ACCOUNTS) {
    return emergencyAccountTasksText(projectedAccountTasks ?? emergencyAccountTasksOf(step, ctx))
  }

  const group = groupName || oneLine(choice.suggested?.name || step.naming?.proposed || 'your dedicated emergency exclusions group')
  const memberRows = choice.actionableId ? ctx.groups?.get(choice.actionableId) : null
  const missing = memberRows && !memberRows.sampled && memberRows.memberIds.length >= memberRows.memberCount ? mapping.breakGlassUserIds.filter(id => !memberRows.memberIds.includes(id)) : []
  const extra = memberRows && !memberRows.sampled ? memberRows.memberIds.filter(id => !mapping.breakGlassUserIds.includes(id)) : []
  // Each policy is two items (Mode, Group exclusion) named in subjectLabel: list the policies whose exclusion is missing.
  const policyItems = (step.configurationFindings ?? []).find(f => f.key === 'group-policies')?.items ?? []
  const policies = policyItems.filter(i => i.label === 'Group exclusion' && i.outcome !== 'pass')
  // What removing a member from this group actually does. The group is excluded
  // from these policies, so a member taken out of it is covered by every one of
  // them from the moment the removal saves, and the ones already On take effect
  // at that person's next sign-in. A tenant with a hundred and fourteen people
  // parked in its exclusions group read one clause about that, with no count, no
  // policy named and nothing said about doing it in stages.
  const modeOf = new Map(policyItems.filter(i => i.label === 'Mode').map(i => [oneLine(i.subjectLabel ?? ''), String(i.value)]))
  const coverAgain = policyItems
    .filter(i => i.label === 'Group exclusion' && i.outcome === 'pass')
    .map(i => oneLine(i.subjectLabel ?? i.label))
    .filter(n => n.length > 0)
  const liveAgain = coverAgain.filter(n => modeOf.get(n) === 'On')
  return [
    numbered([
      groupName ? `Open the saved group ${group} in Entra ID → Groups → All groups. Verify the object ID ${choice.actionableId} before editing.` : `Review the suggested group ${group} and search for an existing dedicated group before creating another. Save the intended Exclusions Group in this step; that saves the identity the plan will use in its instructions.`,
      `If no suitable group exists, create a Security group with Assigned membership, using ${group} or your agreed name. Add only the emergency accounts selected in ${accountLink}. Rescan to discover its object ID and save the group choice before editing policy references.`,
      accountNames.length ? `Check that the group contains every selected emergency account: ${accounts}. Membership must be assigned, and the group must not be mail-enabled. If its type is unsuitable, create/select the correct group and retain the existing recovery route until the replacement is verified.` : `Select the emergency accounts in ${accountLink} before changing membership. IAMAI will then list missing and unexpected members here.`,
      ...(missing.length ? [`Under Members → Add members, add ${missing.map(name).join(', ')}. Verify their object IDs and save.`] : []),
      ...(extra.length ? [`Review the ${extra.length} ${extra.length === 1 ? 'member' : 'members'} listed below, outside the saved emergency selection. Confirm any genuinely dedicated emergency account in ${accountLink} first. Removing the rest puts each of them back inside every policy this group is excluded from${liveAgain.length ? `, and ${liveAgain.length === 1 ? 'one of those is' : `${liveAgain.length} of those are`} On today: ${liveAgain.join(', ')}` : ''}. Remove a few at a time and check their next sign-in before the next few.`] : []),
      ...(memberRows?.sampled ? ['The membership read is incomplete. Resolve that finding and rescan before concluding that members are missing or removing members.'] : []),
    ]),
    ...(extra.length ? ['**Members outside the saved emergency selection**\n\n' + bullets(extra.map(name))] : []),
    ...(policies.length ? ['**Policies missing the group exclusion**\n\n' + bullets(policies.map(p => `${oneLine(p.subjectLabel ?? p.label)} — ${p.value}`))] : []),
    numbered([
      `For each policy listed as missing the group exclusion, open Entra ID → Conditional Access → Policies → the named policy → Users → Exclude → Users and groups. Add ${group}. Preserve all other exclusions and settings; use the group rather than new direct account exclusions.`,
      'Keep the policy’s current mode when saving. An On policy correction takes effect now. A Report-only policy does not restrict access yet; prepare its group reference before enforcement.',
      'Reopen the group and edited policies to verify the saved members and exclusions. Scan again. The account step will use the same membership and policy evidence automatically.',
      `Finish any outstanding authentication changes in ${passkeyLink}, then use ${drillLink}. Membership alone does not prove that the group is excluded by the policies or that recovery succeeds.`,
    ], 3 + Number(missing.length > 0) + Number(extra.length > 0) + Number(Boolean(memberRows?.sampled))),
  ].join('\n\n')
}
