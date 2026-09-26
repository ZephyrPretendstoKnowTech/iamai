// A fixture whose On MFA policies on All resources leave Microsoft Intune
// Enrollment out, as the baseline's own Require MFA for everyone does. Nothing
// then asks for MFA on the enrollment sign-in, so a sign-in frequency of Every
// time there can loop, and 7.3's session-loop hold stands (roadmap/generate.ts).
// Pure data: it never runs the engine (demo.test.ts A).
import type { Fixture } from './index.ts'

export const INTUNE_ENROLLMENT_APP = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'

type Policy = { state?: unknown; grantControls?: { builtInControls?: unknown; authenticationStrength?: unknown } | null; conditions?: { applications?: { includeApplications?: unknown; excludeApplications?: unknown } } }

/** The fixture with Intune Enrollment left out of every On policy that asks for MFA on All resources; `changed` counts them. */
export function mfaLeavesOutIntune(f: Fixture): { fixture: Fixture; changed: number } {
  const out = structuredClone(f)
  let changed = 0
  for (const p of (out.snapshot.config.caPolicies?.rows ?? []) as Policy[]) {
    const apps = p.conditions?.applications
    const controls = Array.isArray(p.grantControls?.builtInControls) ? p.grantControls.builtInControls : []
    const asks = controls.includes('mfa') || (p.grantControls?.authenticationStrength ?? null) !== null
    const include = Array.isArray(apps?.includeApplications) ? apps.includeApplications : []
    if (p.state !== 'enabled' || !asks || !apps || !include.includes('All')) continue
    apps.excludeApplications = [...(Array.isArray(apps.excludeApplications) ? apps.excludeApplications : []), INTUNE_ENROLLMENT_APP]
    changed++
  }
  return { fixture: out, changed }
}
