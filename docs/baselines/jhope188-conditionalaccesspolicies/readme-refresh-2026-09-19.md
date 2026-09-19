# Jon's README refresh (0a69db9, 19 September 2026)

**Summary**
1. `0a69db9` rewrote only the two policy READMEs, which are now identical. No policy JSON changed since the pin `90d9b89`, so nothing IAMAI renders changes on its own.
2. Matching by policy and slot, the README confirms 8 of our group readings and corrects 1: `9ee031a3` is the external AVD users group, not service accounts. It leaves `62d67e66`, `e663a7ce`, `1178bb5d` and the Intune Enrollment placeholder unresolved.
3. The README describes his live tenant, not the export. Every policy now excludes one break-glass group (`5628ad67`). Several policies carry groups the export doesn't have: Azure DevOps users, Teams Rooms devices, guest exclusions, all admins on Admin Portal, and service accounts and travellers on SharePoint.
4. Every new group maps to an existing IAMAI object or to a Direction answer. None needs a new standing group. Drop `62d67e66`, `e663a7ce`, GlobalExclusions and both passkey groups.
5. Four README statements could change policies IAMAI implements. Each waits for his JSON or an owner decision:
   - Medium-Risk Users uses risk remediation, not password change;
   - admins and PIM should use a strength without TAP;
   - B2B-Guest needs a fallback when there's no cross-tenant trust;
   - since July, registering Windows Hello for Business or Platform SSO counts as registering security info.

---

## 1. What changed

`git diff --stat 90d9b89 origin/main` lists:
- `Updated/readme.md`;
- `Updated/Documentation/readme.md`, now identical to the first;
- `.DS_Store` removals and a new `.gitignore`.

**No file under `Updated/Policies/` changed.**

The README covers 37 policies. It leaves out IntuneEnrollment-SIFEveryTime, EntraConnectIDSync and RiskyServicePrincipals. Only three groups carry an id: `5628ad67`, `8d0564e5`, and `bf1e4c1f`, which isn't in the export.

## 2. Group names resolved

"README" is the name in the same policy's Users row. The README always lists break-glass first, so matching is by policy, not by list order.

| GUID | In the JSON | README name (`SG-` dropped) | Our guess | Verdict |
|---|---|---|---|---|
| `5628ad67` | Excluded from 5 late-August policies | Entra-AUG-CAP-BreakglassAccounts (id given) | Break-glass (issue A) | **Confirmed** |
| `b63c3682` | Excluded from 31 | Where it's the only group, the slot reads BreakglassAccounts | Break-glass | **Confirmed**: the older id |
| `62d67e66` | Excluded from 23 | Unnamed; every README lists one group fewer | Unknown | **Still unknown** |
| `e663a7ce` | Excluded from 6 | AllUsers: GlobalExclusions. Admin Portal: AllAdminUsers. The other four: nothing. | An admin group | **Still unknown**: the readings conflict |
| `cc7f9bb7` | Excluded from Countries | Entra-AUG-CAP-TravelingUsers | Travellers | **Confirmed** |
| `2d25c298` | Excluded from Compliant and Device Registration | Entra-ADG-CAP-DeviceExclusions | Device exclusions | **Confirmed** |
| `6612d6d7` | Included by Service Accounts | NHI-AUG-ServiceAccounts-All | Service accounts | **Confirmed** |
| `9ee031a3` | Excluded from SharePoint and both AVD policies | AVD: Intune-AUG-AVD-Prod-ExternalUsers. SharePoint: probably GuestExclusions. | Service accounts or AVD | **Corrected**: external users |
| `902993ed` | Excluded from AVD Exclude | Intune-AUG-AVD-Prod-Users | AllowedAVDUsers | **Confirmed** |
| `5f96c57d` | Included by ADM passkeys | Entra-DUG-Admins-AllAdminUsers | Admin pilot | **Confirmed**: all admins, dynamic |
| `1178bb5d` | Included by passkey registration | Entra-AUG-MFA-AuthPasskey, but its id is `bf1e4c1f` | Pilot | **Still unknown**: replaced |
| `8d0564e5` | EAM policy | Entra-AUG-MFA-AuthEAM (id given) | EAM | **Confirmed** |
| Placeholder `CA-GlobalExclusions-…` | Intune Enrollment | Not in the README. GlobalExclusions now exists apart from break-glass. | The emergency group | **Still unknown** |

The break-glass policy's two named users, `cec6164b` and `ebb6b745`, now read Breakglass01 and Breakglass02.

## 3. Where the README and the JSON disagree

**Groups in the README but not the JSON:**
- **Device Code:** AzureDevOpsUsers and TeamsRoomDevices.
- **SharePoint off-network:** ServiceAccounts-All and TravelingUsers.
- **Admin Portal:** AllAdminUsers, which settles issue B in his tenant.
- **MFA-AllUsers:** GlobalExclusions.
- **BreakGlass - TrustedLocations:** BreakglassAccounts. If Breakglass01 is a member, the policy applies to no one.

**Groups in the JSON but not the README:** `62d67e66` on all 23 policies, plus `b63c3682` wherever `5628ad67` is also present. `e663a7ce` goes unnamed except on AllUsers and Admin Portal. The AVD, Compliant and Device Registration policies each list one or two groups fewer than the JSON.

**Other settings:**
- **MFA-Passkey - UserRegistration**, the one policy the README marks as updated:
  - the action becomes register security info (it was register device);
  - the iOS condition is gone;
  - it includes `bf1e4c1f`;
  - it lists no exclusions.
- **Service Accounts:** includes the Directory Sync Accounts role.
- **Medium-Risk Users:** the README says report-only with **risk remediation**. The JSON is enabled with **passwordChange**. This was already in `Updated/readme.md` at the pin.
- **New guidance only:**
  - Device Registration: strength or plain MFA, and TAP reaching admins;
  - B2B-Guest: which methods guests can satisfy;
  - PIM: now names context `c1`.

**What the README says changed:**
- the header, "Updated September 19, 2026";
- the passkey audit line;
- a July 2026 note: register-security-info policies now apply when someone registers Windows Hello for Business or macOS Platform SSO.

## 4. Groups new to us

All names below drop the `SG-` prefix.

| Group | Used by | What it's for |
|---|---|---|
| Entra-AUG-CAP-AzureDevOpsUsers | Device Code | Documented DevOps pipelines |
| Entra-DUG-CAP-TeamsRoomDevices | Device Code | Meeting-room devices |
| Entra-AUG-CAP-GlobalExclusions | MFA-AllUsers | A standing MFA exception; the purpose isn't stated |
| Entra-AUG-CAP-GuestExclusions | SharePoint | Guests allowed into SharePoint from anywhere |
| NHI-AUG-ServiceAccounts-All | Service Accounts, SharePoint | Non-human accounts |
| Intune-AUG-AVD-Prod-Users / -ExternalUsers | AVD policies | The AVD allowlist. The external group also skips the location block. |
| Entra-AUG-MFA-AuthPasskey | Passkey registration | People registering passkeys |
| Entra-DUG-Admins-AllAdminUsers | ADM passkeys, Admin Portal | All admins, as a dynamic group |
| Entra-ADG-CAP-DeviceExclusions | Intune device policies | Devices that can't meet the rule |

## 5. What it means for IAMAI

| Group | Call | Driver or reason |
|---|---|---|
| BreakglassAccounts (`5628ad67`, `b63c3682`) | (a) | The emergency exclusions group |
| `62d67e66`, `e663a7ce` | (c) | Nothing names them |
| GlobalExclusions | (c) | No second catch-all. The placeholder stays (a), on the emergency group. |
| AllAdminUsers (`5f96c57d`) | (a) | Admin roles, also excluded on Admin Portal (lockdown kit) |
| ServiceAccounts-All (`6612d6d7`) | (b) | D2 Service accounts |
| TravelingUsers (`cc7f9bb7`) | (b) | D4 Travel outside those countries |
| DeviceExclusions (`2d25c298`) | (b) | D3 Devices that can't meet the rule |
| AVD-Prod-Users (`902993ed`) | (b) | D1 Azure Virtual Desktop |
| AVD-Prod-ExternalUsers (`9ee031a3`) | (b) | D1 AVD, with a follow-up on external users (it skips the location block) |
| AzureDevOpsUsers | (b) | D1 Device code sign-in = In use |
| TeamsRoomDevices | (b) | D2 Shared device accounts, feeding the D1 device-code exception |
| GuestExclusions | (b) | D1 Partner or MSP technicians, also on SharePoint when D1 SharePoint = Yes |
| AuthEAM (`8d0564e5`) | (b) | D1 External authentication methods |
| AuthPasskey, `1178bb5d` | (c) | IAMAI's own registration package |
| Breakglass01/02 (users) | (c) | IAMAI's emergency access design |

**README statements that touch implemented policies:**
1. **Medium-Risk Users (#22):** the README says risk remediation; the pin says password change. Keep the pin, and show the README reading as a pending change.
2. **Admin strength (#2, #19, #21, #23):** the README advises no TAP at all for admins and PIM. That goes further than the single-use TAP from chat. Owner decision.
3. **B2B-Guest (#5):** without cross-tenant trust, use plain MFA or a strength guests can satisfy. That settles issue H.
4. **Protect Sign-in Method Registration:** confirmed. The step should add that Windows Hello for Business and Platform SSO setup now meet this policy.
5. **Service Accounts (#16):** the Directory Sync role overlaps the Entra Connect policy. Don't adopt it without an owner decision.
6. **Device Code, Countries, Device Registration, Admin Portal:** no change.

**Pin:** moving it to `0a69db9` changes no policy. It would only make the README count as evidence for the seven ids `interpretation.json` still marks unknown. The owner decides.
