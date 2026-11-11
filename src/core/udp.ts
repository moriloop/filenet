/** Largest IPv4 UDP payload: 65535 - 20 (IP header) - 8 (UDP header). */
export const UDP_MAX_PAYLOAD = 65_507

/** Throws unless `chunkSize` fits in a single datagram. */
export function assertUdpChunkSize(chunkSize: number) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0)
    throw new RangeError(`UDP chunk size must be a positive integer, got ${chunkSize}`)
  if (chunkSize > UDP_MAX_PAYLOAD)
    throw new RangeError(`UDP chunk size must not exceed ${UDP_MAX_PAYLOAD} bytes, got ${chunkSize}`)
}
