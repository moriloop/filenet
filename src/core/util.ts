import type { RemoteInfo } from 'node:dgram'
import type { Socket } from 'node:net'

export function humanFileSize(size: number) {
  const i = Math.floor(Math.log(size) / Math.log(1024))
  return `${(size / 1024 ** i).toFixed(2)} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`
}

export function humanFileSizeToBytes(fileSizeString: string) {
  const fileSize = Number.parseFloat(fileSizeString)
  const units = fileSizeString.trim().slice(-1)
  const multiplier = {
    K: 1024,
    M: 1024 * 1024,
    G: 1024 * 1024 * 1024,
    T: 1024 * 1024 * 1024 * 1024,
  }[units.toUpperCase()]

  return fileSize * (multiplier ?? 1)
}

export interface HostPort {
  host: string
  port: number
}

const BRACKETED_HOST_PORT = /^\[([^\]]+)\]:(\d+)$/

/** Parses `host:port` or `[ipv6]:port` into its parts. */
export function parseHostPort(value: string): HostPort {
  const trimmed = value.trim()
  const bracketed = BRACKETED_HOST_PORT.exec(trimmed)

  let host: string
  let portText: string

  if (bracketed) {
    host = bracketed[1]
    portText = bracketed[2]
  }
  else {
    const separator = trimmed.lastIndexOf(':')
    if (separator <= 0 || trimmed.startsWith('['))
      throw new Error(`Invalid target "${value}": expected host:port or [ipv6]:port`)
    host = trimmed.slice(0, separator)
    portText = trimmed.slice(separator + 1)
  }

  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new RangeError(`Invalid port in target "${value}": expected 1-65535`)

  return { host, port }
}

export function getSocketName(sock: Socket) {
  return `${sock.remoteAddress}:${sock.remotePort}`
}

export function getPeerName(peer: Pick<RemoteInfo, 'address' | 'port'>) {
  return `${peer.address}:${peer.port}`
}

/** One line description of a value caught in a `catch` block. */
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error)
}
