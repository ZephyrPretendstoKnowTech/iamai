// Fetches the tenant display name right after sign-in (one read-only call),
// so the header can show it before any scan runs.
import { getGraphToken } from './msal.ts'
import { graphRequest, V1 } from './collect/http.ts'

export async function fetchTenantName(): Promise<string | null> {
  try {
    let token = await getGraphToken()
    const body = await graphRequest(
      {
        get: () => token,
        refresh: async () => {
          token = await getGraphToken()
          return token
        },
      },
      `${V1}/organization?$select=displayName`,
    )
    const org = body.value?.[0] as Record<string, unknown> | undefined
    return typeof org?.displayName === 'string' ? org.displayName : null
  } catch {
    return null
  }
}
