import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { approvedPasskeyModels, EMERGENCY_ACCOUNTS, EMERGENCY_GROUP, PASSKEY_SETTINGS } from '../../roadmap/emergencyJourney.ts'
import { assignedPasskeyProfiles, passkeyReadingOf } from '../../roadmap/passkeySettings.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { initialDomain } from '../../validation/rules.ts'

const numbered = (lines: string[], offset = 0) => lines.map((line, index) => `${index + offset + 1}. ${line}`).join('\n')
const bullets = (lines: string[]) => lines.map(line => '- ' + line).join('\n')
const accountLink = '[Emergency Access Accounts](#/plan/s-prereq-break-glass)'
const groupLink = '[Exclusions Group](#/plan/s-prereq-exclusion-group)'
const passkeyLink = '[Configure Passkey Authentication](#/plan/s-prereq-passkey-settings)'
const drillLink = '[Verify Emergency Access](#/plan/cleanup-drill)'

/** The Entra channel shares the existing findings and saved choices. Machine
 * artifacts still use their validated package bindings and operations. */
export function emergencyImplementation(step: Step, ctx: StepVarContext): string | null {
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
    const configurationAction = !current || reading.state === 'unread'
      ? 'The current passkey configuration was not fully read. Resolve the named read failure and scan again before changing restrictions; use the intended list only to prepare account choices.'
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
    const domain = initialDomain(snapshot)
    const selected = mapping.breakGlassUserIds.map(id => {
      const u = snapshot.users.find(u => u.id === id)
      const corrections = (step.checks?.items ?? []).filter(i => i.target === id && ['cloud-only', 'onmicrosoft-domain', 'enabled', 'permanent-global-admin'].includes(i.fix)).map(i => ({
        'cloud-only': 'Create a replacement cloud-only account; do not remove the current recovery account before the replacement works.',
        'onmicrosoft-domain': `Use the tenant’s initial ${domain || '*.onmicrosoft.com'} domain for the replacement identity.`,
        enabled: 'Enable sign-in for this account.',
        'permanent-global-admin': 'Assign Global Administrator as permanent active, not only eligible through PIM.',
      })[i.fix])
      return `${name(id)}${u?.userPrincipalName ? ' (' + oneLine(u.userPrincipalName) + ')' : ''}${!u ? ' — Account was not read; resolve the account selection or scan before changing it.' : corrections.length ? ' — ' + corrections.join(' ') : ''}`
    })
    return [
      ...(selected.length ? ['**Selected accounts**\n\n' + bullets(selected)] : []),
      numbered([
        accountNames.length ? `Confirm the saved dedicated accounts: ${accounts}. Add and save a second suitable account where Readiness recommends it; a suggestion is not a saved choice.` : 'Review the suggested identities and save the dedicated emergency accounts you intend to use. Prefer two suitable existing accounts; do not use an employee’s everyday account.',
        `Create only a missing account in Entra ID → Users → New user, using the observed initial ${domain || '*.onmicrosoft.com'} domain. Keep it cloud-only and enabled, complete the supported bootstrap, rescan, then select it here. Never enter its password in IAMAI.`,
        'Correct each named identity or role finding. Assign Global Administrator as permanent active through the applicable Entra/PIM flow; eligible or temporarily activated access is insufficient. If assignment schedule evidence is unavailable, restore that read before treating it as permanent.',
        `Open ${passkeyLink} and confirm the approved destination model before registration. For a new shared recovery route, use an approved physical security key whose exact AAGUID matches; keep any working method until the replacement succeeds.`,
        'Keep the normal administrator session open. In a separate browser session for the named emergency account, open Security info → Add sign-in method → Passkey and explicitly choose the hardware security-key destination. Complete the key interaction, name it recognizably, verify it appears on the intended account, then test a fresh sign-in.',
        'If the fresh account cannot authenticate for registration, first check Temporary Access Pass availability and scoped inclusion. Where permitted, an Authentication Policy Administrator manages the policy and a Privileged Authentication Administrator issues a short, preferably single-use TAP for the privileged account. Enter it only in the separate Microsoft session, register and test the key, then remove the bootstrap credential. IAMAI never stores the TAP.',
        `Store the credential through the approved independent recovery process and confirm custody here. Save and scan again, then continue to ${groupLink}; return to ${passkeyLink} for pending restrictions and use ${drillLink} only after the resulting configuration is ready.`,
      ]),
    ].join('\n\n')
  }

  const group = groupName || oneLine(choice.suggested?.name || step.naming?.proposed || 'your dedicated emergency exclusions group')
  const memberRows = choice.actionableId ? ctx.groups?.get(choice.actionableId) : null
  const missing = memberRows && !memberRows.sampled && memberRows.memberIds.length >= memberRows.memberCount ? mapping.breakGlassUserIds.filter(id => !memberRows.memberIds.includes(id)) : []
  const extra = memberRows && !memberRows.sampled ? memberRows.memberIds.filter(id => !mapping.breakGlassUserIds.includes(id)) : []
  const policies = (step.configurationFindings ?? []).find(f => f.key === 'group-policies')?.items?.filter(i => !i.value.includes('Group already excluded')) ?? []
  return [
    numbered([
      groupName ? `Open the saved group ${group} in Entra ID → Groups → All groups. Verify the object ID ${choice.actionableId} before editing.` : `Review the suggested group ${group} and search for an existing dedicated group before creating another. Save the intended Exclusions Group in this step; that saves the identity the plan will use in its instructions.`,
      `If no suitable group exists, create a Security group with Assigned membership, using ${group} or your agreed name. Add only the emergency accounts selected in ${accountLink}. Rescan to discover its object ID and save the group choice before editing policy references.`,
      accountNames.length ? `Check that the group contains every selected emergency account: ${accounts}. Membership must be assigned, and the group must not be mail-enabled. If its type is unsuitable, create/select the correct group and retain the existing recovery route until the replacement is verified.` : `Select the emergency accounts in ${accountLink} before changing membership. IAMAI will then list missing and unexpected members here.`,
      ...(missing.length ? [`Under Members → Add members, add ${missing.map(name).join(', ')}. Verify their object IDs and save.`] : []),
      ...(extra.length ? [`Review these members outside the saved emergency selection: ${extra.map(name).join(', ')}. Confirm any genuinely dedicated emergency account in Emergency Access Accounts first. Otherwise remove only the reviewed extra members; removal restores policy coverage for them.`] : []),
      ...(memberRows?.sampled ? ['The membership read is incomplete. Resolve that finding and rescan before concluding that members are missing or removing members.'] : []),
    ]),
    ...(policies.length ? ['**Policies missing the group exclusion**\n\n' + bullets(policies.map(p => `${oneLine(p.label)} — ${p.value}`))] : []),
    numbered([
      `For each policy listed as missing the group exclusion, open Entra ID → Conditional Access → Policies → the named policy → Users → Exclude → Users and groups. Add ${group}. Preserve all other exclusions and settings; use the group rather than new direct account exclusions.`,
      'Keep the policy’s current mode when saving. An On policy correction takes effect now. A Report-only policy does not restrict access yet; prepare its group reference before enforcement.',
      'Reopen the group and edited policies to verify the saved members and exclusions. Scan again. The account step will use the same membership and policy evidence automatically.',
      `Finish any outstanding authentication changes in ${passkeyLink}, then use ${drillLink}. Membership alone does not prove that the group is excluded by the policies or that recovery succeeds.`,
    ], 3 + Number(missing.length > 0) + Number(extra.length > 0) + Number(Boolean(memberRows?.sampled))),
  ].join('\n\n')
}
