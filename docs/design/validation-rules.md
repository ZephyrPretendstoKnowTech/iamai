# Design: the validation rule set

Every object the plan depends on must be checked completely, not partially, and the checks
must be visible, testable, and enforced by the plan. Today the checks are written inline per
question, which is why the break-glass set was incomplete twice and silently regressed once.

## 1. The model

One registry: `src/validation/rules.ts`. Every rule is a record:

```
ValidationRule {
  id: string                 // stable, e.g. 'bg.role.permanentGa'
  subject: 'breakGlass' | 'exclusionGroup' | 'trustedLocation' | 'pilotGroup'
         | 'serviceAccount' | 'authStrength' | 'namedLocation'
  severity: 'blocker' | 'warning' | 'note'
  needs: SnapshotSource[]    // what data the rule requires
  evaluate(subject, snapshot): RuleResult   // pass | fail | unknown, with the facts used
  finding(result): string    // plain language, names the object and the fact
  fix(result): FixAction     // portal path, a plan step, or a Setup action
}
```

Rules are pure and unit-tested one by one. `unknown` is a first-class outcome: when the
data needed is missing (no P1, a 403, a group over the member cap), the rule says so rather
than passing silently. **An unknown on a blocker rule blocks.**

## 2. What a blocker does

- The Setup question shows it as "must fix before the plan can run safely", with the fix.
- It generates a Phase 0 step, always ordered before everything else.
- **Every step that can deny access stays Blocked until all blockers for break-glass and
  the exclusion group are cleared.** No enforcement step is Ready while the escape hatch is
  unverified. The blocked reason names the rule.
- The Progress and "Do this next" surfaces lead with it.

Warnings do not block; they appear on the step and in the plan as recommended fixes.
Notes are informational only.

## 3. Break-glass rules (complete set)

Microsoft's guidance for emergency access accounts, expressed as checks. Each is a rule id
in the registry.

### Blockers

| id | Check | Why |
|---|---|---|
| `bg.count` | At least two accounts | One account is a single point of failure |
| `bg.role.permanentGa` | Permanently assigned active Global Administrator, not PIM-eligible only | An eligible-only account cannot activate if the thing you are recovering from is the thing that blocks activation |
| `bg.cloudOnly` | Cloud-only (`onPremisesSyncEnabled` is false) | An on-prem-synced account dies with the sync or the domain controller |
| `bg.initialDomain` | UPN is on the tenant's `*.onmicrosoft.com` initial domain | A custom or federated domain depends on DNS and the identity provider; both are things you may be recovering from |
| `bg.enabled` | Account is enabled | An account disabled "for safety" is not an escape hatch |
| `bg.excludedFromAllPolicies` | Excluded from every enabled and report-only Conditional Access policy, including Microsoft-managed ones | The account exists to survive a bad policy |
| `bg.notInDynamicScope` | Not brought into policy scope by any dynamic group's membership rule | A dynamic rule can silently re-include it tomorrow |
| `bg.hasMfaMethod` | Has at least one MFA-capable method | Without one it cannot sign in under any modern requirement |
| `bg.separateDevices` | No two break-glass accounts share an Authenticator device name, and none shares a device name with a daily-use account | One lost phone must not take out the whole escape hatch |
| `bg.notPersonal` | Not an individual's day-to-day account (no manager, no department, no job title, and not the signed-in operator) | A person leaves, is compromised, or is on a plane |

### Warnings

| id | Check |
|---|---|
| `bg.phishingResistant` | At least one FIDO2 or certificate method; SMS or voice only is called out explicitly |
| `bg.methodDiversity` | The two accounts do not rely on the same single method type |
| `bg.perUserMfaOff` | Legacy per-user MFA state is not Enforced on the account (it conflicts with Conditional Access and with recovery) |
| `bg.noLicenceNeeded` | No licence assigned unless something requires it, and no mailbox in daily use |
| `bg.drilled` | Signed in within 90 days |
| `bg.credentialStorage` | The plan includes where the credential is stored and who can reach it (a prompt, not a detectable fact: asked once in Setup and recorded) |
| `bg.signInMonitoring` | An alert exists on break-glass sign-in, or the plan includes a step to create one |
| `bg.nameIdentifiesPurpose` | Display name makes the purpose obvious to a future admin |

### Notes

Last sign-in date; sign-in locations seen in the window; whether the account has ever
completed MFA in the evidence window.

## 4. The other subjects

Same treatment, same registry, blockers listed.

**Exclusion group** — blockers: contains only accounts that are themselves break-glass or
explicitly approved exclusions; no member holds an active admin role beyond the break-glass
accounts; not a dynamic group whose rule could add members; used consistently (excluded
from every policy the plan assumes it is excluded from). Warnings: member count above the
number of break-glass accounts; group is licensed or mail-enabled.

**Trusted named location** — blockers: no 0.0.0.0/0 or ::/0; no range wider than /16 unless
confirmed; `isTrusted` set. Warnings: single IP with no redundancy; ranges that do not
appear in any sign-in record in the window (possibly stale).

**Allowed-countries location** — blockers: at least one country; the operator's own recent
sign-in countries are included. Warnings: `includeUnknownCountriesAndRegions` left on;
countries with sign-in history that are not in the list.

**Pilot group** — blockers: at least one member; contains no break-glass account. Warnings:
all members from one department; no admin among them; a member whose MFA is not verified.

**Service accounts** — blockers: none. Warnings: any confirmed service account with an
interactive sign-in in the window; any with an admin role; any that would be caught by a
block step without an exclusion.

**Authentication strength** — blockers: the referenced strength exists in the tenant and
its combinations are achievable by the target population. Warnings: a combination no user
has registered.

## 5. Presentation

- Setup: findings grouped as "Must fix", "Recommended", "Notes", with the count in the chip
  matching the number shown, and each finding carrying its fix link.
- Plan: one Phase 0 step per blocking subject, titled plainly ("Sort out emergency access
  before anything else"), containing every blocker for that subject as a checklist with the
  portal path for each, and the criteria that clear it.
- Every deny-capable step's blocked reason names the subject and the rule count: "Blocked
  until emergency access is sorted (3 must-fix items)".
- The rule registry generates a reference page listing every check, its severity, and why it
  matters. This doubles as documentation and as proof the tool is thorough.

## 6. Testing

- One unit test per rule, pass and fail and unknown.
- A fixture per subject in its worst state (one break-glass account, synced, on a custom
  domain, eligible-only, not excluded, SMS-only, shared phone) asserting every blocker
  fires with the right text.
- A plan-level test: with any break-glass blocker present, no deny-capable step is Ready.
- A regression test: the full break-glass rule set is asserted by id, so a refactor that
  drops a rule fails the build.
