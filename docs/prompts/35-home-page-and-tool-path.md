# 35 — Home page at the apex, tool at /rollout/

Precondition: the site is live at getiamai.com and deploying from the iamai repo.

Goal: `getiamai.com` becomes a home page for IAMAI as a whole; the planner moves to
`getiamai.com/rollout/`. Future tools get sibling folders and a card on the home page.
Everything stays in this one repo, one workflow, one domain.

If the tool name changes later, it must be a single constant, not a find-and-replace.

## Part 1 — Build layout

1. Introduce `TOOL_PATH = "rollout"` as a build-time constant (an env var with a default in
   `vite.config.ts`), used for the Vite `base` and anywhere a path is constructed. No
   hard-coded "/rollout/" anywhere else.
2. Build the app with `base: "/rollout/"` into `dist/rollout/`.
3. Add a static home page (hand-written HTML and CSS, no framework, no build step) that is
   copied to `dist/index.html` during the same workflow run.
4. `public/CNAME` continues to land at `dist/CNAME`.
5. Confirm the workflow uploads `dist/` as the Pages artifact, so the result is:
   - `getiamai.com/` → the home page
   - `getiamai.com/rollout/` → the planner
6. Verify hash routing still works under the subpath: `getiamai.com/rollout/#/start` and
   every in-app link, plus deep links like `#/roadmap/step/<id>`.
7. Verify assets, self-hosted fonts, the baseline index fetch, and the favicon all resolve
   under the subpath. A missing font or a 404 asset is the classic base-path symptom.

## Part 2 — The home page

Static, fast, and in the same visual language as the app (reuse the tokens: same navy, same
teal accent, same type scale, the ring motif). No analytics, no external requests, no CDN.

Sections:

1. **Header** — IAMAI wordmark with the ring mark. One line: "Practical tools for Microsoft
   Entra identity work."
2. **What this is** — two or three sentences, first person is allowed here (this is
   Lachlan's page, not the product), saying who built it and why: an identity and access
   engineer building the tools he wanted when he started. No hype, no company language.
3. **Tools** — a card grid, one card per tool, built from a small JSON file so adding a tool
   later is a data change:
   - Name, one-line description, status chip ("Live", "In testing"), and a link.
   - First card: the planner. "Turn a Conditional Access baseline into a dated rollout plan
     that names who each step touches before anything is enforced. Read-only, runs in your
     browser." Status: whatever is accurate today.
4. **How these work** — three short bullets: read-only, nothing leaves the browser, source is
   public. Link to the repo.
5. **About** — a short paragraph, a link to LinkedIn, a link to GitHub, and the feedback
   address.
6. **Footer** — "Read-only · nothing leaves your browser" and the same links as the app.

Meta: page title "IAMAI — tools for Microsoft Entra identity work", a description, and an
OpenGraph image so shared links render properly. Responsive at 360 to 1920, both themes not
required (light or dark, pick one and match the app's dark default).

## Part 3 — Links and consistency

8. The app's footer and header gain a link back to `getiamai.com`.
9. Any absolute URL to the app in docs, README, SECURITY.md, the release checklist, and the
   feedback body updates to `https://getiamai.com/rollout/`.
10. Update `docs/RELEASE-CHECKLIST.md` with the redirect-URI requirement below.

## Part 4 — Redirect URIs (manual, must happen before deploy)

11. State clearly in the commit message and in the checklist that these must be added in the
    Entra app registration before this deploy goes live:
    - `https://getiamai.com/rollout/`
    - `https://www.getiamai.com/rollout/`
    Keep `http://localhost:5173` for development. The bare apex and www URIs can be removed
    once the move is confirmed working.
12. Confirm the MSAL config derives its redirect URI from the current origin plus the base
    path, so it is correct in all environments without a hard-coded value.

## Finishing

Run npm test and vite build. Verify locally that a preview serve of `dist/` gives the home
page at `/` and the app at `/rollout/`. Commit, push, and report the deploy result plus the
two URLs to test.
