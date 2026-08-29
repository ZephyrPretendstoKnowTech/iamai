# Pre-share blockers

Larger than the audit prompt allowed, or impossible without a live tenant or a live
deploy. One line of impact each; every line needs a decision before the tool is shared.

| Item | Impact | Needs |
|---|---|---|
| The free-tier ladder is not part of the plan for an unlicensed tenant (`data/free-tier-ladder.json` shows only on the Licensing guide). A tenant with no Entra ID P1 gets a two-step plan. | The most likely first visitor after a public post sees almost nothing to do. | A feature: generate the ladder items as steps when `entraP1` is off (SPEC §12 names it as the plan spine for free tenants). |
| A non-admin or Global Reader sign-in degrades sections with Graph's own 403 text ("insufficient privileges") but does not name the missing role or say what to ask for. | A visitor without the right role does not learn what to request. | Copy that maps each collector's 403 to the role it needs, plus a live check with a Global Reader and a non-admin account. |
| Network-blocked run after a real scan not exercised live (verified on the mock, where no requests happen after load, and by the destination test). | Low: the claim is guarded by tests; a live cut of the network is still the honest proof. | One run: scan a real tenant, go offline, walk Findings, Roadmap, exports, print. |
| GitHub Pages deploy not exercised live: the workflow, subpath build and redirect URI are in place, but no Pages site exists yet. | First publish is where hash routing, the font path and the MSAL redirect could still break. | Enable Pages, add `https://<owner>.github.io/iamai/` as a SPA redirect URI, run the release checklist. |
| Clean-profile first run against a real tenant (timings, confusion points) not done in this session. | Unknown first-run rough edges on real data volumes. | One walk with a stopwatch, recorded in the audit. |
