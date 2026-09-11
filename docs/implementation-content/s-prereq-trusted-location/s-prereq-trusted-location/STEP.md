# Define the Trusted Network

## Goal
Create one canonical IP-based named location containing only owner/network-confirmed public egress CIDRs that the selected baseline treats as the trusted network.

## Why this exists
Some baseline policies distinguish trusted from untrusted access. Trusting the wrong network weakens those controls, while omitting the real egress network can break legitimate workflows.

## Applies when
The tenant has an office/VPN/public egress network that the baseline is intended to treat as trusted. If there is no such network, the owner may mark the prerequisite not applicable rather than inventing one.

## Do not show implementation when
Do not create or correct a trusted location until the public CIDRs are confirmed by an authorized network/tenant owner. Observed sign-in IPs are evidence only.

## Prerequisites
- Confirmed public IPv4/IPv6 egress CIDRs.
- Current named-location inventory and canonical stable identity where one exists.
- Owner/network confirmation that the ranges are controlled and intended to be trusted.
- Awareness that dynamic consumer ISP addresses may change.

## Owner decisions
The owner decides whether a trusted network exists and which exact public CIDRs belong to it. IAMAI does not promote common sign-in addresses into trusted ranges.

## Current-state inputs
Target display name, confirmed public CIDRs, current location ID/name/ranges/trusted flag, sign-in IP evidence, and network-owner notes.

## Target state
One `#microsoft.graph.ipNamedLocation` with the canonical display name, exactly the confirmed public CIDRs, and `isTrusted: true`.

## Security-significant fields
Stable named-location ID, exact CIDR set, derived IP-range type, and trusted flag.

## Preserve
Preserve stable object identity and downstream policy references. When updating `ipRanges`, remember Graph treats the collection as replacement: every range that should remain must be present in the update body.

## Do not do
- Do not use private RFC1918 addresses as the public sign-in location.
- Do not use `0.0.0.0/0` or broad guessed ranges.
- Do not infer the ISP's allocation size from one observed address.
- Do not automatically trust every common sign-in IP.
- Do not delete/recreate a location solely to change its name or ranges.
- Do not treat Microsoft's API allowance for large CIDRs as permission for IAMAI to broaden the owner's confirmed network.

## State variants
- **Needs decision:** collect authoritative CIDRs; no implementation.
- **Not applicable:** no trusted-network object is created.
- **Missing:** create the IP named location.
- **Partial:** correct only name, exact ranges, or trusted flag.
- **Verification required:** read back the same stable object and compare.
- **In place / blocked:** no actionable implementation.

## Verification
Verify type, stable ID, exact CIDR set, and `isTrusted=true`. Confirm at least one expected office/VPN sign-in matches through normal IAMAI evidence; do not expand ranges merely to make evidence match.

## Rollback / safe recovery
Restore the previously recorded range set or trusted flag on the same object. Do not delete an object referenced by policies unless a separate migration explicitly updates all references.

## Limitations / unknowns
Microsoft evaluates network location from the public IP seen at sign-in. Consumer broadband, VPNs, mobile carriers, proxies, and cloud egress can change that IP.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026:
- Conditional Access network signals: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-assignment-network
- ipNamedLocation: https://learn.microsoft.com/en-us/graph/api/resources/ipnamedlocation?view=graph-rest-1.0
- Create namedLocation: https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-post-namedlocations?view=graph-rest-1.0
- Update ipNamedLocation: https://learn.microsoft.com/en-us/graph/api/ipnamedlocation-update?view=graph-rest-1.0
