// Main-thread controller for the collection worker (docs/design/collection.md
// §5): spawns the worker, feeds it tokens from MSAL on demand, holds the
// per-tenant navigator.locks lock, and relays progress events.
import { getGraphToken } from '../msal.ts'
import { createTokenGate } from './tokenGate.ts'
import type { TenantSnapshot, WorkerOutMessage } from './types.ts'

export type ScanHandle = {
  done: Promise<TenantSnapshot>
  cancel: () => void
  /** After an 'auth-expired' event: sign in again in a popup and resume the paused scan. */
  signInAgain: () => Promise<void>
}

export function startScan(tenantId: string, onEvent: (m: WorkerOutMessage) => void): ScanHandle {
  let worker: Worker | null = null
  let cancelled = false
  // A refresh the session cannot do silently pauses the worker's request until
  // the operator signs in again; nothing collected so far is lost (§3).
  const gate = createTokenGate(() => getGraphToken('silent'), () => onEvent({ type: 'auth-expired' }))

  const done = new Promise<TenantSnapshot>((resolve, reject) => {
    const body = async (): Promise<TenantSnapshot> => {
      const token = await getGraphToken()
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
        // ?dev=1&licence=free|p1|p2 simulates a licence profile (SPEC §12).
        const params = new URLSearchParams(window.location.search)
        const licence = params.get('dev') === '1' ? params.get('licence') : null
        const licenceOverride =
          licence === 'free' || licence === 'p1' || licence === 'p2' ? licence : undefined
        // ?dev=1&fail=1 forces one 403 and one 429 so the disabled and slow states show (ux-review-06 §34).
        const devFail = params.get('dev') === '1' && params.get('fail') === '1'
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
      const token = await getGraphToken('popup')
      gate.resume(token)
      onEvent({ type: 'auth-resumed' })
    },
  }
}
