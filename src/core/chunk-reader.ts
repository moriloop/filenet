import { readChunk } from 'read-chunk'

/**
 * Reads one chunk from `file`. `done` is true when the read was short or
 * empty, which is how both transports detect the end of the file.
 */
export async function readFileChunk(file: string, position: number, chunkSize: number) {
  const buffer = await readChunk(file, { length: chunkSize, startPosition: position })
  return { buffer, done: buffer.byteLength < chunkSize }
}
