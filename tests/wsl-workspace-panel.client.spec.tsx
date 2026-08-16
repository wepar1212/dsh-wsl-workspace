// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type { WslWorkspacePanelProps } from '../src/client/WslWorkspacePanel.tsx'
import { WslWorkspacePanel } from '../src/client/WslWorkspacePanel.tsx'
import { zh } from '../src/client/locales.ts'
import { createWslWorkspaceStore } from '../src/client/store.ts'

// The published runtime /client entry is a browser module-loader bundle. The
// component test needs only defineStore, so provide the same small observable
// contract without booting the DSH browser shell.
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  defineStore: (definition: {
    init: () => Record<string, unknown>
    actions: Record<string, (draft: Record<string, unknown>, ...args: unknown[]) => void>
  }) => ({
    create: () => {
      let state = definition.init()
      const listeners = new Set<() => void>()
      const actions = Object.fromEntries(Object.entries(definition.actions).map(([name, mutate]) => [
        name,
        (...args: unknown[]) => {
          const draft = { ...state }
          mutate(draft, ...args)
          state = draft
          for (const listener of listeners) listener()
        },
      ]))
      const getSnapshot = () => state
      const subscribe = (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      }
      return {
        getSnapshot,
        subscribe,
        store: {
          getSnapshot,
          subscribe,
        },
        actions,
      }
    },
  }),
}))

afterEach(cleanup)

const t: WslWorkspacePanelProps['t'] = (key, params) => {
  let value = zh[key]
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement))
  }
  return value
}

function mount(overrides: Partial<WslWorkspacePanelProps> = {}) {
  const store = createWslWorkspaceStore().create()
  const listDistributions = vi.fn(async () => ({
    available: true,
    distributions: ['Ubuntu'],
    message: null,
  }))
  const listDirectory = vi.fn(async (_distribution: string, linuxPath: string) => ({
    distribution: 'Ubuntu',
    linuxPath,
    parentLinuxPath: linuxPath === '/' ? null : '/',
    windowsPath: linuxPath === '/home'
      ? '\\\\wsl.localhost\\Ubuntu\\home'
      : '\\\\wsl.localhost\\Ubuntu',
    directories: linuxPath === '/' ? [{ name: 'home', linuxPath: '/home' }] : [],
    truncated: false,
  }))
  const addWorkspace = vi.fn(async () => {})
  const props: WslWorkspacePanelProps = {
    wide: true,
    useSessions: vi.fn() as never,
    useWorkspaces: vi.fn() as never,
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    listDistributions,
    listDirectory,
    addWorkspace,
    t,
    ...overrides,
  }
  render(<WslWorkspacePanel {...props} />)
  return { store, listDistributions, listDirectory, addWorkspace }
}

describe('WslWorkspacePanel', () => {
  it('does not inspect WSL until the user enables the switch', async () => {
    const mounted = mount()
    fireEvent.click(screen.getByRole('button', { name: zh['trigger.aria'] }))
    expect(mounted.listDistributions).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('switch', { name: zh.enable }))
    await waitFor(() => { expect(mounted.listDirectory).toHaveBeenCalledWith('Ubuntu', '/') })
    expect(mounted.store.store.getSnapshot().enabled).toBe(true)
  })

  it('browses a WSL directory and registers its UNC path as a workspace', async () => {
    const mounted = mount()
    fireEvent.click(screen.getByRole('button', { name: zh['trigger.aria'] }))
    fireEvent.click(screen.getByRole('switch', { name: zh.enable }))
    await screen.findByRole('button', { name: 'home' })

    fireEvent.click(screen.getByRole('button', { name: 'home' }))
    await waitFor(() => { expect(screen.getByDisplayValue('/home')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: zh.add }))

    await waitFor(() => {
      expect(mounted.addWorkspace).toHaveBeenCalledWith('\\\\wsl.localhost\\Ubuntu\\home')
    })
  })

  it('shows Host-reported unavailability without opening a directory', async () => {
    const listDistributions = vi.fn(async () => ({
      available: false,
      distributions: [],
      message: 'No WSL distribution is installed.',
    }))
    const mounted = mount({ listDistributions })
    fireEvent.click(screen.getByRole('button', { name: zh['trigger.aria'] }))
    fireEvent.click(screen.getByRole('switch', { name: zh.enable }))

    expect(await screen.findByText('No WSL distribution is installed.')).toBeTruthy()
    expect(mounted.listDirectory).not.toHaveBeenCalled()
  })
})
