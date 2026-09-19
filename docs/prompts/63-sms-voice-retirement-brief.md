# 63 — SMS and voice retirement on MFA Readiness (DRAFT brief for the owner; not approved)

Status: a draft for review. The derivation (`src/derive/smsRetirement.ts`, with its tests) is built and reads real scan data. Nothing is on screen: the card, its words and its place on the page need your approval first.

## Why now (verified on Microsoft Learn, updated 2026-09-16)

- **2026-09-01.** Passkeys became the default in Entra ID. Everyone enabled for SMS or voice was:
  - auto-enabled for passkeys;
  - placed in an "all passkeys" profile;
  - prompted to register a passkey at MFA, with unlimited snoozes.
- **2027-02-01.** Microsoft stops providing SMS and voice for everyone except Global Administrators and external users. Internal guests are in this group.
  - After that date, anyone whose **only** MFA method is SMS or voice must register a passkey before they can sign in.
  - The prompt is **blocking**, and there is **no opt-out**.
- **2027-07-01.** The same applies to Global Administrators and external users.
- **Microsoft's finder** is the `entra-sms-voice-usage-analyzer` script. It lists which policies and groups have SMS or voice enabled. It doesn't name people, read their methods or read their sign-ins.
- **The exception.** An organisation with a genuine need can keep SMS or voice through a customer-managed telecom provider from the Microsoft Security Store, selectable from 2026-10-30. IAMAI can't see that choice yet, so the card must say "unless you've set up your own telecom provider".

IAMAI already holds everything needed to name the people, which Microsoft's finder can't, with no new permission. It gives the page a dated reason to run the scan now.

## What the derivation reads (built, tested)

For the people MFA Readiness counts:
- **Only SMS or voice:** the person holds a phone method and no other MFA method.
  - Password, email and Temporary Access Pass are not MFA methods here.
  - An unrecognised method counts as another method, so nobody is told they hold only SMS on a guess.
  - Where the method rows weren't read, the registration report stands in.
  - Where neither was read, the person is **unread**: neither affected nor safe.
- **Which date applies:**
  - July for people holding Global Administrator (active) and for external users. External means invited from outside the organisation, which Graph marks with `externalUserState`.
  - February for everyone else, internal guests included.
- **Texted recently:** a sign-in with a text or call inside the 30-day window.
- **Flagged, not decided:** someone eligible for Global Administrator through PIM, but not active. Microsoft doesn't say which date applies to them.
- **Tenant settings:** whether SMS and voice are enabled in the authentication methods policy. "Unread" where the policy wasn't read.

Numbers the derivation finds in the test fixtures:

| Fixture | People counted | Only SMS or voice, February | Only SMS or voice, July | Texted in 30 days |
|---|---|---|---|---|
| demo | 30 | 1 | 0 | 0 |
| mid | 234 | 30 | 0 | 10 |
| large | 3,972 | 539 | 5 | 234 |

## Proposed card (for approval)

This is a rail tile or a banner above the worklist; which one is your call. It is shown only while anyone the page counts still holds only SMS or voice, or texted recently.

> **SMS and voice retirement**
>
> **{n} people** sign in with only a text or call. From **1 February 2027**, Microsoft will ask them to register a passkey before they can sign in, with no way to skip it (unless you've set up your own telecom provider).
>
> **{m} are Global Administrators or external users**, whose date is **1 July 2027**.
>
> {k} people signed in with a text or call in the last 30 days.
>
> [Show them] · [Why this date →] (Microsoft Learn)

- **Show them** filters the worklist to those people. They're already "Needs a method", so their next step is unchanged ("Set up a passkey in Microsoft Authenticator").
- **The dates come from one constant** (`SMS_RETIREMENT_DATES`), with the Learn page's update date shown in the tooltip. If Microsoft moves a date, one line changes.
- **Words follow Microsoft's.** People are "asked to register a passkey before they can sign in", never "locked out".

## Rules this must keep

- **Claims stay precise.** Every date carries its source. Nothing says "blocked" where Microsoft says "prompted".
- **Unread stays unread.** No count includes someone whose methods weren't read; unread people get their own line.
- **No new permission.** Everything comes from scopes IAMAI already holds.
- **No score.** It is a count and a list, never a percentage compared with other tenants.

## Open questions for you

1. **Where does it sit:** a rail tile, or a banner above the worklist while the count is above zero?
2. **"Texted in 30 days":** show it here, or only in the person panel? It reaches people who hold Authenticator too, who aren't blocked but are still texting.
3. **Campaign emails:** should the MFA campaign get an SMS-retirement variant for exactly these people, following Microsoft's awareness → action → reminder cadence?
4. **The export and the counts-only snapshot:** include these counts?
5. **PIM-eligible Global Administrators:** list them under July, under February, or on a line of their own until Microsoft clarifies?

## Acceptance when built

- **Unit:** the derivation's tests (built) plus the card's words from `content.json`.
- **Counts:**
  - The card's counts equal the derivation's.
  - "Show them" shows exactly those rows.
  - Unread people are never counted.
- **Screen:** checked in the demo and on GetIAMAI at desktop and phone widths.
