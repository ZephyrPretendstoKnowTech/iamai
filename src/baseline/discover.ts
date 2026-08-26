import type { BaselineFile, CaPolicy, LoadReport } from "./types.ts";
import { looksLikePolicy, normalizePolicy } from "./normalize.ts";
import { intentKey } from "./variants.ts";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Folder names (case-insensitive) that hold experiments, never baseline policies. */
const SKIP_SEGMENTS = new Set(["test", "tests", "testing", "scratch"]);

/**
 * Generation = which copy of the baseline a file belongs to. Higher wins.
 * Mirrors the "Updated + fallback" precedence of the analyzer that loads this
 * repo: the newest generation is authoritative; older generations only
 * contribute policies the newest one lacks.
 */
export function precedenceFor(path: string): number {
  const segs = path.split("/").map((s) => s.toLowerCase());
  const dir = segs.slice(0, -1);
  if (dir[0] === "updated") return dir.includes("documentation") ? 20 : 30;
  if (dir.length === 0) return 10;
  if (["policies", "ca", "conditionalaccess", "conditional-access"].includes(dir[0])) return 10;
  return 5;
}

/** Generation number: 30/20 (Updated) collapse to one generation, 10/5 to another. */
function generationOf(precedence: number): number {
  return precedence >= 20 ? 2 : 1;
}

export function shouldSkip(path: string): string | null {
  if (!path.toLowerCase().endsWith(".json")) return "not a .json file";
  const dir = path.split("/").slice(0, -1).map((s) => s.toLowerCase());
  if (dir.some((s) => SKIP_SEGMENTS.has(s))) return "test folder";
  return null;
}

/** Normalized name key: case, whitespace, and dash variants collapsed. */
export function nameKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

/**
 * Family key: the name without its leading tenant/customer tag, so
 * "ACME - GLOBAL - GRANT - MFA - AllUsers" and "IAC - GLOBAL - GRANT - MFA - AllUsers"
 * are recognised as the same policy across generations. The tag must be a
 * single short token (letters/digits) followed by a dash.
 */
export function familyKey(displayName: string): string {
  const key = nameKey(displayName).replace(/\s*\([^)]*\)\s*/g, "").trim();
  const m = key.match(/^([a-z0-9]{1,12})-(.+)$/);
  return m ? m[2] : key;
}

/** Targets nothing: usually an SDK export that dropped conditions it didn't understand. */
export function degenerateReason(p: CaPolicy): string | null {
  const u = p.conditions?.users ?? {};
  const onlyNone = (u.includeUsers ?? []).length === 1 && u.includeUsers![0].toLowerCase() === "none";
  const otherTargets =
    (u.includeGroups?.length ?? 0) + (u.includeRoles?.length ?? 0) > 0 ||
    Boolean(u.includeGuestsOrExternalUsers) ||
    Boolean(p.conditions?.clientApplications?.includeServicePrincipals?.length) ||
    Boolean(p.conditions?.clientApplications?.servicePrincipalFilter?.rule);
  if (onlyNone && !otherTargets) {
    return "targets no users, groups, roles, guests, or service principals — the export probably dropped conditions the exporting SDK did not support (e.g. agent identities); re-export via Graph REST";
  }
  const apps = p.conditions?.applications ?? {};
  const noApps = !(apps.includeApplications?.length || apps.includeUserActions?.length || apps.includeAuthenticationContextClassReferences?.length || apps.applicationFilter?.rule);
  if (noApps && !p.conditions?.clientApplications) return "targets no resources (no apps, user actions, or authentication contexts)";
  return null;
}

interface Candidate {
  policy: CaPolicy;
  path: string;
  precedence: number;
}

function extractPolicies(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed.filter(looksLikePolicy);
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.value)) return o.value.filter(looksLikePolicy); // Graph list envelope
    if (looksLikePolicy(o)) return [o];
  }
  return [];
}

function pickWinner(a: Candidate, b: Candidate): Candidate {
  if (a.precedence !== b.precedence) return a.precedence > b.precedence ? a : b;
  const am = a.policy.modifiedDateTime ?? "";
  const bm = b.policy.modifiedDateTime ?? "";
  if (am !== bm) return am > bm ? a : b;
  return a.path < b.path ? a : b;
}

function dedupeBy(
  cands: Candidate[],
  keyOf: (c: Candidate) => string | null,
  reason: (c: Candidate) => string,
  report: LoadReport,
): { kept: Candidate[]; unkeyed: Candidate[] } {
  const map = new Map<string, Candidate>();
  const unkeyed: Candidate[] = [];
  for (const c of cands) {
    const key = keyOf(c);
    if (!key) {
      unkeyed.push(c);
      continue;
    }
    const prev = map.get(key);
    if (!prev) {
      map.set(key, c);
      continue;
    }
    const winner = pickWinner(prev, c);
    const loser = winner === prev ? c : prev;
    map.set(key, winner);
    report.duplicates.push({ path: loser.path, supersededBy: winner.path, reason: reason(c) });
  }
  return { kept: [...map.values()], unkeyed };
}

export interface DiscoverResult {
  policies: CaPolicy[];
  origins: Record<string, string>;
  report: LoadReport;
}

/**
 * Turn a bag of files into a deduplicated policy list.
 * Never throws on a bad file: every problem lands in `report`.
 */
export function discoverPolicies(files: BaselineFile[]): DiscoverResult {
  const report: LoadReport = { considered: files.length, parsed: 0, skipped: [], errors: [], duplicates: [], warnings: [] };
  const candidates: Candidate[] = [];

  for (const f of files) {
    const skip = shouldSkip(f.path);
    if (skip) {
      report.skipped.push({ path: f.path, reason: skip });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(f.text.replace(/^\uFEFF/, ""));
    } catch (e) {
      report.errors.push({ path: f.path, error: `invalid JSON: ${(e as Error).message}` });
      continue;
    }
    const raws = extractPolicies(parsed);
    if (raws.length === 0) {
      report.skipped.push({ path: f.path, reason: "no Conditional Access policy object found" });
      continue;
    }
    for (const raw of raws) {
      try {
        candidates.push({ policy: normalizePolicy(raw), path: f.path, precedence: precedenceFor(f.path) });
        report.parsed++;
      } catch (e) {
        report.errors.push({ path: f.path, error: (e as Error).message });
      }
    }
  }

  // Pass 1: same policy id (same export, several copies).
  const p1 = dedupeBy(
    candidates,
    (c) => (c.policy.id && GUID.test(c.policy.id) ? c.policy.id.toLowerCase() : null),
    (c) => `same policy id ${c.policy.id}`,
    report,
  );
  // Pass 2: same display name.
  const p2 = dedupeBy(
    [...p1.kept, ...p1.unkeyed],
    (c) => nameKey(c.policy.displayName),
    (c) => `same display name "${c.policy.displayName}"`,
    report,
  );
  // Pass 3: generation fallback — an older generation only contributes a
  // policy the newest generation does not already have, matched first by
  // family (name minus tenant tag and parentheticals), then by intent.
  const all = [...p2.kept, ...p2.unkeyed];
  const newest = all.length ? Math.max(...all.map((c) => generationOf(c.precedence))) : 1;
  const newestByFamily = new Map<string, Candidate>();
  const newestByIntent = new Map<string, Candidate>();
  for (const c of all) {
    if (generationOf(c.precedence) !== newest) continue;
    newestByFamily.set(familyKey(c.policy.displayName), c);
    if (!newestByIntent.has(intentKey(c.policy))) newestByIntent.set(intentKey(c.policy), c);
  }
  const winners: Candidate[] = [];
  for (const c of all) {
    if (generationOf(c.precedence) < newest) {
      const byFamily = newestByFamily.get(familyKey(c.policy.displayName));
      const byIntent = newestByIntent.get(intentKey(c.policy));
      const sup = byFamily ?? byIntent;
      if (sup) {
        const how = byFamily ? "older generation of" : "older generation with the same intent as";
        report.duplicates.push({ path: c.path, supersededBy: sup.path, reason: `${how} "${sup.policy.displayName}"` });
        continue;
      }
    }
    winners.push(c);
  }

  winners.sort((a, b) => a.policy.displayName.localeCompare(b.policy.displayName));
  const origins: Record<string, string> = {};
  for (const w of winners) {
    origins[w.policy.displayName] = w.path;
    const why = degenerateReason(w.policy);
    if (why) report.warnings.push({ policyName: w.policy.displayName, path: w.path, warning: why });
  }
  return { policies: winners.map((w) => w.policy), origins, report };
}
