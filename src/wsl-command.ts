/** Model-facing WSL command bridge for WSL-backed workspaces. */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, TerminalCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { WslWorkspaceTarget } from './wsl.ts'
import { normalizeLinuxPath, parseWslUncPath, validateDistributionName } from './wsl.ts'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 900_000
const OUTPUT_MAX_BYTES = 256 * 1024
const OUTPUT_SPILL_MAX_BYTES = 2 * 1024 * 1024

interface WslBashArgs {
  command: string
  description?: string
  distribution?: string
  workdir?: string
  timeoutMs?: number
}

interface AgentWithCwd {
  session?: { header?: { cwd?: string } }
}

interface AssemblyWithAgent {
  agent?: AgentWithCwd
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function targetFromPath(value: string | undefined): WslWorkspaceTarget | undefined {
  if (value === undefined || value.trim() === '') return undefined
  return parseWslUncPath(value)
}

function resolveTarget(args: WslBashArgs, exec: ToolExecution): WslWorkspaceTarget {
  const sessionCwd = exec.agent?.session.header.cwd
  const sessionTarget = targetFromPath(sessionCwd)
  const requestedWorkdir = args.workdir?.trim()
  const requestedTarget = targetFromPath(requestedWorkdir)
  const explicitDistribution = args.distribution === undefined
    ? undefined
    : validateDistributionName(args.distribution)

  if (requestedWorkdir !== undefined && requestedTarget === undefined && !requestedWorkdir.startsWith('/')) {
    throw new Error('WSL workdir must be an absolute Linux path or a WSL UNC workspace path')
  }

  const distribution = explicitDistribution ?? requestedTarget?.distribution ?? sessionTarget?.distribution
  if (distribution === undefined) {
    throw new Error('No WSL distribution is selected; enable a WSL workspace or provide distribution')
  }
  if (explicitDistribution !== undefined && requestedTarget !== undefined
    && explicitDistribution !== requestedTarget.distribution) {
    throw new Error('distribution does not match the requested WSL workspace path')
  }

  const linuxPath = requestedTarget?.linuxPath
    ?? (requestedWorkdir === undefined ? sessionTarget?.linuxPath : normalizeLinuxPath(requestedWorkdir))
    ?? '/'
  return { distribution, linuxPath }
}

function resolveTimeout(value: number | undefined): number {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`timeoutMs must be an integer between 1 and ${MAX_TIMEOUT_MS}`)
  }
  return timeoutMs
}

function formatResult(
  stdout: string,
  stderr: string,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  timedOut: boolean,
  timeoutMs: number,
): string {
  const body = [
    stdout.trimEnd(),
    stderr.trimEnd() === '' ? '' : `[stderr]\n${stderr.trimEnd()}`,
  ].filter(Boolean).join('\n')
  const status = timedOut
    ? `[timed out after ${timeoutMs} ms]`
    : signal === null
      ? `[exit code: ${exitCode ?? 1}]`
      : `[killed by signal: ${signal}]`
  return body === '' ? status : `${body}\n${status}`
}

export function createWslCommandTool(ctx: Context, toolName = 'wsl_bash') {
  return defineTool({
    name: toolName,
    description: 'Execute a bash command inside the Ubuntu/WSL distribution of the current WSL workspace. Use this instead of bash or pwsh for project commands in a WSL workspace.',
    parameters: {
      command: { type: 'string', required: true, description: 'The bash command to execute inside WSL.' },
      description: {
        type: 'string',
        description: 'Clear, concise description of what this command does in active voice, 5-10 words.',
      },
      distribution: { type: 'string', description: 'Optional WSL distribution name; defaults to the current WSL workspace.' },
      workdir: { type: 'string', description: 'Optional absolute Linux path or WSL UNC workspace path.' },
      timeoutMs: { type: 'number', description: `Timeout in milliseconds, from 1 to ${MAX_TIMEOUT_MS}.` },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args: WslBashArgs, exec: ToolExecution) {
      if (process.platform !== 'win32') throw new Error('WSL commands require a Windows Host')
      if (args.command.trim() === '') throw new Error('command must be a non-empty string')
      if (toolName === 'wsl_bash' && (args.description === undefined || args.description.trim() === '')) {
        throw new Error('description must be a non-empty string')
      }
      const target = resolveTarget(args, exec)
      const timeoutMs = resolveTimeout(args.timeoutMs)
      const timeoutController = new AbortController()
      const timeout = setTimeout(() => timeoutController.abort(new Error('WSL command timed out')), timeoutMs)
      const signal = AbortSignal.any([exec.signal, timeoutController.signal])
      let handle: SubprocessHandle
      try {
        handle = ctx.subprocess.spawn({
          argv: [
            'wsl.exe', '--distribution', target.distribution,
            '--cd', target.linuxPath, '--', 'bash', '-lc', args.command,
          ],
          cwd: process.cwd(),
          stdio: {
            stdin: 'ignore',
            stdout: { maxBytes: OUTPUT_MAX_BYTES, spill: { maxBytes: OUTPUT_SPILL_MAX_BYTES } },
            stderr: { maxBytes: OUTPUT_MAX_BYTES, spill: { maxBytes: OUTPUT_SPILL_MAX_BYTES } },
          },
          graceMs: 1_000,
          signal,
        })
        const outcome = await handle.done
        const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
        const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
        return formatResult(
          stdout,
          stderr,
          outcome.exitCode,
          outcome.signal,
          timeoutController.signal.aborted && !exec.signal.aborted,
          timeoutMs,
        )
      } catch (error) {
        if (exec.signal.aborted) throw error
        if (timeoutController.signal.aborted) throw new Error(`WSL command timed out after ${timeoutMs} ms`)
        throw new Error(`WSL command failed: ${errorMessage(error)}`)
      } finally {
        clearTimeout(timeout)
      }
    },
    presentCall: (args: WslBashArgs): TerminalCallView | GenericCallView => ({
      card: 'terminal',
      title: args.command,
      ...args.description === undefined ? {} : { description: args.description },
      ...args.workdir === undefined ? {} : { cwd: args.workdir },
    }),
  })
}

/** Register the WSL command tool and workspace-aware model guidance. */
export function registerWslCommandBridge(ctx: Context): void {
  ctx.effect(() => ctx.tools.register(createWslCommandTool(ctx)), 'wsl-workspace: wsl_bash tool')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'tool:wsl-bash',
    order: 106,
    text: context => {
      const cwd = (context as AssemblyWithAgent).agent?.session?.header?.cwd
      const target = targetFromPath(cwd)
      if (target === undefined) return ''
      return `The current workspace is inside WSL distribution "${target.distribution}" at "${target.linuxPath}". Use the bash tool (routed to WSL in this workspace) or wsl_bash for project commands; do not use the Windows bash or pwsh tool for this workspace.`
    },
  }), 'wsl-workspace: WSL command guidance')
}
