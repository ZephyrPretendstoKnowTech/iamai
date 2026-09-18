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
 * the subject(s) the next check concerns, the one next check and what is wrong,
 * one action (the owning step's link or the Implementation Task), then the
 * completed checks. Everything else waits behind the remaining count. */
export type EmergencySubjectTile = EmergencyAccountStatus & { detail?: string; link?: { label: string; href: string } }

const rank = (outcome: string | undefined): number => outcome === 'fail' ? 0 : outcome === 'unknown' ? 1 : 2

/** A readiness tile of Steps 2–4 as a Step 1-standard subject tile. Presentation
 * only: which findings exist, and their outcomes, are the tile's own. */
export function emergencySubjectTileOf(tile: ReadinessTile, projected: EmergencyTaskProjection | null): EmergencySubjectTile {
  const key = tile.key.replace(/^configuration:/, '')
  const satisfied = tile.tone === 'good'
  const task = satisfied ? undefined : projected?.tasks.find(item => item.required && (item.readinessKey === key || item.readinessKeys?.includes(key)))
  const items = tile.items ?? []
  const passed = (item: ConfigurationFindingItem): boolean => item.outcome === 'pass' || (item.outcome === undefined && satisfied)
  // A tile without findings of its own (Sign-in Evidence) reads its task's per-subject facts.
  const findings: ConfigurationFindingItem[] = items.length ? items : (task?.readinessFacts ?? []).map(fact => ({
    label: fact.value, factLabel: fact.value, value: '', subjectLabel: fact.label, outcome: /^verified$/i.test(fact.value) ? 'pass' as const : 'fail' as const,
  }))
  const pending = findings.filter(item => !passed(item)).map((item, index) => ({ item, index })).sort((x, y) => rank(x.item.outcome) - rank(y.item.outcome) || x.index - y.index).map(row => row.item)
  const completed = findings.filter(passed).map(item => [item.subjectLabel, `${item.factLabel ?? item.label}${item.value ? `: ${item.value}` : ''}`].filter(Boolean).join(' · '))
  const direction = task ? task.readinessDirection ?? `Follow ${task.title} in Implementation Tasks.` : null
  const base = { key: tile.key, accountId: null, heading: tile.label, completed, remainingCount: pending.length || null, satisfied }
  const next = pending[0]
  if (!next) {
    const labels = [...new Set(findings.map(item => item.subjectLabel).filter((label): label is string => !!label))]
    return { ...base, upn: labels.length === 1 ? labels[0] : task?.subjectLabel ?? null, title: satisfied ? tile.value : task?.readinessTitle ?? tile.value, instruction: satisfied ? '' : direction ?? tile.note ?? '' }
  }
  // The next check, and every subject it applies to alike (two accounts both needing a sign-in).
  const name = (item: ConfigurationFindingItem): string => item.factLabel ?? item.label
  const alike = pending.filter(item => name(item) === name(next) && item.value === next.value)
  const subjects = [...new Set(alike.map(item => item.subjectLabel).filter((label): label is string => !!label))]
  // A merged prerequisite ("Prerequisite · To do", "Finish X first.") is its own action.
  const prerequisite = /^Prerequisite\b/.test(name(next))
  return {
    ...base,
    upn: subjects.length ? subjects.join('\n') : task?.subjectLabel ?? null,
    title: prerequisite ? next.value : name(next),
    detail: prerequisite ? '' : next.value,
    instruction: prerequisite || next.link ? '' : direction ?? '',
    ...(next.link ? { link: next.link } : {}),
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
