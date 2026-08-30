# Release checklist

What a person does before the app is shown to anyone outside the project. The automated
checks (`npm test`, `npm run build`, `npm run smoke`, the network-destination test and the
export redaction test) run in CI on every push; this list is the rest.

## App registration (Entra)

> **Before the /rollout/ move goes live.** The planner now sends
> `https://getiamai.com/rollout/` as its redirect URI, derived from the origin
> plus the build base. Until that exact value is registered, sign-in fails with
> `AADSTS50011` and the tool is unusable on the live site. Add it first.


- [ ] Add the published redirect URI to the IAMAI app registration under Authentication →
      Single-page application. The app sends `window.location.origin + BASE_URL`, so the
      value follows the base the bundle was built with, and the trailing slash matters:
      - custom domain (the default): `https://getiamai.com/rollout/` and
        `https://www.getiamai.com/rollout/`
      - github.io fallback (`VITE_BASE=/iamai/`): `https://<owner>.github.io/iamai/`
      The bare apex and www URIs from before the move can be removed once
      `/rollout/` is confirmed working.
      Keep `http://localhost:5173` for development. Adding both published URIs is fine;
      a redirect URI that is registered and unused costs nothing.
- [ ] Set the publisher domain on the registration so the consent screen shows a verified
      publisher rather than "unverified".
- [ ] Confirm the requested permissions are exactly the read scopes in `src/graph/msal.ts`
      and that no write scope was added by hand in the portal.

## Repository

- [ ] Confirm the repository is public and the licence (MIT) is present.
- [ ] Run the scrub from the pre-share audit (`docs/qa/pre-share-audit.md`, part 2): no
      sign-in names, tenant ids, user or device ids, device names or IP ranges in committed
      files, fixtures, screenshots or QA logs. `git grep -E
      "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|net|org|au)"` should return only
      `example.com`, `example.test` and `noreply@` addresses.
- [ ] Confirm `docs/spikes/raw/` is ignored and empty in the tree.
- [ ] Confirm `SECURITY.md` matches the scopes and storage the code uses.

## Pages and the custom domain

- [ ] Enable GitHub Pages with the **GitHub Actions** source. Until that is done,
      `actions/deploy-pages` fails with `HttpError: Not Found` and
      `Failed to create deployment (status: 404)`; the build job passes, so only the
      deploy job goes red.
- [ ] DNS for the apex domain, at the registrar. GitHub's documented addresses:
      - `A` `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
      - `AAAA` `@` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
        `2606:50c0:8003::153`
      - `CNAME` `www` → `<owner>.github.io` (the owner, without the repository name)
- [ ] Verify the domain: GitHub → Settings → Pages → **Verified domains**, add the
      `_github-pages-challenge-<owner>` TXT record it gives you, then verify. A verified
      domain stops anyone else pointing the same name at their own Pages site.
- [ ] Settings → Pages → Custom domain: `getiamai.com`, then wait for the certificate.
      Check `gh api repos/<owner>/<repo>/pages` shows `"protected_domain_state":
      "verified"` and an approved `https_certificate`.
- [ ] Tick **Enforce HTTPS** once the certificate is issued (it can take up to 24 hours to
      become available). Confirm with `gh api repos/<owner>/<repo>/pages` showing
      `"https_enforced": true`.
- [ ] Confirm the base matches the layout. The workflow builds with `TOOL_PATH`, defaulting
      to `rollout`: the home page lands at `dist/index.html` and the planner at
      `dist/<TOOL_PATH>/`, with the Vite base matching. If the site is ever served from `<owner>.github.io/<repo>/`
      instead, set the `VITE_BASE` repository variable to `/<repo>/` and update the redirect
      URI to match. A mismatch is silent: the page returns 200 with its title and the app
      never renders, because `/<repo>/assets/…` is not there.
- [ ] `public/CNAME` holds `getiamai.com` on one line with no protocol. GitHub's docs say
      this file is ignored when publishing from a custom Actions workflow, and the domain
      lives in repository settings instead; the file is kept so the intent is visible in the
      repository and so a switch back to branch publishing does not silently drop the domain.
- [ ] After the first deploy, open `https://getiamai.com/` for the home page and
      `https://getiamai.com/rollout/#/start` for the planner, sign in to a
      test tenant, and walk Start → Connect → Baseline → Scan → Setup → Findings → Roadmap.
      Print the Roadmap. Save the plan, forget the tenant, reload the plan.
- [ ] Take the first-run screenshots (Start, Findings, Roadmap Progress, Roadmap Plan) at
      360 and 1440 in both themes and commit them under `docs/screens/release/`.
- [ ] Confirm the deployed page actually renders: fetch the site root and check the script
      tag resolves. A blank page with a correct `<title>` is the signature of a base-path
      mismatch.

## Baseline

- [ ] Confirm the baseline index (`baselines/*.index.json`) points at a commit that still
      exists, that the attribution on the Baseline page names the source repository,
      author and commit, and that policy files are fetched live from that commit rather
      than redistributed.

## Blockers

- [ ] `docs/qa/pre-share-blockers.md` is empty, or every line in it has a decision.
