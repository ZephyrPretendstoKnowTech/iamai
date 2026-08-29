# 34 — Permissions disclosure, feedback channel, deployment

Precondition: 33 committed.

## Part 1 — Permissions on the Connect page

1. Add a disclosure on the Connect page, collapsed by default, titled "What IAMAI will ask
   for, and how to remove it". Contents, in plain language, generated from the collector
   registry so it can never drift from what the code requests:
   - A table: permission, what it lets IAMAI read, and what stops working without it. One row
     per delegated scope, in plain words ("Policy.Read.All: read your Conditional Access
     policies and named locations. Without it, IAMAI cannot compare anything").
   - A line stating these are read permissions only, and that Microsoft's consent screen will
     list them.
   - A line stating what consent creates: an enterprise application named IAMAI in the
     tenant, and nothing else.
   - Removal instructions with the exact path: Entra admin center → Enterprise applications →
     IAMAI → Properties → Delete. Plus: this removes all access immediately and leaves nothing
     behind.
   - A link to the What IAMAI reads page for the endpoint-level detail.
2. The same content, condensed, appears on the What IAMAI reads page and in SECURITY.md.

## Part 2 — Feedback channel

3. Add a persistent, quiet footer link on every page: "Something wrong or unclear? Tell me."
4. It opens a small panel, not a new page, containing:
   - A one-line intro: "This tool is only useful if it is accurate. If something looks wrong,
     I want to know."
   - A mailto link to feedback@getiamai.com with a pre-filled subject ("IAMAI feedback") and a
     pre-filled body containing: the page, the tool version, the browser, and, only if the
     user ticks a box, the redacted diagnostics summary (no names, no tenant id). The panel
     shows exactly what will be included before they send.
   - A second option: "Open an issue on GitHub" linking to the repo's issue tracker.
   - Nothing is sent automatically. The user's mail client opens with the text visible.
5. Add the address to the README, SECURITY.md, and the print cover.

## Part 3 — Deployment

6. Fix the failing Pages deploy. Confirm: Settings → Pages source is "GitHub Actions"; the
   workflow has `permissions: contents: read, pages: write, id-token: write`; it uses
   `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` with
   an `environment: github-pages`; the build output directory matches what is uploaded; and
   the workflow runs on pushes to the default branch. Report the actual error from the failing
   run rather than guessing.
7. Make the base path configurable at build time (`VITE_BASE`), defaulting to `/` for the
   custom domain and `/iamai/` for the github.io path, and confirm hash routing, the baseline
   index fetch, fonts, and assets all work under both.
8. Add a `public/CNAME` file containing `getiamai.com` (a plain text file, one line, no
   protocol) so the custom domain survives each deploy.
9. Update the release checklist with the DNS records, the domain verification step, and the
   MSAL redirect URI change.

## Finishing

Run npm test and vite build. Commit by part. Push. Report the Pages error that was failing,
what fixed it, and the live URL once it deploys.
