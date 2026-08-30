// Exclusion drift (prompt 44 Part 3).
//
// An exclusion group is the one object in a tenant that quietly undoes every
// policy that references it. It starts as two break-glass accounts and, a year
// later, holds nine people nobody remembers adding. Nothing in Entra reports
// that, because from Entra's point of view nothing has gone wrong.
//
// So IAMAI records the count at every checkpoint and reports the change. Growth
// beyond the number of nominated emergency-access accounts is a FINDING, not a
// note: it means somebody is now outside controls the plan believes are on.
import { count } from './statements.ts'

export const DRIFT = {
  title: 'Exclusions since the last scan',
  none: 'No exclusion group has changed size since the last scan.',
  first: 'This is the first scan, so there is nothing to compare against yet. The sizes below are the baseline for next time.',

  /** Growth within the nominated count: worth saying, not worth alarming about. */
  grew: (group: string, from: number, to: number, since: string) =>
    `${group} has grown from ${count(from, 'member')} to ${to} since ${since}.`,
  shrank: (group: string, from: number, to: number, since: string) =>
    `${group} has shrunk from ${count(from, 'member')} to ${to} since ${since}.`,

  /**
   * Growth beyond the nominated emergency-access accounts. This is the finding.
   * Two branches: small enough to name the people, or not.
   */
  beyondNominated: (group: string, to: number, nominated: number) =>
    `${group} holds ${count(to, 'member')}, and only ${count(nominated, 'emergency access account is', 'emergency access accounts are')} nominated. Everyone in this group sits outside every policy that excludes it.`,
  added: (names: string[]) => `Added since the last scan: ${names.join(', ')}.`,
  addedMany: (n: number) => `${count(n, 'member')} added since the last scan, too many to list here. The inventory has them.`,

  /** A policy's own direct exclusions get the same treatment (item 15). */
  directTitle: 'Named directly on a policy',
  direct: (policy: string, from: number, to: number, since: string) =>
    `${policy} excludes ${count(to, 'account')} by name, up from ${from} since ${since}.`,
  directBeyond: (policy: string, to: number) =>
    `${policy} excludes ${count(to, 'account')} by name. An account excluded on the policy itself is invisible in the group list, so nobody reviewing groups will find it.`,

  what: 'What to do',
  change: 'Check each member against the reason the exclusion exists. Anyone who is not an emergency access account, and not an approved exception recorded in Setup, belongs outside the group.',
  baselineNote: (n: number) => `${count(n, 'exclusion group')} recorded at this checkpoint.`,
} as const
