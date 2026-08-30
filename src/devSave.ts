// Dev-only: hands result JSON to the local Vite dev server (see vite.config.ts),
// which writes it to docs/spikes/raw/ (gitignored). UPNs and GUIDs are redacted
// before leaving the page.
//
// This lives on its own rather than in src/graph/spikes/spike1.ts, where it used
// to. Two production pages import it — CoveragePage and RoadmapPage — and that
// single static edge dragged the whole spike harness into the main bundle: the
// Graph probe URLs, the paging loops, the console dumps of raw responses and the
// `window.__spike1` global, all shipped to every visitor while two comments in
// the source said they did not (audit egress-04, supply-08).
//
// The fetch below is dead-code-eliminated in production — `import.meta.env.DEV`
// folds to `false`, the guard becomes an unconditional return and the body is
// dropped — so what ships from this module is an empty function.
import { redactIdentifiers } from './redact.ts'

export async function saveDevResults(name: string, data: unknown): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    await fetch(`/__spike/save?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: redactIdentifiers(JSON.stringify(data, null, 2)),
    })
  } catch {
    // Middleware absent — the console output still has the data.
  }
}
