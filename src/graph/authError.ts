// A sign-in that returned an error is one of three states on Connect's first
// tile (docs/design/connect-mockup.html), from the MSAL error code and message:
// admin approval needed, a personal Microsoft account, or cancelled. Anything
// else is a plain failure with Microsoft's words. Pure; no MSAL, no DOM.

export type SignInError = { kind: 'consent'; domain: string | null } | { kind: 'personal'; account: string | null } | { kind: 'cancelled' } | { kind: 'failed'; message: string }

const CONSENT_RE = /consent_required|interaction_required|AADSTS65001|AADSTS90094|AADSTS650052/i
const PERSONAL_RE = /AADSTS50020|AADSTS500200|AADSTS9002332|identity provider 'live\.com'|personal Microsoft account/i
const CANCELLED_RE = /user_cancelled|AADSTS65004|access_denied/i

export function classifyAuthError(e: { code: string; message: string }): SignInError {
  const text = `${e.code} ${e.message}`
  if (CONSENT_RE.test(text)) {
    const m = e.message.match(/@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i)
    return { kind: 'consent', domain: m ? m[1].toLowerCase() : null }
  }
  if (PERSONAL_RE.test(text)) {
    const m = e.message.match(/'([^'\s]+@[^'\s]+)'/)
    return { kind: 'personal', account: m ? m[1] : null }
  }
  if (CANCELLED_RE.test(text)) return { kind: 'cancelled' }
  return { kind: 'failed', message: e.message }
}

/** The MSAL error's code and message, whatever shape the library threw. */
export function authErrorOf(e: unknown): { code: string; message: string } {
  const o = (e ?? {}) as { errorCode?: unknown; errorMessage?: unknown; message?: unknown }
  return {
    code: typeof o.errorCode === 'string' ? o.errorCode : '',
    message: typeof o.errorMessage === 'string' ? o.errorMessage : typeof o.message === 'string' ? o.message : String(e),
  }
}
