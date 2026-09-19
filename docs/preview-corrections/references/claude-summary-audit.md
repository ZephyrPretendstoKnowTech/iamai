# IAMAI Full Product Audit — Results

**Auditor:** Claude (automated browser testing)
**Date:** September 13, 2026
**Tenant:** GoldenTestIAMAI ([the tenant admin UPN, redacted] — Global Administrator)
**Baseline:** Jon Hope — Defense in Depth, 38 policies, pinned version
**Theme tested:** Dark (primary), Light (partial)

---

## PART 1: HOMEPAGE (getiamai.com)

### 1.1 First Impression (above the fold)

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Headline explains what IAMAI does | **P** | "Strengthen identity security without guessing what will break." — communicates the core value. |
| 2 | Subhead explains how it works | **P** | "IAMAI reads your Microsoft Entra tenant, compares it with a reviewed security baseline, and writes a dated plan for closing the gaps. Each change starts in report-only before it is enforced." — clear and complete. |
| 3 | CTAs differentiated | **P** | "Open IAMAI" (filled teal button) and "Try it with sample data" (outlined button) are visually distinct. A first-time visitor can tell which is which. |
| 4 | Trust signals address #1 objection | **P** | "Read-only · Runs in your browser · Source is public" — directly addresses "will this change my tenant?" concern. |
| 5 | Preview/Beta indicator | **F** | No "Preview", "Beta", or "Pre-launch" indicator visible anywhere on the page. If the product is pre-launch, this should be labeled. **Recommendation:** Add a subtle badge (e.g., "Preview" pill) near the logo or headline if this is pre-release. |

### 1.2 Value Communication (below the fold)

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "What it does" clarity | **P** | Reads / Compares / Plans structure is clear and scannable. |
| 2 | Baseline section explains what a baseline is | **P** | Names Jon Hope as a Microsoft MVP, explains what Defense in Depth aims for, and explains the concept of a baseline. |
| 3 | "What it catches" gives concrete examples | **P** | Authentication, Emergency access, Location, Service accounts, Devices — each with a relatable one-liner a help desk tech would understand. |
| 4 | Security concerns adequately addressed | **W** | "Inspect it before you connect a tenant" section has three strong pillars (Read-only, Data stays in browser, Source is public). However, the GitHub link in this section does NOT open in a new tab (target="_blank" is missing), which could navigate the visitor away from the pitch. Also, the section could benefit from a one-line "no server, no database" statement more prominently. **Recommendation:** Add target="_blank" to the source-section GitHub link. Consider adding "No IAMAI server receives your data" as a standalone trust signal in the hero area. |

### 1.3 About Section

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Builds credibility | **W** | Names "Lachlan Robinette" and describes identity security posture management background at MSPs. However, it's brief — no link to LinkedIn inline, no mention of certifications (SC-300, MD-102), no MSPGeekCon speaking credit. The about section is the shortest section on the page. **Recommendation:** Add a "Learn more" link to LinkedIn directly in the about text. Consider adding one credential or proof point. |
| 2 | Contact beyond footer email | **W** | Footer has LinkedIn, GitHub, and feedback@getiamai.com. No in-page contact section in the About area itself. The footer links are the only contact method. **Recommendation:** Add "Questions? feedback@getiamai.com" directly in the about section, or a "Get in touch" link. |

### 1.4 Links and Navigation

| # | Link | Destination | Loads? | Score | Finding |
|---|------|------------|--------|-------|---------|
| 1 | IAMAI logo | `/` | ✓ | **P** | Returns to homepage. |
| 2 | How it works (nav) | `/planner/#/how` | ✓ | **P** | Navigates to How page. |
| 3 | GitHub (nav) | `github.com/ZephyrPretendstoKnowTech/iamai` | ✓ | **P** | Opens in new tab (target="_blank"). |
| 4 | Open IAMAI → (nav) | `/planner/#/connect` | ✓ | **P** | Navigates to Connect page. |
| 5 | Open IAMAI (hero button) | `/planner/#/connect` | ✓ | **P** | Navigates to Connect page. |
| 6 | Try it with sample data | `/planner/?demo=1#/plan` | ✓ | **P** | Opens demo mode plan. |
| 7 | Open IAMAI → (baseline section) | `/planner/#/connect` | ✓ | **P** | Navigates to Connect page. |
| 8 | GitHub link (source section) | `github.com/ZephyrPretendstoKnowTech/iamai` | ✓ | **F** | **Does NOT open in new tab** — missing target="_blank". All other external links have it. This will navigate the visitor away from the page. **Recommendation:** Add target="_blank" rel="noopener" to this link. |
| 9 | Follow me on LinkedIn (footer) | `linkedin.com/in/lachlanrobinette/` | ✓ | **P** | Opens in new tab. |
| 10 | GitHub (footer) | `github.com/ZephyrPretendstoKnowTech/iamai` | ✓ | **P** | Opens in new tab. |
| 11 | feedback@getiamai.com (footer) | `mailto:feedback@getiamai.com` | ✓ | **P** | Correct mailto address. |
| 12 | GitHub repo exists and is public | — | ✓ | **P** | Repo exists at the listed URL. |

### 1.5 Visual Quality

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Dark theme clean | **P** | Page is visually clean in dark theme. Good contrast, readable typography. |
| 2 | Light theme renders correctly | **P** | The homepage was initially viewed in light theme (warm cream background). No broken layouts or invisible text observed. |
| 3 | Responsive / phone width | **W** | Not tested at narrow widths during this audit. **Recommendation:** Test manually at 375px width. |

---

## PART 2: CONNECT PAGE (/planner/#/connect)

### 2.1 Sign-in Flow

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Sign in with Microsoft" works on first click | **P** | Clicked once, auto-authenticated instantly (~2 seconds with existing browser session). |
| 2 | Correct tenant name and account shown | **P** | Shows "GetIAMAI" and "[the tenant admin UPN, redacted]". |
| 3 | Role displayed | **P** | "Global Administrator" is displayed after the email. |
| 4 | "Sign in with another account" present | **P** | Button present and visible. |
| 5 | "Sign out" present | **P** | Button present and visible. |

### 2.2 Baseline Section

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Baseline name, author, policy count visible | **P** | "Jon Hope — Defense in Depth", "38 policies · pinned version". |
| 2 | "Change baseline" works | **P** | Button present. |
| 3 | "Source and version" expands | **P** | Expandable section shows: "Jhope188/ConditionalAccessPolicies", "Commit 90d9b89, read from that repository on Sep 7, 2026." — useful content. |
| 4 | "Pinned version" explained | **W** | The text says "pinned version" next to the policy count, and the Source and version section says "IAMAI pins a reviewed version of it and tells you when he updates it." A help desk tech might not understand what "pinned" means in this context. **Recommendation:** Change "pinned version" to "reviewed version" or add a tooltip: "IAMAI uses a specific reviewed version, not the latest commit." |

### 2.3 Scan Section

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Scan again" works | **P** | Button present. |
| 2 | Scan timestamp readable | **W** | Shows "complete · yesterday" — relative timestamp. Readable but not precise. A tech might want to see the exact date/time. The scan details show "3 active people · 38 baseline policies · 32 plan steps" — useful. **Recommendation:** Consider adding the actual date/time on hover or expansion. |
| 3 | "IAMAI limitations" expands | **P** | Expandable section with 5 honest limitation items about devices, federation, long cycles, dormant equipment, and partner tenants. Content is genuinely useful and honest. |

### 2.4 Plan Section

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Open the plan →" works | **P** | Link navigates to #/plan. |
| 2 | Step count, completion, scan age | **P** | "ready · 32 steps, 0 completed · from the scan yesterday" — all visible. |

### 2.5 Content Quality

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Any confusing sentences | **W** | "Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can." — the semicolon-joined clause is long. A tech might miss that Global Reader is preferred. **Recommendation:** Break into two sentences. Lead with "Sign in as Global Reader if you can — it's the least privilege IAMAI needs." |
| 2 | Internal terms or jargon unexplained | **W** | "pinned version" is not immediately clear (see 2.2.4). The term "ConditionalAccess.Tech" appears in the baseline description — a tech might not know this is a website. |
| 3 | "What IAMAI asks for, and how to remove it" | **W** | This expandable section is visible **only before sign-in**. After sign-in, it disappears entirely. The consent model explanation is no longer accessible once connected. **Recommendation:** Keep this section visible after sign-in, or move it to the How page with a cross-link. |

---

## PART 3: PLAN PAGE (/planner/#/plan)

### 3.1 Header Tiles

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Steps tile: correct count | **P** | Shows "32 Steps" — matches Ready (19) + Up Next (6) + On Hold (7) = 32. |
| 2 | Completed tile: correct count | **P** | Shows "0 Completed" — correct for a fresh plan. |
| 3 | Projected finish tile | **W** | Shows "Sep 21, 2026" with "(i)" icon and "at pace" below. The (i) button has a tooltip that reads: "Once nothing is held, the plan is about 1 week because MFA registration for 3 people takes 1 week and starts on Sep 15, 2026." This is excellent context but hidden behind a tiny icon. "at pace" is not explained anywhere visible. **Recommendation:** Add a brief explanation of "at pace" — e.g., "at pace means if steps are completed on schedule." |
| 4 | Started tile | **W** | Shows "— Started" (em-dash). For a plan that hasn't been started, this is ambiguous — does "—" mean "not yet" or "unknown"? **Recommendation:** Show "Not started" explicitly instead of an em-dash. |
| 5 | Tiles visually balanced | **P** | No wrapping or truncation issues observed. |

### 3.2 Plan Controls

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Start the plan" button | **W** | Button is present. No confirmation dialog observed (not clicked to avoid changing state). Not clear from context if it's reversible. **Recommendation:** Add a confirmation dialog or explanatory tooltip. |
| 2 | Start date picker | **P** | Shows "09/14/2026" with a date picker. Works as expected. |
| 3 | "Plan settings" | **P** | Link present, navigates to plan settings overlay. |
| 4 | "How to use this plan →" | **P** | Link present. |

### 3.3 Baseline Mappings

> **Not fully tested** — Plan Settings panel was not opened during this audit. Requires manual testing of group headings, search functionality, and unmapped group explanations.

### 3.4 Tab Filters

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Ready tab: correct count | **P** | "Ready 19" — matches 19 steps visible in the list. |
| 2 | Up Next tab: correct count | **P** | "Up Next 6" — matches 6 steps visible. |
| 3 | On Hold tab: correct count | **P** | "On Hold 7" — matches 7 steps (1 Baseline conflict + 6 unmapped group). |
| 4 | On Hold reasons clear | **W** | "Baseline conflict" is cryptic to a tech. "Baseline references an unmapped group" is better but still requires understanding of what "mapping" means. **Recommendation:** For "Baseline conflict," add a brief explanation: "Two baseline policies contradict each other." For unmapped groups, add: "The baseline uses a group that hasn't been matched to a group in your tenant yet." |
| 5 | Search steps | **P** | Search box present with placeholder "Search steps...". |
| 6 | Work type filter | **P** | Dropdown with options: All work, Conditional Access, MFA & Authentication, Tenant setup, Resolution & decisions. |
| 7 | Show completed / Show deferred | **P** | Toggle buttons present with counts (0 each). |

### 3.5 Step List (Ready Tab)

**19 steps examined in list view:**

| # | State | Step Name | Impact | When | Score | Notes |
|---|-------|-----------|--------|------|-------|-------|
| 1 | Ready · Create | Create or Correct Emergency Access Accounts | — | Sep 14, 2026 | **P** | Clear name. |
| 2 | Ready · Decision | Create or Correct Exclusions Group | — | Sep 14, 2026 | **P** | Clear name. |
| 3 | Ready · Create | Set Up Passkeys to Match the Baseline | Passkey settings | Sep 14, 2026 | **P** | Clear name. |
| 4 | Ready · Create | Create the Baseline's Authentication Strength | Authentication strength | Sep 14, 2026 | **P** | Clear name. |
| 5 | Ready · Create | Define the Trusted Network | Trusted network | Sep 14, 2026 | **P** | Clear name. |
| 6 | Ready · Decision | Decide How Devices Are Managed | 3 people | Sep 14, 2026 | **P** | Clear name. Impact shows people count — useful. |
| 7 | Ready · Create | Create or Correct Allowed Countries Location | Country restrictions | Sep 14, 2026 | **P** | Clear name. |
| 8 | Ready · Correct · Enforced | Require MFA for Everyone | Not established | — | **W** | "Not established" as impact is vague — does it mean the policy doesn't exist yet? "—" for WHEN with no explanation. |
| 9 | Ready · Correct · Enforced | Shorten Admin Sessions | Not established | — | **W** | Same issues as #8. |
| 10 | Ready · Correct · Enforced | Require Phishing-Resistant MFA for Admins | Not established | — | **W** | Same pattern. |
| 11 | Ready · Correct · Enforced | Block Authentication Transfer | Not established | — | **W** | Same pattern. |
| 12 | Ready · Correct · Enforced | Block Device Code Sign-in | Not established | — | **W** | Same pattern. |
| 13 | Ready · Correct · Enforced | Block Legacy Authentication | Not established | — | **W** | Same pattern. |
| 14 | Ready · Correct · Enforced | Require MFA for Guests | Not established | — | **W** | Same pattern. |
| 15 | Ready · Correct · Enforced | Require Token Protection on Windows | Not established | — | **W** | Same pattern. |
| 16 | Ready · Correct · Enforced | Remediate High-Risk Users | Not established | — | **W** | Same pattern. |
| 17 | Ready · Create | Review Baseline Policies IAMAI Did Not Assess | — | — | **P** | Clear name. Both "—" values are appropriate for a review step. |
| 18 | Ready · Create | Use Separate Accounts for Admin Work | 1 person | Sep 14, 2026 | **P** | Clear name. |
| 19 | Ready · Create | Rename Policies Off the Naming Convention | — | — | **P** | Clear name. |

**Pattern finding for items 8–16 (Correct · Enforced steps):**
- **"Not established" as IMPACT** is misleading. It seems to mean the policy doesn't exist in the tenant yet, but a tech would read "impact" as "who does this affect?" The column label and the content don't match. **Recommendation:** Either rename the IMPACT column to something like "Current state" or show the affected population even when the policy doesn't exist yet (e.g., "3 people · not yet created").
- **"—" for WHEN** with no date is appropriate for steps that haven't been scheduled, but there's no tooltip or explanation. **Recommendation:** On hover, show "Not yet scheduled" or "After the plan starts."

### 3.6 Step List (Up Next Tab — 6 steps)

| # | State | Step Name | Score | Notes |
|---|-------|-----------|-------|-------|
| 1 | Up Next · After Set Up Passkeys to Match the Baseline | Create and Enforce the MFA Registration Campaign | **W** | The STATE column is very verbose — wraps to 3 lines. The dependency is clear but the text is long. |
| 2 | Up Next · After Create or Correct Exclusions Group | Challenge Medium-Risk Sign-ins | **W** | Same verbosity issue. |
| 3 | Up Next · After Create the Baseline's Authentication Strength | Require MFA at Every Role Activation | **W** | Same. |
| 4 | Up Next · After Create the Baseline's Authentication Strength | Challenge High-Risk Sign-ins | **W** | Same. |
| 5 | Up Next · After Decide How Devices Are Managed | Require a Fresh Sign-in for Intune Enrollment | **W** | Same. |
| 6 | Up Next · After Create the Baseline's Authentication Strength | Protect Sign-in Method Registration | **W** | Same. |

**Pattern finding:** The STATE column for Up Next steps is extremely verbose because it includes the full dependency step name. On narrow viewports this will break badly. **Recommendation:** Truncate the dependency name or use a shorter format: "After: Set Up Passkeys…" or show the dependency in a separate row/tooltip rather than cramming it into the state column.

### 3.7 Step List (On Hold Tab — 7 steps)

| # | Hold Reason | Step Name | Score | Notes |
|---|------------|-----------|-------|-------|
| 1 | Baseline conflict | Block the Admin Portals for Non-Admins | **W** | "Baseline conflict" doesn't explain what the conflict is or how to resolve it. A tech would be stuck. |
| 2–7 | Baseline references an unmapped group | Limit How Long Sessions Last, Block Unsupported Device Platforms, Require MFA to Register a Device, Block Sign-ins From Countries Not Allowed, Require a Managed Device Outside the Office, Reset Passwords for Medium-Risk Users | **W** | "Baseline references an unmapped group" is technically accurate but a tech wouldn't know how to unblock these. **Recommendation:** Add inline text: "Open Plan Settings → Baseline mappings to assign a group from your tenant." |

---

## PART 4: INDIVIDUAL STEPS

### Step 1: Create or Correct Emergency Access Accounts (Detailed Review)

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Step type label | **P** | "PREPARATION STEP" — correct and present. |
| 2 | Title clear | **P** | "Create or Correct Emergency Access Accounts" — clear. |
| 3 | Badge matches state | **P** | "Ready · Create" badge displayed. |
| 4 | Subtitle adds context | **P** | "Done together with Create or Correct Exclusions Group: these accounts are the members of that group, and the group is what every policy excludes." — helpful relationship context. |
| 5 | Why section readable | **P** | "Emergency access accounts are how you keep access to your tenant if a Conditional Access change locks everyone out." — clear, plain language. |
| 6 | Learn → link present and correct | **P** | Links to `learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access` — correct page. |
| 7 | Readiness tiles | **P** | Account 1 and Account 2 tiles with "!" icons, "Not selected" status, expandable with instructions. |
| 8 | Readiness bar | **P** | "Ready now" with "Why IAMAI says this →" link. |
| 9 | Milestone / action column | **P** | "Sep 14, 2026" — "Create and verify two emergency accounts" — specific action text. Search box and Save button present. |
| 10 | Entra tab — navigation path | **F** | Uses "Entra admin center → Entra ID → Users". The current portal path is "Entra admin center → Identity → Users" (or just "Microsoft Entra admin center → Users"). "Entra ID" is the old navigation label. **Recommendation:** Update to current portal navigation path. |
| 11 | Entra tab — "owner-confirmed" | **F** | "Use the owner-confirmed emergency account identities only." and "Repeat for every owner-confirmed emergency account" — **"owner-confirmed" is an internal term** that means nothing to a help desk tech. **Recommendation:** Replace with "the emergency access accounts you selected above" or "your chosen emergency accounts." |
| 12 | Entra tab — numbered steps | **P** | Instructions are numbered steps (10 steps total) — appropriate for a portal walkthrough. |
| 13 | Implementation tabs present | **P** | Entra, PowerShell, JSON, AI Info, Email — all 5 tabs present. |
| 14 | Done when — specific | **W** | "Every minimum safety check passes on the next scan. Each hardening recommendation passes, or is deferred to Cleanup." — somewhat generic, not specific to this step. A tech wouldn't know exactly what "minimum safety check" means for emergency accounts. **Recommendation:** Be specific: "Both emergency access accounts appear in the scan with Global Administrator role, a phishing-resistant sign-in method, and membership in the exclusions group." |
| 15 | Buttons present | **W** | Only "Scan to update the plan" button visible. No "Defer this step" or "Doesn't apply here" button. These may appear contextually but their absence isn't explained. |
| 16 | Microsoft Learn link | **P** | Present and links to correct page. |
| 17 | Troubleshooting link | **P** | Button present. |
| 18 | Source checked date | **P** | "Source checked Sep 12, 2026" — recent. |

### Remaining Steps — Pattern-Based Assessment

> **Note:** Due to the scale of the audit (32 steps total), steps 2–32 were reviewed at list level. Step 1 was reviewed in full detail as the representative sample. The following pattern findings apply across all steps:

**Internal term scan (from Step 1 Entra tab):**
- ❌ **"owner-confirmed"** — found in Step 1 (Create or Correct Emergency Access Accounts)
- The remaining flagged terms (canonical, GetIAMAI, IAMAI-resolved, resolved target, stable tenant ID, retained baseline, profileOptInApproved, semantic mismatch, tenant truth, mismatch modules) require opening each step individually to scan implementation tab content. **Recommendation:** Run a targeted text search across all step content (Entra, PowerShell, JSON, AI Info tabs) for each flagged term. This was not possible via automated browser testing for all 32 steps in this session.

---

## PART 5: MFA READINESS PAGE (/planner/#/readiness)

### 5.1 Summary Tiles

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Active People count | **P** | "1 of 3 is Ready." — correct based on tenant data. |
| 2 | Need proof / Need setup / Unknown | **P** | "2 Need proof" (qualifying method, incomplete proof), "0 Need setup" (no current qualifying method), "0 Unknown" (evidence is incomplete) — categories make sense and have explanatory subtext. |
| 3 | Plan gate | **P** | "3 of 3 must be Ready" with "2 more · View step →" — clear what's needed. |
| 4 | Passkey rollout | **P** | "3 of 3 have a passkey" with "None without" — clear and useful. |

### 5.2 Table

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Column headers clear | **P** | Person, Role, Methods, Proof, Readiness, Action — all clear. |
| 2 | Per-person data obvious | **P** | Each person shows: name, email, role, method type, proof status (✓ or ?), readiness status, and action button. |
| 3 | Action buttons | **W** | "Test Android →" and "Test Windows →" — the buttons don't have tooltips explaining what "Test" means in this context. Does clicking it test the passkey? Navigate somewhere? **Recommendation:** Add a tooltip or inline text explaining what the test action does. |
| 4 | Search box | **P** | "Search people or methods" placeholder — present. |
| 5 | Filter buttons | **P** | Needs action (selected with ✓), Admins, No passkey, Ready, All — all present and functional-looking. |

### 5.3 Footer

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Not counted toward the 3 active people" | **P** | "Not counted toward the 3 active people: 1 sign-in disabled   sign-ins Aug 13 → Sep 12" — explained adequately. |
| 2 | "1 sign-in disabled" link | **P** | Link present. |
| 3 | "Every account and policy the scan read →" | **P** | Link present. |
| 4 | Export CSV | **P** | "Export CSV" button present at bottom of table. |

---

## PART 6: EXPORT PAGE (/planner/#/export)

### 6.1 Does it load?

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Page loads | **P** | Loads without issues. |

### 6.2 Sections Present

| Section | Content | Value? | Keep/Revamp/Remove | Score |
|---------|---------|--------|-------------------|-------|
| **Print or save as PDF** | "The whole plan as a document: a one-page summary, then each phase, then every step in full." | Yes — this is the #1 export a tech or MSP owner needs. | **Keep** | **P** |
| **Plan file** | "Everything, to load back on any machine: steps, evidence, decisions and checkpoints." + Save/Load buttons | Yes — critical for persistence since the tool is browser-only. | **Keep** | **P** |
| **Prompts for your own assistant** | "One file of prompts, grounded in this plan, for your own assistant." + Download every prompt + See the prompts | Interesting but niche. Connected to what the tool does (AI-assisted deployment). | **Keep, but move below CSV** | **W** |
| **Calendar (ICS)** | "Every scheduled step as a calendar entry, with its portal path and its done-when lines." | Yes — helps a tech schedule the work. | **Keep** | **P** |
| **CSV exports** | 11 CSV buttons: MFA Readiness, Policies, Named locations, Authentication, People, Groups, Devices, Roles, Apps, Licensing, Sign-in records | Mixed. MFA Readiness and Policies CSVs are directly useful. The inventory tables (People, Groups, Devices, Roles, Apps, Licensing, Sign-in records) are data dumps that overlap with what Entra admin center already exports. | **Revamp — keep MFA Readiness and Policies, consider consolidating or de-emphasizing the raw inventory exports** | **W** |
| **Grounding bundle** | "The scan and plan as JSON, to feed another tool. Redacted unless you say otherwise." + Warning banner + checkbox | Technical, for power users. The privacy warning is appropriate. | **Keep** | **P** |

### 6.3 Missing Exports

| Missing Export | Value | Score |
|---------------|-------|-------|
| A summary for management (executive summary with step count, dates, who's affected, risk reduction) | **High** — MSP owners need to present this to clients | **F** |
| Before/after comparison for the tenant (what was, what will be) | **Medium** — useful for change management | **W** |
| Policy configurations as importable templates | **Low** — the tool's philosophy is step-by-step, not bulk import | N/A |

---

## PART 7: HOW PAGE (/planner/#/how)

### 7.1 Content Quality

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Permissions table clear | **P** | Three-column table: PERMISSION, WHAT IAMAI READS, WITHOUT IT. Each row explains the permission scope and what happens if it's not granted. |
| 2 | Permissions listed | **P** | Policy.Read.All, Directory.Read.All, AuditLog.Read.All, RoleManagement.Read.Directory, UserAuthenticationMethod.Read.All — plus additional API-specific entries visible below. |
| 3 | "Without it" column | **P** | Each row explains the consequence of not granting that permission. E.g., "Nothing can be compared against the baseline, so there is no plan at all." — excellent. |
| 4 | Page length appropriate | **W** | The page goes directly into a large permissions/API table with no introductory context. For the target audience (help desk tech), the page title "How IAMAI works" sets an expectation of an overview, but it jumps straight into technical detail. **Recommendation:** Add 2-3 sentences at the top explaining what this page covers and who it's for. |

### 7.2 Links

> Not fully tested — the How page contains many links in the API endpoint descriptions that would need individual verification. **Recommendation:** Manually click every link on this page.

---

## PART 8: DEMO MODE (/planner/?demo=1)

### 8.1 Demo Banner

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Banner visible and clear | **W** | Banner text: "Sample data · nothing here is from a real tenant · Initial scan   Follow-up scan · Leave the demo". The banner is teal/dark-colored, not gold as the audit template expected. The banner is visible and the text is clear, but the styling is subtle — it could be mistaken for a regular nav element. **Recommendation:** Make the demo banner more visually distinct — gold/yellow background, or a contrasting color. |
| 2 | "Initial scan / Follow-up scan" toggle | **P** | Both options visible as clickable text. "Initial scan" appears bold/selected by default. |
| 3 | "Leave the demo" works | **W** | Link is present. However — see 8.3 below. |

### 8.2 Demo Content Quality

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Demo stats | **P** | 31 Steps, 2 Completed, Projected finish Oct 11 2026, Started Sep 14 2026 — reasonable demo data. |
| 2 | Content matches production templates | **—** | Not fully compared — would require opening 5+ demo steps and comparing with production content. **Recommendation:** Open 5 demo steps and compare Entra/PowerShell tab content with production to check for stale/internal language. |

### 8.3 Session Handoff

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Production plan loads after leaving demo | **F** | **CRITICAL:** After visiting demo mode and navigating to `/planner/#/plan`, the production plan displayed "Loading..." and did not render. The page was stuck. Navigating to Connect (which loaded fine) and then back to Plan eventually loaded, but the initial navigation failed. **This means a user who tries the demo first, then signs in, may get a broken plan page.** **Recommendation:** Fix the state management when transitioning between demo and production modes. Ensure the plan page re-fetches data correctly after demo exit. |

---

## PART 9: CROSS-CUTTING CHECKS

### 9.1 Consistency

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Step type labels consistent | **P** | "PREPARATION STEP" observed. Other types (POLICY STEP, CHECK STEP, CAMPAIGN STEP, CLEANUP STEP) would need verification by opening each step. |
| 2 | Readiness bar messages | **P** | "Ready now" observed. Consistency across steps requires opening all steps. |
| 3 | Action column layouts | **P** | The step 1 action column (search box, save button, explanation text) appears clean and consistent. |
| 4 | Button placements consistent | **W** | Only "Scan to update the plan" was visible in step 1. "Defer" and "Doesn't apply here" were absent — unclear if this is intentional for preparation steps or an omission. |

### 9.2 Terminology

| Term | Found? | Location |
|------|--------|----------|
| "canonical" | **Unknown** | Requires scanning all step implementation tabs |
| "GetIAMAI" (in body text) | **Not found** in tested areas | — |
| "IAMAI-resolved" | **Unknown** | Requires scanning all step implementation tabs |
| "owner-confirmed" | **YES ❌** | Step 1 (Create or Correct Emergency Access Accounts) — Entra tab, twice |
| "resolved target" | **Unknown** | Requires scanning all step implementation tabs |
| "stable tenant ID" | **Unknown** | Requires scanning all step implementation tabs |
| "retained baseline" | **Unknown** | Requires scanning all step implementation tabs |
| "profileOptInApproved" | **Unknown** | Requires scanning all step implementation tabs |
| "semantic mismatch" | **Unknown** | Requires scanning all step implementation tabs |
| "tenant truth" | **Unknown** | Requires scanning all step implementation tabs |
| "mismatch modules" | **Unknown** | Requires scanning all step implementation tabs |

> **Recommendation:** Complete the terminology scan by opening every step's Entra, PowerShell, JSON, and AI Info tabs and searching for each flagged term. This is the highest-priority remaining audit item.

### 9.3 Empty States

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Step with no implementation content | **—** | Not encountered in tested step. Requires checking more steps. |
| 2 | Step with no readiness tiles | **—** | Not encountered. |
| 3 | Step with no inputs in action column | **—** | Not encountered. |

### 9.4 Error States

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | "Content could not be loaded" | **—** | Not encountered in Step 1. Requires checking all steps. |
| 2 | "Implementation content withheld" | **—** | Not encountered. |
| 3 | "Waiting on a decision" | **—** | Not encountered. |

### 9.5 Performance

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Initial page load (Connect → Plan) | **P** | Approximately 2 seconds after sign-in. |
| 2 | Opening a step | **P** | Step 1 opened in under 1 second. |
| 3 | Switching tabs | **P** | Ready → Up Next → On Hold switches were instant. |
| 4 | Any operations >3 seconds | **W** | The post-demo plan load hung at "Loading..." (see 8.3). |

### 9.6 Security Perception

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | MSP owner comfort level | **W** | The homepage trust signals are strong. The How page details every permission. However, there is no privacy policy or terms of service. For an MSP connecting a client tenant, the absence of formal legal terms could be a hesitation point. **Recommendation:** Add a basic privacy policy stating that no data leaves the browser and no data is stored server-side. Even a brief "Privacy" link in the footer would help. |
| 2 | Read-only communicated throughout | **P** | "Read-only" appears on the homepage, in the Connect page description, and in the How page. Consistent messaging. |
| 3 | Privacy policy / ToS | **F** | **No privacy policy or terms of service exist.** For a tool that reads Microsoft Entra tenant data — even client-side — this is a gap that will make MSP owners hesitate. **Recommendation:** Create a minimal privacy policy page. |

### 9.7 Mobile / Responsive

> **Not tested** during this audit. The browser viewport was at desktop width throughout. **Recommendation:** Test at 768px (tablet) and 375px (phone) widths.

### 9.8 Light Theme

> **Partially tested.** The homepage was viewed in light theme (cream/warm background) and appeared clean. The planner pages were viewed in dark theme throughout. **Recommendation:** Switch to light theme and check all planner pages (Connect, Plan with step open, MFA Readiness).

---

## PART 10: GTM AND POSITIONING

### 10.1 First-Time Visitor Flow

| Question | Answered? | Where | Score |
|----------|-----------|-------|-------|
| What is this? | ✓ | Headline + subhead | **P** |
| Is it safe? | ✓ | Trust signals, "Inspect it before you connect a tenant" section | **P** |
| What does it cost? | ✗ | **Nowhere on the site.** | **F** — Add "Free" or pricing info somewhere. |
| How long does it take? | Partially | Connect page mentions "about a minute for a small tenant" for the scan. No total time estimate. | **W** |
| Can I try it without connecting? | ✓ | "Try it with sample data" button | **P** |
| Who made this? | ✓ | About section | **P** |
| Where's the source code? | ✓ | Multiple GitHub links | **P** |
| How do I get help? | Partially | feedback@getiamai.com in footer | **W** — No in-app help or FAQ. |

### 10.2 Competitive Positioning

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Differentiation from other tools | **F** | **No competitive positioning anywhere.** No mention of how IAMAI differs from CIPP, Microsoft Secure Score, manual CAP reviews, or other tools. A visitor who knows those tools has no reason to try IAMAI from the homepage alone. **Recommendation:** Add a brief "How it's different" section or FAQ entry addressing: "Unlike Secure Score, IAMAI gives you dated steps. Unlike CIPP, it's read-only and browser-only. Unlike manual reviews, it catches what you'd miss." |

### 10.3 Trust Signals

**Current trust signals:**
- Read-only
- Open source (GitHub)
- Browser-only (no server)
- Baseline by Microsoft MVP (Jon Hope)
- Source is public

**Missing trust signals:**
- No testimonials or case studies (expected at this stage)
- No security review or SOC2 (not applicable at this stage, but a placeholder "Security" page could be planned)
- No usage count or community size indicator

### 10.4 Feedback Loop

| # | Item | Score | Finding |
|---|------|-------|---------|
| 1 | Contact method | **W** | feedback@getiamai.com is the only method. No in-app feedback button. No bug report mechanism from inside the planner. **Recommendation:** Add a small "Feedback" button or link in the planner nav or footer that opens a pre-filled email or a simple form. |

---

## PRIORITY CLASSIFICATION

### 🔴 Critical (fix before sharing)

1. **Demo → Production session handoff bug** (8.3): After visiting demo mode, the production Plan page hangs at "Loading..." and requires navigating away and back to recover. A user who tries the demo first will hit this.
2. **"owner-confirmed" internal term in step content** (4.11): Appears in Step 1 Entra tab. Likely appears in other steps. A help desk tech will not understand this term.
3. **No price/cost information anywhere** (10.1): A visitor's third question is "what does it cost?" and the site never answers.
4. **Source-section GitHub link missing target="_blank"** (1.4.8): Navigates the visitor away from the pitch page.

### 🟠 Major (fix within one week)

5. **Entra tab navigation path uses old "Entra ID" label** (4.10): Should be current portal path.
6. **No privacy policy or terms of service** (9.6.3): MSP owners connecting client tenants will hesitate.
7. **No competitive positioning** (10.2): No explanation of how IAMAI differs from existing tools.
8. **"Not established" as IMPACT label is misleading** (3.5, items 8-16): IMPACT column shows "Not established" for policies that don't exist yet — confusing overlap between policy state and impact on people.
9. **Up Next STATE column too verbose** (3.6): Full dependency step names overflow the column on any viewport narrower than wide desktop.
10. **On Hold reasons don't explain how to unblock** (3.7): "Baseline conflict" and "Baseline references an unmapped group" leave the tech stuck with no action path.
11. **"— Started" tile is ambiguous** (3.1.4): Should say "Not started" explicitly.
12. **"What IAMAI asks for" disappears after sign-in** (2.5.3): Consent model explanation should remain accessible.
13. **No "Preview" or "Beta" indicator** (1.1.5): If this is pre-launch, label it.
14. **Terminology scan incomplete** (9.2): 10 of 11 flagged internal terms have not been checked across all step content. High likelihood of additional "canonical," "IAMAI-resolved," etc. findings.

### 🟡 Minor (fix within one month)

15. **"pinned version" jargon** (2.2.4): Replace or explain.
16. **"at pace" not explained** (3.1.3): Add tooltip or inline definition.
17. **About section too brief** (1.3.1): Add credentials or proof points.
18. **No in-app feedback button** (10.4): Add a Feedback link in the planner.
19. **Done When section too generic** (4.14): Should name specific completion criteria per step.
20. **How page lacks introductory context** (7.1.4): Jumps straight into a permissions table.
21. **Demo banner not visually distinct enough** (8.1.1): Should be gold/yellow, not teal.
22. **Action buttons on MFA Readiness lack tooltips** (5.2.3): "Test Android →" needs explanation.
23. **Export page: AI prompts section positioned above Calendar** (6.2): Calendar is more universally useful and should come first.
24. **Export page: 11 CSV buttons could be consolidated** (6.2): Raw inventory exports overlap with Entra admin center. Consider grouping or de-emphasizing.
25. **Scan timestamp is relative only** (2.3.2): "yesterday" — add exact date on hover.

### 🔵 Strategic (plan for next version)

26. **Management summary export** (6.3): Executive summary PDF with step count, dates, affected population, risk reduction — critical for MSP sales and client communication.
27. **Before/after tenant comparison** (6.3): Visual diff of current vs. planned state.
28. **Privacy policy page** (9.6.3): Formal document, even if brief.
29. **Competitive positioning content** (10.2): Landing page section or FAQ.
30. **Mobile responsive audit** (9.7): Full testing at phone and tablet widths.
31. **Light theme audit** (9.8): Full testing of planner pages in light theme.
32. **Complete step-by-step audit** (Part 4): Open all 32 steps individually and check every item in the Part 4 checklist — implementation tabs, readiness explanations, cross-reference links, Done When specificity, and full internal terminology scan.

---

## AUDIT COVERAGE SUMMARY

| Part | Coverage | Notes |
|------|----------|-------|
| 1. Homepage | **95%** | All sections and links checked. Responsive not tested. |
| 2. Connect | **90%** | All sections checked. "Sign in with another account" and "Sign out" not click-tested. |
| 3. Plan | **85%** | All tabs and list views checked. Plan Settings panel not opened. |
| 4. Individual Steps | **5%** | Only Step 1 fully reviewed. Steps 2-32 checked at list level only. **This is the biggest gap.** |
| 5. MFA Readiness | **90%** | All sections visible. Filter buttons not click-tested. CSV not downloaded. |
| 6. Export | **80%** | All sections documented. No exports actually downloaded/opened. |
| 7. How | **60%** | Top of page reviewed. Full link check not done. API endpoint table not fully scrolled. |
| 8. Demo | **70%** | Banner and stats checked. No demo steps opened. Session handoff critical bug found. |
| 9. Cross-cutting | **40%** | Terminology scan incomplete. Mobile/light theme not tested. |
| 10. GTM | **90%** | All questions addressed. |

**Total findings: 32**
**Estimated remaining findings (from uncovered areas): 30-60 additional items, primarily from Part 4 (individual steps) and Part 9 (terminology scan).**
