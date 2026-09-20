import type { CompiledPackage, PackageState } from '../../content/implementation/protocol.ts'
import { planSafely } from '../../content/implementation/project.ts'
import type { Bindings, ChannelArtifact, RuntimeContext } from '../../content/implementation/project.ts'
import type { Step } from '../../roadmap/types.ts'
import type { StepVarContext } from './stepVars.ts'
import type { Channel, Artifact } from './stepBody.ts'
import { contentTitle, contentStepFor } from '../../content/stepTitle.ts'
import { buildNameDirectory } from '../../names.ts'
import { countryName } from '../../mapping/countries.ts'
import { devicePlanOf, travelCountriesOf } from '../../roadmap/answers.ts'

/** The same resource remains useful when a task moves from preparation to verification. */
export function lifecycleResources(pkg: CompiledPackage, state: PackageState, bindings: Bindings, runtime: RuntimeContext, label: (key: string) => string): ChannelArtifact[] {
  // Read the current state's own reference/verification blocks first. Never select a
  // different mutation state merely to fill a missing format: the planner owns that target.
  return planSafely(pkg, state, bindings, runtime, label).channels
}

const NON_MACHINE = new Set(['s-ladder-operator-passkey', 's-prereq-device-plan', 's-confirm-workloads'])
const NO_EMAIL = new Set(['s-prereq-break-glass', 's-prereq-passkey-settings', 's-ladder-operator-passkey', 's-confirm-workloads', 's-goal-admin-session', 's-prereq-auth-strength', 's-prereq-exclusion-group'])

export function resourceChannelAllowed(step: Step, channel: Channel): boolean {
  if (step.id === 's-verify-mfa' && channel === 'json') return false
  if (channel === 'email' && (NO_EMAIL.has(step.id) || (step.id !== 's-verify-mfa' && !EMAIL[step.id]))) return false
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

const EMAIL: Record<string, { subject: string; body: string }> = {
  's-goal-all-users-no-persistence': { subject: 'Changes to Work Browser Sign-ins', body: 'We are updating browser sign-in settings to reduce the risk of work accounts staying signed in on shared or unattended computers. After the change, you may need to sign in again when you reopen your browser. Keep your approved sign-in method available. Save work before closing the browser and always sign out on shared computers. If you encounter repeated prompts or cannot access a work app, contact IT with the app name and the time of the problem.' },
  's-goal-mfa-all-users': { subject: 'Stronger Sign-in Protection for Your Work Account', body: 'We are strengthening sign-in protection for work accounts. Make sure you have registered an approved authentication method at https://aka.ms/mfasetup and can use it to sign in. Contact IT before the change if you need help registering or cannot use the offered methods. We will confirm the rollout date separately.' },
  's-goal-admin-session': { subject: 'Review Administrator Session Settings', body: 'We are reviewing sign-in session settings for administrator accounts. Test your normal administrative tasks and tell IT about any unexpected prompts or interrupted work so we can coordinate the change.' },
  's-goal-inforcer-mfa': { subject: 'MFA for Inforcer Access', body: 'We are reviewing MFA protection for Inforcer access. Please confirm your work account has an approved MFA method and contact IT if you need help testing sign-in. Tell IT about any unattended job that uses a person’s account so its access path can be reviewed separately.' },
  's-ladder-legacy-auth-inventory': { subject: 'Review Older Sign-In Workflows', body: 'Please identify each application, printer or scheduled job that uses an older client or username-and-password protocol. Include the account, actual protocol, owner, normal and infrequent run schedules, supported replacement and a delivery or access test window.' },
  's-ladder-app-passwords': { subject: 'Coordinate App Password Retirement', body: 'Please identify applications or jobs that use an app password. Arrange a supported replacement and test access with IT before removing the old credential. Confirm the app password has been removed and report any failed workflow so we can finish the change.' },
  's-prereq-exclusion-group': { subject: 'Review Emergency Exclusions', body: 'Please review the emergency-access group and its membership, and confirm the exclusions on the listed existing policies. Let us know if another approved exception needs to remain.' },
  's-prereq-service-accounts-group': { subject: 'Confirm Service Account Use', body: 'Please confirm the jobs each listed account runs. Identify temporary mail exceptions separately from other service access the account still needs. We will use the confirmed list to prepare the group and check its policy scope.' },
  's-prereq-auth-strength': { subject: 'Review Authentication Strength Setup', body: 'Please review the required authentication methods and model restrictions, together with the policies that use this strength. Identify any working method the proposed settings would exclude, and suggest a change window if adjustments are needed.' },
  's-prereq-allowed-countries': { subject: 'Confirm Work Countries', body: 'Please confirm the countries where people normally work and the recurring travel destinations listed below. Recurring travel is recorded separately from the normal-work access policy. Please send any corrections.' },
  's-prereq-trusted-location': { subject: 'Confirm Office Networks', body: 'Please confirm which of the listed named networks belong to our offices. If an office is missing, provide its public egress IP range and location name so we can create the named location in Entra. If everyone works remotely, confirm that instead.' },
  's-prereq-device-plan': { subject: 'Confirm Device Access Requirements', body: 'Please review our proposed phone management, phone app protection and computer management choices below. Identify work apps or devices that need a different arrangement, and confirm who will prepare the required device and app settings.' },
  's-check-dormant-accounts': { subject: 'Review Inactive Accounts', body: 'Please review the listed accounts and last-known activity. Confirm which accounts are still needed and why, which can be disabled, and which need investigation.' },
  's-check-separate-admin-accounts': { subject: 'Plan Separate Administrator Access', body: 'Please confirm the ordinary and dedicated administrator accounts for the people listed below. We need to test that each dedicated account can perform the required work before removing administrative access from the ordinary account. Please suggest a handover time.' },
  's-shared-devices': { subject: 'Test Shared Device Access', body: 'Please review the shared accounts and proposed policy scope below. The device owner needs to test the normal work tasks and sign-in flow before and after the change. Please confirm who will perform the test and report any interruption.' },
  's-goal-guests-mfa': { subject: 'Upcoming Guest MFA Requirements', body: 'We are strengthening MFA requirements for guest access to our organization. Please review the proposed access change with your team and confirm which guest accounts you use. We will coordinate a test before changing access. If you encounter a sign-in problem, contact [administrator contact] with the affected account and time of the attempt.' },
  // Carries the folded mail follow-up's ask as well as its own, since both are
  // now this step's (docs/plans/step-redundancy-analysis.md finding 6).
  's-goal-block-legacy-auth': { subject: 'Review Older Sign-In and Email Methods', body: 'We are preparing to block older username-and-password sign-in methods. Please identify applications, printers or scanners that still depend on them, and confirm the authentication and TLS capabilities, sender and recipient requirements, and a delivery-test window for each. SMTP with OAuth, connector-based relay and Direct Send use different paths; please provide the actual method your device uses.' },
}

/** Neutral coordination language stays truthful before and after a change. */
export function emailResource(step: Step, ctx: StepVarContext, why: string): Artifact {
  const template = EMAIL[step.id]
  if (!template) throw new Error(`No audience email defined for ${step.id}`)
  const countries = step.id === 's-prereq-allowed-countries' ? `\n\nNormal-work countries: ${ctx.mapping.allowedCountries.map(countryName).join(', ') || 'Not selected'}\nRecurring travel destinations: ${travelCountriesOf(ctx.mapping).map(countryName).join(', ') || 'None selected'}` : ''
  const device = devicePlanOf(ctx.mapping)
  const choices = step.id === 's-prereq-device-plan' ? `\n\nPhone Management: ${device?.phonesText ?? 'Not selected'}\nPhone App Protection: ${device?.phoneAppProtection === 'required' ? 'Required' : device?.phoneAppProtection === 'not-required' ? 'Not required' : 'Not selected'}\nComputer Management: ${device?.computersText ?? 'Not selected'}` : ''
  const text = `Subject: ${template.subject}\n\n${template.body}${countries}${choices}\n\n[administrator contact]`
  return { id: 'email', form: 'markdown', lines: [], text: () => text, note: null }
}

export function mfaPreparationEmail(ctx: StepVarContext): Artifact {
  const text = `Subject: Prepare Your Team for MFA\n\nWe are preparing stronger sign-in requirements. Please follow the instructions below to register an approved method and test sign-in. Contact [support contact] if you need help or cannot use the required method.\n\nOpen https://aka.ms/mfasetup, choose Add sign-in method, and register an approved method offered to your account. Follow the setup prompts, then test sign-in using that method.\n\n--- Administrator message ---\nSubject: Prepare Your Administrator Sign-In Method\n\nOpen https://aka.ms/mfasetup with your dedicated administrator account. Register the approved passkey or hardware security key for that account, then complete a test sign-in using it. Contact [support contact] if you need help arranging a test.\n\n--- Follow-up message ---\nSubject: Help Completing Your Sign-In Setup\n\nYour account still needs a suitable registered sign-in method. Open https://aka.ms/mfasetup and complete the approved method setup. Contact [support contact] if you cannot finish so we can arrange hands-on help before the access change.\n\n${ctx.signature}`
  return { id: 'email', form: 'markdown', lines: [], text: () => text, note: null }
}

/** Read-only portal work when an executable policy target is not yet resolved. */
export function policyInspectionLines(step: Step): string[] {
  if (step.id === 's-goal-inforcer-mfa') return [
    'Open Entra admin center → Entra ID → Enterprise applications → All applications.',
    'Find Inforcer by Application ID 708861da-226e-4d65-a57a-24128df64524. Review its users and sign-in logs to confirm the application used by this tenant.',
    'Open Conditional Access → Policies and review policies targeting this application, including broader policies that apply to all resources. Check user assignments, exclusions, MFA access controls and policy state.',
    'After a representative Inforcer sign-in, scan again to update the application evidence and policy findings.',
  ]
  return [
    'Open Entra admin center → Entra ID → Conditional Access → Policies.',
    `Find the policies for ${contentTitle(step)}; compare their assignments, conditions, access controls and current state with the configuration listed on this step.`,
  ]
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
  const references: Record<string, string> = {
    'service accounts group display name': 'the group selected in Create or Correct Service Accounts Group',
    'service accounts group': 'the Object ID on that group’s Overview page in Entra',
    'exclusions group': 'the group selected in Configure Emergency Exclusions',
    'trusted locations display names': 'the named locations selected in Define the Trusted Network',
    'authentication context name': 'the authentication context configured for the intended PIM role',
    'authentication context ID': 'the ID of that context in Conditional Access → Authentication context',
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

/** Concrete workflow checks accompany the setting procedure and its exported copy. */
export function verificationResourceLines(step: Step): string[] {
  const content = contentStepFor(step) as { whatToDo?: { verification?: unknown } } | undefined
  const checks = content?.whatToDo?.verification
  return Array.isArray(checks) && checks.length ? ['Verify the workflow:', ...checks.filter((line): line is string => typeof line === 'string').map((line, i) => `${i + 1}. ${line}`)] : []
}
export function withWorkflowVerification(artifact: Artifact, step: Step): Artifact {
  const lines = artifact.id === 'portal' ? verificationResourceLines(step) : []
  if (!lines.length) return artifact
  const text = `${artifact.text()}\n\n${lines.join('\n')}`
  return { ...artifact, form: 'markdown', lines: [], text: () => text }
}
