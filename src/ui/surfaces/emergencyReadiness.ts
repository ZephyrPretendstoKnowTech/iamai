import type { ContractReadiness, ReadinessTile } from './stepContract.ts'
import type { EmergencyTaskProjection } from './emergencyAccountTasks.ts'

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
  return { ...readiness, tiles: readiness.tiles.map(project), satisfied: readiness.satisfied.map(project) }
}
