import type { Socket as DatagramSocket, RemoteInfo } from 'node:dgram'
import type { Server, Socket } from 'node:net'
import type { HostPort } from './util.js'
import { createSocket } from 'node:dgram'
import fs from 'node:fs'
import { createServer } from 'node:net'
import consola from 'consola'
import { DatagramChunker } from './datagram-chunker.js'
import { ProgressBars } from './progress-bars.js'
import { SocketChunker } from './socket-chunker.js'
import { errorMessage, getPeerName, getSocketName, humanFileSize } from './util.js'

const TCP_DEFAULT_CHUNK_SIZE = 1024 * 1024
const TCP_DEFAULT_DELAY = 1000
const UDP_DEFAULT_CHUNK_SIZE = 1400
const UDP_DEFAULT_DELAY = 0
/** Largest IPv4 UDP payload: 65535 - 20 (IP header) - 8 (UDP header). */
const UDP_MAX_PAYLOAD = 65_507

export type ServeProtocol = 'tcp' | 'udp'

export interface ServeFileParams {
  chunksize?: number
  delay?: number
  /** Transport to serve on. Defaults to `tcp`. */
  protocol?: ServeProtocol
  /**
   * UDP only. Start sending to this peer as soon as the socket is bound, so the
   * receiver does not have to send a datagram first. The receiver must be bound
   * before the server starts, or the first datagrams are lost.
   */
  target?: HostPort
}

/** `net.Server` for TCP, `dgram.Socket` for UDP. */
export type FileServer = Server | DatagramSocket

export function serveFile(serverPort: number, serverHost: string, fileToServe: string, params?: ServeFileParams): FileServer {
  const protocol = params?.protocol ?? 'tcp'
  if (params?.target && protocol !== 'udp')
    throw new Error('target is only supported with the udp protocol')
  return protocol === 'udp'
    ? serveFileUdp(serverPort, serverHost, fileToServe, params)
    : serveFileTcp(serverPort, serverHost, fileToServe, params)
}

function serveFileTcp(serverPort: number, serverHost: string, fileToServe: string, params?: ServeFileParams): Server {
  const chunkSize = params?.chunksize ?? TCP_DEFAULT_CHUNK_SIZE
  const delay = params?.delay ?? TCP_DEFAULT_DELAY

  const port = serverPort ?? 7070
  const host = serverHost ?? '127.0.0.1'
  const file = fileToServe ?? '/tmp/file'

  const fileStat = fs.statSync(file)
  const fileSize = fileStat.size

  const server = createServer()
  const sockets: Socket[] = []

  const progressBars = new ProgressBars()

  server.listen(port, host, () => {
    consola.start(`TCP File Server is running on ${host}:${port}`)
    consola.start(`Chunk Size: ${humanFileSize(chunkSize)} | Delay (between each chunk): ${delay} ms`)
    consola.success(`File: ${file} | Size: ${humanFileSize(fileSize)} \n`)

  // rl.question(`write close/exist to terminate the server.\n`, async (txt) => {
  //   consola.log(txt)
  //   if (txt === 'close') {
  //     consola.log(`Server is terminating...`)
  //     for (const sock of sockets) {
  //       consola.log('closing sockets ')
  //       sock.destroy()
  //     }
  //     server.close()
  //   }
  // })
  })

  server.on('close', () => {
  })

  server.on('connection', (sock) => {
    const clientName = getSocketName(sock)
    sockets.push(sock)

    progressBars.add(clientName, Math.ceil(fileSize / chunkSize))

    const chunker = new SocketChunker(
      sock, //
      {
        file,
        chunkSize,
        delay, //
        progress: humanSize => progressBars.increment(clientName, {
          humanSize: humanFileSize(humanSize),
          status: 'Working',
        }),
        onError: error => progressBars.log(`ERROR: ${clientName} | ${errorMessage(error)}`),
      },
    )
    chunker.nextChunk()

    sock.on('data', () => {
    // consola.log(`DATA received by client ${sock.remoteAddress}: ${data}`)
    })

    // A client that aborts the transfer (RST, killed process) makes the socket
    // emit ECONNRESET or EPIPE. Node rethrows an unhandled 'error' event, which
    // takes the whole server down, so every socket needs a listener.
    sock.on('error', (error) => {
      progressBars.log(`ERROR: ${clientName} | ${errorMessage(error)}`)
    })

    // Add a 'close' event handler to this instance of socket
    sock.on('close', (_hadError) => {
      const index = sockets.indexOf(sock)
      if (index !== -1)
        sockets.splice(index, 1)
      // clientName was captured while the socket was still connected: after
      // destroy, remoteAddress and remotePort are gone.
      progressBars.update(clientName, { status: 'Closed' })
      progressBars.log(`CLOSED: ${clientName}`)
    })
  })
  return server
}

function serveFileUdp(serverPort: number, serverHost: string, fileToServe: string, params?: ServeFileParams): DatagramSocket {
  const chunkSize = params?.chunksize ?? UDP_DEFAULT_CHUNK_SIZE
  const delay = params?.delay ?? UDP_DEFAULT_DELAY

  if (!Number.isInteger(chunkSize) || chunkSize <= 0)
    throw new RangeError(`UDP chunk size must be a positive integer, got ${chunkSize}`)
  if (chunkSize > UDP_MAX_PAYLOAD)
    throw new RangeError(`UDP chunk size must not exceed ${UDP_MAX_PAYLOAD} bytes, got ${chunkSize}`)

  const target = params?.target
  if (target && (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535))
    throw new RangeError(`Target port must be an integer between 1 and 65535, got ${target.port}`)

  const port = serverPort ?? 7070
  const host = serverHost ?? '127.0.0.1'
  const file = fileToServe ?? '/tmp/file'

  const fileStat = fs.statSync(file)
  const fileSize = fileStat.size

  const socket = createSocket({
    type: host.includes(':')
      ? 'udp6'
      : 'udp4',
  })
  const progressBars = new ProgressBars()
  const activePeers = new Set<string>()

  // One transfer per peer. A peer that is already receiving is ignored.
  const serveToPeer = (peer: Pick<RemoteInfo, 'address' | 'port'>) => {
    const clientName = getPeerName(peer)
    if (activePeers.has(clientName))
      return
    activePeers.add(clientName)

    progressBars.add(clientName, Math.ceil(fileSize / chunkSize))

    const chunker = new DatagramChunker({
      file,
      chunkSize,
      delay,
      send: buffer => sendDatagram(socket, peer, buffer),
      progress: position => progressBars.increment(clientName, {
        humanSize: humanFileSize(position),
        status: 'Working',
      }),
      onComplete: () => {
        activePeers.delete(clientName)
        progressBars.update(clientName, { status: 'Done' })
        progressBars.log(`DONE: ${clientName}`)
      },
      onError: (error) => {
        activePeers.delete(clientName)
        progressBars.update(clientName, { status: 'Error' })
        progressBars.log(`ERROR: ${clientName} | ${errorMessage(error)}`)
      },
    })
    chunker.start()
  }

  socket.on('listening', () => {
    const address = socket.address()
    consola.start(`UDP File Server is running on ${address.address}:${address.port}`)
    consola.start(`Chunk Size: ${humanFileSize(chunkSize)} | Delay (between each chunk): ${delay} ms`)
    consola.success(`File: ${file} | Size: ${humanFileSize(fileSize)} \n`)
    if (target) {
      const peer = { address: target.host, port: target.port }
      consola.info(`Streaming to ${getPeerName(peer)} as soon as the socket is bound. Start the receiver first; datagrams sent before it binds are lost.`)
      serveToPeer(peer)
    }
    else {
      consola.info('Best-effort mode: send any datagram to start a stream. UDP can lose or reorder packets, so the received file is not guaranteed to be intact.')
    }
  })

  // Any datagram from a new peer starts one transfer to that peer.
  socket.on('message', (_message, peer) => {
    serveToPeer(peer)
  })

  // A datagram sent to a port nobody listens on can come back as ICMP port
  // unreachable, which Node reports as ECONNREFUSED on the bound socket. Keep
  // the server alive and report it.
  socket.on('error', (error) => {
    progressBars.log(`ERROR: server | ${errorMessage(error)}`)
  })

  socket.bind(port, host)
  return socket
}

function sendDatagram(socket: DatagramSocket, peer: Pick<RemoteInfo, 'address' | 'port'>, buffer: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    socket.send(buffer, peer.port, peer.address, (error) => {
      if (error)
        reject(error)
      else
        resolve()
    })
  })
}
