/** Browser half of the WSL workspace picker. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import wslWorkspaceRemote from '../typert.remote-client.ts'
import { WslWorkspacePanel, type WslWorkspacePanelFace } from './WslWorkspacePanel.tsx'
import { createWslWorkspaceStore } from './store.ts'
import { en, zh, type WslWorkspaceLocaleKey } from './locales.ts'

export type { WslWorkspacePanelFace, WslWorkspacePanelProps } from './WslWorkspacePanel.tsx'
export { createWslWorkspaceStore } from './store.ts'
export type { WslWorkspaceState } from './store.ts'
export type { WslWorkspaceLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** WSL workspace switch and picker copy. */
    wslWorkspace: WslWorkspaceLocaleKey
  }
}

/** The parent only needs the existing Remote gateway to mount our contribution. */
export const inject = ['remote']

/** Services required after the WSL Remote namespace has been mounted. */
const uiInject = ['slots', 'locale', 'remote', 'remote.wslWorkspace', 'workspaces']

/** Mount the generated WSL Remote contribution and register its sidebar action. */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(wslWorkspaceRemote)
  const uiFiber = ctx.plugin({
    name: 'dsh-wsl-workspace.client-ui',
    inject: uiInject,
    apply: applyUi,
  })
  return async () => {
    await uiFiber.dispose()
    await disposeRemote()
  }
}

/** Runs in a child fiber so `remote.wslWorkspace` is injected after mounting. */
function applyUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register('wslWorkspace', { zh, en }), 'ui-wsl-workspace: dictionaries')
  const face = (): WslWorkspacePanelFace => ({
    listDistributions: async () => {
      const result = await ctx.remote.wslWorkspace.listDistributions()
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      return result.value
    },
    listDirectory: async (distribution, linuxPath) => {
      const result = await ctx.remote.wslWorkspace.listDirectory(distribution, linuxPath)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      return result.value
    },
    addWorkspace: async (windowsPath) => {
      const workspace = await ctx.workspaces.create({ path: windowsPath })
      ctx.workspaces.startSession(workspace.workspaceId)
    },
  })
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'wsl-workspace',
    order: 20,
    locale: 'wslWorkspace',
    store: createWslWorkspaceStore,
    inject: face,
  }, WslWorkspacePanel))
}
