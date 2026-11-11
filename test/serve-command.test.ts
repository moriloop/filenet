import { beforeEach, describe, expect, it, vi } from 'vitest'
import serveCommand from '../src/commands/serve'

const { serveFileMock } = vi.hoisted(() => ({
  serveFileMock: vi.fn(),
}))

vi.mock('../src/core/server-file', () => ({ serveFile: serveFileMock }))

/** citty hands the parsed args to `run`; the rest of the context is unused here. */
function run(args: Record<string, unknown>) {
  (serveCommand.run as unknown as (ctx: { args: Record<string, unknown> }) => void)({ args })
}

beforeEach(() => {
  serveFileMock.mockClear()
})

describe('serve command', () => {
  it('starts a TCP server with the documented defaults', () => {
    run({
      port: '6016',
      udp: false,
      file: '/tmp/file.mp4',
    })

    expect(serveFileMock).toHaveBeenCalledWith(6016, '0.0.0.0', '/tmp/file.mp4', {
      chunksize: 1024 * 1024,
      delay: 500,
      protocol: 'tcp',
    })
  })

  it('parses port, chunk size and delay into the library options', () => {
    run({
      port: '7000',
      udp: false,
      host: '127.0.0.1',
      chunksize: '10K',
      delay: '100',
      file: '/tmp/file.mp4',
    })

    expect(serveFileMock).toHaveBeenCalledWith(7000, '127.0.0.1', '/tmp/file.mp4', {
      chunksize: 10 * 1024,
      delay: 100,
      protocol: 'tcp',
    })
  })

  it('accepts a decimal chunk size', () => {
    run({
      port: '6016',
      udp: false,
      host: '0.0.0.0',
      chunksize: '1.5M',
      delay: '500',
      file: '/tmp/file.mp4',
    })

    expect(serveFileMock).toHaveBeenCalledWith(6016, '0.0.0.0', '/tmp/file.mp4', {
      chunksize: 1.5 * 1024 * 1024,
      delay: 500,
      protocol: 'tcp',
    })
  })

  it('defaults UDP to loopback and a datagram-sized chunk', () => {
    run({
      port: '6016',
      udp: true,
      file: '/tmp/file.mp4',
    })

    expect(serveFileMock).toHaveBeenCalledWith(6016, '127.0.0.1', '/tmp/file.mp4', {
      chunksize: 1400,
      delay: 0,
      protocol: 'udp',
    })
  })

  it('keeps an explicit host, chunk size and delay for UDP', () => {
    run({
      port: '7000',
      udp: true,
      host: '0.0.0.0',
      chunksize: '8K',
      delay: '25',
      file: '/tmp/file.mp4',
    })

    expect(serveFileMock).toHaveBeenCalledWith(7000, '0.0.0.0', '/tmp/file.mp4', {
      chunksize: 8 * 1024,
      delay: 25,
      protocol: 'udp',
    })
  })
})
