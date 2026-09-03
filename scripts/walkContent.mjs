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
// reads every string under it. `must` is the acceptance; `mustNot` the wording
// it replaced, so the entry fails on the content before the fix.
export const ACCEPTANCE = [
  // C2: the Learn links that answered 404 or opened the wrong page. The audit's
  // guest URL (policy-old-require-mfa-b2b) answers 404 itself; the B2B MFA
  // tutorial is the page. The audit's Intune-enrollment URL answers 404 too, and
  // the audit said keep the current one in that case.
  { item: 'C2', step: 's-check-dormant-accounts', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts', mustNot: '/users/users-inactive' },
  { item: 'C2', step: 'admins-phishing-resistant', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/how-to-policy-phish-resistant-admin-mfa', mustNot: 'policy-admin-phishing-resistant-mfa' },
  { item: 'C2', step: 'block-legacy-auth', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-policy-block-legacy', mustNot: 'policy-block-legacy-auth' },
  { item: 'C2', step: 's-prereq-exclusion-group', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#conditional-access-considerations', mustNot: 'plan-conditional-access' },
  { item: 'C2', step: 's-prereq-service-accounts-group', path: 'learn.url', must: 'https://learn.microsoft.com/entra/architecture/secure-service-accounts', mustNot: 'conditional-access/workload-identity' },
  { item: 'C2', step: 'admin-portals-protected', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps#microsoft-admin-portals', mustNot: 'policy-old-require-mfa-admin' },
  { item: 'C2', step: 'guests-mfa', path: 'learn.url', must: 'https://learn.microsoft.com/entra/external-id/b2b-tutorial-require-mfa', mustNot: 'policy-all-users-mfa-strength' },
  { item: 'C2', step: 'intune-enrollment-reauth', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-session-lifetime' },
  { item: 'C2', cleanup: 'alerting', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#monitor-sign-in-and-audit-logs' },
  { item: 'C2', cleanup: 'drill', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access#monitor-sign-in-and-audit-logs' },
  { item: 'C2', cleanup: 'naming', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access' },
  { item: 'C2', cleanup: 'consolidation', path: 'learn.url', must: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access' },
  { item: 'C2', cleanup: 'notAssessed', path: 'learn.url', must: 'https://github.com/Jhope188/ConditionalAccessPolicies' },
  // C4: a manager line never asserts "nobody here used it" unconditionally; the
  // clause returns under the engine's `applies` when the evidence count is zero.
  { item: 'C4', step: 'block-device-code', path: 'more.manager', must: 'Without this, one pasted code signs an attacker in.', mustNot: /nobody here/i },
  { item: 'C4', step: 'block-auth-transfer', path: 'more.manager', must: 'Without this, a captured QR code is a captured account.', mustNot: /nobody here/i },
  { item: 'C4', step: 'geo-restriction', path: 'more.manager', must: 'Without this, a stolen password works from anywhere in the world.', mustNot: /nobody signed in/i },
  // C7: the security-defaults switch is dated to the day Require MFA for Everyone
  // enforces, with the legacy block and the admin MFA policy the same day, and
  // the step says so (report-only policies can exist with security defaults on).
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', must: 'Report-only policies can exist while security defaults are on; an enforced one cannot. On the day Require MFA for Everyone enforces, and not before:', mustNot: '{firstPolicy}' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'whatToDo', must: 'then Block Legacy Authentication and Require Phishing-Resistant MFA for Admins the same day.' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'doneWhen', must: 'Security defaults are off; Require MFA for Everyone, Block Legacy Authentication and Require Phishing-Resistant MFA for Admins are enforced.' },
  { item: 'C7', step: 's-prereq-security-defaults', path: 'more.helpDesk', must: 'Prompts on the switch day are the new MFA policy; anyone without a method gets a Temporary Access Pass.' },
  // Per step, 1–10.
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.mfa-method', must: 'register a hardware security key (FIDO2) and keep it with the passphrase', mustNot: 'see step 5 above' },
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.recent-sign-in', must: '{name} signed in {ago}, not a recorded drill: confirm who signed in and why.', mustNot: 'run the drill' },
  { item: '1', step: 's-prereq-break-glass', path: 'whatToDo.checkFixes.second-account-none', must: 'Create two accounts: one is a single point of failure.' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes', must: 'only the emergency accounts belong here', mustNot: 'each extra member is an account no policy applies to' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes.not-mail-enabled', must: 'recreate it as a plain security group', mustNot: 'remove the mail address and the licence' },
  { item: '2', step: 's-prereq-exclusion-group', path: 'whatToDo.checkFixes.no-admin-members', must: 'besides the emergency accounts' },
  { item: '3', step: 's-check-dormant-accounts', path: 'title', must: 'Disable or Confirm Dormant Accounts', mustNot: 'Address Problematic Accounts' },
  { item: '3', step: 's-check-dormant-accounts', path: 'who', must: 'Last sign-in dates need Entra ID P1; without it every account here reads no sign-in on record.' },
  { item: '4', step: 's-prereq-allowed-countries', path: 'decision.help', must: 'Remove one nobody should work from.', mustNot: /add one people (will )?travel to/ },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: 'a single office is usually /32; use the small block only if your ISP assigned one', mustNot: '/32 or a /24' },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: 'IPv6: /128 for one address, or the /64 your ISP delegated; never wider.' },
  { item: '5', step: 's-prereq-trusted-location', path: 'whatToDo.steps', must: "or take it from the sign-in log's IP column filtered to the office" },
  { item: '5', step: 's-prereq-trusted-location', path: 'more.risks', must: 'A trusted location also lowers Identity Protection risk scores, so keep the ranges tight.' },
  { item: '6', step: 's-prereq-service-accounts-group', path: 'ifWrong', must: 'Remove the account from the group; the policies apply again on its next sign-in.' },
  { item: '6', step: 's-prereq-service-accounts-group', path: 'more.risks', must: 'see Restrict Service Accounts to the Trusted Network' },
  { item: '7', step: 's-shared-devices', path: 'whatToDoReference.steps', must: 'Exclude: {trustedLocation}', mustNot: 'Require device to be marked as compliant' },
  { item: '7', step: 's-shared-devices', path: 'doneWhen', must: 'allows them only from the trusted network', mustNot: 'requires a compliant device' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'whatToDo.lead', must: 'On the day Require MFA for Everyone enforces, and not before:' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'more.risks', must: 'Disabling per-user MFA before the policy enforces removes MFA for that person.' },
  { item: '9', step: 's-prereq-per-user-mfa', path: 'whatToDo.steps', must: 'Manage migration → Migration complete.' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'whatToDo.steps', must: 'Enforce attestation: Yes, so only the key models on the list can register.' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'whatToDo.steps', must: 'Microsoft Authenticator → Enable: On, All users, for push and codes', mustNot: 'so passkeys in the app can be registered' },
  { item: '10', step: 's-prereq-passkey-settings', path: 'more.risks', must: 'Synced passkeys (iCloud Keychain, Google Password Manager) fail attestation and cannot register under these settings.' },
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
export function contentFindings(content, pinned = null) {
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
    if (/\bpreview\b/i.test(s) && s !== 'Preview') add('P0', `content ${path}: a preview claim "${s.slice(0, 60)}" (C3)`)
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
      const have = line ? line.split('→').pop().trim().split(/,\s*/).sort().join(', ') : null
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
    if (userRisk && userRiskPolicy && !userRiskPolicy.conditions?.users?.excludeGuestsOrExternalUsers && !/Guests rated high risk are blocked, not remediated/.test(textAt(userRisk, 'who'))) add('P0', `content user-risk: the baseline's policy includes guests, who cannot change a password here, and the evidence does not say so (C6)`)
    const workload = stepById['workload-identity-block']
    const [workloadPolicy] = pinnedPolicyFor(pinned, 'workload-identity-block')
    if (workload && workloadPolicy && (workloadPolicy.conditions?.clientApplications?.includeServicePrincipals ?? []).length > 0) {
      if (!/Cloud Sync's provisioning service principal/.test(textAt(workload, 'who'))) add('P0', `content workload-identity-block: the baseline's policy targets a service principal (Cloud Sync's provisioning service principal) and the Who line does not say so (C6)`)
      if (!/Classic Entra Connect syncs with a user account/.test(`${workload.why}\n${textAt(workload, 'who')}`)) add('P0', `content workload-identity-block: classic Entra Connect's user account is not named as outside this policy (C6)`)
    }
  }

  // The per-item acceptance table.
  for (const a of ACCEPTANCE) {
    const subject = a.step ? stepById[a.step] : cleanup[a.cleanup]
    const label = a.step ? a.step : `cleanup.${a.cleanup}`
    if (!subject) {
      add('P0', `content ${label}: missing (${a.item})`)
      continue
    }
    const text = textAt(subject, a.path)
    if (a.must !== undefined && !test(a.must, text)) add('P0', `content ${label} ${a.path}: does not say ${String(a.must).slice(0, 80)} (${a.item})`)
    if (a.mustNot !== undefined && test(a.mustNot, text)) add('P0', `content ${label} ${a.path}: still says ${String(a.mustNot).slice(0, 80)} (${a.item})`)
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
  const findings = contentFindings(content, pinned)
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
