import type { Socket as DatagramSocket } from 'node:dgram'
import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createSocket } from 'node:dgram'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
    info: vi.fn(),
    log: vi.fn(),
    start: vi.fn(),
    success: vi.fn(),
  },
}))

function payload(size: number) {
  return Buffer.from(Array.from({ length: size }, (_, i) => i % 251))
}

/**
 * Collects datagrams on a bound client. UDP has no EOF, so the expected count
 * is the only end signal.
 */
function collect(client: DatagramSocket, expectedDatagrams: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    const timer = setTimeout(() => {
      reject(new Error(`timed out after ${chunks.length}/${expectedDatagrams} datagrams`))
    }, 5000)

    client.on('message', (message) => {
      chunks.push(Buffer.from(message))
      if (chunks.length === expectedDatagrams) {
        clearTimeout(timer)
        resolve(Buffer.concat(chunks))
      }
    })

    client.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

/** Binds a client, sends a trigger datagram, then collects the response. */
function receive(port: number, expectedDatagrams: number, trigger = Buffer.from('go')) {
  const client = createSocket('udp4')
  const received = collect(client, expectedDatagrams)
  client.bind(0, '127.0.0.1', () => {
    client.send(trigger, port, '127.0.0.1')
  })
  return received.finally(() => client.close())
}

let dir: string
let servers: DatagramSocket[]

async function serve(content: Buffer, options: { chunksize?: number, delay?: number } = {}) {
  const file = join(dir, 'served.bin')
  await writeFile(file, content)
  const server = serveFile(0, '127.0.0.1', file, {
    protocol: 'udp',
    chunksize: 1024,
    delay: 0,
    ...options,
  }) as DatagramSocket
  servers.push(server)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return { file, port, server }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filenet-'))
  servers = []
  progressLog.length = 0
})

afterEach(async () => {
  await Promise.all(servers.map(server => new Promise<void>((resolve) => {
    server.close(() => resolve())
  })))
  await rm(dir, { recursive: true, force: true })
})

describe('serveFile over UDP', () => {
  it('streams the whole file after any datagram', async () => {
    const content = payload(2500)
    const { port } = await serve(content)

    expect((await receive(port, 3, Buffer.from('anything'))).equals(content)).toBe(true)
  })

  it('sends exactly ceil(size / chunkSize) datagrams for an exact multiple', async () => {
    const content = payload(2048)
    const { port } = await serve(content, { chunksize: 1024 })

    expect((await receive(port, 2)).equals(content)).toBe(true)
  })

  it('serves every peer independently', async () => {
    const content = payload(3000)
    const { port } = await serve(content, { chunksize: 512 })

    const [first, second] = await Promise.all([
      receive(port, 6),
      receive(port, 6),
    ])

    expect(first.equals(content)).toBe(true)
    expect(second.equals(content)).toBe(true)
  })

  it('reports the transfer as done', async () => {
    const content = payload(500)
    const { port } = await serve(content, { chunksize: 512 })

    await receive(port, 1)

    await vi.waitFor(() => expect(progressLog).toContainEqual(expect.stringContaining('DONE: 127.0.0.1')))
  })

  it('rejects a chunk size larger than a UDP datagram', async () => {
    const file = join(dir, 'served.bin')
    await writeFile(file, payload(10))

    expect(() => serveFile(0, '127.0.0.1', file, { protocol: 'udp', chunksize: 65_508 })).toThrow(RangeError)
  })
})
