# 03 — Application shell and design system

Precondition: 02-lane-b.md is committed.
BEFORE RUNNING: replace the two placeholders below with real URLs.

LINKEDIN_URL: <replace me>
GITHUB_URL: <replace me>

Build the real application shell.

Design system first: a single tokens file (colour, spacing, type scale, radii), a sans-serif stack, light and dark themes following the OS, no component library, no CDN.

Layout: top bar with the IAMAI wordmark, tenant name and operator once connected, and a "Forget this tenant" action. Left navigation in flow order — Baseline, Connect, Mapping, Coverage, Readiness, Roadmap, Licensing guide, What IAMAI reads — with Baseline, Connect, Readiness, and What IAMAI reads live and the rest as placeholder pages that say in one paragraph what they will show. Footer with "Built by Lachlan Robinette" linking to LINKEDIN_URL and GITHUB_URL above, plus a link to the source repo.

Baseline page: the pinned Jon Hope source as default with its attribution, an "upload a package" option, and the adapter's load report (policies kept, unusable, variants, unresolved references) in plain language.

Readiness page hosts the MFA viability screen with: sort on every column; filter chips per MFA state, activity, and method tier; name/UPN search; clickable summary tiles that filter; CSV export; UPN as a second line under the name; dates via Intl.DateTimeFormat in the browser locale and time zone, relative with absolute on hover; a legend and hover definitions for every state and tile; version numbers in tooltips with plain-language wording in the cell.

Dev spikes stay behind ?dev=1. Commit and push.
