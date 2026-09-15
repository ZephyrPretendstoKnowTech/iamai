@@IAMAI-BEGIN {"id":"entra.apply","channel":"entra","states":["approvedPendingApply"],"format":"markdown","kind":"template"}
1. Confirm the approved trip: **{{travel.traveler}}**, **{{travel.countries}}**, {{travel.startDate}} through {{travel.endDate}}.
2. Open **Entra ID > Conditional Access > Named locations > {{location.allowedCountries.displayName}}**.
3. Add only the approved destination country/countries. Preserve every country already on the location. This changes the country rule for everyone covered by the policies that use this location, not only the traveler.
4. Save the same named location.
5. Record the trip and a removal task in the trip log: {{travel.logReference}}. The named location does not change back on the trip's end date; a person must remove the country.
6. Verify the country appears before the traveler relies on it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.remove","channel":"entra","states":["revertDue"],"format":"markdown","kind":"template"}
1. Confirm the approved travel window ended on **{{travel.endDate}}**.
2. Open **{{location.allowedCountries.displayName}}**.
3. Check the trip log for other active approved trips. Remove only the trip-specific country/countries **{{travel.countries}}** that are not part of the permanent approved list and are not needed by another active trip.
4. Save and verify the remaining country set matches the owner's permanent decision plus any countries still needed by active trips.
5. Close the trip-log entry and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.approval","channel":"aiInfo","states":["approvalRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

A trip for {{travel.traveler}} needs approval before any location change. The approval needs the destination countries, the travel dates and the approver.

Approved travel is handled by temporarily adding countries to the allowed-countries named location, not by excluding the traveler from Conditional Access. An added country applies to everyone covered by the policies that use that location.

NEXT STEP: Explain which approval facts are still missing and why each one matters.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["approvedPendingApply"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The trip is approved. For {{tenant.displayName}}, add {{travel.countries}} to {{location.allowedCountries.displayName}} for {{travel.startDate}} through {{travel.endDate}}. Countries currently on the location, all of which stay: {{location.allowedCountries.currentCountries}}.

The added country applies to everyone covered by the policies that use this location, not only the traveler. The location does not change back on the end date, so a removal task must be recorded.

NEXT STEP: Explain the change, who it affects and the removal task to record.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.active","channel":"aiInfo","states":["activeTrip"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The approved trip is in progress. If the traveler is blocked, first check the sign-in's IP address and the country Microsoft resolved for it; a VPN or mobile carrier can present a different country from the one the traveler is in. Do not add a Conditional Access exclusion for the traveler.

NEXT STEP: Explain how to diagnose a blocked sign-in during the trip, and that a person must remove the temporary country when no approved trip still needs it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.remove","channel":"aiInfo","states":["revertDue"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The approved travel window ended {{travel.endDate}}. The temporary countries {{travel.countries}} stay on the location until a person removes them; they do not expire automatically.

NEXT STEP: Explain how to remove only the temporary countries, keeping any country on the permanent approved list or still needed by another active approved trip.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This travel step is on hold: {{dependencies.blockers}}. Do not suggest a Conditional Access exclusion for the traveler as a workaround.

NEXT STEP: Explain what must be resolved before the trip can be approved or the country change made.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.approval-request","channel":"email","states":["approvalRequired"],"format":"markdown","kind":"template","audience":"travel-approver"}
Subject: Action needed: Add a Travel Notice and Exclusion

Please confirm the traveler, destination countries and travel dates before departure. Adding a country allows sign-in from it for everyone covered by the country rule, not only the traveler. IT will check the access change and arrange removal when the temporary approval ends.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.traveler-notice","channel":"email","states":["approvedPendingApply"],"format":"markdown","kind":"template","audience":"traveler"}
Subject: Planned change: Add a Travel Notice and Exclusion

IT is preparing access for the approved trip dates: {{travel.countries}}, {{travel.startDate}} through {{travel.endDate}}. If sign-in is blocked while you are traveling, contact IT support with the time, the app and the network or VPN you were using. Do not work around a block by signing in with another account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.removal-check","channel":"email","states":["revertDue"],"format":"markdown","kind":"template","audience":"administrators"}
Subject: Action needed: Add a Travel Notice and Exclusion

The approved travel window for {{travel.traveler}} ended {{travel.endDate}}. The temporary countries {{travel.countries}} stay on the allowed-countries location until someone removes them. Remove each one unless it is on the permanent approved list or another active approved trip still needs it, then verify the remaining countries and close the trip record.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["approvalRequired","approvedPendingApply","activeTrip","revertDue"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"traveler","label":"Traveler","result":{{json:travel.traveler}},"line":"A named person and approved trip are required before any location change."},{"id":"destination","label":"Approved destination","result":{{json:travel.countries}},"line":"Temporary access is country-based, not a user exclusion."},{"id":"window","label":"Travel window","result":"{{travel.startDate}} to {{travel.endDate}}","line":"Approve the trip and the wider country change. Assign someone to remove temporary access when it is no longer needed."}],"whyIamaiSaysThis":"Approved travel temporarily adds countries to the allowed-countries named location. The change applies to everyone the country rule covers, and a person removes the countries when no approved trip needs them."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["approvedPendingApply","activeTrip","revertDue"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"blocked-in-approved-country","classification":"documented","symptom":"The traveler is blocked even though the destination country was added.","check":"Inspect the sign-in IP/network and confirm how Microsoft resolved its country; check VPN/carrier egress.","fix":"Correct the approved country/location only if the actual approved egress proves the current mapping is wrong. Do not add a user exclusion.","then":"Retest and record the result.","sources":["ms-location-block"]},{"id":"temporary-country-left-behind","classification":"derived","symptom":"The trip ended but the temporary country remains allowed.","check":"Compare the current country set with the permanent owner-approved list and the trip log, including other active trips.","fix":"Remove only the trip-specific country from the same named location.","then":"Rescan IAMAI.","sources":["ms-location-block"]}]}
@@IAMAI-END
