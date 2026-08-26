// Main-thread controller for the collection worker (docs/design/collection.md
// §5): spawns the worker, feeds it tokens from MSAL on demand, holds the
// per-tenant navigator.locks lock, and relays progress events.
import { getGraphToken } from '../msal.ts'
import type { TenantSnapshot, WorkerOutMessage } from './types.ts'

export type ScanHandle = {
  done: Promise<TenantSnapshot>
  cancel: () => void
}

export function startScan(tenantId: string, onEvent: (m: WorkerOutMessage) => void): ScanHandle {
  let worker: Worker | null = null
  let cancelled = false

  const done = new Promise<TenantSnapshot>((resolve, reject) => {
    const body = async (): Promise<TenantSnapshot> => {
      const token = await getGraphToken()
      return new Promise<TenantSnapshot>((res, rej) => {
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        worker.onerror = (e) => rej(new Error(e.message || 'collection worker failed'))
        worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
          const msg = e.data
          if (msg.type === 'token-needed') {
            getGraphToken()
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
        worker.postMessage({ type: 'start', token, tenantId, licenceOverride })
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
      worker?.postMessage({ type: 'cancel' })
    },
  }
}
