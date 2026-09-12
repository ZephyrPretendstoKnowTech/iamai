@@IAMAI-BEGIN {"id":"entra.apply","channel":"entra","states":["approvedPendingApply"],"format":"markdown","kind":"template"}
1. Confirm the approved trip: **{{travel.traveler}}**, **{{travel.countries}}**, {{travel.startDate}} through {{travel.endDate}}.
2. Open **Entra ID > Conditional Access > Named locations > {{location.allowedCountries.displayName}}**.
3. Add only the approved destination country/countries. Preserve every permanently approved country already on the location.
4. Save the same named location.
5. Record the trip and removal date in the trip log: {{travel.logReference}}.
6. Verify the country appears before the traveler relies on it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.remove","channel":"entra","states":["revertDue"],"format":"markdown","kind":"template"}
1. Confirm the approved travel window ended on **{{travel.endDate}}**.
2. Open **{{location.allowedCountries.displayName}}**.
3. Remove only the trip-specific country/countries **{{travel.countries}}** that are not independently part of the permanent approved list.
4. Save and verify the remaining country set matches the owner's permanent decision.
5. Close the trip-log entry and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.approval","channel":"aiInfo","states":["approvalRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Summarize the missing approval facts for {{travel.traveler}} without recommending a user exclusion. Required facts are destination country/countries, dates, and approver.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["approvedPendingApply"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the approved temporary travel change for {{tenant.displayName}}. Preserve the permanent country list {{location.allowedCountries.currentCountries}} and add only {{travel.countries}} for {{travel.startDate}} through {{travel.endDate}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.active","channel":"aiInfo","states":["activeTrip"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The approved trip is active. Do not recommend new exclusions unless a real blocked sign-in proves the approved country does not match the network egress; diagnose the egress first.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.remove","channel":"aiInfo","states":["revertDue"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Confirm the temporary travel country can be removed without deleting a permanently approved country. The trip ended {{travel.endDate}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker: {{dependencies.blockers}}. Do not create a traveler-specific Conditional Access exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.approval-request","channel":"email","states":["approvalRequired"],"format":"markdown","kind":"template","audience":"travel-approver"}
Subject: Travel access approval needed

Please confirm the traveler, destination country or countries, and exact travel dates. IAMAI handles approved travel by temporarily adding the destination to the allowed-countries location for the trip window; it does not exclude the traveler from Conditional Access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.traveler-notice","channel":"email","states":["approvedPendingApply"],"format":"markdown","kind":"template","audience":"traveler"}
Subject: Travel access arranged for {{travel.countries}}

Your access is scheduled for {{travel.startDate}} through {{travel.endDate}}. If sign-in is blocked while traveling, contact the help desk with the time, app, and network/VPN you were using. Do not work around the block by changing accounts or asking for a permanent exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.removal-check","channel":"email","states":["revertDue"],"format":"markdown","kind":"template","audience":"administrators"}
Subject: Remove temporary travel country

The approved travel window for {{travel.traveler}} ended {{travel.endDate}}. Remove the trip-only country/countries {{travel.countries}} from the canonical allowed-countries location unless they are part of the permanent approved list, then verify and close the trip record.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["approvalRequired","approvedPendingApply","activeTrip","revertDue"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"traveler","label":"Traveler","result":{{json:travel.traveler}},"line":"A named person and approved trip are required before any location change."},{"id":"destination","label":"Approved destination","result":{{json:travel.countries}},"line":"Temporary access is country-based, not a user exclusion."},{"id":"window","label":"Travel window","result":"{{travel.startDate}} to {{travel.endDate}}","line":"The temporary country must be removed when the approved window ends."}],"whyIamaiSaysThis":"Geographic access is changed on the canonical named location for a bounded approved trip, then reverted."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["approvedPendingApply","activeTrip","revertDue"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"blocked-in-approved-country","classification":"documented","symptom":"The traveler is blocked even though the destination country was added.","check":"Inspect the sign-in IP/network and confirm how Microsoft resolved its country; check VPN/carrier egress.","fix":"Correct the approved country/location only if the actual approved egress proves the current mapping is wrong. Do not add a user exclusion.","then":"Retest and record the result.","sources":["ms-location-block"]},{"id":"temporary-country-left-behind","classification":"derived","symptom":"The trip ended but the temporary country remains allowed.","check":"Compare the current country set with the permanent owner-approved list and trip log.","fix":"Remove only the trip-specific country from the same named location.","then":"Rescan IAMAI.","sources":["ms-location-block"]}]}
@@IAMAI-END
