import { readFileChunk } from './chunk-reader.js'

export interface DatagramChunkerParams {
  file: string
  chunkSize: number
  delay: number
  /** Sends one datagram. Rejecting stops the transfer and reports the error. */
  send: (buffer: Uint8Array) => Promise<void>
  progress?: (position: number) => void
  onComplete?: (position: number) => void
  onError?: (error: unknown) => void
}

/**
 * Sends a file to a single UDP peer, one chunk per datagram. There is no
 * connection and no EOF datagram: the transfer simply stops after the last
 * chunk. Loss and reordering are accepted; the receiver is responsible for
 * detecting them.
 */
export class DatagramChunker {
  file: string
  chunkSize: number
  delay: number
  send: (buffer: Uint8Array) => Promise<void>
  progress?: (position: number) => void
  onComplete?: (position: number) => void
  onError?: (error: unknown) => void
  _position = 0
  stopped = false

  constructor(params: DatagramChunkerParams) {
    this.file = params.file
    this.chunkSize = params.chunkSize
    this.delay = params.delay
    this.send = params.send
    this.progress = params.progress
    this.onComplete = params.onComplete
    this.onError = params.onError
  }

  /** Starts the transfer. The returned promise is never rejected. */
  start() {
    void this.nextChunk()
  }

  stop() {
    this.stopped = true
  }

  private async nextChunk(): Promise<void> {
    try {
      const { buffer, done } = await readFileChunk(this.file, this._position, this.chunkSize)

      if (this.stopped)
        return

      // An empty read means the file size is an exact multiple of the chunk
      // size. There is nothing to send, and an empty datagram would only add
      // noise for the client.
      if (buffer.byteLength > 0) {
        await this.send(buffer)
        if (this.stopped)
          return
        this._position += buffer.byteLength
        this.progress?.(this._position)
      }

      if (done) {
        this.onComplete?.(this._position)
        return
      }

      if (this.delay > 0)
        await new Promise(resolve => setTimeout(resolve, this.delay))

      if (this.stopped)
        return

      await this.nextChunk()
    }
    catch (error) {
      this.stopped = true
      this.onError?.(error)
    }
  }
}
