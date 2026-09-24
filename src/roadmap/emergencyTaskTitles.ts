// The Establish Emergency Access tasks' titles (content.json
// app.plan.emergencyTasks.titles). The task builders (ui/surfaces/
// emergencyAccountTasks.ts, emergencyGroupTasks.ts, emergencyPasskeyTasks.ts)
// title their tasks with them, and a Readiness card whose check this scan did
// not settle states its task's title as the work (roadmap/emergencyJourney.ts;
// owner 2026-09-24, net-new 1 and 2): an unread check reads as the work not
// done, never as "Could not verify".
import { app } from '../content/content.ts'

export type EmergencyTaskTitle = 'createAccount' | 'configureAccount' | 'setUpPasskey' | 'createGroup' | 'chooseGroup' | 'manageMembership' | 'policyExclusions' | 'passkeyRegistration' | 'affectedPasskeys' | 'passkeyProtections'

export const EMERGENCY_TASK = (app.plan as unknown as { emergencyTasks: { titles: Record<EmergencyTaskTitle, string> } }).emergencyTasks.titles
