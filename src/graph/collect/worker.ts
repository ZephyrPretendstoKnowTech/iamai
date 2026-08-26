// Collection worker (docs/design/collection.md §5). Receives a token from the
// main thread, runs Lane 0 + Lane A at concurrency 4, posts section events and
// the final TenantSnapshot. Requests a fresh token on 401 and never talks to
// MSAL directly. Lane B (sign-in evidence) is not implemented yet — its source
// reports 'pending'.
import { redactIdentifiers } from '../../redact.ts'
import {
  deriveTenantCapabilities,
  emptyCapabilities,
  simulatedCapabilities,
} from '../../licensing/capabilities.ts'
import type { LicenceProfile } from '../../licensing/capabilities.ts'
import { COLLECTOR_REGISTRY } from './registry.ts'
import { EVIDENCE_WINDOW_DAYS, LANE_A_CONCURRENCY } from './constants.ts'
import { collectSignInEvidence } from './laneB.ts'
import {
  CONFIG_KEYS,
  collectAppSignInSummary,
  collectConfigSection,
  collectDevices,
  collectMethodsForUsers,
  collectRegistrationDetails,
  collectSpActivity,
  collectUsers,
  deriveRoles,
  isMicrosoftManagedPolicy,
} from './collectors.ts'
import type { Ctx } from './collectors.ts'
import { SectionDisabledError } from './http.ts'
import type {
  ConfigSection,
  ConfigSectionKey,
  MethodsByUser,
  SourceKey,
  SourceState,
  TenantSnapshot,
  WorkerInMessage,
  WorkerOutMessage,
} from './types.ts'

const ctx = self as unknown as {
  postMessage(m: WorkerOutMessage): void
  onmessage: ((e: MessageEvent<WorkerInMessage>) => void) | null
}

// Every reason string passes redaction before leaving the worker
// (docs/design/diagnostics.md) — Graph error messages can carry UPNs.
const post = (m: WorkerOutMessage) => {
  if (m.type === 'section' && m.reason) {
    ctx.postMessage({ ...m, reason: redactIdentifiers(m.reason) })
    return
  }
  ctx.postMessage(m)
}

let currentToken = ''
let tokenWaiter: ((t: string) => void) | null = null
const laneAbort = new AbortController()

const tokens = {
  get: () => currentToken,
  refresh: (): Promise<string> => {
    post({ type: 'token-needed' })
    return new Promise((resolve) => {
      tokenWaiter = (t) => {
        currentToken = t
        resolve(t)
      }
    })
  },
}

async function pool(limit: number, tasks: (() => Promise<void>)[]): Promise<void> {
  const queue = [...tasks]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  })
  await Promise.all(workers)
}

function sourceState(status: SourceState['status'], reason: string | null = null): SourceState {
  return {
    status,
    coveredWindow: null,
    reason: reason === null ? null : redactIdentifiers(reason),
    asOf: new Date().toISOString(),
  }
}

async function run(tenantId: string, licenceOverride?: LicenceProfile): Promise<void> {
  const runCtx: Ctx = { tokens, signal: laneAbort.signal }
  const config = {} as Record<ConfigSectionKey, ConfigSection>
  const snapshot: TenantSnapshot = {
    schemaVersion: 1,
    tenantId,
    asOf: '',
    sources: {
      config: sourceState('pending'),
      registrationDetails: sourceState('pending'),
      users: sourceState('pending'),
      devices: sourceState('pending'),
      spActivity: sourceState('pending'),
      authMethods: sourceState('pending'),
      appSignInSummary: sourceState('pending'),
      signInEvidence: sourceState('pending'),
    },
    config,
    registrationDetails: [],
    users: [],
    devices: [],
    spActivity: [],
    authMethods: {},
    appSignInSummary: [],
    signInEvidence: {},
    evidencePolicyResults: [],
    blockedToday: [],
    capabilities: emptyCapabilities(),
    microsoftManagedPolicyIds: [],
    roles: { active: {}, eligible: {} },
  }

  const section = async <T>(
    source: SourceKey,
    work: () => Promise<T>,
    apply: (result: T) => number,
  ): Promise<void> => {
    post({ type: 'section', source, status: 'started' })
    const t0 = performance.now()
    try {
      const rows = apply(await work())
      snapshot.sources[source] = sourceState('ok')
      post({ type: 'section', source, status: 'ok', rows, ms: Math.round(performance.now() - t0) })
    } catch (e) {
      const disabled = e instanceof SectionDisabledError
      const reason = e instanceof Error ? e.message : String(e)
      snapshot.sources[source] = sourceState(disabled ? 'disabled' : 'error', reason)
      post({
        type: 'section',
        source,
        status: disabled ? 'disabled' : 'error',
        reason,
        ms: Math.round(performance.now() - t0),
      })
    }
  }

  // A5 accumulates as A2 pages stream through it.
  const methods: MethodsByUser = {}
  let methodsFailure: string | null = null

  const runConfigTask = async (key: ConfigSectionKey): Promise<void> => {
    post({ type: 'section', source: `config:${key}`, status: 'started' })
    const t0 = performance.now()
    const result = await collectConfigSection(runCtx, key)
    config[key] = result
    post({
      type: 'section',
      source: `config:${key}`,
      status: result.status === 'ok' ? 'ok' : result.status,
      rows: result.rows.length,
      reason: result.reason ?? undefined,
      ms: Math.round(performance.now() - t0),
    })
  }

  // Licence first (SPEC §12): capabilities gate licence-dependent sections,
  // which report "not available on this licence" before calling and continue.
  await runConfigTask('subscribedSkus')
  const caps = licenceOverride
    ? simulatedCapabilities(licenceOverride)
    : deriveTenantCapabilities(config.subscribedSkus?.rows ?? [])
  snapshot.capabilities = caps

  const CAP_LABEL: Record<string, string> = { entraP1: 'Entra ID P1', entraP2: 'Entra ID P2' }
  const missingCapability = (key: ConfigSectionKey): string | null => {
    const rc = COLLECTOR_REGISTRY.find((s) => s.configKey === key)?.requiredCapability
    if (rc && !caps[rc].enabled) return CAP_LABEL[rc] ?? rc
    return null
  }

  const lane0Tasks = CONFIG_KEYS.filter((k) => k !== 'subscribedSkus').map((key) => async () => {
    const missing = missingCapability(key)
    if (missing) {
      config[key] = { status: 'disabled', reason: `not available on this licence (needs ${missing})`, rows: [] }
      post({ type: 'section', source: `config:${key}`, status: 'disabled', reason: config[key].reason ?? undefined })
      return
    }
    await runConfigTask(key)
  })

  const laneATasks: (() => Promise<void>)[] = [
    () =>
      caps.entraP1.enabled
        ? section('registrationDetails', () => collectRegistrationDetails(runCtx), (rows) => {
            snapshot.registrationDetails = rows
            return rows.length
          })
        : Promise.resolve().then(() => {
            snapshot.sources.registrationDetails = sourceState(
              'disabled',
              'not available on this licence (needs Entra ID P1)',
            )
            post({
              type: 'section',
              source: 'registrationDetails',
              status: 'disabled',
              reason: snapshot.sources.registrationDetails.reason ?? undefined,
            })
          }),
    () =>
      section(
        'users',
        () =>
          collectUsers(
            runCtx,
            async (page) => {
              try {
                Object.assign(methods, await collectMethodsForUsers(runCtx, page.map((u) => u.id)))
              } catch (e) {
                methodsFailure = e instanceof Error ? e.message : String(e)
              }
            },
            { includeSignInActivity: caps.entraP1.enabled },
          ),
        ({ users, partialReason }) => {
          snapshot.users = users
          if (partialReason) snapshot.sources.users = sourceState('partial', partialReason)
          return users.length
        },
      ),
    () =>
      section('devices', () => collectDevices(runCtx), (rows) => {
        snapshot.devices = rows
        return rows.length
      }),
    () =>
      section('spActivity', () => collectSpActivity(runCtx), (rows) => {
        snapshot.spActivity = rows
        return rows.length
      }),
    () =>
      section('appSignInSummary', () => collectAppSignInSummary(runCtx), (rows) => {
        snapshot.appSignInSummary = rows
        return rows.length
      }),
  ]

  const finishAggregates = (): void => {
    snapshot.microsoftManagedPolicyIds = (config.caPolicies?.rows ?? [])
      .filter(isMicrosoftManagedPolicy)
      .map((p) => String((p as Record<string, unknown>).id ?? ''))
      .filter(Boolean)
    snapshot.roles = deriveRoles(config.roleAssignments?.rows ?? [], config.pimEligibility?.rows ?? [])

    const states = CONFIG_KEYS.map((k) => config[k]?.status ?? 'error')
    snapshot.sources.config = states.every((s) => s === 'ok')
      ? sourceState('ok')
      : states.every((s) => s !== 'ok')
        ? sourceState('error', 'every config read failed')
        : sourceState('partial', 'some config reads unavailable')

    snapshot.authMethods = methods
    const unknownCount = Object.values(methods).filter((m) => m === 'unknown').length
    snapshot.sources.authMethods = methodsFailure
      ? sourceState('partial', `some method batches failed: ${methodsFailure}`)
      : unknownCount > 0
        ? sourceState('partial', `${unknownCount} users' methods unavailable`)
        : sourceState('ok')
    post({
      type: 'section',
      source: 'authMethods',
      status: snapshot.sources.authMethods.status,
      rows: Object.keys(methods).length,
      reason: snapshot.sources.authMethods.reason ?? undefined,
    })
  }

  // Lane B runs alongside Lanes 0/A: strictly serialized internally
  // (concurrency 1), independent of the aggregate pool. Licence-gated on P1.
  if (!caps.entraP1.enabled) {
    snapshot.sources.signInEvidence = sourceState('disabled', 'not available on this licence (needs Entra ID P1)')
    post({
      type: 'section',
      source: 'signInEvidence',
      status: 'disabled',
      reason: snapshot.sources.signInEvidence.reason ?? undefined,
    })
    await pool(LANE_A_CONCURRENCY, [...lane0Tasks, ...laneATasks])
    finishAggregates()
    snapshot.asOf = new Date().toISOString()
    post({ type: 'state', value: 'done' })
    post({ type: 'snapshot', snapshot })
    return
  }
  post({ type: 'section', source: 'signInEvidence', status: 'started' })
  const laneB = collectSignInEvidence(runCtx, {
    tenantId,
    windowDays: EVIDENCE_WINDOW_DAYS,
    onPage: (p) => post({ type: 'signin-page', ...p }),
    onSlow: () => post({ type: 'state', value: 'slow' }),
  }).then((evidence) => {
    snapshot.signInEvidence = evidence.perUser
    snapshot.evidencePolicyResults = evidence.policyResults
    snapshot.blockedToday = evidence.blockedToday
    snapshot.sources.signInEvidence = {
      status: evidence.status,
      coveredWindow: evidence.covered,
      reason: evidence.reason === null ? null : redactIdentifiers(evidence.reason),
      asOf: new Date().toISOString(),
    }
    post({
      type: 'section',
      source: 'signInEvidence',
      status: evidence.status,
      rows: evidence.rows,
      reason: evidence.reason ?? undefined,
    })
  })

  await pool(LANE_A_CONCURRENCY, [...lane0Tasks, ...laneATasks])
  await laneB
  post({ type: 'state', value: 'done' })
  finishAggregates()

  snapshot.asOf = new Date().toISOString()
  post({ type: 'snapshot', snapshot })
}

ctx.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  if (msg.type === 'start') {
    currentToken = msg.token
    void run(msg.tenantId, msg.licenceOverride).catch((err: unknown) =>
      post({ type: 'fatal', message: err instanceof Error ? err.message : String(err) }),
    )
  } else if (msg.type === 'token') {
    tokenWaiter?.(msg.token)
    tokenWaiter = null
  } else if (msg.type === 'cancel') {
    laneAbort.abort()
  }
}
