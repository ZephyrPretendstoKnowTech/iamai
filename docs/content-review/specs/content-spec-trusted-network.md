# Content spec: Define the Trusted Network

**Step ID:** `s-prereq-trusted-location`
**Package:** `docs/implementation-content/s-prereq-trusted-location/`

---

## Why

CURRENT →
```
Some baseline policies relax inside the network your team usually signs in from, and that network has to be named before they can. Learn →
```

No change. Clear and explains the dependency.

---

## Readiness

CURRENT → `✓ Clear — Nothing outstanding changes the next action.`
TARGET → `✓ Clear — No blockers. Ready to proceed.`

---

## Readiness bar

CURRENT → `Ready now`
No change.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Sep 14, 2026

Your offices and VPN exits. Remove anything nobody signs in from that location.

Trusted network
Save
```

TARGET →
```
NEXT MILESTONE

Sep 14, 2026

Add your office and VPN IP addresses.

Trusted network
[IP range input]
Save
```

Changes:
- "Your offices and VPN exits. Remove anything nobody signs in from that location." → "Add your office and VPN IP addresses." The original is two sentences that read like a subtitle, not an action. The tech needs to know: add your IPs.
- "Remove anything nobody signs in from that location" is confusing — it tells the tech to remove something from a list that hasn't been created yet.

---

## Implementation — Entra channel

CURRENT →
```
Go to Entra admin center → Entra ID → Conditional Access → Named locations → + IP ranges location.
Name it Core - Trusted - Head office.
Add exactly the owner/network-confirmed public IPv4 and IPv6 CIDRs supplied by IAMAI.
Select Mark as trusted location.
Create it.
Rescan IAMAI before downstream policies consume the location ID.
```

TARGET →
```
1. Go to Entra admin center → Conditional Access → Named locations → + IP ranges location.
2. Name: Core - Trusted - Head office (or a name that describes your location).
3. Add your office's public IP address(es). These are the IPs your internet traffic comes from — your ISP assigns them. If you're not sure, search "what is my IP" from a computer in the office.
4. If you have a VPN, add its exit IP addresses too.
5. Check "Mark as trusted location."
6. Create.
7. Rescan in IAMAI.
```

Changes:
- "Entra ID → Conditional Access" → simplified.
- "owner/network-confirmed public IPv4 and IPv6 CIDRs supplied by IAMAI" → plain English. A help desk tech doesn't know what a CIDR is. "Your office's public IP address(es)" with the "what is my IP" tip.
- "downstream policies consume the location ID" → removed (internal concept).
- Added the VPN instruction as a separate step.

---

## Implementation — AI Info channel

TARGET →
```
A trusted location tells Entra "sign-ins from these IP addresses are coming from our office." Several policies in the baseline use this: some relax their requirements inside the trusted network (like the managed-device policy, which only requires a managed device outside the office).

If you have one office, add its public IP address. If you have multiple offices or a VPN, add all of them. The location should cover every IP address your people normally sign in from at work.

Don't add home IP addresses — those change and aren't controlled by the organization. The point of a trusted location is that the network itself is something you manage.

If nobody works from an office (fully remote, no VPN), you can mark this step as "Doesn't apply here."
```

---

## Done when

CURRENT →
```
A trusted location exists whose ranges match sign-ins since Aug 13, 2026.
```

TARGET →
```
A trusted named location exists in Entra whose IP ranges cover the sign-in sources seen since Aug 13, 2026.
```

Minor — "ranges match sign-ins" → slightly clearer.

---

## Buttons

- "Doesn't apply here" present ✓ — correct for tenants with no office network.

---

## Global issues
1. Readiness tile filler — global fix.
2. "CIDRs supplied by IAMAI" — internal term, removed.
3. "downstream policies consume the location ID" — removed.
4. Source checked present (Sep 12, 2026) ✓.
