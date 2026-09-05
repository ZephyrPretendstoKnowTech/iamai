import { fixture } from '../src/roadmap/fixtures/index.ts'
import { runFixture } from '../src/roadmap/fixtures/run.ts'
import { appliedMapping } from '../src/ui/surfaces/pickerRows.ts'
import { directoryEvidenceFromGroups } from '../src/mapping/safetyChoice.ts'
const f = fixture('demo-week2')
console.log('fixture decisions keys:', Object.keys(f.decisions ?? {}))
const ctx: any = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups), now: f.snapshot.asOf }
const applied = appliedMapping(ctx, f.decisions ?? null)
console.log('questionAnswers:', JSON.stringify(applied.questionAnswers))
console.log('allowedCountries:', applied.allowedCountries)
console.log('bg:', applied.breakGlassUserIds, 'fixture bg:', f.mapping.breakGlassUserIds)
console.log('exclusions record:', JSON.stringify(applied.records['__globalExclusion']))
const r = runFixture({ ...f, mapping: applied }, { mapping: applied })
const ge = r.steps.find(s => s.id === 's-prereq-exclusion-group')
console.log('geStatus', ge?.status, 'checks', JSON.stringify(ge?.checks?.items?.map(i=>i.fix)), ge?.checks?.failing, '/', ge?.checks?.total)
console.log('travel step?', r.steps.some(s => s.id.includes('travel')), r.steps.filter(s=>s.id.startsWith('s-question')).map(s=>s.id))
