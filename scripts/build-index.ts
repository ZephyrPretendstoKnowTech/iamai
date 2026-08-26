// Usage: node scripts/build-index.ts <cloned-repo-dir> <owner> <repo> "<label>" > baselines/<owner>-<repo>.index.json
// Emits a BaselineIndex: file paths + the commit SHA the clone is at. No policy
// content is copied — the app fetches raw files from GitHub at runtime.
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { BaselineIndex } from "../src/baseline/github.ts";

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
const index: BaselineIndex = {
  owner,
  repo,
  commit,
  label: label ?? `${owner}/${repo}`,
  generatedAt: new Date().toISOString(),
  files: walk(root),
  attribution: `Policies and documentation © ${owner} (${owner}/${repo}). Fetched live from GitHub at commit ${commit.slice(0, 7)}; not redistributed by IAMAI.`,
};
process.stdout.write(JSON.stringify(index, null, 2) + "\n");
