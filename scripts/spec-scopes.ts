// Prints the SPEC.md §4 table from the collector registry so the doc can be
// regenerated instead of hand-maintained. Usage: node scripts/spec-scopes.ts
import { COLLECTOR_REGISTRY } from '../src/graph/collect/registry.ts'

const scopes = new Set<string>()
for (const s of COLLECTOR_REGISTRY) for (const scope of s.scopes) scopes.add(scope)

console.log('Delegated scopes in use: `' + [...scopes].sort().join(' ') + '`')
console.log()
console.log('| Lane | Need | Endpoint | API | Scopes | Gate |')
console.log('|---|---|---|---|---|---|')
for (const s of COLLECTOR_REGISTRY) {
  console.log(
    `| ${s.lane} | ${s.purpose} | \`${s.endpoint}\` | ${s.version} | ${s.scopes.join(' ')} | ${s.gate} |`,
  )
}
