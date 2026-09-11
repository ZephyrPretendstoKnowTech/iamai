#!/usr/bin/env node
// Lint, list, extract and register compact implementation-content packages
// (docs/authoring/IAMAI-Implementation-Content-Authoring-Guide-v2.5-Compact.md).
//
// The block protocol itself — parsing CONTENT.md and validating it against
// META.json — is src/content/implementation/protocol.ts, shared with the runtime
// projection, so the compiler and the product cannot read a package differently.
//
// --registry writes the runtime registry from the whole library: every package
// that describes a Plan content step, with the parts the runtime cannot project
// safely withheld (src/content/implementation/library.ts):
//   node scripts/compile-implementation-content.mjs --registry src/content/implementation/registry.generated.json
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { PackageError, bindingsUsed, maskJsonTemplate, normalizeProjection, packageWarnings, parseBlocks, validatePackage } from '../src/content/implementation/protocol.ts';
import { LIBRARY_ROOT, compileLibrary, registryOf } from '../src/content/implementation/library.ts';

function fail(message) { console.error(`ERROR: ${message}`); process.exit(1); }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`${file}: ${e.message}`); } }

function applyBindings(text, bindings) {
  return text
    .replace(/\{\{json:([A-Za-z0-9_.-]+)\}\}/g, (_, key) => {
      if (!(key in bindings)) fail(`missing JSON binding: ${key}`);
      return JSON.stringify(bindings[key]);
    })
    .replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_, key) => {
      if (!(key in bindings)) fail(`missing text binding: ${key}`);
      return String(bindings[key]);
    });
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: node compile-implementation-content.mjs <package-dir> [--lint] [--list] [--extract <block-id> --out <file>] [--bindings <json>]');
  console.log('       node compile-implementation-content.mjs --registry <out.json> [<library-root>]');
  process.exit(2);
}

if (args[0] === '--registry') {
  const out = args[1];
  if (!out) fail('--registry needs an output file');
  let library;
  try { library = compileLibrary(args[2] ?? LIBRARY_ROOT); }
  catch (e) { if (e instanceof PackageError) fail(e.message); throw e; }
  fs.writeFileSync(path.resolve(out), JSON.stringify(registryOf(library), null, 2) + '\n');
  for (const r of library.registered) console.log(`  ${r.stepId.padEnd(42)} ${String(r.withheld.length).padStart(4)} withheld`);
  if (library.notSteps.length > 0) console.log(`  not a Plan content step, not registered: ${library.notSteps.map((r) => r.stepId).join(', ')}`);
  console.log(`registry: ${library.registered.length} packages -> ${out}`);
  process.exit(0);
}

// --validate-library [<root>] [--json <out>]: production validation over every
// package under the library root WITHOUT registering or activating any of them.
// The same validatePackage the registry build enforces, so a PASS here is a
// package the runtime can project safely; failures are grouped by the protocol
// feature they hit.
if (args[0] === '--validate-library') {
  const root = path.resolve(args[1] && !args[1].startsWith('--') ? args[1] : 'docs/implementation-content');
  const pinned = readJson(path.resolve('baselines/jhope188-conditionalaccesspolicies.pinned.json')).commit;
  const dirs = [];
  const walk = (dir, depth) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === 'META.json')) { dirs.push(dir); return; }
    const odd = entries.filter((e) => e.isFile() && /^META.*\.json$/.test(e.name));
    if (odd.length > 0) { dirs.push(dir); return; }
    if (depth >= 3) return;
    for (const e of entries) if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1);
  };
  walk(root, 0);
  const FEATURES = [
    [/unsupported channel/, 'channel the runtime does not render (manual)'],
    [/mode .* is not a composition/, 'projection mode not in the authoring guide (selectByBinding)'],
    [/cannot select this module/, 'correction module with no machine facts or select condition'],
    [/names the binding its selected modules/, 'composed projection without a mismatch binding'],
    [/invocation|mandatory parameter/, 'PowerShell invocation missing or out of step with the script'],
    [/a support model is JSON|does not parse as JSON/, 'support model that is prose or does not parse'],
    [/no machine condition|\.rules\[\d+\]\.result|\.rules: at least one|\.tiles: a list|\.tiles\[\d+\]: (an id|a label)/, 'readiness tile without machine conditions or vocabulary results'],
    [/\.scenarios/, 'troubleshooting scenario without states, title or list fields'],
    [/Email declares/, 'Email without audience or trigger'],
    [/undeclared binding/, 'undeclared binding'],
    [/unsupported key/, 'unsupported projection key'],
    [/missing block|is a \w+ block|does not declare state/, 'projection names a block that does not fit'],
    [/projected in a mode|corrections need/, 'script projected without a mode'],
    [/prerequisites/, 'prerequisite shape'],
    [/META\.json does not parse|CONTENT\.md|no META\.json/, 'package does not parse'],
  ];
  const featureOf = (e) => (FEATURES.find(([re]) => re.test(e)) ?? [null, 'other'])[1];
  const results = [];
  for (const dir of dirs) {
    const rel = path.relative(root, dir).replaceAll('\\', '/');
    const metaPath = path.join(dir, 'META.json');
    if (!fs.existsSync(metaPath)) { results.push({ package: rel, errors: ['no META.json (a timestamped META file needs its canonical name)'], warnings: [], pin: null }); continue; }
    let meta, blocks;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) { results.push({ package: rel, errors: [`META.json does not parse: ${e.message}`], warnings: [], pin: null }); continue; }
    try { blocks = parseBlocks(fs.readFileSync(path.join(dir, meta.contentFile || 'CONTENT.md'), 'utf8')); } catch (e) { results.push({ package: rel, errors: [`CONTENT.md: ${e.message}`], warnings: [], pin: null }); continue; }
    const pkg = { meta: { ...meta, projection: normalizeProjection(meta, blocks) }, blocks };
    results.push({ package: meta.stepId ?? rel, errors: validatePackage(pkg), warnings: packageWarnings(pkg), pin: meta.baselineAuthority?.pinCommit ?? null });
  }
  const passed = results.filter((r) => r.errors.length === 0);
  const byFeature = {};
  for (const r of results) for (const e of r.errors) {
    const f = featureOf(e);
    byFeature[f] ??= { errors: 0, packages: new Set() };
    byFeature[f].errors += 1;
    byFeature[f].packages.add(r.package);
  }
  console.log(`implementation library: ${results.length} packages · ${passed.length} pass production validation · ${results.length - passed.length} fail`);
  for (const [f, v] of Object.entries(byFeature).sort((a, b) => b[1].packages.size - a[1].packages.size)) console.log(`  ${String(v.packages.size).padStart(3)} packages · ${String(v.errors).padStart(4)} errors · ${f}`);
  const pinned8 = pinned.slice(0, 8);
  const otherPin = results.filter((r) => r.pin && r.pin !== pinned);
  if (otherPin.length > 0) console.log(`  ${otherPin.length} authored against a baseline pin other than ${pinned8} (inactive in this build even when valid): ${otherPin.map((r) => r.package).join(', ')}`);
  console.log(`  passing: ${passed.map((r) => r.package).join(', ') || 'none'}`);
  const jsonAt = args.indexOf('--json');
  if (jsonAt >= 0) fs.writeFileSync(path.resolve(args[jsonAt + 1]), JSON.stringify({ pinned, results, byFeature: Object.fromEntries(Object.entries(byFeature).map(([f, v]) => [f, { errors: v.errors, packages: [...v.packages] }])) }, null, 2) + '\n');
  process.exit(0);
}

const packageDir = path.resolve(args[0]);
const meta = readJson(path.join(packageDir, 'META.json'));
const contentPath = path.join(packageDir, meta.contentFile || 'CONTENT.md');
let blocks;
try { blocks = parseBlocks(fs.readFileSync(contentPath, 'utf8')); }
catch (e) { if (e instanceof PackageError) fail(e.message); throw e; }
const bindingsArg = args.indexOf('--bindings');
const bindingValues = bindingsArg >= 0 ? readJson(path.resolve(args[bindingsArg + 1])) : null;

function lint() {
  const pkg = { meta: { ...meta, projection: normalizeProjection(meta, blocks) }, blocks };
  const errors = validatePackage(pkg);
  if (errors.length > 0) fail(errors.join('\n'));
  for (const w of packageWarnings(pkg)) console.log(`WARN: ${w}`);
  const used = new Set(bindingsUsed(fs.readFileSync(contentPath, 'utf8')));
  if (bindingValues) {
    for (const [id, b] of Object.entries(blocks)) {
      if (b.meta.format !== 'json-template') continue;
      try { JSON.parse(maskJsonTemplate(b.text)); JSON.parse(applyBindings(b.text, bindingValues)); } catch (e) { fail(`${id} bound JSON is invalid: ${e.message}`); }
    }
  }
  const refs = Object.keys(blocks).length;
  const ps = Object.values(blocks).filter(b => b.meta.format === 'powershell');
  const locator = process.platform === 'win32' ? 'where' : 'which';
  let psExe = null;
  for (const candidate of ['pwsh', 'powershell']) {
    const located = spawnSync(locator, [candidate], { encoding: 'utf8' });
    if (located.status === 0) { psExe = candidate; break; }
  }
  let psStatus = 'not available';
  if (psExe && ps.length) {
    for (const b of ps) {
      const temp = path.join(packageDir, `.iamai-${b.meta.id.replace(/[^A-Za-z0-9_.-]/g, '_')}.ps1`);
      fs.writeFileSync(temp, b.text);
      const command = `$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${temp.replace(/'/g, "''")}',[ref]$null,[ref]$e); if($e.Count){$e | % { $_.ToString() }; exit 1}`;
      const r = spawnSync(psExe, ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' });
      fs.rmSync(temp, { force: true });
      if (r.status !== 0) fail(`${b.meta.id} PowerShell AST parse failed:\n${r.stdout}\n${r.stderr}`);
    }
    psStatus = `passed via ${psExe}`;
  }
  console.log(`PASS: ${refs} blocks; ${used.size} bindings used; PowerShell AST ${psStatus}.`);
}

if (args.includes('--list')) {
  for (const [id, b] of Object.entries(blocks)) console.log(`${id}\t${b.meta.channel}\t${b.meta.format}\t${(b.meta.states || []).join(',')}`);
}
if (args.includes('--lint') || (!args.includes('--list') && !args.includes('--extract'))) lint();

const extractAt = args.indexOf('--extract');
if (extractAt >= 0) {
  const id = args[extractAt + 1];
  if (!blocks[id]) fail(`unknown block id: ${id}`);
  let text = blocks[id].text;
  if (bindingValues) text = applyBindings(text, bindingValues);
  const outAt = args.indexOf('--out');
  if (outAt >= 0) fs.writeFileSync(path.resolve(args[outAt + 1]), text);
  else process.stdout.write(text);
}
