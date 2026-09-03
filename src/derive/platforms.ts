// Phones and computers, by platform (E2): the one rule the sign-in derivations
// (the worker), the device readiness measure and the policy deviations share.
// Pure constants, so the worker bundle carries no content.

/** Graph's platform tokens for phones and for computers (a Conditional Access platforms condition). */
export const PHONE_PLATFORMS = ['android', 'iOS'] as const
export const COMPUTER_PLATFORMS = ['windows', 'macOS', 'linux'] as const

/** True when a device's or a sign-in's operating system is a phone's. */
export function isPhoneOs(os: string | null | undefined): boolean {
  return /^(ios|android)$/i.test(String(os ?? '').trim())
}
