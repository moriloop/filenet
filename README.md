# filenet

A small network testing utility that serves a file over a socket in chunks, with a configurable chunk size and delay between chunks.

It is built for testing and debugging programs that read from sockets: you control how much data arrives at a time and how fast, so you can reproduce slow consumers, partial reads, backpressure, and multi-client behavior against a predictable stream. TCP is the default; UDP is available for best-effort datagram tests.

> TCP carries raw file bytes with no headers, framing, or handshake, so any client can read it. UDP is lossy by nature: it sends one chunk per datagram, has no EOF marker, and can lose or reorder packets. Do not use it when the received file has to be intact.

## Install

```bash
# npm
npm install -g filenet

# pnpm
pnpm install -g filenet
```

Run it with the `filenet` command, or without a global install with `npx filenet ...`.

## Serve a file

```bash
filenet serve /tmp/file.mp4
```

This listens on `0.0.0.0:6016`, sends 1 MiB chunks, and pauses 500 ms between chunks. Every client that connects receives the file independently, which makes it easy to run several test clients at once.

Read it back with any TCP client, for example `netcat`:

```bash
nc 127.0.0.1 6016 > file.mp4
```

The server keeps running until it is stopped.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--port` | `6016` | Port to listen on |
| `--udp` | `false` | Serve over UDP instead of TCP. Best-effort and lossy |
| `--host` | `0.0.0.0` (TCP), `127.0.0.1` (UDP) | Address to bind |
| `--chunksize` | `1M` (TCP), `1400` (UDP) | Size of each chunk. Accepts bytes or a `K`/`M`/`G` postfix, for example `10K`, `2M`, or `1.5G`. A UDP chunk must fit in one datagram, so it cannot exceed 65507 bytes |
| `--delay` | `500` (TCP), `0` (UDP) | Delay between chunks, in milliseconds |

### Example

```bash
filenet serve --chunksize 2M --delay 100 --host 127.0.0.1 --port 6016 /tmp/file.mp4
```

### Serve over UDP

```bash
filenet serve --udp --chunksize 1400 /tmp/file.mp4
```

UDP has no connections, so the client starts the transfer by sending any datagram. The server streams one chunk per datagram to that source address and port, then stops. There is no EOF datagram, no retransmission, and no ordering guarantee, so the receiver has to know how many bytes to expect or use an idle timeout.

```bash
printf 'go' | nc -u -w 1 127.0.0.1 6016 > file.mp4
```

Because `--udp` binds `127.0.0.1` by default, pass `--host 0.0.0.0` to make it reachable from other machines. Exposing UDP publicly is risky: one small datagram can make the server stream the whole file to a spoofed address (reflection/amplification). Only do that on a trusted network.

UDP defaults to 1400-byte chunks to stay below the common 1500-byte MTU, and to a 0 ms delay. The maximum chunk size is 65507 bytes, the largest IPv4 UDP payload.

## Use as a library

```bash
npm install filenet
```

Requires Node 22.12 or newer. The package is ESM-only; use `import`, not
`require`.

```ts
import { serveFile } from 'filenet'

const server = serveFile(6016, '0.0.0.0', '/tmp/file.mp4', {
  chunksize: 2 * 1024 * 1024, // bytes
  delay: 100, // milliseconds between chunks
  protocol: 'tcp', // 'tcp' (default) or 'udp'
})

// Stop accepting new connections when done.
server.close()
```

The library defaults differ from the CLI: 1 MiB chunks and a 1000 ms delay for TCP, 1400-byte chunks and a 0 ms delay for UDP. `serveFile` returns the underlying `net.Server` for TCP or `dgram.Socket` for UDP; it does not close active client connections for you. UDP has no connections, so a peer starts a transfer by sending any datagram to the bound port.
