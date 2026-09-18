import type { ContractReadiness, ReadinessTile } from './stepContract.ts'
import type { EmergencyAccountStatus, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { ConfigurationFinding, ConfigurationFindingItem } from '../../roadmap/types.ts'

/** Interactive emergency-step presentation. Exact issue metadata allows an action
 * to replace its own evidence row without hiding another finding for the same
 * account. Print/export callers retain the source findings unchanged. */
export function consolidateEmergencyReadiness(
  readiness: ContractReadiness,
  projected: EmergencyTaskProjection | null,
  accountUpns: ReadonlyMap<string, string>,
  consolidate: boolean,
): ContractReadiness {
  if (!consolidate) return readiness
  const upn = new Map([...accountUpns].map(([id, value]) => [id.toLowerCase(), value]))
  const tasks = projected?.tasks.filter(task => task.required && task.issueKeys?.length) ?? []
  const project = (tile: ReadinessTile): ReadinessTile => {
    const structured = tile.items?.some(item => item.subjectId || item.subjectLabel || item.factLabel || item.link) === true
    const items = tile.items?.map(item => {
      const covered = item.issueKeys?.length && tasks.some(task => item.issueKeys!.some(key => task.issueKeys?.includes(key)))
      const subjectLabel = item.accountId ? upn.get(item.accountId.toLowerCase()) ?? item.subjectLabel ?? item.label : item.subjectLabel
      return { ...item, ...(subjectLabel ? { subjectLabel } : {}), label: item.accountId ? item.factLabel ?? item.label : item.label, ...(covered ? { actionCovered: true } : {}) }
    })
    return { ...tile, items, structuredItems: structured, ...(tile.key === 'configuration:recovery-methods' ? { link: undefined } : {}) }
  }
  const tiles = readiness.tiles.map(project)
  const satisfied = readiness.satisfied.map(project)
  if (tiles.some(tile => tile.key.startsWith('configuration:group-'))) {
    const outcomes = tiles.flatMap(tile => tile.items?.map(item => item.outcome) ?? [])
    const confirmed = outcomes.includes('fail')
    const incomplete = outcomes.includes('unknown') || tiles.some(tile => /could not verify|not verified/i.test(`${tile.value} ${tile.note ?? ''}`))
    const main = confirmed ? (incomplete ? 'Changes needed; other checks incomplete' : 'Changes needed') : incomplete ? 'Checks incomplete' : readiness.bar.main
    return { ...readiness, tiles, satisfied, bar: { ...readiness.bar, main } }
  }
  return { ...readiness, tiles, satisfied }
}

export type EmergencyFact = { label: string; value: string; link?: { label: string; href: string } }

/** One Tasks Remaining tile in the Step 1 account-tile standard: subject label,
 * subject identity, the single highest-priority remaining action with its short
 * instruction, the highest-priority finding per subject (the rest behind a
 * disclosure), then the completed checks. */
export type EmergencySubjectTile = EmergencyAccountStatus & { facts?: EmergencyFact[]; moreFacts?: EmergencyFact[] }

/** Subjects whose highest-priority finding shows before the disclosure. */
export const VISIBLE_SUBJECTS = 3

const rank = (outcome: string | undefined): number => outcome === 'fail' ? 0 : outcome === 'unknown' ? 1 : 2

/** A readiness tile of Steps 2–4 as a Step 1-standard subject tile. Presentation
 * only: which findings exist, and their outcomes, are the tile's own. */
export function emergencySubjectTileOf(tile: ReadinessTile, projected: EmergencyTaskProjection | null): EmergencySubjectTile {
  const key = tile.key.replace(/^configuration:/, '')
  const satisfied = tile.tone === 'good'
  const task = satisfied ? undefined : projected?.tasks.find(item => item.required && (item.readinessKey === key || item.readinessKeys?.includes(key)))
  const items = tile.items ?? []
  const passed = (item: ConfigurationFindingItem): boolean => item.outcome === 'pass' || (item.outcome === undefined && satisfied)
  const pending = items.filter(item => !passed(item)).map((item, index) => ({ item, index })).sort((a, b) => rank(a.item.outcome) - rank(b.item.outcome) || a.index - b.index).map(row => row.item)
  const taskFacts = task?.readinessFacts ?? task?.facts ?? []
  // Facts with their subject: an item's own subject identity, or the part of a
  // task fact's label before " · " (a profile, an account), or the fact itself.
  const rows: { subject: string; subjectLabel: string | null; fact: EmergencyFact }[] = taskFacts.length
    ? taskFacts.map(fact => {
        const [head, ...rest] = fact.label.split(' · ')
        return rest.length ? { subject: head, subjectLabel: head, fact: { label: rest.join(' · '), value: fact.value } } : { subject: `${fact.label}\n${fact.value}`, subjectLabel: null, fact }
      })
    : pending.map(item => ({
        // A subject is a named one (an account, a group, a policy). A finding without
        // one (a policy-wide setting) belongs to the tile's shared subject.
        subject: item.accountId ?? (item.subjectLabel ? item.subjectId ?? item.subjectLabel : ''),
        subjectLabel: item.subjectLabel ?? null,
        fact: { label: item.factLabel ?? item.label, value: item.value, ...(item.link ? { link: item.link } : {}) },
      }))
  const subjectLabels = [...new Set(rows.length ? rows.map(row => row.subjectLabel) : items.map(item => item.subjectLabel ?? null))]
  const actionTitle = task ? task.readinessTitle ?? task.title : tile.value
  // One subject names the tile's identity: the findings' own subject, or the one a task title names after " — ".
  const titled = / — ([^—]+)$/.exec(actionTitle)
  const identity = subjectLabels.length === 1 && subjectLabels[0] ? subjectLabels[0] : subjectLabels.every(label => !label) && titled ? titled[1] : null
  const labelled = rows.map(row => ({ ...row, fact: !identity && row.subjectLabel ? { ...row.fact, label: `${row.subjectLabel} · ${row.fact.label}` } : row.fact }))
  const firstOf = new Map<string, number>()
  labelled.forEach((row, index) => { if (!firstOf.has(row.subject) && firstOf.size < VISIBLE_SUBJECTS) firstOf.set(row.subject, index) })
  const shown = new Set(firstOf.values())
  const facts = labelled.filter((_, index) => shown.has(index)).map(row => row.fact)
  const moreFacts = labelled.filter((_, index) => !shown.has(index)).map(row => row.fact)
  // The identity is already on the tile; "Configure passkey protections — Default passkey profile" states it once.
  const title = identity && actionTitle.endsWith(` — ${identity}`) ? actionTitle.slice(0, -` — ${identity}`.length) : actionTitle
  const instruction = task ? task.readinessDirection ?? `Follow ${task.title} in Implementation Tasks.` : satisfied ? '' : tile.note ?? ''
  const completed = items.filter(passed).map(item => `${item.subjectLabel && !identity ? `${item.subjectLabel} · ` : ''}${item.factLabel ?? item.label}: ${item.value}`)
  return {
    key: tile.key, accountId: null, heading: tile.label, upn: identity, title, instruction: instruction === title ? '' : instruction,
    completed, remainingCount: pending.length || null, satisfied, facts, moreFacts,
  }
}

/** Steps 2–3: every readiness tile, remaining then satisfied, as subject tiles. */
export function emergencySubjectsOf(readiness: ContractReadiness, projected: EmergencyTaskProjection | null): EmergencySubjectTile[] {
  return [...readiness.tiles, ...readiness.satisfied].map(tile => emergencySubjectTileOf(tile, projected))
}

/** Step 4: one tile per verification concern, its passed findings under Completed checks. */
export function recoverySubjectsOf(findings: readonly ConfigurationFinding[], projected: EmergencyTaskProjection, accountUpns: ReadonlyMap<string, string>): EmergencySubjectTile[] {
  const tiles: ReadinessTile[] = findings.map(finding => ({
    key: finding.key, label: finding.label, value: finding.value, note: finding.detail || null, items: finding.items, link: finding.link, structuredItems: true,
    tone: finding.outcome !== 'pass' || finding.items?.some(item => item.outcome !== 'pass') ? 'warn' : 'good',
  }))
  const consolidated = consolidateEmergencyReadiness({ tiles, satisfied: [], bar: { key: 'recovery', main: '' } }, projected, accountUpns, true)
  return consolidated.tiles.map(tile => emergencySubjectTileOf(tile, projected))
}
