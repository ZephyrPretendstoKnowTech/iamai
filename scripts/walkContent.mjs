// The walk's invariants over the content file itself (docs/design/step-audit.md).
//
//   node scripts/walkContent.mjs [path/to/content.json] [--links]
//
// The walk (walk.mjs) calls contentFindings over docs/design/content.json on
// every run; this CLI runs the same checks over any content file, so an
// invariant can be shown failing on the content before a fix and passing after
// it. Each audit item's acceptance is one entry in ACCEPTANCE: the step (or
// cleanup row), the key, what its text must say and must no longer say. The
// structural checks cover every step at once.
//
// Pure: no DOM; the network only behind --links.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MONTH = '(January|February|March|April|May|June|July|August|September|October|November|December)'
// A hard date: a month name with a day or a year beside it, or a bare year. A
// variable ({enforceLong}) is not one; the example blocks are not content.
const HARD_DATE = new RegExp(`\\b${MONTH}\\s+\\d{1,2}(,\\s*\\d{4})?\\b|\\b${MONTH}\\s+(19|20)\\d{2}\\b|\\b(19|20)\\d{2}\\b`)
// "Tick", "ticked", "Untick": the checkbox vocabulary the typeahead's chips replaced.
const TICK = /\b(un)?tick(ed|s|ing)?\b/i

/** Every string under a node, with its path; `example` blocks and comments are skipped. */
export function strings(node, path = '', out = []) {
  if (typeof node === 'string') out.push([path, node])
  else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (k !== 'example' && k !== '$comment') strings(v, path ? `${path}.${k}` : k, out)
  return out
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
const textAt = (obj, path) => strings(get(obj, path)).map(([, s]) => s).join('\n')
const test = (re, text) => (re instanceof RegExp ? re.test(text) : text.includes(re))

// One entry per audit item. `path` is a key inside the step (dotted); the check
// reads every string under it. An entry that names neither a step nor a cleanup
// row reads `path` from the content root instead, for words that belong to no
// single step. `must` is the acceptance; `mustNot` the wording it replaced, so
// the entry fails on the content before the fix.
export const ACCEPTANCE = [
  // C2: the Learn links that answered 404 or opened the wrong page. The audit's
  // guest URL (policy-old-require-mfa-b2b) answers 404 itself; the B2B MFA
  // tutorial is the page. The audit's Intune-enrollment URL answers 404 too, and
  // the audit said keep the current one in that case.
  { item: 'C2', step: 's-check-dormant-accounts', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts', mustNot: '/users/users-inactive' },
  { item: 'C2', step: 'admins-phishing-resistant', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/policy-admin-phish-resistant-mfa', mustNot: 'policy-admin-phishing-resistant-mfa' },
  // The howto- path still serves this page, but the page declares
  // policy-block-legacy-authentication as its canonical URL, which is also the
  // one the step's package cites: one fact, one source
  // (docs/plans/close-doors-spec.md A5, checked 2026-09-19).
  { item: 'C2', step: 'block-legacy-auth', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/policy-block-legacy-authentication', mustNot: 'howto-conditional-access-policy-block-legacy' },
  { item: 'C2', step: 's-prereq-exclusion-group', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#conditional-access-considerations', mustNot: 'plan-conditional-access' },
  { item: 'C2', step: 's-prereq-service-accounts-group', path: 'learn.url', must: 'https://learn.microsoft.com/entra/architecture/secure-service-accounts', mustNot: 'conditional-access/workload-identity' },
  { item: 'C2', step: 'admin-portals-protected', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps#microsoft-admin-portals', mustNot: 'policy-old-require-mfa-admin' },
  // MFA for Everyone E7 (docs/plans/mfa-everyone-spec.md section 6, checked
  // 2026-09-20): the tutorial does not carry the facts this step now states —
  // which methods an external user can use in the resource tenant, and what the
  // home tenant's MFA claim covers. The page that does is the step's link.
  { item: 'C2', step: 'guests-mfa', path: 'learn.url', must: 'https://learn.microsoft.com/entra/external-id/authentication-conditional-access', mustNot: 'policy-all-users-mfa-strength' },
  { item: 'C2', step: 'intune-enrollment-reauth', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-session-lifetime' },
  { item: 'C2', cleanup: 'alerting', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#monitor-sign-in-and-audit-logs' },
  { item: 'C2', cleanup: 'drill', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#monitor-sign-in-and-audit-logs' },
  { item: 'C2', cleanup: 'naming', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access' },
  { item: 'C2', cleanup: 'consolidation', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access' },
  // C4: a manager line never asserts "nobody here used it" unconditionally; the
  // clause returns under the engine's `applies` when the evidence count is zero.
  { item: 'C4', step: 'block-device-code', path: 'more.manager', must: 'A sign-in flow often abused in phishing is turned off.', mustNot: /nobody here/i },
  { item: 'C4', step: 'block-auth-transfer', path: 'more.manager', must: 'Signing in by transferring a session from another device is turned off', mustNot: /nobody here/i },
  { item: 'C4', step: 'geo-restriction', path: 'more.manager', must: 'Sign-ins from countries outside the approved list are blocked', mustNot: /nobody signed in/i },
  // C7: the security-defaults switch is dated to the day Require MFA for Everyone
  // enforces, with the other three replacement policies the same day.
  // MFA for Everyone F1-F6 (docs/plans/mfa-everyone-spec.md section 7, Microsoft
  // Learn checked 2026-09-20): security defaults now block device code flow too,
  // so the replacement list is four policies, not three; and no Learn page says
  // a report-only policy may coexist with security defaults — what Learn says is
  // that creating Conditional Access policies prevents enabling them.
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', must: 'once these policies exist you cannot turn security defaults back on. On the day Require MFA for Everyone enforces, and not before:', mustNot: '{firstPolicy}' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', mustNot: 'Report-only policies can exist while security defaults are on' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', must: 'enable Require MFA for Everyone, Block Legacy Authentication, Block Device Code Sign-in and Require Phishing-Resistant MFA for Admins in the same change window' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', must: 'Disabled (not recommended)' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'doneWhen', must: 'Security defaults are off; Require MFA for Everyone, Block Legacy Authentication, Block Device Code Sign-in and Require Phishing-Resistant MFA for Admins are enforced.' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'more.helpDesk', must: 'Prompts on the switch day are the new MFA policy; anyone without a method gets a Temporary Access Pass.' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'more.risks', must: 'Security defaults also block device code sign-in' },
  // Per step, 1–10.
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.mfa-method', must: 'register a passkey from the approved model list', mustNot: /hardware security key \(FIDO2\).*not a passkey in Authenticator/i },
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.recent-sign-in', must: '{name} signed in {ago}, not a recorded drill: confirm who signed in and why.', mustNot: 'run the drill' },
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.second-account-none', must: 'Create two accounts: one is a single point of failure.' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes', must: 'only the emergency accounts belong here', mustNot: 'each extra member is an account no policy applies to' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes.not-mail-enabled', must: 'recreate it as a plain security group', mustNot: 'remove the mail address and the licence' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes.no-admin-members', must: 'besides the emergency accounts' },
  { item: '3', step: 's-check-dormant-accounts', path: 'title', must: 'Disable or Confirm Dormant Accounts', mustNot: 'Address Problematic Accounts' },
  { item: '3', step: 's-check-dormant-accounts', path: 'who', must: 'Last sign-in dates need Entra ID P1; without it every account here reads no sign-in on record.' },
  { item: '4', step: 's-prereq-allowed-countries', path: 'decision.help', must: 'Select the countries where people normally work.', mustNot: /add one people (will )?travel to/ },
  // Control Where People Sign In From T2-T4 (docs/plans/where-people-sign-in-spec.md
  // section 3, Microsoft Learn checked 2026-09-20): the step told an admin not to
  // enter a range Entra rejects anyway, and stated a risk-score effect Learn does
  // not claim. `concept-assignment-network` (ms.date 2026-04-01) says "Only CIDR
  // masks greater than /8 are allowed", and "Sign-ins from trusted named
  // locations improve the accuracy of Microsoft Entra ID Protection's risk
  // calculation" — accuracy, not a lower score.
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: "as narrow as the network owner's allocation", mustNot: '/32 or a /24' },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: 'Entra accepts only masks greater than /8', mustNot: 'never 0.0.0.0/0' },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: 'Ask the network owner for the approved public IPv4 and IPv6 ranges' },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: "being seen does not approve them" },
  { item: '5', step: 's-prereq-trusted-location', path: 'more.risks', must: "improve the accuracy of Microsoft Entra ID Protection's risk calculation, so keep the ranges tight.", mustNot: 'lowers Identity Protection risk scores' },
  { item: '5', step: 's-prereq-trusted-location', path: 'more.risks', must: 'cannot be deleted until the trusted mark is removed' },
  { item: '6', step: 's-prereq-service-accounts-group', path: 'ifWrong', must: 'Remove the account from the group; the policies apply again on its next sign-in.' },
  { item: '6', step: 's-prereq-service-accounts-group', path: 'more.risks', must: 'see Restrict Service Accounts to the Trusted Network' },
  { item: '7', step: 's-shared-devices', path: 'whatToDo.steps', must: 'Exclude: {trustedLocation}', mustNot: 'Require device to be marked as compliant' },
  { item: '7', step: 's-shared-devices', path: 'doneWhen', must: 'Each shared device completes its required work tasks from the approved network', mustNot: 'requires a compliant device' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'whatToDo.lead', must: 'On the day Require MFA for Everyone enforces, and not before:' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'more.risks', must: 'Disabling per-user MFA before the policy enforces removes MFA for that person.' },
  // MFA for Everyone G1-G7 (docs/plans/mfa-everyone-spec.md section 8, Microsoft
  // Learn checked 2026-09-20): the step's outcome is the per-user state, not the
  // methods-policy migration, which its own Completion Criteria already said.
  { item: '9', step: 's-prereq-per-user-mfa', path: 'whatToDo.steps', must: 'Per-user MFA → select the accounts above → Disable MFA', mustNot: 'Manage migration → Migration complete.' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'whatToDo.steps', must: 'it never requires MFA, so finishing its migration is not what finishes this step' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'why', must: 'asked for MFA at every sign-in whatever the policy decides' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'more.risks', must: 'skip for federated requests from your intranet' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/monitoring-health/recommendation-turn-off-per-user-mfa', mustNot: 'how-to-authentication-methods-manage' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'whatToDo.steps', must: 'Enforce attestation: Yes; it applies to new registrations only.' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'whatToDo.steps', must: 'Microsoft Authenticator → Enable: On, All users, for push and codes', mustNot: 'so passkeys in the app can be registered' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'more.risks', must: 'Synced passkeys (iCloud Keychain, Google Password Manager) fail attestation and cannot register under these settings.' },
  // Per step, 11–20.
  { item: '11', step: 's-prereq-auth-strength', path: 'whatToDo.steps', must: 'plus Temporary Access Pass (one-time and multi-use) for first sign-ins', mustNot: 'with a one-time pass for first sign-ins' },
  { item: '11', step: 's-prereq-auth-strength', path: 'ifWrong', must: 'Delete the strength; no policy references it yet.' },
  // 12 says "or" (E7): a passkey or a security key is enough; either is phishing-resistant.
  // The two are now named by the menu entries Microsoft documents, which differ
  // (docs/plans/protect-admins-spec.md section 2); the "either" is what item 12 owns.
  { item: '12', step: 's-ladder-operator-passkey', path: 'whatToDo.steps', must: 'Either one is enough, and Microsoft recommends a security key for elevated privileges.', mustNot: 'security key (survives a lost phone) and a passkey' },
  { item: '12', step: 's-ladder-operator-passkey', path: 'more.risks', must: 'Keep a hardware security key under your control and protect its PIN.' },
  // 13's date and window are the engine's (E7): the day Require MFA for Everyone enforces, and the campaign's window.
  { item: '13', step: 's-verify-mfa', path: 'who.timeline', must: 'Require MFA for Everyone is planned for {mfaEnforce}', mustNot: '{firstEnforce}' },
  { item: '13', step: 's-verify-mfa', path: 'comms.body', must: 'from {mfaEnforceLong}.', mustNot: '{firstEnforceLong}' },
  { item: '13', step: 's-verify-mfa', path: 'comms.body', must: 'Over the next {enrolWindowDays} days', mustNot: 'over the next two weeks' },
  { item: '13', step: 's-verify-mfa', path: 'whatToDo.steps', must: 'Admins: a passkey or a hardware security key; either is phishing-resistant.', mustNot: 'a hardware security key as well' },
  { item: '13', step: 's-verify-mfa', path: 'whatToDo.generic', must: 'Registration campaign' },
  // MFA for Everyone C1-C9 (docs/plans/mfa-everyone-spec.md section 4, Microsoft
  // Learn checked 2026-09-20): the campaign nudges passkeys as well as the
  // Authenticator app, one method at a time, and a passkey campaign reaches no
  // guest. Completion Criteria is one thing per line.
  { item: '13', step: 's-verify-mfa', path: 'doneWhen', must: 'Every administrator has a phishing-resistant method.', mustNot: 'a passkey and a security key' },
  { item: '13', step: 's-verify-mfa', path: 'whatToDo.generic', must: 'either Passkey (FIDO2) or Microsoft Authenticator', mustNot: 'Check the separate passkey registration instructions for passkeys' },
  { item: '13', step: 's-verify-mfa', path: 'whatToDo.generic', must: 'A passkey campaign does not nudge guests' },
  { item: '13', step: 's-verify-mfa', path: 'whatToDo.generic', must: 'Days allowed to snooze and Limited number of snoozes' },
  { item: '14', step: 'mfa-all-users', path: 'who.evidence', must: 'This policy uses Require multifactor authentication.', mustNot: 'requires one the moment a sign-in looks wrong' },
  { item: '14', step: 'mfa-all-users', path: 'who.evidence', must: 'Stronger method requirements belong to the separate policies that select an authentication strength.' },
  // MFA for Everyone D1-D3 (docs/plans/mfa-everyone-spec.md section 5, Microsoft
  // Learn checked 2026-09-20): the reference procedure named an authentication
  // strength where the pin is builtInControls ["mfa"], and Learn says a policy
  // cannot carry both controls. One fact, one source: the pin's.
  { item: '14', step: 'mfa-all-users', path: 'whatToDoReference.steps', must: 'Grant → Require multifactor authentication.', mustNot: 'Grant → Require authentication strength: Multifactor authentication' },
  { item: '14', step: 'mfa-all-users', path: 'more.risks', must: 'Microsoft is retiring both, and a person left with nothing else is made to register a passkey', mustNot: 'waiting on a text that does not arrive' },
  { item: '14', step: 'mfa-all-users', path: 'more.helpDesk', must: "cannot rename or delete is Microsoft's own managed one" },
  { item: '15', step: 'admins-phishing-resistant', path: 'who.evidence', must: 'Limit How Long Sessions Last', mustNot: 'End Browser Sessions When the Browser Closes' },
  { item: '15', step: 'admins-phishing-resistant', path: 'who.evidence', mustNot: '{list:adminsWith}' },
  { item: '15', step: 'admins-phishing-resistant', path: 'comms.body', must: 'sign-ins by your admin account at {tenant} will need a passkey or a security key', mustNot: 'admin sign-ins at {tenant}' },
  { item: '16', step: 'admin-portals-protected', path: 'more.risks', must: 'Anyone with an Azure RBAC role but no directory role is blocked from the Azure portal and CLI' },
  // Run 1B: the baseline defines this policy two ways, so the step states the
  // conflict and promises no enforcement — the who line no longer says who is
  // spared, and the announcement is gone with the implementation.
  { item: '16', step: 'admin-portals-protected', path: 'who.evidence', must: 'signed in to Azure since {from}: {list:azureNonAdmins}', mustNot: 'they are blocked from {enforce}' },
  { item: '16', step: 'admin-portals-protected', path: 'who.lead', must: 'targets every account in the directory and excludes no administrator', mustNot: 'admins in {adminsGroup}' },
  // The conflict's explanation belongs to the reviewed source policy and not to
  // a goal (roadmap/baselineConflict.ts), so it is authored once under
  // shared.engine.baselineConflict and reaches whichever step the active map
  // hands that source. Which step reads it is the unit tests' acceptance
  // (roadmap/adminPortalConflict.test.ts, roadmap/baselineConflictPlan.test.ts).
  { item: '16', path: 'shared.engine.baselineConflict.adminPortalNonAdminScope', must: 'Nothing is wrong in your tenant' },
  { item: '16', step: 'admin-portals-protected', path: 'whatToDoReference.steps', must: 'Microsoft Purview Platform, Inforcer (baseline name), My Staff' },
  { item: '18', step: 'register-info-protected', path: 'more.helpDesk', must: 'Screen-sharing does not change the registering device', mustNot: 'while they are on the VPN' },
  { item: '18', step: 'register-info-protected', path: 'more.risks', must: 'a new starter without an existing method' },
  // Close the Doors A1-A4 (docs/plans/close-doors-spec.md section 2, Microsoft
  // Learn checked 2026-09-19): legacy protocols cannot do MFA, a blocked
  // ActiveSync device gets one quarantine email, and a certificate is still
  // legacy authentication.
  { item: '19', step: 'block-legacy-auth', path: 'why', must: 'Legacy authentication protocols cannot complete multifactor authentication', mustNot: 'can prevent MFA from protecting a sign-in' },
  { item: '19', step: 'block-legacy-auth', path: 'more.helpDesk', must: 'one quarantine email with the reason' },
  { item: '19', step: 'block-legacy-auth', path: 'more.helpDesk', must: 'moved from a password to a certificate is still on legacy authentication' },
  { item: '19', step: 'block-legacy-auth', path: 'decision.help', must: 'SMTP AUTH is the last route that does', mustNot: 'use different authentication paths' },
  { item: '19', step: 'block-legacy-auth', path: 'more.risks', must: 'A mail app that still uses Exchange ActiveSync or basic authentication stops syncing until it moves to a supported client.', mustNot: 'by IMAP or ActiveSync stops syncing' },
  { item: '20', step: 'block-device-code', path: 'more.helpDesk', must: 'the tool\'s supported browser-based sign-in' },
  // Close the Doors C1-C3 (docs/plans/close-doors-spec.md section 4, Microsoft
  // Learn checked 2026-09-19): protocol tracking and the Device Registration
  // Service reach were stated only while the policy was in report-only, which
  // is the one state the admin creating it is not in.
  { item: '20', step: 'block-device-code', path: 'more.risks', must: 'later requests in it are blocked as well, which can sign a device out' },
  { item: '20', step: 'block-device-code', path: 'more.risks', must: 'must exclude the Device Registration Service' },
  { item: '20', step: 'block-device-code', path: 'more.helpDesk', must: 'filter by Authentication Protocol for device code' },
  // Close the Doors B1-B3 (docs/plans/close-doors-spec.md section 3, Microsoft
  // Learn checked 2026-09-19): basic authentication is already gone for the mail
  // protocols and SMTP AUTH is the one still standing. The retirement's dates
  // stay in the spec, because no content string carries a hard date (C3).
  // The mail follow-up folded into Block Legacy Authentication, whose outcome it
  // was (docs/plans/step-redundancy-analysis.md finding 6): its About facts are
  // that step's, and its route instructions are shared.mailDevices, the second
  // Implementation Task's words.
  { item: '20b', step: 'block-legacy-auth', path: 'why', must: 'Exchange Online already refuses a password for POP, IMAP and ActiveSync', mustNot: 'may depend on a mail-sending method' },
  { item: '20b', step: 'block-legacy-auth', path: 'why', must: 'Microsoft is retiring that route too' },
  { item: '20b', path: 'shared.mailDevices.steps', must: 'SMTP AUTH with OAuth, an Exchange Online connector, or Direct Send for internal recipients only' },
  // Per step, 21–30.
  // Close the Doors D1-D2 (docs/plans/close-doors-spec.md section 5, Microsoft
  // Learn checked 2026-09-19): the flow is named concretely, and protocol
  // tracking is a risk on every state rather than a report-only line.
  { item: '21', step: 'block-auth-transfer', path: 'why', must: 'scanning a QR code shown in desktop Outlook', mustNot: 'removes a transfer path the business may not need' },
  { item: '21', step: 'block-auth-transfer', path: 'more.risks', must: 'later requests in it are blocked as well, which can sign a device out' },
  { item: '22', step: 'geo-restriction', path: 'more.helpDesk', must: "VPN exit abroad: add the exit's country to the allowed list for the people who use it, or move the exit.", mustNot: 'egress address to the trusted location' },
  { item: '22', step: 'geo-restriction', path: 'more.helpDesk', must: "log the trip in the plan file's notes, or your ticket system, and add the country to the allowed location for the trip's dates" },
  { item: '23', step: 'admin-session', path: 'comms.body', must: 'If your admin account is also your everyday account, that applies to everything you do with it.', mustNot: 'will not stay signed in when you close the browser' },
  { item: '23', step: 'admin-session', path: 'more.helpDesk', must: 'Unexpected repeated prompts: check the sign-in result' },
  { item: '24', step: 'unmanaged-browser', path: 'who.evidence', must: 'Policy A: Windows browsers on unmanaged devices.' },
  { item: '24', step: 'unmanaged-browser', path: 'who.evidence', must: 'Policy B: other platforms outside the office.' },
  // 25's clause is the engine's (E7): {personalDevicesClause} from shared.engine.personalDevices.
  { item: '25', step: 'require-managed-device', path: 'comms.body', must: 'Personal devices {personalDevicesClause}.', mustNot: 'can still use the browser with limits' },
  // Close the Doors E1-E2 (docs/plans/close-doors-spec.md section 6, Microsoft
  // Learn checked 2026-09-19): Conditional Access supports Linux, which this
  // target does not exclude, and the platform is what the client reports rather
  // than something the service verifies.
  { item: '26', step: 'block-unsupported-platforms', path: 'why', must: 'only Android, iOS, Windows and macOS reach the tenant', mustNot: 'reduces the device types the business needs to support' },
  { item: '26', step: 'block-unsupported-platforms', path: 'more.risks', must: 'reads the platform from what the client reports', mustNot: 'this policy can prompt iOS and macOS users' },
  { item: '26', step: 'block-unsupported-platforms', path: 'more.risks', must: 'Linux is a platform Conditional Access supports and this policy does not exclude' },
  { item: '27', step: 'mobile-app-protection', path: 'why', must: 'App protection can keep work data under company controls inside supported apps' },
  { item: '27', step: 'mobile-app-protection', path: 'licence', must: 'Intune Plan 1' },
  { item: '27', step: 'mobile-app-protection', path: 'comms.body', must: 'mail, files, Teams and any other app that uses your work account', mustNot: 'mail and files on your phone' },
  { item: '28', step: 'azure-management-mfa', path: 'who.evidence', must: 'Microsoft runs its own MFA requirement for Azure management sign-ins; this custom policy does not change or exempt anyone from that requirement.' },
  { item: '28', step: 'azure-management-mfa', path: 'who.evidence', must: 'Require MFA for Everyone already prompts here; this policy keeps Azure covered if that one is ever scoped down.' },
  { item: '28', step: 'azure-management-mfa', path: 'comms.body', must: 'anything that manages Azure at {tenant}' },
  // 29's device-settings toggle, 36's and 38's password writeback and 24's SharePoint
  // line are the content's own "before" lines (whatToDo.before), which the product
  // keeps above the translator's portal lines; the reference no longer carries them.
  // MFA for Everyone B3-B5 (docs/plans/mfa-everyone-spec.md section 3, Microsoft
  // Learn checked 2026-09-20): the tenant-wide setting is not hygiene — while it
  // is Yes, "Conditional Access policies with this user action aren't properly
  // enforced" — and the three conditions are unavailable, not unwise.
  { item: '29', step: 'device-registration-mfa', path: 'whatToDo.before', must: 'this policy is not properly enforced', mustNot: 'After it is enforced for the intended registration or join scope' },
  { item: '29', step: 'device-registration-mfa', path: 'whatToDo.before', must: 'on the day it is enforced for the intended registration or join scope' },
  { item: '29', step: 'device-registration-mfa', path: 'whatToDoReference.steps', mustNot: 'Do not add device-state conditions to this policy; a first join has no device to check.' },
  { item: '29', step: 'device-registration-mfa', path: 'whatToDoReference.steps', must: 'Client apps, Filters for devices and Device state are not available for this user action' },
  { item: '29', step: 'device-registration-mfa', path: 'more.risks', must: 'Windows Hello for Business and a device-bound passkey cannot answer this policy' },
  { item: '30', step: 'token-protection', path: 'more.risks', must: 'An unsupported client or device path can be blocked.' },
  { item: '30', step: 'token-protection', path: 'comms.body', must: 'If Outlook keeps asking you to sign in after the change' },
  // Risk and Sessions F1-F4 (docs/plans/risk-and-sessions-spec.md section 8,
  // Microsoft Learn checked 2026-09-20): both narrowed conditions go through
  // the Configure toggle, Microsoft's own browser warning is stated, and what
  // the policy never reaches is named beside the steps that cover it.
  { item: '30', step: 'token-protection', path: 'why', must: 'is not protected and is not blocked either' },
  { item: '30', step: 'token-protection', path: 'who.evidence', must: 'Block Unsupported Device Platforms turns away the platforms it cannot protect' },
  { item: '30', step: 'token-protection', path: 'more.risks', must: 'Teams on the web among them' },
  { item: '30', step: 'token-protection', path: 'more.risks', must: 'perpetual-licence Office, Surface Hub and Windows-based Teams Rooms' },
  { item: '30', step: 'token-protection', path: 'whatToDoReference.steps', must: 'Conditions → Device platforms → Configure: Yes, then Include: Windows' },
  // Per step, 31–38, and the Cleanup rows. 31 is C6's wording.
  { item: '32', step: 'session-lifetime', path: 'comms.body', must: 'Apps outside the browser are not affected by this change.' },
  // The interval is the resolved target's, never a number in a string
  // (docs/plans/risk-and-sessions-spec.md section 7, the same rule
  // docs/plans/protect-admins-spec.md D4 set for Shorten Admin Sessions).
  { item: '32', step: 'session-lifetime', path: 'who.evidence', must: 'their browser sessions stop persisting and re-authenticate every {wanted}', mustNot: 'every 12 hours' },
  { item: '32', step: 'session-lifetime', path: 'more.helpDesk', must: 'Unexpected repeated prompts: check the sign-in result', mustNot: 'check the device clock' },
  { item: '32', step: 'session-lifetime', path: 'who.evidence', must: 'When several session policies apply, the shortest wins.' },
  // Risk and Sessions E1-E4 (docs/plans/risk-and-sessions-spec.md section 7,
  // Microsoft Learn checked 2026-09-20): the Configure toggle on the condition
  // that makes this browser-only, the setting that has to be off first, and the
  // company-branding prompt this overrides.
  { item: '32', step: 'session-lifetime', path: 'whatToDoReference.steps', must: 'Conditions → Client apps → Configure: Yes, then Browser. Left at No it reaches every client app.' },
  { item: '32', step: 'session-lifetime', path: 'more.risks', must: 'Remember multifactor authentication on trusted devices, left on, prompts these people' },
  { item: '32', step: 'session-lifetime', path: 'more.helpDesk', must: 'Stay signed in? stops working for everyone here' },
  { item: '33', step: 'pim-activation-reauth', path: 'comms.body', must: 'when you activate an eligible admin role', mustNot: 'confirm with MFA each time' },
  { item: '33', step: 'pim-activation-reauth', path: 'who.evidence', must: '{n} of them are not yet Ready for phishing-resistant MFA: {list:eligibleWithout}' },
  { item: '33', step: 'pim-activation-reauth', path: 'why', must: 'Role activation is a useful point to verify the person requesting privileged access.' },
  { item: '34', step: 'intune-enrollment-reauth', path: 'more.manager', must: 'User-driven enrollment asks for a fresh authentication', mustNot: 'one extra prompt' },
  { item: '35', step: 'sign-in-risk', path: 'more.risks', must: 'a person with only Authenticator approval cannot satisfy it until they register an accepted method' },
  { item: '35', step: 'sign-in-risk', path: 'who.evidence', must: '{list:pushOnlyUsers}' },
  { item: '35', step: 'sign-in-risk', path: 'doneWhen', must: 'Available risky sign-ins were reviewed' },
  // Risk and Sessions A1, A4-A6 (docs/plans/risk-and-sessions-spec.md section 3,
  // Microsoft Learn checked 2026-09-20): sign-in risk is a reading of one
  // request; the reading this step has is the sign-in record's and not Identity
  // Protection's; an unregistered person is blocked rather than prompted.
  { item: '35', step: 'sign-in-risk', path: 'why', must: 'one authentication request', mustNot: 'flags a sign-in as suspicious' },
  { item: '35', step: 'sign-in-risk', path: 'who.evidence', must: "Identity Protection's own risk reports are a separate surface this plan does not read" },
  { item: '35', step: 'sign-in-risk', path: 'more.risks', must: 'blocked, not prompted' },
  { item: '35', step: 'sign-in-risk', path: 'more.helpDesk', must: 'AADSTS53004', mustNot: 'then dismiss the risk in Identity Protection.' },
  { item: '36', step: 'user-risk', path: 'whatToDo.before', must: 'Synchronized users who remediate with a password change need password writeback in Entra Connect.' },
  { item: '36', step: 'user-risk', path: 'whatToDoReference.steps', mustNot: 'password writeback' },
  { item: '36', step: 'user-risk', path: 'doneWhen', must: 'People rated at risk were reviewed' },
  // Risk and Sessions B1-B5 (docs/plans/risk-and-sessions-spec.md section 4,
  // Microsoft Learn checked 2026-09-20): user risk is about the account and is
  // mostly read after the sign-in; the pinned grant is Require risk remediation
  // with the strength, never MFA plus a password change; remediation needs a
  // registered method and is not the SSPR flow; a guest is blocked, not helped.
  { item: '36', step: 'user-risk', path: 'why', must: 'the account itself is compromised', mustNot: 'outside a single suspicious sign-in' },
  { item: '36', step: 'user-risk', path: 'whatToDoReference.steps', must: 'Grant → Require risk remediation with Require authentication strength: {strengthName}' },
  { item: '36', step: 'user-risk', path: 'who.evidence', must: 'registered for multifactor authentication before this policy reaches them' },
  { item: '36', step: 'user-risk', path: 'whatToDo.before', must: 'password hash synchronization and the on-premises password-change setting that clears user risk' },
  { item: '36', step: 'user-risk', path: 'more.risks', must: 'blocked rather than remediated' },
  { item: '37', step: 'sign-in-risk-medium', path: 'who.evidence', must: 'A separate response from Challenge High-Risk Sign-ins: Medium-risk sign-ins get built-in MFA' },
  // Risk and Sessions C1-C2 (docs/plans/risk-and-sessions-spec.md section 5,
  // Microsoft Learn checked 2026-09-20): what Medium means, and the grant and
  // absent session control the pin actually holds.
  { item: '37', step: 'sign-in-risk-medium', path: 'why', must: 'one or more moderate anomalies' },
  { item: '37', step: 'sign-in-risk-medium', path: 'whatToDoReference.steps', must: 'Grant → Require multifactor authentication. No session control: the baseline sets none here', mustNot: 'Sign-in frequency → Every time' },
  { item: '37', step: 'sign-in-risk-medium', path: 'more.helpDesk', must: 'AADSTS53004', mustNot: 'dismiss the risk in Identity Protection' },
  { item: '38', step: 'user-risk-medium', path: 'who.evidence', must: 'This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage.' },
  { item: '38', step: 'user-risk-medium', path: 'who.evidence', must: 'People in scope need a registered MFA method to complete the secure password change' },
  { item: '38', step: 'user-risk-medium', path: 'whatToDo.before', must: 'need password writeback in Entra Connect' },
  { item: '38', step: 'user-risk-medium', path: 'whatToDoReference.steps', mustNot: 'password writeback' },
  // Risk and Sessions D1-D4 (docs/plans/risk-and-sessions-spec.md section 6,
  // Microsoft Learn checked 2026-09-20): the grant pair the pin holds, no
  // session control, and why guests are excluded from this one.
  { item: '38', step: 'user-risk-medium', path: 'whatToDoReference.steps', must: 'Grant → Require authentication strength: {strengthName} and Require password change', mustNot: 'Sign-in frequency → Every time' },
  { item: '38', step: 'user-risk-medium', path: 'who.evidence', must: 'Guests and external accounts are excluded from this policy' },
  { item: '38', step: 'user-risk-medium', path: 'why', must: 'moderate anomalies on the account' },
  { item: '24', step: 'unmanaged-browser', path: 'whatToDo.before', must: 'SharePoint admin center → Policies → Access control → Unmanaged devices → Allow limited, web-only access → Save.' },
  { item: '25', step: 'require-managed-device', path: 'whatToDo.before', must: 'Before this policy: Intune → Devices → Compliance → Compliance policy settings' },
  { item: 'cleanup', cleanup: 'alerting', path: 'whatToDo', must: "Review ingestion, retention and cost for the monitoring service you use." },
  { item: 'cleanup', cleanup: 'alerting', path: 'whatToDo', must: 'the SIEM you already use' },
]

/** Every Learn URL the content carries (steps and cleanup rows), for the link check. */
export function contentLearnUrls(content) {
  const urls = new Set()
  for (const s of content.steps ?? []) if (s.learn?.url) urls.add(s.learn.url)
  for (const c of Object.values(content.cleanup ?? {})) if (c.learn?.url) urls.add(c.learn.url)
  return [...urls]
}

/** The pinned policies a content step's goal maps to (the stored goalMap, the product's own source). */
function pinnedPolicyFor(pinned, goalId) {
  const keys = pinned?.goalMap?.[goalId] ?? []
  const policies = pinned?.policies ?? []
  return keys.map((k) => policies.find((p) => (p.id ?? p.displayName) === k)).filter(Boolean)
}

/**
 * The findings over one content file: [{ level, text }]. `pinned` is the pinned
 * baseline (its goalMap and policies) for the transcription checks.
 */
export function contentFindings(content, pinned = null, contracts = null) {
  const out = []
  const add = (level, text) => out.push({ level, text })
  const steps = content.steps ?? []
  const cleanup = content.cleanup ?? {}
  const stepById = Object.fromEntries(steps.map((s) => [s.id, s]))

  // C1: frameworks return as a feature, not a chip; no step carries a CIS value.
  for (const s of steps) if (s.learn && 'cis' in s.learn) add('P0', `content ${s.id}: learn.cis is still present (C1: no CIS chip)`)

  // C2: every step and every Cleanup row has a Learn link.
  for (const s of steps) if (!s.learn?.url) add('P0', `content ${s.id}: no Learn link (C2)`)
  for (const [k, c] of Object.entries(cleanup)) if (!c.learn?.url) add('P0', `content cleanup.${k}: no Learn link (C2)`)

  // C3: no hard date and no preview claim in content that is not a variable.
  for (const [path, s] of strings({ steps, cleanup, shared: content.shared, pages: content.pages, phases: content.phases })) {
    const m = HARD_DATE.exec(s)
    if (m) add('P0', `content ${path}: a hard date "${m[0]}" (C3: no date that is not a variable)`)
    if (/\bpreview\b/i.test(s) && s !== 'Preview' && !path.startsWith('pages.home.')) add('P0', `content ${path}: a preview claim "${s.slice(0, 60)}" (C3)`)
  }

  // The page contract's forbidden strings, on the content before the walk renders
  // it: forbidEverywhere on every string, the step and More surfaces' lists on
  // what a step renders (the reviewer-only whatToDoReference is not on screen).
  if (contracts) {
    const surface = (id) => (contracts.surfaces ?? []).find((s) => s.id === id)?.forbid ?? []
    const stepForbids = [...new Set([...surface('plan.step'), ...surface('plan.step.more')])]
    for (const [path, s] of strings({ steps, cleanup, shared: content.shared, pages: content.pages })) {
      for (const f of contracts.forbidEverywhere ?? []) if (s.includes(f)) add('P0', `content ${path}: forbidden-everywhere string "${f}"`)
      // The engine's own words (shared.engine) and the pages render on the Plan page and the other surfaces, never inside a step.
      if (/whatToDoReference/.test(path) || path.startsWith('pages') || path.startsWith('shared.engine')) continue
      for (const f of stepForbids) if (s.includes(f)) add('P0', `content ${path}: forbidden string "${f}" (plan.step / plan.step.more forbid)`)
    }
  }

  // C5: the typeahead has chips, so nothing on screen is ticked.
  for (const [path, s] of strings({ steps, cleanup, shared: content.shared, pages: content.pages })) {
    const m = TICK.exec(s)
    if (m) add('P0', `content ${path}: "${m[0]}" (C5: no tick vocabulary)`)
  }

  // C6: a step's transcription of its policy agrees with the pinned baseline,
  // resolved through the stored goalMap the product itself reads.
  if (pinned) {
    const cap = (x) => x[0].toUpperCase() + x.slice(1)
    const levelsLine = (s, kind) => strings(s.whatToDoReference ?? {}).map(([, t]) => t).find((t) => t.includes(`Conditions → ${kind} risk →`)) ?? null
    for (const [id, kind, field] of [['sign-in-risk', 'Sign-in', 'signInRiskLevels'], ['sign-in-risk-medium', 'Sign-in', 'signInRiskLevels'], ['user-risk', 'User', 'userRiskLevels'], ['user-risk-medium', 'User', 'userRiskLevels']]) {
      const s = stepById[id]
      const [p] = pinnedPolicyFor(pinned, id)
      if (!s || !p) continue
      const want = [...(p.conditions?.[field] ?? [])].map(cap).sort().join(', ')
      const line = levelsLine(s, kind)
      // The line names the portal's Configure toggle before the levels
      // (docs/plans/risk-and-sessions-spec.md section 2): the levels are what
      // follows "Configure: Yes, then", and they are what this compares.
      const have = line ? line.split('→').pop().trim().replace(/^Configure:\s*Yes,\s*then\s*/, '').split(/,\s*/).sort().join(', ') : null
      if (have !== want) add('P0', `content ${id}: the condition line reads "${have}" but the baseline's policy carries ${field} ${want} (C6)`)
    }
    const managed = stepById['require-managed-device']
    const [managedPolicy] = pinnedPolicyFor(pinned, 'require-managed-device')
    if (managed && managedPolicy) {
      if (!managedPolicy.conditions?.platforms && !/no platform condition/.test(textAt(managed, 'who'))) add('P0', `content require-managed-device: the baseline's policy has no platform condition and the evidence does not say so (C6)`)
      if ((managedPolicy.conditions?.locations?.excludeLocations ?? []).includes('AllTrusted') && !/Outside the Office/.test(managed.title)) add('P0', `content require-managed-device: the baseline's policy excludes trusted locations and the title "${managed.title}" does not say so (C6)`)
    }
    const userRisk = stepById['user-risk']
    const [userRiskPolicy] = pinnedPolicyFor(pinned, 'user-risk')
    if (userRisk && userRiskPolicy && !userRiskPolicy.conditions?.users?.excludeGuestsOrExternalUsers && !/guests rated high risk[^.]*cannot remediate in this tenant/i.test(textAt(userRisk, 'who'))) add('P0', `content user-risk: the baseline's policy includes guests, who cannot remediate here, and the evidence does not say so (C6)`)
    const workload = stepById['workload-identity-block']
    const [workloadPolicy] = pinnedPolicyFor(pinned, 'workload-identity-block')
    if (workload && workloadPolicy && (workloadPolicy.conditions?.clientApplications?.includeServicePrincipals ?? []).length > 0) {
      if (!/Cloud Sync's provisioning service principal/.test(textAt(workload, 'who'))) add('P0', `content workload-identity-block: the baseline's policy targets a service principal (Cloud Sync's provisioning service principal) and the Who line does not say so (C6)`)
      if (!/does not establish support for workload Conditional Access/.test(textAt(workload, 'who'))) add('P0', `content workload-identity-block: the Who line does not say a sync account or provisioning configuration establishes no workload Conditional Access support (C6)`)
    }
  }

  // The per-item acceptance table.
  for (const a of ACCEPTANCE) {
    const subject = a.step ? stepById[a.step] : a.cleanup ? cleanup[a.cleanup] : content
    const label = a.step ? `${a.step} ` : a.cleanup ? `cleanup.${a.cleanup} ` : ''
    if (!subject) {
      add('P0', `content ${label.trim()}: missing (${a.item})`)
      continue
    }
    const text = textAt(subject, a.path)
    if (a.must !== undefined && !test(a.must, text)) add('P0', `content ${label}${a.path}: does not say ${String(a.must).slice(0, 80)} (${a.item})`)
    if (a.mustNot !== undefined && test(a.mustNot, text)) add('P0', `content ${label}${a.path}: still says ${String(a.mustNot).slice(0, 80)} (${a.item})`)
  }
  return out
}

/** HEAD then GET; { status } or { error }. */
export async function probe(href) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 12000)
  try {
    let r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: ctl.signal })
    if (!r.ok) r = await fetch(href, { method: 'GET', redirect: 'follow', signal: ctl.signal })
    return { status: r.status }
  } catch (e) {
    return { error: String(e.message ?? e).slice(0, 60) }
  } finally {
    clearTimeout(t)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const links = args.includes('--links')
  const file = args.find((a) => !a.startsWith('--')) ?? 'docs/design/content.json'
  const content = JSON.parse(readFileSync(file, 'utf8'))
  const pinned = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8'))
  const contracts = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8'))
  const findings = contentFindings(content, pinned, contracts)
  if (links) {
    for (const href of contentLearnUrls(content)) {
      const r = await probe(href)
      if (r.error) findings.push({ level: 'P2', text: `Learn link ${href} could not be checked from here (${r.error})` })
      else if (r.status === 404) findings.push({ level: 'P0', text: `Learn link ${href} answers 404` })
      else if (r.status >= 400) findings.push({ level: 'P1', text: `Learn link ${href} answers ${r.status}` })
    }
  }
  for (const f of findings) console.log(`${f.level} ${f.text}`)
  const p0 = findings.filter((f) => f.level === 'P0').length
  console.log(`${file}: ${p0} P0, ${findings.length - p0} other`)
  process.exit(p0 > 0 ? 1 : 0)
}
