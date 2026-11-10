import { createServer } from 'node:net'
import type { Socket } from 'node:net'
import fs from 'node:fs'
import consola from 'consola'
import { ProgressBars } from './progress-bars.js'
import { errorMessage, getSocketName, humanFileSize } from './util.js'
import { SocketChunker } from './socket-chunker.js'

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// })

export function serveFile(serverPort: number, serverHost: string, fileToServe: string, params?: { chunksize?: number, delay?: number }) {
  const chunkSize = params?.chunksize ?? 1 * 1024 * 1024
  const delay = params?.delay ?? 1000

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
        progress: humanSize => progressBars.increment(clientName, { humanSize: humanFileSize(humanSize), status: 'Working' }),
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
