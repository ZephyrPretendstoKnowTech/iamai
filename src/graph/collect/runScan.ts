// Main-thread controller for the collection worker (docs/design/collection.md
// §5): spawns the worker, feeds it tokens from MSAL on demand, holds the
// per-tenant navigator.locks lock, and relays progress events.
import { getGraphToken } from '../msal.ts'
import { devScanOverrides } from './devOverrides.ts'
import { createTokenGate } from './tokenGate.ts'
import { RoleGapError, coreRoleGap, rolesInToken } from './tokenRoles.ts'
import type { TenantSnapshot, WorkerOutMessage } from './types.ts'

export type ScanHandle = {
  done: Promise<TenantSnapshot>
  cancel: () => void
  /** After an 'auth-expired' event: sign in again in a popup and resume the paused scan. */
  signInAgain: () => Promise<void>
}

/** Where the scan's tokens come from: MSAL, or the mock's stand-in (never set outside the mock). */
export type TokenSource = typeof getGraphToken

export function startScan(tenantId: string, onEvent: (m: WorkerOutMessage) => void, getToken: TokenSource = getGraphToken): ScanHandle {
  let worker: Worker | null = null
  let cancelled = false
  // A refresh the session cannot do silently pauses the worker's request until
  // the operator signs in again; nothing collected so far is lost (§3).
  const gate = createTokenGate(() => getToken('silent'), () => onEvent({ type: 'auth-expired' }))

  const done = new Promise<TenantSnapshot>((resolve, reject) => {
    const body = async (): Promise<TenantSnapshot> => {
      const token = await getToken()
      // Before the first Graph call: a token whose roles read none of the core
      // sections stops here, with the role to ask for (tokenRoles.ts).
      const gap = coreRoleGap(rolesInToken(token))
      if (gap) throw new RoleGapError(gap)
      return new Promise<TenantSnapshot>((res, rej) => {
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        worker.onerror = (e) => rej(new Error(e.message || 'collection worker failed'))
        worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
          const msg = e.data
          if (msg.type === 'token-needed') {
            gate
              .refresh()
              .then((t) => worker?.postMessage({ type: 'token', token: t }))
              .catch((err: unknown) => rej(err instanceof Error ? err : new Error(String(err))))
            return
          }
          if (msg.type === 'snapshot') {
            res(msg.snapshot)
            return
          }
          if (msg.type === 'fatal') {
            rej(new Error(msg.message))
            return
          }
          onEvent(msg)
        }
        // The licence and failure simulations, in dev builds only (devOverrides.ts).
        const { licenceOverride, devFail } = devScanOverrides(window.location.search, import.meta.env.DEV)
        worker.postMessage({ type: 'start', token, tenantId, licenceOverride, devFail })
      }).finally(() => {
        worker?.terminate()
        worker = null
      })
    }

    // One scan per tenant across tabs (§5). Fall back gracefully where the
    // Web Locks API is unavailable.
    const locks = (navigator as { locks?: LockManager }).locks
    const locked = locks
      ? locks.request(`iamai-scan-${tenantId}`, body)
      : body()
    Promise.resolve(locked).then(
      (s) => (cancelled ? reject(new Error('scan cancelled')) : resolve(s as TenantSnapshot)),
      reject,
    )
  })

  return {
    done,
    cancel: () => {
      cancelled = true
      gate.fail(new Error('scan cancelled'))
      worker?.postMessage({ type: 'cancel' })
    },
    signInAgain: async () => {
      const token = await getToken('popup')
      gate.resume(token)
      onEvent({ type: 'auth-resumed' })
    },
  }
}
