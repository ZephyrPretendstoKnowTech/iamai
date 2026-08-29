# Release checklist

What a person does before the app is shown to anyone outside the project. The automated
checks (`npm test`, `npm run build`, `npm run smoke`, the network-destination test and the
export redaction test) run in CI on every push; this list is the rest.

## App registration (Entra)

- [ ] Add the published redirect URI to the IAMAI app registration under Authentication →
      Single-page application: `https://<owner>.github.io/iamai/` (the app sends
      `window.location.origin + BASE_URL`, so the trailing slash and the subpath matter).
      Keep `http://localhost:5173` for development.
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

## Pages

- [ ] Enable GitHub Pages with the "GitHub Actions" source; the `deploy-pages` workflow
      builds with `BASE_PATH=/<repo>/`.
- [ ] After the first deploy, open `https://<owner>.github.io/iamai/#/start`, sign in to a
      test tenant, and walk Start → Connect → Baseline → Scan → Setup → Findings → Roadmap.
      Print the Roadmap. Save the plan, forget the tenant, reload the plan.
- [ ] Take the first-run screenshots (Start, Findings, Roadmap Progress, Roadmap Plan) at
      360 and 1440 in both themes and commit them under `docs/screens/release/`.

## Baseline

- [ ] Confirm the baseline index (`baselines/*.index.json`) points at a commit that still
      exists, that the attribution on the Baseline page names the source repository,
      author and commit, and that policy files are fetched live from that commit rather
      than redistributed.

## Blockers

- [ ] `docs/qa/pre-share-blockers.md` is empty, or every line in it has a decision.
