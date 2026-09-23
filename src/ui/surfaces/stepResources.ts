import type { CompiledPackage, PackageState } from '../../content/implementation/protocol.ts'
import { planSafely } from '../../content/implementation/project.ts'
import type { Bindings, ChannelArtifact, RuntimeContext } from '../../content/implementation/project.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Channel, Artifact } from './stepBody.ts'
import { contentTitle, contentStepFor } from '../../content/stepTitle.ts'
import { buildNameDirectory } from '../../names.ts'
import { countryName } from '../../mapping/countries.ts'
import { answerOf, devicePlanOf, effectLine, travelCountriesOf } from '../../roadmap/answers.ts'
import type { MappingState } from '../../mapping/types.ts'
import { HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { app, structuralWords } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { reportOnlyPatchOf, switchedOffPolicy, unavailableReason } from '../../roadmap/operations.ts'
import type { PolicyOperation } from '../../roadmap/types.ts'
import { powershellFor } from './stepPowerShell.ts'

/**
 * Where a lifecycle resource would print a value IAMAI does not hold: U+E000, the
 * first private-use code point, which no binding or authored line carries. Never
 * shown: a channel carrying it is dropped.
 */
const UNBOUND = '\uE000'

/**
 * The same resource remains useful when a task moves from preparation to
 * verification — but only a channel whose every value IAMAI holds.
 *
 * Callers used to hand in a label for a missing value, and both passed the raw
 * binding key: `‹policies guests mixed target displayName›`. With one of the
 * guests pair resolved, the Entra channel read "Create the two guest policies
 * separately" with the second policy named by that key, and the task list and
 * the AI briefing, which read the Entra channel, repeated it. A name IAMAI does
 * not hold cannot be typed into the portal, and the name plus the plan tag is how
 * IAMAI recognises the policy afterwards. The screen and the export already fall
 * back to the step's own resolved lines, or to a read-only inspection, where no
 * channel comes from here, so dropping the channel is the whole fix.
 */
export function lifecycleResources(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext): ChannelArtifact[] {
  // Read the current state's own reference/verification blocks first. Never select a
  // different mutation state merely to fill a missing format: the planner owns that target.
  return planSafely(pkg, state, bindings, runtime, () => UNBOUND).channels.filter((a) => !JSON.stringify(a).includes(UNBOUND))
}

const NON_MACHINE = new Set(['s-ladder-operator-passkey', 's-prereq-device-plan', 's-confirm-workloads'])
const NO_EMAIL = new Set(['s-prereq-break-glass', 's-prereq-passkey-settings', 's-ladder-operator-passkey', 's-confirm-workloads', 's-goal-admin-session', 's-prereq-auth-strength', 's-prereq-exclusion-group'])

export function resourceChannelAllowed(step: Step, channel: Channel): boolean {
  if (step.id === 's-verify-mfa' && channel === 'json') return false
  if (channel === 'email' && (NO_EMAIL.has(step.id) || (step.id !== 's-verify-mfa' && !EMAILS.steps[step.id]))) return false
  if ((channel === 'ps' || channel === 'json') && NON_MACHINE.has(step.id)) return false
  return true
}

const ENDPOINTS: Record<string, string[]> = {
  's-prereq-break-glass': ['/users?$select=id,displayName,userPrincipalName,accountEnabled', '/roleManagement/directory/roleAssignments'],
  's-prereq-exclusion-group': ['/groups?$select=id,displayName,securityEnabled', '/identity/conditionalAccess/policies'],
  's-prereq-service-accounts-group': ['/groups?$select=id,displayName,securityEnabled'],
  's-prereq-auth-strength': ['/identity/conditionalAccess/authenticationStrength/policies?$expand=combinationConfigurations'],
  's-prereq-passkey-settings': ['/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2'],
  's-prereq-allowed-countries': ['/identity/conditionalAccess/namedLocations'],
  's-prereq-trusted-location': ['/identity/conditionalAccess/namedLocations'],
  's-prereq-security-defaults': ['/policies/identitySecurityDefaultsEnforcementPolicy'],
  's-prereq-per-user-mfa': ['/policies/authenticationMethodsPolicy'],
  's-check-dormant-accounts': ['/users?$select=id,displayName,userPrincipalName,accountEnabled,signInActivity'],
  's-check-separate-admin-accounts': ['/roleManagement/directory/roleAssignments', '/roleManagement/directory/roleEligibilityScheduleInstances'],
  's-verify-mfa': ['/reports/authenticationMethods/userRegistrationDetails'],
}

function endpoints(step: Step): string[] {
  return ENDPOINTS[step.id] ?? ['/identity/conditionalAccess/policies']
}

/** A real inspection request when no resolved mutation exists. It never invents a target. */
export function inspectionResource(step: Step, channel: 'ps' | 'json'): Artifact {
  const requests = endpoints(step).map((url, index) => ({ id: String(index + 1), method: 'GET', url }))
  const title = contentTitle(step).replace(/[\r\n]/g, ' ')
  const text = channel === 'json'
    ? JSON.stringify({ requests }, null, 2)
    : [`# ${title}: inspect the current configuration`, '# Run in a Microsoft Graph PowerShell session with the corresponding read permissions.',
      ...requests.flatMap(r => [`$uri = '${('https://graph.microsoft.com/v1.0' + r.url).replace(/'/g, "''")}'`, 'do {', '  $result = Invoke-MgGraphRequest -Method GET -Uri $uri', '  if ($result.ContainsKey("value")) { $result.value | ConvertTo-Json -Depth 30 } else { $result | ConvertTo-Json -Depth 30 }', '  $uri = $result["@odata.nextLink"]', '} while ($uri)', ''])].join('\n')
  return { id: channel, form: 'code', lines: [], text: () => text, note: channel === 'json' ? 'POST https://graph.microsoft.com/v1.0/$batch · read-only GET requests' : null }
}

/**
 * The audience emails, in content (pages.app.plan.stepContract.implementation.emails).
 *
 * They used to be written here, ending "[administrator contact]" and asking
 * people to "Contact [support contact]": a bracketed fill-in nobody was told to
 * fill, in an email the Prepare Your Team step says to send, so it went out as
 * written (Nadia D10). Every message now asks people to contact IT, as the other
 * emails always did, and is signed with the plan's email signature (Plan
 * settings), as Tell your people is.
 */
type EmailWords = {
  subject: string
  signOff: string
  steps: Record<string, { subject: string; body: string }>
  countries: string[]
  devicePlan: string[]
  notSelected: string
  noneSelected: string
  required: string
  notRequired: string
  mfaPreparation: { heading: string | null; subject: string; paragraphs: string[] }[]
}
const EMAILS = (app.plan as unknown as { stepContract: { implementation: { emails: EmailWords } } }).stepContract.implementation.emails

/** One message: its subject, its paragraphs, and the plan's signature under them. */
function message(subject: string, paragraphs: string[], ctx: StepVarContext): string {
  const signature = fillText(EMAILS.signOff, { signature: ctx.signature }).trim()
  return [fillText(EMAILS.subject, { subject }), ...paragraphs, ...(signature ? [signature] : [])].join('\n\n')
}

/** Neutral coordination language stays truthful before and after a change. */
export function emailResource(step: Step, ctx: StepVarContext, why: string): Artifact {
  // s-goal-block-legacy-auth carries the folded mail follow-up's ask as well as
  // its own, since both are now this step's (docs/plans/step-redundancy-analysis.md finding 6).
  const template = EMAILS.steps[step.id]
  if (!template) throw new Error(`No audience email defined for ${step.id}`)
  const listed = (lines: string[], ex: Record<string, string>): string => lines.map((l) => fillText(l, ex)).join('\n')
  const device = devicePlanOf(ctx.mapping)
  const extra = step.id === 's-prereq-allowed-countries'
    ? [listed(EMAILS.countries, { countries: ctx.mapping.allowedCountries.map(countryName).join(', ') || EMAILS.notSelected, travel: travelCountriesOf(ctx.mapping).map(countryName).join(', ') || EMAILS.noneSelected })]
    : step.id === 's-prereq-device-plan'
      ? [listed(EMAILS.devicePlan, { phones: device?.phonesText ?? EMAILS.notSelected, appProtection: device?.phoneAppProtection === 'required' ? EMAILS.required : device?.phoneAppProtection === 'not-required' ? EMAILS.notRequired : EMAILS.notSelected, computers: device?.computersText ?? EMAILS.notSelected })]
      : []
  const text = message(template.subject, [template.body, ...extra], ctx)
  return { id: 'email', form: 'markdown', lines: [], text: () => text, note: null }
}

/** The MFA preparation step's three messages (everyone, the admins, the follow-up), each signed. */
export function mfaPreparationEmail(ctx: StepVarContext): Artifact {
  const text = EMAILS.mfaPreparation.map((m) => (m.heading ? `${m.heading}\n` : '') + message(m.subject, m.paragraphs, ctx)).join('\n\n')
  return { id: 'email', form: 'markdown', lines: [], text: () => text, note: null }
}

/**
 * A policy this plan tracks that the tenant has switched off, set to Report-only
 * (pages.app.plan.switchedOffSteps): open the one that is there, check it, set
 * Enable policy to Report-only, scan. Never On, and never a second policy; the
 * step's ordinary report-only watch decides the turn-on after the next scan.
 * Null on every other step.
 */
export function switchedOffLines(step: Step, tenant: string): string[] | null {
  const off = unavailableReason(step) === 'switched-off' ? switchedOffPolicy(step) : null
  if (off === null) return null
  return structuralWords.switchedOffSteps.map((line) => fillText(line, { policy: off.name, id: off.id, tenant }))
}

/** The Graph request a switched-off step hands over: the one-field patch to its own policy (operations.ts reportOnlyPatchOf). */
export function switchedOffRequest(step: Step, ctx: StepVarContext): { op: PolicyOperation; text: string; method: string; endpoint: string } | null {
  const op = reportOnlyPatchOf(step, (ctx.snapshot.config.caPolicies?.rows ?? []) as unknown[])
  if (op === null || op.mode !== 'update') return null
  return { op, text: JSON.stringify(op.body, null, 2), method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${op.policyId}` }
}

/**
 * The channels a switched-off step draws, all saying the same change: the
 * portal lines, and the patch as JSON and as PowerShell. Empty on every other
 * step. Where the scan does not hold the policy's own object the patch cannot
 * be stated, and the JSON and PowerShell fall back to inspecting it.
 */
export function switchedOffResources(step: Step, ctx: StepVarContext, tenant: string): Artifact[] {
  const lines = switchedOffLines(step, tenant)
  if (lines === null) return []
  const out: Artifact[] = [{ id: 'portal', form: 'list', lines, text: () => lines.map((line, i) => `${i + 1}. ${line}`).join('\n'), note: null }]
  const request = switchedOffRequest(step, ctx)
  if (request === null) return out
  const ps = powershellFor([request.op])
  out.push({ id: 'ps', form: 'code', lines: [], text: () => ps, note: null })
  out.push({ id: 'json', form: 'code', lines: [], text: () => request.text, note: `${request.method} ${request.endpoint}` })
  return out
}

/** Read-only portal work when an executable policy target is not yet resolved. */
export function policyInspectionLines(step: Step): string[] {
  if (step.id === 's-goal-inforcer-mfa') return [
    'Open Entra admin center → Entra ID → Enterprise applications → All applications.',
    'Find Inforcer by Application ID 708861da-226e-4d65-a57a-24128df64524. Review its users and sign-in logs to confirm the application used by this tenant.',
    'Open Conditional Access → Policies and review policies targeting this application, including broader policies that apply to all resources. Check user assignments, exclusions, MFA access controls and policy state.',
    'After a representative Inforcer sign-in, scan again to update the application evidence and policy findings.',
  ]
  const open = 'Open Entra admin center → Entra ID → Conditional Access → Policies.'
  // The policies IAMAI matched to this step, by name and object id
  // (roadmap/tracking.ts `members`). A step reaches these lines only when it has
  // no operation to hand over — it is already enforced, or its target cannot be
  // resolved — and such a step lists no configuration. The instruction used to
  // send the operator to compare "with the configuration listed on this step",
  // which listed none, so the comparison could not be made and the step was put
  // down. The match is a fact the engine already holds; the criteria it is
  // checked against are this step's own, under its last heading.
  const matched = (step.tracking?.members ?? []).filter((m) => m.policyName)
  const criteria = taskHeadingsOf(step.id)?.doneWhen ?? HEAD.doneWhen
  if (matched.length === 0) return [open, `Review the policies that affect ${contentTitle(step)}: their assignments, conditions, access controls and current state.`]
  return [open, ...matched.map((m) => `Open “${m.policyName}”${m.policyId ? ` (${m.policyId})` : ''} — the policy IAMAI matched to this step — and check its assignments, conditions, access controls and state against ${criteria} on this step.`)]
}

/** Essential setup belongs beside the decision, not exclusively in the AI prompt. */
export function deviceSetupResource(ctx: StepVarContext): Artifact {
  const plan = devicePlanOf(ctx.mapping)
  const lines = [
    'Save the phone, app and computer choices on this step.',
    'For Entra registration, connect the work account on the device and verify its device identity in Entra ID → Devices. Registration identifies the device; it does not enroll it in Intune.',
    'For Intune enrollment, use Intune admin center → Devices → Enrollment to configure the chosen platform, enroll the devices, and assign a compliance policy. Check their reported compliance before requiring compliant-device access.',
    'For hybrid joined computers, verify the hybrid join configuration and the computer’s join state before including it in the managed-device policy.',
  ]
  if (!plan || plan.phoneAppProtection !== 'not-required') {
    lines.push('For protected phone apps, open Intune admin center → Apps → App protection policies. Create or review policies for iOS/iPadOS and Android, select the work apps, set the required data-transfer, storage and access settings, and assign the policies to the intended users.')
    lines.push('Test each supported work app with a representative user and confirm that its app-protection policy is applied. Use the platform’s required broker or registration flow when prompted; app protection and device enrollment are separate choices.')
  }
  lines.push('The managed-device policy shows its actual accepted controls and platform scope. Verify those settings after applying the change, then scan again.')
  return { id: 'portal', form: 'list', lines, text: () => lines.map((line, i) => `${i + 1}. ${line}`).join('\n'), note: null }
}

export function namedPortalResource(artifact: Artifact, ctx: StepVarContext): Artifact {
  if (artifact.id !== 'portal') return artifact
  // Most action sentences contain no object IDs. Resolve names only when a
  // reference is actually present, retaining this call's snapshot and scope.
  let directory: ReturnType<typeof buildNameDirectory> | undefined
  let names: Map<string | undefined, string | undefined> | undefined
  // Each gloss points at the step that makes the object. The authentication
  // context had two that pointed at nothing: "the authentication context
  // configured for the intended PIM role" on the step that creates the policy,
  // which is before any role may be pointed at it, and "the ID of that context in
  // Conditional Access → Authentication context" for a context no step makes. They
  // turned the ID IAMAI had dropped into a copyable sentence on a Ready · Create
  // row (R4-18). The ID is bound now (stepPackage.ts packageBindings); where it
  // cannot be, the preview keeps its ‹…› marker, which says it is unresolved.
  const references: Record<string, string> = {
    'service accounts group display name': 'the group selected in Create or Correct Service Accounts Group',
    'service accounts group': 'the Object ID on that group’s Overview page in Entra',
    'exclusions group': 'the group selected in Configure Emergency Exclusions',
    'trusted locations display names': 'the named locations selected in Define the Trusted Network',
    'browser session policy name': 'the browser-session policy named in this step',
    'authentication strength name': 'the strength configured in Create the Baseline’s Authentication Strength',
    'grant controls': 'the access controls listed in Settings for This Action',
  }
  const fill = (line: string) => line.replace(/‹([^›]+)›/g, (match, key: string) => references[key] ?? match).replace(/\b(?:ID\s+)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi, (match, id: string) => {
    directory ??= buildNameDirectory(ctx.snapshot, ctx.groups)
    names ??= new Map(ctx.snapshot.config.caPolicies.rows.map(row => { const p = row as { id?: string; displayName?: string }; return [p.id, p.displayName] }))
    const name = names.get(id) ?? directory.nameOf(id)
    return name && name !== id && !line.includes(name) ? `${/^ID\s/i.test(match) ? 'ID ' : ''}“${name.replace(/[\r\n]/g, ' ')}” (${id})` : match
  })
  const text = artifact.text().split('\n').map(fill).join('\n')
  return { ...artifact, lines: artifact.lines.map(fill), text: () => text }
}

/**
 * Concrete workflow checks accompany the setting procedure and its exported copy.
 *
 * They open on what the person recorded, where the step's content says it for
 * that answer (whatToDo.verificationLead, one entry per decision option, read as
 * a decision's per-option effect is read). With "None" saved on the device code
 * decision the checks still opened on "Identify the legitimate tools or devices
 * using device code. Move each required workflow…" as if nothing had been
 * answered: the answer reached the lane's condition (planLanes.ts) and nothing the
 * person reads (R4-29, Marcus D10). The checks themselves stay on every answer —
 * None is also what the decision asks to be saved once each workflow has moved
 * off, and the checks are the test of those moves. Their heading is the step's
 * headings' own (HEAD.verifyWorkflow), not a literal written here.
 */
export function verificationResourceLines(step: Step, mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  const content = contentStepFor(step) as { whatToDo?: { verification?: unknown; verificationLead?: unknown } } | undefined
  const checks = content?.whatToDo?.verification
  if (!Array.isArray(checks) || checks.length === 0) return []
  const lead = effectLine(content?.whatToDo?.verificationLead, answerOf(mapping, step.id, 'decision'))
  return [HEAD.verifyWorkflow, ...(lead === null ? [] : [lead]), ...checks.filter((line): line is string => typeof line === 'string').map((line, i) => `${i + 1}. ${line}`)]
}
export function withWorkflowVerification(artifact: Artifact, step: Step, mapping: Pick<MappingState, 'questionAnswers'>): Artifact {
  const lines = artifact.id === 'portal' ? verificationResourceLines(step, mapping) : []
  if (!lines.length) return artifact
  const text = `${artifact.text()}\n\n${lines.join('\n')}`
  return { ...artifact, form: 'markdown', lines: [], text: () => text }
}
