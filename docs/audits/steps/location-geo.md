# Audit sheet — locations and country restriction

**Goals:** `geo-restriction`; also the trusted-location prerequisite and the
allowed-countries prerequisite. **Family:** location. **Can deny access:** yes.

## What it changes

A block policy on sign-ins from outside a country named location, and/or a
trusted IP named location other policies relax inside.

## Verified limits and behaviour

- **Limits:** "No more than 195 named locations. No more than 2000 IP ranges per
  named location. Only CIDR masks greater than /8 are allowed." IPv6 supported,
  CIDR notation required [S23]. These apply to **IP-based** named locations, not
  country ones.
- **"Trusted" is not an access control.** It does exactly two things: policies
  can include/exclude the location, and "Sign-ins from trusted named locations
  improve the accuracy of Microsoft Entra ID Protection's risk calculation" [S23].
  Copy implying trusted = exempt or safe is overstating.
- **Country is resolved from IP** "based on a **periodically updated mapping
  table**". GPS-based country is a separate mode that "contacts the user's
  Microsoft Authenticator app" hourly [S23].
- **Proxies and VPNs:** "the IP address Microsoft Entra ID uses… is the IP
  address of the proxy. The X-Forwarded-For (XFF) header… isn't used… Keeping an
  up-to-date list of IP addresses used by your cloud-hosted proxy or VPN solution
  is **nearly impossible**" [S23].
- **Microsoft's own caution:** "A policy that uses the location condition to
  block access is considered **restrictive, and should be done with care after
  thorough testing**" [S23].
- **Location is not re-evaluated instantly.** "By default, Microsoft Entra ID
  issues tokens hourly" — a country block does not sever an existing session
  immediately, and a traveller is not unblocked immediately either [S23]. CAE
  strict location enforcement makes IP enforcement instant but is **Public
  Preview** [S24].
- **GPS mode in report-only still prompts and can still block** [S23] — another
  breach of "report-only affects nobody".
- **`Include unknown countries/regions`** is safe in a block policy and dangerous
  in an allow policy. Learn's wording is neutral; the asymmetry is not spelled
  out there.
- Legacy **MFA trusted IPs** is a separate, IPv4-only mechanism and "**isn't
  recommended**" [S23].

## Every way a person can be stranded

| # | Stranding | Source |
|---|---|---|
| 1 | The operator's own recent countries are not in the allow list | Field practice; Learn documents only the general block+all-resources lockout and "be sure to exclude your emergency access accounts from this policy" [S25] |
| 2 | Small business on residential/dynamic broadband has no stable IP to trust | **Field practice.** Learn does not say this; the mechanism (public egress address) makes it real |
| 3 | Traveller, roaming, or carrier IP geolocating to a neighbouring country | **Field practice.** Learn documents only the proxy/VPN case |
| 4 | A trusted location that no longer matches the office egress IP | Field practice |

## Honest labelling required

Three of the four strandings above are **field practice, not Microsoft-documented**.
The tool currently states travel, VPN and roaming as flat facts. They are true and
worth saying, but only the VPN/proxy one has a Microsoft citation. Under the audit
program's own citation rule (§6), the other two must be labelled as practice.

## Terminology drift the tool has not tracked

The Conditional Access UI condition is now **Network**, not Location: "The
Location condition moved and was renamed Network." Target resources are "**All
resources** (formerly 'All cloud apps')" [S23]. The tool's portal instructions
still say "Locations" and "Cloud apps", so they no longer match what a 2026 admin
sees.

## Comparison with what the step says today

| Claim | Status | Fix |
|---|---|---|
| Portal path says "Locations" / "Cloud apps" | **wrong** — renamed to Network / All resources | Update every portal path |
| "Trusted" grants nothing by itself | **missing** | Step content |
| Named-location limits (195 / 2000 / >/8) | **missing** | Validation rule |
| Country comes from an IP mapping table, not a definitive source | **missing** | Step content |
| Include-unknown-countries asymmetry | **partial** — a rule exists but does not explain allow vs block | Extend the rule copy |
| A block does not take effect until the token refreshes | **missing** | Step content; corrects an over-promise |
| GPS mode prompts hourly and blocks even in report-only | **missing** | Step content |
| Travel / roaming / carrier IP claims presented as documented | **wrong** (labelling) | Mark as field practice |
| VPN/proxy egress | **present**, and it is the one with a citation | Add the citation |
| Operator's own countries checked | **present** (`cty.includesOperator`) | — |
| Break-glass excluded from the country block | **present** | — |

Eleven claims: 5 missing, 2 wrong, 1 partial, 3 present.
