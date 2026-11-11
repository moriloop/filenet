import { describe, expect, it } from 'vitest'
import { sendFile, serveFile } from '../src'

describe('library entry point', () => {
  it('exports serveFile', () => {
    expect(serveFile).toBeTypeOf('function')
  })

  it('exports sendFile', () => {
    expect(sendFile).toBeTypeOf('function')
  })
})
