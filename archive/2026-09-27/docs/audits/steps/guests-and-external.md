# Audit sheet — guests, external users, and partner access

**Goal:** `guests-mfa`; also the guest-review ladder rung. **Family:** guest.
**Can deny access:** yes.

## The thing the tool assumes and should not

Guests do not register methods in your tenant by default. A TAP **cannot be
issued to an external guest**: "If you try to add a TAP to an external guest
account… you'll receive an error stating **Temporary Access Pass cannot be added
to an external guest user**" [S2]. Only *internal* guests (`userType = Guest`
with methods held here) can be issued one.

What does work: "External guest users can sign in to a resource tenant with a TAP
issued by their home tenant if the TAP meets the home tenant authentication
requirements and **Cross Tenant Access policies have been configured to trust MFA
from the users home tenant**" [S2].

So the guest MFA story is a cross-tenant-access story, not a registration story.
Microsoft's registration guidance says plainly: exclude **All guest and external
users** from the security-info registration policy, with the note "Temporary
Access Pass does not work for guest users" [S1].

## Partner access is the SMB lockout vector nobody expects

Most small businesses are administered by a CSP partner. Microsoft documents the
failure directly [S40]:

> "What is the recommended next step if the **conditional access policy set by
> the customer blocks all external access including CSP's access
> admin-on-behalf-of to the customer's tenant?**" → "**Customers can now exclude
> CSPs from conditional access policy so that partners can transition to GDAP
> without getting blocked.**"

And [S41]: "**External partner access** — Conditional Access policies that target
external users **might interfere with service provider access, for example
granular delegated admin privileges**. For policies that are intended to target
service provider tenants, use the **Service provider user** external user type
available in the Guest or external users selection options."

The correct control is the **Service provider user** external-user type, not a
named-user exclusion — the partner's users have no stable object in the customer
tenant. "an exclude action overrides an include action in policy."

## Every way someone can be stranded

| # | Stranding | Source |
|---|---|---|
| 1 | A guest with no method in their home tenant and no cross-tenant MFA trust, blocked and unable to register here | S1, S2 |
| 2 | An external guest who cannot be issued a TAP as a recovery | S2 |
| 3 | The CSP partner administering the tenant, severed by a guest/external block | S40, S41 |
| 4 | Guests not nudged by a passkey registration campaign ("passkey support for guest users isn't currently available") | S3 |
| 5 | CAE does not support guest accounts, so revocation behaves differently | S24 |

## Comparison with what the step says today

| Claim | Status | Fix |
|---|---|---|
| Guests register in their home tenant; cross-tenant MFA trust changes the outcome | **present** — the tool already distinguishes trusted and untrusted | — |
| A TAP cannot rescue an external guest | **missing** | Step content |
| GDAP / CSP partner access can be severed | **missing** | New rule (blocking when a partner relationship is plausible) + step content |
| Use the "Service provider user" external user type, not a named exclusion | **missing** | Step content |
| Microsoft says exclude guests from the registration policy | **missing** | Cross-reference from the registration step |
| Guests are not nudged for passkeys | **missing** | Campaign content |
| CAE does not cover guests | **missing** | Step content |
| Counts active guests | **present** | — |

Eight claims: 6 missing, 0 wrong, 2 present.
