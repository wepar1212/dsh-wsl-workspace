/** Windows-side WSL discovery and UNC directory listing helpers. */
import type { WslDirectoryListing, WslDistributionSnapshot } from './types.ts';
export interface WslWorkspaceTarget {
    readonly distribution: string;
    readonly linuxPath: string;
}
/** Decode wsl.exe output, which is UTF-16LE on some Windows builds and UTF-8 on others. */
export declare function decodeWslOutput(value: Buffer): string;
/** Parse the quiet distribution list without inventing a default distribution. */
export declare function parseDistributionList(value: Buffer): readonly string[];
/** Normalize an absolute Linux directory path; relative paths are rejected. */
export declare function normalizeLinuxPath(value: string): string;
/** Reject characters that can escape or change one UNC distribution segment. */
export declare function validateDistributionName(value: string): string;
/** Convert one distribution and Linux path into a Windows WSL UNC path. */
export declare function wslUncPath(server: 'wsl.localhost' | 'wsl$', distribution: string, linuxPath: string): string;
/** Parse a Windows WSL UNC workspace path back into its Linux target. */
export declare function parseWslUncPath(value: string): WslWorkspaceTarget | undefined;
/** Read installed WSL distributions from the Windows Host. */
export declare function listWslDistributions(): Promise<WslDistributionSnapshot>;
/** List one WSL directory through the preferred UNC server with the legacy alias as fallback. */
export declare function listWslDirectory(distribution: string, linuxPath: string): Promise<WslDirectoryListing>;
//# sourceMappingURL=wsl.d.ts.map