// Observable failures for durable decisions; scan caches may still be optional.
const issues = new Set<string>()
const listeners = new Set<() => void>()
export function reportStorageIssue(tenantId: string, store: string, failed: boolean): void {
  const key = `${tenantId}:${store}`
  if (failed) issues.add(key)
  else issues.delete(key)
  for (const listener of listeners) listener()
}
export function hasStorageIssue(tenantId: string): boolean {
  return [...issues].some((key) => key.startsWith(`${tenantId}:`))
}
export function subscribeStorageIssues(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
