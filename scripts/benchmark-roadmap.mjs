// Measure fresh replans without the full test suite's retained fixture graphs.
// The caller owns the unchanged acceptance bound; this process only reports time.
import { fixture } from '../src/roadmap/fixtures/index.ts'
import { runFixture } from '../src/roadmap/fixtures/run.ts'

const name = process.argv[2]
if (!['micro', 'small', 'getiamai', 'mid', 'large', 'huge', 'messy', 'midflight', 'hostile', 'demo', 'demo-week2'].includes(name)) throw new Error('Unknown fixture')
const f = fixture(name)
const samples = Array.from({ length: 3 }, () => runFixture(f, { snapshot: f.snapshot }).roadmapMs)
console.log(JSON.stringify({ samples, best: Math.min(...samples) }))
