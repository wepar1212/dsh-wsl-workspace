/** Browser half of the WSL workspace picker. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type WslWorkspaceLocaleKey } from './locales.ts';
export type { WslWorkspacePanelFace, WslWorkspacePanelProps } from './WslWorkspacePanel.tsx';
export { createWslWorkspaceStore } from './store.ts';
export type { WslWorkspaceState } from './store.ts';
export type { WslWorkspaceLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** WSL workspace switch and picker copy. */
        wslWorkspace: WslWorkspaceLocaleKey;
    }
}
/** The parent only needs the existing Remote gateway to mount our contribution. */
export declare const inject: string[];
/** Mount the generated WSL Remote contribution and register its sidebar action. */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map