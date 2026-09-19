/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json (prompt 34 §2). */
declare const __APP_VERSION__: string

/** The commit this bundle was built from, short form (prompt 40 §24). */
declare const __BUILD_COMMIT__: string

/** The day this bundle was built, ISO yyyy-mm-dd (prompt 40 §24). */
declare const __BUILD_DATE__: string

/** True in the dev server and the smoke's build (scripts/smokeBuild.ts), false in the published bundle: whether ?dev=1&mock=1 may load the synthetic tenant. */
declare const __MOCK_TENANT__: boolean

/** The sample tenant's four facts, computed at build time from the demo fixture (vite.config.ts demoFactsModule). */
declare module 'virtual:demo-facts' {
  const facts: import('./ui/demoFacts.ts').DemoFacts
  export default facts
}
