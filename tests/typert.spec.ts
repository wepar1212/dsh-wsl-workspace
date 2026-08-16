import { describe, expect, it } from 'vitest'
import { TYPERT } from '../src/typert.host.ts'
import { TYPERT_REMOTE } from '../src/typert.remote-client.ts'

describe('WSL Typert wire contract', () => {
  it('keeps Host and browser invocation identifiers identical', () => {
    expect(TYPERT.package).toBe('dsh-wsl-workspace')
    expect(TYPERT.face).toBe('host')
    expect(TYPERT_REMOTE.package).toBe('dsh-wsl-workspace')
    expect(TYPERT_REMOTE.descriptors.map(descriptor => descriptor.id))
      .toEqual(TYPERT.invocations.map(invocation => invocation.id))
  })

  it('publishes strict runtime schemas for every wire value', () => {
    for (const invocation of TYPERT.invocations) {
      expect(invocation.result.mode).toBe('strict')
      expect(invocation.result.schema.safeParse).toBeTypeOf('function')
      for (const parameter of invocation.parameters) {
        expect(parameter.codec.mode).toBe('strict')
        expect(parameter.codec.schema.safeParse).toBeTypeOf('function')
      }
    }
  })
})
