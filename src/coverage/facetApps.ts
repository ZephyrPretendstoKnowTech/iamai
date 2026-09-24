// The single facet table: detection (usage, applicability.ts), ad-hoc
// inference (classify.ts), and the people who signed in to each service
// (derive/evidence.ts serviceSignIns). It lives apart from applicability.ts so
// the collection worker, which folds the sign-in rows, reads it without the
// content file.
import type { Facet } from './applicability.ts'

export const FACET_APPS: Partial<Record<Facet, { ids: string[]; namePattern: RegExp }>> = {
  inforcer: { ids: ['708861da-226e-4d65-a57a-24128df64524'], namePattern: /$^/ },
  avd: { ids: ['9cdead84-a844-4324-93f2-b2e6bb768d07'], namePattern: /virtual desktop|\bavd\b/i },
  copilot: { ids: [], namePattern: /copilot/i },
  azureDevOps: { ids: ['499b84ac-1321-427f-aa17-267ca6975798'], namePattern: /devops/i },
  sharepoint: { ids: ['00000003-0000-0ff1-ce00-000000000000'], namePattern: /sharepoint/i },
  agents: { ids: [], namePattern: /\bagents?\b/i },
  azureManagement: { ids: ['797f4846-ba00-4fd7-ba43-dac1f8f63013'], namePattern: /azure (service management|portal)/i },
}
