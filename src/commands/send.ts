import process from 'node:process'
import { defineCommand } from 'citty'
import consola from 'consola'
import { sendFile } from '../core/send-file.js'
import { errorMessage, humanFileSizeToBytes, parseHostPort } from '../core/util.js'

const TCP_DEFAULT_CHUNK_SIZE = 1024 * 1024
const TCP_DEFAULT_DELAY = 500
const UDP_DEFAULT_CHUNK_SIZE = 1400
const UDP_DEFAULT_DELAY = 0

export default defineCommand({
  meta: {
    name: 'send',
    description: 'Send a file to a host:port',
  },
  args: {
    target: {
      type: 'string',
      required: true,
      description: 'host:port to send to, for example 192.168.1.50:9000 or [::1]:9000',
    },
    udp: {
      type: 'boolean',
      default: false,
      description: 'send over UDP instead of TCP (best-effort, lossy)',
    },
    tcp: {
      type: 'boolean',
      default: false,
      description: 'send over TCP (the default)',
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
  async run({ args }) {
    consola.debug('Send command running')
    consola.debug('Parsed args:', args)

    try {
      if (args.udp && args.tcp)
        throw new Error('Pass either --tcp or --udp, not both')

      const protocol = args.udp ? 'udp' : 'tcp'
      const defaultChunksize = protocol === 'udp'
        ? UDP_DEFAULT_CHUNK_SIZE
        : TCP_DEFAULT_CHUNK_SIZE
      const defaultDelay = protocol === 'udp'
        ? UDP_DEFAULT_DELAY
        : TCP_DEFAULT_DELAY
      const chunksize = args.chunksize === undefined
        ? defaultChunksize
        : humanFileSizeToBytes(args.chunksize)
      const delay = args.delay === undefined
        ? defaultDelay
        : Number.parseInt(args.delay)

      await sendFile(parseHostPort(args.target), args.file, {
        chunksize,
        delay,
        protocol,
      })
    }
    catch (error) {
      // citty prints the whole error object for anything that is not a
      // CLIError. A send failure is expected (refused port, bad target), so
      // report the message and exit non-zero without a stack trace.
      consola.error(errorMessage(error))
      process.exitCode = 1
    }
  },
})
