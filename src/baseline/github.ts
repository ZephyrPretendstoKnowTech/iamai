import type { BaselineFile } from "./types.ts";

/**
 * A baseline source pinned to a commit. The file list is shipped with the
 * app (or produced by `scripts/build-index.ts`) because listing a repo needs
 * the GitHub API, which is rate-limited to 60 requests/hour per IP when
 * unauthenticated. Raw file fetches have no such limit and allow CORS.
 */
export interface BaselineIndex {
  owner: string;
  repo: string;
  /** Full commit SHA the index was built from. */
  commit: string;
  /** Human label shown in the picker. */
  label: string;
  /** ISO timestamp of index generation. */
  generatedAt: string;
  /** Repo-relative paths of every .json and README.md worth fetching. */
  files: string[];
  /** Optional attribution/licence note shown next to the source. */
  attribution?: string;
  /** About-card fields (SPEC §7): sources without them show "no description provided". */
  author?: string;
  authorUrl?: string;
  repoUrl?: string;
  description?: string;
  goal?: string;
  /** Licence tiers the baseline targets, e.g. ["Entra ID P1", "Entra ID P2"]. */
  tiers?: string[];
}

/** Where every pinned baseline file comes from. Nothing else is fetched. */
const RAW_ORIGIN = "https://raw.githubusercontent.com";

const SHA = /^[0-9a-f]{40}$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
/**
 * One path segment. A denylist, not an allowlist: real baseline repos use
 * en dashes, parentheses and spaces in filenames, and an allowlist narrow
 * enough to feel safe rejected a path in the shipped index the first time this
 * ran. What actually has to be excluded is anything that can act as a
 * separator or a control character — everything else is percent-encoded on the
 * way out and cannot change the shape of the URL.
 */
const UNSAFE_IN_SEGMENT = /[\u0000-\u001f\u007f/\\]/;

export class BaselinePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselinePathError";
  }
}

/**
 * The pinned commit is the only thing that makes fetching third-party policy
 * content defensible, so it has to be enforced rather than assumed.
 *
 * It was not. `encodeURIComponent` leaves `.` untouched, so a `../` segment in
 * an index survived encoding and the URL parser then normalised the owner, the
 * repo and the commit straight out of the path:
 *
 *   .../Jhope188/ConditionalAccessPolicies/ceccdc2a…/../../../attacker/evil/main/x.json
 *   → https://raw.githubusercontent.com/attacker/evil/main/x.json
 *
 * while the About card went on displaying the honest owner, repo and commit as
 * the provenance the operator is asked to trust.
 *
 * Three defences, because any one of them alone is a single edit away from
 * being wrong again: reject the input, build through `new URL` so the
 * normalisation the parser performs is observable, and assert on the *result*
 * that the pinned prefix survived.
 */
export function rawUrl(index: BaselineIndex, path: string): string {
  if (!SHA.test(index.commit)) throw new BaselinePathError(`baseline commit is not a pinned 40-character SHA: ${index.commit}`);
  if (!OWNER.test(index.owner)) throw new BaselinePathError(`baseline owner is not a GitHub owner name: ${index.owner}`);
  if (!REPO.test(index.repo)) throw new BaselinePathError(`baseline repo is not a GitHub repo name: ${index.repo}`);

  // A scheme, a leading slash or a backslash all move the request somewhere
  // else entirely; a backslash is a separator to the URL parser even though it
  // is an ordinary character to `split("/")`.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) throw new BaselinePathError(`baseline path carries a scheme: ${path}`);
  if (path.startsWith("/")) throw new BaselinePathError(`baseline path is absolute: ${path}`);
  if (path.includes("\\")) throw new BaselinePathError(`baseline path contains a backslash: ${path}`);

  const segments = path.split("/");
  for (const seg of segments) {
    // Percent-encoded dot segments (%2e%2e) decode to `..` at the far end, so
    // the check is on the decoded form, and a decode that throws is rejected.
    let decoded: string;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      throw new BaselinePathError(`baseline path segment is not decodable: ${path}`);
    }
    if (decoded === "" || decoded === "." || decoded === "..") throw new BaselinePathError(`baseline path contains a dot segment: ${path}`);
    if (decoded.length > 255) throw new BaselinePathError(`baseline path segment is too long: ${path}`);
    if (UNSAFE_IN_SEGMENT.test(decoded)) throw new BaselinePathError(`baseline path segment carries a separator or control character: ${path}`);
  }

  const prefix = `/${index.owner}/${index.repo}/${index.commit}/`;
  const url = new URL(prefix + segments.map((s) => encodeURIComponent(decodeURIComponent(s))).join("/"), RAW_ORIGIN);
  // The result, not the input. Whatever the parser did to the path, the pinned
  // prefix is still there and the origin is still GitHub raw, or nothing is
  // fetched.
  if (url.origin !== RAW_ORIGIN || !url.pathname.startsWith(prefix)) {
    throw new BaselinePathError(`baseline path escapes the pinned commit: ${path}`);
  }
  return url.href;
}

/**
 * The index that ships with the app is the allowlist. A path the index does not
 * name is not fetched, whoever asks — so a caller that builds a path from
 * anything other than `index.files` cannot reach the network at all.
 */
export function pinnedUrl(index: BaselineIndex, path: string): string {
  if (!index.files.includes(path)) throw new BaselinePathError(`baseline path is not in the pinned index: ${path}`);
  return rawUrl(index, path);
}

export interface FetchOptions {
  /** Injected for tests and non-browser runtimes. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Parallelism for file downloads. */
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Download every indexed file. Failures are returned, not thrown. */
export async function fetchBaselineFiles(
  index: BaselineIndex,
  opts: FetchOptions = {},
): Promise<{ files: BaselineFile[]; failures: { path: string; error: string }[] }> {
  const f = opts.fetchImpl ?? fetch;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const files: BaselineFile[] = [];
  const failures: { path: string; error: string }[] = [];
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < index.files.length) {
      const path = index.files[next++];
      try {
        const res = await f(pinnedUrl(index, path));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        files.push({ path, text: await res.text() });
      } catch (e) {
        failures.push({ path, error: (e as Error).message });
      } finally {
        done++;
        opts.onProgress?.(done, index.files.length);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, failures };
}
