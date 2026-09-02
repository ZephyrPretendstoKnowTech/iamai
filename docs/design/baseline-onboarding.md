# Baseline onboarding

How a Conditional Access baseline — Jon Hope's, another author's, or a tenant's own — becomes
something IAMAI can plan against, and how what we learned on the first one is applied to every
next one without anybody combing the policies by hand.

Version 1 · Sep 1, 2026. Companion to `docs/design/target-state.md` §8.9–8.11 and
`docs/design/content.json`.

---

## 1. The rule

**The baseline wins.** A step's What to do is generated from the baseline's policy object, not
from a template of ours. The goal catalogue keeps intent only: title, why, who-line patterns,
comms, help desk, manager, risks, done-when. When a baseline contradicts itself, that is the one
case that goes to the owner; everything else is decided by the pipeline below.

Three layers make a baseline:

| Layer | Source | What IAMAI does with it |
|---|---|---|
| Conditional Access policies | the author's exported policy JSON | mapped to goals; each becomes a step whose portal steps, JSON and PowerShell are rendered from the object |
| Authentication methods | the author's policy where it exists; otherwise IAMAI's defaults (passkeys on for all users, attestation enforced, key restrictions allowed with the Authenticator identifiers, Temporary Access Pass on) | the Set Up Passkeys step, and the check on emergency-account methods |
| Custom objects the policies reference | authentication strengths, named locations, groups | recognised in the tenant or created by a Preparation step |

---

## 2. The pipeline

Runs once when a baseline is added, and again on every author update. Every stage produces a
line in the baseline's report; a stage that cannot complete stops the import and says why.

1. **Normalise.** Accept Graph JSON, PowerShell SDK exports (PascalCase, `Conditions.Users`),
   and the older `value[]` wrappers. Produce one Graph-shaped object per policy. Record the
   commit or file hash.
2. **Resolve placeholders.** Every group, location, strength and application id in the export is
   the author's. Classify each by structure, then by the README:
   - the group excluded from the most policies whose members are the author's break-glass
     accounts → `{exclusionsGroup}`
   - a group whose members hold core admin roles and is excluded from an admin-portal block →
     `{adminsGroup}`
   - a group excluded from the countries policy → `{travellersGroup}`
   - a group excluded from the legacy-auth, token and countries policies → `{serviceAccountsGroup}`
   - a trusted named location → `{trustedLocation}`; a countries location → `{allowedCountries}`
   - a custom authentication strength → `{strength:<name>}` with its allowed combinations
   - an application id that is not a Microsoft first-party id and appears as an exclusion → the
     author's own app; stripped, and listed in the report ("author-specific exclusion removed:
     Inforcer Integration")
   Anything unresolved is listed for the owner with the policy it sits in. Policies under an
   author's `Test/` (or similar) folder are excluded and reported as "in the author's Test
   folder", never as removed; a policy present at the previous pin and absent at the new one
   is "removed at head".
3. **Map to goals.** Match each policy to a goal by signature (users, resources, conditions,
   controls). One goal may take several policies (downloads; session lifetime) — record the set.
   A policy that matches no goal is listed as "not assessed" and becomes a Cleanup row. A goal
   with no policy is not in this baseline and never renders.
4. **Validate.** Run every validator in §3. A `must` failure stops the import; a `warn` goes in
   the report and on the step.
5. **Simulate lockouts.** For each policy, run the replay engine against the fixture tenants
   (GetIAMAI, the demo, and any the author supplies): who is stopped, who is prompted, which
   emergency account is inside. A policy that locks out the fixture's operator fails.
6. **Render every step.** Generate What to do, JSON and PowerShell from the object through the
   portal-line translator; fail on any empty section, any `{placeholder}` left unresolved, any
   policy without a grant or session control.
7. **Pin.** Record the commit and file list; nothing outside it is ever fetched (the existing
   supply-chain rule).
8. **Report.** One markdown file per baseline version under `docs/baselines/<owner>-<repo>/
   <commit>.md`: policies, goal map, placeholders, validator results, lockout results, and the
   diff from the previous version.

---

## 3. Validators — the lessons file

Each validator names the finding that created it. New findings become new validators; nothing
is fixed only in prose.

| Id | Level | Rule | Origin |
|---|---|---|---|
| excl-01 | must | Emergency accounts are excluded through a group, never named as users; every policy excludes the same group | Round 4 note 1 |
| excl-02 | must | The exclusions group is assigned, not dynamic, and holds only the emergency accounts | checks table |
| sess-01 | must | A grant policy carries no session control; sign-in frequency and persistence live in their own policies | Round 4 notes 12–14 |
| sess-02 | must | Never-persistent applies only with all resources targeted (all tabs share one token) | Microsoft |
| ret-01 | must | No retired grant: `Require approved client app` (read-only since June 30, 2026) | audit |
| str-01 | must | Every strength id a policy references exists in the baseline (built-in or custom) | checks table |
| str-02 | warn | A phishing-resistant strength on guests or external users; guests cannot register a passkey in a resource tenant until Microsoft's B2B rollout (Oct 2026–Feb 2027), so it works only with MFA trust | Round 5 Q1 |
| str-03 | warn | A phishing-resistant strength on a risk policy for all users; the campaign must register passkeys for everyone | Round 5 Q3 |
| loc-01 | must | A policy that relaxes or blocks around `AllTrusted` has a fallback for a tenant with no trusted location (the registration block becomes require-MFA) | Round 5 Q2 |
| loc-02 | must | A countries policy excludes a countries location, and the location does not include unknown countries | checks table |
| lic-01 | must | Every control's licence is known (P1, P2, Workload ID, Defender for Cloud Apps, Intune) so the step can choose the licensed variant and list the rest under Not licensed | Round 5 Q5 |
| app-01 | warn | Application exclusions that are not Microsoft first-party ids are the author's and are stripped | Round 5 Q6 |
| pair-01 | info | Two policies that implement one goal (downloads A/B; browser and BYOD persistence) render as one step with two policies | Round 4 note 2, Round 5 Q4 |
| ver-01 | must | The pinned commit is recorded and compared with the author's head on every load; a difference renders "Baseline updated by its author" on Connect with the per-policy diff | Round 5 Q8 |
| auth-01 | must | The methods a strength accepts are enabled in the authentication methods layer; key restrictions, when on, allow the Authenticator identifiers (Android `de1e552d-db1d-4423-a619-566b625cdc84`, iOS `90a3ccdf-635c-4729-a248-9b709135078f`) and every key model registered in the tenant | Round 5 Q9 |
| auth-02 | must | An allow-list never omits a key model registered to an emergency account | Round 5 Q9 |
| shape-01 | must | Every rendered step has title, why, who, what to do, done when; a policy step has portal steps ending in a grant or session control | audit §2.A |
| name-01 | must | Proposed policy names follow the tenant's detected convention, else the baseline's prefix; one naming instruction per step | Round 4 |
| dup-01 | must | No two goals share a comms body, help-desk block or manager line | audit §2.A |

---

## 4. What the owner sees when a baseline is added

- Connect: the baseline line names the author, the version and the policy count; `change`
  offers the default, an upload, and later a URL.
- Plan: only goals the baseline holds; a Preparation step for every custom object it references
  (the strength, the groups, the locations).
- How IAMAI works → Baseline packages: the report's placeholders, stripped exclusions, and
  not-assessed policies.
- On an author update: the Connect line "Baseline updated by its author on {date}: {n} policies
  changed · review", the diff, and which steps change if the update is taken.

---

## 5. The floor

IAMAI carries a small "Microsoft recommended, not in this baseline" set (registration
protection, the legacy-authentication block, emergency access), sourced from Microsoft's own
Conditional Access templates, rendered when a baseline lacks them and labelled as not the
author's. Decided Sep 1; builds in 53.

## 6. Later — logged, not scheduled

An automation that watches every baseline the tool knows (author repos, uploaded packages),
notices a push, and tells the owner; then a purpose-built Claude skill that reads the diff,
runs the pipeline, proposes the content and validator changes, and leaves a short version note
for getiamai.com once the owner approves. Not in scope for the current overhaul.
