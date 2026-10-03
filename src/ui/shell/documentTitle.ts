// The browser tab's title (F-145): the page, the tenant, then the product, so a
// row of IAMAI tabs reads apart by page and by tenant. Pure, so Node tests read it.
// The page is the header tab's word (Inventory sits under MFA Readiness, the
// tab the header marks for it); the product is the same title index.html
// starts with (vite.config.ts). No tenant is named while signed out or before
// the tenant's name has arrived.
import { app, PRODUCT_TITLE } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { Route } from './routes.ts'

const TAB_OF: Record<Route, keyof typeof app.shell.tabs | null> = {
  home: null,
  connect: 'connect',
  plan: 'plan',
  readiness: 'readiness',
  inventory: 'readiness',
  export: 'export',
  how: 'how',
}

export function documentTitle(route: Route, tenantName: string | null): string {
  const tab = TAB_OF[route]
  if (!tab) return PRODUCT_TITLE
  const page = app.shell.tabs[tab]
  return tenantName
    ? fillText(app.shell.pageTitle, { page, tenant: tenantName, product: PRODUCT_TITLE })
    : fillText(app.shell.pageTitleNoTenant, { page, product: PRODUCT_TITLE })
}
