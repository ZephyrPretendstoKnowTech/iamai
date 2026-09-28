# Audit sheet — legacy authentication and authentication flows

**Goals:** `block-legacy-auth`, `block-device-code`, `block-auth-transfer`.
**Family:** block. **Can deny access:** yes.

## What it changes

Three block policies: legacy protocols (Client apps = Exchange ActiveSync
clients + Other clients), device code flow, and authentication transfer.

## The correction the tool most needs

**Basic authentication in Exchange Online is already disabled, irreversibly.**
"**Basic authentication is now disabled in all tenants.**… Now no one (you or
Microsoft support) can re-enable Basic authentication in your tenant" [S19].
Affected: "EAS, POP, IMAP, Remote PowerShell (RPS), EWS, OAB, Autodiscover,
Outlook for Windows, and Outlook for Mac. We also disabled SMTP AUTH in all
tenants where it wasn't being used."

So for most tenants a legacy-auth block against those protocols is a **no-op
worth saying**: it closes a door Microsoft already welded shut. The live
exception is **SMTP AUTH**, which remains available and is the only remaining
basic-auth path [S20].

The tool currently presents this step as high-risk breakage across all those
protocols. That over-warns, and over-warning has a cost: it makes an SMB
postpone a step that is, in 2026, usually free.

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| Multifunction printers / scanners / SMTP relays using client SMTP submission | Blocked. SMTP is explicitly in the "Other clients" list, and a printer authenticating as a mailbox is a user sign-in. | S21, S20 |
| Certificate-based authentication on mobile | "Certificate-based authentication is still legacy authentication and as such will be blocked by Microsoft Entra Conditional Access policies that block legacy authentication." An easily missed casualty. | S19 |
| Exchange ActiveSync users | "the affected user receives a **single quarantine email**" | S21 |
| Shared devices, digital signage, conference-room devices (device code flow) | Blocked | S22 |
| The **Device Registration Service** | Must be excluded (client ID `01cb2876-7ebd-4aa4-9cc9-d28bd4d359a9`) when a device-code policy targets all resources | S22 |
| Any later sign-in in a session that used device code flow (**protocol tracking**) | "not being able to access certain resources, or **complete device sign out**"; error `AADSTS530036` | S22 |
| Outlook desktop→mobile QR handoff (authentication transfer) | Broken by design | S22 |

## Dependencies and what Microsoft says to do first

1. **Find the usage first**, and specifically on the non-interactive tab:
   Microsoft tells you to repeat the sign-in-log filter on "User sign-ins
   (non-interactive)" and to use the "Sign-ins using legacy authentication"
   workbook [S21]. **A tool that samples only interactive sign-ins under-reports
   legacy auth and gives a falsely clean pre-flight.**
2. Deploy in report-only, and "exclude at least one account to prevent yourself
   from being locked out due to misconfiguration" [S21].
3. For printers, the documented exits are **SMTP relay via an inbound connector**,
   **Direct Send**, **High Volume Email**, **Azure Communication Services**, or an
   on-prem relay — *not* a Conditional Access exclusion for the printer's
   mailbox, which reopens password spray on that account [S20].
4. "Client SMTP submission using Basic authentication **isn't compatible with
   Security defaults**" [S20]. SMTP AUTH is disabled by default for tenants
   created after January 2020.
5. Microsoft's own deployment plan puts device code flow and authentication
   transfer in **Phase 3 (week 3–4)**, not the first wave [S22].

## Configuration constraint the tool gets wrong

The **Exchange ActiveSync clients** checkbox "only takes effect when assigned to
specific users/groups" — selecting All users, All guest and external users, or
Directory roles makes the whole tenant subject — and "Exchange Online should be
the only cloud application assigned to the policy" [S21]. The standard
block-legacy recipe uses All users + All resources, so the EAS checkbox behaves
differently from what an admin expects.

## Unverified / field practice

- The SMTP AUTH retirement dates circulating as 1 March 2026 → 30 April 2026 are
  **not on Microsoft Learn**. Learn says only "Microsoft has announced plans to
  retire Basic authentication for SMTP AUTH… we recommend referring to the latest
  official announcement" and links a Tech Community blog. **Do not hard-code
  dates.** Say a retirement is announced and point at the announcement.

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| Basic auth is already disabled for EAS/POP/IMAP/EWS/RPS/OAB/Autodiscover, so the block is largely a no-op | **missing** — the step implies all these still work and will break | Step content; downgrade predicted disruption |
| SMTP AUTH is the live exception | **missing** | Step content |
| Legacy-auth detection must include non-interactive sign-ins | **missing**, and the tool reads only the interactive log | Correct the evidence claim, or state the limit plainly |
| Certificate-based auth on mobile is caught | **missing** | Failure mode |
| Device Registration Service must be excluded from a device-code block | **missing** | Blocking rule |
| Protocol tracking can sign a device out entirely | **missing** | Failure mode, high severity |
| EAS quarantine email | **missing** | Help-desk content |
| Printer exits are SMTP relay / Direct Send / HVE / ACS, not a CA exclusion | **missing** — the tool says "carve them out first", which is the wrong fix | Replace with the documented alternatives |
| EAS checkbox assignment constraint | **missing** | Step content |
| Authentication transfer is conditional advice, not a universal recommendation | **missing** | Soften the step |
| Names printers, scanners, LOB apps, scripts | **present** | — |
| Counts affected accounts from evidence | **present** | — |

Twelve claims: 10 missing, 0 wrong, 2 present. (The "wrong fix" for printers is
counted as missing-and-replaced.)
