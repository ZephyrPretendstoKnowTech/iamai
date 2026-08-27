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
  progress: (answered: number, total: number) => `${answered} of ${total} answered`,
  complete: '— that covers everything the plan needs. The optional ones below sharpen it.',
  incomplete: '— the required ones unlock the plan; the rest are optional.',
  autoResolved: (n: number) => `${n} baseline reference${n === 1 ? '' : 's'} resolved automatically.`,
  answered: 'Answered',
  required: 'Required',
  optional: 'Optional',
  searchUsers: 'Search users…',
  searchVips: 'Search users (executives, VIPs)…',
  searchGroups: 'Start typing a group name…',
  usedInPolicy: 'used in a policy',
  members: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
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

export const FRAMEWORK_OPTIONS = ['CIS Controls v8', 'Essential Eight (ACSC)', 'NIST CSF']

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
