// The scan's developer overrides (SPEC §12, ux-review-06 §34): ?dev=1&licence=free|p1|p2
// simulates a licence profile and ?dev=1&fail=1 forces one 403 and one 429.
// They change what a scan reports, so they exist in dev builds only: on the
// published site the query string is ignored and the tenant is read as it is.
export type ScanOverrides = { licenceOverride?: 'free' | 'p1' | 'p2'; devFail: boolean }

export function devScanOverrides(search: string, devBuild: boolean): ScanOverrides {
  if (!devBuild) return { devFail: false }
  const params = new URLSearchParams(search)
  if (params.get('dev') !== '1') return { devFail: false }
  const licence = params.get('licence')
  const licenceOverride = licence === 'free' || licence === 'p1' || licence === 'p2' ? licence : undefined
  return { ...(licenceOverride ? { licenceOverride } : {}), devFail: params.get('fail') === '1' }
}
