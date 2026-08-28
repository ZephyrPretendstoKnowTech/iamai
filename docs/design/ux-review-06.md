# UX review 06 — full pass after prompt 22

Driven in Chrome on GetIAMAI: signed out and back in, baseline loaded from scratch, Setup
re-answered, every Findings tab, every Roadmap tab, Danger areas, Steps with completed
hidden, Inventory, reference pages, both themes. Prompt 23 implements this.

## What is now right (do not regress)

The correctness fixes hold. With Setup answered properly, coverage reads 7 in place, 4
partly, 17 missing; goals delivered by existing policies stay in place; proposed names in
the tenant convention appear with the baseline name beneath; "Below the baseline" is a
distinct state from "Partly in place"; the report-only statement now explains what to do;
sidebar links have accessible names; the scan-age line is present; Danger areas leads with
a sentence and names the person and the portal path.

## A. New defects

1. **Baseline loading has no feedback and takes about ten seconds.** Clicking "Load this
baseline" fires 155 requests to raw.githubusercontent.com with no spinner, no disabled
button, and no progress. I clicked three times believing nothing had happened, which fires
three parallel loads. Needs: immediate disabled state, a progress line ("reading 46 of 155
files"), and a guard against concurrent loads.

2. **Sign-in is silent for about ten seconds too.** "Sign in with Microsoft" produced no
visible change; a second click completed it. Same fix: disabled state plus "Opening the
Microsoft sign-in…".

3. **The baseline still does not survive a reload.** The scan is restored, the baseline is
not. Worse, Findings then renders a full result set from the goal catalogue while its own
Needs line says "Load a baseline in the Baseline step", and the sentence reads "compared
with the goal catalogue" (§8 of the previous review is only half-done). Either persist the
baseline or refuse to render Findings; showing results while telling the user a
prerequisite is missing is the worst of both.

4. **A raw group GUID is printed as a name in step instructions.** "This step also creates
the assigned group "1178bb5d-4f19-4b69-b33b-44eb7f5b39c9" it targets". The step must name
the group it will create ("a new pilot group, for example Core - Pilot - Device
registration"), never the baseline author's id.

5. **Portal step label is wrong.** "Conditions → Client apps: All users" should read "All
client apps". Platform values are unnormalised: "Include: iOS; Exclude: macOS, windows".

6. **Raw URL still pasted into prose.** "Microsoft Learn →: https://learn.microsoft.com/…"
appears inside the Why paragraph on every step. Make it a link, on its own line, with no
trailing colon.

7. **Active-user count disagrees between pages.** Findings says 4 active; a step says "All
3 active users are ready"; another says "4 active users in scope"; the readiness line says
"100% of 4 active users ready" on a step whose own header says 3. One population per step,
computed once.

8. **Setup question 2 shows no validation after an answer.** Picking "Breakglass
Exclusion" collapses the section to "Answered" with no member count, no admins-in-group
check, no dynamic-rule check, and no consistency check across policies. Question 1 shows
its validation; question 2 shows none.

9. **The suggestion list only appears after typing.** Question 2's picker opens empty; the
Breakglass Exclusion suggestion, complete with the "only member is Breakglass" evidence
line, appears only after typing "break". Show ranked suggestions on focus, before any
input, as specified in prompt 11.

10. **Wave placement is wrong for at least one step.** "Restrict access to Office 365" (a
download-restriction session control) sits in "Wave 2 · MFA for everyone", and both it and
"Block access to Office 365 SharePoint Online" are filed under the Locations domain in
Findings. Domain and wave come from the goal's controls, not its app scope.

11. **Consolidation advice is wrong.** Housekeeping says "Every user satisfies MFA on every
app is delivered by 3 policies: consider consolidating". Those three are the admin,
internal-user, and guest policies: separate by design, and Microsoft's own guidance is to
keep persona policies separate. Only suggest consolidation when two policies have the same
population and the same controls.

12. **Ad-hoc goal titles are still machine-generated fragments** with a grammar error:
"Block access to 1 apps", "Block access to 2 apps" three times over, "Require MFA for 4
apps from specific client types". Name them by their app when it resolves ("Block access to
Azure DevOps"), and never print "1 apps".

13. **Naming housekeeping prints the prefix in lower case** ("share the prefix "core"") when
the tenant's convention is "Core". Preserve case.

14. **"Not covered: Excluded directly (1)"** names no one. Name the account, as the other
reasons do.

15. **Findings renders a Group by control and a Sort by control above the tab strip,** so
they appear to apply to the Summary tab as well, where they do nothing.

16. **Screenshot capture timed out repeatedly on Roadmap and Findings** (30-second CDP
timeouts, five times in this pass). The main thread is blocking for seconds on these pages
even with 12 users and 31 steps. This is the single biggest risk to a real tenant demo and
needs profiling, not a workaround.

## B. Copy and content

17. Roadmap Overview still builds a run-on: "7 steps also extend it: Browser sessions never
persist for anyone, Unmanaged devices cannot download, … and 2 more." Use a short sentence
plus a list.
18. "One week longer than a typical small tenant, because the verification campaign needs
two weeks" is good; the sentence before it ("5 weeks: a 2-week verification campaign,
7-day observation window, 7 enforcement waves") repeats the same facts. Keep one.
19. The step announcement is still generic Authenticator wording on a device-registration
step where all four active users are ready and nobody is affected. Announcements should be
per goal, and suppressed when the affected population is zero.
20. "Done when" mixes criteria and instructions: "Then enable the policy (Enforce)" is an
action, not a criterion. Move it out of the list.
21. Details lists three separate entries reading "Block access to 2 apps: does not apply
(no sign-in activity for this workload)". Merge duplicates and name the workload.
22. "Sign-in evidence covers the last 30 days; re-scan once the scan is more than 7 days
old" appears on three pages in the header line; make it a tooltip on the scan age.
23. Guest count appears as "1 guest" in step populations and "The only guest affected" in
Findings; keep one phrasing.
24. The Timeline's "Registration and verification window · 14 days" panel says "Everyone
active registers Microsoft Authenticator and completes one MFA sign-in", but nine of the
twelve users are the ones who need setting up and only four are active. Say who.

## C. Interaction, layout, accessibility

25. Suggestion lists and pickers: no keyboard support tested end to end; Enter did not
select the highlighted option in the group picker, and there is no visible highlight.
26. Roadmap tab switching keeps the scroll position, landing the user mid-page.
27. Group by / Sort by still render once per tab panel with independent state (Findings),
so switching tabs silently changes the sort.
28. Tables inside Inventory still scroll horizontally at 1700px viewport width; the 1440px
container cap is the cause and is still open by choice. Recommend raising it to 1600px for
table-heavy pages only.
29. No focus ring is visible on the Roadmap tab strip or the Findings tab strip when
tabbing.
30. Long pages have no anchor navigation or back-to-top.
31. The theme toggle announces "Theme: dark. Switch to light" correctly, but the sidebar
active step is announced only by number and label with no "current step" state.

## D. Still open from earlier reviews

32. §34 (container width) is open by choice; the header wrapping in "What IAMAI reads"
("v1." / "0") is a direct consequence and should be fixed regardless by not wrapping the
API column.
33. §51 file-versus-screen comparison is covered by plan.test.ts; a manual save-and-reload
was still not exercised in this pass and should be, once, before go-live.
34. Deferred D5 (live error states) needs a forced failure path; add a ?dev=fail flag that
makes one collector return 403 and one return 429 so the disabled and slow states can be
seen without breaking a tenant.
35. Deferred D6 (smoke mocks at the snapshot boundary) is the right call; note it in
SPEC.md so it is not rediscovered later.
