#!/usr/bin/env node
// Writes src/actionability/dependency-data.json from the dependency playbook
// (§8 conditions, §10.0 step index, §10.N edge tables). The document stays the
// source of truth; src/actionability/dependencyData.test.ts fails when they diverge.
//   node scripts/build-dependency-data.mjs           # write
//   node scripts/build-dependency-data.mjs --check   # exit 1 if the JSON is stale
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PLAYBOOK_PATH, parseDependencyDoc } from '../src/actionability/parseDependencyDoc.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'actionability', 'dependency-data.json');
const data = parseDependencyDoc(fs.readFileSync(path.join(root, PLAYBOOK_PATH), 'utf8'));
const text = `${JSON.stringify(data, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (current !== text) { console.error(`stale: ${path.relative(root, out)} differs from ${PLAYBOOK_PATH}`); process.exit(1); }
  console.log(`up to date: ${data.steps.length} steps, ${data.edges.length} edges, ${data.conditions.length} conditions`);
} else {
  fs.writeFileSync(out, text);
  console.log(`wrote ${path.relative(root, out)}: ${data.steps.length} steps, ${data.edges.length} edges, ${data.conditions.length} conditions`);
}
