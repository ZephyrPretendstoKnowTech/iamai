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
/**
 * What a baseline README's Intent section is allowed to become.
 *
 * This is free prose fetched at runtime from a third-party GitHub repo, and it
 * ends up in the step body, in generated prompts and in the grounding bundle.
 * The regex above captures everything up to the next heading: arbitrary length,
 * arbitrary line breaks, arbitrary content. Admitting that unbounded is what
 * made the prompt path injectable (audit prompt-02).
 *
 * One paragraph, one line, no code fences, capped — and the cap is stated to
 * the reader rather than silently swallowing the rest.
 */
export const INTENT_MAX = 600;
export const INTENT_TRUNCATED = " […truncated by IAMAI]";

export function cleanIntent(raw: string): string {
  const oneLine = raw
    .replace(/`+/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return oneLine.length > INTENT_MAX ? oneLine.slice(0, INTENT_MAX).trimEnd() + INTENT_TRUNCATED : oneLine;
}

export function extractPolicyDocs(files: BaselineFile[]): PolicyDoc[] {
  const docs: PolicyDoc[] = [];
  for (const f of files) {
    if (!/readme\.md$/i.test(f.path)) continue;
    const h1 = f.text.match(/^#\s+(.+?)\s*$/m);
    if (!h1) continue;
    const intent = f.text.match(/^##\s+Intent\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/m);
    docs.push({
      policyName: h1[1].trim(),
      intent: intent ? cleanIntent(intent[1]) : undefined,
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
