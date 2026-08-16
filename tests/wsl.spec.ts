import { describe, expect, it } from 'vitest'
import {
  decodeWslOutput, normalizeLinuxPath, parseDistributionList,
  parseWslUncPath, validateDistributionName, wslUncPath,
} from '../src/wsl.ts'

describe('WSL workspace path helpers', () => {
  it('decodes UTF-16LE and UTF-8 wsl.exe output', () => {
    expect(decodeWslOutput(Buffer.from('\uFEFFUbuntu\r\nDebian\r\n', 'utf16le'))).toContain('Ubuntu')
    expect(decodeWslOutput(Buffer.from('Ubuntu\n', 'utf8'))).toBe('Ubuntu\n')
  })

  it('parses unique non-empty distribution names in command order', () => {
    const output = Buffer.from('\uFEFFUbuntu\r\nDebian\r\nUbuntu\r\n', 'utf16le')
    expect(parseDistributionList(output)).toEqual(['Ubuntu', 'Debian'])
  })

  it('normalizes absolute Linux paths and rejects Windows or relative paths', () => {
    expect(normalizeLinuxPath('/home/user/../project')).toBe('/home/project')
    expect(() => normalizeLinuxPath('home/project')).toThrow(/absolute Linux path/)
    expect(() => normalizeLinuxPath('/home\\project')).toThrow(/absolute Linux path/)
  })

  it('keeps distribution names inside one UNC segment', () => {
    expect(validateDistributionName('Ubuntu-24.04')).toBe('Ubuntu-24.04')
    expect(() => validateDistributionName('../Ubuntu')).toThrow(/invalid WSL distribution/)
    expect(() => validateDistributionName('Ubuntu\\share')).toThrow(/invalid WSL distribution/)
  })

  it('builds modern and legacy WSL UNC paths', () => {
    expect(wslUncPath('wsl.localhost', 'Ubuntu', '/home/user/project'))
      .toBe('\\\\wsl.localhost\\Ubuntu\\home\\user\\project')
    expect(wslUncPath('wsl$', 'Ubuntu', '/')).toBe('\\\\wsl$\\Ubuntu')
  })

  it('round-trips WSL UNC workspaces into a distribution and Linux cwd', () => {
    expect(parseWslUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\project'))
      .toEqual({ distribution: 'Ubuntu', linuxPath: '/home/user/project' })
    expect(parseWslUncPath('\\\\wsl$\\Debian')).toEqual({ distribution: 'Debian', linuxPath: '/' })
    expect(parseWslUncPath('C:\\work\\project')).toBeUndefined()
  })
})
