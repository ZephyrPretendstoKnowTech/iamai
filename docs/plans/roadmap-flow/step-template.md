# The step template

What the owner set on 1.1–1.4 (2026-09-23) and wants on every step. Every section's audit checks each of its steps against this list, and every fix batch keeps it.

## Frame (shared code)
1. **Header.** The step-type eyebrow (PREPARATION STEP, CHECK STEP, CAMPAIGN STEP, DECISION STEP …), then the title and the badge. No caption under the title.
2. **Rail.** The inset column runs the full height of the body, in the same colour and with the same left rule, on every step. Top to bottom it holds:
   - NEXT MILESTONE;
   - the headline, which says what the milestone is in words (never a date or a lane word) and reads "Completed" once the step is done;
   - the divider;
   - the instruction line, once, where the step takes a choice;
   - the controls, all of them: every picker, fold and button a step takes lives here, including the Direction steps' Approve.
3. **Main column sections,** in this order and in one heading style: About this Step · Tasks Remaining · Implementation Tasks · Completion Criteria. A decision step shows its Questions in place of Tasks Remaining and Implementation Tasks. A fold such as 1.4's recovery procedure comes after Completion Criteria.
4. **Footer.** One full-width strip holds "Scan to update the plan" at the right, with the scan status line while a scan runs. There is no Close button.

## Content rules
5. **About** is one or two sentences on why the step matters. It carries no lecture and no qualifier, and no inline "Learn →": the Learn link sits under Implementation Tasks with its Source checked date.
6. **Tasks Remaining** shows only open tasks, each as a card. Satisfied holds only satisfied items, each stating its fact, never "In place · No change needed."
   - A Completed step keeps the Tasks Remaining header, "No tasks remaining" and the folded Satisfied items.
   - "After making changes, select Scan to update the plan." sits under Tasks Remaining.
7. **Implementation Tasks** stand open and whole in every state, a Completed one included. They give the real procedure and values, and name the accounts, groups and policies involved.
   - Never "review, no save needed", "No change is needed", "Scan again to verify".
   - No "Reference" fold, no qualifier lines, no lectures, and no troubleshooting lines inside the procedure.
   - Every create names its values, and a policy create names its Include and its Exclude group.
8. **Tabs:** Entra and AI Info. PowerShell, JSON or Email stays only where it gives real value. A read-only GET the scan already makes has none. So has a script that needs IDs typed in by hand, or an email that points at a list it doesn't contain.
9. **Source checked** date beside the Microsoft Learn link.
10. **Completion Criteria:** one or two plain lines saying what IAMAI will see.
11. **Row.** Impact is a count of what the step changes ("2 accounts", "3 policies", "N people", "N steps"), never a label. When is a date.
12. **Never on any step:**
    - "could not read / verify / confirm", "not established", "none found";
    - "Waiting on you to confirm";
    - workflow checks (Workflow Check, Outcome, Tested On, Save Check, Reviewed Accounts);
    - asking the person to record something IAMAI never reads, or to verify what the scan verifies;
    - "Answered in <step>" blocks.
