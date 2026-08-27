# Design: intents and coverage

**Status:** ready to implement.
**Depends on:** `src/baseline/` (adapter), `TenantSnapshot` (Lane 0/A, on-demand group members), SPEC §12 licensing principle.
**Produces:** the Coverage page and the input to the Roadmap.

## 1. The idea

A baseline is a list of policies. A tenant is a list of policies. Comparing
them by name or by JSON equality is useless: the same security outcome is
routinely delivered by two policies here and one policy there, with different
names and different exclusions.

So the engine reasons about **goals**. A goal is a security outcome ("every
member must satisfy MFA on every app"). Each goal has **implementations** by
licence tier. Each implementation has a **signature** (how to recognise a policy
that delivers it), an **expected population** (who it should apply to), a
**control floor** (the weakest control that still counts), and **expected
conditions**.

Coverage answers, per goal: *do the tenant's enabled policies, taken together,
deliver this outcome for everyone they should, with at least the required
strength?* — and when not, exactly who is left out and why.

## 2. Policy facts

Every policy (baseline or tenant) is first reduced to facts. This is
`policyTraits` from the adapter, extended:

```
PolicyFacts {
  name, id, state, isMicrosoftManaged
  who:   { all: bool, members: bool, guests: GuestTypes|null, roles: Set<roleTemplateId>,
           groups: Set<groupId>, users: Set<userId> }
  whoNot:{ roles, groups, users, guests }
  apps:  { all: bool, office365: bool, adminPortals: bool, ids: Set<appId>, excludedIds: Set<appId>,
           userActions: Set<string>, authContexts: Set<string>, filterRule: string|null }
  clientApps: Set<'browser'|'mobileAppsAndDesktopClients'|'exchangeActiveSync'|'other'|'all'>
  platforms: { include: Set, exclude: Set } | null
  locations: { include: Set<locationId|'All'|'AllTrusted'>, exclude: Set } | null
  flows:     Set<'deviceCodeFlow'|'authenticationTransfer'>
  signInRisk, userRisk, spRisk: Set<level>
  deviceFilter: { mode, rule } | null
  workload: { sps: Set, filterRule } | null
  grant:  { operator: 'AND'|'OR', controls: Set<builtIn>, strength: StrengthTier|null, tou: bool }
  session:{ signInFrequencyHours: number|null, persistentBrowser: 'always'|'never'|null,
            secureSignInSession: bool, cloudAppSecurity: string|null, appEnforced: bool }
}
```

`StrengthTier` is derived from the authentication strength's
`allowedCombinations` (tenant policies have them; built-in ids resolve from a
bundled table; baseline custom strengths without combinations resolve through
the Mapping step):

| Tier | Rule |
|---|---|
| `phishingResistant` | every combination ∈ {windowsHelloForBusiness, fido2, x509CertificateMultiFactor, x509CertificateSingleFactor} |
| `passwordless` | every combination ∈ phishingResistant ∪ {deviceBasedPush, microsoftAuthenticator (passwordless), temporaryAccessPass*} |
| `mfa` | anything else that `requirementsSatisfied: mfa` |

## 3. Control strength

Grant strength is a lattice, not a number, because device controls and
authentication controls are different dimensions.

Authentication dimension: `block` > `phishingResistant` > `passwordless` > `mfa` > none.
Device dimension: `compliantDevice` ≥ `domainJoinedDevice` > `approvedApplication` ≈ `compliantApplication` > none.

A grant **satisfies a floor** F when:
- `operator = AND` (or a single control): any control ≥ F in F's dimension; or
- `operator = OR`: **every** control ≥ F in F's dimension — `OR` means the user may pick the weakest.

Session floors: `signInFrequencyHours ≤ floor`, `persistentBrowser = never`
when required, booleans as required.

## 4. Goal catalogue (v1)

Goals live in `data/goals.json`. Each entry:

```
{ id, name, description, phase, applicability: facet|null,
  implementations: [
    { tier: 'free'|'p1'|'p2'|'intune'|'workloadId'|'gsa'|'mcas',
      kind: 'ca' | 'setting',
      signature: {...},        // predicate over PolicyFacts (ca) or a Lane 0 setting check (setting)
      expectedWho: PopulationSpec,
      expectedApps: AppsSpec,
      floor: { grant?: ..., session?: ... },
      allowedExclusions: ['breakGlass','globalExclusion','serviceAccounts', ...] }
  ] }
```

The v1 catalogue, P1/P2 implementations (free-tier `setting` implementations
are populated from `free-tier-ladder.json` in a later pass):

| Id | Goal | Signature (must all hold) | Expected who | Floor | Phase |
|---|---|---|---|---|---|
| mfa-all-users | Every user satisfies MFA on every app | grant has an auth control; apps all; no risk/flow/platform/location condition | all users (members + guests) | grant ≥ mfa | 2 |
| admins-phishing-resistant | Admins use phishing-resistant auth | who.roles ∩ CoreAdminRoles ≠ ∅; apps all | CoreAdminRoles (14 template ids, table in data) | grant ≥ phishingResistant | 3 |
| admin-portals-protected | Admin portals need strong auth or are blocked for non-admins | apps.adminPortals | all users | grant ≥ mfa (or block for non-admin scope) | 3 |
| guests-mfa | Guests satisfy MFA | who.guests; apps all | all guest types present in tenant | grant ≥ mfa | 4 |
| register-info-protected | Security-info registration requires a trusted context | apps.userActions ∋ registersecurityinfo | all members | grant ≥ mfa **or** location include AllTrusted with block elsewhere | 0 |
| block-legacy-auth | Legacy protocols blocked | clientApps ⊇ {exchangeActiveSync, other}; grant block | all users | block | 1 |
| block-device-code | Device-code flow blocked | flows ∋ deviceCodeFlow; grant block | all users | block | 1 |
| block-auth-transfer | Authentication transfer blocked | flows ∋ authenticationTransfer; grant block | all users | block | 1 |
| geo-restriction | Sign-ins outside allowed countries blocked | locations present; grant block; apps all | all users | block | 4 |
| admin-session | Admin sessions expire quickly, never persist | who.roles ∩ CoreAdminRoles ≠ ∅ | CoreAdminRoles | session ≤ 12h and persistentBrowser never | 3 |
| byod-session-controls | Unmanaged-device browser sessions are limited | clientApps ∋ browser; (deviceFilter or no device grant); session has appEnforced or persistentBrowser never or signInFrequency | all users | session floor (any of the three) | 6 |
| require-managed-device | Office apps require a compliant or joined device | grant has a device control; apps office365 or all | all members | grant ≥ compliantDevice (AND with mfa allowed) | 5 |
| block-unsupported-platforms | Unknown platforms blocked | platforms.include = All with exclusions; grant block | all users | block | 5 |
| mobile-app-protection | Mobile access requires approved/protected apps | platforms ⊆ {iOS, android}; grant approvedApplication or compliantApplication | all members | device dim ≥ approvedApplication | 5 |
| sign-in-risk | Risky sign-ins get MFA or block | signInRisk ∋ high (and medium) | all users | grant ≥ mfa (block for high accepted) | 7 (p2) |
| user-risk | High-risk users must change password | userRisk ∋ high | all users | passwordChange (AND mfa) or block | 7 (p2) |
| azure-management-mfa | Azure management requires strong auth | apps.ids ∋ 797f4846-ba00-4fd7-ba43-dac1f8f63013 | all users | grant ≥ mfa | 3 |
| device-registration-mfa | Registering or joining a device requires MFA | apps.userActions ∋ registerdevice | all users | grant ≥ mfa | 5 |
| token-protection | Windows desktop sessions require token protection | session.secureSignInSession; platforms windows | all users | secureSignInSession | 6 |
| workload-identity-block | Service principals restricted | workload present; grant block or spRisk | all SPs or listed | block | 7 (workloadId) |

Anything in a baseline that matches no catalogue goal becomes an **ad-hoc goal**
built from its own facts (signature = its facts minus who/whoNot; expected who
= its who; floor = its grant/session). Nothing in a baseline is dropped; ad-hoc
goals are labelled with the source policy name.

Baseline policies flagged unusable by the adapter (no targets) generate nothing
and are listed under "could not be evaluated".

## 5. Classification

For every policy, baseline or tenant, evaluate every goal signature. A policy
may match several goals (an all-users MFA policy with a 12-hour sign-in
frequency matches `mfa-all-users`; an admin one matches
`admins-phishing-resistant` and `admin-session`). Matching is on facts, never
on names.

A baseline policy that matches a goal **and** whose own expected population or
floor is stricter than the catalogue's raises the goal's floor for this
baseline (Jon's all-users policy requiring a strength raises `mfa-all-users`'s
floor to that tier). The baseline defines the target; the catalogue defines
how to recognise it.

## 6. Populations as user-id sets

Everything about "who" resolves to sets of user ids from the snapshot:

- `all` → every user in A2; `members` → userType member; `guests` → userType guest (filtered by guest types if specified).
- roles → users with an **active** assignment of that role template (eligible-only users are out; the roadmap notes them).
- groups → on-demand transitive member ids (counts-and-sample above 20 000 — coverage then reports percentages with "estimated").
- users → themselves.
- `who` = union of includes; effective = `who − whoNot`.

Dormant and never-signed-in users stay in the sets (a policy does apply to
them) but statements report "of whom N active" so numbers stay meaningful.

## 7. Coverage algorithm

For each goal G with expected population E (a user-id set) and floor F:

1. **Candidates** = tenant policies whose facts match G's signature.
2. For each candidate C compute `pop(C)` = effective population ∩ E, and
   `strong(C)` = pop(C) if C's grant/session satisfies F else ∅, and whether C
   is enabled, report-only, or disabled.
3. `enforced` = ∪ strong(C) over enabled C. `weak` = ∪ pop(C) over enabled C − enforced.
   `reportOnly` = ∪ strong(C) over report-only C − enforced − weak.
4. Apps check: a candidate whose apps are narrower than G's expected apps
   contributes only with an `apps` caveat; app exclusions outside the goal's
   allowed list are a caveat.
5. Status:
   - **enforced** — enforced = E.
   - **partial** — enforced ≠ ∅ or reportOnly ≠ ∅, with reasons (below).
   - **absent** — no candidates, or only disabled ones.
   - **licence-limited** — G has no implementation at the tenant's tier; not
     scored, surfaced on the Licensing guide.
   - **not-applicable** — the goal's applicability facet is off for this tenant (§9).
   - **unknown** — a required population could not be resolved (group over cap,
     roles unavailable); reported with what is known.
6. Reasons for partial, each with the exact user ids behind it:
   - `excluded` — users in E − (∪ pop over all enabled candidates) who are in some candidate's `who` but removed by `whoNot`, grouped by the excluding group/role, with the group's inferred role from the mapping (an expected exclusion such as break-glass is reported but not counted as a gap; an unexpected one is a gap).
   - `not-targeted` — users in E never included by any candidate.
   - `weaker-control` — users in `weak`, with the control they got vs the floor.
   - `report-only` — users only covered in report-only.
   - `apps-narrower` / `apps-excluded` — the caveats from step 4.
   - `session-weaker` — session floor unmet.
   - `disabled-candidate` — a matching policy exists but is disabled.

## 8. Statements

Generated from the sets, in this shape:

- Enforced: "**Every user satisfies MFA** — delivered by *MFA for Internal Users* and *MFA for Admins* together; 2 accounts excluded as break-glass (expected)."
- Partial: "**Legacy authentication blocked** for 96% of users — *Block Legacy Auth* covers everyone except group *Service Accounts* (14 members, 9 active). Not a recognised exclusion for this goal."
- Partial, control: "**Admins use phishing-resistant auth** — *MFA for Admins* applies to all 12 admins but requires only MFA; the baseline requires phishing-resistant."
- Absent: "**Sign-ins outside allowed countries blocked** — no policy does this. Baseline policy: *IAC - GLOBAL - BLOCK - Countries not Allowed*."
- Report-only: "… covered only in report-only by *X* (14 days, 0 failures)." — the failure figure comes from Lane B per-policy results when present.

Names in statements are tenant display names; ids never appear in prose.

## 9. Applicability

Situational goals carry a facet: `avd`, `copilot`, `azureDevOps`, `intune`,
`sharepoint`, `workload`, `agents`, `azureManagement`. The facet is
auto-detected from the snapshot — the app's service principal exists **and**
appears in the app sign-in summary or SP activity — and the user can override
in Mapping with a reason ("we don't use AVD"). Off facets produce
`not-applicable`, listed separately, never scored, never "accepted risk".

## 10. Naming and organisation report (secondary)

Separate from coverage: tenant policies matching no goal ("not in the
baseline" — informational); goals delivered by more than two policies
(consolidation candidates); naming convention detection (prefix pattern
shared by ≥ 60% of policies) and outliers; Microsoft-managed policies present
and their state.

## 11. Worked example — GetIAMAI (10 policies) vs Jon Hope baseline (46)

Tenant facts worth noting: group `4b3ae702…` is excluded from 9 of 10 policies
and never included → inferred break-glass/global exclusion; two users are
excluded directly from the risk policy → inferred break-glass accounts.

| Goal | Status | Statement |
|---|---|---|
| mfa-all-users | **enforced** (control above floor) | *MFA for Internal Users* (members, phishing-resistant) + *MFA for Admins* (roles, phishing-resistant) + *MFA for Guests* (guests, MFA) together cover every user; 1 group excluded (break-glass, expected) plus *f2947cb9…* excluded from the internal policy (10 members — confirm in Mapping) |
| admins-phishing-resistant | **enforced** | *MFA for Admins* |
| admin-session | **partial — session-weaker** | admins get 7-day sign-in frequency with persistent browser *always*; baseline asks ≤ 4 h, never persist |
| block-legacy-auth | **enforced** | *Block - Legacy Authentication* |
| block-device-code | **enforced** | *Block - Device Code Flow* |
| block-auth-transfer | **enforced** | *Block - Authentication Transfer Flow* |
| guests-mfa | **enforced** | *MFA for Guests* |
| token-protection | **enforced** | *Require - Token Protection (Windows)* |
| user-risk | **enforced** | *User Risk Policy* (P2 present) |
| sign-in-risk | **absent** | no sign-in-risk policy |
| geo-restriction | **absent** | baseline variant choice pending (two styles) |
| register-info-protected | **absent** | — |
| admin-portals-protected | **absent** | — |
| require-managed-device | **absent** | Intune licence present, no device policy |
| byod-session-controls | **absent** | — |
| mobile-app-protection | **absent** | — |
| block-unsupported-platforms | **absent** | — |
| device-registration-mfa | **absent** | — |
| azure-management-mfa | **partial — apps-narrower** | covered only through *MFA for Internal Users/Admins* (apps all) — counts as enforced; baseline's dedicated policy is organisational |
| AVD / Copilot / DevOps / SharePoint-location / agents ad-hoc goals | **not-applicable** or **could not be evaluated** | facets off (no AVD/DevOps SP activity); agent policies unusable in source |
| not in baseline | informational | *Defender for Cloud Apps Test* (report-only, 1 user), *Monitor Kaladin using Forms* |

Nine goals enforced on day one, one partial, eight absent, the rest
not-applicable — that is the shape the Coverage page shows, and the eight
absents become Roadmap steps.

## 12. Tests (required)

Fixtures are authored, never copied tenant data. Cases:

1. Two tenant policies (members-minus-roles + roles) jointly cover `mfa-all-users` → enforced, statement names both.
2. Same, but the roles policy is report-only → partial with `report-only` users = admins.
3. Exclusion group of 40 unmapped users → partial `excluded`, 40 ids, group named.
4. Exclusion group mapped as break-glass (2 users) → enforced, "expected" note.
5. `OR` grant of [mfa, compliantDevice] against floor mfa → `weaker-control`.
6. `AND` grant of [mfa, compliantDevice] against floor compliantDevice → satisfies.
7. Baseline all-users policy with phishing-resistant strength raises the floor; tenant plain-MFA policy → partial `weaker-control` for everyone.
8. Apps narrower (Office365 vs all) → partial `apps-narrower`.
9. Disabled candidate only → absent with `disabled-candidate` note.
10. Group over the member cap → unknown with percentage estimate.
11. Facet off → not-applicable; facet on → evaluated.
12. P2 goal on a P1 tenant → licence-limited, excluded from score.
13. Unclassifiable baseline policy → ad-hoc goal created and evaluated structurally.
14. Guests excluded from an all-users policy with a separate guests policy → enforced by union.

## 13. First run (2026-08-26, GetIAMAI vs Jon Hope baseline)

The engine's first live run was compared with §11 goal by goal. Eight goals
matched exactly (the three flow/legacy blocks, admin-session partial with the
4 h floor raise, token-protection, the absents for portals / register-info /
geo / managed-device / platforms / mobile / device-registration / sign-in-risk,
and workload not-applicable). Five engine defects surfaced; all fixed:

1. **Client-app narrowing wasn't checked.** The legacy-auth block (client apps
   EAS+other) matched `mfa-all-users` and counted as strong MFA coverage.
   Fixed: `clientAppsAll` signature key, applied to every all-client-apps goal;
   blocks and risk policies no longer pollute MFA/guest/azure-management
   candidates. Statements now match §11's candidate lists.
2. **Floor raising ignored scope.** The admin-scoped baseline policy
   (*…MFA - AllAdmins*) raised the `mfa-all-users` floor to passwordless, and a
   break-glass-scoped policy raised azure-management's. Fixed: a baseline
   policy raises a floor only when its own scope covers the goal's expected
   population.
3. **BYOD signature was too loose.** Any MFA policy with a sign-in frequency
   matched `byod-session-controls` (§11: absent). Fixed: the signature now
   requires a genuine unmanaged-device discriminator (device filter,
   app-enforced restrictions, or MCAS session control).
4. **Assumed exclusions were labelled too narrowly.** The
   excluded-from-most group is §11's "break-glass/global exclusion" — one
   group in small tenants. It now carries both roles until Mapping separates
   them, and directly-excluded users are assumed break-glass (per this
   section's tenant note), so `admins-phishing-resistant` and `user-risk`
   come out enforced-with-expected-note as §11 says. Duplicate excluded
   reasons (one per candidate) are deduped by source.
5. **Ad-hoc goals ignored facets and session intent.** The AVD baseline
   policy's ad-hoc goal was "enforced" by generic all-app MFA policies. Fixed:
   ad-hoc goals infer a facet from their app ids / name (AVD → not-applicable
   here), and carry their source's session controls into the floor, so
   SIF-every-time policies aren't "covered" by a 7-day-SIF tenant policy.

Where the worked example was wrong, the example, not the engine:

- **guests-mfa**: Jon's guest policy requires a passwordless-tier strength, so
  §5 raises the guests floor and the tenant's plain-MFA guest policy is
  `weaker-control` — §11's flat "enforced" ignored the guest policy's own
  strength. The engine result (partial, weaker-control) stands.
- **byod-session-controls**: the report-only *Defender for Cloud Apps Test*
  policy is a genuine (if tiny) BYOD session candidate; if it matches after
  the tightened signature the goal is partial-report-only rather than §11's
  clean absent. Report-only candidates are real signals; the engine keeps them.

Also observed: the two agent-identity baseline policies were correctly listed
under "could not be evaluated" with the adapter's re-export guidance, and the
organisation report found the tenant's `Core -` naming convention (70%) with
the expected outliers.
