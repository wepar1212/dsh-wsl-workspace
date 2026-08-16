/** Sidebar action and modal directory browser for WSL workspaces. */
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { WslDirectoryListing, WslDistributionSnapshot } from '../types.ts';
import type { createWslWorkspaceStore } from './store.ts';
/** Apply-world callbacks consumed by the WSL picker component. */
export interface WslWorkspacePanelFace {
    /** Read current WSL availability and installed distributions. */
    listDistributions: () => Promise<WslDistributionSnapshot>;
    /** Read one WSL directory. */
    listDirectory: (distribution: string, linuxPath: string) => Promise<WslDirectoryListing>;
    /** Register and open the selected UNC path as a DSH workspace. */
    addWorkspace: (windowsPath: string) => Promise<void>;
}
/** Full props composed by the sidebar footer-action slot. */
export type WslWorkspacePanelProps = PropsRuntime<'sidebar.footer.action'> & PropsStore<ReturnType<typeof createWslWorkspaceStore>> & InjectFace<WslWorkspacePanelFace> & PropsLocale<'wslWorkspace'>;
/** Render the persistent WSL switch and directory-selection flow. */
export declare function WslWorkspacePanel({ wide, useStore, actions, listDistributions, listDirectory, addWorkspace, t, }: WslWorkspacePanelProps): import("react").JSX.Element;
//# sourceMappingURL=WslWorkspacePanel.d.ts.map