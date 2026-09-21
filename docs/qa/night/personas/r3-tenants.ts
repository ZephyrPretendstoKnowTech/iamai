// ROUND 3 TENANTS. Five shapes, each deliberately different from round 2's, so
// this run exercises paths the last one did not. Every mutation is recorded with
// the reason a real tenant would be in that state.
//
//   round 2            round 3
//   Jordan  ?          midflight  — inherits somebody else's half-done rollout
//   Marcus  small      mid        — mixed licences, service accounts, hybrid
//   Sam     messy      large + security defaults ON — the cutover at scale
//   Nadia   small+SD   getiamai   — eleven accounts, nine that never signed in
//   Priya   large      hostile+   — sources that partly refuse to be read
import { tenant } from './harness.ts'
import type { Tenant } from './harness.ts'

const AAD_P2 = 'eec0eb4f-6444-4f95-aba0-50c24d67f998'
const INTUNE_A = 'c1ec4a95-1f05-45b3-a911-aa3fa01094f5'

/** JORDAN — fast, skips warnings. He did not start this rollout; he took it over.
 *  `midflight` ships tagged policies applied 60 days ago by somebody else, which
 *  is the state an administrator inherits and the one his habits are worst for. */
export const jordanTenant = (): Tenant => tenant('midflight', (t) => {
  // The person who started it left no notes and no emergency accounts chosen.
  t.mapping.breakGlassUserIds = []
  t.mapping.wizardAnswered = { ...t.mapping.wizardAnswered, breakGlass: false, globalExclusion: false }
})

/** MARCUS — follows instructions exactly. `mid`: 280 people, mixed licences, three
 *  service accounts, hybrid join. The licence mixture is what his literal reading
 *  meets first, and round 2 never put him in front of it. */
export const marcusTenant = (): Tenant => tenant('mid', (t) => {
  // Intune bought but barely rolled out: the device decision has a real cost.
  const caps = t.snapshot.capabilities as Record<string, unknown>
  caps.intune = { enabled: true, seats: 300, consumed: 41 }
})

/** SAM — verifies everything. `large` with security defaults ON: 4,900 people and
 *  the cutover still to do. Round 2 gave him a messy tenant with defaults already
 *  off, so he never met the one step where order decides whether anyone gets in. */
export const samTenant = (): Tenant => tenant('large', (t) => {
  const sd = t.snapshot.config.securityDefaults
  if (sd) (sd.rows as Record<string, unknown>[])[0] = { isEnabled: true }
  // Security defaults and Conditional Access do not run together, so a tenant
  // with defaults on has no policies of its own.
  const ca = t.snapshot.config.caPolicies
  if (ca) (ca as { rows?: unknown[] }).rows = []
})

/** NADIA — careful, learning. `getiamai`: eleven accounts, nine of which have never
 *  signed in. The smallest real shape there is, and every count she reads is a
 *  number she can check by hand — which is where a wrong one shows. */
export const nadiaTenant = (): Tenant => tenant('getiamai', (t) => {
  // She bought Business Premium for the MFA, so Intune is there and unused.
  const caps = t.snapshot.capabilities as Record<string, unknown>
  caps.intune = { enabled: true, seats: 11, consumed: 0 }
})

/** PRIYA — expert, fast, sceptical. `hostile` with P2: several sources refuse to be
 *  read. An expert goes straight at what the tool claims when it cannot see, which
 *  is the half of the product a cooperative tenant never exercises. */
export const priyaTenant = (): Tenant => tenant('hostile', (t) => {
  const users = t.snapshot.users.length
  const caps = t.snapshot.capabilities as Record<string, unknown>
  caps.entraP2 = { enabled: true, seats: users + 10, consumed: users }
  caps.intune = { enabled: true, seats: users + 10, consumed: Math.floor(users / 3) }
  const skus = t.snapshot.config.subscribedSkus as { rows?: unknown[] } | undefined
  if (skus && Array.isArray(skus.rows)) skus.rows = [...skus.rows, {
    skuId: 'sku-e5', skuPartNumber: 'SPE_E5',
    prepaidUnits: { enabled: users + 10 }, consumedUnits: users, capabilityStatus: 'Enabled',
    servicePlans: [
      { servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2', provisioningStatus: 'Success' },
      { servicePlanId: INTUNE_A, servicePlanName: 'INTUNE_A', provisioningStatus: 'Success' },
    ],
  }]
})

export const R3 = [
  { who: 'Jordan', build: jordanTenant, habit: 'fast, skips warnings' },
  { who: 'Marcus', build: marcusTenant, habit: 'follows instructions exactly' },
  { who: 'Sam', build: samTenant, habit: 'verifies everything' },
  { who: 'Nadia', build: nadiaTenant, habit: 'careful, learning' },
  { who: 'Priya', build: priyaTenant, habit: 'expert, sceptical' },
] as const
