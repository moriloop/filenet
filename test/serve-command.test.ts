import { beforeEach, describe, expect, it, vi } from 'vitest'
import serveCommand from '../src/commands/serve'

const { serveFileMock } = vi.hoisted(() => ({ serveFileMock: vi.fn() }))

vi.mock('../src', () => ({ serveFile: serveFileMock }))

/** citty hands the parsed args to `run`; the rest of the context is unused here. */
function run(args: Record<string, string>) {
  (serveCommand.run as unknown as (ctx: { args: Record<string, string> }) => void)({ args })
}

beforeEach(() => {
  serveFileMock.mockClear()
})

describe('serve command', () => {
  it('starts the server with the documented defaults', () => {
    run({ port: '6016', host: '0.0.0.0', chunksize: '1M', delay: '500', file: '/tmp/file.mp4' })

    expect(serveFileMock).toHaveBeenCalledWith(6016, '0.0.0.0', '/tmp/file.mp4', {
      chunksize: 1024 * 1024,
      delay: 500,
    })
  })

  it('parses port, chunk size and delay into the library options', () => {
    run({ port: '7000', host: '127.0.0.1', chunksize: '10K', delay: '100', file: '/tmp/file.mp4' })

    expect(serveFileMock).toHaveBeenCalledWith(7000, '127.0.0.1', '/tmp/file.mp4', {
      chunksize: 10 * 1024,
      delay: 100,
    })
  })

  it('accepts a decimal chunk size', () => {
    run({ port: '6016', host: '0.0.0.0', chunksize: '1.5M', delay: '500', file: '/tmp/file.mp4' })

    expect(serveFileMock).toHaveBeenCalledWith(6016, '0.0.0.0', '/tmp/file.mp4', {
      chunksize: 1.5 * 1024 * 1024,
      delay: 500,
    })
  })
})
