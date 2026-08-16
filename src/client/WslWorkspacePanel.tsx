/** Sidebar action and modal directory browser for WSL workspaces. */

import { useRef, useState } from 'react'
import {
  Button, IconChevronUpOutline14, IconFolderOpenOutline16, IconLinkOutline16, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {
  WslDirectoryListing, WslDistributionSnapshot,
} from '../types.ts'
import type { createWslWorkspaceStore } from './store.ts'
import css from './WslWorkspacePanel.module.css'

/** Apply-world callbacks consumed by the WSL picker component. */
export interface WslWorkspacePanelFace {
  /** Read current WSL availability and installed distributions. */
  listDistributions: () => Promise<WslDistributionSnapshot>
  /** Read one WSL directory. */
  listDirectory: (distribution: string, linuxPath: string) => Promise<WslDirectoryListing>
  /** Register and open the selected UNC path as a DSH workspace. */
  addWorkspace: (windowsPath: string) => Promise<void>
}

/** Full props composed by the sidebar footer-action slot. */
export type WslWorkspacePanelProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsStore<ReturnType<typeof createWslWorkspaceStore>>
  & InjectFace<WslWorkspacePanelFace>
  & PropsLocale<'wslWorkspace'>

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Render the persistent WSL switch and directory-selection flow. */
export function WslWorkspacePanel({
  wide, useStore, actions, listDistributions, listDirectory, addWorkspace, t,
}: WslWorkspacePanelProps) {
  const enabled = useStore(state => state.enabled)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [snapshot, setSnapshot] = useState<WslDistributionSnapshot | null>(null)
  const [distribution, setDistribution] = useState('')
  const [pathDraft, setPathDraft] = useState('/')
  const [listing, setListing] = useState<WslDirectoryListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const readDirectory = async (nextDistribution: string, nextPath: string): Promise<void> => {
    const generation = ++request.current
    setLoading(true)
    setError(null)
    try {
      const next = await listDirectory(nextDistribution, nextPath)
      if (generation !== request.current) return
      setDistribution(next.distribution)
      setPathDraft(next.linuxPath)
      setListing(next)
    } catch (reason) {
      if (generation !== request.current) return
      setListing(null)
      setError(`${t('error.list')} ${messageOf(reason)}`)
    } finally {
      if (generation === request.current) setLoading(false)
    }
  }

  const readDistributions = async (): Promise<void> => {
    const generation = ++request.current
    setLoading(true)
    setError(null)
    setListing(null)
    try {
      const next = await listDistributions()
      if (generation !== request.current) return
      setSnapshot(next)
      const selected = next.distributions.includes(distribution)
        ? distribution
        : next.distributions[0] ?? ''
      setDistribution(selected)
      if (next.available && selected !== '') await readDirectory(selected, '/')
    } catch (reason) {
      if (generation !== request.current) return
      setSnapshot(null)
      setError(`${t('unavailable')} ${messageOf(reason)}`)
    } finally {
      if (generation === request.current) setLoading(false)
    }
  }

  const openPanel = (): void => {
    setOpen(true)
    if (enabled) void readDistributions()
  }

  const closePanel = (): void => {
    request.current += 1
    setOpen(false)
    setLoading(false)
    setAdding(false)
  }

  const toggleEnabled = (): void => {
    const next = !enabled
    actions.setEnabled(next)
    setError(null)
    if (next) void readDistributions()
    else {
      request.current += 1
      setLoading(false)
      setSnapshot(null)
      setListing(null)
    }
  }

  const addSelected = async (): Promise<void> => {
    if (listing === null || adding) return
    setAdding(true)
    setError(null)
    try {
      await addWorkspace(listing.windowsPath)
      closePanel()
    } catch (reason) {
      setError(`${t('error.add')} ${messageOf(reason)}`)
      setAdding(false)
    }
  }

  return (
    <div className={wide ? css.layer : `${css.layer} ${css.rail}`}>
      <Tooltip label={t('trigger.aria')} side="right" delayMs={500}>
        <button
          type="button"
          className={css.trigger}
          data-active={enabled || undefined}
          aria-label={t('trigger.aria')}
          aria-expanded={open}
          onClick={openPanel}
        >
          <IconLinkOutline16 size={wide ? 16 : 18} />
          {wide && <span>{t('trigger')}</span>}
        </button>
      </Tooltip>
      <Modal
        open={open}
        onClose={closePanel}
        title={t('title')}
        closeLabel={t('close')}
        description={t('description')}
        className={css.dialog ?? ''}
        contentClassName={css.content ?? ''}
        footer={(
          <>
            <Button variant="ghost" onClick={closePanel}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={!enabled || listing === null || loading || adding}
              onClick={() => { void addSelected() }}
            >
              {adding ? t('adding') : t('add')}
            </Button>
          </>
        )}
      >
        <div className={css.switchRow}>
          <div>
            <div className={css.switchTitle}>{t('enable')}</div>
            <div className={css.switchHelp}>{t('enable.help')}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('enable')}
            className={css.switch}
            data-checked={enabled || undefined}
            onClick={toggleEnabled}
          >
            <span />
          </button>
        </div>

        {enabled && (
          <div className={css.browser}>
            {loading && snapshot === null && <p className={css.note}>{t('loading')}</p>}
            {snapshot !== null && !snapshot.available && (
              <div className={css.error} role="alert">
                <span>{snapshot.message ?? t('unavailable')}</span>
                <Button size="sm" variant="outline" onClick={() => { void readDistributions() }}>{t('retry')}</Button>
              </div>
            )}
            {snapshot?.available && (
              <>
                <label className={css.field}>
                  <span>{t('distribution')}</span>
                  <select
                    value={distribution}
                    disabled={loading || adding}
                    onChange={(event) => {
                      const next = event.target.value
                      setDistribution(next)
                      setPathDraft('/')
                      void readDirectory(next, '/')
                    }}
                  >
                    {snapshot.distributions.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <div className={css.pathRow}>
                  <label className={css.field}>
                    <span>{t('path')}</span>
                    <input
                      value={pathDraft}
                      disabled={loading || adding}
                      onChange={event => { setPathDraft(event.target.value) }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void readDirectory(distribution, pathDraft)
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading || adding || distribution === ''}
                    onClick={() => { void readDirectory(distribution, pathDraft) }}
                  >
                    {t('go')}
                  </Button>
                </div>
                <div className={css.toolbar}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<IconChevronUpOutline14 />}
                    disabled={loading || adding || listing?.parentLinuxPath === null || listing === null}
                    onClick={() => {
                      if (listing?.parentLinuxPath !== null && listing?.parentLinuxPath !== undefined) {
                        void readDirectory(distribution, listing.parentLinuxPath)
                      }
                    }}
                  >
                    {t('up')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loading || adding || listing === null}
                    onClick={() => { if (listing !== null) void readDirectory(distribution, listing.linuxPath) }}
                  >
                    {t('refresh')}
                  </Button>
                </div>
                <div className={css.directoryList} aria-busy={loading}>
                  {listing?.directories.map(entry => (
                    <button
                      type="button"
                      key={entry.linuxPath}
                      disabled={loading || adding}
                      onClick={() => { void readDirectory(distribution, entry.linuxPath) }}
                    >
                      <IconFolderOpenOutline16 size={16} />
                      <span>{entry.name}</span>
                    </button>
                  ))}
                  {!loading && listing !== null && listing.directories.length === 0 && (
                    <p className={css.note}>{t('empty')}</p>
                  )}
                </div>
                {listing?.truncated && <p className={css.note}>{t('truncated')}</p>}
              </>
            )}
            {error !== null && <p className={css.error} role="alert">{error}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
