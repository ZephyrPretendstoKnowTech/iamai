// The naming explainer (naming-and-consolidation.md §1, prompt 43 Part 1),
// carried verbatim in structure: why a name matters, the three patterns, and a
// worked example of each drawn from the tenant in front of the reader.
//
// Linked from every proposed name in the app, so the reasoning is said once.

export const NAMING = {
  title: 'Naming policies and groups',
  does: 'Explains the naming convention behind every name IAMAI proposes, and how it reads the one this tenant already uses.',
  next: 'Findings',

  whyTitle: 'Why a name matters',
  why: [
    'A Conditional Access policy name is the only thing an admin sees in a list of forty. A good one answers three questions without opening it: who it applies to, what it does, and whether it is on purpose.',
    'The convention below is a common one, not the only one. What matters is that a tenant picks one and holds to it.',
  ],

  policyTitle: 'Policies',
  policyPattern: '<Prefix> - <Scope> - <Action> - <Target>',
  policyParts: [
    { part: 'Prefix', text: 'Groups policies that belong to one set, so they sort together and a stranger can tell yours from Microsoft’s.' },
    { part: 'Scope', text: 'Who it applies to: Global, Admins, Guests, or a persona.' },
    { part: 'Action', text: 'Block, Require, Grant, or Session.' },
    { part: 'Target', text: 'The thing being protected or restricted.' },
  ],
  policyExamples: ['Core - Global - Block - Legacy authentication', 'Core - Admins - Require - Phishing-resistant MFA'],

  groupTitle: 'Groups',
  groupPattern: '<Prefix> - <Purpose> - <Scope>',
  groupExamples: ['Core - Exclusion - Break-glass', 'Core - Pilot - MFA enforcement', 'Core - Exception - Legacy service accounts'],
  groupNote:
    'An exclusion group’s name should make its risk obvious. Anyone reading Core - Exclusion - Break-glass knows the members sit outside the policies, which is the point of naming it that way.',

  locationTitle: 'Named locations',
  locationPattern: '<Prefix> - <Kind> - <Where>',
  locationExamples: ['Core - Trusted - Head office', 'Core - Allowed countries'],

  // ---- What IAMAI found in this tenant ----
  detectedTitle: 'What this tenant already does',
  /** Four branches: no policies to read, no pattern, a pattern, a pattern with stragglers. */
  detectedNone: 'This tenant has no Conditional Access policies to read a convention from, so IAMAI proposes the pattern above and says so on every name.',
  detectedWeak: (agreement: number, sampled: number) =>
    `No convention is detectable here: the ${sampled === 1 ? 'one policy name' : `${sampled} policy names`} agree only ${agreement}% of the time, below the 60% IAMAI needs. Every name below is a proposal in the pattern above, not a match to something this tenant already does.`,
  detectedStrong: (agreement: number, sampled: number, pattern: string) =>
    `${agreement}% of the ${sampled} policy names here follow ${pattern}, so IAMAI proposes names in that shape rather than its own.`,
  proposalChip: 'Proposal',
  proposalNote: 'IAMAI could not read a convention from this tenant, so this is the documented pattern rather than a match to yours.',
  matchedChip: 'Matches this tenant',

  workedTitle: 'A worked example from this tenant',
  workedPolicy: 'A policy this plan creates',
  workedGroup: 'The exclusion group this plan creates',
  workedLocation: 'A named location this plan creates',

  renameTitle: 'Renaming is safe',
  renameNote:
    'Renaming a policy changes no evaluation. Nobody is affected, nothing needs a report-only window, and it can be undone by renaming it back. Consolidating two policies into one is a different thing entirely and follows the six stages on that step.',

  link: 'How IAMAI names things',
} as const
