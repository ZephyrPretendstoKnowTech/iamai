# Design: naming, formatting, and safe consolidation

Security gaps are the priority; how a tenant is organised is not cosmetic either. A tenant
where three policies do what one baseline policy does, under names nobody can parse, is a
tenant where the next person makes a mistake. This is the second-priority report the tool has
always promised and never delivered properly.

## 1. Why naming matters, said once

A short explainer, linked from every naming suggestion:

A Conditional Access policy name is the only thing an admin sees in a list of forty. A good
one answers three questions without opening it: who it applies to, what it does, and whether
it is on purpose. The convention below is a common one, not the only one; what matters is
that a tenant picks one and holds to it.

**Policies:** `<Prefix> - <Scope> - <Action> - <Target>`
e.g. `Core - Global - Block - Legacy authentication`, `Core - Admins - Require - Phishing-resistant MFA`.

- **Prefix** groups policies that belong to one set, so they sort together and a stranger can
  tell yours from Microsoft's.
- **Scope** is who: Global, Admins, Guests, a persona.
- **Action** is Block, Require, Grant, Session.
- **Target** is the thing being protected or restricted.

**Groups:** `<Prefix> - <Purpose> - <Scope>`
e.g. `Core - Exclusion - Break-glass`, `Core - Pilot - MFA enforcement`, `Core - Exception - Legacy service accounts`.

An exclusion group's name should make its risk obvious: anyone reading `Core - Exclusion -
Break-glass` knows the members are outside the policies, which is the point of naming it that
way.

**Named locations:** `<Prefix> - <Kind> - <Where>` e.g. `Core - Trusted - Head office`,
`Core - Allowed countries`.

## 2. Detecting the tenant's own convention

The tool already infers a prefix. Extend it: detect the separator, the segment order, and the
casing from the tenant's existing policy names, and express every proposal in that convention
rather than the tool's default. Where no convention is detectable (fewer than 60% agreement),
propose the one above and say it is a proposal.

## 3. The organisation report

A section under Findings → Details, never mixed into security findings:

- **Policies that do one goal between them.** Where two or more enabled policies share a goal
  and could be one, list them with what each contributes and what a single policy would look
  like. Only when population and controls genuinely match; persona splits are correct and are
  never flagged (this rule already exists and must be respected here).
- **Names that do not match the tenant's own convention**, with the proposed name.
- **Policies with no prefix at all**, which is what makes a list unreadable.
- **Groups referenced by policies whose names do not say what they are for**, with a proposal.
- **Report-only policies older than 30 days**, which are usually forgotten rather than
  observed.
- **Disabled policies**, which are usually abandoned.

Every item carries the same three parts as a security step: what, why it matters here, and
the exact change.

## 4. Consolidation is a change, not a rename

Merging three policies into one changes evaluation, and doing it badly is how people lock
tenants out. The tool must never suggest deleting a policy and creating a replacement.

The safe procedure, and the only one the tool proposes:

1. Create the consolidated policy in report-only, alongside the existing ones.
2. Observe it for the window its control class requires (see observation-and-readiness.md).
3. Compare: every user the old policies affected must appear under the new one, and no new
   user may appear. The tool checks this from sign-in evidence and states the result.
4. Enforce the new policy.
5. Only then disable the old ones, one at a time, watching for 72 hours after each.
6. Delete nothing for 30 days.

A rename is different and is safe: renaming a policy changes no evaluation. Say so, so people
do not treat the two as equally risky.

## 5. Service principals that do not exist by default

Some baseline policies target first-party applications whose service principal is not present
in a tenant until something uses it. Targeting a missing service principal silently matches
nothing.

For each such reference the tool detects as missing, the step includes:

- Which application, by name and app id, and what the policy would do with it.
- A one-line PowerShell command to create the service principal, using the Graph module the
  tool already recommends elsewhere:
  `New-MgServicePrincipal -AppId <app-id>`
- The one line before it that connects with the least privilege needed:
  `Connect-MgGraph -Scopes "Application.ReadWrite.All"`
- One sentence on what the command does and that it creates an enterprise application entry
  and nothing else.
- A note that this is a write operation the user performs themselves; IAMAI does not run it.

Both lines are copyable separately. No multi-line scripts, no loops, no error handling: if a
command needs more than one line, the step gives the portal path instead.
