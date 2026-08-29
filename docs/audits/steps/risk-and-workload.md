# Audit sheet — risk-based policies and workload identities

**Goals:** `sign-in-risk`, `sign-in-risk-medium`, `user-risk`,
`user-risk-medium` (Entra ID P2); `workload-identity-block` (Workload Identities
Premium). **Can deny access:** yes.

## Risk-based policies

### The stranding Microsoft names explicitly

> "The sign-in risk-based policy prevents users from registering MFA during risky
> sessions. **If users aren't registered for MFA, their risky sign-ins are
> blocked, and they receive an AADSTS53004 error.**" [S4]

So a risk policy enforced before registration is complete blocks exactly the
people who still need to register, and blocks them from the act of registering.
This is the same shape as the security-info registration stranding, from a
different direction, and it is a second reason the registration work must come
first.

### User-risk and password change

"**Users must have previously registered for multifactor authentication before
triggering the user risk policy**" [S12]. And the password-change control has
hard constraints: "The policy must be assigned to **All resources**"; "**Require
password change** can't be used with other controls, such as requiring a
compliant device"; it works only with user/group, all-cloud-apps, and user-risk
conditions [S12].

The tool's `user-risk` and `user-risk-medium` goals do not record these
constraints, so a generated policy could combine password change with another
control and simply not be creatable.

### What Microsoft's own template does

The documented sign-in-risk policy pairs the grant with **Sign-in frequency —
Every time** [S4]. The tool emits the grant without the session control, so it
generates something weaker than Microsoft's own template while citing that
template.

## Workload identities

Verified [S39]:

- "**Calls made by service principals aren't blocked by Conditional Access
  policies scoped to users.**"
- "**Workload Identities Premium licenses are required** to create or modify
  Conditional Access policies scoped to service principals." This is **not**
  included in Entra ID P1 or P2 — a separate paid add-on.
- Scope: "single tenant service principals registered in your tenant. Microsoft
  and third-party SaaS applications, including multitenant apps, are not
  covered… **Managed identities aren't covered by policy.**"
- "While service principals can be added to groups, Conditional Access policies
  assigned to a group that contains a service principal **are not enforced** for
  that service principal."
- Only **Block access** is available as a grant control.

For a small business the honest advice is: every user-targeted policy in this
plan has a hole the size of your application sign-ins, and closing it costs a
separate SKU.

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| Risk policy blocks unregistered users from registering (AADSTS53004) | **missing** | Failure mode + sequence rule |
| User-risk requires prior MFA registration | **missing** | Blocking rule |
| Password-change control constraints (all resources, no other controls) | **missing** | Validation rule on the generated policy |
| Microsoft's template pairs risk with sign-in frequency "Every time" | **missing** | Step content or floor change |
| Service principals are not covered by user-scoped policies | **missing** | Step content on every user-scoped step |
| Workload Identities Premium is a separate SKU, not P1/P2 | **partial** — the tool gates on a `workloadIdPremium` capability but does not say it is extra | Licence copy |
| Managed identities are never covered | **missing** | Step content |
| Group membership does not apply a policy to a service principal | **missing** | Step content |
| P2 goals correctly marked licence-limited | **present** | — |

Nine claims: 7 missing, 0 wrong, 1 partial, 1 present.
