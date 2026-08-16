/** Remote Host gateway for WSL distribution discovery and directory listing. */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from 'zod'
import type { WslDirectoryListing, WslDistributionSnapshot } from './types.ts'
import { listWslDirectory, listWslDistributions } from './wsl.ts'

export type * from './types.ts'

/** Remote-only gateway used by the WSL workspace browser. */
export class WslWorkspaceGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'wslWorkspace')
  }

  /**
   * Enumerate distributions installed for the Windows account running DSH.
   * @returns availability, distribution names, and an operator-facing failure when unavailable.
   */
  @Remote('listDistributions')
  listDistributions(): Promise<WslDistributionSnapshot> {
    return listWslDistributions()
  }

  /**
   * List one absolute Linux directory in a WSL distribution.
   * @param distribution - installed distribution name.
   * @param linuxPath - absolute Linux directory path.
   * @returns the normalized path, Windows UNC workspace path, and direct children.
   */
  @Remote('listDirectory')
  listDirectory(distribution: string, linuxPath: string): Promise<WslDirectoryListing> {
    return listWslDirectory(distribution, linuxPath)
  }
}

export default WslWorkspaceGateway
