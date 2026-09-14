# Independent review contract

Review behavior, not the implementer's confidence. Same-model fresh sessions are a second check, not independent external certification. Do not use cloud/paid review commands or subagents. Tests and browser activity remain local/synthetic.

1. Read owner constraints. Compare starting commit to current candidate. Look for removed/hidden tabs, erased content, validation bypass, new dependencies, baseline/threshold changes, CI changes, or unrelated edits. These are regressions against scope.
2. C01: synthetic separate admin/internal-user policies, changed names, reversed input order, partial mappings, multiple goals. Assert target identity and exact intended delta. A hardcoded audited name is failure.
3. C02: all channels agree on lifecycle and grant; a conditions correction does not silently alter grant. Baseline TAP intent is represented honestly. Report-only is not called harmless when it removes existing enforcement.
4. C03: valid empty collection vs malformed JSON, missing/nonarray value, malformed later page; unknown reaches consumer. Scalar/count endpoints remain valid. No live Graph requests.
5. C04: retained proof, replacement credential, unknown dates, both timestamp spellings when supported, known later creation, unknown inventory. Confirm useful historical information survives and unsupported continuity is not asserted.
6. C05/C06: render complete and incomplete synthetic states. JSON parse is insufficient—field types/operation semantics matter. PowerShell has the required usable inputs, quoting and syntax; do not run write commands. Entra names/IDs/scope/grant/state agree with machine channels. Existing exports must not retain contradictory old instructions after UI fix.
7. C07: Ready/readiness labels match their actual definition; do not invent scope counts. Existing unknowns/prerequisites remain distinguishable. Correct internal strings at their source, not blanket replacement.
8. C08/C09: local demo, direct route/reload, background→foreground, synthetic handoff; no live Microsoft auth. Notice visible before/after connection, both themes, narrow width, correct mailto, no acknowledgement barrier.
9. Tests: distinguish pre-existing/environment failures from new regressions. Snapshot updates require semantic justification. No skipped/softened failing test to obtain green.

## Review output
For each C-ID record VERIFIED / FAILED / NOT VERIFIED / NOT REPRODUCED, with exact scenario, expected result, actual result, command/fixture and relevant commit. A changed code path without a reproduction is NOT VERIFIED. NOT REPRODUCED means the attempted scenario is documented; it is not equivalent to fixed.

Final report: candidate/source SHA; clean/dirty; feature-preservation result; each critical finding; tests/build/browser results; missing evidence; remaining defects ranked; changed files; review verdict; location of preserved unfinished work. Clearly state NO PUSH/NO DEPLOY/NO TENANT CHANGE. Owner reviews before any merge/publication. Do not include credentials/private tenant data.
