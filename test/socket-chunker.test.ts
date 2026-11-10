import type { Socket } from 'node:net'
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SocketChunker } from '../src/core/socket-chunker'

/** Deterministic payload so a failed comparison points at a byte offset. */
function payload(size: number) {
  return Buffer.from(Array.from({ length: size }, (_, i) => i % 251))
}

class FakeSocket extends EventEmitter {
  remoteAddress = '127.0.0.1'
  remotePort = 40000
  readyState = 'open'
  written: Buffer[] = []
  ended = false
  destroyed = false

  write(chunk: Buffer) {
    this.written.push(Buffer.from(chunk))
    return true
  }

  end() {
    this.ended = true
  }

  destroy() {
    this.destroyed = true
    this.readyState = 'closed'
    this.emit('close', false)
  }

  /** Simulates a client that hangs up. */
  hangUp() {
    this.readyState = 'closed'
    this.emit('close', false)
  }

  get contents() {
    return Buffer.concat(this.written)
  }
}

let dir: string

async function fixture(content: Buffer) {
  const file = join(dir, 'fixture.bin')
  await writeFile(file, content)
  return file
}

async function chunkerFor(content: Buffer, chunkSize: number, delay = 0) {
  const file = await fixture(content)
  const socket = new FakeSocket()
  const progress: number[] = []
  const errors: unknown[] = []
  const chunker = new SocketChunker(socket as unknown as Socket, {
    file,
    chunkSize,
    delay,
    progress: position => progress.push(position),
    onError: error => errors.push(error),
  })
  return {
    chunker,
    errors,
    file,
    progress,
    socket,
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filenet-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('socketChunker.nextChunk', () => {
  it('sends a short file in one chunk and then closes the socket', async () => {
    const content = payload(14)
    const { chunker, progress, socket } = await chunkerFor(content, 1024)

    await chunker.nextChunk()

    expect(socket.written.map(chunk => chunk.byteLength)).toEqual([14])
    expect(socket.contents.equals(content)).toBe(true)
    expect(socket.ended).toBe(true)
    expect(socket.destroyed).toBe(true)
    expect(progress).toEqual([14])
  })

  it('splits a file into chunkSize reads', async () => {
    const content = payload(2500)
    const { chunker, progress, socket } = await chunkerFor(content, 1000)

    await chunker.nextChunk()
    await vi.waitFor(() => expect(socket.destroyed).toBe(true))

    expect(socket.written.map(chunk => chunk.byteLength)).toEqual([1000, 1000, 500])
    expect(socket.contents.equals(content)).toBe(true)
    expect(socket.ended).toBe(true)
    expect(progress).toEqual([1000, 2000, 2500])
  })

  it('reads one empty chunk when the file size is a multiple of the chunk size', async () => {
    const content = payload(2000)
    const { chunker, socket } = await chunkerFor(content, 1000)

    await chunker.nextChunk()
    await vi.waitFor(() => expect(socket.destroyed).toBe(true))

    expect(socket.written.map(chunk => chunk.byteLength)).toEqual([1000, 1000, 0])
    expect(socket.contents.equals(content)).toBe(true)
  })

  it('waits for the configured delay between chunks', async () => {
    const delay = 40
    const { chunker, socket } = await chunkerFor(payload(3), 1, delay)

    const startedAt = Date.now()
    await chunker.nextChunk()
    await vi.waitFor(() => expect(socket.destroyed).toBe(true))

    expect(socket.contents.byteLength).toBe(3)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(delay * 2)
  })

  it('writes nothing when the socket is already closed', async () => {
    const { chunker, progress, socket } = await chunkerFor(payload(2500), 1000)

    const pending = chunker.nextChunk()
    socket.hangUp()
    await pending

    expect(socket.written).toEqual([])
    expect(progress).toEqual([])
    expect(socket.destroyed).toBe(false)
  })

  it('reports a read failure instead of rejecting', async () => {
    const { chunker, errors, file, socket } = await chunkerFor(payload(3000), 1000, 5)

    await chunker.nextChunk()
    // The file disappears while the loop is still running.
    await rm(file)
    await vi.waitFor(() => expect(socket.destroyed).toBe(true))

    expect(errors).toHaveLength(1)
    expect((errors[0] as NodeJS.ErrnoException).code).toBe('ENOENT')
    expect(socket.written.map(chunk => chunk.byteLength)).toEqual([1000])
    expect(socket.ended).toBe(false)
  })

  it('stops the loop when the socket closes mid transfer', async () => {
    const { chunker, socket } = await chunkerFor(payload(3000), 1000, 1)

    await chunker.nextChunk()
    await vi.waitFor(() => expect(socket.written.length).toBeGreaterThan(0))
    socket.hangUp()

    const writtenAtClose = socket.written.length
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(socket.written.length).toBe(writtenAtClose)
    expect(socket.ended).toBe(false)
  })
})
