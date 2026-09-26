// The Entra work for Prepare Emergency Access Accounts, projected from the
// step's structured findings and the scan's passkey compatibility. This module
// is deliberately presentation-only: it does not decide readiness, persist a
// choice, or change tenant state.
import type { Step } from '../../roadmap/types.ts'
import { approvedPasskeyModels, emergencyValidationIssueKey } from '../../roadmap/emergencyJourney.ts'
import type { ApprovedModel } from '../../roadmap/emergencyJourney.ts'
import { emergencyAccountPreparationOf } from '../../roadmap/emergencyAccountPreparation.ts'
import { GLOBAL_ADMIN_ROLE, initialDomain } from '../../validation/rules.ts'
import { SHARED_DEVICE_READING } from '../../copy/validation.ts'
import { oneLine } from '../../content/implementation/project.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { authenticatorPasskeyLines } from '../../content/passkeySetup.ts'
import { list } from '../../copy/statements.ts'
import { tenantNameOf } from './stepVars.ts'
import { operatorUserId } from '../../derive/operator.ts'
import { EMERGENCY_TASK } from '../../roadmap/emergencyTaskTitles.ts'
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
  /** The Threshold card states what this task waits for, so no card of its own is drawn (owner, 2026-09-26). */
  onThresholdCard?: true
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
  /** One line on the account that is signed in to IAMAI (the scan's /me): a fact, never a check. */
  headsUp?: string
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
  /** The step's Next milestone where its task state names one (Configure Emergency Exclusions). */
  milestone?: string | null
  /** A policy step's card where its own tasks are all done and the step still waits (policyTasks.ts policyProcedureOf). */
  waiting?: { title: string; detail: string } | null
}

/** What a procedure says about whether a selected account needs it (pages.app.plan.emergencyTasks). */
const WORDS = (app.plan as unknown as { emergencyTasks: Record<'passkeyNeededOne' | 'passkeyNeededMany' | 'variantsLead' | 'signedInAccount' | 'sharedDeviceLabel', string> }).emergencyTasks

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
    'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users → New user → Create new user**.',
    `Enter a unique username, such as **emergency-access-primary** or **emergency-access-secondary**, or choose another account name. Select **${safe(domain)}** from the domain list.`,
    'Enter a display name that identifies the account’s emergency purpose. Leave **Account enabled** selected.',
    'Store the initial password securely where authorized staff can retrieve it without signing in to this tenant.',
    'Select **Review + create**, check the username and domain, then select **Create**.',
    'Return to IAMAI and select **Scan to update the plan**.',
    'Select the new account under **Emergency access accounts**, then select **Done**.',
    ...(replacement ? ['Keep the existing recovery account and its credentials available until the replacement is fully prepared and final verification succeeds.'] : []),
  ]
}

export function yubiKeySteps(upn: string, device = 'approved YubiKey'): string[] {
  const account = upn === 'the emergency account' ? upn : `**${upn}**`
  return [
    `In a separate browser session, open [Security info](https://mysignins.microsoft.com/security-info) and sign in as ${account}.`,
    'Select **Add sign-in method**, then the passkey or security-key option offered by Microsoft. Choose **Security key** as the storage destination.',
    `Connect the ${device}. Set or enter its PIN and touch the key when prompted.`,
    'Name the new method and finish registration.',
    'Open a separate private browser window and sign in to Microsoft Entra admin center with the new passkey. Confirm the account and tenant, then sign out. Retain the previous working method until this succeeds.',
    `Store the ${device} and its access information securely where authorized staff can retrieve them without this tenant.`,
    'Return to IAMAI and select **Scan to update the plan**.',
  ]
}

export function authenticatorSteps(upn: string, platform: 'iPhone/iPad' | 'Android'): string[] {
  const account = upn === 'the emergency account' ? upn : `**${upn}**`
  return [
    // The one Authenticator procedure every step reads (content/passkeySetup.ts).
    ...authenticatorPasskeyLines(`the recovery ${platform} device`, account),
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
 * The notes an account's card states, read from the step's own findings — the
 * same items Verify Emergency Access shows — so the selection step states them
 * where the selection is made. Notes, never checks: none holds the step.
 * - The dedicated-account signal (bg.notPersonal: populated personal profile
 *   fields, or the account signed in to IAMAI).
 * - An Authenticator device the account shares with another account
 *   (bg.separateDevices, a hardening item), as the fact alone: no instruction and
 *   no reading of the device name (owner, 2026-09-26). It was said only in AI
 *   Info before (owner audit, 2026-09-24).
 */
const NOTE_RULES = ['bg.notPersonal', 'bg.separateDevices'] as const
function dedicatedAccountNotes(step: Step): ReadonlyMap<string, { label: string; value: string }[]> {
  const notes = new Map<string, { label: string; value: string }[]>()
  for (const item of (step.configurationFindings ?? []).flatMap(finding => finding.items ?? [])) {
    if (item.outcome !== 'fail' || !item.accountId) continue
    const rule = NOTE_RULES.find((r) => item.issueKeys?.includes(emergencyValidationIssueKey(r, item.accountId!)))
    if (!rule) continue
    const id = item.accountId.toLowerCase()
    const sentence = `${item.value.charAt(0).toUpperCase()}${item.value.slice(1)}`
    const value = rule === 'bg.separateDevices' ? sentence.replace(`: ${SHARED_DEVICE_READING}`, '').replace(/\.?$/, '.') : item.value
    if ((notes.get(id) ?? []).some((n) => n.value === value)) continue
    // The shared-device note names the finding, never the rule's requirement
    // ("No two emergency accounts share an Authenticator device", over the line
    // saying this one does, read as a pass then a fail: owner audit, 2026-09-24).
    const label = rule === 'bg.separateDevices' ? WORDS.sharedDeviceLabel : item.factLabel ?? item.label
    notes.set(id, [...(notes.get(id) ?? []), { label, value }])
  }
  return notes
}

/**
 * Whether an account is the one signed in to IAMAI: the Plan's operator (the
 * scan's /me, or the account signed in, by sign-in name, as Connect shows it:
 * planData.ts operatorIdOf), or the scan's /me by object id or sign-in name. A
 * fact about the account, never a guess about who uses it.
 */
function signedInAccount(ctx: StepVarContext): (id: string) => boolean {
  const me = (ctx.snapshot.config.me?.rows?.[0] ?? null) as { userPrincipalName?: unknown } | null
  const ids = new Set([ctx.operatorId, operatorUserId(ctx.snapshot)].filter((x): x is string => typeof x === 'string' && x !== '').map(x => x.toLowerCase()))
  const meUpn = typeof me?.userPrincipalName === 'string' && me.userPrincipalName.trim() ? me.userPrincipalName.trim().toLowerCase() : null
  return (id) => ids.has(id.toLowerCase()) || (meUpn !== null && userOf(ctx, id)?.userPrincipalName?.trim().toLowerCase() === meUpn)
}

function accountStatuses(ctx: StepVarContext, preparations: Preparations, notes: ReadonlyMap<string, { label: string; value: string }[]> = new Map(), signedIn: (id: string) => boolean = () => false): EmergencyAccountStatus[] {
  // Numbered by the account's display name, never by the order they were
  // picked: the second account picked read as "Emergency access account 1".
  const displayName = (id: string): string => safe(userOf(ctx, id)?.displayName || targetOf(ctx, id))
  const selected = [...ctx.mapping.breakGlassUserIds].sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base', numeric: true }))
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
    // A check this scan did not settle has no title of its own: it said only
    // that the check could not be verified (owner, 2026-09-23).
    } else if (cloudOnly === null) {
      title = ''
      instruction = 'Scan again so IAMAI can confirm this is a cloud-only account.'
    } else if (rightDomain === null) {
      title = ''
      instruction = 'Scan again so IAMAI can confirm the account uses the tenant onmicrosoft.com domain.'
    } else if (enabled === null) {
      title = ''
      instruction = 'Scan again so IAMAI can confirm the account is enabled.'
    } else if (permanentGa === null) {
      title = ''
      instruction = 'Scan again so IAMAI can confirm the account has permanent, active Global Administrator access.'
    } else if (compatible === null) {
      // Unread reads as not done (owner, 2026-09-24; net-new 1): the account
      // needs its approved passkey until a scan reads one, and the task says how.
      title = 'Approved passkey needed'
      instruction = 'Follow Set up an approved passkey in Implementation Tasks.'
    }
    const remainingCount = checks.every(value => value !== null) ? checks.filter(value => value === false).length : null
    // The account signed in to IAMAI says so in one line, in place of the check's note about it.
    const note = signedIn(id) ? undefined : notes.get(id.toLowerCase())
    return { key: id, accountId: id, heading, upn, title, instruction, completed, remainingCount, satisfied: checks.every(value => value === true), ...(note ? { notes: note } : {}), ...(signedIn(id) ? { headsUp: WORDS.signedInAccount } : {}) }
  })
  // An empty card says only that nothing is chosen: the rail says how to choose.
  // The first one says where to create an account, once.
  while (rows.length < 2) {
    const slot = rows.length + 1
    const first = rows.every(row => row.accountId !== null)
    rows.push({ key: `empty-${slot}`, accountId: null, heading: `Emergency access account ${slot}`, upn: null, title: 'No account selected', instruction: first ? 'To create one, follow Create an emergency account in Implementation Tasks.' : '', completed: [], remainingCount: null, satisfied: false })
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
  // were not read; the line names them, and the procedure is for them. They are
  // named beside any account known to need one: looked for only where none did,
  // the second of two accounts, unread, dropped out of the procedure the export
  // and the print carry while it signed in as the first.
  const unread = selected.filter((_, index) => passkeyChecks[index] === null).map(id => targetOf(ctx, id))
  const toPrepare = [...needing, ...unread]
  const registrationTarget = toPrepare.length === 1 ? toPrepare[0] : 'the account you are preparing'
  const bold = (upns: string[]): string => list(upns.map(upn => `**${upn}**`))
  // More than one account needing a passkey (a new tenant's usual case) names
  // them all on the procedure's first line.
  // No qualifier lines (owner, 2026-09-23): the procedure is always there in
  // full, and names only the accounts that need it.
  const repeatLead = needing.length > 1
    ? [fillText(WORDS.passkeyNeededMany, { accounts: bold(needing) })]
    : needing.length === 1 && unread.length > 0
      ? [fillText(WORDS.passkeyNeededOne, { account: bold(needing) })]
      : []
  // The existing-account procedure names only the accounts whose check fails.
  type ConfigureCheck = 'initialDomain' | 'enabled' | 'permanentGlobalAdministrator'
  const needsIds = (check: ConfigureCheck): string[] => selected.filter(id => preparations.get(id)?.checks.cloudOnly !== false && preparations.get(id)?.checks[check] === false)
  const needs = (check: ConfigureCheck): string[] => needsIds(check).map(id => targetOf(ctx, id))
  const named = (upns: string[]): string => upns.map(upn => `**${upn}**`).join(', ')
  // Global Administrator that is eligible, or active with an end date, is held
  // in Privileged Identity Management and is made permanent and active there.
  // So is an account holding none, in a tenant with PIM (its licence, or any
  // eligible assignment): there Roles & admins → Add assignments opens PIM's
  // wizard, which defaults to Eligible, and an eligible assignment fails the
  // check. Only a tenant with neither gets the direct assignment.
  const holdsGa = (roles: Record<string, string[]>, id: string): boolean => (roles[id] ?? []).some(role => role.toLowerCase() === GLOBAL_ADMIN_ROLE)
  const tenantHasPim = ctx.snapshot.capabilities?.pim?.enabled === true || Object.values(ctx.snapshot.roles.eligible).some(roles => roles.length > 0)
  const viaPim = needsIds('permanentGlobalAdministrator').filter(id => tenantHasPim || holdsGa(ctx.snapshot.roles.active, id) || holdsGa(ctx.snapshot.roles.eligible, id))
  const direct = needsIds('permanentGlobalAdministrator').filter(id => !viaPim.includes(id))
  const CONFIGURE_CHECKS = ['initialDomain', 'enabled', 'permanentGlobalAdministrator'] as const
  const configureNeeded = CONFIGURE_CHECKS.some(check => needs(check).length > 0)
  // "No selected account needs a change" is a finding about the selected
  // accounts, so it stands only where there are some and this procedure's three
  // checks were read for each. With nobody selected it was vacuously true: the
  // tile above it said "Select the intended accounts", and the print and the
  // export carried it as step 3 of the work (R4-44). An unread check is not a
  // pass either. Without the line, the changes listed are the ones needed.
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
  const notes = dedicatedAccountNotes(step)
  const signedIn = signedInAccount(ctx)
  const create = domain ? createSteps(domain, false) : [...tenantLead(ctx), 'Open **Entra ID → Custom domain names** and note the tenant’s initial **onmicrosoft.com** domain.', 'Open **Entra ID → Users → New user → Create new user** and create a cloud-only emergency account on that domain.', 'Return to IAMAI and select **Scan to update the plan**.']
  // The configure procedure is offered only where it has a change to give, or
  // its all-clear. With no account chosen, or none whose checks were read and
  // failed, it was "open Users" then "return and scan" with nothing between
  // (review of #19); the cards and the rail already say to choose the accounts.
  const tasks: EmergencyAccountTask[] = [
    task({ id: 'create-account', accountId: null, title: EMERGENCY_TASK.createAccount, targetUpn: null, required: false, readinessKey: 'account-setup', evidence: null, actionLabel: 'Open creation instructions', steps: create }),
    task({ id: 'configure-account', accountId: null, title: EMERGENCY_TASK.configureAccount, targetUpn: null, required: false, readinessKey: 'account-setup', evidence: null, actionLabel: 'Open configuration instructions', steps: [
      'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users**.',
      // Each change is listed only for the chosen accounts IAMAI's checks say
      // need it, and names them; a change no chosen account needs is not listed
      // (owner, 2026-09-23: four conditional fixes read as work).
      // What this procedure is about, and nothing wider. "No selected account
      // currently needs configuration." sits on a step whose other tile can be
      // saying a passkey is missing, and a reader takes it for the step's
      // all-clear and closes the step. These three changes are the sign-in
      // address, the enabled state and the role; the passkey is its own task.
      // Where no chosen account needs a change, the whole procedure stands, as
      // every procedure does on a finished step (owner, 2026-09-23).
      ...(!configureNeeded ? [
        `Open the account, select **Properties → Edit properties**, change **User principal name** to the tenant’s initial domain${domain ? ` **${safe(domain)}**` : ''}, and save.`,
        'Open the account, select **Properties → Edit properties → Settings**, set **Account enabled** to **Yes**, and save.',
        tenantHasPim
          ? 'Open **ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → Global Administrator → Add assignments**, select the account. Choose **Assignment type: Active** and **Permanently assigned**.'
          : 'Open **Entra ID → Roles & admins → Global Administrator → Add assignments**, select the account, and complete the assignment. If it asks for an assignment type, choose **Active** and **Permanently assigned**.',
      ] : []),
      ...(needs('initialDomain').length ? [`Open ${named(needs('initialDomain'))}, select **Properties → Edit properties**, change **User principal name** to the tenant’s initial domain${domain ? ` **${safe(domain)}**` : ''}, and save.`] : []),
      ...(needs('enabled').length ? [`Open ${named(needs('enabled'))}, select **Properties → Edit properties → Settings**, set **Account enabled** to **Yes**, and save.`] : []),
      ...(direct.length ? [`Open **Entra ID → Roles & admins → Global Administrator → Add assignments**, select ${named(direct.map(id => targetOf(ctx, id)))}, and complete the assignment. If it asks for an assignment type, choose **Active** and **Permanently assigned**.`] : []),
      ...(viaPim.length ? [`Open **ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles → Global Administrator → Add assignments**, select ${named(viaPim.map(id => targetOf(ctx, id)))}. Choose **Assignment type: Active** and **Permanently assigned**.`] : []),
      'Return to IAMAI and select **Scan to update the plan**.',
    ] }),
    task({ id: 'set-up-passkey', accountId: null, title: EMERGENCY_TASK.setUpPasskey, targetUpn: null, required: false, readinessKey: 'recovery-methods', evidence: null, actionLabel: 'Open passkey instructions', steps: variants[0].steps, variants, defaultVariantId: variants[0].id }),
  ]
  const accounts = accountStatuses(ctx, preparations, notes, signedIn)
  const confirmedPriority = (row: EmergencyAccountStatus): number => row.accountId === null ? 0
    : row.title === 'Use a cloud-only account' ? 1
      : row.title === 'Change the sign-in address' ? 2
        : row.title === 'Account disabled' ? 3
          // The unsettled Global Administrator check has no title; its instruction names the role.
          : /Global Administrator/.test(row.title) || (row.title === '' && /Global Administrator/.test(row.instruction)) ? 4
            : row.title === 'Approved passkey needed' || row.title === 'Passkey does not meet planned settings' ? 5
              : Number.POSITIVE_INFINITY
  const next = accounts.map((row, index) => ({ row, index, priority: confirmedPriority(row) })).filter(value => Number.isFinite(value.priority)).sort((a, b) => a.priority - b.priority || a.index - b.index)[0]?.row
  const recommendedTaskId = next?.accountId === null
    ? 'create-account'
    : next?.title === 'Use a cloud-only account'
      ? 'create-account'
    : next?.title === 'Approved passkey needed' || next?.title === 'Passkey does not meet planned settings'
      ? 'set-up-passkey'
      : next && next.title !== ''
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
