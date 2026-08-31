// Proves a goal template is the goal it claims to be (prompt 46 item 12). The
// check itself lives in src/roadmap/templateCheck.ts, shared with the test
// suite; this is the command line for authoring. Usage:
//   node scripts/check-template.mjs <goalId> [template.json]   one goal (file overrides goals.json)
//   node scripts/check-template.mjs --all                       every goal in data/goals.json
// Exit code 1 on any failure; --json prints the report as JSON.
import fs from 'node:fs'
import goalsJson from '../data/goals.json' with { type: 'json' }
import { checkTemplate } from '../src/roadmap/templateCheck.ts'

const args = process.argv.slice(2)
const json = args.includes('--json')
const rest = args.filter((a) => !a.startsWith('--'))
const targets = args.includes('--all') ? goalsJson.goals : goalsJson.goals.filter((g) => g.id === rest[0])
if (targets.length === 0) {
  console.error(`no goal ${rest[0]}; ids: ${goalsJson.goals.map((g) => g.id).join(', ')}`)
  process.exit(2)
}
const override = rest[1] ? JSON.parse(fs.readFileSync(rest[1], 'utf8')) : null
const report = []
for (const goal of targets) {
  goal.implementations.forEach((impl, i) => {
    const template = override ? (override.template ?? override) : impl.template
    const shortName = override?.shortName ?? goal.shortName
    const r = checkTemplate({ shortName }, { ...impl, template })
    report.push({ goal: goal.id, implementation: i, shortName, ...r })
  })
}
if (json) console.log(JSON.stringify(report, null, 2))
else
  for (const r of report) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.goal}${r.implementation ? `#${r.implementation}` : ''}  shortName="${r.shortName ?? ''}"`)
    for (const p of r.problems) console.log(`      - ${p}`)
    if (r.ok) console.log(`      facts: ${JSON.stringify(r.facts)}`)
  }
process.exit(report.every((r) => r.ok) ? 0 : 1)
