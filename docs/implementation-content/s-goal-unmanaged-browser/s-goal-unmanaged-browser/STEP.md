# Limit Unmanaged Devices in the Browser

## Goal
Keep company data usable in a constrained browser experience on unmanaged devices while preventing unmanaged download/print/sync according to the two-policy IAMAI baseline step.

## Why this exists
Conditional Access can invoke application-enforced restrictions, but the SharePoint tenant restriction is a separate service prerequisite. IAMAI must not make CA JSON look as though it configures SharePoint or Defender for Cloud Apps.

## Applies when
Conditional Access is licensed; the SharePoint unmanaged-device prerequisite is resolved; IAMAI has resolved the two canonical CA policy bodies; and Policy B is only actionable when its Defender for Cloud Apps dependency is available.

## Do not show implementation when
Hide CA implementation while the SharePoint prerequisite has not been configured and rescanned, when canonical exclusions/conditions are unresolved, or when a required license/owner decision is unresolved.

## Prerequisite — SharePoint tenant setting
Set the organization unmanaged-device behavior to **Allow limited, web-only access**. Microsoft documents that using the SharePoint admin-center control can disable prior CA policies created from that page and create a new all-users CA policy, without carrying customizations. Therefore this package treats the change as its own operation: configure it, stop, allow propagation, rescan IAMAI, and only then resolve/update the CA policy IDs. Never run the SharePoint mutation and CA correction as one blind transaction.

## Target state — Policy A
IAMAI's merged step calls this the app-enforced-restrictions path: Office 365 target; browser path; IAMAI-resolved platform/device discriminator for the baseline's unmanaged Windows scenario; no grant controls; `applicationEnforcedRestrictions.isEnabled = true`; Report-only first.

## Target state — Policy B
IAMAI's merged step calls this the outside-trusted/other-platform download path: Office 365 target; IAMAI-resolved location/platform/device conditions; no grant controls; `cloudAppSecurity.isEnabled = true` with `cloudAppSecurityType = blockDownloads`; Report-only first. This path depends on Microsoft Defender for Cloud Apps. If the dependency is not licensed/resolved, record Policy B as not licensed/blocked rather than pretending Policy A alone completes the full step.

## Source identity
The retained goalMap/product projection does not expose stable source-member GUIDs for these two merged policies. None are invented. Corrections require IAMAI's resolved stable tenant policy IDs after the SharePoint prerequisite rescan.

## Security-significant fields
SharePoint tenant mode, each policy's population/exclusions/resources/client/platform/location/device filter, the exact session-control type, Policy B licensing, stable tenant IDs, and lifecycle.

## Preserve
Preserve IAMAI's exact resolved two-policy conditions, including the source-authored Boolean operators in device-filter rules. Do not “clean up” `AND`/`OR` expressions from memory.

## Do not do
- Do not claim CA JSON configures the SharePoint tenant setting.
- Do not reuse a pre-change policy ID after changing the SharePoint unmanaged-device setting; rescan first.
- Do not invent baseline member GUIDs.
- Do not silently omit Policy B and call the full step complete when Defender for Cloud Apps is unavailable.
- Do not replace application-enforced restrictions with a compliant-device block; that is a different baseline goal.
- Do not assume limited web access protects Anyone links, older clients, or every preview path beyond Microsoft's documented coverage.

## State variants
Configure prerequisite; Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Verify SharePoint tenant mode separately. After the mandatory rescan, re-resolve both CA IDs and compare each canonical body. Test an unmanaged browser against SharePoint/Office 365, confirm restricted actions behave as intended, review Report-only results, and verify Policy B only where Defender for Cloud Apps is actually available.

## Rollback / safe recovery
For CA impact, move the same stable policy back to Report-only. For SharePoint tenant mode, use the documented SharePoint rollback and then rescan because the service may alter CA policy objects. Never guess the old CA stable ID after a SharePoint access-control change.

## Source verification
IAMAI merged-step source plus current SharePoint unmanaged-device, Conditional Access app-enforced restrictions, Defender for Cloud Apps, device-filter, and Graph v1.0 session-control documentation rechecked September 10, 2026.
