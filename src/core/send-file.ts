import type { Socket as DatagramSocket } from 'node:dgram'
import type { Socket } from 'node:net'
import type { ServeProtocol } from './server-file.js'
import type { HostPort } from './util.js'
import { createSocket } from 'node:dgram'
import { lookup } from 'node:dns/promises'
import fs from 'node:fs'
import { createConnection } from 'node:net'
import { setTimeout as delayMs } from 'node:timers/promises'
import consola from 'consola'
import { readFileChunk } from './chunk-reader.js'
import { DatagramChunker } from './datagram-chunker.js'
import { ProgressBars } from './progress-bars.js'
import { assertUdpChunkSize } from './udp.js'
import { getPeerName, humanFileSize } from './util.js'

const TCP_DEFAULT_CHUNK_SIZE = 1024 * 1024
const TCP_DEFAULT_DELAY = 1000
const UDP_DEFAULT_CHUNK_SIZE = 1400
const UDP_DEFAULT_DELAY = 0
const CONNECTION_CLOSED = 'the connection closed before the whole file was sent'

export interface SendFileParams {
  chunksize?: number
  delay?: number
  /** Transport to send over. Defaults to `tcp`. */
  protocol?: ServeProtocol
}

/**
 * Sends `fileToSend` to a single peer, with the same chunking and delay
 * controls as `serveFile`. The transfer starts immediately instead of waiting
 * for a client, and ends when the file has been sent: TCP closes the
 * connection, UDP simply stops sending datagrams.
 */
export async function sendFile(target: HostPort, fileToSend: string, params?: SendFileParams): Promise<void> {
  const protocol = params?.protocol ?? 'tcp'
  const isUdp = protocol === 'udp'
  const chunkSize = params?.chunksize ?? (isUdp ? UDP_DEFAULT_CHUNK_SIZE : TCP_DEFAULT_CHUNK_SIZE)
  const delay = params?.delay ?? (isUdp ? UDP_DEFAULT_DELAY : TCP_DEFAULT_DELAY)

  assertTarget(target)
  if (isUdp)
    assertUdpChunkSize(chunkSize)
  else if (!Number.isInteger(chunkSize) || chunkSize <= 0)
    throw new RangeError(`TCP chunk size must be a positive integer, got ${chunkSize}`)

  // Fail before the first byte is sent, not halfway through the transfer.
  const fileSize = fs.statSync(fileToSend).size
  const peerName = getPeerName({ address: target.host, port: target.port })
  const progressBars = new ProgressBars()
  progressBars.add(peerName, Math.ceil(fileSize / chunkSize))

  consola.start(`${isUdp ? 'UDP' : 'TCP'} File Client is sending to ${peerName}`)
  consola.start(`Chunk Size: ${humanFileSize(chunkSize)} | Delay (between each chunk): ${delay} ms`)
  consola.success(`File: ${fileToSend} | Size: ${humanFileSize(fileSize)} \n`)

  const reportProgress = (position: number) => progressBars.increment(peerName, {
    humanSize: humanFileSize(position),
    status: 'Working',
  })

  try {
    if (isUdp)
      await sendFileUdp(target, fileToSend, chunkSize, delay, reportProgress)
    else
      await sendFileTcp(target, fileToSend, chunkSize, delay, reportProgress)
  }
  catch (error) {
    progressBars.update(peerName, { status: 'Error' })
    progressBars.stop()
    throw error
  }

  progressBars.update(peerName, { status: '✔ Done' })
  // Outside a TTY no bar is drawn, so the final line is the only confirmation.
  if (!progressBars.stop())
    consola.success(`Sent ${humanFileSize(fileSize)} to ${peerName}`)
}

function assertTarget(target: HostPort) {
  if (target.host.trim() === '')
    throw new Error('Target host must not be empty')
  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535)
    throw new RangeError(`Target port must be an integer between 1 and 65535, got ${target.port}`)
}

async function sendFileTcp(target: HostPort, file: string, chunkSize: number, delay: number, onProgress: (position: number) => void) {
  const socket = createConnection({ host: target.host, port: target.port })

  // Node rethrows an unhandled 'error' event, so a refused or reset connection
  // would take the whole process down. Record it and let the transfer report it.
  let socketError: Error | undefined
  socket.on('error', (error) => {
    socketError = error
  })

  try {
    await waitForConnect(socket, () => socketError)
    await writeChunks(socket, file, chunkSize, delay, onProgress, () => socketError)

    if (socket.destroyed)
      throw socketError ?? new Error(CONNECTION_CLOSED)

    // 'finish' means every byte was flushed to the kernel, which is what makes
    // the transfer complete. Destroying right after end() could drop the tail.
    socket.end()
    await waitForFinish(socket)
  }
  finally {
    socket.destroy()
  }
}

/** Waits for the writable side to drain. A connection that closes first fails. */
function waitForFinish(socket: Socket) {
  return new Promise<void>((resolve, reject) => {
    function onFinish() {
      socket.off('close', onClose)
      resolve()
    }

    function onClose() {
      socket.off('finish', onFinish)
      reject(new Error(CONNECTION_CLOSED))
    }

    socket.once('finish', onFinish)
    socket.once('close', onClose)
  })
}

function waitForConnect(socket: Socket, errorOf: () => Error | undefined) {
  return new Promise<void>((resolve, reject) => {
    function onConnect() {
      socket.off('close', onClose)
      resolve()
    }

    function onClose() {
      socket.off('connect', onConnect)
      reject(errorOf() ?? new Error('the connection closed before it was established'))
    }

    socket.once('connect', onConnect)
    socket.once('close', onClose)
  })
}

async function writeChunks(socket: Socket, file: string, chunkSize: number, delay: number, onProgress: (position: number) => void, errorOf: () => Error | undefined) {
  let position = 0

  while (true) {
    const { buffer, done } = await readFileChunk(file, position, chunkSize)

    if (buffer.byteLength > 0) {
      await writeChunk(socket, buffer)
      position += buffer.byteLength
      onProgress(position)
    }

    if (done)
      return

    if (socket.destroyed)
      throw errorOf() ?? new Error(CONNECTION_CLOSED)

    if (delay > 0)
      await delayMs(delay)
  }
}

/**
 * Writes one chunk and waits until the socket has accepted it, so a slow
 * receiver slows the sender down instead of growing the socket buffer.
 */
function writeChunk(socket: Socket, buffer: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    socket.write(buffer, (error) => {
      if (error) {
        reject(error)
        return
      }
      if (socket.destroyed) {
        reject(new Error(CONNECTION_CLOSED))
        return
      }
      resolve()
    })
  })
}

async function sendFileUdp(target: HostPort, file: string, chunkSize: number, delay: number, onProgress: (position: number) => void) {
  // The address family decides the socket type, and resolving once avoids a
  // DNS lookup per datagram.
  const { address, family } = await lookup(target.host)
  const socket = createSocket(family === 6
    ? 'udp6'
    : 'udp4')

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const finish = (error?: unknown) => {
        if (settled)
          return
        settled = true
        if (error === undefined)
          resolve()
        else
          reject(error)
      }

      const chunker = new DatagramChunker({
        file,
        chunkSize,
        delay,
        send: buffer => sendDatagram(socket, address, target.port, buffer),
        progress: onProgress,
        onComplete: () => finish(),
        onError: error => finish(error),
      })

      // A datagram sent to a closed port can come back as ICMP port
      // unreachable, which Node reports as an error event on the socket
      // instead of as a send failure. Without a listener it would crash the
      // process.
      socket.on('error', (error) => {
        chunker.stop()
        finish(error)
      })

      chunker.start()
    })
  }
  finally {
    // The first send binds the socket implicitly, so an empty file leaves it
    // unbound and close() throws.
    try {
      socket.close()
    }
    catch {
      // Nothing was sent, so there is no socket to close.
    }
  }
}

function sendDatagram(socket: DatagramSocket, address: string, port: number, buffer: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    socket.send(buffer, port, address, (error) => {
      if (error)
        reject(error)
      else
        resolve()
    })
  })
}
