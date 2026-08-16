/** Workspace-scoped bash routing for WSL workspaces. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-tools'
import { createWslCommandTool } from './wsl-command.ts'
import { parseWslUncPath } from './wsl.ts'

/**
 * Install a WSL-backed `bash` shadow for one Agent.
 *
 * DSH's current Windows subprocess provider cannot inspect PTY foreground
 * process groups, so its persistent terminal backend is unavailable on Win32.
 * The shadow deliberately uses the reliable bounded subprocess path instead:
 * the model still calls `bash`, but every command runs through `wsl.exe` in
 * the selected distribution and Linux cwd.
 */
function installAgentBash(agent: Agent): void {
  const cwd = agent.session.header.cwd
  if (cwd === undefined || parseWslUncPath(cwd) === undefined) return
  agent.ctx.inject(['tools', 'subprocess'], ctx => {
    ctx.tools.register(createWslCommandTool(ctx, 'bash'))
  })
}

/** Install WSL bash shadows for current and future WSL workspace Agents. */
export function registerWslTerminal(ctx: Context): void {
  const installed = new WeakSet<Agent>()
  const installOnce = (agent: Agent): void => {
    if (installed.has(agent)) return
    const cwd = agent.session.header.cwd
    if (cwd === undefined || parseWslUncPath(cwd) === undefined) return
    installed.add(agent)
    installAgentBash(agent)
  }
  for (const agent of ctx.agents.list()) installOnce(agent)
  ctx.on('agent/created', ({ agent }) => { installOnce(agent) })
  ctx.on('agent/session-start', ({ agent }) => { installOnce(agent) })
}
