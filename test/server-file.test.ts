import type { AddressInfo, Server } from 'node:net'
import { Buffer } from 'node:buffer'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serveFile } from '../src/core/server-file'

// Keep the terminal clean: the progress bars and the consola banners are not
// what these tests are about. The log lines are recorded so tests can assert on
// the events the server reports.
const { progressLog } = vi.hoisted(() => ({ progressLog: [] as string[] }))

vi.mock('cli-progress', () => ({
  default: {
    MultiBar: class {
      create() {
        return {
          increment: vi.fn(),
          update: vi.fn(),
        }
      }

      log(message: string) {
        progressLog.push(message)
      }
    },
  },
}))

vi.mock('consola', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
    start: vi.fn(),
    success: vi.fn(),
  },
}))

function payload(size: number) {
  return Buffer.from(Array.from({ length: size }, (_, i) => i % 251))
}

/** Connects, reads until the server closes the stream, and returns the bytes. */
function receive(port: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    const chunks: Buffer[] = []
    socket.on('data', chunk => chunks.push(chunk))
    socket.on('end', () => {
      socket.destroy()
      resolve(Buffer.concat(chunks))
    })
    socket.on('error', reject)
  })
}

async function listen(server: Server) {
  if (server.listening)
    return server.address() as AddressInfo
  await new Promise<void>(resolve => server.once('listening', resolve))
  return server.address() as AddressInfo
}

let dir: string
let servers: Server[]

async function serve(content: Buffer, options: { chunksize?: number, delay?: number } = {}) {
  const file = join(dir, 'served.bin')
  await writeFile(file, content)
  const server = serveFile(0, '127.0.0.1', file, { chunksize: 1024, delay: 0, ...options }) as Server
  servers.push(server)
  const { port } = await listen(server)
  return { file, port, server }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filenet-'))
  servers = []
  progressLog.length = 0
})

afterEach(async () => {
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))))
  await rm(dir, { recursive: true, force: true })
})

describe('serveFile', () => {
  it('sends the whole file to a client', async () => {
    const content = payload(2500)
    const { port } = await serve(content)

    expect((await receive(port)).equals(content)).toBe(true)
  })

  it('sends the whole file when it fits in a single chunk', async () => {
    const content = payload(64)
    const { port } = await serve(content, { chunksize: 4096 })

    expect((await receive(port)).equals(content)).toBe(true)
  })

  it('serves every client independently', async () => {
    const content = payload(3000)
    const { port } = await serve(content, { chunksize: 512 })

    const [first, second] = await Promise.all([
      receive(port),
      receive(port),
    ])

    expect(first.equals(content)).toBe(true)
    expect(second.equals(content)).toBe(true)
  })

  it('honours the chunk size and delay options', async () => {
    const content = payload(200)
    const { port } = await serve(content, { chunksize: 50, delay: 5 })

    expect((await receive(port)).equals(content)).toBe(true)
  })

  it('throws when the file does not exist', async () => {
    expect(() => serveFile(0, '127.0.0.1', join(dir, 'missing.bin'), { delay: 0 })).toThrow()
  })

  it('keeps serving when the served file disappears mid transfer', async () => {
    const content = payload(64 * 1024)
    const { file, port } = await serve(content, { chunksize: 1024, delay: 1 })

    const socket = connect(port, '127.0.0.1')
    socket.on('error', () => {})
    await once(socket, 'data')
    await rm(file)
    await once(socket, 'close')

    await vi.waitFor(() => expect(progressLog).toContainEqual(expect.stringContaining('ERROR: 127.0.0.1')))

    // The server is still up, so it serves whatever the path holds now.
    const replacement = payload(2048)
    await writeFile(file, replacement)

    expect((await receive(port)).equals(replacement)).toBe(true)
  })

  it('keeps serving when a client aborts the transfer', async () => {
    const content = payload(64 * 1024)
    const { port } = await serve(content, { chunksize: 1024, delay: 1 })

    const socket = connect(port, '127.0.0.1')
    socket.on('error', () => {})
    await once(socket, 'data')
    // Abortive close: the server sees ECONNRESET on its side of the socket.
    socket.resetAndDestroy()

    // The abort is reported instead of taking the process down, and the server
    // goes on serving other clients.
    await vi.waitFor(() => expect(progressLog).toContainEqual(expect.stringContaining('ERROR: 127.0.0.1')))
    expect(progressLog).toContainEqual(expect.stringContaining('CLOSED: 127.0.0.1'))
    expect((await receive(port)).equals(content)).toBe(true)
  })
})
