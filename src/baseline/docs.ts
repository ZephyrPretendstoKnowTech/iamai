import type { BaselineFile, PolicyDoc } from "./types.ts";
import { nameKey } from "./discover.ts";

/**
 * A per-policy README looks like:
 *   # <policy display name>
 *   ...
 *   ## Intent
 *   <paragraphs>
 *   ## <next heading>
 * We take the H1 as the policy name and the Intent section verbatim.
 */
export function extractPolicyDocs(files: BaselineFile[]): PolicyDoc[] {
  const docs: PolicyDoc[] = [];
  for (const f of files) {
    if (!/readme\.md$/i.test(f.path)) continue;
    const h1 = f.text.match(/^#\s+(.+?)\s*$/m);
    if (!h1) continue;
    const intent = f.text.match(/^##\s+Intent\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/m);
    docs.push({
      policyName: h1[1].trim(),
      intent: intent ? intent[1].trim() : undefined,
      sourcePath: f.path,
    });
  }
  return docs;
}

/** Look up a doc by policy name, tolerant of dash/case/whitespace drift. */
export function docFor(docs: PolicyDoc[], displayName: string): PolicyDoc | undefined {
  const key = nameKey(displayName);
  return docs.find((d) => nameKey(d.policyName) === key);
}
