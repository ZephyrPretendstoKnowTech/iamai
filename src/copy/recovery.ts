// The recovery card (prompt 44 Part 2).
//
// The audience is one person with no colleague to call. If a change goes wrong
// on a Friday evening, the worst moment to be reading a rollout plan is the
// moment they need it. So this is one page, printable, and it works from a saved
// plan file with no fresh scan — because a person locked out of the portal
// cannot run a scan.
//
// It never carries a credential. It says where the credential is recorded,
// which is what the Setup answer is for.

export const RECOVERY = {
  title: 'Recovery card',
  action: 'Recovery card',
  does: 'One page to print and keep. What to do if a change locks somebody out, including you.',
  print: 'Print this card',

  generated: (date: string) => `Generated ${date}.`,
  reprint: 'Reprint this after any change to emergency access, because the accounts below are the part that goes stale.',

  accountsTitle: 'Emergency access accounts',
  accountsNone:
    'No emergency access accounts are nominated in this plan. That is the first thing to fix: without one, a policy that locks everybody out has no way back in. The plan has a step for it.',
  accountsNote: 'Sign in with one of these if your own account is locked out.',
  credentialTitle: 'Where the credential is',
  credentialNone: 'Setup has no answer for where these credentials are kept. Write it here by hand before filing this card.',

  disableTitle: 'Turn a Conditional Access policy off',
  disableSteps: [
    'Go to entra.microsoft.com and sign in.',
    'Protection → Conditional Access → Policies.',
    'Open the policy by name.',
    'Set Enable policy to Off.',
    'Save. It applies within a few minutes.',
  ],

  reportOnlyTitle: 'Put a policy back to report-only',
  reportOnlySteps: [
    'Protection → Conditional Access → Policies.',
    'Open the policy by name.',
    'Set Enable policy to Report-only.',
    'Save. The policy keeps recording what it would have done, and stops doing it.',
  ],
  reportOnlyWhy: 'Report-only is the better move where the policy is worth keeping: it stops the harm and keeps the evidence.',

  blockedTitle: 'If the portal itself blocks you',
  blockedSteps: [
    'Use an emergency access account above, in a private browser window.',
    'If that is also blocked, sign in from a device and location the policy trusts: an office network, a managed laptop.',
    'If Conditional Access blocks every route, a Global Administrator can disable a policy with PowerShell from any device: Connect-MgGraph, then update the policy state.',
    'A tenant with no working way in needs Microsoft support, and they will ask for the tenant id below.',
  ],

  tenantTitle: 'This tenant',
  tenantIdLabel: 'Tenant ID',
  domainLabel: 'Domain',
  supportNote: 'Microsoft support will ask for the tenant id.',

  noPlan: 'Load a saved plan or run a scan, and this card fills in with the accounts and tenant from it.',
} as const
