# Walk of build 7e6fbba — demo tenant, Sep 1, 2026

Reviewer's walk of getiamai.com/rollout with sample data after prompt 51. GetIAMAI not yet
walked (sign-in required in the reviewer's browser). Mobile width not yet verified.

Verdict: not show-ready. The engine, translator and step shape are in; the step-variable layer
and the row/step consistency are not. Everything below is visible in the first three minutes
of a demo.

## P0 — wrong or broken facts on screen

1. **Plan rows use the old titles; the opened step uses the content title.** Row: "Run the
   MFA verification campaign" → body: "Create and Enforce the MFA Registration Campaign".
   Every row. Rows must render `title` from content.json; delete the plain-title table.
2. **Unfilled variables leave broken sentences.** Campaign step: "30 active people · 3
   admins · 1 guests · readiness, the plan waits for 90% until." ({readiness}, {enrollBy}
   empty); Done when: "or has passed and every holdout is reviewed."; the email: "from it
   will be required." A missing variable must suppress the line (or the step must derive it),
   never render around a hole. `{n} guests` → "1 guest" (pluralisation not applied).
3. **The campaign's lists are empty**: no method, text or call only, Authenticator without a
   passkey, never seen, holdouts — none render, and the special-care picker shows one empty
   checkbox with "·". Today lists 7 people with no method and 14 registered-unproven; the
   step shows none of them. These are 52 Part 3's derivations; they are the demo's best
   content and must land before the show.
4. **"an account IAMAI could not name"** appears in the translator's portal lines for the
   exclusions group and for two resource ids (Azure Virtual Desktop, Windows 365). The group
   placeholder must resolve to the tenant's group; the app ids to their names; and that
   phrase is forbidden vocabulary in any case.
5. **Dates**: "Announce 22 Sept 2026 · Report-only from · Enforce 29 Sept 2026" —
   {reportOnly} empty. The token-protection email says "From Monday, September 28" while the
   row and Dates say 29 Sept: an off-by-one between the long and short date renderers
   (time-zone). Two date formats on one page ("Sep 7, 2026" in phase headings, "15 Sept
   2026" in rows, "Monday, September 28" in emails): one short format everywhere, the long
   form only inside emails, both from the same instant.
6. **Empty section rendered**: token-protection shows a "Done when" heading with nothing
   under it. §8.7: a section with no content is not rendered; the policy done-when lines
   come from `shared.policyDoneWhen`.
7. **Literal `{firstName}`** in the token-protection email. Per-person emails fill the name
   or fall back to "Hi,".
8. **One readiness per kind is not one**: rows in the same plan show "MFA readiness … now
   34%" and "now 37%"; Today says 33 active people while the campaign step says 30. §2.2 and
   the population object: one value per kind, one population, everywhere.
9. **Absent goals render.** The demo plan carries "Stop attackers adding their own MFA
   method" (register-info), "Only allow protected apps on phones", "Stop downloads to devices
   you do not manage" and "Limit what personal devices can do in the browser" — all "not in
   this baseline" per the pinned goalMap. Either the demo uses a different baseline than the
   product (then it must not) or rows still derive from the catalogue floor rather than the
   goalMap.

## P1 — visible, not fatal

10. Today's Show dropdown lists the old states (MFA proven / Registered, unproven / No
    method / Not active) while the table uses Never prompted and Possibly broken; the list is
    `pages.today.show`. Tiles lack the "held by …" lines.
11. Fixture: "Boardroom · Proven · Phishing-resistant · MFA via Microsoft Authenticator
    notification" — a shared device with contradictory method and evidence. Patch the
    fixture, not the product.
12. "Learn →CIS 4.3" — no space between the link and the chip.
13. The opener still shows the old three bullets and no limitations panel (52 Part 1, in
    flight).

## Not yet checked

GetIAMAI (needs sign-in in the reviewer's tab); every step opened one by one; mobile width;
the week-two re-scan story; Export; How.

## GetIAMAI (signed in; plan built from a scan 27h old)

The same nine P0s reproduce on the real tenant. In addition:

14. **Create or Correct Emergency Access Accounts is a regression.** The v1 build listed
    the failing checks by name with a fix each; this build shows "of 0 checks fail today",
    "All 0 checks pass", "Your own account,, is not one of these" ({operator} empty), an
    empty picker ("· ·"), "the tenant id:." ({tenantId} empty), no create instructions
    although only one account exists, no "policies not excluding the group" line, no
    "done together with" line. The checks engine exists (How IAMAI works lists 23 checks);
    it is not wired to `checkFixes`. This is the showpiece step and must be the first fix.
15. **Wrong policy named as existing coverage.** The guests step says "GetIAMAI already
    covers this with Core - Allow - MFA for Internal Users" — the tenant's guest policy is
    "Core - Allow - MFA for Guests". The existing-coverage derivation takes the mfa-all-users
    match, not the goal's own. Wrong fact.
16. **Row and step disagree on guests.** The row says "requires MFA, wants passwordless
    sign-in"; the step's Policy A is plain MFA (the decided default), which the tenant
    already meets. With the A/B map, this goal is in place for A and offered for B; the row
    must say so or say nothing.
17. **Forbidden vocabulary on rows**: "expire every 168h, wants 4h" on the admin-session row.
    The contract forbids `168h`; the pattern is `sessions expire weekly, the baseline wants
    4 hours` (`pages.plan.gapSuffix`). The inventory lint did not catch it because the
    capture is of the demo; add GetIAMAI's snapshot to the lint fixtures.
18. Unfilled variables again: "1 guests and external users", "from  partner tenants",
    "and its  strength of formal partners" ({partners}, {strengthName} empty).
19. **Theme is not one setting.** Light/dark differs between the home page, the demo and
    the signed-in app; store one preference and honour it on every surface, home included.

## Order of repair

Emergency access (14) first, then titles (1), then the variable layer (2, 3, 5, 6, 7, 18),
then coverage attribution and row/step agreement (8, 15, 16), then absent goals (9), then
vocabulary and theme (17, 19).
