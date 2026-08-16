/** Remote Host gateway for WSL distribution discovery and directory listing. */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { WslDirectoryListing, WslDistributionSnapshot } from './types.ts';
export type * from './types.ts';
/** Remote-only gateway used by the WSL workspace browser. */
export declare class WslWorkspaceGateway extends TypertRemoteService {
    constructor(ctx: Context);
    /**
     * Enumerate distributions installed for the Windows account running DSH.
     * @returns availability, distribution names, and an operator-facing failure when unavailable.
     */
    listDistributions(): Promise<WslDistributionSnapshot>;
    /**
     * List one absolute Linux directory in a WSL distribution.
     * @param distribution - installed distribution name.
     * @param linuxPath - absolute Linux directory path.
     * @returns the normalized path, Windows UNC workspace path, and direct children.
     */
    listDirectory(distribution: string, linuxPath: string): Promise<WslDirectoryListing>;
}
export default WslWorkspaceGateway;
//# sourceMappingURL=index.d.ts.map