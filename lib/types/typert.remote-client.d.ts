/** Hand-owned browser Remote contribution matching the WSL Host manifest. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { WslDirectoryListing, WslDistributionSnapshot } from './types.ts';
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespace$77736c576f726b7370616365 {
        listDirectory: (distribution: string, linuxPath: string) => Promise<RemoteResult<WslDirectoryListing>>;
        listDistributions: () => Promise<RemoteResult<WslDistributionSnapshot>>;
    }
    interface TypertRemoteMap {
        'wslWorkspace/listDirectory': (distribution: string, linuxPath: string) => Promise<RemoteResult<WslDirectoryListing>>;
        'wslWorkspace/listDistributions': () => Promise<RemoteResult<WslDistributionSnapshot>>;
    }
    interface TypertRemoteNamespaceMap {
        wslWorkspace: TypertRemoteNamespace$77736c576f726b7370616365;
    }
}
/** Browser contribution mounted through ctx.remote.$mount(). */
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
//# sourceMappingURL=typert.remote-client.d.ts.map