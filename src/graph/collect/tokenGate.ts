// Token gate (prompt 20 §3). When MSAL cannot refresh silently, the scan
// must pause where it is, not fail: the gate turns the worker's refresh
// request into a promise that stays pending until the operator signs in
// again, then resumes with the new token. Pure; no MSAL, no DOM.

export class SessionExpiredError extends Error {
  constructor(message = 'Microsoft session expired') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

export type TokenGate = {
  /** Silent refresh; on session expiry, pauses until resume() or fail(). */
  refresh(): Promise<string>
  /** Hand in a token obtained interactively; every paused refresh resumes with it. */
  resume(token: string): void
  /** Abandon the pause (cancelled scan): every paused refresh rejects. */
  fail(error: Error): void
  paused(): boolean
}

export function createTokenGate(acquireSilent: () => Promise<string>, onExpired: () => void): TokenGate {
  let waiters: { resolve: (t: string) => void; reject: (e: Error) => void }[] = []
  return {
    paused: () => waiters.length > 0,
    refresh: () =>
      acquireSilent().catch((e: unknown) => {
        if (!(e instanceof SessionExpiredError)) throw e
        if (waiters.length === 0) onExpired()
        return new Promise<string>((resolve, reject) => {
          waiters.push({ resolve, reject })
        })
      }),
    resume: (token) => {
      const w = waiters
      waiters = []
      for (const x of w) x.resolve(token)
    },
    fail: (error) => {
      const w = waiters
      waiters = []
      for (const x of w) x.reject(error)
    },
  }
}
