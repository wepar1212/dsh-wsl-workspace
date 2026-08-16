/** Hand-owned browser Remote contribution matching the WSL Host manifest. */
import { z } from 'zod';
const listDirectoryDistribution = z.string();
const listDirectoryLinuxPath = z.string();
const directoryListing = z.object({
    distribution: z.string().readonly(),
    linuxPath: z.string().readonly(),
    parentLinuxPath: z.union([z.literal(null), z.string()]).readonly(),
    windowsPath: z.string().readonly(),
    directories: z.array(z.object({
        name: z.string().readonly(),
        linuxPath: z.string().readonly(),
    })).readonly(),
    truncated: z.boolean().readonly(),
});
const distributionSnapshot = z.object({
    available: z.boolean().readonly(),
    distributions: z.array(z.string()).readonly(),
    message: z.union([z.literal(null), z.string()]).readonly(),
});
/** Browser contribution mounted through ctx.remote.$mount(). */
export const TYPERT_REMOTE = {
    package: 'dsh-wsl-workspace',
    descriptors: [
        {
            id: 'dsh-wsl-workspace#wslWorkspace/listDirectory',
            service: 'wslWorkspace',
            namespace: 'wslWorkspace',
            method: 'listDirectory',
            invocation: { kind: 'direct' },
            parameters: [
                {
                    name: 'distribution',
                    wire: 'distribution',
                    source: 'json',
                    codec: {
                        mode: 'strict',
                        typeSymbol: 'dsh-wsl-workspace#wslWorkspace/listDirectory:distribution',
                        schema: listDirectoryDistribution,
                    },
                },
                {
                    name: 'linuxPath',
                    wire: 'linuxPath',
                    source: 'json',
                    codec: {
                        mode: 'strict',
                        typeSymbol: 'dsh-wsl-workspace#wslWorkspace/listDirectory:linuxPath',
                        schema: listDirectoryLinuxPath,
                    },
                },
            ],
            result: {
                mode: 'strict',
                typeSymbol: 'dsh-wsl-workspace/types#WslDirectoryListing',
                schema: directoryListing,
            },
            sourceLocation: { file: 'src/index.ts', line: 33, column: 3 },
        },
        {
            id: 'dsh-wsl-workspace#wslWorkspace/listDistributions',
            service: 'wslWorkspace',
            namespace: 'wslWorkspace',
            method: 'listDistributions',
            invocation: { kind: 'direct' },
            parameters: [],
            result: {
                mode: 'strict',
                typeSymbol: 'dsh-wsl-workspace/types#WslDistributionSnapshot',
                schema: distributionSnapshot,
            },
            sourceLocation: { file: 'src/index.ts', line: 22, column: 3 },
        },
    ],
};
export default TYPERT_REMOTE;
