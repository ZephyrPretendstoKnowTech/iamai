// Static-rule Housekeeping lines (prompt 48 item 5). Kept apart from
// scenarios.ts so the step evidence copy and the housekeeping copy do not share
// a file. Product voice.
export const STATIC_RULE = {
  blockDependency: (name: string) =>
    `${name} blocks all resources without excluding the sign-in dependencies (Device Registration Service, Windows Sign In, Intune Enrollment, the Authentication Broker), so registration and enrolment break. Exclude them.`,
  appProtectionManaged: (name: string) => `${name} requires an approved app but does not target unmanaged devices only, so scope it to personal devices.`,
  autopilot: (name: string) => `${name} requires a compliant device over all resources, so new-device enrolment stops. Add the Autopilot carve-out.`,
} as const
