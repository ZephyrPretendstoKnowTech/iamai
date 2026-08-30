// Spike 1 (SPEC.md §9): sign-in log pull from the browser — page size, $select
// support, filter operators, throttling, wall-clock. Dev-only harness; results
// are logged to the console and stored on window.__spike1.
import { getGraphToken } from '../msal.ts'

const V1 = 'https://graph.microsoft.com/v1.0'
const BETA = 'https://graph.microsoft.com/beta'
const SIGNINS = `${V1}/auditLogs/signIns`
const BETA_SIGNINS = `${BETA}/auditLogs/signIns`

export type Probe = {
  label: string
  url: string
  status: number
  ms: number
  itemCount?: number
  hasNextLink?: boolean
  firstItemKeys?: string[]
  retryAfter?: string
  requestId?: string
  errorCode?: string
  errorMessage?: string
}

export type Spike1Results = {
  startedAt: string
  probes: Probe[]
  paging: {
    filter: string
    pages: { ms: number; itemCount: number; status: number; retryAfter?: string }[]
    totalItems: number
    totalMs: number
    stoppedBecause: string
  } | null
  finishedAt: string
}

async function probe(label: string, token: string, url: string): Promise<Probe> {
  const t0 = performance.now()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const ms = Math.round(performance.now() - t0)
  const out: Probe = {
    label,
    url: url.replace(V1, '').replace(BETA, '/beta:'),
    status: res.status,
    ms,
    retryAfter: res.headers.get('Retry-After') ?? undefined,
    requestId: res.headers.get('request-id') ?? undefined,
  }
  try {
    const body = await res.json()
    if (Array.isArray(body.value)) {
      out.itemCount = body.value.length
      out.hasNextLink = '@odata.nextLink' in body
      if (body.value[0]) out.firstItemKeys = Object.keys(body.value[0])
    }
    if (body.error) {
      out.errorCode = body.error.code
      out.errorMessage = String(body.error.message).slice(0, 300)
    }
  } catch {
    out.errorMessage = 'non-JSON response body'
  }
  return out
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export async function runSpike1(): Promise<Spike1Results> {
  const token = await getGraphToken()
  const probes: Probe[] = []
  const results: Spike1Results = {
    startedAt: new Date().toISOString(),
    probes,
    paging: null,
    finishedAt: '',
  }
  const run = async (label: string, url: string) => {
    const p = await probe(label, token, url)
    probes.push(p)
    console.log('[spike1]', label, `status=${p.status}`, `ms=${p.ms}`, `items=${p.itemCount ?? '-'}`)
    return p
  }

  const ge7d = `createdDateTime ge ${isoDaysAgo(7)}`

  // Access + default page size (no $top).
  const first = await run('default page (no $top)', SIGNINS)

  // $top limits.
  for (const top of [50, 100, 500, 999, 1000]) {
    await run(`$top=${top}`, `${SIGNINS}?$top=${top}`)
  }

  // $select — compare firstItemKeys against the requested set to see if it is honored.
  await run(
    '$select subset',
    `${SIGNINS}?$select=id,createdDateTime,userPrincipalName,userId,appId,appDisplayName,ipAddress,clientAppUsed,conditionalAccessStatus,status&$top=5`,
  )

  // Filter operators — SPEC §4 expects eq/ge/le/startswith to work and negation to fail.
  await run('filter ge (7d)', `${SIGNINS}?$filter=${encodeURIComponent(ge7d)}&$top=5`)
  await run(
    'filter ge+le range',
    `${SIGNINS}?$filter=${encodeURIComponent(`${ge7d} and createdDateTime le ${isoDaysAgo(1)}`)}&$top=5`,
  )
  await run(
    'filter startswith',
    `${SIGNINS}?$filter=${encodeURIComponent("startswith(userPrincipalName,'a')")}&$top=5`,
  )
  await run(
    'filter status/errorCode eq',
    `${SIGNINS}?$filter=${encodeURIComponent('status/errorCode eq 0')}&$top=5`,
  )
  await run(
    'filter conditionalAccessStatus eq',
    `${SIGNINS}?$filter=${encodeURIComponent("conditionalAccessStatus eq 'success'")}&$top=5`,
  )
  await run('filter ne (expect 400)', `${SIGNINS}?$filter=${encodeURIComponent("clientAppUsed ne 'Browser'")}&$top=5`)
  await run(
    'filter not startswith (expect 400)',
    `${SIGNINS}?$filter=${encodeURIComponent("not startswith(userPrincipalName,'a')")}&$top=5`,
  )
  if (first.status !== 200) {
    results.finishedAt = new Date().toISOString()
    console.log('[spike1] RESULTS (no access — skipping paging)', JSON.stringify(results, null, 2))
    ;(window as { __spike1?: Spike1Results }).__spike1 = results
    return results
  }

  // Wall-clock: page through the last 7 days, cap at 10 pages or 90 s.
  const pagingFilter = `${SIGNINS}?$filter=${encodeURIComponent(ge7d)}&$top=999`
  const pages: { ms: number; itemCount: number; status: number; retryAfter?: string }[] = []
  let next: string | null = pagingFilter
  let totalItems = 0
  let stoppedBecause = 'exhausted (no nextLink)'
  const wallStart = performance.now()
  while (next) {
    if (pages.length >= 10) {
      stoppedBecause = 'page cap (10)'
      break
    }
    if (performance.now() - wallStart > 90_000) {
      stoppedBecause = 'time cap (90s)'
      break
    }
    const t0 = performance.now()
    const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
    const ms = Math.round(performance.now() - t0)
    const retryAfter = res.headers.get('Retry-After') ?? undefined
    if (res.status === 429) {
      pages.push({ ms, itemCount: 0, status: 429, retryAfter })
      console.log('[spike1] paging: 429, Retry-After =', retryAfter)
      await new Promise((r) => setTimeout(r, (Number(retryAfter) || 5) * 1000))
      continue
    }
    const body: { value?: unknown[]; '@odata.nextLink'?: string } = await res.json()
    const count = Array.isArray(body.value) ? body.value.length : 0
    totalItems += count
    pages.push({ ms, itemCount: count, status: res.status })
    console.log(`[spike1] page ${pages.length}: ${count} items in ${ms} ms`)
    if (res.status !== 200) {
      stoppedBecause = `error ${res.status}`
      break
    }
    next = body['@odata.nextLink'] ?? null
  }
  results.paging = {
    filter: ge7d,
    pages,
    totalItems,
    totalMs: Math.round(performance.now() - wallStart),
    stoppedBecause,
  }

  results.finishedAt = new Date().toISOString()
  console.log('[spike1] RESULTS', JSON.stringify(results, null, 2))
  ;(window as { __spike1?: Spike1Results }).__spike1 = results
  await saveDevResults('spike1', results)
  return results
}

import { redactIdentifiers } from '../../redact.ts'
export { redactIdentifiers }

// saveDevResults moved to src/devSave.ts. Importing it from here was the
// single static edge that pulled this whole file into the production bundle
// (audit egress-04); re-exported so the other spike modules keep their import.
import { saveDevResults } from '../../devSave.ts'
export { saveDevResults }

type PageStat = { ms: number; itemCount: number; status: number; retryAfter?: string }

export type Spike1RetestResults = {
  startedAt: string
  probes: Probe[]
  paging: {
    startUrl: string
    pages: PageStat[]
    totalItems: number
    totalMs: number
    stoppedBecause: string
  } | null
  finishedAt: string
}

// Retest set (2026-08-26): interactive-only via signInEventTypes/any on v1.0,
// combined with the date window, wide $select, and $top 50/100/200.
export async function runSpike1Retest(): Promise<Spike1RetestResults> {
  const token = await getGraphToken()
  const probes: Probe[] = []
  const results: Spike1RetestResults = {
    startedAt: new Date().toISOString(),
    probes,
    paging: null,
    finishedAt: '',
  }
  const run = async (label: string, url: string) => {
    const p = await probe(label, token, url)
    probes.push(p)
    console.log('[spike1-retest]', label, `status=${p.status}`, `ms=${p.ms}`, `items=${p.itemCount ?? '-'}`)
    return p
  }

  const ge7d = `createdDateTime ge ${isoDaysAgo(7)}`
  const interactive = "signInEventTypes/any(t: t eq 'interactiveUser')"
  const both = `${ge7d} and ${interactive}`
  const select =
    'id,createdDateTime,userId,userPrincipalName,appId,appDisplayName,clientAppUsed,conditionalAccessStatus,appliedConditionalAccessPolicies,status,deviceDetail,location,authenticationRequirement,resourceId'
  const bothSelect = `${SIGNINS}?$filter=${encodeURIComponent(both)}&$select=${select}`

  await run('1: createdDateTime ge 7d, $top=50', `${SIGNINS}?$filter=${encodeURIComponent(ge7d)}&$top=50`)
  await run('2: signInEventTypes any interactiveUser, $top=50', `${SIGNINS}?$filter=${encodeURIComponent(interactive)}&$top=50`)
  await run('3: both filters, $top=50', `${SIGNINS}?$filter=${encodeURIComponent(both)}&$top=50`)
  await run('4: both filters + $select, $top=50', `${bothSelect}&$top=50`)
  await run('5a: both filters + $select, $top=100', `${bothSelect}&$top=100`)
  const start = await run('5b: both filters + $select, $top=200', `${bothSelect}&$top=200`)

  // 6: fetch the 5b query again and follow @odata.nextLink for 3 pages.
  if (start.status === 200) {
    const startUrl = `${bothSelect}&$top=200`
    const pages: PageStat[] = []
    let next: string | null = startUrl
    let totalItems = 0
    let stoppedBecause = 'exhausted (no nextLink)'
    const wallStart = performance.now()
    while (next) {
      if (pages.length >= 4) {
        stoppedBecause = 'followed 3 nextLinks (cap)'
        break
      }
      const t0 = performance.now()
      const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
      const ms = Math.round(performance.now() - t0)
      const retryAfter = res.headers.get('Retry-After') ?? undefined
      if (res.status === 429) {
        pages.push({ ms, itemCount: 0, status: 429, retryAfter })
        console.log('[spike1-retest] paging: 429, Retry-After =', retryAfter)
        await new Promise((r) => setTimeout(r, (Number(retryAfter) || 5) * 1000))
        continue
      }
      const body: { value?: unknown[]; '@odata.nextLink'?: string } = await res.json()
      const count = Array.isArray(body.value) ? body.value.length : 0
      totalItems += count
      pages.push({ ms, itemCount: count, status: res.status })
      console.log(`[spike1-retest] page ${pages.length}: ${count} items in ${ms} ms`)
      if (res.status !== 200) {
        stoppedBecause = `error ${res.status}`
        break
      }
      next = body['@odata.nextLink'] ?? null
    }
    results.paging = {
      startUrl: startUrl.replace(V1, ''),
      pages,
      totalItems,
      totalMs: Math.round(performance.now() - wallStart),
      stoppedBecause,
    }
  }

  results.finishedAt = new Date().toISOString()
  console.log('[spike1-retest] RESULTS', JSON.stringify(results, null, 2))
  ;(window as { __spike1Retest?: Spike1RetestResults }).__spike1Retest = results
  await saveDevResults('spike1-retest', results)
  return results
}

// Follow-up to the retest: v1.0 with a valid $select (the retest showed
// signInEventTypes and authenticationRequirement do not exist on v1.0), the
// same beta queries where they should, and the 3-page nextLink follow.
export async function runSpike1Followup(): Promise<Spike1RetestResults> {
  const token = await getGraphToken()
  const probes: Probe[] = []
  const results: Spike1RetestResults = {
    startedAt: new Date().toISOString(),
    probes,
    paging: null,
    finishedAt: '',
  }
  const run = async (label: string, url: string) => {
    const p = await probe(label, token, url)
    probes.push(p)
    console.log('[spike1-followup]', label, `status=${p.status}`, `ms=${p.ms}`, `items=${p.itemCount ?? '-'}`)
    return p
  }

  const ge7d = `createdDateTime ge ${isoDaysAgo(7)}`
  const interactive = "signInEventTypes/any(t: t eq 'interactiveUser')"
  const both = `${ge7d} and ${interactive}`
  const fullSelect =
    'id,createdDateTime,userId,userPrincipalName,appId,appDisplayName,clientAppUsed,conditionalAccessStatus,appliedConditionalAccessPolicies,status,deviceDetail,location,authenticationRequirement,resourceId'
  const v1Select = fullSelect.replace(',authenticationRequirement', '')
  const v1Base = `${SIGNINS}?$filter=${encodeURIComponent(ge7d)}&$select=${v1Select}`
  const betaBase = `${BETA_SIGNINS}?$filter=${encodeURIComponent(both)}&$select=${fullSelect}`

  await run('A: v1 ge7d only, $top=50 (latency re-check)', `${SIGNINS}?$filter=${encodeURIComponent(ge7d)}&$top=50`)
  await run('B1: v1 ge7d + v1-valid $select, $top=50', `${v1Base}&$top=50`)
  await run('B2: v1 ge7d + v1-valid $select, $top=100', `${v1Base}&$top=100`)
  const v1Big = await run('B3: v1 ge7d + v1-valid $select, $top=200', `${v1Base}&$top=200`)
  await run('C1: beta interactiveUser lambda, $top=50', `${BETA_SIGNINS}?$filter=${encodeURIComponent(interactive)}&$top=50`)
  const beta = await run('C2: beta both filters + full $select, $top=50', `${betaBase}&$top=50`)

  // Paging: prefer the beta query (the retest's intended case 6); fall back to v1.0.
  const startUrl = beta.status === 200 ? `${betaBase}&$top=200` : v1Big.status === 200 ? `${v1Base}&$top=200` : null
  if (startUrl) {
    const pages: PageStat[] = []
    let next: string | null = startUrl
    let totalItems = 0
    let stoppedBecause = 'exhausted (no nextLink)'
    const wallStart = performance.now()
    while (next) {
      if (pages.length >= 4) {
        stoppedBecause = 'followed 3 nextLinks (cap)'
        break
      }
      const t0 = performance.now()
      const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
      const ms = Math.round(performance.now() - t0)
      const retryAfter = res.headers.get('Retry-After') ?? undefined
      if (res.status === 429) {
        pages.push({ ms, itemCount: 0, status: 429, retryAfter })
        await new Promise((r) => setTimeout(r, (Number(retryAfter) || 5) * 1000))
        continue
      }
      const body: { value?: unknown[]; '@odata.nextLink'?: string } = await res.json()
      const count = Array.isArray(body.value) ? body.value.length : 0
      totalItems += count
      pages.push({ ms, itemCount: count, status: res.status })
      console.log(`[spike1-followup] page ${pages.length}: ${count} items in ${ms} ms`)
      if (res.status !== 200) {
        stoppedBecause = `error ${res.status}`
        break
      }
      next = body['@odata.nextLink'] ?? null
    }
    results.paging = {
      startUrl: startUrl.replace(V1, '').replace(BETA, '/beta:'),
      pages,
      totalItems,
      totalMs: Math.round(performance.now() - wallStart),
      stoppedBecause,
    }
  }

  results.finishedAt = new Date().toISOString()
  console.log('[spike1-followup] RESULTS', JSON.stringify(results, null, 2))
  ;(window as { __spike1Followup?: Spike1RetestResults }).__spike1Followup = results
  await saveDevResults('spike1-followup', results)
  return results
}

export type PagingRun = {
  name: string
  startUrl: string
  pages: (PageStat & { oldestCreatedDateTime?: string })[]
  totalItems: number
  totalMs: number
  stoppedBecause: string
}

export type Spike1PagingResults = {
  startedAt: string
  runs: PagingRun[]
  finishedAt: string
}

async function followPages(token: string, name: string, startUrl: string): Promise<PagingRun> {
  const pages: PagingRun['pages'] = []
  let next: string | null = startUrl
  let totalItems = 0
  let stoppedBecause = 'exhausted (no nextLink)'
  const wallStart = performance.now()
  while (next) {
    if (pages.length >= 4) {
      stoppedBecause = 'followed 3 nextLinks (cap)'
      break
    }
    const t0 = performance.now()
    const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } })
    const ms = Math.round(performance.now() - t0)
    const retryAfter = res.headers.get('Retry-After') ?? undefined
    if (res.status === 429) {
      pages.push({ ms, itemCount: 0, status: 429, retryAfter })
      console.log(`[spike1-paging] ${name}: 429, Retry-After =`, retryAfter)
      await new Promise((r) => setTimeout(r, (Number(retryAfter) || 5) * 1000))
      continue
    }
    const body: { value?: { createdDateTime?: string }[]; '@odata.nextLink'?: string } = await res.json()
    const items = Array.isArray(body.value) ? body.value : []
    totalItems += items.length
    pages.push({
      ms,
      itemCount: items.length,
      status: res.status,
      oldestCreatedDateTime: items.at(-1)?.createdDateTime,
    })
    console.log(`[spike1-paging] ${name} page ${pages.length}: ${items.length} items in ${ms} ms`)
    if (res.status !== 200) {
      stoppedBecause = `error ${res.status}`
      break
    }
    next = body['@odata.nextLink'] ?? null
  }
  return {
    name,
    startUrl: startUrl.replace(V1, '').replace(BETA, '/beta:'),
    pages,
    totalItems,
    totalMs: Math.round(performance.now() - wallStart),
    stoppedBecause,
  }
}

// Paging test: every date-filtered query in the follow-up 429/504'd while the
// unfiltered beta query answered in 12 s, so page newest-first with NO
// createdDateTime filter and record each page's oldest timestamp to prove a
// client-side window cutoff works.
export async function runSpike1Paging(): Promise<Spike1PagingResults> {
  const token = await getGraphToken()
  const results: Spike1PagingResults = { startedAt: new Date().toISOString(), runs: [], finishedAt: '' }
  const interactive = "signInEventTypes/any(t: t eq 'interactiveUser')"
  const fullSelect =
    'id,createdDateTime,userId,userPrincipalName,appId,appDisplayName,clientAppUsed,conditionalAccessStatus,appliedConditionalAccessPolicies,status,deviceDetail,location,authenticationRequirement,resourceId'

  results.runs.push(await followPages(token, 'v1 no filter, $top=200', `${SIGNINS}?$top=200`))
  results.runs.push(
    await followPages(
      token,
      'beta interactiveUser + full $select, $top=200',
      `${BETA_SIGNINS}?$filter=${encodeURIComponent(interactive)}&$select=${fullSelect}&$top=200`,
    ),
  )

  results.finishedAt = new Date().toISOString()
  console.log('[spike1-paging] RESULTS', JSON.stringify(results, null, 2))
  ;(window as { __spike1Paging?: Spike1PagingResults }).__spike1Paging = results
  await saveDevResults('spike1-paging', results)
  return results
}

declare global {
  interface Window {
    __runSpike1?: typeof runSpike1
    __runSpike1Retest?: typeof runSpike1Retest
    __runSpike1Followup?: typeof runSpike1Followup
    __runSpike1Paging?: typeof runSpike1Paging
  }
}

if (import.meta.env.DEV) {
  window.__runSpike1 = runSpike1
  window.__runSpike1Retest = runSpike1Retest
  window.__runSpike1Followup = runSpike1Followup
  window.__runSpike1Paging = runSpike1Paging
}
