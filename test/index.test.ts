import { describe, expect, it } from 'vitest'
import { serveFile } from '../src'

describe('library entry point', () => {
  it('exports serveFile', () => {
    expect(serveFile).toBeTypeOf('function')
  })
})
