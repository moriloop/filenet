import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatagramChunker } from '../src/core/datagram-chunker'

/** Deterministic payload so a failed comparison points at a byte offset. */
function payload(size: number) {
  return Buffer.from(Array.from({ length: size }, (_, i) => i % 251))
}

let dir: string

async function fixture(content: Buffer) {
  const file = join(dir, 'fixture.bin')
  await writeFile(file, content)
  return file
}

async function startChunker(content: Buffer, chunkSize: number, options: { delay?: number, failAt?: number } = {}) {
  const file = await fixture(content)
  const sent: Buffer[] = []
  const progress: number[] = []
  const completions: number[] = []
  const errors: unknown[] = []

  const chunker = new DatagramChunker({
    file,
    chunkSize,
    delay: options.delay ?? 0,
    send: async (buffer) => {
      if (options.failAt !== undefined && sent.length === options.failAt)
        throw new Error('send failed')
      sent.push(Buffer.from(buffer))
    },
    progress: position => progress.push(position),
    onComplete: position => completions.push(position),
    onError: error => errors.push(error),
  })

  chunker.start()

  return {
    chunker,
    completions,
    errors,
    file,
    progress,
    sent,
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filenet-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('datagramChunker', () => {
  it('sends a short file in one datagram and completes', async () => {
    const content = payload(14)
    const { completions, errors, progress, sent } = await startChunker(content, 1024)

    await vi.waitFor(() => expect(completions).toEqual([14]))

    expect(sent.map(chunk => chunk.byteLength)).toEqual([14])
    expect(Buffer.concat(sent).equals(content)).toBe(true)
    expect(progress).toEqual([14])
    expect(errors).toEqual([])
  })

  it('sends one datagram per chunk', async () => {
    const content = payload(2500)
    const { completions, progress, sent } = await startChunker(content, 1000)

    await vi.waitFor(() => expect(completions).toEqual([2500]))

    expect(sent.map(chunk => chunk.byteLength)).toEqual([1000, 1000, 500])
    expect(Buffer.concat(sent).equals(content)).toBe(true)
    expect(progress).toEqual([1000, 2000, 2500])
  })

  it('does not send an empty datagram when the file size is a multiple of the chunk size', async () => {
    const content = payload(2000)
    const { completions, progress, sent } = await startChunker(content, 1000)

    await vi.waitFor(() => expect(completions).toEqual([2000]))

    expect(sent.map(chunk => chunk.byteLength)).toEqual([1000, 1000])
    expect(progress).toEqual([1000, 2000])
  })

  it('completes without sending anything for an empty file', async () => {
    const { completions, progress, sent } = await startChunker(payload(0), 1000)

    await vi.waitFor(() => expect(completions).toEqual([0]))

    expect(sent).toEqual([])
    expect(progress).toEqual([])
  })

  it('waits for the configured delay between datagrams', async () => {
    const delay = 40
    const { completions } = await startChunker(payload(3), 1, { delay })

    const startedAt = Date.now()
    await vi.waitFor(() => expect(completions).toEqual([3]))

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(delay * 2)
  })

  it('stops the transfer when stopped', async () => {
    const { chunker, sent } = await startChunker(payload(10_000), 1000, { delay: 20 })

    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0), { interval: 5 })
    chunker.stop()
    const sentAtStop = sent.length
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(sent.length).toBe(sentAtStop)
  })

  it('reports a send failure instead of rejecting', async () => {
    const { completions, errors, sent } = await startChunker(payload(3000), 1000, { failAt: 1 })

    await vi.waitFor(() => expect(errors).toHaveLength(1))

    expect((errors[0] as Error).message).toBe('send failed')
    expect(sent.map(chunk => chunk.byteLength)).toEqual([1000])
    expect(completions).toEqual([])
  })

  it('reports a read failure instead of rejecting', async () => {
    const { errors, file, sent } = await startChunker(payload(10_000), 1000, { delay: 20 })

    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0), { interval: 5 })
    await rm(file)
    await vi.waitFor(() => expect(errors).toHaveLength(1))

    expect((errors[0] as NodeJS.ErrnoException).code).toBe('ENOENT')
  })
})
