import consola from 'consola'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sendCommand from '../src/commands/send'

const { sendFileMock } = vi.hoisted(() => ({
  sendFileMock: vi.fn(),
}))

vi.mock('../src/core/send-file', () => ({ sendFile: sendFileMock }))
vi.mock('consola', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    start: vi.fn(),
    success: vi.fn(),
  },
}))

/** citty hands the parsed args to `run`; the rest of the context is unused here. */
async function run(args: Record<string, unknown>) {
  await (sendCommand.run as unknown as (ctx: { args: Record<string, unknown> }) => Promise<void>)({ args })
}

beforeEach(() => {
  sendFileMock.mockReset()
  sendFileMock.mockResolvedValue(undefined)
  vi.mocked(consola.error).mockClear()
})

afterEach(() => {
  // A failed send sets the exit code; keep it from leaking between tests.
  process.exitCode = undefined
})

describe('send command', () => {
  it('sends over TCP with the documented defaults', async () => {
    await run({
      target: '127.0.0.1:9000',
      udp: false,
      tcp: false,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9000 }, '/tmp/file.mp4', {
      chunksize: 1024 * 1024,
      delay: 500,
      protocol: 'tcp',
    })
  })

  it('parses chunk size and delay into the library options', async () => {
    await run({
      target: '192.168.1.50:9000',
      udp: false,
      tcp: false,
      chunksize: '2K',
      delay: '300',
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).toHaveBeenCalledWith({ host: '192.168.1.50', port: 9000 }, '/tmp/file.mp4', {
      chunksize: 2048,
      delay: 300,
      protocol: 'tcp',
    })
  })

  it('defaults UDP to a datagram-sized chunk and no delay', async () => {
    await run({
      target: '127.0.0.1:9000',
      udp: true,
      tcp: false,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9000 }, '/tmp/file.mp4', {
      chunksize: 1400,
      delay: 0,
      protocol: 'udp',
    })
  })

  it('accepts --tcp as an explicit default', async () => {
    await run({
      target: '127.0.0.1:9000',
      udp: false,
      tcp: true,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9000 }, '/tmp/file.mp4', expect.objectContaining({ protocol: 'tcp' }))
  })

  it('parses a bracketed IPv6 target', async () => {
    await run({
      target: '[::1]:9000',
      udp: true,
      tcp: false,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).toHaveBeenCalledWith({ host: '::1', port: 9000 }, '/tmp/file.mp4', expect.objectContaining({ protocol: 'udp' }))
  })

  it('rejects both --tcp and --udp', async () => {
    await run({
      target: '127.0.0.1:9000',
      udp: true,
      tcp: true,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).not.toHaveBeenCalled()
    expect(consola.error).toHaveBeenCalledWith('Pass either --tcp or --udp, not both')
    expect(process.exitCode).toBe(1)
  })

  it('reports an invalid target', async () => {
    await run({
      target: '127.0.0.1',
      udp: false,
      tcp: false,
      file: '/tmp/file.mp4',
    })

    expect(sendFileMock).not.toHaveBeenCalled()
    expect(consola.error).toHaveBeenCalledWith(expect.stringContaining('Invalid target'))
    expect(process.exitCode).toBe(1)
  })

  it('reports a failed send without a stack trace', async () => {
    sendFileMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:9000'))

    await run({
      target: '127.0.0.1:9000',
      udp: false,
      tcp: false,
      file: '/tmp/file.mp4',
    })

    expect(consola.error).toHaveBeenCalledWith('connect ECONNREFUSED 127.0.0.1:9000')
    expect(process.exitCode).toBe(1)
  })
})
