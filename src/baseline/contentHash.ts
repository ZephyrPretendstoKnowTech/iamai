import type { BaselineFile } from './types.ts'

/** Exact file contents and paths, independent of the upload order. */
export async function baselineContentHash(files: readonly BaselineFile[]): Promise<string> {
  const entries = files.map(({ path, text }) => [path, text]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(entries)))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
