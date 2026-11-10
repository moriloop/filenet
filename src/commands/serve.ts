import { defineCommand } from 'citty'
import consola from 'consola'
import { serveFile } from '../core/server-file.js'
import { humanFileSizeToBytes } from '../core/util.js'

const TCP_DEFAULT_CHUNK_SIZE = 1024 * 1024
const TCP_DEFAULT_DELAY = 500
const UDP_DEFAULT_CHUNK_SIZE = 1400
const UDP_DEFAULT_DELAY = 0

export default defineCommand({
  meta: {
    name: 'serve',
    description: 'Serve the file from current directory to network',
  },
  args: {
    port: {
      type: 'string',
      default: '6016',
      description: 'server port',
    },
    udp: {
      type: 'boolean',
      default: false,
      description: 'serve over UDP instead of TCP (best-effort, lossy)',
    },
    host: {
      type: 'string',
      description: 'server host (default: 0.0.0.0 for TCP, 127.0.0.1 for UDP)',
    },
    chunksize: {
      type: 'string',
      description: 'Chunksize in bytes or with postfix K/M/G like 2M, 10K, 1.5M (default: 1M TCP, 1400 UDP)',
    },
    delay: {
      type: 'string',
      description: 'delay in ms (default: 500 TCP, 0 UDP)',
    },
    file: {
      type: 'positional',
      description: 'path to file',
      required: true,
    },
  },
  run({ args }) {
    consola.debug('Serve command running')
    consola.debug('Parsed args:', args)

    const protocol = args.udp ? 'udp' : 'tcp'
    const defaultHost = protocol === 'udp'
      ? '127.0.0.1'
      : '0.0.0.0'
    const defaultChunksize = protocol === 'udp'
      ? UDP_DEFAULT_CHUNK_SIZE
      : TCP_DEFAULT_CHUNK_SIZE
    const defaultDelay = protocol === 'udp'
      ? UDP_DEFAULT_DELAY
      : TCP_DEFAULT_DELAY
    const host = args.host ?? defaultHost
    const chunksize = args.chunksize === undefined
      ? defaultChunksize
      : humanFileSizeToBytes(args.chunksize)
    const delay = args.delay === undefined
      ? defaultDelay
      : Number.parseInt(args.delay)

    serveFile(Number.parseInt(args.port), host, args.file, {
      chunksize,
      delay,
      protocol,
    })
  },
})
