# Audit sheet — the exclusions group, and the free-tier ladder

Two families that share one property: neither creates a Conditional Access
policy, and both are load-bearing for everything that does.

## The exclusions group

**Steps:** `s-blocker-exclusion-group`, `s-prereq-exclusion-group`. **Gates:**
every deny-capable step.

### Verified

- Microsoft's own walkthroughs require an exclusion to exist at all: "Under
  **Exclude**, select **Users and groups** and exclude at least one account to
  prevent yourself from being locked out. **If you don't exclude any accounts,
  you can't create the policy.**" [S14]
- "Be careful when using block and all resources in a single policy. This
  combination **could lock out admins**, and **exclusions can't be configured for
  important endpoints such as Microsoft Graph**" [S25]. So "block + all
  resources" is genuinely unrecoverable without a break-glass account.
- "**Report-only policies don't require an exclusion**" [S8] — useful for a
  wizard that stages policies, and a reason not to block on report-only-only
  exclusions.
- Microsoft-managed policies need the same exclusion, and the admin's exclusions
  are preserved when Microsoft expands scope [S36].

### Gaps

| Claim | Status | Fix |
|---|---|---|
| The portal refuses to create a policy with no exclusion | **missing** | Step content |
| Exclusions cannot cover Microsoft Graph, so block+all-resources is unrecoverable | **missing** | Failure mode, high severity |
| Report-only policies do not need the exclusion | **wrong** — the tool blocks on them | Downgrade to a warning |
| Microsoft-managed policies need excluding too | **missing** | New rule |
| Members approved, no extra admins, not dynamic, used consistently, size, mail-enabled | **present** (prompt 32) | — |

Five claims: 3 missing, 1 wrong, 1 present.

## The free-tier ladder

**Steps:** `s-ladder-*`, ten rungs. **Can deny access:** no; they are portal
changes a person makes.

### Corrections carried from other sheets

| Claim | Status | Fix |
|---|---|---|
| "Microsoft recommends two to four" Global Administrators | **wrong** | "At least two emergency accounts, fewer than five Global Administrators in total" [S37, S38] |
| "App passwords live in the legacy per-user MFA settings, which Microsoft Graph does not expose" | **wrong** — per-user MFA state is readable at the beta endpoint; app passwords specifically are not | Narrow the claim to app passwords, and say IAMAI does not call the beta endpoint |
| The per-user MFA rung conflates enforcement state with the methods migration state | **wrong** | Separate them |
| Legacy-auth inventory rung tells the operator to check Exchange reports | **partial** — correct, but omits that basic auth is already disabled for most protocols, so the rung is mostly a no-op | Rewrite around SMTP AUTH |
| Security-defaults rung: "the only tenant-wide control this licence has" | **present** and correct | — |
| Security defaults blocks device code flow for new tenants from 1 Jul 2026 | **missing** | Rung content |
| Break-glass rung uses "long random passphrase" | **partial** — Microsoft's current guidance is phishing-resistant methods (FIDO2/CBA) | Update; keep the passphrase line as the fallback for a free tenant |

Seven claims: 1 missing, 3 wrong, 2 partial, 1 present.

## Necessity note (Layer F, previewed)

Both families are appropriate for a ten-person business. The exclusions group is
the one piece of Conditional Access hygiene that has no cheaper substitute, and
the ladder is explicitly the small-tenant path. Nothing here is recommended for
removal.
