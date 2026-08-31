// Static-rule Housekeeping lines (prompt 48 item 5). Kept apart from
// scenarios.ts so the step evidence copy and the housekeeping copy do not share
// a file. Product voice.
export const STATIC_RULE = {
  blockDependency: (name: string) =>
    `${name} blocks every resource but excludes none of the sign-in dependencies. Registration and enrolment break; exclude those four apps first.`,
  appProtectionManaged: (name: string) => `${name} requires an approved app but does not target unmanaged devices only, so scope it to personal devices.`,
  autopilot: (name: string) => `${name} requires a compliant device over all resources, so new-device enrolment stops. Add the Autopilot carve-out.`,
} as const
