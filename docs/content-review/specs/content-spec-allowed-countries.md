# Content spec: Create or Correct Allowed Countries Location

**Step ID:** `s-prereq-allowed-countries`
**Package:** `docs/implementation-content/s-prereq-allowed-countries/`

---

## Why

CURRENT →
```
The countries policy blocks sign-ins from everywhere except this list, so the list has to be right before the policy exists. Learn →
```

No change. Clear and concise.

---

## Readiness tile

CURRENT → `! PEOPLE WHO TRAVEL OR WORK ABROAD — Confirm`

TARGET (collapsed) → `! TRAVEL — Confirm whether anyone travels`

The current label is very long for a collapsed tile. "PEOPLE WHO TRAVEL OR WORK ABROAD" wraps on smaller screens. Shorten to "TRAVEL" with a clearer status.

---

## Readiness bar

CURRENT → `Ready now`

No change. Correct.

---

## Milestone / action column

CURRENT →
```
NEXT MILESTONE

Sep 14, 2026

Every country with sign-ins since Aug 13, 2026. Remove one nobody should work from.

Allowed countries
United States
People who travel or work abroad

No sign-ins from outside United States since Aug 13, 2026. Does anyone travel or work abroad?

Nobody
Occasionally: I will add a country before each trip
Regularly: add:
Save
```

TARGET →
```
NEXT MILESTONE

Sep 14, 2026

Confirm the allowed countries and travel policy.

Allowed countries
United States

Travel

No sign-ins from outside the United States since Aug 13, 2026. Does anyone travel or work abroad?

Nobody — block sign-ins from all other countries
Occasionally — I will add a country before each trip
Regularly — add the countries people regularly work from:
Save
```

Changes:
- Milestone sub-text simplified from "Every country with sign-ins since Aug 13, 2026. Remove one nobody should work from." → "Confirm the allowed countries and travel policy." The original is confusing — "Remove one nobody should work from" reads as instructions, not a milestone.
- Section header "People who travel or work abroad" → "Travel" for brevity.
- Radio option labels get explanatory suffixes so the tech knows what each choice means.
- "Regularly: add:" → "Regularly — add the countries people regularly work from:" to complete the sentence.

---

## Implementation — Entra channel

CURRENT →
```
Go to Entra admin center → Entra ID → Conditional Access → Named locations → + Countries location.
Name it Core - Allowed - Countries.
Use Determine location by IP address.
Select exactly the owner-approved countries supplied by IAMAI.
Leave Include unknown countries/regions off.
Create the location, then rescan IAMAI so its stable ID becomes tenant truth.
```

TARGET →
```
1. Go to Entra admin center → Conditional Access → Named locations → + Countries location.
2. Name: Core - Allowed - Countries.
3. Location method: Determine location by IP address.
4. Select the countries listed above (United States, plus any you added for travel).
5. Leave "Include unknown countries/regions" off.
6. Create. Rescan in IAMAI.
```

Changes:
- Numbered steps for scannability.
- "Entra ID → Conditional Access" simplified — Entra admin center already implies Entra ID.
- "owner-approved countries supplied by IAMAI" → "the countries listed above" — the action column already shows them.
- "so its stable ID becomes tenant truth" → removed (internal concept).

---

## Implementation — AI Info channel

TARGET →
```
This named location defines which countries your organization operates in. The geo-restriction policy (Block Sign-ins From Countries Not Allowed) will block sign-ins from everywhere except these countries.

Get it right before the policy exists: adding a country later is easy, but forgetting one locks people out immediately.

If people travel occasionally, choose "Occasionally" above — you'll add the destination country before each trip and remove it after. If people regularly work from another country, add those countries permanently.
```

---

## Done when

CURRENT →
```
A countries named location with exactly United States exists in the tenant.
```

No change. Specific and verifiable.

---

## Global issues
1. Tile label too long ("PEOPLE WHO TRAVEL OR WORK ABROAD") — content fix.
2. Milestone sub-text confusing — content fix.
3. Radio options need explanation suffixes — content fix.
