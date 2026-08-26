# Design: diagnostics

When a scan misbehaves, the operator needs something to send — without leaking
their tenant. The diagnostics bundle is a **downloadable JSON** built entirely
from what the collection service already tracks:

- per-source and per-section **statuses, timings, row counts, and reasons**
  (the same data the section events carry),
- the Lane B page log (per-page ms, counts, stop reason, covered window),
- app version / schema version, browser user agent, and generation time.

## Redaction rules (hard requirements)

- **No UPNs. No user GUIDs.** Every string in the bundle passes
  `redactIdentifiers` (`src/redact.ts`): email-shaped strings become
  `upn-N@redacted`, GUIDs become `guid-NNNN`, placeholders stable within the
  bundle so correlations survive.
- **The tenant id is hashed** (SHA-256) — enough to correlate two bundles from
  the same tenant, useless for identifying it.
- No raw Graph response bodies, ever; error *messages* are included but pass
  redaction like everything else.

## "Every log line obeys it"

The same rule applies to anything the app emits outside the page itself:
section-event `reason` strings are redacted in the worker before they are
posted, so no surface — UI, console, bundle — ever holds an unredacted
identifier that came from a Graph error message. Dev-spike output already
obeys the same function via `saveDevResults`.

## Non-goals

- Not telemetry: nothing is sent anywhere; the bundle exists only as a file
  the operator chooses to download and share.
- Not a data export: tenant data (users, policies, sign-ins) never appears in
  it, redacted or otherwise — only statuses, timings, and errors.
