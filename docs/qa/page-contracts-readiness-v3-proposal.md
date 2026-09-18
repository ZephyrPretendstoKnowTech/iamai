# Proposed `readiness` entry for `docs/qa/page-contracts.json` (prompt 62)

`docs/qa/page-contracts.json` says Claude Code never edits it, so this change is
for the owner to review and apply. The MFA Readiness rebuild (prompt 62, v3 layout)
renders new headings, buttons, chips and links. Until the entry is replaced, the
walk's and smoke's allow-list checks for `#/readiness` report the new strings.

The entry in the file today no longer matches the page that shipped before this
change either. It still lists the Step 7 tiles ("Passkey-ready", "Needs proof",
"Needs a passkey") and columns ("Account", "Strongest method", "Proof") that
earlier work removed.

Every string below is a `pages.readiness` key in `docs/design/content.json`, so the
list moves with the words.

```json
{
  "id": "readiness",
  "name": "MFA Readiness",
  "status": "built",
  "reach": { "route": "/readiness", "state": "scanned" },
  "allow": {
    "headings": [
      "MFA Readiness",
      "re:^\\d+ of \\d+ (people|person) (is|are) ready for phishing-resistant sign-in\\.$",
      "re:^Readiness not measured for \\d+ active (people|person): this scan holds no sign-in proof\\.$",
      "No active people to count.",
      "What to do",
      "Tenant setup",
      "Approved passkey models",
      "Not counted",
      "Evidence read",
      "Next step",
      "Devices seen in the last 30 days",
      "Phishing-resistant methods",
      "re:^.+$"
    ],
    "tabs": [],
    "tiles": [],
    "columns": ["Person", "Devices seen", "Methods", "Next step"],
    "chips": [
      "Admin",
      "Guest",
      "Seamless",
      "Confirmed",
      "Not confirmed",
      "Not set up",
      "No passkey",
      "Blocked",
      "Not read",
      "No phone sign-ins"
    ],
    "buttons": [
      "re:^Needs action · \\d+$",
      "Admins",
      "Everyone",
      "Lapsing this week",
      "Seamless",
      "Ready",
      "Confirm it",
      "Needs a device",
      "Needs a method",
      "Blocked by setup",
      "Unknown",
      "Not counted",
      "Export CSV",
      "Details",
      "Close",
      "Show them",
      "re:^Show the next \\d+$",
      "Scan the tenant"
    ],
    "summaries": [
      "re:^(Next check)?(Set up a phishing-resistant method|Confirm the method still exists|Add a passkey to the device they use|Waiting on tenant setup|IAMAI couldn’t read these people|Could be seamless|Seamless).*\\d+$",
      "re:^(Admins|.+)\\d+$",
      "re:^Completed checks · \\d+$"
    ],
    "links": [
      "Every account and policy the scan read →",
      "Open the setup steps in the Plan",
      "Open the related step",
      "Confirm or disable in the Plan",
      "Never signed in.",
      "Looks retired: no sign-in in 90 days, still enabled.",
      "New this month, hasn’t signed in yet.",
      "Activity not read.",
      "Emergency access accounts",
      "Service accounts",
      "Shared devices",
      "Sign-in disabled",
      "← Back to the step"
    ]
  },
  "budget": { "sentences": 16, "words": 300 },
  "forbid": [
    "Legend",
    "To set up before enforcement",
    "Sign-in records: complete",
    "assume",
    "nothing can lock out",
    "signed in now",
    "MFA proven",
    "Registered, unproven",
    "Likely works",
    "Never prompted",
    "Possibly broken",
    "Needs proof",
    "Needs setup"
  ]
}
```

## Why each change

- **Headings.**
  - The answer is now an `h2` sentence.
  - The rail tiles and the person panel carry `h3` headings.
  - A group's heading is its action.
  - The panel's heading is the person's name, which is why `re:^.+$` sits last. Remove it if a stricter rule is wanted; the panel heading would then need its own pattern.
- **Tiles.** None: the three count tiles are gone.
- **Columns.** The worklist's four zones.
- **Chips.** The device chips' words and the Admin and Guest tags.
- **Buttons.**
  - The filters and Export CSV.
  - Details and Close for the person panel.
  - "Show them" for the lapsing people.
  - "Show the next N" for sub-group paging.
  - "Scan the tenant" (`app.readiness.scanLink`), shown when a read is missing.
- **Summaries.** The group and sub-group headers, and the completed-checks caret.
- **Links.** The Plan links for the next check and setup checks, the uncounted populations, and the way back.
- **Budget.**
  - The page's own prose is the lead, the answer's goal and definition, the next check's body, the rail's setup text and the two footer lines.
  - 16 sentences and 300 words holds the demo and the live tenant with room to spare.
  - Repeaters (rows, groups) are items, not prose.
- **Forbid.**
  - "Rollout" is dropped. The Plan already owns that word, and this page never renders it.
  - The retired state words "Needs proof" and "Needs setup" are added, so the old vocabulary cannot come back.
