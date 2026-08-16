/** Persisted user opt-in for the WSL workspace entry. */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Root interaction state retained across browser reloads. */
export interface WslWorkspaceState {
  /** Whether WSL discovery is allowed to run when the panel opens. */
  enabled: boolean
}

type WslWorkspaceActions = {
  setEnabled: (draft: WslWorkspaceState, enabled: boolean) => void
}

/** Declare the persisted WSL opt-in store and its complete write API. */
export function createWslWorkspaceStore(): EngineStoreHandle<WslWorkspaceState, WslWorkspaceActions> {
  return defineStore({
    init: (): WslWorkspaceState => ({ enabled: false }),
    persist: 'dsh.ui.wsl-workspace',
    actions: {
      setEnabled: (draft, enabled: boolean) => { draft.enabled = enabled },
    },
  })
}
