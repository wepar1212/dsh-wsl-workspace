/** Client-safe payloads published by the WSL workspace Remote. */
/** Current WSL availability and the installed distribution names. */
export interface WslDistributionSnapshot {
    /** Whether the Host can enumerate WSL distributions. */
    readonly available: boolean;
    /** Installed distributions in the order reported by WSL. */
    readonly distributions: readonly string[];
    /** Operator-facing failure when WSL is unavailable. */
    readonly message: string | null;
}
/** One child directory inside a WSL distribution. */
export interface WslDirectoryEntry {
    /** Linux basename displayed by the browser. */
    readonly name: string;
    /** Absolute Linux path used for a subsequent listing request. */
    readonly linuxPath: string;
}
/** One successfully listed WSL directory. */
export interface WslDirectoryListing {
    /** Selected WSL distribution. */
    readonly distribution: string;
    /** Normalized absolute Linux path. */
    readonly linuxPath: string;
    /** Parent Linux path, or null at the distribution root. */
    readonly parentLinuxPath: string | null;
    /** Windows UNC path accepted by the DSH workspace registry. */
    readonly windowsPath: string;
    /** Direct child directories, sorted by name. */
    readonly directories: readonly WslDirectoryEntry[];
    /** Whether more directories existed beyond the response bound. */
    readonly truncated: boolean;
}
//# sourceMappingURL=types.d.ts.map