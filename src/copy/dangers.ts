// Danger-area copy: titles, detail, per-person needs, and where to go.
import { count } from './statements.ts'

export const DANGER = {
  methodSetupLink: { label: 'Set up sign-in methods (for the user)', url: 'https://aka.ms/mfasetup' },
  authMethodsPath: 'Entra admin center → Protection → Authentication methods → Policies',

  blockedToday: {
    title: (n: number) => `${count(n, 'user is', 'users are')} blocked today, before this plan changes anything`,
    detail: 'Their most recent sign-in failed an existing Conditional Access policy. Fix this first: otherwise the rollout gets the blame.',
    need: 'investigate the failing sign-in',
    path: 'Entra admin center → Identity → Monitoring & health → Sign-in logs (filter: Failure)',
    link: {
      label: 'Troubleshoot sign-in problems with Conditional Access',
      url: 'https://learn.microsoft.com/entra/identity/conditional-access/troubleshoot-conditional-access',
    },
  },
  careAtRisk: {
    title: (n: number) => `${count(n, 'handle-with-care user')} would struggle with MFA today`,
    detail: 'Set these people up personally before their step goes live: a call or a desk visit, not an email blast. Enforcement stays gated until each is ready.',
    noMethod: 'has no MFA method: issue a Temporary Access Pass and walk them through Authenticator',
    smsOnly: 'has only text or call: upgrade them to Microsoft Authenticator',
    unproven: 'method registered but unproven: have them complete one MFA sign-in',
    path: (base: string) => `${base} (enable Temporary Access Pass, then Users → user → Authentication methods → Add)`,
  },
  weakAdmins: {
    title: (n: number) => `${count(n, 'admin has', 'admins have')} no phishing-resistant method`,
    detail: 'The admin-hardening phase requires passkeys or FIDO2 keys. Get keys into their hands early.',
    need: (strongest: string) => `strongest today: ${strongest}: register a passkey or FIDO2 key`,
    nothing: 'nothing',
    path: (base: string) => `${base} → Passkey (FIDO2) → Enable and target these admins`,
    link: {
      label: 'Enable passkeys (FIDO2) for your organization',
      url: 'https://learn.microsoft.com/entra/identity/authentication/how-to-enable-passkey-fido2',
    },
  },
  operator: {
    title: 'The signed-in account is not provably safe yet',
    detail:
      'This account is making the changes. Before enforcing anything that includes it, register a strong method and complete one MFA sign-in: the most common lockout is the operator\'s own.',
    need: 'register a passkey or FIDO2 key and complete one MFA sign-in',
    path: 'My sign-ins → Security info → Add method',
  },
  staleBreakGlass: {
    title: (n: number, days: number) => `${count(n, 'break-glass account')} unproven in ${days}+ days`,
    detail: 'An emergency account that has not signed in recently is unproven exactly when it matters. Run the drill.',
    need: 'complete a test sign-in with its strong method',
    link: {
      label: 'Manage emergency access accounts',
      url: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access',
    },
  },
}
