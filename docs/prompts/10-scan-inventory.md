# 10 — Scan progress, inventory pages, info tips, package instructions

Precondition: 09 committed.

## A. Scan page
1. Replace the collection list with a ProgressBar (sections complete / total, then sign-in records as a second bar with "covered back to <date>"), a plain-language "now reading: policies and named locations…" caption, and an elapsed timer. The per-section list moves under a collapsed "Details" with friendly labels ("Conditional Access policies — 10 found") and no timings unless ?dev=1.
2. When the scan finishes, show a completion card: "Scan complete · <n> users · <n> policies · sign-in records for <window>" with Next: Setup.

## B. Inventory (new tabbed area on the Scan page, below the completion card; also reachable from the stepper as "Scan → Inventory")
Read-only tables built on DataTable, no analysis, the data as found. Every table has CSV export and a one-line InfoTip explaining where the data comes from.
- Policies: name, state chip, users summary (All / N groups / N roles / guests), apps summary, conditions summary (client apps, platforms, locations, risk, flows), grant, session; expandable row shows the resolved include/exclude names. Microsoft-managed flag.
- Named locations: name, type, trusted, countries or IP ranges, used by N policies.
- Authentication: methods policy (each method, state, targets), authentication strengths (name, built-in/custom, combinations), registration statistics (from userRegistrationDetails: capable, passwordless-capable, by method tier), registration campaign state, security defaults state.
- People: users table (name, UPN, type, activity, MFA state, strongest method, licence tier, roles), and a Groups sub-tab listing every group referenced by any policy with member count, dynamic flag, and which policies reference it.
- Devices: OS, trust type, compliant, managed, last sign-in, owner.
- Roles: role, active holders, eligible holders.
- Licensing: SKU, seats (enabled/consumed), service plans → capabilities detected; tenant capability summary.
- Apps & service principals: app, sign-in summary (30 days), last SP activity; workload facets detected.
- Sign-in records: window covered, counts by client app, by protocol, by country (distinct users), device-code and auth-transfer users, blocked today by policy. No raw rows.

## C. Info tips
Replace every "?" with InfoTip; definitions come from src/copy/definitions.ts.

## D. Package instructions page (route /baseline/package)
Linked from the Baseline page's upload line. Sections: What a package is (Graph conditionalAccessPolicy JSON, one per file or an array, any casing); Three ways to make one — (1) Entra admin center: Protection → Conditional Access → Policies → each policy → the JSON view → save (click path with the exact button names), (2) PowerShell: `Get-MgIdentityConditionalAccessPolicy -All | ConvertTo-Json -Depth 10` to a folder, plus named locations and authentication strengths one-liners, (3) exports from idPowerToys, CA Policy Copier, DCToolbox, CIPP, or any public GitHub repo of policy JSON; What to include for best results (named locations, authentication strengths, a names lookup) and what happens to references you don't include (Setup asks); What IAMAI does with the upload (nothing leaves the browser). Each command in a copy block.

Commit and push. Send screenshots of Scan (running and complete), two inventory tabs, and the package page.
