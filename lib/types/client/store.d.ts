/** Persisted user opt-in for the WSL workspace entry. */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
/** Root interaction state retained across browser reloads. */
export interface WslWorkspaceState {
    /** Whether WSL discovery is allowed to run when the panel opens. */
    enabled: boolean;
}
type WslWorkspaceActions = {
    setEnabled: (draft: WslWorkspaceState, enabled: boolean) => void;
};
/** Declare the persisted WSL opt-in store and its complete write API. */
export declare function createWslWorkspaceStore(): EngineStoreHandle<WslWorkspaceState, WslWorkspaceActions>;
export {};
//# sourceMappingURL=store.d.ts.map