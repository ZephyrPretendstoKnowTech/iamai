# 15 — Inventory fixes: roles, licensing, devices, policies table

Precondition: 14 committed. Read docs/design/ux-review-03.md §A6, §C.

1. Bundle `data/role-templates.json` with every Microsoft Entra built-in role template id and display name (from Microsoft's published list; add a refresh script). Resolve every role reference in policies, portal steps, and inventory through it; a template id that is missing from the catalogue renders as "Unknown role (id …)" once, never "an object not in this tenant".
2. Roles tab: resolve holders to display names of users, groups, or service principals (fetch service principals by id on demand); mark service principals as "service: <name>". Hide roles with no active or eligible holders by default with a "show all roles" toggle.
3. Licensing tab: bundle `data/product-names.json` from Microsoft's product names and service plan identifiers list (refresh script); show the friendly name with the SKU code beneath in muted small text; hide zero-seat SKUs behind a toggle; the capabilities summary stays.
4. Devices tab: keep Entra owner; add "Authenticator registrations with this device name" listing every account whose Authenticator displayName matches, with the medium-confidence note per §A6. The Setup break-glass validation lists all matching accounts, not just the operator.
5. Policies table: "133 roles" renders as "All admin roles (133)" when the set covers the catalogue's admin set, otherwise "N roles"; users column tooltip lists names.
6. People tab: add columns for licence tier and roles from the resolved catalogue.

Commit and push. Send screenshots of Roles and Licensing.
