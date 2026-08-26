// Usage: node scripts/analyze-local.ts <path-to-cloned-baseline-repo>
// Proves the adapter against real data without touching the network.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { loadBaseline, unresolvedReferences, ROLE_LABELS, docFor } from "../src/baseline/index.ts";
import type { BaselineFile } from "../src/baseline/types.ts";

const root = process.argv[2];
if (!root) {
  console.error("usage: node scripts/analyze-local.ts <repo-dir>");
  process.exit(1);
}

function walk(dir: string, out: BaselineFile[] = []): BaselineFile[] {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(json|md)$/i.test(name)) out.push({ path: relative(root, full).split("\\").join("/"), text: readFileSync(full, "utf8") });
  }
  return out;
}

const pkg = loadBaseline(walk(root));
const r = pkg.report;

console.log(`files considered ${r.considered} | policies parsed ${r.parsed} | kept ${pkg.policies.length} | duplicates ${r.duplicates.length} | skipped ${r.skipped.length} | errors ${r.errors.length}`);
for (const e of r.errors) console.log(`  ERROR ${e.path}: ${e.error}`);
for (const w of r.warnings) console.log(`  WARN  ${w.policyName}: ${w.warning}`);

console.log("\nPolicies (source state is NOT the target state):");
for (const p of pkg.policies) {
  const doc = docFor(pkg.docs, p.displayName);
  console.log(`  ${p.state?.padEnd(33) ?? "(no state)".padEnd(33)} ${p.displayName}${doc?.intent ? "  [intent doc]" : ""}`);
}

const unresolved = unresolvedReferences(pkg.references);
const byKind = new Map<string, number>();
for (const ref of unresolved) byKind.set(`${ref.kind}/${ref.portability}`, (byKind.get(`${ref.kind}/${ref.portability}`) ?? 0) + 1);
console.log("\nReferences the target tenant must supply or verify:");
for (const [k, n] of byKind) console.log(`  ${k}: ${n}`);

console.log("\nGroup signatures:");
for (const s of pkg.groupSignatures) {
  console.log(`  ${s.id}  in=${s.includedIn.length} ex=${s.excludedFrom.length}  ${ROLE_LABELS[s.inferredRole]} (${s.confidence}) — ${s.evidence}`);
}

console.log("\nVariant / duplicate sets:");
for (const v of pkg.variantSets) console.log(`  ${v.relation}: ${v.policyNames.join("  <->  ")}`);
if (pkg.variantSets.length === 0) console.log("  none");

console.log(`\nAuthor docs found: ${pkg.docs.length} (${pkg.docs.filter((d) => d.intent).length} with Intent)`);
