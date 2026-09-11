// The Content-Security-Policy both published pages carry, as a <meta> written at
// build (vite.config.ts for the planner, build-home.ts assembleHome for the home
// page). GitHub Pages sets no response headers, so the policy travels in the
// document; frame-ancestors, report-to and sandbox are header-only and are not
// here (SECURITY.md says where they would be set).
import { createHash } from 'node:crypto'

/** The hosts the planner requests: Microsoft sign-in and Graph, and the public baseline on GitHub. */
export const REQUEST_HOSTS = ['graph.microsoft.com', 'login.microsoftonline.com', 'raw.githubusercontent.com', 'api.github.com'] as const

// Cloudflare injects its Web Analytics beacon into the HTML it serves (How page,
// SECURITY.md). It is not IAMAI's, and the policy does not decide whether it
// runs: the Cloudflare account does. Allowing its two hosts keeps the site
// behaving as those statements describe it.
const BEACON_SCRIPT = 'https://static.cloudflareinsights.com'
const BEACON_REPORT = 'https://cloudflareinsights.com'

const COMMON = ["default-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]

/** The planner: the bundle's own scripts and worker, Graph and sign-in, and MSAL's silent-renewal frame. */
export function plannerCsp(): string {
  return [
    ...COMMON,
    `script-src 'self' ${BEACON_SCRIPT}`,
    `connect-src 'self' ${REQUEST_HOSTS.map((h) => `https://${h}`).join(' ')} ${BEACON_REPORT}`,
    "frame-src https://login.microsoftonline.com",
    "worker-src 'self'",
  ].join('; ')
}

/** The home page: its own inline scripts by hash, nothing fetched, no frames. */
export function homeCsp(scriptHashes: string[]): string {
  return [
    ...COMMON,
    `script-src 'self' ${scriptHashes.map((h) => `'${h}'`).join(' ')} ${BEACON_SCRIPT}`.replace(/\s+/g, ' '),
    `connect-src 'self' ${BEACON_REPORT}`,
    "frame-src 'none'",
  ].join('; ')
}

/** sha256-<base64> of every inline <script> body, in document order. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => `sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}`)
}

/** The page with the policy as its first governing element, straight after the charset. */
export function withCsp(html: string, policy: string): string {
  const charset = /<meta charset="[^"]*"\s*\/?>/i
  if (!charset.test(html)) throw new Error('withCsp: the page has no <meta charset>, so there is nowhere safe to put the policy')
  if (/http-equiv="Content-Security-Policy"/i.test(html)) throw new Error('withCsp: the page already carries a policy')
  return html.replace(charset, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
}
