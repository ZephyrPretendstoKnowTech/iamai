# 33 — Guidance audit: correctness, completeness, necessity

Precondition: 32 committed. Read docs/design/audit-program.md.

Work this prompt as a Microsoft MVP in identity and access would: not as a developer
checking that code matches a spec, but as an architect checking that the advice would not
hurt the person following it. Where the tool's guidance and Microsoft's documented behaviour
disagree, Microsoft wins and the tool changes. Where Microsoft is silent and field practice
is clear, say so and cite the practice.

Verify every technical claim against Microsoft Learn before acting on it. Do not rely on
memory for feature behaviour, licence gates, or portal wording.

## Part 1 — The audit sheets (Layer B)

1. For every step family the plan can produce, write an audit sheet in
   `docs/audits/steps/<family>.md` covering: what it changes; every population that could be
   caught by it; every dependency it assumes exists; every way a person could be stranded by
   it; what Microsoft's own deployment guidance says to do first; and the Learn URLs for each
   claim.
2. Compare each sheet against what the step actually says today. Record gaps as a table:
   claim, status (present, missing, wrong), and the fix.
3. Fix every gap in step content. A step is complete when its content covers its sheet.

## Part 2 — Omission audit (Layer E)

4. Work through the omission candidates in audit-program.md §3, verifying each against Learn.
   For each: confirm the behaviour, decide whether it is a rule (blocking or warning), step
   content, or a scenario fixture, and implement it.
5. The registration-campaign interaction is the highest-risk item on that list: applying a
   location-restricted security-info registration policy before people have registered can
   permanently strand remote staff. Verify the exact behaviour and make the plan's ordering
   and warnings reflect it.
6. Add any omission you find that is not on the list, with its citation.

## Part 3 — Necessity audit (Layer F)

7. Walk the plan produced for the small and micro fixtures as if you were a ten-person
   business with one part-time IT person. List everything the tool asks for that such a
   business does not need, or would reasonably decline. Remove or downgrade each.
8. Confirm that nothing in the plan requires a process, a tool, or a role that a small MSP
   does not have.

## Part 4 — Sequence safety (Layer C)

9. Express as property tests, running for every fixture: no deny-capable step is Ready before
   the escape hatch is verified; no policy references an object before its creation step; no
   MFA requirement before registration evidence; no device requirement before enrolment
   coverage; no geo block before the operator's own recent countries are in the allow list; no
   session control that would sign out the person applying it; security defaults disabled
   before any CA step.

## Part 5 — Citations

10. Every validation rule and every "what could go wrong" item carries a Microsoft Learn URL,
    stored with the rule or the content, rendered as a named link in the UI and in print.
11. Add citations to the `#/checks` reference page, and to each step's Why section.
12. A build check fails if any rule or warning lacks a citation.

## Finishing

Produce `docs/audits/guidance-audit-01.md`: every claim checked, its source, its verdict, and
what changed. Run npm test and vite build. Commit by part. Push. Report the count of gaps
found by category (missing, wrong, unnecessary) and the three you consider most serious.
