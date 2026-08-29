# Audit sheet — tenant-state conflicts

**Steps:** `s-prereq-security-defaults` ("Turn off security defaults"),
`s-prereq-per-user-mfa` ("Retire per-user MFA"), and the free-tier ladder rungs
that touch the same settings. **Can deny access:** indirectly, yes.

## Security defaults: the tool's claim is half wrong

The tool says Conditional Access "cannot exist" while security defaults are on.
Microsoft says something more precise and more dangerous:

> "If security defaults are turned on, **you can create new Conditional Access
> policies, but you can't turn them on.**" [S32]

A tool that creates policies and reports "created" would let an admin believe the
tenant is protected when nothing is enforcing. That is a false-safety failure,
which is worse than a blocked action.

The reverse direction is also sharper than the tool states: "If one or more
Conditional Access policies exist in **any state (Off, On, or Report only)**, you
can't turn on security defaults. You need to **delete** all existing Conditional
Access policies before you can turn on security defaults." Microsoft adds:
"Before you delete any Conditional Access policies, be sure to record their
settings" [S32]. Going back is destructive and needs a saved copy.

## The gap between off and enforced

Microsoft's sequencing is documented: "After administrators disable security
defaults, organizations should **immediately** enable Conditional Access policies
to protect their organization", and "**Caution: Don't turn off security defaults
unless you're switching to Conditional Access policies**" [S33]. The documented
order is: turn off security defaults → recreate the baseline policies from
templates → adjust MFA exclusions → create new policies [S32].

Microsoft never names the window as an "unprotected gap" — that framing is our
inference and should be labelled as such.

Also new: security defaults now **blocks device code flow** for all new tenants
from 1 July 2026, with no exception path except moving to Conditional Access
[S33]. A tenant relying on Teams Rooms or IoT sign-ins under security defaults is
already affected.

## Per-user MFA

- Conflict, verbatim: "**Don't enable or enforce per-user Microsoft Entra
  multifactor authentication if you use Conditional Access policies.**" *Enforced*
  means MFA "is **required at sign-in**", irrespective of Conditional Access
  conditions [S34].
- "Enabling MFA through a Conditional Access policy doesn't change the state of
  the user. Don't be alarmed if users appear disabled" [S34].
- Migration order: require MFA via Conditional Access **first**, then set every
  user to Disabled [S35].
- **The tool's claim that per-user MFA state "is not exposed by Microsoft Graph
  at all" is wrong.** It is readable at `GET
  /beta/users/{id}/authentication/requirements` returning `perUserMfaState`
  [S34]. Beta only, and IAMAI does not call it — which is a different and honest
  statement.
- The authentication methods **migration state** (Pre-migration / Migration in
  Progress / Migration Complete) is a **separate concept** about which methods
  policy is authoritative, not about per-user enforcement. The tool's free-tier
  ladder and the `bg.perUserMfaOff` rule conflate the two.

## Microsoft-managed policies

Policies the admin never created arrive in report-only and **Microsoft turns them
on** "no less than 30 days after they're introduced… in some cases… faster than
30 days", with two weeks' notice. They cannot be renamed or deleted, only
excluded or toggled, and their scope auto-expands, though "any admin-configured
exclusions are always preserved" [S36].

The tool snapshots Conditional Access state and plans against it. It does not say
that the floor moves.

## Global Administrator count

**The tool's "Microsoft recommends two to four" is not a Microsoft
recommendation.** The documented figures are: "**Limit the number of Global
Administrators to less than 5**"; an alert at "5 or more privileged Global
Administrator role assignments"; "Limit the number of privileged role assignments
to less than 10"; and "Microsoft recommends that organizations have **two**
cloud-only emergency access accounts permanently assigned the Global
Administrator role" [S37]. Plus "at least two admin emergency access accounts"
[S38].

The defensible statement is **"at least two emergency access accounts, fewer than
five Global Administrators in total"** — and the two break-glass accounts count
toward the five.

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| "CA policies cannot exist while security defaults are on" | **wrong** — they can be created, just not enabled | Correct the copy; add the false-safety warning |
| Turning security defaults back on requires deleting every CA policy | **missing** | Rollback content |
| "Record the settings before deleting" | **missing** | Rollback content |
| Security defaults blocks device code flow (new tenants, 1 Jul 2026) | **missing** | Step content |
| "Immediately enable CA after disabling" is Microsoft's word | **partial** — the tool sequences it but does not cite | Add citation |
| The unprotected-gap framing is our inference | **wrong** (labelling) | Label it |
| Per-user MFA state not exposed by Graph | **wrong** — beta endpoint exists | Restate as "not read by IAMAI" |
| Per-user MFA enforcement vs methods migration state conflated | **wrong** | Separate the two in copy and in the ladder rung |
| Migration order (CA first, then disable per-user) | **present** | — |
| Microsoft-managed policies enable themselves after ~30 days | **missing** | New rule (warning) + step content |
| "Microsoft recommends two to four Global Administrators" | **wrong** | Restate as above |
| Security defaults conflict detected and ordered first | **present** | — |

Twelve claims: 4 missing, 5 wrong, 1 partial, 2 present.
