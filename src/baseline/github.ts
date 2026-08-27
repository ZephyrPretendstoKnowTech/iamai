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

export function rawUrl(index: BaselineIndex, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${index.owner}/${index.repo}/${index.commit}/${encoded}`;
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
        const res = await f(rawUrl(index, path));
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
