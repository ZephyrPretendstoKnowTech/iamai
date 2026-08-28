// Lane orchestration (docs/design/collection.md §5, prompt 20 §4). Pure so the
// isolation rule can be tested outside the worker: Lane A failures never abort
// Lane B, and vice versa; each lane lands as a labelled outcome.

export async function pool(limit: number, tasks: (() => Promise<void>)[]): Promise<void> {
  const queue = [...tasks]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  })
  await Promise.all(workers)
}

export type LaneOutcome = { ok: true } | { ok: false; error: string }

async function settle(run: () => Promise<void>): Promise<LaneOutcome> {
  try {
    await run()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Runs both lanes to completion; a rejection in one is recorded, never propagated. */
export async function settleLanes(laneA: () => Promise<void>, laneB: () => Promise<void>): Promise<{ laneA: LaneOutcome; laneB: LaneOutcome }> {
  const [a, b] = await Promise.all([settle(laneA), settle(laneB)])
  return { laneA: a, laneB: b }
}
