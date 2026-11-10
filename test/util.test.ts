import type { Socket } from 'node:net'
import { describe, expect, it } from 'vitest'
import { errorMessage, getSocketName, humanFileSize, humanFileSizeToBytes } from '../src/core/util'

describe('humanFileSize', () => {
  it('formats sizes below 1 KiB as bytes', () => {
    expect(humanFileSize(1)).toBe('1.00 B')
    expect(humanFileSize(512)).toBe('512.00 B')
    expect(humanFileSize(1023)).toBe('1023.00 B')
  })

  it('steps up through the units', () => {
    expect(humanFileSize(1024)).toBe('1.00 KB')
    expect(humanFileSize(1536)).toBe('1.50 KB')
    expect(humanFileSize(1024 ** 2)).toBe('1.00 MB')
    expect(humanFileSize(1024 ** 3)).toBe('1.00 GB')
    expect(humanFileSize(1024 ** 4)).toBe('1.00 TB')
  })

  it('always uses two decimals', () => {
    expect(humanFileSize(1024 * 1024 * 2.5)).toBe('2.50 MB')
  })
})

describe('humanFileSizeToBytes', () => {
  it('treats a bare number as bytes', () => {
    expect(humanFileSizeToBytes('0')).toBe(0)
    expect(humanFileSizeToBytes('500')).toBe(500)
  })

  it('applies the K, M, G and T multipliers', () => {
    expect(humanFileSizeToBytes('10K')).toBe(10 * 1024)
    expect(humanFileSizeToBytes('2M')).toBe(2 * 1024 ** 2)
    expect(humanFileSizeToBytes('1G')).toBe(1024 ** 3)
    expect(humanFileSizeToBytes('1T')).toBe(1024 ** 4)
  })

  it('accepts lowercase units, decimals and surrounding whitespace', () => {
    expect(humanFileSizeToBytes('2m')).toBe(2 * 1024 ** 2)
    expect(humanFileSizeToBytes('1.5G')).toBe(1.5 * 1024 ** 3)
    expect(humanFileSizeToBytes(' 1g ')).toBe(1024 ** 3)
  })

  it('falls back to bytes for an unknown unit character', () => {
    expect(humanFileSizeToBytes('500B')).toBe(500)
    expect(humanFileSizeToBytes('500X')).toBe(500)
  })
})

describe('getSocketName', () => {
  it('joins the remote address and port', () => {
    const socket = { remoteAddress: '127.0.0.1', remotePort: 51714 } as unknown as Socket
    expect(getSocketName(socket)).toBe('127.0.0.1:51714')
  })
})

describe('errorMessage', () => {
  it('uses the message of an Error', () => {
    expect(errorMessage(new Error('read ECONNRESET'))).toBe('read ECONNRESET')
  })

  it('keeps the code of a system error', () => {
    const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
    error.code = 'ENOENT'
    expect(errorMessage(error)).toBe('ENOENT: no such file or directory')
  })

  it('falls back to a string for anything else', () => {
    expect(errorMessage('boom')).toBe('boom')
    expect(errorMessage(undefined)).toBe('undefined')
  })
})
