// The Entra work for Prepare Emergency Access Accounts, projected from the
// step's structured findings and the scan's passkey compatibility. This module
// is deliberately presentation-only: it does not decide readiness, persist a
// choice, or change tenant state.
import type { Step } from '../../roadmap/types.ts'
import { approvedPasskeyModels, emergencyValidationIssueKey } from '../../roadmap/emergencyJourney.ts'
import type { ApprovedModel } from '../../roadmap/emergencyJourney.ts'
import { emergencyAccountPreparationOf } from '../../roadmap/emergencyAccountPreparation.ts'
import { GLOBAL_ADMIN_ROLE, initialDomain } from '../../validation/rules.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'
import { tenantNameOf } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

export type EmergencyAccountTaskVariant = {
  id: string
  label: string
  facts?: { label: string; value: string }[]
  steps: string[]
}

export type EmergencyAccountTask = {
  id: string
  accountId: string | null
  title: string
  targetUpn: string | null
  /** Non-account target shown once above its facts. */
  targetLabel?: string | null
  /** The subject a Tasks Remaining tile names for this task (a passkey profile); never drawn in the task itself. */
  subjectLabel?: string
  required: boolean
  readinessKey: string
  readinessKeys?: string[]
  evidence: string | null
  actionLabel: string
  /** Concise correction heading used only in Tasks Remaining. */
  readinessTitle?: string
  /** Plain direction to the matching Implementation Task; never a second workflow. */
  readinessDirection?: string
  /** Exact constituent findings this action/evidence replaces in interactive Readiness. */
  issueKeys?: string[]
  facts?: { label: string; value: string }[]
  /** Facts shown only in the Tasks Remaining tile, never repeated in the Implementation Task. */
  readinessFacts?: { label: string; value: string }[]
  steps: string[]
  variants?: EmergencyAccountTaskVariant[]
  defaultVariantId?: string
}

export type EmergencyAccountTasks = {
  tasks: EmergencyAccountTask[]
  recommendedTaskId?: string | null
  approvedModels: ApprovedModel[]
  tapAvailable: boolean | null
  accounts: EmergencyAccountStatus[]
  printAll?: boolean
}

export type EmergencyAccountStatus = {
  key: string
  accountId: string | null
  heading: string
  upn: string | null
  title: string
  instruction: string
  completed: string[]
  remainingCount: number | null
  satisfied: boolean
  /** Signals shown beside the account that are not checks: they count toward nothing and gate nothing. */
  notes?: { label: string; value: string }[]
}

/** Shared task projection used by the connected emergency-access steps. */
export type EmergencyTaskProjection = {
  tasks: EmergencyAccountTask[]
  /** Initial Entra procedure derived from the highest-priority confirmed action. */
  recommendedTaskId?: string | null
  approvedModels?: ApprovedModel[]
  tapAvailable?: boolean | null
  accounts?: EmergencyAccountStatus[]
  printAll?: boolean
}

/** What a procedure says about whether a selected account needs it (pages.app.plan.emergencyTasks). */
const WORDS = (app.plan as unknown as { emergencyTasks: Record<'configureNotNeeded' | 'passkeyNotNeeded' | 'passkeyUnreadOne' | 'passkeyUnreadMany' | 'createNotNeeded' | 'variantsLead', string> }).emergencyTasks

const safe = (value: string): string => oneLine(value).trim()
const userOf = (ctx: StepVarContext, id: string) => ctx.snapshot.users.find(user => user.id.toLowerCase() === id.toLowerCase())
const targetOf = (ctx: StepVarContext, id: string): string => safe(userOf(ctx, id)?.userPrincipalName || ctx.nameOf(id) || id)
const task = (value: EmergencyAccountTask): EmergencyAccountTask => value

function tenantLead(ctx: StepVarContext): string[] {
  const tenant = safe(tenantNameOf(ctx.snapshot))
  return tenant
    ? [`Open [Microsoft Entra admin center](https://entra.microsoft.com/) and select **${tenant}**.`]
    : ['Open [Microsoft Entra admin center](https://entra.microsoft.com/) and confirm the intended tenant before continuing.']
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

export function yubiKeySteps(upn: string, device = 'approved YubiKey'): string[] {
  const account = upn === 'the emergency account' ? upn : `**${upn}**`
  return [
    `In a separate browser session, open [Security info](https://mysignins.microsoft.com/security-info) and sign in as ${account}.`,
    'Select **Add sign-in method**, then the passkey or security-key option offered by Microsoft. Choose **Security key** as the storage destination.',
    `Connect the ${device}. Set or enter its PIN and touch the key when prompted.`,
    `Name the new method and finish registration. Confirm it appears in ${account}’s Security info.`,
    'Open a separate private browser window and sign in to Microsoft Entra admin center with the new passkey. Confirm the account and tenant, then sign out. Retain the previous working method until this succeeds.',
    `Store the ${device} and its access information securely where authorized staff can retrieve them without this tenant.`,
    'Return to IAMAI and select **Scan to update the plan**.',
  ]
}

export function authenticatorSteps(upn: string, platform: 'iPhone/iPad' | 'Android'): string[] {
  const account = upn === 'the emergency account' ? upn : `**${upn}**`
  return [
    `Open **Microsoft Authenticator** on the recovery ${platform} device.`,
    `Select ${account} and **Create a passkey**. If the account is absent, use **Add account → Work or school account → Sign in** instead, and complete the passkey setup flow.`,
    'Complete the Microsoft authentication prompts for that account.',
    'Follow the app’s Settings prompt to enable a screen lock and select **Authenticator** as a passkey provider. Return to the app and finish setup.',
    `Confirm the passkey appears for ${account}. In a separate private browser window, sign in to Microsoft Entra admin center using it; confirm the account and tenant, then sign out.`,
    'Retain the previous working method until that sign-in succeeds. Secure the recovery device and unlock information for authorized access without this tenant.',
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

type Preparations = ReadonlyMap<string, ReturnType<typeof emergencyAccountPreparationOf>[number]>

/**
 * The dedicated-account signal (validation rule bg.notPersonal: populated
 * personal profile fields, or the account signed in to IAMAI), read from the
 * step's own findings — the same item Verify Emergency Access shows — so the
 * selection step states it where the selection is made. A note, never a check.
 */
function dedicatedAccountNotes(step: Step): ReadonlyMap<string, { label: string; value: string }[]> {
  const notes = new Map<string, { label: string; value: string }[]>()
  for (const item of (step.configurationFindings ?? []).flatMap(finding => finding.items ?? [])) {
    if (item.outcome !== 'fail' || !item.accountId || !item.issueKeys?.includes(emergencyValidationIssueKey('bg.notPersonal', item.accountId))) continue
    const id = item.accountId.toLowerCase()
    notes.set(id, [...(notes.get(id) ?? []), { label: item.factLabel ?? item.label, value: item.value }])
  }
  return notes
}

function accountStatuses(ctx: StepVarContext, preparations: Preparations, notes: ReadonlyMap<string, { label: string; value: string }[]> = new Map()): EmergencyAccountStatus[] {
  const selected = ctx.mapping.breakGlassUserIds
  const domain = initialDomain(ctx.snapshot)
  const rows: EmergencyAccountStatus[] = selected.map((id, index) => {
    const user = userOf(ctx, id)
    const upn = user?.userPrincipalName ? targetOf(ctx, id) : null
    const heading = `Emergency access account ${index + 1}`
    const preparation = preparations.get(id)!
    const { cloudOnly, initialDomain: rightDomain, enabled, permanentGlobalAdministrator: permanentGa, approvedPasskey: compatible } = preparation.checks
    const checks = [cloudOnly, rightDomain, enabled, permanentGa, compatible]
    const completed = [
      cloudOnly && 'Cloud-only account',
      rightDomain && 'Signs in with the tenant’s onmicrosoft.com address',
      enabled && 'Account enabled',
      permanentGa && 'Permanent, active Global Administrator',
      compatible && 'Approved passkey registered',
    ].filter((value): value is string => Boolean(value))
    let title = 'Account prepared'
    let instruction = 'No account changes remain.'
    if (cloudOnly === false) {
      title = 'Use a cloud-only account'
      instruction = 'This account is synchronized. Select a cloud-only account, or follow Create an emergency account in Implementation Tasks.'
    } else if (rightDomain === false) {
      title = 'Change the sign-in address'
      instruction = `Use ${domain ?? 'the tenant’s initial onmicrosoft.com domain'}. Follow Configure an existing account in Implementation Tasks.`
    } else if (enabled === false) {
      title = 'Account disabled'
      instruction = 'Follow Configure an existing account in Implementation Tasks.'
    } else if (permanentGa === false) {
      const active = (ctx.snapshot.roles.active[id] ?? []).some(role => role.toLowerCase() === GLOBAL_ADMIN_ROLE)
      const eligible = (ctx.snapshot.roles.eligible[id] ?? []).some(role => role.toLowerCase() === GLOBAL_ADMIN_ROLE)
      title = active ? 'Global Administrator assignment expires' : eligible ? 'Global Administrator is eligible only' : 'Global Administrator not assigned'
      instruction = active ? 'Follow Configure an existing account in Implementation Tasks to make it permanent.' : eligible ? 'Follow Configure an existing account in Implementation Tasks to make it permanent and active.' : 'Follow Configure an existing account in Implementation Tasks.'
    } else if (compatible === false) {
      const missing = preparation.passkeyCount === 0
      title = missing ? 'Approved passkey needed' : 'Passkey does not meet planned settings'
      instruction = 'Follow Set up an approved passkey in Implementation Tasks.'
    } else if (cloudOnly === null) {
      title = 'Account source could not be verified'
      instruction = 'Scan again so IAMAI can confirm this is a cloud-only account.'
    } else if (rightDomain === null) {
      title = 'Tenant sign-in domain could not be verified'
      instruction = 'Scan again so IAMAI can confirm the account uses the tenant onmicrosoft.com domain.'
    } else if (enabled === null) {
      title = 'Account status could not be verified'
      instruction = 'Scan again so IAMAI can confirm the account is enabled.'
    } else if (permanentGa === null) {
      title = 'Global Administrator assignment could not be verified'
      instruction = 'Scan again so IAMAI can confirm the account has permanent, active Global Administrator access.'
    } else if (compatible === null) {
      title = 'Passkey check incomplete'
      instruction = 'IAMAI could not fully check this account. Open MFA Readiness and find it under Emergency access, where Evidence read says what could not be read. No account change is established.'
    }
    const remainingCount = checks.every(value => value !== null) ? checks.filter(value => value === false).length : null
    const note = notes.get(id.toLowerCase())
    return { key: id, accountId: id, heading, upn, title, instruction, completed, remainingCount, satisfied: checks.every(value => value === true), ...(note ? { notes: note } : {}) }
  })
  while (rows.length < 2) {
    const slot = rows.length + 1
    rows.push({ key: `empty-${slot}`, accountId: null, heading: `Emergency access account ${slot}`, upn: null, title: 'No account selected', instruction: 'Select an account under Emergency access accounts, then Save. To create one, follow Create an emergency account in Implementation Tasks.', completed: [], remainingCount: null, satisfied: false })
  }
  return rows
}

/** Structured task projection for this one step. */
export function emergencyAccountTasksOf(step: Step, ctx: StepVarContext): EmergencyAccountTasks {
  const domain = initialDomain(ctx.snapshot)
  const selected = ctx.mapping.breakGlassUserIds
  const preparations: Preparations = new Map(emergencyAccountPreparationOf(ctx.snapshot, ctx.mapping, ctx.groups).map(row => [row.accountId, row]))
  // The passkey procedure names only the selected accounts whose approved-passkey
  // check fails; it stays available when none does, and says so.
  const passkeyChecks = selected.map(id => preparations.get(id)?.checks.approvedPasskey ?? null)
  const needing = selected.filter((_, index) => passkeyChecks[index] === false).map(id => targetOf(ctx, id))
  // An unread check is not a passed one. With no account known to need a
  // passkey, the two used to share one branch that chose between "currently
  // needs" and "is confirmed to need" — two words apart, the unread one a double
  // negative that read as "not needed" over a tile saying Could not verify, with
  // eight registration steps under it (R4-51). The engine knows which accounts
  // were not read; the line names them, and the procedure is for them.
  const unread = needing.length === 0 ? selected.filter((_, index) => passkeyChecks[index] === null).map(id => targetOf(ctx, id)) : []
  const registrationTarget = needing.length === 1 ? needing[0] : unread.length === 1 ? unread[0] : 'the account you are preparing'
  const bold = (upns: string[]): string => list(upns.map(upn => `**${upn}**`))
  const repeatLead = needing.length > 1
    ? [`Keep your working administrator session open. Accounts: **${needing.join('**, **')}**.`, 'Repeat this procedure separately for each account listed above.']
    : needing.length === 1
      ? ['Keep your working administrator session open.']
      : selected.length
        ? ['Keep your working administrator session open.', unread.length === 0 ? WORDS.passkeyNotNeeded
          : unread.length === 1 ? fillText(WORDS.passkeyUnreadOne, { account: bold(unread) })
            : fillText(WORDS.passkeyUnreadMany, { accounts: bold(unread) })]
        : ['Keep your working administrator session open.']
  // The existing-account procedure names only the accounts whose check fails.
  type ConfigureCheck = 'initialDomain' | 'enabled' | 'permanentGlobalAdministrator'
  const needs = (check: ConfigureCheck): string[] => selected.filter(id => preparations.get(id)?.checks.cloudOnly !== false && preparations.get(id)?.checks[check] === false).map(id => targetOf(ctx, id))
  const named = (upns: string[]): string => upns.map(upn => `**${upn}**`).join(', ')
  const CONFIGURE_CHECKS = ['initialDomain', 'enabled', 'permanentGlobalAdministrator'] as const
  const configureNeeded = CONFIGURE_CHECKS.some(check => needs(check).length > 0)
  // "No selected account needs a change" is a finding about the selected
  // accounts, so it stands only where there are some and this procedure's three
  // checks were read for each. With nobody selected it was vacuously true: the
  // tile above it said "Select the intended accounts", and the print and the
  // export carried it as step 3 of the work (R4-44). An unread check is not a
  // pass either. Without the line the three changes stand as they are, for
  // whoever needs them.
  const configureClear = selected.length > 0 && !configureNeeded
    && selected.every(id => preparations.get(id)?.checks.cloudOnly === false || CONFIGURE_CHECKS.every(check => preparations.get(id)?.checks[check] != null))
  const approvedModels = approvedPasskeyModels(ctx.snapshot, ctx.mapping)
  const variants = emergencyRegistrationVariants(registrationTarget).map(variant => ({
    ...variant,
    steps: [...repeatLead, ...variant.steps.slice(0, -1), 'Cannot complete registration sign-in? Use **Troubleshooting → Temporary Access Pass**.', variant.steps.at(-1)!],
  }))
  const customHardware = approvedModels.filter(model => model.source === 'plan' && model.recovery && !/yubikey/i.test(model.name))
  if (customHardware.length) variants.push({
    id: 'approved-hardware',
    label: 'Additional approved hardware key',
    steps: [
      ...repeatLead,
      ...yubiKeySteps(registrationTarget, `approved hardware security key (${customHardware.map(model => `${model.name}, AAGUID ${model.aaguid}`).join('; ')})`).slice(0, -1),
      'Cannot complete registration sign-in? Use **Troubleshooting → Temporary Access Pass**.',
      'Return to IAMAI and select **Scan to update the plan**.',
    ],
  })
  // A new account is needed while fewer than two are selected, or one selected
  // is synchronized (the account card sends it here). Where the selection holds
  // two or more, every one read as cloud-only, nothing here is needed, and the
  // procedure says so as the configuration procedure does. It never did, so
  // with two verified accounts the printed plan and the task list offered
  // "Create an emergency account" as work beside the one task that remained
  // (NEW-Nadia-D12). An unread source is not cloud-only: no line then.
  const createClear = selected.length >= 2 && selected.every(id => preparations.get(id)?.checks.cloudOnly === true)
  const create = domain ? createSteps(domain, false) : [...tenantLead(ctx), 'Open **Entra ID → Custom domain names** and note the tenant’s initial **onmicrosoft.com** domain.', 'Open **Entra ID → Users → New user → Create new user** and create a cloud-only emergency account on that domain.', 'Return to IAMAI and select **Scan to update the plan**.']
  // After the session reminder where there is one: the reminder leads every task.
  const createAt = create[0] === 'Keep your working administrator session open.' ? 1 : 0
  if (createClear) create.splice(createAt, 0, fillText(WORDS.createNotNeeded, { n: selected.length }))
  const tasks: EmergencyAccountTask[] = [
    task({ id: 'create-account', accountId: null, title: 'Create an emergency account', targetUpn: null, required: false, readinessKey: 'account-setup', evidence: null, actionLabel: 'Open creation instructions', steps: create }),
    task({ id: 'configure-account', accountId: null, title: 'Configure an existing account', targetUpn: null, required: false, readinessKey: 'account-setup', evidence: null, actionLabel: 'Open configuration instructions', steps: [
      'Keep your working administrator session open.',
      'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users**.',
      // Each change names the selected accounts that need it; with none needing
      // any, every change stays available as a reference.
      // What this procedure is about, and nothing wider. "No selected account
      // currently needs configuration." sits on a step whose other tile can be
      // saying a passkey is missing, and a reader takes it for the step's
      // all-clear and closes the step. These three changes are the sign-in
      // address, the enabled state and the role; the passkey is its own task.
      ...(configureClear ? [WORDS.configureNotNeeded] : []),
      ...(!configureNeeded || needs('initialDomain').length ? [`${needs('initialDomain').length ? `Open ${named(needs('initialDomain'))}` : 'To change a sign-in address, open the account'}, select **Properties → Edit properties**, change **User principal name** to the tenant’s initial domain${domain ? ` **${safe(domain)}**` : ''}, and save. Do not use this to convert a synchronized identity.`] : []),
      ...(!configureNeeded || needs('enabled').length ? [`${needs('enabled').length ? `Open ${named(needs('enabled'))}` : 'To enable an account, open the account'}, select **Properties → Edit properties → Settings**, set **Account enabled** to **Yes**, and save.`] : []),
      ...(!configureNeeded || needs('permanentGlobalAdministrator').length ? [
        `For a direct role assignment, open **Entra ID → Roles & admins → Global Administrator → Add assignments**, select ${needs('permanentGlobalAdministrator').length ? named(needs('permanentGlobalAdministrator')) : 'the account'}, and complete the assignment.`,
        'If Privileged Identity Management manages the role, open **ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → Global Administrator → Add assignments**. Choose **Assignment type: Active** and **Permanently assigned**.',
      ] : []),
      'Save the changes, reopen the account, and confirm the sign-in address, enabled state, cloud-only identity, and permanent active role.',
      'Return to IAMAI and select **Scan to update the plan**.',
    ] }),
    task({ id: 'set-up-passkey', accountId: null, title: 'Set up an approved passkey', targetUpn: null, required: false, readinessKey: 'recovery-methods', evidence: null, actionLabel: 'Open passkey instructions', steps: variants[0].steps, variants, defaultVariantId: variants[0].id }),
  ]
  const accounts = accountStatuses(ctx, preparations, dedicatedAccountNotes(step))
  const confirmedPriority = (row: EmergencyAccountStatus): number => row.accountId === null ? 0
    : row.title === 'Use a cloud-only account' ? 1
      : row.title === 'Change the sign-in address' ? 2
        : row.title === 'Account disabled' ? 3
          : /Global Administrator/.test(row.title) ? 4
            : row.title === 'Approved passkey needed' || row.title === 'Passkey does not meet planned settings' ? 5
              : Number.POSITIVE_INFINITY
  const next = accounts.map((row, index) => ({ row, index, priority: confirmedPriority(row) })).filter(value => Number.isFinite(value.priority)).sort((a, b) => a.priority - b.priority || a.index - b.index)[0]?.row
  const recommendedTaskId = next?.accountId === null
    ? 'create-account'
    : next?.title === 'Use a cloud-only account'
      ? 'create-account'
    : next?.title === 'Approved passkey needed' || next?.title === 'Passkey does not meet planned settings'
      ? 'set-up-passkey'
      : next && !/could not be verified|check incomplete/i.test(next.title)
        ? 'configure-account'
        : null
  return { tasks, accounts, recommendedTaskId, printAll: true, approvedModels, tapAvailable: null }
}

export function emergencyTaskFacts(task: EmergencyAccountTask, variantId?: string | null): { label: string; value: string }[] {
  const selected = task.variants?.find(variant => variant.id === variantId) ?? task.variants?.find(variant => variant.id === task.defaultVariantId) ?? task.variants?.[0]
  return selected?.facts ?? task.facts ?? []
}

export function emergencyTaskSteps(task: EmergencyAccountTask, variantId?: string | null): string[] {
  if (!task.variants?.length) return task.steps
  const selected = task.variants.find(variant => variant.id === variantId) ?? task.variants.find(variant => variant.id === task.defaultVariantId) ?? task.variants[0]
  if (task.id !== 'prepare-affected-passkeys') return selected.steps
  const closing = task.steps.at(-1)
  return [...task.steps.slice(0, -1), ...selected.steps.filter(line => !/Return to IAMAI.*Scan to update the plan/i.test(line)), ...(closing ? [closing] : [])]
}

export function emergencyTaskText(task: EmergencyAccountTask, variantId?: string | null): string {
  const heading = `**${task.title}**${task.targetUpn ? `\n\nTarget: ${task.targetUpn}` : ''}`
  const taskFacts = emergencyTaskFacts(task, variantId)
  const facts = taskFacts.length ? `\n\n${taskFacts.map(row => `- **${row.label}:** ${row.value}`).join('\n')}` : ''
  return `${heading}${facts}\n\n${emergencyTaskSteps(task, variantId).map((line, index) => `${index + 1}. ${line}`).join('\n')}`
}

/**
 * A task as text for a reader who cannot pick an alternative: every one the
 * screen offers, each under its own label.
 *
 * The screen puts the method choices behind a picker (YubiKey security key,
 * Microsoft Authenticator on iPhone/iPad, on Android, an additional approved
 * key). The flattened text used to take the default alone, unlabelled and
 * numbered on from the shared steps, so the export, AI Info and the Entra
 * artifact told whoever read them to register a YubiKey on thirty-three
 * ordinary accounts, and the Authenticator procedures were gone (R4-32). The
 * lines every alternative shares at its start are said once; each alternative
 * then carries the rest of its own procedure, numbered on from the shared
 * lines as the screen numbers the one it shows. A task with one way to do it
 * reads as before.
 */
export function emergencyTaskAlternativesText(task: EmergencyAccountTask): string {
  const variants = task.variants ?? []
  if (variants.length < 2) return emergencyTaskText(task, task.defaultVariantId)
  const renderings = variants.map(variant => emergencyTaskSteps(task, variant.id))
  const shortest = Math.min(...renderings.map(steps => steps.length))
  let shared = 0
  while (shared < shortest - 1 && renderings.every(steps => steps[shared] === renderings[0][shared])) shared++
  const factLines = (rows: { label: string; value: string }[]): string => rows.map(row => `- **${row.label}:** ${row.value}`).join('\n')
  const numbered = (lines: string[], from: number): string => lines.map((line, index) => `${from + index + 1}. ${line}`).join('\n')
  const common = task.facts ?? []
  const own = (rows: { label: string; value: string }[] | undefined) => (rows ?? []).filter(row => !common.some(other => other.label === row.label && other.value === row.value))
  return [
    `**${task.title}**${task.targetUpn ? `\n\nTarget: ${task.targetUpn}` : ''}`,
    ...(common.length ? [factLines(common)] : []),
    ...(shared ? [numbered(renderings[0].slice(0, shared), 0)] : []),
    WORDS.variantsLead,
    ...variants.flatMap((variant, index) => [
      `**${variant.label}**`,
      ...(own(variant.facts).length ? [factLines(own(variant.facts))] : []),
      numbered(renderings[index].slice(shared), shared),
    ]),
  ].join('\n\n')
}

/** Deterministic flattened output for exports and the Entra artifact: every task, and every alternative within one. */
export function emergencyAccountTasksText(value: Pick<EmergencyAccountTasks, 'tasks' | 'printAll'>): string {
  const required = value.printAll ? value.tasks : value.tasks.filter(item => item.required)
  return required.length
    ? required.map(item => emergencyTaskAlternativesText(item)).join('\n\n')
    : 'No Entra action is currently identified. Review Readiness.'
}
