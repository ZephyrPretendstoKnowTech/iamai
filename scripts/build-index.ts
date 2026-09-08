// Usage: node scripts/build-index.ts <cloned-repo-dir> <owner> <repo> "<label>" > baselines/<owner>-<repo>.index.json
// Emits a BaselineIndex: file paths + the commit SHA the clone is at. No policy
// content is copied — the app fetches raw files from GitHub at runtime.
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { indexRecord } from "../src/baseline/pinArtifacts.ts";

const [root, owner, repo, label] = process.argv.slice(2);
if (!root || !owner || !repo) {
  console.error('usage: node scripts/build-index.ts <repo-dir> <owner> <repo> "<label>"');
  process.exit(1);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.json$/i.test(name) || /^readme\.md$/i.test(name)) out.push(relative(root, full).split("\\").join("/"));
  }
  return out.sort();
}

const commit = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
// One shape for an index record, shared with scripts/pin-baseline.ts, so a pin
// and a clone walk cannot disagree about what one holds (src/baseline/pinArtifacts.ts).
const index = indexRecord({}, {
  owner,
  repo,
  commit,
  label: label ?? `${owner}/${repo}`,
  generatedAt: new Date().toISOString(),
  files: walk(root),
});
process.stdout.write(JSON.stringify(index, null, 2) + "\n");
