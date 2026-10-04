# v1.5: partner mode (draft)

v1.1 ships first: its live tests (`docs/plans/v1.1/plan.md` §8), then the merge to `main`.
v1.5 follows a week later. v2.0 (a second baseline) comes the week after that.

## The lead item: two ways in, chosen by the person (owner, 2026-10-04)
1. **Sign in** (today's button). Sign-in goes to the account's own tenant through
   `/organizations`, with today's permissions. Nothing changes for anyone who uses only this.
2. **Sign in as a Microsoft partner** (new, opt-in). The technician signs in to the partner
   tenant. IAMAI reads the partner's GDAP customers and opens one at a time.

Signing in to an arbitrary tenant as a guest is ruled out (owner, 2026-10-04: no guest
pulling security data). Neither button reaches a tenant where the account is a guest.

### What the partner path reads
- `GET /tenantRelationships/delegatedAdminCustomers` and
  `GET /tenantRelationships/delegatedAdminRelationships`: each relationship's status, end date
  and granted roles (`accessDetails.unifiedRoles`).
- The permission is `DelegatedAdminRelationship.Read.All`, delegated and read-only.
  - It is requested only when the partner button is pressed (dynamic consent).
  - It is never added to the app registration's configured permissions, so approving IAMAI
    in an ordinary tenant does not grant it.

### Guardrails (fixed)
1. **Only customers on the list.** The partner path opens only customers with an active
   GDAP relationship; any other tenant is refused before sign-in, and again on the token's
   tenant id after it.
2. **Roles before sign-in.** Each customer row says whether its granted roles cover what a
   scan reads. A relationship that grants more than IAMAI needs (Global Administrator, for
   example) is flagged: reader roles are all IAMAI uses.
3. **IAMAI never approves anything in a customer tenant.** The customer's admin approves
   IAMAI once through the tenant's own admin-consent link, which IAMAI shows. The Partner
   Center consent API is a write and is out.
4. **One customer at a time.** No bulk scan, and no view across every customer yet.
5. **Held data:**
   - "Forget every tenant" in the Account menu;
   - stored scans that expire after a set number of days (the number is the owner's call);
   - the customer list cleared on sign-out.
6. **Scripts stay pinned to the scanned tenant** (stepPowerShell.ts `pinnedToTenant`,
   already in place): the wrong-customer script is the classic partner break.
7. **Plain words.** One line on the partner button says what is read and that each customer
   approves IAMAI first. SECURITY.md and the README name the new permission.

### Phases
1. **The customer list and role check** in the partner tenant only. It is useful alone:
   which relationships are active, which expire soon, which can plan, and which grant too much.
2. **Signing in to one listed customer,** then scan, plan and storage as today.
   Switching between customers is v1.1's tenant switcher.
3. **Later, on evidence:** a view across customers (Tier C).

### Owner decisions before building
- [x] Two buttons; the partner permission is opt-in only (2026-10-04).
- [ ] The second button on Connect (approved pack change).
- [ ] How many days a stored scan is kept.
- [ ] A Partner Center tenant with an active GDAP customer for the live test. It ships only
  after that test passes.

### Still open from v1.1
- F-065's last part: keep the open step and its scroll after Scan.
- Close Dependabot PRs #9, #12, #19, #20 and #21 once v1.1 merges (owner).
