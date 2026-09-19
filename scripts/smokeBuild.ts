// The smoke's own build (`vite build --mode smoke`): the production bundle,
// minified and code-split as it ships, with the synthetic tenant
// (?dev=1&mock=1, src/ui/App.tsx) left in, written beside the published site
// rather than into it. vite.config.ts builds it and scripts/smoke.mjs serves it.
//
// Why a bundle: the smoke drove the dev server until the Plan's module graph
// outgrew what Chrome on a CI runner will request at once (hundreds of
// unbundled modules, net::ERR_INSUFFICIENT_RESOURCES, the Plan never drew). A
// bundle is a few dozen requests whatever the graph grows to, and it is the code
// that ships. The published build is mode 'production', where __MOCK_TENANT__ is
// false and the mock branch and its fixtures are not emitted at all.
import { TOOL_PATH } from './toolPath.ts'

export const SMOKE_MODE = 'smoke'

/**
 * Where the smoke on `port` writes its build: outside dist/, so it can never be
 * assembled or published, and a folder per port, so two smokes side by side
 * (npm run verify -- --prepush beside one run by hand) never empty each other's.
 * The smoke hands its port to vite as SMOKE_PORT; 0 is a build run by hand.
 */
export const smokeOutDir = (port: number): string => `dist-smoke/${port}/${TOOL_PATH}`
