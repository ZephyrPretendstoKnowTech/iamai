# 00 — Scoring split: activity vs MFA

Skip this file if the Readiness table already shows Activity and MFA state as separate columns.

Split scoring into two dimensions: `activity` (active / dormant / neverSignedIn, with account createdDateTime carried for neverSignedIn) and `mfa` (none / verified / likelyViable / notChallenged / unverified). Remove `inactive` from the MFA enum; evidence rules 1 and 5 apply only to active users; summarizeTenant counts verification phase over active users only.

Add `strongestMethod` and `methodTiers` per user from userRegistrationDetails.methodsRegistered using the tiers: phishingResistant (passKeyDeviceBound*, fido2SecurityKey, windowsHelloForBusiness, x509Certificate) > passwordless (microsoftAuthenticatorPasswordless) > push (microsoftAuthenticatorPush) > otp (softwareOneTimePasscode, hardwareOneTimePasscode) > smsVoice (mobilePhone, alternateMobilePhone, officePhone) > none; email and securityQuestion are not MFA.

Update docs/design/collection.md §10 and the test cases (T9 becomes activity=dormant with mfa still computed; add neverSignedIn and strongestMethod cases).

Table: Activity and MFA state as separate columns plus a Strongest method column. Replace the pending banner with "Sign-in evidence hasn't been collected yet — states below are based on registered methods only." Rename the No MFA tile to No method. Hide the dev spikes panel unless the URL has ?dev=1.

Commit with message "Scoring: split activity from MFA state; strongest method tiers".
