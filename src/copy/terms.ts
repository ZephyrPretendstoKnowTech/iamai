// Terminology dictionary (ux-review-03 §A8): the final user-facing labels for
// every internal state. Enum values never change; only these words do. Every
// chip, tile, legend entry, CSV header and print label reads from here via
// src/copy/definitions.ts.

export const TERMS = {
  mfaState: {
    verified: 'Verified',
    likelyViable: 'Looks healthy',
    notChallenged: 'Never prompted',
    unverified: 'Possibly broken',
    none: 'No method',
  },
  activity: {
    active: 'Active',
    dormant: 'Inactive 90+ days',
    neverSignedIn: 'Never signed in',
  },
  methodTier: {
    phishingResistant: 'Phishing-resistant',
    passwordless: 'Passwordless',
    push: 'App notification',
    otp: 'One-time code',
    smsVoice: 'Text or call',
    none: 'None',
  },
  stepKind: {
    prerequisite: 'Prerequisite',
    create: 'New policy',
    adjust: 'Change',
    verify: 'Verify',
    enforce: 'Enforce',
    recurring: 'Recurring',
    check: 'Check',
  },
  legendGroups: {
    mfaState: 'MFA state',
    activity: 'Activity',
    methodTier: 'Method tier',
  },
} as const

export type MfaStateKey = keyof typeof TERMS.mfaState
export type ActivityKey = keyof typeof TERMS.activity
export type MethodTierKey = keyof typeof TERMS.methodTier
