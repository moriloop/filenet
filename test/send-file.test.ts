import type { Socket as DatagramSocket } from 'node:dgram'
import type { AddressInfo, Server } from 'node:net'
import { Buffer } from 'node:buffer'
import { createSocket } from 'node:dgram'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendFile } from '../src/core/send-file'

// Keep the terminal clean: the progress bars and the consola banners are not
// what these tests are about. The bar updates are recorded so tests can assert
// on the status the client reports.
const { barUpdates } = vi.hoisted(() => ({
  barUpdates: [] as Record<string, unknown>[],
}))

vi.mock('cli-progress', () => ({
  default: {
    MultiBar: class {
      isActive = false

      create() {
        this.isActive = true
        return {
          increment: vi.fn(),
          update: (values: Record<string, unknown>) => {
            barUpdates.push(values)
          },
        }
      }

      log() {
      }

      stop() {
        this.isActive = false
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

let dir: string
let servers: Server[]
let sockets: DatagramSocket[]

/** Starts a TCP server that collects everything its first client sends. */
async function tcpReceiver() {
  let resolveReceived!: (data: Buffer) => void
  const received = new Promise<Buffer>((resolve) => {
    resolveReceived = resolve
  })

  const server = createServer((socket) => {
    const chunks: Buffer[] = []
    socket.on('data', chunk => chunks.push(chunk))
    socket.on('end', () => resolveReceived(Buffer.concat(chunks)))
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  return { port: (server.address() as AddressInfo).port, received, server }
}

/** Binds a UDP socket that collects `expectedDatagrams` datagrams. */
async function udpReceiver(expectedDatagrams: number) {
  const socket = createSocket('udp4')
  sockets.push(socket)

  const received = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []

    const timer = setTimeout(() => {
      reject(new Error(`timed out after ${chunks.length}/${expectedDatagrams} datagrams`))
    }, 5000)

    socket.on('message', (message) => {
      chunks.push(Buffer.from(message))
      if (chunks.length === expectedDatagrams) {
        clearTimeout(timer)
        resolve(Buffer.concat(chunks))
      }
    })
  })

  socket.bind(0, '127.0.0.1')
  await once(socket, 'listening')

  return { port: (socket.address() as AddressInfo).port, received }
}

/** Returns a port that was bound and released, so nothing is listening on it. */
async function closedPort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
  return port
}

async function makeFile(content: Buffer) {
  const file = join(dir, 'sent.bin')
  await writeFile(file, content)
  return file
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filenet-'))
  servers = []
  sockets = []
  barUpdates.length = 0
})

afterEach(async () => {
  for (const socket of sockets)
    socket.close()
  await Promise.all(servers.map(server => new Promise<void>((resolve) => {
    server.close(() => resolve())
  })))
  await rm(dir, { recursive: true, force: true })
})

describe('sendFile', () => {
  it('sends the whole file over TCP', async () => {
    const content = payload(2500)
    const file = await makeFile(content)
    const { port, received } = await tcpReceiver()

    await sendFile({ host: '127.0.0.1', port }, file, { chunksize: 1024, delay: 0 })

    expect((await received).equals(content)).toBe(true)
  })

  it('sends the whole file when it fits in a single chunk', async () => {
    const content = payload(64)
    const file = await makeFile(content)
    const { port, received } = await tcpReceiver()

    await sendFile({ host: '127.0.0.1', port }, file, { chunksize: 4096, delay: 0 })

    expect((await received).equals(content)).toBe(true)
  })

  it('sends the whole file over UDP', async () => {
    const content = payload(2500)
    const file = await makeFile(content)
    const { port, received } = await udpReceiver(3)

    await sendFile({ host: '127.0.0.1', port }, file, {
      chunksize: 1024,
      delay: 0,
      protocol: 'udp',
    })

    expect((await received).equals(content)).toBe(true)
  })

  it('reports the transfer as done', async () => {
    const file = await makeFile(payload(500))
    const { port, received } = await tcpReceiver()

    await sendFile({ host: '127.0.0.1', port }, file, { chunksize: 512, delay: 0 })
    await received

    expect(barUpdates).toContainEqual(expect.objectContaining({ status: 'Done' }))
  })

  it('rejects when the TCP connection is refused', async () => {
    const file = await makeFile(payload(10))
    const port = await closedPort()

    await expect(sendFile({ host: '127.0.0.1', port }, file, { delay: 0 })).rejects.toThrow()
    expect(barUpdates).toContainEqual(expect.objectContaining({ status: 'Error' }))
  })

  it('rejects a missing file', async () => {
    const port = await closedPort()

    await expect(sendFile({ host: '127.0.0.1', port }, join(dir, 'missing.bin'))).rejects.toThrow()
  })

  it('rejects an invalid target port', async () => {
    const file = await makeFile(payload(10))

    await expect(sendFile({ host: '127.0.0.1', port: 0 }, file)).rejects.toThrow(RangeError)
  })

  it('rejects a UDP chunk size larger than a datagram', async () => {
    const file = await makeFile(payload(10))

    await expect(sendFile({ host: '127.0.0.1', port: 9000 }, file, {
      protocol: 'udp',
      chunksize: 65_508,
    })).rejects.toThrow(RangeError)
  })
})
