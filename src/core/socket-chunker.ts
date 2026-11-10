import type { Socket } from 'node:net'
import { readFileChunk } from './chunk-reader.js'
import { getSocketName } from './util.js'

export class SocketChunker {
  file: string
  chunkSize: number
  delay: number
  socket: Socket
  socketIsClosed: boolean
  progress?: (current: number) => void
  onError?: (error: unknown) => void
  _position = 0
  _socketName = ''

  constructor(socket: Socket, params: { file: string, chunkSize: number, delay: number, progress?: (current: number) => void, onError?: (error: unknown) => void }) {
    this.socket = socket
    this.socketIsClosed = false
    this.socket.on('close', (_hadError) => {
      this.socketIsClosed = true
    })
    this.file = params.file
    this.chunkSize = params.chunkSize
    this.delay = params.delay
    this.progress = params.progress
    this.onError = params.onError
    this._socketName = getSocketName(socket)
  }

  async nextChunk() {
    try {
      const { buffer, done } = await readFileChunk(this.file, this._position, this.chunkSize)

      if (this.socketIsClosed)
        return

      if (this.socket.readyState === 'open') {
        this.socket.write(buffer)
        this._position += buffer.byteLength

        this.progress && this.progress(this._position)

        if (done) {
          // end of file reached
          this.socket.end()
          this.socket.destroy()
          return
        }
      }
      setTimeout(() => this.nextChunk(), this.delay)
    }
    catch (error) {
      // A read fails if the file is deleted or replaced mid transfer. Drop this
      // client and let the caller report it: rejecting would take the whole
      // server down through an unhandled rejection.
      this.onError?.(error)
      this.socket.destroy()
    }
  }
}
