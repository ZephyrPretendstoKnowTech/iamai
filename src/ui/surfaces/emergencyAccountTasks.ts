// The Entra work for Prepare Emergency Access Accounts, projected from the
// step's structured findings and the scan's passkey compatibility. This module
// is deliberately presentation-only: it does not decide readiness, persist a
// choice, or change tenant state.
import type { Step } from '../../roadmap/types.ts'
import { approvedPasskeyModels, emergencyMethodIssueKey, emergencyValidationIssueKey } from '../../roadmap/emergencyJourney.ts'
import type { ApprovedModel } from '../../roadmap/emergencyJourney.ts'
import { emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility } from '../../roadmap/passkeyCompatibility.ts'
import { methodAvailability } from '../../roadmap/methodAvailability.ts'
import { GLOBAL_ADMIN_ROLE, initialDomain } from '../../validation/rules.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

export type EmergencyAccountTaskVariant = {
  id: string
  label: string
  steps: string[]
}

export type EmergencyAccountTask = {
  id: string
  accountId: string | null
  title: string
  targetUpn: string | null
  /** Non-account target shown once above its facts. */
  targetLabel?: string | null
  required: boolean
  readinessKey: string
  readinessKeys?: string[]
  evidence: string | null
  actionLabel: string
  /** Exact constituent findings this action/evidence replaces in interactive Readiness. */
  issueKeys?: string[]
  facts?: { label: string; value: string }[]
  steps: string[]
  variants?: EmergencyAccountTaskVariant[]
  defaultVariantId?: string
}

export type EmergencyAccountTasks = {
  tasks: EmergencyAccountTask[]
  approvedModels: ApprovedModel[]
  tapAvailable: boolean | null
}

/** Shared task projection used by the connected emergency-access steps. */
export type EmergencyTaskProjection = {
  tasks: EmergencyAccountTask[]
  approvedModels?: ApprovedModel[]
  tapAvailable?: boolean | null
}

const safe = (value: string): string => oneLine(value).trim()
const userOf = (ctx: StepVarContext, id: string) => ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())
const targetOf = (ctx: StepVarContext, id: string): string => safe(userOf(ctx, id)?.userPrincipalName || ctx.nameOf(id) || id)
const task = (value: EmergencyAccountTask): EmergencyAccountTask => value

const UNKNOWN_PASSKEY_EVIDENCE: Record<string, string> = {
  methodsUnread: 'The registered authentication methods could not be read.',
  profileOrPartial: 'The assigned passkey profile could not be read.',
  policyUnread: 'The Passkey (FIDO2) configuration could not be read.',
  membershipUnread: 'The account’s Passkey (FIDO2) targeting membership could not be read.',
  modelsUnread: 'The registered passkey model or applicable restriction could not be read.',
}

function tenantLead(ctx: StepVarContext): string[] {
  const tenant = safe(tenantNameOf(ctx.snapshot))
  return tenant
    ? [`Open [Microsoft Entra admin center](https://entra.microsoft.com/) and select **${tenant}**.`]
    : ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) and confirm the intended tenant before continuing.']
}

function inspectSteps(ctx: StepVarContext, target: string, inspectIdentity: boolean, inspectRole: boolean): string[] {
  return [
    ...tenantLead(ctx),
    `Open **Entra ID → Users** and select **${target}**.`,
    ...(inspectIdentity ? ['Open **Properties** and check the username, account-enabled state, and on-premises synchronization details.'] : []),
    ...(inspectRole ? ['Open **Assigned roles** and check the Global Administrator assignment and its active or eligible state.'] : []),
    'Return to IAMAI and select **Scan to update the plan**.',
  ]
}

function createSteps(domain: string, replacement: boolean): string[] {
  return [
    'Keep your working administrator session open.',
    'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users → New user → Create new user**.',
    `Enter a unique username, such as **emergency-access-primary** or **emergency-access-secondary**, or choose another account name. Select **${safe(domain)}** from the domain list.`,
    'Enter a display name that identifies the account’s emergency purpose. Leave **Account enabled** selected.',
    'Store the initial password securely where authorized staff can retrieve it without signing in to this tenant.',
    'Select **Review + create**, check the username and domain, then select **Create**.',
    'Return to IAMAI and select **Scan to update the plan**.',
    'Select the new account under **Emergency access accounts**, then select **Save**.',
    ...(replacement ? ['Keep the existing recovery account and its credentials available until the replacement is fully prepared and final verification succeeds.'] : []),
  ]
}

export function yubiKeySteps(upn: string): string[] {
  return [
    'Keep your working administrator session open.',
    `Open a separate browser session, go to [Security info](https://mysignins.microsoft.com/security-info), and sign in as **${upn}**.`,
    'Select **Add sign-in method → Choose a method → Passkey**, then select **Next**.',
    'When Microsoft asks where to save the passkey, select **Use another device** or **More options**, then choose **Security key**.',
    'Connect the approved YubiKey. Complete its PIN and touch prompts.',
    'Give the passkey a recognizable name and finish registration.',
    `Confirm the new passkey appears in **${upn}**’s Security info.`,
    'Store the YubiKey and its PIN securely where authorized staff can retrieve them without signing in to this tenant.',
    'Return to IAMAI and select **Scan to update the plan**.',
  ]
}

export function authenticatorSteps(upn: string, platform: 'iPhone/iPad' | 'Android'): string[] {
  return [
    'Keep your working administrator session open.',
    `Open **Microsoft Authenticator** on the recovery ${platform} device.`,
    `If **${upn}** is listed, select it, then select **Create a passkey**.`,
    `If the account is not listed, select **Add account** or **+**, choose **Work or school account → Sign in**, and enter **${upn}**.`,
    `After the account is added, select **${upn} → Create a passkey**.`,
    'Complete the Microsoft sign-in and multifactor prompts shown for this account.',
    'Follow the app-directed screen-lock and passkey-provider setup, then finish registration.',
    `Confirm **${upn}** and its passkey appear in Microsoft Authenticator.`,
    'Store the recovery device and its unlock information through the approved process accessible to authorized staff without this tenant.',
    'Return to IAMAI and select **Scan to update the plan**.',
  ]
}

export function emergencyRegistrationVariants(upn: string): EmergencyAccountTaskVariant[] {
  return [
    { id: 'yubikey', label: 'YubiKey security key', steps: yubiKeySteps(upn) },
    { id: 'authenticator-ios', label: 'Microsoft Authenticator on iPhone/iPad', steps: authenticatorSteps(upn, 'iPhone/iPad') },
    { id: 'authenticator-android', label: 'Microsoft Authenticator on Android', steps: authenticatorSteps(upn, 'Android') },
  ]
}

function tapState(ctx: StepVarContext, id: string): boolean | null {
  const groups = Object.fromEntries([...(ctx.groups ?? new Map())].map(([groupId, value]) => [groupId, value.memberIds]))
  const state = methodAvailability(ctx.snapshot, { groupMembers: groups }).usable(id, 'temporaryaccesspass')
  return state === 'yes' ? true : state === 'no' ? false : null
}

const fixSet = (step: Step, id: string): Set<string> => new Set((step.checks?.items ?? []).filter(item => item.target?.toLowerCase() === id.toLowerCase()).map(item => item.fix))

/** Structured task projection for this one step. */
export function emergencyAccountTasksOf(step: Step, ctx: StepVarContext): EmergencyAccountTasks {
  const domain = initialDomain(ctx.snapshot)
  const selected = ctx.mapping.breakGlassUserIds
  const current = new Map(emergencyPasskeyCompatibility(ctx.snapshot, selected, ctx.groups).map(item => [item.accountId.toLowerCase(), item]))
  const intended = new Map(emergencyProposedPasskeyCompatibility(ctx.snapshot, selected, ctx.mapping, ctx.groups).map(item => [item.accountId.toLowerCase(), item]))
  const tasks: EmergencyAccountTask[] = []
  const tapStates = selected.map(id => tapState(ctx, id))

  for (const id of selected) {
    const target = targetOf(ctx, id)
    const user = userOf(ctx, id)
    const fixes = fixSet(step, id)
    const standing = step.emergency?.accounts.find(account => account.id.toLowerCase() === id.toLowerCase())
    const replacement = fixes.has('cloud-only') || fixes.has('onmicrosoft-domain') || fixes.has('not-a-person')
    const scheduleRead = ctx.snapshot.config.roleAssignmentSchedules?.status === 'ok'
    const rolesRead = ctx.snapshot.config.roleAssignments?.status === 'ok'
    const roleUnread = !user || !rolesRead || !scheduleRead || standing?.assessed === false
    if (roleUnread && !replacement) {
      tasks.push(task({
        id: `inspect-account:${id}`,
        accountId: id,
        title: 'Inspect account settings',
        targetUpn: target,
        required: true,
        readinessKey: 'account-setup',
        evidence: !user ? 'The selected identity was not read.' : !rolesRead ? 'Role assignments were not read.' : !scheduleRead ? 'Permanent role schedules were not read.' : 'Identity or role evidence is incomplete.',
        actionLabel: 'Open inspection instructions',
        ...(!rolesRead || !scheduleRead || standing?.assessed === false ? { issueKeys: [emergencyValidationIssueKey('bg.role.permanentGa', id)] } : {}),
        steps: inspectSteps(ctx, target, true, true),
      }))
    }
    if (replacement && !domain) {
      tasks.push(task({
        id: `inspect-initial-domain:${id}`,
        accountId: id,
        title: 'Inspect the initial tenant domain',
        targetUpn: target,
        required: true,
        readinessKey: 'account-setup',
        evidence: 'The identity needs replacement, but the initial tenant domain was not read.',
        actionLabel: 'Open inspection instructions',
        issueKeys: [emergencyValidationIssueKey('bg.initialDomain', id)],
        steps: [
          ...tenantLead(ctx),
          'Open **Entra ID → Custom domain names** and identify the verified initial **onmicrosoft.com** domain.',
          'Return to IAMAI and select **Scan to update the plan** before creating the replacement.',
          'Do not change roles or authentication methods on the unsuitable identity.',
        ],
      }))
      continue
    }
    if (replacement && domain) {
      tasks.push(task({
        id: `create-replacement:${id}`,
        accountId: id,
        title: 'Create a replacement emergency account',
        targetUpn: target,
        required: true,
        readinessKey: 'account-setup',
        evidence: 'The selected identity is unsuitable for emergency access.',
        actionLabel: 'Open replacement instructions',
        issueKeys: [
          ...(fixes.has('cloud-only') ? [emergencyValidationIssueKey('bg.cloudOnly', id)] : []),
          ...(fixes.has('onmicrosoft-domain') ? [emergencyValidationIssueKey('bg.initialDomain', id)] : []),
          ...(fixes.has('not-a-person') ? [emergencyValidationIssueKey('bg.notPersonal', id)] : []),
        ],
        steps: createSteps(domain, true),
      }))
      continue
    }
    if (fixes.has('enabled')) {
      tasks.push(task({
        id: `enable-account:${id}`,
        accountId: id,
        title: 'Enable account sign-in',
        targetUpn: target,
        required: true,
        readinessKey: 'account-setup',
        evidence: 'The account is disabled.',
        actionLabel: 'Open enablement instructions',
        issueKeys: [emergencyValidationIssueKey('bg.enabled', id)],
        steps: [
          `Open **Microsoft Entra admin center → Entra ID → Users → ${target}**.`,
          'Open **Properties → Edit properties → Settings**.',
          'Set **Account enabled** to **Yes**, then select **Save**.',
          'Reopen the account and confirm sign-in is enabled.',
          'Return to IAMAI and select **Scan to update the plan**.',
        ],
      }))
    }
    if (fixes.has('permanent-global-admin') && !roleUnread) {
      const active = (ctx.snapshot.roles.active[id] ?? []).some(role => role.toLowerCase() === GLOBAL_ADMIN_ROLE)
      const eligible = (ctx.snapshot.roles.eligible[id] ?? []).some(role => role.toLowerCase() === GLOBAL_ADMIN_ROLE)
      tasks.push(task({
        id: `assign-role:${id}`,
        accountId: id,
        title: 'Assign permanent active Global Administrator',
        targetUpn: target,
        required: true,
        readinessKey: 'account-setup',
        evidence: active ? 'A permanent tenant-wide assignment was not established.' : eligible ? 'Global Administrator is eligible, not permanently active.' : 'No permanent active Global Administrator assignment was found.',
        actionLabel: 'Open role-assignment instructions',
        issueKeys: [emergencyValidationIssueKey('bg.role.permanentGa', id)],
        steps: [
          'Keep your working administrator session open.',
          `For a direct assignment, open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Roles & admins → Global Administrator → Add assignments**, select **${target}**, then select **Add**. The direct assignment page has no Active or expiry controls.`,
          `If your organization uses PIM for this permanent assignment, open **ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → Global Administrator → Add assignments**, select **${target}**, choose **Assignment type: Active** and **Permanently assigned**, then select **Assign**.`,
          `Reopen **${target} → Assigned roles** and confirm Global Administrator is active and permanent.`,
          'Return to IAMAI and select **Scan to update the plan**.',
        ],
      }))
    }

    const now = current.get(id.toLowerCase())
    const next = intended.get(id.toLowerCase())
    // A directly observed absence is enough to offer registration even when the
    // intended profile assignment is partly unread. Unknown method evidence is
    // still left in Readiness and never becomes a mutation task.
    const needsRegistration = (now?.state === 'review' && now.reason === 'newKey')
      || (next?.state === 'review' && ['newKey', 'modelRestricted', 'proposedModelRestricted'].includes(next.reason))
    if (needsRegistration) {
      const registrationReasons = new Set(['newKey', 'modelRestricted', 'proposedModelRestricted'])
      const issueKeys = ([['current', now], ['planned', next]] as const).flatMap(([phase, reading]) => reading && reading.state !== 'eligible' && registrationReasons.has(reading.reason) ? [emergencyMethodIssueKey(id, phase, reading.reason)] : [])
      const variants = emergencyRegistrationVariants(target)
      if (variants.length) tasks.push(task({
        id: `register-passkey:${id}`,
        accountId: id,
        title: 'Register an approved passkey',
        targetUpn: target,
        required: true,
        readinessKey: 'recovery-methods',
        evidence: now?.reason === 'newKey' ? 'No registered passkey was found.' : 'The registered passkey is not compatible with the current and planned settings.',
        actionLabel: 'Open registration instructions',
        issueKeys,
        steps: variants[0].steps,
        variants,
        defaultVariantId: variants[0].id,
      }))
      if (tapState(ctx, id) === true) tasks.push(task({
        id: `issue-tap:${id}`,
        accountId: id,
        title: 'Issue a Temporary Access Pass',
        targetUpn: target,
        required: false,
        readinessKey: 'recovery-methods',
        evidence: 'Optional bootstrap help. Requires Privileged Authentication Administrator.',
        actionLabel: 'Open Temporary Access Pass instructions',
        steps: [
          `In your working administrator session, open **Entra ID → Users → ${target} → Authentication methods**.`,
          'Select **Add authentication method → Temporary Access Pass**.',
          'Set a short lifetime and select single use, then create the pass.',
          `Use the displayed pass only in **${target}**’s separate Microsoft sign-in session.`,
          'Complete the selected passkey-registration task and confirm the passkey appears for the intended account.',
        ],
      }))
    }
    const unreadReasons = [...new Set([now, next].filter(reading => reading?.state === 'unknown').map(reading => reading!.reason))]
    if (unreadReasons.length > 0) {
      const inspectPolicy = unreadReasons.some(reason => reason !== 'methodsUnread')
      const issueKeys = ([['current', now], ['planned', next]] as const).flatMap(([phase, reading]) => reading?.state === 'unknown' ? [emergencyMethodIssueKey(id, phase, reading.reason)] : [])
      tasks.push(task({
        id: `inspect-passkey:${id}`,
        accountId: id,
        title: 'Review passkey evidence',
        targetUpn: target,
        required: true,
        readinessKey: 'recovery-methods',
        evidence: unreadReasons.map(reason => UNKNOWN_PASSKEY_EVIDENCE[reason] ?? 'Passkey evidence could not be read.').join(' '),
        actionLabel: 'Open inspection instructions',
        issueKeys,
        steps: [
          ...tenantLead(ctx),
          `Open **Entra ID → Users → ${target} → Authentication methods**.`,
          'Inspect the registered passkey entries and note the display name, AAGUID and passkey type. Do not add or delete a method in this inspection task.',
          ...(inspectPolicy ? ['Open **Entra ID → Authentication methods → Policies → Passkey (FIDO2)** and inspect the targeting and applicable profile shown for this account. Do not change the policy or profile in this inspection task.'] : []),
          'Return to IAMAI and select **Scan to update the plan**.',
        ],
      }))
    }
  }

  if (domain && !tasks.some(item => item.id.startsWith('create-replacement:'))) {
    tasks.push(task({
      id: 'create-account',
      accountId: null,
      title: 'Create an emergency account',
      targetUpn: null,
      required: false,
      readinessKey: 'account-setup',
      evidence: null,
      actionLabel: 'Open creation instructions',
      steps: createSteps(domain, false),
    }))
  }

  return { tasks, approvedModels: approvedPasskeyModels(ctx.snapshot, ctx.mapping), tapAvailable: tapStates.length === 0 ? null : tapStates.every(value => value === true) ? true : tapStates.some(value => value === false) ? false : null }
}

export function emergencyTaskSteps(task: EmergencyAccountTask, variantId?: string | null): string[] {
  if (!task.variants?.length) return task.steps
  return task.variants.find(variant => variant.id === variantId)?.steps ?? task.variants.find(variant => variant.id === task.defaultVariantId)?.steps ?? task.variants[0].steps
}

export function emergencyTaskText(task: EmergencyAccountTask, variantId?: string | null): string {
  const heading = `**${task.title}**${task.targetUpn ? `\n\nTarget: ${task.targetUpn}` : ''}`
  return `${heading}\n\n${emergencyTaskSteps(task, variantId).map((line, index) => `${index + 1}. ${line}`).join('\n')}`
}

/** Deterministic flattened output for exports and the Entra artifact. */
export function emergencyAccountTasksText(value: EmergencyAccountTasks): string {
  const required = value.tasks.filter(item => item.required)
  return required.length
    ? required.map(item => emergencyTaskText(item, item.defaultVariantId)).join('\n\n')
    : 'No Entra action is currently identified. Review Readiness.'
}
