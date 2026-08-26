import type { BaselineFile, BaselinePackage } from "./types.ts";
import { discoverPolicies } from "./discover.ts";
import { inventoryReferences } from "./references.ts";
import { groupSignatures } from "./signatures.ts";
import { findVariantSets } from "./variants.ts";
import { extractPolicyDocs } from "./docs.ts";

export type * from "./types.ts";
export { discoverPolicies, nameKey, precedenceFor, shouldSkip } from "./discover.ts";
export { normalizePolicy, normalizeValue, looksLikePolicy } from "./normalize.ts";
export { inventoryReferences, unresolvedReferences } from "./references.ts";
export { groupSignatures, policyTraits, ROLE_LABELS } from "./signatures.ts";
export { findVariantSets, intentKey } from "./variants.ts";
export { extractPolicyDocs, docFor } from "./docs.ts";
export { fetchBaselineFiles, rawUrl } from "./github.ts";
export type { BaselineIndex, FetchOptions } from "./github.ts";

/**
 * Build a BaselinePackage from raw files. Pure and synchronous: no network,
 * no DOM, so it runs identically in the browser, a Web Worker, or Node tests.
 *
 * Policy `state` values in the result are the source's lab state and MUST be
 * treated as "intended enforced" by consumers unless a manifest says otherwise.
 */
export function loadBaseline(files: BaselineFile[]): BaselinePackage {
  const { policies, origins, report } = discoverPolicies(files);
  return {
    policies,
    origins,
    report,
    references: inventoryReferences(policies),
    groupSignatures: groupSignatures(policies),
    variantSets: findVariantSets(policies),
    docs: extractPolicyDocs(files),
  };
}
