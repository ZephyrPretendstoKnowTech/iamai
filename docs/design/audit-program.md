# The audit program: proving the guidance is safe

The tool is now technically correct in most places. That is not the same as being safe to
follow. The break-glass gap was not a bug: the code did exactly what it was told, and what
it was told was incomplete guidance. Every remaining risk of that kind lives in the same
place, in the gap between "the tool computes this correctly" and "a person following this
will not get hurt".

This document defines how that gap gets closed and stays closed.

## 1. The three questions every audit asks

For every finding, step, and instruction the tool produces:

1. **Is it correct?** Does it match Microsoft's documented behaviour for the feature, at the
   licence tier the tenant actually has?
2. **Is it complete?** If a person does exactly what it says and nothing more, are they
   safe? What did it omit that a competent architect would have said?
3. **Is it necessary?** Does it tell them to do something that is not needed for this
   tenant, or that a small business would reasonably choose not to do?

Failure mode one (incorrect) is what tests catch. Failure modes two and three are what the
break-glass gap was, and only a domain review catches those.

## 2. Audit layers

**Layer A — Rule completeness (per subject).** For each validated object, the full set of
requirements from Microsoft's guidance, expressed as rules, with a citation for each. Done
for break-glass in prompt 32; needed for every other subject and for every goal.

**Layer B — Step safety (per step).** For each step the plan can produce, an audit sheet:
what it changes, every population that could be caught by it, every dependency it assumes,
every way it can strand someone, and what the step says about each. A step passes when its
content covers every item on its own sheet.

**Layer C — Sequence safety (per plan).** Ordering rules that hold for any tenant: nothing
that can deny access before the escape hatch is verified; no policy referencing an object
before that object exists; no MFA requirement before registration is proven; no device
requirement before enrollment coverage; no geo block before the operator's own locations
are in the allow list; no session control that can log out the person applying it.

**Layer D — Scenario coverage.** The tenant shapes the plan must survive, each as a fixture
with an expected-guidance assertion. See §4.

**Layer E — Omission audit.** The hardest and most valuable: what should the tool say that
it currently says nothing about? Run by walking Microsoft's own deployment guidance for each
control and asking what warning is missing.

**Layer F — Necessity audit.** The reverse: everything the tool tells an SMB to do that it
should not. A ten-person company does not need four rings, a change freeze, or a
department-based pilot.

## 3. Known omission candidates (starting list for Layer E)

These are the things a competent architect says that the tool currently does not. Each needs
verification against Microsoft Learn, then a rule or step-content change.

**Identity and recovery**
- Break-glass credential storage, split knowledge, and physical security (asked, not
  detectable).
- Alerting on break-glass sign-in.
- Break-glass accounts excluded from per-user MFA and from security defaults.
- What happens to break-glass if the tenant later enables a security default or a
  Microsoft-managed policy.
- Password reset and SSPR dependencies for accounts about to be locked into MFA.

**MFA and registration**
- Registration campaign interaction with the security-info registration policy: applying the
  location-restricted registration policy before people have registered locks out remote
  staff permanently.
- Users who are remote-only and cannot reach a trusted location.
- Temporary Access Pass as the recovery path, and that TAP must be enabled in the
  authentication methods policy first.
- Number matching and its effect on users trained on the old flow.
- Guests: they register in their home tenant, not yours, and cross-tenant MFA trust changes
  what your policy does.
- Shared and kiosk accounts that cannot hold a personal method.

**Device controls**
- Compliance policies must exist and be assigned in Intune before requiring compliance, or
  every device is non-compliant by definition.
- Grace period and the difference between "not evaluated yet" and "non-compliant".
- Hybrid-joined devices needing the right registration state.
- macOS, Linux, and unmanaged personal devices excluded or accounted for.
- The Company Portal enrolment path being blocked by the very policy that requires
  compliance.

**Sessions and tokens**
- Sign-in frequency effects on Teams and Outlook, and the difference between token lifetime
  and prompt frequency.
- Continuous access evaluation and why a session may survive a policy change.
- Token protection platform limits.

**Locations and network**
- Trusted locations based on egress IPs that change; VPN split tunnelling; ISP IP rotation.
- Country blocks and travel, roaming, and mobile networks that resolve to another country.
- The operator's own IP being outside the trusted range when they apply the policy.

**Applications and identities**
- Service principals and workload identities that no user policy covers.
- Exchange and SharePoint legacy auth already retired, so a block is a no-op worth saying.
- Printers, scanners, and SMTP relays as the classic legacy-auth casualties.
- App-specific policies that a tenant's line-of-business app will break under.

**Tenant state**
- Security defaults being on, which blocks CA policy creation entirely.
- Per-user MFA state conflicting with CA.
- A tenant mid-migration between per-user MFA and CA.
- Fewer than two Global Administrators.
- Partner and GDAP access that a policy could sever.

## 4. Scenario matrix (Layer D)

Each is a fixture, each asserts expected guidance, not just absence of crashes.

| Scenario | Must produce |
|---|---|
| No P1 | Free-tier ladder as the plan, no CA steps, no false gaps |
| Security defaults on | A step to disable them, ordered before any CA step, with the warning about the gap between |
| Per-user MFA enforced | Migration guidance before enforcement, and no double-prompt advice |
| One Global Administrator | A blocker: create a second before anything |
| No break-glass at all | Phase 0 with the full creation procedure |
| Break-glass synced from on-prem | Blocker with the reason |
| Remote-only workforce, no office IP | No trusted-location dependency in the registration step; alternative path offered |
| Heavy legacy auth in use | Named accounts and protocols, an exclusion path, and a migration note before the block |
| No Intune | Device steps marked unavailable, not "missing" |
| Intune present but no compliance policies | Blocker before requiring compliance |
| Guests from many tenants | Cross-tenant MFA trust explained; no assumption they register locally |
| Shared or kiosk accounts | Excluded, named, with the reason |
| GDAP partner access | Warning that a policy could sever partner access, and how to scope it |
| Frontline or shift workers | No assumption of email, and a comms path that reaches them |
| Multi-geo or travelling staff | Geo step includes travel handling |
| A tenant already mid-rollout | No duplicate steps, correct progress |
| 25,000 users | Cohorts, no name lists, plan still coherent |
| Everything already perfect | A plan that says so without inventing work |

## 5. Cadence

- Layer A and B run once per subject and per step family, then on any change to that family.
- Layer C is permanent: property tests that run on every build.
- Layer D fixtures run on every build.
- Layer E and F are human-led reviews, repeated whenever a new goal or step type is added.
- Every audit produces a document under `docs/audits/` naming what was checked, against what
  source, and what changed.

## 6. Evidence and citations

Every rule and every "what could go wrong" item carries a Microsoft Learn citation, stored
with the rule, rendered as a named link in the UI and in print. A rule without a citation is
a rule nobody has verified. The reference page at `#/checks` lists them, which is also the
page that answers "how do I know this tool is right".
