// Setup wizard copy: the questions a human answers, and the page around them.

export const SETUP_QUESTIONS = {
  breakGlass: {
    title: 'Emergency access',
    question: 'Which accounts are the emergency access (break-glass) admins?',
    help: 'Two cloud-only Global Administrator accounts, kept out of every policy, used only when everything else fails. IAMAI validates each pick and says exactly what to fix.',
  },
  globalExclusion: {
    title: 'Exclusion group',
    question: 'Which group holds the policy exclusions?',
    help: 'Usually a small assigned group containing only the break-glass accounts. If there is none, say so — creating it goes at the start of the plan.',
  },
  highCare: {
    title: 'Handle with care',
    question: 'Who needs extra care?',
    help: 'Executives, VIPs, or anyone an accidental lockout would hurt. The changes still apply to them: enforcement waits until each is verified, every step that touches them names them, and they go after the approach is proven.',
  },
  trustedLocations: {
    title: 'Trusted locations',
    question: 'Which named locations count as trusted?',
    help: 'Office IP ranges trusted for things like security-info registration. IAMAI checks each one for ranges that are too broad.',
  },
  serviceAccounts: {
    title: 'Service accounts',
    question: 'Are service accounts kept in a group?',
    help: 'Legacy-authentication or automation accounts that need carve-outs from some policies. Optional — skip it if that does not apply.',
  },
  variants: {
    title: 'Style choices',
    question: 'A few policies come in two styles — pick one of each.',
    help: 'Same security outcome, different shape. Pick whichever suits how the tenant is run; both are shown side by side.',
  },
  timeZone: {
    title: 'Time zone',
    question: 'Which time zone should dates display in?',
    help: 'Affects display only; everything is stored in UTC.',
  },
  frameworks: {
    title: 'Frameworks',
    question: 'Which security frameworks is the tenant working toward?',
    help: 'Findings and plan steps are tagged with the matching controls so the plan doubles as compliance evidence.',
  },
  applicability: {
    title: 'What applies',
    question: 'Are the detected workloads right?',
    help: 'Recommendations are switched off for workloads the tenant does not use. Correct any detection that is wrong.',
  },
} as const

export const SETUP_PAGE = {
  title: 'Setup',
  does: 'A handful of questions about the tenant. Everything else is worked out from the scan.',
  needsBaseline: 'baseline loaded',
  needBaseline: 'load a baseline',
  needsScan: 'scan complete',
  needScan: 'run a scan',
  next: 'Findings',
  blocked: 'Setup needs a loaded baseline and a scan.',
  loadBaseline: 'Load a baseline',
  runScan: 'run a scan',
  progress: (answered: number, total: number, requiredLeft: number) =>
    `${answered} of ${total} answered · ${requiredLeft === 0 ? 'nothing required remaining' : `${requiredLeft} required remaining`}`,
  requiredList: (names: string[]) => `Still required: ${names.join(', ')}.`,
  questionNumber: (n: number) => `Question ${n}`,
  why: {
    inferredBreakGlass: 'directly excluded from an existing policy',
    inferredExclusion: 'the tenant\'s policies exclude this group the way a break-glass group is excluded',
    inferredServiceAccounts: 'excluded only from MFA or block policies, the way service accounts are',
    nameMatch: (m: string) => `name contains "${m}"`,
    cloudOnlyGa: 'cloud-only Global Administrator',
    trusted: 'marked trusted in the tenant',
  },
  doesNotExist: "Doesn't exist yet — add it to the plan",
  workloadEvidence: (name: string, reason: string) => `${name} — ${reason}`,
  workloadNames: {
    avd: 'Azure Virtual Desktop',
    copilot: 'Microsoft 365 Copilot',
    azureDevOps: 'Azure DevOps',
    intune: 'Intune',
    sharepoint: 'SharePoint',
    workload: 'Workload identities',
    agents: 'AI agents',
    azureManagement: 'Azure management',
  } as Record<string, string>,
  workloadReason: {
    seen: 'sign-ins seen in the last 30 days',
    notSeen: 'no sign-ins in the last 30 days',
    licence: (name: string) => `${name} licence present`,
    noLicence: (name: string) => `no ${name} licence`,
  },
  vendorNotSeen: (vendor: string) => `the ${vendor} app is not present in this tenant`,
  complete: '— that covers everything the plan needs. The optional ones below sharpen it.',
  incomplete: '— the required ones unlock the plan; the rest are optional.',
  autoResolved: (n: number) => `${n} baseline reference${n === 1 ? '' : 's'} resolved automatically.`,
  answered: 'Answered',
  required: 'Required',
  optional: 'Optional',
  searchUsers: 'Search users…',
  searchVips: 'Search users (executives, VIPs)…',
  searchGroups: 'Start typing a group name…',
  searchLocations: 'Search named locations…',
  usedInPolicy: 'used in a policy',
  members: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
  toFix: (n: number) => `${n} to fix`,
  checksPassed: 'Checks passed',
  needsAttention: 'Needs attention before this is safe',
  noBreakGlass: 'No break-glass accounts yet — put creating them in the plan',
  noExclusionGroup: 'No exclusions group yet — put creating it in the plan',
  nobodyNeedsCare: 'Nobody needs special care',
  careExplained: (n: number) =>
    `${n === 1 ? 'This user gets' : `These ${n} users get`} white-glove treatment: named on every step that touches them, verified before anything is enforced, and sequenced after the approach is proven.`,
  noNamedLocations: 'The tenant has no named locations yet.',
  markedTrusted: 'marked trusted in the tenant',
  notMarkedTrusted: 'not marked trusted',
  noLocationYet: 'None yet — put creating one in the plan',
  notApplicable: 'Not applicable',
  browserZone: (zone: string) => `${zone} (this browser)`,
  frameworkNone: 'Not sure / none',
  confirmedByOperator: 'confirmed in Setup',
  notUsed: 'marked as not used in Setup',
  yourAnswer: '(your answer)',
  detectionsRight: 'Detections look right',
}

/** Fix paths for validation findings: a plan step, or the exact portal path. */
export const VALIDATION_ACTION = {
  roadmap: { label: 'See the step in the Roadmap', href: '#/roadmap' },
  drill: { label: 'Break-glass drill step in the Roadmap', href: '#/roadmap' },
  pickAnother: { label: 'Pick a different account above', href: '#/mapping' },
  policies: { label: 'Entra admin center → Protection → Conditional Access → Policies', href: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/Policies' },
  roles: { label: 'Entra admin center → Roles & admins → Global Administrator', href: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/RolesManagementMenuBlade/~/AllRoles' },
  namedLocations: { label: 'Entra admin center → Protection → Conditional Access → Named locations', href: 'https://entra.microsoft.com/#view/Microsoft_AAD_ConditionalAccess/ConditionalAccessBlade/~/NamedLocations' },
  userMethods: (userId: string) => ({
    label: 'Entra admin center → Users → this user → Authentication methods',
    href: `https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/AuthenticationMethods/userId/${userId}`,
  }),
  userProfile: (userId: string) => ({
    label: 'Entra admin center → Users → this user',
    href: `https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${userId}`,
  }),
  group: (groupId: string) => ({
    label: 'Entra admin center → Groups → this group → Members',
    href: `https://entra.microsoft.com/#view/Microsoft_AAD_IAM/GroupDetailsMenuBlade/~/Members/groupId/${groupId}`,
  }),
}

export const FRAMEWORK_OPTIONS =['CIS Controls v8', 'Essential Eight (ACSC)', 'NIST CSF']

export const COMMON_TIMEZONES = [
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Perth',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Singapore',
  'UTC',
]
